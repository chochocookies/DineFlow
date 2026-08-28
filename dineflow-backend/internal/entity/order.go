package entity

import "time"

// OrderStatus follows the kitchen/serving lifecycle from the DineFlow concept:
// pending -> confirmed -> preparing -> ready -> served -> completed
// (or cancelled at any point before preparing).
type OrderStatus string

const (
	OrderPending   OrderStatus = "pending"
	OrderConfirmed OrderStatus = "confirmed"
	OrderPreparing OrderStatus = "preparing"
	OrderReady     OrderStatus = "ready"
	OrderServed    OrderStatus = "served"
	OrderCompleted OrderStatus = "completed"
	OrderCancelled OrderStatus = "cancelled"
)

type PaymentStatus string

const (
	PaymentUnpaid  PaymentStatus = "unpaid"
	PaymentPending PaymentStatus = "pending"
	PaymentPaid    PaymentStatus = "paid"
)

// Order and OrderItem are defined now so the schema/entities are ready, but
// their repository/service/handler (plus the WebSocket push to the Kitchen
// Display) are built in Phase 2 — see the "menu" module for the pattern to
// follow.
type Order struct {
	ID               string        `json:"id"`
	RestaurantID     string        `json:"restaurant_id"`
	TableID          string        `json:"table_id"`
	OrderCode        string        `json:"order_code"`
	Status           OrderStatus   `json:"status"`
	PaymentStatus    PaymentStatus `json:"payment_status"`
	Subtotal         float64       `json:"subtotal"`
	Tax              float64       `json:"tax"`
	ServiceFee       float64       `json:"service_fee"`
	Total            float64       `json:"total"`
	Notes            string        `json:"notes,omitempty"`
	PaymentMethod    string        `json:"payment_method,omitempty"`
	PaymentReference string        `json:"payment_reference,omitempty"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
	Items            []OrderItem   `json:"items,omitempty"`
}

type OrderItem struct {
	ID        string    `json:"id"`
	OrderID   string    `json:"order_id"`
	MenuID    string    `json:"menu_id"`
	MenuName  string    `json:"menu_name,omitempty"`
	Quantity  int       `json:"quantity"`
	Price     float64   `json:"price"`
	Notes     string    `json:"notes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
