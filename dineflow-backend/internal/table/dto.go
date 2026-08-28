package table

type CreateTableRequest struct {
	Code string `json:"code" binding:"required"`
}

type UpdateTableRequest struct {
	Code   *string `json:"code"`
	Status *string `json:"status"`
}
