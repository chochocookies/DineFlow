package dashboard

import "context"

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

type PeriodWithAverage struct {
	OrderCount   int     `json:"order_count"`
	TotalSales   float64 `json:"total_sales"`
	AverageOrder float64 `json:"average_order"`
}

type Summary struct {
	Today      PeriodWithAverage `json:"today"`
	ThisWeek   PeriodWithAverage `json:"this_week"`
	ThisMonth  PeriodWithAverage `json:"this_month"`
	DailyTrend []DailyPoint      `json:"daily_trend"`
}

func withAverage(p PeriodStats) PeriodWithAverage {
	var avg float64
	if p.OrderCount > 0 {
		avg = p.TotalSales / float64(p.OrderCount)
	}
	return PeriodWithAverage{OrderCount: p.OrderCount, TotalSales: p.TotalSales, AverageOrder: avg}
}

func (s *Service) Summary(ctx context.Context, restaurantID string) (*Summary, error) {
	today, err := s.repo.TodayStats(ctx, restaurantID)
	if err != nil {
		return nil, err
	}
	week, err := s.repo.ThisWeekStats(ctx, restaurantID)
	if err != nil {
		return nil, err
	}
	month, err := s.repo.ThisMonthStats(ctx, restaurantID)
	if err != nil {
		return nil, err
	}
	trend, err := s.repo.DailyTrend(ctx, restaurantID, 7)
	if err != nil {
		return nil, err
	}

	return &Summary{
		Today:      withAverage(today),
		ThisWeek:   withAverage(week),
		ThisMonth:  withAverage(month),
		DailyTrend: trend,
	}, nil
}

func (s *Service) BestSellers(ctx context.Context, restaurantID string, limit int) ([]BestSeller, error) {
	if limit <= 0 || limit > 50 {
		limit = 5
	}
	return s.repo.BestSellers(ctx, restaurantID, limit)
}
