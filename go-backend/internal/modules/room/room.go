package room

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"go-backend/internal/modules/engine"
	"go-backend/internal/modules/persistence"
	"go-backend/internal/modules/player"
	"go-backend/internal/modules/session"
	"go-backend/internal/modules/state"
	gamesync "go-backend/internal/modules/sync"
	apperrors "go-backend/internal/shared/errors"
)

var (
	ErrRoomNotFound    = errors.New("room not found")
	ErrRoomFull        = errors.New("room is full")
	ErrMatchInProgress = errors.New("match has already started")
)

const (
	emptyRoomTTL     = 1 * time.Minute
	emoteCooldown    = 400 * time.Millisecond
	respawnWait      = 7 * time.Second
	dummyRespawnWait = 1500 * time.Millisecond
	dummyHealIdle    = 4 * time.Second
)

// CreateRoomOptions configures mode and battlefield map for a new room.
type CreateRoomOptions struct {
	Mode       string
	MapID      string
	HostUserID string
}

// RoomInfo summarizes public room metadata returned on creation or lookup.
type RoomInfo struct {
	RoomID         string `json:"roomId"`
	ShareURL       string `json:"shareUrl"`
	Mode           string `json:"mode"`
	MapID          string `json:"mapId"`
	MapName        string `json:"mapName"`
	Phase          string `json:"phase"`
	TargetKills    int    `json:"targetKills"`
	MaxPlayers     int    `json:"maxPlayers"`
	CurrentPlayers int    `json:"currentPlayers"`
	BlueCount      int    `json:"blueCount"`
	RedCount       int    `json:"redCount"`
	IsFull         bool   `json:"isFull"`
}

type joinRequest struct {
	userID      string
	userRole    string
	playerName  string
	characterID string
	binaryMode  bool
	conn        session.RealtimeConn
	respCh      chan joinResponse
}

type joinResponse struct {
	session *session.Session
	err     error
}

type inputCommand struct {
	playerID string
	msg      session.InboundMessage
}

// Room is an actor owning a single game room's state and tick loop.
type Room struct {
	id              string
	maxPlayers      int
	tickRateHz      int
	state           *state.RoomState
	sessions        map[string]*session.Session // keyed by playerID
	playerRoles     map[string]string           // keyed by playerID
	slotSeq         int
	hadActiveTimers bool
	iconicFirstGojo bool

	engine  *engine.Engine
	players *player.Manager
	sessMgr *session.Manager
	syncer  *gamesync.Synchronizer
	persist *persistence.Service
	log     *slog.Logger

	joinCh  chan joinRequest
	leaveCh chan string
	inputCh chan inputCommand
	stopCh  chan struct{}
	once    sync.Once

	infoMu     sync.RWMutex
	cachedInfo RoomInfo

	onEmpty func(roomID string)
}

// Manager creates, indexes, and cleans up all active game rooms.
type Manager struct {
	mu           sync.RWMutex
	rooms        map[string]*Room
	maxPlayers   int
	tickRateHz   int
	shareBaseURL string

	engine  *engine.Engine
	players *player.Manager
	sessMgr *session.Manager
	syncer  *gamesync.Synchronizer
	persist *persistence.Service
	log     *slog.Logger
}

// NewManager initializes the Room Manager.
func NewManager(
	maxPlayers int,
	tickRateHz int,
	shareBaseURL string,
	eng *engine.Engine,
	pm *player.Manager,
	sm *session.Manager,
	syncer *gamesync.Synchronizer,
	persist *persistence.Service,
	log *slog.Logger,
) *Manager {
	return &Manager{
		rooms:        make(map[string]*Room),
		maxPlayers:   maxPlayers,
		tickRateHz:   tickRateHz,
		shareBaseURL: shareBaseURL,
		engine:       eng,
		players:      pm,
		sessMgr:      sm,
		syncer:       syncer,
		persist:      persist,
		log:          log,
	}
}

// CreateRoom generates a unique 6-digit room code, persists metadata, and launches its actor goroutine.
func (m *Manager) CreateRoom(ctx context.Context, opts CreateRoomOptions) (*RoomInfo, error) {
	mode := state.NormalizeMode(opts.Mode)
	mapID := state.NormalizeMapID(opts.MapID)
	mapCfg := state.MapConfigFor(mapID)

	maxPlayers := m.maxPlayers
	targetKills := 0
	phase := state.PhaseWaiting
	if !state.HasWaitingLobby(mode) {
		phase = state.PhasePlaying
	}
	switch mode {
	case state.ModeDuel1v1:
		maxPlayers = 2
		targetKills = 5
	case state.ModeIconic:
		maxPlayers = 2
		targetKills = 5
		mapID = state.MapShibuya
		mapCfg = state.MapConfigFor(state.MapShibuya)
	case state.ModeTDM3v3:
		maxPlayers = 6
		targetKills = 50
	case state.ModePractice:
		maxPlayers = 1
		targetKills = 0
	}

	var roomID string
	for attempt := 0; attempt < 24; attempt++ {
		code, err := m.players.NewRoomCode6()
		if err != nil {
			return nil, fmt.Errorf("generate room code: %w", err)
		}
		m.mu.RLock()
		_, inMem := m.rooms[code]
		m.mu.RUnlock()
		if inMem {
			continue
		}
		existsDB, err := m.persist.RoomExists(ctx, code)
		if err == nil && existsDB {
			continue
		}
		roomID = code
		break
	}
	if roomID == "" {
		return nil, fmt.Errorf("could not allocate unique 6-digit room code")
	}

	if err := m.persist.CreateRoom(ctx, roomID, maxPlayers, mode, mapID, targetKills, opts.HostUserID); err != nil {
		return nil, fmt.Errorf("persist room: %w", err)
	}

	rs := state.NewRoomState(roomID, maxPlayers, mapCfg)
	rs.Mode = mode
	rs.MapID = mapID
	rs.Phase = phase
	rs.TargetKills = targetKills
	rs.HostUserID = opts.HostUserID
	if phase == state.PhasePlaying {
		rs.MatchStartedAt = time.Now()
	}
	if mode == state.ModePractice {
		seedPracticeDummies(rs)
	}

	r := &Room{
		id:              roomID,
		maxPlayers:      maxPlayers,
		tickRateHz:      m.tickRateHz,
		state:           rs,
		sessions:        make(map[string]*session.Session, maxPlayers),
		iconicFirstGojo: m.engine.RandomBit(),
		engine:          m.engine,
		players:    m.players,
		sessMgr:    m.sessMgr,
		syncer:     m.syncer,
		persist:    m.persist,
		log:        m.log,
		joinCh:     make(chan joinRequest, 12),
		leaveCh:    make(chan string, 16),
		inputCh:    make(chan inputCommand, 128),
		stopCh:     make(chan struct{}),
		onEmpty:    m.removeRoom,
	}

	m.mu.Lock()
	m.rooms[roomID] = r
	m.mu.Unlock()
	r.refreshSummary()

	go r.run()

	m.log.Info("room created", "roomId", roomID, "mode", mode, "mapId", mapID, "maxPlayers", maxPlayers)
	return &RoomInfo{
		RoomID:         roomID,
		ShareURL:       fmt.Sprintf("%s/?room=%s", m.shareBaseURL, roomID),
		Mode:           mode,
		MapID:          mapID,
		MapName:        mapCfg.Name,
		Phase:          phase,
		TargetKills:    targetKills,
		MaxPlayers:     maxPlayers,
		CurrentPlayers: 0,
		IsFull:         false,
	}, nil
}

// GetRoomInfo returns metadata for an active room if it exists.
func (m *Manager) GetRoomInfo(roomID string) (*RoomInfo, bool) {
	m.mu.RLock()
	r, ok := m.rooms[roomID]
	m.mu.RUnlock()
	if !ok {
		return nil, false
	}

	snap := r.getCachedSummary()
	snap.ShareURL = fmt.Sprintf("%s/?room=%s", m.shareBaseURL, roomID)
	return &snap, true
}

// JoinRoom attaches a session with optional binary tick/datagram mode to an active room.
func (m *Manager) JoinRoom(roomID, userID, userRole, rawName, characterID string, conn session.RealtimeConn) (*Room, *session.Session, error) {
	return m.JoinRoomWithProto(roomID, userID, userRole, rawName, characterID, conn, false)
}

// JoinRoomWithProto validates identity/capacity and attaches either JSON text or Binary/WebTransport session.
func (m *Manager) JoinRoomWithProto(roomID, userID, userRole, rawName, characterID string, conn session.RealtimeConn, binaryMode bool) (*Room, *session.Session, error) {
	cleanName, err := m.players.SanitizeName(rawName)
	if err != nil {
		return nil, nil, err
	}

	m.mu.RLock()
	r, ok := m.rooms[roomID]
	m.mu.RUnlock()
	if !ok {
		return nil, nil, ErrRoomNotFound
	}

	respCh := make(chan joinResponse, 1)
	select {
	case r.joinCh <- joinRequest{
		userID:      userID,
		userRole:    userRole,
		playerName:  cleanName,
		characterID: characterID,
		binaryMode:  binaryMode,
		conn:        conn,
		respCh:      respCh,
	}:
	case <-r.stopCh:
		return nil, nil, ErrRoomNotFound
	}

	res := <-respCh
	if res.err != nil {
		return nil, nil, res.err
	}
	return r, res.session, nil
}

// ActiveCount returns the number of active rooms in memory.
func (m *Manager) ActiveCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.rooms)
}

// Shutdown stops all active room goroutines cleanly.
func (m *Manager) Shutdown() {
	m.mu.RLock()
	list := make([]*Room, 0, len(m.rooms))
	for _, r := range m.rooms {
		list = append(list, r)
	}
	m.mu.RUnlock()

	for _, r := range list {
		r.stop()
	}
}

func (m *Manager) removeRoom(roomID string) {
	m.mu.Lock()
	delete(m.rooms, roomID)
	m.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := m.persist.DeleteRoom(ctx, roomID); err != nil {
		m.log.Error("failed to delete room in postgres", "roomId", roomID, "error", err)
	}
	m.log.Info("empty room deleted after 1m timeout", "roomId", roomID)
}

// HandleInput queues a player's command for the room actor.
func (r *Room) HandleInput(playerID string, msg session.InboundMessage) {
	select {
	case r.inputCh <- inputCommand{playerID: playerID, msg: msg}:
	case <-r.stopCh:
	default:
	}
}

// HandleLeave notifies the room actor that a player disconnected.
func (r *Room) HandleLeave(playerID string) {
	select {
	case r.leaveCh <- playerID:
	case <-r.stopCh:
	}
}

func (r *Room) refreshSummary() {
	blue, red := r.teamCounts()
	count := len(r.sessions)
	snap := RoomInfo{
		RoomID:         r.id,
		Mode:           r.state.Mode,
		MapID:          r.state.MapID,
		MapName:        r.state.Map.Name,
		Phase:          r.state.Phase,
		TargetKills:    r.state.TargetKills,
		MaxPlayers:     r.maxPlayers,
		CurrentPlayers: count,
		BlueCount:      blue,
		RedCount:       red,
		IsFull:         count >= r.maxPlayers,
	}
	r.infoMu.Lock()
	r.cachedInfo = snap
	r.infoMu.Unlock()
}

func (r *Room) getCachedSummary() RoomInfo {
	r.infoMu.RLock()
	defer r.infoMu.RUnlock()
	return r.cachedInfo
}

func (r *Room) maxPerSide() int {
	if r.state.Mode == state.ModeDuel1v1 || r.state.Mode == state.ModeIconic {
		return 1
	}
	if r.state.Mode == state.ModeTDM3v3 {
		return 3
	}
	return r.maxPlayers
}

func (r *Room) iconicHeroForTeam(team string) string {
	isGojo := (team == state.TeamBlue) == r.iconicFirstGojo
	if isGojo {
		return "sia_mon"
	}
	return "ajarn_boy"
}

func applyCharacterTemplate(p *state.PlayerState, charDef state.CharacterDef) {
	p.CharacterID = charDef.ID
	p.CharacterName = charDef.DisplayName
	p.Color = charDef.Color
	p.AccentColor = charDef.AccentColor
	p.MaxHP = charDef.MaxHP
	p.HP = charDef.MaxHP
}

func (r *Room) teamCounts() (blue, red int) {
	for _, p := range r.state.Players {
		switch p.Team {
		case state.TeamBlue:
			blue++
		case state.TeamRed:
			red++
		}
	}
	return blue, red
}

func (r *Room) stop() {
	r.once.Do(func() {
		close(r.stopCh)
	})
}

func (r *Room) run() {
	tickInterval := time.Second / time.Duration(r.tickRateHz)
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	idleTimer := time.NewTimer(emptyRoomTTL)
	defer idleTimer.Stop()

	lastTick := time.Now()

	for {
		select {
		case <-r.stopCh:
			for _, sess := range r.sessions {
				r.sessMgr.Remove(sess.ID())
			}
			return

		case req := <-r.joinCh:
			r.handleJoin(req, idleTimer)

		case playerID := <-r.leaveCh:
			r.handleLeave(playerID, idleTimer)

		case cmd := <-r.inputCh:
			r.handleCommand(cmd)

		case now := <-ticker.C:
			dt := now.Sub(lastTick).Seconds()
			lastTick = now
			if dt <= 0 || dt > 0.25 {
				dt = tickInterval.Seconds()
			}
			r.state.Tick++
			changed := false

			if r.state.Phase == state.PhasePlaying {
				dummyBefore := r.captureDummyHP()
				for _, p := range r.state.Players {
					if p.IsDummy {
						if !p.Alive && !p.RespawnAt.IsZero() && !now.Before(p.RespawnAt) {
							resetPracticeDummy(p)
							changed = true
						} else if p.Alive && p.HP < p.MaxHP && !p.LastHitAt.IsZero() && now.Sub(p.LastHitAt) >= dummyHealIdle {
							p.HP = p.MaxHP
							p.StunUntil = time.Time{}
							p.SlowUntil = time.Time{}
							p.VoidUntil = time.Time{}
							p.LastHitAt = time.Time{}
							changed = true
						}
						continue
					}
					if !p.Alive && !p.RespawnAt.IsZero() && !now.Before(p.RespawnAt) {
						r.respawnPlayer(p, now)
						changed = true
						continue
					}
					if r.engine.StepPlayer(p, dt, r.state.Map, now) {
						changed = true
					}
				}

				projMoved, projHits := r.engine.StepProjectiles(r.state, dt, now)
				zoneChanged, zoneHits := r.engine.StepZones(r.state, dt, now)
				beamChanged := r.engine.StepBeams(r.state, dt)
				r.touchDamagedDummies(dummyBefore, now)

				if projMoved || zoneChanged || beamChanged || len(projHits) > 0 || len(zoneHits) > 0 {
					changed = true
				}

				allHits := append(projHits, zoneHits...)
				r.emitHits(allHits, now)

				// Ensure final 0ms expiration frame ALWAYS broadcasts even if no players move (fixes 0.1s stall).
				activeTimers := r.hasActiveStatusTimers(now)
				timerJustExpired := r.hadActiveTimers && !activeTimers
				r.hadActiveTimers = activeTimers
				if !changed && ((activeTimers && r.state.Tick%4 == 0) || timerJustExpired) {
					changed = true
				}

				// At 60Hz sim rate, coalesce routine movement ticks to 30Hz (client interpolates at 60-120fps);
				// discrete hits/deaths/timer expirations/match-finish always push immediately.
				shouldBroadcast := changed && len(r.sessions) > 0 && (len(allHits) > 0 || timerJustExpired || r.state.Phase == state.PhaseFinished || r.tickRateHz < 40 || r.state.Tick%2 == 0)
				if shouldBroadcast {
					r.syncer.BroadcastState(r.receivers(), r.state, now)
				}
			}

		case <-idleTimer.C:
			if len(r.sessions) == 0 {
				r.stop()
				r.onEmpty(r.id)
				return
			}
		}
	}
}

func (r *Room) hasActiveStatusTimers(now time.Time) bool {
	for _, p := range r.state.Players {
		if now.Before(p.StunUntil) || now.Before(p.SlowUntil) || now.Before(p.BuffUntil) ||
			now.Before(p.RapidAttackUntil) || now.Before(p.InvulnUntil) || now.Before(p.ThroneUntil) ||
			now.Before(p.VoidUntil) || now.Before(p.AttackUntil) || now.Before(p.DashUntil) ||
			now.Before(p.RctUntil) || now.Before(p.SnapUntil) || (!p.Alive && !p.RespawnAt.IsZero()) {
			return true
		}
		for i := 0; i < len(p.CooldownUntil); i++ {
			if now.Before(p.CooldownUntil[i]) {
				return true
			}
		}
	}
	return false
}

func (r *Room) emitHits(hits []engine.HitEvent, now time.Time) {
	if len(hits) == 0 {
		return
	}
	for _, h := range hits {
		if r.state.Phase != state.PhasePlaying {
			break
		}
		if victim, ok := r.state.Players[h.VictimID]; ok {
			if victim.IsDummy {
				victim.RespawnAt = now.Add(dummyRespawnWait)
			} else {
				victim.Deaths++
				victim.RespawnAt = now.Add(respawnWait)
			}
		}
		if state.IsTeamMatchMode(r.state.Mode) {
			if killer, ok := r.state.Players[h.KillerID]; ok {
				switch killer.Team {
				case state.TeamBlue:
					r.state.BlueKills++
				case state.TeamRed:
					r.state.RedKills++
				}
			}
			if r.state.TargetKills > 0 {
				if r.state.BlueKills >= r.state.TargetKills {
					r.finishMatch(state.TeamBlue, now)
				} else if r.state.RedKills >= r.state.TargetKills {
					r.finishMatch(state.TeamRed, now)
				}
			}
		}

		r.syncer.BroadcastPlayerDied(r.receivers(), h.VictimID, h.VictimName, h.KillerName, h.X, h.Y)
		r.persist.RecordEventAsync(r.id, "player_died", map[string]string{
			"victimId":   h.VictimID,
			"victimName": h.VictimName,
			"killerName": h.KillerName,
		})
	}
}

func (r *Room) finishMatch(winnerTeam string, now time.Time) {
	r.state.Phase = state.PhaseFinished
	r.state.WinnerTeam = winnerTeam
	r.state.MatchEndedAt = now
	r.state.Projectiles = r.state.Projectiles[:0]
	r.state.Beams = r.state.Beams[:0]
	r.state.Zones = r.state.Zones[:0]
	r.refreshSummary()

	go func(rid, winner string) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = r.persist.UpdateRoomMatchResult(ctx, rid, "finished", winner)
	}(r.id, winnerTeam)
	r.persist.RecordEventAsync(r.id, "match_finished", map[string]any{
		"winnerTeam": winnerTeam,
		"blueKills":  r.state.BlueKills,
		"redKills":   r.state.RedKills,
	})
}

func (r *Room) respawnPlayer(p *state.PlayerState, now time.Time) {
	if p.IsDummy {
		resetPracticeDummy(p)
		return
	}
	x, y := r.engine.SpawnPositionForTeam(r.state, p.Team)
	if r.state.Mode == state.ModePractice {
		x, y = 1480, 900
	}
	charDef := state.GetCharacter(p.CharacterID)
	p.X = x
	p.Y = y
	p.HP = charDef.MaxHP
	p.MaxHP = charDef.MaxHP
	p.InputDX = 0
	p.InputDY = 0
	p.Alive = true
	p.KilledBy = ""
	p.StunUntil = time.Time{}
	p.SlowUntil = time.Time{}
	p.BuffUntil = time.Time{}
	p.RapidAttackUntil = time.Time{}
	p.InvulnUntil = time.Time{}
	p.ThroneUntil = time.Time{}
	p.VoidUntil = time.Time{}
	p.RespawnAt = time.Time{}
	p.CooldownUntil = [5]time.Time{}
	p.AttackUntil = time.Time{}
	p.DashUntil = time.Time{}
	p.RctUntil = time.Time{}
	p.SnapUntil = time.Time{}
	r.engine.InitHeroState(p)
	if r.state.Mode == state.ModePractice {
		p.AimDX = 1
		p.AimDY = 0
	} else if r.state.Mode == state.ModeIconic {
		if p.Team == state.TeamRed {
			p.AimDX = -1
		} else {
			p.AimDX = 1
		}
		p.AimDY = 0
	}
	_ = now
}

func (r *Room) handleCommand(cmd inputCommand) {
	p, ok := r.state.Players[cmd.playerID]
	if !ok {
		return
	}
	now := time.Now()

	switch cmd.msg.Type {
	case "select_team":
		if !state.IsTeamMatchMode(r.state.Mode) || r.state.Phase != state.PhaseWaiting {
			return
		}
		targetTeam := cmd.msg.Team
		if targetTeam != state.TeamBlue && targetTeam != state.TeamRed || targetTeam == p.Team {
			return
		}
		sideCap := r.maxPerSide()
		blue, red := r.teamCounts()
		if (targetTeam == state.TeamBlue && blue >= sideCap) || (targetTeam == state.TeamRed && red >= sideCap) {
			return
		}
		p.Team = targetTeam
		p.X, p.Y = r.engine.SpawnPositionForTeam(r.state, p.Team)
		if r.state.Mode == state.ModeIconic {
			applyCharacterTemplate(p, state.GetCharacter(r.iconicHeroForTeam(p.Team)))
			r.engine.InitHeroState(p)
		}
		r.refreshSummary()
		if len(r.sessions) > 0 {
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "select_character":
		if r.state.Phase != state.PhaseWaiting {
			return
		}
		if r.state.Mode == state.ModeIconic {
			if sess, exists := r.sessions[p.ID]; exists {
				r.syncer.SendError(sess, apperrors.CodeInvalidInput, "โหมด ICONIC ระบบสุ่ม Gojo vs Sukuna อัตโนมัติ ไม่สามารถเลือกตัวละครเองได้")
			}
			return
		}
		charDef := state.GetCharacter(cmd.msg.CharacterID)
		if charDef.AdminOnly && r.playerRoles[p.ID] != "admin" {
			if sess, exists := r.sessions[p.ID]; exists {
				r.syncer.SendError(sess, apperrors.CodeInvalidInput, "ตัวละครนี้สงวนไว้สำหรับแอดมินเท่านั้น")
			}
			return
		}
		applyCharacterTemplate(p, charDef)
		r.engine.InitHeroState(p)
		if len(r.sessions) > 0 {
			r.syncer.BroadcastReliableState(r.receivers(), r.state, now)
		}

	case "select_map":
		if r.state.Phase != state.PhaseWaiting || !p.IsHost || r.state.Mode == state.ModeIconic {
			return
		}
		nextMapID := state.NormalizeMapID(cmd.msg.MapID)
		r.state.MapID = nextMapID
		r.state.Map = state.MapConfigFor(nextMapID)
		r.refreshSummary()
		if len(r.sessions) > 0 {
			r.syncer.BroadcastRoomConfig(r.receivers(), r.state, now)
		}

	case "toggle_ready":
		if r.state.Phase != state.PhaseWaiting {
			return
		}
		p.Ready = !p.Ready
		if len(r.sessions) > 0 {
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "start_match":
		if !state.HasWaitingLobby(r.state.Mode) || r.state.Phase != state.PhaseWaiting || !p.IsHost {
			return
		}
		if state.IsTeamMatchMode(r.state.Mode) {
			sideCap := r.maxPerSide()
			blue, red := r.teamCounts()
			if r.humanPlayerCount() < r.maxPlayers || blue != sideCap || red != sideCap {
				if sess, ok := r.sessions[p.ID]; ok {
					errMsg := "ต้องรอผู้เล่นเข้าครบ 6 คน (ทีมละ 3 คน) ก่อนเริ่มเกม"
					if r.state.Mode == state.ModeIconic {
						errMsg = "ต้องรอผู้เล่นเข้าครบ 2 คน (Gojo vs Sukuna) ก่อนเริ่มศึก ICONIC"
					} else if r.state.Mode == state.ModeDuel1v1 {
						errMsg = "ต้องรอผู้เล่นเข้าครบ 2 คน (ฝั่งละ 1 คน) ก่อนเริ่มดวล 1v1"
					}
					r.syncer.SendError(sess, apperrors.CodeMatchState, errMsg)
				}
				return
			}
		} else if r.humanPlayerCount() < 1 {
			return
		}
		r.state.Phase = state.PhasePlaying
		r.state.BlueKills = 0
		r.state.RedKills = 0
		r.state.WinnerTeam = ""
		r.state.MatchStartedAt = now
		r.state.MatchEndedAt = time.Time{}
		r.state.Projectiles = r.state.Projectiles[:0]
		r.state.Beams = r.state.Beams[:0]
		r.state.Zones = r.state.Zones[:0]
		for _, member := range r.state.Players {
			member.Kills = 0
			member.Deaths = 0
			member.InfinityStones = nil
			member.SnapUntil = time.Time{}
			r.respawnPlayer(member, now)
		}
		r.refreshSummary()
		if len(r.sessions) > 0 {
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "return_lobby":
		if !state.HasWaitingLobby(r.state.Mode) || r.state.Phase != state.PhaseFinished {
			return
		}
		r.state.Phase = state.PhaseWaiting
		r.state.BlueKills = 0
		r.state.RedKills = 0
		r.state.WinnerTeam = ""
		r.state.Projectiles = r.state.Projectiles[:0]
		r.state.Beams = r.state.Beams[:0]
		r.state.Zones = r.state.Zones[:0]
		if r.state.Mode == state.ModeIconic {
			r.iconicFirstGojo = r.engine.RandomBit()
		}
		for _, member := range r.state.Players {
			if member.IsDummy {
				resetPracticeDummy(member)
				continue
			}
			member.Kills = 0
			member.Deaths = 0
			member.InfinityStones = nil
			member.SnapUntil = time.Time{}
			member.Ready = member.IsHost
			if r.state.Mode == state.ModeIconic {
				applyCharacterTemplate(member, state.GetCharacter(r.iconicHeroForTeam(member.Team)))
			}
			r.respawnPlayer(member, now)
		}
		r.refreshSummary()
		if len(r.sessions) > 0 {
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "input":
		if r.state.Phase != state.PhasePlaying || !p.Alive {
			return
		}
		newDX := r.players.ClampAxis(cmd.msg.DX)
		newDY := r.players.ClampAxis(cmd.msg.DY)
		vecChanged := newDX != p.InputDX || newDY != p.InputDY
		p.InputDX = newDX
		p.InputDY = newDY
		if newDX != 0 || newDY != 0 {
			p.AimDX = newDX
			p.AimDY = newDY
		}
		if cmd.msg.Seq > p.LastSeq {
			p.LastSeq = cmd.msg.Seq
		}
		if vecChanged && newDX == 0 && newDY == 0 && len(r.sessions) > 0 {
			r.state.Tick++
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "switch_character":
		if r.state.Mode != state.ModePractice || r.state.Phase != state.PhasePlaying {
			return
		}
		charDef := state.GetCharacter(cmd.msg.CharacterID)
		if charDef.AdminOnly && r.playerRoles[p.ID] != "admin" {
			if sess, exists := r.sessions[p.ID]; exists {
				r.syncer.SendError(sess, apperrors.CodeInvalidInput, "ตัวละครนี้สงวนไว้สำหรับแอดมินเท่านั้น")
			}
			return
		}
		p.CharacterID = charDef.ID
		p.CharacterName = charDef.DisplayName
		p.Color = charDef.Color
		p.AccentColor = charDef.AccentColor
		p.MaxHP = charDef.MaxHP
		p.HP = charDef.MaxHP
		p.Alive = true
		p.StunUntil = time.Time{}
		p.SlowUntil = time.Time{}
		p.VoidUntil = time.Time{}
		p.CooldownUntil = [5]time.Time{}
		p.AttackUntil = time.Time{}
		p.DashUntil = time.Time{}
		p.InfinityStones = nil
		r.engine.InitHeroState(p)
		if len(r.sessions) > 0 {
			r.syncer.BroadcastReliableState(r.receivers(), r.state, now)
		}

	case "reset_cooldowns":
		if r.state.Mode != state.ModePractice || r.state.Phase != state.PhasePlaying {
			return
		}
		p.HP = p.MaxHP
		p.Alive = true
		p.StunUntil = time.Time{}
		p.SlowUntil = time.Time{}
		p.BuffUntil = time.Time{}
		p.RapidAttackUntil = time.Time{}
		p.InvulnUntil = time.Time{}
		p.ThroneUntil = time.Time{}
		p.VoidUntil = time.Time{}
		p.CooldownUntil = [5]time.Time{}
		p.SnapUntil = time.Time{}
		p.AttackUntil = time.Time{}
		p.DashUntil = time.Time{}
		for _, member := range r.state.Players {
			if member.IsDummy {
				resetPracticeDummy(member)
			}
		}
		if len(r.sessions) > 0 {
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "skill":
		dummyBefore := r.captureDummyHP()
		out := r.engine.CastSkillFull(r.state, p, cmd.msg.Slot, cmd.msg.TX, cmd.msg.TY, cmd.msg.TargetID, now)
		if !out.OK {
			return
		}
		r.touchDamagedDummies(dummyBefore, now)
		if len(r.sessions) > 0 {
			for _, pe := range out.Punches {
				r.syncer.BroadcastSaitamaPunch(r.receivers(), gamesync.SaitamaPunchMessage{
					TargetID:     pe.TargetID,
					TargetName:   pe.TargetName,
					AttackerID:   pe.AttackerID,
					AttackerName: pe.AttackerName,
					Blocked:      pe.Blocked,
					X:            pe.X,
					Y:            pe.Y,
				})
			}
			for _, ce := range out.Clashes {
				r.syncer.BroadcastDomainClash(r.receivers(), gamesync.DomainClashMessage{
					GojoName:   ce.GojoName,
					SukunaName: ce.SukunaName,
					X:          ce.X,
					Y:          ce.Y,
				})
			}
		}
		r.emitHits(out.Hits, now)
		if len(r.sessions) > 0 {
			r.state.Tick++
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "rct":
		if !r.engine.CastRCT(r.state, p, now) {
			return
		}
		if len(r.sessions) > 0 {
			r.state.Tick++
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "snap":
		dummyBefore := r.captureDummyHP()
		hits, killed, ok := r.engine.CastInfinitySnap(r.state, p, now)
		if !ok {
			return
		}
		r.touchDamagedDummies(dummyBefore, now)
		instantWin := state.IsTeamMatchMode(r.state.Mode)
		if len(r.sessions) > 0 {
			r.syncer.BroadcastInfinitySnap(r.receivers(), gamesync.InfinitySnapMessage{
				AttackerID:   p.ID,
				AttackerName: p.Name,
				Mode:         r.state.Mode,
				InstantWin:   instantWin,
				KilledCount:  killed,
			})
		}
		r.emitHits(hits, now)
		if instantWin && r.state.Phase == state.PhasePlaying {
			r.finishMatch(p.Team, now)
		}
		if len(r.sessions) > 0 {
			r.state.Tick++
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "attack":
		dummyBefore := r.captureDummyHP()
		hits, ok := r.engine.CastBasicAttack(r.state, p, cmd.msg.TX, cmd.msg.TY, now)
		if !ok {
			return
		}
		r.touchDamagedDummies(dummyBefore, now)
		if p.CharacterID == "luangphi_sorn" && len(hits) > 0 && len(r.sessions) > 0 {
			for _, h := range hits {
				if v, exists := r.state.Players[h.VictimID]; exists && !v.IsDummy {
					r.syncer.BroadcastSaitamaPunch(r.receivers(), gamesync.SaitamaPunchMessage{
						TargetID:     h.VictimID,
						TargetName:   h.VictimName,
						AttackerID:   p.ID,
						AttackerName: p.Name,
						Blocked:      false,
						X:            h.X,
						Y:            h.Y,
					})
				}
			}
		}
		r.emitHits(hits, now)
		if len(r.sessions) > 0 {
			r.state.Tick++
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "dash":
		if !r.engine.CastDash(r.state, p, cmd.msg.TX, cmd.msg.TY, now) {
			return
		}
		if len(r.sessions) > 0 {
			r.state.Tick++
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "respawn":
		if r.state.Phase != state.PhasePlaying || p.Alive {
			return
		}
		if !p.RespawnAt.IsZero() && now.Before(p.RespawnAt) {
			return
		}
		r.respawnPlayer(p, now)
		if len(r.sessions) > 0 {
			r.syncer.BroadcastState(r.receivers(), r.state, now)
		}

	case "emote":
		if !p.Alive {
			return
		}
		if now.Sub(p.LastEmoteAt) < emoteCooldown {
			return
		}
		allowed := map[string]bool{
			"⚡ Pulse!":     true,
			"👋 สวัสดี!":    true,
			"✨ เยี่ยมเลย!": true,
			"🔥 ลุยเลย!":    true,
		}
		if !allowed[cmd.msg.Emote] {
			return
		}
		p.LastEmoteAt = now
		if len(r.sessions) > 0 {
			r.syncer.BroadcastPlayerEmote(r.receivers(), p.ID, cmd.msg.Emote)
		}
	}
}

func (r *Room) handleJoin(req joinRequest, idleTimer *time.Timer) {
	if state.HasWaitingLobby(r.state.Mode) && r.state.Phase != state.PhaseWaiting {
		req.respCh <- joinResponse{err: ErrMatchInProgress}
		return
	}

	// Cleanly replace duplicate stale session if same authenticated user rejoins.
	if req.userID != "" {
		for existingPID, existingPlayer := range r.state.Players {
			if existingPlayer.UserID == req.userID {
				r.handleLeave(existingPID, idleTimer)
				break
			}
		}
	}

	if r.humanPlayerCount() >= r.maxPlayers {
		req.respCh <- joinResponse{err: ErrRoomFull}
		return
	}

	playerID, err := mUUIDOrErr(r.players)
	if err != nil {
		req.respCh <- joinResponse{err: err}
		return
	}
	sessionID, err := mUUIDOrErr(r.players)
	if err != nil {
		req.respCh <- joinResponse{err: err}
		return
	}

	if !idleTimer.Stop() {
		select {
		case <-idleTimer.C:
		default:
		}
	}

	team := state.TeamFFA
	if state.IsTeamMatchMode(r.state.Mode) {
		blue, red := r.teamCounts()
		if blue <= red {
			team = state.TeamBlue
		} else {
			team = state.TeamRed
		}
	}

	isHost := false
	if r.state.HostUserID != "" && req.userID == r.state.HostUserID {
		isHost = true
	} else if r.humanPlayerCount() == 0 {
		isHost = true
		if req.userID != "" {
			r.state.HostUserID = req.userID
		}
	}

	charDef := state.GetCharacter(req.characterID)
	if r.state.Mode == state.ModeIconic {
		charDef = state.GetCharacter(r.iconicHeroForTeam(team))
	} else if charDef.AdminOnly && req.userRole != "admin" {
		charDef = state.GetCharacter("pa")
	}
	if r.playerRoles == nil {
		r.playerRoles = make(map[string]string, r.maxPlayers)
	}
	r.playerRoles[playerID] = req.userRole
	r.slotSeq++
	x, y := r.engine.SpawnPositionForTeam(r.state, team)
	if r.state.Mode == state.ModePractice {
		x, y = 1480, 900
	}
	aimDX := 1.0
	if r.state.Mode == state.ModeIconic && team == state.TeamRed {
		aimDX = -1.0
	}
	pState := &state.PlayerState{
		ID:            playerID,
		UserID:        req.userID,
		Name:          req.playerName,
		CharacterID:   charDef.ID,
		CharacterName: charDef.DisplayName,
		Team:          team,
		Ready:         isHost,
		IsHost:        isHost,
		X:             x,
		Y:             y,
		Color:         charDef.Color,
		AccentColor:   charDef.AccentColor,
		HP:            charDef.MaxHP,
		MaxHP:         charDef.MaxHP,
		Alive:         true,
		AimDX:         aimDX,
		AimDY:         0,
	}
	r.engine.InitHeroState(pState)
	r.state.AssignNetID(pState)
	r.state.Players[playerID] = pState

	sess := r.sessMgr.CreateWithProto(sessionID, playerID, r.id, req.conn, req.binaryMode)
	r.sessions[playerID] = sess
	r.refreshSummary()

	go func(pid, rid, pname, uid, tm string) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = r.persist.RecordPlayerJoin(ctx, pid, rid, pname, uid, tm)
	}(playerID, r.id, req.playerName, req.userID, team)
	r.persist.RecordEventAsync(r.id, "player_joined", map[string]string{
		"playerId":    playerID,
		"userId":      req.userID,
		"name":        req.playerName,
		"team":        team,
		"characterId": charDef.ID,
	})

	now := time.Now()
	r.syncer.SendWelcome(sess, playerID, r.state, req.userRole, now)
	r.syncer.BroadcastPlayerEvent(r.receivers(), "player_joined", *pState, playerID)
	if len(r.sessions) > 0 {
		r.syncer.BroadcastState(r.receivers(), r.state, now)
	}

	r.log.Info("player joined room", "roomId", r.id, "playerId", playerID, "team", team, "characterId", charDef.ID, "players", len(r.sessions))
	req.respCh <- joinResponse{session: sess}
}

func mUUIDOrErr(pm *player.Manager) (string, error) {
	return pm.NewUUID()
}

func (r *Room) handleLeave(playerID string, idleTimer *time.Timer) {
	pState, exists := r.state.Players[playerID]
	if !exists {
		return
	}
	wasHost := pState.IsHost
	copied := *pState
	delete(r.state.Players, playerID)
	delete(r.playerRoles, playerID)

	if sess, ok := r.sessions[playerID]; ok {
		delete(r.sessions, playerID)
		r.sessMgr.Remove(sess.ID())
	}

	// Transfer host ownership smoothly if the current host left (skip training dummies).
	if wasHost && r.humanPlayerCount() > 0 {
		for _, next := range r.state.Players {
			if next.IsDummy {
				continue
			}
			next.IsHost = true
			next.Ready = true
			if next.UserID != "" {
				r.state.HostUserID = next.UserID
			}
			break
		}
	}
	r.refreshSummary()

	go func(pid string) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = r.persist.RecordPlayerLeave(ctx, pid)
	}(playerID)
	r.persist.RecordEventAsync(r.id, "player_left", map[string]string{
		"playerId": playerID,
	})

	r.syncer.BroadcastPlayerEvent(r.receivers(), "player_left", copied, "")
	if len(r.sessions) > 0 {
		r.syncer.BroadcastState(r.receivers(), r.state, time.Now())
	}
	r.log.Info("player left room", "roomId", r.id, "playerId", playerID, "players", len(r.sessions))

	if len(r.sessions) == 0 {
		idleTimer.Reset(emptyRoomTTL)
	}
}

func (r *Room) receivers() []gamesync.ClientReceiver {
	out := make([]gamesync.ClientReceiver, 0, len(r.sessions))
	for _, s := range r.sessions {
		out = append(out, s)
	}
	return out
}

// MapErrorCode maps room errors to standard API error codes.
func MapErrorCode(err error) string {
	switch {
	case errors.Is(err, ErrRoomNotFound):
		return apperrors.CodeRoomNotFound
	case errors.Is(err, ErrRoomFull):
		return apperrors.CodeRoomFull
	case errors.Is(err, ErrMatchInProgress):
		return apperrors.CodeMatchState
	default:
		return apperrors.CodeInvalidPlayerName
	}
}

func (r *Room) humanPlayerCount() int {
	n := 0
	for _, p := range r.state.Players {
		if !p.IsDummy {
			n++
		}
	}
	return n
}

func (r *Room) captureDummyHP() map[string]int {
	if r.state.Mode != state.ModePractice {
		return nil
	}
	m := make(map[string]int, 2)
	for id, p := range r.state.Players {
		if p.IsDummy {
			m[id] = p.HP
		}
	}
	return m
}

func (r *Room) touchDamagedDummies(before map[string]int, now time.Time) {
	if len(before) == 0 {
		return
	}
	for id, prevHP := range before {
		if d, ok := r.state.Players[id]; ok && d.IsDummy && d.HP < prevHP {
			d.LastHitAt = now
		}
	}
}

func seedPracticeDummies(rs *state.RoomState) {
	dummies := []struct {
		id    string
		name  string
		x     float64
		color string
		acc   string
	}{
		{"dummy-near", "🎯 หุ่นทดสอบ (ใกล้)", 1730, "#F59E0B", "#FEF08A"},
		{"dummy-far", "🎯 หุ่นทดสอบ (ไกล)", 1920, "#38BDF8", "#E0F2FE"},
	}
	for _, dm := range dummies {
		p := &state.PlayerState{
			ID:            dm.id,
			Name:          dm.name,
			CharacterID:   "default",
			CharacterName: "Training Dummy",
			Team:          "dummy",
			IsDummy:       true,
			X:             dm.x,
			Y:             900,
			Color:         dm.color,
			AccentColor:   dm.acc,
			HP:            1000,
			MaxHP:         1000,
			Alive:         true,
			AimDX:         -1,
			AimDY:         0,
		}
		rs.AssignNetID(p)
		rs.Players[dm.id] = p
	}
}

func resetPracticeDummy(p *state.PlayerState) {
	x := 1730.0
	if p.ID == "dummy-far" {
		x = 1920.0
	}
	p.X = x
	p.Y = 900
	p.HP = 1000
	p.MaxHP = 1000
	p.Alive = true
	p.KilledBy = ""
	p.InputDX = 0
	p.InputDY = 0
	p.StunUntil = time.Time{}
	p.SlowUntil = time.Time{}
	p.BuffUntil = time.Time{}
	p.RapidAttackUntil = time.Time{}
	p.InvulnUntil = time.Time{}
	p.ThroneUntil = time.Time{}
	p.VoidUntil = time.Time{}
	p.RespawnAt = time.Time{}
	p.LastHitAt = time.Time{}
}
