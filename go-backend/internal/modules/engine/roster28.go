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
		case "nezha":
			// Wind Fire Wheels: drop burning flame trail zones while speed buff is active & moving
			if now.Before(p.BuffUntil) && (p.InputDX != 0 || p.InputDY != 0) && (p.PassiveTickAt.IsZero() || !now.Before(p.PassiveTickAt)) {
				p.PassiveTickAt = now.Add(380 * time.Millisecond)
				e.appendZone(rs, p, "nezha_flame_trail", p.X, p.Y, 54, "#F97316", "#FEF08A", 1.8, 0, 0, 9, 0.45, 0, 0.7, false)
				changed = true
			}
		}
	}

	// Lore Projectile Nullification / Reflection for Yami (Black Moon), Beelzebub (Gates of Hell), and Meliodas (Full Counter)
	if len(rs.Projectiles) > 0 {
		kept := rs.Projectiles[:0]
		for _, pr := range rs.Projectiles {
			nullified := false
			for _, z := range rs.Zones {
				if z.Kind != "yami_black_moon" && z.Kind != "beelz_defensive_barrier" && z.Kind != "cid_atomic" {
					continue
				}
				if z.OwnerID == pr.OwnerID || (z.OwnerTeam != "" && z.OwnerTeam != state.TeamFFA && z.OwnerTeam == pr.OwnerTeam) {
					continue
				}
				if math.Hypot(pr.X-z.X, pr.Y-z.Y) <= z.Radius+pr.Radius {
					nullified = true
					changed = true
					break
				}
			}
			if !nullified {
				// Meliodas Full Counter & Po Belly Bounce: reflect enemy projectiles right back!
				for _, p := range rs.Players {
					if !p.Alive || (p.CharacterID != "meliodas" && p.CharacterID != "po") || !now.Before(p.CounterUntil) {
						continue
					}
					if pr.OwnerID == p.ID || (p.Team != "" && p.Team != state.TeamFFA && p.Team == pr.OwnerTeam) {
						continue
					}
					if math.Hypot(pr.X-p.X, pr.Y-p.Y) <= 62+pr.Radius {
						pr.OwnerID = p.ID
						pr.OwnerName = p.Name
						pr.OwnerTeam = p.Team
						pr.VX = -pr.VX * 1.35
						pr.VY = -pr.VY * 1.35
						mult := 1.8
						col, acc, bKind := "#38BDF8", "#F8FAFC", "meliodas_full_counter"
						if p.CharacterID == "po" {
							mult = 1.45
							col, acc, bKind = "#FACC15", "#F8FAFC", "po_belly_bounce"
						}
						pr.Damage = int(math.Round(float64(pr.Damage) * mult))
						pr.Color = col
						pr.AccentColor = acc
						pr.Life = math.Max(pr.Life, 0.9)
						p.CounterUntil = time.Time{}
						e.addBeamVisual(rs, p, bKind, p.X, p.Y, pr.X+pr.VX*0.18, pr.Y+pr.VY*0.18, 56, 0.28, col, acc)
						changed = true
						break
					}
				}
				kept = append(kept, pr)
			}
		}
		rs.Projectiles = kept
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

	case "meliodas": // True Full Counter stance: reflects 1.8x damage back at attacker
		if victim.PassiveStacks < 5 {
			victim.PassiveStacks++
		}
		victim.PassiveUntil = now.Add(7 * time.Second)
		if now.Before(victim.CounterUntil) && killer != nil && killer.Alive {
			reflect := int(math.Max(18, math.Round(float64(dmg)*1.8)))
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
		case 1: // Ice Make: Lance — central piercing ice spear + 2 flanking diagonal crystal lances!
			hits = e.fireLineBeam(rs, caster, "gray_ice_lance", nx, ny, skill.CastRange, 44, 24, 34, 0.28, "#38BDF8", "#E0F2FE", now)
			for _, ang := range []float64{-0.2, 0.2} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind: "gray_ice_lance_shard", Radius: 9, Damage: 15, Knockback: 22,
					Piercing: true, Life: skill.CastRange / 860, MaxLife: skill.CastRange / 860,
					Color: "#38BDF8", AccentColor: "#E0F2FE",
				}, ax, ay, 860)
			}
		case 2: // Ice Make: Rampart — freezing frontal glacial nova that chills & freezes already-slowed foes
			hits = e.fireConeSweep(rs, caster, "gray_ice_rampart", nx, ny, skill.AoeRadius*1.35, 1.15, 22, 135, 0.3, "#BAE6FD", "#0284C7", now)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-caster.X, foe.Y-caster.Y) <= skill.AoeRadius*1.4 {
					if now.Before(foe.SlowUntil) {
						if stEnd := now.Add(1150 * time.Millisecond); stEnd.After(foe.StunUntil) {
							foe.StunUntil = stEnd
						}
					} else if slEnd := now.Add(1800 * time.Millisecond); slEnd.After(foe.SlowUntil) {
						foe.SlowUntil = slEnd
					}
				}
			}
			e.appendZone(rs, caster, "gray_ice_shield", caster.X+nx*42, caster.Y+ny*42, skill.AoeRadius, "#BAE6FD", "#38BDF8", 1.6, 0, 0, 8, 0.55, 0, 1.4, false)
		case 3: // Ice Devil's Zerø Destruction Bow — piercing giant Devil Ice Arrow that detonates into blizzard
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "gray_devil_arrow", Radius: 18, Damage: 46, StunSec: 0.9, Knockback: 95,
				Piercing: true, ExplodeRadius: skill.AoeRadius, ExplodeKind: "gray_devil_rage",
				Life: 0.72, MaxLife: 0.72, Color: "#0284C7", AccentColor: "#E0F2FE",
			}, nx, ny, 920)
			e.appendZone(rs, caster, "gray_devil_rage", zx, zy, skill.AoeRadius, "#0284C7", "#E0F2FE", 1.8, 0.28, 0, 18, 0.45, 0.65, 2.2, false)
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
		case 1: // Slime Blade Double Wave — melee slash + piercing shadow crescent projectile
			hits = e.fireConeSweep(rs, caster, "cid_shadow_slash", nx, ny, skill.AoeRadius*1.35, 1.05, 24, 38, 0.24, "#7C3AED", "#38BDF8", now)
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "cid_slime_wave", Radius: 13, Damage: 18, Knockback: 28,
				Piercing: true, Life: 0.48, MaxLife: 0.48, Color: "#7C3AED", AccentColor: "#38BDF8",
			}, nx, ny, 880)
		case 2: // Shadow Step — assassin blink behind nearest target near aim (or clean shadow blink)
			prevX, prevY := caster.X, caster.Y
			if caster.PassiveStacks < 5 {
				caster.PassiveStacks++
			}
			caster.PassiveUntil = now.Add(7 * time.Second)
			if target := findLockOnTarget(rs, caster, zx, zy, 340, now); target != nil {
				tdx, tdy := target.AimDX, target.AimDY
				if mag := math.Hypot(tdx, tdy); mag > 0.01 {
					tdx /= mag
					tdy /= mag
				} else {
					tdx, tdy = nx, ny
				}
				caster.X, caster.Y = resolveObstacles(target.X-tdx*48, target.Y-tdy*48, rs.Map)
				toX, toY, _ := normalizeAim(caster, target.X, target.Y)
				caster.AimDX, caster.AimDY = toX, toY
				e.addBeamVisual(rs, caster, "cid_shadow_step", prevX, prevY, caster.X, caster.Y, 44, 0.26, "#38BDF8", "#7C3AED")
				hits = e.fireConeSweep(rs, caster, "cid_shadow_slash", toX, toY, 115, 1.0, 26, 36, 0.24, "#7C3AED", "#38BDF8", now)
			} else {
				caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 275, rs.Map)
				hits = e.fireLineFromTo(rs, caster, "cid_shadow_step", prevX, prevY, caster.X, caster.Y, 54, 20, 32, 0.28, "#38BDF8", "#7C3AED", now)
			}
		case 3: // I AM ATOMIC — 2-stage arcane singularity (nullifies projectiles + pulls) -> nuclear violet detonation scaled by Shadow stacks
			bonusDmg := caster.PassiveStacks * 5
			caster.PassiveStacks = 0
			e.appendZone(rs, caster, "cid_atomic", zx, zy, skill.AoeRadius*1.12, "#6D28D9", "#38BDF8", 1.75, 0.55, 130, 56+bonusDmg, 2.0, 0.85, 1.8, false)
			e.appendZone(rs, caster, "cid_atomic_outer", zx, zy, skill.AoeRadius*1.55, "#38BDF8", "#7C3AED", 1.15, 0.65, -90, 22, 2.0, 0, 1.4, false)
		}

	case "pop":
		switch slot {
		case 1: // Ravenous Lunge — predator lunge bite with 50% true lifesteal!
			caster.X, caster.Y = stepDashAvoidingPillars(caster.X, caster.Y, nx, ny, 165, rs.Map)
			hits = e.fireLineBeam(rs, caster, "pop_ghost_claw", nx, ny, skill.CastRange*0.72, 74, 30, 42, 0.26, "#22C55E", "#A3E635", now)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-caster.X, foe.Y-caster.Y) <= 135 {
					caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+15)))
					break
				}
			}
		case 2: // Spirit Possession — launches homing ghoul spirit that curses & drains target area
			target := findLockOnTarget(rs, caster, zx, zy, skill.CastRange, now)
			tid := ""
			if target != nil {
				tid = target.ID
			}
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "pop_possession_orb", Radius: 13, Damage: 20, Knockback: 18,
				TargetID: tid, HomingSpeed: 760, ExplodeRadius: skill.AoeRadius,
				SpawnPoolKind: "pop_possession", Life: 0.72, MaxLife: 0.72,
				Color: "#15803D", AccentColor: "#A3E635",
			}, nx, ny, 760)
			e.appendZone(rs, caster, "pop_possession", zx, zy, skill.AoeRadius, "#15803D", "#A3E635", 1.8, 0.2, 0, 14, 0.6, 0.35, 1.8, false)
		case 3: // Blood Moon Feast — berserk ghoul frenzy (4s rapid attack + heal + life-sapping fang wave)
			caster.RapidAttackUntil = now.Add(4200 * time.Millisecond)
			caster.BuffUntil = now.Add(4200 * time.Millisecond)
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+28)))
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius*1.1, 34, 0.45, 78, now)
			e.appendZone(rs, caster, "pop_endless_hunger", caster.X, caster.Y, skill.AoeRadius, "#22C55E", "#A3E635", 3.0, 0, 75, 12, 0.55, 0, 1.2, true)
		}

	case "speed_grandma":
		switch slot {
		case 1: // 120 km/h Drift Dash — extreme high-speed rush stacking passive momentum!
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 315, rs.Map)
			if caster.PassiveStacks < 5 {
				caster.PassiveStacks++
			}
			caster.PassiveUntil = now.Add(2400 * time.Millisecond)
			hits = e.fireLineFromTo(rs, caster, "grandma_dash", prevX, prevY, caster.X, caster.Y, 76, 30, 90, 0.28, "#EF4444", "#FCA5A5", now)
		case 2: // Highway Afterimage — leaves explosive speed-echo behind while surging forward at hyper speed!
			prevX, prevY := caster.X, caster.Y
			caster.BuffUntil = now.Add(2800 * time.Millisecond)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 210, rs.Map)
			e.appendZone(rs, caster, "grandma_phantom_trail", prevX, prevY, skill.AoeRadius, "#F87171", "#111827", 1.2, 0.3, 0, 28, 1.5, 0, 1.4, false)
			e.addBeamVisual(rs, caster, "grandma_dash", prevX, prevY, caster.X, caster.Y, 52, 0.26, "#EF4444", "#FEF08A")
		case 3: // Midnight Expressway — 3-segment lightning-fast zigzag expressway blitz through target point!
			caster.BuffUntil = now.Add(3000 * time.Millisecond)
			px, py := -ny, nx
			p0x, p0y := caster.X, caster.Y
			p1x, p1y := resolveObstacles(zx+px*115, zy+py*115, rs.Map)
			p2x, p2y := resolveObstacles(zx-px*115, zy-py*115, rs.Map)
			p3x, p3y := resolveObstacles(zx+nx*75, zy+ny*75, rs.Map)
			h1 := e.fireLineFromTo(rs, caster, "grandma_death_chase", p0x, p0y, p1x, p1y, 70, 22, 40, 0.34, "#DC2626", "#FCA5A5", now)
			h2 := e.fireLineFromTo(rs, caster, "grandma_death_chase", p1x, p1y, p2x, p2y, 70, 22, 40, 0.38, "#EF4444", "#FEF08A", now)
			h3 := e.fireLineFromTo(rs, caster, "grandma_death_chase", p2x, p2y, p3x, p3y, 74, 24, 95, 0.42, "#DC2626", "#FCA5A5", now)
			caster.X, caster.Y = p3x, p3y
			hits = append(append(h1, h2...), h3...)
			e.appendZone(rs, caster, "grandma_death_chase", zx, zy, skill.AoeRadius, "#DC2626", "#FCA5A5", 1.1, 0, 0, 12, 0.35, 0.35, 1.1, false)
		}

	case "krahang":
		switch slot {
		case 1: // Sacred Pestle Smash — sweeping heavy pestle slam + ground tremor projectile
			hits = e.fireConeSweep(rs, caster, "krahang_pestle_strike", nx, ny, skill.AoeRadius*1.15, 1.05, 30, 95, 0.25, "#D97706", "#FEF08A", now)
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "krahang_tremor", Radius: 14, Damage: 16, Knockback: 75,
				Piercing: true, Life: 0.42, MaxLife: 0.42, Color: "#D97706", AccentColor: "#FEF08A",
			}, nx, ny, 760)
		case 2: // Winnowing-Basket Gust — soars forward while blasting a wind gust behind him!
			prevX, prevY := caster.X, caster.Y
			caster.BuffUntil = now.Add(2600 * time.Millisecond)
			e.applyRadialImpact(rs, caster, prevX, prevY, 115, 16, 0, 155, now)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 285, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "krahang_wind_flight", prevX, prevY, caster.X, caster.Y, 84, 24, 95, 0.3, "#F59E0B", "#FEF08A", now)
		case 3: // Monsoon Krahang Vortex — swirling twister pulls foes inward then flings them outward!
			e.appendZone(rs, caster, "krahang_storm", zx, zy, skill.AoeRadius*1.12, "#B45309", "#FEF08A", 2.2, 0, 165, 16, 0.5, 0.35, 1.4, false)
			e.appendZone(rs, caster, "krahang_storm_burst", zx, zy, skill.AoeRadius*1.3, "#F59E0B", "#FEF08A", 0.9, 1.4, -155, 24, 2.0, 0, 1.0, false)
		}

	case "krasue":
		switch slot {
		case 1: // Cursed Lantern Beam — instant crimson spirit beam (triggers Spirit Blood lifesteal!) + burning wisp
			hits = e.fireLineBeam(rs, caster, "krasue_crimson_beam", nx, ny, skill.CastRange, skill.AoeRadius, 32, 32, 0.34, "#F43F5E", "#FB923C", now)
		case 2: // Severed Flight — rapid spectral flight dash leaving cursed floating mist behind (no generic invuln!)
			prevX, prevY := caster.X, caster.Y
			caster.BuffUntil = now.Add(2400 * time.Millisecond)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 245, rs.Map)
			e.addBeamVisual(rs, caster, "krasue_crimson_beam", prevX, prevY, caster.X, caster.Y, 44, 0.28, "#FB923C", "#F43F5E")
			e.appendZone(rs, caster, "krasue_floating_curse", prevX, prevY, skill.AoeRadius, "#FB923C", "#F43F5E", 2.4, 0, 0, 12, 0.55, 0, 1.6, false)
		case 3: // Midnight Blood Drain — spectral tether beams drain HP from EVERY enemy in range!
			drainHeal := 0
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-zx, foe.Y-zy) <= skill.AoeRadius+80 {
					e.addBeamVisual(rs, caster, "krasue_blood_tether", caster.X, caster.Y, foe.X, foe.Y, 28, 0.48, "#E11D48", "#FB923C")
					if ev, died := e.damagePlayerCC(foe, caster, caster.ID, caster.Name, 36, 0.45, 1.5, caster.X-foe.X, caster.Y-foe.Y, 45, rs.Map, now); died {
						hits = append(hits, ev)
					}
					drainHeal += 20
				}
			}
			if drainHeal > 0 {
				caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+drainHeal)))
			}
			e.appendZone(rs, caster, "krasue_midnight_horror", zx, zy, skill.AoeRadius, "#E11D48", "#FB923C", 1.6, 0.2, 65, 18, 0.55, 0.35, 1.5, false)
		}

	case "po":
		switch slot {
		case 1: // Panda Rolling Strike — rolls forward like a kung fu cannonball bowling foes aside!
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 160, rs.Map)
			hits = e.fireConeSweep(rs, caster, "po_panda_punch", nx, ny, skill.AoeRadius*1.1, 1.05, 32, 145, 0.26, "#FACC15", "#F8FAFC", now)
		case 2: // Belly Bounce Counter — 1.15s stance bouncing enemy projectiles RIGHT BACK + radial belly bounce!
			caster.CounterUntil = now.Add(1150 * time.Millisecond)
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius*1.1, 26, 0.55, 175, now)
			e.appendZone(rs, caster, "po_belly_bounce", caster.X, caster.Y, skill.AoeRadius, "#F8FAFC", "#FACC15", 0.9, 0, -145, 0, 1, 0, 0, true)
		case 3: // Wuxi Finger Hold ("Skadoosh!") — snaps onto closest target & detonates massive golden peach-blossom shockwave!
			if target := findLockOnTarget(rs, caster, zx, zy, skill.CastRange, now); target != nil {
				caster.X, caster.Y = resolveObstacles(target.X-nx*42, target.Y-ny*42, rs.Map)
				zx, zy = target.X, target.Y
			}
			hits = e.applyRadialImpact(rs, caster, zx, zy, skill.AoeRadius*1.25, 52, 0.7, 195, now)
			e.appendZone(rs, caster, "po_wuxi_finger", zx, zy, skill.AoeRadius*1.25, "#EAB308", "#F9A8D4", 1.45, 0, -185, 14, 0.7, 0, 1.4, false)
		}

	case "tai_lung":
		switch slot {
		case 1: // Pressure Point Nerve Strike — disables & heavily slows struck target!
			hits = e.fireConeSweep(rs, caster, "tailung_nerve_strike", nx, ny, skill.AoeRadius*1.2, 0.92, 28, 25, 0.24, "#3B82F6", "#E2E8F0", now)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-caster.X, foe.Y-caster.Y) <= skill.AoeRadius*1.25 {
					if stEnd := now.Add(650 * time.Millisecond); stEnd.After(foe.StunUntil) {
						foe.StunUntil = stEnd
					}
					if slEnd := now.Add(2200 * time.Millisecond); slEnd.After(foe.SlowUntil) {
						foe.SlowUntil = slEnd
					}
				}
			}
		case 2: // Leopard Wall Pounce — long predator leap; refunds 45% CD on takedown!
			prevX, prevY := caster.X, caster.Y
			dashDist := clamp(targetDist-32, 90, 310)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, dashDist, rs.Map)
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 28, 0.55, 80, now)
			if len(hits) > 0 {
				caster.CooldownUntil[1] = now.Add(2500 * time.Millisecond)
			}
			e.addBeamVisual(rs, caster, "tailung_flying_leap", prevX, prevY, caster.X, caster.Y, 48, 0.28, "#60A5FA", "#E2E8F0")
		case 3: // Furious Blue-Flame Barrage — 4-direction criss-cross blue-flame blink assault!
			for i := 0; i < 4; i++ {
				ang := math.Atan2(ny, nx) + float64(i)*math.Pi*0.5 + 0.35
				sx := zx - math.Cos(ang)*skill.AoeRadius*0.95
				sy := zy - math.Sin(ang)*skill.AoeRadius*0.95
				ex := zx + math.Cos(ang)*skill.AoeRadius*0.95
				ey := zy + math.Sin(ang)*skill.AoeRadius*0.95
				h := e.fireLineFromTo(rs, caster, "tailung_thousand_strikes", sx, sy, ex, ey, 46, 16, 32, 0.36+float64(i)*0.06, "#1D4ED8", "#93C5FD", now)
				hits = append(hits, h...)
			}
			caster.X, caster.Y = resolveObstacles(zx, zy, rs.Map)
			e.appendZone(rs, caster, "tailung_thousand_strikes", zx, zy, skill.AoeRadius, "#1D4ED8", "#E2E8F0", 1.0, 0, 0, 10, 0.35, 0.3, 1.0, false)
		}

	case "kai":
		switch slot {
		case 1: // Dual Jade Blades — twin curving boomerang jade chain-blades!
			for _, ang := range []float64{-0.18, 0.18} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind: "kai_jade_whip", Radius: 12, Damage: 22, Knockback: 28,
					Piercing: true, Boomerang: true, Life: 0.78, MaxLife: 0.78,
					Color: "#10B981", AccentColor: "#A7F3D0",
				}, ax, ay, 820)
			}
			hits = e.fireLineBeam(rs, caster, "kai_jade_whip", nx, ny, skill.CastRange*0.65, 48, 18, 28, 0.24, "#10B981", "#A7F3D0", now)
		case 2: // Jade Spirit Chains — hooks & yanks target to Kai + Chi Drain heal!
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "kai_spirit_chains", Radius: 13, Damage: 24, StunSec: 0.8,
				PullOnHit: 190, Life: 0.68, MaxLife: 0.68, Color: "#34D399", AccentColor: "#064E3B",
			}, nx, ny, 880)
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+14)))
		case 3: // Jombies: Army of Jade — launches 4 homing jade spirit warriors + emerald crystal field!
			target := findLockOnTarget(rs, caster, zx, zy, 520, now)
			tid := ""
			if target != nil {
				tid = target.ID
			}
			for i := 0; i < 4; i++ {
				ang := float64(i) * math.Pi * 0.5
				ax, ay := math.Cos(ang), math.Sin(ang)
				e.addProjectileAt(rs, caster, state.Projectile{
					Kind: "kai_jade_wraith", Radius: 12, Damage: 18, Knockback: 35,
					TargetID: tid, HomingSpeed: 640, Life: 1.4, MaxLife: 1.4,
					Color: "#059669", AccentColor: "#A7F3D0",
				}, zx+ax*55, zy+ay*55, ax, ay, 580)
			}
			e.appendZone(rs, caster, "kai_jade_army", zx, zy, skill.AoeRadius, "#059669", "#A7F3D0", 3.4, 0.2, 55, 14, 0.6, 0, 1.0, false)
		}

	case "gambit":
		switch slot {
		case 1: // 52-Card Pickup — 3-card kinetic fan that explodes AND ricochets (ChainLeft: 1)!
			for _, ang := range []float64{-0.22, 0, 0.22} {
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind: "gambit_explosive_cards", Radius: 10, Damage: 18, Knockback: 24,
					ExplodeRadius: 72, ChainLeft: 1, ChainRadius: 155,
					Life: skill.CastRange / 840, MaxLife: skill.CastRange / 840,
					Color: "#EC4899", AccentColor: "#A855F7",
				}, ax, ay, 840)
			}
		case 2: // Acrobatic Bo Vault — vaults forward while planting a kinetic trap card behind!
			prevX, prevY := caster.X, caster.Y
			e.appendZone(rs, caster, "gambit_trap_card", prevX, prevY, 86, "#EC4899", "#FACC15", 1.1, 0.45, 0, 28, 2.0, 0.35, 1.2, false)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 235, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "gambit_bo_staff", prevX, prevY, caster.X+nx*85, caster.Y+ny*85, 68, 26, 95, 0.26, "#A855F7", "#F8FAFC", now)
		case 3: // Royal Flush (10-J-Q-K-A) — fires 5 sequential exploding cards in a piercing kinetic line!
			for i := 0; i < 5; i++ {
				spd := 660.0 + float64(i)*75.0
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind: "gambit_royal_flush_card", Radius: 12, Damage: 16, Knockback: 35,
					ExplodeRadius: 92, Piercing: false,
					Life: 0.45 + float64(i)*0.12, MaxLife: 0.45 + float64(i)*0.12,
					Color: "#DB2777", AccentColor: "#FACC15",
				}, nx, ny, spd)
			}
			e.appendZone(rs, caster, "gambit_royal_flush", zx, zy, skill.AoeRadius, "#DB2777", "#FACC15", 1.35, 0.32, 0, 36, 2.0, 0.65, 1.4, false)
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
		case 1: // Amputate — razor surgical blade; 1.6x range & extra damage while inside ROOM!
			inRoom := now.Before(caster.PassiveUntil)
			cutRange := skill.CastRange
			dmg := 30
			if inRoom {
				cutRange *= 1.55
				dmg = 40
			}
			hits = e.fireLineBeam(rs, caster, "law_amputate", nx, ny, cutRange, 48, dmg, 30, 0.26, "#0EA5E9", "#E0F2FE", now)
		case 2: // ROOM: Shambles — deploys ROOM & literally SWAPS POSITIONS with enemy near target point!
			caster.PassiveUntil = now.Add(5200 * time.Millisecond)
			e.appendZone(rs, caster, "law_shambles_room", zx, zy, skill.AoeRadius*1.15, "#38BDF8", "#E0F2FE", 4.8, 0, 0, 6, 1.1, 0, 0.9, false)
			if swapTarget := findLockOnTarget(rs, caster, zx, zy, skill.CastRange+90, now); swapTarget != nil && math.Hypot(swapTarget.X-zx, swapTarget.Y-zy) <= skill.AoeRadius+65 {
				oldX, oldY := caster.X, caster.Y
				tx, ty := swapTarget.X, swapTarget.Y
				caster.X, caster.Y = resolveObstacles(tx, ty, rs.Map)
				swapTarget.X, swapTarget.Y = resolveObstacles(oldX, oldY, rs.Map)
				e.addBeamVisual(rs, caster, "law_shambles_swap", oldX, oldY, caster.X, caster.Y, 36, 0.3, "#38BDF8", "#FACC15")
				if slEnd := now.Add(1100 * time.Millisecond); slEnd.After(swapTarget.SlowUntil) {
					swapTarget.SlowUntil = slEnd
				}
			} else {
				oldX, oldY := caster.X, caster.Y
				caster.X, caster.Y = resolveObstacles(zx, zy, rs.Map)
				e.addBeamVisual(rs, caster, "law_shambles_swap", oldX, oldY, caster.X, caster.Y, 32, 0.26, "#38BDF8", "#E0F2FE")
			}
		case 3: // K-ROOM: Puncture Wille — giant armor/invuln-piercing underground shock trench beam!
			hits = e.fireLineBeam(rs, caster, "law_puncture_wille", nx, ny, skill.CastRange*1.25, 108, 56, 110, 0.55, "#0EA5E9", "#FACC15", now)
			endX := clamp(caster.X+nx*skill.CastRange*1.25, 0, rs.Map.Width)
			endY := clamp(caster.Y+ny*skill.CastRange*1.25, 0, rs.Map.Height)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && pointToSegmentDist(foe.X, foe.Y, caster.X, caster.Y, endX, endY) <= 58+rs.Map.PlayerRadius {
					foe.InvulnUntil = time.Time{} // Puncture Wille bypasses external armor/invuln
					if stEnd := now.Add(750 * time.Millisecond); stEnd.After(foe.StunUntil) {
						foe.StunUntil = stEnd
					}
				}
			}
			e.appendZone(rs, caster, "law_puncture_wille", caster.X+nx*180, caster.Y+ny*180, skill.AoeRadius, "#0EA5E9", "#FACC15", 1.1, 0, -110, 18, 0.9, 0, 1.4, false)
		}

	case "garp":
		switch slot {
		case 1: // Galaxy Impact — heroic Haki leap straight onto (zx, zy) slamming a radial shockwave crater!
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, clamp(targetDist, 85, skill.CastRange), rs.Map)
			e.addBeamVisual(rs, caster, "garp_iron_fist", prevX, prevY, caster.X, caster.Y, 54, 0.26, "#1E293B", "#DC2626")
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 38, 0.55, 145, now)
			e.appendZone(rs, caster, "garp_galaxy_impact", caster.X, caster.Y, skill.AoeRadius*1.1, "#DC2626", "#18181B", 1.15, 0, -135, 12, 0.9, 0, 1.3, false)
		case 2: // Blue Hole — lunges forward, grabs & slams enemies into the earth!
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 200, rs.Map)
			hits = e.fireConeSweep(rs, caster, "garp_iron_fist", nx, ny, 130, 1.0, 32, 165, 0.28, "#1E293B", "#DC2626", now)
			e.appendZone(rs, caster, "garp_blue_hole", caster.X+nx*55, caster.Y+ny*55, 110, "#18181B", "#DC2626", 0.9, 0, 90, 14, 0.8, 0.45, 1.5, false)
		case 3: // Galaxy Divide — colossal arena-splitting Conqueror Haki trench wave!
			hits = e.fireLineBeam(rs, caster, "garp_galaxy_divide", nx, ny, 560, 124, 62, 155, 0.52, "#DC2626", "#09090B", now)
			e.appendZone(rs, caster, "garp_galaxy_divide", caster.X+nx*220, caster.Y+ny*220, skill.AoeRadius, "#EF4444", "#09090B", 1.2, 0, -120, 16, 0.9, 0.5, 1.5, false)
		}

	case "tansan":
		switch slot {
		case 1: // Fizzy Canister Toss — pressurized soda bomb that ricochets (ChainLeft: 1) & pops fizzy pool!
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "tansan_bubble_orb", Radius: 12, Damage: 24, Knockback: 48,
				ExplodeRadius: skill.AoeRadius, SpawnPoolKind: "tansan_bubble_shot",
				ChainLeft: 1, ChainRadius: 150, Life: 0.68, MaxLife: 0.68,
				Color: "#38BDF8", AccentColor: "#F8FAFC",
			}, nx, ny, 780)
			e.appendZone(rs, caster, "tansan_bubble_shot", zx, zy, skill.AoeRadius, "#38BDF8", "#F8FAFC", 1.3, 0.25, 0, 20, 1.5, 0, 1.4, false)
		case 2: // Carbonation Jet Boost — jet-dashes forward while healing & hasting nearby allies!
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 195, rs.Map)
			caster.BuffUntil = now.Add(3000 * time.Millisecond)
			for _, member := range rs.Players {
				if member.Alive && !isEnemy(rs, caster, member) && math.Hypot(member.X-caster.X, member.Y-caster.Y) <= skill.AoeRadius+40 {
					member.HP = int(math.Min(float64(member.MaxHP), float64(member.HP+24)))
					member.BuffUntil = now.Add(2800 * time.Millisecond)
				}
			}
			e.appendZone(rs, caster, "tansan_soda_boost", caster.X, caster.Y, skill.AoeRadius, "#F8FAFC", "#38BDF8", 1.6, 0, 0, 0, 1, 0, 0, true)
		case 3: // Super Mentos Geyser — violent radial soda geyser blasting foes outward + 6 radial fizz bursts!
			e.appendZone(rs, caster, "tansan_carbonation_boom", zx, zy, skill.AoeRadius*1.12, "#0284C7", "#F8FAFC", 1.6, 0.3, -170, 44, 2.0, 0.45, 2.0, false)
			for i := 0; i < 6; i++ {
				a := float64(i) * (math.Pi / 3.0)
				e.addProjectileAt(rs, caster, state.Projectile{
					Kind: "tansan_basic_fizz", Radius: 10, Damage: 12, Knockback: 55,
					Life: 0.48, MaxLife: 0.48, Color: "#38BDF8", AccentColor: "#F8FAFC",
				}, zx, zy, math.Cos(a), math.Sin(a), 640)
			}
		}

	case "wukong":
		switch slot {
		case 1: // Ruyi Jingu Bang — long-range staff thrust with Sweet-Spot Tip Bonus (+40% dmg at outer half!)
			hits = e.fireLineBeam(rs, caster, "wukong_golden_staff", nx, ny, skill.CastRange*1.2, 52, 28, 75, 0.3, "#F59E0B", "#DC2626", now)
			tipX := caster.X + nx*skill.CastRange*0.92
			tipY := caster.Y + ny*skill.CastRange*0.92
			tipHits := e.applyRadialImpact(rs, caster, tipX, tipY, 72, 14, 0.35, 95, now)
			hits = append(hits, tipHits...)
		case 2: // 72 Transformations: Cloud Decoy — leaves exploding clone decoy behind while dashing on Somersault Cloud!
			prevX, prevY := caster.X, caster.Y
			e.appendZone(rs, caster, "wukong_decoy_zone", prevX, prevY, 95, "#F59E0B", "#FEF08A", 1.0, 0.65, 0, 34, 2.0, 0.4, 1.1, false)
			caster.BuffUntil = now.Add(2200 * time.Millisecond)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 285, rs.Map)
			e.addBeamVisual(rs, caster, "wukong_cloud_dash", prevX, prevY, caster.X, caster.Y, 64, 0.32, "#FEF08A", "#F59E0B")
		case 3: // Great Sage: Colossal Giant Staff Slam down a wide corridor + Great Sage haste!
			caster.BuffUntil = now.Add(4500 * time.Millisecond)
			caster.RapidAttackUntil = now.Add(4000 * time.Millisecond)
			hits = e.fireLineBeam(rs, caster, "wukong_great_sage", nx, ny, 520, 112, 58, 130, 0.5, "#DC2626", "#FACC15", now)
			e.appendZone(rs, caster, "wukong_great_sage", caster.X+nx*220, caster.Y+ny*220, skill.AoeRadius, "#DC2626", "#F59E0B", 1.2, 0, -90, 14, 0.8, 0.55, 1.3, false)
		}

	case "nezha":
		switch slot {
		case 1: // Fire-Tipped Spear — piercing spear lunge + blazing spearhead bolt
			hits = e.fireLineBeam(rs, caster, "nezha_fire_spear", nx, ny, skill.CastRange*0.85, 52, 24, 48, 0.26, "#F97316", "#FEF08A", now)
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "nezha_spear_bolt", Radius: 11, Damage: 20, Knockback: 35,
				Piercing: true, Life: 0.48, MaxLife: 0.48, Color: "#F97316", AccentColor: "#FEF08A",
			}, nx, ny, 920)
		case 2: // Wind Fire Wheels — high-speed surge that leaves burning flame trail zones while moving!
			caster.BuffUntil = now.Add(3200 * time.Millisecond)
			e.appendZone(rs, caster, "nezha_wind_wheels", caster.X, caster.Y, skill.AoeRadius, "#FEF08A", "#F97316", 3.0, 0, 0, 10, 0.55, 0, 0.8, true)
		case 3: // Universe Ring & Lotus Inferno — throws Boomerang Universe Ring + blooming fire lotus!
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "nezha_universe_ring", Radius: 16, Damage: 36, StunSec: 0.75, Knockback: 45,
				Piercing: true, Boomerang: true, Life: 0.95, MaxLife: 0.95, Color: "#FACC15", AccentColor: "#F97316",
			}, nx, ny, 860)
			e.appendZone(rs, caster, "nezha_lotus_inferno", zx, zy, skill.AoeRadius*1.05, "#EA580C", "#FEF08A", 1.6, 0.3, 0, 26, 0.45, 0.4, 1.4, false)
		}

	case "king":
		switch slot {
		case 1: // King Engine Roar — terrifying heartbeat wave FEAR-PUSHES enemies backward!
			hits = e.fireConeSweep(rs, caster, "king_legendary_glare", nx, ny, skill.CastRange, 1.1, 20, 145, 0.3, "#FACC15", "#94A3B8", now)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-caster.X, foe.Y-caster.Y) <= skill.AoeRadius+40 {
					if slowEnd := now.Add(2400 * time.Millisecond); slowEnd.After(foe.SlowUntil) {
						foe.SlowUntil = slowEnd
					}
				}
			}
		case 2: // Lucky Stumble — comical stumble dodge granting brief grace & burst movement speed!
			caster.InvulnUntil = now.Add(650 * time.Millisecond)
			caster.BuffUntil = now.Add(2200 * time.Millisecond)
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+16)))
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 255, rs.Map)
			e.addBeamVisual(rs, caster, "king_lucky_escape", prevX, prevY, caster.X, caster.Y, 42, 0.3, "#94A3B8", "#FACC15")
		case 3: // Ultimate Hellfire Wavemotion Bluff -> SAITAMA ASSIST!
			// King poses menacingly (King Engine zone) while a surprise Saitama Serious Punch tears through the zone!
			e.appendZone(rs, caster, "king_s_reputation", zx, zy, skill.AoeRadius, "#EAB308", "#0F172A", 1.4, 0.2, 0, 18, 0.7, 0.55, 2.0, false)
			hits = e.fireLineBeam(rs, caster, "saitama_serious_punch", nx, ny, 640, 118, 54, 185, 0.46, "#F97316", "#FEF9C3", now)
		}

	case "gon":
		switch slot {
		case 1: // Jajanken: Rock — extreme knockback Nen punch with Wall-Slam bonus!
			hits = e.fireConeSweep(rs, caster, "gon_jajanken_rock", nx, ny, skill.AoeRadius*1.4, 0.95, 38, 175, 0.28, "#FACC15", "#22C55E", now)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-caster.X, foe.Y-caster.Y) <= skill.AoeRadius*1.5 {
					nearEdge := foe.X <= 95 || foe.X >= rs.Map.Width-95 || foe.Y <= 95 || foe.Y >= rs.Map.Height-95
					if nearEdge {
						if ev, died := e.damagePlayerCC(foe, caster, caster.ID, caster.Name, 18, 0.85, 0.8, nx, ny, 40, rs.Map, now); died {
							hits = append(hits, ev)
						}
					}
				}
			}
		case 2: // Jajanken: Paper & Scissors — shoots Nen Paper orb AND slashes with Scissors blade!
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "gon_jajanken_paper", Radius: 13, Damage: 22, Knockback: 45,
				ExplodeRadius: 72, Life: 0.62, MaxLife: 0.62, Color: "#FACC15", AccentColor: "#FEF08A",
			}, nx, ny, 760)
			hits = e.fireLineBeam(rs, caster, "gon_jajanken_scissors", nx, ny, skill.CastRange*0.82, 54, 26, 30, 0.28, "#22C55E", "#FACC15", now)
		case 3: // Vow & Limitation: Adult Gon — sacrifices 18% HP, resets Q/E cooldowns, dashes in for Execute punch!
			cost := int(math.Round(float64(caster.HP) * 0.18))
			if caster.HP-cost > 15 {
				caster.HP -= cost
			}
			caster.CooldownUntil[0] = time.Time{}
			caster.CooldownUntil[1] = time.Time{}
			caster.BuffUntil = now.Add(5 * time.Second)
			caster.RapidAttackUntil = now.Add(5 * time.Second)
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, clamp(targetDist, 95, skill.CastRange), rs.Map)
			e.addBeamVisual(rs, caster, "gon_adult_dash", prevX, prevY, caster.X, caster.Y, 64, 0.34, "#18181B", "#FACC15")
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-caster.X, foe.Y-caster.Y) <= skill.AoeRadius+rs.Map.PlayerRadius {
					missingPct := 1.0 - float64(foe.HP)/math.Max(1, float64(foe.MaxHP))
					execDmg := 44 + int(math.Round(missingPct*38))
					if ev, died := e.damagePlayerCC(foe, caster, caster.ID, caster.Name, execDmg, 0.65, 1.2, nx, ny, 140, rs.Map, now); died {
						hits = append(hits, ev)
					}
				}
			}
			e.appendZone(rs, caster, "gon_adult_gon", caster.X, caster.Y, skill.AoeRadius, "#18181B", "#FACC15", 1.35, 0, -110, 12, 0.9, 0, 1.4, false)
		}

	case "steve":
		switch slot {
		case 1: // Diamond Sword Sweeping Edge — wide voxel cleave + crit knockback!
			hits = e.fireConeSweep(rs, caster, "steve_diamond_sword", nx, ny, skill.AoeRadius*1.45, 1.15, 34, 72, 0.26, "#06B6D4", "#A855F7", now)
		case 2: // Obsidian Wall & Golden Apple — eats Golden Apple (+24 HP + buff) & drops Obsidian knockback barricade!
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+24)))
			caster.BuffUntil = now.Add(2600 * time.Millisecond)
			wallX := clamp(caster.X+nx*64, rs.Map.PlayerRadius, rs.Map.Width-rs.Map.PlayerRadius)
			wallY := clamp(caster.Y+ny*64, rs.Map.PlayerRadius, rs.Map.Height-rs.Map.PlayerRadius)
			hits = e.applyRadialImpact(rs, caster, wallX, wallY, skill.AoeRadius, 18, 0, 155, now)
			e.appendZone(rs, caster, "steve_block_builder", wallX, wallY, skill.AoeRadius, "#1E1B4B", "#06B6D4", 3.2, 0, -95, 6, 0.8, 0, 1.6, false)
		case 3: // TNT Chain Detonation — drops 3 staggered lit TNT charges along aim direction!
			for i := 0; i < 3; i++ {
				distOff := float64(i-1) * 78.0
				tx := clamp(zx+nx*distOff, rs.Map.PlayerRadius, rs.Map.Width-rs.Map.PlayerRadius)
				ty := clamp(zy+ny*distOff, rs.Map.PlayerRadius, rs.Map.Height-rs.Map.PlayerRadius)
				e.appendZone(rs, caster, "steve_netherite_tnt", tx, ty, skill.AoeRadius*0.82, "#EF4444", "#FACC15", 1.25+float64(i)*0.2, 0.42+float64(i)*0.2, -135, 36, 2.0, 0.45, 1.2, false)
			}
		}

	case "doraemon":
		switch slot {
		case 1: // Air Cannon — giant high-knockback compressed air ring blasting enemies far back!
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "doraemon_air_cannon", Radius: 18, Damage: 28, Knockback: 165,
				Piercing: true, Life: skill.CastRange / 780, MaxLife: skill.CastRange / 780,
				Color: "#38BDF8", AccentColor: "#E0F2FE",
			}, nx, ny, 780)
		case 2: // Anywhere Door — teleports cleanly leaving TWO pink Anywhere Door portals (entry & exit)!
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = resolveObstacles(zx, zy, rs.Map)
			caster.BuffUntil = now.Add(2200 * time.Millisecond)
			e.appendZone(rs, caster, "doraemon_door_portal", prevX, prevY, 72, "#EC4899", "#F9A8D4", 2.2, 0, 0, 0, 1, 0, 0, false)
			e.appendZone(rs, caster, "doraemon_door_portal", caster.X, caster.Y, 72, "#EC4899", "#38BDF8", 2.2, 0, 0, 0, 1, 0, 0, false)
			e.addBeamVisual(rs, caster, "doraemon_anywhere_door", prevX, prevY, caster.X, caster.Y, 38, 0.3, "#EC4899", "#38BDF8")
		case 3: // Time Cloth & Small Light — heals allies inside (+26 HP) while shrinking & heavily slowing enemies!
			for _, member := range rs.Players {
				if member.Alive && !isEnemy(rs, caster, member) && math.Hypot(member.X-zx, member.Y-zy) <= skill.AoeRadius+35 {
					member.HP = int(math.Min(float64(member.MaxHP), float64(member.HP+26)))
					member.BuffUntil = now.Add(2800 * time.Millisecond)
				}
			}
			e.appendZone(rs, caster, "doraemon_time_machine", zx, zy, skill.AoeRadius*1.12, "#0284C7", "#FACC15", 2.0, 0.25, 0, 26, 0.65, 0.4, 2.4, false)
		}

	case "yami":
		switch slot {
		case 1: // Dark Cloaked Avidya Slash — piercing long-range dark crescent projectile
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "yami_dark_slash", Radius: 16, Damage: 32, Knockback: 42,
				Piercing: true, Life: skill.CastRange / 840, MaxLife: skill.CastRange / 840,
				Color: "#6B21A8", AccentColor: "#EF4444",
			}, nx, ny, 840)
		case 2: // Mana Zone: Black Moon — nullifies ALL incoming enemy projectiles inside the dome!
			e.appendZone(rs, caster, "yami_black_moon", caster.X, caster.Y, skill.AoeRadius*1.12, "#111827", "#6B21A8", 2.8, 0, 140, 12, 0.65, 0, 1.5, true)
		case 3: // Dimension Slash: Equinox — pierces obstacles & strips invulnerability across the arena!
			endX := clamp(caster.X+nx*skill.CastRange*1.25, 0, rs.Map.Width)
			endY := clamp(caster.Y+ny*skill.CastRange*1.25, 0, rs.Map.Height)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && pointToSegmentDist(foe.X, foe.Y, caster.X, caster.Y, endX, endY) <= skill.AoeRadius*0.7+rs.Map.PlayerRadius {
					foe.InvulnUntil = time.Time{} // Cuts through dimensions & invuln!
					if stEnd := now.Add(750 * time.Millisecond); stEnd.After(foe.StunUntil) {
						foe.StunUntil = stEnd
					}
				}
			}
			hits = e.fireLineBeam(rs, caster, "yami_dimension_slash", nx, ny, skill.CastRange*1.25, skill.AoeRadius, 60, 75, 0.48, "#9333EA", "#09090B", now)
		}

	case "escanor":
		switch slot {
		case 1: // Cruel Sun — throws a slow hovering miniature sun projectile that explodes into burning solar ground!
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "escanor_cruel_sun_orb", Radius: 20, Damage: 36, Knockback: 65,
				ExplodeRadius: skill.AoeRadius, ExplodeKind: "escanor_cruel_sun",
				SpawnPoolKind: "escanor_cruel_sun",
				Life:          skill.CastRange / 540, MaxLife: skill.CastRange / 540,
				Color: "#F97316", AccentColor: "#FEF08A",
			}, nx, ny, 540)
		case 2: // Divine Sword Escanor — scorching downward solar cleave + burning ground trail
			hits = e.fireConeSweep(rs, caster, "escanor_divine_sword", nx, ny, skill.CastRange*0.68, 1.05, 34, 72, 0.28, "#FACC15", "#FFFFFF", now)
			e.appendZone(rs, caster, "escanor_cruel_sun", caster.X+nx*90, caster.Y+ny*90, 92, "#F97316", "#FEF08A", 1.8, 0, 0, 12, 0.55, 0, 0.8, false)
		case 3: // High Noon: The One — scales with Sun Stacks, rapid solar fury + blazing radial burst
			sunBonus := caster.PassiveStacks * 6
			caster.BuffUntil = now.Add(6 * time.Second)
			caster.RapidAttackUntil = now.Add(5500 * time.Millisecond)
			caster.HP = int(math.Min(float64(caster.MaxHP), float64(caster.HP+24)))
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius*1.1, 46+sunBonus, 0.65, 130, now)
			e.appendZone(rs, caster, "escanor_the_one", caster.X, caster.Y, skill.AoeRadius, "#FEF08A", "#F59E0B", 3.2, 0, 0, 14, 0.65, 0, 0, true)
		}

	case "meliodas":
		switch slot {
		case 1: // True Full Counter — 1.35s counter stance reflecting both melee hits & projectiles at 1.8x damage!
			caster.CounterUntil = now.Add(1350 * time.Millisecond)
			hits = e.fireConeSweep(rs, caster, "meliodas_full_counter", nx, ny, skill.AoeRadius, 1.05, 22, 95, 0.26, "#38BDF8", "#F8FAFC", now)
		case 2: // Hellblaze — dashing purple-black demonic cleave leaving cursed flames
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 190, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "meliodas_hellblaze", prevX, prevY, caster.X+nx*85, caster.Y+ny*85, 76, 32, 46, 0.32, "#7E22CE", "#09090B", now)
			e.appendZone(rs, caster, "meliodas_hellblaze_pool", caster.X+nx*60, caster.Y+ny*60, 88, "#581C87", "#09090B", 2.0, 0, 0, 12, 0.5, 0, 1.2, false)
		case 3: // Assault Mode: Trillion Dark — unleashes 8 homing dark projectiles + Assault Mode fury!
			caster.RapidAttackUntil = now.Add(5 * time.Second)
			caster.BuffUntil = now.Add(4 * time.Second)
			target := findLockOnTarget(rs, caster, zx, zy, 520, now)
			tid := ""
			if target != nil {
				tid = target.ID
			}
			for i := 0; i < 8; i++ {
				ang := -0.7 + (float64(i)/7.0)*1.4
				ax, ay := rotateVec(nx, ny, ang)
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind: "meliodas_trillion_dark", Radius: 9, Damage: 12, Knockback: 18,
					TargetID: tid, HomingSpeed: 760, Life: 0.95, MaxLife: 0.95,
					Color: "#1E1B4B", AccentColor: "#9333EA",
				}, ax, ay, 680+float64(i%3)*55)
			}
			e.appendZone(rs, caster, "meliodas_assault_mode", caster.X, caster.Y, skill.AoeRadius*0.85, "#1E1B4B", "#9333EA", 2.4, 0, 0, 10, 0.65, 0, 1.0, true)
		}

	case "adam":
		switch slot {
		case 1: // Eyes of the Lord: Divine Copy — scales +55% with LastHitDamage & fires golden copy strike!
			dmg := 30 + int(math.Min(30, math.Round(float64(caster.LastHitDamage)*0.55)))
			hits = e.fireConeSweep(rs, caster, "adam_divine_rep", nx, ny, skill.AoeRadius*1.35, 1.0, dmg, 70, 0.24, "#FBBF24", "#F8FAFC", now)
		case 2: // Divine Weave — crisp sidestep dash priming Eyes of the Lord counter window
			caster.CounterUntil = now.Add(1600 * time.Millisecond)
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 220, rs.Map)
			e.addBeamVisual(rs, caster, "adam_divine_dodge", prevX, prevY, caster.X, caster.Y, 42, 0.26, "#F8FAFC", "#FBBF24")
		case 3: // The Fist That Surpassed Time — blinks to locked target, freezes them 0.55s, unleashes 5-hit golden flurry!
			prevX, prevY := caster.X, caster.Y
			if target := findLockOnTarget(rs, caster, zx, zy, skill.CastRange+60, now); target != nil {
				caster.X, caster.Y = resolveObstacles(target.X-nx*44, target.Y-ny*44, rs.Map)
				e.addBeamVisual(rs, caster, "adam_divine_dodge", prevX, prevY, caster.X, caster.Y, 48, 0.3, "#F8FAFC", "#FBBF24")
				if stEnd := now.Add(550 * time.Millisecond); stEnd.After(target.StunUntil) {
					target.StunUntil = stEnd
				}
				zx, zy = target.X, target.Y
			}
			z := state.ZoneEffect{
				ID: e.nextID("zone"), OwnerID: caster.ID, OwnerName: caster.Name, OwnerTeam: caster.Team,
				Kind: "adam_ultimate_father", X: zx, Y: zy, Radius: skill.AoeRadius,
				Color: "#F59E0B", AccentColor: "#F8FAFC", AimAngle: math.Atan2(ny, nx),
				Life: 1.0, MaxLife: 1.0, DelayLeft: 0.08, MaxDelay: 0.08,
				DamagePerTick: 14, TickInterval: 0.19, StunSec: 0.2,
			}
			rs.Zones = append(rs.Zones, z)
		}

	case "beelzebub":
		switch slot {
		case 1: // Palmyra: Vibration Blade — piercing high-velocity invisible vibration slash projectile
			e.addProjectileFull(rs, caster, state.Projectile{
				Kind: "beelz_chaos_wave", Radius: 15, Damage: 34, Knockback: 65,
				Piercing: true, Life: skill.CastRange / 920, MaxLife: skill.CastRange / 920,
				Color: "#6D28D9", AccentColor: "#A78BFA",
			}, nx, ny, 920)
		case 2: // Gates of Hell — vibration barrier that destroys enemy projectiles & blasts close foes back!
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 22, 0, 155, now)
			e.appendZone(rs, caster, "beelz_defensive_barrier", caster.X, caster.Y, skill.AoeRadius*1.12, "#A78BFA", "#4C1D95", 2.4, 0, -85, 0, 1, 0, 1.3, true)
		case 3: // Original Sin: Chaos — imploding vibration sphere (pull) -> violent outer shockwave blast (repel)!
			e.appendZone(rs, caster, "beelz_chaos_unleashed", zx, zy, skill.AoeRadius, "#4C1D95", "#EF4444", 1.55, 0.5, 140, 52, 2.0, 0.75, 1.6, false)
			e.appendZone(rs, caster, "beelz_chaos_outer", zx, zy, skill.AoeRadius*1.55, "#6D28D9", "#A78BFA", 1.1, 0.58, -145, 24, 2.0, 0, 1.4, false)
		}

	case "buddha":
		switch slot {
		case 1: // Six Realms Staff — cycles between Staff (push), Halberd Axe (wide cleave), and Scythe of Hatred (long pierce)!
			form := caster.PassiveStacks % 3
			caster.PassiveStacks = (caster.PassiveStacks + 1) % 3
			caster.PassiveUntil = now.Add(12 * time.Second)
			if form == 0 {
				hits = e.fireLineBeam(rs, caster, "buddha_divine_staff", nx, ny, skill.CastRange, 58, 30, 115, 0.28, "#FACC15", "#FEF08A", now)
			} else if form == 1 {
				hits = e.fireConeSweep(rs, caster, "buddha_axe_cleave", nx, ny, 165, 1.18, 38, 85, 0.28, "#F59E0B", "#FEF08A", now)
			} else {
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind: "buddha_scythe_rend", Radius: 16, Damage: 40, Knockback: 45,
					Piercing: true, Life: 0.52, MaxLife: 0.52, Color: "#9333EA", AccentColor: "#FACC15",
				}, nx, ny, 880)
			}
		case 2: // Future Sight: Soul Read — activates auto-evade Future Sight counter + nimble sidestep
			caster.CounterUntil = now.Add(1700 * time.Millisecond)
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 215, rs.Map)
			hits = e.fireLineFromTo(rs, caster, "buddha_enlightened_step", prevX, prevY, caster.X, caster.Y, 58, 22, 48, 0.28, "#FEF08A", "#38BDF8", now)
		case 3: // Zero: Mahapari Nirvana — colossal golden enlightenment sword cleave that strips enemy invuln + lotus sanctuary!
			endX := clamp(caster.X+nx*460, 0, rs.Map.Width)
			endY := clamp(caster.Y+ny*460, 0, rs.Map.Height)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && pointToSegmentDist(foe.X, foe.Y, caster.X, caster.Y, endX, endY) <= 78+rs.Map.PlayerRadius {
					foe.InvulnUntil = time.Time{}
				}
			}
			hits = e.fireLineBeam(rs, caster, "buddha_nirvana_wave", nx, ny, 460, 130, 58, 120, 0.48, "#FACC15", "#38BDF8", now)
			e.appendZone(rs, caster, "buddha_nirvana", caster.X+nx*180, caster.Y+ny*180, skill.AoeRadius, "#EAB308", "#38BDF8", 1.5, 0, 0, 12, 0.6, 0, 1.2, false)
		}

	case "cj_palony":
		switch slot {
		case 1: // Combo Breaker Dash — rapid 2-hit street rush; refunds 35% cooldown on hit!
			prevX, prevY := caster.X, caster.Y
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 155, rs.Map)
			hits = e.fireLineBeam(rs, caster, "cj_power_strike", nx, ny, skill.CastRange*0.85, 62, 34, 65, 0.28, "#38BDF8", "#F43F5E", now)
			for _, foe := range rs.Players {
				if isEnemy(rs, caster, foe) && math.Hypot(foe.X-caster.X, foe.Y-caster.Y) <= skill.CastRange*0.85 {
					caster.CooldownUntil[0] = now.Add(1600 * time.Millisecond)
					break
				}
			}
		case 2: // Phantom Feint — agile sidestep/backstep leaving a detonating flash-charge decoy!
			prevX, prevY := caster.X, caster.Y
			e.appendZone(rs, caster, "cj_phantom_move", prevX, prevY, skill.AoeRadius, "#F43F5E", "#38BDF8", 1.15, 0.3, 0, 28, 2.0, 0.35, 1.2, false)
			caster.X, caster.Y = stepDashAvoidingPillars(prevX, prevY, nx, ny, 275, rs.Map)
			caster.BuffUntil = now.Add(2200 * time.Millisecond)
		case 3: // Maxion Overdrive — unleashes 4-way street energy cross-barrage + 5s overdrive fury!
			caster.BuffUntil = now.Add(5 * time.Second)
			caster.RapidAttackUntil = now.Add(4800 * time.Millisecond)
			for i := 0; i < 4; i++ {
				a := math.Atan2(ny, nx) + float64(i)*math.Pi*0.5
				e.addProjectileFull(rs, caster, state.Projectile{
					Kind: "cj_basic_bolt", Radius: 12, Damage: 22, Knockback: 45,
					Piercing: true, Life: 0.52, MaxLife: 0.52, Color: "#F43F5E", AccentColor: "#38BDF8",
				}, math.Cos(a), math.Sin(a), 860)
			}
			hits = e.applyRadialImpact(rs, caster, caster.X, caster.Y, skill.AoeRadius, 42, 0.55, 125, now)
			e.appendZone(rs, caster, "cj_final_awakening", caster.X, caster.Y, skill.AoeRadius, "#F43F5E", "#38BDF8", 1.6, 0, -90, 10, 0.7, 0, 0, true)
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
	// Removed legacy fake 420px North-to-South horizontal beam that caused all 20 Roster-28
	// ultimates to visually look identical on detonation. Zone detonation visuals are now
	// driven by each hero's bespoke 3D sculpted VFX & lore mechanics.
	_ = rs
	_ = z
	_ = owner
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
