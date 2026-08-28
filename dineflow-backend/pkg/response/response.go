package response

import "github.com/gin-gonic/gin"

type successBody struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

type errorBody struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func Success(c *gin.Context, status int, data interface{}) {
	c.JSON(status, successBody{Success: true, Data: data})
}

func SuccessWithMeta(c *gin.Context, status int, data interface{}, meta interface{}) {
	c.JSON(status, successBody{Success: true, Data: data, Meta: meta})
}

func Error(c *gin.Context, status int, message string) {
	c.JSON(status, errorBody{Success: false, Message: message})
}
