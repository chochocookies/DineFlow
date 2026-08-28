package inventory

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

func (s *Service) Create(ctx context.Context, restaurantID string, req CreateIngredientRequest) (*entity.Ingredient, error) {
	i := &entity.Ingredient{
		RestaurantID:  restaurantID,
		Name:          req.Name,
		Unit:          req.Unit,
		StockQuantity: req.StockQuantity,
	}
	if err := s.repo.Create(ctx, i); err != nil {
		return nil, err
	}
	return i, nil
}

func (s *Service) List(ctx context.Context, restaurantID string) ([]entity.Ingredient, error) {
	return s.repo.ListByRestaurant(ctx, restaurantID)
}

func (s *Service) Get(ctx context.Context, id, restaurantID string) (*entity.Ingredient, error) {
	return s.repo.FindByID(ctx, id, restaurantID)
}

func (s *Service) Update(ctx context.Context, id, restaurantID string, req UpdateIngredientRequest) (*entity.Ingredient, error) {
	i, err := s.repo.FindByID(ctx, id, restaurantID)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		i.Name = *req.Name
	}
	if req.Unit != nil {
		i.Unit = *req.Unit
	}
	if req.StockQuantity != nil {
		i.StockQuantity = *req.StockQuantity
	}
	if err := s.repo.Update(ctx, i); err != nil {
		return nil, err
	}
	return i, nil
}

func (s *Service) AdjustStock(ctx context.Context, id, restaurantID string, req AdjustStockRequest) (*entity.Ingredient, error) {
	return s.repo.AdjustStock(ctx, id, restaurantID, req.Delta)
}

func (s *Service) Delete(ctx context.Context, id, restaurantID string) error {
	return s.repo.Delete(ctx, id, restaurantID)
}

func (s *Service) GetRecipe(ctx context.Context, menuID string) ([]entity.RecipeLine, error) {
	return s.repo.GetRecipe(ctx, menuID)
}

func (s *Service) SetRecipe(ctx context.Context, menuID string, req SetRecipeRequest) error {
	return s.repo.SetRecipe(ctx, menuID, req.Items)
}

// RecipesForMenus is used by order.Service to compute inventory deductions
// when a cart is checked out — see internal/order/service.go.
func (s *Service) RecipesForMenus(ctx context.Context, menuIDs []string) (map[string][]entity.RecipeLine, error) {
	return s.repo.RecipesForMenus(ctx, menuIDs)
}
