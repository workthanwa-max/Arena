package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"go-backend/internal/infrastructure/config"
	"go-backend/internal/modules/auth"
	"go-backend/internal/modules/room"
	"go-backend/internal/modules/session"
	"go-backend/internal/modules/state"
	gamesync "go-backend/internal/modules/sync"
	apperrors "go-backend/internal/shared/errors"
	"go-backend/internal/shared/middleware"
	"go-backend/internal/shared/ws"
	"go-backend/internal/shared/wt"

	"github.com/quic-go/webtransport-go"
)

type registerRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type selectCharacterRequest struct {
	CharacterID string `json:"characterId"`
}

type createRoomRequest struct {
	PlayerName  string `json:"playerName"`
	Mode        string `json:"mode"`
	MapID       string `json:"mapId"`
	WaitInLobby bool   `json:"waitInLobby"`
}

// NewRouter builds the perimeter HTTP ServeMux with auth guards, security middlewares, and game routes.
func NewRouter(
	cfg *config.Config,
	db *sql.DB,
	authSvc *auth.Service,
	roomMgr *room.Manager,
	sessMgr *session.Manager,
	syncer *gamesync.Synchronizer,
	log *slog.Logger,
) http.Handler {
	mux := http.NewServeMux()
	roomCreateLimiter := middleware.NewRateLimiter(12, 40)
	authLimiter := middleware.NewRateLimiter(12, 30)

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		pgStatus := "ok"
		statusCode := http.StatusOK
		if db == nil {
			pgStatus = "disabled"
		} else {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := db.PingContext(ctx); err != nil {
				pgStatus = "error"
				statusCode = http.StatusServiceUnavailable
			}
		}

		writeJSON(w, statusCode, map[string]any{
			"status":         pgStatus,
			"postgres":       pgStatus,
			"database":       "postgres",
			"activeRooms":    roomMgr.ActiveCount(),
			"activeSessions": sessMgr.ActiveCount(),
		})
	})

	// Advertises binary WebSocket fast-path and directly reachable HTTP/3 WebTransport QUIC Datagram endpoint.
	mux.HandleFunc("GET /api/transport/info", func(w http.ResponseWriter, r *http.Request) {
		wtURL := cfg.WTBaseURL
		isProxied := r.Header.Get("CF-Ray") != "" || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
		if wtURL == "" && cfg.WTCertHash != "" && cfg.WTPort != "" && !isProxied {
			host := strings.Split(r.Host, ":")[0]
			if isLocalHostOrLAN(host) {
				wtURL = "https://" + host + ":" + cfg.WTPort + "/wt"
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"binaryWs":        true,
			"webTransportUrl": wtURL,
			"certSha256":      cfg.WTCertHash,
		})
	})

	mux.HandleFunc("GET /api/characters", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Vary", "Cookie, Authorization")
		w.WriteHeader(http.StatusOK)
		if prof, _, err := authSvc.AuthenticateRequest(r); err == nil && prof.Role == "admin" {
			_, _ = w.Write(state.AllCharactersJSON())
			return
		}
		_, _ = w.Write(state.PublicCharactersJSON())
	})

	// Member Authentication Endpoints (Unlimited Session until explicit Logout)
	mux.Handle("POST /api/auth/register", authLimiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 2048)
		var req registerRequest
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			apperrors.WriteJSON(w, http.StatusBadRequest, apperrors.CodeInvalidInput, "ข้อมูลสมัครสมาชิกไม่ถูกต้อง")
			return
		}

		prof, token, err := authSvc.Register(r.Context(), req.Username, req.Password, req.DisplayName, r.UserAgent())
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrInvalidUsername), errors.Is(err, auth.ErrInvalidPassword):
				apperrors.WriteJSON(w, http.StatusBadRequest, apperrors.CodeInvalidInput, err.Error())
			case errors.Is(err, auth.ErrUsernameTaken):
				apperrors.WriteJSON(w, http.StatusConflict, apperrors.CodeConflict, err.Error())
			default:
				log.Error("register failed", "error", err)
				apperrors.WriteJSON(w, http.StatusInternalServerError, apperrors.CodeInternalError, "ไม่สามารถสมัครสมาชิกได้")
			}
			return
		}

		auth.SetSessionCookie(w, r, token)
		writeJSON(w, http.StatusCreated, map[string]any{
			"user":  prof,
			"token": token,
		})
	})))

	mux.Handle("POST /api/auth/login", authLimiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 2048)
		var req loginRequest
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			apperrors.WriteJSON(w, http.StatusBadRequest, apperrors.CodeInvalidInput, "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง")
			return
		}

		prof, token, err := authSvc.Login(r.Context(), req.Username, req.Password, r.UserAgent())
		if err != nil {
			if errors.Is(err, auth.ErrInvalidCredential) {
				apperrors.WriteJSON(w, http.StatusUnauthorized, apperrors.CodeUnauthenticated, err.Error())
				return
			}
			log.Error("login failed", "error", err)
			apperrors.WriteJSON(w, http.StatusInternalServerError, apperrors.CodeInternalError, "ไม่สามารถเข้าสู่ระบบได้")
			return
		}

		auth.SetSessionCookie(w, r, token)
		writeJSON(w, http.StatusOK, map[string]any{
			"user":  prof,
			"token": token,
		})
	})))

	mux.HandleFunc("POST /api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		_, tok, err := authSvc.AuthenticateRequest(r)
		if err == nil && tok != "" {
			_ = authSvc.RevokeToken(r.Context(), tok)
		}
		auth.ClearSessionCookie(w, r)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	mux.HandleFunc("GET /api/auth/me", func(w http.ResponseWriter, r *http.Request) {
		prof, tok, err := authSvc.AuthenticateRequest(r)
		if err != nil {
			apperrors.WriteJSON(w, http.StatusUnauthorized, apperrors.CodeUnauthenticated, auth.ErrUnauthenticated.Error())
			return
		}
		// Refresh 1-year cookie cleanly even when authenticated via persisted Bearer token
		auth.SetSessionCookie(w, r, tok)
		writeJSON(w, http.StatusOK, map[string]any{
			"user":  prof,
			"token": tok,
		})
	})

	mux.HandleFunc("PUT /api/users/me/character", func(w http.ResponseWriter, r *http.Request) {
		prof, _, err := authSvc.AuthenticateRequest(r)
		if err != nil {
			apperrors.WriteJSON(w, http.StatusUnauthorized, apperrors.CodeUnauthenticated, auth.ErrUnauthenticated.Error())
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1024)
		var req selectCharacterRequest
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			apperrors.WriteJSON(w, http.StatusBadRequest, apperrors.CodeInvalidInput, "ข้อมูลตัวละครไม่ถูกต้อง")
			return
		}
		updated, err := authSvc.UpdateSelectedCharacter(r.Context(), prof.ID, strings.TrimSpace(req.CharacterID))
		if err != nil {
			if errors.Is(err, auth.ErrInvalidCharacter) {
				apperrors.WriteJSON(w, http.StatusBadRequest, apperrors.CodeInvalidInput, err.Error())
				return
			}
			if errors.Is(err, auth.ErrForbiddenCharacter) {
				apperrors.WriteJSON(w, http.StatusForbidden, apperrors.CodeInvalidInput, err.Error())
				return
			}
			log.Error("update character failed", "error", err)
			apperrors.WriteJSON(w, http.StatusInternalServerError, apperrors.CodeInternalError, "ไม่สามารถบันทึกตัวละครได้")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"user": updated})
	})

	// Protected 6-Digit Room Lifecycle Routes
	mux.Handle("POST /api/rooms", roomCreateLimiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prof, _, err := authSvc.AuthenticateRequest(r)
		if err != nil {
			apperrors.WriteJSON(w, http.StatusUnauthorized, apperrors.CodeUnauthenticated, auth.ErrUnauthenticated.Error())
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1024)
		var req createRoomRequest
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil && err.Error() != "EOF" {
			apperrors.WriteJSON(w, http.StatusBadRequest, apperrors.CodeInvalidInput, "invalid request body")
			return
		}

		info, err := roomMgr.CreateRoom(r.Context(), room.CreateRoomOptions{
			Mode:        strings.TrimSpace(req.Mode),
			MapID:       strings.TrimSpace(req.MapID),
			HostUserID:  prof.ID,
			WaitInLobby: req.WaitInLobby,
		})
		if err != nil {
			log.Error("create room failed", "error", err)
			apperrors.WriteJSON(w, http.StatusInternalServerError, apperrors.CodeInternalError, "could not create room")
			return
		}
		writeJSON(w, http.StatusCreated, info)
	})))

	mux.HandleFunc("GET /api/rooms/{id}", func(w http.ResponseWriter, r *http.Request) {
		if _, _, err := authSvc.AuthenticateRequest(r); err != nil {
			apperrors.WriteJSON(w, http.StatusUnauthorized, apperrors.CodeUnauthenticated, auth.ErrUnauthenticated.Error())
			return
		}

		roomID := strings.TrimSpace(r.PathValue("id"))
		if roomID == "" {
			apperrors.WriteJSON(w, http.StatusBadRequest, apperrors.CodeInvalidInput, "room id is required")
			return
		}

		info, ok := roomMgr.GetRoomInfo(roomID)
		if !ok {
			apperrors.WriteJSON(w, http.StatusNotFound, apperrors.CodeRoomNotFound, "ไม่พบห้องหมายเลข "+roomID)
			return
		}
		writeJSON(w, http.StatusOK, info)
	})

	// Real-time WebSocket Arena & Lobby Connection (Authenticated Member Only)
	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		prof, _, authErr := authSvc.AuthenticateRequest(r)
		roomID := strings.TrimSpace(r.URL.Query().Get("roomId"))
		characterID := strings.TrimSpace(r.URL.Query().Get("characterId"))

		conn, err := ws.Upgrade(w, r, cfg.AllowedOrigins, 4096)
		if err != nil {
			log.Warn("ws upgrade failed", "error", err, "remote", middleware.ExtractIP(r))
			return
		}

		if authErr != nil {
			errBytes, _ := json.Marshal(gamesync.ErrorMessage{
				Type:    "error",
				Code:    apperrors.CodeUnauthenticated,
				Message: auth.ErrUnauthenticated.Error(),
			})
			_ = conn.WriteText(errBytes)
			_ = conn.WriteClose()
			return
		}

		if characterID == "" {
			characterID = prof.SelectedCharacterID
		}
		if charDef := state.GetCharacter(characterID); charDef.AdminOnly && prof.Role != "admin" {
			characterID = "pa"
		}
		binMode := strings.TrimSpace(r.URL.Query().Get("proto")) == "bin1"
		rm, sess, err := roomMgr.JoinRoomWithProto(roomID, prof.ID, prof.Role, prof.DisplayName, characterID, conn, binMode)
		if err != nil {
			code := room.MapErrorCode(err)
			msg := err.Error()
			if errors.Is(err, room.ErrRoomFull) {
				msg = "ห้องเต็มความจุแล้ว"
			}
			errBytes, _ := json.Marshal(gamesync.ErrorMessage{
				Type:    "error",
				Code:    code,
				Message: msg,
			})
			_ = conn.WriteText(errBytes)
			_ = conn.WriteClose()
			return
		}

		sess.RunPumps(rm, func() {
			sessMgr.Remove(sess.ID())
		})
	})

	handler := middleware.SecurityHeaders(mux)
	handler = middleware.CORS(cfg.AllowedOrigins)(handler)
	return handler
}

// NewWebTransportHandler serves `/wt` HTTP/3 QUIC sessions (Unreliable Datagrams + Reliable Control Stream).
func NewWebTransportHandler(
	cfg *config.Config,
	authSvc *auth.Service,
	roomMgr *room.Manager,
	sessMgr *session.Manager,
	log *slog.Logger,
	wtSrvFn func() *webtransport.Server,
) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/wt", func(w http.ResponseWriter, r *http.Request) {
		wtSrv := wtSrvFn()
		if wtSrv == nil {
			http.Error(w, "webtransport unavailable", http.StatusServiceUnavailable)
			return
		}
		prof, _, authErr := authSvc.AuthenticateRequest(r)
		if authErr != nil {
			http.Error(w, auth.ErrUnauthenticated.Error(), http.StatusUnauthorized)
			return
		}
		roomID := strings.TrimSpace(r.URL.Query().Get("roomId"))
		characterID := strings.TrimSpace(r.URL.Query().Get("characterId"))

		rawSess, err := wtSrv.Upgrade(w, r)
		if err != nil {
			log.Warn("wt upgrade failed", "error", err)
			return
		}
		conn, err := wt.NewConn(rawSess)
		if err != nil {
			_ = rawSess.CloseWithError(1, "control stream missing")
			return
		}
		if characterID == "" {
			characterID = prof.SelectedCharacterID
		}
		if charDef := state.GetCharacter(characterID); charDef.AdminOnly && prof.Role != "admin" {
			characterID = "pa"
		}
		rm, sess, err := roomMgr.JoinRoomWithProto(roomID, prof.ID, prof.Role, prof.DisplayName, characterID, conn, true)
		if err != nil {
			errBytes, _ := json.Marshal(gamesync.ErrorMessage{
				Type:    "error",
				Code:    room.MapErrorCode(err),
				Message: err.Error(),
			})
			_ = conn.WriteReliableText(errBytes)
			_ = conn.Close()
			return
		}
		sess.RunPumps(rm, func() {
			sessMgr.Remove(sess.ID())
		})
	})
	return mux
}

func isLocalHostOrLAN(host string) bool {
	if host == "" || host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate())
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
