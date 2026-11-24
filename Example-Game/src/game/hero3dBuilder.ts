import * as THREE from 'three'
import type { PlayerState } from '../types/game'

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
  gauntletGems?: THREE.Mesh[]
  gauntletGemMats?: THREE.MeshStandardMaterial[]
  flashMaterials: Array<{ mat: THREE.MeshStandardMaterial; baseEmissive: number; baseIntensity: number }>
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

// Shared static geometries created ONCE per module load (zero allocation per spawn/frame!)
let geoPool: {
  shadow: THREE.CircleGeometry
  floorRing: THREE.RingGeometry
  chevron: THREE.ConeGeometry
  statusHalo: THREE.RingGeometry
  shieldSphere: THREE.SphereGeometry
  torso: THREE.CylinderGeometry
  waist: THREE.CylinderGeometry
  titanTorso: THREE.CylinderGeometry
  neck: THREE.CylinderGeometry
  pauldron: THREE.SphereGeometry
  sash: THREE.CylinderGeometry
  buckle: THREE.BoxGeometry
  head: THREE.SphereGeometry
  chin: THREE.ConeGeometry
  hairCrown: THREE.SphereGeometry
  helmetBand: THREE.CylinderGeometry
  hairSpike: THREE.ConeGeometry
  visor: THREE.BoxGeometry
  eyeWhite: THREE.SphereGeometry
  eyeDot: THREE.SphereGeometry
  eyeGlint: THREE.SphereGeometry
  brow: THREE.BoxGeometry
  limb: THREE.CapsuleGeometry
  boot: THREE.BoxGeometry
  arm: THREE.CapsuleGeometry
  glove: THREE.SphereGeometry
  cloak: THREE.BoxGeometry
  katanaBlade: THREE.BoxGeometry
  katanaGuard: THREE.CylinderGeometry
  orb: THREE.SphereGeometry
  haloRing: THREE.TorusGeometry
  dummyBarrel: THREE.CylinderGeometry
  bullseyeOuter: THREE.CircleGeometry
  bullseyeMid: THREE.CircleGeometry
  bullseyeCore: THREE.CircleGeometry
} | null = null

function getGeoPool() {
  if (geoPool) return geoPool
  geoPool = {
    shadow: new THREE.CircleGeometry(23, 24),
    floorRing: new THREE.RingGeometry(21, 27.5, 32),
    chevron: new THREE.ConeGeometry(7.8, 14.5, 3),
    statusHalo: new THREE.RingGeometry(28.5, 34.5, 32),
    shieldSphere: new THREE.SphereGeometry(34, 20, 16),
    // Sculpted Anime V-Tapered Upper Chest + Waist/Pelvis instead of blocky boxes!
    torso: new THREE.CylinderGeometry(11.2, 8.4, 14.5, 16),
    waist: new THREE.CylinderGeometry(8.2, 9.6, 9.0, 16),
    titanTorso: new THREE.CylinderGeometry(15.2, 11.4, 24, 18),
    neck: new THREE.CylinderGeometry(3.6, 4.3, 5.2, 12),
    pauldron: new THREE.SphereGeometry(5.8, 12, 10),
    sash: new THREE.CylinderGeometry(9.9, 10.3, 4.8, 16),
    buckle: new THREE.BoxGeometry(5.8, 4.6, 2.4),
    head: new THREE.SphereGeometry(10.6, 22, 18),
    chin: new THREE.ConeGeometry(7.4, 6.2, 14),
    hairCrown: new THREE.SphereGeometry(11.3, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.64),
    helmetBand: new THREE.CylinderGeometry(11.35, 11.35, 4.4, 18),
    hairSpike: new THREE.ConeGeometry(4.2, 14.2, 8),
    visor: new THREE.BoxGeometry(15, 4.8, 4),
    eyeWhite: new THREE.SphereGeometry(2.3, 10, 8),
    eyeDot: new THREE.SphereGeometry(1.65, 10, 8),
    eyeGlint: new THREE.SphereGeometry(0.65, 6, 6),
    brow: new THREE.BoxGeometry(4.0, 0.95, 1.2),
    // Smooth Sculpted Capsule Limbs + Stylized Combat Boots!
    limb: new THREE.CapsuleGeometry(3.6, 9.2, 6, 12),
    boot: new THREE.BoxGeometry(7.2, 5.2, 9.8),
    arm: new THREE.CapsuleGeometry(3.15, 9.8, 6, 12),
    glove: new THREE.SphereGeometry(5.0, 12, 10),
    cloak: new THREE.BoxGeometry(24, 27, 3.2),
    katanaBlade: new THREE.BoxGeometry(2.0, 2.6, 39),
    katanaGuard: new THREE.CylinderGeometry(3.8, 3.8, 1.6, 12),
    orb: new THREE.SphereGeometry(3.4, 12, 10),
    haloRing: new THREE.TorusGeometry(28, 1.35, 8, 32),
    dummyBarrel: new THREE.CylinderGeometry(13.5, 12.5, 34, 16),
    bullseyeOuter: new THREE.CircleGeometry(9, 18),
    bullseyeMid: new THREE.CircleGeometry(5.6, 16),
    bullseyeCore: new THREE.CircleGeometry(2.6, 14),
  }
  geoPool.shadow.rotateX(-Math.PI / 2)
  geoPool.floorRing.rotateX(-Math.PI / 2)
  geoPool.statusHalo.rotateX(-Math.PI / 2)
  geoPool.chevron.rotateX(Math.PI / 2)
  geoPool.chin.rotateX(Math.PI)
  geoPool.katanaGuard.rotateX(Math.PI / 2)
  return geoPool
}

function makeMat(
  mats: THREE.Material[],
  flashList: Array<{ mat: THREE.MeshStandardMaterial; baseEmissive: number; baseIntensity: number }>,
  color: number,
  opts?: {
    emissive?: number
    emissiveIntensity?: number
    roughness?: number
    metalness?: number
    transparent?: boolean
    opacity?: number
  },
): THREE.MeshStandardMaterial {
  // Subtle anime cel-rim self-illumination so every character pops vividly against any map floor
  const defaultEmissive = opts?.emissive ?? color
  const defaultIntensity = opts?.emissive !== undefined ? (opts.emissiveIntensity ?? 0.25) : 0.11
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.34,
    metalness: opts?.metalness ?? 0.18,
    emissive: defaultEmissive,
    emissiveIntensity: defaultIntensity,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
  })
  mats.push(m)
  if (!opts?.transparent) {
    flashList.push({ mat: m, baseEmissive: defaultEmissive, baseIntensity: defaultIntensity })
  }
  return m
}

function makeBasicMat(
  mats: THREE.Material[],
  color: number,
  opts?: { transparent?: boolean; opacity?: number; side?: THREE.Side; additive?: boolean },
): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: opts?.transparent ?? Boolean(opts?.additive),
    opacity: opts?.opacity ?? 1,
    side: opts?.side ?? THREE.FrontSide,
    blending: opts?.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: opts?.transparent || opts?.additive ? false : true,
  })
  mats.push(m)
  return m
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
    // Distinct per-hero idle stances
    if (cid === 'sia_mon') {
      // Gojo Satoru: Levitating Six-Eyes float + relaxed confident arms
      rig.bodyPivot.position.y = 3.5 + breath * 2.2
      rig.leftArm.rotation.z = 0.18
      rig.rightArm.rotation.z = -0.22
    } else if (cid === 'jinwoo') {
      // Sung Jin-Woo: Dual-dagger reverse assassin crouch-ready stance
      rig.bodyPivot.position.y = breath * 1.3
      rig.leftArm.rotation.x = -0.42 + breath * 0.06
      rig.rightArm.rotation.x = -0.52 - breath * 0.06
      rig.leftArm.rotation.z = 0.24
      rig.rightArm.rotation.z = -0.24
    } else if (cid === 'sanji') {
      // Sanji: Hands-in-pocket gentleman lean + glowing kick leg ready
      rig.bodyPivot.position.y = breath * 1.2
      rig.leftArm.rotation.z = -0.14
      rig.rightArm.rotation.z = 0.14
      rig.rightLeg.rotation.x = -0.18 + breath * 0.05
    } else if (cid === 'thanwa' || cid === 'ko') {
      // Zoro / Zenitsu: Katana sword-draw iaijutsu guard
      rig.bodyPivot.position.y = breath * 1.3
      rig.rightArm.rotation.x = -0.48 + breath * 0.05
      rig.leftArm.rotation.x = -0.28
    } else if (cid === 'simo' || cid === 'ben10') {
      // Simo / Ben 10: Tactical rifle/Omnitrix aim guard
      rig.bodyPivot.position.y = breath * 1.2
      rig.rightArm.rotation.x = -0.58 + breath * 0.04
      rig.leftArm.rotation.x = -0.45
    } else {
      rig.bodyPivot.position.y = breath * 1.5
    }
  }

  if (rig.headGroup) {
    rig.headGroup.rotation.y = Math.sin(nowMs * 0.0019) * 0.07
    rig.headGroup.rotation.x = Math.cos(nowMs * 0.0028) * 0.04
  }

  // Active Skill Cast Motion Override (Q/E/R expressive 3D cast animations!)
  if (nowMs < rig.castAnimUntil) {
    const prog = 1 - (rig.castAnimUntil - nowMs) / 340
    const pulse = Math.sin(prog * Math.PI)
    if (rig.castAnimSlot === 3) {
      // Ultimate (R): High-impact double-arm power surge + upward chest tilt!
      rig.leftArm.rotation.x = -2.1 * pulse
      rig.rightArm.rotation.x = -2.1 * pulse
      rig.leftArm.rotation.z = 0.55 * pulse
      rig.rightArm.rotation.z = -0.55 * pulse
      rig.bodyPivot.position.y += 6.5 * pulse
    } else if (rig.castAnimSlot === 2) {
      // Skill 2 (E): Dynamic spin / thrust slash
      rig.bodyPivot.rotation.y = Math.sin(prog * Math.PI * 2) * 0.65
      rig.rightArm.rotation.x = -1.75 * pulse
      rig.leftArm.rotation.x = -1.1 * pulse
    } else {
      // Skill 1 (Q): Fast forward strike / projectile release
      rig.rightArm.rotation.x = -1.65 * pulse
      rig.bodyPivot.rotation.y = 0.45 * pulse
    }
  }
}

export function buildHeroRig3D(p: PlayerState, isMe: boolean, initialRingColor: number): HeroRig3D {
  const gp = getGeoPool()
  const mats: THREE.Material[] = []
  const flashMaterials: Array<{ mat: THREE.MeshStandardMaterial; baseEmissive: number; baseIntensity: number }> = []

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

  if (p.isDummy) {
    const dummyBody = new THREE.Mesh(gp.dummyBarrel, makeMat(mats, flashMaterials, 0x92400e, { roughness: 0.48 }))
    dummyBody.position.y = 24
    bodyPivot.add(dummyBody)

    const woodPost = new THREE.Mesh(gp.limb, makeMat(mats, flashMaterials, 0x451a03))
    woodPost.position.y = 8
    bodyPivot.add(woodPost)

    const head = new THREE.Mesh(gp.head, makeMat(mats, flashMaterials, 0xd97706, { roughness: 0.35 }))
    head.position.y = 48
    bodyPivot.add(head)

    // Crisp Concentric Red-White Bullseye on front of Training Dummy
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

  const cid = p.characterId
  const baseColor = Number.parseInt(p.color.replace('#', ''), 16) || 0x38bdf8
  const accentColor = Number.parseInt((p.accentColor || '#FACC15').replace('#', ''), 16) || 0xfacc15
  const skinHex = cid === 'default' ? baseColor : cid === 'noone' ? 0x9333ea : 0xfde0c4
  const suitHex =
    cid === 'pa'
      ? 0xf59e0b
      : cid === 'boy'
        ? 0xf97316
        : cid === 'ole'
          ? 0x111827
          : cid === 'thanwa'
            ? 0x065f46
            : cid === 'ajarn_au'
              ? 0x1e3a8a
              : cid === 'ajarn_boy'
                ? 0xfef2f2
                : cid === 'kaem'
                  ? 0x0f172a
                  : cid === 'frame'
                    ? 0x1e1b4b
                    : cid === 'luangphi_sorn'
                      ? 0xf59e0b
                      : cid === 'sia_mon'
                        ? 0x0f172a
                        : cid === 'ko'
                          ? 0xf59e0b
                          : cid === 'noone'
                            ? 0x1e1b4b
                            : cid === 'simo'
                              ? 0xf8fafc
                              : cid === 'jinwoo'
                                ? 0x0f172a
                                : cid === 'naruto'
                                  ? 0xf97316
                                  : cid === 'sanji'
                                    ? 0x0f172a
                                    : cid === 'luffy'
                                      ? 0xdc2626
                                      : cid === 'ben10'
                                        ? 0x16a34a
                                        : cid === 'diablo'
                                          ? 0x09090b
                                          : baseColor

  const pantsHex =
    cid === 'boy' || cid === 'luffy'
      ? 0x1d4ed8
      : cid === 'simo'
        ? 0xe2e8f0
        : cid === 'naruto'
          ? 0xea580c
          : cid === 'ben10'
            ? 0x1e293b
            : cid === 'luangphi_sorn'
              ? 0xf59e0b
              : cid === 'ko' || cid === 'thanwa' || cid === 'sia_mon' || cid === 'jinwoo' || cid === 'sanji' || cid === 'diablo'
                ? 0x0f172a
                : 0x1e293b

  const bootHex =
    cid === 'luangphi_sorn' || cid === 'luffy'
      ? 0xdc2626
      : cid === 'pa' || cid === 'noone'
        ? 0xfacc15
        : cid === 'boy' || cid === 'naruto'
          ? 0x1e3a8a
          : cid === 'simo'
            ? 0xcbd5e1
            : 0x09090b

  ;(leftLeg.material as THREE.MeshStandardMaterial).color.setHex(pantsHex)
  ;(rightLeg.material as THREE.MeshStandardMaterial).color.setHex(pantsHex)
  leftLeg.position.set(-5.4, 8.2, 0)
  rightLeg.position.set(5.4, 8.2, 0)

  // Stylized Combat Boots attached to each leg
  const bootMat = makeMat(mats, flashMaterials, bootHex, { roughness: 0.35, metalness: 0.25 })
  const lBoot = new THREE.Mesh(gp.boot, bootMat)
  lBoot.position.set(0, -5.8, 1.4)
  leftLeg.add(lBoot)
  const rBoot = new THREE.Mesh(gp.boot, bootMat)
  rBoot.position.set(0, -5.8, 1.4)
  rightLeg.add(rBoot)

  bodyPivot.add(leftLeg, rightLeg)

  // Sculpted Anime V-Tapered Upper Chest + Waist/Pelvis + Shoulder Caps
  const isTitan = cid === 'noone'
  const suitMat = makeMat(mats, flashMaterials, suitHex, {
    metalness: cid === 'pa' || isTitan ? 0.62 : 0.2,
    roughness: cid === 'pa' || isTitan ? 0.24 : 0.38,
  })
  const torso = new THREE.Mesh(isTitan ? gp.titanTorso : gp.torso, suitMat)
  torso.scale.set(1.0, 1.0, 0.68)
  torso.position.y = isTitan ? 27.5 : 28.2
  bodyPivot.add(torso)

  if (!isTitan) {
    const waist = new THREE.Mesh(gp.waist, suitMat)
    waist.scale.set(1.0, 1.0, 0.68)
    waist.position.y = 18.2
    bodyPivot.add(waist)
  }

  // Sculpted Shoulder Deltoid / Jacket Caps + Belt Sash + Metallic Buckle
  const shoulderCol =
    cid === 'naruto' || cid === 'kaem' || cid === 'diablo'
      ? 0x09090b
      : cid === 'noone' || cid === 'pa'
        ? 0xfacc15
        : suitHex
  const shoulderMat = makeMat(mats, flashMaterials, shoulderCol, {
    metalness: cid === 'pa' || isTitan ? 0.72 : 0.24,
    roughness: 0.32,
  })
  for (const sx of [isTitan ? -15.5 : -11.8, isTitan ? 15.5 : 11.8]) {
    const shCap = new THREE.Mesh(gp.pauldron, shoulderMat)
    shCap.scale.set(1.05, 0.88, 0.95)
    shCap.position.set(sx, isTitan ? 35.5 : 33.4, 0)
    bodyPivot.add(shCap)
  }

  const beltCol =
    cid === 'thanwa'
      ? 0x10b981
      : cid === 'boy'
        ? 0x0284c7
        : cid === 'luffy' || cid === 'pa' || cid === 'noone' || cid === 'diablo' || cid === 'kaem' || cid === 'frame'
          ? 0xfacc15
          : cid === 'jinwoo'
            ? 0x7c3aed
            : 0x1e293b
  const belt = new THREE.Mesh(gp.sash, makeMat(mats, flashMaterials, beltCol, { metalness: 0.45, roughness: 0.35 }))
  belt.scale.set(1.02, 1.0, 0.7)
  belt.position.set(0, 16.5, 0)
  const buckle = new THREE.Mesh(gp.buckle, makeMat(mats, flashMaterials, accentColor, { metalness: 0.82, roughness: 0.2 }))
  buckle.position.set(0, 16.5, 7.2)
  bodyPivot.add(belt, buckle)

  // Sculpted Neck connecting chest to head
  const neck = new THREE.Mesh(gp.neck, makeMat(mats, flashMaterials, skinHex, { roughness: 0.38 }))
  neck.position.set(0, isTitan ? 39 : 36.8, 0)
  bodyPivot.add(neck)

  // Animated Cape / Coat Tails
  let capePivot: THREE.Group | undefined
  if (
    cid === 'luangphi_sorn' ||
    cid === 'ole' ||
    cid === 'kaem' ||
    cid === 'ko' ||
    cid === 'frame' ||
    cid === 'simo' ||
    cid === 'jinwoo' ||
    cid === 'diablo' ||
    cid === 'pa'
  ) {
    capePivot = new THREE.Group()
    capePivot.position.set(0, 35, -6.5)
    const cloakCol =
      cid === 'luangphi_sorn' || cid === 'simo'
        ? 0xf8fafc
        : cid === 'pa'
          ? 0xdc2626
          : cid === 'ko'
            ? 0xfacc15
            : cid === 'kaem'
              ? 0x7dd3fc
              : cid === 'frame'
                ? 0x312e81
                : cid === 'jinwoo'
                  ? 0x1e1b4b
                  : cid === 'diablo'
                    ? 0x180407
                    : 0x111827
    const cloakMesh = new THREE.Mesh(
      gp.cloak,
      makeMat(mats, flashMaterials, cloakCol, {
        emissive:
          cid === 'ko'
            ? 0x92400e
            : cid === 'kaem'
              ? 0x0284c7
              : cid === 'jinwoo'
                ? 0x4c1d95
                : cid === 'diablo' || cid === 'pa'
                  ? 0x7f1d1d
                  : 0x000000,
        emissiveIntensity: cid === 'ko' || cid === 'jinwoo' || cid === 'diablo' || cid === 'pa' ? 0.32 : cid === 'kaem' ? 0.22 : 0.08,
      }),
    )
    cloakMesh.position.set(0, -12, -1)
    capePivot.add(cloakMesh)

    if (cid === 'ole') {
      for (const [cxOff, cyOff] of [[-5, -9], [5, -16]]) {
        const cloud = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xdc2626))
        cloud.scale.set(0.95, 0.55, 0.5)
        cloud.position.set(cxOff, cyOff, -2.5)
        capePivot.add(cloud)
      }
    } else if (cid === 'ko') {
      for (const sx of [-6, 6]) {
        const tri = new THREE.Mesh(gp.hairSpike, makeBasicMat(mats, 0xffffff))
        tri.scale.set(0.9, 0.7, 0.4)
        tri.position.set(sx, -21, -2.6)
        capePivot.add(tri)
      }
    }
    bodyPivot.add(capePivot)
  }

  // Distinct Chest Armor / Outfit Details
  if (cid === 'noone') {
    const plate = new THREE.Mesh(
      gp.torso,
      makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.78, roughness: 0.2, emissive: 0x78350f, emissiveIntensity: 0.3 }),
    )
    plate.scale.set(0.94, 0.78, 0.78)
    plate.position.set(0, 29, 1.4)
    bodyPivot.add(plate)
  } else if (cid === 'kaem') {
    const collar = new THREE.Mesh(gp.sash, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.65 }))
    collar.scale.set(1.06, 0.9, 0.78)
    collar.position.set(0, 34.5, 0)
    bodyPivot.add(collar)
  } else if (cid === 'frame') {
    const strap = new THREE.Mesh(gp.sash, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85 }))
    strap.scale.set(1.04, 0.8, 0.75)
    strap.position.set(0, 31, 0)
    strap.rotation.z = 0.24
    bodyPivot.add(strap)
  } else if (cid === 'naruto') {
    const panel = new THREE.Mesh(gp.sash, makeMat(mats, flashMaterials, 0x0f172a, { roughness: 0.42 }))
    panel.scale.set(1.12, 1.35, 0.78)
    panel.position.set(0, 33.5, 0)
    bodyPivot.add(panel)
  } else if (cid === 'sanji') {
    const tie = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0xfacc15, { roughness: 0.35 }))
    tie.scale.set(0.24, 3.1, 0.7)
    tie.position.set(0, 27.5, 7.6)
    bodyPivot.add(tie)
    for (const leg of [leftLeg, rightLeg]) {
      const flameBoot = new THREE.Mesh(
        gp.orb,
        makeBasicMat(mats, 0x38bdf8, { transparent: true, opacity: 0.82, additive: true }),
      )
      flameBoot.scale.set(1.5, 1.3, 1.7)
      flameBoot.position.set(0, -6, 1.8)
      leg.add(flameBoot)
    }
  } else if (cid === 'luffy') {
    const cloudMat = makeBasicMat(mats, 0xf8fafc, { transparent: true, opacity: 0.88, additive: true })
    for (const [cxOff, cyOff, czOff] of [[-13, 36, -5], [13, 36, -5], [0, 40, -10], [-9, 39, -8], [9, 39, -8]] as const) {
      const puff = new THREE.Mesh(gp.orb, cloudMat)
      puff.scale.setScalar(1.38)
      puff.position.set(cxOff, cyOff, czOff)
      bodyPivot.add(puff)
    }
  } else if (cid === 'ben10') {
    const stripe = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0xf8fafc, { roughness: 0.3 }))
    stripe.scale.set(0.32, 4.4, 0.7)
    stripe.position.set(4.5, 26, 7.6)
    bodyPivot.add(stripe)
  } else if (cid === 'diablo') {
    const cravat = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0xdc2626, { emissive: 0x7f1d1d, emissiveIntensity: 0.45 }))
    cravat.scale.set(0.35, 2.8, 0.75)
    cravat.position.set(0, 29, 7.7)
    bodyPivot.add(cravat)
  }

  // Articulated Sculpted Capsule Arms + Hands/Gloves + Signature Weapons
  leftArm.position.set(isTitan ? -16.8 : -13.2, isTitan ? 35 : 33.2, 0)
  rightArm.position.set(isTitan ? 16.8 : 13.2, isTitan ? 35 : 33.2, 0)

  const armCol = isTitan ? 0x9333ea : cid === 'ko' ? 0xf59e0b : suitHex
  const armMat = makeMat(mats, flashMaterials, armCol)
  const lArmMesh = new THREE.Mesh(gp.arm, armMat)
  lArmMesh.position.y = -7.2
  leftArm.add(lArmMesh)

  const rArmMesh = new THREE.Mesh(gp.arm, armMat)
  rArmMesh.position.y = -7.2
  rightArm.add(rArmMesh)

  // Every hero has sculpted hands/gloves at wrist tip
  const handCol =
    cid === 'luangphi_sorn'
      ? 0xdc2626
      : cid === 'luffy'
        ? 0x18181b
        : cid === 'simo' || cid === 'frame' || cid === 'diablo' || cid === 'jinwoo'
          ? 0x0f172a
          : skinHex
  const handMat = makeMat(mats, flashMaterials, handCol, {
    emissive: cid === 'luangphi_sorn' || cid === 'luffy' ? 0x991b1b : 0x000000,
    emissiveIntensity: cid === 'luangphi_sorn' || cid === 'luffy' ? 0.35 : 0.08,
    roughness: 0.32,
  })
  for (const grp of [leftArm, rightArm]) {
    const hand = new THREE.Mesh(gp.glove, handMat)
    hand.scale.setScalar(cid === 'luangphi_sorn' || cid === 'luffy' ? 1.05 : 0.78)
    hand.position.set(0, -14.2, 1.0)
    grp.add(hand)
  }

  let fastFistsGroup: THREE.Group | undefined
  if (cid === 'boy') {
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

  let gauntletGems: THREE.Mesh[] | undefined
  let gauntletGemMats: THREE.MeshStandardMaterial[] | undefined

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
  } else if (cid === 'ko') {
    const guard = new THREE.Mesh(gp.katanaGuard, makeMat(mats, flashMaterials, 0xf59e0b, { metalness: 0.85 }))
    guard.position.set(0, -13, 3.5)
    const katana = new THREE.Mesh(
      gp.katanaBlade,
      makeMat(mats, flashMaterials, 0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 0.78, metalness: 0.88, roughness: 0.12 }),
    )
    katana.position.set(0, -13, 20)
    rightArm.add(guard, katana)
  } else if (cid === 'thanwa') {
    const enma = new THREE.Mesh(
      gp.katanaBlade,
      makeMat(mats, flashMaterials, 0xc084fc, { emissive: 0x9333ea, emissiveIntensity: 0.78, metalness: 0.85 }),
    )
    enma.position.set(0, -13, 19)
    rightArm.add(enma)
    const kitetsu = new THREE.Mesh(
      gp.katanaBlade,
      makeMat(mats, flashMaterials, 0x34d399, { emissive: 0x10b981, emissiveIntensity: 0.7, metalness: 0.85 }),
    )
    kitetsu.position.set(0, -13, 18)
    leftArm.add(kitetsu)
  } else if (cid === 'kaem') {
    const katana = new THREE.Mesh(
      gp.katanaBlade,
      makeMat(mats, flashMaterials, 0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.78, metalness: 0.85 }),
    )
    katana.position.set(0, -13, 17)
    rightArm.add(katana)
  } else if (cid === 'simo') {
    const stock = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0x78350f, { roughness: 0.5 }))
    stock.scale.set(1.6, 1.8, 0.72)
    stock.position.set(0, -12, 10)
    const barrel = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0x1e293b, { metalness: 0.85, roughness: 0.25 }))
    barrel.scale.set(0.95, 0.95, 1.18)
    barrel.position.set(0, -11, 21)
    const muzzleTip = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8, { additive: true }))
    muzzleTip.scale.setScalar(0.55)
    muzzleTip.position.set(0, -11, 37)
    rightArm.add(stock, barrel, muzzleTip)
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
  } else if (cid === 'ben10') {
    const omnitrixBand = new THREE.Mesh(
      gp.pauldron,
      makeMat(mats, flashMaterials, 0x0f172a, { metalness: 0.72, roughness: 0.22 }),
    )
    omnitrixBand.scale.set(0.75, 0.82, 0.75)
    omnitrixBand.position.set(0, -11, 1.5)
    const omnitrixDial = new THREE.Mesh(
      gp.orb,
      makeBasicMat(mats, 0x22c55e, { additive: true }),
    )
    omnitrixDial.scale.set(1.18, 0.88, 1.18)
    omnitrixDial.position.set(-2.5, -11, 4.8)
    leftArm.add(omnitrixBand, omnitrixDial)
  } else if (cid === 'diablo') {
    for (const grp of [leftArm, rightArm]) {
      const claw = new THREE.Mesh(
        gp.orb,
        makeBasicMat(mats, 0xdc2626, { transparent: true, opacity: 0.82, additive: true }),
      )
      claw.scale.set(1.15, 1.5, 1.15)
      claw.position.set(0, -14, 3.2)
      grp.add(claw)
    }
  }

  bodyPivot.add(leftArm, rightArm)

  // Sculpted Anime Head Group (Cranium + Tapered Jaw + Layered Anime Eyes + Eyebrows + Full Hair Crown & Bangs!)
  const headY = isTitan ? 48.0 : 45.2
  const headGroup = new THREE.Group()
  headGroup.position.set(0, headY, 0)
  bodyPivot.add(headGroup)

  const skinMat = makeMat(mats, flashMaterials, skinHex, { roughness: 0.36 })
  const head = new THREE.Mesh(gp.head, skinMat)
  head.scale.set(isTitan ? 1.15 : 1.0, isTitan ? 1.12 : 0.98, isTitan ? 1.12 : 0.98)
  const chin = new THREE.Mesh(gp.chin, skinMat)
  chin.scale.set(1.0, 0.9, 0.92)
  chin.position.set(0, -6.5, 2.0)
  headGroup.add(head, chin)

  // Helper: adds multi-layer anime eyes (White Sclera + Colored Iris + Sparkling White Catchlight + Expressive Brow)
  const addAnimeEyes = (irisHex: number, browHex: number, angryAngle = 0.16) => {
    const whiteMat = makeBasicMat(mats, 0xf8fafc)
    const irisMat = makeBasicMat(mats, irisHex)
    const glintMat = makeBasicMat(mats, 0xffffff)
    const browMat = makeBasicMat(mats, browHex)
    for (const side of [-1, 1] as const) {
      const ex = side * 3.8
      const sclera = new THREE.Mesh(gp.eyeWhite, whiteMat)
      sclera.scale.set(1.15, 0.92, 0.55)
      sclera.position.set(ex, 0.8, 9.6)
      const iris = new THREE.Mesh(gp.eyeDot, irisMat)
      iris.scale.set(1.0, 1.05, 0.65)
      iris.position.set(ex, 0.8, 10.3)
      const glint = new THREE.Mesh(gp.eyeGlint, glintMat)
      glint.position.set(ex + side * 0.55, 1.45, 11.0)
      const brow = new THREE.Mesh(gp.brow, browMat)
      brow.position.set(ex, 3.6, 10.1)
      brow.rotation.z = -side * angryAngle
      headGroup.add(sclera, iris, glint, brow)
    }
  }

  const hairCol =
    cid === 'ko' || cid === 'pa' || cid === 'naruto' || cid === 'sanji'
      ? 0xfacc15
      : cid === 'thanwa'
        ? 0x10b981
        : cid === 'boy' || cid === 'ole' || cid === 'frame' || cid === 'jinwoo' || cid === 'luffy' || cid === 'diablo'
          ? 0x111827
          : cid === 'ben10'
            ? 0x78350f
            : cid === 'ajarn_au' || cid === 'sia_mon'
              ? 0xf8fafc
              : cid === 'ajarn_boy'
                ? 0xfb7185
                : cid === 'kaem'
                  ? 0xbae6fd
                  : baseColor

  // Helper: builds a full 3D anime hair crown + front bangs + side anime locks + spiky crown (zero bald angles!)
  const addFullAnimeHair = (colHex: number, spikyMult = 1.0, tipAccentHex?: number) => {
    const hMat = makeMat(mats, flashMaterials, colHex, { roughness: 0.32 })
    const tipMat = tipAccentHex ? makeMat(mats, flashMaterials, tipAccentHex, { roughness: 0.3 }) : hMat
    const crown = new THREE.Mesh(gp.hairCrown, hMat)
    crown.position.set(0, 1.2, -0.4)
    headGroup.add(crown)

    // Front forehead bangs & side face-framing anime locks
    for (const [bx, by, bz, rx, rz, s] of [
      [-4.2, 4.5, 9.2, 2.65, 0.25, 0.68],
      [0, 5.2, 9.8, 2.72, 0.0, 0.72],
      [4.2, 4.5, 9.2, 2.65, -0.25, 0.68],
      [-8.8, 1.5, 5.5, 2.85, 0.35, 0.78],
      [8.8, 1.5, 5.5, 2.85, -0.35, 0.78],
    ] as const) {
      const bang = new THREE.Mesh(gp.hairSpike, hMat)
      bang.scale.setScalar(s)
      bang.position.set(bx, by, bz)
      bang.rotation.set(rx, 0, rz)
      headGroup.add(bang)
    }

    // Dynamic 10-lock 3D anime spiky crown
    const spikes: Array<[number, number, number, number, number, number, boolean]> = [
      [-6.5, 9.5, -1.5, -0.25, 0.55, 1.05 * spikyMult, false],
      [6.5, 9.5, -1.5, -0.25, -0.55, 1.05 * spikyMult, false],
      [-3.5, 11.8, 1.8, 0.28, 0.25, 1.12 * spikyMult, true],
      [3.5, 11.8, 1.8, 0.28, -0.25, 1.12 * spikyMult, true],
      [0, 12.6, -2.2, -0.38, 0, 1.18 * spikyMult, true],
      [0, 11.5, 3.2, 0.35, 0, 0.95 * spikyMult, false],
      [-8.2, 5.8, -5.5, -0.68, 0.65, 0.98 * spikyMult, false],
      [8.2, 5.8, -5.5, -0.68, -0.65, 0.98 * spikyMult, false],
      [-4.2, 7.2, -8.5, -0.85, 0.28, 1.04 * spikyMult, true],
      [4.2, 7.2, -8.5, -0.85, -0.28, 1.04 * spikyMult, true],
    ]
    for (const [sx, sy, sz, rx, rz, sc, useTip] of spikes) {
      const sp = new THREE.Mesh(gp.hairSpike, useTip ? tipMat : hMat)
      sp.scale.setScalar(sc)
      sp.position.set(sx, sy, sz)
      sp.rotation.set(rx, 0, rz)
      headGroup.add(sp)
    }
  }

  if (cid === 'sia_mon') {
    const blindfold = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0x020617, { roughness: 0.22 }))
    blindfold.position.set(0, 1.0, 9.0)
    const sixEyesSlit = new THREE.Mesh(gp.visor, makeBasicMat(mats, 0x38bdf8, { additive: true }))
    sixEyesSlit.scale.set(0.94, 0.3, 1.04)
    sixEyesSlit.position.set(0, 1.0, 9.4)
    headGroup.add(blindfold, sixEyesSlit)
    for (const ex of [-4.4, 4.4]) {
      const gEye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xe0f2fe, { additive: true }))
      gEye.position.set(ex, 1.2, 11.2)
      headGroup.add(gEye)
    }
    addFullAnimeHair(0xf8fafc, 1.12, 0xe0f2fe)
    for (const arm of [leftArm, rightArm]) {
      const fistAura = new THREE.Mesh(
        gp.orb,
        makeBasicMat(mats, 0x38bdf8, { transparent: true, opacity: 0.72, additive: true }),
      )
      fistAura.scale.setScalar(1.4)
      fistAura.position.set(0, -14, 3)
      arm.add(fistAura)
    }
  } else if (cid === 'simo') {
    const hood = new THREE.Mesh(gp.hairCrown, makeMat(mats, flashMaterials, 0xf8fafc, { roughness: 0.35 }))
    hood.scale.set(1.12, 1.18, 1.15)
    hood.position.set(0, 1.2, -0.5)
    const mask = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0xf1f5f9, { roughness: 0.3 }))
    mask.scale.set(1.04, 1.38, 1.05)
    mask.position.set(0, -2.4, 8.8)
    headGroup.add(hood, mask)
    addAnimeEyes(0x38bdf8, 0x334155, 0.22)
  } else if (cid === 'noone') {
    const helm = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85, roughness: 0.18 }))
    helm.scale.set(1.18, 1.45, 1.18)
    helm.position.set(0, 5.8, 0)
    headGroup.add(helm)
    addAnimeEyes(0xfef08a, 0xfacc15, 0.24)
  } else if (cid === 'luangphi_sorn') {
    // Saitama: gleaming bald head with intense serious anime eyes & golden forehead glint
    addAnimeEyes(0xfacc15, 0x0f172a, 0.25)
    const band = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.5 }))
    band.scale.set(0.36, 0.3, 0.36)
    band.position.set(-2, 9, 2)
    headGroup.add(band)
  } else {
    const eyeHex =
      cid === 'ole' || cid === 'ajarn_boy' || cid === 'pa'
        ? 0xef4444
        : cid === 'kaem' || cid === 'diablo' || cid === 'ko'
          ? 0xfacc15
          : cid === 'jinwoo' || cid === 'naruto' || cid === 'sanji' || cid === 'ajarn_au'
            ? 0x38bdf8
            : cid === 'ben10' || cid === 'thanwa'
              ? 0x22c55e
              : 0x0f172a
    addAnimeEyes(eyeHex, hairCol === 0xf8fafc ? 0x475569 : hairCol, 0.18)
    const tipAccent =
      cid === 'ko'
        ? 0xf97316
        : cid === 'diablo'
          ? 0xdc2626
          : cid === 'jinwoo'
            ? 0x38bdf8
            : undefined
    addFullAnimeHair(hairCol, cid === 'boy' || cid === 'naruto' ? 1.18 : 1.0, tipAccent)

    if (cid === 'luffy') {
      const hatBrim = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0xfacc15, { roughness: 0.48 }))
      hatBrim.scale.set(1.72, 0.45, 1.72)
      hatBrim.position.set(0, 6.8, 0)
      const hatCrown = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0xfde047, { roughness: 0.45 }))
      hatCrown.scale.set(1.08, 1.3, 1.08)
      hatCrown.position.set(0, 10.5, 0)
      const hatBand = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0xdc2626, { roughness: 0.4 }))
      hatBand.scale.set(1.13, 0.44, 1.13)
      hatBand.position.set(0, 8.2, 0)
      headGroup.add(hatBrim, hatCrown, hatBand)
    } else if (cid === 'thanwa') {
      const bandana = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0x064e3b))
      bandana.position.set(0, 4.2, 0)
      const wado = new THREE.Mesh(gp.katanaBlade, makeMat(mats, flashMaterials, 0xf8fafc, { metalness: 0.88, emissive: 0x94a3b8, emissiveIntensity: 0.3 }))
      wado.position.set(0, -3.5, 14.5)
      wado.rotation.y = Math.PI * 0.46
      headGroup.add(bandana, wado)
    } else if (cid === 'naruto' || cid === 'ole') {
      const headband = new THREE.Mesh(gp.helmetBand, makeMat(mats, flashMaterials, 0x0f172a))
      headband.scale.set(1.04, 0.72, 1.04)
      headband.position.set(0, 4.6, 0)
      const plate = new THREE.Mesh(gp.visor, makeMat(mats, flashMaterials, 0xcbd5e1, { metalness: 0.85, roughness: 0.18 }))
      plate.scale.set(0.64, 0.7, 0.62)
      plate.position.set(0, 4.6, 10.6)
      headGroup.add(headband, plate)
    } else if (cid === 'ajarn_boy') {
      for (const ex of [-4.2, 4.2]) {
        const subEye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xfb7185, { additive: true }))
        subEye.scale.setScalar(0.72)
        subEye.position.set(ex, -1.5, 10.0)
        headGroup.add(subEye)
      }
      const tattooMat = makeBasicMat(mats, 0x09090b)
      const browMark = new THREE.Mesh(gp.helmetBand, tattooMat)
      browMark.scale.set(1.03, 0.35, 1.03)
      browMark.position.set(0, 4.4, 0)
      headGroup.add(browMark)
      for (const arm of [leftArm, rightArm]) {
        const clawAura = new THREE.Mesh(
          gp.orb,
          makeBasicMat(mats, 0xdc2626, { transparent: true, opacity: 0.72, additive: true }),
        )
        clawAura.scale.set(1.25, 1.45, 1.25)
        clawAura.position.set(0, -14, 3)
        arm.add(clawAura)
      }
    }
  }

  // Iconic Companions (Rimuru's Bouncing Slime & Frame's Floating Stand Cat "ไออ้วน")
  let companionGroup: THREE.Group | undefined
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
    const catMat = makeMat(mats, flashMaterials, 0xa855f7, { emissive: 0x7e22ce, emissiveIntensity: 0.55, transparent: true, opacity: 0.9 })
    const catBody = new THREE.Mesh(gp.head, catMat)
    catBody.scale.set(1.15, 0.95, 1.0)
    companionGroup.add(catBody)
    for (const sx of [-6, 6]) {
      const ear = new THREE.Mesh(gp.hairSpike, catMat)
      ear.scale.set(0.75, 0.75, 0.75)
      ear.position.set(sx, 11, 0)
      companionGroup.add(ear)
      const eye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xfef08a))
      eye.position.set(sx * 0.65, 2, 9.6)
      companionGroup.add(eye)
    }
    const paws = new THREE.Mesh(gp.glove, makeMat(mats, flashMaterials, 0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 0.65 }))
    paws.scale.setScalar(0.8)
    paws.position.set(8, -2, 10)
    companionGroup.add(paws)
    modelPivot.add(companionGroup)
  }

  // Orbiting Auras / Limitless Spheres / Halos / Thunders / Katanas / Portals
  let throneGroup: THREE.Group | undefined
  let extraOrbitalGroup: THREE.Group | undefined
  let kuramaGroup: THREE.Group | undefined

  if (cid === 'naruto') {
    kuramaGroup = new THREE.Group()
    const cloakGlowMat = makeBasicMat(mats, 0xf97316, { transparent: true, opacity: 0.42, side: THREE.DoubleSide, additive: true })
    const tailGoldMat = makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.92, additive: true })
    const tailCoreMat = makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.98, additive: true })

    const auraShell = new THREE.Mesh(gp.shieldSphere, cloakGlowMat)
    auraShell.scale.set(0.86, 1.2, 0.86)
    auraShell.position.set(0, 29, 0)
    kuramaGroup.add(auraShell)

    for (const sx of [-7.5, 7.5]) {
      const foxEar = new THREE.Mesh(gp.hairSpike, tailGoldMat)
      foxEar.scale.set(1.2, 1.5, 0.92)
      foxEar.position.set(sx, headY + 16, 1)
      foxEar.rotation.z = sx < 0 ? 0.32 : -0.32
      kuramaGroup.add(foxEar)
    }

    for (let t = 0; t < 9; t++) {
      const fan = (t - 4) * 0.25
      const tailPivot = new THREE.Group()
      tailPivot.position.set(0, 20, -10)
      tailPivot.rotation.set(-0.55 - Math.abs(t - 4) * 0.05, fan * 0.65, fan * 0.95)
      tailPivot.userData.tailIdx = t
      const segA = new THREE.Mesh(gp.katanaBlade, t % 2 === 0 ? tailGoldMat : tailCoreMat)
      segA.scale.set(2.3, 2.3, 1.08)
      segA.position.set(0, 4, -20)
      const tip = new THREE.Mesh(gp.hairSpike, tailCoreMat)
      tip.rotation.x = -Math.PI * 0.5
      tip.scale.set(1.35, 1.65, 1.35)
      tip.position.set(0, 6, -42)
      tailPivot.add(segA, tip)
      kuramaGroup.add(tailPivot)
    }
    kuramaGroup.visible = Boolean(p.godspeed)
    modelPivot.add(kuramaGroup)
  }

  if (
    cid === 'noone' ||
    cid === 'pa' ||
    cid === 'ko' ||
    cid === 'sia_mon' ||
    cid === 'thanwa' ||
    cid === 'ajarn_au' ||
    cid === 'ole' ||
    cid === 'luangphi_sorn' ||
    cid === 'simo' ||
    cid === 'jinwoo' ||
    cid === 'ben10' ||
    cid === 'diablo' ||
    cid === 'sanji'
  ) {
    extraOrbitalGroup = new THREE.Group()
    extraOrbitalGroup.position.y = 28
    if (cid === 'jinwoo') {
      const monarchRing = new THREE.Mesh(
        gp.haloRing,
        makeBasicMat(mats, 0x7c3aed, { transparent: true, opacity: 0.65, additive: true }),
      )
      monarchRing.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(monarchRing)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        const flame = new THREE.Mesh(gp.orb, makeBasicMat(mats, i % 2 === 0 ? 0x38bdf8 : 0x7c3aed, { additive: true }))
        flame.scale.set(1.05, 1.6, 1.05)
        flame.position.set(Math.cos(a) * 29, Math.sin(a * 2) * 5, Math.sin(a) * 29)
        extraOrbitalGroup.add(flame)
      }
    } else if (cid === 'ben10') {
      const omniRing = new THREE.Mesh(
        gp.haloRing,
        makeBasicMat(mats, 0x22c55e, { transparent: true, opacity: 0.72, additive: true }),
      )
      omniRing.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(omniRing)
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3
        const node = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x86efac, { additive: true }))
        node.scale.setScalar(1.0)
        node.position.set(Math.cos(a) * 28, (i - 1) * 4, Math.sin(a) * 28)
        extraOrbitalGroup.add(node)
      }
    } else if (cid === 'diablo') {
      const noirRing = new THREE.Mesh(
        gp.haloRing,
        makeBasicMat(mats, 0xdc2626, { transparent: true, opacity: 0.62, additive: true }),
      )
      noirRing.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(noirRing)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        const sigil = new THREE.Mesh(gp.orb, makeBasicMat(mats, i % 2 === 0 ? 0xdc2626 : 0xfacc15, { additive: true }))
        sigil.scale.setScalar(1.1)
        sigil.position.set(Math.cos(a) * 30, Math.cos(a * 2) * 4, Math.sin(a) * 30)
        extraOrbitalGroup.add(sigil)
      }
    } else if (cid === 'sanji') {
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3
        const ember = new THREE.Mesh(gp.orb, makeBasicMat(mats, i % 2 === 0 ? 0x38bdf8 : 0xf97316, { additive: true }))
        ember.scale.setScalar(0.95)
        ember.position.set(Math.cos(a) * 26, -10 + i * 4, Math.sin(a) * 26)
        extraOrbitalGroup.add(ember)
      }
    } else if (cid === 'simo') {
      const scopeRing = new THREE.Mesh(
        gp.haloRing,
        makeBasicMat(mats, 0x38bdf8, { transparent: true, opacity: 0.55, additive: true }),
      )
      scopeRing.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(scopeRing)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        const crystal = new THREE.Mesh(gp.orb, makeBasicMat(mats, i % 2 === 0 ? 0xe0f2fe : 0x38bdf8, { additive: true }))
        crystal.scale.setScalar(0.8)
        crystal.position.set(Math.cos(a) * 28, (i % 2) * 4, Math.sin(a) * 28)
        extraOrbitalGroup.add(crystal)
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
      const infRing = new THREE.Mesh(
        gp.haloRing,
        makeBasicMat(mats, 0x38bdf8, { transparent: true, opacity: 0.52, additive: true }),
      )
      infRing.rotation.x = Math.PI / 2
      infRing.scale.setScalar(1.08)
      const bOrb = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8, { additive: true }))
      bOrb.scale.setScalar(1.6)
      bOrb.position.set(31, 5, 0)
      const bCore = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xffffff))
      bCore.scale.setScalar(0.85)
      bCore.position.set(31, 5, 0)
      const rOrb = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xef4444, { additive: true }))
      rOrb.scale.setScalar(1.6)
      rOrb.position.set(-31, -5, 0)
      const rCore = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xffffff))
      rCore.scale.setScalar(0.85)
      rCore.position.set(-31, -5, 0)
      extraOrbitalGroup.add(infRing, bOrb, bCore, rOrb, rCore)
    } else if (cid === 'pa') {
      for (const side of [-1, 1]) {
        const portal = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.9, additive: true }))
        portal.scale.set(0.34, 0.34, 0.34)
        portal.position.set(side * 22, 8, -12)
        extraOrbitalGroup.add(portal)
      }
    } else if (cid === 'ko' || cid === 'ajarn_au') {
      const colA = cid === 'ko' ? 0xfacc15 : 0x22d3ee
      const colB = cid === 'ko' ? 0x7dd3fc : 0xfef08a
      const ring = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, colA, { transparent: true, opacity: 0.65, additive: true }))
      ring.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(ring)
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3
        const spark = new THREE.Mesh(gp.orb, makeBasicMat(mats, colB, { additive: true }))
        spark.scale.setScalar(0.9)
        spark.position.set(Math.cos(a) * 28, (i - 1) * 4, Math.sin(a) * 28)
        extraOrbitalGroup.add(spark)
      }
    } else if (cid === 'thanwa') {
      const hakiRing = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0x10b981, { transparent: true, opacity: 0.6, additive: true }))
      hakiRing.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(hakiRing)
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3
        const wisp = new THREE.Mesh(gp.orb, makeBasicMat(mats, i === 1 ? 0xc084fc : 0x34d399, { additive: true }))
        wisp.position.set(Math.cos(a) * 29, 0, Math.sin(a) * 29)
        extraOrbitalGroup.add(wisp)
      }
    } else if (cid === 'ole') {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        const feather = new THREE.Mesh(gp.orb, makeBasicMat(mats, i % 2 === 0 ? 0xdc2626 : 0x09090b))
        feather.scale.set(1.2, 0.5, 0.7)
        feather.position.set(Math.cos(a) * 28, Math.sin(a * 2) * 5, Math.sin(a) * 28)
        extraOrbitalGroup.add(feather)
      }
    } else if (cid === 'luangphi_sorn') {
      extraOrbitalGroup.position.set(0, 44, -8)
      const sacred = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.9, additive: true }))
      sacred.scale.set(0.75, 0.75, 0.75)
      extraOrbitalGroup.add(sacred)
    }
    modelPivot.add(extraOrbitalGroup)
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
    capePivot,
    companionGroup,
    throneGroup,
    extraOrbitalGroup,
    fastFistsGroup,
    kuramaGroup,
    gauntletGems,
    gauntletGemMats,
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
