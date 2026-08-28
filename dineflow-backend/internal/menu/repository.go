package menu

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"github.com/chochocookies/dineflow-backend/internal/entity"
)

var ErrNotFound = errors.New("menu not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *entity.Menu) (string, error) {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO menus (restaurant_id, category, name, description, price, image_url, is_available)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at, updated_at`,
		m.RestaurantID, m.Category, m.Name, m.Description, m.Price, m.ImageURL, m.IsAvailable,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
	return m.ID, err
}

// ListByRestaurant is intentionally scoped by restaurant_id on every query in
// this file — that's the tenant boundary. Every module added later should
// follow the same rule: never trust a caller-supplied restaurant_id, always
// use the one from the JWT (see handler.go).
func (r *Repository) ListByRestaurant(ctx context.Context, restaurantID string) ([]entity.Menu, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, restaurant_id, category, name, description, price, image_url, is_available, created_at, updated_at
		 FROM menus WHERE restaurant_id = $1 ORDER BY category, name`, restaurantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	menus := []entity.Menu{}
	for rows.Next() {
		var m entity.Menu
		if err := rows.Scan(&m.ID, &m.RestaurantID, &m.Category, &m.Name, &m.Description,
			&m.Price, &m.ImageURL, &m.IsAvailable, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		menus = append(menus, m)
	}
	return menus, rows.Err()
}

// ListAvailableByRestaurant is the customer-facing counterpart to
// ListByRestaurant: it hides items marked unavailable, unlike the staff
// management view which needs to see everything to toggle it back on.
func (r *Repository) ListAvailableByRestaurant(ctx context.Context, restaurantID string) ([]entity.Menu, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, restaurant_id, category, name, description, price, image_url, is_available, created_at, updated_at
		 FROM menus WHERE restaurant_id = $1 AND is_available = true ORDER BY category, name`, restaurantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	menus := []entity.Menu{}
	for rows.Next() {
		var m entity.Menu
		if err := rows.Scan(&m.ID, &m.RestaurantID, &m.Category, &m.Name, &m.Description,
			&m.Price, &m.ImageURL, &m.IsAvailable, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		menus = append(menus, m)
	}
	return menus, rows.Err()
}

// FindByIDs bulk-fetches menu items scoped to a restaurant — used by the
// order module to validate and price a customer's cart in one query instead
// of one round trip per line item.
func (r *Repository) FindByIDs(ctx context.Context, restaurantID string, ids []string) ([]entity.Menu, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, restaurant_id, category, name, description, price, image_url, is_available, created_at, updated_at
		 FROM menus WHERE restaurant_id = $1 AND id = ANY($2)`, restaurantID, pq.Array(ids),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	menus := []entity.Menu{}
	for rows.Next() {
		var m entity.Menu
		if err := rows.Scan(&m.ID, &m.RestaurantID, &m.Category, &m.Name, &m.Description,
			&m.Price, &m.ImageURL, &m.IsAvailable, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		menus = append(menus, m)
	}
	return menus, rows.Err()
}

func (r *Repository) FindByID(ctx context.Context, id, restaurantID string) (*entity.Menu, error) {
	var m entity.Menu
	err := r.db.QueryRowContext(ctx,
		`SELECT id, restaurant_id, category, name, description, price, image_url, is_available, created_at, updated_at
		 FROM menus WHERE id = $1 AND restaurant_id = $2`, id, restaurantID,
	).Scan(&m.ID, &m.RestaurantID, &m.Category, &m.Name, &m.Description,
		&m.Price, &m.ImageURL, &m.IsAvailable, &m.CreatedAt, &m.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) Update(ctx context.Context, m *entity.Menu) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE menus SET category = $1, name = $2, description = $3, price = $4,
		 image_url = $5, is_available = $6, updated_at = now()
		 WHERE id = $7 AND restaurant_id = $8`,
		m.Category, m.Name, m.Description, m.Price, m.ImageURL, m.IsAvailable, m.ID, m.RestaurantID,
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
		`DELETE FROM menus WHERE id = $1 AND restaurant_id = $2`, id, restaurantID,
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
