package dashboard

import (
	"net/http"
	"strconv"

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
// middleware.RequireAuth + middleware.RequireRole("owner", "manager")
// applied — see main.go. Sales figures aren't something a kitchen or
// cashier login needs to see.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/summary", h.Summary)
	rg.GET("/best-sellers", h.BestSellers)
}

func restaurantID(c *gin.Context) string {
	v, _ := c.Get("restaurant_id")
	id, _ := v.(string)
	return id
}

func (h *Handler) Summary(c *gin.Context) {
	summary, err := h.service.Summary(c.Request.Context(), restaurantID(c))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to load dashboard summary")
		return
	}
	response.Success(c, http.StatusOK, summary)
}

func (h *Handler) BestSellers(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit")) // 0 on empty/invalid -> service defaults it
	items, err := h.service.BestSellers(c.Request.Context(), restaurantID(c), limit)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to load best sellers")
		return
	}
	response.Success(c, http.StatusOK, items)
}
