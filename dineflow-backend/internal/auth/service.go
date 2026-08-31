package auth

import (
	"context"
	"errors"

	"golang.org/x/crypto/bcrypt"

	"github.com/chochocookies/dineflow-backend/internal/entity"
	"github.com/chochocookies/dineflow-backend/pkg/jwt"
)

var ErrInvalidCredentials = errors.New("invalid email or password")
var ErrInvalidRole = errors.New("invalid role")

var validRoles = map[string]bool{
	string(entity.RoleOwner):   true,
	string(entity.RoleManager): true,
	string(entity.RoleCashier): true,
	string(entity.RoleKitchen): true,
	string(entity.RoleStaff):   true,
}

type Service struct {
	repo *Repository
	jwtM *jwt.Manager
}

func NewService(repo *Repository, jwtM *jwt.Manager) *Service {
	return &Service{repo: repo, jwtM: jwtM}
}

// Register creates a new restaurant together with its first staff account
// (always the "owner" role — additional staff are invited later).
func (s *Service) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	restaurantID, err := s.repo.CreateRestaurant(ctx, req.RestaurantName)
	if err != nil {
		return nil, err
	}

	staff := &entity.Staff{
		RestaurantID: restaurantID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         entity.RoleOwner,
	}
	staffID, err := s.repo.CreateStaff(ctx, staff)
	if err != nil {
		return nil, err
	}

	token, err := s.jwtM.Generate(staffID, restaurantID, string(entity.RoleOwner))
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		Staff: StaffPublic{
			ID:           staffID,
			RestaurantID: restaurantID,
			Name:         staff.Name,
			Email:        staff.Email,
			Role:         string(entity.RoleOwner),
		},
	}, nil
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	staff, err := s.repo.FindByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(staff.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := s.jwtM.Generate(staff.ID, staff.RestaurantID, string(staff.Role))
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		Staff: StaffPublic{
			ID:           staff.ID,
			RestaurantID: staff.RestaurantID,
			Name:         staff.Name,
			Email:        staff.Email,
			Role:         string(staff.Role),
		},
	}, nil
}

// CreateAdditionalRestaurant lets an existing owner start a second
// restaurant under their own identity — reusing their name/email/password
// hash rather than asking them to register a whole new account. This is
// what "multi-tenant" means in this phase: the same person can now own more
// than one independently-scoped restaurant, each with its own staff, menu,
// tables and orders.
func (s *Service) CreateAdditionalRestaurant(ctx context.Context, callerStaffID, restaurantName string) (*AuthResponse, error) {
	caller, err := s.repo.FindByID(ctx, callerStaffID)
	if err != nil {
		return nil, err
	}

	restaurantID, err := s.repo.CreateRestaurant(ctx, restaurantName)
	if err != nil {
		return nil, err
	}

	newStaff := &entity.Staff{
		RestaurantID: restaurantID,
		Name:         caller.Name,
		Email:        caller.Email,
		PasswordHash: caller.PasswordHash,
		Role:         entity.RoleOwner,
	}
	staffID, err := s.repo.CreateStaff(ctx, newStaff)
	if err != nil {
		return nil, err
	}

	// Hand back a token scoped to the new restaurant right away — the
	// caller is already authenticated, so there's no need to make them log
	// in again just to start operating the new restaurant.
	token, err := s.jwtM.Generate(staffID, restaurantID, string(entity.RoleOwner))
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		Staff: StaffPublic{
			ID:           staffID,
			RestaurantID: restaurantID,
			Name:         caller.Name,
			Email:        caller.Email,
			Role:         string(entity.RoleOwner),
		},
	}, nil
}

func (s *Service) ListRestaurants(ctx context.Context) ([]entity.Restaurant, error) {
	return s.repo.ListRestaurants(ctx)
}

// GetRestaurant backs both the public landing page and the admin Settings
// page — see Repository.GetRestaurantByID's comment for why one method
// serves both.
func (s *Service) GetRestaurant(ctx context.Context, id string) (*entity.Restaurant, error) {
	return s.repo.GetRestaurantByID(ctx, id)
}

func (s *Service) UpdateRestaurant(ctx context.Context, id string, req UpdateRestaurantRequest) (*entity.Restaurant, error) {
	if err := s.repo.UpdateRestaurantDescription(ctx, id, req.Description); err != nil {
		return nil, err
	}
	return s.repo.GetRestaurantByID(ctx, id)
}

func (s *Service) ListStaff(ctx context.Context, restaurantID string) ([]StaffPublic, error) {
	staff, err := s.repo.ListByRestaurant(ctx, restaurantID)
	if err != nil {
		return nil, err
	}
	public := make([]StaffPublic, len(staff))
	for i, st := range staff {
		public[i] = StaffPublic{
			ID:           st.ID,
			RestaurantID: st.RestaurantID,
			Name:         st.Name,
			Email:        st.Email,
			Role:         string(st.Role),
		}
	}
	return public, nil
}

func (s *Service) DeleteStaff(ctx context.Context, id, restaurantID string) error {
	return s.repo.Delete(ctx, id, restaurantID)
}

// CreateStaff adds a teammate to restaurantID, which the handler always
// takes from the caller's JWT — never from client input — so this can only
// ever add staff to the caller's own restaurant.
func (s *Service) CreateStaff(ctx context.Context, restaurantID string, req CreateStaffRequest) (*StaffPublic, error) {
	if !validRoles[req.Role] {
		return nil, ErrInvalidRole
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	staff := &entity.Staff{
		RestaurantID: restaurantID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         entity.StaffRole(req.Role),
	}
	staffID, err := s.repo.CreateStaff(ctx, staff)
	if err != nil {
		return nil, err
	}

	return &StaffPublic{
		ID:           staffID,
		RestaurantID: restaurantID,
		Name:         staff.Name,
		Email:        staff.Email,
		Role:         req.Role,
	}, nil
}
