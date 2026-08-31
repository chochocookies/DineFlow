package menu

// CreateMenuRequest is intentionally flat (no variants/addons yet — that's a
// Scale Up-phase addition once the core ordering loop is proven).
type CreateMenuRequest struct {
	Category    string  `json:"category" binding:"required"`
	Name        string  `json:"name" binding:"required,min=2"`
	Description string  `json:"description"`
	Price       float64 `json:"price" binding:"required,gt=0"`
	ImageURL    string  `json:"image_url"`
	// Optional on purpose — 0/omitted falls back to a 15-minute default in
	// Service.Create rather than binding:"required", so existing API
	// clients built before this field existed don't suddenly start
	// getting validation errors.
	PrepTimeMinutes int `json:"prep_time_minutes" binding:"omitempty,gt=0"`
}

// UpdateMenuRequest uses pointers so a client can patch just one field
// (e.g. only is_available) without resending the whole menu.
type UpdateMenuRequest struct {
	Category        *string  `json:"category"`
	Name            *string  `json:"name"`
	Description     *string  `json:"description"`
	Price           *float64 `json:"price"`
	ImageURL        *string  `json:"image_url"`
	IsAvailable     *bool    `json:"is_available"`
	PrepTimeMinutes *int     `json:"prep_time_minutes"`
}
