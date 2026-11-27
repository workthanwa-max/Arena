import * as THREE from 'three'
import type { GraphicsQuality } from '../types/game'

/**
 * Game Feel Controller v2 (`game-feel` skill from awesome-gamedev-agent-skills):
 * 1. Scale-Proportional 5-Tier Trauma (`none` / `micro` / `medium` / `heavy` / `cataclysm`).
 *    - Basic attacks (`none`) NEVER shake the screen.
 *    - Cataclysmic ultimates only reach max ~2.4 world units of smooth trauma^2 rumble.
 * 2. Distance Attenuation from the camera focus/player (`clamp(1 - dist / 680, 0, 1)`),
 *    so off-screen / far-away skills never rattle the player's camera.
 * 3. Recycled Impact PointLight Pool (1–3 lights) with restrained anti-neon intensity.
 */

export type FeelTier = 'none' | 'micro' | 'small' | 'medium' | 'heavy' | 'large' | 'cataclysm'

interface ImpactLightSlot {
  light: THREE.PointLight
  life: number
  maxLife: number
  peakIntensity: number
}

export class GameFeelController {
  private group = new THREE.Group()
  private lightSlots: ImpactLightSlot[] = []
  private lightCursor = 0

  private trauma = 0
  private shakeClock = 0
  private decayRate = 2.4 // crisp recovery per real second (never lingers)
  private maxOffsetXZ = 9.0
  private maxOffsetY = 3.5
  private strength = 1.0
  private listenerX = 0
  private listenerZ = 0
  private hasListener = false
  private outOffset = new THREE.Vector3()

  constructor(quality: GraphicsQuality) {
    this.group.name = 'vfx-impact-lights'
    const lightCount = quality === 'pixel' ? 1 : quality === 'ultra' ? 3 : 2
    for (let i = 0; i < lightCount; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 220, 1.8)
      light.position.set(0, -100, 0)
      light.visible = false
      this.group.add(light)
      this.lightSlots.push({ light, life: 0, maxLife: 0.2, peakIntensity: 0 })
    }
  }

  getObject3D(): THREE.Group {
    return this.group
  }

  setStrength(strength01: number): void {
    this.strength = Math.max(0, Math.min(1, strength01))
  }

  setListenerPosition(worldX: number, worldZ: number): void {
    this.listenerX = worldX
    this.listenerZ = worldZ
    this.hasListener = true
  }

  addTrauma(amount: number): void {
    // Cap trauma at 0.62 so camera never gets violently unreadable even if multiple ults overlap
    this.trauma = Math.min(0.62, Math.max(0, this.trauma + amount))
  }

  triggerFeedback(
    tier: FeelTier,
    worldX: number,
    worldY: number,
    worldZ: number,
    colorHex: number,
  ): void {
    if (tier === 'none') return

    // Distance attenuation so off-screen skills don't rattle the local camera
    let distFactor = 1.0
    if (this.hasListener) {
      const d = Math.hypot(worldX - this.listenerX, worldZ - this.listenerZ)
      distFactor = Math.max(0, Math.min(1, 1 - d / 680))
    }
    if (distFactor <= 0.04) return

    // Soft squared falloff for distant impacts
    const atten = distFactor * distFactor

    if (tier === 'micro' || tier === 'small') {
      this.addTrauma(0.08 * atten)
      this.flashLight(worldX, worldY + 22, worldZ, colorHex, 0.9 * distFactor, 150, 0.11)
    } else if (tier === 'medium') {
      this.addTrauma(0.20 * atten)
      this.flashLight(worldX, worldY + 30, worldZ, colorHex, 2.0 * distFactor, 220, 0.18)
    } else if (tier === 'heavy' || tier === 'large') {
      this.addTrauma(0.34 * atten)
      this.flashLight(worldX, worldY + 38, worldZ, colorHex, 3.2 * distFactor, 280, 0.25)
    } else if (tier === 'cataclysm') {
      this.addTrauma(0.50 * atten)
      this.flashLight(worldX, worldY + 46, worldZ, colorHex, 4.5 * distFactor, 360, 0.34)
    }
  }

  flashLight(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    intensity: number,
    distance = 180,
    durationSec = 0.2,
  ): void {
    if (this.lightSlots.length === 0 || intensity <= 0.05) return
    const slot = this.lightSlots[this.lightCursor]
    this.lightCursor = (this.lightCursor + 1) % this.lightSlots.length
    slot.light.color.setHex(colorHex)
    slot.light.position.set(x, y, z)
    slot.light.distance = distance
    slot.light.intensity = intensity
    slot.light.visible = true
    slot.peakIntensity = intensity
    slot.life = durationSec
    slot.maxLife = Math.max(0.05, durationSec)
  }

  update(realDt: number): THREE.Vector3 {
    const dt = Math.min(0.05, Math.max(0.001, realDt))

    for (const slot of this.lightSlots) {
      if (slot.life <= 0) continue
      slot.life -= dt
      if (slot.life <= 0) {
        slot.life = 0
        slot.light.intensity = 0
        slot.light.visible = false
      } else {
        const ratio = slot.life / slot.maxLife
        slot.light.intensity = slot.peakIntensity * ratio * ratio
      }
    }

    if (this.trauma <= 0.0001 || this.strength <= 0) {
      this.trauma = 0
      this.outOffset.set(0, 0, 0)
      return this.outOffset
    }

    this.trauma = Math.max(0, this.trauma - this.decayRate * dt)
    const shake = this.trauma * this.trauma * this.strength
    this.shakeClock += dt * 28.0

    this.outOffset.set(
      this.maxOffsetXZ * shake * Math.sin(this.shakeClock * 1.7),
      this.maxOffsetY * shake * Math.sin(this.shakeClock * 2.3),
      this.maxOffsetXZ * shake * Math.cos(this.shakeClock * 1.3),
    )
    return this.outOffset
  }

  dispose(): void {
    for (const slot of this.lightSlots) {
      this.group.remove(slot.light)
    }
    this.lightSlots.length = 0
  }
}
