import * as THREE from 'three'
import type { ZoneEffect } from '../types/game'
import { registerChoreography } from './vfxAnimator'
import { addJaggedLightningBolt } from './vfxArchetypes'
import type { BasicVfxGeos } from './vfxBasicAttacks'
import type { SculptedVfxGeos } from './vfxGeometries'
import type { HeroVfxSignature } from './vfxHeroSignatures'
import type { VfxShaderLibrary } from './vfxShaders'
import type { VfxTextureAtlas } from './vfxTextures'

/**
 * Roster 28 Sculpted 3D Lore AoE Zone Landmarks (`vfxZoneLandmarks.ts`, v4).
 * Matched 1:1 to every newly reworked Roster 28 hero using true sculpted 3D meshes
 * (`facetedCrystal`, `jaggedFlame`, `vortexFunnel`, `craterRim`, `gothicObelisk`, `curvedSlashRibbon`),
 * procedural textures (`VfxTextureAtlas`), and 3-stage choreography (`vfxAnimator`).
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

export function buildHeroZoneLandmark(
  z: ZoneEffect,
  isWindup: boolean,
  sig: HeroVfxSignature,
  g: BasicVfxGeos,
  sculpted: SculptedVfxGeos,
  shaderLib: VfxShaderLibrary,
  textures: VfxTextureAtlas,
  groundPlaneGeo: THREE.PlaneGeometry,
  domeHemiGeo: THREE.SphereGeometry,
): THREE.Group {
  const grp = new THREE.Group()
  const r = Math.max(24, z.radius || 80)
  const k = (z.kind ?? '').toLowerCase()
  const id = sig.id

  // === WINDUP STATE: Crisp tactical non-neon ground telegraph ===
  if (isWindup) {
    const borderMat = trackShader(
      grp,
      shaderLib.createMaterial('celZone', sig.coreHex, sig.outerHex, { opacity: 0.52, speed: 2.0 }),
      0.52,
    )
    const plane = new THREE.Mesh(groundPlaneGeo, borderMat)
    plane.scale.setScalar(r)
    plane.position.y = 2.6
    grp.add(plane)

    const ring = new THREE.Mesh(g.ring, solidMat(sig.outerHex, 0.78))
    ring.scale.setScalar(r)
    ring.position.y = 3.1
    ring.userData.isPulseRing = true
    grp.add(ring)
    return grp
  }

  // === BASE SUBTLE GROUND BOUNDARY ===
  const isSquareVoxel = id === 'steve' || k.includes('steve')
  if (!isSquareVoxel) {
    const baseMat = trackShader(
      grp,
      shaderLib.createMaterial('celZone', sig.coreHex, sig.outerHex, { opacity: 0.44, speed: 1.15 }),
      0.44,
    )
    const ground = new THREE.Mesh(groundPlaneGeo, baseMat)
    ground.scale.setScalar(r)
    ground.position.y = 2.3
    grp.add(ground)
  }

  // === 1. LAW: Ultra-Clean Transparent Cyan Surgical ROOM + Orbiting Levitating Rocks ===
  if (id === 'law' || k.includes('room') || k.includes('shambles') || k.includes('puncture')) {
    const dome = new THREE.Mesh(domeHemiGeo, solidMat(0x0ea5e9, 0.16))
    dome.scale.setScalar(r)
    dome.position.y = 2
    const rim = new THREE.Mesh(g.torus, solidMat(0x7dd3fc, 0.82))
    rim.scale.setScalar(r)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 4
    grp.add(dome, rim)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const rock = new THREE.Mesh(sculpted.facetedCrystal, solidMat(0x475569, 0.92))
      rock.scale.set(10, 16, 10)
      rock.position.set(Math.cos(a) * r * 0.58, 22 + (i % 3) * 14, Math.sin(a) * r * 0.58)
      grp.add(rock)
      registerChoreography(grp, {
        target: rock,
        kind: 'orbit_vortex',
        orbitRadius: r * (0.45 + (i % 2) * 0.2),
        orbitAngle: a,
        orbitSpeed: 1.15,
        targetY: 26 + (i % 3) * 12,
        bobAmp: 9,
        spinSpeed: 2.2,
        seed: i * 1.7,
      })
    }
    return grp
  }

  // === 2. GRAY & KAI: Erupting Sculpted Faceted Ice / Jade Crystal Clusters ===
  if (id === 'gray' || id === 'kai' || k.includes('ice') || k.includes('jade')) {
    const isJade = id === 'kai' || k.includes('jade')
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const cluster = new THREE.Mesh(
        sculpted.facetedCrystal,
        solidMat(isJade ? (i % 2 === 0 ? 0x059669 : 0x34d399) : i % 2 === 0 ? 0x0284c7 : 0xe0f2fe, 0.94),
      )
      const h = r * (0.5 + (i % 2) * 0.22)
      cluster.scale.set(r * 0.24, h, r * 0.24)
      cluster.position.set(Math.cos(a) * r * 0.62, 0, Math.sin(a) * r * 0.62)
      cluster.rotation.y = a
      grp.add(cluster)
      registerChoreography(grp, {
        target: cluster,
        kind: 'erupt_rise',
        startY: -h * 0.5,
        targetY: 0,
        stagger: i * 0.03,
      })
    }
    return grp
  }

  // === 3. ESCANOR & NEZHA: Sculpted Anime Flame Tongues + Sky Sun / Dharma Lotus ===
  if (id === 'escanor' || id === 'nezha' || k.includes('cruel_sun') || k.includes('lotus') || k.includes('nezha')) {
    const flameMat = trackShader(
      grp,
      shaderLib.createMaterial('animeFlame', 0xfef9c3, id === 'escanor' ? 0xf59e0b : 0xea580c, { opacity: 0.94, speed: 2.4 }),
      0.94,
    )
    const count = k === 'nezha_flame_trail' ? 3 : 6
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const fl = new THREE.Mesh(sculpted.jaggedFlame, flameMat)
      const h = r * (i === 0 ? 0.72 : 0.48)
      fl.scale.set(r * 0.28, h, r * 0.28)
      fl.position.set(i === 0 ? 0 : Math.cos(a) * r * 0.52, 0, i === 0 ? 0 : Math.sin(a) * r * 0.52)
      grp.add(fl)
      registerChoreography(grp, { target: fl, kind: 'erupt_rise', startY: -h * 0.4, targetY: 0, stagger: i * 0.03 })
    }
    if (id === 'nezha') {
      const lotus = new THREE.Mesh(groundPlaneGeo, texMat(textures.dharmaLotus, 0xf97316, 0.86))
      lotus.scale.setScalar(r * 0.98)
      lotus.position.y = 3.2
      grp.add(lotus)
      registerChoreography(grp, { target: lotus, kind: 'orbit_vortex', spinSpeed: 2.0 })
    } else if (k === 'escanor_cruel_sun') {
      const sun = new THREE.Mesh(g.sphere, solidMat(0xf59e0b, 0.95))
      sun.scale.setScalar(Math.min(48, r * 0.34))
      sun.position.y = 150
      grp.add(sun)
      registerChoreography(grp, { target: sun, kind: 'drop_impact', startY: 160, targetY: Math.min(62, r * 0.46), spinSpeed: 2.4 })
    }
    return grp
  }

  // === 4. STEVE: Authentic Minecraft Square Grid + Erupting TNT & Obsidian/Diamond Blocks ===
  if (isSquareVoxel) {
    const isWall = k === 'steve_block_builder'
    const frame = new THREE.Mesh(g.box, solidMat(isWall ? 0x312e81 : 0xdc2626, 0.48))
    frame.scale.set(r * 1.72, 2.4, r * 1.72)
    frame.position.y = 2.6
    grp.add(frame)
    const tntMat = texMat(textures.voxelTnt, 0xffffff, 0.98)
    const diaMat = texMat(textures.voxelDiamond, 0xffffff, 0.98)
    const obsMat = solidMat(0x1e1b4b, 0.96)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const cube = new THREE.Mesh(g.box, isWall ? (i % 2 === 0 ? obsMat : diaMat) : i % 2 === 0 ? tntMat : diaMat)
      const sz = Math.min(30, r * 0.26)
      cube.scale.setScalar(sz)
      const tx = i === 0 ? 0 : Math.cos(a) * r * 0.52
      const tz = i === 0 ? 0 : Math.sin(a) * r * 0.52
      cube.position.set(tx, -sz, tz)
      grp.add(cube)
      registerChoreography(grp, { target: cube, kind: 'erupt_rise', startY: -sz, targetY: sz * 0.56 + (i % 2) * 8, stagger: i * 0.04 })
    }
    return grp
  }

  // === 5. DORAEMON: Framed Pink Anywhere Door + Rotating Clockwork Time Cloth ===
  if (id === 'doraemon' || k.includes('doraemon')) {
    const doorPivot = new THREE.Group()
    const door = new THREE.Mesh(g.box, solidMat(0xec4899, 0.96))
    door.scale.set(r * 0.46, r * 0.78, 7)
    const panel = new THREE.Mesh(g.box, solidMat(0xf9a8d4, 0.92))
    panel.scale.set(r * 0.34, r * 0.62, 9)
    const knob = new THREE.Mesh(g.sphere, solidMat(0xfacc15, 0.98))
    knob.scale.setScalar(4.8)
    knob.position.set(r * 0.13, 0, 5.5)
    doorPivot.add(door, panel, knob)
    doorPivot.position.y = -r * 0.4
    grp.add(doorPivot)
    registerChoreography(grp, { target: doorPivot, kind: 'erupt_rise', startY: -r * 0.35, targetY: r * 0.4 })

    const clock = new THREE.Mesh(groundPlaneGeo, texMat(textures.clockworkCrack, 0x38bdf8, 0.8))
    clock.scale.setScalar(r * 0.96)
    clock.position.y = 3.2
    grp.add(clock)
    registerChoreography(grp, { target: clock, kind: 'orbit_vortex', spinSpeed: 1.6 })
    return grp
  }

  // === 6. BUDDHA & PO: Ornate Rotating Dharma Lotus Wheel + Expanding Peach/Gold Shockwave ===
  if (id === 'buddha' || id === 'po' || k.includes('buddha') || k.includes('wuxi') || k.includes('po_')) {
    const wheel = new THREE.Mesh(groundPlaneGeo, texMat(textures.dharmaLotus, 0xfacc15, 0.92))
    wheel.scale.setScalar(r * 0.98)
    wheel.position.y = 3.4
    grp.add(wheel)
    registerChoreography(grp, { target: wheel, kind: 'orbit_vortex', spinSpeed: 1.3 })

    const pulse = new THREE.Mesh(g.ring, solidMat(id === 'po' ? 0xf9a8d4 : 0x38bdf8, 0.84))
    pulse.scale.setScalar(r)
    pulse.position.y = 4.5
    grp.add(pulse)
    registerChoreography(grp, { target: pulse, kind: 'pulse_ring', spinSpeed: 2.1 })
    return grp
  }

  // === 7. GAMBIT: Real Playing Cards Erupting Upright ===
  if (id === 'gambit' || k.includes('gambit')) {
    const cardMat = texMat(textures.playingCard, 0xffffff, 0.98)
    const count = k === 'gambit_trap_card' ? 3 : 5
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const card = new THREE.Mesh(g.box, cardMat)
      card.scale.set(20, 32, 3)
      card.position.set(Math.cos(a) * r * 0.58, -16, Math.sin(a) * r * 0.58)
      card.rotation.set(0.22, -a + Math.PI / 2, 0.14)
      grp.add(card)
      registerChoreography(grp, { target: card, kind: 'erupt_rise', startY: -16, targetY: 20, stagger: i * 0.04 })
    }
    return grp
  }

  // === 8. CID (I AM ATOMIC), YAMI (BLACK MOON), MELIODAS, BEELZEBUB ===
  if (id === 'cid' || id === 'yami' || id === 'meliodas' || id === 'beelzebub') {
    const voidMat = trackShader(grp, shaderLib.createMaterial('darkVoid', sig.coreHex, sig.outerHex, { opacity: 0.9 }), 0.9)
    const sigil = new THREE.Mesh(groundPlaneGeo, texMat(textures.magicSigil, sig.coreHex, 0.84))
    sigil.scale.setScalar(r * 1.02)
    sigil.position.y = 2.8
    grp.add(sigil)
    registerChoreography(grp, { target: sigil, kind: 'orbit_vortex', spinSpeed: 2.0 })

    if (id === 'cid') {
      const spire = new THREE.Mesh(sculpted.gothicObelisk, voidMat)
      spire.scale.set(r * 0.36, r * 1.6, r * 0.36)
      grp.add(spire)
      registerChoreography(grp, { target: spire, kind: 'erupt_rise', startY: -r * 0.6, targetY: 0 })

      const wave = new THREE.Mesh(g.ring, solidMat(0xc084fc, 0.84))
      wave.scale.setScalar(r)
      wave.position.y = 10
      grp.add(wave)
      registerChoreography(grp, { target: wave, kind: 'pulse_ring', spinSpeed: 2.4 })
    } else if (id === 'yami' || id === 'beelzebub') {
      const dome = new THREE.Mesh(domeHemiGeo, voidMat)
      dome.scale.setScalar(r * 0.94)
      dome.position.y = 2
      grp.add(dome)
      const pulse = new THREE.Mesh(g.ring, solidMat(sig.coreHex, 0.85))
      pulse.scale.setScalar(r)
      pulse.position.y = 6
      grp.add(pulse)
      registerChoreography(grp, { target: pulse, kind: 'pulse_ring', spinSpeed: 2.0 })
    } else {
      // Meliodas Hellblaze / Assault Mode: Dark purple twisting anime flames!
      const flameMat = trackShader(grp, shaderLib.createMaterial('animeFlame', 0x09090b, 0x9333ea, { opacity: 0.95, speed: 2.4 }), 0.95)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const fl = new THREE.Mesh(sculpted.jaggedFlame, flameMat)
        const h = r * 0.56
        fl.scale.set(r * 0.26, h, r * 0.26)
        fl.position.set(Math.cos(a) * r * 0.54, 0, Math.sin(a) * r * 0.54)
        grp.add(fl)
        registerChoreography(grp, { target: fl, kind: 'erupt_rise', startY: -h * 0.4, targetY: 0, stagger: i * 0.03 })
      }
    }
    return grp
  }

  // === 9. KRAHANG MONSOON TWISTER (True Tornado ONLY on Krahang!) ===
  if (id === 'krahang') {
    const vortexMat = trackShader(
      grp,
      shaderLib.createMaterial('vortexSwirl', sig.coreHex, sig.outerHex, { opacity: 0.84, speed: 2.5 }),
      0.84,
    )
    const funnel = new THREE.Mesh(sculpted.vortexFunnel, vortexMat)
    funnel.scale.set(r * 0.86, r * 1.1, r * 0.86)
    grp.add(funnel)
    registerChoreography(grp, { target: funnel, kind: 'erupt_rise', startY: -r * 0.4, targetY: 0 })
    registerChoreography(grp, { target: funnel, kind: 'orbit_vortex', spinSpeed: 3.2 })
    return grp
  }

  // === 9b. WUKONG: Golden Somersault Cloud Ring + Colossal Golden Staff Pillar ===
  if (id === 'wukong') {
    const staff = new THREE.Mesh(g.cyl, solidMat(0xdc2626, 0.96))
    staff.scale.set(16, 16, r * 1.2)
    staff.rotation.x = Math.PI / 2
    staff.position.y = r * 0.6
    grp.add(staff)
    registerChoreography(grp, { target: staff, kind: 'drop_impact', startY: 170, targetY: r * 0.55 })

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const cloud = new THREE.Mesh(groundPlaneGeo, texMat(textures.smokePuff, 0xfef08a, 0.78))
      cloud.scale.setScalar(r * 0.4)
      cloud.position.set(Math.cos(a) * r * 0.56, 12, Math.sin(a) * r * 0.56)
      grp.add(cloud)
    }
    return grp
  }

  // === 9c. TANSAN: Rising Translucent Fizzy Soda Bubbles (NO tornado!) ===
  if (id === 'tansan') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const dist = i === 0 ? 0 : r * (0.35 + (i % 3) * 0.2)
      const bubble = new THREE.Mesh(g.sphere, solidMat(i % 2 === 0 ? 0x38bdf8 : 0xe0f2fe, 0.76))
      bubble.scale.setScalar(8 + (i % 4) * 5)
      bubble.position.set(Math.cos(a) * dist, 10, Math.sin(a) * dist)
      grp.add(bubble)
      registerChoreography(grp, { target: bubble, kind: 'erupt_rise', startY: 4, targetY: 24 + (i % 3) * 18, stagger: i * 0.03 })
    }
    return grp
  }

  // === 9d. KRASUE: 5 Floating Eerie Crimson Spirit Lanterns ===
  if (id === 'krasue') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const lantern = new THREE.Mesh(g.sphere, solidMat(i % 2 === 0 ? 0xe11d48 : 0xfb923c, 0.92))
      lantern.scale.setScalar(11)
      lantern.position.set(Math.cos(a) * r * 0.56, 26, Math.sin(a) * r * 0.56)
      grp.add(lantern)
      registerChoreography(grp, { target: lantern, kind: 'orbit_vortex', orbitRadius: r * 0.56, orbitAngle: a, orbitSpeed: 1.4, targetY: 28, bobAmp: 10 })
    }
    return grp
  }

  // === 9e. POP: Eerie Dark-Green Cursed Fangs Erupting Around Perimeter ===
  if (id === 'pop') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const fang = new THREE.Mesh(sculpted.jaggedFlame, solidMat(i % 2 === 0 ? 0x15803d : 0xa3e635, 0.92))
      fang.scale.set(r * 0.18, r * 0.45, r * 0.18)
      fang.position.set(Math.cos(a) * r * 0.62, 0, Math.sin(a) * r * 0.62)
      grp.add(fang)
      registerChoreography(grp, { target: fang, kind: 'erupt_rise', startY: -24, targetY: 0, stagger: i * 0.03 })
    }
    return grp
  }

  // === 10. KING ENGINE HEARTBEAT PULSES ===
  if (id === 'king') {
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(g.ring, solidMat(i === 0 ? 0xfef08a : 0xdc2626, 0.86))
      ring.scale.setScalar(r)
      ring.position.y = 4 + i * 5
      grp.add(ring)
      registerChoreography(grp, { target: ring, kind: 'pulse_ring', spinSpeed: 2.5, stagger: i * 0.33 })
    }
    return grp
  }

  // === 11. SCULPTED 3D PHYSICAL CRATER RIM + DUST + HAKI (Garp, Gon, Adam, Tai Lung, Speed Grandma, CJ) ===
  const crater = new THREE.Mesh(groundPlaneGeo, texMat(textures.groundCrater, 0xffffff, 0.9))
  crater.scale.setScalar(r * 1.05)
  crater.position.y = 2.5
  grp.add(crater)

  const rim = new THREE.Mesh(sculpted.craterRim, solidMat(0x475569, 0.92))
  rim.scale.set(r * 0.9, r * 0.36, r * 0.9)
  grp.add(rim)
  registerChoreography(grp, { target: rim, kind: 'erupt_rise', startY: -22, targetY: 0 })

  if (id === 'garp' || k.includes('galaxy') || k.includes('blue_hole')) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      addJaggedLightningBolt(
        grp,
        new THREE.Vector3(0, 12, 0),
        new THREE.Vector3(Math.cos(a) * r * 0.85, 42, Math.sin(a) * r * 0.85),
        0x18181b,
        0xdc2626,
        5.2,
        16,
        5,
        i * 7 + r,
        g,
        shaderLib,
        false,
      )
    }
  }

  return grp
}
