package errors

import (
	"encoding/json"
	"net/http"
)

// Standard application error codes.
const (
	CodeRoomNotFound      = "ROOM_NOT_FOUND"
	CodeRoomFull          = "ROOM_FULL"
	CodeInvalidInput      = "INVALID_INPUT"
	CodeInvalidPlayerName = "INVALID_PLAYER_NAME"
	CodeRateLimited       = "RATE_LIMITED"
	CodeUnauthorized      = "UNAUTHORIZED_ORIGIN"
	CodeUnauthenticated   = "UNAUTHENTICATED"
	CodeForbidden         = "FORBIDDEN"
	CodeConflict          = "CONFLICT"
	CodeMatchState        = "INVALID_MATCH_STATE"
	CodeInternalError     = "INTERNAL_ERROR"
)

// ErrorResponse represents a consistent JSON error payload.
type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// WriteJSON sends a structured JSON error response with the given HTTP status code.
func WriteJSON(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ErrorResponse{
		Code:    code,
		Message: message,
	})
}
