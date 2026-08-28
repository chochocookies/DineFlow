// Package midtrans implements paymentgateway.Gateway against Midtrans's
// Core API (https://api-docs.midtrans.com/), which is by far the most
// common payment gateway for Indonesian QRIS integrations.
//
// IMPORTANT: this was written and code-reviewed against Midtrans's
// documented API contract, but the actual outbound HTTP call to
// api.sandbox.midtrans.com has NOT been exercised — the sandbox this
// project was built in can't reach that host. Test CreateQRISCharge against
// a real sandbox Server Key before relying on it; the webhook signature
// verification below has no such caveat since it needs no network call and
// was tested with a hand-built payload (see README).
package midtrans

import (
	"bytes"
	"context"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/chochocookies/dineflow-backend/pkg/paymentgateway"
)

const (
	sandboxBaseURL    = "https://api.sandbox.midtrans.com"
	productionBaseURL = "https://api.midtrans.com"
)

type Gateway struct {
	serverKey  string
	baseURL    string
	httpClient *http.Client
}

func New(serverKey string, isProduction bool) *Gateway {
	baseURL := sandboxBaseURL
	if isProduction {
		baseURL = productionBaseURL
	}
	return &Gateway{
		serverKey:  serverKey,
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type chargeResponse struct {
	TransactionID string `json:"transaction_id"`
	OrderID       string `json:"order_id"`
	StatusCode    string `json:"status_code"`
	StatusMessage string `json:"status_message"`
	Actions       []struct {
		Name   string `json:"name"`
		Method string `json:"method"`
		URL    string `json:"url"`
	} `json:"actions"`
}

// CreateQRISCharge POSTs /v2/charge with payment_type "qris". Docs:
// https://api-docs.midtrans.com/#qris
func (g *Gateway) CreateQRISCharge(ctx context.Context, orderCode string, amount float64) (*paymentgateway.QRISCharge, error) {
	reqBody := map[string]interface{}{
		"payment_type": "qris",
		"transaction_details": map[string]interface{}{
			"order_id":     orderCode,
			"gross_amount": int64(amount + 0.5), // Midtrans wants a whole-Rupiah integer
		},
		"qris": map[string]interface{}{
			"acquirer": "gopay",
		},
	}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal charge request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.baseURL+"/v2/charge", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("build charge request: %w", err)
	}
	req.SetBasicAuth(g.serverKey, "") // Midtrans auth: Server Key as basic-auth username, empty password
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("midtrans charge request: %w", err)
	}
	defer resp.Body.Close()

	var result chargeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode midtrans response: %w", err)
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("midtrans charge failed (%s): %s", result.StatusCode, result.StatusMessage)
	}

	charge := &paymentgateway.QRISCharge{
		OrderID:    result.OrderID,
		GatewayRef: result.TransactionID,
	}
	for _, a := range result.Actions {
		if a.Name == "generate-qr-code" {
			charge.QRImageURL = a.URL
		}
	}
	return charge, nil
}

// ParseWebhook verifies Midtrans's HTTP Notification signature:
// SHA512(order_id + status_code + gross_amount + ServerKey). Docs:
// https://api-docs.midtrans.com/#signature-key
func (g *Gateway) ParseWebhook(payload map[string]interface{}) (*paymentgateway.WebhookEvent, error) {
	orderID, _ := payload["order_id"].(string)
	statusCode, _ := payload["status_code"].(string)
	grossAmountStr, _ := payload["gross_amount"].(string)
	signatureKey, _ := payload["signature_key"].(string)

	if orderID == "" || signatureKey == "" {
		return nil, paymentgateway.ErrInvalidSignature
	}
	if !g.verifySignature(orderID, statusCode, grossAmountStr, signatureKey) {
		return nil, paymentgateway.ErrInvalidSignature
	}

	transactionStatus, _ := payload["transaction_status"].(string)
	paymentType, _ := payload["payment_type"].(string)
	gatewayRef, _ := payload["transaction_id"].(string)
	amount, _ := strconv.ParseFloat(grossAmountStr, 64)

	return &paymentgateway.WebhookEvent{
		OrderID:           orderID,
		GatewayRef:        gatewayRef,
		TransactionStatus: transactionStatus,
		GrossAmount:       amount,
		PaymentType:       paymentType,
		Raw:               payload,
	}, nil
}

func (g *Gateway) verifySignature(orderID, statusCode, grossAmount, signatureKey string) bool {
	raw := orderID + statusCode + grossAmount + g.serverKey
	sum := sha512.Sum512([]byte(raw))
	expected := hex.EncodeToString(sum[:])
	// Constant-time compare: good practice for any secret-derived comparison,
	// even though the "secret" here is a hash rather than an HMAC.
	return subtle.ConstantTimeCompare([]byte(expected), []byte(signatureKey)) == 1
}

// IsPaid: Midtrans reports a successful QRIS payment as "settlement" (and
// "capture" for card-based flows, kept here for when other payment_types
// are added later).
func (g *Gateway) IsPaid(transactionStatus string) bool {
	return transactionStatus == "settlement" || transactionStatus == "capture"
}
