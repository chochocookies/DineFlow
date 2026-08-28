package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"github.com/chochocookies/dineflow-backend/internal/auth"
	"github.com/chochocookies/dineflow-backend/internal/config"
	"github.com/chochocookies/dineflow-backend/internal/dashboard"
	"github.com/chochocookies/dineflow-backend/internal/inventory"
	"github.com/chochocookies/dineflow-backend/internal/menu"
	"github.com/chochocookies/dineflow-backend/internal/order"
	"github.com/chochocookies/dineflow-backend/internal/payment"
	"github.com/chochocookies/dineflow-backend/internal/realtime"
	"github.com/chochocookies/dineflow-backend/internal/table"
	"github.com/chochocookies/dineflow-backend/pkg/database"
	"github.com/chochocookies/dineflow-backend/pkg/jwt"
	"github.com/chochocookies/dineflow-backend/pkg/middleware"
	"github.com/chochocookies/dineflow-backend/pkg/paymentgateway"
	"github.com/chochocookies/dineflow-backend/pkg/paymentgateway/midtrans"
	mockgateway "github.com/chochocookies/dineflow-backend/pkg/paymentgateway/mock"
	"github.com/chochocookies/dineflow-backend/pkg/ws"
)

func main() {
	cfg := config.Load()

	db, err := database.NewPostgres(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("connected to database")

	jwtManager := jwt.NewManager(cfg.JWTSecret, cfg.JWTExpiryHr)
	hub := ws.NewHub()

	// Every module follows the same repository -> service -> handler shape,
	// wired here. order depends on table + menu's *Service (not their
	// repositories directly) to stay within normal layering.
	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo, jwtManager)
	authHandler := auth.NewHandler(authService)

	menuRepo := menu.NewRepository(db)
	menuService := menu.NewService(menuRepo)
	menuHandler := menu.NewHandler(menuService)

	tableRepo := table.NewRepository(db)
	tableService := table.NewService(tableRepo)
	tableHandler := table.NewHandler(tableService)

	inventoryRepo := inventory.NewRepository(db)
	inventoryService := inventory.NewService(inventoryRepo)
	inventoryHandler := inventory.NewHandler(inventoryService)

	orderRepo := order.NewRepository(db)
	orderService := order.NewService(orderRepo, tableService, menuService, inventoryService, hub)
	orderHandler := order.NewHandler(orderService)

	dashboardRepo := dashboard.NewRepository(db)
	dashboardService := dashboard.NewService(dashboardRepo)
	dashboardHandler := dashboard.NewHandler(dashboardService)

	// The active payment gateway is chosen by config so this binary works
	// out of the box (mock) and only needs real credentials when you're
	// ready to actually test against Midtrans.
	var gateway paymentgateway.Gateway
	if cfg.PaymentGateway == "midtrans" {
		gateway = midtrans.New(cfg.MidtransServerKey, cfg.MidtransIsProduction)
		log.Println("payment gateway: midtrans")
	} else {
		gateway = mockgateway.New()
		log.Println("payment gateway: mock (set PAYMENT_GATEWAY=midtrans + MIDTRANS_SERVER_KEY for the real thing)")
	}
	paymentHandler := payment.NewHandler(gateway, orderService)

	r := gin.Default()
	r.Use(middleware.CORS())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "dineflow-backend"})
	})

	// Kitchen Display connects here: wss://.../ws/kitchen?token=<jwt>
	r.GET("/ws/kitchen", realtime.KitchenHandler(jwtManager, hub))

	v1 := r.Group("/api/v1")
	{
		authGroup := v1.Group("/auth")
		authHandler.RegisterRoutes(authGroup)

		menuGroup := v1.Group("/menus")
		menuGroup.Use(middleware.RequireAuth(jwtManager))
		menuHandler.RegisterRoutes(menuGroup)
		// Recipe management lives on inventory's handler but is mounted
		// under /menus/:id/recipe since that's the natural URL for it.
		menuGroup.GET("/:id/recipe", inventoryHandler.GetRecipe)
		menuGroup.PUT("/:id/recipe", middleware.RequireRole("owner", "manager"), inventoryHandler.SetRecipe)

		ingredientGroup := v1.Group("/ingredients")
		ingredientGroup.Use(middleware.RequireAuth(jwtManager), middleware.RequireRole("owner", "manager"))
		inventoryHandler.RegisterIngredientRoutes(ingredientGroup)

		tableGroup := v1.Group("/tables")
		tableGroup.Use(middleware.RequireAuth(jwtManager))
		tableHandler.RegisterRoutes(tableGroup)

		orderGroup := v1.Group("/orders")
		orderGroup.Use(middleware.RequireAuth(jwtManager))
		orderHandler.RegisterStaffRoutes(orderGroup)
		// Payment is a financial action, so it's gated tighter than the rest
		// of the order routes above — kitchen/staff roles can move an order
		// through its status but can't touch payment.
		orderGroup.PATCH("/:id/payment", middleware.RequireRole("owner", "manager", "cashier"), orderHandler.UpdatePayment)

		staffGroup := v1.Group("/staff")
		staffGroup.Use(middleware.RequireAuth(jwtManager), middleware.RequireRole("owner", "manager"))
		authHandler.RegisterStaffManagementRoutes(staffGroup)

		restaurantGroup := v1.Group("/restaurants")
		restaurantGroup.Use(middleware.RequireAuth(jwtManager), middleware.RequireRole("owner"))
		authHandler.RegisterRestaurantRoutes(restaurantGroup)

		dashboardGroup := v1.Group("/dashboard")
		dashboardGroup.Use(middleware.RequireAuth(jwtManager), middleware.RequireRole("owner", "manager"))
		dashboardHandler.RegisterRoutes(dashboardGroup)

		// Everything under /public needs no Authorization header — this is
		// the entire customer-facing "scan QR and order" surface.
		public := v1.Group("/public")
		{
			publicTables := public.Group("/tables")
			tableHandler.RegisterPublicRoutes(publicTables)

			publicRestaurants := public.Group("/restaurants")
			authHandler.RegisterPublicRestaurantRoutes(publicRestaurants)
			menuHandler.RegisterPublicRoutes(publicRestaurants)

			publicOrders := public.Group("/orders")
			orderHandler.RegisterPublicRoutes(publicOrders)
			paymentHandler.RegisterChargeRoute(publicOrders)
			paymentHandler.RegisterSimulateRoute(publicOrders)
		}

		paymentsGroup := v1.Group("/payments")
		paymentHandler.RegisterWebhookRoute(paymentsGroup)
	}

	log.Printf("dineflow-backend listening on :%s", cfg.AppPort)
	if err := r.Run(":" + cfg.AppPort); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
