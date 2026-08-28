package config

import "os"

type Config struct {
	AppPort string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	JWTSecret   string
	JWTExpiryHr int

	// PaymentGateway selects which pkg/paymentgateway implementation main.go
	// wires up: "mock" (default, for local dev with no real credentials) or
	// "midtrans".
	PaymentGateway       string
	MidtransServerKey    string
	MidtransIsProduction bool
}

// Load reads configuration from environment variables (see .env.example),
// falling back to sane local-dev defaults for anything unset.
func Load() *Config {
	return &Config{
		AppPort: getEnv("APP_PORT", "8080"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "dineflow"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		JWTSecret:   getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiryHr: 24,

		PaymentGateway:       getEnv("PAYMENT_GATEWAY", "mock"),
		MidtransServerKey:    getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransIsProduction: getEnv("MIDTRANS_IS_PRODUCTION", "false") == "true",
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
