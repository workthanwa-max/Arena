package sync

import (
	"encoding/binary"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	"go-backend/internal/modules/state"
)

// Binary opcodes shared cleanly across WebSocket Binary Frames (opBinary) and WebTransport QUIC Datagrams/Streams.
const (
	BinClientInput   byte = 0x01 // [0]=0x01 [1..4]=u32 seq [5]=i8 dx*127 [6]=i8 dy*127
	BinClientAttack  byte = 0x02 // [0]=0x02 [1..2]=u16 tx [3..4]=u16 ty
	BinClientDash    byte = 0x03 // [0]=0x03 [1..2]=u16 tx [3..4]=u16 ty
	BinClientRCT     byte = 0x04 // [0]=0x04
	BinClientSnap    byte = 0x05 // [0]=0x05
	BinClientRespawn byte = 0x06 // [0]=0x06
	BinClientSkill   byte = 0x07 // [0]=0x07 [1]=u8 slot [2..3]=u16 tx [4..5]=u16 ty [6]=u8 targetLen [targetUTF8...]
	BinClientPing    byte = 0x08 // [0]=0x08 [1..8]=i64 tsMs

	BinServerState byte = 0x10 // Compact world delta snapshot (PhasePlaying)
	BinServerPong  byte = 0x11 // [0]=0x11 [1..8]=i64 tsMs
)

// EffectKinds keeps projectile/beam/zone kind strings compact (1 byte) across both Go & TypeScript.
var EffectKinds = []string{
	"atk_default_pulse",      // 0
	"atk_gilga_sword",        // 1
	"atk_gilga_flash",        // 2
	"atk_goku_fist",          // 3
	"atk_itachi_kunai",       // 4
	"atk_zoro_sweep",         // 5
	"atk_killua_spark",       // 6
	"atk_sukuna_cleave",      // 7
	"atk_rimuru_water",       // 8
	"atk_aiouan_paw",         // 9
	"atk_sorn_jab",           // 10
	"atk_gojo_punch",         // 11
	"atk_zenitsu_slash",      // 12
	"atk_thanos_gauntlet",    // 13
	"basic_lock_reticle",     // 14
	"gate_sword",             // 15
	"gate_portal",            // 16
	"enkidu_field",           // 17
	"enkidu_tether",          // 18
	"gilga_sword_rain",       // 19
	"gilga_sky_sword",        // 20
	"ki_blast",               // 21
	"dragon_rush",            // 22
	"kamehameha",             // 23
	"dash_afterimage",        // 24
	"instant_transmission",   // 25
	"crow_shuriken",          // 26
	"crow_storm",             // 27
	"tsukuyomi",              // 28
	"amaterasu",              // 29
	"pound_ho",               // 30
	"shishi_sonson",          // 31
	"sanzen_sekai",           // 32
	"killua_solo_flash",      // 33
	"killua_solo_ring",       // 34
	"godspeed_aura",          // 35
	"narukami",               // 36
	"narukami_strike",        // 37
	"dismantle",              // 38
	"fuga_arrow",             // 39
	"fuga_explosion",         // 40
	"fuga_cinder",            // 41
	"malevolent_shrine",      // 42
	"black_lightning",        // 43
	"black_lightning_strike", // 44
	"black_flame_wave",       // 45
	"beelzebuth",             // 46
	"aiouan_lock_beam",       // 47
	"aiouan_pounce",          // 48
	"aiouan_pounce_seal",     // 49
	"aiouan_ora_rush",        // 50
	"aiouan_timestop",        // 51
	"aiouan_timestop_burst",  // 52
	"saitama_serious_punch",  // 53
	"saitama_dodge",          // 54
	"gojo_red",               // 55
	"gojo_blue",              // 56
	"gojo_cast_red",          // 57
	"gojo_cast_blue",         // 58
	"hollow_purple",          // 59
	"hollow_purple_blast",    // 60
	"infinite_void",          // 61
	"infinite_void_open",     // 62
	"domain_clash_shock",     // 63
	"zenitsu_hekireki",       // 64
	"zenitsu_rokuren",        // 65
	"zenitsu_murad_slash",    // 66
	"zenitsu_honoo_no_kami",  // 67
	"thanos_power_blast",     // 68
	"thanos_space_warp",      // 69
	"thanos_space_vortex",    // 70
	"thanos_reality_shard",   // 71
	"thanos_reality_rift",    // 72
	"thanos_time_mandala",    // 73
	"thanos_mind_beam",       // 74
	"thanos_infinity_snap",   // 75
	"atk_simo_rifle",         // 76
	"simo_sentinel",          // 77
	"simo_snipe_max",         // 78
	"simo_snipe_off",         // 79
	"simo_backflip_shot",     // 80
	"simo_blizzard_burst",    // 81
	"scp_medkit_orb",         // 82
	"scp_medkit_heal",        // 83
	"atk_jinwoo_dagger",      // 84
	"atk_naruto_rasen",       // 85
	"atk_sanji_kick",         // 86
	"atk_luffy_punch",        // 87
	"atk_ben10_omni",         // 88
	"atk_diablo_claw",        // 89
	"jinwoo_dagger_dash",     // 90
	"jinwoo_rulers_hand",     // 91
	"jinwoo_arise",           // 92
	"jinwoo_shadow_slash",    // 93
	"naruto_rasengan",        // 94
	"naruto_rasengan_burst",  // 95
	"naruto_rasenshuriken",   // 96
	"naruto_shuriken_boom",   // 97
	"naruto_kurama_aura",     // 98
	"sanji_skywalk",          // 99
	"sanji_diable_fire",      // 100
	"sanji_ifrit_rush",       // 101
	"sanji_ifrit_burst",      // 102
	"luffy_pistol",           // 103
	"luffy_gatling",          // 104
	"luffy_gatling_fist",     // 105
	"luffy_bajrang_gun",      // 106
	"luffy_bajrang_smash",    // 107
	"ben10_heatblast",        // 108
	"ben10_heat_boom",        // 109
	"ben10_heat_pool",        // 110
	"ben10_xlr8_blitz",       // 111
	"ben10_cosmic_ray",       // 112
	"diablo_despair_wave",    // 113
	"diablo_temptation",      // 114
	"diablo_end_world",       // 115
	"diablo_eclipse_burst",   // 116
	"aegis_core_orb",         // 117
	"aegis_core_burst",       // 118
}

var effectKindIndex = func() map[string]byte {
	m := make(map[string]byte, len(EffectKinds))
	for i, k := range EffectKinds {
		m[k] = byte(i)
	}
	return m
}()

// DecodedBinaryCommand holds a fast zero-JSON command decoded from a client binary packet.
type DecodedBinaryCommand struct {
	Type     string
	Seq      uint64
	DX       float64
	DY       float64
	Slot     int
	TX       float64
	TY       float64
	TS       int64
	TargetID string
}

// ParseBinaryCommand decodes compact client binary input/action frames without JSON allocation.
func ParseBinaryCommand(data []byte) (DecodedBinaryCommand, error) {
	if len(data) == 0 {
		return DecodedBinaryCommand{}, errors.New("empty binary command")
	}
	switch data[0] {
	case BinClientInput:
		if len(data) < 7 {
			return DecodedBinaryCommand{}, errors.New("short C_INPUT")
		}
		return DecodedBinaryCommand{
			Type: "input",
			Seq:  uint64(binary.LittleEndian.Uint32(data[1:5])),
			DX:   float64(int8(data[5])) / 127.0,
			DY:   float64(int8(data[6])) / 127.0,
		}, nil
	case BinClientAttack:
		if len(data) < 5 {
			return DecodedBinaryCommand{}, errors.New("short C_ATTACK")
		}
		return DecodedBinaryCommand{
			Type: "attack",
			TX:   float64(binary.LittleEndian.Uint16(data[1:3])),
			TY:   float64(binary.LittleEndian.Uint16(data[3:5])),
		}, nil
	case BinClientDash:
		if len(data) < 5 {
			return DecodedBinaryCommand{}, errors.New("short C_DASH")
		}
		return DecodedBinaryCommand{
			Type: "dash",
			TX:   float64(binary.LittleEndian.Uint16(data[1:3])),
			TY:   float64(binary.LittleEndian.Uint16(data[3:5])),
		}, nil
	case BinClientRCT:
		return DecodedBinaryCommand{Type: "rct"}, nil
	case BinClientSnap:
		return DecodedBinaryCommand{Type: "snap"}, nil
	case BinClientRespawn:
		return DecodedBinaryCommand{Type: "respawn"}, nil
	case BinClientSkill:
		if len(data) < 7 {
			return DecodedBinaryCommand{}, errors.New("short C_SKILL")
		}
		tLen := int(data[6])
		var tid string
		if tLen > 0 && len(data) >= 7+tLen {
			tid = string(data[7 : 7+tLen])
		}
		return DecodedBinaryCommand{
			Type:     "skill",
			Slot:     int(data[1]),
			TX:       float64(binary.LittleEndian.Uint16(data[2:4])),
			TY:       float64(binary.LittleEndian.Uint16(data[4:6])),
			TargetID: tid,
		}, nil
	case BinClientPing:
		if len(data) < 9 {
			return DecodedBinaryCommand{}, errors.New("short C_PING")
		}
		return DecodedBinaryCommand{
			Type: "ping",
			TS:   int64(binary.LittleEndian.Uint64(data[1:9])),
		}, nil
	default:
		return DecodedBinaryCommand{}, errors.New("unknown binary opcode")
	}
}

// EncodeBinaryPong builds a 9-byte compact binary pong reply.
func EncodeBinaryPong(ts int64) []byte {
	out := make([]byte, 9)
	out[0] = BinServerPong
	binary.LittleEndian.PutUint64(out[1:9], uint64(ts))
	return out
}

func appendU16(b []byte, v uint16) []byte {
	var tmp [2]byte
	binary.LittleEndian.PutUint16(tmp[:], v)
	return append(b, tmp[:]...)
}

func appendI16(b []byte, v int16) []byte {
	return appendU16(b, uint16(v))
}

func appendU32(b []byte, v uint32) []byte {
	var tmp [4]byte
	binary.LittleEndian.PutUint32(tmp[:], v)
	return append(b, tmp[:]...)
}

func parseHexRGB(hex string) (byte, byte, byte) {
	s := strings.TrimPrefix(hex, "#")
	if len(s) != 6 {
		return 56, 189, 248
	}
	v, err := strconv.ParseUint(s, 16, 24)
	if err != nil {
		return 56, 189, 248
	}
	return byte(v >> 16), byte((v >> 8) & 0xFF), byte(v & 0xFF)
}

func parseEffectSeqID(id string, fallback uint32) uint32 {
	if idx := strings.LastIndexByte(id, '-'); idx >= 0 && idx+1 < len(id) {
		if n, err := strconv.ParseUint(id[idx+1:], 10, 32); err == nil {
			return uint32(n)
		}
	}
	return fallback
}

func appendKind(b []byte, kind string) []byte {
	if code, ok := effectKindIndex[kind]; ok {
		return append(b, code)
	}
	b = append(b, 0xFF)
	raw := []byte(kind)
	if len(raw) > 255 {
		raw = raw[:255]
	}
	b = append(b, byte(len(raw)))
	return append(b, raw...)
}

func clampU16Scale10(v float64) uint16 {
	scaled := math.Round(v * 10.0)
	if scaled <= 0 {
		return 0
	}
	if scaled >= 65535 {
		return 65535
	}
	return uint16(scaled)
}

func clampI8Scale127(v float64) byte {
	if v > 1 {
		v = 1
	} else if v < -1 {
		v = -1
	}
	return byte(int8(math.Round(v * 127.0)))
}

func clampU16Int(v int) uint16 {
	if v <= 0 {
		return 0
	}
	if v >= 65535 {
		return 65535
	}
	return uint16(v)
}

func clampU16Ms(ms int64) uint16 {
	if ms <= 0 {
		return 0
	}
	if ms >= 65535 {
		return 65535
	}
	return uint16(ms)
}

// EncodeBinaryState serializes high-frequency world state updates cleanly into ~150-300 byte datagram-ready frames.
func (s *Synchronizer) EncodeBinaryState(rs *state.RoomState, now time.Time) ([]byte, bool) {
	players := rs.SnapshotPlayers(now)
	projs := rs.SnapshotProjectiles()
	beams := rs.SnapshotBeams()
	zones := rs.SnapshotZones()

	// Guarantee every actor has a non-zero NetID before binary packing
	netMap := make(map[string]uint16, len(players))
	for i := range players {
		if players[i].NetID == 0 {
			return nil, false
		}
		netMap[players[i].ID] = players[i].NetID
	}

	b := make([]byte, 0, 512)
	b = append(b, BinServerState)
	var flags byte
	if rs.Phase == state.PhasePlaying {
		flags |= 1
	} else if rs.Phase == state.PhaseFinished {
		flags |= 2
	}
	b = append(b, flags)
	b = appendU32(b, uint32(rs.Tick))
	b = appendU16(b, clampU16Int(rs.BlueKills))
	b = appendU16(b, clampU16Int(rs.RedKills))
	b = appendU16(b, clampU16Int(computeMatchElapsedSec(rs, now)))
	b = append(b, byte(min(255, len(players))))
	b = append(b, byte(min(255, len(projs))))
	b = append(b, byte(min(255, len(beams))))
	b = append(b, byte(min(255, len(zones))))

	pLim := min(255, len(players))
	for i := 0; i < pLim; i++ {
		p := players[i]
		b = appendU16(b, p.NetID)
		b = appendU16(b, clampU16Scale10(p.X))
		b = appendU16(b, clampU16Scale10(p.Y))
		b = append(b, clampI8Scale127(p.InputDX), clampI8Scale127(p.InputDY), clampI8Scale127(p.AimDX), clampI8Scale127(p.AimDY))
		b = appendU16(b, clampU16Int(p.HP))
		b = appendU16(b, clampU16Int(p.MaxHP))
		b = appendU16(b, clampU16Int(p.Kills))
		b = appendU16(b, clampU16Int(p.Deaths))

		var st uint16
		if p.Alive {
			st |= 1 << 0
		}
		if p.Stunned {
			st |= 1 << 1
		}
		if p.Slowed {
			st |= 1 << 2
		}
		if p.Godspeed {
			st |= 1 << 3
		}
		if p.FastAttack {
			st |= 1 << 4
		}
		if p.Invulnerable {
			st |= 1 << 5
		}
		if p.Seated {
			st |= 1 << 6
		}
		if p.InVoid {
			st |= 1 << 7
		}
		for _, stone := range p.InfinityStones {
			if stone >= 1 && stone <= 5 {
				st |= 1 << uint(7+stone) // bits 8..12
			}
		}
		hasTimers := p.RespawnInMs > 0 || p.BasicCooldownMs > 0 || p.DashCooldownMs > 0 ||
			p.RctCooldownMs > 0 || p.SnapCooldownMs > 0 ||
			p.CooldownsMs[0] > 0 || p.CooldownsMs[1] > 0 || p.CooldownsMs[2] > 0 ||
			p.CooldownsMs[3] > 0 || p.CooldownsMs[4] > 0
		if hasTimers {
			st |= 1 << 13
		}
		b = appendU16(b, st)
		b = appendU32(b, uint32(p.LastSeq))
		if hasTimers {
			b = appendU16(b, clampU16Ms(p.RespawnInMs))
			for sIdx := 0; sIdx < 5; sIdx++ {
				b = appendU16(b, clampU16Ms(p.CooldownsMs[sIdx]))
			}
			b = appendU16(b, clampU16Ms(p.BasicCooldownMs))
			b = appendU16(b, clampU16Ms(p.DashCooldownMs))
			b = appendU16(b, clampU16Ms(p.RctCooldownMs))
			b = appendU16(b, clampU16Ms(p.SnapCooldownMs))
		}
	}

	prLim := min(255, len(projs))
	for i := 0; i < prLim; i++ {
		pr := projs[i]
		b = appendU32(b, parseEffectSeqID(pr.ID, uint32(i+1)))
		b = appendU16(b, netMap[pr.OwnerID])
		b = appendU16(b, netMap[pr.TargetID])
		b = appendKind(b, pr.Kind)
		b = appendU16(b, clampU16Scale10(pr.X))
		b = appendU16(b, clampU16Scale10(pr.Y))
		b = appendI16(b, int16(clampFloat(math.Round(pr.VX), -32767, 32767)))
		b = appendI16(b, int16(clampFloat(math.Round(pr.VY), -32767, 32767)))
		b = append(b, byte(clampFloat(math.Round(pr.Radius), 1, 255)))
		r1, g1, b1 := parseHexRGB(pr.Color)
		r2, g2, b2 := parseHexRGB(pr.AccentColor)
		b = append(b, r1, g1, b1, r2, g2, b2)
	}

	bLim := min(255, len(beams))
	for i := 0; i < bLim; i++ {
		bm := beams[i]
		b = appendU32(b, parseEffectSeqID(bm.ID, uint32(i+1)))
		b = appendU16(b, netMap[bm.OwnerID])
		b = appendKind(b, bm.Kind)
		b = appendU16(b, clampU16Scale10(bm.X1))
		b = appendU16(b, clampU16Scale10(bm.Y1))
		b = appendU16(b, clampU16Scale10(bm.X2))
		b = appendU16(b, clampU16Scale10(bm.Y2))
		b = append(b, byte(clampFloat(math.Round(bm.Width), 1, 255)))
		b = appendU16(b, clampU16Ms(int64(math.Round(bm.Life*1000))))
		b = appendU16(b, clampU16Ms(int64(math.Round(bm.MaxLife*1000))))
		r1, g1, b1 := parseHexRGB(bm.Color)
		r2, g2, b2 := parseHexRGB(bm.AccentColor)
		b = append(b, r1, g1, b1, r2, g2, b2)
	}

	zLim := min(255, len(zones))
	for i := 0; i < zLim; i++ {
		zn := zones[i]
		b = appendU32(b, parseEffectSeqID(zn.ID, uint32(i+1)))
		b = appendU16(b, netMap[zn.OwnerID])
		b = appendKind(b, zn.Kind)
		b = appendU16(b, clampU16Scale10(zn.X))
		b = appendU16(b, clampU16Scale10(zn.Y))
		b = appendU16(b, uint16(clampFloat(math.Round(zn.Radius), 1, 65535)))
		b = appendI16(b, int16(clampFloat(math.Round(zn.AimAngle*1000.0), -32767, 32767)))
		b = append(b, byte(clampFloat(float64(zn.StepCount), 0, 255)))
		b = appendU16(b, clampU16Ms(int64(math.Round(zn.Life*1000))))
		b = appendU16(b, clampU16Ms(int64(math.Round(zn.MaxLife*1000))))
		b = appendU16(b, clampU16Ms(int64(math.Round(zn.DelayLeft*1000))))
		b = appendU16(b, clampU16Ms(int64(math.Round(zn.MaxDelay*1000))))
		r1, g1, b1 := parseHexRGB(zn.Color)
		r2, g2, b2 := parseHexRGB(zn.AccentColor)
		b = append(b, r1, g1, b1, r2, g2, b2)
	}

	return b, true
}

func clampFloat(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
