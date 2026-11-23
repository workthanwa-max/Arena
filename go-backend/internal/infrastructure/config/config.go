package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds validated runtime configuration loaded from environment variables.
type Config struct {
	Port              string
	WTPort            string
	WTBaseURL         string
	WTCertFile        string
	WTKeyFile         string
	WTCertHash        string
	AllowedOrigins    []string
	ShareBaseURL      string
	DatabaseURL       string
	TickRateHz        int
	MaxPlayersPerRoom int
}

// Load reads configuration from environment variables with safe development defaults and validates them.
func Load() (*Config, error) {
	port := getEnv("PORT", "7777")
	if p, err := strconv.Atoi(port); err != nil || p < 1 || p > 65535 {
		return nil, fmt.Errorf("invalid PORT %q", port)
	}

	originsRaw := getEnv("ALLOWED_ORIGINS", "http://localhost:5555,http://127.0.0.1:5555,https://arene.kitsakorn.com,http://arene.kitsakorn.com,https://arena.kitsakorn.com,http://arena.kitsakorn.com,https://loykrathong.kitsakorn.com,http://loykrathong.kitsakorn.com")
	var origins []string
	for _, o := range strings.Split(originsRaw, ",") {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			if trimmed == "*" {
				return nil, fmt.Errorf("wildcard '*' is not allowed in ALLOWED_ORIGINS")
			}
			origins = append(origins, trimmed)
		}
	}
	if len(origins) == 0 {
		return nil, fmt.Errorf("ALLOWED_ORIGINS must contain at least one origin")
	}

	shareBaseURL := strings.TrimRight(getEnv("SHARE_BASE_URL", "http://localhost:5555"), "/")
	databaseURL := getEnv("DATABASE_URL", "postgres://pulsearena:pulsearena@127.0.0.1:5435/pulsearena?sslmode=disable")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL must not be empty")
	}

	tickRate, err := strconv.Atoi(getEnv("TICK_RATE_HZ", "60"))
	if err != nil || tickRate < 5 || tickRate > 120 {
		return nil, fmt.Errorf("TICK_RATE_HZ must be between 5 and 120")
	}

	maxPlayers, err := strconv.Atoi(getEnv("MAX_PLAYERS_PER_ROOM", "5"))
	if err != nil || maxPlayers < 2 || maxPlayers > 20 {
		return nil, fmt.Errorf("MAX_PLAYERS_PER_ROOM must be between 2 and 20")
	}

	wtPort := getEnv("WT_PORT", "8443")
	wtBaseURL := strings.TrimRight(getEnv("WT_BASE_URL", ""), "/")
	wtCertFile := getEnv("WT_TLS_CERT", "")
	wtKeyFile := getEnv("WT_TLS_KEY", "")

	return &Config{
		Port:              port,
		WTPort:            wtPort,
		WTBaseURL:         wtBaseURL,
		WTCertFile:        wtCertFile,
		WTKeyFile:         wtKeyFile,
		AllowedOrigins:    origins,
		ShareBaseURL:      shareBaseURL,
		DatabaseURL:       databaseURL,
		TickRateHz:        tickRate,
		MaxPlayersPerRoom: maxPlayers,
	}, nil
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
