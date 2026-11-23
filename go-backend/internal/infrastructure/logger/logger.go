package logger

import (
	"log/slog"
	"os"
)

// New creates a structured JSON logger using Go standard library log/slog.
func New() *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	return slog.New(handler)
}

// Redact masks sensitive values before writing to structured logs.
func Redact(val string) string {
	if len(val) <= 4 {
		return "****"
	}
	return val[:2] + "****" + val[len(val)-2:]
}
