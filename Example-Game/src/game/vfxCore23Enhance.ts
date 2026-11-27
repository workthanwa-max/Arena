import * as THREE from 'three'
import type { BeamEffect, ZoneEffect } from '../types/game'
import { registerChoreography } from './vfxAnimator'
import type { HeroVfxSignature } from './vfxHeroSignatures'
import type { VfxTextureAtlas } from './vfxTextures'

/**
 * Core 23 + Igris Bespoke Lore Enhancement Layer (v3).
 * Preserves all 125 bespoke Core-23 builders in Vfx3dManager while layering crisp
 * Procedural Canvas2D Textures (`VfxTextureAtlas`) and 3-Stage Choreography (`vfxAnimator`)
 * tailored to each character's anime lore — without double-additive neon blowout.
 */

export const CORE23_BESPOKE_BEAM_KINDS = new Set<string>([
  'aiouan_lock_beam',
  'aiouan_ora_rush',
  'aiouan_timestop_burst',
  'aizen_black_coffin_burst',
  'aizen_hogyoku_beam',
  'basic_lock_reticle',
  'ben10_cosmic_ray',
  'ben10_xlr8_blitz',
  'black_lightning_strike',
  'diavolo_crimson_punch',
  'enuma_elish',
  'frieren_supreme_beam',
  'frieren_zoltraak',
  'gilga_sky_sword',
  'gojo_cast_blue',
  'gojo_cast_red',
  'goku_dragon_rush',
  'hollow_purple_blast',
  'igris_fire_slash',
  'igris_leap_slash',
  'infinite_void_open',
  'jinwoo_dagger_dash',
  'jinwoo_dagger_rush',
  'kamehameha',
  'killua_leap_arc',
  'lightning_arc',
  'luffy_gatling_fist',
  'luffy_pistol',
  'narukami_radial_beam',
  'narukami_strike',
  'naruto_bijuudama_beam',
  'naruto_rasengan',
  'saitama_serious_punch',
  'sanji_ifrit_kick',
  'sanji_ifrit_rush',
  'sanji_sky_kick',
  'sanji_skywalk',
  'shishi_sonson',
  'simo_backflip_shot',
  'simo_snipe_max',
  'simo_snipe_off',
  'thanos_mind_beam',
  'thunder_slam_burst',
  'toriko_leg_knife',
  'toriko_ultimate_fist',
  'zenitsu_hekireki',
  'zenitsu_murad_slash',
  'zenitsu_rokuren',
])

export const CORE23_BESPOKE_ZONE_KINDS = new Set<string>([
  'aegis_core_burst',
  'aegis_core_orb',
  'aiouan_timestop',
  'aizen_black_coffin',
  'aizen_hogyoku_aura',
  'aizen_hogyoku_wave',
  'aizen_hypnosis_mirage',
  'aizen_kyoka_decoy',
  'amaterasu',
  'beelzebuth',
  'ben10_heat_boom',
  'ben10_heat_pool',
  'black_lightning',
  'diablo_eclipse_burst',
  'diablo_end_world',
  'diablo_temptation',
  'diavolo_fate_decided',
  'diavolo_time_erase',
  'enkidu_field',
  'frieren_mana_barrier',
  'frieren_supreme_circle',
  'fuga_cinder',
  'fuga_explosion',
  'gilga_sword_rain',
  'hollow_purple',
  'igris_fire_burst',
  'igris_slash_impact',
  'infinite_void',
  'ironman_missile_boom',
  'ironman_snap_wave',
  'jinwoo_arise',
  'jinwoo_dagger_flurry',
  'jinwoo_rulers_hand',
  'jinwoo_shadow_slash',
  'killua_solo_ring',
  'luffy_bajrang_gun',
  'luffy_bajrang_smash',
  'luffy_gatling',
  'malevolent_shrine',
  'narukami_step2',
  'naruto_bijuudama_boom',
  'naruto_kurama_aura',
  'naruto_rasen_blast',
  'naruto_rasengan_burst',
  'naruto_shuriken_boom',
  'ora_meow_barrage',
  'saitama_crater',
  'sanji_diable_fire',
  'sanji_ifrit_burst',
  'sanzen_sekai',
  'scp_medkit_heal',
  'scp_medkit_orb',
  'simo_blizzard_burst',
  'simo_sentinel',
  'thanos_infinity_snap',
  'thanos_space_vortex',
  'thanos_time_mandala',
  'thunder_slam',
  'toriko_gourmet_surge',
  'toriko_knife_barrage',
  'toriko_ultimate_routine',
  'tsukuyomi',
  'zenitsu_honoo_no_kami',
])

function texMat(tex: THREE.Texture, colorHex: number, opacity: number, additive = false): THREE.MeshBasicMaterial {
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

/**
 * Adds lore-accurate animated texture accents (brush slashes, crackling lightning ribbons,
 * magic origin sigils) onto Core-23 bespoke beam groups.
 */
export function enhanceCore23BeamWithLore(
  grp: THREE.Group,
  b: BeamEffect,
  sig: HeroVfxSignature,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): void {
  const k = (b.kind ?? '').toLowerCase()
  const dx = b.x2 - b.x1
  const dz = b.y2 - b.y1
  const len = Math.max(20, Math.hypot(dx, dz))
  const yaw = Math.atan2(dx, dz)
  const midX = (b.x1 + b.x2) * 0.5
  const midZ = (b.y1 + b.y2) * 0.5

  // 1. Anime Brush-Stroke Sweeping Slash Accent (Zoro, Igris, Jinwoo, Toriko, Sanji)
  if (
    k === 'shishi_sonson' ||
    k === 'igris_fire_slash' ||
    k === 'igris_leap_slash' ||
    k === 'jinwoo_dagger_rush' ||
    k === 'toriko_leg_knife' ||
    k === 'sanji_ifrit_kick' ||
    k === 'sanji_sky_kick' ||
    k === 'zenitsu_murad_slash'
  ) {
    const slashMesh = new THREE.Mesh(groundPlaneGeo, texMat(textures.brushSlash, sig.coreHex, 0.88))
    const rad = Math.min(135, Math.max(68, len * 0.58))
    slashMesh.scale.set(rad, 1, rad)
    slashMesh.position.set(b.x1 + dx * 0.25, 26, b.y1 + dz * 0.25)
    grp.add(slashMesh)
    registerChoreography(grp, {
      target: slashMesh,
      kind: 'sweep_arc',
      baseYaw: yaw,
      sweepSpan: 1.75,
    })
    return
  }

  // 2. Live-Flickering Lightning Ribbon (Killua, Zenitsu, Rimuru Black Lightning)
  if (
    k.includes('lightning') ||
    k.includes('narukami') ||
    k.includes('killua') ||
    k.includes('zenitsu_hekireki') ||
    k.includes('zenitsu_rokuren') ||
    k.includes('thunder')
  ) {
    const isBlack = k.includes('black_lightning')
    const boltColor = isBlack ? 0x7e22ce : k.includes('zenitsu') ? 0xfacc15 : 0x38bdf8
    const ribbon = new THREE.Mesh(groundPlaneGeo, texMat(textures.lightningBolt, boltColor, 0.82, !isBlack))
    ribbon.scale.set(Math.min(44, Math.max(18, b.width * 0.55)), 1, len * 0.5)
    ribbon.position.set(midX, 27, midZ)
    ribbon.rotation.y = yaw
    grp.add(ribbon)
    registerChoreography(grp, {
      target: ribbon,
      kind: 'lightning_flicker',
      seed: len * 0.19,
    })
    return
  }

  // 3. Arcane Origin Magic Sigil at Muzzle (Frieren Zoltraak / Supreme Beam / Gilgamesh)
  if (k === 'frieren_zoltraak' || k === 'frieren_supreme_beam' || k === 'enuma_elish' || k === 'aizen_hogyoku_beam') {
    const sigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, sig.coreHex, 0.78))
    const s = Math.min(54, Math.max(24, b.width * 0.6))
    sigil.scale.set(s, 1, s)
    sigil.position.set(b.x1, 26, b.y1)
    sigil.rotation.set(Math.PI / 2, yaw, 0)
    grp.add(sigil)
    registerChoreography(grp, {
      target: sigil,
      kind: 'orbit_vortex',
      spinSpeed: 3.4,
    })
  }
}

/**
 * Adds lore-accurate ground decals (fractured craters, arcane magic sigils, clockwork glass,
 * sniper reticles, anime smoke clouds, vertical lightning) onto Core-23 bespoke zone groups.
 */
export function enhanceCore23ZoneWithLore(
  grp: THREE.Group,
  z: ZoneEffect,
  isWindup: boolean,
  sig: HeroVfxSignature,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
): void {
  if (isWindup) return
  const k = (z.kind ?? '').toLowerCase()
  const r = Math.max(28, z.radius || 80)

  // 1. Fractured Ground Crater + Rising Dust Clouds (Saitama, Luffy Bajrang, Toriko, Naruto Bijuudama, Jinwoo Ruler's Hand)
  if (
    k === 'saitama_crater' ||
    k === 'luffy_bajrang_gun' ||
    k === 'luffy_bajrang_smash' ||
    k === 'toriko_ultimate_routine' ||
    k === 'naruto_bijuudama_boom' ||
    k === 'jinwoo_rulers_hand' ||
    k === 'fuga_explosion' ||
    k === 'ironman_missile_boom'
  ) {
    const crater = new THREE.Mesh(groundPlaneGeo, texMat(textures.groundCrater, 0xffffff, 0.88))
    crater.scale.setScalar(r * 1.05)
    crater.position.y = 2.4
    grp.add(crater)

    // 4 anime cel-shaded dust/cloud puffs billowing outward around crater rim
    const puffCol = k.includes('luffy') ? 0xf8fafc : k.includes('fuga') ? 0xfdba74 : 0xcbd5e1
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      const puff = new THREE.Mesh(groundPlaneGeo, texMat(textures.smokePuff, puffCol, 0.62))
      puff.scale.setScalar(r * 0.34)
      puff.position.set(Math.cos(a) * r * 0.62, 10 + i * 3, Math.sin(a) * r * 0.62)
      grp.add(puff)
      registerChoreography(grp, {
        target: puff,
        kind: 'erupt_rise',
        startY: 3,
        targetY: 16 + i * 3,
        stagger: i * 0.04,
      })
    }
    return
  }

  // 2. Intricate Rotating Magic Circle (Frieren, Gilgamesh, Aizen, Diablo)
  if (
    k === 'frieren_supreme_circle' ||
    k === 'frieren_mana_barrier' ||
    k === 'gilga_sword_rain' ||
    k === 'enkidu_field' ||
    k === 'aizen_black_coffin' ||
    k === 'diablo_temptation' ||
    k === 'diablo_end_world'
  ) {
    const sigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, sig.coreHex, 0.72))
    sigil.scale.setScalar(r * 1.02)
    sigil.position.y = 2.6
    grp.add(sigil)
    registerChoreography(grp, {
      target: sigil,
      kind: 'orbit_vortex',
      spinSpeed: k === 'aizen_black_coffin' ? -1.1 : 1.4,
    })
    return
  }

  // 3. Shattered Time Glass & Clockwork (Joestar The World, Diavolo Time Erase / Fate Decided, Thanos Time Mandala)
  if (
    k === 'aiouan_timestop' ||
    k === 'diavolo_time_erase' ||
    k === 'diavolo_fate_decided' ||
    k === 'thanos_time_mandala'
  ) {
    const clockCol = k.includes('diavolo') ? 0xf43f5e : k.includes('thanos') ? 0x4ade80 : 0xfacc15
    const clock = new THREE.Mesh(groundPlaneGeo, texMat(textures.clockworkCrack, clockCol, 0.76))
    clock.scale.setScalar(r * 0.98)
    clock.position.y = 2.8
    grp.add(clock)
    registerChoreography(grp, {
      target: clock,
      kind: 'orbit_vortex',
      spinSpeed: k.includes('diavolo') ? -1.8 : 0.9,
    })
    return
  }

  // 4. Precision Military Sniper Reticle (Simo Häyhä)
  if (k === 'simo_sentinel' || k === 'simo_blizzard_burst') {
    const reticle = new THREE.Mesh(groundPlaneGeo, texMat(textures.sniperCrosshair, 0xe0f2fe, 0.78))
    reticle.scale.setScalar(r * 0.96)
    reticle.position.y = 3.0
    grp.add(reticle)
    registerChoreography(grp, {
      target: reticle,
      kind: 'orbit_vortex',
      spinSpeed: 0.65,
    })
    return
  }

  // 5. Vertical Flickering Sky Lightning Ribbon (Killua Narukami, Rimuru Black Lightning, Zenitsu)
  if (
    k === 'narukami_step2' ||
    k === 'killua_solo_ring' ||
    k === 'black_lightning' ||
    k === 'thunder_slam'
  ) {
    const isBlack = k === 'black_lightning'
    const col = isBlack ? 0x9333ea : 0x38bdf8
    const bolt = new THREE.Mesh(groundPlaneGeo, texMat(textures.lightningBolt, col, 0.85, !isBlack))
    bolt.scale.set(r * 0.45, 1, 95)
    bolt.rotation.x = Math.PI / 2
    bolt.position.y = 85
    grp.add(bolt)
    registerChoreography(grp, {
      target: bolt,
      kind: 'lightning_flicker',
      seed: r * 0.31,
    })
    return
  }

  // 6. Black Smoke Mist for Amaterasu / Jinwoo Shadow Monarch
  if (k === 'amaterasu' || k === 'jinwoo_arise' || k === 'beelzebuth') {
    const mistCol = k === 'amaterasu' ? 0x18181b : k === 'jinwoo_arise' ? 0x3b0764 : 0x1e3a8a
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const puff = new THREE.Mesh(groundPlaneGeo, texMat(textures.smokePuff, mistCol, 0.76))
      puff.scale.setScalar(r * 0.42)
      puff.position.set(Math.cos(a) * r * 0.48, 8, Math.sin(a) * r * 0.48)
      grp.add(puff)
      registerChoreography(grp, {
        target: puff,
        kind: 'orbit_vortex',
        orbitRadius: r * 0.48,
        orbitAngle: a,
        orbitSpeed: k === 'beelzebuth' ? 2.4 : 0.9,
        targetY: 14,
        bobAmp: 6,
      })
    }
  }
}
