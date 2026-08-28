package table

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"github.com/chochocookies/dineflow-backend/internal/entity"
)

var (
	ErrNotFound  = errors.New("table not found")
	ErrCodeTaken = errors.New("a table with this code already exists")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, t *entity.Table) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO tables (restaurant_id, code, qr_token, status)
		 VALUES ($1, $2, $3, $4) RETURNING id, created_at, updated_at`,
		t.RestaurantID, t.Code, t.QRToken, t.Status,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" { // unique_violation
			return ErrCodeTaken
		}
		return err
	}
	return nil
}

func (r *Repository) ListByRestaurant(ctx context.Context, restaurantID string) ([]entity.Table, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, restaurant_id, code, qr_token, status, created_at, updated_at
		 FROM tables WHERE restaurant_id = $1 ORDER BY code`, restaurantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := []entity.Table{}
	for rows.Next() {
		var t entity.Table
		if err := rows.Scan(&t.ID, &t.RestaurantID, &t.Code, &t.QRToken, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tables = append(tables, t)
	}
	return tables, rows.Err()
}

func (r *Repository) FindByID(ctx context.Context, id, restaurantID string) (*entity.Table, error) {
	var t entity.Table
	err := r.db.QueryRowContext(ctx,
		`SELECT id, restaurant_id, code, qr_token, status, created_at, updated_at
		 FROM tables WHERE id = $1 AND restaurant_id = $2`, id, restaurantID,
	).Scan(&t.ID, &t.RestaurantID, &t.Code, &t.QRToken, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// TableWithRestaurant is what a customer gets back right after scanning a
// QR code — everything the ordering page needs from a single request.
type TableWithRestaurant struct {
	Table          entity.Table `json:"table"`
	RestaurantName string       `json:"restaurant_name"`
}

func (r *Repository) FindByQRToken(ctx context.Context, qrToken string) (*TableWithRestaurant, error) {
	var t entity.Table
	var restaurantName string
	err := r.db.QueryRowContext(ctx,
		`SELECT t.id, t.restaurant_id, t.code, t.qr_token, t.status, t.created_at, t.updated_at, r.name
		 FROM tables t JOIN restaurants r ON r.id = t.restaurant_id
		 WHERE t.qr_token = $1`, qrToken,
	).Scan(&t.ID, &t.RestaurantID, &t.Code, &t.QRToken, &t.Status, &t.CreatedAt, &t.UpdatedAt, &restaurantName)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &TableWithRestaurant{Table: t, RestaurantName: restaurantName}, nil
}

func (r *Repository) Update(ctx context.Context, t *entity.Table) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE tables SET code = $1, status = $2, updated_at = now() WHERE id = $3 AND restaurant_id = $4`,
		t.Code, t.Status, t.ID, t.RestaurantID,
	)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return ErrCodeTaken
		}
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id, restaurantID, status string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE tables SET status = $1, updated_at = now() WHERE id = $2 AND restaurant_id = $3`,
		status, id, restaurantID,
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

func (r *Repository) Delete(ctx context.Context, id, restaurantID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM tables WHERE id = $1 AND restaurant_id = $2`, id, restaurantID,
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
