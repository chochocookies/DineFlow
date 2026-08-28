package entity

import "time"

type Menu struct {
	ID           string    `json:"id"`
	RestaurantID string    `json:"restaurant_id"`
	Category     string    `json:"category"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	Price        float64   `json:"price"`
	ImageURL     string    `json:"image_url,omitempty"`
	IsAvailable  bool      `json:"is_available"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
