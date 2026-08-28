// Package dashboard is read-only reporting on top of orders/order_items —
// no new tables, just aggregate queries.
package dashboard

import (
	"context"
	"database/sql"
	"time"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type PeriodStats struct {
	OrderCount int     `json:"order_count"`
	TotalSales float64 `json:"total_sales"`
}

// "Sales" here means non-cancelled orders placed in the period, not
// necessarily paid yet — dine-in customers often pay after eating, so this
// is the "how's today going" operational number owners want to watch live,
// not a strict accounting figure. All three queries share the same shape;
// only the date_trunc boundary differs.
func (r *Repository) TodayStats(ctx context.Context, restaurantID string) (PeriodStats, error) {
	return r.scanPeriod(ctx,
		`SELECT COUNT(*), COALESCE(SUM(total), 0) FROM orders
		 WHERE restaurant_id = $1 AND status != 'cancelled' AND created_at >= date_trunc('day', now())`,
		restaurantID)
}

func (r *Repository) ThisWeekStats(ctx context.Context, restaurantID string) (PeriodStats, error) {
	return r.scanPeriod(ctx,
		`SELECT COUNT(*), COALESCE(SUM(total), 0) FROM orders
		 WHERE restaurant_id = $1 AND status != 'cancelled' AND created_at >= date_trunc('week', now())`,
		restaurantID)
}

func (r *Repository) ThisMonthStats(ctx context.Context, restaurantID string) (PeriodStats, error) {
	return r.scanPeriod(ctx,
		`SELECT COUNT(*), COALESCE(SUM(total), 0) FROM orders
		 WHERE restaurant_id = $1 AND status != 'cancelled' AND created_at >= date_trunc('month', now())`,
		restaurantID)
}

func (r *Repository) scanPeriod(ctx context.Context, query, restaurantID string) (PeriodStats, error) {
	var s PeriodStats
	err := r.db.QueryRowContext(ctx, query, restaurantID).Scan(&s.OrderCount, &s.TotalSales)
	return s, err
}

type DailyPoint struct {
	Date  string  `json:"date"`
	Total float64 `json:"total"`
}

// DailyTrend returns exactly `days` consecutive points ending today, zero-
// filled for days with no orders, so a chart never has gaps. Assumes the DB
// session and this server agree on UTC — true for the default docker
// postgres image plus Go's time.Now().UTC() below.
func (r *Repository) DailyTrend(ctx context.Context, restaurantID string, days int) ([]DailyPoint, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT date_trunc('day', created_at)::date AS day, COALESCE(SUM(total), 0)
		 FROM orders
		 WHERE restaurant_id = $1 AND status != 'cancelled'
		   AND created_at >= date_trunc('day', now()) - ($2::int - 1) * interval '1 day'
		 GROUP BY day ORDER BY day`,
		restaurantID, days,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byDate := make(map[string]float64)
	for rows.Next() {
		var day time.Time
		var total float64
		if err := rows.Scan(&day, &total); err != nil {
			return nil, err
		}
		byDate[day.Format("2006-01-02")] = total
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	points := make([]DailyPoint, 0, days)
	today := time.Now().UTC().Truncate(24 * time.Hour)
	for i := days - 1; i >= 0; i-- {
		key := today.AddDate(0, 0, -i).Format("2006-01-02")
		points = append(points, DailyPoint{Date: key, Total: byDate[key]})
	}
	return points, nil
}

type BestSeller struct {
	MenuID     string `json:"menu_id"`
	MenuName   string `json:"menu_name"`
	TotalQty   int    `json:"total_quantity"`
	OrderCount int    `json:"order_count"`
}

func (r *Repository) BestSellers(ctx context.Context, restaurantID string, limit int) ([]BestSeller, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT oi.menu_id, m.name, SUM(oi.quantity)::int, COUNT(DISTINCT oi.order_id)::int
		 FROM order_items oi
		 JOIN orders o ON o.id = oi.order_id
		 JOIN menus m ON m.id = oi.menu_id
		 WHERE o.restaurant_id = $1 AND o.status != 'cancelled'
		 GROUP BY oi.menu_id, m.name
		 ORDER BY SUM(oi.quantity) DESC
		 LIMIT $2`,
		restaurantID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []BestSeller{}
	for rows.Next() {
		var b BestSeller
		if err := rows.Scan(&b.MenuID, &b.MenuName, &b.TotalQty, &b.OrderCount); err != nil {
			return nil, err
		}
		items = append(items, b)
	}
	return items, rows.Err()
}
