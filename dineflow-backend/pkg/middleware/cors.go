package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CORS allows requests from any origin, which is fine for local development
// against the Next.js frontend on a different port. Restrict AllowOrigin to
// your real frontend URL before deploying to production.
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
