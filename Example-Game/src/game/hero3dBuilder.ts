import * as THREE from 'three'
import type { PlayerState } from '../types/game'
import { getGeoPool, makeBasicMat, makeMat, type HeroFlashMat } from './hero3dGeoPool'
import { buildHeroHairAndHead3D } from './hero3dHair'
import { buildHeroBodyAndOutfit3D } from './hero3dOutfits'
import { HERO3D_PROFILES } from './hero3dProfiles'
import { buildHeroWeaponAndExtras3D } from './hero3dWeapons'
import { ROSTER28_MAP } from './roster28Meta'

export interface HeroRig3D {
  id: string
  characterId: string
  root: THREE.Group
  modelPivot: THREE.Group
  bodyPivot: THREE.Group
  headGroup?: THREE.Group
  leftLeg: THREE.Mesh
  rightLeg: THREE.Mesh
  leftArm: THREE.Group
  rightArm: THREE.Group
  shadowDisc: THREE.Mesh
  floorRing: THREE.Mesh
  dirChevron: THREE.Mesh
  statusHalo: THREE.Mesh
  shieldSphere: THREE.Mesh
  capePivot?: THREE.Group
  companionGroup?: THREE.Group
  throneGroup?: THREE.Group
  extraOrbitalGroup?: THREE.Group
  fastFistsGroup?: THREE.Group
  kuramaGroup?: THREE.Group
  rasenganOrbGroup?: THREE.Group
  hogyokuGroup?: THREE.Group
  gauntletGems?: THREE.Mesh[]
  gauntletGemMats?: THREE.MeshStandardMaterial[]
  flashMaterials: HeroFlashMat[]
  materialsToDispose: THREE.Material[]
  isDummy: boolean
  wasMovedDist: number
  walkPhase: number
  attackSwingUntil: number
  attackSwingSide: number
  castAnimUntil: number
  castAnimSlot: number
  hitFlashUntil: number
  hitFlashActive: boolean
  leapUntil: number
  lastTeamRingColor: number
  lastJumpLift: number
  afterimageCooldown: number
}

/** Updates 90ms White-Gold Combat Hit-Flash on a 3D Hero Rig with zero allocations. */
export function updateHeroHitFlash3D(rig: HeroRig3D, nowMs: number): void {
  const wantFlash = nowMs < rig.hitFlashUntil
  if (wantFlash === rig.hitFlashActive) return
  rig.hitFlashActive = wantFlash
  for (const item of rig.flashMaterials) {
    if (wantFlash) {
      item.mat.emissive.setHex(0xffffff)
      item.mat.emissiveIntensity = 0.92
    } else {
      item.mat.emissive.setHex(item.baseEmissive)
      item.mat.emissiveIntensity = item.baseIntensity
    }
  }
}

/**
 * Animates hero-specific breathing, idle weapon readiness stances, and skill cast motions
 * shared between the 3D Hero Showroom Turntable and the live 3D Arena.
 */
export function animateHeroPose3D(rig: HeroRig3D, nowMs: number, isMoving: boolean): void {
  const cid = rig.characterId
  const breath = Math.sin(nowMs * 0.0038)

  if (!isMoving) {
    if (cid === 'sia_mon') {
      rig.bodyPivot.position.y = 3.5 + breath * 2.2
      rig.leftArm.rotation.z = 0.18
      rig.rightArm.rotation.z = -0.22
    } else if (cid === 'krasue') {
      rig.bodyPivot.position.y = 8.0 + breath * 2.8
      rig.bodyPivot.rotation.z = Math.sin(nowMs * 0.0022) * 0.06
    } else if (cid === 'wukong' || cid === 'nezha') {
      rig.bodyPivot.position.y = 4.5 + breath * 2.0
      rig.rightArm.rotation.x = -0.45 + breath * 0.06
      rig.leftArm.rotation.z = 0.22
    } else if (cid === 'doraemon' || cid === 'iron_man') {
      rig.bodyPivot.position.y = 2.8 + breath * 1.9
      rig.leftArm.rotation.z = 0.16
      rig.rightArm.rotation.z = -0.16
    } else if (cid === 'jinwoo') {
      rig.bodyPivot.position.y = breath * 1.3
      rig.leftArm.rotation.x = -0.42 + breath * 0.06
      rig.rightArm.rotation.x = -0.52 - breath * 0.06
      rig.leftArm.rotation.z = 0.24
      rig.rightArm.rotation.z = -0.24
    } else if (cid === 'igris' || cid === 'escanor') {
      rig.bodyPivot.position.y = 1.2 + breath * 1.5
      rig.rightArm.rotation.x = -0.62 + breath * 0.05
      rig.leftArm.rotation.x = -0.28
      rig.rightArm.rotation.z = -0.18
    } else if (cid === 'sanji') {
      rig.bodyPivot.position.y = breath * 1.2
      rig.leftArm.rotation.z = -0.14
      rig.rightArm.rotation.z = 0.14
      rig.rightLeg.rotation.x = -0.18 + breath * 0.05
    } else if (cid === 'thanwa' || cid === 'ko' || cid === 'law' || cid === 'yami') {
      rig.bodyPivot.position.y = breath * 1.3
      rig.rightArm.rotation.x = -0.48 + breath * 0.05
      rig.leftArm.rotation.x = -0.28
    } else if (cid === 'simo' || cid === 'ben10') {
      rig.bodyPivot.position.y = breath * 1.2
      rig.rightArm.rotation.x = -0.58 + breath * 0.04
      rig.leftArm.rotation.x = -0.45
    } else if (cid === 'aizen') {
      rig.bodyPivot.position.y = 2.6 + breath * 1.8
      rig.leftArm.rotation.z = 0.14
      rig.rightArm.rotation.x = -0.34 + breath * 0.04
    } else if (cid === 'toriko' || cid === 'po' || cid === 'garp' || cid === 'adam') {
      rig.bodyPivot.position.y = breath * 1.2
      rig.leftArm.rotation.x = -0.58 + breath * 0.05
      rig.rightArm.rotation.x = -0.68 - breath * 0.05
    } else if (cid === 'krahang') {
      rig.bodyPivot.position.y = 3.2 + breath * 2.2
      rig.leftArm.rotation.z = 0.42 + breath * 0.12
      rig.rightArm.rotation.z = -0.42 - breath * 0.12
    } else if (cid === 'frieren' || cid === 'buddha' || cid === 'beelzebub') {
      rig.bodyPivot.position.y = 1.6 + breath * 1.6
      rig.rightArm.rotation.x = -0.48 + breath * 0.04
      rig.leftArm.rotation.z = 0.12
    } else {
      rig.bodyPivot.position.y = breath * 1.5
    }
  }

  if (rig.headGroup) {
    rig.headGroup.rotation.y = Math.sin(nowMs * 0.0019) * 0.07
    rig.headGroup.rotation.x = Math.cos(nowMs * 0.0028) * 0.04
  }

  if (nowMs < rig.castAnimUntil) {
    const prog = 1 - (rig.castAnimUntil - nowMs) / 340
    const pulse = Math.sin(prog * Math.PI)
    if (rig.castAnimSlot === 3) {
      rig.leftArm.rotation.x = -2.1 * pulse
      rig.rightArm.rotation.x = -2.1 * pulse
      rig.leftArm.rotation.z = 0.55 * pulse
      rig.rightArm.rotation.z = -0.55 * pulse
      rig.bodyPivot.position.y += 6.5 * pulse
    } else if (rig.castAnimSlot === 2) {
      rig.bodyPivot.rotation.y = Math.sin(prog * Math.PI * 2) * 0.65
      rig.rightArm.rotation.x = -1.75 * pulse
      rig.leftArm.rotation.x = -1.1 * pulse
    } else {
      rig.rightArm.rotation.x = -1.65 * pulse
      rig.bodyPivot.rotation.y = 0.45 * pulse
    }
  }
}

export function buildHeroRig3D(p: PlayerState, isMe: boolean, initialRingColor: number): HeroRig3D {
  const gp = getGeoPool()
  const mats: THREE.Material[] = []
  const flashMaterials: HeroFlashMat[] = []

  const root = new THREE.Group()
  root.position.set(p.x, 0, p.y)

  const shadowDisc = new THREE.Mesh(
    gp.shadow,
    makeBasicMat(mats, 0x020617, { transparent: true, opacity: 0.55 }),
  )
  shadowDisc.position.y = 0.7
  root.add(shadowDisc)

  const floorRing = new THREE.Mesh(
    gp.floorRing,
    makeBasicMat(mats, initialRingColor, { transparent: true, opacity: isMe ? 0.96 : 0.8, side: THREE.DoubleSide }),
  )
  floorRing.position.y = 1.1
  root.add(floorRing)

  const statusHalo = new THREE.Mesh(
    gp.statusHalo,
    makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.0, side: THREE.DoubleSide, additive: true }),
  )
  statusHalo.position.y = 1.6
  statusHalo.visible = false
  root.add(statusHalo)

  const shieldSphere = new THREE.Mesh(
    gp.shieldSphere,
    makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, additive: true }),
  )
  shieldSphere.position.y = 26
  shieldSphere.visible = false
  root.add(shieldSphere)

  const modelPivot = new THREE.Group()
  root.add(modelPivot)

  const dirChevron = new THREE.Mesh(
    gp.chevron,
    makeBasicMat(mats, isMe ? 0x38bdf8 : initialRingColor, { transparent: true, opacity: 0.94 }),
  )
  dirChevron.position.set(0, 2.0, 31)
  modelPivot.add(dirChevron)

  const bodyPivot = new THREE.Group()
  modelPivot.add(bodyPivot)

  const leftLeg = new THREE.Mesh(gp.limb, makeMat(mats, flashMaterials, 0x1e293b))
  const rightLeg = new THREE.Mesh(gp.limb, makeMat(mats, flashMaterials, 0x1e293b))
  const leftArm = new THREE.Group()
  const rightArm = new THREE.Group()

  if (p.isDummy && p.characterId !== 'igris' && p.characterId !== 'naruto_clone') {
    const dummyBody = new THREE.Mesh(gp.dummyBarrel, makeMat(mats, flashMaterials, 0x92400e, { roughness: 0.48 }))
    dummyBody.position.y = 24
    bodyPivot.add(dummyBody)

    const woodPost = new THREE.Mesh(gp.limb, makeMat(mats, flashMaterials, 0x451a03))
    woodPost.position.y = 8
    bodyPivot.add(woodPost)

    const head = new THREE.Mesh(gp.head, makeMat(mats, flashMaterials, 0xd97706, { roughness: 0.35 }))
    head.position.y = 48
    bodyPivot.add(head)

    const bOut = new THREE.Mesh(gp.bullseyeOuter, makeBasicMat(mats, 0xffffff, { side: THREE.DoubleSide }))
    bOut.position.set(0, 25, 13.7)
    const bMid = new THREE.Mesh(gp.bullseyeMid, makeBasicMat(mats, 0xdc2626, { side: THREE.DoubleSide }))
    bMid.position.set(0, 25, 14.0)
    const bCore = new THREE.Mesh(gp.bullseyeCore, makeBasicMat(mats, 0xffffff, { side: THREE.DoubleSide }))
    bCore.position.set(0, 25, 14.3)
    bodyPivot.add(bOut, bMid, bCore)

    leftLeg.visible = false
    rightLeg.visible = false
    bodyPivot.add(leftLeg, rightLeg, leftArm, rightArm)

    return {
      id: p.id,
      characterId: p.characterId,
      root,
      modelPivot,
      bodyPivot,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      shadowDisc,
      floorRing,
      dirChevron,
      statusHalo,
      shieldSphere,
      flashMaterials,
      materialsToDispose: mats,
      isDummy: true,
      wasMovedDist: 0,
      walkPhase: 0,
      attackSwingUntil: 0,
      attackSwingSide: 1,
      castAnimUntil: 0,
      castAnimSlot: 1,
      hitFlashUntil: 0,
      hitFlashActive: false,
      leapUntil: 0,
      lastTeamRingColor: initialRingColor,
      lastJumpLift: 0,
      afterimageCooldown: 0,
    }
  }

  const cid = p.characterId === 'naruto_clone' ? 'naruto' : p.characterId
  const r28 = ROSTER28_MAP[cid]
  const baseColor = Number.parseInt(p.color.replace('#', ''), 16) || 0x38bdf8
  const accentColor = Number.parseInt((p.accentColor || '#FACC15').replace('#', ''), 16) || 0xfacc15
  const profile = HERO3D_PROFILES[cid] ?? {
    ...HERO3D_PROFILES.default,
    suitHex: r28?.suitHex ?? baseColor,
    pantsHex: r28?.pantsHex ?? 0x1e293b,
    bootHex: r28?.bootHex ?? 0x09090b,
    hairHex: r28?.hairHex ?? baseColor,
    eyeHex: r28?.eyeHex ?? 0x38bdf8,
  }

  const bodyResult = buildHeroBodyAndOutfit3D(
    cid,
    profile,
    gp,
    mats,
    flashMaterials,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    accentColor,
  )

  if (profile.bodyType !== 'spectral_floating') {
    bodyPivot.add(leftArm, rightArm)
  }

  const headGroup = buildHeroHairAndHead3D(cid, profile, gp, mats, flashMaterials, bodyPivot, bodyResult.headY)

  const extras = buildHeroWeaponAndExtras3D(
    cid,
    p,
    profile,
    gp,
    mats,
    flashMaterials,
    modelPivot,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    bodyResult.headY,
    accentColor,
    r28?.orbitalHex,
  )

  return {
    id: p.id,
    characterId: p.characterId,
    root,
    modelPivot,
    bodyPivot,
    headGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    shadowDisc,
    floorRing,
    dirChevron,
    statusHalo,
    shieldSphere,
    capePivot: bodyResult.capePivot,
    companionGroup: extras.companionGroup,
    throneGroup: extras.throneGroup,
    extraOrbitalGroup: extras.extraOrbitalGroup,
    fastFistsGroup: extras.fastFistsGroup,
    kuramaGroup: extras.kuramaGroup,
    rasenganOrbGroup: extras.rasenganOrbGroup,
    hogyokuGroup: extras.hogyokuGroup,
    gauntletGems: extras.gauntletGems,
    gauntletGemMats: extras.gauntletGemMats,
    flashMaterials,
    materialsToDispose: mats,
    isDummy: false,
    wasMovedDist: 0,
    walkPhase: Math.random() * Math.PI * 2,
    attackSwingUntil: 0,
    attackSwingSide: 1,
    castAnimUntil: 0,
    castAnimSlot: 1,
    hitFlashUntil: 0,
    hitFlashActive: false,
    leapUntil: 0,
    lastTeamRingColor: initialRingColor,
    lastJumpLift: 0,
    afterimageCooldown: 0,
  }
}

export function disposeHeroRig3D(rig: HeroRig3D): void {
  for (const m of rig.materialsToDispose) {
    m.dispose()
  }
  rig.materialsToDispose.length = 0
  rig.flashMaterials.length = 0
}
