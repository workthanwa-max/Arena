import * as THREE from 'three'

/**
 * 3-Stage Anime VFX Animation Choreography Engine (`vfxAnimator.ts`, v4.1).
 * Fixes:
 * - Added `roll_spin` (rotates around local Z forward axis) so helical beam spirals roll cleanly
 *   instead of helicopter-spinning around world Y.
 * - Fixed `lightning_flicker` so it NEVER rotates/scales world-offset groups around (0,0,0)
 *   (completely eliminates lightning teleporting across the map!).
 */

export type ChoreographyKind =
  | 'sweep_arc'
  | 'lightning_flicker'
  | 'erupt_rise'
  | 'drop_impact'
  | 'orbit_vortex'
  | 'roll_spin'
  | 'thrust_lunge'
  | 'pulse_ring'

export interface ChoreographyTrack {
  target: THREE.Object3D
  kind: ChoreographyKind
  baseYaw?: number
  sweepSpan?: number
  baseScaleX?: number
  baseScaleY?: number
  baseScaleZ?: number
  startY?: number
  targetY?: number
  orbitRadius?: number
  orbitAngle?: number
  orbitSpeed?: number
  bobAmp?: number
  spinSpeed?: number
  stagger?: number
  seed?: number
}

export function easeOutExpo(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return 1 - Math.pow(2, -10 * t)
}

export function easeOutBack(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export function easeInExpo(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return Math.pow(2, 10 * t - 10)
}

export function registerChoreography(grp: THREE.Group, track: ChoreographyTrack): void {
  let list = grp.userData.choreoTracks as ChoreographyTrack[] | undefined
  if (!list) {
    list = []
    grp.userData.choreoTracks = list
  }
  if (track.baseScaleX === undefined) track.baseScaleX = track.target.scale.x
  if (track.baseScaleY === undefined) track.baseScaleY = track.target.scale.y
  if (track.baseScaleZ === undefined) track.baseScaleZ = track.target.scale.z
  list.push(track)
}

export function stepVfxChoreography(
  grp: THREE.Group,
  progress01: number,
  dt: number,
  nowSec: number,
): void {
  const tracks = grp.userData.choreoTracks as ChoreographyTrack[] | undefined
  if (!tracks || tracks.length === 0) return

  const p = Math.max(0, Math.min(1, progress01))

  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i]
    const obj = tr.target
    const sx = tr.baseScaleX ?? 1
    const sy = tr.baseScaleY ?? 1
    const sz = tr.baseScaleZ ?? 1

    switch (tr.kind) {
      case 'sweep_arc': {
        const localT = Math.min(1, p * 2.4)
        const e = easeOutExpo(localT)
        const span = tr.sweepSpan ?? 1.65
        const baseYaw = tr.baseYaw ?? 0
        obj.rotation.y = baseYaw - span * 0.5 + span * e
        const scaleMult = 0.76 + 0.3 * e
        obj.scale.set(sx * scaleMult, sy, sz * scaleMult)
        break
      }

      case 'lightning_flicker': {
        // Safe local-only electric flicker (NEVER rotates around world origin!)
        const tick = Math.floor(nowSec * 22 + (tr.seed ?? i * 3.7))
        const h1 = Math.sin(tick * 12.9898) * 43758.5453
        const frac1 = h1 - Math.floor(h1)
        const h2 = Math.cos(tick * 78.233) * 19341.123
        const frac2 = h2 - Math.floor(h2)
        obj.visible = frac1 > 0.16
        if (tr.targetY !== undefined) {
          obj.position.y = tr.targetY + (frac2 - 0.5) * 4.5
        }
        break
      }

      case 'erupt_rise': {
        const delay = tr.stagger ?? 0
        const localT = Math.max(0, Math.min(1, (p - delay) * 3.4))
        const e = easeOutBack(localT)
        const yScale = Math.max(0.04, e)
        obj.scale.set(sx * (0.86 + 0.14 * Math.min(1, localT)), sy * yScale, sz * (0.86 + 0.14 * Math.min(1, localT)))
        if (tr.targetY !== undefined) {
          const startY = tr.startY ?? -Math.abs(tr.targetY) * 0.6
          obj.position.y = startY + (tr.targetY - startY) * Math.min(1.06, e)
        }
        break
      }

      case 'drop_impact': {
        const localT = Math.min(1, p * 3.2)
        const e = easeInExpo(localT)
        const startY = tr.startY ?? 170
        const targetY = tr.targetY ?? 24
        obj.position.y = startY + (targetY - startY) * e
        if (localT >= 0.96) {
          const squashT = Math.min(1, (p - 0.3) * 4)
          const rebound = 1 + Math.sin(squashT * Math.PI) * 0.14
          obj.scale.set(sx * rebound, sy / rebound, sz * rebound)
        }
        if (tr.spinSpeed) {
          obj.rotation.y += dt * tr.spinSpeed
        }
        break
      }

      case 'orbit_vortex': {
        const speed = tr.orbitSpeed ?? 1.8
        const angle = (tr.orbitAngle ?? 0) + nowSec * speed
        if (tr.orbitRadius !== undefined && tr.orbitRadius > 0) {
          obj.position.x = Math.cos(angle) * tr.orbitRadius
          obj.position.z = Math.sin(angle) * tr.orbitRadius
        }
        if (tr.targetY !== undefined && tr.bobAmp) {
          obj.position.y = tr.targetY + Math.sin(nowSec * (speed * 1.4) + (tr.seed ?? i)) * tr.bobAmp
        }
        if (tr.spinSpeed) {
          obj.rotation.y += dt * tr.spinSpeed
        }
        break
      }

      case 'roll_spin': {
        // Spins cleanly around forward Z axis (for helical beam spirals & vertical muzzle rings)
        obj.rotation.z += dt * (tr.spinSpeed ?? 4.0)
        break
      }

      case 'thrust_lunge': {
        const localT = Math.min(1, p * 3.6)
        const e = easeOutExpo(localT)
        obj.scale.set(sx * (0.8 + 0.24 * e), sy * (0.8 + 0.24 * e), sz * Math.max(0.18, e))
        break
      }

      case 'pulse_ring': {
        const wave = (nowSec * (tr.spinSpeed ?? 2.2) + (tr.stagger ?? 0)) % 1
        const s = 0.25 + easeOutExpo(wave) * 0.95
        obj.scale.set(sx * s, sy, sz * s)
        break
      }
    }
  }
}
