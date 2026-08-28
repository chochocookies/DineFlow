// Package mock implements paymentgateway.Gateway with no network calls and
// no real credentials — for local development, or for testing the webhook
// flow with a hand-built payload before you have real sandbox keys.
//
// It does no signature verification at all, since there's no real secret to
// check a payload against. Never wire this gateway up outside local dev.
package mock

import (
	"context"

	"github.com/chochocookies/dineflow-backend/pkg/paymentgateway"
)

type Gateway struct{}

func New() *Gateway { return &Gateway{} }

func (g *Gateway) CreateQRISCharge(_ context.Context, orderCode string, _ float64) (*paymentgateway.QRISCharge, error) {
	return &paymentgateway.QRISCharge{
		OrderID:    orderCode,
		QRString:   "MOCK-QRIS-PAYLOAD-" + orderCode, // not a real QRIS payload, just a placeholder
		GatewayRef: "mock-" + orderCode,
	}, nil
}

// ParseWebhook trusts whatever it's given — see the package doc. Send it a
// payload shaped like:
//
//	{"order_id": "...", "transaction_status": "settlement", "gross_amount": 65550, "payment_type": "qris"}
func (g *Gateway) ParseWebhook(payload map[string]interface{}) (*paymentgateway.WebhookEvent, error) {
	orderID, _ := payload["order_id"].(string)
	status, _ := payload["transaction_status"].(string)
	amount, _ := payload["gross_amount"].(float64)
	paymentType, _ := payload["payment_type"].(string)

	return &paymentgateway.WebhookEvent{
		OrderID:           orderID,
		GatewayRef:        "mock-" + orderID,
		TransactionStatus: status,
		GrossAmount:       amount,
		PaymentType:       paymentType,
		Raw:               payload,
	}, nil
}

func (g *Gateway) IsPaid(status string) bool {
	return status == "settlement"
}

// SimulatePayload builds a payload shaped exactly like the one ParseWebhook
// expects above — used by internal/payment's dev-only "simulate payment"
// route so local testing drives the order through the real
// ParseWebhook -> IsPaid -> UpdatePayment path instead of a shortcut that
// skips it. This is what lets you "pay via QRIS" end-to-end on localhost
// with no real gateway and no hand-built curl request to /payments/webhook.
func (g *Gateway) SimulatePayload(orderCode string, amount float64) map[string]interface{} {
	return map[string]interface{}{
		"order_id":           orderCode,
		"transaction_status": "settlement",
		"gross_amount":       amount,
		"payment_type":       "qris",
	}
}
