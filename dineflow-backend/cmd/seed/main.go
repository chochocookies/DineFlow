// Command seed populates a restaurant with a starter menu so the ordering
// flow, Kitchen Display, and dashboard best-sellers all have something to
// show during local testing instead of an empty list.
//
// Usage:
//
//	go run ./cmd/seed                        # seeds the first restaurant found
//	go run ./cmd/seed --restaurant=<uuid>     # seeds a specific restaurant
//
// It's safe to run more than once — menu items are matched by name per
// restaurant, so anything already there is skipped rather than duplicated.
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"

	"github.com/chochocookies/dineflow-backend/internal/config"
	"github.com/chochocookies/dineflow-backend/pkg/database"
)

type menuSeed struct {
	Category    string
	Name        string
	Description string
	Price       float64
}

// A representative Indonesian warung menu spread across the categories
// MenuBrowser already groups by on the frontend (category is a free-form
// string, not a fixed enum — whatever's used here shows up as its own
// section there).
var seedMenus = []menuSeed{
	// Makanan Utama
	{"Makanan Utama", "Nasi Goreng Kampung", "Nasi goreng bumbu merah dengan telur mata sapi dan kerupuk", 28000},
	{"Makanan Utama", "Ayam Geprek Sambal Bawang", "Ayam goreng tepung digeprek dengan sambal bawang pedas", 25000},
	{"Makanan Utama", "Mie Ayam Bakso", "Mie ayam dengan topping bakso dan pangsit goreng", 22000},
	{"Makanan Utama", "Soto Ayam Lamongan", "Soto ayam kuah kuning dengan koya dan telur rebus", 24000},
	{"Makanan Utama", "Nasi Padang Rendang", "Nasi dengan rendang sapi, sayur singkong, dan sambal ijo", 32000},
	{"Makanan Utama", "Gado-Gado Jakarta", "Sayuran rebus dengan bumbu kacang dan kerupuk", 20000},
	{"Makanan Utama", "Sate Ayam (10 tusuk)", "Sate ayam bumbu kacang dengan lontong", 27000},
	{"Makanan Utama", "Nasi Uduk Komplit", "Nasi uduk dengan ayam goreng, tempe orek, dan sambal kacang", 26000},
	// Camilan
	{"Camilan", "Tahu Isi Goreng", "Tahu goreng isi sayuran, 5 buah", 12000},
	{"Camilan", "Pisang Goreng Keju", "Pisang goreng crispy dengan taburan keju parut", 15000},
	{"Camilan", "Tempe Mendoan", "Tempe goreng tepung setengah matang, 6 potong", 13000},
	{"Camilan", "Cireng Bumbu Rujak", "Aci goreng dengan saus bumbu rujak pedas manis", 14000},
	// Minuman
	{"Minuman", "Es Teh Manis", "Teh manis dingin", 6000},
	{"Minuman", "Es Jeruk Peras", "Jeruk peras segar dengan es", 10000},
	{"Minuman", "Kopi Susu Gula Aren", "Kopi susu dengan gula aren khas nusantara", 18000},
	{"Minuman", "Es Cendol", "Cendol dengan santan dan gula merah", 15000},
	{"Minuman", "Air Mineral", "Air mineral dalam kemasan botol", 5000},
	{"Minuman", "Jus Alpukat", "Jus alpukat kental dengan susu cokelat", 16000},
	// Dessert
	{"Dessert", "Es Krim Goreng", "Es krim vanila dibalut tepung roti lalu digoreng", 18000},
	{"Dessert", "Pisang Ijo", "Pisang dibalut adonan hijau dengan saus santan", 16000},
	{"Dessert", "Puding Roti", "Puding roti dengan saus vanila", 14000},
}

func main() {
	restaurantFlag := flag.String("restaurant", "", "Restaurant ID to seed (defaults to the first restaurant found, ordered by creation date)")
	flag.Parse()

	cfg := config.Load()
	db, err := database.NewPostgres(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	restaurantID, restaurantName, err := resolveRestaurant(ctx, db, *restaurantFlag)
	if err != nil {
		log.Fatalf("%v", err)
	}
	fmt.Printf("Seeding menu for restaurant %q (%s)\n", restaurantName, restaurantID)

	inserted, skipped, err := seedMenuItems(ctx, db, restaurantID)
	if err != nil {
		log.Fatalf("seeding failed: %v", err)
	}
	fmt.Printf("Done — %d menu item(s) added, %d already existed and were skipped.\n", inserted, skipped)
}

// resolveRestaurant looks up the restaurant to seed: by ID if one was
// passed on the command line, otherwise the earliest-created restaurant in
// the database (the common case for a single-restaurant local setup).
func resolveRestaurant(ctx context.Context, db *sql.DB, id string) (string, string, error) {
	if id != "" {
		var name string
		err := db.QueryRowContext(ctx, `SELECT name FROM restaurants WHERE id = $1`, id).Scan(&name)
		if err == sql.ErrNoRows {
			return "", "", fmt.Errorf("no restaurant found with id %s", id)
		}
		if err != nil {
			return "", "", err
		}
		return id, name, nil
	}

	var foundID, name string
	err := db.QueryRowContext(ctx, `SELECT id, name FROM restaurants ORDER BY created_at ASC LIMIT 1`).Scan(&foundID, &name)
	if err == sql.ErrNoRows {
		return "", "", fmt.Errorf("no restaurants exist yet — register one first (POST /api/v1/auth/register, or sign up via the admin login page), then re-run the seeder")
	}
	if err != nil {
		return "", "", err
	}
	return foundID, name, nil
}

// seedMenuItems inserts every entry in seedMenus that doesn't already exist
// for restaurantID (matched by name). image_url is stored as an empty
// string, same as menu.Service.Create does when the field is left blank
// through the normal API/admin-UI path — the menus table allows NULL there,
// but entity.Menu.ImageURL is a plain (non-pointer) string, so scanning an
// actual NULL back out fails with a sql.Scan error. Fill photos in later
// through the admin Menu page's edit sheet once you have real image URLs
// to use.
func seedMenuItems(ctx context.Context, db *sql.DB, restaurantID string) (inserted, skipped int, err error) {
	for _, m := range seedMenus {
		var exists bool
		err = db.QueryRowContext(ctx,
			`SELECT EXISTS(SELECT 1 FROM menus WHERE restaurant_id = $1 AND name = $2)`,
			restaurantID, m.Name,
		).Scan(&exists)
		if err != nil {
			return inserted, skipped, err
		}
		if exists {
			skipped++
			continue
		}

		_, err = db.ExecContext(ctx,
			`INSERT INTO menus (restaurant_id, category, name, description, price, image_url, is_available)
			 VALUES ($1, $2, $3, $4, $5, $6, true)`,
			restaurantID, m.Category, m.Name, m.Description, m.Price, "",
		)
		if err != nil {
			return inserted, skipped, err
		}
		inserted++
	}
	return inserted, skipped, nil
}
