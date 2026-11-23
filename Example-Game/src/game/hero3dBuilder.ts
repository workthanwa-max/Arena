import * as THREE from 'three'
import type { PlayerState } from '../types/game'

export interface HeroRig3D {
  id: string
  characterId: string
  root: THREE.Group
  modelPivot: THREE.Group
  bodyPivot: THREE.Group
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
  gauntletGems?: THREE.Mesh[]
  gauntletGemMats?: THREE.MeshStandardMaterial[]
  materialsToDispose: THREE.Material[]
  isDummy: boolean
  wasMovedDist: number
  walkPhase: number
  attackSwingUntil: number
  attackSwingSide: number
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
  torso: THREE.BoxGeometry
  titanTorso: THREE.BoxGeometry
  pauldron: THREE.BoxGeometry
  sash: THREE.BoxGeometry
  head: THREE.SphereGeometry
  helmetBand: THREE.CylinderGeometry
  hairSpike: THREE.ConeGeometry
  visor: THREE.BoxGeometry
  eyeDot: THREE.SphereGeometry
  limb: THREE.BoxGeometry
  arm: THREE.BoxGeometry
  glove: THREE.SphereGeometry
  cloak: THREE.BoxGeometry
  katanaBlade: THREE.BoxGeometry
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
    shadow: new THREE.CircleGeometry(22, 22),
    floorRing: new THREE.RingGeometry(21, 27, 28),
    chevron: new THREE.ConeGeometry(7.5, 14, 3),
    statusHalo: new THREE.RingGeometry(28, 34, 28),
    shieldSphere: new THREE.SphereGeometry(34, 18, 14),
    torso: new THREE.BoxGeometry(20, 22, 12),
    titanTorso: new THREE.BoxGeometry(27, 27, 16),
    pauldron: new THREE.BoxGeometry(10.5, 8.5, 13.5),
    sash: new THREE.BoxGeometry(21.5, 5.5, 13.2),
    head: new THREE.SphereGeometry(10.8, 16, 14),
    helmetBand: new THREE.CylinderGeometry(11.4, 11.4, 4.6, 16),
    hairSpike: new THREE.ConeGeometry(4.4, 13.5, 6),
    visor: new THREE.BoxGeometry(15, 4.8, 4),
    eyeDot: new THREE.SphereGeometry(1.75, 8, 8),
    limb: new THREE.BoxGeometry(7.2, 15, 7.2),
    arm: new THREE.BoxGeometry(6.6, 17, 6.6),
    glove: new THREE.SphereGeometry(5.6, 10, 10),
    cloak: new THREE.BoxGeometry(24, 26, 3.6),
    katanaBlade: new THREE.BoxGeometry(2.2, 2.8, 38),
    orb: new THREE.SphereGeometry(3.4, 10, 10),
    haloRing: new THREE.TorusGeometry(28, 1.3, 8, 28),
    dummyBarrel: new THREE.CylinderGeometry(13.5, 12.5, 34, 14),
    bullseyeOuter: new THREE.CircleGeometry(9, 18),
    bullseyeMid: new THREE.CircleGeometry(5.6, 16),
    bullseyeCore: new THREE.CircleGeometry(2.6, 14),
  }
  geoPool.shadow.rotateX(-Math.PI / 2)
  geoPool.floorRing.rotateX(-Math.PI / 2)
  geoPool.statusHalo.rotateX(-Math.PI / 2)
  geoPool.chevron.rotateX(Math.PI / 2)
  return geoPool
}

function makeMat(
  mats: THREE.Material[],
  color: number,
  opts?: { emissive?: number; emissiveIntensity?: number; roughness?: number; metalness?: number; transparent?: boolean; opacity?: number },
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.42,
    metalness: opts?.metalness ?? 0.18,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
  })
  mats.push(m)
  return m
}

function makeBasicMat(
  mats: THREE.Material[],
  color: number,
  opts?: { transparent?: boolean; opacity?: number; side?: THREE.Side },
): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
    side: opts?.side ?? THREE.FrontSide,
    depthWrite: opts?.transparent ? false : true,
  })
  mats.push(m)
  return m
}

export function buildHeroRig3D(p: PlayerState, isMe: boolean, initialRingColor: number): HeroRig3D {
  const gp = getGeoPool()
  const mats: THREE.Material[] = []

  const root = new THREE.Group()
  root.position.set(p.x, 0, p.y)

  const shadowDisc = new THREE.Mesh(
    gp.shadow,
    makeBasicMat(mats, 0x020617, { transparent: true, opacity: 0.52 }),
  )
  shadowDisc.position.y = 0.7
  root.add(shadowDisc)

  const floorRing = new THREE.Mesh(
    gp.floorRing,
    makeBasicMat(mats, initialRingColor, { transparent: true, opacity: isMe ? 0.96 : 0.78, side: THREE.DoubleSide }),
  )
  floorRing.position.y = 1.1
  root.add(floorRing)

  const statusHalo = new THREE.Mesh(
    gp.statusHalo,
    makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
  )
  statusHalo.position.y = 1.6
  statusHalo.visible = false
  root.add(statusHalo)

  const shieldSphere = new THREE.Mesh(
    gp.shieldSphere,
    makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
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

  const leftLeg = new THREE.Mesh(gp.limb, makeMat(mats, 0x1e293b))
  const rightLeg = new THREE.Mesh(gp.limb, makeMat(mats, 0x1e293b))
  const leftArm = new THREE.Group()
  const rightArm = new THREE.Group()

  if (p.isDummy) {
    const dummyBody = new THREE.Mesh(gp.dummyBarrel, makeMat(mats, 0x92400e, { roughness: 0.52 }))
    dummyBody.position.y = 24
    bodyPivot.add(dummyBody)

    const woodPost = new THREE.Mesh(gp.limb, makeMat(mats, 0x451a03))
    woodPost.position.y = 8
    bodyPivot.add(woodPost)

    const head = new THREE.Mesh(gp.head, makeMat(mats, 0xd97706, { roughness: 0.35 }))
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
      materialsToDispose: mats,
      isDummy: true,
      wasMovedDist: 0,
      walkPhase: 0,
      attackSwingUntil: 0,
      attackSwingSide: 1,
      leapUntil: 0,
      lastTeamRingColor: initialRingColor,
      lastJumpLift: 0,
      afterimageCooldown: 0,
    }
  }

  const cid = p.characterId
  const baseColor = Number.parseInt(p.color.replace('#', ''), 16) || 0x38bdf8
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
              ? 0x1e293b
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
                            : baseColor

  const pantsHex =
    cid === 'boy' ? 0x1d4ed8 : cid === 'ko' || cid === 'thanwa' || cid === 'sia_mon' ? 0x0f172a : 0x1e293b
  ;(leftLeg.material as THREE.MeshStandardMaterial).color.setHex(pantsHex)
  ;(rightLeg.material as THREE.MeshStandardMaterial).color.setHex(pantsHex)
  leftLeg.position.set(-5.6, 7.5, 0)
  rightLeg.position.set(5.6, 7.5, 0)
  bodyPivot.add(leftLeg, rightLeg)

  const isTitan = cid === 'noone'
  const torso = new THREE.Mesh(
    isTitan ? gp.titanTorso : gp.torso,
    makeMat(mats, suitHex, {
      metalness: cid === 'pa' || isTitan ? 0.6 : 0.16,
      roughness: cid === 'pa' || isTitan ? 0.25 : 0.45,
    }),
  )
  torso.position.y = isTitan ? 27 : 25
  bodyPivot.add(torso)

  // Animated Cape / Flow Hair / Sash Details
  let capePivot: THREE.Group | undefined
  if (cid === 'luangphi_sorn' || cid === 'ole' || cid === 'kaem' || cid === 'ko' || cid === 'frame') {
    capePivot = new THREE.Group()
    capePivot.position.set(0, 35, -7)
    const cloakCol =
      cid === 'luangphi_sorn'
        ? 0xf8fafc
        : cid === 'ko'
          ? 0xfacc15
          : cid === 'kaem'
            ? 0x7dd3fc
            : cid === 'frame'
              ? 0x312e81
              : 0x111827
    const cloakMesh = new THREE.Mesh(
      gp.cloak,
      makeMat(mats, cloakCol, {
        emissive: cid === 'ko' ? 0x92400e : cid === 'kaem' ? 0x0284c7 : 0x000000,
        emissiveIntensity: cid === 'ko' ? 0.25 : cid === 'kaem' ? 0.2 : 0,
      }),
    )
    cloakMesh.position.set(0, -12, -1)
    capePivot.add(cloakMesh)

    if (cid === 'ole') {
      // Akatsuki signature Red Clouds on Itachi coat back & chest!
      for (const [cxOff, cyOff] of [[-5, -9], [5, -16]]) {
        const cloud = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xdc2626))
        cloud.scale.set(0.95, 0.55, 0.5)
        cloud.position.set(cxOff, cyOff, -2.5)
        capePivot.add(cloud)
      }
    } else if (cid === 'ko') {
      // Crisp White Triangle Haori motifs on Zenitsu coat
      for (const sx of [-6, 6]) {
        const tri = new THREE.Mesh(gp.hairSpike, makeBasicMat(mats, 0xffffff))
        tri.scale.set(0.9, 0.7, 0.4)
        tri.position.set(sx, -21, -2.6)
        capePivot.add(tri)
      }
    }
    bodyPivot.add(capePivot)
  }

  // Distinct Chest Armor / Sashes
  if (cid === 'noone') {
    const plate = new THREE.Mesh(
      gp.torso,
      makeMat(mats, 0xfacc15, { metalness: 0.75, roughness: 0.2, emissive: 0x78350f, emissiveIntensity: 0.28 }),
    )
    plate.scale.set(0.9, 0.78, 1.15)
    plate.position.set(0, 28, 1.5)
    bodyPivot.add(plate)
    for (const sx of [-16.5, 16.5]) {
      const pd = new THREE.Mesh(gp.pauldron, makeMat(mats, 0xf59e0b, { metalness: 0.8, roughness: 0.2 }))
      pd.position.set(sx, 36, 0)
      bodyPivot.add(pd)
    }
  } else if (cid === 'thanwa' || cid === 'boy') {
    const sash = new THREE.Mesh(gp.sash, makeMat(mats, cid === 'thanwa' ? 0x10b981 : 0x0284c7, { roughness: 0.5 }))
    sash.position.set(0, 17, 0)
    bodyPivot.add(sash)
  } else if (cid === 'kaem') {
    // Rimuru Gold-Trimmed Fur Mantle Collar
    const collar = new THREE.Mesh(gp.sash, makeMat(mats, 0xfacc15, { metalness: 0.65 }))
    collar.position.set(0, 34, 0)
    bodyPivot.add(collar)
  } else if (cid === 'frame') {
    // Joestar Gold Collar Strap
    const strap = new THREE.Mesh(gp.sash, makeMat(mats, 0xfacc15, { metalness: 0.85 }))
    strap.position.set(0, 31, 0)
    strap.rotation.z = 0.24
    bodyPivot.add(strap)
  }

  // Articulated Arms + Weapons + Gloves
  leftArm.position.set(isTitan ? -17 : -13.5, isTitan ? 35 : 33, 0)
  rightArm.position.set(isTitan ? 17 : 13.5, isTitan ? 35 : 33, 0)

  const armCol = isTitan ? 0x9333ea : cid === 'ko' ? 0xf59e0b : suitHex
  const lArmMesh = new THREE.Mesh(gp.arm, makeMat(mats, armCol))
  lArmMesh.position.y = -7
  leftArm.add(lArmMesh)

  const rArmMesh = new THREE.Mesh(gp.arm, makeMat(mats, armCol))
  rArmMesh.position.y = -7
  rightArm.add(rArmMesh)

  if (cid === 'luangphi_sorn') {
    for (const grp of [leftArm, rightArm]) {
      const glove = new THREE.Mesh(gp.glove, makeMat(mats, 0xdc2626, { emissive: 0x7f1d1d, emissiveIntensity: 0.3, roughness: 0.3 }))
      glove.position.set(0, -15, 1.5)
      grp.add(glove)
    }
  }

  let fastFistsGroup: THREE.Group | undefined
  if (cid === 'boy') {
    fastFistsGroup = new THREE.Group()
    for (const [grp, fx] of [[leftArm, -1], [rightArm, 1]] as const) {
      const auraFist = new THREE.Mesh(gp.glove, makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.85 }))
      auraFist.scale.set(1.3, 1.3, 1.3)
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
      makeMat(mats, 0xf59e0b, { metalness: 0.88, roughness: 0.18, emissive: 0x78350f, emissiveIntensity: 0.35 }),
    )
    gauntlet.scale.set(0.85, 1.38, 0.82)
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
      const gmMat = makeMat(mats, 0x334155, { emissive: 0x000000, emissiveIntensity: 0, roughness: 0.15 })
      const gem = new THREE.Mesh(gp.orb, gmMat)
      gem.scale.setScalar(i === 4 ? 0.75 : 0.48)
      gem.position.set(...gemOffsets[i])
      leftArm.add(gem)
      gauntletGems.push(gem)
      gauntletGemMats.push(gmMat)
    }
  } else if (cid === 'ko') {
    const katana = new THREE.Mesh(
      gp.katanaBlade,
      makeMat(mats, 0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 0.72, metalness: 0.88, roughness: 0.12 }),
    )
    katana.position.set(0, -12, 18)
    rightArm.add(katana)
  } else if (cid === 'thanwa') {
    const enma = new THREE.Mesh(
      gp.katanaBlade,
      makeMat(mats, 0xc084fc, { emissive: 0x9333ea, emissiveIntensity: 0.75, metalness: 0.85 }),
    )
    enma.position.set(0, -12, 18)
    rightArm.add(enma)
    const kitetsu = new THREE.Mesh(
      gp.katanaBlade,
      makeMat(mats, 0x34d399, { emissive: 0x10b981, emissiveIntensity: 0.65, metalness: 0.85 }),
    )
    kitetsu.position.set(0, -12, 17)
    leftArm.add(kitetsu)
  } else if (cid === 'kaem') {
    const katana = new THREE.Mesh(
      gp.katanaBlade,
      makeMat(mats, 0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.75, metalness: 0.85 }),
    )
    katana.position.set(0, -12, 16)
    rightArm.add(katana)
  }

  bodyPivot.add(leftArm, rightArm)

  // Head + Eyes + Hair Silhouette
  const headY = isTitan ? 47.5 : 44.5
  const head = new THREE.Mesh(gp.head, makeMat(mats, skinHex, { roughness: 0.38 }))
  head.scale.setScalar(isTitan ? 1.15 : 1.0)
  head.position.y = headY
  bodyPivot.add(head)

  if (cid === 'sia_mon') {
    const blindfold = new THREE.Mesh(gp.visor, makeMat(mats, 0x020617, { roughness: 0.25 }))
    blindfold.position.set(0, headY + 1, 9.0)
    bodyPivot.add(blindfold)
    // Subtle cyan Six-Eyes gleam at edges of blindfold
    for (const ex of [-4.5, 4.5]) {
      const gEye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0x38bdf8))
      gEye.position.set(ex, headY + 1.2, 11.1)
      bodyPivot.add(gEye)
    }
    for (const [sx, sz, rotZ, rotX] of [[-4, -2, 0.38, -0.22], [4, -2, -0.38, -0.22], [0, -3, 0, -0.4], [0, 3, 0, 0.25]]) {
      const sp = new THREE.Mesh(gp.hairSpike, makeMat(mats, 0xf8fafc))
      sp.position.set(sx, headY + 11.5, sz)
      sp.rotation.set(rotX, 0, rotZ)
      bodyPivot.add(sp)
    }
  } else if (cid === 'noone') {
    const helm = new THREE.Mesh(gp.helmetBand, makeMat(mats, 0xfacc15, { metalness: 0.85, roughness: 0.18 }))
    helm.scale.set(1.2, 1.35, 1.2)
    helm.position.set(0, headY + 6, 0)
    bodyPivot.add(helm)
    for (const ex of [-4.2, 4.2]) {
      const eye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, 0xfef08a))
      eye.position.set(ex, headY + 1, 10.8)
      bodyPivot.add(eye)
    }
  } else {
    const eyeHex = cid === 'ole' ? 0xef4444 : cid === 'kaem' ? 0xfacc15 : 0x0f172a
    for (const ex of [-3.6, 3.6]) {
      const eye = new THREE.Mesh(gp.eyeDot, makeBasicMat(mats, eyeHex))
      eye.position.set(ex, headY + 1, 9.8)
      bodyPivot.add(eye)
    }
    const hairCol =
      cid === 'ko'
        ? 0xfacc15
        : cid === 'thanwa'
          ? 0x10b981
          : cid === 'pa'
            ? 0xfacc15
            : cid === 'boy' || cid === 'ole' || cid === 'frame'
              ? 0x111827
              : cid === 'ajarn_au'
                ? 0xf1f5f9
                : cid === 'ajarn_boy'
                  ? 0xfb7185
                  : cid === 'kaem'
                    ? 0xbae6fd
                    : baseColor

    if (cid === 'luangphi_sorn') {
      const band = new THREE.Mesh(gp.helmetBand, makeMat(mats, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.45 }))
      band.scale.set(0.36, 0.3, 0.36)
      band.position.set(-2, headY + 9, 2)
      bodyPivot.add(band)
    } else if (cid === 'thanwa') {
      const bandana = new THREE.Mesh(gp.helmetBand, makeMat(mats, 0x0f172a))
      bandana.position.set(0, headY + 4.2, 0)
      bodyPivot.add(bandana)
      const wado = new THREE.Mesh(gp.katanaBlade, makeMat(mats, 0xf8fafc, { metalness: 0.88, emissive: 0x94a3b8, emissiveIntensity: 0.25 }))
      wado.position.set(0, headY - 4, 15.5)
      wado.rotation.y = Math.PI * 0.46
      bodyPivot.add(wado)
      for (const [sx, sz, rz] of [[-5, 0, 0.38], [5, 0, -0.38], [0, -3, 0]]) {
        const sp = new THREE.Mesh(gp.hairSpike, makeMat(mats, hairCol))
        sp.position.set(sx, headY + 10.5, sz)
        sp.rotation.z = rz
        bodyPivot.add(sp)
      }
    } else if (cid !== 'default') {
      for (const [sx, sz, rz, rx] of [[-5.5, -2, 0.48, -0.15], [5.5, -2, -0.48, -0.15], [0, -4, 0, -0.34]]) {
        const sp = new THREE.Mesh(gp.hairSpike, makeMat(mats, hairCol))
        sp.position.set(sx, headY + 10.5, sz)
        sp.rotation.set(rx, 0, rz)
        bodyPivot.add(sp)
      }
    }
  }

  // Iconic Companions (Rimuru's Bouncing Slime & Frame's Floating Stand Cat "ไออ้วน")
  let companionGroup: THREE.Group | undefined
  if (cid === 'kaem') {
    companionGroup = new THREE.Group()
    companionGroup.position.set(22, 22, 4)
    const slimeMat = makeMat(mats, 0x0ea5e9, { emissive: 0x0284c7, emissiveIntensity: 0.55, roughness: 0.15, transparent: true, opacity: 0.92 })
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
    const catMat = makeMat(mats, 0xa855f7, { emissive: 0x7e22ce, emissiveIntensity: 0.55, transparent: true, opacity: 0.9 })
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
    const paws = new THREE.Mesh(gp.glove, makeMat(mats, 0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 0.65 }))
    paws.scale.setScalar(0.8)
    paws.position.set(8, -2, 10)
    companionGroup.add(paws)
    modelPivot.add(companionGroup)
  }

  // Orbiting Auras / Limitless Spheres / Halos / Thunders / Katanas / Portals
  let throneGroup: THREE.Group | undefined
  let extraOrbitalGroup: THREE.Group | undefined

  if (
    cid === 'noone' ||
    cid === 'pa' ||
    cid === 'ko' ||
    cid === 'sia_mon' ||
    cid === 'thanwa' ||
    cid === 'ajarn_au' ||
    cid === 'ole' ||
    cid === 'luangphi_sorn'
  ) {
    extraOrbitalGroup = new THREE.Group()
    extraOrbitalGroup.position.y = 28
    if (cid === 'noone') {
      const cols = [0xa855f7, 0x3b82f6, 0xef4444, 0x10b981, 0xfacc15]
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5
        const gem = new THREE.Mesh(gp.orb, makeBasicMat(mats, cols[i]))
        gem.position.set(Math.cos(a) * 29, Math.sin(i * 1.4) * 3, Math.sin(a) * 29)
        extraOrbitalGroup.add(gem)
      }
      extraOrbitalGroup.visible = (p.infinityStones?.length ?? 0) >= 5
    } else if (cid === 'sia_mon') {
      // Orbiting Azure Blue + Crimson Red Limitless Motes around Gojo
      const bOrb = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8))
      bOrb.scale.setScalar(1.35)
      bOrb.position.set(30, 4, 0)
      const rOrb = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xef4444))
      rOrb.scale.setScalar(1.35)
      rOrb.position.set(-30, -4, 0)
      extraOrbitalGroup.add(bOrb, rOrb)
    } else if (cid === 'pa') {
      for (const side of [-1, 1]) {
        const portal = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.85 }))
        portal.scale.set(0.32, 0.32, 0.32)
        portal.position.set(side * 22, 8, -12)
        extraOrbitalGroup.add(portal)
      }
    } else if (cid === 'ko' || cid === 'ajarn_au') {
      const colA = cid === 'ko' ? 0xfacc15 : 0x22d3ee
      const colB = cid === 'ko' ? 0x7dd3fc : 0xfef08a
      const ring = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, colA, { transparent: true, opacity: 0.55 }))
      ring.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(ring)
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3
        const spark = new THREE.Mesh(gp.orb, makeBasicMat(mats, colB))
        spark.scale.setScalar(0.85)
        spark.position.set(Math.cos(a) * 28, (i - 1) * 4, Math.sin(a) * 28)
        extraOrbitalGroup.add(spark)
      }
    } else if (cid === 'thanwa') {
      const hakiRing = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0x10b981, { transparent: true, opacity: 0.52 }))
      hakiRing.rotation.x = Math.PI / 2
      extraOrbitalGroup.add(hakiRing)
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3
        const wisp = new THREE.Mesh(gp.orb, makeBasicMat(mats, i === 1 ? 0xc084fc : 0x34d399))
        wisp.position.set(Math.cos(a) * 29, 0, Math.sin(a) * 29)
        extraOrbitalGroup.add(wisp)
      }
    } else if (cid === 'ole') {
      // Orbiting Black & Crimson Sharingan Crow Motes
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        const feather = new THREE.Mesh(gp.orb, makeBasicMat(mats, i % 2 === 0 ? 0xdc2626 : 0x09090b))
        feather.scale.set(1.2, 0.5, 0.7)
        feather.position.set(Math.cos(a) * 28, Math.sin(a * 2) * 5, Math.sin(a) * 28)
        extraOrbitalGroup.add(feather)
      }
    } else if (cid === 'luangphi_sorn') {
      // Sacred Golden Halo behind LuangPhi Sorn's head!
      extraOrbitalGroup.position.set(0, 44, -8)
      const sacred = new THREE.Mesh(gp.haloRing, makeBasicMat(mats, 0xfef08a, { transparent: true, opacity: 0.85 }))
      sacred.scale.set(0.75, 0.75, 0.75)
      extraOrbitalGroup.add(sacred)
    }
    modelPivot.add(extraOrbitalGroup)
  }

  if (cid === 'ajarn_boy') {
    throneGroup = new THREE.Group()
    const base = new THREE.Mesh(gp.torso, makeMat(mats, 0x450a0a))
    base.scale.set(1.8, 0.7, 1.6)
    base.position.set(0, 12, -4)
    const back = new THREE.Mesh(gp.cloak, makeMat(mats, 0x7f1d1d))
    back.scale.set(1.6, 1.45, 1.4)
    back.position.set(0, 32, -13)
    const lHorn = new THREE.Mesh(gp.hairSpike, makeMat(mats, 0xf8fafc))
    lHorn.scale.set(1.4, 2.2, 1.4)
    lHorn.position.set(-22, 54, -13)
    lHorn.rotation.z = 0.42
    const rHorn = new THREE.Mesh(gp.hairSpike, makeMat(mats, 0xf8fafc))
    rHorn.scale.set(1.4, 2.2, 1.4)
    rHorn.position.set(22, 54, -13)
    rHorn.rotation.z = -0.42
    throneGroup.add(base, back, lHorn, rHorn)
    throneGroup.visible = Boolean(p.seated)
    modelPivot.add(throneGroup)
  }

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
    capePivot,
    companionGroup,
    throneGroup,
    extraOrbitalGroup,
    fastFistsGroup,
    gauntletGems,
    gauntletGemMats,
    materialsToDispose: mats,
    isDummy: false,
    wasMovedDist: 0,
    walkPhase: Math.random() * Math.PI * 2,
    attackSwingUntil: 0,
    attackSwingSide: 1,
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
}
