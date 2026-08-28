package order

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"strings"

	"github.com/chochocookies/dineflow-backend/internal/entity"
	"github.com/chochocookies/dineflow-backend/internal/menu"
	"github.com/chochocookies/dineflow-backend/internal/table"
	"github.com/chochocookies/dineflow-backend/pkg/ws"
)

var (
	ErrTableNotFound    = errors.New("table not found")
	ErrMenuNotFound     = errors.New("one or more menu items were not found")
	ErrMenuNotAvailable = errors.New("one or more menu items are not available")
	ErrInvalidStatus    = errors.New("invalid order status")
	ErrInvalidPayment   = errors.New("invalid payment status")
	ErrPaymentRequired  = errors.New("order must be marked paid before it can be completed")
)

// inventoryService is the slice of internal/inventory.Service that order
// needs — an interface here (instead of importing *inventory.Service
// directly) keeps this a one-way dependency and makes CreateOrder testable
// without a real inventory package.
type inventoryService interface {
	RecipesForMenus(ctx context.Context, menuIDs []string) (map[string][]entity.RecipeLine, error)
}

// Adjust to your local tax rate (e.g. PPN) and service policy. A future
// phase could make these per-restaurant settings instead of constants.
const (
	taxRate     = 0.10
	serviceRate = 0.05
)

var validStatuses = map[string]bool{
	string(entity.OrderPending):   true,
	string(entity.OrderConfirmed): true,
	string(entity.OrderPreparing): true,
	string(entity.OrderReady):     true,
	string(entity.OrderServed):    true,
	string(entity.OrderCompleted): true,
	string(entity.OrderCancelled): true,
}

var validPaymentStatuses = map[string]bool{
	string(entity.PaymentUnpaid):  true,
	string(entity.PaymentPending): true,
	string(entity.PaymentPaid):    true,
}

type Service struct {
	repo         *Repository
	tableSvc     *table.Service
	menuSvc      *menu.Service
	inventorySvc inventoryService
	hub          *ws.Hub
}

func NewService(repo *Repository, tableSvc *table.Service, menuSvc *menu.Service, inventorySvc inventoryService, hub *ws.Hub) *Service {
	return &Service{repo: repo, tableSvc: tableSvc, menuSvc: menuSvc, inventorySvc: inventorySvc, hub: hub}
}

// CreateOrder is the whole "core ordering loop" in one call: resolve the
// table from its QR token, validate + price every cart line against the
// real menu (never trust a client-supplied price), persist transactionally,
// mark the table occupied, and push a "new_order" event to the Kitchen
// Display over WebSocket.
func (s *Service) CreateOrder(ctx context.Context, req CreateOrderRequest) (*entity.Order, error) {
	tr, err := s.tableSvc.FindByQRToken(ctx, req.QRToken)
	if err != nil {
		if errors.Is(err, table.ErrNotFound) {
			return nil, ErrTableNotFound
		}
		return nil, err
	}
	restaurantID := tr.Table.RestaurantID

	menuIDs := make([]string, len(req.Items))
	for i, item := range req.Items {
		menuIDs[i] = item.MenuID
	}

	menus, err := s.menuSvc.FindByIDs(ctx, restaurantID, menuIDs)
	if err != nil {
		return nil, err
	}
	menuByID := make(map[string]entity.Menu, len(menus))
	for _, m := range menus {
		menuByID[m.ID] = m
	}

	items := make([]entity.OrderItem, 0, len(req.Items))
	var subtotal float64
	for _, in := range req.Items {
		m, ok := menuByID[in.MenuID]
		if !ok {
			return nil, ErrMenuNotFound
		}
		if !m.IsAvailable {
			return nil, ErrMenuNotAvailable
		}
		subtotal += m.Price * float64(in.Quantity)
		items = append(items, entity.OrderItem{
			MenuID:   m.ID,
			MenuName: m.Name,
			Quantity: in.Quantity,
			Price:    m.Price, // snapshot at order time; menu price may change later
			Notes:    in.Notes,
		})
	}

	tax := math.Round(subtotal * taxRate)
	svcFee := math.Round(subtotal * serviceRate)

	code, err := generateOrderCode()
	if err != nil {
		return nil, err
	}

	o := &entity.Order{
		RestaurantID:  restaurantID,
		TableID:       tr.Table.ID,
		OrderCode:     code,
		Status:        entity.OrderPending,
		PaymentStatus: entity.PaymentUnpaid,
		Subtotal:      subtotal,
		Tax:           tax,
		ServiceFee:    svcFee,
		Total:         subtotal + tax + svcFee,
		Notes:         req.Notes,
		Items:         items,
	}

	// Menus without a recipe defined (the common case unless you've set one
	// up via PUT /menus/:id/recipe) simply contribute no deductions — recipe
	// tracking is opt-in per menu item, not required.
	deductions, err := s.planInventoryDeductions(ctx, menuIDs, req.Items)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Create(ctx, o, deductions); err != nil {
		if errors.Is(err, ErrInsufficientStock) {
			return nil, ErrInsufficientStock
		}
		return nil, err
	}

	// Best-effort: the order itself already succeeded, so a failure to flip
	// the table's status shouldn't fail the whole request.
	_ = s.tableSvc.MarkOccupied(ctx, tr.Table.ID, restaurantID)

	s.broadcast(restaurantID, "new_order", o)

	return o, nil
}

// planInventoryDeductions looks up each ordered menu's recipe and sums how
// much of each ingredient the whole cart needs. A menu with no recipe rows
// contributes nothing — inventory tracking is opt-in per menu item.
func (s *Service) planInventoryDeductions(ctx context.Context, menuIDs []string, items []CreateOrderItemInput) ([]InventoryDeduction, error) {
	recipes, err := s.inventorySvc.RecipesForMenus(ctx, menuIDs)
	if err != nil {
		return nil, err
	}
	if len(recipes) == 0 {
		return nil, nil
	}

	needed := make(map[string]float64)
	for _, in := range items {
		for _, line := range recipes[in.MenuID] {
			needed[line.IngredientID] += line.QuantityPerUnit * float64(in.Quantity)
		}
	}

	deductions := make([]InventoryDeduction, 0, len(needed))
	for ingredientID, qty := range needed {
		deductions = append(deductions, InventoryDeduction{IngredientID: ingredientID, Quantity: qty})
	}
	return deductions, nil
}

func (s *Service) GetByCode(ctx context.Context, code string) (*entity.Order, error) {
	return s.repo.FindByCode(ctx, code)
}

func (s *Service) Get(ctx context.Context, id, restaurantID string) (*entity.Order, error) {
	return s.repo.FindByID(ctx, id, restaurantID)
}

func (s *Service) List(ctx context.Context, restaurantID, statusFilter string) ([]entity.Order, error) {
	return s.repo.ListByRestaurant(ctx, restaurantID, statusFilter)
}

// UpdateStatus is what the Kitchen Display / cashier screen calls as an
// order moves pending -> confirmed -> preparing -> ready -> served ->
// completed (or cancelled). Every transition broadcasts to the same
// restaurant room so every connected screen stays in sync.
//
// One business rule is enforced here: an order can't be marked "completed"
// until it's actually been paid — mirrors how a real POS won't let you
// close out an unpaid ticket. Every other transition is unrestricted at
// this phase.
func (s *Service) UpdateStatus(ctx context.Context, id, restaurantID string, req UpdateOrderStatusRequest) (*entity.Order, error) {
	if !validStatuses[req.Status] {
		return nil, ErrInvalidStatus
	}

	if req.Status == string(entity.OrderCompleted) {
		current, err := s.repo.FindByID(ctx, id, restaurantID)
		if err != nil {
			return nil, err
		}
		if current.PaymentStatus != entity.PaymentPaid {
			return nil, ErrPaymentRequired
		}
	}

	if err := s.repo.UpdateStatus(ctx, id, restaurantID, req.Status); err != nil {
		return nil, err
	}
	o, err := s.repo.FindByID(ctx, id, restaurantID)
	if err != nil {
		return nil, err
	}
	s.broadcast(restaurantID, "order_status_updated", o)

	// A completed or cancelled order is done occupying its table — but only
	// once every order on that table has reached one of those two terminal
	// states, since one table can run through several order rounds. This is
	// what used to be missing: an order marked "completed" (cash or QRIS,
	// either way) never flipped its table back to "available", so it stayed
	// stuck "occupied" until someone fixed it by hand.
	if o.Status == entity.OrderCompleted || o.Status == entity.OrderCancelled {
		if remaining, err := s.repo.CountActiveByTable(ctx, o.TableID, o.ID); err == nil && remaining == 0 {
			if err := s.tableSvc.MarkAvailable(ctx, o.TableID, restaurantID); err == nil {
				if t, err := s.tableSvc.Get(ctx, o.TableID, restaurantID); err == nil {
					s.broadcast(restaurantID, "table_status_updated", t)
				}
			}
		}
	}

	return o, nil
}

// UpdatePayment is the "simulated" payment confirmation for this phase — a
// cashier marks cash/QRIS as received by hand. Phase 5 replaces the manual
// call to this from a handler with a call from a payment gateway's webhook
// instead; the method/service/broadcast logic underneath stays the same.
func (s *Service) UpdatePayment(ctx context.Context, id, restaurantID string, req UpdatePaymentRequest) (*entity.Order, error) {
	if !validPaymentStatuses[req.PaymentStatus] {
		return nil, ErrInvalidPayment
	}
	if err := s.repo.UpdatePayment(ctx, id, restaurantID, req.PaymentStatus, req.PaymentMethod, req.PaymentReference); err != nil {
		return nil, err
	}
	o, err := s.repo.FindByID(ctx, id, restaurantID)
	if err != nil {
		return nil, err
	}
	s.broadcast(restaurantID, "order_payment_updated", o)
	return o, nil
}

func (s *Service) broadcast(restaurantID, event string, data interface{}) {
	if s.hub == nil {
		return
	}
	payload, err := json.Marshal(map[string]interface{}{"event": event, "data": data})
	if err != nil {
		return
	}
	s.hub.Broadcast(restaurantID, payload)
}

func generateOrderCode() (string, error) {
	b := make([]byte, 3)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "DF" + strings.ToUpper(hex.EncodeToString(b)), nil
}
