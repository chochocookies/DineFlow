package order

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/chochocookies/dineflow-backend/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterPublicRoutes: no auth, reachable straight from a scanned QR code.
func (h *Handler) RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.POST("", h.CreatePublic)
	rg.GET("/:code", h.GetPublic)
}

// RegisterStaffRoutes expects to be mounted on a group that already has
// middleware.RequireAuth applied — this is what the Kitchen Display /
// cashier screen calls.
func (h *Handler) RegisterStaffRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.List)
	rg.GET("/:id", h.Get)
	rg.PATCH("/:id/status", h.UpdateStatus)
}

func restaurantID(c *gin.Context) string {
	v, _ := c.Get("restaurant_id")
	id, _ := v.(string)
	return id
}

func (h *Handler) CreatePublic(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	o, err := h.service.CreateOrder(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrTableNotFound):
			response.Error(c, http.StatusNotFound, "table not found — check the QR code")
		case errors.Is(err, ErrMenuNotFound):
			response.Error(c, http.StatusBadRequest, "one or more menu items were not found")
		case errors.Is(err, ErrMenuNotAvailable):
			response.Error(c, http.StatusBadRequest, "one or more menu items are currently unavailable")
		case errors.Is(err, ErrInsufficientStock):
			response.Error(c, http.StatusConflict, "insufficient stock for one or more items")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to create order")
		}
		return
	}
	response.Success(c, http.StatusCreated, o)
}

func (h *Handler) GetPublic(c *gin.Context) {
	o, err := h.service.GetByCode(c.Request.Context(), c.Param("code"))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "order not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch order")
		return
	}
	response.Success(c, http.StatusOK, o)
}

func (h *Handler) List(c *gin.Context) {
	orders, err := h.service.List(c.Request.Context(), restaurantID(c), c.Query("status"))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch orders")
		return
	}
	response.Success(c, http.StatusOK, orders)
}

func (h *Handler) Get(c *gin.Context) {
	o, err := h.service.Get(c.Request.Context(), c.Param("id"), restaurantID(c))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "order not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch order")
		return
	}
	response.Success(c, http.StatusOK, o)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	var req UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	o, err := h.service.UpdateStatus(c.Request.Context(), c.Param("id"), restaurantID(c), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidStatus):
			response.Error(c, http.StatusBadRequest, "invalid status value")
		case errors.Is(err, ErrPaymentRequired):
			response.Error(c, http.StatusConflict, "order must be marked paid before it can be completed")
		case errors.Is(err, ErrNotFound):
			response.Error(c, http.StatusNotFound, "order not found")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to update order status")
		}
		return
	}
	response.Success(c, http.StatusOK, o)
}

// UpdatePayment is wired in main.go with an extra RequireRole check
// (owner/manager/cashier) since it's a financial action, unlike the other
// staff routes here which any authenticated staff member can call.
func (h *Handler) UpdatePayment(c *gin.Context) {
	var req UpdatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	o, err := h.service.UpdatePayment(c.Request.Context(), c.Param("id"), restaurantID(c), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidPayment):
			response.Error(c, http.StatusBadRequest, "invalid payment status value")
		case errors.Is(err, ErrNotFound):
			response.Error(c, http.StatusNotFound, "order not found")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to update payment")
		}
		return
	}
	response.Success(c, http.StatusOK, o)
}
