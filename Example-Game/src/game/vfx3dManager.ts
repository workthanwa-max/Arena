import * as THREE from 'three'
import type { BeamEffect, GraphicsQuality, PlayerState, Projectile, ZoneEffect } from '../types/game'
import type { AimPreviewPayload } from './core/eventBus'
import { ArcaneAimTextureCache } from './magicCircleBuilder'

interface Particle3D {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  active: boolean
}

interface DashGhost3D {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  life: number
  maxLife: number
  active: boolean
}

interface GroundDecal3D {
  outerRing: THREE.Mesh
  innerDisc: THREE.Mesh
  outerMat: THREE.MeshBasicMaterial
  innerMat: THREE.MeshBasicMaterial
  life: number
  maxLife: number
  active: boolean
}

interface SmoothProjState {
  grp: THREE.Group
  rx: number
  rz: number
}

function hexNum(hex: string | undefined, fallback = 0x38bdf8): number {
  if (!hex) return fallback
  return Number.parseInt(hex.replace('#', ''), 16) || fallback
}

function buildMergedStarArmsGeo(includeDiagonals: boolean): THREE.BufferGeometry {
  // Builds a single BufferGeometry containing 2 (4-point) or 4 (8-point) crossed 3D box beams so a star glint takes 1 draw call instead of 4
  const boxes: Array<[number, number, number, number]> = [
    [2.15, 1.0, 0.26, 0],
    [0.26, 1.0, 2.15, 0],
  ]
  if (includeDiagonals) {
    boxes.push([1.45, 0.8, 0.18, Math.PI / 4], [1.45, 0.8, 0.18, -Math.PI / 4])
  }
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  let vertOffset = 0
  const baseBox = new THREE.BoxGeometry(1, 1, 1)
  const posAttr = baseBox.getAttribute('position')
  const normAttr = baseBox.getAttribute('normal')
  const idxAttr = baseBox.getIndex()!
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()

  for (const [sx, sy, sz, rotY] of boxes) {
    const cosY = Math.cos(rotY)
    const sinY = Math.sin(rotY)
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i)
      v.x *= sx
      v.y *= sy
      v.z *= sz
      const rx = v.x * cosY + v.z * sinY
      const rz = -v.x * sinY + v.z * cosY
      positions.push(rx, v.y, rz)

      n.fromBufferAttribute(normAttr, i)
      const nrx = n.x * cosY + n.z * sinY
      const nrz = -n.x * sinY + n.z * cosY
      normals.push(nrx, n.y, nrz)
    }
    for (let i = 0; i < idxAttr.count; i++) {
      indices.push(idxAttr.getX(i) + vertOffset)
    }
    vertOffset += posAttr.count
  }
  baseBox.dispose()

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setIndex(indices)
  return merged
}

export class Vfx3dManager {
  private group = new THREE.Group()
  private aimGroup = new THREE.Group()
  private quality: GraphicsQuality
  private isPixelTier: boolean
  private isUltraTier: boolean
  private lineScale: number
  private detailMult: number
  private particles: Particle3D[] = []
  private particleCursor = 0
  private activeParticleCount = 0
  private ghosts: DashGhost3D[] = []
  private ghostCursor = 0
  private activeGhostCount = 0
  private decals: GroundDecal3D[] = []
  private decalCursor = 0
  private activeDecalCount = 0
  // Reusable material & mesh pools prevent GPU/GC micro-stutter during intensive combat
  private matPool: THREE.MeshBasicMaterial[] = []
  private meshPool: THREE.Mesh[] = []

  // Live synced effect meshes keyed by server ID
  private projMeshes = new Map<string, SmoothProjState>()
  private beamMeshes = new Map<string, THREE.Group>()
  private zoneMeshes = new Map<string, THREE.Group>()

  // Shared static geometries (zero per-effect geometry allocation!)
  private sharedSphereGeo = new THREE.SphereGeometry(1, 12, 8)
  private sharedOctaGeo = new THREE.OctahedronGeometry(1, 0)
  private sharedRingGeo = new THREE.RingGeometry(0.82, 1.0, 28)
  private sharedDiscGeo = new THREE.CircleGeometry(1, 24)
  private sharedPlaneGeo = new THREE.PlaneGeometry(1, 1)
  private sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1)
  private sharedCylGeo = new THREE.CylinderGeometry(1, 1, 1, 10)
  private sharedTorusGeo = new THREE.TorusGeometry(1, 0.14, 6, 22)
  private sharedConeGeo = new THREE.ConeGeometry(0.55, 1.4, 8)
  private sharedGlintArmsGeo: THREE.BufferGeometry
  // Crescent arc centered pointing directly toward +Z after rotateX(-PI/2)
  private sharedSlashGeo = new THREE.RingGeometry(0.58, 1.0, 22, 1, -Math.PI * 0.5 - 1.12, 2.24)
  private ghostGeo = new THREE.CapsuleGeometry(11, 22, 4, 8)

  // Magic-Circle Aim preview sub-meshes + per-hero procedural sigil texture cache
  private aimTexCache = new ArcaneAimTextureCache()
  private aimSigilGeo = new THREE.PlaneGeometry(2, 2)
  private aimOuterSigil: THREE.Mesh
  private aimInnerSigil: THREE.Mesh
  private aimLineBar: THREE.Mesh
  private aimSniperLeftLaser: THREE.Mesh
  private aimSniperRightLaser: THREE.Mesh
  private aimOuterMat: THREE.MeshBasicMaterial
  private aimInnerMat: THREE.MeshBasicMaterial
  private aimLineMat: THREE.MeshBasicMaterial
  private aimSniperLaserMat: THREE.MeshBasicMaterial
  private lastAimTexKey = ''

  constructor(scene: THREE.Scene, quality: GraphicsQuality = 'pixel') {
    this.quality = quality
    this.isPixelTier = quality === 'pixel' || quality === 'fine_pixel'
    this.isUltraTier = quality === 'ultra'
    // Thicker high-contrast geometry in Pixel tiers so 3px/1.75px nearest-neighbor sampling stays bold and flicker-free
    this.lineScale = quality === 'pixel' ? 1.38 : quality === 'fine_pixel' ? 1.18 : 1.0
    this.detailMult = quality === 'ultra' ? 1.25 : quality === 'hd' ? 1.0 : quality === 'fine_pixel' ? 0.9 : 0.78
    this.sharedGlintArmsGeo = buildMergedStarArmsGeo(quality !== 'pixel')

    this.sharedRingGeo.rotateX(-Math.PI / 2)
    this.sharedDiscGeo.rotateX(-Math.PI / 2)
    this.sharedPlaneGeo.rotateX(-Math.PI / 2)
    this.sharedSlashGeo.rotateX(-Math.PI / 2)
    this.sharedCylGeo.rotateX(Math.PI / 2) // Length along Z axis
    this.aimSigilGeo.rotateX(-Math.PI / 2)

    scene.add(this.group)
    scene.add(this.aimGroup)

    this.aimOuterMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.aimInnerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.aimLineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.aimSniperLaserMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    this.aimOuterSigil = new THREE.Mesh(this.aimSigilGeo, this.aimOuterMat)
    this.aimOuterSigil.position.y = 2.3
    this.aimOuterSigil.renderOrder = 20
    this.aimInnerSigil = new THREE.Mesh(this.aimSigilGeo, this.aimInnerMat)
    this.aimInnerSigil.position.y = 2.9
    this.aimInnerSigil.renderOrder = 22
    this.aimLineBar = new THREE.Mesh(this.sharedPlaneGeo, this.aimLineMat)
    this.aimLineBar.position.y = 2.6
    this.aimLineBar.renderOrder = 21
    this.aimSniperLeftLaser = new THREE.Mesh(this.sharedPlaneGeo, this.aimSniperLaserMat)
    this.aimSniperLeftLaser.position.y = 3.2
    this.aimSniperLeftLaser.renderOrder = 23
    this.aimSniperLeftLaser.visible = false
    this.aimSniperRightLaser = new THREE.Mesh(this.sharedPlaneGeo, this.aimSniperLaserMat)
    this.aimSniperRightLaser.position.y = 3.2
    this.aimSniperRightLaser.renderOrder = 23
    this.aimSniperRightLaser.visible = false
    this.aimGroup.add(
      this.aimOuterSigil,
      this.aimInnerSigil,
      this.aimLineBar,
      this.aimSniperLeftLaser,
      this.aimSniperRightLaser,
    )
    this.aimGroup.visible = false

    // Pre-allocate 128 pooled 3D impact particles:
    // - Pixel & Fine-Pixel modes use chunky 3D Voxel Cubes (sharedBoxGeo) for authentic pixel-art debris
    // - HD & Ultra Max modes use faceted energy crystals / spheres
    const particleGeo = this.isPixelTier
      ? this.sharedBoxGeo
      : this.isUltraTier
        ? this.sharedOctaGeo
        : this.sharedSphereGeo
    for (let i = 0; i < 128; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(particleGeo, mat)
      mesh.visible = false
      this.group.add(mesh)
      this.particles.push({ mesh, mat, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.45, active: false })
    }

    // Pre-allocate 28 pooled 3D Dash Afterimage Ghosts (Voxel block silhouette in Pixel tiers, Capsule in HD/Ultra)
    const dashGhostGeo = this.isPixelTier ? this.sharedBoxGeo : this.ghostGeo
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(dashGhostGeo, mat)
      mesh.visible = false
      this.group.add(mesh)
      this.ghosts.push({ mesh, mat, life: 0, maxLife: 0.28, active: false })
    }

    // Pre-allocate 18 pooled 3D Ground Scorch & Crater Decals (lingering 2.2s battlefield impact scars!)
    for (let i = 0; i < 18; i++) {
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0x09090b,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const outerRing = new THREE.Mesh(this.sharedRingGeo, outerMat)
      const innerDisc = new THREE.Mesh(this.sharedDiscGeo, innerMat)
      outerRing.visible = false
      innerDisc.visible = false
      this.group.add(innerDisc, outerRing)
      this.decals.push({ outerRing, innerDisc, outerMat, innerMat, life: 0, maxLife: 2.2, active: false })
    }
  }

  private allocMesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    const m = this.meshPool.pop()
    if (m) {
      m.geometry = geo
      m.material = mat
      m.position.set(0, 0, 0)
      m.rotation.set(0, 0, 0)
      m.scale.set(1, 1, 1)
      m.visible = true
      m.userData = {}
      return m
    }
    return new THREE.Mesh(geo, mat)
  }

  private mkMat(
    grp: THREE.Group,
    color: number,
    opacity = 1,
    doubleSide = false,
  ): THREE.MeshBasicMaterial {
    // Deduplicate identical materials within the same effect group to minimize GPU state switches & opacity loop cost
    let lookup = grp.userData.matLookup as Map<number, THREE.MeshBasicMaterial> | undefined
    if (!lookup) {
      lookup = new Map<number, THREE.MeshBasicMaterial>()
      grp.userData.matLookup = lookup
    }
    const key = ((color & 0xffffff) * 256) + (Math.round(opacity * 100) & 0x7f) + (doubleSide ? 128 : 0)
    const cached = lookup.get(key)
    if (cached) return cached

    let m = this.matPool.pop()
    const isDarkCore = color === 0x020617 || color === 0x09090b || color === 0x111827 || color === 0x180205 || color === 0x0b0518 || color === 0x120306
    const useAdditive = !isDarkCore && opacity <= 0.96
    const isTrans = opacity < 1 || useAdditive
    const wantSide = doubleSide ? THREE.DoubleSide : THREE.FrontSide
    const wantDepth = opacity >= 0.99 && !doubleSide && !useAdditive
    if (m) {
      m.color.setHex(color)
      m.transparent = isTrans
      m.opacity = opacity
      m.side = wantSide
      m.blending = useAdditive ? THREE.AdditiveBlending : THREE.NormalBlending
      m.depthWrite = wantDepth
    } else {
      m = new THREE.MeshBasicMaterial({
        color,
        transparent: isTrans,
        opacity,
        side: wantSide,
        blending: useAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: wantDepth,
      })
    }
    // In ULTRA MAX tier, gently boost bright core materials above 1.0 luminance so UnrealBloomPass (threshold 0.88) radiates authentic anime glow
    if (this.isUltraTier && opacity >= 0.88 && color !== 0x020617 && color !== 0x09090b && color !== 0x111827) {
      m.color.multiplyScalar(1.36)
    }
    m.userData.baseOpacity = opacity
    lookup.set(key, m)
    const list = (grp.userData.mats as THREE.MeshBasicMaterial[]) ?? []
    list.push(m)
    grp.userData.mats = list
    return m
  }

  private recycleMeshesRecursive(obj: THREE.Object3D): void {
    for (let i = obj.children.length - 1; i >= 0; i--) {
      const ch = obj.children[i]
      if (ch.children.length > 0) {
        this.recycleMeshesRecursive(ch)
      }
      if (ch instanceof THREE.Mesh && this.meshPool.length < 640) {
        this.meshPool.push(ch)
      }
    }
    obj.children.length = 0
  }

  private recycleGroupResources(grp: THREE.Object3D): void {
    this.recycleMeshesRecursive(grp)
    const lookup = grp.userData.matLookup as Map<number, THREE.MeshBasicMaterial> | undefined
    if (lookup) lookup.clear()
    const mats = grp.userData.mats as THREE.MeshBasicMaterial[] | undefined
    if (!mats) return
    for (const m of mats) {
      if (this.matPool.length < 256) {
        this.matPool.push(m)
      } else {
        m.dispose()
      }
    }
    mats.length = 0
  }

  spawnImpact(x: number, z: number, color: number, count = 10): void {
    const scaledCount = Math.max(3, Math.round(count * this.detailMult))
    const baseSize = this.quality === 'pixel' ? 6.6 : this.quality === 'fine_pixel' ? 5.6 : 5.0
    const len = this.particles.length
    for (let i = 0; i < scaledCount; i++) {
      let slot: Particle3D | null = null
      for (let probe = 0; probe < len; probe++) {
        const idx = (this.particleCursor + probe) & 127
        if (!this.particles[idx].active) {
          slot = this.particles[idx]
          this.particleCursor = (idx + 1) & 127
          break
        }
      }
      if (!slot) break
      const ang = (Math.PI * 2 * i) / scaledCount + Math.random() * 0.4
      const spd = 95 + Math.random() * 165
      slot.vx = Math.cos(ang) * spd
      slot.vz = Math.sin(ang) * spd
      slot.vy = 95 + Math.random() * 130
      slot.life = 0.44
      slot.maxLife = 0.44
      slot.active = true
      this.activeParticleCount++
      slot.mat.color.setHex(color)
      if (this.isUltraTier) {
        slot.mat.color.multiplyScalar(1.38)
      }
      slot.mat.opacity = 1
      slot.mesh.position.set(x, 22, z)
      slot.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0)
      slot.mesh.scale.setScalar(baseSize)
      slot.mesh.visible = true
    }
  }

  spawnDashGhost(x: number, z: number, yaw: number, colorHex: number): void {
    const len = this.ghosts.length
    let slot: DashGhost3D | null = null
    for (let probe = 0; probe < len; probe++) {
      const idx = (this.ghostCursor + probe) % len
      if (!this.ghosts[idx].active) {
        slot = this.ghosts[idx]
        this.ghostCursor = (idx + 1) % len
        break
      }
    }
    if (!slot) return
    slot.active = true
    this.activeGhostCount++
    slot.life = 0.28
    slot.maxLife = 0.28
    slot.mat.color.setHex(colorHex)
    if (this.isUltraTier) {
      slot.mat.color.multiplyScalar(1.3)
    }
    slot.mat.opacity = this.isPixelTier ? 0.68 : 0.56
    slot.mesh.position.set(x, 24, z)
    slot.mesh.rotation.y = yaw
    if (this.isPixelTier) {
      slot.mesh.scale.set(16, 36, 12)
    } else {
      slot.mesh.scale.set(1.0, 1.0, 1.0)
    }
    slot.mesh.visible = true
  }

  stepParticles(dt: number): void {
    if (this.activeParticleCount > 0) {
      const baseSize = this.quality === 'pixel' ? 6.6 : this.quality === 'fine_pixel' ? 5.6 : 5.0
      for (const p of this.particles) {
        if (!p.active) continue
        p.life -= dt
        if (p.life <= 0) {
          p.active = false
          p.mesh.visible = false
          this.activeParticleCount = Math.max(0, this.activeParticleCount - 1)
          continue
        }
        const ratio = p.life / p.maxLife
        p.mesh.position.x += p.vx * dt
        p.mesh.position.z += p.vz * dt
        p.mesh.position.y = Math.max(2, p.mesh.position.y + p.vy * dt)
        p.vy -= 380 * dt
        p.mesh.rotation.x += dt * 7.5
        p.mesh.rotation.y += dt * 9.0
        p.mat.opacity = this.isPixelTier ? Math.min(1, ratio * 1.35) : ratio
        p.mesh.scale.setScalar(Math.max(1.6, baseSize * ratio))
      }
    }

    if (this.activeGhostCount > 0) {
      for (const g of this.ghosts) {
        if (!g.active) continue
        g.life -= dt
        if (g.life <= 0) {
          g.active = false
          g.mesh.visible = false
          this.activeGhostCount = Math.max(0, this.activeGhostCount - 1)
          continue
        }
        const ratio = g.life / g.maxLife
        g.mat.opacity = ratio * (this.isPixelTier ? 0.65 : 0.54)
        const s = 0.85 + (1 - ratio) * 0.28
        if (this.isPixelTier) {
          g.mesh.scale.set(16 * s, 36, 12 * s)
        } else {
          g.mesh.scale.set(s, 1.0, s)
        }
      }
    }

    if (this.activeDecalCount > 0) {
      for (const d of this.decals) {
        if (!d.active) continue
        d.life -= dt
        if (d.life <= 0) {
          d.active = false
          d.outerRing.visible = false
          d.innerDisc.visible = false
          this.activeDecalCount = Math.max(0, this.activeDecalCount - 1)
          continue
        }
        const ratio = d.life / d.maxLife
        d.outerMat.opacity = ratio * 0.72
        d.innerMat.opacity = ratio * 0.48
      }
    }
  }

  /** Spawns a pooled 3D Ground Scorch / Blast Crater Decal that lingers and fades over 2.2s. */
  spawnGroundDecal(x: number, z: number, radius: number, colorHex: number, durationSec = 2.2): void {
    const len = this.decals.length
    let slot: GroundDecal3D | null = null
    for (let probe = 0; probe < len; probe++) {
      const idx = (this.decalCursor + probe) % len
      if (!this.decals[idx].active) {
        slot = this.decals[idx]
        this.decalCursor = (idx + 1) % len
        break
      }
    }
    if (!slot) {
      slot = this.decals[this.decalCursor]
      this.decalCursor = (this.decalCursor + 1) % len
    } else {
      this.activeDecalCount++
    }
    slot.active = true
    slot.life = durationSec
    slot.maxLife = durationSec
    slot.outerMat.color.setHex(colorHex)
    slot.outerMat.opacity = 0.76
    slot.innerMat.opacity = 0.5
    slot.innerDisc.position.set(x, 1.15, z)
    slot.innerDisc.scale.setScalar(Math.max(24, radius * 0.84))
    slot.outerRing.position.set(x, 1.35, z)
    slot.outerRing.scale.setScalar(Math.max(28, radius))
    slot.innerDisc.visible = true
    slot.outerRing.visible = true
  }

  updateAimPreview(
    me: PlayerState | undefined,
    preview: AimPreviewPayload,
    animTimeMs: number,
    anchorX?: number,
    anchorZ?: number,
  ): void {
    if (!me || !me.alive || !preview.active) {
      this.aimGroup.visible = false
      return
    }
    this.aimGroup.visible = true

    const charId = me.characterId || 'default'
    const texKey = `${charId}:${preview.cancel ? 'cancel' : 'ok'}`
    if (texKey !== this.lastAimTexKey) {
      this.lastAimTexKey = texKey
      this.aimOuterMat.map = this.aimTexCache.getOuter(charId, preview.cancel)
      this.aimInnerMat.map = this.aimTexCache.getInner(charId, preview.cancel)
      this.aimLineMat.map = this.aimTexCache.getCorridor(charId, preview.cancel)
      this.aimOuterMat.needsUpdate = true
      this.aimInnerMat.needsUpdate = true
      this.aimLineMat.needsUpdate = true
    }

    const pulse = Math.sin(animTimeMs * 0.0055)
    this.aimOuterMat.opacity = 0.8 + pulse * 0.08
    this.aimInnerMat.opacity = 0.9 + pulse * 0.07
    this.aimLineMat.opacity = 0.84 + pulse * 0.08

    const ax = anchorX ?? me.x
    const az = anchorZ ?? me.y
    const range = Math.max(60, preview.castRange)
    const aoe = Math.max(30, preview.aoeRadius)
    const len = Math.hypot(preview.dirX, preview.dirY) || 1
    const nx = preview.dirX / len
    const nz = preview.dirY / len
    const yaw = Math.atan2(nx, nz)

    this.aimOuterSigil.position.set(ax, 2.3, az)
    this.aimOuterSigil.scale.setScalar(range)
    this.aimOuterSigil.rotation.y = -animTimeMs * 0.00055
    this.aimSniperLeftLaser.visible = false
    this.aimSniperRightLaser.visible = false

    if (charId === 'simo' && preview.slot === 2) {
      // RoV Elsu Skill 2 Converging Sniper Laser Sight Cone!
      // At 0% charge: wide V-shaped spread cone (±27.5 deg). At 100% charge: locks into a single blazing crimson-gold laser line!
      const charge = Math.max(0, Math.min(1, preview.chargeRatio ?? 0))
      const isLocked = charge >= 0.95
      const spread = isLocked ? 0 : (1 - charge) * 0.48
      this.aimSniperLaserMat.color.setHex(
        preview.cancel ? 0xef4444 : isLocked ? 0xfef08a : 0xef4444,
      )
      this.aimSniperLaserMat.opacity = isLocked ? 0.98 : 0.85
      this.aimSniperLeftLaser.visible = true
      this.aimSniperRightLaser.visible = true
      const yawL = yaw - spread
      const yawR = yaw + spread
      const lx = Math.sin(yawL)
      const lz = Math.cos(yawL)
      const rx = Math.sin(yawR)
      const rz = Math.cos(yawR)
      const beamW = isLocked ? 10 : 5
      this.aimSniperLeftLaser.position.set(ax + lx * range * 0.5, 3.3, az + lz * range * 0.5)
      this.aimSniperLeftLaser.scale.set(beamW, 1, range)
      this.aimSniperLeftLaser.rotation.y = yawL
      this.aimSniperRightLaser.position.set(ax + rx * range * 0.5, 3.3, az + rz * range * 0.5)
      this.aimSniperRightLaser.scale.set(beamW, 1, range)
      this.aimSniperRightLaser.rotation.y = yawR
    }

    if (preview.aimType === 'ground') {
      const dist = range * Math.max(0.2, preview.rangeFactor)
      const tx = ax + nx * dist
      const tz = az + nz * dist
      this.aimInnerSigil.visible = true
      this.aimLineBar.visible = true
      this.aimInnerSigil.position.set(tx, 2.9, tz)
      this.aimInnerSigil.scale.setScalar(aoe)
      this.aimInnerSigil.rotation.y = animTimeMs * 0.0018
      this.aimLineBar.position.set(ax + nx * dist * 0.5, 2.6, az + nz * dist * 0.5)
      this.aimLineBar.scale.set(Math.max(24, Math.min(40, aoe * 0.36)), 1, Math.max(24, dist))
      this.aimLineBar.rotation.y = yaw
    } else if (preview.aimType === 'self') {
      this.aimInnerSigil.visible = true
      this.aimLineBar.visible = false
      this.aimInnerSigil.position.set(ax, 2.9, az)
      this.aimInnerSigil.scale.setScalar(Math.max(48, aoe * 0.86))
      this.aimInnerSigil.rotation.y = animTimeMs * 0.0015
    } else {
      const width = preview.aimType === 'cone' ? aoe * 1.45 : Math.max(32, aoe * 1.15)
      const tipX = ax + nx * range
      const tipZ = az + nz * range
      this.aimLineBar.visible = true
      this.aimLineBar.position.set(ax + nx * range * 0.5, 2.6, az + nz * range * 0.5)
      this.aimLineBar.scale.set(width, 1, range)
      this.aimLineBar.rotation.y = yaw
      this.aimInnerSigil.visible = true
      this.aimInnerSigil.position.set(tipX, 2.9, tipZ)
      this.aimInnerSigil.scale.setScalar(Math.max(28, Math.min(72, width * 0.65)))
      this.aimInnerSigil.rotation.y = animTimeMs * 0.0022
    }
  }

  private addStarGlint(grp: THREE.Group, x: number, y: number, z: number, size: number, col: number): void {
    const s = size * (this.isPixelTier ? 1.15 : this.isUltraTier ? 1.25 : 1.0)
    const armThick = (this.isPixelTier ? 4.2 : 3.0) * this.lineScale
    const outerMat = this.mkMat(grp, col, 0.9)
    const coreMat = this.mkMat(grp, 0xffffff, 0.99)
    // Single merged geometry for all 4 or 8 star rays (1 draw call instead of 4!)
    const arms = this.allocMesh(this.sharedGlintArmsGeo, outerMat)
    arms.position.set(x, y, z)
    arms.scale.set(s, armThick, s)
    const coreGeo = this.isPixelTier ? this.sharedBoxGeo : this.isUltraTier ? this.sharedOctaGeo : this.sharedSphereGeo
    const core = this.allocMesh(coreGeo, coreMat)
    core.position.set(x, y, z)
    core.scale.setScalar(Math.max(4, s * 0.28))
    grp.add(arms, core)
  }

  /**
   * Spawns a cluster of 3D Voxel Cubes (in Pixel / Fine-Pixel tiers) or Faceted Energy Crystals (in HD / Ultra tiers)
   * around a skill effect so every ability visually matches the active graphics tier.
   */
  private addTierMotes3D(
    grp: THREE.Group,
    cx: number,
    cy: number,
    cz: number,
    radius: number,
    baseCount: number,
    col: number,
    acc: number,
  ): void {
    const count = Math.max(3, Math.round(baseCount * this.detailMult))
    const moteGeo = this.isPixelTier ? this.sharedBoxGeo : this.sharedOctaGeo
    const moteSize = this.quality === 'pixel' ? 7.2 : this.quality === 'fine_pixel' ? 5.6 : 5.2
    const matA = this.mkMat(grp, acc, 0.94)
    const matB = this.mkMat(grp, col, 0.94)
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count
      const r = radius * (0.65 + (i % 3) * 0.18)
      const m = this.allocMesh(moteGeo, i % 2 === 0 ? matA : matB)
      m.position.set(cx + Math.cos(a) * r, cy + (i % 3) * 8, cz + Math.sin(a) * r)
      m.scale.setScalar(moteSize)
      if (!this.isPixelTier) {
        m.rotation.set(a, a * 1.5, 0)
      }
      grp.add(m)
    }
  }

  private addSegment3D(
    grp: THREE.Group,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    width: number,
    col: number,
    alpha: number,
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const dz = z2 - z1
    const len = Math.max(2, Math.hypot(dx, dy, dz))
    const w = width * this.lineScale
    const mat = this.mkMat(grp, col, alpha)
    const seg = this.allocMesh(this.sharedBoxGeo, mat)
    seg.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5)
    seg.scale.set(w, w, len)
    seg.lookAt(x2, y2, z2)
    grp.add(seg)
  }

  private addJaggedBolt3D(
    grp: THREE.Group,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    col: number,
    acc: number,
    jitter: number,
    segs = 5,
    seed = 0,
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const dz = z2 - z1
    const horizLen = Math.max(1, Math.hypot(dx, dz))
    const px = -dz / horizLen
    const pz = dx / horizLen
    const totalSegs = Math.min(segs, this.isUltraTier ? 6 : 5)

    let lx = x1
    let ly = y1
    let lz = z1
    for (let i = 1; i <= totalSegs; i++) {
      const t = i / totalSegs
      const off = i === totalSegs ? 0 : Math.sin(seed + i * 3.7) * jitter
      const nx = x1 + dx * t + px * off
      const ny = y1 + dy * t + (i === totalSegs ? 0 : Math.cos(seed + i * 2.9) * jitter * 0.45)
      const nz = z1 + dz * t + pz * off
      this.addSegment3D(grp, lx, ly, lz, nx, ny, nz, this.isUltraTier ? 10.5 : 8.8, col, 0.76)
      this.addSegment3D(grp, lx, ly, lz, nx, ny, nz, 4.0, acc, 0.99)
      lx = nx
      ly = ny
      lz = nz
    }
  }

  private addRing3D(grp: THREE.Group, x: number, y: number, z: number, radius: number, col: number, alpha: number, fillAlpha = 0): void {
    if (fillAlpha > 0) {
      const d = this.allocMesh(this.sharedDiscGeo, this.mkMat(grp, col, fillAlpha, true))
      d.position.set(x, y, z)
      d.scale.setScalar(radius)
      grp.add(d)
    }
    const r = this.allocMesh(this.sharedRingGeo, this.mkMat(grp, col, alpha, true))
    r.position.set(x, y + 0.5, z)
    r.scale.setScalar(radius)
    grp.add(r)
  }

  private buildProjectileGroup(pr: Projectile): THREE.Group {
    const grp = new THREE.Group()
    const col = hexNum(pr.color, 0x38bdf8)
    const acc = hexNum(pr.accentColor, 0xffffff)
    const coreGeo = this.isPixelTier ? this.sharedBoxGeo : this.sharedSphereGeo

    // Ground contact shadow beneath flying projectile
    const sh = this.allocMesh(this.sharedDiscGeo, this.mkMat(grp, 0x020617, 0.34, true))
    sh.position.set(0, -24.5, 0)
    sh.scale.set(pr.radius * 0.95, 1, pr.radius * 0.95)
    grp.add(sh)

    // Glowing Wake Trail Tail behind every projectile (-Z)
    const wake = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, col, 0.42))
    wake.rotation.x = -Math.PI / 2
    wake.scale.set(pr.radius * 1.05, 42, pr.radius * 0.65)
    wake.position.set(0, 0, -24)
    grp.add(wake)

    if (pr.kind === 'crow_shuriken') {
      const spin = new THREE.Group()
      spin.userData.spinSpeed = 0.028
      const bladeMat = this.mkMat(grp, 0x111827, 0.98)
      const rimMat = this.mkMat(grp, 0xdc2626, 0.95)
      for (let b = 0; b < 4; b++) {
        const blade = this.allocMesh(this.sharedBoxGeo, bladeMat)
        blade.scale.set(6.5 * this.lineScale, 3.5, 30)
        blade.rotation.y = (b * Math.PI) / 2
        const rim = this.allocMesh(this.sharedBoxGeo, rimMat)
        rim.scale.set(8.2 * this.lineScale, 2.5, 18)
        rim.rotation.y = (b * Math.PI) / 2
        spin.add(blade, rim)
      }
      const eyeCore = this.allocMesh(coreGeo, this.mkMat(grp, 0xef4444, 0.98))
      eyeCore.scale.setScalar(5.5)
      spin.add(eyeCore)
      grp.add(spin)
      this.addTierMotes3D(grp, 0, 0, -8, pr.radius * 0.9, 4, 0x111827, 0xef4444)
    } else if (pr.kind === 'dismantle') {
      // Sukuna "Kai" (Dismantle): Twin Crisscrossing X-Razor Crescent Blades + Cursed Mote Aura
      for (const roll of [-0.56, 0.56]) {
        const wing = new THREE.Group()
        wing.rotation.z = roll
        const darkCore = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, 0x09090b, 0.94, true))
        darkCore.scale.setScalar(pr.radius * 2.05)
        const crimsonEdge = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, 0xdc2626, 0.92, true))
        crimsonEdge.scale.setScalar(pr.radius * 2.35)
        crimsonEdge.position.y = 0.6
        const whiteRazor = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, 0xffffff, 0.99, true))
        whiteRazor.scale.setScalar(pr.radius * 1.75)
        whiteRazor.position.y = 1.2
        wing.add(darkCore, crimsonEdge, whiteRazor)
        grp.add(wing)
      }
      this.addTierMotes3D(grp, 0, 0, -6, pr.radius * 1.1, 4, 0xdc2626, 0xffffff)
    } else if (pr.kind === 'pound_ho' || pr.kind === 'black_flame_wave' || pr.kind === 'atk_default_pulse' || pr.kind === 'atk_rimuru_water') {
      // Triple-Tier Crescent Blade Wave + Tier Voxels/Crystals!
      const cOuter = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, col, 0.55, true))
      cOuter.scale.setScalar(pr.radius * 1.68)
      const cA = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, col, 0.85, true))
      cA.scale.setScalar(pr.radius * 1.42)
      cA.position.y = 0.8
      const cB = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, acc, 0.98, true))
      cB.scale.setScalar(pr.radius * 1.15)
      cB.position.y = 1.6
      grp.add(cOuter, cA, cB)
      this.addTierMotes3D(grp, 0, 0, -4, pr.radius * 0.95, 4, col, acc)
    } else if (pr.kind === 'gate_sword' || pr.kind === 'atk_gilga_sword') {
      // Gilgamesh Gate of Babylon Rippled Golden Portal + Divine Sword
      const portalOuter = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.92))
      portalOuter.scale.setScalar(15)
      portalOuter.position.set(0, 0, -16)
      portalOuter.userData.spinSpeed = 0.025
      const portalInner = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xfef08a, 0.96))
      portalInner.scale.setScalar(9.5)
      portalInner.position.set(0, 0, -14)
      const blade = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0xfef08a, 0.99))
      blade.scale.set(5.5 * this.lineScale, 3.2, 44)
      const fuller = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0xef4444, 0.95))
      fuller.scale.set(2.4 * this.lineScale, 3.8, 28)
      const hilt = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0xf59e0b, 0.98))
      hilt.scale.set(18, 4.5, 4.5)
      hilt.position.set(0, 0, -10)
      grp.add(portalOuter, portalInner, blade, fuller, hilt)
    } else if (pr.kind === 'fuga_arrow') {
      // Sukuna "Kamino / Fuga" (Open): Colossal Blazing Hellfire Arrow + Spinning Fire Vortex Rings!
      const tip = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0xffffff, 0.99))
      tip.rotation.x = Math.PI / 2
      tip.scale.set(20, 42, 14)
      tip.position.set(0, 0, 20)
      const outerFlame = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0xf97316, 0.86))
      outerFlame.rotation.x = -Math.PI / 2
      outerFlame.scale.set(26, 64, 22)
      outerFlame.position.set(0, 0, -12)
      const shaft = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0xfef08a, 0.99))
      shaft.scale.set(6.5 * this.lineScale, 6.5 * this.lineScale, 58)
      const ringA = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xef4444, 0.95))
      ringA.scale.setScalar(20)
      ringA.position.set(0, 0, 4)
      ringA.userData.spinSpeed = 0.026
      const ringB = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.96))
      ringB.scale.setScalar(14)
      ringB.position.set(0, 0, -14)
      ringB.userData.spinSpeed = -0.03
      grp.add(tip, outerFlame, shaft, ringA, ringB)
      this.addTierMotes3D(grp, 0, 0, -6, 18, 5, 0xf97316, 0xfef08a)
    } else if (pr.kind === 'atk_itachi_kunai') {
      const tip = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, acc, 0.99))
      tip.rotation.x = Math.PI / 2
      tip.scale.set(11, 28, 7)
      tip.position.set(0, 0, 10)
      const shaft = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, col, 0.96))
      shaft.scale.set(4.5 * this.lineScale, 4.5 * this.lineScale, 30)
      const ring = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xdc2626, 0.94))
      ring.scale.setScalar(5.5)
      ring.position.set(0, 0, -14)
      grp.add(tip, shaft, ring)
    } else if (pr.kind === 'gojo_red' || pr.kind === 'gojo_blue') {
      const isBlue = pr.kind === 'gojo_blue'
      // Gojo Lapse Blue (Abyssal Implosion Singularity) vs Reversal Red (Blazing Repulsion Singularity)
      const core = this.allocMesh(
        coreGeo,
        this.mkMat(grp, isBlue ? 0x020617 : 0xffffff, 0.99),
      )
      core.scale.setScalar(pr.radius * 0.72)
      const innerCorona = this.allocMesh(
        coreGeo,
        this.mkMat(grp, isBlue ? 0x38bdf8 : 0xef4444, 0.82),
      )
      innerCorona.scale.setScalar(pr.radius * 1.22)
      const outerHalo = this.allocMesh(
        this.sharedSphereGeo,
        this.mkMat(grp, isBlue ? 0x7dd3fc : 0xfca5a5, 0.36),
      )
      outerHalo.scale.setScalar(pr.radius * 1.8)
      const gyroA = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, acc, 0.96))
      gyroA.scale.setScalar(pr.radius * 1.5)
      gyroA.rotation.x = 0.65
      gyroA.userData.spinSpeed = 0.024
      const gyroB = this.allocMesh(
        this.sharedTorusGeo,
        this.mkMat(grp, isBlue ? 0x0284c7 : 0xdc2626, 0.92),
      )
      gyroB.scale.setScalar(pr.radius * 1.85)
      gyroB.rotation.y = 0.85
      gyroB.userData.spinSpeed = -0.02
      grp.add(core, innerCorona, outerHalo, gyroA, gyroB)
      this.addTierMotes3D(grp, 0, 0, 0, pr.radius * 1.35, 5, isBlue ? 0x38bdf8 : 0xef4444, 0xffffff)
    } else if (pr.kind === 'aiouan_pounce') {
      const orb = this.allocMesh(coreGeo, this.mkMat(grp, 0xc084fc, 0.94))
      orb.scale.setScalar(pr.radius * 0.9)
      const ring = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.96))
      ring.rotation.x = Math.PI / 2
      ring.scale.setScalar(pr.radius * 1.2)
      ring.userData.spinSpeed = 0.025
      grp.add(orb, ring)
      this.addTierMotes3D(grp, 0, 0, -4, pr.radius, 4, 0xa855f7, 0xfacc15)
    } else if (pr.kind === 'naruto_rasenshuriken') {
      // Spinning 4-Blade Wind-Release Rasenshuriken + Glowing Azure Chakra Core!
      const core = this.allocMesh(coreGeo, this.mkMat(grp, 0xffffff, 0.99))
      core.scale.setScalar(pr.radius * 0.55)
      const innerOrb = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, col, 0.85))
      innerOrb.scale.setScalar(pr.radius * 0.9)
      const spin = new THREE.Group()
      spin.userData.spinSpeed = 0.036
      for (let b = 0; b < 4; b++) {
        const blade = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, b % 2 === 0 ? 0xe0f2fe : acc, 0.96))
        blade.scale.set(pr.radius * 2.9, 4.2, pr.radius * 0.42)
        blade.rotation.y = (b * Math.PI) / 4
        spin.add(blade)
      }
      const windRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, col, 0.9))
      windRing.rotation.x = Math.PI / 2
      windRing.scale.setScalar(pr.radius * 1.45)
      spin.add(windRing)
      grp.add(core, innerOrb, spin)
      this.addTierMotes3D(grp, 0, 0, -6, pr.radius * 1.25, 5, col, acc)
    } else if (pr.kind === 'ben10_heatblast' || pr.kind === 'atk_ben10_plasma' || pr.kind === 'atk_ben10_omni') {
      // Blazing Heatblast Magma Fireball / Emerald Omnitrix Plasma Bolt
      const isOmni = pr.kind === 'atk_ben10_plasma' || pr.kind === 'atk_ben10_omni'
      const core = this.allocMesh(coreGeo, this.mkMat(grp, isOmni ? 0xffffff : 0xfef08a, 0.99))
      core.scale.setScalar(pr.radius * 0.72)
      const shell = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, isOmni ? 0x22c55e : 0xf97316, 0.78))
      shell.scale.setScalar(pr.radius * 1.35)
      const ring = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, isOmni ? 0x86efac : 0xef4444, 0.94))
      ring.scale.setScalar(pr.radius * 1.45)
      ring.userData.spinSpeed = 0.028
      grp.add(core, shell, ring)
      this.addTierMotes3D(grp, 0, 0, -6, pr.radius * 1.1, 4, col, acc)
    } else if (pr.kind === 'diablo_despair_claw' || pr.kind === 'diablo_despair_wave' || pr.kind === 'atk_diablo_orb' || pr.kind === 'atk_diablo_claw') {
      // Primordial Noir Crimson-Obsidian Demonic Crescent / Energy Sphere
      const darkOrb = this.allocMesh(coreGeo, this.mkMat(grp, 0x09090b, 0.96))
      darkOrb.scale.setScalar(pr.radius * 0.85)
      const slash = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, 0xdc2626, 0.94, true))
      slash.scale.setScalar(pr.radius * 1.85)
      const goldTrim = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, 0xfacc15, 0.98, true))
      goldTrim.scale.setScalar(pr.radius * 1.45)
      goldTrim.position.y = 1.0
      grp.add(darkOrb, slash, goldTrim)
      this.addTierMotes3D(grp, 0, 0, -4, pr.radius * 1.05, 4, 0xdc2626, 0xfacc15)
    } else {
      const core = this.allocMesh(coreGeo, this.mkMat(grp, acc, 0.99))
      core.scale.setScalar(pr.radius * 0.78)
      const halo = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, col, 0.48))
      halo.scale.setScalar(pr.radius * 1.6)
      const spinRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, col, 0.92))
      spinRing.scale.setScalar(pr.radius * 1.15)
      spinRing.rotation.x = 0.7
      spinRing.userData.spinSpeed = 0.024
      grp.add(core, halo, spinRing)
      this.addTierMotes3D(grp, 0, 0, -6, pr.radius * 0.95, 3, col, acc)
    }
    return grp
  }

  syncProjectiles(list: Projectile[], dt: number, animTime: number): void {
    const aliveIds = new Set<string>()
    const blend = 1 - Math.exp(-12 * dt)
    for (const pr of list) {
      aliveIds.add(pr.id)
      pr.x += pr.vx * dt
      pr.y += pr.vy * dt

      let st = this.projMeshes.get(pr.id)
      if (!st) {
        const grp = this.buildProjectileGroup(pr)
        this.group.add(grp)
        st = { grp, rx: pr.x, rz: pr.y }
        this.projMeshes.set(pr.id, st)
      } else {
        // Advance smoothly at local 60-120fps and gently reconcile toward bursty TCP coordinates
        st.rx += pr.vx * dt
        st.rz += pr.vy * dt
        const ex = pr.x - st.rx
        const ez = pr.y - st.rz
        if (Math.hypot(ex, ez) > 140) {
          st.rx = pr.x
          st.rz = pr.y
        } else {
          st.rx += ex * blend
          st.rz += ez * blend
        }
      }

      st.grp.position.set(st.rx, 26, st.rz)
      if (pr.kind === 'crow_shuriken') {
        st.grp.rotation.y = animTime * 0.022
      } else {
        st.grp.rotation.y = Math.atan2(pr.vx, pr.vy)
      }
      for (const ch of st.grp.children) {
        if (ch.userData.spinSpeed) {
          ch.rotation.y += animTime * 0.0001
          ch.rotation.z = animTime * (ch.userData.spinSpeed as number)
        }
      }
    }

    for (const [id, st] of this.projMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(st.grp)
        this.recycleGroupResources(st.grp)
        this.projMeshes.delete(id)
      }
    }
  }

  private buildBeamGroup(b: BeamEffect): THREE.Group {
    const grp = new THREE.Group()
    const col = hexNum(b.color, 0x38bdf8)
    const acc = hexNum(b.accentColor, 0xffffff)
    const dx = b.x2 - b.x1
    const dz = b.y2 - b.y1
    const len = Math.max(12, Math.hypot(dx, dz))
    const yaw = Math.atan2(dx, dz)

    if (
      b.kind === 'atk_zoro_sweep' ||
      b.kind === 'atk_zenitsu_slash' ||
      b.kind === 'atk_aiouan_paw' ||
      b.kind === 'atk_thanos_gauntlet' ||
      b.kind === 'atk_jinwoo_dagger' ||
      b.kind === 'atk_sanji_kick' ||
      b.kind === 'atk_naruto_punch' ||
      b.kind === 'atk_naruto_rasen'
    ) {
      // Dramatic Triple-Layered 3D Crescent Slash Arc + Tier Voxels/Crystals + Katana Star Glints!
      const rad = b.kind === 'atk_zoro_sweep' ? 132 : 116
      const c0 = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, col, 0.45, true))
      c0.scale.setScalar(rad * 1.12)
      c0.position.set(b.x1, 20, b.y1)
      c0.rotation.y = yaw
      const c1 = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, col, 0.8, true))
      c1.scale.setScalar(rad * 0.85)
      c1.position.set(b.x1, 22, b.y1)
      c1.rotation.y = yaw
      const c2 = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, acc, 0.98, true))
      c2.scale.setScalar(rad)
      c2.position.set(b.x1, 24, b.y1)
      c2.rotation.y = yaw
      grp.add(c0, c1, c2)
      if (b.kind === 'atk_zenitsu_slash') {
        this.addJaggedBolt3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 0xfacc15, 0x7dd3fc, 13, 5, b.x1)
      } else if (b.kind === 'atk_zoro_sweep') {
        this.addJaggedBolt3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 0x10b981, 0xc084fc, 10, 4, b.x1)
      } else if (b.kind === 'atk_jinwoo_dagger') {
        this.addJaggedBolt3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 0x7c3aed, 0x38bdf8, 11, 4, b.x1)
      } else if (b.kind === 'atk_sanji_kick') {
        this.addJaggedBolt3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 0xf97316, 0x38bdf8, 10, 4, b.x1)
      }
      this.addTierMotes3D(grp, b.x2, 24, b.y2, 28, 4, col, acc)
      this.addStarGlint(grp, b.x2, 26, b.y2, 24, acc)
      return grp
    }

    if (
      b.kind === 'jinwoo_dagger_rush' ||
      b.kind === 'jinwoo_dagger_dash' ||
      b.kind === 'sanji_sky_kick' ||
      b.kind === 'sanji_skywalk' ||
      b.kind === 'sanji_ifrit_kick' ||
      b.kind === 'sanji_ifrit_rush' ||
      b.kind === 'ben10_xlr8_blitz'
    ) {
      // Blazing High-Speed Dash Strike Corridor + Afterimage Ghosts + Lightning/Flame Helix!
      const isIfrit = b.kind === 'sanji_ifrit_kick' || b.kind === 'sanji_ifrit_rush'
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, isIfrit ? 26 : 18, col, 0.62)
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, isIfrit ? 10 : 7, 0xffffff, 0.99)
      this.addJaggedBolt3D(grp, b.x1, 26, b.y1, b.x2, 26, b.y2, col, acc, isIfrit ? 20 : 15, 6, b.x1 + b.y2)
      for (let i = 1; i <= 3; i++) {
        const t = i / 4
        this.spawnDashGhost(b.x1 + dx * t, b.y1 + dz * t, yaw, col)
      }
      this.addRing3D(grp, b.x2, 3, b.y2, isIfrit ? 88 : 56, acc, 0.96, 0.28)
      this.addTierMotes3D(grp, b.x2, 26, b.y2, isIfrit ? 54 : 34, 6, col, acc)
      this.addStarGlint(grp, b.x2, 28, b.y2, isIfrit ? 42 : 28, acc)
      return grp
    }

    if (b.kind === 'naruto_rasengan') {
      // Spinning Azure/Golden Kurama Rasengan Spiral Charge + Shockwave Cone!
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 16, col, 0.52)
      const orb = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, col, 0.88))
      orb.scale.setScalar(26)
      orb.position.set(b.x2, 26, b.y2)
      const core = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0xffffff, 0.99))
      core.scale.setScalar(14)
      core.position.set(b.x2, 26, b.y2)
      const ringA = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, acc, 0.96))
      ringA.scale.setScalar(34)
      ringA.position.set(b.x2, 26, b.y2)
      ringA.rotation.x = 0.7
      const ringB = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, col, 0.92))
      ringB.scale.setScalar(42)
      ringB.position.set(b.x2, 26, b.y2)
      ringB.rotation.y = 0.9
      grp.add(orb, core, ringA, ringB)
      this.addRing3D(grp, b.x2, 3, b.y2, 68, col, 0.94, 0.26)
      this.addTierMotes3D(grp, b.x2, 26, b.y2, 46, 6, col, acc)
      this.addStarGlint(grp, b.x2, 28, b.y2, 36, 0xffffff)
      return grp
    }

    if (b.kind === 'luffy_pistol' || b.kind === 'atk_luffy_punch' || b.kind === 'luffy_gatling_fist') {
      // Stretched Rubber Arm + Red-Black Busoshoku Haki Impact Fist + Shock Rings!
      const isPistol = b.kind === 'luffy_pistol'
      this.addSegment3D(grp, b.x1, 25, b.y1, b.x2, 25, b.y2, isPistol ? 14 : 9, 0xfde0c4, 0.88)
      this.addSegment3D(grp, b.x1, 25, b.y1, b.x2, 25, b.y2, isPistol ? 22 : 14, 0xef4444, 0.38)
      const fist = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x18181b, 0.98))
      fist.scale.setScalar(isPistol ? 26 : 16)
      fist.position.set(b.x2, 25, b.y2)
      const hakiHalo = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xef4444, 0.96))
      hakiHalo.scale.setScalar(isPistol ? 32 : 20)
      hakiHalo.position.set(b.x2, 25, b.y2)
      hakiHalo.rotation.y = yaw
      grp.add(fist, hakiHalo)
      if (isPistol) {
        this.addJaggedBolt3D(grp, b.x1, 25, b.y1, b.x2, 25, b.y2, 0x09090b, 0xef4444, 14, 5, b.x1)
      }
      this.addRing3D(grp, b.x2, 3, b.y2, isPistol ? 64 : 38, 0xef4444, 0.94, 0.25)
      this.addStarGlint(grp, b.x2, 26, b.y2, isPistol ? 34 : 20, 0xfacc15)
      return grp
    }

    if (b.kind === 'atk_sukuna_cleave') {
      // Sukuna "Hachi" (Cleave): Caster Claw Crescent + Triple Cross-Hatched Razor Slashes + Ground Spiderweb Fracture!
      const claw = this.allocMesh(this.sharedSlashGeo, this.mkMat(grp, 0xdc2626, 0.88, true))
      claw.scale.setScalar(98)
      claw.position.set(b.x1, 24, b.y1)
      claw.rotation.y = yaw
      grp.add(claw)

      const tx = b.x2
      const tz = b.y2
      for (const [ox, oz, oy] of [
        [54, 44, 34],
        [54, -44, 24],
        [-50, 14, 30],
      ] as const) {
        this.addSegment3D(grp, tx - ox, 20, tz - oz, tx + ox, oy, tz + oz, 10.5, 0x09090b, 0.94)
        this.addSegment3D(grp, tx - ox, 22, tz - oz, tx + ox, oy + 2, tz + oz, 5.2, 0xef4444, 0.98)
        this.addSegment3D(grp, tx - ox, 24, tz - oz, tx + ox, oy + 4, tz + oz, 2.5, 0xffffff, 0.99)
      }
      // Spiderweb ground cleave fracture under target
      this.addRing3D(grp, tx, 2.5, tz, 56, 0xdc2626, 0.94, 0.24)
      for (let s = 0; s < 6; s++) {
        const a = (s * Math.PI) / 3
        this.addSegment3D(grp, tx, 3, tz, tx + Math.cos(a) * 60, 3, tz + Math.sin(a) * 60, 3.2, 0x09090b, 0.9)
      }
      this.addTierMotes3D(grp, tx, 22, tz, 34, 5, 0xdc2626, 0xffffff)
      this.addStarGlint(grp, tx, 28, tz, 28, 0xfb7185)
      return grp
    }

    if (b.kind === 'atk_gojo_punch') {
      // Gojo Lapse-Blue Spatial Vacuum Fist + Black Flash (Kokusen) Crimson-Black Lightning Sparks!
      this.addSegment3D(grp, b.x1, 25, b.y1, b.x2, 25, b.y2, 18, 0x38bdf8, 0.56)
      this.addSegment3D(grp, b.x1, 25, b.y1, b.x2, 25, b.y2, 7.5, 0xffffff, 0.99)
      const shockCone = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0x38bdf8, 0.72))
      shockCone.rotation.x = Math.PI / 2
      shockCone.scale.set(30, 50, 30)
      shockCone.position.set(b.x2, 25, b.y2)
      shockCone.rotation.y = yaw
      grp.add(shockCone)
      this.addRing3D(grp, b.x2, 3, b.y2, 58, 0x38bdf8, 0.96, 0.26)
      this.addRing3D(grp, b.x2, 4, b.y2, 36, 0xa855f7, 0.94, 0)
      for (let k = 0; k < 4; k++) {
        const a = yaw + (k - 1.5) * 0.85
        const r = 66
        this.addJaggedBolt3D(
          grp,
          b.x2,
          25,
          b.y2,
          b.x2 + Math.cos(a) * r,
          12 + (k % 2) * 24,
          b.y2 + Math.sin(a) * r,
          k % 2 === 0 ? 0x09090b : 0x38bdf8,
          k % 2 === 0 ? 0xef4444 : 0xffffff,
          12,
          4,
          b.x2 + k * 7,
        )
      }
      this.addTierMotes3D(grp, b.x2, 25, b.y2, 32, 5, 0x38bdf8, 0xef4444)
      this.addStarGlint(grp, b.x2, 26, b.y2, 30, 0x38bdf8)
      return grp
    }

    if (b.kind === 'gojo_cast_red' || b.kind === 'gojo_cast_blue') {
      const isBlue = b.kind === 'gojo_cast_blue'
      const mainHex = isBlue ? 0x38bdf8 : 0xef4444
      for (let i = 1; i <= 3; i++) {
        const t = i / 3
        const ring = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, i === 3 ? 0xffffff : mainHex, 0.94))
        ring.scale.setScalar(isBlue ? (4 - i) * 9.5 : i * 9.5)
        ring.position.set(b.x1 + dx * t, 26, b.y1 + dz * t)
        ring.rotation.y = yaw
        grp.add(ring)
      }
      this.addJaggedBolt3D(grp, b.x1, 26, b.y1, b.x2, 26, b.y2, mainHex, 0xffffff, 11, 4, b.x1)
      this.addTierMotes3D(grp, b.x2, 26, b.y2, 24, 4, mainHex, 0xffffff)
      this.addStarGlint(grp, b.x2, 26, b.y2, 26, mainHex)
      return grp
    }

    if (b.kind === 'infinite_void_open') {
      // Descending Cosmic Pillar of Unlimited Void + Six-Eyes Rings!
      this.addJaggedBolt3D(grp, b.x2, 340, b.y2, b.x2, 6, b.y2, 0x38bdf8, 0xffffff, 22, 7, b.x2)
      for (let i = 0; i < 4; i++) {
        this.addRing3D(grp, b.x2, 6 + i * 55, b.y2, 134 - i * 22, i % 2 === 0 ? 0x38bdf8 : 0xc084fc, 0.94, 0.16)
      }
      this.addTierMotes3D(grp, b.x2, 36, b.y2, 72, 8, 0x38bdf8, 0xc084fc)
      this.addStarGlint(grp, b.x2, 42, b.y2, 50, 0xffffff)
      return grp
    }

    if (b.kind === 'hollow_purple_blast') {
      // Overlapping Red (赫) & Blue (蒼) Venn Rings snapping into Imaginary-Mass Purple (茈)!
      const mx = (b.x1 + b.x2) * 0.5
      const mz = (b.y1 + b.y2) * 0.5
      const redRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xef4444, 0.96))
      redRing.scale.setScalar(70)
      redRing.position.set(mx - 34, 34, mz)
      const blueRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0x38bdf8, 0.96))
      blueRing.scale.setScalar(70)
      blueRing.position.set(mx + 34, 34, mz)
      const purpleRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xc084fc, 0.99))
      purpleRing.scale.setScalar(98)
      purpleRing.position.set(mx, 34, mz)
      grp.add(redRing, blueRing, purpleRing)
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3
        this.addJaggedBolt3D(grp, mx, 34, mz, mx + Math.cos(a) * 185, 14, mz + Math.sin(a) * 185, 0x9333ea, 0xffffff, 18, 5, k)
      }
      this.addTierMotes3D(grp, mx, 34, mz, 84, 8, 0xa855f7, 0xffffff)
      this.addStarGlint(grp, mx, 38, mz, 58, 0xf0abfc)
      return grp
    }

    if (b.kind === 'atk_gilga_flash') {
      for (const [px, pz] of [[b.x1, b.y1], [b.x2, b.y2]] as const) {
        this.addRing3D(grp, px, 22, pz, 26, 0xfacc15, 0.96, 0.28)
        this.addStarGlint(grp, px, 24, pz, 18, 0xfef08a)
      }
      return grp
    }

    if (b.kind === 'atk_simo_rifle' || b.kind === 'simo_snipe_off' || b.kind === 'simo_backflip_shot') {
      // Simo Hayha M/28-30 Frost Rifle Shot / Off-Center Glancing Shot / Backflip Disengage Shot
      const isBackflip = b.kind === 'simo_backflip_shot'
      this.addSegment3D(grp, b.x1, 26, b.y1, b.x2, 26, b.y2, isBackflip ? 14 : 9.5, col, 0.7)
      this.addSegment3D(grp, b.x1, 26, b.y1, b.x2, 26, b.y2, isBackflip ? 5.5 : 3.8, 0xffffff, 0.99)
      this.addRing3D(grp, b.x1 + dx * 0.06, 26, b.y1 + dz * 0.06, isBackflip ? 26 : 16, 0xfef08a, 0.94, 0)
      this.addRing3D(grp, b.x2, 3, b.y2, isBackflip ? 50 : 32, col, 0.94, 0.24)
      this.addTierMotes3D(grp, b.x2, 24, b.y2, isBackflip ? 34 : 22, 4, col, 0xffffff)
      this.addStarGlint(grp, b.x2, 26, b.y2, isBackflip ? 30 : 20, 0xe0f2fe)
      return grp
    }

    if (b.kind === 'simo_snipe_max') {
      // Simo Hayha 100% Charged Elsu Snipe (50% Enemy HP!): Blazing Supersonic Crimson-Frost Rail + 7 Sonic Boom Rings!
      this.addSegment3D(grp, b.x1, 27, b.y1, b.x2, 27, b.y2, 25, 0xef4444, 0.62)
      this.addSegment3D(grp, b.x1, 27, b.y1, b.x2, 27, b.y2, 13, 0x38bdf8, 0.88)
      this.addSegment3D(grp, b.x1, 27, b.y1, b.x2, 27, b.y2, 5.5, 0xffffff, 0.99)
      for (let r = 1; r <= 7; r++) {
        const t = r / 7.5
        const ring = this.allocMesh(
          this.sharedTorusGeo,
          this.mkMat(grp, r % 2 === 0 ? 0x38bdf8 : 0xef4444, 0.95),
        )
        ring.scale.setScalar(18 + r * 3.5)
        ring.position.set(b.x1 + dx * t, 27, b.y1 + dz * t)
        ring.rotation.y = yaw
        grp.add(ring)
      }
      this.addRing3D(grp, b.x2, 3, b.y2, 76, 0xef4444, 0.96, 0.3)
      this.addTierMotes3D(grp, b.x2, 27, b.y2, 52, 7, 0x38bdf8, 0xef4444)
      this.addStarGlint(grp, b.x1, 27, b.y1, 34, 0xfef08a)
      this.addStarGlint(grp, b.x2, 28, b.y2, 48, 0xffffff)
      return grp
    }

    if (b.kind === 'basic_lock_reticle' || b.kind === 'aiouan_lock_beam') {
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 3.4, acc, 0.78)
      this.addRing3D(grp, b.x2, 3, b.y2, 36, col, 0.95, 0.24)
      this.addTierMotes3D(grp, b.x2, 22, b.y2, 22, 3, col, acc)
      this.addStarGlint(grp, b.x2, 28, b.y2, 20, acc)
      return grp
    }

    if (b.kind === 'killua_leap_arc') {
      const steps = 8
      let lx = b.x1
      let ly = 24
      let lz = b.y1
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const nx = b.x1 + dx * t
        const ny = 24 + Math.sin(t * Math.PI) * 95
        const nz = b.y1 + dz * t
        this.addSegment3D(grp, lx, ly, lz, nx, ny, nz, 8.5, col, 0.78)
        this.addSegment3D(grp, lx, ly, lz, nx, ny, nz, 3.8, acc, 0.99)
        lx = nx
        ly = ny
        lz = nz
      }
      this.addTierMotes3D(grp, b.x2, 20, b.y2, 32, 4, col, acc)
      return grp
    }

    if (b.kind === 'narukami_strike' || b.kind === 'black_lightning_strike' || b.kind === 'aiouan_timestop_burst') {
      // Sky-Descending Jagged Lightning Strike from High Heavens (Y=380 -> Y=0)
      this.addJaggedBolt3D(grp, b.x2, 360, b.y2, b.x2, 4, b.y2, col, acc, 22, 7, b.x2 + b.y2)
      this.addRing3D(grp, b.x2, 3, b.y2, 78, acc, 0.96, 0.3)
      this.addRing3D(grp, b.x2, 4, b.y2, 48, 0xffffff, 0.94, 0)
      this.addTierMotes3D(grp, b.x2, 24, b.y2, 48, 6, col, acc)
      this.addStarGlint(grp, b.x2, 22, b.y2, 30, acc)
      return grp
    }

    if (b.kind === 'gilga_sky_sword') {
      // Overhead Golden Gate Portal at Y=240 + Plunging Divine Sword
      const portal = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.95))
      portal.rotation.x = Math.PI / 2
      portal.scale.setScalar(28)
      portal.position.set(b.x2, 240, b.y2)
      grp.add(portal)
      this.addSegment3D(grp, b.x2, 240, b.y2, b.x2, 10, b.y2, 8.5, 0xfacc15, 0.96)
      this.addSegment3D(grp, b.x2, 240, b.y2, b.x2, 10, b.y2, 3.8, 0xffffff, 0.99)
      this.addRing3D(grp, b.x2, 3, b.y2, 44, 0xfacc15, 0.92, 0.24)
      this.addTierMotes3D(grp, b.x2, 18, b.y2, 28, 4, 0xfacc15, 0xfef08a)
      return grp
    }

    if (b.kind === 'zenitsu_hekireki' || b.kind === 'zenitsu_rokuren' || b.kind === 'shishi_sonson' || b.kind === 'zenitsu_murad_slash') {
      // High-Impact Dash Corridor + Sonic Silhouettes + Jagged Thunder + Katana Glints
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 19, col, 0.5)
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 7.5, 0xffffff, 0.99)
      this.addJaggedBolt3D(grp, b.x1, 26, b.y1, b.x2, 26, b.y2, col, acc, 18, 7, b.x1 + b.y2)
      if (b.kind !== 'zenitsu_murad_slash') {
        const copies = b.kind === 'zenitsu_rokuren' ? 4 : 3
        for (let i = 1; i <= copies; i++) {
          const t = i / (copies + 1)
          const gx = b.x1 + dx * t
          const gz = b.y1 + dz * t
          this.spawnDashGhost(gx, gz, yaw, col)
        }
        this.addRing3D(grp, b.x2, 3, b.y2, b.kind === 'zenitsu_rokuren' ? 80 : 60, acc, 0.94, 0.22)
      }
      this.addTierMotes3D(grp, (b.x1 + b.x2) * 0.5, 26, (b.y1 + b.y2) * 0.5, 36, 5, col, acc)
      this.addStarGlint(grp, b.x1, 26, b.y1, 20, col)
      this.addStarGlint(grp, b.x2, 26, b.y2, 30, acc)
      return grp
    }

    if (b.kind === 'atk_killua_spark' || b.kind === 'lightning_arc' || b.kind === 'narukami_radial_beam' || b.kind === 'thunder_slam_burst') {
      this.addJaggedBolt3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, col, acc, 15, 6, b.x1 * 0.1)
      this.addRing3D(grp, b.x2, 3, b.y2, 34, acc, 0.88, 0)
      this.addTierMotes3D(grp, b.x2, 22, b.y2, 20, 3, col, acc)
      return grp
    }

    // Mega Beams & Shock Corridors (Kamehameha, Enuma Elish, Saitama Serious Punch, Mind Beam, Way Big Cosmic Ray!)
    const w = Math.max(8, b.width * 0.56) * this.lineScale
    const auraSheath = this.allocMesh(this.sharedCylGeo, this.mkMat(grp, col, 0.28))
    auraSheath.scale.set(w * 1.48, w * 1.48, len)
    auraSheath.position.set((b.x1 + b.x2) * 0.5, 25, (b.y1 + b.y2) * 0.5)
    auraSheath.rotation.y = yaw

    const outer = this.allocMesh(this.sharedCylGeo, this.mkMat(grp, col, 0.64))
    outer.scale.set(w, w, len)
    outer.position.set((b.x1 + b.x2) * 0.5, 25, (b.y1 + b.y2) * 0.5)
    outer.rotation.y = yaw

    const inner = this.allocMesh(this.sharedCylGeo, this.mkMat(grp, acc, 0.99))
    inner.scale.set(w * 0.48, w * 0.48, len)
    inner.position.set((b.x1 + b.x2) * 0.5, 25, (b.y1 + b.y2) * 0.5)
    inner.rotation.y = yaw
    grp.add(auraSheath, outer, inner)

    if (
      b.kind === 'kamehameha' ||
      b.kind === 'enuma_elish' ||
      b.kind === 'saitama_serious_punch' ||
      b.kind === 'goku_dragon_rush' ||
      b.kind === 'thanos_mind_beam' ||
      b.kind === 'ben10_cosmic_ray'
    ) {
      for (let r = 1; r <= 6; r++) {
        const t = r / 6.5
        const ring = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, r % 2 === 0 ? 0xffffff : acc, 0.95))
        ring.scale.setScalar(w * (0.95 + r * 0.16))
        ring.position.set(b.x1 + dx * t, 25, b.y1 + dz * t)
        ring.rotation.y = yaw
        grp.add(ring)
      }
      // Twin Coiling Plasma Bolt Helices + Ground Impact Shockwave Ring along Mega Beam!
      this.addJaggedBolt3D(grp, b.x1, 26, b.y1, b.x2, 26, b.y2, col, 0xffffff, w * 0.72, 6, b.x1)
      this.addJaggedBolt3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, acc, 0xffffff, w * 0.58, 5, b.y2 + 19)
      this.addRing3D(grp, b.x2, 3, b.y2, w * 2.1, acc, 0.95, 0.28)
      this.addTierMotes3D(grp, b.x2, 26, b.y2, w * 1.55, 7, col, acc)
      this.addStarGlint(grp, b.x1, 26, b.y1, 28, col)
      this.addStarGlint(grp, b.x2, 26, b.y2, 42, acc)
    } else if (b.kind === 'aiouan_ora_rush') {
      const fistGeo = this.isPixelTier ? this.sharedBoxGeo : this.sharedSphereGeo
      for (let f = 1; f <= 6; f++) {
        const t = f / 6
        const fist = this.allocMesh(fistGeo, this.mkMat(grp, f % 2 === 0 ? 0xfacc15 : 0xc084fc, 0.96))
        fist.scale.setScalar(12)
        fist.position.set(b.x1 + dx * t + (f % 2 === 0 ? 12 : -12), 25 + (f % 2 === 0 ? 6 : -6), b.y1 + dz * t)
        grp.add(fist)
      }
      this.addStarGlint(grp, b.x2, 26, b.y2, 26, 0xfacc15)
    }
    return grp
  }

  syncBeams(list: BeamEffect[], dt: number): void {
    const aliveIds = new Set<string>()
    for (const b of list) {
      b.life = Math.max(0, b.life - dt)
      if (b.life <= 0) continue
      aliveIds.add(b.id)
      const alpha = Math.max(0, Math.min(1, b.life / Math.max(0.05, b.maxLife)))

      let grp = this.beamMeshes.get(b.id)
      if (!grp) {
        grp = this.buildBeamGroup(b)
        this.group.add(grp)
        this.beamMeshes.set(b.id, grp)
      }

      const mats = grp.userData.mats as THREE.MeshBasicMaterial[] | undefined
      if (mats) {
        for (const m of mats) {
          m.opacity = ((m.userData.baseOpacity as number) ?? 0.85) * alpha
        }
      }
    }

    for (const [id, grp] of this.beamMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(grp)
        this.recycleGroupResources(grp)
        this.beamMeshes.delete(id)
      }
    }
  }

  private buildZoneGroup(z: ZoneEffect, isWindup: boolean): THREE.Group {
    const grp = new THREE.Group()
    const col = hexNum(z.color, 0x38bdf8)
    const acc = hexNum(z.accentColor, 0xfef08a)

    if (isWindup) {
      // Clear Telegraphed Windup Seals before Detonation
      this.addRing3D(grp, 0, 2.0, 0, z.radius, acc, 0.92, 0.2)
      const innerSeal = this.allocMesh(this.sharedRingGeo, this.mkMat(grp, col, 0.88, true))
      innerSeal.scale.setScalar(z.radius * 0.72)
      innerSeal.position.y = 2.6
      innerSeal.userData.isPulseRing = true
      grp.add(innerSeal)

      if (
        z.kind === 'sanzen_sekai' ||
        z.kind === 'narukami_step2' ||
        z.kind === 'aiouan_timestop' ||
        z.kind === 'black_lightning' ||
        z.kind === 'luffy_bajrang_gun' ||
        z.kind === 'diablo_end_world'
      ) {
        const count = z.kind === 'aiouan_timestop' ? 8 : 6
        for (let i = 0; i < count; i++) {
          const a = (i * Math.PI * 2) / count
          this.addSegment3D(
            grp,
            Math.cos(a) * z.radius * 0.3,
            10,
            Math.sin(a) * z.radius * 0.3,
            Math.cos(a) * z.radius * 0.92,
            10,
            Math.sin(a) * z.radius * 0.92,
            4.5,
            i % 2 === 0 ? acc : col,
            0.9,
          )
        }
      }
      return grp
    }

    if (z.kind === 'zenitsu_honoo_no_kami') {
      // Pure 5-Point Star without Outer Circle + Crackling 3D Thunderbolts along every active ray!
      const baseAng = z.aimAngle ?? 0
      const activeSteps = Math.max(1, z.stepCount ?? 5)
      for (let step = 0; step < 5; step++) {
        const i1 = (step * 2) % 5
        const i2 = ((step + 1) * 2) % 5
        const a1 = baseAng + (i1 * Math.PI * 2) / 5
        const a2 = baseAng + (i2 * Math.PI * 2) / 5
        const x1 = Math.cos(a1) * z.radius
        const z1 = Math.sin(a1) * z.radius
        const x2 = Math.cos(a2) * z.radius
        const z2 = Math.sin(a2) * z.radius
        const isActive = step < activeSteps
        this.addSegment3D(grp, x1, 6, z1, x2, 6, z2, isActive ? 9 : 3.2, isActive ? 0xfef08a : 0xf59e0b, isActive ? 0.95 : 0.38)
        if (isActive) {
          this.addJaggedBolt3D(grp, x1, 10, z1, x2, 10, z2, 0xfacc15, 0x7dd3fc, 14, 5, step * 13)
          this.addStarGlint(grp, x2, 16, z2, 24, 0x7dd3fc)
        }
        this.addStarGlint(grp, x1, 14, z1, 18, 0xfacc15)
      }
      this.addTierMotes3D(grp, 0, 18, 0, z.radius * 0.72, 6, 0xfacc15, 0x7dd3fc)
      return grp
    }

    // Standard Base Domain Ring + Fill
    this.addRing3D(grp, 0, 1.8, 0, z.radius, col, 0.94, 0.28)
    this.addRing3D(grp, 0, 2.4, 0, z.radius * 0.72, acc, 0.82, 0)

    if (z.kind === 'malevolent_shrine') {
      // Anime Fukuma Mizushi (Malevolent Shrine): Abyssal Blood Lake + 4 Horned Demon Skulls + Multi-Tier Pagoda Shrine + 360° Slash Hurricane!
      const bloodFloor = this.allocMesh(this.sharedDiscGeo, this.mkMat(grp, 0x180205, 0.84, true))
      bloodFloor.position.y = 1.9
      bloodFloor.scale.setScalar(z.radius * 0.98)
      grp.add(bloodFloor)
      this.addRing3D(grp, 0, 2.5, 0, z.radius, 0xdc2626, 0.96, 0)
      this.addRing3D(grp, 0, 2.8, 0, z.radius * 0.84, 0xfb7185, 0.85, 0)

      // Altar Stone Plinth & Demonic Ribcage Core
      const plinth = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0x1c0407, 0.98))
      plinth.scale.set(116, 18, 72)
      plinth.position.set(0, 9, 0)
      const mawCore = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0xdc2626, 0.92))
      mawCore.scale.set(68, 56, 38)
      mawCore.position.set(0, 44, 0)
      grp.add(plinth, mawCore)

      // 4 Dark Crimson Shrine Timber Pillars
      for (const [px, pz] of [[-48, -26], [48, -26], [-48, 26], [48, 26]] as const) {
        const post = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0x2e0507, 0.98))
        post.scale.set(13, 96, 13)
        post.position.set(px, 48, pz)
        grp.add(post)
      }

      // 4 Colossal Bleached Horned Demon Skulls guarding the 4 corners of the Shrine
      for (const [sx, sz, yawRot] of [
        [-68, 44, -0.5],
        [68, 44, 0.5],
        [-68, -44, -2.6],
        [68, -44, 2.6],
      ] as const) {
        const skullGrp = new THREE.Group()
        skullGrp.position.set(sx, 20, sz)
        skullGrp.rotation.y = yawRot
        const cranium = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0xe2e8f0, 0.96))
        cranium.scale.set(18, 20, 18)
        const eyeL = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0xef4444, 0.99))
        eyeL.scale.setScalar(4.2)
        eyeL.position.set(-6, 2, 15)
        const eyeR = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0xef4444, 0.99))
        eyeR.scale.setScalar(4.2)
        eyeR.position.set(6, 2, 15)
        const hornL = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0xf8fafc, 0.96))
        hornL.scale.set(9, 24, 9)
        hornL.position.set(-14, 18, 0)
        hornL.rotation.z = 0.48
        const hornR = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0xf8fafc, 0.96))
        hornR.scale.set(9, 24, 9)
        hornR.position.set(14, 18, 0)
        hornR.rotation.z = -0.48
        skullGrp.add(cranium, eyeL, eyeR, hornL, hornR)
        grp.add(skullGrp)
      }

      // Double-Tiered Pagoda Roofs + Upturned Demonic Ridge Horns
      const beamLow = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0x7f1d1d, 0.98))
      beamLow.scale.set(146, 14, 84)
      beamLow.position.set(0, 88, 0)
      const roofLow = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0x450a0a, 0.98))
      roofLow.scale.set(162, 26, 108)
      roofLow.rotation.y = Math.PI / 4
      roofLow.position.set(0, 106, 0)
      const roofHigh = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0x991b1b, 0.98))
      roofHigh.scale.set(136, 38, 92)
      roofHigh.rotation.y = Math.PI / 4
      roofHigh.position.set(0, 136, 0)
      const ridgeBar = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0xfacc15, 0.95))
      ridgeBar.scale.set(96, 6, 8)
      ridgeBar.position.set(0, 154, 0)
      grp.add(beamLow, roofLow, roofHigh, ridgeBar)

      // Relentless Rotating Hurricane of Dismantle & Cleave Slash Arcs
      const slashStorm = new THREE.Group()
      slashStorm.userData.isShrineSlashStorm = true
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4
        const r = z.radius * (0.48 + (i % 2) * 0.34)
        const arc = this.allocMesh(
          this.sharedSlashGeo,
          this.mkMat(grp, i % 2 === 0 ? 0xffffff : 0xf43f5e, 0.94, true),
        )
        arc.scale.setScalar(72 + (i % 3) * 18)
        arc.position.set(Math.cos(ang) * r, 24 + (i % 4) * 22, Math.sin(ang) * r)
        arc.rotation.set((i % 2 === 0 ? 1 : -1) * 0.45, ang + Math.PI * 0.5, (i - 3) * 0.35)
        slashStorm.add(arc)
      }
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI) / 5
        const r = z.radius * (0.36 + (i % 3) * 0.24)
        const cx = Math.cos(ang) * r
        const cz = Math.sin(ang) * r
        const cy = 22 + (i % 4) * 24
        this.addSegment3D(
          slashStorm,
          cx - 38,
          cy - 14,
          cz - 28,
          cx + 38,
          cy + 14,
          cz + 28,
          i % 3 === 0 ? 6 : 3.5,
          i % 2 === 0 ? 0xffffff : i % 3 === 0 ? 0x09090b : 0xef4444,
          0.95,
        )
      }
      this.addTierMotes3D(slashStorm, 0, 32, 0, z.radius * 0.78, 8, 0xdc2626, 0xffffff)
      grp.add(slashStorm)
    } else if (z.kind === 'infinite_void') {
      // Anime Muryokusho (Unlimited Void): Abyssal Deep-Space Floor + Blinding Event Horizon + Levitating Black Hole Singularity & Accretion Disc!
      const voidFloor = this.allocMesh(this.sharedDiscGeo, this.mkMat(grp, 0x020617, 0.9, true))
      voidFloor.position.y = 1.95
      voidFloor.scale.setScalar(z.radius * 0.99)
      grp.add(voidFloor)
      this.addRing3D(grp, 0, 2.6, 0, z.radius, 0xffffff, 0.98, 0)
      this.addRing3D(grp, 0, 3.0, 0, z.radius * 0.94, 0x38bdf8, 0.94, 0)
      this.addRing3D(grp, 0, 3.3, 0, z.radius * 0.64, 0xc084fc, 0.78, 0)

      // Streaking White-Cyan Cosmic Neural Information Rays across the Abyss
      for (let r = 0; r < 14; r++) {
        const a = (r * Math.PI) / 7
        const innerR = z.radius * (0.18 + (r % 3) * 0.12)
        const outerR = z.radius * (0.72 + (r % 2) * 0.22)
        this.addSegment3D(
          grp,
          Math.cos(a) * innerR,
          3.5 + (r % 3) * 4,
          Math.sin(a) * innerR,
          Math.cos(a) * outerR,
          3.5 + (r % 3) * 4,
          Math.sin(a) * outerR,
          r % 2 === 0 ? 3.5 : 2.2,
          r % 3 === 0 ? 0xffffff : r % 2 === 0 ? 0x38bdf8 : 0xc084fc,
          0.88,
        )
      }

      // 22 Orbiting Cosmic Stars & Nebulae (Voxel Cubes in Pixel tiers, Spheres in HD/Ultra)
      const starGeo = this.isPixelTier ? this.sharedBoxGeo : this.sharedSphereGeo
      for (let s = 0; s < 22; s++) {
        const a = (s * Math.PI * 2) / 22
        const r = z.radius * (0.24 + ((s * 0.17) % 0.68))
        const star = this.allocMesh(
          starGeo,
          this.mkMat(grp, s % 3 === 0 ? 0xffffff : s % 2 === 0 ? 0x38bdf8 : 0xc084fc, 0.96),
        )
        star.scale.setScalar((s % 3 === 0 ? 5.6 : 4.2) * this.lineScale)
        star.position.set(Math.cos(a) * r, 14 + (s % 5) * 14, Math.sin(a) * r)
        grp.add(star)
      }

      // Colossal Levitating Black-Hole Event Horizon Singularity + Relativistic Photon Accretion Discs
      const blackHoleGrp = new THREE.Group()
      blackHoleGrp.position.set(0, 74, 0)
      blackHoleGrp.userData.isVoidAccretion = true
      const eventHorizon = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x020617, 0.99))
      eventHorizon.scale.setScalar(34)
      const photonShell = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x38bdf8, 0.36))
      photonShell.scale.setScalar(42)
      const photonRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xffffff, 0.98))
      photonRing.scale.setScalar(40)
      photonRing.rotation.x = 0.42
      const accretionOuter = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0x38bdf8, 0.92))
      accretionOuter.scale.setScalar(56)
      accretionOuter.rotation.x = 1.18
      const accretionViolet = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xc084fc, 0.88))
      accretionViolet.scale.setScalar(68)
      accretionViolet.rotation.set(1.18, 0.4, 0.25)
      blackHoleGrp.add(eventHorizon, photonShell, photonRing, accretionOuter, accretionViolet)
      grp.add(blackHoleGrp)
      this.addStarGlint(grp, 0, 74, 0, 52, 0xe0f2fe)
    } else if (z.kind === 'fuga_explosion') {
      // Sukuna "Kamino / Fuga" Detonation: Towering Shibuya Thermobaric Pillar of Hellfire!
      const innerPillar = this.allocMesh(this.sharedCylGeo, this.mkMat(grp, 0xfef08a, 0.96))
      innerPillar.rotation.x = Math.PI / 2
      innerPillar.scale.set(z.radius * 0.42, z.radius * 0.42, 230)
      innerPillar.position.set(0, 115, 0)
      const outerPillar = this.allocMesh(this.sharedCylGeo, this.mkMat(grp, 0xf97316, 0.72))
      outerPillar.rotation.x = Math.PI / 2
      outerPillar.scale.set(z.radius * 0.76, z.radius * 0.76, 210)
      outerPillar.position.set(0, 105, 0)
      grp.add(innerPillar, outerPillar)
      for (let r = 0; r < 3; r++) {
        this.addRing3D(grp, 0, 12 + r * 68, 0, z.radius * (1.05 - r * 0.18), r === 0 ? 0xffffff : 0xfacc15, 0.94, 0)
      }
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        const cone = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, i % 2 === 0 ? 0xef4444 : 0xfacc15, 0.92))
        cone.scale.set(24, 52, 24)
        cone.position.set(Math.cos(a) * z.radius * 0.72, 26, Math.sin(a) * z.radius * 0.72)
        grp.add(cone)
      }
      this.addTierMotes3D(grp, 0, 48, 0, z.radius * 0.85, 8, 0xf97316, 0xfef08a)
      this.addStarGlint(grp, 0, 64, 0, 56, 0xfef08a)
    } else if (z.kind === 'aiouan_timestop') {
      // Golden Clock Dial + Rotating Clock Hands + Giant Floating Astral Stand Cat "Ai-Ouan"!
      for (let h = 0; h < 12; h++) {
        const ha = (h * Math.PI) / 6
        this.addSegment3D(
          grp,
          Math.cos(ha) * z.radius * 0.76,
          4,
          Math.sin(ha) * z.radius * 0.76,
          Math.cos(ha) * z.radius * 0.96,
          4,
          Math.sin(ha) * z.radius * 0.96,
          h % 3 === 0 ? 7 : 3.5,
          0xfacc15,
          0.95,
        )
      }
      this.addSegment3D(grp, 0, 5, 0, 0, 5, -z.radius * 0.68, 6, 0xffffff, 0.96)
      this.addSegment3D(grp, 0, 5, 0, z.radius * 0.48, 5, 0, 8, 0xfacc15, 0.96)
      const catHead = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0xa855f7, 0.68))
      catHead.scale.set(34, 28, 30)
      catHead.position.set(0, 82, 0)
      for (const sx of [-18, 18]) {
        const ear = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0xc084fc, 0.78))
        ear.scale.set(18, 22, 14)
        ear.position.set(sx, 112, 0)
        const eye = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0xfef08a, 0.98))
        eye.scale.setScalar(5.5)
        eye.position.set(sx * 0.6, 86, 26)
        grp.add(ear, eye)
      }
      grp.add(catHead)
      this.addTierMotes3D(grp, 0, 44, 0, z.radius * 0.75, 8, 0xa855f7, 0xfacc15)
    } else if (z.kind === 'sanzen_sekai') {
      // King-of-Hell Cross Cleaves + Conqueror's Haki Lightning Spokes + Flames
      for (const ang of [-0.52, 0.52, Math.PI * 0.5]) {
        const r = z.radius * 0.92
        this.addSegment3D(grp, -Math.cos(ang) * r, 22, -Math.sin(ang) * r, Math.cos(ang) * r, 22, Math.sin(ang) * r, 12, 0xa855f7, 0.85)
        this.addSegment3D(grp, -Math.cos(ang) * r, 24, -Math.sin(ang) * r, Math.cos(ang) * r, 24, Math.sin(ang) * r, 5, 0x10b981, 0.98)
      }
      for (let f = 0; f < 8; f++) {
        const fa = (f * Math.PI) / 4
        const cone = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, f % 2 === 0 ? 0x10b981 : 0x9333ea, 0.88))
        cone.scale.set(18, 34, 18)
        cone.position.set(Math.cos(fa) * z.radius * 0.82, 18, Math.sin(fa) * z.radius * 0.82)
        grp.add(cone)
      }
      for (let b = 0; b < 4; b++) {
        const ba = (b * Math.PI) / 2 + 0.35
        this.addJaggedBolt3D(grp, 0, 26, 0, Math.cos(ba) * z.radius * 0.9, 8, Math.sin(ba) * z.radius * 0.9, 0x10b981, 0xc084fc, 14, 4, b)
      }
      this.addTierMotes3D(grp, 0, 28, 0, z.radius * 0.75, 6, 0x10b981, 0xc084fc)
      this.addStarGlint(grp, 0, 30, 0, 44, 0x34d399)
    } else if (z.kind === 'beelzebuth') {
      // Dark Event Horizon Core + Raphael Golden Gyro Ring + Abyssal Pull Spirals
      const blackCore = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x020617, 0.98))
      blackCore.scale.setScalar(30)
      blackCore.position.y = 32
      const photonRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0x38bdf8, 0.94))
      photonRing.scale.setScalar(34)
      photonRing.position.y = 32
      const raphaelRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.92))
      raphaelRing.scale.setScalar(44)
      raphaelRing.position.y = 32
      raphaelRing.rotation.x = 0.85
      grp.add(blackCore, photonRing, raphaelRing)
      for (let t = 0; t < 8; t++) {
        const a = (t * Math.PI) / 4
        this.addSegment3D(grp, Math.cos(a) * z.radius * 0.92, 6, Math.sin(a) * z.radius * 0.92, 0, 26, 0, 6, t % 2 === 0 ? 0x38bdf8 : 0xa855f7, 0.85)
      }
      this.addTierMotes3D(grp, 0, 30, 0, z.radius * 0.72, 8, 0x38bdf8, 0xfacc15)
    } else if (z.kind === 'gilga_sword_rain') {
      // 6 Golden Gate Sky Portals High Above + Plunging Golden Divine Swords!
      const portals = 6
      for (let i = 0; i < portals; i++) {
        const a = (i * Math.PI * 2) / portals
        const px = Math.cos(a) * z.radius * 0.56
        const pz = Math.sin(a) * z.radius * 0.56
        const portal = this.allocMesh(this.sharedDiscGeo, this.mkMat(grp, 0xfacc15, 0.88, true))
        portal.scale.setScalar(34)
        portal.position.set(px, 220, pz)
        grp.add(portal)
        this.addSegment3D(grp, px, 220, pz, px * 0.85, 8, pz * 0.85, 5.5, 0xfef08a, 0.94)
        this.addRing3D(grp, px * 0.85, 3, pz * 0.85, 22, 0xfacc15, 0.88, 0)
      }
      this.addTierMotes3D(grp, 0, 28, 0, z.radius * 0.7, 6, 0xfacc15, 0xef4444)
      this.addStarGlint(grp, 0, 24, 0, 34, 0xfacc15)
    } else if (z.kind === 'enkidu_field' || z.kind === 'thanos_space_vortex' || z.kind === 'thanos_time_mandala') {
      const spokes = z.kind === 'thanos_time_mandala' ? 6 : 8
      for (let s = 0; s < spokes; s++) {
        const a = (s * Math.PI * 2) / spokes
        this.addSegment3D(grp, Math.cos(a) * z.radius * 0.92, 6, Math.sin(a) * z.radius * 0.92, 0, 18, 0, 5.5, acc, 0.9)
      }
      this.addTierMotes3D(grp, 0, 18, 0, z.radius * 0.68, 5, col, acc)
    } else if (z.kind === 'amaterasu' || z.kind === 'fuga_cinder') {
      for (let i = 0; i < 10; i++) {
        const ang = i * 0.68
        const dist = z.radius * (0.25 + (i % 3) * 0.25)
        const flame = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, z.kind === 'amaterasu' ? 0x09090b : col, 0.94))
        flame.scale.set(17, 34, 17)
        flame.position.set(Math.cos(ang) * dist, 17, Math.sin(ang) * dist)
        grp.add(flame)
      }
      this.addTierMotes3D(grp, 0, 24, 0, z.radius * 0.7, 6, z.kind === 'amaterasu' ? 0x09090b : col, acc)
    } else if (z.kind === 'tsukuyomi') {
      const tomoeGeo = this.isPixelTier ? this.sharedBoxGeo : this.sharedSphereGeo
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3
        const tomoe = this.allocMesh(tomoeGeo, this.mkMat(grp, 0xef4444, 0.96))
        tomoe.scale.setScalar(12)
        tomoe.position.set(Math.cos(ang) * z.radius * 0.58, 18, Math.sin(ang) * z.radius * 0.58)
        grp.add(tomoe)
        this.addSegment3D(grp, 0, 18, 0, Math.cos(ang) * z.radius * 0.58, 18, Math.sin(ang) * z.radius * 0.58, 4, 0xdc2626, 0.88)
      }
      this.addTierMotes3D(grp, 0, 22, 0, z.radius * 0.72, 5, 0xdc2626, 0x09090b)
    } else if (z.kind === 'ora_meow_barrage') {
      const fistGeo = this.isPixelTier ? this.sharedBoxGeo : this.sharedSphereGeo
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4
        const fist = this.allocMesh(fistGeo, this.mkMat(grp, k % 2 === 0 ? 0xc084fc : 0xfacc15, 0.94))
        fist.scale.setScalar(14)
        fist.position.set(Math.cos(ang) * z.radius * 0.56, 22 + (k % 2) * 14, Math.sin(ang) * z.radius * 0.56)
        grp.add(fist)
      }
      this.addStarGlint(grp, 0, 28, 0, 32, 0xfacc15)
    } else if (z.kind === 'thanos_infinity_snap') {
      const cols = [0xa855f7, 0x3b82f6, 0xef4444, 0x10b981, 0xfacc15]
      for (let i = 0; i < cols.length; i++) {
        this.addRing3D(grp, 0, 4 + i, 0, z.radius * (0.55 + i * 0.14), cols[i], 0.96, 0)
      }
      this.addTierMotes3D(grp, 0, 36, 0, z.radius * 0.75, 10, 0xa855f7, 0xfacc15)
      this.addStarGlint(grp, 0, 38, 0, 62, 0xfef08a)
    } else if (z.kind === 'killua_solo_ring' || z.kind === 'thunder_slam' || z.kind === 'saitama_crater') {
      const bolts = z.kind === 'saitama_crater' ? 10 : 6
      for (let k = 0; k < bolts; k++) {
        const a = (k * Math.PI * 2) / bolts
        this.addJaggedBolt3D(grp, 0, 14, 0, Math.cos(a) * z.radius * 0.94, 4, Math.sin(a) * z.radius * 0.94, col, acc, 11, 4, k)
      }
      this.addTierMotes3D(grp, 0, 20, 0, z.radius * 0.68, 6, col, acc)
    } else if (z.kind === 'hollow_purple') {
      // Gojo Hollow Purple (茈): Colossal Imaginary-Mass Singularity + Gyroscopic Void Rings + Purple Lightning!
      const voidCore = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x09090b, 0.98))
      voidCore.scale.setScalar(42)
      voidCore.position.y = 42
      const brightShell = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0xc084fc, 0.68))
      brightShell.scale.setScalar(58)
      brightShell.position.y = 42
      const gyroGrp = new THREE.Group()
      gyroGrp.position.y = 42
      gyroGrp.userData.isVoidAccretion = true
      const ring1 = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xffffff, 0.96))
      ring1.scale.setScalar(66)
      ring1.rotation.x = 0.65
      const ring2 = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xa855f7, 0.92))
      ring2.scale.setScalar(82)
      ring2.rotation.y = 0.85
      gyroGrp.add(ring1, ring2)
      grp.add(voidCore, brightShell, gyroGrp)
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4
        this.addJaggedBolt3D(
          grp,
          0,
          42,
          0,
          Math.cos(a) * z.radius * 0.96,
          6,
          Math.sin(a) * z.radius * 0.96,
          0x9333ea,
          0xffffff,
          16,
          5,
          k,
        )
      }
      this.addTierMotes3D(grp, 0, 42, 0, z.radius * 0.76, 8, 0xa855f7, 0x38bdf8)
      this.addStarGlint(grp, 0, 44, 0, 68, 0xf0abfc)
    } else if (z.kind === 'simo_sentinel') {
      // Simo Hayha Elsu-Style Arctic Sentinel Radar Beacon Trap in Snow!
      const beacon = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0x38bdf8, 0.95))
      beacon.scale.set(16, 48, 16)
      beacon.position.y = 24
      const coreGeo = this.isPixelTier ? this.sharedBoxGeo : this.sharedSphereGeo
      const core = this.allocMesh(coreGeo, this.mkMat(grp, 0xffffff, 0.98))
      core.scale.setScalar(10)
      core.position.y = 50
      const scanRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xe0f2fe, 0.9))
      scanRing.rotation.x = Math.PI / 2
      scanRing.scale.setScalar(26)
      scanRing.position.y = 32
      grp.add(beacon, core, scanRing)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        this.addSegment3D(
          grp,
          Math.cos(a) * z.radius * 0.25,
          4,
          Math.sin(a) * z.radius * 0.25,
          Math.cos(a) * z.radius * 0.95,
          4,
          Math.sin(a) * z.radius * 0.95,
          3.8,
          0x7dd3fc,
          0.88,
        )
      }
      this.addTierMotes3D(grp, 0, 26, 0, z.radius * 0.65, 4, 0x38bdf8, 0xffffff)
    } else if (z.kind === 'simo_blizzard_burst') {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3
        const spike = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, 0xe0f2fe, 0.92))
        spike.scale.set(15, 30, 15)
        spike.position.set(Math.cos(a) * z.radius * 0.65, 15, Math.sin(a) * z.radius * 0.65)
        grp.add(spike)
      }
      this.addTierMotes3D(grp, 0, 20, 0, z.radius * 0.72, 5, 0x38bdf8, 0xffffff)
      this.addStarGlint(grp, 0, 24, 0, 34, 0xffffff)
    } else if (z.kind === 'scp_medkit_orb') {
      // Small Glowing Green Bio-Medkit Pickup Orb on Circular SCP Research Station!
      const coreOrb = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x34d399, 0.94))
      coreOrb.scale.setScalar(13)
      coreOrb.position.y = 22
      const haloOrb = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x10b981, 0.34))
      haloOrb.scale.setScalar(21)
      haloOrb.position.y = 22
      const crossV = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0xffffff, 0.99))
      crossV.scale.set(5, 16, 5)
      crossV.position.y = 22
      const crossH = this.allocMesh(this.sharedBoxGeo, this.mkMat(grp, 0xffffff, 0.99))
      crossH.scale.set(16, 5, 5)
      crossH.position.y = 22
      const floatRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0x6ee7b7, 0.92))
      floatRing.rotation.x = Math.PI / 2
      floatRing.scale.setScalar(22)
      floatRing.position.y = 14
      grp.add(coreOrb, haloOrb, crossV, crossH, floatRing)
    } else if (z.kind === 'scp_medkit_heal' || z.kind === 'aegis_core_burst') {
      // Crisp Expanding Emerald Bio-Heal / Golden Aegis Core Burst Rings
      const isAegis = z.kind === 'aegis_core_burst'
      for (let i = 0; i < 3; i++) {
        this.addRing3D(
          grp,
          0,
          6 + i * 16,
          0,
          z.radius * (0.65 + i * 0.2),
          i === 1 ? 0xffffff : isAegis ? 0xfacc15 : 0x34d399,
          0.94,
          0,
        )
      }
      this.addTierMotes3D(grp, 0, 24, 0, z.radius * 0.65, 6, isAegis ? 0xfacc15 : 0x10b981, isAegis ? 0x38bdf8 : 0xa7f3d0)
      this.addStarGlint(grp, 0, 28, 0, 34, isAegis ? 0xfef08a : 0x6ee7b7)
    } else if (z.kind === 'aegis_core_orb') {
      // Central Dimensional Aegis Core Objective Crystal + Dual Gyroscopic Rings!
      const coreCrystal = this.allocMesh(this.sharedOctaGeo, this.mkMat(grp, 0xfacc15, 0.96))
      coreCrystal.scale.set(16, 26, 16)
      coreCrystal.position.y = 32
      const innerCrystal = this.allocMesh(this.sharedOctaGeo, this.mkMat(grp, 0xffffff, 0.99))
      innerCrystal.scale.set(9, 16, 9)
      innerCrystal.position.y = 32
      const ringA = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0x38bdf8, 0.92))
      ringA.scale.setScalar(28)
      ringA.rotation.x = 0.65
      ringA.position.y = 32
      const ringB = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.92))
      ringB.scale.setScalar(34)
      ringB.rotation.y = 0.85
      ringB.position.y = 32
      grp.add(coreCrystal, innerCrystal, ringA, ringB)
      this.addStarGlint(grp, 0, 32, 0, 32, 0xfef08a)
    } else if (z.kind === 'jinwoo_arise' || z.kind === 'jinwoo_rulers_hand' || z.kind === 'jinwoo_shadow_slash') {
      // Sung Jin-Woo: Shadow Monarch ARISE! Abyssal Domain + Spectral Shadow Soldiers & Violet-Cyan Slash Pillars!
      const shadowFloor = this.allocMesh(this.sharedDiscGeo, this.mkMat(grp, 0x0b0518, 0.84, true))
      shadowFloor.position.y = 1.95
      shadowFloor.scale.setScalar(z.radius * 0.98)
      grp.add(shadowFloor)
      const count = z.kind === 'jinwoo_arise' ? 8 : 5
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count
        const r = z.radius * (z.kind === 'jinwoo_arise' ? 0.68 : 0.56)
        const sx = Math.cos(a) * r
        const sz = Math.sin(a) * r
        const wraith = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, i % 2 === 0 ? 0x1e1b4b : 0x7c3aed, 0.94))
        wraith.scale.set(22, z.kind === 'jinwoo_arise' ? 68 : 42, 22)
        wraith.position.set(sx, z.kind === 'jinwoo_arise' ? 34 : 21, sz)
        const eye = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x38bdf8, 0.99))
        eye.scale.setScalar(6)
        eye.position.set(sx, z.kind === 'jinwoo_arise' ? 54 : 34, sz)
        grp.add(wraith, eye)
        this.addJaggedBolt3D(grp, sx, 24, sz, 0, 28, 0, 0x7c3aed, 0x38bdf8, 12, 4, i)
      }
      this.addTierMotes3D(grp, 0, 32, 0, z.radius * 0.8, 8, 0x7c3aed, 0x38bdf8)
      this.addStarGlint(grp, 0, 38, 0, 48, 0x38bdf8)
    } else if (
      z.kind === 'naruto_kurama_aura' ||
      z.kind === 'naruto_rasen_blast' ||
      z.kind === 'naruto_rasengan_burst' ||
      z.kind === 'naruto_shuriken_boom'
    ) {
      // Naruto Kurama Nine-Tails Blazing Golden Chakra Vortex / Wind-Shuriken Detonation!
      const dome = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, col, z.kind === 'naruto_kurama_aura' ? 0.34 : 0.55))
      dome.scale.setScalar(z.radius * 0.56)
      dome.position.y = 26
      const ringA = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, acc, 0.96))
      ringA.rotation.x = Math.PI / 2
      ringA.scale.setScalar(z.radius * 0.88)
      ringA.position.y = 14
      grp.add(dome, ringA)
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3
        this.addJaggedBolt3D(grp, 0, 22, 0, Math.cos(a) * z.radius * 0.92, 10, Math.sin(a) * z.radius * 0.92, col, acc, 14, 4, i)
      }
      this.addTierMotes3D(grp, 0, 26, 0, z.radius * 0.78, 7, col, acc)
      this.addStarGlint(grp, 0, 32, 0, 42, 0xfef08a)
    } else if (z.kind === 'sanji_diable_fire' || z.kind === 'sanji_ifrit_burst') {
      // Sanji Diable Jambe Orange Vortex / Ifrit Jambe Blue-White Superheated Plasma Storm!
      const isIfrit = z.kind === 'sanji_ifrit_burst'
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        const r = z.radius * (0.42 + (i % 2) * 0.36)
        const pillar = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, isIfrit ? (i % 2 === 0 ? 0x38bdf8 : 0xe0f2fe) : (i % 2 === 0 ? 0xf97316 : 0xfacc15), 0.94))
        pillar.scale.set(20, isIfrit ? 56 : 38, 20)
        pillar.position.set(Math.cos(a) * r, isIfrit ? 28 : 19, Math.sin(a) * r)
        grp.add(pillar)
      }
      if (isIfrit) {
        for (let b = 0; b < 5; b++) {
          const a = (b * Math.PI * 2) / 5
          this.addJaggedBolt3D(grp, 0, 30, 0, Math.cos(a) * z.radius * 0.95, 12, Math.sin(a) * z.radius * 0.95, 0x38bdf8, 0xffffff, 16, 5, b)
        }
      }
      this.addTierMotes3D(grp, 0, 26, 0, z.radius * 0.76, 7, col, acc)
      this.addStarGlint(grp, 0, 30, 0, isIfrit ? 46 : 32, acc)
    } else if (z.kind === 'luffy_bajrang_gun' || z.kind === 'luffy_bajrang_smash' || z.kind === 'luffy_gatling') {
      // Luffy Gear 5 Bajrang Gun Colossal Descending Haki Fist + White Clouds & Red-Black Conqueror's Lightning!
      const isBajrang = z.kind === 'luffy_bajrang_gun' || z.kind === 'luffy_bajrang_smash'
      const fist = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x18181b, 0.96))
      fist.scale.setScalar(isBajrang ? 56 : 24)
      fist.position.y = isBajrang ? 58 : 28
      const cloudRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xf8fafc, 0.94))
      cloudRing.rotation.x = Math.PI / 2
      cloudRing.scale.setScalar(z.radius * 0.82)
      cloudRing.position.y = isBajrang ? 32 : 16
      grp.add(fist, cloudRing)
      for (let k = 0; k < (isBajrang ? 8 : 5); k++) {
        const a = (k * Math.PI * 2) / (isBajrang ? 8 : 5)
        this.addJaggedBolt3D(grp, 0, isBajrang ? 56 : 26, 0, Math.cos(a) * z.radius * 0.96, 8, Math.sin(a) * z.radius * 0.96, 0x09090b, 0xef4444, 18, 5, k)
      }
      this.addTierMotes3D(grp, 0, 34, 0, z.radius * 0.82, 8, 0xef4444, 0xfacc15)
      this.addStarGlint(grp, 0, 44, 0, isBajrang ? 56 : 32, 0xfef08a)
    } else if (z.kind === 'ben10_heat_pool' || z.kind === 'ben10_heat_boom') {
      // Heatblast Molten Magma Pool + Rising Ember Spires
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3
        const spire = this.allocMesh(this.sharedConeGeo, this.mkMat(grp, i % 2 === 0 ? 0xf97316 : 0xfacc15, 0.92))
        spire.scale.set(18, 36, 18)
        spire.position.set(Math.cos(a) * z.radius * 0.62, 18, Math.sin(a) * z.radius * 0.62)
        grp.add(spire)
      }
      this.addTierMotes3D(grp, 0, 22, 0, z.radius * 0.72, 6, 0xf97316, 0xfef08a)
      this.addStarGlint(grp, 0, 26, 0, 32, 0xfef08a)
    } else if (z.kind === 'diablo_temptation' || z.kind === 'diablo_end_world' || z.kind === 'diablo_eclipse_burst') {
      // Diablo Primordial Noir: Obsidian-Crimson Eclipse Singularity + Golden Pentagram Spoke Seals!
      const isUlt = z.kind === 'diablo_end_world' || z.kind === 'diablo_eclipse_burst'
      const eclipseFloor = this.allocMesh(this.sharedDiscGeo, this.mkMat(grp, 0x120306, 0.88, true))
      eclipseFloor.position.y = 1.95
      eclipseFloor.scale.setScalar(z.radius * 0.98)
      const eclipseCore = this.allocMesh(this.sharedSphereGeo, this.mkMat(grp, 0x09090b, 0.98))
      eclipseCore.scale.setScalar(isUlt ? 40 : 24)
      eclipseCore.position.y = isUlt ? 46 : 28
      const coronaRing = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xdc2626, 0.96))
      coronaRing.scale.setScalar(isUlt ? 54 : 32)
      coronaRing.position.y = isUlt ? 46 : 28
      const goldHalo = this.allocMesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.94))
      goldHalo.scale.setScalar(isUlt ? 68 : 42)
      goldHalo.rotation.x = 0.85
      goldHalo.position.y = isUlt ? 46 : 28
      grp.add(eclipseFloor, eclipseCore, coronaRing, goldHalo)
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3
        this.addJaggedBolt3D(grp, 0, isUlt ? 46 : 28, 0, Math.cos(a) * z.radius * 0.94, 8, Math.sin(a) * z.radius * 0.94, 0xdc2626, 0xfacc15, 16, 5, i)
      }
      this.addTierMotes3D(grp, 0, 34, 0, z.radius * 0.8, 8, 0xdc2626, 0xfacc15)
      this.addStarGlint(grp, 0, isUlt ? 48 : 30, 0, isUlt ? 56 : 34, 0xfacc15)
    } else {
      this.addTierMotes3D(grp, 0, 20, 0, z.radius * 0.68, 5, col, acc)
      this.addStarGlint(grp, 0, 22, 0, 28, acc)
    }
    return grp
  }

  syncZones(list: ZoneEffect[], dt: number, animTime: number): void {
    const aliveIds = new Set<string>()
    for (const z of list) {
      z.life = Math.max(0, z.life - dt)
      if ((z.delayLeft ?? 0) > 0) {
        z.delayLeft = Math.max(0, (z.delayLeft ?? 0) - dt)
      }
      if (z.life <= 0) continue

      const isWindup = (z.delayLeft ?? 0) > 0 && (z.maxDelay ?? 0) > 0
      const meshKey = isWindup ? `${z.id}:windup` : z.id
      aliveIds.add(meshKey)
      const ratio = Math.max(0, Math.min(1, z.life / Math.max(0.05, z.maxLife)))
      const fade = Math.min(1, ratio * 1.45)

      let grp = this.zoneMeshes.get(meshKey)
      if (!grp) {
        grp = this.buildZoneGroup(z, isWindup)
        this.group.add(grp)
        this.zoneMeshes.set(meshKey, grp)
      }

      grp.position.set(z.x, 0, z.y)
      if (z.kind === 'malevolent_shrine') {
        // Keep the Shrine building anchored in world space while its Slash Storm hurricane spins violently!
        grp.rotation.y = 0
        for (const ch of grp.children) {
          if (ch.userData.isShrineSlashStorm) {
            ch.rotation.y = animTime * 0.014
          }
        }
      } else if (z.kind === 'infinite_void' || z.kind === 'hollow_purple') {
        grp.rotation.y = animTime * 0.0012
        for (const ch of grp.children) {
          if (ch.userData.isVoidAccretion) {
            ch.rotation.y = -animTime * 0.0065
            ch.rotation.z = Math.sin(animTime * 0.003) * 0.28
          }
        }
      } else if (z.kind === 'scp_medkit_orb' || z.kind === 'aegis_core_orb') {
        grp.rotation.y = animTime * 0.0028
        grp.position.y = Math.sin(animTime * 0.0045 + z.x) * 4.5
      } else if (z.kind !== 'zenitsu_honoo_no_kami') {
        grp.rotation.y = animTime * (isWindup ? 0.004 : 0.002)
      }
      if (!isWindup && z.kind === 'thanos_infinity_snap') {
        const exp = 0.3 + (1 - ratio) * 1.45
        grp.scale.set(exp, 1, exp)
      }
      if (isWindup && z.maxDelay) {
        const prog = 1 - (z.delayLeft ?? 0) / Math.max(0.05, z.maxDelay)
        for (const ch of grp.children) {
          if (ch.userData.isPulseRing) {
            (ch as THREE.Mesh).scale.setScalar(z.radius * Math.max(0.18, prog))
          }
        }
      }
      const mats = grp.userData.mats as THREE.MeshBasicMaterial[] | undefined
      if (mats) {
        for (const m of mats) {
          m.opacity = ((m.userData.baseOpacity as number) ?? 0.75) * fade
        }
      }
    }

    for (const [id, grp] of this.zoneMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.group.remove(grp)
        this.recycleGroupResources(grp)
        this.zoneMeshes.delete(id)
      }
    }
  }

  dispose(): void {
    for (const p of this.particles) p.mat.dispose()
    for (const g of this.ghosts) g.mat.dispose()
    for (const d of this.decals) {
      d.outerMat.dispose()
      d.innerMat.dispose()
    }
    for (const st of this.projMeshes.values()) this.recycleGroupResources(st.grp)
    for (const grp of this.beamMeshes.values()) this.recycleGroupResources(grp)
    for (const grp of this.zoneMeshes.values()) this.recycleGroupResources(grp)
    for (const m of this.matPool) m.dispose()
    this.matPool.length = 0
    this.meshPool.length = 0
    this.projMeshes.clear()
    this.beamMeshes.clear()
    this.zoneMeshes.clear()
    this.aimTexCache.dispose()
    this.aimOuterMat.dispose()
    this.aimInnerMat.dispose()
    this.aimLineMat.dispose()
    this.aimSniperLaserMat.dispose()
    this.aimSigilGeo.dispose()
    this.sharedGlintArmsGeo.dispose()
    this.sharedSphereGeo.dispose()
    this.sharedOctaGeo.dispose()
    this.sharedRingGeo.dispose()
    this.sharedDiscGeo.dispose()
    this.sharedPlaneGeo.dispose()
    this.sharedBoxGeo.dispose()
    this.sharedCylGeo.dispose()
    this.sharedTorusGeo.dispose()
    this.sharedConeGeo.dispose()
    this.sharedSlashGeo.dispose()
    this.ghostGeo.dispose()
  }
}
