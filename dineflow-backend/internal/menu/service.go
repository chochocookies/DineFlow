package menu

import (
	"context"

	"github.com/chochocookies/dineflow-backend/internal/entity"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, restaurantID string, req CreateMenuRequest) (*entity.Menu, error) {
	m := &entity.Menu{
		RestaurantID: restaurantID,
		Category:     req.Category,
		Name:         req.Name,
		Description:  req.Description,
		Price:        req.Price,
		ImageURL:     req.ImageURL,
		IsAvailable:  true,
	}
	id, err := s.repo.Create(ctx, m)
	if err != nil {
		return nil, err
	}
	m.ID = id
	return m, nil
}

func (s *Service) List(ctx context.Context, restaurantID string) ([]entity.Menu, error) {
	return s.repo.ListByRestaurant(ctx, restaurantID)
}

// ListAvailable is the public, customer-facing listing (unavailable items
// hidden). Used by GET /public/restaurants/:restaurant_id/menus.
func (s *Service) ListAvailable(ctx context.Context, restaurantID string) ([]entity.Menu, error) {
	return s.repo.ListAvailableByRestaurant(ctx, restaurantID)
}

// FindByIDs is used by the order module to validate and price a cart.
func (s *Service) FindByIDs(ctx context.Context, restaurantID string, ids []string) ([]entity.Menu, error) {
	return s.repo.FindByIDs(ctx, restaurantID, ids)
}

func (s *Service) Get(ctx context.Context, id, restaurantID string) (*entity.Menu, error) {
	return s.repo.FindByID(ctx, id, restaurantID)
}

func (s *Service) Update(ctx context.Context, id, restaurantID string, req UpdateMenuRequest) (*entity.Menu, error) {
	m, err := s.repo.FindByID(ctx, id, restaurantID)
	if err != nil {
		return nil, err
	}

	if req.Category != nil {
		m.Category = *req.Category
	}
	if req.Name != nil {
		m.Name = *req.Name
	}
	if req.Description != nil {
		m.Description = *req.Description
	}
	if req.Price != nil {
		m.Price = *req.Price
	}
	if req.ImageURL != nil {
		m.ImageURL = *req.ImageURL
	}
	if req.IsAvailable != nil {
		m.IsAvailable = *req.IsAvailable
	}

	if err := s.repo.Update(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Delete(ctx context.Context, id, restaurantID string) error {
	return s.repo.Delete(ctx, id, restaurantID)
}
