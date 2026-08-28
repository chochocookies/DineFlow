package menu

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
// middleware.RequireAuth applied, so restaurant_id is always present.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("", h.Create)
	rg.GET("", h.List)
	rg.GET("/:id", h.Get)
	rg.PUT("/:id", h.Update)
	rg.DELETE("/:id", h.Delete)
}

// RegisterPublicRoutes is the unauthenticated menu listing a customer's
// ordering page calls after scanning a table's QR code.
func (h *Handler) RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.GET("/:restaurant_id/menus", h.ListPublic)
}

func restaurantID(c *gin.Context) string {
	v, _ := c.Get("restaurant_id")
	id, _ := v.(string)
	return id
}

func (h *Handler) ListPublic(c *gin.Context) {
	menus, err := h.service.ListAvailable(c.Request.Context(), c.Param("restaurant_id"))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch menus")
		return
	}
	response.Success(c, http.StatusOK, menus)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateMenuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	m, err := h.service.Create(c.Request.Context(), restaurantID(c), req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to create menu")
		return
	}
	response.Success(c, http.StatusCreated, m)
}

func (h *Handler) List(c *gin.Context) {
	menus, err := h.service.List(c.Request.Context(), restaurantID(c))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch menus")
		return
	}
	response.Success(c, http.StatusOK, menus)
}

func (h *Handler) Get(c *gin.Context) {
	m, err := h.service.Get(c.Request.Context(), c.Param("id"), restaurantID(c))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "menu not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch menu")
		return
	}
	response.Success(c, http.StatusOK, m)
}

func (h *Handler) Update(c *gin.Context) {
	var req UpdateMenuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	m, err := h.service.Update(c.Request.Context(), c.Param("id"), restaurantID(c), req)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "menu not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to update menu")
		return
	}
	response.Success(c, http.StatusOK, m)
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Request.Context(), c.Param("id"), restaurantID(c)); err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "menu not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to delete menu")
		return
	}
	response.Success(c, http.StatusOK, gin.H{"deleted": true})
}
