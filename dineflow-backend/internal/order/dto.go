package order

type CreateOrderItemInput struct {
	MenuID   string `json:"menu_id" binding:"required"`
	Quantity int    `json:"quantity" binding:"required,gt=0"`
	Notes    string `json:"notes"`
}

// CreateOrderRequest is what a customer's ordering page submits after
// scanning a table's QR code — QRToken is how we recover which restaurant
// and table this order belongs to, with no login involved.
type CreateOrderRequest struct {
	QRToken string                 `json:"qr_token" binding:"required"`
	Items   []CreateOrderItemInput `json:"items" binding:"required,min=1,dive"`
	Notes   string                 `json:"notes"`
}

type UpdateOrderStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// UpdatePaymentRequest records a payment against an order. This is a manual
// simulation for now (staff confirms cash/QRIS was received) — Phase 5
// swaps PaymentMethod's free-form string for a real gateway webhook.
type UpdatePaymentRequest struct {
	PaymentStatus    string `json:"payment_status" binding:"required"`
	PaymentMethod    string `json:"payment_method"`
	PaymentReference string `json:"payment_reference"`
}
