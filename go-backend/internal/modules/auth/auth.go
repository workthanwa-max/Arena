package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"

	"golang.org/x/crypto/argon2"

	"go-backend/internal/modules/state"
)

const (
	SessionCookieName = "pulse_session"
	SessionTTL        = 365 * 24 * time.Hour
	SessionMaxAgeSec  = 365 * 24 * 60 * 60 // 1 year (365 days)

	argonTime    = 1
	argonMemory  = 64 * 1024
	argonThreads = 4
	argonKeyLen  = 32
)

var (
	ErrInvalidUsername   = errors.New("ชื่อผู้ใช้ต้องมี 3-20 ตัวอักษร (a-z, 0-9, _, -)")
	ErrInvalidPassword   = errors.New("รหัสผ่านต้องมีความยาว 6-72 ตัวอักษร")
	ErrUsernameTaken     = errors.New("ชื่อผู้ใช้นี้มีผู้ใช้งานแล้ว")
	ErrInvalidCredential = errors.New("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
	ErrUnauthenticated    = errors.New("กรุณาเข้าสู่ระบบก่อนใช้งาน")
	ErrInvalidCharacter   = errors.New("ไม่พบตัวละครที่เลือก")
	ErrForbiddenCharacter = errors.New("ตัวละครนี้สงวนไว้สำหรับแอดมินเท่านั้น")

	usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,20}$`)
)

// UserProfile describes an authenticated member's public profile and owned hero roster.
type UserProfile struct {
	ID                  string   `json:"id"`
	Username            string   `json:"username"`
	DisplayName         string   `json:"displayName"`
	Role                string   `json:"role"`
	SelectedCharacterID string   `json:"selectedCharacterId"`
	OwnedCharacterIDs   []string `json:"ownedCharacterIds"`
}

type memUser struct {
	id           string
	username     string
	displayName  string
	role         string
	passwordHash string
	selectedChar string
	ownedChars   map[string]bool
}

type memSession struct {
	id        string
	userID    string
	tokenHash string
	createdAt time.Time
	revoked   bool
}

// Service manages member accounts, Argon2id credentials, starter hero ownership, and non-expiring sessions until Logout.
type Service struct {
	db  *sql.DB
	log *slog.Logger

	mu       sync.RWMutex
	memUsers map[string]*memUser // keyed by lowercase username
	memByID  map[string]*memUser
	memSess  map[string]*memSession // keyed by tokenHash
}

// NewService constructs the Authentication & Profile Service.
func NewService(db *sql.DB, log *slog.Logger) *Service {
	return &Service{
		db:       db,
		log:      log,
		memUsers: make(map[string]*memUser),
		memByID:  make(map[string]*memUser),
		memSess:  make(map[string]*memSession),
	}
}

// Register creates a new member account, unlocks all starter heroes, and starts an unlimited session.
func (s *Service) Register(ctx context.Context, rawUsername, rawPassword, rawDisplayName, userAgent string) (*UserProfile, string, error) {
	username := strings.TrimSpace(rawUsername)
	if !usernameRe.MatchString(username) {
		return nil, "", ErrInvalidUsername
	}
	if len(rawPassword) < 6 || len(rawPassword) > 72 {
		return nil, "", ErrInvalidPassword
	}
	displayName := sanitizeDisplayName(rawDisplayName)
	if displayName == "" {
		displayName = username
	}

	pwHash, err := hashPassword(rawPassword)
	if err != nil {
		return nil, "", fmt.Errorf("hash password: %w", err)
	}
	userID, err := newUUID()
	if err != nil {
		return nil, "", fmt.Errorf("generate user id: %w", err)
	}
	rawToken, tokenHash, err := generateSessionToken()
	if err != nil {
		return nil, "", fmt.Errorf("generate session token: %w", err)
	}
	sessID, err := newUUID()
	if err != nil {
		return nil, "", fmt.Errorf("generate session id: %w", err)
	}

	starterIDs := starterCharacterIDs()
	defaultHero := "pa"

	if s.db == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		lower := strings.ToLower(username)
		if _, exists := s.memUsers[lower]; exists {
			return nil, "", ErrUsernameTaken
		}
		owned := make(map[string]bool, len(starterIDs))
		for _, cid := range starterIDs {
			owned[cid] = true
		}
		u := &memUser{
			id:           userID,
			username:     username,
			displayName:  displayName,
			role:         "player",
			passwordHash: pwHash,
			selectedChar: defaultHero,
			ownedChars:   owned,
		}
		s.memUsers[lower] = u
		s.memByID[userID] = u
		s.memSess[tokenHash] = &memSession{id: sessID, userID: userID, tokenHash: tokenHash, createdAt: time.Now().UTC()}
		return &UserProfile{
			ID:                  u.id,
			Username:            u.username,
			DisplayName:         u.displayName,
			Role:                u.role,
			SelectedCharacterID: u.selectedChar,
			OwnedCharacterIDs:   starterIDs,
		}, rawToken, nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, "", fmt.Errorf("begin register tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1))`, username).Scan(&exists); err != nil {
		return nil, "", fmt.Errorf("check username uniqueness: %w", err)
	}
	if exists {
		return nil, "", ErrUsernameTaken
	}

	now := time.Now().UTC()
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO users (id, username, display_name, password_hash, role, selected_character_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, 'player', $5, $6, $6)`,
		userID, username, displayName, pwHash, defaultHero, now,
	); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, "", ErrUsernameTaken
		}
		return nil, "", fmt.Errorf("insert user: %w", err)
	}

	for _, cid := range starterIDs {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO user_characters (user_id, character_id, unlocked_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			userID, cid, now,
		); err != nil {
			return nil, "", fmt.Errorf("grant starter character: %w", err)
		}
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO user_sessions (id, user_id, token_hash, user_agent, created_at, last_seen_at)
		 VALUES ($1, $2, $3, $4, $5, $5)`,
		sessID, userID, tokenHash, truncateAgent(userAgent), now,
	); err != nil {
		return nil, "", fmt.Errorf("insert session: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, "", fmt.Errorf("commit register tx: %w", err)
	}

	return &UserProfile{
		ID:                  userID,
		Username:            username,
		DisplayName:         displayName,
		Role:                "player",
		SelectedCharacterID: defaultHero,
		OwnedCharacterIDs:   starterIDs,
	}, rawToken, nil
}

// Login validates credentials with Argon2id and creates a persistent session valid until Logout.
func (s *Service) Login(ctx context.Context, rawUsername, rawPassword, userAgent string) (*UserProfile, string, error) {
	username := strings.TrimSpace(rawUsername)
	if username == "" || rawPassword == "" {
		return nil, "", ErrInvalidCredential
	}

	rawToken, tokenHash, err := generateSessionToken()
	if err != nil {
		return nil, "", fmt.Errorf("generate session token: %w", err)
	}
	sessID, err := newUUID()
	if err != nil {
		return nil, "", fmt.Errorf("generate session id: %w", err)
	}

	if s.db == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		u, ok := s.memUsers[strings.ToLower(username)]
		if !ok || !verifyPassword(rawPassword, u.passwordHash) {
			return nil, "", ErrInvalidCredential
		}
		s.memSess[tokenHash] = &memSession{id: sessID, userID: u.id, tokenHash: tokenHash, createdAt: time.Now().UTC()}
		return &UserProfile{
			ID:                  u.id,
			Username:            u.username,
			DisplayName:         u.displayName,
			Role:                u.role,
			SelectedCharacterID: u.selectedChar,
			OwnedCharacterIDs:   characterIDsForRole(u.role),
		}, rawToken, nil
	}

	var userID, storedUsername, displayName, pwHash, role, selectedChar string
	err = s.db.QueryRowContext(
		ctx,
		`SELECT id, username, display_name, password_hash, COALESCE(NULLIF(role, ''), 'player'), selected_character_id
		 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
		username,
	).Scan(&userID, &storedUsername, &displayName, &pwHash, &role, &selectedChar)
	if err != nil || !verifyPassword(rawPassword, pwHash) {
		return nil, "", ErrInvalidCredential
	}

	now := time.Now().UTC()
	if _, err := s.db.ExecContext(
		ctx,
		`INSERT INTO user_sessions (id, user_id, token_hash, user_agent, created_at, last_seen_at)
		 VALUES ($1, $2, $3, $4, $5, $5)`,
		sessID, userID, tokenHash, truncateAgent(userAgent), now,
	); err != nil {
		return nil, "", fmt.Errorf("create session: %w", err)
	}

	owned := s.ensureStarterCharacters(ctx, userID, role)
	return &UserProfile{
		ID:                  userID,
		Username:            storedUsername,
		DisplayName:         displayName,
		Role:                role,
		SelectedCharacterID: selectedChar,
		OwnedCharacterIDs:   owned,
	}, rawToken, nil
}

// AuthenticateRequest resolves the active member profile from either the HttpOnly cookie or Authorization Bearer header.
func (s *Service) AuthenticateRequest(r *http.Request) (*UserProfile, string, error) {
	rawToken := extractRequestToken(r)
	if rawToken == "" {
		return nil, "", ErrUnauthenticated
	}
	prof, err := s.ValidateToken(r.Context(), rawToken)
	if err != nil {
		return nil, "", err
	}
	return prof, rawToken, nil
}

// ValidateToken verifies a raw session token against active (non-revoked) sessions.
func (s *Service) ValidateToken(ctx context.Context, rawToken string) (*UserProfile, error) {
	if rawToken == "" {
		return nil, ErrUnauthenticated
	}
	tokenHash := hashToken(rawToken)

	if s.db == nil {
		s.mu.RLock()
		defer s.mu.RUnlock()
		sess, ok := s.memSess[tokenHash]
		if !ok || sess.revoked || (!sess.createdAt.IsZero() && time.Since(sess.createdAt) > SessionTTL) {
			return nil, ErrUnauthenticated
		}
		u, ok := s.memByID[sess.userID]
		if !ok {
			return nil, ErrUnauthenticated
		}
		return &UserProfile{
			ID:                  u.id,
			Username:            u.username,
			DisplayName:         u.displayName,
			Role:                u.role,
			SelectedCharacterID: u.selectedChar,
			OwnedCharacterIDs:   characterIDsForRole(u.role),
		}, nil
	}

	var userID, username, displayName, role, selectedChar string
	err := s.db.QueryRowContext(
		ctx,
		`SELECT u.id, u.username, u.display_name, COALESCE(NULLIF(u.role, ''), 'player'), u.selected_character_id
		 FROM user_sessions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.created_at >= $2
		 LIMIT 1`,
		tokenHash,
		time.Now().UTC().Add(-SessionTTL),
	).Scan(&userID, &username, &displayName, &role, &selectedChar)
	if err != nil {
		return nil, ErrUnauthenticated
	}

	_, _ = s.db.ExecContext(ctx, `UPDATE user_sessions SET last_seen_at = $1 WHERE token_hash = $2`, time.Now().UTC(), tokenHash)
	owned := s.ensureStarterCharacters(ctx, userID, role)

	return &UserProfile{
		ID:                  userID,
		Username:            username,
		DisplayName:         displayName,
		Role:                role,
		SelectedCharacterID: selectedChar,
		OwnedCharacterIDs:   owned,
	}, nil
}

// RevokeToken permanently invalidates a session token upon explicit Logout.
func (s *Service) RevokeToken(ctx context.Context, rawToken string) error {
	if rawToken == "" {
		return nil
	}
	tokenHash := hashToken(rawToken)

	if s.db == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		if sess, ok := s.memSess[tokenHash]; ok {
			sess.revoked = true
		}
		return nil
	}

	_, err := s.db.ExecContext(
		ctx,
		`UPDATE user_sessions SET revoked_at = $1 WHERE token_hash = $2 AND revoked_at IS NULL`,
		time.Now().UTC(), tokenHash,
	)
	return err
}

// UpdateSelectedCharacter persists a member's active hero choice in PostgreSQL.
func (s *Service) UpdateSelectedCharacter(ctx context.Context, userID, characterID string) (*UserProfile, error) {
	if !isKnownCharacter(characterID) {
		return nil, ErrInvalidCharacter
	}
	charDef := state.GetCharacter(characterID)

	if s.db == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		u, ok := s.memByID[userID]
		if !ok {
			return nil, ErrUnauthenticated
		}
		if charDef.AdminOnly && u.role != "admin" {
			return nil, ErrForbiddenCharacter
		}
		u.selectedChar = characterID
		return &UserProfile{
			ID:                  u.id,
			Username:            u.username,
			DisplayName:         u.displayName,
			Role:                u.role,
			SelectedCharacterID: u.selectedChar,
			OwnedCharacterIDs:   characterIDsForRole(u.role),
		}, nil
	}

	var role string
	if err := s.db.QueryRowContext(ctx, `SELECT COALESCE(NULLIF(role, ''), 'player') FROM users WHERE id = $1`, userID).Scan(&role); err != nil {
		return nil, ErrUnauthenticated
	}
	if charDef.AdminOnly && role != "admin" {
		return nil, ErrForbiddenCharacter
	}

	now := time.Now().UTC()
	_, _ = s.db.ExecContext(
		ctx,
		`INSERT INTO user_characters (user_id, character_id, unlocked_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		userID, characterID, now,
	)

	var username, displayName string
	err := s.db.QueryRowContext(
		ctx,
		`UPDATE users SET selected_character_id = $1, updated_at = $2 WHERE id = $3
		 RETURNING username, display_name`,
		characterID, now, userID,
	).Scan(&username, &displayName)
	if err != nil {
		return nil, fmt.Errorf("update selected character: %w", err)
	}
	owned := s.ensureStarterCharacters(ctx, userID, role)
	return &UserProfile{
		ID:                  userID,
		Username:            username,
		DisplayName:         displayName,
		Role:                role,
		SelectedCharacterID: characterID,
		OwnedCharacterIDs:   owned,
	}, nil
}

// SetSessionCookie writes an HttpOnly 1-year (365-day) persistent cookie bound to the browser until explicit Logout.
func SetSessionCookie(w http.ResponseWriter, r *http.Request, rawToken string) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    rawToken,
		Path:     "/",
		MaxAge:   SessionMaxAgeSec,
		Expires:  time.Now().UTC().Add(SessionTTL),
		HttpOnly: true,
		Secure:   isHTTPSRequest(r),
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearSessionCookie deletes the persistent session cookie on Logout.
func ClearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isHTTPSRequest(r),
		SameSite: http.SameSiteLaxMode,
	})
}

// EnsureAdminUser idempotently seeds or promotes the exclusive admin account with all heroes unlocked.
func (s *Service) EnsureAdminUser(ctx context.Context, username, password string) error {
	cleanUser := strings.TrimSpace(username)
	if cleanUser == "" || password == "" {
		return fmt.Errorf("admin username and password must be non-empty")
	}
	allIDs := characterIDsForRole("admin")
	defaultAdminHero := "luangphi_sorn"

	if s.db == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		lower := strings.ToLower(cleanUser)
		owned := make(map[string]bool, len(allIDs))
		for _, cid := range allIDs {
			owned[cid] = true
		}
		if existing, ok := s.memUsers[lower]; ok {
			existing.role = "admin"
			existing.ownedChars = owned
			if !verifyPassword(password, existing.passwordHash) {
				if h, err := hashPassword(password); err == nil {
					existing.passwordHash = h
				}
			}
			return nil
		}
		pwHash, err := hashPassword(password)
		if err != nil {
			return err
		}
		uid, err := newUUID()
		if err != nil {
			return err
		}
		u := &memUser{
			id:           uid,
			username:     cleanUser,
			displayName:  "หลวงพี่ศร (Admin)",
			role:         "admin",
			passwordHash: pwHash,
			selectedChar: defaultAdminHero,
			ownedChars:   owned,
		}
		s.memUsers[lower] = u
		s.memByID[uid] = u
		return nil
	}

	var existingID, existingHash, existingRole string
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, password_hash, COALESCE(NULLIF(role, ''), 'player') FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
		cleanUser,
	).Scan(&existingID, &existingHash, &existingRole)

	now := time.Now().UTC()
	if errors.Is(err, sql.ErrNoRows) {
		uid, uerr := newUUID()
		if uerr != nil {
			return uerr
		}
		pwHash, herr := hashPassword(password)
		if herr != nil {
			return herr
		}
		if _, ierr := s.db.ExecContext(
			ctx,
			`INSERT INTO users (id, username, display_name, password_hash, role, selected_character_id, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, 'admin', $5, $6, $6)`,
			uid, cleanUser, "หลวงพี่ศร (Admin)", pwHash, defaultAdminHero, now,
		); ierr != nil {
			return fmt.Errorf("seed admin user: %w", ierr)
		}
		s.ensureStarterCharacters(ctx, uid, "admin")
		return nil
	}
	if err != nil {
		return fmt.Errorf("lookup admin user: %w", err)
	}

	if existingRole != "admin" {
		if _, uerr := s.db.ExecContext(ctx, `UPDATE users SET role = 'admin', updated_at = $1 WHERE id = $2`, now, existingID); uerr != nil {
			return uerr
		}
	}
	if !verifyPassword(password, existingHash) {
		pwHash, herr := hashPassword(password)
		if herr != nil {
			return herr
		}
		if _, uerr := s.db.ExecContext(ctx, `UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`, pwHash, now, existingID); uerr != nil {
			return uerr
		}
	}
	s.ensureStarterCharacters(ctx, existingID, "admin")
	return nil
}

func (s *Service) ensureStarterCharacters(ctx context.Context, userID, role string) []string {
	eligible := characterIDsForRole(role)
	if s.db == nil {
		return eligible
	}
	now := time.Now().UTC()
	for _, cid := range eligible {
		_, _ = s.db.ExecContext(
			ctx,
			`INSERT INTO user_characters (user_id, character_id, unlocked_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			userID, cid, now,
		)
	}
	rows, err := s.db.QueryContext(ctx, `SELECT character_id FROM user_characters WHERE user_id = $1`, userID)
	if err != nil {
		return eligible
	}
	defer func() { _ = rows.Close() }()
	ownedSet := make(map[string]bool, len(eligible))
	for rows.Next() {
		var cid string
		if rows.Scan(&cid) == nil {
			ownedSet[cid] = true
		}
	}
	ordered := make([]string, 0, len(eligible))
	for _, cid := range eligible {
		if ownedSet[cid] {
			ordered = append(ordered, cid)
		}
	}
	if len(ordered) == 0 {
		return eligible
	}
	return ordered
}

func starterCharacterIDs() []string {
	return characterIDsForRole("player")
}

func characterIDsForRole(role string) []string {
	chars := state.CharactersForRole(role)
	out := make([]string, 0, len(chars))
	for _, c := range chars {
		out = append(out, c.ID)
	}
	return out
}

func isKnownCharacter(id string) bool {
	for _, c := range state.AllCharacters() {
		if c.ID == id {
			return true
		}
	}
	return false
}

func extractRequestToken(r *http.Request) string {
	if authHdr := strings.TrimSpace(r.Header.Get("Authorization")); authHdr != "" {
		if strings.HasPrefix(strings.ToLower(authHdr), "bearer ") {
			return strings.TrimSpace(authHdr[7:])
		}
	}
	if cookie, err := r.Cookie(SessionCookieName); err == nil && strings.TrimSpace(cookie.Value) != "" {
		return strings.TrimSpace(cookie.Value)
	}
	// WebSocket upgrade fallback if passed via query string when Bearer header isn't supported by browser WS API
	if tok := strings.TrimSpace(r.URL.Query().Get("token")); tok != "" {
		return tok
	}
	return ""
}

func isHTTPSRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
}

func sanitizeDisplayName(raw string) string {
	cleaned := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, strings.TrimSpace(raw))
	runes := []rune(cleaned)
	if len(runes) > 24 {
		runes = runes[:24]
	}
	return string(runes)
}

func truncateAgent(ua string) string {
	if len(ua) > 180 {
		return ua[:180]
	}
	return ua
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	sum := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		argonMemory,
		argonTime,
		argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(sum),
	), nil
}

func verifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false
	}
	var memory uint32
	var timeCost uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &timeCost, &threads); err != nil {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false
	}
	expectedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(expectedHash) == 0 {
		return false
	}
	actualHash := argon2.IDKey([]byte(password), salt, timeCost, memory, threads, uint32(len(expectedHash)))
	return subtle.ConstantTimeCompare(actualHash, expectedHash) == 1
}

func generateSessionToken() (rawToken, tokenHash string, err error) {
	var b [32]byte
	if _, err = rand.Read(b[:]); err != nil {
		return "", "", err
	}
	rawToken = base64.RawURLEncoding.EncodeToString(b[:])
	tokenHash = hashToken(rawToken)
	return rawToken, tokenHash, nil
}

func hashToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

func newUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}
