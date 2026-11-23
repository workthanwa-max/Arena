package state

import (
	"sort"
	"time"
)

// Match modes, map identifiers, and room lifecycle phases.
const (
	ModeFFA      = "ffa"
	ModeDuel1v1  = "duel_1v1"
	ModeIconic   = "iconic"
	ModeTDM3v3   = "tdm_3v3"
	ModePractice = "practice"

	MapShibuya = "shibuya"
	MapKonoha  = "konoha"

	PhaseWaiting  = "waiting"
	PhasePlaying  = "playing"
	PhaseFinished = "finished"

	TeamFFA  = "ffa"
	TeamBlue = "blue"
	TeamRed  = "red"
)

// Pillar defines an indestructible circular obstacle on the battlefield.
type Pillar struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Radius float64 `json:"radius"`
}

// MapConfig defines authoritative world dimensions, obstacles, and base movement parameters.
type MapConfig struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Width        float64  `json:"width"`
	Height       float64  `json:"height"`
	PlayerRadius float64  `json:"playerRadius"`
	MoveSpeed    float64  `json:"moveSpeed"`
	Pillars      []Pillar `json:"pillars"`
}

// NormalizeMode validates room game mode ("ffa", "duel_1v1", "iconic", "tdm_3v3", or "practice").
func NormalizeMode(raw string) string {
	switch raw {
	case ModeDuel1v1:
		return ModeDuel1v1
	case ModeIconic:
		return ModeIconic
	case ModeTDM3v3:
		return ModeTDM3v3
	case ModePractice:
		return ModePractice
	default:
		return ModeFFA
	}
}

// IsTeamMatchMode reports whether the mode uses two opposing sides (Blue vs Red) with team scoring & balanced spawns.
func IsTeamMatchMode(mode string) bool {
	return mode == ModeTDM3v3 || mode == ModeDuel1v1 || mode == ModeIconic
}

// HasWaitingLobby reports whether players wait in a pre-game room lobby and enter together on start (all modes except ModeFFA).
func HasWaitingLobby(mode string) bool {
	return mode != ModeFFA
}

// NormalizeMapID validates map identifier ("shibuya" or "konoha").
func NormalizeMapID(raw string) string {
	if raw == MapKonoha {
		return MapKonoha
	}
	return MapShibuya
}

// MapConfigFor returns the authoritative arena geometry for the given map ID.
func MapConfigFor(mapID string) MapConfig {
	switch NormalizeMapID(mapID) {
	case MapKonoha:
		return MapConfig{
			ID:           MapKonoha,
			Name:         "หมู่บ้านโคโนฮะ (Konoha Village)",
			Width:        3000,
			Height:       1800,
			PlayerRadius: 18,
			MoveSpeed:    255,
			// Symmetrical Shinobi village pillars & torii checkpoints balanced for 3v3 left-vs-right combat.
			Pillars: []Pillar{
				{X: 620, Y: 460, Radius: 44},
				{X: 620, Y: 1340, Radius: 44},
				{X: 1080, Y: 720, Radius: 42},
				{X: 1080, Y: 1080, Radius: 42},
				{X: 1500, Y: 380, Radius: 48},
				{X: 1500, Y: 1420, Radius: 48},
				{X: 1920, Y: 720, Radius: 42},
				{X: 1920, Y: 1080, Radius: 42},
				{X: 2380, Y: 460, Radius: 44},
				{X: 2380, Y: 1340, Radius: 44},
			},
		}
	default:
		return MapConfig{
			ID:           MapShibuya,
			Name:         "ชิบูย่า (Shibuya Incident)",
			Width:        3000,
			Height:       1800,
			PlayerRadius: 18,
			MoveSpeed:    255,
			Pillars: []Pillar{
				{X: 560, Y: 420, Radius: 46},
				{X: 1500, Y: 360, Radius: 50},
				{X: 2440, Y: 420, Radius: 46},
				{X: 560, Y: 1380, Radius: 46},
				{X: 1500, Y: 1440, Radius: 50},
				{X: 2440, Y: 1380, Radius: 46},
				{X: 980, Y: 900, Radius: 44},
				{X: 2020, Y: 900, Radius: 44},
				{X: 1120, Y: 560, Radius: 40},
				{X: 1880, Y: 1240, Radius: 40},
			},
		}
	}
}

// DefaultMapConfig returns the expansive 3000x1800 colosseum battlefield configuration.
func DefaultMapConfig() MapConfig {
	return MapConfigFor(MapShibuya)
}

// PlayerState holds the server-authoritative state of one player in a room.
type PlayerState struct {
	ID               string       `json:"id"`
	NetID            uint16       `json:"netId"`
	UserID           string       `json:"userId,omitempty"`
	Name             string       `json:"name"`
	CharacterID      string       `json:"characterId"`
	CharacterName    string       `json:"characterName"`
	Team             string       `json:"team"`
	IsDummy          bool         `json:"isDummy,omitempty"`
	Ready            bool         `json:"ready"`
	IsHost           bool         `json:"isHost"`
	X                float64      `json:"x"`
	Y                float64      `json:"y"`
	Color            string       `json:"color"`
	AccentColor      string       `json:"accentColor"`
	HP               int          `json:"hp"`
	MaxHP            int          `json:"maxHp"`
	Alive            bool         `json:"alive"`
	Kills            int          `json:"kills"`
	Deaths           int          `json:"deaths"`
	KilledBy         string       `json:"killedBy,omitempty"`
	Stunned          bool         `json:"stunned"`
	Slowed           bool         `json:"slowed"`
	Godspeed         bool         `json:"godspeed"`
	FastAttack       bool         `json:"fastAttack"`
	Invulnerable     bool         `json:"invulnerable"`
	Seated           bool         `json:"seated"`
	InVoid           bool         `json:"inVoid"`
	RespawnInMs      int64        `json:"respawnInMs"`
	CooldownsMs      [5]int64     `json:"cooldownsMs"`
	InfinityStones   []int        `json:"infinityStones,omitempty"`
	SnapCooldownMs   int64        `json:"snapCooldownMs"`
	BasicCooldownMs  int64        `json:"basicCooldownMs"`
	DashCooldownMs   int64        `json:"dashCooldownMs"`
	RctCooldownMs    int64        `json:"rctCooldownMs"`
	InputDX          float64      `json:"dx"`
	InputDY          float64      `json:"dy"`
	AimDX            float64      `json:"aimDx"`
	AimDY            float64      `json:"aimDy"`
	LastSeq          uint64       `json:"lastSeq"`
	StunUntil        time.Time    `json:"-"`
	SlowUntil        time.Time    `json:"-"`
	BuffUntil        time.Time    `json:"-"`
	RapidAttackUntil time.Time    `json:"-"`
	InvulnUntil      time.Time    `json:"-"`
	ThroneUntil      time.Time    `json:"-"`
	VoidUntil        time.Time    `json:"-"`
	RespawnAt        time.Time    `json:"-"`
	LastHitAt        time.Time    `json:"-"`
	CooldownUntil    [5]time.Time `json:"-"`
	SnapUntil        time.Time    `json:"-"`
	AttackUntil      time.Time    `json:"-"`
	DashUntil        time.Time    `json:"-"`
	RctUntil         time.Time    `json:"-"`
	LastEmoteAt      time.Time    `json:"-"`
}

// Projectile represents a flying skill projectile simulated by the server.
type Projectile struct {
	ID            string          `json:"id"`
	OwnerID       string          `json:"ownerId"`
	OwnerName     string          `json:"-"`
	OwnerTeam     string          `json:"-"`
	Kind          string          `json:"kind"`
	X             float64         `json:"x"`
	Y             float64         `json:"y"`
	VX            float64         `json:"vx"`
	VY            float64         `json:"vy"`
	Radius        float64         `json:"radius"`
	Color         string          `json:"color"`
	AccentColor   string          `json:"accentColor"`
	Damage        int             `json:"-"`
	StunSec       float64         `json:"-"`
	Knockback     float64         `json:"-"`
	PullOnHit     float64         `json:"-"`
	ExplodeRadius float64         `json:"-"`
	SpawnPoolKind string          `json:"-"`
	Piercing      bool            `json:"-"`
	Boomerang     bool            `json:"-"`
	Returned      bool            `json:"-"`
	TargetID      string          `json:"targetId,omitempty"`
	HomingSpeed   float64         `json:"-"`
	ExplodeKind   string          `json:"-"`
	ChainLeft     int             `json:"-"`
	ChainRadius   float64         `json:"-"`
	HitTargets    map[string]bool `json:"-"`
	Life          float64         `json:"-"`
	MaxLife       float64         `json:"-"`
}

// BeamEffect represents a line/slash wave attack rendered briefly on clients.
type BeamEffect struct {
	ID          string  `json:"id"`
	OwnerID     string  `json:"ownerId"`
	Kind        string  `json:"kind"`
	X1          float64 `json:"x1"`
	Y1          float64 `json:"y1"`
	X2          float64 `json:"x2"`
	Y2          float64 `json:"y2"`
	Width       float64 `json:"width"`
	Color       string  `json:"color"`
	AccentColor string  `json:"accentColor"`
	Life        float64 `json:"life"`
	MaxLife     float64 `json:"maxLife"`
}

// ZoneEffect represents an AoE field (e.g. Tsukuyomi, Amaterasu, Narukami, Malevolent Shrine).
type ZoneEffect struct {
	ID            string               `json:"id"`
	OwnerID       string               `json:"ownerId"`
	OwnerName     string               `json:"-"`
	OwnerTeam     string               `json:"-"`
	Kind          string               `json:"kind"`
	X             float64              `json:"x"`
	Y             float64              `json:"y"`
	Radius        float64              `json:"radius"`
	Color         string               `json:"color"`
	AccentColor   string               `json:"accentColor"`
	Life          float64              `json:"life"`
	MaxLife       float64              `json:"maxLife"`
	DelayLeft     float64              `json:"delayLeft,omitempty"`
	MaxDelay      float64              `json:"maxDelay,omitempty"`
	StepCount     int                  `json:"stepCount,omitempty"`
	AimAngle      float64              `json:"aimAngle,omitempty"`
	DamagePerTick int                  `json:"-"`
	TickInterval  float64              `json:"-"`
	NextTickIn    float64              `json:"-"`
	StunSec       float64              `json:"-"`
	SlowSec       float64              `json:"-"`
	PullForce     float64              `json:"-"`
	MoveVX        float64              `json:"-"`
	MoveVY        float64              `json:"-"`
	FollowOwner   bool                 `json:"-"`
	HitCooldowns  map[string]time.Time `json:"-"`
}

// RoomState holds the authoritative state of a single game room.
type RoomState struct {
	RoomID         string
	MaxPlayers     int
	Mode           string
	MapID          string
	Phase          string
	HostUserID     string
	TargetKills    int
	BlueKills      int
	RedKills       int
	WinnerTeam     string
	MatchStartedAt time.Time
	MatchEndedAt   time.Time
	Map            MapConfig
	Tick           uint64
	NextNetID      uint16
	Players        map[string]*PlayerState
	Projectiles    []Projectile
	Beams          []BeamEffect
	Zones          []ZoneEffect
}

// NewRoomState initializes an empty room state configured for its mode & map.
func NewRoomState(roomID string, maxPlayers int, cfg MapConfig) *RoomState {
	mapID := cfg.ID
	if mapID == "" {
		mapID = MapShibuya
		cfg.ID = MapShibuya
	}
	return &RoomState{
		RoomID:      roomID,
		MaxPlayers:  maxPlayers,
		Mode:        ModeFFA,
		MapID:       mapID,
		Phase:       PhasePlaying,
		Map:         cfg,
		Players:     make(map[string]*PlayerState, maxPlayers),
		Projectiles: make([]Projectile, 0, 32),
		Beams:       make([]BeamEffect, 0, 8),
		Zones:       make([]ZoneEffect, 0, 8),
	}
}

// AssignNetID ensures each player/dummy in the room owns a compact uint16 identifier for binary tick packets.
func (rs *RoomState) AssignNetID(p *PlayerState) {
	if p == nil || p.NetID != 0 {
		return
	}
	rs.NextNetID++
	if rs.NextNetID == 0 {
		rs.NextNetID = 1
	}
	p.NetID = rs.NextNetID
}

// SnapshotPlayers returns a copy of all player states with computed remaining cooldowns.
func (rs *RoomState) SnapshotPlayers(now time.Time) []PlayerState {
	out := make([]PlayerState, 0, len(rs.Players))
	for _, p := range rs.Players {
		cp := *p
		cp.Stunned = now.Before(p.StunUntil)
		cp.Slowed = now.Before(p.SlowUntil)
		cp.Godspeed = now.Before(p.BuffUntil)
		cp.FastAttack = now.Before(p.RapidAttackUntil)
		cp.Invulnerable = now.Before(p.InvulnUntil)
		cp.Seated = now.Before(p.ThroneUntil)
		cp.InVoid = now.Before(p.VoidUntil)
		if !p.Alive && !p.RespawnAt.IsZero() && now.Before(p.RespawnAt) {
			cp.RespawnInMs = p.RespawnAt.Sub(now).Milliseconds()
		} else {
			cp.RespawnInMs = 0
		}
		for i := 0; i < len(p.CooldownUntil); i++ {
			if rem := p.CooldownUntil[i].Sub(now).Milliseconds(); rem > 0 {
				cp.CooldownsMs[i] = rem
			} else {
				cp.CooldownsMs[i] = 0
			}
		}
		if len(p.InfinityStones) > 0 {
			stones := make([]int, len(p.InfinityStones))
			copy(stones, p.InfinityStones)
			cp.InfinityStones = stones
		}
		if rem := p.SnapUntil.Sub(now).Milliseconds(); rem > 0 {
			cp.SnapCooldownMs = rem
		} else {
			cp.SnapCooldownMs = 0
		}
		if rem := p.AttackUntil.Sub(now).Milliseconds(); rem > 0 {
			cp.BasicCooldownMs = rem
		} else {
			cp.BasicCooldownMs = 0
		}
		if rem := p.DashUntil.Sub(now).Milliseconds(); rem > 0 {
			cp.DashCooldownMs = rem
		} else {
			cp.DashCooldownMs = 0
		}
		if rem := p.RctUntil.Sub(now).Milliseconds(); rem > 0 {
			cp.RctCooldownMs = rem
		} else {
			cp.RctCooldownMs = 0
		}
		out = append(out, cp)
	}
	// Sort scoreboard strictly by Kills descending with deterministic ID tie-breaker
	// so rows never flicker/swap randomly across 30Hz snapshots.
	sort.Slice(out, func(i, j int) bool {
		if out[i].Kills != out[j].Kills {
			return out[i].Kills > out[j].Kills
		}
		return out[i].ID < out[j].ID
	})
	return out
}

var (
	emptyProjectiles = []Projectile{}
	emptyBeams       = []BeamEffect{}
	emptyZones       = []ZoneEffect{}
)

// SnapshotProjectiles returns a copy of active projectiles.
func (rs *RoomState) SnapshotProjectiles() []Projectile {
	if len(rs.Projectiles) == 0 {
		return emptyProjectiles
	}
	out := make([]Projectile, len(rs.Projectiles))
	copy(out, rs.Projectiles)
	return out
}

// SnapshotBeams returns a copy of active beam effects.
func (rs *RoomState) SnapshotBeams() []BeamEffect {
	if len(rs.Beams) == 0 {
		return emptyBeams
	}
	out := make([]BeamEffect, len(rs.Beams))
	copy(out, rs.Beams)
	return out
}

// SnapshotZones returns a copy of active ground/domain zones.
func (rs *RoomState) SnapshotZones() []ZoneEffect {
	if len(rs.Zones) == 0 {
		return emptyZones
	}
	out := make([]ZoneEffect, len(rs.Zones))
	copy(out, rs.Zones)
	return out
}
