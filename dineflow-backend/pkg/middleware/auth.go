package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/chochocookies/dineflow-backend/pkg/jwt"
	"github.com/chochocookies/dineflow-backend/pkg/response"
)

// RequireAuth verifies the Bearer token and stashes staff_id / restaurant_id
// / role into the Gin context for handlers/RequireRole to read.
func RequireAuth(jwtManager *jwt.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Error(c, http.StatusUnauthorized, "missing or malformed Authorization header")
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(header, "Bearer ")
		claims, err := jwtManager.Verify(tokenString)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid or expired token")
			c.Abort()
			return
		}

		c.Set("staff_id", claims.StaffID)
		c.Set("restaurant_id", claims.RestaurantID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// RequireRole restricts a route to specific staff roles. Chain it after
// RequireAuth, e.g. group.Use(RequireAuth(m), RequireRole("owner", "manager")).
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		roleStr, ok := role.(string)
		if !ok || !allowed[roleStr] {
			response.Error(c, http.StatusForbidden, "you don't have permission for this action")
			c.Abort()
			return
		}
		c.Next()
	}
}
