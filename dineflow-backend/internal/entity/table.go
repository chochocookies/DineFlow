package entity

import "time"

type TableStatus string

const (
	TableAvailable      TableStatus = "available"
	TableOccupied       TableStatus = "occupied"
	TableWaitingPayment TableStatus = "waiting_payment"
)

// Table represents a physical dining table ("meja"). QRToken is the opaque
// value encoded into the table's printed QR code — customers scanning it hit
// a public route like /order/t/{qr_token} with no login required.
type Table struct {
	ID           string      `json:"id"`
	RestaurantID string      `json:"restaurant_id"`
	Code         string      `json:"code"`
	QRToken      string      `json:"qr_token"`
	Status       TableStatus `json:"status"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}
