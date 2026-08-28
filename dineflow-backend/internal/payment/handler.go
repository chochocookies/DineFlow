// Package payment is the HTTP layer tying pkg/paymentgateway to
// DineFlow's order flow. It deliberately has no repository of its own — it
// reads/writes orders entirely through order.Service, so the paid-before-
// completed rule and the WebSocket broadcast from Phase 3 apply here too
// with no duplicated logic.
package payment

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/chochocookies/dineflow-backend/internal/entity"
	"github.com/chochocookies/dineflow-backend/internal/order"
	"github.com/chochocookies/dineflow-backend/pkg/paymentgateway"
	"github.com/chochocookies/dineflow-backend/pkg/response"
)

type Handler struct {
	gateway      paymentgateway.Gateway
	orderService *order.Service
}

func NewHandler(gateway paymentgateway.Gateway, orderService *order.Service) *Handler {
	return &Handler{gateway: gateway, orderService: orderService}
}

// RegisterChargeRoute is meant to be mounted on the same public /orders
// group internal/order's public routes use: POST /public/orders/:code/charge.
func (h *Handler) RegisterChargeRoute(rg *gin.RouterGroup) {
	rg.POST("/:code/charge", h.CreateCharge)
}

// RegisterWebhookRoute is its own top-level group — the gateway calls this
// directly with no DineFlow auth token, so authenticity relies entirely on
// Gateway.ParseWebhook's signature check, not middleware.RequireAuth.
func (h *Handler) RegisterWebhookRoute(rg *gin.RouterGroup) {
	rg.POST("/webhook", h.Webhook)
}

// RegisterSimulateRoute is meant to be mounted alongside RegisterChargeRoute
// on /public/orders. It only ever does anything when the mock gateway is
// active (see SimulatePayment below) — with Midtrans wired up, the route
// exists but always answers 404, so there's no path to fake a real payment.
func (h *Handler) RegisterSimulateRoute(rg *gin.RouterGroup) {
	rg.POST("/:code/simulate-payment", h.SimulatePayment)
}

func (h *Handler) CreateCharge(c *gin.Context) {
	code := c.Param("code")

	o, err := h.orderService.GetByCode(c.Request.Context(), code)
	if err != nil {
		if errors.Is(err, order.ErrNotFound) {
			response.Error(c, http.StatusNotFound, "order not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch order")
		return
	}
	if o.PaymentStatus == entity.PaymentPaid {
		response.Error(c, http.StatusConflict, "order is already paid")
		return
	}

	charge, err := h.gateway.CreateQRISCharge(c.Request.Context(), o.OrderCode, o.Total)
	if err != nil {
		response.Error(c, http.StatusBadGateway, "failed to create payment charge")
		return
	}

	// Mark pending immediately so the customer's screen can show "waiting
	// for payment" — the webhook flips it to paid once the gateway confirms.
	_, _ = h.orderService.UpdatePayment(c.Request.Context(), o.ID, o.RestaurantID, order.UpdatePaymentRequest{
		PaymentStatus:    string(entity.PaymentPending),
		PaymentMethod:    "qris",
		PaymentReference: charge.GatewayRef,
	})

	response.Success(c, http.StatusOK, charge)
}

func (h *Handler) Webhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid payload")
		return
	}

	event, err := h.gateway.ParseWebhook(payload)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "invalid webhook signature")
		return
	}

	o, err := h.orderService.GetByCode(c.Request.Context(), event.OrderID)
	if err != nil {
		// Acknowledge with 200 even for an order we don't recognize — most
		// gateways retry aggressively on non-2xx, and this will never
		// resolve on retry, so a retry storm helps nobody.
		response.Success(c, http.StatusOK, gin.H{"received": true, "note": "order not found, ignored"})
		return
	}

	status := string(entity.PaymentPending)
	if h.gateway.IsPaid(event.TransactionStatus) {
		status = string(entity.PaymentPaid)
	}

	_, err = h.orderService.UpdatePayment(c.Request.Context(), o.ID, o.RestaurantID, order.UpdatePaymentRequest{
		PaymentStatus:    status,
		PaymentMethod:    event.PaymentType,
		PaymentReference: event.GatewayRef,
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to update payment")
		return
	}

	response.Success(c, http.StatusOK, gin.H{"received": true})
}

// devSimulateGateway is implemented only by pkg/paymentgateway/mock.Gateway.
// SimulatePayment type-asserts h.gateway against it instead of adding
// SimulatePayload to the Gateway interface itself — that keeps this dev-only
// shortcut out of the interface every real provider (Midtrans, and whatever
// comes after it) has to implement.
type devSimulateGateway interface {
	SimulatePayload(orderCode string, amount float64) map[string]interface{}
}

// SimulatePayment is a local-development convenience: it drives an order
// through the exact same ParseWebhook -> IsPaid -> UpdatePayment path a real
// settlement webhook would, but is triggered by a button in the UI instead
// of a real QRIS scan or a hand-built curl request to /payments/webhook.
//
// It only works with the mock gateway — the type assertion below fails
// (404) the moment PAYMENT_GATEWAY=midtrans is configured, so this can
// never be used to fake a real payment.
func (h *Handler) SimulatePayment(c *gin.Context) {
	sim, ok := h.gateway.(devSimulateGateway)
	if !ok {
		response.Error(c, http.StatusNotFound, "payment simulation is only available with the mock gateway (PAYMENT_GATEWAY=mock)")
		return
	}

	code := c.Param("code")
	o, err := h.orderService.GetByCode(c.Request.Context(), code)
	if err != nil {
		if errors.Is(err, order.ErrNotFound) {
			response.Error(c, http.StatusNotFound, "order not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch order")
		return
	}
	if o.PaymentStatus == entity.PaymentPaid {
		response.Error(c, http.StatusConflict, "order is already paid")
		return
	}

	event, err := h.gateway.ParseWebhook(sim.SimulatePayload(o.OrderCode, o.Total))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to simulate payment")
		return
	}

	status := string(entity.PaymentPending)
	if h.gateway.IsPaid(event.TransactionStatus) {
		status = string(entity.PaymentPaid)
	}

	updated, err := h.orderService.UpdatePayment(c.Request.Context(), o.ID, o.RestaurantID, order.UpdatePaymentRequest{
		PaymentStatus:    status,
		PaymentMethod:    event.PaymentType,
		PaymentReference: event.GatewayRef,
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to update payment")
		return
	}
	response.Success(c, http.StatusOK, updated)
}
