package entity

import "time"

// StaffRole mirrors the role system in the original DineFlow concept:
// Owner > Manager > Cashier / Kitchen / Staff. Role-based route protection
// is wired via pkg/middleware.RequireRole in later phases.
type StaffRole string

const (
	RoleOwner   StaffRole = "owner"
	RoleManager StaffRole = "manager"
	RoleCashier StaffRole = "cashier"
	RoleKitchen StaffRole = "kitchen"
	RoleStaff   StaffRole = "staff"
)

type Staff struct {
	ID           string    `json:"id"`
	RestaurantID string    `json:"restaurant_id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         StaffRole `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
