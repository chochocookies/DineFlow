package inventory

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

// RegisterIngredientRoutes expects to be mounted on a group that already
// has middleware.RequireAuth + middleware.RequireRole("owner", "manager")
// applied — see main.go.
func (h *Handler) RegisterIngredientRoutes(rg *gin.RouterGroup) {
	rg.POST("", h.Create)
	rg.GET("", h.List)
	rg.GET("/:id", h.Get)
	rg.PUT("/:id", h.Update)
	rg.PATCH("/:id/stock", h.AdjustStock)
	rg.DELETE("/:id", h.Delete)
}

func restaurantID(c *gin.Context) string {
	v, _ := c.Get("restaurant_id")
	id, _ := v.(string)
	return id
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateIngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	i, err := h.service.Create(c.Request.Context(), restaurantID(c), req)
	if err != nil {
		if errors.Is(err, ErrNameTaken) {
			response.Error(c, http.StatusConflict, "an ingredient with this name already exists")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to create ingredient")
		return
	}
	response.Success(c, http.StatusCreated, i)
}

func (h *Handler) List(c *gin.Context) {
	items, err := h.service.List(c.Request.Context(), restaurantID(c))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch ingredients")
		return
	}
	response.Success(c, http.StatusOK, items)
}

func (h *Handler) Get(c *gin.Context) {
	i, err := h.service.Get(c.Request.Context(), c.Param("id"), restaurantID(c))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Error(c, http.StatusNotFound, "ingredient not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch ingredient")
		return
	}
	response.Success(c, http.StatusOK, i)
}

func (h *Handler) Update(c *gin.Context) {
	var req UpdateIngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	i, err := h.service.Update(c.Request.Context(), c.Param("id"), restaurantID(c), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			response.Error(c, http.StatusNotFound, "ingredient not found")
		case errors.Is(err, ErrNameTaken):
			response.Error(c, http.StatusConflict, "an ingredient with this name already exists")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to update ingredient")
		}
		return
	}
	response.Success(c, http.StatusOK, i)
}

func (h *Handler) AdjustStock(c *gin.Context) {
	var req AdjustStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	i, err := h.service.AdjustStock(c.Request.Context(), c.Param("id"), restaurantID(c), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			response.Error(c, http.StatusNotFound, "ingredient not found")
		case errors.Is(err, ErrWouldGoNegative):
			response.Error(c, http.StatusConflict, "adjustment would make stock negative")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to adjust stock")
		}
		return
	}
	response.Success(c, http.StatusOK, i)
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Request.Context(), c.Param("id"), restaurantID(c)); err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			response.Error(c, http.StatusNotFound, "ingredient not found")
		case errors.Is(err, ErrInUse):
			response.Error(c, http.StatusConflict, "ingredient is used in one or more menu recipes — remove it from those recipes first")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to delete ingredient")
		}
		return
	}
	response.Success(c, http.StatusOK, gin.H{"deleted": true})
}

func (h *Handler) GetRecipe(c *gin.Context) {
	lines, err := h.service.GetRecipe(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch recipe")
		return
	}
	response.Success(c, http.StatusOK, lines)
}

func (h *Handler) SetRecipe(c *gin.Context) {
	var req SetRecipeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.service.SetRecipe(c.Request.Context(), c.Param("id"), req); err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to update recipe")
		return
	}
	response.Success(c, http.StatusOK, gin.H{"updated": true})
}
