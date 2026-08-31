package auth

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"github.com/chochocookies/dineflow-backend/internal/entity"
)

var (
	ErrEmailTaken         = errors.New("email already registered")
	ErrNotFound           = errors.New("staff not found")
	ErrRestaurantNotFound = errors.New("restaurant not found")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateRestaurant(ctx context.Context, name string) (string, error) {
	var id string
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO restaurants (name) VALUES ($1) RETURNING id`, name,
	).Scan(&id)
	return id, err
}

// GetRestaurantByID powers both the public restaurant-landing-page lookup
// and the admin Settings page's "load my current profile" call — same row,
// same columns either way; RegisterPublicRestaurantRoutes vs. an
// authenticated route decides who's allowed to call it, not this method.
func (r *Repository) GetRestaurantByID(ctx context.Context, id string) (*entity.Restaurant, error) {
	var rst entity.Restaurant
	var description, address, phone sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, description, address, phone, created_at, updated_at FROM restaurants WHERE id = $1`, id,
	).Scan(&rst.ID, &rst.Name, &description, &address, &phone, &rst.CreatedAt, &rst.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrRestaurantNotFound
	}
	if err != nil {
		return nil, err
	}
	rst.Description = description.String
	rst.Address = address.String
	rst.Phone = phone.String
	return &rst, nil
}

// UpdateRestaurantDescription is deliberately narrow (just the one field)
// rather than a general-purpose restaurant update — name/address/phone
// aren't editable through the API yet at all, so there's no existing
// pattern for "update the rest of these fields too" to extend here.
func (r *Repository) UpdateRestaurantDescription(ctx context.Context, id, description string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE restaurants SET description = $1, updated_at = now() WHERE id = $2`,
		description, id,
	)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrRestaurantNotFound
	}
	return nil
}

func (r *Repository) CreateStaff(ctx context.Context, s *entity.Staff) (string, error) {
	var id string
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO staff (restaurant_id, name, email, password_hash, role)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		s.RestaurantID, s.Name, s.Email, s.PasswordHash, s.Role,
	).Scan(&id)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" { // unique_violation
			return "", ErrEmailTaken
		}
		return "", err
	}
	return id, nil
}

func (r *Repository) FindByEmail(ctx context.Context, email string) (*entity.Staff, error) {
	s := &entity.Staff{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, restaurant_id, name, email, password_hash, role, created_at, updated_at
		 FROM staff WHERE email = $1`, email,
	).Scan(&s.ID, &s.RestaurantID, &s.Name, &s.Email, &s.PasswordHash, &s.Role, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

// FindByID is used by the "create an additional restaurant" flow to look up
// the caller's own name/email/password hash to reuse for the new
// restaurant's owner account.
func (r *Repository) FindByID(ctx context.Context, id string) (*entity.Staff, error) {
	s := &entity.Staff{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, restaurant_id, name, email, password_hash, role, created_at, updated_at
		 FROM staff WHERE id = $1`, id,
	).Scan(&s.ID, &s.RestaurantID, &s.Name, &s.Email, &s.PasswordHash, &s.Role, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *Repository) ListByRestaurant(ctx context.Context, restaurantID string) ([]entity.Staff, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, restaurant_id, name, email, password_hash, role, created_at, updated_at
		 FROM staff WHERE restaurant_id = $1 ORDER BY created_at`, restaurantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	staff := []entity.Staff{}
	for rows.Next() {
		var s entity.Staff
		if err := rows.Scan(&s.ID, &s.RestaurantID, &s.Name, &s.Email, &s.PasswordHash, &s.Role, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		staff = append(staff, s)
	}
	return staff, rows.Err()
}

// ErrLastOwner guards against a restaurant ever ending up with zero
// owners, which would make it unmanageable — nobody left with permission
// to add staff, change the menu's sensitive settings, etc.
var ErrLastOwner = errors.New("cannot remove the only owner of a restaurant")

func (r *Repository) Delete(ctx context.Context, id, restaurantID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM staff
		 WHERE id = $1 AND restaurant_id = $2
		   AND (role != 'owner' OR (SELECT COUNT(*) FROM staff WHERE restaurant_id = $2 AND role = 'owner') > 1)`,
		id, restaurantID,
	)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		// Either the row doesn't exist (in any restaurant, or in a
		// different one than the caller's — never reveal that), or it was
		// the last owner and the WHERE clause's guard blocked the delete.
		existing, err := r.FindByID(ctx, id)
		if err != nil || existing.RestaurantID != restaurantID {
			return ErrNotFound
		}
		return ErrLastOwner
	}
	return nil
}

// ListRestaurants powers the public "choose your restaurant" listing — the
// customer-app alternative to scanning a table QR code directly.
func (r *Repository) ListRestaurants(ctx context.Context) ([]entity.Restaurant, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name, description, address, phone, created_at, updated_at FROM restaurants ORDER BY name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	restaurants := []entity.Restaurant{}
	for rows.Next() {
		var rst entity.Restaurant
		var description, address, phone sql.NullString
		if err := rows.Scan(&rst.ID, &rst.Name, &description, &address, &phone, &rst.CreatedAt, &rst.UpdatedAt); err != nil {
			return nil, err
		}
		rst.Description = description.String
		rst.Address = address.String
		rst.Phone = phone.String
		restaurants = append(restaurants, rst)
	}
	return restaurants, rows.Err()
}
