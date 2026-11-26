package engine

import (
	"math"
	"time"

	"go-backend/internal/modules/state"
)

type rosterBasicSpec struct {
	atkRange  float64
	mode      string // "proj" | "beam" | "cone"
	kind      string
	damage    int
	knockback float64
	widthOrA  float64 // beam width or cone half-angle rad or proj speed
	color     string
	accent    string
}

var roster28BasicSpecs = map[string]rosterBasicSpec{
	"gray":          {260, "proj", "gray_basic_shard", 19, 22, 810, "#38BDF8", "#E0F2FE"},
	"diavolo":       {190, "cone", "diavolo_basic_chop", 20, 36, 1.0, "#DC2626", "#F472B6"},
	"cid":           {220, "cone", "cid_basic_slime", 20, 30, 1.02, "#7C3AED", "#38BDF8"},
	"pop":           {190, "cone", "pop_basic_fang", 19, 28, 1.0, "#22C55E", "#A3E635"},
	"speed_grandma": {185, "beam", "grandma_basic_dash", 19, 28, 52, "#EF4444", "#FCA5A5"},
	"krahang":       {195, "cone", "krahang_basic_club", 20, 44, 1.05, "#D97706", "#FEF08A"},
	"krasue":        {310, "proj", "krasue_basic_wisp", 18, 20, 790, "#F43F5E", "#FB923C"},
	"po":            {185, "cone", "po_basic_palm", 20, 46, 1.0, "#FACC15", "#F8FAFC"},
	"tai_lung":      {190, "cone", "tailung_basic_strike", 20, 32, 0.98, "#3B82F6", "#E2E8F0"},
	"kai":           {235, "beam", "kai_basic_blade", 20, 28, 56, "#10B981", "#A7F3D0"},
	"gambit":        {320, "proj", "gambit_basic_card", 19, 20, 825, "#EC4899", "#A855F7"},
	"iron_man":      {330, "proj", "ironman_basic_bolt", 19, 22, 835, "#EF4444", "#FACC15"},
	"law":           {290, "beam", "law_basic_slash", 20, 28, 58, "#0EA5E9", "#FACC15"},
	"garp":          {190, "cone", "garp_basic_fist", 21, 48, 1.0, "#DC2626", "#F8FAFC"},
	"tansan":        {305, "proj", "tansan_basic_fizz", 18, 26, 785, "#38BDF8", "#F8FAFC"},
	"wukong":        {225, "beam", "wukong_basic_staff", 20, 36, 56, "#F59E0B", "#DC2626"},
	"nezha":         {210, "beam", "nezha_basic_spear", 20, 32, 54, "#F97316", "#FEF08A"},
	"king":          {260, "proj", "king_basic_pulse", 17, 24, 770, "#FACC15", "#94A3B8"},
	"gon":           {195, "cone", "gon_basic_fist", 21, 42, 1.0, "#22C55E", "#FACC15"},
	"steve":         {200, "cone", "steve_basic_sword", 20, 36, 1.02, "#06B6D4", "#A855F7"},
	"doraemon":      {295, "proj", "doraemon_basic_air", 18, 32, 795, "#0284C7", "#FACC15"},
	"yami":          {230, "cone", "yami_basic_blade", 21, 34, 1.04, "#6B21A8", "#EF4444"},
	"escanor":       {210, "cone", "escanor_basic_flare", 22, 42, 1.05, "#F59E0B", "#FEF08A"},
	"meliodas":      {205, "cone", "meliodas_basic_cut", 20, 32, 1.0, "#7E22CE", "#09090B"},
	"adam":          {195, "cone", "adam_basic_knuckle", 20, 30, 1.0, "#FBBF24", "#F8FAFC"},
	"beelzebub":     {300, "proj", "beelz_basic_vib", 19, 24, 800, "#6D28D9", "#A78BFA"},
	"buddha":        {215, "cone", "buddha_basic_staff", 20, 34, 1.02, "#FACC15", "#FEF08A"},
	"cj_palony":     {240, "proj", "cj_basic_bolt", 19, 26, 805, "#38BDF8", "#F43F5E"},
}

func roster28BasicRange(cid string) (float64, bool) {
	spec, ok := roster28BasicSpecs[cid]
	return spec.atkRange, ok
}

func (e *Engine) castRoster28BasicAttack(
	rs *state.RoomState,
	caster *state.PlayerState,
	strikeRange, projLife float64,
	targetID string,
	nx, ny float64,
	now time.Time,
) ([]HitEvent, bool) {
	spec, ok := roster28BasicSpecs[caster.CharacterID]
	if !ok {
		return nil, false
	}
	switch spec.mode {
	case "proj":
		spd := spec.widthOrA
		e.addProjectileFull(rs, caster, state.Projectile{
			Kind:        spec.kind,
			Radius:      8.5,
			Damage:      spec.damage,
			Knockback:   spec.knockback,
			TargetID:    targetID,
			HomingSpeed: spd,
			Life:        projLife,
			MaxLife:     projLife,
			Color:       spec.color,
			AccentColor: spec.accent,
		}, nx, ny, spd)
		return nil, true
	case "beam":
		return e.fireLineBeam(rs, caster, spec.kind, nx, ny, strikeRange, spec.widthOrA, spec.damage, spec.knockback, 0.22, spec.color, spec.accent, now), true
	default:
		return e.fireConeSweep(rs, caster, spec.kind, nx, ny, strikeRange, spec.widthOrA, spec.damage, spec.knockback, 0.22, spec.color, spec.accent, now), true
	}
}

func roster28MoveSpeedMult(p *state.PlayerState, moving bool, now time.Time) float64 {
	if !p.Alive {
		return 1.0
	}
	mult := 1.0
	switch p.CharacterID {
	case "diavolo":
		if now.Before(p.TimeEraseUntil) {
			mult += 0.24
		}
	case "speed_grandma":
		if moving && p.PassiveStacks > 0 && now.Before(p.PassiveUntil) {
			mult += 0.085 * float64(p.PassiveStacks)
		}
	case "krahang":
		if now.Before(p.BuffUntil) || (moving && now.Before(p.PassiveUntil)) {
			mult += 0.20
		}
	case "cj_palony":
		if p.PassiveStacks > 0 && now.Before(p.PassiveUntil) {
			mult += 0.05 * float64(p.PassiveStacks)
		}
	case "adam", "buddha":
		if now.Before(p.CounterUntil) {
			mult += 0.16
		}
	case "iron_man":
		if p.IronManFlight {
			mult += 0.55
		}
	}
	return mult
}

func stepRoster28PlayerTick(p *state.PlayerState, now time.Time) bool {
	if !p.Alive {
		return false
	}
	if _, ok := roster28BasicSpecs[p.CharacterID]; !ok {
		return false
	}
	if p.CharacterID == "speed_grandma" && (p.InputDX != 0 || p.InputDY != 0) {
		if now.After(p.PassiveTickAt) {
			p.PassiveTickAt = now.Add(450 * time.Millisecond)
			if p.PassiveStacks < 5 {
				p.PassiveStacks++
			}
			p.PassiveUntil = now.Add(1600 * time.Millisecond)
		}
	} else if p.CharacterID == "krahang" && (p.InputDX != 0 || p.InputDY != 0) {
		p.PassiveUntil = now.Add(600 * time.Millisecond)
	} else if p.PassiveStacks > 0 && !p.PassiveUntil.IsZero() && now.After(p.PassiveUntil) {
		p.PassiveStacks = 0
	}
	return false
}

func (e *Engine) stepRoster28Passives(rs *state.RoomState, now time.Time) bool {
	changed := false
	for _, p := range rs.Players {
		if !p.Alive {
			continue
		}
		switch p.CharacterID {
		case "king":
			if p.PassiveTickAt.IsZero() || !now.Before(p.PassiveTickAt) {
				p.PassiveTickAt = now.Add(1200 * time.Millisecond)
				for _, foe := range rs.Players {
					if isEnemy(rs, p, foe) && math.Hypot(foe.X-p.X, foe.Y-p.Y) <= 235 {
						if slEnd := now.Add(850 * time.Millisecond); slEnd.After(foe.SlowUntil) {
							foe.SlowUntil = slEnd
						}
						changed = true
					}
				}
			}
		case "escanor":
			if p.PassiveTickAt.IsZero() || !now.Before(p.PassiveTickAt) {
				p.PassiveTickAt = now.Add(1800 * time.Millisecond)
				if p.PassiveStacks < 5 {
					p.PassiveStacks++
				}
				p.PassiveUntil = now.Add(8 * time.Second)
			}
		case "doraemon":
			if p.PassiveTickAt.IsZero() || !now.Before(p.PassiveTickAt) {
				p.PassiveTickAt = now.Add(4200 * time.Millisecond)
				p.PassiveStacks = (p.PassiveStacks + 1) % 3
				if p.PassiveStacks == 0 && p.HP < p.MaxHP {
					p.HP = int(math.Min(float64(p.MaxHP), float64(p.HP+8)))
					changed = true
				} else if p.PassiveStacks == 1 {
					p.BuffUntil = now.Add(1400 * time.Millisecond)
					changed = true
				}
			}
		case "buddha":
			if p.PassiveTickAt.IsZero() || !now.Before(p.PassiveTickAt) {
				p.PassiveTickAt = now.Add(4500 * time.Millisecond)
				p.CounterUntil = now.Add(900 * time.Millisecond)
			}
		case "law":
			for _, z := range rs.Zones {
				if z.Kind == "law_shambles_room" && z.OwnerID == p.ID {
					p.PassiveUntil = now.Add(500 * time.Millisecond)
					break
				}
			}
		case "iron_man":
			if p.ArcChargeStartAt.IsZero() {
				p.ArcChargeStartAt = now
				changed = true
			}
		}
	}
	return changed
}

func applyRoster28DefensePassives(victim, killer *state.PlayerState, dmg int, now time.Time) (int, bool) {
	if _, ok := roster28BasicSpecs[victim.CharacterID]; !ok {
		return dmg, false
	}
	if killer != nil {
		victim.LastHitByID = killer.ID
		victim.LastHitDamage = dmg
	}

	switch victim.CharacterID {
	case "diavolo": // Epitaph: 1/4 (25%) chance to foresee and completely dodge incoming attacks
		if randUnit() < 0.25 {
			victim.CounterUntil = now.Add(750 * time.Millisecond)
			return 0, true
		}
		return dmg, false

	case "adam": // Eyes of the Lord: predicts & evades every 3rd strike
		victim.PassiveStacks++
		victim.PassiveUntil = now.Add(6 * time.Second)
		if victim.PassiveStacks >= 3 {
			victim.PassiveStacks = 0
			victim.CounterUntil = now.Add(900 * time.Millisecond)
			return 0, true
		}

	case "buddha": // Future Sight: evades while CounterUntil active + baseline 18% mitigation
		if now.Before(victim.CounterUntil) {
			victim.CounterUntil = time.Time{}
			return 0, true
		}
		return int(math.Round(float64(dmg) * 0.82)), false

	case "meliodas": // Full Counter stance + Demon Power builds when taking hits
		if victim.PassiveStacks < 5 {
			victim.PassiveStacks++
		}
		victim.PassiveUntil = now.Add(7 * time.Second)
		if now.Before(victim.CounterUntil) && killer != nil && killer.Alive {
			reflect := int(math.Max(14, float64(dmg)))
			killer.HP -= reflect
			if killer.HP < 1 {
				killer.HP = 1
			}
			victim.CounterUntil = time.Time{}
			return 0, true
		}

	case "yami": // Ki Sense: primes counter slash on incoming attack
		victim.CounterUntil = now.Add(2200 * time.Millisecond)
		return int(math.Round(float64(dmg) * 0.85)), false

	case "po": // Inner Peace: -8% damage per consecutive hit taken (max -32%)
		if victim.PassiveStacks < 4 {
			victim.PassiveStacks++
		}
		victim.PassiveUntil = now.Add(5 * time.Second)
		return int(math.Round(float64(dmg) * (1.0 - 0.08*float64(victim.PassiveStacks)))), false

	case "garp": // Hero of the Marines: iron Haki below 50% HP
		if victim.MaxHP > 0 && float64(victim.HP)/float64(victim.MaxHP) < 0.50 {
			return int(math.Round(float64(dmg) * 0.78)), false
		}

	case "steve": // Inventory: shield rotation slot reduces hit dmg
		if victim.PassiveStacks%3 == 1 {
			return int(math.Round(float64(dmg) * 0.78)), false
		}

	case "nezha": // Lotus Rebirth: mitigates lethal burst every 10s
		if dmg >= 26 && (victim.PassiveTickAt.IsZero() || !now.Before(victim.PassiveTickAt)) {
			victim.PassiveTickAt = now.Add(10 * time.Second)
			victim.InvulnUntil = now.Add(1000 * time.Millisecond)
			victim.HP = int(math.Min(float64(victim.MaxHP), float64(victim.HP+16)))
			return int(math.Round(float64(dmg) * 0.45)), false
		}
	}
	return dmg, false
}

func applyRoster28AttackPassives(victim, killer *state.PlayerState, dmg int, stunSec, slowSec float64, now time.Time) (int, float64, float64) {
	switch killer.CharacterID {
	case "gray":
		if slowSec < 0.8 {
			slowSec = 0.8
		}
		killer.PassiveStacks++
		killer.PassiveUntil = now.Add(6 * time.Second)
		if killer.PassiveStacks >= 3 {
			killer.PassiveStacks = 0
			dmg += 10
			if stunSec < 0.65 {
				stunSec = 0.65
			}
		}
	case "cid":
		if killer.PassiveStacks < 5 {
			killer.PassiveStacks++
		}
		killer.PassiveUntil = now.Add(7 * time.Second)
		dmg = int(math.Round(float64(dmg) * (1.0 + 0.06*float64(killer.PassiveStacks))))
	case "pop":
		if killer.PassiveStacks < 5 {
			killer.PassiveStacks++
		}
		killer.PassiveUntil = now.Add(6500 * time.Millisecond)
		killer.HP = int(math.Min(float64(killer.MaxHP), float64(killer.HP+4)))
		dmg = int(math.Round(float64(dmg) * (1.0 + 0.05*float64(killer.PassiveStacks))))
	case "krahang":
		if now.Before(killer.BuffUntil) {
			dmg = int(math.Round(float64(dmg) * 1.15))
		}
	case "krasue":
		heal := int(math.Max(5, math.Round(float64(dmg)*0.25)))
		killer.HP = int(math.Min(float64(killer.MaxHP), float64(killer.HP+heal)))
	case "tai_lung":
		killer.PassiveStacks++
		killer.PassiveUntil = now.Add(6 * time.Second)
		if killer.PassiveStacks >= 3 {
			killer.PassiveStacks = 0
			dmg += 10
			if stunSec < 0.75 {
				stunSec = 0.75
			}
		}
	case "gambit":
		killer.PassiveStacks++
		killer.PassiveUntil = now.Add(6 * time.Second)
		if killer.PassiveStacks >= 3 {
			killer.PassiveStacks = 0
			dmg += 14
		}
	case "gon":
		if killer.PassiveStacks < 5 {
			killer.PassiveStacks++
		}
		killer.PassiveUntil = now.Add(7 * time.Second)
		dmg = int(math.Round(float64(dmg) * (1.0 + 0.055*float64(killer.PassiveStacks))))
	case "law":
		if now.Before(killer.PassiveUntil) {
			dmg = int(math.Round(float64(dmg) * 1.25))
		}
	case "garp":
		if killer.MaxHP > 0 && float64(killer.HP)/float64(killer.MaxHP) < 0.50 {
			dmg = int(math.Round(float64(dmg) * 1.22))
		}
	case "tansan", "beelzebub":
		if killer.PassiveStacks < 4 {
			killer.PassiveStacks++
		}
		killer.PassiveUntil = now.Add(7 * time.Second)
		dmg = int(math.Round(float64(dmg) * (1.0 + 0.075*float64(killer.PassiveStacks))))
		if killer.CharacterID == "beelzebub" && killer.PassiveStacks >= 4 {
			dmg += 8
		}
	case "wukong":
		killer.PassiveStacks++
		killer.PassiveUntil = now.Add(6 * time.Second)
		if killer.PassiveStacks >= 3 {
			killer.PassiveStacks = 0
			dmg += 10
			killer.BuffUntil = now.Add(1200 * time.Millisecond)
		}
	case "steve":
		killer.PassiveStacks = (killer.PassiveStacks + 1) % 3
		killer.PassiveUntil = now.Add(8 * time.Second)
		if killer.PassiveStacks == 0 {
			dmg = int(math.Round(float64(dmg) * 1.16))
		} else if killer.PassiveStacks == 2 {
			dmg += 6
		}
	case "yami":
		if now.Before(killer.CounterUntil) {
			dmg = int(math.Round(float64(dmg) * 1.20))
		}
	case "escanor":
		dmg = int(math.Round(float64(dmg) * (1.0 + 0.07*float64(killer.PassiveStacks))))
	case "meliodas":
		dmg = int(math.Round(float64(dmg) * (1.0 + 0.07*float64(killer.PassiveStacks))))
	case "adam":
		if killer.LastHitDamage > 0 {
			bonus := int(math.Min(16, math.Round(float64(killer.LastHitDamage)*0.35)))
			dmg += bonus
		}
	case "cj_palony":
		if killer.PassiveStacks < 5 {
			killer.PassiveStacks++
		}
		killer.PassiveUntil = now.Add(7 * time.Second)
		dmg = int(math.Round(float64(dmg) * (1.0 + 0.05*float64(killer.PassiveStacks))))
	}
	return dmg, stunSec, slowSec
}

func applyRoster28KillPassives(killer *state.PlayerState, now time.Time) {
	if killer == nil || killer.CharacterID != "kai" || !killer.Alive {
		return
	}
	killer.MaxHP += 10
	killer.HP = int(math.Min(float64(killer.MaxHP), float64(killer.HP+28)))
	for i := 0; i < 3; i++ {
		if rem := killer.CooldownUntil[i].Sub(now); rem > 0 {
			killer.CooldownUntil[i] = now.Add(time.Duration(float64(rem) * 0.65))
		}
	}
}

func (e *Engine) castRoster28Skill(
	rs *state.RoomState,
	caster *state.PlayerState,
	slot int,
	skill state.SkillDef,
	nx, ny, targetDist float64,
	now time.Time,
) ([]HitEvent, bool) {
	if _, ok := roster28BasicSpecs[caster.CharacterID]; !ok {
		return nil, false
	}
	zx, zy := clampTargetPoint(caster, nx, ny, targetDist, skill.CastRange, rs.Map)
	var hits []HitEvent

	switch caster.CharacterID {
	case "gray":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "gray_ice_lance", nx, ny, skill.CastRange, 56, 26, 40, 0.3, "#38BDF8", "#E0F2FE", now)
		case 2:
			caster.InvulnUntil = now.Add(1250 * time.Millisecond)
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 18, 0, 125, now)
			e.appendZone(rs, caster, "gray_ice_shield", caster.X, caster.Y, skill.AoeRadius, "#BAE6FD", "#38BDF8", 2.0, 0, 0, 8, 0.5, 0, 1.4, true)
		case 3:
			e.appendZone(rs, caster, "gray_devil_rage", zx, zy, skill.AoeRadius, "#0284C7", "#E0F2FE", 1.35, 0.45, 0, 48, 2.0, 1.25, 2.0, false)
		}

	case "diavolo":
		switch slot {
		case 1:
			caster.X, caster.Y = stepDashAvoidingPillars(caster.X, caster.Y, nx, ny, 75, rs.Map)
			hits = e.fireConeSweep(rs, caster, "diavolo_crimson_punch", nx, ny, skill.AoeRadius, 1.05, 42, 135, 0.28, "#DC2626", "#F472B6", now)
			minDot := math.Cos(1.05)
			for _, p := range rs.Players {
				if !isEnemy(rs, caster, p) || now.Before(p.InvulnUntil) || now.Before(p.TimeEraseUntil) {
					continue
				}
				dx, dy := p.X-caster.X, p.Y-caster.Y
				d := math.Hypot(dx, dy)
				if d <= skill.AoeRadius+rs.Map.PlayerRadius+140 && (d < 1 || (dx/d)*nx+(dy/d)*ny >= minDot) {
					if slEnd := now.Add(450 * time.Millisecond); slEnd.After(p.SlowUntil) {
						p.SlowUntil = slEnd
					}
				}
			}
		case 2:
			caster.TimeEraseUntil = now.Add(5 * time.Second)
			caster.InvulnUntil = now.Add(5 * time.Second)
			caster.BuffUntil = now.Add(5 * time.Second)
			caster.SlowUntil = time.Time{}
			e.appendZone(rs, caster, "diavolo_time_erase", caster.X, caster.Y, skill.AoeRadius, "#DC2626", "#F472B6", 0.65, 0, 0, 0, 1, 0, 0, false)
		case 3:
			prevX, prevY := caster.X, caster.Y
			e.appendZone(rs, caster, "diavolo_time_erase", prevX, prevY, 120, "#DC2626", "#F472B6", 0.55, 0, 0, 0, 1, 0, 0, false)
			caster.TimeEraseUntil = time.Time{}
			caster.InvulnUntil = now.Add(750 * time.Millisecond)
			if target := findLockOnTarget(rs, caster, zx, zy, skill.CastRange, now); target != nil {
				faceDX, faceDY := target.AimDX, target.AimDY
				if mag := math.Hypot(faceDX, faceDY); mag > 0.01 {
					faceDX /= mag
					faceDY /= mag
				} else {
					faceDX, faceDY, _ = normalizeAim(caster, target.X, target.Y)
				}
				caster.X, caster.Y = resolveObstacles(target.X-faceDX*54, target.Y-faceDY*54, rs.Map)
				toX, toY, _ := normalizeAim(caster, target.X, target.Y)
				caster.AimDX = toX
				caster.AimDY = toY
				e.addBeamVisual(rs, caster, "diavolo_crimson_punch", caster.X, caster.Y, target.X, target.Y, 64, 0.38, "#DC2626", "#F472B6")
				if ev, died := e.damagePlayerCC(target, caster, caster.ID, caster.Name, 62, 1.1, 0.8, toX, toY, 95, rs.Map, now); died {
					hits = append(hits, ev)
				}
				e.appendZone(rs, caster, "diavolo_fate_decided", target.X, target.Y, skill.AoeRadius, "#991B1B", "#F472B6", 0.85, 0, 0, 0, 1, 0, 0, false)
			} else {
				caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, clamp(targetDist, 80, skill.CastRange), rs.Map)
				hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 54, 1.0, 90, now)
				e.appendZone(rs, caster, "diavolo_fate_decided", caster.X, caster.Y, skill.AoeRadius, "#991B1B", "#F472B6", 0.85, 0, 0, 0, 1, 0, 0, false)
			}
		}

	case "cid":
		switch slot {
		case 1:
			hits = e.fireConeSweep(rs, caster, "cid_shadow_slash", nx, ny, skill.AoeRadius*1.4, 1.05, 32, 48, 0.26, "#7C3AED", "#38BDF8", now)
		case 2:
			prevX, prevY := caster.X, caster.Y
			caster.InvulnUntil = now.Add(650 * time.Millisecond)
			if caster.PassiveStacks < 5 {
				caster.PassiveStacks++
			}
			caster.PassiveUntil = now.Add(7 * time.Second)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 260, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "cid_shadow_step", prevX, prevY, caster.X, caster.Y, 64, 22, 35, 0.3, "#38BDF8", "#7C3AED", now)
		case 3:
			e.appendZone(rs, caster, "cid_atomic", zx, zy, skill.AoeRadius, "#6D28D9", "#38BDF8", 1.5, 0.55, 110, 60, 2.0, 1.15, 1.8, false)
		}

	case "pop":
		switch slot {
		case 1:
			caster.X, caster.Y = stepDashAvoidingPillars(caster.X, caster.Y, nx, ny, 150, rs.Map)
			hits = e.fireLineBeam(rs, caster, "pop_ghost_claw", nx, ny, skill.CastRange*0.7, 74, 28, 40, 0.26, "#22C55E", "#A3E635", now)
		case 2:
			e.appendZone(rs, caster, "pop_possession", zx, zy, skill.AoeRadius, "#15803D", "#A3E635", 1.5, 0, 0, 16, 0.75, 0.75, 1.8, false)
		case 3:
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+20)))
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 28, 0.5, 70, now)
			e.appendZone(rs, caster, "pop_endless_hunger", caster.X, caster.Y, skill.AoeRadius, "#22C55E", "#A3E635", 2.4, 0, 60, 11, 0.6, 0, 1.2, true)
		}

	case "speed_grandma":
		switch slot {
		case 1:
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 290, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "grandma_dash", prevX, prevY, caster.X, caster.Y, 76, 30, 80, 0.28, "#EF4444", "#FCA5A5", now)
		case 2:
			caster.BuffUntil = now.Add(2200 * time.Millisecond)
			e.appendZone(rs, caster, "grandma_phantom_trail", caster.X, caster.Y, skill.AoeRadius, "#F87171", "#111827", 1.8, 0.35, 0, 24, 1.5, 0, 1.3, false)
		case 3:
			caster.BuffUntil = now.Add(2600 * time.Millisecond)
			e.appendZone(rs, caster, "grandma_death_chase", zx, zy, skill.AoeRadius, "#DC2626", "#FCA5A5", 1.2, 0.2, 0, 16, 0.28, 0.4, 0.9, false)
		}

	case "krahang":
		switch slot {
		case 1:
			hits = e.fireConeSweep(rs, caster, "krahang_pestle_strike", nx, ny, skill.AoeRadius, 1.05, 30, 85, 0.25, "#D97706", "#FEF08A", now)
		case 2:
			prevX, prevY := caster.X, caster.Y
			caster.BuffUntil = now.Add(2200 * time.Millisecond)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 260, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "krahang_wind_flight", prevX, prevY, caster.X, caster.Y, 82, 24, 95, 0.3, "#F59E0B", "#FEF08A", now)
		case 3:
			e.appendZone(rs, caster, "krahang_storm", zx, zy, skill.AoeRadius, "#B45309", "#FEF08A", 2.0, 0, 145, 16, 0.55, 0.4, 1.4, false)
		}

	case "krasue":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "krasue_crimson_beam", nx, ny, skill.CastRange, skill.AoeRadius, 32, 32, 0.34, "#F43F5E", "#FB923C", now)
		case 2:
			caster.InvulnUntil = now.Add(900 * time.Millisecond)
			e.appendZone(rs, caster, "krasue_floating_curse", caster.X, caster.Y, skill.AoeRadius, "#FB923C", "#F43F5E", 2.0, 0, 0, 10, 0.65, 0, 1.6, true)
		case 3:
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+30)))
			e.appendZone(rs, caster, "krasue_midnight_horror", zx, zy, skill.AoeRadius, "#E11D48", "#FB923C", 1.2, 0.38, 0, 50, 2.0, 0.9, 1.5, false)
		}

	case "po":
		switch slot {
		case 1:
			hits = e.fireConeSweep(rs, caster, "po_panda_punch", nx, ny, skill.AoeRadius, 1.0, 32, 120, 0.25, "#FACC15", "#F8FAFC", now)
		case 2:
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 26, 0.75, 145, now)
			e.appendZone(rs, caster, "po_belly_bounce", caster.X, caster.Y, skill.AoeRadius, "#F8FAFC", "#FACC15", 0.6, 0, 0, 0, 1, 0, 0, false)
		case 3:
			e.appendZone(rs, caster, "po_wuxi_finger", zx, zy, skill.AoeRadius, "#EAB308", "#F8FAFC", 1.35, 0.45, 0, 54, 2.0, 1.1, 1.6, false)
		}

	case "tai_lung":
		switch slot {
		case 1:
			hits = e.fireConeSweep(rs, caster, "tailung_nerve_strike", nx, ny, skill.AoeRadius*1.15, 0.9, 28, 30, 0.24, "#3B82F6", "#E2E8F0", now)
		case 2:
			prevX, prevY := caster.X, caster.Y
			dashDist := clamp(targetDist-32, 85, 290)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, dashDist, rs.Map)
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 26, 0.65, 80, now)
			e.addBeamVisual(rs, caster, "tailung_flying_leap", prevX, prevY, caster.X, caster.Y, 46, 0.28, "#60A5FA", "#E2E8F0")
		case 3:
			z := state.ZoneEffect{
				ID: e.nextID("zone"), OwnerID: caster.ID, OwnerName: caster.Name,
				Kind: "tailung_thousand_strikes", X: zx, Y: zy, Radius: skill.AoeRadius,
				Color: "#1D4ED8", AccentColor: "#E2E8F0", AimAngle: math.Atan2(ny, nx),
				Life: 1.1, MaxLife: 1.1, DelayLeft: 0.15, MaxDelay: 0.15,
				DamagePerTick: 14, TickInterval: 0.25, SlowSec: 0.6,
			}
			rs.Zones = append(rs.Zones, z)
		}

	case "kai":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "kai_jade_whip", nx, ny, skill.CastRange, skill.AoeRadius, 30, 35, 0.3, "#10B981", "#A7F3D0", now)
		case 2:
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "kai_spirit_chains", Radius: 12, Damage: 22, StunSec: 0.85,
				PullOnHit: 165, Life: 0.65, MaxLife: 0.65, Color: "#34D399", AccentColor: "#064E3B",
			}, nx, ny, 860)
		case 3:
			e.appendZone(rs, caster, "kai_jade_army", zx, zy, skill.AoeRadius, "#059669", "#A7F3D0", 4.0, 0.25, 45, 14, 0.65, 0, 0.8, false)
		}

	case "gambit":
		switch slot {
		case 1:
			for _, ang := range []float64{-0.22, 0, 0.22} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectile(rs, caster, "gambit_explosive_cards", ax, ay, 820, 9, 18, 0, 22, 75, skill.CastRange/820, "#EC4899", "#A855F7")
			}
		case 2:
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 210, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "gambit_bo_staff", prevX, prevY, caster.X+nx*90, caster.Y+ny*90, 72, 26, 95, 0.26, "#A855F7", "#F8FAFC", now)
		case 3:
			e.appendZone(rs, caster, "gambit_royal_flush", zx, zy, skill.AoeRadius, "#DB2777", "#FACC15", 1.35, 0.4, 0, 54, 2.0, 0.8, 1.5, false)
		}

	case "iron_man":
		switch slot {
		case 1:
			fullCharge := !caster.ArcChargeStartAt.IsZero() && !now.Before(caster.ArcChargeStartAt.Add(10*time.Second))
			caster.ArcChargeStartAt = now
			if fullCharge {
				hits = e.fireLineBeam(rs, caster, "ironman_mega_unibeam", nx, ny, 760, 118, 58, 115, 0.52, "#38BDF8", "#FACC15", now)
				startX := caster.X + nx*(rs.Map.PlayerRadius+4)
				startY := caster.Y + ny*(rs.Map.PlayerRadius+4)
				endX := clamp(startX+nx*760, 0, rs.Map.Width)
				endY := clamp(startY+ny*760, 0, rs.Map.Height)
				hitRad := 118.0/2.0 + rs.Map.PlayerRadius
				for _, foe := range rs.Players {
					if isEnemy(rs, caster, foe) && pointToSegmentDist(foe.X, foe.Y, startX, startY, endX, endY) <= hitRad {
						if stEnd := now.Add(650 * time.Millisecond); stEnd.After(foe.StunUntil) {
							foe.StunUntil = stEnd
						}
					}
				}
			} else {
				hits = e.fireLineBeam(rs, caster, "ironman_repulsor_blast", nx, ny, skill.CastRange, skill.AoeRadius, 30, 52, 0.32, "#38BDF8", "#EF4444", now)
			}
		case 2:
			if caster.IronManSnapReady {
				caster.InvulnUntil = now.Add(1500 * time.Millisecond)
				rs.Zones = append(rs.Zones, state.ZoneEffect{
					ID:          e.nextID("zone"),
					OwnerID:     caster.ID,
					OwnerName:   caster.Name,
					OwnerTeam:   caster.Team,
					Kind:        "ironman_snap_wave",
					X:           caster.X,
					Y:           caster.Y,
					Radius:      480,
					Color:       "#EF4444",
					AccentColor: "#FACC15",
					Life:        1.5,
					MaxLife:     1.5,
				})
				for _, target := range rs.Players {
					if !isEnemy(rs, caster, target) {
						continue
					}
					target.InvulnUntil = time.Time{}
					target.TimeEraseUntil = time.Time{}
					if ev, died := e.damagePlayerCC(target, caster, caster.ID, caster.Name, target.HP+9999, 0, 0, target.X-caster.X, target.Y-caster.Y, 90, rs.Map, now); died {
						hits = append(hits, ev)
					}
				}
				caster.IronManSnapReady = false
				caster.InfinityStones = nil
			} else {
				perpX, perpY := -ny, nx
				sideOffsets := []float64{-28, -17, -7, 7, 17, 28}
				landingOffsets := [][2]float64{
					{-34, -22}, {-14, 26}, {-4, -8},
					{6, 12}, {18, -24}, {34, 20},
				}
				for i := 0; i < 6; i++ {
					sx := clamp(caster.X+nx*14+perpX*sideOffsets[i], rs.Map.PlayerRadius, rs.Map.Width-rs.Map.PlayerRadius)
					sy := clamp(caster.Y+ny*14+perpY*sideOffsets[i], rs.Map.PlayerRadius, rs.Map.Height-rs.Map.PlayerRadius)
					tx := clamp(zx+landingOffsets[i][0], rs.Map.PlayerRadius, rs.Map.Width-rs.Map.PlayerRadius)
					ty := clamp(zy+landingOffsets[i][1], rs.Map.PlayerRadius, rs.Map.Height-rs.Map.PlayerRadius)
					dx := tx - sx
					dy := ty - sy
					dist := math.Hypot(dx, dy)
					var mx, my float64
					if dist < 1 {
						mx, my = nx, ny
						dist = 40
					} else {
						mx, my = dx/dist, dy/dist
					}
					spd := 720.0 + float64(i)*28.0
					life := math.Max(0.14, dist/spd)
					e.addProjectileAt(rs, caster, state.Projectile{
						Kind:          "ironman_missile",
						Radius:        10,
						Damage:        11,
						StunSec:       0.15,
						Knockback:     22,
						ExplodeRadius: 85,
						ExplodeKind:   "ironman_missile_boom",
						Life:          life,
						MaxLife:       life,
						Color:         "#EF4444",
						AccentColor:   "#FACC15",
					}, sx, sy, mx, my, spd)
				}
			}
		case 3:
			caster.IronManFlight = !caster.IronManFlight
			if caster.IronManFlight {
				caster.MaxHP = 170
				if caster.HP > 170 {
					caster.HP = 170
				}
				prevX, prevY := caster.X, caster.Y
				caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 135, rs.Map)
				e.addBeamVisual(rs, caster, "ironman_thruster_flight", prevX, prevY, caster.X, caster.Y, 74, 0.34, "#38BDF8", "#FACC15")
			} else {
				caster.MaxHP = 225
				if caster.Alive {
					caster.HP = int(math.Min(225, float64(caster.HP+35)))
				}
				e.appendZone(rs, caster, "ironman_missile_boom", caster.X, caster.Y, 110, "#38BDF8", "#FACC15", 0.36, 0, 0, 0, 0, 0, 0, false)
			}
		}

	case "law":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "law_amputate", nx, ny, skill.CastRange, skill.AoeRadius, 32, 35, 0.28, "#0EA5E9", "#FACC15", now)
		case 2:
			caster.PassiveUntil = now.Add(4500 * time.Millisecond)
			e.appendZone(rs, caster, "law_shambles_room", zx, zy, skill.AoeRadius, "#38BDF8", "#FACC15", 4.2, 0, 0, 8, 0.9, 0, 1.0, false)
			caster.X, caster.Y = resolveObstacles(zx, zy, rs.Map)
		case 3:
			e.appendZone(rs, caster, "law_puncture_wille", zx, zy, skill.AoeRadius, "#0EA5E9", "#FACC15", 1.4, 0.48, 0, 56, 2.0, 1.15, 1.5, false)
		}

	case "garp":
		switch slot {
		case 1:
			e.appendZone(rs, caster, "garp_galaxy_impact", zx, zy, skill.AoeRadius, "#DC2626", "#F8FAFC", 1.1, 0.32, 0, 36, 2.0, 0.5, 1.4, false)
		case 2:
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 210, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "garp_iron_fist", prevX, prevY, caster.X+nx*80, caster.Y+ny*80, 78, 30, 140, 0.28, "#1E293B", "#DC2626", now)
		case 3:
			e.appendZone(rs, caster, "garp_galaxy_divide", zx, zy, skill.AoeRadius, "#EF4444", "#09090B", 1.4, 0.48, 0, 58, 2.0, 1.1, 1.6, false)
		}

	case "tansan":
		switch slot {
		case 1:
			e.appendZone(rs, caster, "tansan_bubble_shot", zx, zy, skill.AoeRadius, "#38BDF8", "#F8FAFC", 1.2, 0.28, 0, 28, 2.0, 0, 1.4, false)
		case 2:
			caster.BuffUntil = now.Add(2800 * time.Millisecond)
			for _, member := range rs.Players {
				if member.Alive && !isEnemy(rs, caster, member) && math.Hypot(member.X-caster.X, member.Y-caster.Y) <= skill.AoeRadius {
					member.HP = int(math.Min(float64(member.MaxHP), float64(member.HP+20)))
					member.BuffUntil = now.Add(2600 * time.Millisecond)
				}
			}
			e.appendZone(rs, caster, "tansan_soda_boost", caster.X, caster.Y, skill.AoeRadius, "#F8FAFC", "#38BDF8", 1.5, 0, 0, 0, 1, 0, 0, true)
		case 3:
			e.appendZone(rs, caster, "tansan_carbonation_boom", zx, zy, skill.AoeRadius, "#0284C7", "#F8FAFC", 1.5, 0.38, -110, 50, 2.0, 0.65, 2.0, false)
		}

	case "wukong":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "wukong_golden_staff", nx, ny, skill.CastRange, skill.AoeRadius, 32, 70, 0.28, "#F59E0B", "#DC2626", now)
		case 2:
			prevX, prevY := caster.X, caster.Y
			caster.InvulnUntil = now.Add(500 * time.Millisecond)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 270, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "wukong_cloud_dash", prevX, prevY, caster.X, caster.Y, 72, 24, 48, 0.28, "#FEF08A", "#F59E0B", now)
		case 3:
			caster.BuffUntil = now.Add(4500 * time.Millisecond)
			e.appendZone(rs, caster, "wukong_great_sage", zx, zy, skill.AoeRadius, "#DC2626", "#F59E0B", 1.4, 0.45, 0, 54, 2.0, 1.0, 1.5, false)
		}

	case "nezha":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "nezha_fire_spear", nx, ny, skill.CastRange, skill.AoeRadius, 30, 52, 0.28, "#F97316", "#FEF08A", now)
		case 2:
			caster.BuffUntil = now.Add(2600 * time.Millisecond)
			e.appendZone(rs, caster, "nezha_wind_wheels", caster.X, caster.Y, skill.AoeRadius, "#FEF08A", "#F97316", 2.4, 0, 0, 12, 0.55, 0, 0.8, true)
		case 3:
			e.appendZone(rs, caster, "nezha_lotus_inferno", zx, zy, skill.AoeRadius, "#EA580C", "#FEF08A", 1.4, 0.45, 0, 52, 2.0, 1.0, 1.4, false)
		}

	case "king":
		switch slot {
		case 1:
			hits = e.fireConeSweep(rs, caster, "king_legendary_glare", nx, ny, skill.CastRange, 1.0, 22, 40, 0.3, "#FACC15", "#94A3B8", now)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-caster.X, foe.Y-caster.Y) <= skill.AoeRadius {
					if stunEnd := now.Add(700 * time.Millisecond); stunEnd.After(foe.StunUntil) {
						foe.StunUntil = stunEnd
					}
					if slowEnd := now.Add(2000 * time.Millisecond); slowEnd.After(foe.SlowUntil) {
						foe.SlowUntil = slowEnd
					}
				}
			}
		case 2:
			caster.InvulnUntil = now.Add(1350 * time.Millisecond)
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+18)))
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 240, rs.Map)
			e.addBeamVisual(rs, caster, "king_lucky_escape", prevX, prevY, caster.X, caster.Y, 42, 0.3, "#94A3B8", "#FACC15")
		case 3:
			e.appendZone(rs, caster, "king_s_reputation", zx, zy, skill.AoeRadius, "#EAB308", "#0F172A", 1.45, 0.35, 0, 40, 2.0, 1.4, 2.0, false)
		}

	case "gon":
		switch slot {
		case 1:
			hits = e.fireConeSweep(rs, caster, "gon_jajanken_rock", nx, ny, skill.AoeRadius*1.4, 0.95, 38, 125, 0.28, "#FACC15", "#22C55E", now)
		case 2:
			hits = e.fireLineBeam(rs, caster, "gon_jajanken_scissors", nx, ny, skill.CastRange, skill.AoeRadius, 30, 32, 0.3, "#22C55E", "#FACC15", now)
		case 3:
			caster.BuffUntil = now.Add(5 * time.Second)
			e.appendZone(rs, caster, "gon_adult_gon", zx, zy, skill.AoeRadius, "#16A34A", "#FACC15", 1.5, 0.45, 0, 62, 2.0, 1.1, 1.6, false)
		}

	case "steve":
		switch slot {
		case 1:
			hits = e.fireConeSweep(rs, caster, "steve_diamond_sword", nx, ny, skill.AoeRadius*1.4, 1.05, 32, 56, 0.25, "#06B6D4", "#A855F7", now)
		case 2:
			caster.InvulnUntil = now.Add(1250 * time.Millisecond)
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+14)))
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 16, 0, 140, now)
			e.appendZone(rs, caster, "steve_block_builder", caster.X, caster.Y, skill.AoeRadius, "#94A3B8", "#06B6D4", 2.0, 0, 0, 0, 1, 0, 0, true)
		case 3:
			e.appendZone(rs, caster, "steve_netherite_tnt", zx, zy, skill.AoeRadius, "#EF4444", "#FACC15", 1.4, 0.5, 0, 54, 2.0, 1.0, 1.5, false)
		}

	case "doraemon":
		switch slot {
		case 1:
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, clamp(targetDist, 100, skill.CastRange), rs.Map)
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 26, 0, 48, now)
			e.addBeamVisual(rs, caster, "doraemon_anywhere_door", prevX, prevY, caster.X, caster.Y, 44, 0.34, "#EC4899", "#38BDF8")
		case 2:
			caster.InvulnUntil = now.Add(1000 * time.Millisecond)
			caster.BuffUntil = now.Add(2500 * time.Millisecond)
			e.appendZone(rs, caster, "doraemon_bamboo_copter", caster.X, caster.Y, skill.AoeRadius, "#FACC15", "#38BDF8", 1.8, 0, 0, 0, 1, 0, 0, true)
		case 3:
			e.appendZone(rs, caster, "doraemon_time_machine", zx, zy, skill.AoeRadius, "#0284C7", "#FACC15", 1.5, 0.42, 0, 46, 2.0, 1.45, 2.0, false)
		}

	case "yami":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "yami_dark_slash", nx, ny, skill.CastRange, skill.AoeRadius, 32, 42, 0.28, "#6B21A8", "#EF4444", now)
		case 2:
			e.appendZone(rs, caster, "yami_black_moon", caster.X, caster.Y, skill.AoeRadius, "#111827", "#6B21A8", 2.2, 0, 160, 12, 0.65, 0, 1.5, true)
		case 3:
			hits = e.fireLineBeam(rs, caster, "yami_dimension_slash", nx, ny, skill.CastRange, skill.AoeRadius, 58, 70, 0.45, "#9333EA", "#09090B", now)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && pointToSegmentDist(foe.X, foe.Y, caster.X, caster.Y, caster.X+nx*skill.CastRange, caster.Y+ny*skill.CastRange) <= skill.AoeRadius+rs.Map.PlayerRadius {
					if stunEnd := now.Add(900 * time.Millisecond); stunEnd.After(foe.StunUntil) {
						foe.StunUntil = stunEnd
					}
				}
			}
		}

	case "escanor":
		switch slot {
		case 1:
			e.appendZone(rs, caster, "escanor_cruel_sun", zx, zy, skill.AoeRadius, "#F97316", "#FEF08A", 1.5, 0.35, 0, 34, 0.7, 0.4, 1.2, false)
		case 2:
			hits = e.fireConeSweep(rs, caster, "escanor_divine_sword", nx, ny, skill.CastRange*0.65, 1.0, 32, 65, 0.28, "#FACC15", "#FFFFFF", now)
		case 3:
			caster.BuffUntil = now.Add(6 * time.Second)
			caster.RapidAttackUntil = now.Add(5 * time.Second)
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+24)))
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 58, 1.0, 125, now)
			e.appendZone(rs, caster, "escanor_the_one", caster.X, caster.Y, skill.AoeRadius, "#FEF08A", "#F59E0B", 2.2, 0, 0, 12, 0.8, 0, 0, true)
		}

	case "meliodas":
		switch slot {
		case 1:
			caster.CounterUntil = now.Add(1050 * time.Millisecond)
			caster.InvulnUntil = now.Add(550 * time.Millisecond)
			hits = e.fireConeSweep(rs, caster, "meliodas_full_counter", nx, ny, skill.AoeRadius, 1.05, 26, 90, 0.26, "#38BDF8", "#F8FAFC", now)
		case 2:
			hits = e.fireLineBeam(rs, caster, "meliodas_hellblaze", nx, ny, skill.CastRange, 72, 32, 42, 0.32, "#7E22CE", "#09090B", now)
		case 3:
			caster.RapidAttackUntil = now.Add(5 * time.Second)
			caster.BuffUntil = now.Add(3 * time.Second)
			e.appendZone(rs, caster, "meliodas_assault_mode", caster.X, caster.Y, skill.AoeRadius, "#1E1B4B", "#9333EA", 1.5, 0.3, 0, 54, 2.0, 1.0, 1.4, false)
		}

	case "adam":
		switch slot {
		case 1:
			dmg := 32 + int(math.Min(18, math.Round(float64(caster.LastHitDamage)*0.4)))
			hits = e.fireConeSweep(rs, caster, "adam_divine_rep", nx, ny, skill.AoeRadius*1.3, 1.0, dmg, 65, 0.24, "#FBBF24", "#F8FAFC", now)
		case 2:
			caster.InvulnUntil = now.Add(1150 * time.Millisecond)
			caster.CounterUntil = now.Add(2000 * time.Millisecond)
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 230, rs.Map)
			e.addBeamVisual(rs, caster, "adam_divine_dodge", prevX, prevY, caster.X, caster.Y, 44, 0.28, "#F8FAFC", "#FBBF24")
		case 3:
			z := state.ZoneEffect{
				ID: e.nextID("zone"), OwnerID: caster.ID, OwnerName: caster.Name,
				Kind: "adam_ultimate_father", X: zx, Y: zy, Radius: skill.AoeRadius,
				Color: "#F59E0B", AccentColor: "#F8FAFC", AimAngle: math.Atan2(ny, nx),
				Life: 1.15, MaxLife: 1.15, DelayLeft: 0.15, MaxDelay: 0.15,
				DamagePerTick: 15, TickInterval: 0.26, StunSec: 0.35,
			}
			rs.Zones = append(rs.Zones, z)
		}

	case "beelzebub":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "beelz_chaos_wave", nx, ny, skill.CastRange, skill.AoeRadius, 32, 65, 0.32, "#6D28D9", "#A78BFA", now)
		case 2:
			caster.InvulnUntil = now.Add(1250 * time.Millisecond)
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 20, 0, 130, now)
			e.appendZone(rs, caster, "beelz_defensive_barrier", caster.X, caster.Y, skill.AoeRadius, "#A78BFA", "#4C1D95", 2.0, 0, 0, 0, 1, 0, 1.3, true)
		case 3:
			e.appendZone(rs, caster, "beelz_chaos_unleashed", zx, zy, skill.AoeRadius, "#4C1D95", "#EF4444", 1.5, 0.5, 115, 58, 2.0, 1.15, 1.6, false)
		}

	case "buddha":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "buddha_divine_staff", nx, ny, skill.CastRange, skill.AoeRadius, 32, 70, 0.28, "#FACC15", "#FEF08A", now)
		case 2:
			caster.InvulnUntil = now.Add(1100 * time.Millisecond)
			caster.CounterUntil = now.Add(1800 * time.Millisecond)
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 220, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "buddha_enlightened_step", prevX, prevY, caster.X, caster.Y, 68, 24, 52, 0.3, "#FEF08A", "#FACC15", now)
		case 3:
			e.appendZone(rs, caster, "buddha_nirvana", zx, zy, skill.AoeRadius, "#EAB308", "#38BDF8", 1.45, 0.45, 0, 56, 2.0, 1.1, 1.5, false)
		}

	case "cj_palony":
		switch slot {
		case 1:
			hits = e.fireLineBeam(rs, caster, "cj_power_strike", nx, ny, skill.CastRange, skill.AoeRadius, 32, 48, 0.3, "#38BDF8", "#F43F5E", now)
		case 2:
			prevX, prevY := caster.X, caster.Y
			caster.InvulnUntil = now.Add(750 * time.Millisecond)
			e.appendZone(rs, caster, "cj_phantom_move", prevX, prevY, skill.AoeRadius, "#F43F5E", "#38BDF8", 1.3, 0.25, 0, 24, 2.0, 0, 1.2, false)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 270, rs.Map)
		case 3:
			caster.BuffUntil = now.Add(5 * time.Second)
			caster.RapidAttackUntil = now.Add(4500 * time.Millisecond)
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 54, 1.0, 125, now)
			e.appendZone(rs, caster, "cj_final_awakening", caster.X, caster.Y, skill.AoeRadius, "#F43F5E", "#38BDF8", 1.2, 0, 0, 0, 1, 0, 0, true)
		}
	}
	return hits, true
}

func (e *Engine) appendZone(
	rs *state.RoomState,
	caster *state.PlayerState,
	kind string,
	x, y, radius float64,
	color, accent string,
	life, delay, pull float64,
	dmgPerTick int,
	tickInterval, stunSec, slowSec float64,
	followOwner bool,
) {
	rs.Zones = append(rs.Zones, state.ZoneEffect{
		ID:            e.nextID("zone"),
		OwnerID:       caster.ID,
		OwnerName:     caster.Name,
		OwnerTeam:     caster.Team,
		Kind:          kind,
		X:             x,
		Y:             y,
		Radius:        radius,
		Color:         color,
		AccentColor:   accent,
		Life:          life,
		MaxLife:       life,
		DelayLeft:     delay,
		MaxDelay:      delay,
		PullForce:     pull,
		FollowOwner:   followOwner,
		DamagePerTick: dmgPerTick,
		TickInterval:  tickInterval,
		StunSec:       stunSec,
		SlowSec:       slowSec,
	})
}

func (e *Engine) stepRoster28ZoneDetonate(rs *state.RoomState, z *state.ZoneEffect, owner *state.PlayerState) {
	switch z.Kind {
	case "gray_devil_rage", "cid_atomic", "krasue_midnight_horror", "po_wuxi_finger",
		"garp_galaxy_impact", "garp_galaxy_divide", "law_puncture_wille", "wukong_great_sage",
		"nezha_lotus_inferno", "king_s_reputation", "gon_adult_gon", "steve_netherite_tnt",
		"doraemon_time_machine", "escanor_cruel_sun", "meliodas_assault_mode",
		"beelz_chaos_unleashed", "buddha_nirvana", "pop_endless_hunger", "gambit_royal_flush",
		"tansan_carbonation_boom":
		e.addBeamVisual(rs, owner, z.Kind, z.X, z.Y-420, z.X, z.Y, 72, 0.45, z.Color, z.AccentColor)
	}
}

func (e *Engine) stepRoster28ZoneTick(rs *state.RoomState, z *state.ZoneEffect, owner *state.PlayerState, kb *float64) {
	switch z.Kind {
	case "tailung_thousand_strikes", "adam_ultimate_father", "grandma_death_chase", "kai_jade_army":
		for k := 0; k < 2; k++ {
			ang := z.AimAngle + (randUnit()-0.5)*1.4
			e.addBeamVisual(rs, owner, z.Kind, z.X-math.Cos(ang)*58, z.Y-math.Sin(ang)*58, z.X+math.Cos(ang)*z.Radius, z.Y+math.Sin(ang)*z.Radius, 24, 0.24, z.Color, z.AccentColor)
		}
	case "tansan_carbonation_boom", "krahang_storm":
		*kb = 75
	}
}
