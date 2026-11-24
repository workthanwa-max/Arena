import { getBasicAttackRange, isTeamMatchMode, setSimoSnipeCharging, useGameStore } from '../store/useGameStore'
import type { MapConfig, PlayerState, Projectile, ZoneEffect } from '../types/game'
import { gameEventBus } from './core/eventBus'
import { isOnSisaketDryLand, SCP_CENTER_X, SCP_CENTER_Z, SCP_RADIUS } from './map3dBuilder'

/**
 * Grandmaster-Tier Admin-Only Autonomous Combat AI (`adminAutoAi.ts`)
 * Strictly gated to `authUser?.role === 'admin'`.
 * Runs 100% locally in the admin's browser at 25Hz decision rate using exact authoritative player channels:
 * - Frame-perfect incoming projectile & delayed telegraph zone dodging (sidestep + reactive Dash)
 * - Sisaket Ko Klang Nam water avoidance & instant land-recovery steering
 * - Pillar tangent sliding navigation (never gets stuck on obstacles)
 * - First-order velocity-lead predictive intercept aiming for every skill & basic attack
 * - Custom Grandmaster combo brain for ALL 14 heroes (incl. Gojo auto Hollow Purple fusion,
 *   Simo 100% max-charge snipe & backflip kite, Thanos auto 5-stone chain & instant Snap,
 *   Saitama non-invulnerable lock-on execution, Killua/Frame/Zenitsu CC-burst chains,
 *   Sukuna/Gojo Iconic RCT sustain, and 5-Archetype passive exploitation!)
 */

interface LiveWorldSnapshot {
  myPlayerId: string
  mapCfg: MapConfig | null
  players: PlayerState[]
  projectiles: Projectile[]
  zones: ZoneEffect[]
}

function idealRangeForHero(characterId: string): number {
  if (characterId === 'luangphi_sorn') return 95
  return Math.max(120, getBasicAttackRange(characterId) - 28)
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function normalize(x: number, y: number): { x: number; y: number; len: number } {
  const len = Math.hypot(x, y)
  if (len < 0.0001) return { x: 0, y: 0, len: 0 }
  return { x: x / len, y: y / len, len }
}

function pointHitsPillar(x: number, y: number, pad: number, cfg: MapConfig): boolean {
  for (const pil of cfg.pillars ?? []) {
    if (Math.hypot(x - pil.x, y - pil.y) < pil.radius + pad) return true
  }
  return false
}

function isSafeCoord(x: number, y: number, cfg: MapConfig): boolean {
  const margin = (cfg.playerRadius || 18) + 28
  if (x < margin || x > cfg.width - margin || y < margin || y > cfg.height - margin) return false
  if (cfg.id === 'scp_site' && Math.hypot(x - SCP_CENTER_X, y - SCP_CENTER_Z) > SCP_RADIUS - margin) return false
  if (cfg.id === 'sisaket_island' && !isOnSisaketDryLand(x, y)) return false
  if (pointHitsPillar(x, y, (cfg.playerRadius || 18) + 10, cfg)) return false
  return true
}

/** Finds nearest safe dry-land point when pushed into Huai Nam Kham reservoir water on sisaket_island. */
function findNearestDryLand(x: number, y: number, cfg: MapConfig): { x: number; y: number } {
  const stepDist = [60, 120, 190, 270, 380, 520]
  for (const dist of stepDist) {
    let best: { x: number; y: number; score: number } | null = null
    for (let i = 0; i < 16; i++) {
      const ang = (i * Math.PI * 2) / 16
      const cx = clamp(x + Math.cos(ang) * dist, 80, cfg.width - 80)
      const cy = clamp(y + Math.sin(ang) * dist, 80, cfg.height - 80)
      if (isSafeCoord(cx, cy, cfg)) {
        // Prefer dry land closer to center island plaza (1500, 900)
        const score = Math.hypot(cx - 1500, cy - 900)
        if (!best || score < best.score) {
          best = { x: cx, y: cy, score }
        }
      }
    }
    if (best) return { x: best.x, y: best.y }
  }
  return { x: 1500, y: 1060 }
}

/** Projects a safe steering direction that avoids map edges, pillars, and Sisaket water. */
function steerSafely(me: PlayerState, rawDx: number, rawDy: number, cfg: MapConfig): { dx: number; dy: number } {
  const base = normalize(rawDx, rawDy)
  if (base.len < 0.01) return { dx: 0, dy: 0 }

  // If currently in Sisaket water, immediately steer straight to dry land!
  if (cfg.id === 'sisaket_island' && !isOnSisaketDryLand(me.x, me.y)) {
    const land = findNearestDryLand(me.x, me.y, cfg)
    const toLand = normalize(land.x - me.x, land.y - me.y)
    return { dx: toLand.x, dy: toLand.y }
  }

  const baseAng = Math.atan2(base.y, base.x)
  const lookAhead = 72
  const candidateOffsets = [0, 0.35, -0.35, 0.72, -0.72, 1.15, -1.15, 1.65, -1.65, Math.PI]
  for (const off of candidateOffsets) {
    const a = baseAng + off
    const tx = me.x + Math.cos(a) * lookAhead
    const ty = me.y + Math.sin(a) * lookAhead
    if (isSafeCoord(tx, ty, cfg)) {
      return { dx: Math.cos(a), dy: Math.sin(a) }
    }
  }
  return { dx: base.x, dy: base.y }
}

class AdminAutoAiController {
  private enabled = false
  private timerId: number | null = null
  private unsubInit: (() => void) | null = null
  private unsubSync: (() => void) | null = null

  private world: LiveWorldSnapshot = {
    myPlayerId: '',
    mapCfg: null,
    players: [],
    projectiles: [],
    zones: [],
  }

  // Hero combo state memory
  private strafeSign = 1
  private nextStrafeFlipAt = 0
  private lastCastAt = 0
  private gojoRedFiredAt = 0
  private gojoRedFusionDelayMs = 450
  private gojoRedTarget = { x: 0, y: 0 }
  private simoSnipeStartedAt = 0
  private simoSnipeActive = false

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(next: boolean): boolean {
    const st = useGameStore.getState()
    // Zero-Trust Admin Gate: strictly refuse activation for any non-admin account!
    if (next && st.authUser?.role !== 'admin') {
      this.stop()
      return false
    }
    if (next === this.enabled) return this.enabled
    if (next) {
      this.start()
    } else {
      this.stop()
    }
    return this.enabled
  }

  private start(): void {
    this.enabled = true
    this.simoSnipeActive = false
    this.simoSnipeStartedAt = 0
    this.gojoRedFiredAt = 0
    this.nextStrafeFlipAt = performance.now() + 1400

    const st = useGameStore.getState()
    this.world = {
      myPlayerId: st.myPlayerId,
      mapCfg: st.mapCfg,
      players: st.roster,
      projectiles: [],
      zones: [],
    }

    this.unsubInit?.()
    this.unsubSync?.()
    this.unsubInit = gameEventBus.onInit((p) => {
      this.world = {
        myPlayerId: p.myPlayerId,
        mapCfg: p.mapCfg,
        players: p.players,
        projectiles: p.projectiles,
        zones: p.zones,
      }
    })
    this.unsubSync = gameEventBus.onSync((p) => {
      const cur = useGameStore.getState()
      this.world = {
        myPlayerId: cur.myPlayerId || this.world.myPlayerId,
        mapCfg: cur.mapCfg || this.world.mapCfg,
        players: p.players,
        projectiles: p.projectiles,
        zones: p.zones,
      }
    })

    if (this.timerId !== null) window.clearInterval(this.timerId)
    // 25Hz tactical decision loop (40ms): superhuman reaction with tiny CPU cost
    this.timerId = window.setInterval(() => {
      this.tick()
    }, 40)
  }

  stop(): void {
    const wasEnabled = this.enabled
    this.enabled = false
    if (this.timerId !== null) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }
    this.unsubInit?.()
    this.unsubInit = null
    this.unsubSync?.()
    this.unsubSync = null
    if (this.simoSnipeActive) {
      this.simoSnipeActive = false
      setSimoSnipeCharging(false)
      gameEventBus.emitAimPreview({
        active: false,
        slot: 2,
        dirX: 1,
        dirY: 0,
        rangeFactor: 1,
        castRange: 2800,
        aoeRadius: 44,
        aimType: 'line',
        cancel: false,
      })
    }
    if (wasEnabled) {
      useGameStore.getState().sendMovementVector(0, 0, true, true)
    }
  }

  private getEnemyList(me: PlayerState, isTeam: boolean): PlayerState[] {
    const out: PlayerState[] = []
    for (const p of this.world.players) {
      if (p.id === me.id || !p.alive) continue
      if (isTeam && me.team && p.team === me.team) continue
      out.push(p)
    }
    return out
  }

  private pickBestTarget(me: PlayerState, enemies: PlayerState[]): PlayerState | null {
    if (enemies.length === 0) return null
    let best: PlayerState | null = null
    let bestScore = -Infinity
    for (const e of enemies) {
      const dist = Math.hypot(e.x - me.x, e.y - me.y)
      const hpRatio = e.hp / Math.max(1, e.maxHp)
      let score = 1200 - dist
      // Strongly prefer real players over dummies when both exist, and avoid wasting burst on invulnerable foes
      if (e.invulnerable) score -= 900
      if (e.stunned || e.inVoid) score += 260
      if (hpRatio <= 0.25) score += 340
      else if (hpRatio <= 0.5) score += 140
      if (score > bestScore) {
        bestScore = score
        best = e
      }
    }
    return best
  }

  private predictTarget(me: PlayerState, target: PlayerState, projSpeed: number, maxRange: number): { x: number; y: number } {
    const dist = Math.hypot(target.x - me.x, target.y - me.y)
    const speedBoost = me.characterId === 'simo' || me.characterId === 'ole' ? 1.2 : 1.0
    const effSpeed = Math.max(220, projSpeed * speedBoost)
    const targetMoveSpd = target.stunned || target.inVoid ? 0 : target.godspeed ? 460 : target.slowed ? 140 : 255
    const leadSec = clamp(dist / effSpeed, 0, 0.55)
    let px = target.x + (target.dx || 0) * targetMoveSpd * leadSec
    let py = target.y + (target.dy || 0) * targetMoveSpd * leadSec
    const d = Math.hypot(px - me.x, py - me.y)
    if (d > maxRange && d > 1) {
      px = me.x + ((px - me.x) / d) * maxRange
      py = me.y + ((py - me.y) / d) * maxRange
    }
    return { x: px, y: py }
  }

  private computeThreatEvade(
    me: PlayerState,
    cfg: MapConfig,
    isTeam: boolean,
  ): { dx: number; dy: number; urgentDash: boolean } {
    const prRad = cfg.playerRadius || 18
    let evadeX = 0
    let evadeY = 0
    let urgentDash = false

    // 1. Dodge incoming enemy projectiles before impact
    for (const pr of this.world.projectiles) {
      if (pr.ownerId === me.id) continue
      const owner = this.world.players.find((pl) => pl.id === pr.ownerId)
      if (isTeam && owner?.team && owner.team === me.team) continue
      const speedSq = pr.vx * pr.vx + pr.vy * pr.vy
      if (speedSq < 100) continue

      const rx = me.x - pr.x
      const ry = me.y - pr.y
      const t = (rx * pr.vx + ry * pr.vy) / speedSq
      if (t < -0.02 || t > 0.55) continue

      const cx = pr.x + pr.vx * Math.max(0, t)
      const cy = pr.y + pr.vy * Math.max(0, t)
      const missDist = Math.hypot(me.x - cx, me.y - cy)
      const dangerRad = pr.radius + prRad + 44
      if (missDist < dangerRad) {
        const vNorm = normalize(pr.vx, pr.vy)
        // Pick perpendicular direction away from projectile line (preferring dry land)
        const perp1 = { x: -vNorm.y, y: vNorm.x }
        const perp2 = { x: vNorm.y, y: -vNorm.x }
        const cross = rx * pr.vy - ry * pr.vx
        const preferred = cross >= 0 ? perp2 : perp1
        const alt = cross >= 0 ? perp1 : perp2
        const chosen = isSafeCoord(me.x + preferred.x * 75, me.y + preferred.y * 75, cfg) ? preferred : alt
        const weight = 2.6 * (1 - clamp(t / 0.55, 0, 0.85))
        evadeX += chosen.x * weight
        evadeY += chosen.y * weight
        if (t < 0.2 && missDist < pr.radius + prRad + 22) {
          urgentDash = true
        }
      }
    }

    // 2. Evade hostile AoE zones & lethal delayed windup telegraphs (Narukami, Sanzen Sekai, Shrine, Void, etc.)
    for (const z of this.world.zones) {
      if (
        z.kind === 'scp_medkit_orb' ||
        z.kind === 'scp_medkit_heal' ||
        z.kind === 'aegis_core_orb' ||
        z.kind === 'aegis_core_burst'
      ) {
        continue
      }
      if (z.ownerId === me.id) continue
      const owner = this.world.players.find((pl) => pl.id === z.ownerId)
      if (isTeam && owner?.team && owner.team === me.team) continue
      const dist = Math.hypot(me.x - z.x, me.y - z.y)
      const danger = z.radius + prRad + 34
      if (dist < danger) {
        const out = dist > 1 ? normalize(me.x - z.x, me.y - z.y) : { x: 1, y: 0, len: 1 }
        evadeX += out.x * 3.0
        evadeY += out.y * 3.0
        if ((z.delayLeft ?? 0) > 0 && (z.delayLeft ?? 0) < 0.32) {
          urgentDash = true
        }
        if (
          z.kind === 'malevolent_shrine' ||
          z.kind === 'beelzebuth' ||
          z.kind === 'amaterasu' ||
          z.kind === 'fuga_cinder'
        ) {
          urgentDash = true
        }
      }
    }

    return { dx: evadeX, dy: evadeY, urgentDash }
  }

  private tick(): void {
    const st = useGameStore.getState()
    if (!this.enabled || st.authUser?.role !== 'admin') {
      this.stop()
      return
    }
    if (st.currentView !== 'arena' || !st.connected || st.matchPhase !== 'playing') {
      if (st.currentView !== 'arena') this.stop()
      return
    }

    const me = this.world.players.find((p) => p.id === st.myPlayerId) ?? st.roster.find((p) => p.id === st.myPlayerId)
    const cfg = this.world.mapCfg ?? st.mapCfg
    if (!me || !cfg) return

    // Auto-respawn immediately when respawn countdown finishes
    if (!me.alive) {
      if (this.simoSnipeActive) {
        this.simoSnipeActive = false
        setSimoSnipeCharging(false)
      }
      if ((me.respawnInMs ?? 0) <= 0) {
        st.sendRespawn()
      }
      return
    }

    const now = performance.now()
    if (now >= this.nextStrafeFlipAt) {
      this.strafeSign *= -1
      this.nextStrafeFlipAt = now + 950 + Math.random() * 900
    }

    const isTeam = isTeamMatchMode(st.roomMode)
    const enemies = this.getEnemyList(me, isTeam)
    const target = this.pickBestTarget(me, enemies)
    const hpRatio = me.hp / Math.max(1, me.maxHp)
    const cd = (slot: 1 | 2 | 3 | 4 | 5) => (me.cooldownsMs?.[slot - 1] ?? 0) <= 0
    const dashReady = (me.dashCooldownMs ?? 0) <= 0
    const basicReady = (me.basicCooldownMs ?? 0) <= 0
    const rctReady = st.roomMode === 'iconic' && (me.rctCooldownMs ?? 0) <= 0

    // 0. Handle active Simo 100% Charged Snipe hold-and-release state cleanly
    if (this.simoSnipeActive) {
      if (me.characterId !== 'simo' || !target || me.stunned || me.inVoid) {
        this.simoSnipeActive = false
        setSimoSnipeCharging(false)
        gameEventBus.emitAimPreview({
          active: false,
          slot: 2,
          dirX: 1,
          dirY: 0,
          rangeFactor: 1,
          castRange: 2800,
          aoeRadius: 44,
          aimType: 'line',
          cancel: false,
        })
      } else {
        const elapsed = now - this.simoSnipeStartedAt
        const ratio = clamp(elapsed / 1150, 0, 1)
        const pred = this.predictTarget(me, target, 2400, 2750)
        const dir = normalize(pred.x - me.x, pred.y - me.y)
        gameEventBus.emitAimPreview({
          active: true,
          slot: 2,
          dirX: dir.x || 1,
          dirY: dir.y || 0,
          rangeFactor: 1,
          castRange: 2800,
          aoeRadius: 44,
          aimType: 'line',
          cancel: false,
          chargeRatio: ratio,
        })
        const enemyTooClose = Math.hypot(target.x - me.x, target.y - me.y) < 195
        if (elapsed >= 1170 || enemyTooClose) {
          this.simoSnipeActive = false
          setSimoSnipeCharging(false)
          const pct = Math.min(100, Math.round((elapsed / 1150) * 100))
          gameEventBus.emitAimPreview({
            active: false,
            slot: 2,
            dirX: dir.x || 1,
            dirY: dir.y || 0,
            rangeFactor: 1,
            castRange: 2800,
            aoeRadius: 44,
            aimType: 'line',
            cancel: false,
          })
          st.castSkill(2, { worldX: pred.x, worldY: pred.y, targetId: `charge:${pct}` })
          this.lastCastAt = now
        }
        return
      }
    }

    // 1. Auto Iconic RCT Heal when below 58% HP
    if (rctReady && hpRatio < 0.58 && !me.stunned) {
      st.castRct()
    }

    // 2. Sisaket Emergency Water Recovery (Dash back onto dry island immediately!)
    if (cfg.id === 'sisaket_island' && !isOnSisaketDryLand(me.x, me.y)) {
      const land = findNearestDryLand(me.x, me.y, cfg)
      if (dashReady && !me.stunned && !me.seated) {
        st.castDash({ worldX: land.x, worldY: land.y })
      }
      const dir = normalize(land.x - me.x, land.y - me.y)
      st.sendMovementVector(dir.x, dir.y, false, true)
      return
    }

    // 3. Threat Detection: Projectile & Windup Zone Dodging
    const evade = this.computeThreatEvade(me, cfg, isTeam)
    const evadeNorm = normalize(evade.dx, evade.dy)
    if (evade.urgentDash && dashReady && evadeNorm.len > 0.1 && !me.stunned && !me.seated) {
      const safe = steerSafely(me, evadeNorm.x, evadeNorm.y, cfg)
      st.castDash({ worldX: me.x + safe.dx * 260, worldY: me.y + safe.dy * 260 })
    }

    if (!target) {
      // No living enemies yet -> patrol near safe center plaza (dry land)
      const homePt = cfg.id === 'sisaket_island' ? { x: 1340, y: 1060 } : { x: cfg.width * 0.5, y: cfg.height * 0.5 }
      const dHome = Math.hypot(homePt.x - me.x, homePt.y - me.y)
      if (dHome > 90) {
        const mv = steerSafely(me, homePt.x - me.x, homePt.y - me.y, cfg)
        st.sendMovementVector(mv.dx, mv.dy, false, true)
      } else {
        st.sendMovementVector(0, 0, false, true)
      }
      return
    }

    const toTarget = normalize(target.x - me.x, target.y - me.y)
    const dist = toTarget.len

    // 4. Movement & Tactical Spacing (Evade > SCP Medkit Sustain > Safe Kiting / Aggressive Pursuit + Orb-Walk Strafe)
    let wantX = 0
    let wantY = 0
    let seekingMedkit = false
    if (cfg.id === 'scp_site' && hpRatio < 0.72 && evadeNorm.len < 0.15) {
      let bestMed: ZoneEffect | null = null
      let bestMedDist = 520
      for (const z of this.world.zones) {
        if (z.kind !== 'scp_medkit_orb') continue
        const md = Math.hypot(z.x - me.x, z.y - me.y)
        if (md < bestMedDist) {
          bestMedDist = md
          bestMed = z
        }
      }
      if (bestMed) {
        const toMed = normalize(bestMed.x - me.x, bestMed.y - me.y)
        wantX = toMed.x
        wantY = toMed.y
        seekingMedkit = true
      }
    }
    if (!seekingMedkit && evadeNorm.len > 0.15) {
      wantX = evadeNorm.x * 1.6 + (-toTarget.y * this.strafeSign) * 0.35
      wantY = evadeNorm.y * 1.6 + (toTarget.x * this.strafeSign) * 0.35
    } else if (!seekingMedkit) {
      const ideal = idealRangeForHero(me.characterId)
      const thanosPreserveStones = me.characterId === 'noone' && (me.infinityStones?.length ?? 0) >= 3 && hpRatio < 0.38
      const desiredDist = thanosPreserveStones ? 440 : me.characterId === 'ajarn_au' && me.godspeed ? 26 : ideal

      if (dist > desiredDist + 38) {
        // Close distance with diagonal weave to dodge straight skillshots
        wantX = toTarget.x * 0.92 + (-toTarget.y * this.strafeSign) * 0.38
        wantY = toTarget.y * 0.92 + (toTarget.x * this.strafeSign) * 0.38
      } else if (dist < desiredDist - 52 && me.characterId !== 'luangphi_sorn' && !(me.characterId === 'ajarn_au' && me.godspeed)) {
        // Kite backward while strafing
        wantX = -toTarget.x * 0.78 + (-toTarget.y * this.strafeSign) * 0.62
        wantY = -toTarget.y * 0.78 + (toTarget.x * this.strafeSign) * 0.62
      } else {
        // Circle-strafe smoothly inside optimal combat envelope
        wantX = -toTarget.y * this.strafeSign
        wantY = toTarget.x * this.strafeSign
      }
    }

    if (!me.stunned && !me.seated && !me.inVoid) {
      const safeMove = steerSafely(me, wantX, wantY, cfg)
      st.sendMovementVector(safeMove.dx, safeMove.dy, false, true)
    }

    if (me.stunned || me.inVoid || me.seated) return

    // 5. Offensive Dash Gap-Close (for Chronos / Saitama / Execute / Chasing)
    if (
      dashReady &&
      evadeNorm.len < 0.15 &&
      !target.invulnerable &&
      ((me.characterId === 'luangphi_sorn' && dist > 160 && dist < 560) ||
        ((me.characterId === 'ko' || me.characterId === 'ajarn_au' || me.characterId === 'frame') && dist > 380 && dist < 680) ||
        (target.hp / Math.max(1, target.maxHp) < 0.25 && dist > 280 && dist < 540))
    ) {
      const dashPt = { x: me.x + toTarget.x * 260, y: me.y + toTarget.y * 260 }
      if (isSafeCoord(dashPt.x, dashPt.y, cfg)) {
        st.castDash({ worldX: dashPt.x, worldY: dashPt.y })
      }
    }

    // 6. Hero-Specific Grandmaster Skill Rotation Engine (all 14 heroes!)
    const canCastNow = now - this.lastCastAt >= 85
    if (canCastNow && !target.invulnerable) {
      const casted = this.executeHeroCombo(me, target, dist, hpRatio, cfg, st, cd, now)
      if (casted) {
        this.lastCastAt = now
        return
      }
    }

    // 7. Relentless Orb-Walking Basic Attack Weave synced 1:1 with authoritative getBasicAttackRange
    const basicRange = getBasicAttackRange(me.characterId)
    if (basicReady && dist <= basicRange + 12 && !target.invulnerable) {
      const pred = this.predictTarget(me, target, 820, basicRange)
      st.castBasicAttack({ worldX: pred.x, worldY: pred.y })
    }
  }

  private executeHeroCombo(
    me: PlayerState,
    target: PlayerState,
    dist: number,
    hpRatio: number,
    cfg: MapConfig,
    st: ReturnType<typeof useGameStore.getState>,
    cd: (slot: 1 | 2 | 3 | 4 | 5) => boolean,
    now: number,
  ): boolean {
    switch (me.characterId) {
      case 'sia_mon': {
        // Gojo Satoru: 1) Physics-Solved Hollow Purple Fusion just before Red hits target!
        if (
          this.gojoRedFiredAt > 0 &&
          now - this.gojoRedFiredAt >= this.gojoRedFusionDelayMs &&
          now - this.gojoRedFiredAt <= this.gojoRedFusionDelayMs + 350 &&
          cd(2)
        ) {
          st.castSkill(2, { worldX: this.gojoRedTarget.x, worldY: this.gojoRedTarget.y })
          this.gojoRedFiredAt = 0
          return true
        }
        if (this.gojoRedFiredAt > 0 && now - this.gojoRedFiredAt > this.gojoRedFusionDelayMs + 400) {
          this.gojoRedFiredAt = 0
        }
        if (cd(1) && dist <= 560) {
          const pred = this.predictTarget(me, target, 320, 560)
          const predDist = Math.hypot(pred.x - me.x, pred.y - me.y)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          if (cd(2)) {
            this.gojoRedFiredAt = now
            // Fuse ~55px in front of enemy so Red + Blue collide cleanly BEFORE Red is consumed on hit -> 64 dmg Hollow Purple!
            const fuseDist = Math.max(45, predDist - 55)
            this.gojoRedFusionDelayMs = clamp(Math.round((fuseDist / 334) * 1000), 110, 720)
            this.gojoRedTarget = pred
          }
          return true
        }
        const voidRange = st.roomMode === 'iconic' ? 305 : 295
        if (cd(3) && dist <= voidRange && this.gojoRedFiredAt === 0) {
          st.castSkill(3, { worldX: target.x, worldY: target.y })
          return true
        }
        if (cd(2) && dist <= 720 && this.gojoRedFiredAt === 0) {
          const pred = this.predictTarget(me, target, 920, 720)
          st.castSkill(2, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      case 'ajarn_boy': {
        // Sukuna: Malevolent Shrine when in domain range -> Fuga burn -> Dismantle X-Cut
        if (cd(3) && dist <= 325) {
          st.castSkill(3, { worldX: target.x, worldY: target.y })
          return true
        }
        if (cd(2) && dist <= 680) {
          const pred = this.predictTarget(me, target, 760, 680)
          st.castSkill(2, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 460) {
          const pred = this.predictTarget(me, target, 900, 460)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      case 'luangphi_sorn': {
        // Admin Saitama: Instant guaranteed Lock-On Serious Punch on non-invulnerable target!
        if (cd(1)) {
          st.castSkill(1, { worldX: target.x, worldY: target.y, targetId: target.id })
          return true
        }
        return false
      }

      case 'noone': {
        // Thanos: Instant Snap at 5/5 stones -> optimal stone CC-burst chain (Time -> Space -> Power -> Reality -> Mind)
        const stones = me.infinityStones ?? []
        if (stones.length >= 5 && (me.snapCooldownMs ?? 0) <= 0) {
          st.castSnap()
          return true
        }
        const order: Array<{ slot: 1 | 2 | 3 | 4 | 5; range: number; spd: number }> = [
          { slot: 4, range: 430, spd: 900 }, // Time Freeze
          { slot: 2, range: 480, spd: 860 }, // Space Pull
          { slot: 1, range: 540, spd: 880 }, // Power Beam
          { slot: 3, range: 460, spd: 760 }, // Reality Zone
          { slot: 5, range: 540, spd: 950 }, // Mind Ray
        ]
        for (const item of order) {
          if (stones.includes(item.slot) && cd(item.slot) && dist <= item.range) {
            const pred = this.predictTarget(me, target, item.spd, item.range)
            st.castSkill(item.slot, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        return false
      }

      case 'simo': {
        // Simo Hayha (Elsu Sniper): Backflip disengage on divers -> Radar slow -> 100% Full-Charge White Death Snipe!
        if (cd(3) && dist <= 235) {
          // Ensure backflip won't drop us into Sisaket water!
          const dir = normalize(target.x - me.x, target.y - me.y)
          const backX = me.x - dir.x * 240
          const backY = me.y - dir.y * 240
          if (cfg.id !== 'sisaket_island' || isOnSisaketDryLand(backX, backY)) {
            st.castSkill(3, { worldX: target.x, worldY: target.y })
            return true
          }
        }
        if (cd(1) && dist <= 540) {
          const pred = this.predictTarget(me, target, 900, 540)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(2) && dist >= 310 && dist <= 2550) {
          this.simoSnipeActive = true
          this.simoSnipeStartedAt = now
          setSimoSnipeCharging(true)
          st.sendMovementVector(0, 0, true, true)
          return true
        }
        return false
      }

      case 'ko': {
        // Zenitsu: Dimensional Star (R) invulnerable 5-point burst -> Sixfold Blitz (E) -> Hekireki Issen (Q)
        if (cd(3) && dist <= 340) {
          st.castSkill(3, { worldX: target.x, worldY: target.y })
          return true
        }
        if (cd(2) && dist <= 520) {
          const pred = this.predictTarget(me, target, 1200, 520)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(2, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        if (cd(1) && dist <= 410) {
          const pred = this.predictTarget(me, target, 1300, 410)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(1, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        return false
      }

      case 'ajarn_au': {
        // Killua: Godspeed (E) -> Narukami (R) on stunned/mid target -> Solo Whirlwind i-frame (Q)
        if (cd(2) && dist <= 460) {
          st.castSkill(2, { worldX: target.x, worldY: target.y })
          return true
        }
        if (cd(3) && dist <= 470) {
          const pred = this.predictTarget(me, target, 550, 470)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 165) {
          st.castSkill(1, { worldX: target.x, worldY: target.y })
          return true
        }
        return false
      }

      case 'frame': {
        // Frame & Stand Cat Ai-Ouan: Lock-On Pounce (Q) -> The World Time-Stop (R) -> ORA Barrage (E)
        if (cd(1) && dist <= 520) {
          st.castSkill(1, { worldX: target.x, worldY: target.y, targetId: target.id })
          return true
        }
        if (cd(3) && dist <= 400) {
          st.castSkill(3, { worldX: target.x, worldY: target.y, targetId: target.id })
          return true
        }
        if (cd(2) && dist <= 260) {
          st.castSkill(2, { worldX: target.x, worldY: target.y })
          return true
        }
        return false
      }

      case 'kaem': {
        // Rimuru: Beelzebuth void pull + heal (R) -> Black Lightning (Q) -> Black Flame 3-way (E)
        if (cd(3) && (dist <= 340 || (hpRatio < 0.78 && dist <= 400))) {
          const pred = this.predictTarget(me, target, 650, 380)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 520) {
          const pred = this.predictTarget(me, target, 720, 520)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(2) && dist <= 540) {
          const pred = this.predictTarget(me, target, 740, 540)
          st.castSkill(2, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      case 'thanwa': {
        // Zoro: Sanzen Sekai (R) -> Shishi Sonson dash-cut (E) -> 108 Pound Ho (Q)
        if (cd(3) && dist <= 340) {
          const pred = this.predictTarget(me, target, 700, 340)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(2) && dist <= 370) {
          const pred = this.predictTarget(me, target, 1100, 370)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(2, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        if (cd(1) && dist <= 620) {
          const pred = this.predictTarget(me, target, 840, 620)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      case 'boy': {
        // Goku: Dragon Punch gap-close stun + rapid attack buff (E) -> Kamehameha (R) -> Ki Barrage (Q)
        if (cd(2) && dist <= 365) {
          const pred = this.predictTarget(me, target, 1050, 365)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(2, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        if (cd(3) && dist <= 640) {
          const pred = this.predictTarget(me, target, 1150, 640)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 560) {
          const pred = this.predictTarget(me, target, 820, 560)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      case 'pa': {
        // Gilgamesh: Enkidu AoE Slow (E) -> Sword Rain (R) on slowed target -> Gate of Babylon (Q)
        if (cd(2) && dist <= 490) {
          const pred = this.predictTarget(me, target, 800, 490)
          st.castSkill(2, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(3) && dist <= 520) {
          const pred = this.predictTarget(me, target, 720, 520)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 600) {
          const pred = this.predictTarget(me, target, 860, 600)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      case 'ole': {
        // Itachi: Tsukuyomi Stun (E) -> Amaterasu Burn (R) -> Crow Boomerang (Q)
        if (cd(2) && dist <= 460) {
          const pred = this.predictTarget(me, target, 880, 460)
          st.castSkill(2, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(3) && dist <= 500) {
          const pred = this.predictTarget(me, target, 820, 500)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 600) {
          const pred = this.predictTarget(me, target, 696, 600)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      case 'jinwoo': {
        // Sung Jin-Woo: ARISE! Shadow Army (R) -> Ruler's Authority pull+stun (E) -> Dagger Rush (Q)
        if (cd(3) && dist <= 310) {
          st.castSkill(3, { worldX: target.x, worldY: target.y })
          return true
        }
        if (cd(2) && dist <= 430) {
          const pred = this.predictTarget(me, target, 900, 430)
          st.castSkill(2, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 375) {
          const pred = this.predictTarget(me, target, 1200, 375)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(1, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        return false
      }

      case 'naruto': {
        // Naruto: Kurama Mode Transformation (R) first -> Rasenshuriken (E) -> Rasengan dash (Q)
        if (cd(3) && dist <= 460) {
          st.castSkill(3, { worldX: target.x, worldY: target.y })
          return true
        }
        if (cd(2) && dist <= 540) {
          const pred = this.predictTarget(me, target, 660, 540)
          st.castSkill(2, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 355) {
          const pred = this.predictTarget(me, target, 1100, 355)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(1, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        return false
      }

      case 'sanji': {
        // Sanji: Ifrit Jambe (R) stun -> Diable Jambe (E) spin+speed -> Sky Walk Kick (Q)
        if (cd(3) && dist <= 430) {
          const pred = this.predictTarget(me, target, 1250, 430)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(3, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        if (cd(2) && dist <= 220) {
          st.castSkill(2, { worldX: target.x, worldY: target.y })
          return true
        }
        if (cd(1) && dist <= 355) {
          const pred = this.predictTarget(me, target, 1150, 355)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(1, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        return false
      }

      case 'luffy': {
        // Luffy: Gear 5 Bajrang Gun (R) -> Gomu Gomu Gatling (E) -> Gomu Gomu Pistol (Q)
        if (cd(3) && dist <= 410) {
          const pred = this.predictTarget(me, target, 720, 410)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(2) && dist <= 325) {
          st.castSkill(2, { worldX: target.x, worldY: target.y })
          return true
        }
        if (cd(1) && dist <= 465) {
          const pred = this.predictTarget(me, target, 1100, 465)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      case 'ben10': {
        // Ben 10: Way Big Cosmic Ray (R) stun -> Heatblast Fireball (Q) -> XLR8 Hyper Blitz (E)
        if (cd(3) && dist <= 830) {
          const pred = this.predictTarget(me, target, 1400, 830)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 550) {
          const pred = this.predictTarget(me, target, 780, 550)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(2) && dist <= 410) {
          const pred = this.predictTarget(me, target, 1300, 410)
          if (isSafeCoord(pred.x, pred.y, cfg)) {
            st.castSkill(2, { worldX: pred.x, worldY: pred.y })
            return true
          }
        }
        return false
      }

      case 'diablo': {
        // Diablo: Temptation World pull+stun (E) -> End of World eclipse execute (R) -> Despair Time 3-way (Q)
        if (cd(2) && dist <= 440) {
          const pred = this.predictTarget(me, target, 900, 440)
          st.castSkill(2, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(3) && dist <= 465) {
          const pred = this.predictTarget(me, target, 780, 465)
          st.castSkill(3, { worldX: pred.x, worldY: pred.y })
          return true
        }
        if (cd(1) && dist <= 530) {
          const pred = this.predictTarget(me, target, 760, 530)
          st.castSkill(1, { worldX: pred.x, worldY: pred.y })
          return true
        }
        return false
      }

      default:
        return false
    }
  }
}

export const adminAutoAi = new AdminAutoAiController()
