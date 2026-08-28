package table

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

// RegisterRoutes expects to be mounted on a group that already has
// middleware.RequireAuth applied.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("", h.Create)
	rg.GET("", h.List)
	rg.GET("/:id", h.Get)
	rg.PUT("/:id", h.Update)
	rg.DELETE("/:id", h.Delete)
}

// RegisterPublicRoutes is the unauthenticated lookup a customer hits right
// after scanning a table's QR code.
func (h *Handler) RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.GET("/:qr_token", h.GetPublic)
}

func restaurantID(c *gin.Context) string {
	v, _ := c.Get("restaurant_id")
	id, _ := v.(string)
	return id
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	t, err := h.service.Create(c.Request.Context(), restaurantID(c), req)
	if err != nil {
		if errors.Is(err, ErrCodeTaken) {
			response.Error(c, http.StatusConflict, "a table with this code already exists")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to create table")
		return
	}
	response.Success(c, http.StatusCreated, t)
}

func (h *Handler) List(c *gin.Context) {
	tables, err := h.service.List(c.Request.Context(), restaurantID(c))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch tables")
		return
	}
	response.Success(c, http.StatusOK, tables)
}

func (h *Handler) Get(c *gin.Context) {
	t, err := h.service.Get(c.Request.Context(), c.Param("id"), restaurantID(c))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "table not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch table")
		return
	}
	response.Success(c, http.StatusOK, t)
}

func (h *Handler) GetPublic(c *gin.Context) {
	tr, err := h.service.FindByQRToken(c.Request.Context(), c.Param("qr_token"))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "table not found — check the QR code")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch table")
		return
	}
	response.Success(c, http.StatusOK, tr)
}

func (h *Handler) Update(c *gin.Context) {
	var req UpdateTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	t, err := h.service.Update(c.Request.Context(), c.Param("id"), restaurantID(c), req)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "table not found")
			return
		}
		if errors.Is(err, ErrCodeTaken) {
			response.Error(c, http.StatusConflict, "a table with this code already exists")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to update table")
		return
	}
	response.Success(c, http.StatusOK, t)
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Request.Context(), c.Param("id"), restaurantID(c)); err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "table not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to delete table")
		return
	}
	response.Success(c, http.StatusOK, gin.H{"deleted": true})
}
