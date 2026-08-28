// Package realtime wires the JWT-authenticated Kitchen Display WebSocket
// route on top of pkg/ws.Hub.
package realtime

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/chochocookies/dineflow-backend/pkg/jwt"
	"github.com/chochocookies/dineflow-backend/pkg/response"
	"github.com/chochocookies/dineflow-backend/pkg/ws"
)

// KitchenHandler upgrades GET /ws/kitchen to a WebSocket for a restaurant's
// Kitchen Display. Browsers can't send an Authorization header when opening
// a WebSocket, so the JWT travels as a query param instead:
// wss://.../ws/kitchen?token=<jwt>
func KitchenHandler(jwtManager *jwt.Manager, hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			response.Error(c, http.StatusUnauthorized, "missing token query parameter")
			return
		}

		claims, err := jwtManager.Verify(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		// Upgrade failures already write their own response to the client,
		// nothing more to do here on error.
		_ = hub.ServeKitchen(c.Writer, c.Request, claims.RestaurantID)
	}
}
