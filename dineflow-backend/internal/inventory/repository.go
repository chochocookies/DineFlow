package inventory

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"github.com/chochocookies/dineflow-backend/internal/entity"
)

var (
	ErrNotFound        = errors.New("ingredient not found")
	ErrNameTaken       = errors.New("an ingredient with this name already exists")
	ErrWouldGoNegative = errors.New("adjustment would make stock negative")
	ErrInUse           = errors.New("ingredient is used in one or more menu recipes")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, i *entity.Ingredient) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO ingredients (restaurant_id, name, unit, stock_quantity)
		 VALUES ($1, $2, $3, $4) RETURNING id, created_at, updated_at`,
		i.RestaurantID, i.Name, i.Unit, i.StockQuantity,
	).Scan(&i.ID, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return ErrNameTaken
		}
		return err
	}
	return nil
}

func (r *Repository) ListByRestaurant(ctx context.Context, restaurantID string) ([]entity.Ingredient, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, restaurant_id, name, unit, stock_quantity, created_at, updated_at
		 FROM ingredients WHERE restaurant_id = $1 ORDER BY name`, restaurantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []entity.Ingredient{}
	for rows.Next() {
		var i entity.Ingredient
		if err := rows.Scan(&i.ID, &i.RestaurantID, &i.Name, &i.Unit, &i.StockQuantity, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func (r *Repository) FindByID(ctx context.Context, id, restaurantID string) (*entity.Ingredient, error) {
	var i entity.Ingredient
	err := r.db.QueryRowContext(ctx,
		`SELECT id, restaurant_id, name, unit, stock_quantity, created_at, updated_at
		 FROM ingredients WHERE id = $1 AND restaurant_id = $2`, id, restaurantID,
	).Scan(&i.ID, &i.RestaurantID, &i.Name, &i.Unit, &i.StockQuantity, &i.CreatedAt, &i.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &i, nil
}

func (r *Repository) Update(ctx context.Context, i *entity.Ingredient) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE ingredients SET name = $1, unit = $2, stock_quantity = $3, updated_at = now()
		 WHERE id = $4 AND restaurant_id = $5`,
		i.Name, i.Unit, i.StockQuantity, i.ID, i.RestaurantID,
	)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return ErrNameTaken
		}
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// AdjustStock applies delta atomically (stock_quantity = stock_quantity +
// delta) with the >= 0 guard built into the WHERE clause, so two concurrent
// adjustments can never push stock negative between them.
func (r *Repository) AdjustStock(ctx context.Context, id, restaurantID string, delta float64) (*entity.Ingredient, error) {
	res, err := r.db.ExecContext(ctx,
		`UPDATE ingredients SET stock_quantity = stock_quantity + $1, updated_at = now()
		 WHERE id = $2 AND restaurant_id = $3 AND stock_quantity + $1 >= 0`,
		delta, id, restaurantID,
	)
	if err != nil {
		return nil, err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		// Distinguish "doesn't exist" from "would go negative" for a
		// clearer error — this extra lookup only happens on the error path.
		if _, err := r.FindByID(ctx, id, restaurantID); err != nil {
			return nil, err
		}
		return nil, ErrWouldGoNegative
	}
	return r.FindByID(ctx, id, restaurantID)
}

func (r *Repository) Delete(ctx context.Context, id, restaurantID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM ingredients WHERE id = $1 AND restaurant_id = $2`, id, restaurantID,
	)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23503" { // foreign_key_violation
			// menu_ingredients.ingredient_id is ON DELETE RESTRICT on
			// purpose (see migration 000010) — deleting an ingredient
			// should never silently change what a menu's recipe requires.
			return ErrInUse
		}
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) GetRecipe(ctx context.Context, menuID string) ([]entity.RecipeLine, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT mi.ingredient_id, i.name, i.unit, mi.quantity_per_unit
		 FROM menu_ingredients mi JOIN ingredients i ON i.id = mi.ingredient_id
		 WHERE mi.menu_id = $1 ORDER BY i.name`, menuID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lines := []entity.RecipeLine{}
	for rows.Next() {
		var l entity.RecipeLine
		if err := rows.Scan(&l.IngredientID, &l.IngredientName, &l.Unit, &l.QuantityPerUnit); err != nil {
			return nil, err
		}
		lines = append(lines, l)
	}
	return lines, rows.Err()
}

// SetRecipe replaces a menu's whole recipe (delete + reinsert in one
// transaction) rather than patching individual lines — simpler to reason
// about from a form that edits "the recipe" as a single list.
func (r *Repository) SetRecipe(ctx context.Context, menuID string, items []RecipeItemInput) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck

	if _, err := tx.ExecContext(ctx, `DELETE FROM menu_ingredients WHERE menu_id = $1`, menuID); err != nil {
		return err
	}
	for _, item := range items {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO menu_ingredients (menu_id, ingredient_id, quantity_per_unit) VALUES ($1, $2, $3)`,
			menuID, item.IngredientID, item.QuantityPerUnit,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// RecipesForMenus batch-loads recipes for several menus at once — used by
// order.Service when checking out a cart with multiple different items.
func (r *Repository) RecipesForMenus(ctx context.Context, menuIDs []string) (map[string][]entity.RecipeLine, error) {
	result := make(map[string][]entity.RecipeLine)
	if len(menuIDs) == 0 {
		return result, nil
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT menu_id, ingredient_id, quantity_per_unit FROM menu_ingredients WHERE menu_id = ANY($1)`,
		pq.Array(menuIDs),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var menuID string
		var line entity.RecipeLine
		if err := rows.Scan(&menuID, &line.IngredientID, &line.QuantityPerUnit); err != nil {
			return nil, err
		}
		result[menuID] = append(result[menuID], line)
	}
	return result, rows.Err()
}
