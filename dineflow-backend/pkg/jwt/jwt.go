package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("invalid or expired token")

// Claims carries just enough to authorize a staff request without another DB
// round-trip: which staff member, which restaurant (for tenant scoping), and
// their role (for RequireRole checks).
type Claims struct {
	StaffID      string `json:"staff_id"`
	RestaurantID string `json:"restaurant_id"`
	Role         string `json:"role"`
	jwt.RegisteredClaims
}

type Manager struct {
	secret   []byte
	expiryHr int
}

func NewManager(secret string, expiryHr int) *Manager {
	return &Manager{secret: []byte(secret), expiryHr: expiryHr}
}

func (m *Manager) Generate(staffID, restaurantID, role string) (string, error) {
	claims := Claims{
		StaffID:      staffID,
		RestaurantID: restaurantID,
		Role:         role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(m.expiryHr) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *Manager) Verify(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		return m.secret, nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
