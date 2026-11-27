import * as THREE from 'three'
import type { BeamEffect, Projectile } from '../types/game'
import { registerChoreography } from './vfxAnimator'
import type { VfxShaderLibrary } from './vfxShaders'
import type { VfxTextureAtlas } from './vfxTextures'

/**
 * 100% Unique Anti-Neon Basic Attack 3D VFX Builders for all 51 Heroes + Igris (v3).
 * - Uses Procedural Canvas2D Textures (brush slashes, playing cards, voxel diamond, lightning ribbons).
 * - Uses 3-Stage Choreography (`sweep_arc`, `lightning_flicker`, `thrust_lunge`).
 * - Zero screen shake (handled by Vfx3dManager with FeelTier 'none').
 */

export interface BasicVfxGeos {
  box: THREE.BoxGeometry
  sphere: THREE.SphereGeometry
  cone: THREE.ConeGeometry
  cyl: THREE.CylinderGeometry
  ring: THREE.RingGeometry
  disc: THREE.CircleGeometry
  torus: THREE.TorusGeometry
  slashArc: THREE.RingGeometry
  octa: THREE.OctahedronGeometry
  shockCone: THREE.CylinderGeometry
}

export function createBasicVfxGeos(): BasicVfxGeos {
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10)
  cyl.rotateX(Math.PI / 2)
  const cone = new THREE.ConeGeometry(0.55, 1.4, 8)
  cone.rotateX(Math.PI / 2)
  const ring = new THREE.RingGeometry(0.76, 1.0, 22)
  ring.rotateX(-Math.PI / 2)
  const disc = new THREE.CircleGeometry(1, 18)
  disc.rotateX(-Math.PI / 2)
  const torus = new THREE.TorusGeometry(1, 0.2, 6, 18)
  const slashArc = new THREE.RingGeometry(0.48, 1.0, 22, 1, -Math.PI * 0.62, Math.PI * 1.24)
  slashArc.rotateX(-Math.PI / 2)
  const shockCone = new THREE.CylinderGeometry(0.28, 1.0, 1.0, 14, 1, true)
  shockCone.rotateX(Math.PI / 2)

  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 12, 8),
    cone,
    cyl,
    ring,
    disc,
    torus,
    slashArc,
    octa: new THREE.OctahedronGeometry(1, 0),
    shockCone,
  }
}

export function disposeBasicVfxGeos(g: BasicVfxGeos): void {
  g.box.dispose()
  g.sphere.dispose()
  g.cone.dispose()
  g.cyl.dispose()
  g.ring.dispose()
  g.disc.dispose()
  g.torus.dispose()
  g.slashArc.dispose()
  g.octa.dispose()
  g.shockCone.dispose()
}

export function isBasicAttackKind(kind: string | undefined): boolean {
  if (!kind) return false
  const k = kind.toLowerCase()
  return k.startsWith('atk_') || k.includes('_basic_') || k === 'basic_lock_reticle'
}

function solidMat(colorHex: number, opacity = 0.92, additive = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: opacity < 1 || additive,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
}

function texMat(tex: THREE.Texture, colorHex: number, opacity = 0.94, additive = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: tex,
    color: colorHex,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
}

function trackShader(grp: THREE.Group, mat: THREE.ShaderMaterial, baseOpacity: number): THREE.ShaderMaterial {
  mat.userData.baseOpacity = baseOpacity
  let list = grp.userData.shaderMats as THREE.ShaderMaterial[] | undefined
  if (!list) {
    list = []
    grp.userData.shaderMats = list
  }
  list.push(mat)
  return mat
}

/**
 * Builds a unique 3D projectile Group for any hero's ranged basic attack.
 */
export function buildUniqueBasicProjectile(
  pr: Projectile,
  g: BasicVfxGeos,
  shaderLib: VfxShaderLibrary,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): THREE.Group | null {
  if (!isBasicAttackKind(pr.kind)) return null
  const k = (pr.kind ?? '').toLowerCase()
  const grp = new THREE.Group()
  const r = Math.max(7.5, pr.radius || 8.5)

  if (k === 'atk_gilga_sword') {
    const blade = new THREE.Mesh(g.box, solidMat(0xfacc15, 0.96))
    blade.scale.set(r * 0.42, r * 0.22, r * 3.1)
    const edge = new THREE.Mesh(g.box, solidMat(0xfef9c3, 0.95))
    edge.scale.set(r * 0.2, r * 0.26, r * 3.25)
    const guard = new THREE.Mesh(g.box, solidMat(0xb45309, 0.96))
    guard.scale.set(r * 1.45, r * 0.3, r * 0.34)
    guard.position.z = -r * 0.95
    const ripple = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, 0xfacc15, 0.72))
    ripple.scale.setScalar(r * 1.15)
    ripple.rotation.x = Math.PI / 2
    ripple.position.z = -r * 1.45
    grp.add(blade, edge, guard, ripple)
    return grp
  }

  if (k === 'atk_itachi_kunai') {
    const blade = new THREE.Mesh(g.cone, solidMat(0x18181b, 0.96))
    blade.scale.set(r * 0.68, r * 0.34, r * 1.9)
    blade.position.z = r * 0.55
    const edge = new THREE.Mesh(g.cone, solidMat(0xe11d48, 0.78))
    edge.scale.set(r * 0.78, r * 0.2, r * 1.65)
    edge.position.z = r * 0.45
    const hilt = new THREE.Mesh(g.cyl, solidMat(0x991b1b, 0.96))
    hilt.scale.set(r * 0.22, r * 0.22, r * 1.25)
    hilt.position.z = -r * 0.85
    const feather = new THREE.Mesh(g.box, solidMat(0x09090b, 0.85))
    feather.scale.set(r * 0.9, r * 0.12, r * 1.4)
    feather.position.set(r * 0.45, 2, -r * 1.2)
    feather.rotation.y = 0.28
    grp.add(blade, edge, hilt, feather)
    return grp
  }

  if (k === 'atk_rimuru_water') {
    const arc = new THREE.Mesh(groundPlaneGeo, texMat(textures.brushSlash, 0x38bdf8, 0.92))
    arc.scale.setScalar(r * 2.15)
    const core = new THREE.Mesh(g.sphere, solidMat(0xe0f2fe, 0.82))
    core.scale.set(r * 0.6, r * 0.42, r * 1.35)
    grp.add(arc, core)
    return grp
  }

  if (k === 'atk_ben10_omni') {
    const body = new THREE.Mesh(g.octa, solidMat(0x16a34a, 0.94))
    body.scale.set(r * 0.95, r * 0.55, r * 1.9)
    const darkBand = new THREE.Mesh(g.box, solidMat(0x09090b, 0.92))
    darkBand.scale.set(r * 1.12, r * 0.65, r * 0.45)
    const ring = new THREE.Mesh(g.torus, solidMat(0x4ade80, 0.75))
    ring.scale.setScalar(r * 0.85)
    grp.add(body, darkBand, ring)
    return grp
  }

  if (k === 'atk_diablo_claw') {
    for (const ox of [-r * 0.75, 0, r * 0.75]) {
      const claw = new THREE.Mesh(g.cone, solidMat(0x4c0519, 0.94))
      claw.scale.set(r * 0.34, r * 0.24, r * 2.1)
      claw.position.set(ox, 0, ox === 0 ? r * 0.35 : 0)
      const rim = new THREE.Mesh(g.cone, solidMat(0xf43f5e, 0.78))
      rim.scale.set(r * 0.22, r * 0.3, r * 2.0)
      rim.position.set(ox, 0.5, ox === 0 ? r * 0.35 : 0)
      grp.add(claw, rim)
    }
    return grp
  }

  if (k === 'aizen_basic_orb') {
    const mat = trackShader(grp, shaderLib.createMaterial('darkVoid', 0xe9d5ff, 0x7e22ce, { opacity: 0.94 }), 0.94)
    const orb = new THREE.Mesh(g.sphere, mat)
    orb.scale.setScalar(r * 1.18)
    const ring = new THREE.Mesh(g.torus, solidMat(0xc084fc, 0.78))
    ring.scale.setScalar(r * 1.5)
    ring.rotation.x = Math.PI * 0.35
    ring.userData.spinSpeed = 0.015
    grp.add(orb, ring)
    return grp
  }

  if (k === 'frieren_basic_bolt') {
    const shaft = new THREE.Mesh(g.cone, solidMat(0x38bdf8, 0.94))
    shaft.scale.set(r * 0.58, r * 0.58, r * 2.4)
    const core = new THREE.Mesh(g.cyl, solidMat(0xfef08a, 0.95))
    core.scale.set(r * 0.2, r * 0.2, r * 2.1)
    const sigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, 0xfacc15, 0.82))
    sigil.scale.setScalar(r * 1.15)
    sigil.rotation.x = Math.PI / 2
    sigil.position.z = -r * 0.9
    sigil.userData.spinSpeed = 0.018
    grp.add(shaft, core, sigil)
    return grp
  }

  if (k === 'gray_basic_shard') {
    const crystal = new THREE.Mesh(g.octa, solidMat(0x0284c7, 0.94))
    crystal.scale.set(r * 0.65, r * 0.55, r * 2.35)
    const frost = new THREE.Mesh(g.cone, solidMat(0xe0f2fe, 0.92))
    frost.scale.set(r * 0.42, r * 0.42, r * 1.8)
    frost.position.z = r * 0.4
    grp.add(crystal, frost)
    return grp
  }

  if (k === 'krasue_basic_wisp') {
    const outer = new THREE.Mesh(g.cone, solidMat(0xe11d48, 0.88))
    outer.scale.set(r * 0.9, r * 0.9, r * 1.9)
    outer.rotation.x = Math.PI
    const head = new THREE.Mesh(g.sphere, solidMat(0xfb923c, 0.94))
    head.scale.setScalar(r * 0.72)
    head.position.z = r * 0.45
    grp.add(outer, head)
    return grp
  }

  if (k === 'gambit_basic_card') {
    // Authentic spinning playing card face with kinetic magenta trim!
    const card = new THREE.Mesh(g.box, texMat(textures.playingCard, 0xffffff, 0.98))
    card.scale.set(r * 1.45, r * 0.16, r * 2.05)
    card.userData.spinSpeed = 0.028
    grp.add(card)
    return grp
  }

  if (k === 'ironman_basic_bolt') {
    const dart = new THREE.Mesh(g.cyl, solidMat(0xe0f2fe, 0.96))
    dart.scale.set(r * 0.34, r * 0.34, r * 2.6)
    const sleeve = new THREE.Mesh(g.cyl, solidMat(0xef4444, 0.82))
    sleeve.scale.set(r * 0.56, r * 0.56, r * 1.55)
    sleeve.position.z = -r * 0.45
    const tip = new THREE.Mesh(g.sphere, solidMat(0x38bdf8, 0.92))
    tip.scale.setScalar(r * 0.55)
    tip.position.z = r * 1.15
    grp.add(sleeve, dart, tip)
    return grp
  }

  if (k === 'tansan_basic_fizz') {
    const b1 = new THREE.Mesh(g.sphere, solidMat(0x38bdf8, 0.76))
    b1.scale.setScalar(r * 0.95)
    const b2 = new THREE.Mesh(g.sphere, solidMat(0xf0f9ff, 0.86))
    b2.scale.setScalar(r * 0.58)
    b2.position.set(r * 0.65, r * 0.25, -r * 0.45)
    const b3 = new THREE.Mesh(g.sphere, solidMat(0x7dd3fc, 0.78))
    b3.scale.setScalar(r * 0.48)
    b3.position.set(-r * 0.6, -r * 0.15, -r * 0.55)
    grp.add(b1, b2, b3)
    return grp
  }

  if (k === 'king_basic_pulse') {
    const outer = new THREE.Mesh(g.torus, solidMat(0xd97706, 0.88))
    outer.scale.setScalar(r * 1.25)
    const inner = new THREE.Mesh(g.torus, solidMat(0x1e293b, 0.82))
    inner.scale.setScalar(r * 0.75)
    inner.position.z = r * 0.35
    grp.add(outer, inner)
    return grp
  }

  if (k === 'doraemon_basic_air') {
    const ring = new THREE.Mesh(g.torus, solidMat(0xe0f2fe, 0.9))
    ring.scale.setScalar(r * 1.22)
    const rim = new THREE.Mesh(g.torus, solidMat(0x0284c7, 0.76))
    rim.scale.setScalar(r * 1.42)
    rim.position.z = -r * 0.35
    grp.add(ring, rim)
    return grp
  }

  if (k === 'beelz_basic_vib') {
    const wave = new THREE.Mesh(g.torus, solidMat(0x581c87, 0.9))
    wave.scale.setScalar(r * 1.15)
    const core = new THREE.Mesh(g.octa, solidMat(0xa78bfa, 0.85))
    core.scale.set(r * 0.55, r * 0.55, r * 1.35)
    grp.add(wave, core)
    return grp
  }

  if (k === 'cj_basic_bolt') {
    const main = new THREE.Mesh(g.cone, solidMat(0x0284c7, 0.94))
    main.scale.set(r * 0.62, r * 0.48, r * 2.2)
    const fin = new THREE.Mesh(g.box, solidMat(0xe11d48, 0.9))
    fin.scale.set(r * 1.35, r * 0.16, r * 0.9)
    fin.position.z = -r * 0.65
    grp.add(main, fin)
    return grp
  }

  const orb = new THREE.Mesh(g.octa, solidMat(0x539bf5, 0.9))
  orb.scale.set(r * 0.8, r * 0.8, r * 1.4)
  grp.add(orb)
  return grp
}

/**
 * Helper to create a compact animated jagged 3D lightning ribbon for electric basic attacks.
 */
function addAnimatedLightningBasic(
  grp: THREE.Group,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  colorHex: number,
  width: number,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): void {
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.max(14, Math.hypot(dx, dz))
  const yaw = Math.atan2(dx, dz)

  const ribbon = new THREE.Mesh(groundPlaneGeo, texMat(textures.lightningBolt, colorHex, 0.92, true))
  ribbon.scale.set(width, 1, len * 0.5)
  ribbon.position.set((x1 + x2) * 0.5, 25, (z1 + z2) * 0.5)
  ribbon.rotation.y = yaw
  grp.add(ribbon)
  registerChoreography(grp, { target: ribbon, kind: 'lightning_flicker', seed: len * 0.17 })
}

/**
 * Builds a unique animated 3D melee sweep / thrust / shot Group for any hero's Beam/Cone basic attack.
 */
export function buildUniqueBasicBeam(
  b: BeamEffect,
  g: BasicVfxGeos,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): THREE.Group | null {
  if (!isBasicAttackKind(b.kind)) return null
  const k = (b.kind ?? '').toLowerCase()
  const grp = new THREE.Group()

  const dx = b.x2 - b.x1
  const dz = b.y2 - b.y1
  const len = Math.max(16, Math.hypot(dx, dz))
  const yaw = Math.atan2(dx, dz)
  const midX = (b.x1 + b.x2) * 0.5
  const midZ = (b.y1 + b.y2) * 0.5

  // 0. Target-Lock Reticle: subtle crisp ring directly on the locked enemy (NEVER a floating cone!)
  if (k === 'basic_lock_reticle') {
    const ring = new THREE.Mesh(g.ring, solidMat(0xe2e8f0, 0.55))
    ring.scale.setScalar(26)
    ring.position.set(b.x2, 3.2, b.y2)
    grp.add(ring)
    return grp
  }

  // 1. Electric Basic Attacks (Killua & Zenitsu) -> Live flickering jagged lightning!
  if (k === 'atk_killua_spark') {
    addAnimatedLightningBasic(grp, b.x1, b.y1, b.x2, b.y2, 0x38bdf8, 16, textures, groundPlaneGeo)
    return grp
  }
  if (k === 'atk_zenitsu_slash') {
    addAnimatedLightningBasic(grp, b.x1, b.y1, b.x2, b.y2, 0xfacc15, 18, textures, groundPlaneGeo)
    const slash = new THREE.Mesh(groundPlaneGeo, texMat(textures.brushSlash, 0xfef08a, 0.92))
    const rad = Math.min(105, len * 0.65)
    slash.scale.set(rad, 1, rad)
    slash.position.set(b.x1 + dx * 0.15, 24, b.y1 + dz * 0.15)
    grp.add(slash)
    registerChoreography(grp, { target: slash, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.55 })
    return grp
  }

  // 2. Gilgamesh Golden Flash Line
  if (k === 'atk_gilga_flash') {
    const bar = new THREE.Mesh(g.box, solidMat(0xfacc15, 0.9))
    bar.scale.set(5, 3, len)
    bar.position.set(midX, 26, midZ)
    bar.rotation.y = yaw
    grp.add(bar)
    registerChoreography(grp, { target: bar, kind: 'thrust_lunge' })
    return grp
  }

  // 3. Simo Sniper Rifle Shot
  if (k === 'atk_simo_rifle') {
    const tracer = new THREE.Mesh(g.box, solidMat(0xf8fafc, 0.95))
    tracer.scale.set(3.4, 3.4, len)
    tracer.position.set(midX, 26, midZ)
    tracer.rotation.y = yaw
    const puff = new THREE.Mesh(groundPlaneGeo, texMat(textures.smokePuff, 0xe0f2fe, 0.68))
    puff.scale.setScalar(18)
    puff.position.set(b.x1, 26, b.y1)
    grp.add(tracer, puff)
    return grp
  }

  // 4. Zoro Santoryu (3 staggered sweeping anime brush crescents!)
  if (k === 'atk_zoro_sweep') {
    const rad = Math.min(125, Math.max(70, len * 0.64))
    const configs = [
      { y: 18, col: 0x10b981, span: 1.75 },
      { y: 26, col: 0x34d399, span: 1.95 },
      { y: 34, col: 0x059669, span: 1.6 },
    ]
    for (const c of configs) {
      const arc = new THREE.Mesh(groundPlaneGeo, texMat(textures.brushSlash, c.col, 0.9))
      arc.scale.set(rad, 1, rad)
      arc.position.set(b.x1, c.y, b.y1)
      grp.add(arc)
      registerChoreography(grp, { target: arc, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: c.span })
    }
    return grp
  }

  // 5. Sukuna Dismantle Cleave (razor-sharp crossed crimson-black slicing air cuts directly across target!)
  if (k === 'atk_sukuna_cleave') {
    const cutLen = Math.min(115, Math.max(68, len * 0.72))
    // Twin diagonal X-slice cuts flashing directly across the strike point!
    for (const ang of [-0.62, 0.62]) {
      const darkBlade = new THREE.Mesh(g.box, solidMat(0x09090b, 0.96))
      darkBlade.scale.set(3.2, 2.2, cutLen)
      darkBlade.position.set(b.x1 + dx * 0.65, 26, b.y1 + dz * 0.65)
      darkBlade.rotation.set(ang * 0.45, yaw + ang, ang * 0.5)
      const crimsonEdge = new THREE.Mesh(g.box, solidMat(0xe11d48, 0.94))
      crimsonEdge.scale.set(7.5, 1.4, cutLen * 1.06)
      crimsonEdge.position.copy(darkBlade.position)
      crimsonEdge.rotation.copy(darkBlade.rotation)
      const whiteFlash = new THREE.Mesh(g.box, solidMat(0xfda4af, 0.95))
      whiteFlash.scale.set(1.8, 2.8, cutLen * 0.86)
      whiteFlash.position.copy(darkBlade.position)
      whiteFlash.rotation.copy(darkBlade.rotation)
      grp.add(crimsonEdge, darkBlade, whiteFlash)
    }
    // Thin crimson slicing streak from Sukuna to target
    const line = new THREE.Mesh(g.box, solidMat(0xbe123c, 0.78))
    line.scale.set(3.0, 1.6, len * 0.85)
    line.position.set(midX, 25, midZ)
    line.rotation.y = yaw
    grp.add(line)
    registerChoreography(grp, { target: line, kind: 'thrust_lunge' })
    return grp
  }

  // 6. Steve Voxel Diamond Sword Sweep (textured Diamond blocks swinging!)
  if (k === 'steve_basic_sword') {
    const pivot = new THREE.Group()
    pivot.position.set(b.x1, 24, b.y1)
    const rad = Math.min(105, Math.max(62, len * 0.58))
    const mat = texMat(textures.voxelDiamond, 0xffffff, 0.96)
    for (let i = 0; i < 4; i++) {
      const a = -0.55 + (i / 3) * 1.1
      const block = new THREE.Mesh(g.box, mat)
      block.scale.set(16, 10, 16)
      block.position.set(Math.sin(a) * rad, 0, Math.cos(a) * rad)
      block.rotation.y = a
      pivot.add(block)
    }
    grp.add(pivot)
    registerChoreography(grp, { target: pivot, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.45 })
    return grp
  }

  // 7. Polearms / Staffs / Spears / Chain Blades (Animated Thrust Lunge!)
  if (
    k === 'wukong_basic_staff' ||
    k === 'nezha_basic_spear' ||
    k === 'buddha_basic_staff' ||
    k === 'kai_basic_blade' ||
    k === 'law_basic_slash'
  ) {
    const isWukong = k === 'wukong_basic_staff'
    const isNezha = k === 'nezha_basic_spear'
    const isKai = k === 'kai_basic_blade'
    const isLaw = k === 'law_basic_slash'

    const mainCol = isWukong ? 0xdc2626 : isNezha ? 0xf97316 : isKai ? 0x10b981 : isLaw ? 0x0ea5e9 : 0xfacc15
    const tipCol = isWukong ? 0xfacc15 : isNezha ? 0xfef08a : isKai ? 0xa7f3d0 : isLaw ? 0xe0f2fe : 0xfef9c3

    const shaft = new THREE.Mesh(g.cyl, solidMat(mainCol, 0.94))
    shaft.scale.set(isLaw ? 3.2 : 6.0, isLaw ? 2.4 : 6.0, len * 0.88)
    shaft.position.set(midX, 25, midZ)
    shaft.rotation.y = yaw
    grp.add(shaft)
    registerChoreography(grp, { target: shaft, kind: 'thrust_lunge' })

    if (isWukong) {
      for (const end of [0.15, 0.86]) {
        const cap = new THREE.Mesh(g.cyl, solidMat(0xfacc15, 0.96))
        cap.scale.set(8.0, 8.0, 16)
        cap.position.set(b.x1 + dx * end, 25, b.y1 + dz * end)
        cap.rotation.y = yaw
        grp.add(cap)
      }
    } else if (isNezha || isKai) {
      const tip = new THREE.Mesh(g.cone, solidMat(tipCol, 0.96))
      tip.scale.set(15, 10, 30)
      tip.position.set(b.x2, 25, b.y2)
      tip.rotation.y = yaw
      grp.add(tip)
    } else if (isLaw) {
      const line = new THREE.Mesh(g.box, solidMat(0xf8fafc, 0.96))
      line.scale.set(2.2, 2.2, len)
      line.position.set(midX, 25, midZ)
      line.rotation.y = yaw
      grp.add(line)
      registerChoreography(grp, { target: line, kind: 'thrust_lunge' })
    } else {
      const lotus = new THREE.Mesh(groundPlaneGeo, texMat(textures.dharmaLotus, tipCol, 0.78))
      lotus.scale.setScalar(26)
      lotus.position.set(b.x2, 25, b.y2)
      grp.add(lotus)
    }
    return grp
  }

  // 8. Physical Punches / Palms / Kicks (Crisp Anime Fist Streak + Impact Shock Rings — ZERO ugly cones!)
  if (
    k === 'atk_goku_fist' ||
    k === 'atk_sorn_jab' ||
    k === 'atk_gojo_punch' ||
    k === 'atk_luffy_punch' ||
    k === 'atk_sanji_kick' ||
    k === 'atk_thanos_gauntlet' ||
    k === 'garp_basic_fist' ||
    k === 'gon_basic_fist' ||
    k === 'adam_basic_knuckle' ||
    k === 'po_basic_palm' ||
    k === 'diavolo_basic_chop' ||
    k === 'toriko_basic_punch' ||
    k === 'tailung_basic_strike' ||
    k === 'grandma_basic_dash'
  ) {
    let coreHex = 0xf8fafc
    let outerHex = 0x94a3b8
    if (k === 'atk_goku_fist') { coreHex = 0xfef08a; outerHex = 0xf97316 }
    else if (k === 'atk_sorn_jab') { coreHex = 0xfef9c3; outerHex = 0xdc2626 }
    else if (k === 'atk_gojo_punch') { coreHex = 0xe0f2fe; outerHex = 0x2563eb }
    else if (k === 'atk_luffy_punch') { coreHex = 0xfef2f2; outerHex = 0xdc2626 }
    else if (k === 'atk_sanji_kick') { coreHex = 0xfef08a; outerHex = 0xf97316 }
    else if (k === 'atk_thanos_gauntlet') { coreHex = 0xfacc15; outerHex = 0x7e22ce }
    else if (k === 'garp_basic_fist') { coreHex = 0x18181b; outerHex = 0xdc2626 }
    else if (k === 'gon_basic_fist') { coreHex = 0xfef08a; outerHex = 0x16a34a }
    else if (k === 'adam_basic_knuckle') { coreHex = 0xf8fafc; outerHex = 0xf59e0b }
    else if (k === 'po_basic_palm') { coreHex = 0xfef9c3; outerHex = 0xeab308 }
    else if (k === 'diavolo_basic_chop') { coreHex = 0xf472b6; outerHex = 0xbe123c }
    else if (k === 'toriko_basic_punch') { coreHex = 0xfef08a; outerHex = 0xef4444 }
    else if (k === 'tailung_basic_strike') { coreHex = 0xbfdbfe; outerHex = 0x1d4ed8 }
    else if (k === 'grandma_basic_dash') { coreHex = 0xfca5a5; outerHex = 0xdc2626 }

    // 3 sleek forward anime motion lines aligned cleanly along strike direction
    const streakSpread = 12
    const px = -dz / len
    const pz = dx / len
    for (let i = -1; i <= 1; i++) {
      const streak = new THREE.Mesh(g.box, solidMat(i === 0 ? coreHex : outerHex, i === 0 ? 0.9 : 0.65))
      streak.scale.set(i === 0 ? 4.2 : 2.2, 2.2, len * (i === 0 ? 0.72 : 0.56))
      streak.position.set(midX + px * i * streakSpread, 24 + (i === 0 ? 0 : 3), midZ + pz * i * streakSpread)
      streak.rotation.y = yaw
      grp.add(streak)
      registerChoreography(grp, { target: streak, kind: 'thrust_lunge' })
    }

    // Crisp perpendicular shock impact ring at strike tip
    const ring = new THREE.Mesh(g.torus, solidMat(coreHex, 0.9))
    ring.scale.setScalar(22)
    ring.position.set(b.x1 + dx * 0.84, 24, b.y1 + dz * 0.84)
    ring.rotation.y = yaw
    grp.add(ring)

    const outerRing = new THREE.Mesh(g.torus, solidMat(outerHex, 0.72))
    outerRing.scale.setScalar(30)
    outerRing.position.set(b.x1 + dx * 0.72, 24, b.y1 + dz * 0.72)
    outerRing.rotation.y = yaw
    grp.add(outerRing)

    if (k === 'garp_basic_fist') {
      addAnimatedLightningBasic(grp, b.x1, b.y1, b.x2, b.y2, 0xdc2626, 14, textures, groundPlaneGeo)
    } else if (k === 'atk_luffy_punch') {
      const arm = new THREE.Mesh(g.cyl, solidMat(0xfdba74, 0.92))
      arm.scale.set(5.2, 5.2, len * 0.82)
      arm.position.set(midX, 24, midZ)
      arm.rotation.y = yaw
      grp.add(arm)
      registerChoreography(grp, { target: arm, kind: 'thrust_lunge' })
    } else if (k === 'atk_sanji_kick') {
      const kickArc = new THREE.Mesh(groundPlaneGeo, texMat(textures.brushSlash, 0xf97316, 0.92))
      const rad = Math.min(95, len * 0.62)
      kickArc.scale.set(rad, 1, rad)
      kickArc.position.set(b.x1 + dx * 0.14, 22, b.y1 + dz * 0.14)
      grp.add(kickArc)
      registerChoreography(grp, { target: kickArc, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.65 })
    }
    return grp
  }

  // 9. All Remaining Blade / Claw / Club / Rasengan Sweeps -> Animated Brush-Stroke Sweep Arc!
  let slashCol = 0x539bf5
  if (k === 'atk_jinwoo_dagger') slashCol = 0xa855f7
  else if (k === 'atk_naruto_rasen') slashCol = 0x38bdf8
  else if (k === 'atk_aiouan_paw') slashCol = 0xc084fc
  else if (k === 'cid_basic_slime') slashCol = 0x7c3aed
  else if (k === 'yami_basic_blade') slashCol = 0x581c87
  else if (k === 'meliodas_basic_cut') slashCol = 0x7e22ce
  else if (k === 'escanor_basic_flare') slashCol = 0xf59e0b
  else if (k === 'krahang_basic_club') slashCol = 0xd97706
  else if (k === 'pop_basic_fang') slashCol = 0x22c55e

  const rad = Math.min(120, Math.max(66, len * 0.62))
  const arc = new THREE.Mesh(groundPlaneGeo, texMat(textures.brushSlash, slashCol, 0.94))
  arc.scale.set(rad, 1, rad)
  arc.position.set(b.x1, 24, b.y1)
  grp.add(arc)
  registerChoreography(grp, { target: arc, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.72 })

  if (k === 'atk_naruto_rasen') {
    const orb = new THREE.Mesh(g.sphere, solidMat(0x38bdf8, 0.9))
    orb.scale.setScalar(15)
    orb.position.set(b.x2, 24, b.y2)
    grp.add(orb)
  } else if (k === 'atk_jinwoo_dagger') {
    const arc2 = new THREE.Mesh(groundPlaneGeo, texMat(textures.brushSlash, 0x38bdf8, 0.85))
    arc2.scale.set(rad * 0.82, 1, rad * 0.82)
    arc2.position.set(b.x1, 30, b.y1)
    grp.add(arc2)
    registerChoreography(grp, { target: arc2, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: -1.55 })
  }

  return grp
}
