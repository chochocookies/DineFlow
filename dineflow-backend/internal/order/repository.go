package order

import (
	"context"
	"database/sql"
	"errors"

	"github.com/chochocookies/dineflow-backend/internal/entity"
)

var (
	ErrNotFound          = errors.New("order not found")
	ErrInsufficientStock = errors.New("insufficient stock for one or more items")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// InventoryDeduction is one ingredient to decrement, by however much this
// order's items require in total (already aggregated across all order
// lines by order.Service before calling Create).
type InventoryDeduction struct {
	IngredientID string
	Quantity     float64
}

// Create inserts the order, all of its items, and applies any inventory
// deductions — all inside a single transaction, so a stock shortfall rolls
// back the whole order rather than leaving a half-placed one behind. It
// also scans back the DB-generated id/created_at/updated_at into o and each
// item, so the struct returned to the caller already reflects the real row.
func (r *Repository) Create(ctx context.Context, o *entity.Order, deductions []InventoryDeduction) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op once Commit succeeds

	err = tx.QueryRowContext(ctx,
		`INSERT INTO orders (restaurant_id, table_id, order_code, status, payment_status, subtotal, tax, service_fee, total, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING id, created_at, updated_at`,
		o.RestaurantID, o.TableID, o.OrderCode, o.Status, o.PaymentStatus,
		o.Subtotal, o.Tax, o.ServiceFee, o.Total, o.Notes,
	).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return err
	}

	for i := range o.Items {
		item := &o.Items[i]
		item.OrderID = o.ID
		err = tx.QueryRowContext(ctx,
			`INSERT INTO order_items (order_id, menu_id, quantity, price, notes)
			 VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
			item.OrderID, item.MenuID, item.Quantity, item.Price, item.Notes,
		).Scan(&item.ID, &item.CreatedAt)
		if err != nil {
			return err
		}
	}

	// The >= quantity guard makes each line atomic against concurrent
	// orders; if any ingredient doesn't have enough left, RowsAffected is 0
	// and the whole transaction (order included) rolls back on return.
	for _, d := range deductions {
		res, err := tx.ExecContext(ctx,
			`UPDATE ingredients SET stock_quantity = stock_quantity - $1, updated_at = now()
			 WHERE id = $2 AND stock_quantity >= $1`,
			d.Quantity, d.IngredientID,
		)
		if err != nil {
			return err
		}
		rows, _ := res.RowsAffected()
		if rows == 0 {
			return ErrInsufficientStock
		}
	}

	return tx.Commit()
}

func (r *Repository) itemsByOrderID(ctx context.Context, orderID string) ([]entity.OrderItem, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT oi.id, oi.order_id, oi.menu_id, m.name, m.prep_time_minutes, oi.quantity, oi.price, oi.notes, oi.created_at
		 FROM order_items oi JOIN menus m ON m.id = oi.menu_id
		 WHERE oi.order_id = $1 ORDER BY oi.created_at`, orderID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []entity.OrderItem{}
	for rows.Next() {
		var it entity.OrderItem
		if err := rows.Scan(&it.ID, &it.OrderID, &it.MenuID, &it.MenuName, &it.PrepTimeMinutes,
			&it.Quantity, &it.Price, &it.Notes, &it.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

func (r *Repository) scanOrder(row *sql.Row) (*entity.Order, error) {
	var o entity.Order
	var paymentMethod, paymentReference sql.NullString
	var preparingStartedAt sql.NullTime
	err := row.Scan(&o.ID, &o.RestaurantID, &o.TableID, &o.OrderCode, &o.Status, &o.PaymentStatus,
		&o.Subtotal, &o.Tax, &o.ServiceFee, &o.Total, &o.Notes, &paymentMethod, &paymentReference,
		&preparingStartedAt, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	o.PaymentMethod = paymentMethod.String
	o.PaymentReference = paymentReference.String
	if preparingStartedAt.Valid {
		o.PreparingStartedAt = &preparingStartedAt.Time
	}
	return &o, nil
}

const orderColumns = `id, restaurant_id, table_id, order_code, status, payment_status, subtotal, tax, service_fee, total, notes, payment_method, payment_reference, preparing_started_at, created_at, updated_at`

// FindByCode is the public, unauthenticated lookup a customer uses to track
// their own order — the order_code (e.g. "DF3F9A2B") acts as a lightweight
// access key, similar to a guest-checkout confirmation number.
func (r *Repository) FindByCode(ctx context.Context, orderCode string) (*entity.Order, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+orderColumns+` FROM orders WHERE order_code = $1`, orderCode)
	o, err := r.scanOrder(row)
	if err != nil {
		return nil, err
	}
	items, err := r.itemsByOrderID(ctx, o.ID)
	if err != nil {
		return nil, err
	}
	o.Items = items
	return o, nil
}

func (r *Repository) FindByID(ctx context.Context, id, restaurantID string) (*entity.Order, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT `+orderColumns+` FROM orders WHERE id = $1 AND restaurant_id = $2`, id, restaurantID)
	o, err := r.scanOrder(row)
	if err != nil {
		return nil, err
	}
	items, err := r.itemsByOrderID(ctx, o.ID)
	if err != nil {
		return nil, err
	}
	o.Items = items
	return o, nil
}

// ListByRestaurant powers the staff order list / Kitchen Display's initial
// load. statusFilter is optional ("" means all statuses).
func (r *Repository) ListByRestaurant(ctx context.Context, restaurantID, statusFilter string) ([]entity.Order, error) {
	query := `SELECT ` + orderColumns + ` FROM orders WHERE restaurant_id = $1`
	args := []interface{}{restaurantID}
	if statusFilter != "" {
		query += ` AND status = $2`
		args = append(args, statusFilter)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := []entity.Order{}
	for rows.Next() {
		var o entity.Order
		var paymentMethod, paymentReference sql.NullString
		var preparingStartedAt sql.NullTime
		if err := rows.Scan(&o.ID, &o.RestaurantID, &o.TableID, &o.OrderCode, &o.Status, &o.PaymentStatus,
			&o.Subtotal, &o.Tax, &o.ServiceFee, &o.Total, &o.Notes, &paymentMethod, &paymentReference,
			&preparingStartedAt, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		o.PaymentMethod = paymentMethod.String
		o.PaymentReference = paymentReference.String
		if preparingStartedAt.Valid {
			o.PreparingStartedAt = &preparingStartedAt.Time
		}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// One extra query per order to load its items. Fine at MVP/kitchen-list
	// scale; if this list ever gets to hundreds of concurrent open orders,
	// switch to a single query joining order_items + json_agg instead.
	for i := range orders {
		items, err := r.itemsByOrderID(ctx, orders[i].ID)
		if err != nil {
			return nil, err
		}
		orders[i].Items = items
	}
	return orders, nil
}

// CountActiveByTable reports how many orders on tableID are still in a
// non-terminal status, other than excludeOrderID itself. order.Service uses
// this right after an order is completed/cancelled to decide whether the
// table's last active order just closed out — one table can run through
// several order rounds (e.g. starters ordered separately from mains), so a
// single completed order shouldn't free the table if another one on it is
// still open.
func (r *Repository) CountActiveByTable(ctx context.Context, tableID, excludeOrderID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM orders
		 WHERE table_id = $1 AND id != $2 AND status NOT IN ('completed', 'cancelled')`,
		tableID, excludeOrderID,
	).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id, restaurantID, status string) error {
	// isPreparing is computed here rather than as `$1 = 'preparing'` inside
	// the CASE below: reusing $1 in a second context (compared bare against
	// a string literal) made Postgres's parameter-type inference see two
	// different types for the same parameter — the status column's
	// `character varying` from the SET clause vs. `text` from the literal
	// comparison — and reject the query with "inconsistent types deduced
	// for parameter $1" the moment it went through the extended query
	// protocol (which is what database/sql always uses; psql -c with a
	// literal value never hits this, which is exactly why it looked fine
	// there). A dedicated, unambiguously-typed parameter sidesteps the
	// whole issue instead of fighting it with casts.
	isPreparing := status == "preparing"

	res, err := r.db.ExecContext(ctx,
		`UPDATE orders SET status = $1,
		 preparing_started_at = CASE
		     WHEN $4 AND preparing_started_at IS NULL THEN now()
		     ELSE preparing_started_at
		 END,
		 updated_at = now()
		 WHERE id = $2 AND restaurant_id = $3`,
		status, id, restaurantID, isPreparing,
	)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// UpdatePayment records payment_status (and optionally which method/
// gateway-reference) against an order. method/reference are passed through
// as-is — there's no enum for them since the exact vocabulary depends on
// whichever gateway is wired up (see pkg/paymentgateway).
func (r *Repository) UpdatePayment(ctx context.Context, id, restaurantID, status, method, reference string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE orders SET payment_status = $1, payment_method = NULLIF($2, ''), payment_reference = NULLIF($3, ''), updated_at = now()
		 WHERE id = $4 AND restaurant_id = $5`,
		status, method, reference, id, restaurantID,
	)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
