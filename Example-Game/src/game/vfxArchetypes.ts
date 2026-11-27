import * as THREE from 'three'
import type { BeamEffect, Projectile } from '../types/game'
import type { FeelTier } from './gameFeelController'
import { registerChoreography } from './vfxAnimator'
import { type BasicVfxGeos, isBasicAttackKind } from './vfxBasicAttacks'
import type { SculptedVfxGeos } from './vfxGeometries'
import type { HeroVfxSignature } from './vfxHeroSignatures'
import type { VfxShaderLibrary } from './vfxShaders'
import type { VfxTextureAtlas } from './vfxTextures'

/**
 * Roster 28 Sculpted 3D Skill Projectiles, Beams, Lightning & Sweeps (`vfxArchetypes.ts`, v4).
 * Matched 1:1 to the reworked lore skills in `roster28.go` using true sculpted 3D meshes
 * (`curvedSlashRibbon`, `helicalBeamSpiral`, `facetedCrystal`, `jaggedFlame`, `craterRim`).
 */

export type BeamArchetype = 'dash' | 'lightning' | 'beam' | 'punch_cone' | 'thrust_weapon' | 'blade_sweep'

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

function texMat(tex: THREE.Texture, colorHex: number, opacity = 0.92, additive = false): THREE.MeshBasicMaterial {
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
 * Builds sculpted 3D projectiles for all Roster 28 reworked projectile skills.
 * Returns null if not a Roster 28 custom projectile kind.
 */
export function buildRoster28SculptedProjectile(
  pr: Projectile,
  g: BasicVfxGeos,
  sculpted: SculptedVfxGeos,
  shaderLib: VfxShaderLibrary,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): THREE.Group | null {
  const k = (pr.kind ?? '').toLowerCase()
  const r = Math.max(9, pr.radius || 12)
  const grp = new THREE.Group()

  if (k === 'dismantle') {
    // Sukuna Dismantle: Razor-sharp flying crimson-black slicing crescent blade!
    const mat = trackShader(grp, shaderLib.createMaterial('celSlash', 0xfda4af, 0x991b1b, { opacity: 0.96 }), 0.96)
    const blade = new THREE.Mesh(sculpted.curvedSlashRibbon, mat)
    blade.scale.set(r * 2.8, r * 1.1, r * 2.8)
    const darkCore = new THREE.Mesh(g.box, solidMat(0x09090b, 0.95))
    darkCore.scale.set(r * 3.2, 2.2, 4.5)
    grp.add(blade, darkCore)
    return grp
  }

  if (k === 'gray_ice_lance_shard' || k === 'gray_devil_arrow') {
    const isUlt = k === 'gray_devil_arrow'
    const crystal = new THREE.Mesh(sculpted.facetedCrystal, solidMat(isUlt ? 0x0284c7 : 0x38bdf8, 0.96))
    crystal.scale.set(r * 0.95, r * (isUlt ? 3.2 : 2.3), r * 0.95)
    crystal.rotation.x = Math.PI / 2
    const frost = new THREE.Mesh(g.cone, solidMat(0xe0f2fe, 0.92))
    frost.scale.set(r * 0.72, r * 0.72, r * 2.1)
    frost.position.z = r * 0.6
    grp.add(crystal, frost)
    return grp
  }

  if (k === 'cid_slime_wave' || k === 'yami_dark_slash' || k === 'buddha_scythe_rend' || k === 'beelz_chaos_wave') {
    const isYami = k === 'yami_dark_slash'
    const isBuddha = k === 'buddha_scythe_rend'
    const coreCol = isBuddha ? 0xfacc15 : isYami ? 0xef4444 : 0x38bdf8
    const outerCol = isYami ? 0x3b0764 : isBuddha ? 0x7e22ce : 0x6d28d9
    const mat = trackShader(grp, shaderLib.createMaterial('celSlash', coreCol, outerCol, { opacity: 0.95 }), 0.95)
    const arc = new THREE.Mesh(sculpted.curvedSlashRibbon, mat)
    arc.scale.set(r * 2.5, r * 1.4, r * 2.5)
    grp.add(arc)
    return grp
  }

  if (k === 'escanor_cruel_sun_orb') {
    const sun = new THREE.Mesh(g.sphere, solidMat(0xf97316, 0.96))
    sun.scale.setScalar(r * 1.35)
    const core = new THREE.Mesh(g.sphere, solidMat(0xfef9c3, 0.94))
    core.scale.setScalar(r * 0.92)
    const ring = new THREE.Mesh(g.torus, solidMat(0xfacc15, 0.86))
    ring.scale.setScalar(r * 1.75)
    ring.userData.spinSpeed = 0.02
    grp.add(sun, core, ring)
    return grp
  }

  if (k === 'nezha_universe_ring') {
    const ring = new THREE.Mesh(g.torus, solidMat(0xfacc15, 0.98))
    ring.scale.setScalar(r * 1.45)
    ring.rotation.x = Math.PI / 2
    ring.userData.spinSpeed = 0.032
    const fire = new THREE.Mesh(g.torus, solidMat(0xf97316, 0.82))
    fire.scale.setScalar(r * 1.68)
    fire.rotation.x = Math.PI / 2
    grp.add(fire, ring)
    return grp
  }

  if (k === 'nezha_spear_bolt') {
    const tip = new THREE.Mesh(sculpted.jaggedFlame, solidMat(0xf97316, 0.95))
    tip.scale.set(r * 1.1, r * 2.6, r * 1.1)
    tip.rotation.x = Math.PI / 2
    const core = new THREE.Mesh(g.cone, solidMat(0xfef08a, 0.96))
    core.scale.set(r * 0.55, r * 0.55, r * 2.2)
    grp.add(tip, core)
    return grp
  }

  if (k === 'meliodas_trillion_dark') {
    const mat = trackShader(grp, shaderLib.createMaterial('darkVoid', 0xc084fc, 0x3b0764, { opacity: 0.96 }), 0.96)
    const orb = new THREE.Mesh(g.sphere, mat)
    orb.scale.setScalar(r * 1.2)
    grp.add(orb)
    return grp
  }

  if (k === 'gon_jajanken_paper') {
    const orb = new THREE.Mesh(g.sphere, solidMat(0xfacc15, 0.95))
    orb.scale.setScalar(r * 1.25)
    const ring = new THREE.Mesh(g.torus, solidMat(0x22c55e, 0.86))
    ring.scale.setScalar(r * 1.55)
    ring.userData.spinSpeed = 0.022
    grp.add(orb, ring)
    return grp
  }

  if (k === 'gambit_explosive_cards' || k === 'gambit_royal_flush_card') {
    const card = new THREE.Mesh(g.box, texMat(textures.playingCard, 0xffffff, 0.98))
    const s = k === 'gambit_royal_flush_card' ? 1.85 : 1.45
    card.scale.set(r * s, r * 0.2, r * s * 1.4)
    card.userData.spinSpeed = 0.03
    grp.add(card)
    return grp
  }

  if (k === 'doraemon_air_cannon') {
    const ring = new THREE.Mesh(g.torus, solidMat(0xe0f2fe, 0.92))
    ring.scale.setScalar(r * 1.45)
    const rim = new THREE.Mesh(g.torus, solidMat(0x0284c7, 0.84))
    rim.scale.setScalar(r * 1.72)
    rim.position.z = -r * 0.35
    grp.add(rim, ring)
    return grp
  }

  if (k === 'kai_jade_whip' || k === 'kai_spirit_chains' || k === 'kai_jade_wraith') {
    const mesh = new THREE.Mesh(
      k === 'kai_jade_wraith' ? sculpted.facetedCrystal : sculpted.curvedSlashRibbon,
      solidMat(0x10b981, 0.95),
    )
    if (k === 'kai_jade_wraith') {
      mesh.scale.set(r * 1.25, r * 2.2, r * 1.25)
    } else {
      mesh.scale.set(r * 2.1, r * 1.1, r * 2.1)
      mesh.userData.spinSpeed = 0.028
    }
    grp.add(mesh)
    return grp
  }

  if (k === 'tansan_bubble_orb' || k === 'pop_possession_orb' || k === 'krahang_tremor') {
    if (k === 'krahang_tremor') {
      const rock = new THREE.Mesh(sculpted.craterRim, solidMat(0xb45309, 0.94))
      rock.scale.set(r * 1.6, r * 0.9, r * 1.6)
      grp.add(rock)
      return grp
    }
    const isPop = k === 'pop_possession_orb'
    const puff = new THREE.Mesh(groundPlaneGeo, texMat(textures.smokePuff, isPop ? 0x22c55e : 0x38bdf8, 0.9))
    puff.scale.setScalar(r * 2.1)
    const core = new THREE.Mesh(g.sphere, solidMat(isPop ? 0xa3e635 : 0xe0f2fe, 0.92))
    core.scale.setScalar(r * 0.82)
    grp.add(puff, core)
    return grp
  }

  return null
}

export function classifyBeamArchetype(kind: string | undefined, width: number): BeamArchetype {
  const k = (kind ?? '').toLowerCase()

  // Normal Dash & mobility blinks MUST render as crisp dash afterimage trails (NEVER sword slashes!)
  if (
    k === 'dash_afterimage' ||
    k.includes('afterimage') ||
    k.includes('lucky_escape') ||
    k.includes('divine_dodge') ||
    k.includes('thruster_flight') ||
    k.includes('shadow_step') ||
    k.includes('enlightened_step') ||
    k.includes('flying_leap')
  ) {
    return 'dash'
  }

  if (
    k.includes('narukami') ||
    k.includes('godspeed') ||
    k.includes('killua') ||
    k.includes('zenitsu') ||
    k.includes('thunder') ||
    k.includes('honoo') ||
    k.includes('lightning') ||
    k.includes('shock') ||
    k.includes('ifrit')
  ) {
    return 'lightning'
  }

  if (
    k.includes('kamehameha') ||
    k.includes('enuma') ||
    k.includes('zoltraak') ||
    k.includes('unibeam') ||
    k.includes('repulsor') ||
    k.includes('crimson_beam') ||
    k.includes('blood_tether') ||
    k.includes('atomic') ||
    k.includes('waybig') ||
    k.includes('bijuu') ||
    k.includes('hollow_purple') ||
    k.includes('beelz_chaos_wave') ||
    k.includes('puncture_wille') ||
    k.includes('galaxy_divide') ||
    k.includes('wukong_great_sage') ||
    k.includes('buddha_nirvana_wave') ||
    k.includes('shambles_swap') ||
    k.includes('anywhere_door') ||
    k.includes('laser') ||
    k.includes('beam') ||
    k.includes('cannon') ||
    k.includes('fuga')
  ) {
    return 'beam'
  }

  if (
    k.includes('ice_lance') ||
    k.includes('golden_staff') ||
    k.includes('fire_spear') ||
    k.includes('divine_staff') ||
    k.includes('jade_whip') ||
    k.includes('pestle') ||
    k.includes('scissors') ||
    k.includes('bo_staff') ||
    k.includes('cloud_dash')
  ) {
    return 'thrust_weapon'
  }

  if (
    k.includes('punch') ||
    k.includes('fist') ||
    k.includes('palm') ||
    k.includes('kick') ||
    k.includes('jab') ||
    k.includes('chop') ||
    k.includes('nerve_strike') ||
    k.includes('power_strike') ||
    k.includes('jajanken_rock') ||
    k.includes('divine_rep') ||
    k.includes('legendary_glare') ||
    k.includes('belly_bounce') ||
    k.includes('grandma_dash') ||
    k.includes('grandma_death_chase') ||
    k.includes('wind_flight') ||
    k.includes('garp') ||
    k.includes('luffy') ||
    k.includes('saitama')
  ) {
    return 'punch_cone'
  }

  if (
    k.includes('slash') ||
    k.includes('cleave') ||
    k.includes('dismantle') ||
    k.includes('sanzen') ||
    k.includes('pound_ho') ||
    k.includes('amputate') ||
    k.includes('divine_sword') ||
    k.includes('full_counter') ||
    k.includes('hellblaze') ||
    k.includes('diamond_sword') ||
    k.includes('ghost_claw') ||
    k.includes('rampart') ||
    k.includes('thousand_strikes') ||
    k.includes('cut')
  ) {
    return 'blade_sweep'
  }

  return width >= 66 ? 'beam' : 'blade_sweep'
}

export function resolveSkillFeelTier(kind: string | undefined, radiusOrWidth: number, isZone: boolean): FeelTier {
  if (isBasicAttackKind(kind)) return 'none'
  const k = (kind ?? '').toLowerCase()
  if (k === 'dash_afterimage' || k.includes('afterimage') || k === 'basic_lock_reticle') return 'none'

  if (
    k.includes('enuma') ||
    k.includes('kamehameha') ||
    k.includes('hollow_purple') ||
    k.includes('galaxy_impact') ||
    k.includes('galaxy_divide') ||
    k.includes('atomic') ||
    k.includes('cruel_sun') ||
    k.includes('saitama_serious') ||
    k.includes('mega_unibeam') ||
    k.includes('infinity_snap') ||
    k.includes('dimension_slash') ||
    k.includes('puncture_wille') ||
    k.includes('buddha_nirvana_wave')
  ) {
    return 'cataclysm'
  }

  if (
    k.includes('shrine') ||
    k.includes('infinite_void') ||
    k.includes('kurohitsugi') ||
    k.includes('shambles_room') ||
    k.includes('arise') ||
    k.includes('time_erase') ||
    k.includes('black_moon') ||
    k.includes('thousand_strikes') ||
    k.includes('ultimate_father') ||
    k.includes('wuxi') ||
    k.includes('bijuu') ||
    (isZone && radiusOrWidth >= 195)
  ) {
    return 'heavy'
  }

  if (
    k.includes('repulsor') ||
    k.includes('card') ||
    k.includes('fizz') ||
    k.includes('spark') ||
    k.includes('glare') ||
    k.includes('air') ||
    k.includes('bolt') ||
    k.includes('kunai') ||
    k.includes('shard') ||
    k.includes('nerve_strike') ||
    k.includes('shambles_swap')
  ) {
    return 'micro'
  }

  return 'medium'
}

export function addJaggedLightningBolt(
  grp: THREE.Group,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  coreHex: number,
  outerHex: number,
  thickness: number,
  jitterAmt: number,
  segments: number,
  seed: number,
  g: BasicVfxGeos,
  shaderLib: VfxShaderLibrary,
  withForks = true,
): void {
  const dir = new THREE.Vector3().subVectors(p2, p1)
  const len = Math.max(8, dir.length())
  dir.divideScalar(len)

  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const right = new THREE.Vector3().crossVectors(dir, up).normalize()
  const orthoUp = new THREE.Vector3().crossVectors(right, dir).normalize()

  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const pt = new THREE.Vector3().lerpVectors(p1, p2, t)
    if (i > 0 && i < segments) {
      const env = Math.sin(t * Math.PI)
      const h1 = Math.sin(i * 17.31 + seed * 3.7)
      const h2 = Math.cos(i * 23.19 + seed * 5.1)
      pt.addScaledVector(right, h1 * jitterAmt * env)
      pt.addScaledVector(orthoUp, h2 * jitterAmt * 0.48 * env)
    }
    pts.push(pt)
  }

  const coreMat = solidMat(coreHex, 0.96, false)
  const auraMat = trackShader(
    grp,
    shaderLib.createMaterial('lightningArc', coreHex, outerHex, { opacity: 0.56, speed: 3.2, additive: true }),
    0.56,
  )

  const boltPivot = new THREE.Group()
  const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
  boltPivot.position.copy(center)

  for (let i = 0; i < segments; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const sLen = Math.max(2, a.distanceTo(b))
    const midLocal = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5).sub(center)
    const bLocal = b.clone().sub(center)

    const coreSeg = new THREE.Mesh(g.box, coreMat)
    coreSeg.scale.set(thickness, thickness, sLen * 1.07)
    coreSeg.position.copy(midLocal)
    coreSeg.lookAt(bLocal)
    boltPivot.add(coreSeg)

    const auraSeg = new THREE.Mesh(g.box, auraMat)
    auraSeg.scale.set(thickness * 2.3, thickness * 1.7, sLen * 1.04)
    auraSeg.position.copy(midLocal)
    auraSeg.lookAt(bLocal)
    boltPivot.add(auraSeg)

    if (withForks && (i === 2 || i === 4 || i === segments - 2)) {
      const sideSign = i % 2 === 0 ? 1 : -1
      const forkLen = Math.min(72, len * 0.24)
      const forkEnd = b
        .clone()
        .addScaledVector(dir, forkLen * 0.65)
        .addScaledVector(right, sideSign * forkLen * 0.68)
        .addScaledVector(orthoUp, sideSign * 0.25 * forkLen)
      const fMidLocal = new THREE.Vector3().addVectors(b, forkEnd).multiplyScalar(0.5).sub(center)
      const fEndLocal = forkEnd.clone().sub(center)
      const fSeg = new THREE.Mesh(g.box, coreMat)
      fSeg.scale.set(thickness * 0.58, thickness * 0.58, b.distanceTo(forkEnd))
      fSeg.position.copy(fMidLocal)
      fSeg.lookAt(fEndLocal)
      boltPivot.add(fSeg)
    }
  }
  grp.add(boltPivot)
  registerChoreography(grp, { target: boltPivot, kind: 'lightning_flicker', targetY: center.y, seed })
}

export function buildSkillBeamArchetype(
  b: BeamEffect,
  sig: HeroVfxSignature,
  g: BasicVfxGeos,
  sculpted: SculptedVfxGeos,
  shaderLib: VfxShaderLibrary,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): THREE.Group {
  const grp = new THREE.Group()
  const arch = classifyBeamArchetype(b.kind, b.width)
  const k = (b.kind ?? '').toLowerCase()

  const dx = b.x2 - b.x1
  const dz = b.y2 - b.y1
  const len = Math.max(18, Math.hypot(dx, dz))
  const yaw = Math.atan2(dx, dz)
  const midX = (b.x1 + b.x2) * 0.5
  const midZ = (b.y1 + b.y2) * 0.5
  const w = Math.max(12, b.width || 48)

  // === ARCHETYPE 0: CLEAN DASH AFTERIMAGE & SPEED STREAKS (ZERO sword slash, ZERO cone!) ===
  if (arch === 'dash') {
    const px = -dz / len
    const pz = dx / len
    // 3 sleek translucent speed-lines along dash path
    for (let i = -1; i <= 1; i++) {
      const streak = new THREE.Mesh(g.box, solidMat(i === 0 ? 0xf8fafc : sig.outerHex, i === 0 ? 0.52 : 0.36))
      streak.scale.set(i === 0 ? 3.5 : 2.0, 2.0, len * 0.9)
      streak.position.set(midX + px * i * 11, 22 + Math.abs(i) * 4, midZ + pz * i * 11)
      streak.rotation.y = yaw
      grp.add(streak)
    }
    // 3 fading vertical dash-echo silhouettes along the dash corridor
    for (let i = 1; i <= 3; i++) {
      const t = i / 4
      const echo = new THREE.Mesh(g.cyl, solidMat(sig.outerHex, 0.24 * (1 - t * 0.4)))
      echo.scale.set(11, 11, 34)
      echo.rotation.x = Math.PI / 2
      echo.position.set(b.x1 + dx * t, 20, b.y1 + dz * t)
      grp.add(echo)
    }
    // Subtle wind ring at takeoff point
    const takeoff = new THREE.Mesh(g.torus, solidMat(0xe2e8f0, 0.55))
    takeoff.scale.setScalar(18)
    takeoff.position.set(b.x1, 18, b.y1)
    takeoff.rotation.y = yaw
    grp.add(takeoff)
    return grp
  }

  // === ARCHETYPE A: TRUE BRANCHING & FLICKERING 3D LIGHTNING ===
  if (arch === 'lightning') {
    const isGold = k.includes('zenitsu') || k.includes('honoo')
    const coreHex = isGold ? 0xfef9c3 : 0xe0f2fe
    const outerHex = isGold ? 0xf59e0b : 0x06b6d4

    addJaggedLightningBolt(
      grp,
      new THREE.Vector3(b.x1, 26, b.y1),
      new THREE.Vector3(b.x2, 24, b.y2),
      coreHex,
      outerHex,
      Math.min(6.5, w * 0.09),
      Math.min(26, w * 0.42),
      8,
      len * 0.13,
      g,
      shaderLib,
      true,
    )
    const scorch = new THREE.Mesh(groundPlaneGeo, texMat(textures.groundCrater, 0xffffff, 0.72))
    scorch.scale.setScalar(Math.min(64, w * 0.85))
    scorch.position.set(b.x2, 2.8, b.y2)
    grp.add(scorch)
    return grp
  }

  // === ARCHETYPE B: SCULPTED HELICAL ANIME BEAMS & SPECIAL LINE SKILLS ===
  if (arch === 'beam') {
    // Garp Galaxy Divide: Colossal crimson-black Haki canyon + black-red Conqueror Haki bolts!
    if (k === 'garp_galaxy_divide') {
      const trench = new THREE.Mesh(g.box, solidMat(0x09090b, 0.94))
      trench.scale.set(w * 0.65, 8, len)
      trench.position.set(midX, 8, midZ)
      trench.rotation.y = yaw
      grp.add(trench)
      registerChoreography(grp, { target: trench, kind: 'thrust_lunge' })

      addJaggedLightningBolt(
        grp,
        new THREE.Vector3(b.x1, 28, b.y1),
        new THREE.Vector3(b.x2, 24, b.y2),
        0x18181b,
        0xdc2626,
        7.2,
        28,
        8,
        len * 0.19,
        g,
        shaderLib,
        true,
      )
      const rim = new THREE.Mesh(sculpted.craterRim, solidMat(0x475569, 0.92))
      rim.scale.set(w * 0.95, 28, w * 0.95)
      rim.position.set(b.x2, 2, b.y2)
      grp.add(rim)
      return grp
    }

    // Wukong Great Sage Giant Staff Slam: Enlarged golden-red Ruyi Jingu Bang!
    if (k === 'wukong_great_sage') {
      const staff = new THREE.Mesh(g.cyl, solidMat(0xdc2626, 0.96))
      staff.scale.set(22, 22, len * 0.94)
      staff.position.set(midX, 26, midZ)
      staff.rotation.y = yaw
      grp.add(staff)
      registerChoreography(grp, { target: staff, kind: 'thrust_lunge' })

      for (const end of [0.1, 0.9]) {
        const cap = new THREE.Mesh(g.cyl, solidMat(0xfacc15, 0.98))
        cap.scale.set(28, 28, 36)
        cap.position.set(b.x1 + dx * end, 26, b.y1 + dz * end)
        cap.rotation.y = yaw
        grp.add(cap)
      }
      return grp
    }

    // Buddha Mahapari Nirvana Wave: Giant golden-cyan sculpted enlightenment crescent!
    if (k === 'buddha_nirvana_wave') {
      const mat = trackShader(grp, shaderLib.createMaterial('celSlash', 0xfef9c3, 0x38bdf8, { opacity: 0.95 }), 0.95)
      const wave = new THREE.Mesh(sculpted.curvedSlashRibbon, mat)
      wave.scale.set(175, 95, 175)
      wave.position.set(midX, 26, midZ)
      grp.add(wave)
      registerChoreography(grp, { target: wave, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.9 })
      return grp
    }

    const beamRadius = Math.max(10, w * 0.35)
    const isDark = k.includes('atomic') || k.includes('beelz') || k.includes('krasue')
    const isMagic = k.includes('atomic') || k.includes('beelz')

    const beamPivot = new THREE.Group()
    beamPivot.position.set(midX, 26, midZ)
    beamPivot.rotation.y = yaw
    grp.add(beamPivot)

    const coreCyl = new THREE.Mesh(g.cyl, solidMat(sig.coreHex, 0.95))
    coreCyl.scale.set(beamRadius * 0.5, beamRadius * 0.5, len)
    beamPivot.add(coreCyl)

    const sheathMat = trackShader(
      grp,
      shaderLib.createMaterial('structuredBeam', sig.coreHex, sig.outerHex, {
        opacity: isDark ? 0.88 : 0.76,
        speed: sig.beamSpeed,
        additive: false,
      }),
      isDark ? 0.88 : 0.76,
    )
    const sheath = new THREE.Mesh(g.cyl, sheathMat)
    sheath.scale.set(beamRadius * 1.04, beamRadius * 1.04, len * 0.99)
    beamPivot.add(sheath)

    // Sculpted 3D Dual Helical Spiral rolling cleanly around beam forward Z axis (roll_spin, NOT Y spin!)
    const spiral = new THREE.Mesh(sculpted.helicalBeamSpiral, solidMat(sig.coreHex, 0.82))
    spiral.scale.set(beamRadius * 1.22, beamRadius * 1.22, len * 0.95)
    beamPivot.add(spiral)
    registerChoreography(grp, { target: spiral, kind: 'roll_spin', spinSpeed: 4.5 })

    // Only genuine magic/tech beams get an origin ring; never put wizard wheels on unrelated heroes
    if (isMagic) {
      const originSigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, sig.coreHex, 0.78))
      originSigil.scale.setScalar(beamRadius * 1.65)
      originSigil.rotation.x = Math.PI / 2
      originSigil.position.z = -len * 0.48
      beamPivot.add(originSigil)
      registerChoreography(grp, { target: originSigil, kind: 'roll_spin', spinSpeed: 3.0 })
    } else if (k.includes('unibeam') || k.includes('repulsor')) {
      const arcCore = new THREE.Mesh(g.sphere, solidMat(0xe0f2fe, 0.96))
      arcCore.scale.setScalar(beamRadius * 1.1)
      arcCore.position.z = -len * 0.48
      beamPivot.add(arcCore)
    }
    return grp
  }

  // === ARCHETYPE C1: PHYSICAL PUNCH / PALM / DASH IMPACT (Crisp Speed-Streaks + Shock Rings — ZERO cones!) ===
  if (arch === 'punch_cone') {
    const px = -dz / len
    const pz = dx / len
    const impactW = Math.min(48, Math.max(22, w * 0.5))

    for (let i = -1; i <= 1; i++) {
      const streak = new THREE.Mesh(g.box, solidMat(i === 0 ? sig.coreHex : sig.outerHex, i === 0 ? 0.9 : 0.68))
      streak.scale.set(i === 0 ? 5.5 : 2.6, 2.6, len * (i === 0 ? 0.82 : 0.66))
      streak.position.set(midX + px * i * 15, 25 + Math.abs(i) * 4, midZ + pz * i * 15)
      streak.rotation.y = yaw
      grp.add(streak)
      registerChoreography(grp, { target: streak, kind: 'thrust_lunge' })
    }

    for (const frac of [0.58, 0.88]) {
      const ring = new THREE.Mesh(g.torus, solidMat(frac > 0.7 ? sig.coreHex : sig.outerHex, 0.88))
      ring.scale.setScalar(impactW * (frac > 0.7 ? 1.05 : 0.72))
      ring.position.set(b.x1 + dx * frac, 25, b.y1 + dz * frac)
      ring.rotation.y = yaw
      grp.add(ring)
    }

    if (k.includes('garp')) {
      addJaggedLightningBolt(
        grp,
        new THREE.Vector3(b.x1, 26, b.y1),
        new THREE.Vector3(b.x2, 24, b.y2),
        0x18181b,
        0xdc2626,
        4.4,
        18,
        6,
        len * 0.21,
        g,
        shaderLib,
        true,
      )
    }
    return grp
  }

  // === ARCHETYPE C2: POLEARM / SPEAR / ICE LANCE / CLOUD THRUST ===
  if (arch === 'thrust_weapon') {
    const isIce = k.includes('ice_lance')
    const isWukong = k.includes('golden_staff') || k.includes('cloud_dash')
    const shaft = new THREE.Mesh(g.cyl, solidMat(isWukong ? 0xdc2626 : sig.outerHex, 0.94))
    shaft.scale.set(isIce ? 8 : 7.5, isIce ? 8 : 7.5, len * 0.88)
    shaft.position.set(midX, 25, midZ)
    shaft.rotation.y = yaw
    grp.add(shaft)
    registerChoreography(grp, { target: shaft, kind: 'thrust_lunge' })

    const tip = new THREE.Mesh(isIce ? sculpted.facetedCrystal : g.cone, solidMat(sig.coreHex, 0.96))
    if (isIce) {
      tip.scale.set(22, 46, 22)
      tip.rotation.set(Math.PI / 2, yaw, 0)
    } else {
      tip.scale.set(20, 12, 38)
      tip.rotation.y = yaw
    }
    tip.position.set(b.x2, 25, b.y2)
    grp.add(tip)

    if (isWukong) {
      const cloud = new THREE.Mesh(groundPlaneGeo, texMat(textures.smokePuff, 0xfef08a, 0.78))
      cloud.scale.setScalar(48)
      cloud.position.set(b.x1, 14, b.y1)
      grp.add(cloud)
    }
    return grp
  }

  // === ARCHETYPE C3: SCULPTED 3D CURVED BLADE / CLAW SWEEP ===
  const isVoxel = k.includes('diamond_sword') || k.includes('steve')
  const rad = Math.min(180, Math.max(78, len * 0.7))

  if (isVoxel) {
    const pivot = new THREE.Group()
    pivot.position.set(b.x1, 25, b.y1)
    const mat = texMat(textures.voxelDiamond, 0xffffff, 0.96)
    for (let i = 0; i < 6; i++) {
      const a = -0.8 + (i / 5) * 1.6
      const cube = new THREE.Mesh(g.box, mat)
      cube.scale.set(20, 12, 20)
      cube.position.set(Math.sin(a) * rad, 0, Math.cos(a) * rad)
      cube.rotation.y = a
      pivot.add(cube)
    }
    grp.add(pivot)
    registerChoreography(grp, { target: pivot, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.55 })
    return grp
  }

  if (k.includes('dimension_slash')) {
    const tear = new THREE.Mesh(g.box, solidMat(0x09090b, 0.98))
    tear.scale.set(16, 22, len * 1.02)
    tear.position.set(midX, 26, midZ)
    tear.rotation.y = yaw
    grp.add(tear)
    registerChoreography(grp, { target: tear, kind: 'thrust_lunge' })

    addJaggedLightningBolt(
      grp,
      new THREE.Vector3(b.x1, 28, b.y1),
      new THREE.Vector3(b.x2, 28, b.y2),
      0xd8b4fe,
      0x6b21a8,
      5.2,
      20,
      8,
      len * 0.25,
      g,
      shaderLib,
      true,
    )
    return grp
  }

  // True 3D Sculpted Curved Slash Ribbon sweeping cleanly via celSlash + sweep_arc!
  const slashMat = trackShader(
    grp,
    shaderLib.createMaterial('celSlash', sig.coreHex, sig.outerHex, { opacity: 0.95, speed: sig.beamSpeed }),
    0.95,
  )
  const ribbon = new THREE.Mesh(sculpted.curvedSlashRibbon, slashMat)
  ribbon.scale.set(rad, rad * 0.62, rad)
  ribbon.position.set(b.x1 + dx * 0.14, 25, b.y1 + dz * 0.14)
  grp.add(ribbon)
  registerChoreography(grp, { target: ribbon, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.88 })

  const echo = new THREE.Mesh(sculpted.curvedSlashRibbon, slashMat)
  echo.scale.set(rad * 0.84, rad * 0.48, rad * 0.84)
  echo.position.set(b.x1 + dx * 0.2, 32, b.y1 + dz * 0.2)
  echo.rotation.z = 0.24
  grp.add(echo)
  registerChoreography(grp, { target: echo, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.48 })

  return grp
}
