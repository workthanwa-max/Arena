package middleware

import (
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	apperrors "go-backend/internal/shared/errors"
)

// SecurityHeaders applies strict perimeter security headers to every HTTP response.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'none'")
		next.ServeHTTP(w, r)
	})
}

// CORS enforces a strict origin allowlist without wildcard '*'.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if slices.Contains(allowedOrigins, origin) {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Credentials", "true")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				} else if r.Method == http.MethodOptions {
					apperrors.WriteJSON(w, http.StatusForbidden, apperrors.CodeUnauthorized, "origin not allowed")
					return
				}
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

type bucket struct {
	tokens     float64
	lastRefill time.Time
}

// RateLimiter provides per-IP token bucket rate limiting for HTTP endpoints.
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	capacity float64
	rate     float64 // tokens per second
}

// NewRateLimiter creates a token bucket limiter allowing burst capacity and steady refill rate.
func NewRateLimiter(capacity int, perMinute int) *RateLimiter {
	return &RateLimiter{
		buckets:  make(map[string]*bucket),
		capacity: float64(capacity),
		rate:     float64(perMinute) / 60.0,
	}
}

// Allow checks whether the given client IP has tokens available.
func (rl *RateLimiter) Allow(ip string) bool {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if len(rl.buckets) > 1024 {
		for k, v := range rl.buckets {
			if now.Sub(v.lastRefill) > 5*time.Minute {
				delete(rl.buckets, k)
			}
		}
	}

	b, ok := rl.buckets[ip]
	if !ok {
		rl.buckets[ip] = &bucket{tokens: rl.capacity - 1, lastRefill: now}
		return true
	}

	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens += elapsed * rl.rate
	if b.tokens > rl.capacity {
		b.tokens = rl.capacity
	}
	b.lastRefill = now

	if b.tokens < 1 {
		return false
	}
	b.tokens -= 1
	return true
}

// Middleware wraps an HTTP handler with per-IP rate limiting.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := ExtractIP(r)
		if !rl.Allow(ip) {
			apperrors.WriteJSON(w, http.StatusTooManyRequests, apperrors.CodeRateLimited, "too many requests")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ExtractIP returns the client's IP address without port.
func ExtractIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
