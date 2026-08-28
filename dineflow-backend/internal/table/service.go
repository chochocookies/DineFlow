package table

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	"github.com/chochocookies/dineflow-backend/internal/entity"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// Create makes a new table and its QR token. The frontend turns
// {qr_token} into a printable QR code that encodes a URL like
// https://your-frontend/order/{qr_token} — scanning it is what a customer
// uses to reach the public menu/order endpoints with no login required.
func (s *Service) Create(ctx context.Context, restaurantID string, req CreateTableRequest) (*entity.Table, error) {
	token, err := generateQRToken()
	if err != nil {
		return nil, err
	}

	t := &entity.Table{
		RestaurantID: restaurantID,
		Code:         req.Code,
		QRToken:      token,
		Status:       entity.TableAvailable,
	}
	if err := s.repo.Create(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *Service) List(ctx context.Context, restaurantID string) ([]entity.Table, error) {
	return s.repo.ListByRestaurant(ctx, restaurantID)
}

func (s *Service) Get(ctx context.Context, id, restaurantID string) (*entity.Table, error) {
	return s.repo.FindByID(ctx, id, restaurantID)
}

func (s *Service) FindByQRToken(ctx context.Context, qrToken string) (*TableWithRestaurant, error) {
	return s.repo.FindByQRToken(ctx, qrToken)
}

func (s *Service) Update(ctx context.Context, id, restaurantID string, req UpdateTableRequest) (*entity.Table, error) {
	t, err := s.repo.FindByID(ctx, id, restaurantID)
	if err != nil {
		return nil, err
	}
	if req.Code != nil {
		t.Code = *req.Code
	}
	if req.Status != nil {
		t.Status = entity.TableStatus(*req.Status)
	}
	if err := s.repo.Update(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

// MarkOccupied is called by the order module right after a customer places
// an order on this table.
func (s *Service) MarkOccupied(ctx context.Context, id, restaurantID string) error {
	return s.repo.UpdateStatus(ctx, id, restaurantID, string(entity.TableOccupied))
}

// MarkAvailable is called by the order module once a table's last active
// order has been completed or cancelled, freeing the table up for the next
// customers. See order.Service.UpdateStatus for the "last active order"
// check that guards this.
func (s *Service) MarkAvailable(ctx context.Context, id, restaurantID string) error {
	return s.repo.UpdateStatus(ctx, id, restaurantID, string(entity.TableAvailable))
}

func (s *Service) Delete(ctx context.Context, id, restaurantID string) error {
	return s.repo.Delete(ctx, id, restaurantID)
}

func generateQRToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
