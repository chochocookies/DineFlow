package auth

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

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/register", h.Register)
	rg.POST("/login", h.Login)
}

// RegisterStaffManagementRoutes expects to be mounted on a group that
// already has middleware.RequireAuth + middleware.RequireRole("owner",
// "manager") applied — see main.go.
func (h *Handler) RegisterStaffManagementRoutes(rg *gin.RouterGroup) {
	rg.POST("", h.CreateStaff)
	rg.GET("", h.ListStaff)
	rg.DELETE("/:id", h.DeleteStaff)
}

// RegisterRestaurantRoutes expects middleware.RequireAuth +
// middleware.RequireRole("owner") — starting a whole new restaurant is a
// bigger action than typical manager-level permissions. GetMyRestaurant is
// mounted here too even though it's a plain read, since it's always "my
// own restaurant" from the JWT — no reason to relax the group's role gate
// just for a read the owner already has broader write access to.
func (h *Handler) RegisterRestaurantRoutes(rg *gin.RouterGroup) {
	rg.POST("", h.CreateRestaurant)
	rg.GET("/me", h.GetMyRestaurant)
	rg.PATCH("/me", h.UpdateMyRestaurant)
}

// RegisterPublicRestaurantRoutes needs no auth — it's the "choose your
// restaurant" listing for a customer-facing landing page, plus a
// single-restaurant lookup for that restaurant's own landing page
// (name + description; the menu itself comes from menu.Handler's
// ListPublic on the same :restaurant_id). The param is named
// "restaurant_id" here, not "id", because this group is shared with
// menu.Handler.RegisterPublicRoutes's "/:restaurant_id/menus" — Gin's
// router panics at startup if two routes need a wildcard at the same tree
// position under different names, so both handlers have to agree on one.
func (h *Handler) RegisterPublicRestaurantRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.ListRestaurants)
	rg.GET("/:restaurant_id", h.GetRestaurant)
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	res, err := h.service.Register(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, ErrEmailTaken) {
			response.Error(c, http.StatusConflict, "email is already registered")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to register")
		return
	}

	response.Success(c, http.StatusCreated, res)
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	res, err := h.service.Login(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			response.Error(c, http.StatusUnauthorized, "invalid email or password")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to login")
		return
	}

	response.Success(c, http.StatusOK, res)
}

func (h *Handler) CreateStaff(c *gin.Context) {
	var req CreateStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	v, _ := c.Get("restaurant_id")
	restaurantID, _ := v.(string)

	staff, err := h.service.CreateStaff(c.Request.Context(), restaurantID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrEmailTaken):
			response.Error(c, http.StatusConflict, "email is already registered")
		case errors.Is(err, ErrInvalidRole):
			response.Error(c, http.StatusBadRequest, "invalid role")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to create staff")
		}
		return
	}
	response.Success(c, http.StatusCreated, staff)
}

func (h *Handler) CreateRestaurant(c *gin.Context) {
	var req CreateRestaurantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	v, _ := c.Get("staff_id")
	staffID, _ := v.(string)

	res, err := h.service.CreateAdditionalRestaurant(c.Request.Context(), staffID, req.Name)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to create restaurant")
		return
	}
	response.Success(c, http.StatusCreated, res)
}

func (h *Handler) ListRestaurants(c *gin.Context) {
	restaurants, err := h.service.ListRestaurants(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch restaurants")
		return
	}
	response.Success(c, http.StatusOK, restaurants)
}

// GetRestaurant is the public lookup a restaurant's own landing page
// (app/r/[restaurantId] on the frontend) uses to load its name and
// description — no auth, since anyone with the link should be able to
// view it, same trust level as the QR-code ordering flow.
func (h *Handler) GetRestaurant(c *gin.Context) {
	rst, err := h.service.GetRestaurant(c.Request.Context(), c.Param("restaurant_id"))
	if err != nil {
		if errors.Is(err, ErrRestaurantNotFound) {
			response.Error(c, http.StatusNotFound, "restaurant not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "failed to fetch restaurant")
		return
	}
	response.Success(c, http.StatusOK, rst)
}

// GetMyRestaurant/UpdateMyRestaurant back the admin Settings page — both
// always act on the caller's own restaurant_id from the JWT, never a
// client-supplied id, same rule every other authenticated handler in this
// package follows.
func (h *Handler) GetMyRestaurant(c *gin.Context) {
	v, _ := c.Get("restaurant_id")
	restaurantID, _ := v.(string)

	rst, err := h.service.GetRestaurant(c.Request.Context(), restaurantID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch restaurant")
		return
	}
	response.Success(c, http.StatusOK, rst)
}

func (h *Handler) UpdateMyRestaurant(c *gin.Context) {
	var req UpdateRestaurantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	v, _ := c.Get("restaurant_id")
	restaurantID, _ := v.(string)

	rst, err := h.service.UpdateRestaurant(c.Request.Context(), restaurantID, req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to update restaurant")
		return
	}
	response.Success(c, http.StatusOK, rst)
}

func (h *Handler) ListStaff(c *gin.Context) {
	v, _ := c.Get("restaurant_id")
	restaurantID, _ := v.(string)

	staff, err := h.service.ListStaff(c.Request.Context(), restaurantID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to fetch staff")
		return
	}
	response.Success(c, http.StatusOK, staff)
}

func (h *Handler) DeleteStaff(c *gin.Context) {
	v, _ := c.Get("restaurant_id")
	restaurantID, _ := v.(string)

	err := h.service.DeleteStaff(c.Request.Context(), c.Param("id"), restaurantID)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			response.Error(c, http.StatusNotFound, "staff not found")
		case errors.Is(err, ErrLastOwner):
			response.Error(c, http.StatusConflict, "cannot remove the only owner of a restaurant")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to delete staff")
		}
		return
	}
	response.Success(c, http.StatusOK, gin.H{"deleted": true})
}
