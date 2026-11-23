package session

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	gamesync "go-backend/internal/modules/sync"
)

const (
	writeBufferSize = 24
	pingInterval    = 20 * time.Second
	readTimeout     = 45 * time.Second
)

// RealtimeConn abstracts either Binary+Text TCP WebSocket or QUIC WebTransport (Datagram + Reliable Stream).
type RealtimeConn interface {
	ReadPacket() (isBinary bool, data []byte, err error)
	WriteReliableText(data []byte) error
	WriteDatagramBinary(data []byte) error
	WritePing() error
	SetReadDeadline(t time.Time) error
	Close() error
}

// InboundMessage represents a validated command sent from a WebSocket client.
type InboundMessage struct {
	Type        string  `json:"type"`
	Seq         uint64  `json:"seq"`
	DX          float64 `json:"dx"`
	DY          float64 `json:"dy"`
	Slot        int     `json:"slot"`
	TX          float64 `json:"tx"`
	TY          float64 `json:"ty"`
	TS          int64   `json:"ts"`
	Emote       string  `json:"emote"`
	Team        string  `json:"team"`
	MapID       string  `json:"mapId"`
	CharacterID string  `json:"characterId"`
	TargetID    string  `json:"targetId"`
}

// InputHandler handles validated client commands inside the owning room.
type InputHandler interface {
	HandleInput(playerID string, msg InboundMessage)
	HandleLeave(playerID string)
}

// Session represents a single player's active WebSocket or WebTransport connection.
type Session struct {
	id         string
	playerID   string
	roomID     string
	conn       RealtimeConn
	binaryMode bool
	sendCh     chan []byte
	dgramMu    sync.Mutex
	pendingDg  []byte
	dgramSig   chan struct{}
	log        *slog.Logger
	syncer     *gamesync.Synchronizer
	closeMu    sync.Mutex
	closed     bool
}

// Manager tracks active real-time sessions across the server.
type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	log      *slog.Logger
	syncer   *gamesync.Synchronizer
}

// NewManager creates a Session Manager.
func NewManager(log *slog.Logger, syncer *gamesync.Synchronizer) *Manager {
	return &Manager{
		sessions: make(map[string]*Session),
		log:      log,
		syncer:   syncer,
	}
}

// Create registers a text-only Session (backward-compatible default).
func (m *Manager) Create(sessionID, playerID, roomID string, conn RealtimeConn) *Session {
	return m.CreateWithProto(sessionID, playerID, roomID, conn, false)
}

// CreateWithProto registers a Session with optional Binary Datagram/Frame fast-path enabled.
func (m *Manager) CreateWithProto(sessionID, playerID, roomID string, conn RealtimeConn, binaryMode bool) *Session {
	s := &Session{
		id:         sessionID,
		playerID:   playerID,
		roomID:     roomID,
		conn:       conn,
		binaryMode: binaryMode,
		sendCh:     make(chan []byte, writeBufferSize),
		dgramSig:   make(chan struct{}, 1),
		log:        m.log,
		syncer:     m.syncer,
	}
	m.mu.Lock()
	m.sessions[sessionID] = s
	m.mu.Unlock()
	return s
}

// BinaryEnabled reports whether this session uses the compact binary tick/datagram wire protocol.
func (s *Session) BinaryEnabled() bool {
	return s.binaryMode
}

// Remove unregisters a session and closes its outbound channel.
func (m *Manager) Remove(sessionID string) {
	m.mu.Lock()
	s, ok := m.sessions[sessionID]
	if ok {
		delete(m.sessions, sessionID)
	}
	m.mu.Unlock()

	if ok {
		s.Close()
	}
}

// ActiveCount returns the number of currently registered WebSocket sessions.
func (m *Manager) ActiveCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// ID returns the session's unique identifier.
func (s *Session) ID() string {
	return s.id
}

// PlayerID returns the associated player UUID.
func (s *Session) PlayerID() string {
	return s.playerID
}

// TrySend queues a guaranteed reliable message (events, welcome, lobby transitions) without blocking the room tick loop.
func (s *Session) TrySend(payload []byte) {
	s.closeMu.Lock()
	defer s.closeMu.Unlock()
	if s.closed {
		return
	}
	select {
	case s.sendCh <- payload:
	default:
		// Slow consumer: drop rather than stalling the room.
	}
}

// TrySendDatagram stores the latest coalesced binary tick/datagram frame so slow links skip stale positions cleanly!
func (s *Session) TrySendDatagram(payload []byte) {
	s.closeMu.Lock()
	closed := s.closed
	s.closeMu.Unlock()
	if closed {
		return
	}
	s.dgramMu.Lock()
	s.pendingDg = payload
	s.dgramMu.Unlock()
	select {
	case s.dgramSig <- struct{}{}:
	default:
	}
}

// Close closes the session's outbound channels and underlying network connection.
func (s *Session) Close() {
	s.closeMu.Lock()
	if s.closed {
		s.closeMu.Unlock()
		return
	}
	s.closed = true
	close(s.sendCh)
	s.closeMu.Unlock()

	_ = s.conn.Close()
}

// RunPumps starts the WritePump goroutine and runs the ReadPump until disconnect.
func (s *Session) RunPumps(handler InputHandler, onCleanup func()) {
	defer onCleanup()

	go s.writePump()
	s.readPump(handler)
}

func (s *Session) readPump(handler InputHandler) {
	defer handler.HandleLeave(s.playerID)

	for {
		_ = s.conn.SetReadDeadline(time.Now().Add(readTimeout))
		isBin, raw, err := s.conn.ReadPacket()
		if err != nil {
			s.log.Debug("session read ended", "sessionId", s.id, "playerId", s.playerID, "error", err)
			return
		}

		if isBin {
			binCmd, err := gamesync.ParseBinaryCommand(raw)
			if err != nil {
				s.syncer.SendError(s, "INVALID_INPUT", "malformed binary command")
				continue
			}
			if binCmd.Type == "ping" {
				s.syncer.SendPong(s, binCmd.TS)
				continue
			}
			handler.HandleInput(s.playerID, InboundMessage{
				Type:     binCmd.Type,
				Seq:      binCmd.Seq,
				DX:       binCmd.DX,
				DY:       binCmd.DY,
				Slot:     binCmd.Slot,
				TX:       binCmd.TX,
				TY:       binCmd.TY,
				TargetID: binCmd.TargetID,
			})
			continue
		}

		var msg InboundMessage
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&msg); err != nil {
			s.syncer.SendError(s, "INVALID_INPUT", "malformed command payload")
			continue
		}

		switch msg.Type {
		case "input", "skill", "attack", "dash", "rct", "snap", "respawn", "emote", "select_team", "select_map", "select_character", "toggle_ready", "start_match", "return_lobby", "switch_character", "reset_cooldowns":
			handler.HandleInput(s.playerID, msg)
		case "ping":
			s.syncer.SendPong(s, msg.TS)
		default:
			s.syncer.SendError(s, "INVALID_INPUT", "unknown command type")
		}
	}
}

func (s *Session) writePump() {
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

	for {
		// Prioritize reliable control events before coalesced unreliable state ticks
		select {
		case payload, ok := <-s.sendCh:
			if !ok {
				return
			}
			if err := s.conn.WriteReliableText(payload); err != nil {
				_ = s.conn.Close()
				return
			}
			continue
		default:
		}

		select {
		case payload, ok := <-s.sendCh:
			if !ok {
				return
			}
			if err := s.conn.WriteReliableText(payload); err != nil {
				_ = s.conn.Close()
				return
			}
		case <-s.dgramSig:
			s.dgramMu.Lock()
			pkt := s.pendingDg
			s.pendingDg = nil
			s.dgramMu.Unlock()
			if len(pkt) > 0 {
				if err := s.conn.WriteDatagramBinary(pkt); err != nil {
					_ = s.conn.Close()
					return
				}
			}
		case <-ticker.C:
			if err := s.conn.WritePing(); err != nil {
				_ = s.conn.Close()
				return
			}
		}
	}
}
