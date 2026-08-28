package entity

import "time"

type Ingredient struct {
	ID            string    `json:"id"`
	RestaurantID  string    `json:"restaurant_id"`
	Name          string    `json:"name"`
	Unit          string    `json:"unit"`
	StockQuantity float64   `json:"stock_quantity"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// RecipeLine is one ingredient's requirement to make one unit of a menu
// item — e.g. "Nasi Goreng needs 150g of Rice".
type RecipeLine struct {
	IngredientID    string  `json:"ingredient_id"`
	IngredientName  string  `json:"ingredient_name,omitempty"`
	Unit            string  `json:"unit,omitempty"`
	QuantityPerUnit float64 `json:"quantity_per_unit"`
}
