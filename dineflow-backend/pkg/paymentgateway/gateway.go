// Package paymentgateway is the seam between DineFlow's order flow and
// whichever payment provider is actually wired up. Swapping providers (or
// adding a second one, e.g. Xendit) means writing one more implementation
// of Gateway — nothing in internal/payment or internal/order needs to
// change.
package paymentgateway

import (
	"context"
	"errors"
)

var ErrInvalidSignature = errors.New("invalid webhook signature")

type QRISCharge struct {
	OrderID    string `json:"order_id"`
	QRImageURL string `json:"qr_image_url,omitempty"`
	QRString   string `json:"qr_string,omitempty"`
	GatewayRef string `json:"gateway_ref,omitempty"`
}

// WebhookEvent is the normalized shape every Gateway implementation parses
// its provider-specific payload into, so internal/payment only has to
// handle one shape regardless of which provider sent it.
type WebhookEvent struct {
	OrderID           string
	GatewayRef        string
	TransactionStatus string
	GrossAmount       float64
	PaymentType       string
	Raw               map[string]interface{}
}

type Gateway interface {
	// CreateQRISCharge asks the provider to generate a QRIS code for an
	// order. The customer scans QRImageURL (or renders QRString as their
	// own QR code) to pay.
	CreateQRISCharge(ctx context.Context, orderCode string, amount float64) (*QRISCharge, error)

	// ParseWebhook verifies the payload's authenticity (signature/secret —
	// implementation-specific) and normalizes it. Returns
	// ErrInvalidSignature if the payload can't be trusted.
	ParseWebhook(payload map[string]interface{}) (*WebhookEvent, error)

	// IsPaid reports whether a webhook's TransactionStatus represents a
	// successful, settled payment — the exact status vocabulary is
	// provider-specific, so this stays behind the interface too.
	IsPaid(transactionStatus string) bool
}
