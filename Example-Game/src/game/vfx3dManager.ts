import * as THREE from 'three'
import type { BeamEffect, PlayerState, Projectile, ZoneEffect } from '../types/game'
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

interface SmoothProjState {
  grp: THREE.Group
  rx: number
  rz: number
}

function hexNum(hex: string | undefined, fallback = 0x38bdf8): number {
  if (!hex) return fallback
  return Number.parseInt(hex.replace('#', ''), 16) || fallback
}

export class Vfx3dManager {
  private group = new THREE.Group()
  private aimGroup = new THREE.Group()
  private particles: Particle3D[] = []
  private ghosts: DashGhost3D[] = []
  // Reusable material pool prevents GPU/GC stutter during intensive combat & attack spam
  private matPool: THREE.MeshBasicMaterial[] = []

  // Live synced effect meshes keyed by server ID
  private projMeshes = new Map<string, SmoothProjState>()
  private beamMeshes = new Map<string, THREE.Group>()
  private zoneMeshes = new Map<string, THREE.Group>()

  // Shared static geometries (zero per-effect geometry allocation!)
  private sharedSphereGeo = new THREE.SphereGeometry(1, 14, 10)
  private sharedRingGeo = new THREE.RingGeometry(0.84, 1.0, 36)
  private sharedDiscGeo = new THREE.CircleGeometry(1, 32)
  private sharedPlaneGeo = new THREE.PlaneGeometry(1, 1)
  private sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1)
  private sharedCylGeo = new THREE.CylinderGeometry(1, 1, 1, 12)
  private sharedTorusGeo = new THREE.TorusGeometry(1, 0.14, 8, 28)
  private sharedConeGeo = new THREE.ConeGeometry(0.55, 1.4, 8)
  // Crescent arc centered pointing directly toward +Z after rotateX(-PI/2)
  private sharedSlashGeo = new THREE.RingGeometry(0.6, 1.0, 26, 1, -Math.PI * 0.5 - 1.12, 2.24)
  private ghostGeo = new THREE.CapsuleGeometry(11, 22, 4, 8)

  // Magic-Circle Aim preview sub-meshes + per-hero procedural sigil texture cache
  private aimTexCache = new ArcaneAimTextureCache()
  private aimSigilGeo = new THREE.PlaneGeometry(2, 2)
  private aimOuterSigil: THREE.Mesh
  private aimInnerSigil: THREE.Mesh
  private aimLineBar: THREE.Mesh
  private aimOuterMat: THREE.MeshBasicMaterial
  private aimInnerMat: THREE.MeshBasicMaterial
  private aimLineMat: THREE.MeshBasicMaterial
  private lastAimTexKey = ''

  constructor(scene: THREE.Scene) {
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

    this.aimOuterSigil = new THREE.Mesh(this.aimSigilGeo, this.aimOuterMat)
    this.aimOuterSigil.position.y = 2.3
    this.aimOuterSigil.renderOrder = 20
    this.aimInnerSigil = new THREE.Mesh(this.aimSigilGeo, this.aimInnerMat)
    this.aimInnerSigil.position.y = 2.9
    this.aimInnerSigil.renderOrder = 22
    this.aimLineBar = new THREE.Mesh(this.sharedPlaneGeo, this.aimLineMat)
    this.aimLineBar.position.y = 2.6
    this.aimLineBar.renderOrder = 21
    this.aimGroup.add(this.aimOuterSigil, this.aimInnerSigil, this.aimLineBar)
    this.aimGroup.visible = false

    // Pre-allocate 96 pooled 3D impact particles
    for (let i = 0; i < 96; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(this.sharedSphereGeo, mat)
      mesh.visible = false
      this.group.add(mesh)
      this.particles.push({ mesh, mat, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.45, active: false })
    }

    // Pre-allocate 28 pooled 3D Dash Afterimage Ghosts
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(this.ghostGeo, mat)
      mesh.visible = false
      this.group.add(mesh)
      this.ghosts.push({ mesh, mat, life: 0, maxLife: 0.28, active: false })
    }
  }

  private mkMat(
    grp: THREE.Group,
    color: number,
    opacity = 1,
    doubleSide = false,
  ): THREE.MeshBasicMaterial {
    let m = this.matPool.pop()
    const isTrans = opacity < 1
    const wantSide = doubleSide ? THREE.DoubleSide : THREE.FrontSide
    const wantDepth = opacity >= 0.99 && !doubleSide
    if (m) {
      m.color.setHex(color)
      m.transparent = isTrans
      m.opacity = opacity
      m.side = wantSide
      m.depthWrite = wantDepth
    } else {
      m = new THREE.MeshBasicMaterial({
        color,
        transparent: isTrans,
        opacity,
        side: wantSide,
        depthWrite: wantDepth,
      })
    }
    m.userData.baseOpacity = opacity
    const list = (grp.userData.mats as THREE.MeshBasicMaterial[]) ?? []
    list.push(m)
    grp.userData.mats = list
    return m
  }

  private recycleGroupResources(grp: THREE.Object3D): void {
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
    for (let i = 0; i < count; i++) {
      const slot = this.particles.find((p) => !p.active)
      if (!slot) break
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4
      const spd = 95 + Math.random() * 155
      slot.vx = Math.cos(ang) * spd
      slot.vz = Math.sin(ang) * spd
      slot.vy = 95 + Math.random() * 120
      slot.life = 0.45
      slot.maxLife = 0.45
      slot.active = true
      slot.mat.color.setHex(color)
      slot.mat.opacity = 1
      slot.mesh.position.set(x, 22, z)
      slot.mesh.scale.setScalar(5.0)
      slot.mesh.visible = true
    }
  }

  spawnDashGhost(x: number, z: number, yaw: number, colorHex: number): void {
    const slot = this.ghosts.find((g) => !g.active)
    if (!slot) return
    slot.active = true
    slot.life = 0.28
    slot.maxLife = 0.28
    slot.mat.color.setHex(colorHex)
    slot.mat.opacity = 0.56
    slot.mesh.position.set(x, 24, z)
    slot.mesh.rotation.y = yaw
    slot.mesh.scale.set(1.0, 1.0, 1.0)
    slot.mesh.visible = true
  }

  stepParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        p.mesh.visible = false
        continue
      }
      const ratio = p.life / p.maxLife
      p.mesh.position.x += p.vx * dt
      p.mesh.position.z += p.vz * dt
      p.mesh.position.y = Math.max(2, p.mesh.position.y + p.vy * dt)
      p.vy -= 380 * dt
      p.mat.opacity = ratio
      p.mesh.scale.setScalar(Math.max(1.2, 5.0 * ratio))
    }

    for (const g of this.ghosts) {
      if (!g.active) continue
      g.life -= dt
      if (g.life <= 0) {
        g.active = false
        g.mesh.visible = false
        continue
      }
      const ratio = g.life / g.maxLife
      g.mat.opacity = ratio * 0.54
      const s = 0.85 + (1 - ratio) * 0.28
      g.mesh.scale.set(s, 1.0, s)
    }
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
    const outerMat = this.mkMat(grp, col, 0.86)
    const coreMat = this.mkMat(grp, 0xffffff, 0.98)
    const hArm = new THREE.Mesh(this.sharedBoxGeo, outerMat)
    hArm.position.set(x, y, z)
    hArm.scale.set(size * 2.1, 3, size * 0.24)
    const vArm = new THREE.Mesh(this.sharedBoxGeo, outerMat)
    vArm.position.set(x, y, z)
    vArm.scale.set(size * 0.24, 3, size * 2.1)
    const core = new THREE.Mesh(this.sharedSphereGeo, coreMat)
    core.position.set(x, y, z)
    core.scale.setScalar(Math.max(3, size * 0.22))
    grp.add(hArm, vArm, core)
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
    const mat = this.mkMat(grp, col, alpha)
    const seg = new THREE.Mesh(this.sharedBoxGeo, mat)
    seg.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5)
    seg.scale.set(width, width, len)
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
    segs = 6,
    seed = 0,
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const dz = z2 - z1
    const horizLen = Math.max(1, Math.hypot(dx, dz))
    const px = -dz / horizLen
    const pz = dx / horizLen

    let lx = x1
    let ly = y1
    let lz = z1
    for (let i = 1; i <= segs; i++) {
      const t = i / segs
      const off = i === segs ? 0 : Math.sin(seed + i * 3.7) * jitter
      const nx = x1 + dx * t + px * off
      const ny = y1 + dy * t + (i === segs ? 0 : Math.cos(seed + i * 2.9) * jitter * 0.45)
      const nz = z1 + dz * t + pz * off
      this.addSegment3D(grp, lx, ly, lz, nx, ny, nz, 8.5, col, 0.65)
      this.addSegment3D(grp, lx, ly, lz, nx, ny, nz, 3.6, acc, 0.98)
      lx = nx
      ly = ny
      lz = nz
    }
  }

  private addRing3D(grp: THREE.Group, x: number, y: number, z: number, radius: number, col: number, alpha: number, fillAlpha = 0): void {
    if (fillAlpha > 0) {
      const d = new THREE.Mesh(this.sharedDiscGeo, this.mkMat(grp, col, fillAlpha, true))
      d.position.set(x, y, z)
      d.scale.setScalar(radius)
      grp.add(d)
    }
    const r = new THREE.Mesh(this.sharedRingGeo, this.mkMat(grp, col, alpha, true))
    r.position.set(x, y + 0.5, z)
    r.scale.setScalar(radius)
    grp.add(r)
  }

  private buildProjectileGroup(pr: Projectile): THREE.Group {
    const grp = new THREE.Group()
    const col = hexNum(pr.color, 0x38bdf8)
    const acc = hexNum(pr.accentColor, 0xffffff)

    // Ground contact shadow beneath flying projectile
    const sh = new THREE.Mesh(this.sharedDiscGeo, this.mkMat(grp, 0x020617, 0.32, true))
    sh.position.set(0, -24.5, 0)
    sh.scale.set(pr.radius * 0.9, 1, pr.radius * 0.9)
    grp.add(sh)

    // Glowing Wake Trail Tail behind every projectile (-Z)
    const wake = new THREE.Mesh(this.sharedConeGeo, this.mkMat(grp, col, 0.36))
    wake.rotation.x = -Math.PI / 2
    wake.scale.set(pr.radius * 0.95, 36, pr.radius * 0.55)
    wake.position.set(0, 0, -24)
    grp.add(wake)

    if (pr.kind === 'crow_shuriken') {
      const spin = new THREE.Group()
      spin.userData.spinSpeed = 0.025
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(this.sharedBoxGeo, this.mkMat(grp, 0x111827, 0.98))
        blade.scale.set(6, 3, 28)
        blade.rotation.y = (b * Math.PI) / 2
        const rim = new THREE.Mesh(this.sharedBoxGeo, this.mkMat(grp, 0xdc2626, 0.9))
        rim.scale.set(7.5, 2, 16)
        rim.rotation.y = (b * Math.PI) / 2
        spin.add(blade, rim)
      }
      grp.add(spin)
    } else if (pr.kind === 'pound_ho' || pr.kind === 'black_flame_wave' || pr.kind === 'atk_default_pulse' || pr.kind === 'dismantle' || pr.kind === 'atk_rimuru_water') {
      // Curved Multi-Tier Crescent Blade Wave!
      const cA = new THREE.Mesh(this.sharedSlashGeo, this.mkMat(grp, col, 0.65, true))
      cA.scale.setScalar(pr.radius * 1.45)
      const cB = new THREE.Mesh(this.sharedSlashGeo, this.mkMat(grp, acc, 0.96, true))
      cB.scale.setScalar(pr.radius * 1.15)
      cB.position.y = 1.2
      grp.add(cA, cB)
    } else if (pr.kind === 'gate_sword' || pr.kind === 'atk_gilga_sword') {
      const portal = new THREE.Mesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.85))
      portal.scale.setScalar(13)
      portal.position.set(0, 0, -14)
      const blade = new THREE.Mesh(this.sharedBoxGeo, this.mkMat(grp, 0xfef08a, 0.98))
      blade.scale.set(5, 3, 40)
      const hilt = new THREE.Mesh(this.sharedBoxGeo, this.mkMat(grp, 0xf59e0b, 0.98))
      hilt.scale.set(16, 4, 4)
      hilt.position.set(0, 0, -10)
      grp.add(portal, blade, hilt)
    } else if (pr.kind === 'fuga_arrow' || pr.kind === 'atk_itachi_kunai') {
      const tip = new THREE.Mesh(this.sharedConeGeo, this.mkMat(grp, acc, 0.98))
      tip.rotation.x = Math.PI / 2
      tip.scale.set(10, 26, 6)
      tip.position.set(0, 0, 10)
      const shaft = new THREE.Mesh(this.sharedBoxGeo, this.mkMat(grp, col, 0.95))
      shaft.scale.set(4, 4, 28)
      grp.add(tip, shaft)
    } else if (pr.kind === 'gojo_red' || pr.kind === 'gojo_blue') {
      const isBlue = pr.kind === 'gojo_blue'
      const core = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, isBlue ? 0x020617 : 0xffffff, 0.98))
      core.scale.setScalar(pr.radius * 0.56)
      const shell = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, col, 0.65))
      shell.scale.setScalar(pr.radius * 1.15)
      const ring = new THREE.Mesh(this.sharedTorusGeo, this.mkMat(grp, acc, 0.92))
      ring.scale.setScalar(pr.radius * 1.25)
      ring.userData.spinSpeed = 0.015
      grp.add(core, shell, ring)
    } else if (pr.kind === 'aiouan_pounce') {
      const orb = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, 0xc084fc, 0.9))
      orb.scale.setScalar(pr.radius * 0.85)
      const ring = new THREE.Mesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.95))
      ring.rotation.x = Math.PI / 2
      ring.scale.setScalar(pr.radius * 1.1)
      grp.add(orb, ring)
    } else {
      const core = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, acc, 0.98))
      core.scale.setScalar(pr.radius * 0.72)
      const halo = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, col, 0.45))
      halo.scale.setScalar(pr.radius * 1.55)
      grp.add(core, halo)
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

    if (b.kind === 'atk_zoro_sweep' || b.kind === 'atk_zenitsu_slash' || b.kind === 'atk_aiouan_paw' || b.kind === 'atk_thanos_gauntlet') {
      // Dramatic Layered 3D Crescent Slash Arc + Katana Star Glints!
      const rad = b.kind === 'atk_zoro_sweep' ? 128 : 112
      const c1 = new THREE.Mesh(this.sharedSlashGeo, this.mkMat(grp, col, 0.72, true))
      c1.scale.setScalar(rad * 0.75)
      c1.position.set(b.x1, 22, b.y1)
      c1.rotation.y = yaw
      const c2 = new THREE.Mesh(this.sharedSlashGeo, this.mkMat(grp, acc, 0.96, true))
      c2.scale.setScalar(rad)
      c2.position.set(b.x1, 24, b.y1)
      c2.rotation.y = yaw
      grp.add(c1, c2)
      if (b.kind === 'atk_zenitsu_slash') {
        this.addJaggedBolt3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 0xfacc15, 0x7dd3fc, 12, 5, b.x1)
      }
      this.addStarGlint(grp, b.x2, 26, b.y2, 22, acc)
      return grp
    }

    if (b.kind === 'atk_sukuna_cleave') {
      // Giant Razor Crimson-Black X-Cross Cleave at Target
      const mx = (b.x1 + b.x2) * 0.5
      const mz = (b.y1 + b.y2) * 0.5
      this.addSegment3D(grp, mx - 46, 26, mz - 36, mx + 46, 26, mz + 36, 9, 0x09090b, 0.88)
      this.addSegment3D(grp, mx - 46, 28, mz - 36, mx + 46, 28, mz + 36, 4.5, 0xf43f5e, 0.98)
      this.addSegment3D(grp, mx - 46, 26, mz + 36, mx + 46, 26, mz - 36, 9, 0x09090b, 0.88)
      this.addSegment3D(grp, mx - 46, 28, mz + 36, mx + 46, 28, mz - 36, 4.5, 0xffffff, 0.98)
      return grp
    }

    if (b.kind === 'atk_gilga_flash') {
      for (const [px, pz] of [[b.x1, b.y1], [b.x2, b.y2]] as const) {
        this.addRing3D(grp, px, 22, pz, 24, 0xfacc15, 0.95, 0.25)
      }
      return grp
    }

    if (b.kind === 'basic_lock_reticle' || b.kind === 'aiouan_lock_beam') {
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 3, acc, 0.72)
      this.addRing3D(grp, b.x2, 3, b.y2, 34, col, 0.95, 0.22)
      this.addStarGlint(grp, b.x2, 28, b.y2, 18, acc)
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
        this.addSegment3D(grp, lx, ly, lz, nx, ny, nz, 8, col, 0.75)
        this.addSegment3D(grp, lx, ly, lz, nx, ny, nz, 3.5, acc, 0.98)
        lx = nx
        ly = ny
        lz = nz
      }
      return grp
    }

    if (b.kind === 'narukami_strike' || b.kind === 'black_lightning_strike' || b.kind === 'aiouan_timestop_burst') {
      // Sky-Descending Jagged Lightning Strike from High Heavens (Y=380 -> Y=0)
      this.addJaggedBolt3D(grp, b.x2, 360, b.y2, b.x2, 4, b.y2, col, acc, 22, 7, b.x2 + b.y2)
      this.addRing3D(grp, b.x2, 3, b.y2, 75, acc, 0.95, 0.28)
      this.addRing3D(grp, b.x2, 4, b.y2, 46, 0xffffff, 0.92, 0)
      this.addStarGlint(grp, b.x2, 22, b.y2, 26, acc)
      return grp
    }

    if (b.kind === 'gilga_sky_sword') {
      // Overhead Golden Gate Portal at Y=240 + Plunging Divine Sword
      const portal = new THREE.Mesh(this.sharedTorusGeo, this.mkMat(grp, 0xfacc15, 0.92))
      portal.rotation.x = Math.PI / 2
      portal.scale.setScalar(26)
      portal.position.set(b.x2, 240, b.y2)
      grp.add(portal)
      this.addSegment3D(grp, b.x2, 240, b.y2, b.x2, 10, b.y2, 8, 0xfacc15, 0.95)
      this.addSegment3D(grp, b.x2, 240, b.y2, b.x2, 10, b.y2, 3.5, 0xffffff, 0.98)
      this.addRing3D(grp, b.x2, 3, b.y2, 42, 0xfacc15, 0.9, 0.22)
      return grp
    }

    if (b.kind === 'zenitsu_hekireki' || b.kind === 'zenitsu_rokuren' || b.kind === 'shishi_sonson' || b.kind === 'zenitsu_murad_slash') {
      // High-Impact Dash Corridor + Sonic Silhouettes + Jagged Thunder + Katana Glints
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 18, col, 0.45)
      this.addSegment3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, 7, 0xffffff, 0.98)
      this.addJaggedBolt3D(grp, b.x1, 26, b.y1, b.x2, 26, b.y2, col, acc, 18, 7, b.x1 + b.y2)
      if (b.kind !== 'zenitsu_murad_slash') {
        const copies = b.kind === 'zenitsu_rokuren' ? 4 : 3
        for (let i = 1; i <= copies; i++) {
          const t = i / (copies + 1)
          const gx = b.x1 + dx * t
          const gz = b.y1 + dz * t
          this.spawnDashGhost(gx, gz, yaw, col)
        }
        this.addRing3D(grp, b.x2, 3, b.y2, b.kind === 'zenitsu_rokuren' ? 78 : 58, acc, 0.92, 0.2)
      }
      this.addStarGlint(grp, b.x1, 26, b.y1, 18, col)
      this.addStarGlint(grp, b.x2, 26, b.y2, 28, acc)
      return grp
    }

    if (b.kind === 'atk_killua_spark' || b.kind === 'lightning_arc' || b.kind === 'narukami_radial_beam' || b.kind === 'thunder_slam_burst') {
      this.addJaggedBolt3D(grp, b.x1, 24, b.y1, b.x2, 24, b.y2, col, acc, 15, 6, b.x1 * 0.1)
      this.addRing3D(grp, b.x2, 3, b.y2, 32, acc, 0.85, 0)
      return grp
    }

    // Mega Beams & Shock Corridors (Kamehameha, Enuma Elish, Saitama Serious Punch, Mind Beam, Sora Jab)
    const w = Math.max(8, b.width * 0.52)
    const outer = new THREE.Mesh(this.sharedCylGeo, this.mkMat(grp, col, 0.55))
    outer.scale.set(w, w, len)
    outer.position.set((b.x1 + b.x2) * 0.5, 25, (b.y1 + b.y2) * 0.5)
    outer.rotation.y = yaw

    const inner = new THREE.Mesh(this.sharedCylGeo, this.mkMat(grp, acc, 0.96))
    inner.scale.set(w * 0.45, w * 0.45, len)
    inner.position.set((b.x1 + b.x2) * 0.5, 25, (b.y1 + b.y2) * 0.5)
    inner.rotation.y = yaw
    grp.add(outer, inner)

    if (b.kind === 'kamehameha' || b.kind === 'enuma_elish' || b.kind === 'saitama_serious_punch' || b.kind === 'goku_dragon_rush' || b.kind === 'thanos_mind_beam') {
      for (let r = 1; r <= 4; r++) {
        const t = r / 4.5
        const ring = new THREE.Mesh(this.sharedTorusGeo, this.mkMat(grp, r === 4 ? 0xffffff : acc, 0.88))
        ring.scale.setScalar(w * (0.9 + r * 0.16))
        ring.position.set(b.x1 + dx * t, 25, b.y1 + dz * t)
        ring.rotation.y = yaw
        grp.add(ring)
      }
      this.addStarGlint(grp, b.x2, 26, b.y2, 30, acc)
    } else if (b.kind === 'aiouan_ora_rush') {
      for (let f = 1; f <= 5; f++) {
        const t = f / 5
        const fist = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, f % 2 === 0 ? 0xfacc15 : 0xc084fc, 0.94))
        fist.scale.setScalar(11)
        fist.position.set(b.x1 + dx * t + (f % 2 === 0 ? 10 : -10), 25 + (f % 2 === 0 ? 5 : -5), b.y1 + dz * t)
        grp.add(fist)
      }
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
      const innerSeal = new THREE.Mesh(this.sharedRingGeo, this.mkMat(grp, col, 0.88, true))
      innerSeal.scale.setScalar(z.radius * 0.72)
      innerSeal.position.y = 2.6
      innerSeal.userData.isPulseRing = true
      grp.add(innerSeal)

      if (z.kind === 'sanzen_sekai' || z.kind === 'narukami_step2' || z.kind === 'aiouan_timestop' || z.kind === 'black_lightning') {
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
      // Pure 5-Point Star without Outer Circle!
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
        this.addSegment3D(grp, x1, 6, z1, x2, 6, z2, step < activeSteps ? 8 : 3, step < activeSteps ? 0xfef08a : 0xf59e0b, step < activeSteps ? 0.92 : 0.35)
        this.addStarGlint(grp, x1, 14, z1, 16, 0xfacc15)
        if (step < activeSteps) this.addStarGlint(grp, x2, 16, z2, 22, 0x7dd3fc)
      }
      return grp
    }

    // Standard Base Domain Ring + Fill
    this.addRing3D(grp, 0, 1.8, 0, z.radius, col, 0.92, 0.28)
    this.addRing3D(grp, 0, 2.4, 0, z.radius * 0.72, acc, 0.78, 0)

    if (z.kind === 'malevolent_shrine') {
      // Towering 3D Crimson Malevolent Shrine Pavilion!
      for (const [px, pz] of [[-46, -24], [46, -24], [-46, 24], [46, 24]] as const) {
        const post = new THREE.Mesh(this.sharedBoxGeo, this.mkMat(grp, 0x2e0606, 0.95))
        post.scale.set(12, 92, 12)
        post.position.set(px, 46, pz)
        grp.add(post)
      }
      const beamTop = new THREE.Mesh(this.sharedBoxGeo, this.mkMat(grp, 0x991b1b, 0.96))
      beamTop.scale.set(138, 16, 74)
      beamTop.position.set(0, 94, 0)
      const roofTop = new THREE.Mesh(this.sharedConeGeo, this.mkMat(grp, 0x7f1d1d, 0.96))
      roofTop.scale.set(145, 34, 95)
      roofTop.rotation.y = Math.PI / 4
      roofTop.position.set(0, 124, 0)
      grp.add(beamTop, roofTop)
      // Relentless Slicing Blades inside Shrine Domain
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4
        const r = z.radius * 0.65
        this.addSegment3D(
          grp,
          Math.cos(ang) * r - 28,
          26 + (i % 3) * 14,
          Math.sin(ang) * r - 18,
          Math.cos(ang) * r + 28,
          26 + (i % 3) * 14,
          Math.sin(ang) * r + 18,
          4.5,
          i % 2 === 0 ? 0xf43f5e : 0xffffff,
          0.88,
        )
      }
    } else if (z.kind === 'infinite_void') {
      // Deep Void Floor + Orbiting Cosmic Stars + Levitating Six-Eyes Emblem!
      for (let s = 0; s < 14; s++) {
        const a = (s * Math.PI) / 7
        const r = z.radius * (0.28 + ((s * 0.19) % 0.66))
        const star = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, s % 2 === 0 ? 0x38bdf8 : 0xc084fc, 0.94))
        star.scale.setScalar(4.2)
        star.position.set(Math.cos(a) * r, 12 + (s % 4) * 10, Math.sin(a) * r)
        grp.add(star)
      }
      const eyeCore = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, 0x38bdf8, 0.95))
      eyeCore.scale.set(18, 12, 18)
      eyeCore.position.set(0, 68, 0)
      const eyeOrbit = new THREE.Mesh(this.sharedTorusGeo, this.mkMat(grp, 0xa855f7, 0.92))
      eyeOrbit.scale.setScalar(34)
      eyeOrbit.position.set(0, 68, 0)
      grp.add(eyeCore, eyeOrbit)
    } else if (z.kind === 'aiouan_timestop') {
      // Golden Clock Dial + Giant Floating Astral Stand Cat "Ai-Ouan"!
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
      const catHead = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, 0xa855f7, 0.68))
      catHead.scale.set(34, 28, 30)
      catHead.position.set(0, 82, 0)
      for (const sx of [-18, 18]) {
        const ear = new THREE.Mesh(this.sharedConeGeo, this.mkMat(grp, 0xc084fc, 0.78))
        ear.scale.set(18, 22, 14)
        ear.position.set(sx, 112, 0)
        const eye = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, 0xfef08a, 0.98))
        eye.scale.setScalar(5.5)
        eye.position.set(sx * 0.6, 86, 26)
        grp.add(ear, eye)
      }
      grp.add(catHead)
    } else if (z.kind === 'sanzen_sekai') {
      // King-of-Hell Cross Cleaves + 6 Conqurer's Haki Lightning Spokes + Flames
      for (const ang of [-0.52, 0.52, Math.PI * 0.5]) {
        const r = z.radius * 0.92
        this.addSegment3D(grp, -Math.cos(ang) * r, 22, -Math.sin(ang) * r, Math.cos(ang) * r, 22, Math.sin(ang) * r, 12, 0xa855f7, 0.85)
        this.addSegment3D(grp, -Math.cos(ang) * r, 24, -Math.sin(ang) * r, Math.cos(ang) * r, 24, Math.sin(ang) * r, 5, 0x10b981, 0.98)
      }
      for (let f = 0; f < 8; f++) {
        const fa = (f * Math.PI) / 4
        const cone = new THREE.Mesh(this.sharedConeGeo, this.mkMat(grp, f % 2 === 0 ? 0x10b981 : 0x9333ea, 0.88))
        cone.scale.set(18, 34, 18)
        cone.position.set(Math.cos(fa) * z.radius * 0.82, 18, Math.sin(fa) * z.radius * 0.82)
        grp.add(cone)
      }
      this.addStarGlint(grp, 0, 30, 0, 42, 0x34d399)
    } else if (z.kind === 'beelzebuth') {
      // Dark Event Horizon Core + Abyssal Pull Spirals
      const blackCore = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, 0x020617, 0.98))
      blackCore.scale.setScalar(30)
      blackCore.position.y = 32
      const photonRing = new THREE.Mesh(this.sharedTorusGeo, this.mkMat(grp, 0x38bdf8, 0.94))
      photonRing.scale.setScalar(34)
      photonRing.position.y = 32
      grp.add(blackCore, photonRing)
      for (let t = 0; t < 8; t++) {
        const a = (t * Math.PI) / 4
        this.addSegment3D(grp, Math.cos(a) * z.radius * 0.92, 6, Math.sin(a) * z.radius * 0.92, 0, 26, 0, 6, t % 2 === 0 ? 0x38bdf8 : 0xa855f7, 0.85)
      }
    } else if (z.kind === 'gilga_sword_rain') {
      // 4 Golden Gate Sky Portals High Above!
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        const portal = new THREE.Mesh(this.sharedDiscGeo, this.mkMat(grp, 0xfacc15, 0.85, true))
        portal.scale.setScalar(36)
        portal.position.set(Math.cos(a) * z.radius * 0.56, 220, Math.sin(a) * z.radius * 0.56)
        grp.add(portal)
      }
      this.addStarGlint(grp, 0, 24, 0, 30, 0xfacc15)
    } else if (z.kind === 'enkidu_field' || z.kind === 'thanos_space_vortex' || z.kind === 'thanos_time_mandala') {
      const spokes = z.kind === 'thanos_time_mandala' ? 4 : 8
      for (let s = 0; s < spokes; s++) {
        const a = (s * Math.PI * 2) / spokes
        this.addSegment3D(grp, Math.cos(a) * z.radius * 0.92, 6, Math.sin(a) * z.radius * 0.92, 0, 6, 0, 5, acc, 0.88)
      }
    } else if (z.kind === 'amaterasu' || z.kind === 'fuga_cinder') {
      for (let i = 0; i < 8; i++) {
        const ang = i * 0.85
        const dist = z.radius * (0.28 + (i % 3) * 0.25)
        const flame = new THREE.Mesh(this.sharedConeGeo, this.mkMat(grp, z.kind === 'amaterasu' ? 0x09090b : col, 0.92))
        flame.scale.set(16, 30, 16)
        flame.position.set(Math.cos(ang) * dist, 16, Math.sin(ang) * dist)
        grp.add(flame)
      }
    } else if (z.kind === 'tsukuyomi') {
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3
        const tomoe = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, 0xef4444, 0.95))
        tomoe.scale.setScalar(11)
        tomoe.position.set(Math.cos(ang) * z.radius * 0.58, 18, Math.sin(ang) * z.radius * 0.58)
        grp.add(tomoe)
      }
    } else if (z.kind === 'ora_meow_barrage') {
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3
        const fist = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, k % 2 === 0 ? 0xc084fc : 0xfacc15, 0.92))
        fist.scale.setScalar(14)
        fist.position.set(Math.cos(ang) * z.radius * 0.56, 22 + (k % 2) * 14, Math.sin(ang) * z.radius * 0.56)
        grp.add(fist)
      }
    } else if (z.kind === 'thanos_infinity_snap') {
      const cols = [0xa855f7, 0x3b82f6, 0xef4444, 0x10b981, 0xfacc15]
      for (let i = 0; i < cols.length; i++) {
        this.addRing3D(grp, 0, 4 + i, 0, z.radius * (0.55 + i * 0.14), cols[i], 0.94, 0)
      }
      this.addStarGlint(grp, 0, 38, 0, 58, 0xfef08a)
    } else if (z.kind === 'killua_solo_ring' || z.kind === 'thunder_slam' || z.kind === 'saitama_crater') {
      const bolts = z.kind === 'saitama_crater' ? 10 : 6
      for (let k = 0; k < bolts; k++) {
        const a = (k * Math.PI * 2) / bolts
        this.addJaggedBolt3D(grp, 0, 14, 0, Math.cos(a) * z.radius * 0.94, 4, Math.sin(a) * z.radius * 0.94, col, acc, 10, 4, k)
      }
    } else if (z.kind === 'hollow_purple') {
      const core = new THREE.Mesh(this.sharedSphereGeo, this.mkMat(grp, 0xffffff, 0.92))
      core.scale.setScalar(48)
      core.position.y = 30
      grp.add(core)
      this.addStarGlint(grp, 0, 36, 0, 54, 0xf0abfc)
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
      if (z.kind !== 'zenitsu_honoo_no_kami') {
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
    for (const st of this.projMeshes.values()) this.recycleGroupResources(st.grp)
    for (const grp of this.beamMeshes.values()) this.recycleGroupResources(grp)
    for (const grp of this.zoneMeshes.values()) this.recycleGroupResources(grp)
    for (const m of this.matPool) m.dispose()
    this.matPool.length = 0
    this.projMeshes.clear()
    this.beamMeshes.clear()
    this.zoneMeshes.clear()
    this.aimTexCache.dispose()
    this.aimOuterMat.dispose()
    this.aimInnerMat.dispose()
    this.aimLineMat.dispose()
    this.aimSigilGeo.dispose()
    this.sharedSphereGeo.dispose()
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
