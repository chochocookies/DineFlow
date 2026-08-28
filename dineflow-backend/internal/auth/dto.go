package auth

// RegisterRequest creates a restaurant together with its first staff
// account, who becomes the owner. Later staff (cashier, kitchen, ...) get
// added through CreateStaffRequest below.
type RegisterRequest struct {
	RestaurantName string `json:"restaurant_name" binding:"required,min=2"`
	Name           string `json:"name" binding:"required,min=2"`
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// CreateStaffRequest lets an owner/manager add a teammate — cashier,
// kitchen, etc. — to their own restaurant. There's no restaurant_id field
// here on purpose: the handler always takes it from the caller's JWT, so a
// manager can never add staff to a restaurant that isn't theirs.
type CreateStaffRequest struct {
	Name     string `json:"name" binding:"required,min=2"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role" binding:"required"`
}

// CreateRestaurantRequest lets an existing owner start a second (or third,
// ...) restaurant under their own identity — see
// Service.CreateAdditionalRestaurant for how that works without needing a
// separate email/password.
type CreateRestaurantRequest struct {
	Name string `json:"name" binding:"required,min=2"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	Staff StaffPublic `json:"staff"`
}

type StaffPublic struct {
	ID           string `json:"id"`
	RestaurantID string `json:"restaurant_id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Role         string `json:"role"`
}
