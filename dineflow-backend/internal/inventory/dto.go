package inventory

type CreateIngredientRequest struct {
	Name          string  `json:"name" binding:"required,min=2"`
	Unit          string  `json:"unit" binding:"required"`
	StockQuantity float64 `json:"stock_quantity" binding:"gte=0"`
}

type UpdateIngredientRequest struct {
	Name          *string  `json:"name"`
	Unit          *string  `json:"unit"`
	StockQuantity *float64 `json:"stock_quantity"`
}

// AdjustStockRequest is for restocking (positive delta) or manual
// corrections/waste (negative delta) — the auto-deduction on order
// creation goes through order.Service instead, not this endpoint.
type AdjustStockRequest struct {
	Delta  float64 `json:"delta" binding:"required"`
	Reason string  `json:"reason"`
}

type SetRecipeRequest struct {
	Items []RecipeItemInput `json:"items" binding:"dive"`
}

type RecipeItemInput struct {
	IngredientID    string  `json:"ingredient_id" binding:"required"`
	QuantityPerUnit float64 `json:"quantity_per_unit" binding:"required,gt=0"`
}
