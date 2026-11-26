import * as THREE from 'three'
import { makeBasicMat, makeMat, type Hero3dGeoPool, type HeroFlashMat } from './hero3dGeoPool'
import type { Hero3dProfile } from './hero3dProfiles'

export function buildHeroHairAndHead3D(
  cid: string,
  profile: Hero3dProfile,
  gp: Hero3dGeoPool,
  mats: THREE.Material[],
  flashMaterials: HeroFlashMat[],
  bodyPivot: THREE.Group,
  headY: number,
  options?: { isKuramaOrBig?: boolean },
): THREE.Group {
  const headGroup = new THREE.Group()
  headGroup.position.set(0, headY, 0)
  bodyPivot.add(headGroup)

  const isTitan = profile.bodyType === 'titan_muscular'
  const isMascot = profile.bodyType === 'spherical_mascot'
  const isVoxel = profile.hairStyle === 'voxel_cube'
  const skinMat = makeMat(mats, flashMaterials, profile.skinHex, { roughness: 0.36 })

  // 1. Cranium & Jaw Foundation (Distinct per physique archetype)
  if (isVoxel) {
    const cubeHead = new THREE.Mesh(gp.box, skinMat)
    cubeHead.scale.set(17.5, 17.5, 17.5)
    cubeHead.position.set(0, 1.5, 0)
    headGroup.add(cubeHead)
  } else if (isMascot) {
    const bigBall = new THREE.Mesh(gp.head, skinMat)
    bigBall.scale.set(1.24, 1.15, 1.18)
    headGroup.add(bigBall)
  } else {
    const head = new THREE.Mesh(gp.head, skinMat)
    head.scale.set(isTitan ? 1.12 : 0.98, isTitan ? 1.08 : 0.98, isTitan ? 1.1 : 0.98)
    const chin = new THREE.Mesh(gp.chin, skinMat)
    chin.scale.set(isTitan ? 1.12 : 0.94, 0.9, 0.92)
    chin.position.set(0, -6.5, 2.0)
    headGroup.add(head, chin)
  }

  // Helper: Multi-layer expressive anime eyes
  const addAnimeEyes = (
    irisHex: number,
    browHex: number,
    opts?: { angry?: number; eyeZ?: number; skipLeft?: boolean; deadpan?: boolean; scale?: number },
  ) => {
    const whiteMat = makeBasicMat(mats, 0xf8fafc)
    const irisMat = makeBasicMat(mats, irisHex)
    const glintMat = makeBasicMat(mats, 0xffffff)
    const browMat = makeBasicMat(mats, browHex)
    const z = opts?.eyeZ ?? 9.6
    const sc = opts?.scale ?? 1.0
    const angry = opts?.angry ?? 0.16
    for (const side of [-1, 1] as const) {
      if (opts?.skipLeft && side === -1) continue
      const ex = side * 3.8 * sc
      if (opts?.deadpan) {
        const dot = new THREE.Mesh(gp.eyeDot, irisMat)
        dot.scale.set(0.65, 0.65, 0.5)
        dot.position.set(ex, 0.8, z + 0.5)
        const brow = new THREE.Mesh(gp.brow, browMat)
        brow.scale.set(0.8, 0.7, 0.8)
        brow.position.set(ex, 3.3, z + 0.5)
        headGroup.add(dot, brow)
      } else {
        const sclera = new THREE.Mesh(gp.eyeWhite, whiteMat)
        sclera.scale.set(1.12 * sc, 0.9 * sc, 0.55)
        sclera.position.set(ex, 0.8, z)
        const iris = new THREE.Mesh(gp.eyeDot, irisMat)
        iris.scale.set(sc, 1.05 * sc, 0.65)
        iris.position.set(ex, 0.8, z + 0.7)
        const glint = new THREE.Mesh(gp.eyeGlint, glintMat)
        glint.position.set(ex + side * 0.55 * sc, 1.45, z + 1.4)
        const brow = new THREE.Mesh(gp.brow, browMat)
        brow.position.set(ex, 3.6, z + 0.5)
        brow.rotation.z = -side * angry
        headGroup.add(sclera, iris, glint, brow)
      }
    }
  }

  const hMat = makeMat(mats, flashMaterials, profile.hairHex, { roughness: 0.34 })
  const tipMat = profile.tipAccentHex ? makeMat(mats, flashMaterials, profile.tipAccentHex, { roughness: 0.3 }) : hMat
  const browHex = profile.hairHex === 0xf8fafc ? 0x475569 : profile.hairHex

  // 2. Archetype Branching
  const style = profile.hairStyle

  if (style === 'voxel_cube') {
    // Steve: pixel hair slab + blocky blue eyes + brown beard + diamond helmet rim
    const hairTop = new THREE.Mesh(gp.box, hMat)
    hairTop.scale.set(18.2, 5.2, 18.2)
    hairTop.position.set(0, 8.2, 0)
    const hairBack = new THREE.Mesh(gp.box, hMat)
    hairBack.scale.set(18.2, 11.5, 4.2)
    hairBack.position.set(0, 2.5, -7.2)
    const beard = new THREE.Mesh(gp.box, hMat)
    beard.scale.set(8.5, 4.2, 1.2)
    beard.position.set(0, -4.4, 8.6)
    const whiteMat = makeBasicMat(mats, 0xf8fafc)
    const irisMat = makeBasicMat(mats, profile.eyeHex)
    for (const sx of [-4.2, 4.2]) {
      const ew = new THREE.Mesh(gp.box, whiteMat)
      ew.scale.set(3.4, 2.2, 0.8)
      ew.position.set(sx, 1.2, 8.6)
      const ep = new THREE.Mesh(gp.box, irisMat)
      ep.scale.set(1.8, 2.2, 1.0)
      ep.position.set(sx + (sx < 0 ? 0.6 : -0.6), 1.2, 8.8)
      headGroup.add(ew, ep)
    }
    const helmMat = makeMat(mats, flashMaterials, 0x06b6d4, { metalness: 0.45, roughness: 0.2 })
    const helmRim = new THREE.Mesh(gp.box, helmMat)
    helmRim.scale.set(19.2, 4.6, 19.2)
    helmRim.position.set(0, 9.2, 0)
    const noseGuard = new THREE.Mesh(gp.box, helmMat)
    noseGuard.scale.set(3.4, 4.2, 1.8)
    noseGuard.position.set(0, 5.2, 9.1)
    headGroup.add(hairTop, hairBack, beard, helmRim, noseGuard)
    return headGroup
  }

  if (style === 'animal_head') {
    if (cid === 'doraemon') {
      const whiteMat = makeMat(mats, flashMaterials, 0xf8fafc, { roughness: 0.32 })
      const faceMask = new THREE.Mesh(gp.head, whiteMat)
      faceMask.scale.set(1.06, 0.88, 0.68)
      faceMask.position.set(0, -1.6, 5.4)
      headGroup.add(faceMask)
      for (const sx of [-3.2, 3.2]) {
        const bigEye = new THREE.Mesh(gp.eyeWhite, makeBasicMat(mats, 0xffffff))
        bigEye.scale.set(1.45, 1.75, 0.65)
        bigEye.position.set(sx, 3.4, 11.2)
        const pupil = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0x09090b))
        pupil.scale.set(0.62, 0.78, 0.55)
        pupil.position.set(sx * 0.8, 3.4, 12.2)
        headGroup.add(bigEye, pupil)
      }
      const nose = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xdc2626))
      nose.scale.setScalar(0.68)
      nose.position.set(0, 0.6, 12.6)
      const whiskerMat = makeBasicMat(mats, 0x09090b)
      for (const sx of [-1, 1] as const) {
        for (let w = -1; w <= 1; w++) {
          const wh = new THREE.Mesh(gp.box, whiskerMat)
          wh.scale.set(6.5, 0.45, 0.45)
          wh.position.set(sx * 7.8, -1.6 + w * 1.8, 10.2)
          wh.rotation.z = sx * w * 0.16
          headGroup.add(wh)
        }
      }
      headGroup.add(nose)
      return headGroup
    }

    if (cid === 'po') {
      const blackMat = makeMat(mats, flashMaterials, 0x111827, { roughness: 0.4 })
      for (const sx of [-8.8, 8.8]) {
        const ear = new THREE.Mesh(gp.orb, blackMat)
        ear.scale.setScalar(1.25)
        ear.position.set(sx, 11.2, -0.5)
        const patch = new THREE.Mesh(gp.orb, blackMat)
        patch.scale.set(1.15, 0.92, 0.45)
        patch.position.set(sx * 0.45, 1.4, 11.0)
        patch.rotation.z = sx < 0 ? 0.3 : -0.3
        headGroup.add(ear, patch)
      }
      const bearNose = new THREE.Mesh(gp.orb, blackMat)
      bearNose.scale.set(0.85, 0.58, 0.65)
      bearNose.position.set(0, -1.4, 12.5)
      headGroup.add(bearNose)
      addAnimeEyes(0x22c55e, 0x111827, { eyeZ: 11.4, angry: 0.12 })
      return headGroup
    }

    if (cid === 'tai_lung') {
      const snout = new THREE.Mesh(gp.orb, makeMat(mats, flashMaterials, 0xe5e7eb))
      snout.scale.set(1.6, 1.1, 1.4)
      snout.position.set(0, -2.5, 9.5)
      const nose = new THREE.Mesh(gp.orb, makeMat(mats, flashMaterials, 0xec4899))
      nose.scale.set(0.65, 0.45, 0.5)
      nose.position.set(0, -1.2, 13.5)
      const spotMat = makeMat(mats, flashMaterials, 0x374151)
      for (const sx of [-6.5, 6.5]) {
        const ear = new THREE.Mesh(gp.thinCone, makeMat(mats, flashMaterials, 0x9ca3af))
        ear.scale.set(1.15, 0.62, 0.95)
        ear.position.set(sx, 11.5, -1)
        ear.rotation.z = sx < 0 ? 0.35 : -0.35
        const cheekSpot = new THREE.Mesh(gp.orb, spotMat)
        cheekSpot.scale.set(0.75, 0.55, 0.4)
        cheekSpot.position.set(sx * 1.1, -1.2, 7.6)
        headGroup.add(ear, cheekSpot)
      }
      headGroup.add(snout, nose)
      addAnimeEyes(0xfacc15, 0x1f2937, { angry: 0.32, eyeZ: 9.8 })
      return headGroup
    }

    if (cid === 'kai') {
      const hornMat = makeMat(mats, flashMaterials, 0x1e293b, { roughness: 0.28, metalness: 0.35 })
      const muzzle = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, 0x6b7280))
      muzzle.scale.set(9.5, 6.2, 7.5)
      muzzle.position.set(0, -3.5, 9.2)
      for (const sx of [-1, 1] as const) {
        const horn = new THREE.Mesh(gp.thickHorn, hornMat)
        horn.scale.set(1.45, 1.45, 1.35)
        horn.position.set(sx * 11.5, 7.2, 0)
        horn.rotation.set(0.3, sx * 0.45, sx * 2.15)
        headGroup.add(horn)
      }
      const goatee = new THREE.Mesh(gp.thinCone, makeMat(mats, flashMaterials, 0x111827))
      goatee.scale.set(0.75, 0.65, 0.75)
      goatee.position.set(0, -10.5, 9.8)
      goatee.rotation.x = Math.PI
      headGroup.add(muzzle, goatee)
      addAnimeEyes(0x10b981, 0x09090b, { angry: 0.34, eyeZ: 10.6 })
      return headGroup
    }

    // Wukong: monkey ears, golden wild mane, headband & towering twin red-gold pheasant plumes
    const maneMat = hMat
    const goldMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85, roughness: 0.18 })
    const featherMat = makeMat(mats, flashMaterials, 0xdc2626, { emissive: 0x991b1b, emissiveIntensity: 0.35 })
    const crownBase = new THREE.Mesh(gp.hairCrown, maneMat)
    crownBase.position.set(0, 1.2, -0.4)
    const headband = new THREE.Mesh(gp.ringThin, goldMat)
    headband.rotation.x = Math.PI * 0.5
    headband.scale.set(1.12, 1.12, 1.35)
    headband.position.set(0, 4.6, 0)
    headGroup.add(crownBase, headband)
    for (const sx of [-1, 1] as const) {
      const mEar = new THREE.Mesh(gp.thinCone, skinMat)
      mEar.scale.set(0.85, 0.48, 0.55)
      mEar.position.set(sx * 10.8, 0.8, 0.4)
      mEar.rotation.z = -sx * 1.18
      const tuft = new THREE.Mesh(gp.hairSpike, maneMat)
      tuft.scale.set(0.78, 0.85, 0.78)
      tuft.position.set(sx * 8.2, 6.2, -2.5)
      tuft.rotation.set(-0.35, 0, -sx * 0.65)
      const plumeA = new THREE.Mesh(gp.thinCone, featherMat)
      plumeA.scale.set(0.55, 2.25, 0.45)
      plumeA.position.set(sx * 6.5, 22, -7.5)
      plumeA.rotation.set(-0.78, 0, -sx * 0.38)
      headGroup.add(mEar, tuft, plumeA)
    }
    addAnimeEyes(profile.eyeHex, 0x92400e, { angry: 0.25 })
    return headGroup
  }

  if (style === 'none_bald') {
    if (cid === 'iron_man') {
      const redMat = makeMat(mats, flashMaterials, 0xdc2626, { metalness: 0.84, roughness: 0.16 })
      const goldMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.88, roughness: 0.18 })
      const helmDome = new THREE.Mesh(gp.head, redMat)
      helmDome.scale.set(1.06, 1.05, 1.05)
      const faceMask = new THREE.Mesh(gp.visor, goldMat)
      faceMask.scale.set(0.88, 2.75, 0.92)
      faceMask.position.set(0, -0.4, 8.8)
      const jawGold = new THREE.Mesh(gp.chin, goldMat)
      jawGold.scale.set(0.92, 0.95, 0.95)
      jawGold.position.set(0, -6.5, 2.2)
      const eyeGlowMat = makeBasicMat(mats, 0x38bdf8, { additive: true })
      for (const sx of [-3.6, 3.6]) {
        const slit = new THREE.Mesh(gp.box, eyeGlowMat)
        slit.scale.set(3.4, 1.05, 1.0)
        slit.position.set(sx, 1.5, 10.5)
        slit.rotation.z = sx < 0 ? -0.14 : 0.14
        headGroup.add(slit)
      }
      headGroup.add(helmDome, faceMask, jawGold)
      return headGroup
    }

    if (cid === 'igris') {
      const helm = new THREE.Mesh(
        gp.hairCrown,
        makeMat(mats, flashMaterials, 0x1e1b4b, { emissive: 0x4c1d95, emissiveIntensity: 0.55, metalness: 0.88, roughness: 0.18 }),
      )
      helm.scale.set(1.14, 1.24, 1.16)
      helm.position.set(0, 1.4, -0.3)
      const facePlate = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0x09090b, { metalness: 0.9, roughness: 0.15 }))
      facePlate.scale.set(1.06, 1.5, 1.08)
      facePlate.position.set(0, -1.2, 8.9)
      const hornCrest = new THREE.Mesh(gp.hairSpike, makeMat(mats, flashMaterials, 0x312e81, { emissive: 0x7c3aed, emissiveIntensity: 0.65 }))
      hornCrest.scale.set(0.85, 1.45, 0.85)
      hornCrest.position.set(0, 13.5, 4.5)
      hornCrest.rotation.x = 0.25
      headGroup.add(helm, facePlate, hornCrest)
      for (const ex of [-4.2, 4.2]) {
        const vEye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xe9d5ff, { additive: true }))
        vEye.scale.set(1.35, 0.75, 1.0)
        vEye.position.set(ex, 1.5, 11.2)
        headGroup.add(vEye)
      }
      const plumeMat = makeMat(mats, flashMaterials, 0xdc2626, { emissive: 0xef4444, emissiveIntensity: 0.75, roughness: 0.25 })
      for (const [py, pz, rx, sc] of [
        [14.5, -2.5, -0.55, 1.35],
        [17.5, -8.5, -0.95, 1.45],
        [15.2, -14.5, -1.28, 1.35],
      ] as const) {
        const plume = new THREE.Mesh(gp.hairSpike, plumeMat)
        plume.scale.set(0.95, sc, 1.15)
        plume.position.set(0, py, pz)
        plume.rotation.x = rx
        headGroup.add(plume)
      }
      return headGroup
    }

    if (cid === 'simo') {
      const hoodMat = makeMat(mats, flashMaterials, 0xf8fafc, { roughness: 0.36 })
      const hood = new THREE.Mesh(gp.hairCrown, hoodMat)
      hood.scale.set(1.16, 1.24, 1.18)
      hood.position.set(0, 1.4, -0.6)
      const hoodSideL = new THREE.Mesh(gp.slab, hoodMat)
      hoodSideL.scale.set(0.45, 1.1, 2.2)
      hoodSideL.position.set(-10.2, -3.5, 1.2)
      const hoodSideR = new THREE.Mesh(gp.slab, hoodMat)
      hoodSideR.scale.set(0.45, 1.1, 2.2)
      hoodSideR.position.set(10.2, -3.5, 1.2)
      const mask = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0xf1f5f9, { roughness: 0.3 }))
      mask.scale.set(1.06, 1.45, 1.06)
      mask.position.set(0, -2.8, 8.9)
      headGroup.add(hood, hoodSideL, hoodSideR, mask)
      addAnimeEyes(0x38bdf8, 0x334155, { angry: 0.24 })
      return headGroup
    }

    if (cid === 'noone') {
      const goldMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.86, roughness: 0.18 })
      const helmBand = new THREE.Mesh(gp.helmetBand, goldMat)
      helmBand.scale.set(1.16, 1.32, 1.16)
      helmBand.position.set(0, 5.2, 0)
      const helmCrest = new THREE.Mesh(gp.box, goldMat)
      helmCrest.scale.set(3.2, 8.5, 11)
      helmCrest.position.set(0, 8.5, 2)
      // Ribbed Thanos chin grooves
      const grooveMat = makeMat(mats, flashMaterials, 0x6b21a8)
      for (const gx of [-2.2, 0, 2.2]) {
        const gr = new THREE.Mesh(gp.box, grooveMat)
        gr.scale.set(0.75, 4.2, 1.4)
        gr.position.set(gx, -6.2, 8.2)
        headGroup.add(gr)
      }
      headGroup.add(helmBand, helmCrest)
      addAnimeEyes(0xfef08a, 0x581c87, { angry: 0.24, eyeZ: 10.6 })
      return headGroup
    }

    // Luangphi Sorn / Saitama: deadpan shiny dome head with specular dot!
    addAnimeEyes(0x09090b, 0x09090b, { deadpan: true })
    const sheen = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xffffff))
    sheen.scale.set(0.45, 0.25, 0.25)
    sheen.position.set(-3.2, 8.6, 5.8)
    headGroup.add(sheen)
    return headGroup
  }

  // Common semi-spherical skull cap under hair for all haired anime styles
  const addSkullCap = (scaleY = 1.0, zOff = -0.5) => {
    const crown = new THREE.Mesh(gp.hairCrown, hMat)
    crown.scale.set(1.02, scaleY, 1.04)
    crown.position.set(0, 1.3, zOff)
    headGroup.add(crown)
  }

  if (style === 'tall_pillar') {
    // Gon Freecss: iconic soaring vertical black hair tower with forest-green tips!
    addSkullCap(1.05)
    const pillar = new THREE.Mesh(gp.cyl, hMat)
    pillar.scale.set(7.8, 26, 7.2)
    pillar.position.set(0, 17, -0.5)
    const topCone = new THREE.Mesh(gp.hairSpike, tipMat)
    topCone.scale.set(1.75, 1.45, 1.65)
    topCone.position.set(0, 34, -0.5)
    headGroup.add(pillar, topCone)
    for (const sx of [-1, 1] as const) {
      const sideSpike = new THREE.Mesh(gp.thinCone, tipMat)
      sideSpike.scale.set(1.35, 1.1, 1.2)
      sideSpike.position.set(sx * 7.2, 24, 1.2)
      sideSpike.rotation.z = -sx * 0.28
      const sideBang = new THREE.Mesh(gp.thinCone, hMat)
      sideBang.scale.set(0.75, 0.65, 0.65)
      sideBang.position.set(sx * 8.2, 2.2, 5.2)
      sideBang.rotation.set(2.8, 0, sx * 0.25)
      headGroup.add(sideSpike, sideBang)
    }
    addAnimeEyes(profile.eyeHex, browHex, { angry: 0.16 })
  } else if (style === 'asym_spiky_goku') {
    addSkullCap(1.02)
    if (cid === 'boy') {
      // Authentic Goku asymmetrical jagged silhouette: 4 bold left prongs, 3 swept right prongs!
      const gokuSpikes: Array<[number, number, number, number, number, number]> = [
        [-8.5, 9.2, -1.0, -0.15, 0.95, 1.35],
        [-11.0, 4.2, -2.5, -0.1, 1.25, 1.28],
        [-5.2, 13.0, -1.8, -0.25, 0.45, 1.35],
        [-9.2, -0.8, -3.5, 0.05, 1.55, 1.1],
        [7.5, 10.5, -1.5, -0.2, -0.78, 1.32],
        [10.2, 5.2, -2.2, -0.15, -1.18, 1.22],
        [3.2, 13.6, -2.0, -0.3, -0.22, 1.22],
        [-2.8, 6.2, 8.8, 2.55, 0.18, 0.65],
        [2.6, 5.8, 8.8, 2.55, -0.18, 0.65],
      ]
      for (const [sx, sy, sz, rx, rz, sc] of gokuSpikes) {
        const sp = new THREE.Mesh(gp.hairSpike, hMat)
        sp.scale.set(sc * 0.95, sc * 1.15, sc * 0.85)
        sp.position.set(sx, sy, sz)
        sp.rotation.set(rx, 0, rz)
        headGroup.add(sp)
      }
    } else {
      // Toriko wild tall blue swept-up comb + triple left cheek scars
      for (let i = -2; i <= 2; i++) {
        const sp = new THREE.Mesh(gp.thinCone, hMat)
        sp.scale.set(1.15, 1.12, 1.05)
        sp.position.set(i * 3.6, 12.2 - Math.abs(i) * 1.4, -1.5 - Math.abs(i))
        sp.rotation.set(-0.35, 0, -i * 0.25)
        headGroup.add(sp)
      }
      const scarMat = makeBasicMat(mats, 0x7f1d1d)
      for (let s = 0; s < 3; s++) {
        const scar = new THREE.Mesh(gp.visor, scarMat)
        scar.scale.set(0.28, 0.18, 0.25)
        scar.position.set(-4.6 + s * 0.4, -1.6 - s * 1.1, 9.8)
        scar.rotation.z = 0.35
        headGroup.add(scar)
      }
    }
    addAnimeEyes(profile.eyeHex, browHex, { angry: 0.22 })
  } else if (style === 'eye_cover_bang') {
    addSkullCap(1.0)
    if (cid === 'sanji') {
      // Sanji: smooth golden curtain completely sweeping over LEFT eye (-x in local model space facing +z), right eye visible!
      const coverBang = new THREE.Mesh(gp.slab, hMat)
      coverBang.scale.set(0.75, 0.95, 0.72)
      coverBang.position.set(-4.2, 2.2, 8.8)
      coverBang.rotation.set(0.18, -0.35, -0.22)
      const backSweep = new THREE.Mesh(gp.slab, hMat)
      backSweep.scale.set(1.9, 1.1, 1.2)
      backSweep.position.set(0, 0.2, -7.8)
      const cig = new THREE.Mesh(gp.box, makeBasicMat(mats, 0xf8fafc))
      cig.scale.set(0.65, 0.65, 4.8)
      cig.position.set(2.2, -5.0, 10.6)
      cig.rotation.set(0.2, 0.2, 0)
      const ember = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xf97316, { additive: true }))
      ember.scale.setScalar(0.22)
      ember.position.set(2.6, -5.4, 13.0)
      headGroup.add(coverBang, backSweep, cig, ember)
      addAnimeEyes(profile.eyeHex, browHex, { angry: 0.12, skipLeft: true })
    } else {
      // Killua: messy silver layered wide curls without radial cone halo
      for (const [bx, by, bz, rx, rz, sc] of [
        [-7.5, 4.2, 5.2, 2.4, 0.38, 0.85],
        [-3.2, 5.5, 8.8, 2.6, 0.12, 0.82],
        [3.4, 5.2, 8.5, 2.6, -0.18, 0.78],
        [7.6, 4.0, 5.0, 2.4, -0.38, 0.85],
        [-9.2, 3.0, -3.5, -0.7, 0.82, 0.95],
        [9.2, 3.0, -3.5, -0.7, -0.82, 0.95],
        [0, 8.8, -5.5, -0.85, 0, 1.05],
      ] as const) {
        const lock = new THREE.Mesh(gp.thinCone, hMat)
        lock.scale.set(sc * 1.1, sc * 0.9, sc)
        lock.position.set(bx, by, bz)
        lock.rotation.set(rx, 0, rz)
        headGroup.add(lock)
      }
      addAnimeEyes(profile.eyeHex, browHex, { angry: 0.22 })
    }
  } else if (style === 'gojo_upward') {
    // Gojo Satoru: sleek black blindfold + glowing cyan Six-Eyes shimmer + tall standing white tufts
    addSkullCap(1.06)
    const blindfold = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0x020617, { roughness: 0.22 }))
    blindfold.scale.set(1.22, 1.15, 1.15)
    blindfold.position.set(0, 1.2, 7.6)
    const bandWrap = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0x020617, { roughness: 0.22 }))
    bandWrap.scale.set(1.04, 1.18, 1.04)
    bandWrap.position.set(0, 1.2, 0)
    const slit = new THREE.Mesh(gp.box, makeBasicMat(mats, 0x38bdf8, { additive: true }))
    slit.scale.set(12.5, 0.9, 1.2)
    slit.position.set(0, 1.2, 10.6)
    headGroup.add(blindfold, bandWrap, slit)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const tuft = new THREE.Mesh(gp.thinCone, i % 2 === 0 ? hMat : tipMat)
      tuft.scale.set(1.25, 1.08, 1.05)
      tuft.position.set(Math.cos(angle) * 5.2, 12.8, Math.sin(angle) * 4.5 - 0.5)
      tuft.rotation.set(Math.sin(angle) * 0.28, 0, -Math.cos(angle) * 0.28)
      headGroup.add(tuft)
    }
  } else if (style === 'twin_tails') {
    // Frieren: center-parted silver bangs + long pointed elf ears + flowing twin-tails
    addSkullCap(1.0)
    for (const sx of [-1, 1] as const) {
      const ear = new THREE.Mesh(gp.thinCone, skinMat)
      ear.scale.set(0.68, 1.15, 0.45)
      ear.position.set(sx * 12.0, 0.6, 0.4)
      ear.rotation.z = -sx * 1.32
      const bang = new THREE.Mesh(gp.thinCone, hMat)
      bang.scale.set(0.95, 0.68, 0.6)
      bang.position.set(sx * 4.0, 4.6, 9.2)
      bang.rotation.set(2.75, 0, sx * 0.28)
      const twinTail = new THREE.Mesh(gp.slab, hMat)
      twinTail.scale.set(0.65, 1.85, 1.65)
      twinTail.position.set(sx * 10.6, -7.8, -3.5)
      twinTail.rotation.z = sx * 0.2
      const tieRing = new THREE.Mesh(gp.ringThin, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.7 }))
      tieRing.scale.setScalar(0.28)
      tieRing.position.set(sx * 10.2, 2.2, -2.5)
      headGroup.add(ear, bang, twinTail, tieRing)
    }
    addAnimeEyes(profile.eyeHex, browHex, { angry: 0.08 })
  } else if (style === 'twin_odango') {
    // Nezha: cute twin Odango buns with vivid red ribbons + chopped straight bangs
    addSkullCap(0.98)
    const ribMat = makeMat(mats, flashMaterials, 0xdc2626)
    for (const sx of [-1, 1] as const) {
      const bun = new THREE.Mesh(gp.orb, hMat)
      bun.scale.setScalar(1.48)
      bun.position.set(sx * 8.8, 10.2, -1.5)
      const rib = new THREE.Mesh(gp.ringThin, ribMat)
      rib.scale.setScalar(0.55)
      rib.position.set(sx * 8.2, 8.6, -1.2)
      rib.rotation.set(0.6, 0, sx * 0.6)
      const tail = new THREE.Mesh(gp.thinCone, tipMat)
      tail.scale.set(0.6, 0.85, 0.35)
      tail.position.set(sx * 10.8, 4.8, -2.2)
      tail.rotation.set(2.8, 0, sx * 0.4)
      headGroup.add(bun, rib, tail)
    }
    const frontFringe = new THREE.Mesh(gp.slab, hMat)
    frontFringe.scale.set(1.35, 0.42, 0.6)
    frontFringe.position.set(0, 5.8, 9.2)
    headGroup.add(frontFringe)
    addAnimeEyes(profile.eyeHex, browHex, { angry: 0.2 })
  } else if (style === 'topknot_usnisha') {
    addSkullCap(1.0)
    const bun = new THREE.Mesh(gp.orb, hMat)
    bun.scale.setScalar(cid === 'buddha' ? 1.55 : 1.38)
    bun.position.set(0, 12.2, -1.5)
    headGroup.add(bun)
    if (cid === 'buddha') {
      const goldMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85 })
      const crownRing = new THREE.Mesh(gp.ringThin, goldMat)
      crownRing.rotation.x = Math.PI * 0.5
      crownRing.scale.setScalar(0.52)
      crownRing.position.set(0, 10.2, -1.5)
      const tilak = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xef4444))
      tilak.scale.setScalar(0.32)
      tilak.position.set(0, 4.5, 10.4)
      headGroup.add(crownRing, tilak)
      for (const sx of [-1, 1] as const) {
        const earRing = new THREE.Mesh(gp.ringThin, goldMat)
        earRing.scale.setScalar(0.28)
        earRing.position.set(sx * 10.2, -4.0, 0.8)
        earRing.rotation.y = Math.PI * 0.5
        const cheekLock = new THREE.Mesh(gp.thinCone, hMat)
        cheekLock.scale.set(0.65, 0.72, 0.5)
        cheekLock.position.set(sx * 7.8, 1.0, 6.2)
        cheekLock.rotation.x = 2.95
        headGroup.add(earRing, cheekLock)
      }
      addAnimeEyes(profile.eyeHex, 0x0284c7, { angry: 0.1 })
    } else {
      // Speed Grandma: round retro wire glasses!
      const frameMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.8 })
      for (const sx of [-3.8, 3.8]) {
        const rim = new THREE.Mesh(gp.ringThin, frameMat)
        rim.scale.setScalar(0.32)
        rim.position.set(sx, 0.8, 10.8)
        headGroup.add(rim)
      }
      addAnimeEyes(profile.eyeHex, browHex, { angry: 0.25 })
    }
  } else if (style === 'bowl_layered') {
    addSkullCap(1.04)
    const backCap = new THREE.Mesh(gp.slab, hMat)
    backCap.scale.set(1.85, 0.95, 1.35)
    backCap.position.set(0, 0.6, -7.2)
    headGroup.add(backCap)
    for (const bx of [-5.2, -1.8, 1.8, 5.2]) {
      const squareBang = new THREE.Mesh(gp.slab, bx === -5.2 || bx === 5.2 ? tipMat : hMat)
      squareBang.scale.set(0.42, 0.54, 0.45)
      squareBang.position.set(bx, 5.2, 8.6)
      squareBang.rotation.x = -0.25
      headGroup.add(squareBang)
    }
    if (cid === 'naruto') {
      const headband = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0x0f172a))
      headband.scale.set(1.04, 0.7, 1.04)
      headband.position.set(0, 4.6, 0)
      const plate = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0xcbd5e1, { metalness: 0.88, roughness: 0.16 }))
      plate.scale.set(0.65, 0.72, 0.62)
      plate.position.set(0, 4.6, 10.6)
      const whMat = makeBasicMat(mats, 0x334155)
      for (const sx of [-5.5, 5.5]) {
        for (let w = 0; w < 3; w++) {
          const line = new THREE.Mesh(gp.box, whMat)
          line.scale.set(2.4, 0.35, 0.4)
          line.position.set(sx, -2.0 - w * 1.1, 9.2)
          headGroup.add(line)
        }
      }
      headGroup.add(headband, plate)
    } else if (cid === 'meliodas') {
      const ahoge = new THREE.Mesh(gp.thinCone, hMat)
      ahoge.scale.set(0.5, 0.82, 0.5)
      ahoge.position.set(0.5, 13.8, 1.0)
      ahoge.rotation.z = -0.3
      const mark = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x4c1d95))
      mark.scale.set(0.65, 0.45, 0.3)
      mark.position.set(-4.5, 3.8, 10.1)
      headGroup.add(ahoge, mark)
    }
    addAnimeEyes(profile.eyeHex, browHex, { angry: cid === 'ko' ? 0.1 : 0.18 })
  } else if (style === 'long_flowing') {
    addSkullCap(1.02)
    // Flowing rear curtain down back & shoulders
    const backFlow = new THREE.Mesh(gp.slab, hMat)
    backFlow.scale.set(2.15, cid === 'kaem' || cid === 'diavolo' || cid === 'krasue' ? 2.65 : 1.95, 1.45)
    backFlow.position.set(0, cid === 'kaem' || cid === 'diavolo' ? -13 : -8.5, -7.8)
    headGroup.add(backFlow)
    for (const sx of [-1, 1] as const) {
      const cheekLock = new THREE.Mesh(gp.thinCone, hMat)
      cheekLock.scale.set(0.72, 1.05, 0.58)
      cheekLock.position.set(sx * 7.8, -0.5, 6.2)
      cheekLock.rotation.set(3.0, 0, sx * 0.14)
      headGroup.add(cheekLock)
    }
    if (cid === 'ole') {
      const headband = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0x0f172a))
      headband.scale.set(1.04, 0.72, 1.04)
      headband.position.set(0, 4.6, 0)
      const plate = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0xcbd5e1, { metalness: 0.85 }))
      plate.scale.set(0.64, 0.7, 0.62)
      plate.position.set(0, 4.6, 10.6)
      const ponytail = new THREE.Mesh(gp.thinCone, hMat)
      ponytail.scale.set(0.75, 0.95, 0.65)
      ponytail.position.set(0, -10, -11.5)
      ponytail.rotation.x = 2.85
      headGroup.add(headband, plate, ponytail)
    } else if (cid === 'diablo') {
      const hornMat = makeMat(mats, flashMaterials, 0x09090b, { roughness: 0.2, metalness: 0.5 })
      for (const sx of [-1, 1] as const) {
        const horn = new THREE.Mesh(gp.thickHorn, hornMat)
        horn.scale.set(0.85, 0.85, 0.85)
        horn.position.set(sx * 6.5, 9.5, 0.5)
        horn.rotation.set(-0.5, sx * 0.35, -sx * 0.6)
        const redStreak = new THREE.Mesh(gp.thinCone, tipMat)
        redStreak.scale.set(0.45, 0.82, 0.4)
        redStreak.position.set(sx * 5.2, 2.2, 8.8)
        redStreak.rotation.set(2.9, 0, sx * 0.18)
        headGroup.add(horn, redStreak)
      }
    } else if (cid === 'diavolo') {
      // Leopard spots on long pink hair + Epitaph forehead sub-face
      for (const [lx, ly, lz] of [[-7, -4, -9], [7, -10, -9], [0, -16, -9.2], [-6, 1, 7]] as const) {
        const spot = new THREE.Mesh(gp.orb, tipMat)
        spot.scale.set(0.5, 0.5, 0.35)
        spot.position.set(lx, ly, lz)
        headGroup.add(spot)
      }
      const epitaph = new THREE.Mesh(gp.orb, makeMat(mats, flashMaterials, 0xf472b6))
      epitaph.scale.set(0.75, 0.72, 0.45)
      epitaph.position.set(0, 5.2, 10.2)
      headGroup.add(epitaph)
    }
    addAnimeEyes(profile.eyeHex, browHex, { angry: 0.22 })
  } else if (style === 'slicked_back') {
    // Sleek backward-swept hair (NO spiky front cone halo)
    addSkullCap(1.04, -0.8)
    const sweepBack = new THREE.Mesh(gp.slab, hMat)
    sweepBack.scale.set(1.75, 0.92, 1.35)
    sweepBack.position.set(0, 6.5, -5.8)
    sweepBack.rotation.x = 0.68
    headGroup.add(sweepBack)
    if (cid === 'aizen') {
      // Aizen signature single loose lock falling over forehead
      const looseStrand = new THREE.Mesh(gp.thinCone, hMat)
      looseStrand.scale.set(0.45, 0.78, 0.45)
      looseStrand.position.set(0.6, 2.2, 10.6)
      looseStrand.rotation.x = 2.98
      headGroup.add(looseStrand)
    } else if (cid === 'thanwa') {
      const bandana = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0x064e3b))
      bandana.scale.set(1.04, 0.82, 1.04)
      bandana.position.set(0, 4.4, 0)
      const wado = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0xf8fafc, { metalness: 0.9 }))
      wado.position.set(0, -3.5, 14.5)
      wado.rotation.y = Math.PI * 0.46
      headGroup.add(bandana, wado)
    } else if (cid === 'ajarn_boy') {
      const tatMat = makeBasicMat(mats, 0x09090b)
      const browBand = new THREE.Mesh(gp.helmetBand, tatMat)
      browBand.scale.set(1.03, 0.35, 1.03)
      browBand.position.set(0, 4.4, 0)
      headGroup.add(browBand)
      for (const ex of [-4.2, 4.2]) {
        const subEye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xfb7185, { additive: true }))
        subEye.scale.setScalar(0.72)
        subEye.position.set(ex, -1.5, 10.0)
        headGroup.add(subEye)
      }
    } else if (cid === 'escanor') {
      // Prominent golden-orange curled handlebar mustache!
      const stacheMat = makeMat(mats, flashMaterials, 0xf97316)
      for (const sx of [-1, 1] as const) {
        const st = new THREE.Mesh(gp.thickHorn, stacheMat)
        st.scale.set(0.45, 0.35, 0.4)
        st.position.set(sx * 3.0, -3.2, 10.6)
        st.rotation.set(0, 0, sx * 0.9)
        headGroup.add(st)
      }
    } else if (cid === 'king') {
      const scarMat = makeBasicMat(mats, 0xef4444)
      for (let i = 0; i < 3; i++) {
        const sc = new THREE.Mesh(gp.visor, scarMat)
        sc.scale.set(0.32, 0.16, 0.2)
        sc.position.set(-4.2 + i * 0.5, -1.2 - i * 1.1, 10.2)
        sc.rotation.z = 0.4
        headGroup.add(sc)
      }
    }
    addAnimeEyes(profile.eyeHex, browHex, { angry: 0.24, eyeZ: isTitan ? 10.4 : 9.6 })
  } else {
    // 'parted_sharp' (Jinwoo, Frame/Jotaro, Luffy, Law, Gambit, Cid, Gray, Ben10, Tansan, CJ, Krahang, Default)
    addSkullCap(1.0)
    for (const [bx, by, bz, rx, rz, sc, useTip] of [
      [-4.2, 4.4, 9.2, 2.75, 0.26, 0.72, false],
      [0.4, 4.8, 9.8, 2.82, -0.05, 0.74, true],
      [4.2, 4.4, 9.2, 2.75, -0.26, 0.72, false],
      [-8.5, 1.5, 5.2, 2.85, 0.35, 0.78, false],
      [8.5, 1.5, 5.2, 2.85, -0.35, 0.78, false],
    ] as const) {
      const b = new THREE.Mesh(gp.thinCone, useTip ? tipMat : hMat)
      b.scale.setScalar(sc)
      b.position.set(bx, by, bz)
      b.rotation.set(rx, 0, rz)
      headGroup.add(b)
    }

    if (cid === 'luffy') {
      const brim = new THREE.Mesh(gp.hatDisc, makeMat(mats, flashMaterials, 0xfacc15, { roughness: 0.48 }))
      brim.position.set(0, 6.8, 0)
      const hCrown = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0xfde047, { roughness: 0.45 }))
      hCrown.scale.set(1.06, 1.3, 1.06)
      hCrown.position.set(0, 10.2, 0)
      const redRibbon = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0xdc2626))
      redRibbon.scale.set(1.11, 0.45, 1.11)
      redRibbon.position.set(0, 8.2, 0)
      headGroup.add(brim, hCrown, redRibbon)
    } else if (cid === 'law') {
      const hatBase = new THREE.Mesh(gp.hairCrown, makeMat(mats, flashMaterials, 0xf8fafc, { roughness: 0.55 }))
      hatBase.scale.set(1.18, 1.05, 1.18)
      hatBase.position.set(0, 4.6, 0)
      const spotMat = makeMat(mats, flashMaterials, 0x09090b)
      for (const [sx, sy, sz] of [[-6, 6, 8], [6, 7, 8], [-9, 5, 0], [9, 6, 0], [0, 8, -9]] as const) {
        const sp = new THREE.Mesh(gp.orb, spotMat)
        sp.scale.setScalar(0.55)
        sp.position.set(sx, sy, sz)
        headGroup.add(sp)
      }
      headGroup.add(hatBase)
    } else if (cid === 'frame') {
      // Jotaro: black cap fused seamlessly into back hair + gold visor plate!
      const cap = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0x0f172a))
      cap.scale.set(1.08, 1.25, 1.08)
      cap.position.set(0, 7.2, 0)
      const visor = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, 0x0f172a))
      visor.scale.set(15.5, 1.4, 8.5)
      visor.position.set(0, 5.2, 10.5)
      visor.rotation.x = 0.22
      const goldPin = new THREE.Mesh(gp.orb, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85 }))
      goldPin.scale.setScalar(0.52)
      goldPin.position.set(0, 7.8, 11.8)
      headGroup.add(cap, visor, goldPin)
    } else if (cid === 'gambit') {
      const cowlMat = makeMat(mats, flashMaterials, 0x1e293b, { metalness: 0.5, roughness: 0.3 })
      const cowl = new THREE.Mesh(gp.helmetBand, cowlMat)
      cowl.scale.set(1.06, 1.15, 1.06)
      cowl.position.set(0, 1.6, 0)
      const chinStrap = new THREE.Mesh(gp.helmetBand, cowlMat)
      chinStrap.scale.set(0.95, 0.85, 0.98)
      chinStrap.position.set(0, -5.8, 1.2)
      headGroup.add(cowl, chinStrap)
    } else if (cid === 'cid') {
      const hood = new THREE.Mesh(gp.hairCrown, makeMat(mats, flashMaterials, 0x09090b, { roughness: 0.4 }))
      hood.scale.set(1.16, 1.22, 1.18)
      hood.position.set(0, 1.8, -0.5)
      headGroup.add(hood)
    }
    addAnimeEyes(profile.eyeHex, browHex, { angry: cid === 'jinwoo' || cid === 'cid' ? 0.26 : 0.16 })
  }

  void options
  return headGroup
}
