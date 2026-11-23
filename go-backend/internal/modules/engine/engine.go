package engine

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"math"
	"sort"
	"time"

	"go-backend/internal/modules/state"
)

// HitEvent describes an elimination on the battlefield.
type HitEvent struct {
	VictimID   string
	VictimName string
	KillerID   string
	KillerName string
	X          float64
	Y          float64
}

// PunchEvent describes Saitama's guaranteed-kill lock-on punch result for full-screen victim presentation.
type PunchEvent struct {
	TargetID     string
	TargetName   string
	AttackerID   string
	AttackerName string
	Blocked      bool
	X            float64
	Y            float64
}

// DomainClashEvent fires when Gojo Infinite Void and Sukuna Malevolent Shrine collide cleanly.
type DomainClashEvent struct {
	GojoName   string
	SukunaName string
	X          float64
	Y          float64
}

// SkillOutcome aggregates all effects emitted from casting a hero ability.
type SkillOutcome struct {
	Hits    []HitEvent
	Punches []PunchEvent
	Clashes []DomainClashEvent
	OK      bool
}

// Engine performs server-authoritative movement, collision, and distinct hero skill simulation.
type Engine struct {
	seq uint64
}

// NewEngine creates a Game Engine instance.
func NewEngine() *Engine {
	return &Engine{}
}

// RandomBit returns an unbiased random coin flip using CSPRNG.
func (e *Engine) RandomBit() bool {
	return randUnit() >= 0.5
}

func (e *Engine) nextID(prefix string) string {
	e.seq++
	return fmt.Sprintf("%s-%d", prefix, e.seq)
}

// SpawnPosition returns a safe spawn coordinate suited for the room mode and FFA spread.
func (e *Engine) SpawnPosition(rs *state.RoomState) (float64, float64) {
	return e.SpawnPositionForTeam(rs, state.TeamFFA)
}

// SpawnPositionForTeam spawns Blue on west village/plaza gates, Red on east gates, or spread randomly in FFA.
func (e *Engine) SpawnPositionForTeam(rs *state.RoomState, team string) (float64, float64) {
	cfg := rs.Map
	margin := cfg.PlayerRadius + 70
	minX := margin
	maxX := cfg.Width - margin
	minY := margin
	maxY := cfg.Height - margin

	if state.IsTeamMatchMode(rs.Mode) {
		minY = cfg.Height * 0.25
		maxY = cfg.Height * 0.75
		if rs.Mode == state.ModeIconic {
			// Face each other directly across central Shibuya Crossing (~1100px apart) for immediate 3D perspective duel!
			minY = cfg.Height*0.5 - 110
			maxY = cfg.Height*0.5 + 110
			if team == state.TeamBlue {
				minX = 880
				maxX = 980
			} else if team == state.TeamRed {
				minX = cfg.Width - 980
				maxX = cfg.Width - 880
			}
		} else if team == state.TeamBlue {
			minX = 110
			maxX = 360
		} else if team == state.TeamRed {
			minX = cfg.Width - 360
			maxX = cfg.Width - 110
		}
	}

	usableW := math.Max(60, maxX-minX)
	usableH := math.Max(100, maxY-minY)

	var bestX, bestY float64
	bestMinDist := -1.0

	for attempt := 0; attempt < 24; attempt++ {
		rx := minX + randUnit()*usableW
		ry := minY + randUnit()*usableH
		if hitsAnyPillar(rx, ry, cfg.PlayerRadius+28, cfg) {
			continue
		}

		minDist := math.MaxFloat64
		for _, p := range rs.Players {
			if !p.Alive {
				continue
			}
			d := math.Hypot(p.X-rx, p.Y-ry)
			if d < minDist {
				minDist = d
			}
		}

		threshold := 260.0
		if state.IsTeamMatchMode(rs.Mode) {
			threshold = 90.0
		}
		if minDist >= threshold {
			return rx, ry
		}
		if minDist > bestMinDist {
			bestMinDist = minDist
			bestX, bestY = rx, ry
		}
	}

	if bestMinDist >= 0 {
		return resolveObstacles(bestX, bestY, cfg)
	}
	return resolveObstacles((minX+maxX)*0.5, (minY+maxY)*0.5, cfg)
}

func isEnemyIDTeam(rs *state.RoomState, ownerID, ownerTeam string, target *state.PlayerState) bool {
	if target == nil || !target.Alive || target.ID == ownerID {
		return false
	}
	if state.IsTeamMatchMode(rs.Mode) {
		effectiveTeam := ownerTeam
		if effectiveTeam == "" {
			if owner, ok := rs.Players[ownerID]; ok {
				effectiveTeam = owner.Team
			}
		}
		if effectiveTeam != "" && target.Team == effectiveTeam {
			return false
		}
	}
	return true
}

func isEnemy(rs *state.RoomState, attacker, target *state.PlayerState) bool {
	if attacker == nil {
		return target != nil && target.Alive
	}
	return isEnemyIDTeam(rs, attacker.ID, attacker.Team, target)
}

func randUnit() float64 {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return 0.5
	}
	v := binary.BigEndian.Uint64(buf[:]) >> 11
	return float64(v) / float64(uint64(1)<<53)
}

// StepPlayer advances one player's position authoritatively, respecting stun, throne-sit, slow, godspeed, and pillars.
func (e *Engine) StepPlayer(p *state.PlayerState, dt float64, cfg state.MapConfig, now time.Time) bool {
	if !p.Alive || now.Before(p.StunUntil) || now.Before(p.ThroneUntil) {
		return false
	}

	dx, dy := p.InputDX, p.InputDY
	if dx == 0 && dy == 0 {
		return false
	}

	mag := math.Hypot(dx, dy)
	nx, ny := dx, dy
	if mag > 1 {
		nx = dx / mag
		ny = dy / mag
	}

	charDef := state.GetCharacter(p.CharacterID)
	speed := charDef.MoveSpeed
	if speed <= 0 {
		speed = cfg.MoveSpeed
	}
	if now.Before(p.BuffUntil) {
		speed *= 1.85
	}
	if now.Before(p.SlowUntil) {
		speed *= 0.55
	}

	nextX, nextY := resolveObstacles(p.X+nx*speed*dt, p.Y+ny*speed*dt, cfg)
	changed := nextX != p.X || nextY != p.Y
	p.X = nextX
	p.Y = nextY
	return changed
}

func basicAttackRange(characterID string) float64 {
	switch characterID {
	case "pa", "ole", "default":
		return 300
	case "kaem":
		return 316
	case "ajarn_au":
		return 240
	case "ko":
		return 195
	default:
		return 175
	}
}

// CastBasicAttack executes a signature Target Lock-On normal attack unique to each of the 9 characters.
func (e *Engine) CastBasicAttack(rs *state.RoomState, caster *state.PlayerState, targetX, targetY float64, now time.Time) ([]HitEvent, bool) {
	if rs.Phase != state.PhasePlaying || !caster.Alive || now.Before(caster.StunUntil) || now.Before(caster.AttackUntil) {
		return nil, false
	}

	nx, ny, targetDist := normalizeAim(caster, targetX, targetY)
	aimRange := basicAttackRange(caster.CharacterID)
	aimX, aimY := clampTargetPoint(caster, nx, ny, targetDist, aimRange, rs.Map)
	locked := findLockOnTarget(rs, caster, aimX, aimY, aimRange)

	targetID := ""
	projLife := 0.42
	strikeRange := aimRange
	if locked != nil {
		targetID = locked.ID
		var lockedDist float64
		nx, ny, lockedDist = normalizeAim(caster, locked.X, locked.Y)
		strikeRange = math.Max(aimRange, lockedDist+22)
		projLife = 0.72
		e.addBeamVisual(rs, caster, "basic_lock_reticle", caster.X, caster.Y, locked.X, locked.Y, 10, 0.22, caster.Color, caster.AccentColor)
	}

	caster.AimDX = nx
	caster.AimDY = ny
	cd := 420 * time.Millisecond
	if now.Before(caster.RapidAttackUntil) {
		cd = 190 * time.Millisecond
	}
	caster.AttackUntil = now.Add(cd)

	px, py := -ny, nx
	switch caster.CharacterID {
	case "pa": // Gilgamesh: Twin locked golden key-swords homing onto target
		for _, side := range []float64{-16, 16} {
			pr := state.Projectile{
				Kind:        "atk_gilga_sword",
				Radius:      6.5,
				Damage:      10,
				Knockback:   14,
				TargetID:    targetID,
				HomingSpeed: 780,
				Life:        projLife,
				MaxLife:     projLife,
				Color:       "#FACC15",
				AccentColor: "#FEF08A",
			}
			e.addProjectileAt(rs, caster, pr, caster.X+nx*22+px*side, caster.Y+ny*22+py*side, nx, ny, 780)
		}
		e.addBeamVisual(rs, caster, "atk_gilga_flash", caster.X+nx*18-px*22, caster.Y+ny*18-py*22, caster.X+nx*18+px*22, caster.Y+ny*18+py*22, 12, 0.2, "#FACC15", "#FFFFFF")
		return nil, true

	case "boy": // Goku: Locked Saiyan Dragon Fist shockwave (boosted damage + speed buff from Skill 2)
		return e.fireLineBeam(rs, caster, "atk_goku_fist", nx, ny, strikeRange, 64, 28, 75, 0.24, "#F97316", "#FEF08A", now), true

	case "ole": // Itachi: Locked homing crimson kunai accompanied by black crow feather trail
		e.addProjectileFull(rs, caster, state.Projectile{
			Kind:        "atk_itachi_kunai",
			Radius:      7,
			Damage:      18,
			Knockback:   18,
			TargetID:    targetID,
			HomingSpeed: 810,
			Life:        projLife,
			MaxLife:     projLife,
			Color:       "#DC2626",
			AccentColor: "#111827",
		}, nx, ny, 810)
		return nil, true

	case "thanwa": // Zoro: Locked emerald 3-blade katana sweep snapped onto target
		hits := e.fireConeSweep(rs, caster, "atk_zoro_sweep", nx, ny, strikeRange, 1.05, 20, 42, 0.25, "#10B981", "#ECFDF5", now)
		return hits, true

	case "ajarn_au": // Killua: Locked instant cyan lightning palm bolt
		hits := e.fireLineBeam(rs, caster, "atk_killua_spark", nx, ny, strikeRange, 42, 18, 22, 0.2, "#06B6D4", "#FEF08A", now)
		return hits, true

	case "ajarn_boy": // Sukuna: Locked crimson-black X-cleave claws
		hits := e.fireLineBeam(rs, caster, "atk_sukuna_cleave", nx, ny, strikeRange, 68, 19, 34, 0.24, "#991B1B", "#FB7185", now)
		return hits, true

	case "kaem": // Rimuru: Locked homing aquamarine water blade crescent shot
		e.addProjectileFull(rs, caster, state.Projectile{
			Kind:        "atk_rimuru_water",
			Radius:      8.5,
			Damage:      18,
			Knockback:   18,
			TargetID:    targetID,
			HomingSpeed: 790,
			Life:        projLife,
			MaxLife:     projLife,
			Color:       "#38BDF8",
			AccentColor: "#E0F2FE",
		}, nx, ny, 790)
		return nil, true

	case "frame": // Joestar + Stand Cat Ai-Ouan: Locked Purple-Gold Stand Paw Claw Rush Sweep
		hits := e.fireConeSweep(rs, caster, "atk_aiouan_paw", nx, ny, strikeRange, 0.95, 19, 32, 0.23, "#A855F7", "#FACC15", now)
		return hits, true

	case "luangphi_sorn": // LuangPhi Sorn (Saitama): Locked Serious Temple Jab
		hits := e.fireLineBeam(rs, caster, "atk_sorn_jab", nx, ny, math.Max(strikeRange, 185), 54, 24, 52, 0.22, "#F59E0B", "#DC2626", now)
		return hits, true

	case "sia_mon": // Sia Mon (Gojo): Locked Six-Eyes Cursed Energy Punch
		hits := e.fireLineBeam(rs, caster, "atk_gojo_punch", nx, ny, strikeRange, 56, 19, 36, 0.22, "#38BDF8", "#A855F7", now)
		return hits, true

	case "ko": // Ko (Zenitsu): Locked Golden Thunder Breathing Nichirin Katana Flash Sweep
		hits := e.fireConeSweep(rs, caster, "atk_zenitsu_slash", nx, ny, strikeRange, 1.0, 19, 34, 0.22, "#FACC15", "#FEF08A", now)
		return hits, true

	case "noone": // Thanos (noone): Locked Heavy Infinity Gauntlet Shockwave Sweep
		hits := e.fireConeSweep(rs, caster, "atk_thanos_gauntlet", nx, ny, strikeRange, 1.02, 20, 44, 0.24, "#9333EA", "#FACC15", now)
		return hits, true

	default: // Classic Challenger: Locked homing cyan holographic energy pulse
		e.addProjectileFull(rs, caster, state.Projectile{
			Kind:        "atk_default_pulse",
			Radius:      8,
			Damage:      18,
			Knockback:   26,
			TargetID:    targetID,
			HomingSpeed: 760,
			Life:        projLife,
			MaxLife:     projLife,
			Color:       "#0284C7",
			AccentColor: "#BAE6FD",
		}, nx, ny, 760)
		return nil, true
	}
}

// CastDash performs a directional or chosen-distance dash available to ALL 9 characters, blocked cleanly by pillars.
func (e *Engine) CastDash(rs *state.RoomState, caster *state.PlayerState, targetX, targetY float64, now time.Time) bool {
	if rs.Phase != state.PhasePlaying || !caster.Alive || now.Before(caster.StunUntil) || now.Before(caster.DashUntil) {
		return false
	}

	var nx, ny float64
	dashDist := 255.0
	hasValidTarget := !math.IsNaN(targetX) && !math.IsNaN(targetY) && !math.IsInf(targetX, 0) && !math.IsInf(targetY, 0)
	if hasValidTarget && math.Hypot(targetX-caster.X, targetY-caster.Y) >= 4 {
		var dist float64
		nx, ny, dist = normalizeAim(caster, targetX, targetY)
		dashDist = clamp(dist, 90, 255)
	} else if caster.InputDX != 0 || caster.InputDY != 0 {
		mag := math.Hypot(caster.InputDX, caster.InputDY)
		nx, ny = caster.InputDX/mag, caster.InputDY/mag
	} else {
		nx, ny, _ = normalizeAim(caster, math.NaN(), math.NaN())
	}

	caster.AimDX = nx
	caster.AimDY = ny
	caster.DashUntil = now.Add(3200 * time.Millisecond)

	startX, startY := caster.X, caster.Y
	destX, destY := stepDashAvoidingPillars(startX, startY, nx, ny, dashDist, rs.Map)
	caster.X = destX
	caster.Y = destY

	e.addBeamVisual(rs, caster, "dash_afterimage", startX, startY, destX, destY, 28, 0.34, caster.Color, "#FFFFFF")
	return true
}

// CastRCT activates Reverse Cursed Technique (ไสยเวทย้อนกลับ) exclusively in Iconic mode every 5s for instant full HP heal.
func (e *Engine) CastRCT(rs *state.RoomState, caster *state.PlayerState, now time.Time) bool {
	if rs.Mode != state.ModeIconic || rs.Phase != state.PhasePlaying || !caster.Alive {
		return false
	}
	if now.Before(caster.RctUntil) {
		return false
	}
	caster.HP = caster.MaxHP
	caster.RctUntil = now.Add(5 * time.Second)
	rs.Zones = append(rs.Zones, state.ZoneEffect{
		ID:          e.nextID("zone"),
		OwnerID:     caster.ID,
		OwnerName:   caster.Name,
		OwnerTeam:   caster.Team,
		Kind:        "iconic_rct",
		X:           caster.X,
		Y:           caster.Y,
		Radius:      105,
		Color:       "#34D399",
		AccentColor: "#FEF08A",
		Life:        1.1,
		MaxLife:     1.1,
		FollowOwner: true,
	})
	return true
}

// CastSkill validates character skill ownership, stun, and cooldown, then executes the unique hero ability.
func (e *Engine) CastSkill(rs *state.RoomState, caster *state.PlayerState, slot int, targetX, targetY float64, now time.Time) ([]HitEvent, bool) {
	out := e.CastSkillFull(rs, caster, slot, targetX, targetY, "", now)
	return out.Hits, out.OK
}

// CastSkillWithTarget executes a hero skill with optional explicit enemy TargetID (used by Saitama's Lock-On Death Punch).
func (e *Engine) CastSkillWithTarget(rs *state.RoomState, caster *state.PlayerState, slot int, targetX, targetY float64, targetID string, now time.Time) ([]HitEvent, []PunchEvent, bool) {
	out := e.CastSkillFull(rs, caster, slot, targetX, targetY, targetID, now)
	return out.Hits, out.Punches, out.OK
}

// CastSkillFull executes a hero skill and returns hits, Saitama lock-on punch events, and Domain Clash events.
func (e *Engine) CastSkillFull(rs *state.RoomState, caster *state.PlayerState, slot int, targetX, targetY float64, targetID string, now time.Time) SkillOutcome {
	// In Iconic mode, opposing Domain Expansion (slot 3) can counter-activate out of enemy Infinite Void lock!
	domainCounterReady := rs.Mode == state.ModeIconic && slot == 3 && !now.Before(caster.CooldownUntil[2]) && now.Before(caster.VoidUntil)
	if rs.Phase != state.PhasePlaying || !caster.Alive || (now.Before(caster.StunUntil) && !domainCounterReady) {
		return SkillOutcome{}
	}
	if domainCounterReady {
		caster.StunUntil = time.Time{}
		caster.VoidUntil = time.Time{}
	}
	if slot < 1 || slot > 5 {
		return SkillOutcome{}
	}

	charDef := state.GetCharacter(caster.CharacterID)
	if len(charDef.Skills) < slot {
		return SkillOutcome{}
	}
	if caster.CharacterID == "noone" && !HasInfinityStone(caster, slot) {
		return SkillOutcome{}
	}
	skill := charDef.Skills[slot-1]
	idx := slot - 1
	if now.Before(caster.CooldownUntil[idx]) {
		return SkillOutcome{}
	}

	nx, ny, targetDist := normalizeAim(caster, targetX, targetY)
	caster.AimDX = nx
	caster.AimDY = ny
	caster.CooldownUntil[idx] = now.Add(time.Duration(skill.CooldownSec * float64(time.Second)))

	var hits []HitEvent
	var punches []PunchEvent
	var clashes []DomainClashEvent
	prevZones := len(rs.Zones)
	switch caster.CharacterID {
	case "pa": // Gilgamesh: 620px fan -> 640px AoE Enkidu Slow Field -> 680px Falling Sky Sword Rain AoE
		switch slot {
		case 1:
			for _, ang := range []float64{-0.32, -0.16, 0, 0.16, 0.32} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectile(rs, caster, "gate_sword", ax, ay, 580, 7, 13, 0, 12, 0, skill.CastRange/580, "#FACC15", "#FEF08A")
			}
			e.addBeamVisual(rs, caster, "gate_portal", caster.X+nx*22-ny*45, caster.Y+ny*22+nx*45, caster.X+nx*22+ny*45, caster.Y+ny*22-nx*45, 22, 0.42, "#FACC15", "#FFFFFF")
		case 2:
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "enkidu_field",
				X:             zx,
				Y:             zy,
				Radius:        155,
				Color:         "#F59E0B",
				AccentColor:   "#FEF08A",
				Life:          2.6,
				MaxLife:       2.6,
				DamagePerTick: 12,
				TickInterval:  0.65,
				SlowSec:       1.6,
			})
		case 3:
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "gilga_sword_rain",
				X:             zx,
				Y:             zy,
				Radius:        195,
				Color:         "#EAB308",
				AccentColor:   "#EF4444",
				Life:          2.4,
				MaxLife:       2.4,
				DelayLeft:     0.16,
				MaxDelay:      0.16,
				DamagePerTick: 16,
				TickInterval:  0.4,
				SlowSec:       0.6,
			})
		}

	case "boy": // Goku: 540px twin barrage -> 380px Dash Punch Small Stun (+2s Fast Attack on Hit) -> 920px Kamehameha
		switch slot {
		case 1:
			px, py := -ny, nx
			for _, off := range []float64{-14, 14} {
				pr := state.Projectile{
					ID:          e.nextID("proj"),
					OwnerID:     caster.ID,
					OwnerName:   caster.Name,
					OwnerTeam:   caster.Team,
					Kind:        "ki_blast",
					X:           caster.X + nx*26 + px*off,
					Y:           caster.Y + ny*26 + py*off,
					VX:          nx * 700,
					VY:          ny * 700,
					Radius:      8,
					Color:       "#38BDF8",
					AccentColor: "#FFFFFF",
					Damage:      14,
					Knockback:   48,
					Life:        skill.CastRange / 700,
					MaxLife:     skill.CastRange / 700,
				}
				rs.Projectiles = append(rs.Projectiles, pr)
			}
		case 2:
			startX, startY := caster.X, caster.Y
			dashDist := clamp(targetDist, 95, skill.CastRange)
			destX, destY := stepDashAvoidingPillars(startX, startY, nx, ny, dashDist, rs.Map)
			e.addBeamVisual(rs, caster, "goku_dragon_rush", startX, startY, destX, destY, 34, 0.36, "#FACC15", "#38BDF8")
			caster.X = destX
			caster.Y = destY
			impactHits, hitCount := e.applyRadialImpactCounted(rs, caster, destX, destY, 105, 30, 0.95, 72, now)
			hits = append(hits, impactHits...)
			if hitCount > 0 {
				caster.RapidAttackUntil = now.Add(2000 * time.Millisecond)
			}
		case 3:
			hits = append(hits, e.fireLineBeam(rs, caster, "kamehameha", nx, ny, skill.CastRange, 62, 72, 145, 0.62, "#0EA5E9", "#E0F2FE", now)...)
		}

	case "ole": // Itachi: 440px boomerang crows -> 460px Tsukuyomi -> 420px ground-placed Amaterasu
		switch slot {
		case 1:
			for _, ang := range []float64{-0.24, 0, 0.24} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind:        "crow_shuriken",
					Radius:      9,
					Damage:      13,
					Knockback:   8,
					Piercing:    true,
					Boomerang:   true,
					Life:        1.5,
					MaxLife:     1.5,
					Color:       "#DC2626",
					AccentColor: "#111827",
				}, ax, ay, 580)
			}
		case 2:
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "tsukuyomi",
				X:             zx,
				Y:             zy,
				Radius:        145,
				Color:         "#DC2626",
				AccentColor:   "#A855F7",
				Life:          1.6,
				MaxLife:       1.6,
				DamagePerTick: 26,
				TickInterval:  2.2,
				StunSec:       1.5,
			})
		case 3:
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "amaterasu",
				X:             zx,
				Y:             zy,
				Radius:        120,
				Color:         "#111827",
				AccentColor:   "#EF4444",
				Life:          3.8,
				MaxLife:       3.8,
				DamagePerTick: 11,
				TickInterval:  0.4,
				MoveVX:        nx * 125,
				MoveVY:        ny * 125,
			})
		}

	case "thanwa": // Zoro: 580px wide crescent -> 310px variable dash cut -> 195px cyclone pull slam
		switch slot {
		case 1:
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind:        "pound_ho",
				Radius:      26,
				Damage:      28,
				Knockback:   42,
				Piercing:    true,
				Life:        skill.CastRange / 560,
				MaxLife:     skill.CastRange / 560,
				Color:       "#10B981",
				AccentColor: "#A7F3D0",
			}, nx, ny, 560)
		case 2:
			dashDist := clamp(targetDist, 80, skill.CastRange)
			startX, startY := caster.X, caster.Y
			destX, destY := stepDashAvoidingPillars(startX, startY, nx, ny, dashDist, rs.Map)
			caster.X = destX
			caster.Y = destY
			hits = append(hits, e.fireLineFromTo(rs, caster, "shishi_sonson", startX, startY, destX, destY, 50, 42, 70, 0.52, "#10B981", "#FFFFFF", now)...)
		case 3:
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "sanzen_sekai",
				X:             caster.X,
				Y:             caster.Y,
				Radius:        195,
				Color:         "#10B981",
				AccentColor:   "#ECFDF5",
				Life:          1.15,
				MaxLife:       1.15,
				DelayLeft:     0.28,
				MaxDelay:      0.28,
				DamagePerTick: 74,
				TickInterval:  2.0,
				StunSec:       0.4,
				PullForce:     260,
				FollowOwner:   true,
			})
		}

	case "ajarn_au": // Killua: 175px Solo Whirlwind + 0.5s i-frame -> 85px Godspeed Collide Stun -> 500px Narukami
		switch slot {
		case 1:
			caster.InvulnUntil = now.Add(500 * time.Millisecond)
			hits = append(hits, e.applyRadialImpact(rs, caster, caster.X, caster.Y, 175, 28, 0.5, 55, now)...)
			e.addBeamVisual(rs, caster, "killua_solo_flash", caster.X, caster.Y, caster.X+nx*140, caster.Y+ny*140, 44, 0.32, "#22D3EE", "#FACC15")
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:          e.nextID("zone"),
				OwnerID:     caster.ID,
				OwnerName:   caster.Name,
				Kind:        "killua_solo_ring",
				X:           caster.X,
				Y:           caster.Y,
				Radius:      175,
				Color:       "#06B6D4",
				AccentColor: "#FEF08A",
				Life:        0.48,
				MaxLife:     0.48,
				FollowOwner: true,
			})
		case 2:
			caster.BuffUntil = now.Add(3500 * time.Millisecond)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "godspeed_aura",
				X:             caster.X,
				Y:             caster.Y,
				Radius:        85,
				Color:         "#06B6D4",
				AccentColor:   "#E0F2FE",
				Life:          3.5,
				MaxLife:       3.5,
				DamagePerTick: 18,
				TickInterval:  2.0,
				StunSec:       1.2,
				FollowOwner:   true,
				HitCooldowns:  make(map[string]time.Time),
			})
		case 3:
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "narukami",
				X:             zx,
				Y:             zy,
				Radius:        165,
				Color:         "#0284C7",
				AccentColor:   "#FDE047",
				Life:          1.15,
				MaxLife:       1.15,
				DelayLeft:     0.45,
				MaxDelay:      0.45,
				DamagePerTick: 54,
				TickInterval:  2.2,
				StunSec:       1.4,
			})
		}

	case "ajarn_boy": // Sukuna: 640px X-cross -> 660px Fuga arrow+pool -> 270px Seated Stationary Malevolent Shrine (Slow + Invuln on hit)
		switch slot {
		case 1:
			for _, ang := range []float64{-0.14, 0.14} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind:        "dismantle",
					Radius:      12,
					Damage:      16,
					Knockback:   14,
					Piercing:    true,
					Life:        skill.CastRange / 700,
					MaxLife:     skill.CastRange / 700,
					Color:       "#DC2626",
					AccentColor: "#FDA4AF",
				}, ax, ay, 700)
			}
		case 2:
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind:          "fuga_arrow",
				Radius:        10,
				Damage:        40,
				Knockback:     85,
				ExplodeRadius: 140,
				SpawnPoolKind: "fuga_cinder",
				Life:          skill.CastRange / 580,
				MaxLife:       skill.CastRange / 580,
				Color:         "#F97316",
				AccentColor:   "#FEF08A",
			}, nx, ny, 580)
		case 3:
			caster.ThroneUntil = now.Add(3800 * time.Millisecond)
			caster.InputDX = 0
			caster.InputDY = 0
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "malevolent_shrine",
				X:             caster.X,
				Y:             caster.Y,
				Radius:        270,
				Color:         "#991B1B",
				AccentColor:   "#FB7185",
				Life:          3.8,
				MaxLife:       3.8,
				DamagePerTick: 15,
				TickInterval:  0.26,
				SlowSec:       0.9,
			})
			if ce, hit := e.detectDomainClash(rs, caster, "infinite_void", caster.X, caster.Y); hit {
				clashes = append(clashes, ce)
			}
		}

	case "kaem": // Rimuru Tempest: 560px Black Lightning -> 540px 3-wave Black Flame -> 440px Beelzebuth Void Singularity + Self-Heal
		switch slot {
		case 1:
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "black_lightning",
				X:             zx,
				Y:             zy,
				Radius:        110,
				Color:         "#0F172A",
				AccentColor:   "#38BDF8",
				Life:          0.65,
				MaxLife:       0.65,
				DelayLeft:     0.22,
				MaxDelay:      0.22,
				DamagePerTick: 30,
				TickInterval:  2.0,
				StunSec:       0.7,
			})
		case 2:
			for _, ang := range []float64{-0.22, 0, 0.22} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind:        "black_flame_wave",
					Radius:      14,
					Damage:      16,
					Knockback:   18,
					Piercing:    true,
					Life:        skill.CastRange / 600,
					MaxLife:     skill.CastRange / 600,
					Color:       "#1E1B4B",
					AccentColor: "#38BDF8",
				}, ax, ay, 600)
			}
		case 3:
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			caster.HP = min(caster.MaxHP, caster.HP+20)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "beelzebuth",
				X:             zx,
				Y:             zy,
				Radius:        180,
				Color:         "#020617",
				AccentColor:   "#FACC15",
				Life:          1.6,
				MaxLife:       1.6,
				DelayLeft:     0.32,
				MaxDelay:      0.32,
				DamagePerTick: 18,
				TickInterval:  0.34,
				StunSec:       0.35,
				PullForce:     285,
			})
		}

	case "frame": // Joestar & Stand Cat "Ai-Ouan": 560px Lock-On Homing Pounce -> 320px ORA Meow Barrage CC -> 500px Lock-On Time-Stop Domain
		switch slot {
		case 1:
			aimX, aimY := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			locked := findLockOnTarget(rs, caster, aimX, aimY, skill.CastRange)
			targetID := ""
			life := clamp(targetDist, 90, skill.CastRange) / 760
			if locked != nil {
				targetID = locked.ID
				nx, ny, _ = normalizeAim(caster, locked.X, locked.Y)
				life = 1.6
				e.addBeamVisual(rs, caster, "aiouan_lock_beam", caster.X, caster.Y, locked.X, locked.Y, 16, 0.36, "#A855F7", "#FACC15")
			}
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind:          "aiouan_pounce",
				Radius:        14,
				Damage:        24,
				StunSec:       1.25,
				Knockback:     16,
				TargetID:      targetID,
				HomingSpeed:   760,
				ExplodeRadius: 95,
				ExplodeKind:   "aiouan_pounce_seal",
				Life:          math.Max(0.24, life),
				MaxLife:       math.Max(0.24, life),
				Color:         "#A855F7",
				AccentColor:   "#FACC15",
			}, nx, ny, 760)
		case 2:
			dist := clamp(targetDist, 120, skill.CastRange)
			zx, zy := clampTargetPoint(caster, nx, ny, dist*0.58, skill.CastRange, rs.Map)
			endX, endY := clampTargetPoint(caster, nx, ny, skill.CastRange, skill.CastRange, rs.Map)
			e.addBeamVisual(rs, caster, "aiouan_ora_rush", caster.X, caster.Y, endX, endY, 44, 0.72, "#A855F7", "#FACC15")
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "ora_meow_barrage",
				X:             zx,
				Y:             zy,
				Radius:        140,
				Color:         "#A855F7",
				AccentColor:   "#FACC15",
				Life:          0.85,
				MaxLife:       0.85,
				DamagePerTick: 8,
				TickInterval:  0.2,
				StunSec:       0.45,
				PullForce:     120,
			})
		case 3:
			aimX, aimY := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			zx, zy := aimX, aimY
			if locked := findLockOnTarget(rs, caster, aimX, aimY, skill.CastRange); locked != nil {
				zx, zy = locked.X, locked.Y
				e.addBeamVisual(rs, caster, "aiouan_lock_beam", caster.X, caster.Y, zx, zy, 22, 0.42, "#FACC15", "#A855F7")
			}
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "aiouan_timestop",
				X:             zx,
				Y:             zy,
				Radius:        210,
				Color:         "#7E22CE",
				AccentColor:   "#FACC15",
				Life:          2.1,
				MaxLife:       2.1,
				DelayLeft:     0.28,
				MaxDelay:      0.28,
				DamagePerTick: 29,
				TickInterval:  0.9,
				StunSec:       2.0,
				PullForce:     155,
			})
		}

	case "luangphi_sorn": // LuangPhi Sorn (Saitama): Single 20s Target-Select Guaranteed Kill Punch (dodged ONLY by Invulnerability)
		if slot != 1 {
			caster.CooldownUntil[idx] = time.Time{}
			return SkillOutcome{}
		}
		var target *state.PlayerState
		if targetID != "" {
			if cand, exists := rs.Players[targetID]; exists && isEnemy(rs, caster, cand) {
				target = cand
			}
		}
		if target == nil {
			aimX, aimY := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			target = findLockOnTarget(rs, caster, aimX, aimY, skill.CastRange)
		}
		if target == nil {
			caster.CooldownUntil[idx] = time.Time{}
			return SkillOutcome{}
		}

		px, py, _ := normalizeAim(caster, target.X, target.Y)
		caster.AimDX = px
		caster.AimDY = py
		e.addBeamVisual(rs, caster, "saitama_serious_punch", caster.X, caster.Y, target.X, target.Y, 96, 0.72, "#DC2626", "#FACC15")
		rs.Zones = append(rs.Zones, state.ZoneEffect{
			ID:          e.nextID("zone"),
			OwnerID:     caster.ID,
			OwnerName:   caster.Name,
			Kind:        "saitama_crater",
			X:           target.X,
			Y:           target.Y,
			Radius:      170,
			Color:       "#DC2626",
			AccentColor: "#F59E0B",
			Life:        1.35,
			MaxLife:     1.35,
		})

		if now.Before(target.InvulnUntil) {
			e.addBeamVisual(rs, caster, "saitama_dodge", target.X-50, target.Y-50, target.X+50, target.Y+50, 56, 0.45, "#FACC15", "#FFFFFF")
			punches = append(punches, PunchEvent{
				TargetID:     target.ID,
				TargetName:   target.Name,
				AttackerID:   caster.ID,
				AttackerName: caster.Name,
				Blocked:      true,
				X:            target.X,
				Y:            target.Y,
			})
		} else {
			if ev, died := e.damagePlayerCC(target, caster, caster.ID, caster.Name, target.HP+9999, 0, 0, px, py, 130, rs.Map, now); died {
				hits = append(hits, ev)
			}
			punches = append(punches, PunchEvent{
				TargetID:     target.ID,
				TargetName:   target.Name,
				AttackerID:   caster.ID,
				AttackerName: caster.Name,
				Blocked:      false,
				X:            target.X,
				Y:            target.Y,
			})
		}

	case "sia_mon": // Sia Mon (Gojo Satoru): Slow Red + Fast Blue (fuse into Hollow Purple!) + 5s Closed Infinite Void
		switch slot {
		case 1:
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind:        "gojo_red",
				Radius:      15,
				Damage:      22,
				Knockback:   68,
				Life:        3.4,
				MaxLife:     3.4,
				Color:       "#EF4444",
				AccentColor: "#FECACA",
			}, nx, ny, 245)
			e.addBeamVisual(rs, caster, "gojo_cast_red", caster.X, caster.Y, caster.X+nx*80, caster.Y+ny*80, 26, 0.25, "#EF4444", "#FFFFFF")
		case 2:
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind:        "gojo_blue",
				Radius:      14,
				Damage:      18,
				PullOnHit:   54,
				Life:        1.3,
				MaxLife:     1.3,
				Color:       "#38BDF8",
				AccentColor: "#BAE6FD",
			}, nx, ny, 920)
			e.addBeamVisual(rs, caster, "gojo_cast_blue", caster.X, caster.Y, caster.X+nx*95, caster.Y+ny*95, 24, 0.22, "#38BDF8", "#FFFFFF")
		case 3:
			const voidDuration = 5.0
			voidRadius := 265.0
			voidInitDmg := 14
			voidTickDmg := 5
			voidTickInterval := 0.95
			if rs.Mode == state.ModeIconic {
				voidRadius = 320.0
				voidInitDmg = 34
				voidTickDmg = 18
				voidTickInterval = 0.55
			}
			caster.RapidAttackUntil = now.Add(time.Duration(voidDuration * float64(time.Second)))
			e.addBeamVisual(rs, caster, "infinite_void_open", caster.X, caster.Y-280, caster.X, caster.Y, 90, 0.55, "#38BDF8", "#C084FC")
			voidEnd := now.Add(time.Duration(voidDuration * float64(time.Second)))
			trapped := make(map[string]time.Time)
			for _, p := range rs.Players {
				if !isEnemy(rs, caster, p) {
					continue
				}
				if math.Hypot(p.X-caster.X, p.Y-caster.Y) <= voidRadius+rs.Map.PlayerRadius {
					if now.Before(p.InvulnUntil) {
						continue
					}
					trapped[p.ID] = voidEnd
					if voidEnd.After(p.StunUntil) {
						p.StunUntil = voidEnd
					}
					if voidEnd.After(p.VoidUntil) {
						p.VoidUntil = voidEnd
					}
					p.InputDX = 0
					p.InputDY = 0
					if ev, died := e.damagePlayerCC(p, caster, caster.ID, caster.Name, voidInitDmg, voidDuration, 0, 0, 0, 0, rs.Map, now); died {
						hits = append(hits, ev)
					}
				}
			}
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "infinite_void",
				X:             caster.X,
				Y:             caster.Y,
				Radius:        voidRadius,
				Color:         "#1E1B4B",
				AccentColor:   "#38BDF8",
				Life:          voidDuration,
				MaxLife:       voidDuration,
				DamagePerTick: voidTickDmg,
				TickInterval:  voidTickInterval,
				NextTickIn:    voidTickInterval,
				HitCooldowns:  trapped,
			})
			if ce, hit := e.detectDomainClash(rs, caster, "malevolent_shrine", caster.X, caster.Y); hit {
				clashes = append(clashes, ce)
			}
		}

	case "ko": // Ko (Zenitsu): Dash-Heavy Thunder Breathing (Q 420px Flash Dash -> E 540px Sixfold Blitz Dash + Speed -> R 360° Around-Body Slash)
		switch slot {
		case 1:
			dashDist := clamp(targetDist, 140, skill.CastRange)
			startX, startY := caster.X, caster.Y
			destX, destY := stepDashAvoidingPillars(startX, startY, nx, ny, dashDist, rs.Map)
			caster.X = destX
			caster.Y = destY
			caster.InvulnUntil = now.Add(220 * time.Millisecond)
			hits = append(hits, e.fireLineFromTo(rs, caster, "zenitsu_hekireki", startX, startY, destX, destY, 56, 28, 36, 0.44, "#FACC15", "#FEF08A", now)...)
		case 2:
			dashDist := clamp(targetDist, 110, skill.CastRange)
			startX, startY := caster.X, caster.Y
			destX, destY := stepDashAvoidingPillars(startX, startY, nx, ny, dashDist, rs.Map)
			caster.X = destX
			caster.Y = destY
			caster.BuffUntil = now.Add(1800 * time.Millisecond)
			hits = append(hits, e.fireLineFromTo(rs, caster, "zenitsu_rokuren", startX, startY, destX, destY, 54, 22, 24, 0.50, "#F59E0B", "#7DD3FC", now)...)
			hits = append(hits, e.applyRadialImpact(rs, caster, destX, destY, 95, 18, 0.70, 48, now)...)
		case 3:
			caster.InvulnUntil = now.Add(960 * time.Millisecond)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:            e.nextID("zone"),
				OwnerID:       caster.ID,
				OwnerName:     caster.Name,
				Kind:          "zenitsu_honoo_no_kami",
				X:             caster.X,
				Y:             caster.Y,
				Radius:        245,
				Color:         "#F59E0B",
				AccentColor:   "#FEF08A",
				Life:          0.92,
				MaxLife:       0.92,
				AimAngle:      math.Atan2(ny, nx),
				DamagePerTick: 18,
				TickInterval:  0.15,
				NextTickIn:    0.01,
				SlowSec:       0.45,
			})
		}

	case "noone": // Thanos (noone): 5 Infinity Stones (Power / Space / Reality / Time / Mind) unlocked 1 at start + 1 random per kill
		switch slot {
		case 1: // Power Stone: Purple ground meteor blast + knockback + brief stun
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			hits = append(hits, e.applyRadialImpact(rs, caster, zx, zy, skill.AoeRadius, 38, 0.45, 78, now)...)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:          e.nextID("zone"),
				OwnerID:     caster.ID,
				OwnerName:   caster.Name,
				Kind:        "thanos_power_blast",
				X:           zx,
				Y:           zy,
				Radius:      skill.AoeRadius,
				Color:       "#A855F7",
				AccentColor: "#F3E8FF",
				Life:        0.58,
				MaxLife:     0.58,
			})
		case 2: // Space Stone: Blue dimensional warp blink + gravity pull vortex + stun
			zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
			startX, startY := caster.X, caster.Y
			caster.X, caster.Y = zx, zy
			e.addBeamVisual(rs, caster, "thanos_space_warp", startX, startY, zx, zy, 34, 0.36, "#3B82F6", "#BAE6FD")
			for _, p := range rs.Players {
				if !isEnemy(rs, caster, p) {
					continue
				}
				dx := zx - p.X
				dy := zy - p.Y
				d := math.Hypot(dx, dy)
				if d <= skill.AoeRadius+rs.Map.PlayerRadius {
					if d > 12 {
						p.X, p.Y = resolveObstacles(p.X+(dx/d)*math.Min(85, d*0.58), p.Y+(dy/d)*math.Min(85, d*0.58), rs.Map)
					}
					if ev, died := e.damagePlayerCC(p, caster, caster.ID, caster.Name, 26, 0.65, 0, dx, dy, 0, rs.Map, now); died {
						hits = append(hits, ev)
					}
				}
			}
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:          e.nextID("zone"),
				OwnerID:     caster.ID,
				OwnerName:   caster.Name,
				Kind:        "thanos_space_vortex",
				X:           zx,
				Y:           zy,
				Radius:      skill.AoeRadius,
				Color:       "#3B82F6",
				AccentColor: "#E0F2FE",
				Life:        0.72,
				MaxLife:     0.72,
				PullForce:   320,
			})
		case 3: // Reality Stone: 5 crimson ether shards fanning outward + heavy slow
			for _, ang := range []float64{-0.28, -0.14, 0, 0.14, 0.28} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectile(rs, caster, "thanos_reality_shard", ax, ay, 650, 10, 16, 0, 18, 2.0, skill.CastRange/650, "#EF4444", "#FECACA")
			}
			e.addBeamVisual(rs, caster, "thanos_reality_rift", caster.X, caster.Y, caster.X+nx*75, caster.Y+ny*75, 32, 0.25, "#EF4444", "#FFFFFF")
		case 4: // Time Stone: Green mandala freezing surrounding enemies + restoring HP
			if caster.HP < caster.MaxHP {
				caster.HP += 55
				if caster.HP > caster.MaxHP {
					caster.HP = caster.MaxHP
				}
			}
			caster.InvulnUntil = now.Add(350 * time.Millisecond)
			hits = append(hits, e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 22, 1.25, 0, now)...)
			rs.Zones = append(rs.Zones, state.ZoneEffect{
				ID:          e.nextID("zone"),
				OwnerID:     caster.ID,
				OwnerName:   caster.Name,
				Kind:        "thanos_time_mandala",
				X:           caster.X,
				Y:           caster.Y,
				Radius:      skill.AoeRadius,
				Color:       "#10B981",
				AccentColor: "#A7F3D0",
				Life:        1.25,
				MaxLife:     1.25,
				FollowOwner: true,
			})
		case 5: // Mind Stone: Piercing long golden psychic beam + stun
			endX := caster.X + nx*skill.CastRange
			endY := caster.Y + ny*skill.CastRange
			e.addBeamVisual(rs, caster, "thanos_mind_beam", caster.X, caster.Y, endX, endY, 44, 0.42, "#F59E0B", "#FEF08A")
			for _, p := range rs.Players {
				if !isEnemy(rs, caster, p) {
					continue
				}
				if pointToSegmentDist(p.X, p.Y, caster.X, caster.Y, endX, endY) <= skill.AoeRadius+rs.Map.PlayerRadius {
					if ev, died := e.damagePlayerCC(p, caster, caster.ID, caster.Name, 42, 0.75, 0, nx, ny, 34, rs.Map, now); died {
						hits = append(hits, ev)
					}
				}
			}
		}
	}

	for i := prevZones; i < len(rs.Zones); i++ {
		rs.Zones[i].OwnerTeam = caster.Team
	}
	return SkillOutcome{Hits: hits, Punches: punches, Clashes: clashes, OK: true}
}

// InitHeroState resets hero-specific mechanics (e.g., Thanos spawns with 1 random Infinity Stone).
func (e *Engine) InitHeroState(p *state.PlayerState) {
	if p == nil {
		return
	}
	p.SnapUntil = time.Time{}
	if p.CharacterID != "noone" {
		p.InfinityStones = nil
		return
	}
	stone := 1 + int(randUnit()*5.0)
	if stone > 5 {
		stone = 5
	}
	p.InfinityStones = []int{stone}
}

// EnsureStarterInfinityStone guarantees Thanos holds at least 1 starter Infinity Stone without wiping already-earned stones.
func (e *Engine) EnsureStarterInfinityStone(p *state.PlayerState) {
	if p == nil {
		return
	}
	if p.CharacterID != "noone" {
		p.InfinityStones = nil
		return
	}
	if len(p.InfinityStones) == 0 {
		e.InitHeroState(p)
	}
}

// HasInfinityStone reports whether Thanos has unlocked the given stone slot (1..5).
func HasInfinityStone(p *state.PlayerState, slot int) bool {
	for _, s := range p.InfinityStones {
		if s == slot {
			return true
		}
	}
	return false
}

// GrantRandomInfinityStone awards one random unowned Infinity Stone (1..5) to Thanos upon scoring a kill.
func GrantRandomInfinityStone(p *state.PlayerState) (int, bool) {
	if p == nil || p.CharacterID != "noone" {
		return 0, false
	}
	var missing []int
	for s := 1; s <= 5; s++ {
		if !HasInfinityStone(p, s) {
			missing = append(missing, s)
		}
	}
	if len(missing) == 0 {
		return 0, false
	}
	idx := int(randUnit() * float64(len(missing)))
	if idx >= len(missing) {
		idx = len(missing) - 1
	}
	chosen := missing[idx]
	p.InfinityStones = append(p.InfinityStones, chosen)
	sort.Ints(p.InfinityStones)
	return chosen, true
}

// CastInfinitySnap triggers Thanos's cosmic Snap once all 5 Infinity Stones are collected.
func (e *Engine) CastInfinitySnap(rs *state.RoomState, caster *state.PlayerState, now time.Time) (hits []HitEvent, killed int, ok bool) {
	if rs.Phase != state.PhasePlaying || !caster.Alive || now.Before(caster.StunUntil) {
		return nil, 0, false
	}
	if caster.CharacterID != "noone" || len(caster.InfinityStones) < 5 || now.Before(caster.SnapUntil) {
		return nil, 0, false
	}
	caster.SnapUntil = now.Add(10 * time.Second)
	rs.Zones = append(rs.Zones, state.ZoneEffect{
		ID:          e.nextID("zone"),
		OwnerID:     caster.ID,
		OwnerName:   caster.Name,
		OwnerTeam:   caster.Team,
		Kind:        "thanos_infinity_snap",
		X:           caster.X,
		Y:           caster.Y,
		Radius:      420,
		Color:       "#FACC15",
		AccentColor: "#A855F7",
		Life:        1.35,
		MaxLife:     1.35,
	})
	for _, target := range rs.Players {
		if !isEnemy(rs, caster, target) {
			continue
		}
		target.InvulnUntil = time.Time{}
		if ev, died := e.damagePlayerCC(target, caster, caster.ID, caster.Name, target.HP+99999, 0, 0, target.X-caster.X, target.Y-caster.Y, 0, rs.Map, now); died {
			hits = append(hits, ev)
			killed++
		}
	}
	return hits, killed, true
}

// detectDomainClash checks if an enemy has an active opposing Domain zone; if so, breaks mutual Void lock and spawns shockwave.
func (e *Engine) detectDomainClash(rs *state.RoomState, caster *state.PlayerState, opposingKind string, zx, zy float64) (DomainClashEvent, bool) {
	for _, z := range rs.Zones {
		if z.Kind != opposingKind || z.OwnerID == caster.ID || z.Life <= 0 {
			continue
		}
		if z.OwnerTeam != "" && z.OwnerTeam == caster.Team && state.IsTeamMatchMode(rs.Mode) {
			continue
		}
		midX := (zx + z.X) * 0.5
		midY := (zy + z.Y) * 0.5
		gojoName, sukunaName := caster.Name, z.OwnerName
		if opposingKind == "infinite_void" {
			gojoName, sukunaName = z.OwnerName, caster.Name
		}
		// Mutual Domain Clash breaks barrier locks cleanly so both fighters keep dueling!
		for _, p := range rs.Players {
			p.VoidUntil = time.Time{}
			p.StunUntil = time.Time{}
		}
		rs.Zones = append(rs.Zones, state.ZoneEffect{
			ID:          e.nextID("zone"),
			OwnerID:     caster.ID,
			OwnerName:   caster.Name,
			OwnerTeam:   caster.Team,
			Kind:        "domain_clash_shock",
			X:           midX,
			Y:           midY,
			Radius:      340,
			Color:       "#38BDF8",
			AccentColor: "#EF4444",
			Life:        1.05,
			MaxLife:     1.05,
		})
		return DomainClashEvent{
			GojoName:   gojoName,
			SukunaName: sukunaName,
			X:          midX,
			Y:          midY,
		}, true
	}
	return DomainClashEvent{}, false
}

func findLockOnTarget(rs *state.RoomState, caster *state.PlayerState, aimX, aimY, castRange float64) *state.PlayerState {
	var bestEnemy *state.PlayerState
	bestAimDist := math.MaxFloat64
	maxCastDist := castRange + rs.Map.PlayerRadius
	for _, p := range rs.Players {
		if !isEnemy(rs, caster, p) {
			continue
		}
		if math.Hypot(p.X-caster.X, p.Y-caster.Y) > maxCastDist {
			continue
		}
		aimDist := math.Hypot(p.X-aimX, p.Y-aimY)
		if aimDist < bestAimDist {
			bestAimDist = aimDist
			bestEnemy = p
		}
	}
	return bestEnemy
}

func findWarpStrikeDest(rs *state.RoomState, caster *state.PlayerState, nx, ny, targetDist, castRange float64) (float64, float64) {
	chosenDist := clamp(targetDist, 40, castRange)
	aimX := caster.X + nx*chosenDist
	aimY := caster.Y + ny*chosenDist
	var bestEnemy *state.PlayerState
	bestDist := 120.0
	for _, p := range rs.Players {
		if !isEnemy(rs, caster, p) {
			continue
		}
		d := math.Hypot(p.X-aimX, p.Y-aimY)
		if d < bestDist && math.Hypot(p.X-caster.X, p.Y-caster.Y) <= castRange+60 {
			bestDist = d
			bestEnemy = p
		}
	}
	if bestEnemy != nil {
		dx := bestEnemy.X - caster.X
		dy := bestEnemy.Y - caster.Y
		d := math.Max(1, math.Hypot(dx, dy))
		return resolveObstacles(bestEnemy.X+(dx/d)*44, bestEnemy.Y+(dy/d)*44, rs.Map)
	}
	return resolveObstacles(aimX, aimY, rs.Map)
}

// StepProjectiles advances active projectiles, handles Red+Blue Hollow Purple fusion, boomerangs, chains, explosions, and tethers.
func (e *Engine) StepProjectiles(rs *state.RoomState, dt float64, now time.Time) (moved bool, hits []HitEvent) {
	if len(rs.Projectiles) == 0 {
		return false, nil
	}
	moved = true

	// Advance positions first so high-speed Blue cleanly intersects slow Red in the same frame.
	for i := range rs.Projectiles {
		e.updateProjectileGuidance(rs, &rs.Projectiles[i])
		rs.Projectiles[i].X += rs.Projectiles[i].VX * dt
		rs.Projectiles[i].Y += rs.Projectiles[i].VY * dt
		rs.Projectiles[i].Life -= dt
	}

	// Detect Gojo Red + Blue collision -> balanced distance-scaled Hollow Purple explosion.
	consumed := make([]bool, len(rs.Projectiles))
	for i := range rs.Projectiles {
		if consumed[i] || rs.Projectiles[i].Kind != "gojo_red" {
			continue
		}
		for j := range rs.Projectiles {
			if i == j || consumed[j] || rs.Projectiles[j].Kind != "gojo_blue" {
				continue
			}
			a := rs.Projectiles[i]
			b := rs.Projectiles[j]
			if a.OwnerID != b.OwnerID {
				continue
			}
			if math.Hypot(a.X-b.X, a.Y-b.Y) <= 66 {
				consumed[i] = true
				consumed[j] = true
				fx, fy := (a.X+b.X)*0.5, (a.Y+b.Y)*0.5
				hits = append(hits, e.triggerHollowPurple(rs, a.OwnerID, a.OwnerTeam, a.OwnerName, fx, fy, now)...)
				break
			}
		}
	}

	kept := rs.Projectiles[:0]
	for i := range rs.Projectiles {
		if consumed[i] {
			continue
		}
		pr := rs.Projectiles[i]

		outOfBounds := pr.Life <= 0 || pr.X < 0 || pr.X > rs.Map.Width || pr.Y < 0 || pr.Y > rs.Map.Height
		hitPillar := !pr.Boomerang && pr.TargetID == "" && hitsAnyPillar(pr.X, pr.Y, pr.Radius, rs.Map)
		if outOfBounds || hitPillar {
			if pr.ExplodeRadius > 0 {
				hits = append(hits, e.triggerExplosion(rs, pr, now)...)
			}
			continue
		}

		var stopped bool
		hits, stopped = e.checkProjectilePlayerHits(rs, &pr, now, hits)
		if !stopped {
			kept = append(kept, pr)
		}
	}
	for j := len(kept); j < len(rs.Projectiles); j++ {
		rs.Projectiles[j] = state.Projectile{}
	}
	rs.Projectiles = kept
	return moved, hits
}

func (e *Engine) triggerHollowPurple(rs *state.RoomState, ownerID, ownerTeam, ownerName string, fx, fy float64, now time.Time) []HitEvent {
	const purpleRadius = 270.0
	owner := rs.Players[ownerID]
	e.addBeamVisual(rs, owner, "hollow_purple_blast", fx-purpleRadius*0.85, fy, fx+purpleRadius*0.85, fy, 74, 0.55, "#9333EA", "#F0ABFC")
	rs.Zones = append(rs.Zones, state.ZoneEffect{
		ID:          e.nextID("zone"),
		OwnerID:     ownerID,
		OwnerName:   ownerName,
		OwnerTeam:   ownerTeam,
		Kind:        "hollow_purple",
		X:           fx,
		Y:           fy,
		Radius:      purpleRadius,
		Color:       "#9333EA",
		AccentColor: "#F0ABFC",
		Life:        1.05,
		MaxLife:     1.05,
	})

	var hits []HitEvent
	for _, p := range rs.Players {
		if !isEnemyIDTeam(rs, ownerID, ownerTeam, p) {
			continue
		}
		distToCenter := math.Hypot(p.X-fx, p.Y-fy)
		if distToCenter > purpleRadius+rs.Map.PlayerRadius {
			continue
		}
		// Balanced distance falloff: closer to collision point hits harder (26 rim -> 64 center).
		effectiveDist := math.Max(0, distToCenter-rs.Map.PlayerRadius)
		prox := 1.0 - clamp(effectiveDist/purpleRadius, 0, 1)
		dmg := 26 + int(math.Round(38.0*prox))
		stunSec := 0.25 + 0.40*prox
		knockback := 25.0 + 80.0*prox
		if ev, died := e.damagePlayerCC(p, owner, ownerID, ownerName, dmg, stunSec, 0.8, p.X-fx, p.Y-fy, knockback, rs.Map, now); died {
			hits = append(hits, ev)
		}
	}
	return hits
}

func (e *Engine) updateProjectileGuidance(rs *state.RoomState, pr *state.Projectile) {
	if pr.TargetID != "" && pr.HomingSpeed > 0 {
		if target, ok := rs.Players[pr.TargetID]; ok && target.Alive {
			dx := target.X - pr.X
			dy := target.Y - pr.Y
			if d := math.Hypot(dx, dy); d > 1 {
				pr.VX = (dx / d) * pr.HomingSpeed
				pr.VY = (dy / d) * pr.HomingSpeed
			}
			return
		}
	}
	if !pr.Boomerang || pr.MaxLife <= 0 {
		return
	}
	if !pr.Returned && pr.Life <= pr.MaxLife*0.52 {
		pr.Returned = true
		pr.HitTargets = make(map[string]bool)
		pr.VX = -pr.VX
		pr.VY = -pr.VY
	}
	if pr.Returned {
		if owner, ok := rs.Players[pr.OwnerID]; ok {
			spd := math.Max(300, math.Hypot(pr.VX, pr.VY))
			dx := owner.X - pr.X
			dy := owner.Y - pr.Y
			d := math.Hypot(dx, dy)
			if d > 12 {
				pr.VX = (dx / d) * spd
				pr.VY = (dy / d) * spd
			}
		}
	}
}

func (e *Engine) checkProjectilePlayerHits(rs *state.RoomState, pr *state.Projectile, now time.Time, hits []HitEvent) ([]HitEvent, bool) {
	owner := rs.Players[pr.OwnerID]
	for _, p := range rs.Players {
		if !isEnemyIDTeam(rs, pr.OwnerID, pr.OwnerTeam, p) {
			continue
		}
		if pr.HitTargets != nil && pr.HitTargets[p.ID] {
			continue
		}
		if math.Hypot(p.X-pr.X, p.Y-pr.Y) > rs.Map.PlayerRadius+pr.Radius {
			continue
		}

		if pr.ExplodeRadius > 0 {
			hits = append(hits, e.triggerExplosion(rs, *pr, now)...)
			return hits, true
		}

		if pr.HitTargets == nil {
			pr.HitTargets = make(map[string]bool)
		}
		pr.HitTargets[p.ID] = true

		if ev, died := e.damagePlayer(p, owner, pr.OwnerID, pr.OwnerName, pr.Damage, pr.StunSec, pr.VX, pr.VY, pr.Knockback, rs.Map, now); died {
			hits = append(hits, ev)
		}

		if pr.PullOnHit > 0 && owner != nil {
			dx := owner.X - p.X
			dy := owner.Y - p.Y
			if d := math.Hypot(dx, dy); d > 1 {
				p.X, p.Y = resolveObstacles(p.X+(dx/d)*pr.PullOnHit, p.Y+(dy/d)*pr.PullOnHit, rs.Map)
				e.addBeamVisual(rs, owner, "enkidu_tether", owner.X, owner.Y, p.X, p.Y, 10, 0.9, "#F59E0B", "#FEF08A")
			}
		}

		if pr.ChainLeft > 0 {
			hits = append(hits, e.applyChainBounces(rs, pr, owner, p, pr.ChainLeft, now)...)
		}

		if !pr.Piercing {
			return hits, true
		}
	}
	return hits, false
}

func (e *Engine) applyChainBounces(rs *state.RoomState, pr *state.Projectile, owner, first *state.PlayerState, bounces int, now time.Time) []HitEvent {
	var hits []HitEvent
	curr := first
	visited := map[string]bool{pr.OwnerID: true, first.ID: true}
	dmg := int(float64(pr.Damage) * 0.85)

	for step := 0; step < bounces; step++ {
		var next *state.PlayerState
		bestDist := pr.ChainRadius
		for _, cand := range rs.Players {
			if visited[cand.ID] || !isEnemyIDTeam(rs, pr.OwnerID, pr.OwnerTeam, cand) {
				continue
			}
			d := math.Hypot(cand.X-curr.X, cand.Y-curr.Y)
			if d <= bestDist {
				bestDist = d
				next = cand
			}
		}
		if next == nil {
			break
		}
		visited[next.ID] = true
		e.addBeamVisual(rs, owner, "lightning_arc", curr.X, curr.Y, next.X, next.Y, 12, 0.32, pr.Color, "#FFFFFF")
		if ev, died := e.damagePlayer(next, owner, pr.OwnerID, pr.OwnerName, dmg, 0.3, 0, 0, 0, rs.Map, now); died {
			hits = append(hits, ev)
		}
		curr = next
	}
	return hits
}

// StepZones advances active AoE zones, delayed sky strikes, vortex pulls, moving flames, and ticks.
func (e *Engine) StepZones(rs *state.RoomState, dt float64, now time.Time) (changed bool, hits []HitEvent) {
	if len(rs.Zones) == 0 {
		return false, nil
	}
	changed = true

	kept := rs.Zones[:0]
	var extraZones []state.ZoneEffect
	for _, z := range rs.Zones {
		z.Life -= dt
		if z.Life <= 0 {
			continue
		}
		if z.FollowOwner {
			if owner, ok := rs.Players[z.OwnerID]; ok && owner.Alive {
				z.X = owner.X
				z.Y = owner.Y
			}
		} else if z.MoveVX != 0 || z.MoveVY != 0 {
			z.X = clamp(z.X+z.MoveVX*dt, z.Radius, rs.Map.Width-z.Radius)
			z.Y = clamp(z.Y+z.MoveVY*dt, z.Radius, rs.Map.Height-z.Radius)
		}

		if z.PullForce > 0 {
			e.applyZonePull(rs, &z, dt)
		}

		if z.DelayLeft > 0 {
			z.DelayLeft -= dt
			if z.DelayLeft <= 0 {
				z.DelayLeft = 0
				z.NextTickIn = 0
				owner := rs.Players[z.OwnerID]
				if z.Kind == "narukami" {
					e.addBeamVisual(rs, owner, "narukami_strike", z.X, z.Y-480, z.X, z.Y, 44, 0.45, z.Color, z.AccentColor)
					// Schedule Step 2: 6-way radial lightning burst (lighter secondary damage)
					extraZones = append(extraZones, state.ZoneEffect{
						ID:          e.nextID("zone"),
						OwnerID:     z.OwnerID,
						OwnerName:   z.OwnerName,
						OwnerTeam:   z.OwnerTeam,
						Kind:        "narukami_step2",
						X:           z.X,
						Y:           z.Y,
						Radius:      115,
						Color:       "#22D3EE",
						AccentColor: "#FACC15",
						Life:        0.55,
						MaxLife:     0.55,
						DelayLeft:   0.34,
						MaxDelay:    0.34,
					})
				} else if z.Kind == "narukami_step2" {
					for k := 0; k < 6; k++ {
						ang := float64(k) * (math.Pi / 3)
						dx, dy := math.Cos(ang), math.Sin(ang)
						e.addBeamVisual(rs, owner, "narukami_radial_beam", z.X, z.Y, z.X+dx*240, z.Y+dy*240, 26, 0.34, "#22D3EE", "#FEF08A")
						rs.Projectiles = append(rs.Projectiles, state.Projectile{
							ID:          e.nextID("proj"),
							OwnerID:     z.OwnerID,
							OwnerName:   z.OwnerName,
							OwnerTeam:   z.OwnerTeam,
							Kind:        "narukami_bolt",
							X:           clamp(z.X+dx*18, 0, rs.Map.Width),
							Y:           clamp(z.Y+dy*18, 0, rs.Map.Height),
							VX:          dx * 760,
							VY:          dy * 760,
							Radius:      11,
							Color:       "#22D3EE",
							AccentColor: "#FEF08A",
							Damage:      16,
							StunSec:     0.35,
							Piercing:    true,
							Life:        0.34,
							MaxLife:     0.34,
						})
					}
				} else if z.Kind == "thunder_slam" {
					e.addBeamVisual(rs, owner, "thunder_slam_burst", z.X, z.Y-110, z.X, z.Y, 32, 0.28, z.Color, z.AccentColor)
				} else if z.Kind == "black_lightning" {
					e.addBeamVisual(rs, owner, "black_lightning_strike", z.X, z.Y-420, z.X, z.Y, 38, 0.42, "#0F172A", "#38BDF8")
				} else if z.Kind == "aiouan_timestop" {
					e.addBeamVisual(rs, owner, "aiouan_timestop_burst", z.X, z.Y-380, z.X, z.Y, 56, 0.45, "#FACC15", "#A855F7")
				}
			}
			kept = append(kept, z)
			continue
		}

		if z.Kind == "godspeed_aura" {
			owner := rs.Players[z.OwnerID]
			for _, p := range rs.Players {
				if !isEnemyIDTeam(rs, z.OwnerID, z.OwnerTeam, p) {
					continue
				}
				if math.Hypot(p.X-z.X, p.Y-z.Y) <= z.Radius+rs.Map.PlayerRadius {
					if z.HitCooldowns != nil && now.Before(z.HitCooldowns[p.ID]) {
						continue
					}
					if z.HitCooldowns == nil {
						z.HitCooldowns = make(map[string]time.Time)
					}
					z.HitCooldowns[p.ID] = now.Add(2200 * time.Millisecond)
					if ev, died := e.damagePlayerCC(p, owner, z.OwnerID, z.OwnerName, z.DamagePerTick, z.StunSec, 0, p.X-z.X, p.Y-z.Y, 36, rs.Map, now); died {
						hits = append(hits, ev)
					}
					e.addBeamVisual(rs, owner, "godspeed_collide", z.X, z.Y, p.X, p.Y, 26, 0.3, "#22D3EE", "#FEF08A")
				}
			}
		} else if z.DamagePerTick > 0 {
			z.NextTickIn -= dt
			if z.NextTickIn <= 0 {
				z.NextTickIn = z.TickInterval
				owner := rs.Players[z.OwnerID]
				kb := 0.0
				if z.Kind == "thunder_slam" {
					kb = 68
				}
				if z.Kind == "gilga_sword_rain" {
					for k := 0; k < 3; k++ {
						ang := (randUnit() * math.Pi * 2)
						dist := randUnit() * z.Radius * 0.78
						sx := clamp(z.X+math.Cos(ang)*dist, 20, rs.Map.Width-20)
						sy := clamp(z.Y+math.Sin(ang)*dist, 20, rs.Map.Height-20)
						e.addBeamVisual(rs, owner, "gilga_sky_sword", sx-22, sy-360, sx, sy, 22, 0.36, "#FACC15", "#EF4444")
					}
				} else if z.Kind == "zenitsu_honoo_no_kami" {
					if z.StepCount < 5 {
						step := z.StepCount
						z.StepCount++
						v1Idx := (step * 2) % 5
						v2Idx := ((step + 1) * 2) % 5
						ang1 := z.AimAngle + float64(v1Idx)*(2.0*math.Pi/5.0)
						ang2 := z.AimAngle + float64(v2Idx)*(2.0*math.Pi/5.0)
						x1 := clamp(z.X+math.Cos(ang1)*z.Radius, 10, rs.Map.Width-10)
						y1 := clamp(z.Y+math.Sin(ang1)*z.Radius, 10, rs.Map.Height-10)
						x2 := clamp(z.X+math.Cos(ang2)*z.Radius, 10, rs.Map.Width-10)
						y2 := clamp(z.Y+math.Sin(ang2)*z.Radius, 10, rs.Map.Height-10)
						e.addBeamVisual(rs, owner, "zenitsu_murad_slash", x1, y1, x2, y2, 42, 0.72, "#FACC15", "#7DD3FC")

						hitRadius := 58.0 + rs.Map.PlayerRadius
						for _, p := range rs.Players {
							if !isEnemyIDTeam(rs, z.OwnerID, z.OwnerTeam, p) || now.Before(p.InvulnUntil) {
								continue
							}
							if pointToSegmentDist(p.X, p.Y, x1, y1, x2, y2) <= hitRadius {
								if ev, died := e.damagePlayerCC(p, owner, z.OwnerID, z.OwnerName, z.DamagePerTick, 0, z.SlowSec, x2-x1, y2-y1, 10, rs.Map, now); died {
									hits = append(hits, ev)
								}
							}
						}
					}
					kept = append(kept, z)
					continue
				}
				hitAny := false
				for _, p := range rs.Players {
					if !isEnemyIDTeam(rs, z.OwnerID, z.OwnerTeam, p) {
						continue
					}
					if math.Hypot(p.X-z.X, p.Y-z.Y) <= z.Radius+rs.Map.PlayerRadius {
						if now.Before(p.InvulnUntil) {
							continue
						}
						hitAny = true
						if ev, died := e.damagePlayerCC(p, owner, z.OwnerID, z.OwnerName, z.DamagePerTick, z.StunSec, z.SlowSec, p.X-z.X, p.Y-z.Y, kb, rs.Map, now); died {
							hits = append(hits, ev)
						}
					}
				}
				if z.Kind == "malevolent_shrine" && hitAny && owner != nil && owner.Alive {
					owner.InvulnUntil = now.Add(420 * time.Millisecond)
				}
				if z.Kind == "infinite_void" {
					domainEnd := now.Add(time.Duration(z.Life * float64(time.Second)))
					if owner != nil && owner.Alive && math.Hypot(owner.X-z.X, owner.Y-z.Y) <= z.Radius+rs.Map.PlayerRadius {
						if boostEnd := now.Add(1100 * time.Millisecond); boostEnd.After(owner.RapidAttackUntil) {
							owner.RapidAttackUntil = boostEnd
						}
					}
					for _, p := range rs.Players {
						if !isEnemyIDTeam(rs, z.OwnerID, z.OwnerTeam, p) {
							continue
						}
						if z.HitCooldowns == nil {
							z.HitCooldowns = make(map[string]time.Time)
						}
						if z.HitCooldowns[p.ID].IsZero() && math.Hypot(p.X-z.X, p.Y-z.Y) <= z.Radius+rs.Map.PlayerRadius {
							if now.Before(p.InvulnUntil) {
								continue
							}
							z.HitCooldowns[p.ID] = domainEnd
							if domainEnd.After(p.StunUntil) {
								p.StunUntil = domainEnd
							}
							if domainEnd.After(p.VoidUntil) {
								p.VoidUntil = domainEnd
							}
						}
					}
				}
			}
		}
		kept = append(kept, z)
	}
	for j := len(kept); j < len(rs.Zones); j++ {
		rs.Zones[j] = state.ZoneEffect{}
	}
	rs.Zones = append(kept, extraZones...)
	return changed, hits
}

func (e *Engine) applyZonePull(rs *state.RoomState, z *state.ZoneEffect, dt float64) {
	for _, p := range rs.Players {
		if !isEnemyIDTeam(rs, z.OwnerID, z.OwnerTeam, p) {
			continue
		}
		dx := z.X - p.X
		dy := z.Y - p.Y
		d := math.Hypot(dx, dy)
		if d > 24 && d <= z.Radius+rs.Map.PlayerRadius {
			pull := z.PullForce * dt
			p.X, p.Y = resolveObstacles(p.X+(dx/d)*pull, p.Y+(dy/d)*pull, rs.Map)
		}
	}
}

// StepBeams decays short-lived beam visuals.
func (e *Engine) StepBeams(rs *state.RoomState, dt float64) bool {
	if len(rs.Beams) == 0 {
		return false
	}
	kept := rs.Beams[:0]
	for _, b := range rs.Beams {
		b.Life -= dt
		if b.Life > 0 {
			kept = append(kept, b)
		}
	}
	for j := len(kept); j < len(rs.Beams); j++ {
		rs.Beams[j] = state.BeamEffect{}
	}
	rs.Beams = kept
	return true
}

func (e *Engine) triggerExplosion(rs *state.RoomState, pr state.Projectile, now time.Time) []HitEvent {
	explodeKind := pr.ExplodeKind
	if explodeKind == "" {
		explodeKind = "fuga_explosion"
	}
	rs.Zones = append(rs.Zones, state.ZoneEffect{
		ID:          e.nextID("zone"),
		OwnerID:     pr.OwnerID,
		OwnerName:   pr.OwnerName,
		OwnerTeam:   pr.OwnerTeam,
		Kind:        explodeKind,
		X:           pr.X,
		Y:           pr.Y,
		Radius:      pr.ExplodeRadius,
		Color:       pr.Color,
		AccentColor: pr.AccentColor,
		Life:        0.52,
		MaxLife:     0.52,
	})
	if pr.SpawnPoolKind != "" {
		rs.Zones = append(rs.Zones, state.ZoneEffect{
			ID:            e.nextID("zone"),
			OwnerID:       pr.OwnerID,
			OwnerName:     pr.OwnerName,
			OwnerTeam:     pr.OwnerTeam,
			Kind:          pr.SpawnPoolKind,
			X:             pr.X,
			Y:             pr.Y,
			Radius:        pr.ExplodeRadius * 0.85,
			Color:         "#EA580C",
			AccentColor:   "#FDE047",
			Life:          2.0,
			MaxLife:       2.0,
			DamagePerTick: 8,
			TickInterval:  0.4,
			NextTickIn:    0.35,
		})
	}
	owner := rs.Players[pr.OwnerID]
	var hits []HitEvent
	for _, p := range rs.Players {
		if !isEnemyIDTeam(rs, pr.OwnerID, pr.OwnerTeam, p) {
			continue
		}
		if math.Hypot(p.X-pr.X, p.Y-pr.Y) <= pr.ExplodeRadius+rs.Map.PlayerRadius {
			if ev, died := e.damagePlayer(p, owner, pr.OwnerID, pr.OwnerName, pr.Damage, pr.StunSec, p.X-pr.X, p.Y-pr.Y, pr.Knockback, rs.Map, now); died {
				hits = append(hits, ev)
			}
		}
	}
	return hits
}

func (e *Engine) addProjectile(rs *state.RoomState, caster *state.PlayerState, kind string, nx, ny, speed, radius float64, dmg int, stunSec, knockback, explodeRadius, life float64, color, accent string) {
	e.addProjectileFull(rs, caster, state.Projectile{
		Kind:          kind,
		Radius:        radius,
		Damage:        dmg,
		StunSec:       stunSec,
		Knockback:     knockback,
		ExplodeRadius: explodeRadius,
		Life:          life,
		MaxLife:       life,
		Color:         color,
		AccentColor:   accent,
	}, nx, ny, speed)
}

func (e *Engine) addProjectileFull(rs *state.RoomState, caster *state.PlayerState, pr state.Projectile, nx, ny, speed float64) {
	offset := rs.Map.PlayerRadius + pr.Radius + 4
	e.addProjectileAt(rs, caster, pr, caster.X+nx*offset, caster.Y+ny*offset, nx, ny, speed)
}

func (e *Engine) addProjectileAt(rs *state.RoomState, caster *state.PlayerState, pr state.Projectile, sx, sy, nx, ny, speed float64) {
	pr.ID = e.nextID("proj")
	pr.OwnerID = caster.ID
	pr.OwnerName = caster.Name
	pr.OwnerTeam = caster.Team
	pr.X = sx
	pr.Y = sy
	pr.VX = nx * speed
	pr.VY = ny * speed
	rs.Projectiles = append(rs.Projectiles, pr)
}

func (e *Engine) fireConeSweep(rs *state.RoomState, caster *state.PlayerState, kind string, nx, ny, radius, halfAngleRad float64, dmg int, knockback, life float64, color, accent string, now time.Time) []HitEvent {
	endX := clamp(caster.X+nx*radius, 0, rs.Map.Width)
	endY := clamp(caster.Y+ny*radius, 0, rs.Map.Height)
	e.addBeamVisual(rs, caster, kind, caster.X, caster.Y, endX, endY, radius*0.65, life, color, accent)
	var hits []HitEvent
	minDot := math.Cos(halfAngleRad)
	for _, p := range rs.Players {
		if !isEnemy(rs, caster, p) {
			continue
		}
		dx := p.X - caster.X
		dy := p.Y - caster.Y
		d := math.Hypot(dx, dy)
		if d > radius+rs.Map.PlayerRadius {
			continue
		}
		if d < 1 || (dx/d)*nx+(dy/d)*ny >= minDot {
			if ev, died := e.damagePlayer(p, caster, caster.ID, caster.Name, dmg, 0, dx, dy, knockback, rs.Map, now); died {
				hits = append(hits, ev)
			}
		}
	}
	return hits
}

func (e *Engine) addBeamVisual(rs *state.RoomState, caster *state.PlayerState, kind string, x1, y1, x2, y2, width, life float64, color, accent string) {
	ownerID := ""
	if caster != nil {
		ownerID = caster.ID
	}
	rs.Beams = append(rs.Beams, state.BeamEffect{
		ID:          e.nextID("beam"),
		OwnerID:     ownerID,
		Kind:        kind,
		X1:          x1,
		Y1:          y1,
		X2:          x2,
		Y2:          y2,
		Width:       width,
		Color:       color,
		AccentColor: accent,
		Life:        life,
		MaxLife:     life,
	})
}

func (e *Engine) fireLineBeam(rs *state.RoomState, caster *state.PlayerState, kind string, nx, ny, length, width float64, dmg int, knockback, life float64, color, accent string, now time.Time) []HitEvent {
	startX := caster.X + nx*(rs.Map.PlayerRadius+4)
	startY := caster.Y + ny*(rs.Map.PlayerRadius+4)
	endX := clamp(startX+nx*length, 0, rs.Map.Width)
	endY := clamp(startY+ny*length, 0, rs.Map.Height)
	return e.fireLineFromTo(rs, caster, kind, startX, startY, endX, endY, width, dmg, knockback, life, color, accent, now)
}

func (e *Engine) fireLineFromTo(rs *state.RoomState, caster *state.PlayerState, kind string, x1, y1, x2, y2, width float64, dmg int, knockback, life float64, color, accent string, now time.Time) []HitEvent {
	e.addBeamVisual(rs, caster, kind, x1, y1, x2, y2, width, life, color, accent)
	var hits []HitEvent
	hitRadius := width/2 + rs.Map.PlayerRadius
	dirX := x2 - x1
	dirY := y2 - y1

	for _, p := range rs.Players {
		if !isEnemy(rs, caster, p) {
			continue
		}
		if pointToSegmentDist(p.X, p.Y, x1, y1, x2, y2) <= hitRadius {
			if ev, died := e.damagePlayer(p, caster, caster.ID, caster.Name, dmg, 0, dirX, dirY, knockback, rs.Map, now); died {
				hits = append(hits, ev)
			}
		}
	}
	return hits
}

func (e *Engine) applyRadialImpact(rs *state.RoomState, caster *state.PlayerState, cx, cy, radius float64, dmg int, stunSec, knockback float64, now time.Time) []HitEvent {
	hits, _ := e.applyRadialImpactCounted(rs, caster, cx, cy, radius, dmg, stunSec, knockback, now)
	return hits
}

func (e *Engine) applyRadialImpactCounted(rs *state.RoomState, caster *state.PlayerState, cx, cy, radius float64, dmg int, stunSec, knockback float64, now time.Time) ([]HitEvent, int) {
	var hits []HitEvent
	hitCount := 0
	for _, p := range rs.Players {
		if !isEnemy(rs, caster, p) {
			continue
		}
		if math.Hypot(p.X-cx, p.Y-cy) <= radius+rs.Map.PlayerRadius {
			if now.Before(p.InvulnUntil) {
				continue
			}
			hitCount++
			if ev, died := e.damagePlayerCC(p, caster, caster.ID, caster.Name, dmg, stunSec, 0, p.X-cx, p.Y-cy, knockback, rs.Map, now); died {
				hits = append(hits, ev)
			}
		}
	}
	return hits, hitCount
}

func (e *Engine) damagePlayer(
	victim *state.PlayerState,
	killer *state.PlayerState,
	killerID string,
	killerName string,
	dmg int,
	stunSec float64,
	pushDX float64,
	pushDY float64,
	knockback float64,
	cfg state.MapConfig,
	now time.Time,
) (HitEvent, bool) {
	return e.damagePlayerCC(victim, killer, killerID, killerName, dmg, stunSec, 0, pushDX, pushDY, knockback, cfg, now)
}

func (e *Engine) damagePlayerCC(
	victim *state.PlayerState,
	killer *state.PlayerState,
	killerID string,
	killerName string,
	dmg int,
	stunSec float64,
	slowSec float64,
	pushDX float64,
	pushDY float64,
	knockback float64,
	cfg state.MapConfig,
	now time.Time,
) (HitEvent, bool) {
	if !victim.Alive || now.Before(victim.InvulnUntil) {
		return HitEvent{}, false
	}
	victim.HP -= dmg
	if stunSec > 0 {
		until := now.Add(time.Duration(stunSec * float64(time.Second)))
		if until.After(victim.StunUntil) {
			victim.StunUntil = until
		}
	}
	if slowSec > 0 {
		until := now.Add(time.Duration(slowSec * float64(time.Second)))
		if until.After(victim.SlowUntil) {
			victim.SlowUntil = until
		}
	}
	if knockback > 0 {
		mag := math.Hypot(pushDX, pushDY)
		if mag > 0.01 {
			victim.X, victim.Y = resolveObstacles(victim.X+(pushDX/mag)*knockback, victim.Y+(pushDY/mag)*knockback, cfg)
		}
	}
	if victim.HP <= 0 {
		victim.HP = 0
		victim.Alive = false
		victim.InputDX = 0
		victim.InputDY = 0
		victim.KilledBy = killerName
		if victim.CharacterID == "noone" {
			victim.InfinityStones = nil
			victim.SnapUntil = time.Time{}
		}
		if killer != nil {
			killer.Kills++
			if killer.CharacterID == "noone" {
				GrantRandomInfinityStone(killer)
			}
		}
		return HitEvent{
			VictimID:   victim.ID,
			VictimName: victim.Name,
			KillerID:   killerID,
			KillerName: killerName,
			X:          victim.X,
			Y:          victim.Y,
		}, true
	}
	return HitEvent{}, false
}

func normalizeAim(p *state.PlayerState, targetX, targetY float64) (nx, ny, dist float64) {
	fallbackX, fallbackY := 1.0, 0.0
	if p.AimDX != 0 || p.AimDY != 0 {
		m := math.Hypot(p.AimDX, p.AimDY)
		fallbackX, fallbackY = p.AimDX/m, p.AimDY/m
	}
	if !math.IsNaN(targetX) && !math.IsNaN(targetY) && !math.IsInf(targetX, 0) && !math.IsInf(targetY, 0) {
		dx := targetX - p.X
		dy := targetY - p.Y
		d := math.Hypot(dx, dy)
		if d >= 1 {
			return dx / d, dy / d, d
		}
		// Exact or sub-pixel placement at caster's own feet must preserve dist=0 rather than jumping 220px.
		return fallbackX, fallbackY, 0
	}
	return fallbackX, fallbackY, 220
}

func clampTargetPoint(p *state.PlayerState, nx, ny, dist, maxRange float64, cfg state.MapConfig) (float64, float64) {
	d := math.Min(dist, maxRange)
	return clamp(p.X+nx*d, 20, cfg.Width-20), clamp(p.Y+ny*d, 20, cfg.Height-20)
}

func rotateVec(x, y, rad float64) (float64, float64) {
	c := math.Cos(rad)
	s := math.Sin(rad)
	return x*c - y*s, x*s + y*c
}

func stepDashAvoidingPillars(x, y, nx, ny, dist float64, cfg state.MapConfig) (float64, float64) {
	steps := 8
	stepDist := dist / float64(steps)
	cx, cy := x, y
	for i := 0; i < steps; i++ {
		cx, cy = resolveObstacles(cx+nx*stepDist, cy+ny*stepDist, cfg)
	}
	return cx, cy
}

func resolveObstacles(x, y float64, cfg state.MapConfig) (float64, float64) {
	x = clamp(x, cfg.PlayerRadius, cfg.Width-cfg.PlayerRadius)
	y = clamp(y, cfg.PlayerRadius, cfg.Height-cfg.PlayerRadius)
	for _, pil := range cfg.Pillars {
		dx := x - pil.X
		dy := y - pil.Y
		minDist := cfg.PlayerRadius + pil.Radius
		d := math.Hypot(dx, dy)
		if d < minDist {
			if d < 0.001 {
				dx, dy, d = 1, 0, 1
			}
			x = pil.X + (dx/d)*minDist
			y = pil.Y + (dy/d)*minDist
		}
	}
	x = clamp(x, cfg.PlayerRadius, cfg.Width-cfg.PlayerRadius)
	y = clamp(y, cfg.PlayerRadius, cfg.Height-cfg.PlayerRadius)
	return x, y
}

func hitsAnyPillar(x, y, radius float64, cfg state.MapConfig) bool {
	for _, pil := range cfg.Pillars {
		if math.Hypot(x-pil.X, y-pil.Y) <= pil.Radius+radius {
			return true
		}
	}
	return false
}

func pointToSegmentDist(px, py, x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	lenSq := dx*dx + dy*dy
	if lenSq < 0.0001 {
		return math.Hypot(px-x1, py-y1)
	}
	t := clamp(((px-x1)*dx+(py-y1)*dy)/lenSq, 0, 1)
	projX := x1 + t*dx
	projY := y1 + t*dy
	return math.Hypot(px-projX, py-projY)
}

func clamp(v, minV, maxV float64) float64 {
	if v < minV {
		return minV
	}
	if v > maxV {
		return maxV
	}
	return v
}
