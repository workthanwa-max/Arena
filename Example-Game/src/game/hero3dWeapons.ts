import * as THREE from 'three'
import type { PlayerState } from '../types/game'
import { makeBasicMat, makeMat, type Hero3dGeoPool, type HeroFlashMat } from './hero3dGeoPool'
import type { Hero3dProfile } from './hero3dProfiles'

export interface WeaponsAndExtrasResult {
  companionGroup?: THREE.Group
  throneGroup?: THREE.Group
  extraOrbitalGroup?: THREE.Group
  fastFistsGroup?: THREE.Group
  kuramaGroup?: THREE.Group
  rasenganOrbGroup?: THREE.Group
  hogyokuGroup?: THREE.Group
  gauntletGems?: THREE.Mesh[]
  gauntletGemMats?: THREE.MeshStandardMaterial[]
}

export function buildHeroWeaponAndExtras3D(
  cid: string,
  p: PlayerState,
  profile: Hero3dProfile,
  gp: Hero3dGeoPool,
  mats: THREE.Material[],
  flashMaterials: HeroFlashMat[],
  modelPivot: THREE.Group,
  bodyPivot: THREE.Group,
  headGroup: THREE.Group,
  leftArm: THREE.Group,
  rightArm: THREE.Group,
  headY: number,
  accentColor: number,
  orbitalHintHex?: number,
): WeaponsAndExtrasResult {
  let companionGroup: THREE.Group | undefined
  let throneGroup: THREE.Group | undefined
  let extraOrbitalGroup: THREE.Group | undefined
  let fastFistsGroup: THREE.Group | undefined
  let kuramaGroup: THREE.Group | undefined
  let rasenganOrbGroup: THREE.Group | undefined
  let hogyokuGroup: THREE.Group | undefined
  let gauntletGems: THREE.Mesh[] | undefined
  let gauntletGemMats: THREE.MeshStandardMaterial[] | undefined

  // === 1. Bespoke Weapons & Head/Arm Props ===
  if (cid === 'noone') {
    const gauntlet = new THREE.Mesh(
      gp.pauldron,
      makeMat(mats, flashMaterials, 0xf59e0b, { metalness: 0.88, roughness: 0.18, emissive: 0x78350f, emissiveIntensity: 0.35 }),
    )
    gauntlet.scale.set(0.95, 1.45, 0.92)
    gauntlet.position.set(0, -13, 2)
    leftArm.add(gauntlet)

    const gemOffsets: Array<[number, number, number]> = [
      [-2.5, -16.5, 5.8],
      [-0.8, -17.3, 6.0],
      [1.0, -17.1, 6.0],
      [2.6, -16.2, 5.8],
      [0, -12.8, 6.5],
    ]
    gauntletGems = []
    gauntletGemMats = []
    for (let i = 0; i < 5; i++) {
      const gmMat = makeMat(mats, flashMaterials, 0x334155, { emissive: 0x000000, emissiveIntensity: 0, roughness: 0.15 })
      const gem = new THREE.Mesh(gp.orb, gmMat)
      gem.scale.setScalar(i === 4 ? 0.75 : 0.48)
      gem.position.set(...gemOffsets[i])
      leftArm.add(gem)
      gauntletGems.push(gem)
      gauntletGemMats.push(gmMat)
    }
  } else if (cid === 'ko' || cid === 'kaem' || cid === 'cid' || cid === 'yami' || cid === 'law' || cid === 'aizen' || cid === 'meliodas') {
    const bladeCol =
      cid === 'ko'
        ? 0xfacc15
        : cid === 'kaem' || cid === 'law'
          ? 0x38bdf8
          : cid === 'cid' || cid === 'yami' || cid === 'aizen'
            ? 0x9333ea
            : 0x22c55e
    const bladeMat = makeMat(mats, flashMaterials, bladeCol, { emissive: bladeCol, emissiveIntensity: 0.75, metalness: 0.88, roughness: 0.12 })
    const blade = new THREE.Mesh(gp.katanaBlade, bladeMat)
    blade.scale.set(1.0, 1.0, cid === 'law' ? 1.42 : cid === 'meliodas' ? 0.72 : 1.0)
    blade.position.set(0, -13, cid === 'law' ? 23 : 16)
    const guard = new THREE.Mesh(gp.katanaGuard, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85 }))
    guard.position.set(0, -13, 3.5)
    rightArm.add(blade, guard)
    if (cid === 'aizen') {
      const kidoOrb = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x9333ea, { transparent: true, opacity: 0.82, additive: true }))
      kidoOrb.scale.setScalar(1.35)
      kidoOrb.position.set(0, -14, 4.5)
      leftArm.add(kidoOrb)
    }
  } else if (cid === 'thanwa') {
    const enma = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0xc084fc, { emissive: 0x9333ea, emissiveIntensity: 0.78, metalness: 0.85 }))
    enma.position.set(0, -13, 19)
    const kitetsu = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0x34d399, { emissive: 0x10b981, emissiveIntensity: 0.7, metalness: 0.85 }))
    kitetsu.position.set(0, -13, 18)
    rightArm.add(enma)
    leftArm.add(kitetsu)
  } else if (cid === 'jinwoo') {
    for (const [arm, col, em] of [
      [rightArm, 0x38bdf8, 0x7c3aed],
      [leftArm, 0xa855f7, 0x38bdf8],
    ] as const) {
      const guard = new THREE.Mesh(gp.katanaGuard, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85 }))
      guard.scale.setScalar(0.8)
      guard.position.set(0, -13, 3.2)
      const dagger = new THREE.Mesh(
        gp.katanaBlade,
        makeMat(mats, flashMaterials, col, { emissive: em, emissiveIntensity: 0.9, metalness: 0.88, roughness: 0.12 }),
      )
      dagger.scale.set(1.35, 1.45, 0.68)
      dagger.position.set(0, -13, 14)
      arm.add(guard, dagger)
    }
  } else if (cid === 'igris') {
    const guard = new THREE.Mesh(gp.katanaGuard, makeMat(mats, flashMaterials, 0xdc2626, { emissive: 0x991b1b, emissiveIntensity: 0.75, metalness: 0.9 }))
    guard.scale.set(1.45, 1.3, 1.45)
    guard.position.set(0, -13, 3.8)
    const blade = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0x1e1b4b, { emissive: 0xa855f7, emissiveIntensity: 1.15, metalness: 0.92 }))
    blade.scale.set(1.85, 1.85, 1.38)
    blade.position.set(0, -13, 21)
    const bloodEdge = new THREE.Mesh(gp.katanaBlade, makeBasicMat(mats, 0xef4444, { transparent: true, opacity: 0.85, additive: true }))
    bloodEdge.scale.set(2.1, 1.4, 1.32)
    bloodEdge.position.set(0, -13, 21)
    rightArm.add(guard, blade, bloodEdge)
  } else if (cid === 'pa') {
    // Gilgamesh Sword of Rupture Ea (cylindrical rotating red-gold blade)
    const hilt = new THREE.Mesh(gp.katanaGuard, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.9 }))
    hilt.scale.set(1.3, 1.3, 1.3)
    hilt.position.set(0, -13, 3.6)
    const eaCore = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, 0x991b1b, { emissive: 0xef4444, emissiveIntensity: 0.85, metalness: 0.82 }))
    eaCore.scale.set(2.4, 34, 2.4)
    eaCore.rotation.x = Math.PI * 0.5
    eaCore.position.set(0, -13, 20)
    rightArm.add(hilt, eaCore)
  } else if (cid === 'escanor') {
    // Rhitta: Giant Golden Sacred Axe!
    const shaft = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, 0x78350f, { roughness: 0.4 }))
    shaft.scale.set(1.8, 38, 1.8)
    shaft.position.set(0, -4, 7)
    const axeHead = new THREE.Mesh(gp.crescentBlade, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.9, emissive: 0xf59e0b, emissiveIntensity: 0.55 }))
    axeHead.scale.set(1.35, 1.45, 0.75)
    axeHead.position.set(0, 14, 13.5)
    axeHead.rotation.y = Math.PI * 0.5
    rightArm.add(shaft, axeHead)
  } else if (cid === 'wukong') {
    // Ruyi Jingu Bang (crimson rod with gold end caps)
    const staffMat = makeMat(mats, flashMaterials, 0xdc2626, { emissive: 0x991b1b, emissiveIntensity: 0.45 })
    const capMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.9, roughness: 0.15 })
    const staff = new THREE.Mesh(gp.cyl, staffMat)
    staff.scale.set(1.6, 54, 1.6)
    staff.position.set(0, -2, 8)
    const capTop = new THREE.Mesh(gp.cyl, capMat)
    capTop.scale.set(2.2, 6, 2.2)
    capTop.position.set(0, 24, 8)
    const capBot = new THREE.Mesh(gp.cyl, capMat)
    capBot.scale.set(2.2, 6, 2.2)
    capBot.position.set(0, -28, 8)
    rightArm.add(staff, capTop, capBot)
  } else if (cid === 'nezha') {
    // Flame-Tipped Spear
    const shaft = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.8 }))
    shaft.scale.set(1.3, 44, 1.3)
    shaft.position.set(0, -4, 7)
    const spearTip = new THREE.Mesh(gp.thinCone, makeBasicMat(mats, 0xf97316, { additive: true }))
    spearTip.scale.set(0.95, 0.95, 0.95)
    spearTip.position.set(0, 21, 7)
    rightArm.add(shaft, spearTip)
  } else if (cid === 'krahang') {
    // Authentic Thai Krahang: Giant woven bamboo winnowing basket wings (กระด้ง) + Rice Pestle (สาก)!
    const bambooMat = makeMat(mats, flashMaterials, 0xd97706, { roughness: 0.65 })
    const rimMat = makeMat(mats, flashMaterials, 0x92400e, { roughness: 0.55 })
    for (const [arm, sx] of [[leftArm, -1], [rightArm, 1]] as const) {
      const kradong = new THREE.Mesh(gp.hatDisc, bambooMat)
      kradong.scale.set(0.92, 0.9, 0.92)
      kradong.rotation.z = sx * Math.PI * 0.42
      kradong.position.set(sx * 10, -8, -4)
      const kRim = new THREE.Mesh(gp.ringThin, rimMat)
      kRim.scale.setScalar(1.65)
      kRim.rotation.x = Math.PI * 0.5
      kRim.rotation.z = sx * Math.PI * 0.42
      kRim.position.set(sx * 10, -8, -4)
      arm.add(kradong, kRim)
    }
    const pestle = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, 0x78350f, { roughness: 0.55 }))
    pestle.scale.set(2.4, 34, 2.4)
    pestle.rotation.x = Math.PI * 0.46
    pestle.position.set(0, -13, 14)
    rightArm.add(pestle)
  } else if (cid === 'steve') {
    // Pixel Voxel Diamond Sword + Blocky Shield!
    const handleMat = makeMat(mats, flashMaterials, 0x78350f)
    const diaMat = makeMat(mats, flashMaterials, 0x06b6d4, { emissive: 0x0891b2, emissiveIntensity: 0.4, metalness: 0.35 })
    const hilt = new THREE.Mesh(gp.box, handleMat)
    hilt.scale.set(2.4, 2.4, 8.0)
    hilt.position.set(0, -14, 4.5)
    const cross = new THREE.Mesh(gp.box, diaMat)
    cross.scale.set(8.5, 2.4, 2.4)
    cross.position.set(0, -14, 9.5)
    const blade = new THREE.Mesh(gp.box, diaMat)
    blade.scale.set(3.2, 2.2, 24)
    blade.position.set(0, -14, 22)
    rightArm.add(hilt, cross, blade)

    const shield = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, 0x92400e))
    shield.scale.set(2.2, 16, 11)
    shield.position.set(-4.5, -10, 2)
    leftArm.add(shield)
  } else if (cid === 'iron_man') {
    // Repulsor palm glows + sweeping Mark 85 back flight wing-flaps!
    const repMat = makeBasicMat(mats, 0x38bdf8, { additive: true })
    for (const grp of [leftArm, rightArm]) {
      const rep = new THREE.Mesh(gp.orb, repMat)
      rep.scale.setScalar(0.85)
      rep.position.set(0, -14.2, 2.5)
      grp.add(rep)
    }
    const wingMat = makeMat(mats, flashMaterials, 0xdc2626, { metalness: 0.85 })
    const trimMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.88 })
    for (const sx of [-1, 1] as const) {
      const flap = new THREE.Mesh(gp.slab, wingMat)
      flap.scale.set(1.2, 0.9, 0.65)
      flap.position.set(sx * 14, 34, -8)
      flap.rotation.set(0.2, sx * 0.35, -sx * 0.52)
      const trim = new THREE.Mesh(gp.box, trimMat)
      trim.scale.set(2.2, 12, 1.6)
      trim.position.set(sx * 18, 37, -8.5)
      trim.rotation.z = -sx * 0.52
      bodyPivot.add(flap, trim)
    }
  } else if (cid === 'doraemon') {
    // Bamboo Copter (ทาเคคอปเตอร์) on top of Doraemon's head + Air Cannon on arm!
    const copterMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.45 })
    const stem = new THREE.Mesh(gp.cyl, copterMat)
    stem.scale.set(0.85, 5.5, 0.85)
    stem.position.set(0, 14.5, 0)
    const prop = new THREE.Mesh(gp.box, copterMat)
    prop.scale.set(16, 0.7, 2.2)
    prop.position.set(0, 17.2, 0)
    headGroup.add(stem, prop)

    const airCannon = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, 0xf1f5f9, { metalness: 0.4 }))
    airCannon.scale.set(4.8, 9.5, 4.8)
    airCannon.rotation.x = Math.PI * 0.5
    airCannon.position.set(0, -11, 5.5)
    rightArm.add(airCannon)
  } else if (cid === 'po') {
    const scroll = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.65 }))
    scroll.scale.set(2.2, 11, 2.2)
    scroll.rotation.z = Math.PI * 0.5
    scroll.position.set(0, -11, 5.5)
    leftArm.add(scroll)
  } else if (cid === 'kai') {
    const jadeMat = makeMat(mats, flashMaterials, 0x10b981, { emissive: 0x059669, emissiveIntensity: 0.75, metalness: 0.7 })
    for (const grp of [leftArm, rightArm]) {
      const cBlade = new THREE.Mesh(gp.crescentBlade, jadeMat)
      cBlade.scale.set(1.1, 1.15, 0.65)
      cBlade.position.set(0, -14, 9)
      cBlade.rotation.y = Math.PI * 0.5
      grp.add(cBlade)
    }
  } else if (cid === 'adam') {
    // Brass Knuckleduster on right fist!
    const knuck = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.9, roughness: 0.16 }))
    knuck.scale.set(4.5, 2.5, 4.5)
    knuck.position.set(0, -14.2, 4.2)
    rightArm.add(knuck)
  } else if (cid === 'simo') {
    const stock = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0x78350f, { roughness: 0.5 }))
    stock.scale.set(1.6, 1.8, 0.72)
    stock.position.set(0, -12, 10)
    const barrel = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0x1e293b, { metalness: 0.85 }))
    barrel.scale.set(0.95, 0.95, 1.18)
    barrel.position.set(0, -11, 21)
    const muzzleTip = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8, { additive: true }))
    muzzleTip.scale.setScalar(0.55)
    muzzleTip.position.set(0, -11, 37)
    rightArm.add(stock, barrel, muzzleTip)
  } else if (cid === 'ben10') {
    const band = new THREE.Mesh(gp.pauldron, makeMat(mats, flashMaterials, 0x0f172a, { metalness: 0.72 }))
    band.scale.set(0.75, 0.82, 0.75)
    band.position.set(0, -11, 1.5)
    const dial = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x22c55e, { additive: true }))
    dial.scale.set(1.18, 0.88, 1.18)
    dial.position.set(-2.5, -11, 4.8)
    leftArm.add(band, dial)
  } else if (cid === 'frieren' || cid === 'buddha' || cid === 'beelzebub') {
    const shaftCol = cid === 'frieren' ? 0x7f1d1d : cid === 'buddha' ? 0xf59e0b : 0x1e1b4b
    const gemCol = cid === 'frieren' ? 0xef4444 : cid === 'buddha' ? 0xfacc15 : 0x7c3aed
    const shaft = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, shaftCol))
    shaft.scale.set(1.5, 44, 1.5)
    shaft.position.set(0, -4, 7.0)
    const ring = new THREE.Mesh(gp.haloRing, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.88 }))
    ring.scale.set(0.28, 0.28, 0.28)
    ring.position.set(0, 17, 7.0)
    const gem = new THREE.Mesh(gp.orb, makeBasicMat(mats, gemCol, { additive: true }))
    gem.scale.setScalar(0.95)
    gem.position.set(0, 17, 7.0)
    rightArm.add(shaft, ring, gem)
  } else if (cid === 'gambit') {
    const bo = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, 0x94a3b8, { metalness: 0.85 }))
    bo.scale.set(1.3, 46, 1.3)
    bo.position.set(0, -3, 7.0)
    const card = new THREE.Mesh(gp.box, makeBasicMat(mats, 0xec4899, { additive: true }))
    card.scale.set(4.5, 6.5, 0.6)
    card.position.set(0, -14, 5.2)
    rightArm.add(bo)
    leftArm.add(card)
  } else if (cid === 'cj_palony' || cid === 'tansan' || cid === 'gray') {
    const bladeCol = cid === 'cj_palony' ? 0xf43f5e : 0x38bdf8
    for (const grp of [leftArm, rightArm]) {
      const auraBlade = new THREE.Mesh(gp.orb, makeBasicMat(mats, bladeCol, { transparent: true, opacity: 0.85, additive: true }))
      auraBlade.scale.set(1.35, 1.55, 1.65)
      auraBlade.position.set(0, -14.2, 3.8)
      grp.add(auraBlade)
    }
  } else if (cid === 'toriko' || cid === 'garp' || cid === 'tai_lung') {
    const auraCol = cid === 'toriko' ? 0xef4444 : cid === 'garp' ? 0xdc2626 : 0x38bdf8
    for (const grp of [leftArm, rightArm]) {
      const fist = new THREE.Mesh(gp.orb, makeBasicMat(mats, auraCol, { transparent: true, opacity: 0.84, additive: true }))
      fist.scale.set(1.65, 1.65, 1.85)
      fist.position.set(0, -14.2, 3.5)
      grp.add(fist)
    }
  } else if (cid === 'diablo' || cid === 'ajarn_boy' || cid === 'pop') {
    const clawCol = cid === 'pop' ? 0x991b1b : 0xdc2626
    for (const grp of [leftArm, rightArm]) {
      const claw = new THREE.Mesh(gp.orb, makeBasicMat(mats, clawCol, { transparent: true, opacity: 0.82, additive: true }))
      claw.scale.set(1.15, 1.5, 1.15)
      claw.position.set(0, -14, 3.2)
      grp.add(claw)
    }
  } else if (cid === 'luffy') {
    const cloudMat = makeBasicMat(mats, 0xf8fafc, { transparent: true, opacity: 0.88, additive: true })
    for (const [cxOff, cyOff, czOff] of [[-13, 36, -5], [13, 36, -5], [0, 40, -10], [-9, 39, -8], [9, 39, -8]] as const) {
      const puff = new THREE.Mesh(gp.orb, cloudMat)
      puff.scale.setScalar(1.38)
      puff.position.set(cxOff, cyOff, czOff)
      bodyPivot.add(puff)
    }
  }

  // === 2. Special Live Gameplay Transformation Groups (MUST PRESERVE) ===
  if (cid === 'pa') {
    // Base subtle Gate rings always anchored behind Gilgamesh's shoulders
    for (const side of [-1, 1] as const) {
      const baseGate = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.72, additive: true }))
      baseGate.scale.set(0.28, 0.28, 0.28)
      baseGate.position.set(side * 16, 36, -13)
      bodyPivot.add(baseGate)
    }

    // Skill 2 (E) 7s Overdrive: Radiant Golden Gate of Babylon Treasury Array flaring behind his back!
    fastFistsGroup = new THREE.Group()
    fastFistsGroup.position.set(0, 32, -16)
    const portalCoords: Array<[number, number, number, number]> = [
      [-26, 8, -2, 0.36],
      [26, 8, -2, 0.36],
      [-17, 22, -4, 0.42],
      [17, 22, -4, 0.42],
      [0, 29, -5, 0.46],
      [-31, -4, 0, 0.32],
      [31, -4, 0, 0.32],
    ]
    const rippleGold = makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.94, additive: true })
    const rippleCore = makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.92, additive: true })
    const glowDisc = makeBasicMat(mats, 0xf59e0b, { transparent: true, opacity: 0.56, side: THREE.DoubleSide, additive: true })
    const swordMat = makeMat(mats, flashMaterials, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 1.25, metalness: 0.9 })
    for (let i = 0; i < portalCoords.length; i++) {
      const [px, py, pz, sc] = portalCoords[i]
      const gateNode = new THREE.Group()
      gateNode.position.set(px, py, pz)
      gateNode.userData.isPaGate = true

      const outerRing = new THREE.Mesh(gp.haloRing, rippleGold)
      outerRing.scale.setScalar(sc)
      const innerRing = new THREE.Mesh(gp.ringThin, rippleCore)
      innerRing.scale.setScalar(sc * 1.9)
      const core = new THREE.Mesh(gp.orb, glowDisc)
      core.scale.set(sc * 5.2, sc * 5.2, sc * 1.1)
      const sword = new THREE.Mesh(gp.katanaBlade, swordMat)
      sword.scale.set(0.75, 0.75, 0.45)
      sword.position.set(0, 0, 6)
      gateNode.add(outerRing, innerRing, core, sword)
      fastFistsGroup.add(gateNode)
    }
    fastFistsGroup.visible = Boolean(p.fastAttack)
    bodyPivot.add(fastFistsGroup)
  } else if (cid === 'boy') {
    fastFistsGroup = new THREE.Group()
    for (const [grp, fx] of [[leftArm, -1], [rightArm, 1]] as const) {
      const auraFist = new THREE.Mesh(gp.glove, makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.85, additive: true }))
      auraFist.scale.set(1.32, 1.32, 1.32)
      auraFist.position.set(fx * 0.5, -14, 2)
      grp.add(auraFist)
      auraFist.userData.isFastFist = true
    }
    fastFistsGroup.visible = Boolean(p.fastAttack)
    bodyPivot.add(fastFistsGroup)
  }

  if (cid === 'kaem') {
    companionGroup = new THREE.Group()
    companionGroup.position.set(22, 22, 4)
    const slimeMat = makeMat(mats, flashMaterials, 0x0ea5e9, { emissive: 0x0284c7, emissiveIntensity: 0.55, roughness: 0.15, transparent: true, opacity: 0.92 })
    const slime = new THREE.Mesh(gp.head, slimeMat)
    slime.scale.set(0.85, 0.65, 0.85)
    for (const ex of [-2.8, 2.8]) {
      const eye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xfef08a))
      eye.scale.setScalar(0.7)
      eye.position.set(ex, 1, 7.6)
      companionGroup.add(eye)
    }
    companionGroup.add(slime)
    modelPivot.add(companionGroup)
  } else if (cid === 'frame') {
    companionGroup = new THREE.Group()
    companionGroup.position.set(-22, 42, -6)
    const spMat = makeMat(mats, flashMaterials, 0xa855f7, { emissive: 0x7e22ce, emissiveIntensity: 0.55, transparent: true, opacity: 0.9 })
    const spBody = new THREE.Mesh(gp.head, spMat)
    spBody.scale.set(1.15, 0.95, 1.0)
    companionGroup.add(spBody)
    for (const sx of [-6, 6]) {
      const ear = new THREE.Mesh(gp.hairSpike, spMat)
      ear.scale.set(0.75, 0.75, 0.75)
      ear.position.set(sx, 11, 0)
      const eye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xfef08a))
      eye.position.set(sx * 0.65, 2, 9.6)
      companionGroup.add(ear, eye)
    }
    const paws = new THREE.Mesh(gp.glove, makeMat(mats, flashMaterials, 0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 0.65 }))
    paws.scale.setScalar(0.8)
    paws.position.set(8, -2, 10)
    companionGroup.add(paws)
    modelPivot.add(companionGroup)
  } else if (cid === 'diavolo') {
    companionGroup = new THREE.Group()
    companionGroup.position.set(-19, 44, -14)
    const kcRed = makeMat(mats, flashMaterials, 0xdc2626, { emissive: 0x991b1b, emissiveIntensity: 0.65, transparent: true, opacity: 0.92 })
    const kcWhite = makeMat(mats, flashMaterials, 0xf8fafc, { emissive: 0xfecdd3, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 })
    const epitaphPink = makeMat(mats, flashMaterials, 0xf472b6, { emissive: 0xdb2777, emissiveIntensity: 0.6 })
    const kcEye = makeBasicMat(mats, 0x10b981)
    const kcTorso = new THREE.Mesh(gp.torso, kcRed)
    kcTorso.scale.set(0.82, 0.72, 0.78)
    kcTorso.position.set(0, -10, 0)
    const kcHead = new THREE.Mesh(gp.head, kcRed)
    kcHead.scale.set(0.95, 1.05, 0.92)
    kcHead.position.set(0, 4, 0)
    const kcMask = new THREE.Mesh(gp.head, kcWhite)
    kcMask.scale.set(0.76, 0.56, 0.45)
    kcMask.position.set(0, 1.5, 4.8)
    const epitaph = new THREE.Mesh(gp.head, epitaphPink)
    epitaph.scale.set(0.42, 0.44, 0.34)
    epitaph.position.set(0, 9.2, 6.2)
    companionGroup.add(kcTorso, kcHead, kcMask, epitaph)
    for (const sx of [-3.2, 3.2]) {
      const eye = new THREE.Mesh(gp.eyeDot, kcEye)
      eye.scale.setScalar(0.85)
      eye.position.set(sx, 3.5, 8.6)
      const fist = new THREE.Mesh(gp.glove, kcRed)
      fist.scale.setScalar(0.95)
      fist.position.set(sx * 3.6, -7.5, 10.5)
      companionGroup.add(eye, fist)
    }
    modelPivot.add(companionGroup)
  }

  if (cid === 'aizen') {
    hogyokuGroup = new THREE.Group()
    const wingWhiteMat = makeBasicMat(mats, 0xf5f3ff, { transparent: true, opacity: 0.9, side: THREE.DoubleSide, additive: true })
    const wingVioletMat = makeBasicMat(mats, 0x9333ea, { transparent: true, opacity: 0.72, side: THREE.DoubleSide, additive: true })
    const auraShell = new THREE.Mesh(gp.shieldSphere, makeBasicMat(mats, 0x7c3aed, { transparent: true, opacity: 0.34, side: THREE.DoubleSide, additive: true }))
    auraShell.scale.set(0.88, 1.24, 0.88)
    auraShell.position.set(0, 29, 0)
    hogyokuGroup.add(auraShell)
    for (let w = 0; w < 6; w++) {
      const side = w < 3 ? -1 : 1
      const tier = w % 3
      const wingPivot = new THREE.Group()
      wingPivot.position.set(side * 6, 31 - tier * 3.5, -8)
      wingPivot.userData.wingSide = side
      wingPivot.userData.wingTier = tier
      const feather = new THREE.Mesh(gp.katanaBlade, tier === 0 ? wingWhiteMat : wingVioletMat)
      feather.scale.set(3.2, 2.4, 1.35)
      feather.position.set(side * (16 + tier * 3), 8 - tier * 4, -8)
      feather.rotation.set(0.25, side * 0.55, -side * (0.45 + tier * 0.24))
      wingPivot.add(feather)
      hogyokuGroup.add(wingPivot)
    }
    hogyokuGroup.visible = Boolean(p.godspeed)
    modelPivot.add(hogyokuGroup)
  }

  if (cid === 'naruto') {
    rasenganOrbGroup = new THREE.Group()
    rasenganOrbGroup.position.set(0, -15.2, 6.2)
    const rasCore = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xffffff, { additive: true }))
    rasCore.scale.setScalar(1.35)
    const rasShell = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8, { transparent: true, opacity: 0.86, additive: true }))
    rasShell.scale.setScalar(2.45)
    const rasRingA = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0x7dd3fc, { transparent: true, opacity: 0.92, additive: true }))
    rasRingA.scale.setScalar(0.32)
    rasRingA.rotation.x = 0.78
    const rasRingB = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0xe0f2fe, { transparent: true, opacity: 0.92, additive: true }))
    rasRingB.scale.setScalar(0.34)
    rasRingB.rotation.y = 0.85
    rasenganOrbGroup.add(rasCore, rasShell, rasRingA, rasRingB)
    rasenganOrbGroup.visible = Boolean(p.rasenganCharged) || p.characterId === 'naruto_clone'
    rightArm.add(rasenganOrbGroup)

    kuramaGroup = new THREE.Group()
    const cloakGlowMat = makeBasicMat(mats, 0xf97316, { transparent: true, opacity: 0.56, side: THREE.DoubleSide, additive: true })
    const tailGoldMat = makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.95, additive: true })
    const tailCoreMat = makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.99, additive: true })
    const truthOrbMat = makeBasicMat(mats, 0x09090b)

    const auraShell = new THREE.Mesh(gp.shieldSphere, cloakGlowMat)
    auraShell.scale.set(0.96, 1.32, 0.96)
    auraShell.position.set(0, 29, 0)
    const innerGoldShell = new THREE.Mesh(gp.shieldSphere, tailGoldMat)
    innerGoldShell.scale.set(0.76, 1.12, 0.76)
    innerGoldShell.position.set(0, 29, 0)
    kuramaGroup.add(auraShell, innerGoldShell)

    for (let g = 0; g < 6; g++) {
      const ga = (g * Math.PI) / 5 - Math.PI * 0.1
      const gx = Math.cos(ga) * 23
      const gy = 26 + Math.sin(ga) * 23
      const tOrb = new THREE.Mesh(gp.orb, truthOrbMat)
      tOrb.scale.setScalar(1.18)
      tOrb.position.set(gx, gy, -11)
      const tRim = new THREE.Mesh(gp.orb, tailGoldMat)
      tRim.scale.setScalar(1.42)
      tRim.position.set(gx, gy, -11)
      kuramaGroup.add(tOrb, tRim)
    }

    for (const sx of [-7.8, 7.8]) {
      const foxEar = new THREE.Mesh(gp.hairSpike, tailGoldMat)
      foxEar.scale.set(1.45, 1.85, 1.12)
      foxEar.position.set(sx, headY + 17, 1)
      foxEar.rotation.z = sx < 0 ? 0.34 : -0.34
      kuramaGroup.add(foxEar)
    }

    for (let t = 0; t < 9; t++) {
      const fan = (t - 4) * 0.25
      const tailPivot = new THREE.Group()
      tailPivot.position.set(0, 20, -10)
      tailPivot.rotation.set(-0.55 - Math.abs(t - 4) * 0.05, fan * 0.65, fan * 0.95)
      tailPivot.userData.tailIdx = t
      const segA = new THREE.Mesh(gp.katanaBlade, t % 2 === 0 ? tailGoldMat : tailCoreMat)
      segA.scale.set(2.85, 2.75, 1.26)
      segA.position.set(0, 5, -22)
      const tip = new THREE.Mesh(gp.hairSpike, tailCoreMat)
      tip.rotation.x = -Math.PI * 0.5
      tip.scale.set(1.65, 1.95, 1.65)
      tip.position.set(0, 7, -46)
      tailPivot.add(segA, tip)
      kuramaGroup.add(tailPivot)
    }
    kuramaGroup.visible = Boolean(p.godspeed)
    modelPivot.add(kuramaGroup)
  }

  if (cid === 'ajarn_boy') {
    throneGroup = new THREE.Group()
    const base = new THREE.Mesh(gp.torso, makeMat(mats, flashMaterials, 0x450a0a))
    base.scale.set(1.9, 0.72, 1.7)
    base.position.set(0, 12, -4)
    const back = new THREE.Mesh(gp.cloak, makeMat(mats, flashMaterials, 0x7f1d1d))
    back.scale.set(1.65, 1.5, 1.45)
    back.position.set(0, 32, -13)
    const lHorn = new THREE.Mesh(gp.hairSpike, makeMat(mats, flashMaterials, 0xf8fafc))
    lHorn.scale.set(1.5, 2.4, 1.5)
    lHorn.position.set(-23, 55, -13)
    lHorn.rotation.z = 0.42
    const rHorn = new THREE.Mesh(gp.hairSpike, makeMat(mats, flashMaterials, 0xf8fafc))
    rHorn.scale.set(1.5, 2.4, 1.5)
    rHorn.position.set(23, 55, -13)
    rHorn.rotation.z = -0.42
    throneGroup.add(base, back, lHorn, rHorn)
    for (const [skX, skZ] of [[-18, 8], [18, 8], [-22, -10], [22, -10]]) {
      const skull = new THREE.Mesh(gp.head, makeMat(mats, flashMaterials, 0xe2e8f0, { roughness: 0.4 }))
      skull.scale.setScalar(0.65)
      skull.position.set(skX, 8, skZ)
      const eyeL = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xef4444))
      eyeL.position.set(skX - 2, 9, skZ + 6)
      const eyeR = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xef4444))
      eyeR.position.set(skX + 2, 9, skZ + 6)
      throneGroup.add(skull, eyeL, eyeR)
    }
    throneGroup.visible = Boolean(p.seated)
    modelPivot.add(throneGroup)
  }

  // === 3. Signature Orbitals (Gate of Babylon, Limitless Spheres, Infinity Stones, Wukong Cloud, etc.) ===
  const orbCol = orbitalHintHex ?? profile.secondaryHex ?? accentColor
  if (cid !== 'boy' && cid !== 'naruto' && cid !== 'ajarn_boy' && cid !== 'kaem' && cid !== 'frame' && cid !== 'default') {
    extraOrbitalGroup = new THREE.Group()
    extraOrbitalGroup.position.y = 28

    if (cid === 'pa') {
      // Base crown glint aura subtly circling at shoulder height (Gates themselves are anchored behind back)
      for (const side of [-1, 1]) {
        const mote = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.8, additive: true }))
        mote.scale.setScalar(0.8)
        mote.position.set(side * 24, 6, 0)
        extraOrbitalGroup.add(mote)
      }
    } else if (cid === 'noone') {
      const cols = [0xa855f7, 0x3b82f6, 0xef4444, 0x10b981, 0xfacc15]
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5
        const gem = new THREE.Mesh(gp.orb, makeBasicMat(mats, cols[i], { additive: true }))
        gem.position.set(Math.cos(a) * 29, Math.sin(i * 1.4) * 3, Math.sin(a) * 29)
        extraOrbitalGroup.add(gem)
      }
      extraOrbitalGroup.visible = (p.infinityStones?.length ?? 0) >= 5
    } else if (cid === 'sia_mon') {
      const infRing = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0x38bdf8, { transparent: true, opacity: 0.52, additive: true }))
      infRing.rotation.x = Math.PI / 2
      infRing.scale.setScalar(1.08)
      const bOrb = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8, { additive: true }))
      bOrb.scale.setScalar(1.6)
      bOrb.position.set(31, 5, 0)
      const rOrb = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xef4444, { additive: true }))
      rOrb.scale.setScalar(1.6)
      rOrb.position.set(-31, -5, 0)
      extraOrbitalGroup.add(infRing, bOrb, rOrb)
    } else if (cid === 'wukong') {
      // Golden Somersault Cloud ring beneath Wukong's feet!
      const cloudMat = makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.85, additive: true })
      extraOrbitalGroup.position.y = 4
      for (let c = 0; c < 5; c++) {
        const a = (c / 5) * Math.PI * 2
        const puff = new THREE.Mesh(gp.orb, cloudMat)
        puff.scale.set(1.6, 0.9, 1.6)
        puff.position.set(Math.cos(a) * 14, 0, Math.sin(a) * 14)
        extraOrbitalGroup.add(puff)
      }
    } else if (cid === 'luangphi_sorn') {
      extraOrbitalGroup.position.set(0, 44, -8)
      const sacred = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.9, additive: true }))
      sacred.scale.set(0.75, 0.75, 0.75)
      extraOrbitalGroup.add(sacred)
    } else {
      const ring = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, orbCol, { transparent: true, opacity: 0.56, additive: true }))
      ring.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(ring)
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3
        const mote = new THREE.Mesh(gp.orb, makeBasicMat(mats, i % 2 === 0 ? accentColor : orbCol, { additive: true }))
        mote.scale.setScalar(0.85)
        mote.position.set(Math.cos(a) * 28, Math.sin(a * 2) * 3, Math.sin(a) * 28)
        extraOrbitalGroup.add(mote)
      }
    }
    modelPivot.add(extraOrbitalGroup)
  }

  return {
    companionGroup,
    throneGroup,
    extraOrbitalGroup,
    fastFistsGroup,
    kuramaGroup,
    rasenganOrbGroup,
    hogyokuGroup,
    gauntletGems,
    gauntletGemMats,
  }
}
