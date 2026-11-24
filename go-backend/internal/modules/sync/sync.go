package sync

import (
	"bytes"
	"encoding/json"
	stdsync "sync"
	"time"

	"go-backend/internal/modules/state"
)

// ClientReceiver is the minimal interface Synchronization needs from a Session.
type ClientReceiver interface {
	ID() string
	TrySend(payload []byte)
	TrySendDatagram(payload []byte)
	BinaryEnabled() bool
}

// WelcomeMessage is sent to a player immediately upon joining a room.
type WelcomeMessage struct {
	Type            string               `json:"type"`
	PlayerID        string               `json:"playerId"`
	RoomID          string               `json:"roomId"`
	MaxPlayers      int                  `json:"maxPlayers"`
	Mode            string               `json:"mode"`
	MapID           string               `json:"mapId"`
	Phase           string               `json:"phase"`
	HostUserID      string               `json:"hostUserId"`
	TargetKills     int                  `json:"targetKills"`
	BlueKills       int                  `json:"blueKills"`
	RedKills        int                  `json:"redKills"`
	WinnerTeam      string               `json:"winnerTeam,omitempty"`
	MatchElapsedSec int                  `json:"matchElapsedSec"`
	Map             state.MapConfig      `json:"map"`
	Characters      []state.CharacterDef `json:"characters"`
	Players         []state.PlayerState  `json:"players"`
	Projectiles     []state.Projectile   `json:"projectiles"`
	Beams           []state.BeamEffect   `json:"beams"`
	Zones           []state.ZoneEffect   `json:"zones"`
}

// StateMessage broadcasts authoritative room state on tick updates.
type StateMessage struct {
	Type            string              `json:"type"`
	Tick            uint64              `json:"tick"`
	Mode            string              `json:"mode"`
	MapID           string              `json:"mapId,omitempty"`
	Phase           string              `json:"phase"`
	HostUserID      string              `json:"hostUserId"`
	TargetKills     int                 `json:"targetKills"`
	BlueKills       int                 `json:"blueKills"`
	RedKills        int                 `json:"redKills"`
	WinnerTeam      string              `json:"winnerTeam,omitempty"`
	MatchElapsedSec int                 `json:"matchElapsedSec"`
	Map             *state.MapConfig    `json:"map,omitempty"`
	Players         []state.PlayerState `json:"players"`
	Projectiles     []state.Projectile  `json:"projectiles"`
	Beams           []state.BeamEffect  `json:"beams"`
	Zones           []state.ZoneEffect  `json:"zones"`
}

// PlayerEventMessage notifies room members when a player joins or leaves.
type PlayerEventMessage struct {
	Type   string            `json:"type"`
	Player state.PlayerState `json:"player"`
}

// PlayerDiedMessage notifies room members when a player is eliminated.
type PlayerDiedMessage struct {
	Type       string  `json:"type"`
	VictimID   string  `json:"victimId"`
	VictimName string  `json:"victimName"`
	KillerName string  `json:"killerName"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
}

// PlayerEmoteMessage broadcasts a player's emote/pulse signal to the room.
type PlayerEmoteMessage struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
	Emote    string `json:"emote"`
}

// SaitamaPunchMessage broadcasts a Serious Death Punch target-select strike so the victim sees the fist + DEAD screen.
type SaitamaPunchMessage struct {
	Type         string  `json:"type"`
	TargetID     string  `json:"targetId"`
	TargetName   string  `json:"targetName"`
	AttackerID   string  `json:"attackerId"`
	AttackerName string  `json:"attackerName"`
	Blocked      bool    `json:"blocked"`
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
}

// InfinitySnapMessage broadcasts Thanos collecting all 5 Infinity Stones and snapping his fingers.
type InfinitySnapMessage struct {
	Type         string `json:"type"`
	AttackerID   string `json:"attackerId"`
	AttackerName string `json:"attackerName"`
	Mode         string `json:"mode"`
	InstantWin   bool   `json:"instantWin"`
	KilledCount  int    `json:"killedCount"`
}

// DomainClashMessage notifies room members when Gojo Infinite Void & Sukuna Malevolent Shrine collide.
type DomainClashMessage struct {
	Type       string  `json:"type"`
	GojoName   string  `json:"gojoName"`
	SukunaName string  `json:"sukunaName"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
}

// VoiceSignalMessage relays WebRTC offer/answer/ICE candidates, mic/speaker state, or fallback voice chunks between peers in the same room.
type VoiceSignalMessage struct {
	Type       string `json:"type"`
	FromID     string `json:"fromId"`
	FromName   string `json:"fromName"`
	TargetID   string `json:"targetId,omitempty"`
	SignalType string `json:"signalType"`
	SDP        string `json:"sdp,omitempty"`
	Candidate  string `json:"candidate,omitempty"`
	MicOn      bool   `json:"micOn"`
	SpeakerOn  bool   `json:"speakerOn"`
	Speaking   bool   `json:"speaking"`
	AudioChunk string `json:"audioChunk,omitempty"`
}

// ErrorMessage delivers structured error feedback over WebSocket.
type ErrorMessage struct {
	Type    string `json:"type"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// PongMessage responds to client latency pings.
type PongMessage struct {
	Type string `json:"type"`
	TS   int64  `json:"ts"`
}

// Synchronizer serializes and fans out authoritative state to room sessions.
type Synchronizer struct {
	bufPool stdsync.Pool
}

// NewSynchronizer creates a Synchronization coordinator.
func NewSynchronizer() *Synchronizer {
	return &Synchronizer{
		bufPool: stdsync.Pool{
			New: func() any {
				return bytes.NewBuffer(make([]byte, 0, 2048))
			},
		},
	}
}

func (s *Synchronizer) marshalFrame(v any) ([]byte, bool) {
	buf := s.bufPool.Get().(*bytes.Buffer)
	buf.Reset()
	enc := json.NewEncoder(buf)
	enc.SetEscapeHTML(false)
	err := enc.Encode(v)
	if err != nil {
		s.bufPool.Put(buf)
		return nil, false
	}
	b := buf.Bytes()
	if len(b) > 0 && b[len(b)-1] == '\n' {
		b = b[:len(b)-1]
	}
	out := make([]byte, len(b))
	copy(out, b)
	if buf.Cap() <= 65536 {
		s.bufPool.Put(buf)
	}
	return out, true
}

func computeMatchElapsedSec(rs *state.RoomState, now time.Time) int {
	if rs.MatchStartedAt.IsZero() {
		return 0
	}
	end := now
	if rs.Phase == state.PhaseFinished && !rs.MatchEndedAt.IsZero() {
		end = rs.MatchEndedAt
	}
	if sec := int(end.Sub(rs.MatchStartedAt).Seconds()); sec > 0 {
		return sec
	}
	return 0
}

// SendWelcome sends the initial room snapshot and role-filtered character catalog to a newly joined session.
func (s *Synchronizer) SendWelcome(target ClientReceiver, playerID string, rs *state.RoomState, role string, now time.Time) {
	msg := WelcomeMessage{
		Type:            "welcome",
		PlayerID:        playerID,
		RoomID:          rs.RoomID,
		MaxPlayers:      rs.MaxPlayers,
		Mode:            rs.Mode,
		MapID:           rs.MapID,
		Phase:           rs.Phase,
		HostUserID:      rs.HostUserID,
		TargetKills:     rs.TargetKills,
		BlueKills:       rs.BlueKills,
		RedKills:        rs.RedKills,
		WinnerTeam:      rs.WinnerTeam,
		MatchElapsedSec: computeMatchElapsedSec(rs, now),
		Map:             rs.Map,
		Characters:      state.CharactersForRole(role),
		Players:         rs.SnapshotPlayers(now),
		Projectiles:     rs.SnapshotProjectiles(),
		Beams:           rs.SnapshotBeams(),
		Zones:           rs.SnapshotZones(),
	}
	if data, ok := s.marshalFrame(msg); ok {
		target.TrySend(data)
	}
}

// BroadcastState sends the latest authoritative state to all sessions in the room.
// Sessions with BinaryEnabled() receive compact binary datagram-ready ticks during live play,
// while Lobby/Finished/legacy text clients receive reliable JSON frames cleanly.
func (s *Synchronizer) BroadcastState(receivers []ClientReceiver, rs *state.RoomState, now time.Time) {
	s.broadcastStateWithMap(receivers, rs, now, false)
}

// BroadcastReliableState forces a reliable full JSON snapshot (used after map or hero swaps).
func (s *Synchronizer) BroadcastReliableState(receivers []ClientReceiver, rs *state.RoomState, now time.Time) {
	s.broadcastStateWithMap(receivers, rs, now, true)
}

// BroadcastRoomConfig sends authoritative state along with updated map geometry (used after map switch in lobby).
func (s *Synchronizer) BroadcastRoomConfig(receivers []ClientReceiver, rs *state.RoomState, now time.Time) {
	s.broadcastStateWithMap(receivers, rs, now, true)
}

func (s *Synchronizer) broadcastStateWithMap(receivers []ClientReceiver, rs *state.RoomState, now time.Time, includeMap bool) {
	var hasTextClient, hasBinClient bool
	allowBin := rs.Phase == state.PhasePlaying && !includeMap
	for _, r := range receivers {
		if allowBin && r.BinaryEnabled() {
			hasBinClient = true
		} else {
			hasTextClient = true
		}
	}

	var binData []byte
	var binOK bool
	if hasBinClient {
		binData, binOK = s.EncodeBinaryState(rs, now)
		if !binOK {
			hasTextClient = true
		}
	}

	var jsonData []byte
	var jsonOK bool
	if hasTextClient {
		var mapPtr *state.MapConfig
		if includeMap {
			mCopy := rs.Map
			mapPtr = &mCopy
		}
		msg := StateMessage{
			Type:            "state",
			Tick:            rs.Tick,
			Mode:            rs.Mode,
			MapID:           rs.MapID,
			Phase:           rs.Phase,
			HostUserID:      rs.HostUserID,
			TargetKills:     rs.TargetKills,
			BlueKills:       rs.BlueKills,
			RedKills:        rs.RedKills,
			WinnerTeam:      rs.WinnerTeam,
			MatchElapsedSec: computeMatchElapsedSec(rs, now),
			Map:             mapPtr,
			Players:         rs.SnapshotPlayers(now),
			Projectiles:     rs.SnapshotProjectiles(),
			Beams:           rs.SnapshotBeams(),
			Zones:           rs.SnapshotZones(),
		}
		jsonData, jsonOK = s.marshalFrame(msg)
	}

	for _, r := range receivers {
		if binOK && r.BinaryEnabled() {
			r.TrySendDatagram(binData)
		} else if jsonOK {
			r.TrySend(jsonData)
		}
	}
}

// BroadcastPlayerEvent notifies all sessions except excludeID about a join or leave.
func (s *Synchronizer) BroadcastPlayerEvent(receivers []ClientReceiver, eventType string, p state.PlayerState, excludeID string) {
	msg := PlayerEventMessage{
		Type:   eventType,
		Player: p,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for _, r := range receivers {
		if r.ID() == excludeID {
			continue
		}
		r.TrySend(data)
	}
}

// BroadcastPlayerDied notifies all sessions in the room about an elimination.
func (s *Synchronizer) BroadcastPlayerDied(receivers []ClientReceiver, victimID, victimName, killerName string, x, y float64) {
	msg := PlayerDiedMessage{
		Type:       "player_died",
		VictimID:   victimID,
		VictimName: victimName,
		KillerName: killerName,
		X:          x,
		Y:          y,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for _, r := range receivers {
		r.TrySend(data)
	}
}

// BroadcastPlayerEmote sends an emote/pulse bubble to all sessions in the room.
func (s *Synchronizer) BroadcastPlayerEmote(receivers []ClientReceiver, playerID, emote string) {
	msg := PlayerEmoteMessage{
		Type:     "emote",
		PlayerID: playerID,
		Emote:    emote,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for _, r := range receivers {
		r.TrySend(data)
	}
}

// BroadcastSaitamaPunch notifies room members of an instant-kill lock-on punch or invulnerability block.
func (s *Synchronizer) BroadcastSaitamaPunch(receivers []ClientReceiver, msg SaitamaPunchMessage) {
	msg.Type = "saitama_punch"
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for _, r := range receivers {
		r.TrySend(data)
	}
}

// BroadcastDomainClash notifies room members when Infinite Void & Malevolent Shrine clash!
func (s *Synchronizer) BroadcastDomainClash(receivers []ClientReceiver, msg DomainClashMessage) {
	msg.Type = "domain_clash"
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for _, r := range receivers {
		r.TrySend(data)
	}
}

// BroadcastInfinitySnap notifies room members of Thanos's Infinity Gauntlet Snap!
func (s *Synchronizer) BroadcastInfinitySnap(receivers []ClientReceiver, msg InfinitySnapMessage) {
	msg.Type = "infinity_snap"
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for _, r := range receivers {
		r.TrySend(data)
	}
}

// SendVoiceSignal delivers a targeted WebRTC offer/answer/ICE candidate to a specific peer in the room.
func (s *Synchronizer) SendVoiceSignal(target ClientReceiver, msg VoiceSignalMessage) {
	msg.Type = "voice_signal"
	if data, ok := s.marshalFrame(msg); ok {
		target.TrySend(data)
	}
}

// BroadcastVoiceSignal broadcasts a player's voice state (mic/speaker/speaking) or audio frame to all other room peers.
func (s *Synchronizer) BroadcastVoiceSignal(receivers []ClientReceiver, msg VoiceSignalMessage, excludeSessionID string) {
	msg.Type = "voice_signal"
	data, ok := s.marshalFrame(msg)
	if !ok {
		return
	}
	for _, r := range receivers {
		if r.ID() == excludeSessionID {
			continue
		}
		r.TrySend(data)
	}
}

// SendError sends a structured error JSON frame to a single session.
func (s *Synchronizer) SendError(target ClientReceiver, code, message string) {
	data, err := json.Marshal(ErrorMessage{
		Type:    "error",
		Code:    code,
		Message: message,
	})
	if err == nil {
		target.TrySend(data)
	}
}

// SendPong replies to a client ping frame (9-byte compact binary if BinaryEnabled, else JSON).
func (s *Synchronizer) SendPong(target ClientReceiver, ts int64) {
	if target.BinaryEnabled() {
		target.TrySendDatagram(EncodeBinaryPong(ts))
		return
	}
	data, err := json.Marshal(PongMessage{
		Type: "pong",
		TS:   ts,
	})
	if err == nil {
		target.TrySend(data)
	}
}
