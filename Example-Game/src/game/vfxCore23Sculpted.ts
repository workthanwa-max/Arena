import * as THREE from 'three'
import type { BeamEffect, ZoneEffect } from '../types/game'
import { registerChoreography } from './vfxAnimator'
import { addJaggedLightningBolt } from './vfxArchetypes'
import type { BasicVfxGeos } from './vfxBasicAttacks'
import type { SculptedVfxGeos } from './vfxGeometries'
import type { HeroVfxSignature } from './vfxHeroSignatures'
import type { VfxShaderLibrary } from './vfxShaders'
import type { VfxTextureAtlas } from './vfxTextures'

/**
 * Core 23 + Igris Sculpted 3D Anime VFX Builders (`vfxCore23Sculpted.ts`, v4).
 * Completely replaces legacy flat cylinder/ring/sphere meshes with true sculpted 3D geometries
 * (`curvedSlashRibbon`, `helicalBeamSpiral`, `vortexFunnel`, `jaggedFlame`, `facetedCrystal`,
 * `craterRim`, `gothicObelisk`), anti-neon GLSL shaders, procedural textures, and 3-stage choreography.
 */

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

function texMat(tex: THREE.Texture, colorHex: number, opacity = 0.9, additive = false): THREE.MeshBasicMaterial {
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
 * Builds a true Sculpted 3D Anime Beam / Sweep / Sky Strike for any Core-23 + Igris skill.
 */
export function buildCore23SculptedBeam(
  b: BeamEffect,
  sig: HeroVfxSignature,
  g: BasicVfxGeos,
  sculpted: SculptedVfxGeos,
  shaderLib: VfxShaderLibrary,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): THREE.Group {
  const grp = new THREE.Group()
  const k = (b.kind ?? '').toLowerCase()
  const dx = b.x2 - b.x1
  const dz = b.y2 - b.y1
  const len = Math.max(20, Math.hypot(dx, dz))
  const yaw = Math.atan2(dx, dz)
  const midX = (b.x1 + b.x2) * 0.5
  const midZ = (b.y1 + b.y2) * 0.5
  const w = Math.max(16, b.width || 56)

  // === 0. INFINITE VOID OPEN FLASH (Clean Dark Cosmic Pillar + Silver Horizon Ring — NOT a cone!) ===
  if (k === 'infinite_void_open') {
    const pillar = new THREE.Mesh(g.cyl, solidMat(0x020308, 0.92))
    pillar.scale.set(42, 42, 240)
    pillar.rotation.x = Math.PI / 2
    pillar.position.set(b.x2, 120, b.y2)
    const ring = new THREE.Mesh(g.torus, solidMat(0xe0f2fe, 0.92))
    ring.scale.setScalar(74)
    ring.rotation.x = Math.PI / 2
    ring.position.set(b.x2, 18, b.y2)
    grp.add(pillar, ring)
    return grp
  }

  // === 1. GILGAMESH SKY SWORD (Overhead Magic Portal + Plunging Golden Blade) ===
  if (k === 'gilga_sky_sword') {
    const portal = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, 0xfacc15, 0.9))
    portal.scale.setScalar(42)
    portal.position.set(b.x2, 185, b.y2)
    grp.add(portal)
    registerChoreography(grp, { target: portal, kind: 'orbit_vortex', spinSpeed: 3.0 })

    const blade = new THREE.Mesh(sculpted.gothicObelisk, solidMat(0xfacc15, 0.96))
    blade.scale.set(14, 72, 14)
    blade.rotation.x = Math.PI // point downward
    blade.position.set(b.x2, 185, b.y2)
    grp.add(blade)
    registerChoreography(grp, { target: blade, kind: 'drop_impact', startY: 185, targetY: 22 })

    const crater = new THREE.Mesh(sculpted.craterRim, solidMat(0xb45309, 0.85))
    crater.scale.set(36, 18, 36)
    crater.position.set(b.x2, 2, b.y2)
    grp.add(crater)
    return grp
  }

  // === 2. VERTICAL SKY LIGHTNING (Killua Narukami / Rimuru Black Lightning) ===
  if (k === 'narukami_strike' || k === 'black_lightning_strike' || k === 'aiouan_timestop_burst') {
    const isBlack = k === 'black_lightning_strike'
    const coreHex = isBlack ? 0x09090b : k === 'aiouan_timestop_burst' ? 0xfef08a : 0xe0f2fe
    const outerHex = isBlack ? 0x9333ea : k === 'aiouan_timestop_burst' ? 0x9333ea : 0x06b6d4

    addJaggedLightningBolt(
      grp,
      new THREE.Vector3(b.x2, 310, b.y2),
      new THREE.Vector3(b.x2, 4, b.y2),
      coreHex,
      outerHex,
      8.5,
      26,
      8,
      b.x2 * 0.13 + b.y2,
      g,
      shaderLib,
      true,
    )
    const rim = new THREE.Mesh(sculpted.craterRim, solidMat(isBlack ? 0x1e1b4b : outerHex, 0.82))
    rim.scale.set(58, 22, 58)
    rim.position.set(b.x2, 2, b.y2)
    grp.add(rim)
    const scorch = new THREE.Mesh(groundPlaneGeo, texMat(textures.groundCrater, 0xffffff, 0.88))
    scorch.scale.setScalar(68)
    scorch.position.set(b.x2, 2.5, b.y2)
    grp.add(scorch)
    return grp
  }

  // === 3. CORRIDOR LIGHTNING & THUNDER FLASH (Zenitsu Hekireki/Rokuren/Murad Star, Killua Leap/Arc) ===
  if (
    k === 'zenitsu_hekireki' ||
    k === 'zenitsu_rokuren' ||
    k === 'zenitsu_murad_slash' ||
    k === 'killua_leap_arc' ||
    k === 'lightning_arc' ||
    k === 'narukami_radial_beam' ||
    k === 'thunder_slam_burst'
  ) {
    const isGold = k.includes('zenitsu')
    const coreHex = isGold ? 0xfef9c3 : 0xe0f2fe
    const outerHex = isGold ? 0xf59e0b : 0x06b6d4
    // Primary jagged forked 3D lightning bolt + secondary electric filament!
    addJaggedLightningBolt(
      grp,
      new THREE.Vector3(b.x1, 26, b.y1),
      new THREE.Vector3(b.x2, 24, b.y2),
      coreHex,
      outerHex,
      6.8,
      24,
      8,
      len * 0.21,
      g,
      shaderLib,
      true,
    )
    addJaggedLightningBolt(
      grp,
      new THREE.Vector3(b.x1, 22, b.y1),
      new THREE.Vector3(b.x2, 26, b.y2),
      outerHex,
      coreHex,
      3.8,
      30,
      7,
      len * 0.43 + 7,
      g,
      shaderLib,
      false,
    )
    // Sharp white-gold katana flash line straight along the lightning strike
    const flashLine = new THREE.Mesh(g.box, solidMat(coreHex, 0.94))
    flashLine.scale.set(3.2, 2.4, len)
    flashLine.position.set(midX, 25, midZ)
    flashLine.rotation.y = yaw
    grp.add(flashLine)
    return grp
  }

  // === 4. SCULPTED 3D HELICAL ENERGY BEAMS (Enuma Elish, Kamehameha, Zoltraak, Way Big, Bijuudama, Mind, Hollow Purple) ===
  if (
    k === 'enuma_elish' ||
    k === 'kamehameha' ||
    k === 'frieren_zoltraak' ||
    k === 'frieren_supreme_beam' ||
    k === 'ben10_cosmic_ray' ||
    k === 'naruto_bijuudama_beam' ||
    k === 'thanos_mind_beam' ||
    k === 'aizen_hogyoku_beam' ||
    k === 'hollow_purple_blast' ||
    k === 'aiouan_lock_beam'
  ) {
    const isEnuma = k === 'enuma_elish'
    const isZoltraak = k === 'frieren_zoltraak' || k === 'frieren_supreme_beam'
    const isPurple = k === 'hollow_purple_blast'
    const isBiju = k === 'naruto_bijuudama_beam'
    const beamR = Math.max(12, w * 0.36)

    const beamPivot = new THREE.Group()
    beamPivot.position.set(midX, 26, midZ)
    beamPivot.rotation.y = yaw
    grp.add(beamPivot)

    if (isEnuma) {
      grp.userData.baseWidth = b.width
      grp.userData.isEnumaElish = true
      grp.userData.enumaPivot = beamPivot
    }

    // Layer 1: Crisp anti-neon inner core cylinder
    const coreCol = isEnuma || isBiju ? 0x18181b : isPurple ? 0xe9d5ff : sig.coreHex
    const core = new THREE.Mesh(g.cyl, solidMat(coreCol, 0.96))
    core.scale.set(beamR * 0.48, beamR * 0.48, len)
    beamPivot.add(core)

    // Layer 2: Structured flowing anime beam sheath
    const outerCol = isEnuma ? 0xdc2626 : isPurple ? 0x7e22ce : isBiju ? 0x991b1b : sig.outerHex
    const sheathMat = trackShader(
      grp,
      shaderLib.createMaterial('structuredBeam', sig.coreHex, outerCol, { opacity: 0.82, speed: sig.beamSpeed }),
      0.82,
    )
    const sheath = new THREE.Mesh(g.cyl, sheathMat)
    sheath.scale.set(beamR * 1.02, beamR * 1.02, len * 0.99)
    beamPivot.add(sheath)

    // Layer 3: Sculpted 3D Dual Helical Energy Spiral rolling cleanly around beam forward Z axis!
    const spiralCol = isEnuma ? 0xfacc15 : isZoltraak ? 0xfef08a : sig.coreHex
    const spiral = new THREE.Mesh(sculpted.helicalBeamSpiral, solidMat(spiralCol, 0.86))
    spiral.scale.set(beamR * 1.2, beamR * 1.2, len * 0.96)
    beamPivot.add(spiral)
    registerChoreography(grp, { target: spiral, kind: 'roll_spin', spinSpeed: isEnuma ? 5.2 : 3.8 })

    // Layer 4: Lore-specific Origin Effects (Magic Circles ONLY for Frieren & Gilgamesh!)
    if (isZoltraak || isEnuma) {
      const ringCount = isZoltraak ? 3 : 2
      for (let i = 0; i < ringCount; i++) {
        const zOff = -len * 0.48 + i * Math.min(70, len * 0.16)
        const sigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, spiralCol, 0.84))
        sigil.scale.setScalar(beamR * (1.8 - i * 0.25))
        sigil.rotation.x = Math.PI / 2
        sigil.position.z = zOff
        beamPivot.add(sigil)
        registerChoreography(grp, { target: sigil, kind: 'roll_spin', spinSpeed: i % 2 === 0 ? 3.2 : -2.6 })
      }
    }

    if (k === 'kamehameha' || isPurple || isBiju || k === 'ben10_cosmic_ray') {
      const muzzle = new THREE.Mesh(g.sphere, solidMat(coreCol, 0.96))
      muzzle.scale.setScalar(beamR * 1.28)
      muzzle.position.z = -len * 0.48
      beamPivot.add(muzzle)
    }

    // Crisp impact ring at beam tip (no generic cloud puff!)
    const tipRing = new THREE.Mesh(g.torus, solidMat(spiralCol, 0.86))
    tipRing.scale.setScalar(beamR * 1.45)
    tipRing.position.z = len * 0.48
    beamPivot.add(tipRing)
    return grp
  }

  // === 5. SCULPTED 3D CURVED SWORD / KICK / KNIFE SWEEPS ===
  if (
    k === 'shishi_sonson' ||
    k === 'igris_fire_slash' ||
    k === 'igris_leap_slash' ||
    k === 'jinwoo_dagger_rush' ||
    k === 'jinwoo_dagger_dash' ||
    k === 'toriko_leg_knife' ||
    k === 'sanji_ifrit_kick' ||
    k === 'sanji_ifrit_rush' ||
    k === 'sanji_sky_kick' ||
    k === 'sanji_skywalk'
  ) {
    const rad = Math.min(165, Math.max(82, len * 0.68))
    const isIfrit = k.includes('ifrit')
    const coreCol = isIfrit ? 0x7dd3fc : sig.coreHex
    const outerCol = isIfrit ? 0x0284c7 : sig.outerHex

    const slashMat = trackShader(
      grp,
      shaderLib.createMaterial('celSlash', coreCol, outerCol, { opacity: 0.94, speed: sig.beamSpeed }),
      0.94,
    )
    const ribbon = new THREE.Mesh(sculpted.curvedSlashRibbon, slashMat)
    ribbon.scale.set(rad, rad * 0.65, rad)
    ribbon.position.set(b.x1 + dx * 0.18, 25, b.y1 + dz * 0.18)
    grp.add(ribbon)
    registerChoreography(grp, { target: ribbon, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: 1.85 })

    // Secondary crossed blade ribbon for dramatic anime depth
    const ribbon2 = new THREE.Mesh(sculpted.curvedSlashRibbon, slashMat)
    ribbon2.scale.set(rad * 0.84, rad * 0.52, rad * 0.84)
    ribbon2.position.set(b.x1 + dx * 0.25, 32, b.y1 + dz * 0.25)
    ribbon2.rotation.z = 0.26
    grp.add(ribbon2)
    registerChoreography(grp, { target: ribbon2, kind: 'sweep_arc', baseYaw: yaw, sweepSpan: -1.45 })

    if (isIfrit) {
      addJaggedLightningBolt(
        grp,
        new THREE.Vector3(b.x1, 24, b.y1),
        new THREE.Vector3(b.x2, 24, b.y2),
        0xe0f2fe,
        0x38bdf8,
        4.2,
        16,
        6,
        len * 0.3,
        g,
        shaderLib,
        false,
      )
    }
    return grp
  }

  // === 6. SIMO WHITE DEATH SNIPE (Crisp Frost Tracer + Sonic Shock Rings + Snow Puff) ===
  if (k === 'simo_snipe_max' || k === 'simo_snipe_off' || k === 'simo_backflip_shot') {
    const tracer = new THREE.Mesh(g.cyl, solidMat(0xf8fafc, 0.96))
    tracer.scale.set(k === 'simo_snipe_max' ? 6.5 : 4.0, k === 'simo_snipe_max' ? 6.5 : 4.0, len)
    tracer.position.set(midX, 26, midZ)
    tracer.rotation.y = yaw
    grp.add(tracer)
    registerChoreography(grp, { target: tracer, kind: 'thrust_lunge' })

    for (const frac of [0.12, 0.45, 0.78]) {
      const sonic = new THREE.Mesh(g.torus, solidMat(0x7dd3fc, 0.82))
      sonic.scale.setScalar(k === 'simo_snipe_max' ? 28 : 18)
      sonic.position.set(b.x1 + dx * frac, 26, b.y1 + dz * frac)
      sonic.rotation.y = yaw
      grp.add(sonic)
    }
    const snow = new THREE.Mesh(groundPlaneGeo, texMat(textures.smokePuff, 0xe0f2fe, 0.78))
    snow.scale.setScalar(38)
    snow.position.set(b.x1, 24, b.y1)
    grp.add(snow)
    return grp
  }

  // === 7. PHYSICAL STRIKES & SPECIALS (Crisp Speed-Streaks + Shock Rings — ZERO ugly traffic cones!) ===
  const px = -dz / len
  const pz = dx / len
  const ringW = Math.min(52, Math.max(24, w * 0.55))

  if (k === 'goku_dragon_rush' || k === 'saitama_serious_punch') {
    const spiral = new THREE.Mesh(
      sculpted.helicalBeamSpiral,
      solidMat(k === 'goku_dragon_rush' ? 0xfacc15 : 0xf97316, 0.92),
    )
    spiral.scale.set(ringW * 0.95, ringW * 0.95, len * 0.88)
    spiral.position.set(midX, 25, midZ)
    spiral.rotation.y = yaw
    grp.add(spiral)
    registerChoreography(grp, { target: spiral, kind: 'roll_spin', spinSpeed: 4.5 })
  }

  for (let i = -1; i <= 1; i++) {
    const streak = new THREE.Mesh(g.box, solidMat(i === 0 ? sig.coreHex : sig.outerHex, i === 0 ? 0.92 : 0.7))
    streak.scale.set(i === 0 ? 6.0 : 2.8, 2.8, len * (i === 0 ? 0.88 : 0.72))
    streak.position.set(midX + px * i * 16, 25 + Math.abs(i) * 4, midZ + pz * i * 16)
    streak.rotation.y = yaw
    grp.add(streak)
    registerChoreography(grp, { target: streak, kind: 'thrust_lunge' })
  }

  for (const frac of [0.42, 0.72, 0.94]) {
    const impactRing = new THREE.Mesh(g.torus, solidMat(frac > 0.8 ? sig.coreHex : sig.outerHex, 0.88))
    impactRing.scale.setScalar(ringW * (0.65 + frac * 0.5))
    impactRing.position.set(b.x1 + dx * frac, 25, b.y1 + dz * frac)
    impactRing.rotation.y = yaw
    grp.add(impactRing)
  }
  return grp
}

/**
 * Builds a true Sculpted 3D Anime AoE Zone / Domain for any Core-23 + Igris skill.
 */
export function buildCore23SculptedZone(
  z: ZoneEffect,
  isWindup: boolean,
  sig: HeroVfxSignature,
  g: BasicVfxGeos,
  sculpted: SculptedVfxGeos,
  shaderLib: VfxShaderLibrary,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): THREE.Group {
  const grp = new THREE.Group()
  const r = Math.max(28, z.radius || 90)
  const k = (z.kind ?? '').toLowerCase()

  // Crisp non-neon windup telegraph
  if (isWindup) {
    const borderMat = trackShader(
      grp,
      shaderLib.createMaterial('celZone', sig.coreHex, sig.outerHex, { opacity: 0.54, speed: 2.0 }),
      0.54,
    )
    const plane = new THREE.Mesh(groundPlaneGeo, borderMat)
    plane.scale.setScalar(r)
    plane.position.y = 2.6
    grp.add(plane)

    const pulseRing = new THREE.Mesh(g.ring, solidMat(sig.outerHex, 0.78))
    pulseRing.scale.setScalar(r)
    pulseRing.position.y = 3.1
    pulseRing.userData.isPulseRing = true
    grp.add(pulseRing)
    return grp
  }

  // Subtle anti-neon perimeter ring
  const baseMat = trackShader(
    grp,
    shaderLib.createMaterial('celZone', sig.coreHex, sig.outerHex, { opacity: 0.44, speed: 1.15 }),
    0.44,
  )
  const ground = new THREE.Mesh(groundPlaneGeo, baseMat)
  ground.scale.setScalar(r)
  ground.position.y = 2.3
  grp.add(ground)

  // === 1. AIZEN KUROHITSUGI: Towering Sculpted Gothic Obelisk Sarcophagus + 4 Piercing Violet Lances ===
  if (k === 'aizen_black_coffin') {
    const voidMat = trackShader(grp, shaderLib.createMaterial('darkVoid', 0xc084fc, 0x4c1d95, { opacity: 0.94 }), 0.94)
    const coffin = new THREE.Mesh(sculpted.gothicObelisk, voidMat)
    coffin.scale.set(r * 0.95, r * 1.55, r * 0.95)
    coffin.position.y = 0
    grp.add(coffin)
    registerChoreography(grp, { target: coffin, kind: 'erupt_rise', startY: -r * 0.8, targetY: 0 })

    const sigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, 0xc084fc, 0.82))
    sigil.scale.setScalar(r * 1.05)
    sigil.position.y = 2.8
    grp.add(sigil)
    registerChoreography(grp, { target: sigil, kind: 'orbit_vortex', spinSpeed: -1.4 })
    return grp
  }

  // === 2. SUKUNA MALEVOLENT SHRINE: Dark Crimson Shrine + 10 Razor-Sharp Crisscrossing Dismantle Cut Lines! ===
  if (k === 'malevolent_shrine') {
    const shrine = new THREE.Mesh(sculpted.gothicObelisk, solidMat(0x7f1d1d, 0.96))
    shrine.scale.set(r * 0.42, r * 0.92, r * 0.42)
    grp.add(shrine)
    registerChoreography(grp, { target: shrine, kind: 'erupt_rise', startY: -r * 0.5, targetY: 0 })

    // 10 razor-sharp straight black-and-crimson Cleave & Dismantle slash lines slicing continuously across the domain!
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + (i % 3) * 0.4
      const ox = Math.cos(a) * r * (0.2 + (i % 3) * 0.24)
      const oz = Math.sin(a) * r * (0.2 + (i % 3) * 0.24)
      const cutLen = r * (0.55 + (i % 3) * 0.22)
      const cutPivot = new THREE.Group()
      cutPivot.position.set(ox, 16 + (i % 4) * 14, oz)
      cutPivot.rotation.set((i % 2 === 0 ? 0.35 : -0.35), a * 1.7, (i % 3 - 1) * 0.45)

      const darkCut = new THREE.Mesh(g.box, solidMat(0x09090b, 0.96))
      darkCut.scale.set(3.2, 2.2, cutLen)
      const redEdge = new THREE.Mesh(g.box, solidMat(0xe11d48, 0.92))
      redEdge.scale.set(7.2, 1.4, cutLen * 1.05)
      const glint = new THREE.Mesh(g.box, solidMat(0xfda4af, 0.95))
      glint.scale.set(1.6, 2.8, cutLen * 0.85)
      cutPivot.add(redEdge, darkCut, glint)
      grp.add(cutPivot)
      registerChoreography(grp, { target: cutPivot, kind: 'lightning_flicker', targetY: cutPivot.position.y, seed: i * 17.3 })
    }
    return grp
  }

  // === 3. GOJO INFINITE VOID (Deep Pitch-Black Space + Black Hole Singularity + White Starlight — NOT Law's cyan dome!) ===
  if (k === 'infinite_void' || k === 'hollow_purple') {
    const isPurple = k === 'hollow_purple'
    if (isPurple) {
      const core = new THREE.Mesh(g.sphere, solidMat(0x18181b, 0.96))
      core.scale.setScalar(r * 0.48)
      core.position.y = r * 0.45
      const shell = new THREE.Mesh(g.sphere, solidMat(0x9333ea, 0.52))
      shell.scale.setScalar(r * 0.72)
      shell.position.y = r * 0.45
      const ring = new THREE.Mesh(g.torus, solidMat(0xe9d5ff, 0.92))
      ring.scale.setScalar(r * 0.85)
      ring.rotation.x = Math.PI / 2
      ring.position.y = r * 0.45
      grp.add(core, shell, ring)
      registerChoreography(grp, { target: ring, kind: 'orbit_vortex', spinSpeed: 3.4 })
      return grp
    }

    // Authentic Jujutsu Kaisen Infinite Void: Pitch-Black Space Floor + Black Hole Gargantua Ring + Cosmic Light Rays!
    const spaceFloor = new THREE.Mesh(g.disc, solidMat(0x02030a, 0.9))
    spaceFloor.scale.setScalar(r * 0.98)
    spaceFloor.position.y = 2.6
    grp.add(spaceFloor)

    // Central Pitch-Black Event Horizon Sphere
    const blackHole = new THREE.Mesh(g.sphere, solidMat(0x000000, 0.99))
    blackHole.scale.setScalar(Math.min(48, r * 0.22))
    blackHole.position.y = 46
    grp.add(blackHole)

    // Razor-bright Tilted White-Silver Accretion Ring (Gargantua)
    const accretion = new THREE.Mesh(g.torus, solidMat(0xf8fafc, 0.94))
    accretion.scale.setScalar(Math.min(82, r * 0.38))
    accretion.rotation.set(Math.PI * 0.42, 0.25, 0)
    accretion.position.y = 46
    grp.add(accretion)
    registerChoreography(grp, { target: accretion, kind: 'orbit_vortex', spinSpeed: 1.5 })

    // 12 Crisp White-Violet Cosmic Starlight Rays radiating across the black void
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const ray = new THREE.Mesh(g.box, solidMat(i % 2 === 0 ? 0xf8fafc : 0xc084fc, 0.72))
      ray.scale.set(2.4, 2.0, r * 0.72)
      ray.position.set(Math.sin(a) * r * 0.56, 8 + (i % 3) * 10, Math.cos(a) * r * 0.56)
      ray.rotation.y = a
      grp.add(ray)
    }
    return grp
  }

  // === 4. ITACHI AMATERASU & TSUKUYOMI ===
  if (k === 'amaterasu' || k === 'tsukuyomi') {
    if (k === 'amaterasu') {
      const flameMat = trackShader(
        grp,
        shaderLib.createMaterial('animeFlame', 0x09090b, 0xe11d48, { opacity: 0.96, speed: 2.2 }),
        0.96,
      )
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2
        const dist = i === 0 ? 0 : r * 0.56
        const flame = new THREE.Mesh(sculpted.jaggedFlame, flameMat)
        const h = r * (i === 0 ? 0.78 : 0.52)
        flame.scale.set(r * 0.28, h, r * 0.28)
        flame.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist)
        grp.add(flame)
        registerChoreography(grp, { target: flame, kind: 'erupt_rise', startY: -h * 0.4, targetY: 0, stagger: i * 0.03 })
      }
      return grp
    }
    // Tsukuyomi: Blood-Red Moon hovering over crimson clockwork fracture
    const moon = new THREE.Mesh(g.sphere, solidMat(0xdc2626, 0.94))
    moon.scale.setScalar(Math.min(46, r * 0.3))
    moon.position.y = Math.min(105, r * 0.68)
    grp.add(moon)
    const crack = new THREE.Mesh(groundPlaneGeo, texMat(textures.clockworkCrack, 0xe11d48, 0.82))
    crack.scale.setScalar(r * 0.98)
    crack.position.y = 2.8
    grp.add(crack)
    registerChoreography(grp, { target: crack, kind: 'orbit_vortex', spinSpeed: -1.1 })
    return grp
  }

  // === 5. RIMURU BEELZEBUTH (True Abyssal Vortex), SANJI FLAMES, NARUTO KURAMA, THANOS SPACE ===
  if (k === 'beelzebuth') {
    const vortexMat = trackShader(
      grp,
      shaderLib.createMaterial('vortexSwirl', 0x09090b, 0x1d4ed8, { opacity: 0.86, speed: 2.6 }),
      0.86,
    )
    const funnel = new THREE.Mesh(sculpted.vortexFunnel, vortexMat)
    funnel.scale.set(r * 0.86, r * 1.05, r * 0.86)
    grp.add(funnel)
    registerChoreography(grp, { target: funnel, kind: 'erupt_rise', startY: -r * 0.4, targetY: 0 })
    registerChoreography(grp, { target: funnel, kind: 'orbit_vortex', spinSpeed: 3.4 })
    return grp
  }

  if (k === 'sanji_diable_fire' || k === 'sanji_ifrit_burst' || k === 'naruto_kurama_aura') {
    const isIfrit = k === 'sanji_ifrit_burst'
    const flameMat = trackShader(
      grp,
      shaderLib.createMaterial('animeFlame', isIfrit ? 0xe0f2fe : 0xfef08a, isIfrit ? 0x0284c7 : 0xf97316, { opacity: 0.94, speed: 2.5 }),
      0.94,
    )
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const fl = new THREE.Mesh(sculpted.jaggedFlame, flameMat)
      const h = r * 0.56
      fl.scale.set(r * 0.25, h, r * 0.25)
      fl.position.set(Math.cos(a) * r * 0.58, 0, Math.sin(a) * r * 0.58)
      grp.add(fl)
      registerChoreography(grp, { target: fl, kind: 'erupt_rise', startY: -h * 0.4, targetY: 0, stagger: i * 0.03 })
    }
    if (isIfrit) {
      for (let i = 0; i < 2; i++) {
        const a = i * Math.PI
        addJaggedLightningBolt(
          grp,
          new THREE.Vector3(Math.cos(a) * r * 0.7, 16, Math.sin(a) * r * 0.7),
          new THREE.Vector3(-Math.cos(a) * r * 0.7, 36, -Math.sin(a) * r * 0.7),
          0xe0f2fe,
          0x38bdf8,
          4.2,
          14,
          6,
          i * 9 + r,
          g,
          shaderLib,
          false,
        )
      }
    }
    return grp
  }

  if (k === 'thanos_space_vortex') {
    const portal = new THREE.Mesh(g.disc, solidMat(0x1d4ed8, 0.58))
    portal.scale.setScalar(r * 0.82)
    portal.position.y = 3
    const ring = new THREE.Mesh(g.ring, solidMat(0x93c5fd, 0.9))
    ring.scale.setScalar(r)
    ring.position.y = 5
    grp.add(portal, ring)
    registerChoreography(grp, { target: ring, kind: 'pulse_ring', spinSpeed: 2.2 })
    return grp
  }

  // === 6. FRIEREN SUPREME CIRCLE & MANA BARRIER: Rotating Arcane Sigil + 6 Sculpted Crystal Pillars ===
  if (k === 'frieren_supreme_circle' || k === 'frieren_mana_barrier' || k === 'gilga_sword_rain' || k === 'enkidu_field') {
    const sigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, sig.coreHex, 0.88))
    sigil.scale.setScalar(r * 1.04)
    sigil.position.y = 2.8
    grp.add(sigil)
    registerChoreography(grp, { target: sigil, kind: 'orbit_vortex', spinSpeed: 1.5 })

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const pillar = new THREE.Mesh(
        k.includes('gilga') ? sculpted.gothicObelisk : sculpted.facetedCrystal,
        solidMat(i % 2 === 0 ? sig.outerHex : sig.coreHex, 0.92),
      )
      const h = r * 0.62
      pillar.scale.set(r * 0.2, h, r * 0.2)
      pillar.position.set(Math.cos(a) * r * 0.72, 0, Math.sin(a) * r * 0.72)
      grp.add(pillar)
      registerChoreography(grp, { target: pillar, kind: 'erupt_rise', startY: -h * 0.5, targetY: 0, stagger: i * 0.04 })
    }
    return grp
  }

  // === 7. JINWOO ARISE / DIABLO END OF WORLD: Sculpted Obsidian Monoliths + Abyssal Mist ===
  if (k === 'jinwoo_arise' || k === 'diablo_end_world' || k === 'diablo_temptation' || k === 'diablo_eclipse_burst') {
    const voidMat = trackShader(grp, shaderLib.createMaterial('darkVoid', sig.coreHex, sig.outerHex, { opacity: 0.92 }), 0.92)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const ob = new THREE.Mesh(sculpted.gothicObelisk, voidMat)
      const h = r * (i === 0 ? 0.85 : 0.58)
      ob.scale.set(r * 0.22, h, r * 0.22)
      ob.position.set(i === 0 ? 0 : Math.cos(a) * r * 0.58, 0, i === 0 ? 0 : Math.sin(a) * r * 0.58)
      grp.add(ob)
      registerChoreography(grp, { target: ob, kind: 'erupt_rise', startY: -h * 0.5, targetY: 0, stagger: i * 0.04 })
    }
    const sigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, sig.coreHex, 0.76))
    sigil.scale.setScalar(r)
    sigil.position.y = 2.8
    grp.add(sigil)
    registerChoreography(grp, { target: sigil, kind: 'orbit_vortex', spinSpeed: -1.6 })
    return grp
  }

  // === 8. ZENITSU DIMENSIONAL STAR (TRUE 5-POINTED GOLDEN THUNDER PENTAGRAM!), KILLUA NARUKAMI, BLACK LIGHTNING ===
  if (k === 'zenitsu_honoo_no_kami') {
    // Compute the 5 vertices of a classic 5-pointed star and slash lightning across 0->2->4->1->3->0!
    const verts: THREE.Vector3[] = []
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
      verts.push(new THREE.Vector3(Math.cos(a) * r * 0.92, 24, Math.sin(a) * r * 0.92))
    }
    const order = [0, 2, 4, 1, 3, 0]
    for (let i = 0; i < 5; i++) {
      const a = verts[order[i]]
      const b = verts[order[i + 1]]
      // Crisp golden lightning-slash chord connecting star vertices
      addJaggedLightningBolt(grp, a, b, 0xfef9c3, 0xf59e0b, 6.0, 12, 6, i * 13 + r, g, shaderLib, false)
      // Sharp katana flash bar along the exact star line
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
      const chord = new THREE.Mesh(g.box, solidMat(0xfef08a, 0.92))
      chord.scale.set(4.2, 3.2, a.distanceTo(b))
      chord.position.copy(mid)
      chord.lookAt(b)
      grp.add(chord)
      // Bright electric vertex node at each star point
      const node = new THREE.Mesh(g.octa, solidMat(0xfef9c3, 0.96))
      node.scale.setScalar(11)
      node.position.copy(verts[i])
      grp.add(node)
    }
    return grp
  }

  if (k === 'narukami_step2' || k === 'killua_solo_ring' || k === 'black_lightning' || k === 'thunder_slam') {
    const isBlack = k === 'black_lightning'
    const cCore = isBlack ? 0x09090b : 0xe0f2fe
    const cOuter = isBlack ? 0x9333ea : 0x06b6d4

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const ox = i === 0 ? 0 : Math.cos(a) * r * 0.45
      const oz = i === 0 ? 0 : Math.sin(a) * r * 0.45
      addJaggedLightningBolt(
        grp,
        new THREE.Vector3(ox, 210, oz),
        new THREE.Vector3(ox, 4, oz),
        cCore,
        cOuter,
        6.2,
        22,
        7,
        i * 11 + r,
        g,
        shaderLib,
        true,
      )
    }
    return grp
  }

  // === 9. SIMO SENTINEL / DIAVOLO TIME ERASE / JOESTAR THE WORLD / THANOS TIME MANDALA ===
  if (
    k === 'simo_sentinel' ||
    k === 'simo_blizzard_burst' ||
    k === 'aiouan_timestop' ||
    k === 'diavolo_time_erase' ||
    k === 'diavolo_fate_decided' ||
    k === 'thanos_time_mandala' ||
    k === 'thanos_infinity_snap'
  ) {
    const isSimo = k.includes('simo')
    const tex = isSimo ? textures.sniperCrosshair : textures.clockworkCrack
    const decal = new THREE.Mesh(groundPlaneGeo, texMat(tex, sig.coreHex, 0.86))
    decal.scale.setScalar(r * 0.98)
    decal.position.y = 3.0
    grp.add(decal)
    registerChoreography(grp, { target: decal, kind: 'orbit_vortex', spinSpeed: isSimo ? 0.7 : -1.5 })

    if (k === 'thanos_infinity_snap') {
      const gemColors = [0x9333ea, 0x2563eb, 0xdc2626, 0xf97316, 0x16a34a, 0xfacc15]
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const gem = new THREE.Mesh(sculpted.facetedCrystal, solidMat(gemColors[i], 0.96))
        gem.scale.set(16, 28, 16)
        gem.position.set(Math.cos(a) * r * 0.55, 22, Math.sin(a) * r * 0.55)
        grp.add(gem)
        registerChoreography(grp, {
          target: gem,
          kind: 'orbit_vortex',
          orbitRadius: r * 0.58,
          orbitAngle: a,
          orbitSpeed: 2.2,
          targetY: 28,
          bobAmp: 8,
        })
      }
    }
    return grp
  }

  // === 10. ZORO SANZEN SEKAI / IGRIS / BEN10 HEAT / FUGA: Swirling 3D Blades or Anime Flames ===
  if (k === 'sanzen_sekai' || k === 'igris_fire_burst' || k === 'igris_slash_impact' || k === 'fuga_explosion' || k === 'fuga_cinder' || k === 'ben10_heat_pool' || k === 'ben10_heat_boom') {
    const isFlame = k.includes('fuga') || k.includes('heat') || k === 'igris_fire_burst'
    if (isFlame) {
      const flameMat = trackShader(grp, shaderLib.createMaterial('animeFlame', 0xfef08a, 0xdc2626, { opacity: 0.94, speed: 2.4 }), 0.94)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const fl = new THREE.Mesh(sculpted.jaggedFlame, flameMat)
        const h = r * (i === 0 ? 0.9 : 0.58)
        fl.scale.set(r * 0.3, h, r * 0.3)
        fl.position.set(i === 0 ? 0 : Math.cos(a) * r * 0.54, 0, i === 0 ? 0 : Math.sin(a) * r * 0.54)
        grp.add(fl)
        registerChoreography(grp, { target: fl, kind: 'erupt_rise', startY: -h * 0.4, targetY: 0, stagger: i * 0.03 })
      }
      return grp
    }
    const slashMat = trackShader(grp, shaderLib.createMaterial('celSlash', sig.coreHex, sig.outerHex, { opacity: 0.94 }), 0.94)
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(sculpted.curvedSlashRibbon, slashMat)
      arc.scale.set(r * (0.78 + i * 0.12), r * 0.4, r * (0.78 + i * 0.12))
      arc.position.y = 18 + i * 12
      grp.add(arc)
      registerChoreography(grp, { target: arc, kind: 'orbit_vortex', spinSpeed: i % 2 === 0 ? 5.0 : -4.2 })
    }
    return grp
  }

  // === 11. PHYSICAL CRATERS & EXPLOSIONS (Luffy Bajrang Gun, Saitama Crater, Naruto Bijuudama, Toriko, Iron Man, Jinwoo Ruler's Hand) ===
  const craterDecal = new THREE.Mesh(groundPlaneGeo, texMat(textures.groundCrater, 0xffffff, 0.9))
  craterDecal.scale.setScalar(r * 1.06)
  craterDecal.position.y = 2.5
  grp.add(craterDecal)

  // Sculpted 3D upturned earth rim erupting around crater!
  const rim = new THREE.Mesh(sculpted.craterRim, solidMat(0x475569, 0.92))
  rim.scale.set(r * 0.92, r * 0.38, r * 0.92)
  grp.add(rim)
  registerChoreography(grp, { target: rim, kind: 'erupt_rise', startY: -22, targetY: 0 })

  // Gear 5 Luffy ONLY gets white Nika clouds; all other physical craters stay clean rocky craters!
  if (k === 'luffy_bajrang_gun' || k === 'luffy_bajrang_smash') {
    const fist = new THREE.Mesh(g.sphere, solidMat(0x18181b, 0.96))
    fist.scale.set(r * 0.46, r * 0.42, r * 0.5)
    fist.position.y = 180
    grp.add(fist)
    registerChoreography(grp, { target: fist, kind: 'drop_impact', startY: 185, targetY: r * 0.32 })

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const puff = new THREE.Mesh(groundPlaneGeo, texMat(textures.smokePuff, 0xf8fafc, 0.74))
      puff.scale.setScalar(r * 0.34)
      puff.position.set(Math.cos(a) * r * 0.68, 12, Math.sin(a) * r * 0.68)
      grp.add(puff)
      registerChoreography(grp, { target: puff, kind: 'erupt_rise', startY: 4, targetY: 20, stagger: i * 0.03 })
    }
  }

  return grp
}
