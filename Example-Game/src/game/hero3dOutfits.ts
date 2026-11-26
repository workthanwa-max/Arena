import * as THREE from 'three'
import { makeBasicMat, makeMat, type Hero3dGeoPool, type HeroFlashMat } from './hero3dGeoPool'
import type { Hero3dProfile } from './hero3dProfiles'

export interface BodyOutfitResult {
  capePivot?: THREE.Group
  headY: number
  isTitan: boolean
}

export function buildHeroBodyAndOutfit3D(
  cid: string,
  profile: Hero3dProfile,
  gp: Hero3dGeoPool,
  mats: THREE.Material[],
  flashMaterials: HeroFlashMat[],
  bodyPivot: THREE.Group,
  leftLeg: THREE.Mesh,
  rightLeg: THREE.Mesh,
  leftArm: THREE.Group,
  rightArm: THREE.Group,
  accentColor: number,
): BodyOutfitResult {
  const bType = profile.bodyType
  const isTitan = bType === 'titan_muscular'
  const isVoxel = bType === 'voxel_cubic'
  const isMascot = bType === 'spherical_mascot'
  const isSpectral = bType === 'spectral_floating'

  if (profile.bodyScale) {
    bodyPivot.scale.set(...profile.bodyScale)
  }

  // 1. Legs & Boots Setup (Distinct by BodyArchetype)
  const pantsMat = makeMat(mats, flashMaterials, profile.pantsHex, { roughness: 0.42 })
  const bootMat = makeMat(mats, flashMaterials, profile.bootHex, { roughness: 0.35, metalness: 0.25 })

  if (isSpectral) {
    // Krasue: NO normal legs! Floating head + spine, ribcage & glowing entrails trailing beneath!
    leftLeg.visible = false
    rightLeg.visible = false
    bodyPivot.add(leftLeg, rightLeg)

    const spineMat = makeMat(mats, flashMaterials, 0xe2e8f0, { roughness: 0.32 })
    const organMat = makeBasicMat(mats, 0xf43f5e, { transparent: true, opacity: 0.88, additive: true })
    const neckCol = new THREE.Mesh(gp.cyl, makeMat(mats, flashMaterials, profile.skinHex))
    neckCol.scale.set(3.2, 9.5, 3.2)
    neckCol.position.set(0, 35, 0)
    bodyPivot.add(neckCol)

    for (let r = 0; r < 5; r++) {
      const y = 30 - r * 3.4
      const spineVert = new THREE.Mesh(gp.orb, spineMat)
      spineVert.scale.set(0.65, 0.48, 0.65)
      spineVert.position.set(0, y, -1.5)
      bodyPivot.add(spineVert)
      if (r < 3) {
        const rib = new THREE.Mesh(gp.ringThin, spineMat)
        rib.scale.set(0.9 - r * 0.14, 0.22, 0.72)
        rib.rotation.x = Math.PI * 0.48
        rib.position.set(0, y, 0.5)
        bodyPivot.add(rib)
      }
    }
    const capePivot = new THREE.Group()
    capePivot.position.set(0, 28, 0)
    for (let g = 0; g < 6; g++) {
      const seg = new THREE.Mesh(gp.orb, organMat)
      const curveX = Math.sin(g * 1.15) * 3.4
      seg.scale.set(1.05 - g * 0.1, 1.35, 1.05 - g * 0.1)
      seg.position.set(curveX, -g * 3.8 - 2, -Math.cos(g * 0.9) * 1.8)
      capePivot.add(seg)
    }
    bodyPivot.add(capePivot)

    leftArm.visible = false
    rightArm.visible = false
    bodyPivot.add(leftArm, rightArm)
    return { capePivot, headY: 44.5, isTitan: false }
  }

  if (isVoxel) {
    // Steve: pure cubic voxel legs + boots
    leftLeg.geometry = gp.box
    rightLeg.geometry = gp.box
    leftLeg.scale.set(8.2, 16, 8.2)
    rightLeg.scale.set(8.2, 16, 8.2)
    ;(leftLeg.material as THREE.MeshStandardMaterial).color.setHex(profile.pantsHex)
    ;(rightLeg.material as THREE.MeshStandardMaterial).color.setHex(profile.pantsHex)
    leftLeg.position.set(-4.3, 8.0, 0)
    rightLeg.position.set(4.3, 8.0, 0)
    bodyPivot.add(leftLeg, rightLeg)
  } else {
    ;(leftLeg.material as THREE.MeshStandardMaterial).color.setHex(profile.pantsHex)
    ;(rightLeg.material as THREE.MeshStandardMaterial).color.setHex(profile.pantsHex)
    const legSpread = isMascot ? 6.4 : isTitan ? 6.8 : 5.4
    leftLeg.position.set(-legSpread, isMascot ? 6.8 : 8.2, 0)
    rightLeg.position.set(legSpread, isMascot ? 6.8 : 8.2, 0)
    if (isMascot) {
      leftLeg.scale.set(1.2, 0.78, 1.2)
      rightLeg.scale.set(1.2, 0.78, 1.2)
    }
    const lBoot = new THREE.Mesh(isMascot ? gp.glove : gp.boot, bootMat)
    lBoot.position.set(0, -5.6, 1.4)
    if (isMascot) lBoot.scale.set(1.15, 0.78, 1.35)
    leftLeg.add(lBoot)
    const rBoot = new THREE.Mesh(isMascot ? gp.glove : gp.boot, bootMat)
    rBoot.position.set(0, -5.6, 1.4)
    if (isMascot) rBoot.scale.set(1.15, 0.78, 1.35)
    rightLeg.add(rBoot)
    bodyPivot.add(leftLeg, rightLeg)

    // Sanji: Diable Jambe blazing orange-cyan flames around right leg!
    if (cid === 'sanji') {
      const fireA = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xf97316, { transparent: true, opacity: 0.88, additive: true }))
      fireA.scale.set(1.65, 1.85, 1.65)
      fireA.position.set(0, -4.5, 1.2)
      const fireB = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xfacc15, { transparent: true, opacity: 0.9, additive: true }))
      fireB.scale.set(1.2, 1.2, 1.2)
      fireB.position.set(0, -6.2, 1.8)
      rightLeg.add(fireA, fireB)
    }

    // Nezha: flaming Wind Fire Wheels hovering under both boots!
    if (cid === 'nezha') {
      const wheelMat = makeBasicMat(mats, 0xf97316, { additive: true })
      const rimMat = makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85, emissive: 0xf59e0b, emissiveIntensity: 0.65 })
      for (const leg of [leftLeg, rightLeg]) {
        const w = new THREE.Mesh(gp.ringThin, rimMat)
        w.scale.set(0.55, 0.55, 0.55)
        w.rotation.y = Math.PI * 0.5
        w.position.set(0, -6.4, 0)
        const fl = new THREE.Mesh(gp.orb, wheelMat)
        fl.scale.set(0.95, 0.95, 1.35)
        fl.position.set(0, -6.4, -2.5)
        leg.add(w, fl)
      }
    }
  }

  // 2. Torso & Chest Modeling (Distinct per BodyArchetype)
  const suitMat = makeMat(mats, flashMaterials, profile.suitHex, {
    metalness: bType === 'armored_plate' ? 0.72 : isTitan ? 0.35 : 0.18,
    roughness: bType === 'armored_plate' ? 0.22 : 0.38,
  })
  const secMat = makeMat(mats, flashMaterials, profile.secondaryHex, {
    metalness: bType === 'armored_plate' ? 0.68 : 0.22,
    roughness: 0.34,
  })
  const skinMat = makeMat(mats, flashMaterials, profile.skinHex, { roughness: 0.38 })

  let headY = isTitan ? 48.0 : 45.2

  if (isVoxel) {
    const chest = new THREE.Mesh(gp.box, suitMat)
    chest.scale.set(17.2, 18.5, 9.2)
    chest.position.set(0, 25.2, 0)
    const neckBlock = new THREE.Mesh(gp.box, skinMat)
    neckBlock.scale.set(6.5, 3.2, 4.5)
    neckBlock.position.set(0, 35.0, 1.2)
    bodyPivot.add(chest, neckBlock)
    headY = 44.5
  } else if (isMascot) {
    // Doraemon / Po chubby spherical torso & belly patch!
    const sphereBody = new THREE.Mesh(gp.roundBelly, suitMat)
    sphereBody.scale.set(1.06, 1.0, 1.0)
    sphereBody.position.set(0, 23.5, 0)
    bodyPivot.add(sphereBody)
    if (cid === 'doraemon') {
      const whitePocketPatch = new THREE.Mesh(gp.roundBelly, secMat)
      whitePocketPatch.scale.set(0.84, 0.78, 0.55)
      whitePocketPatch.position.set(0, 22.8, 7.6)
      const pocketArc = new THREE.Mesh(gp.ringThin, makeMat(mats, flashMaterials, 0x09090b))
      pocketArc.scale.set(0.62, 0.45, 0.35)
      pocketArc.position.set(0, 20.5, 13.5)
      const collar = new THREE.Mesh(gp.sash, makeMat(mats, flashMaterials, 0xdc2626))
      collar.scale.set(1.05, 0.65, 0.95)
      collar.position.set(0, 34.0, 0)
      const bell = new THREE.Mesh(gp.orb, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.85 }))
      bell.scale.setScalar(0.82)
      bell.position.set(0, 32.8, 10.2)
      const redTail = new THREE.Mesh(gp.orb, makeMat(mats, flashMaterials, 0xdc2626))
      redTail.scale.setScalar(0.85)
      redTail.position.set(0, 14.5, -13.5)
      bodyPivot.add(whitePocketPatch, pocketArc, collar, bell, redTail)
      headY = 44.5
    } else {
      // Po Panda black chest shoulder sash & kung-fu shorts wrap
      const chestWrap = new THREE.Mesh(gp.sash, secMat)
      chestWrap.scale.set(1.42, 1.35, 1.15)
      chestWrap.position.set(0, 31.2, 0)
      const waistWrap = new THREE.Mesh(gp.sash, pantsMat)
      waistWrap.scale.set(1.42, 1.45, 1.15)
      waistWrap.position.set(0, 15.5, 0)
      bodyPivot.add(chestWrap, waistWrap)
      headY = 45.2
    }
  } else if (isTitan) {
    const tTorso = new THREE.Mesh(gp.titanTorso, suitMat)
    tTorso.scale.set(1.0, 1.0, 0.72)
    tTorso.position.y = 27.5
    bodyPivot.add(tTorso)
    if (cid === 'noone' || cid === 'escanor') {
      const chestPlate = new THREE.Mesh(gp.torso, secMat)
      chestPlate.scale.set(1.08, 0.85, 0.82)
      chestPlate.position.set(0, 29.5, 1.6)
      bodyPivot.add(chestPlate)
    }
    if (cid === 'toriko') {
      const bareChest = new THREE.Mesh(gp.slab, skinMat)
      bareChest.scale.set(0.82, 1.15, 0.85)
      bareChest.position.set(0, 28, 7.6)
      bodyPivot.add(bareChest)
    }
  } else if (bType === 'bare_chest_hero') {
    // Shirtless muscular upper torso + sculpted waist/sarong (Gray, Adam, Krahang)
    const bareTorso = new THREE.Mesh(gp.torso, skinMat)
    bareTorso.scale.set(1.04, 1.0, 0.68)
    bareTorso.position.y = 28.2
    const waistWrap = new THREE.Mesh(gp.waist, pantsMat)
    waistWrap.scale.set(1.04, 1.05, 0.72)
    waistWrap.position.y = 18.2
    bodyPivot.add(bareTorso, waistWrap)

    if (cid === 'adam') {
      // Iconic golden fig leaf waist cover!
      const leaf = new THREE.Mesh(gp.thinCone, secMat)
      leaf.scale.set(1.45, 0.55, 0.35)
      leaf.position.set(0, 15.2, 8.2)
      leaf.rotation.x = Math.PI
      bodyPivot.add(leaf)
    } else if (cid === 'gray') {
      const emblem = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8, { additive: true }))
      emblem.scale.set(0.45, 0.55, 0.25)
      emblem.position.set(3.8, 30.2, 7.4)
      const crossV = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, 0xe2e8f0, { metalness: 0.9 }))
      crossV.scale.set(1.2, 3.8, 0.8)
      crossV.position.set(0, 31.5, 7.8)
      const crossH = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, 0xe2e8f0, { metalness: 0.9 }))
      crossH.scale.set(2.8, 1.0, 0.8)
      crossH.position.set(0, 32.2, 7.8)
      bodyPivot.add(emblem, crossV, crossH)
    } else if (cid === 'krahang') {
      // Plaid shoulder sash (ผ้าขาวม้า)
      const pha = new THREE.Mesh(gp.sash, secMat)
      pha.scale.set(1.12, 0.75, 0.82)
      pha.position.set(0, 29.5, 0)
      pha.rotation.z = 0.55
      bodyPivot.add(pha)
    }
  } else {
    // Standard sculpted anime chest + waist
    const torso = new THREE.Mesh(gp.torso, suitMat)
    torso.scale.set(1.0, 1.0, 0.68)
    torso.position.y = 28.2
    const waist = new THREE.Mesh(gp.waist, suitMat)
    waist.scale.set(1.0, 1.0, 0.68)
    waist.position.y = 18.2
    bodyPivot.add(torso, waist)

    // Bespoke Chest Details
    if (cid === 'iron_man') {
      const chestArmor = new THREE.Mesh(gp.box, secMat)
      chestArmor.scale.set(13.5, 5.2, 2.2)
      chestArmor.position.set(0, 30.5, 6.8)
      const arcOuter = new THREE.Mesh(gp.ringThin, makeMat(mats, flashMaterials, 0xfacc15, { metalness: 0.9 }))
      arcOuter.scale.setScalar(0.38)
      arcOuter.position.set(0, 29.5, 8.2)
      const arcCore = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8, { additive: true }))
      arcCore.scale.set(0.85, 0.85, 0.4)
      arcCore.position.set(0, 29.5, 8.5)
      bodyPivot.add(chestArmor, arcOuter, arcCore)
    } else if (cid === 'sanji' || cid === 'meliodas') {
      const shirt = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, cid === 'sanji' ? 0x38bdf8 : 0xf8fafc))
      shirt.scale.set(4.5, 9.5, 1.2)
      shirt.position.set(0, 30.2, 7.0)
      const tie = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, cid === 'sanji' ? 0xfacc15 : 0x16a34a))
      tie.scale.set(1.8, 9.0, 1.4)
      tie.position.set(0, 28.0, 7.6)
      bodyPivot.add(shirt, tie)
    } else if (cid === 'luffy') {
      // Open red vest revealing bare chest & X-shaped scar!
      const bare = new THREE.Mesh(gp.box, skinMat)
      bare.scale.set(7.5, 13.5, 1.8)
      bare.position.set(0, 27.5, 6.8)
      const xMat = makeMat(mats, flashMaterials, 0x991b1b)
      const scarA = new THREE.Mesh(gp.box, xMat)
      scarA.scale.set(1.1, 6.5, 0.6)
      scarA.position.set(0, 29.0, 7.8)
      scarA.rotation.z = 0.72
      const scarB = new THREE.Mesh(gp.box, xMat)
      scarB.scale.set(1.1, 6.5, 0.6)
      scarB.position.set(0, 29.0, 7.8)
      scarB.rotation.z = -0.72
      bodyPivot.add(bare, scarA, scarB)
    } else if (cid === 'diavolo') {
      // Open diamond fishnet vest showing chest
      const chest = new THREE.Mesh(gp.box, skinMat)
      chest.scale.set(8.2, 13.0, 1.8)
      chest.position.set(0, 27.5, 6.8)
      bodyPivot.add(chest)
    } else if (cid === 'ben10') {
      const stripe = new THREE.Mesh(gp.box, makeMat(mats, flashMaterials, 0xf8fafc))
      stripe.scale.set(3.0, 16.5, 1.4)
      stripe.position.set(4.5, 26.2, 7.3)
      const badge = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x22c55e))
      badge.scale.set(0.55, 0.55, 0.3)
      badge.position.set(-4.5, 30.5, 7.8)
      bodyPivot.add(stripe, badge)
    } else if (cid === 'aizen') {
      const collar = new THREE.Mesh(gp.sash, secMat)
      collar.scale.set(1.08, 1.25, 0.78)
      collar.position.set(0, 34.5, 0)
      const hogyoku = new THREE.Mesh(gp.orb, makeMat(mats, flashMaterials, 0x9333ea, { emissive: 0xc084fc, emissiveIntensity: 1.5 }))
      hogyoku.scale.set(0.95, 1.35, 0.75)
      hogyoku.position.set(0, 28, 8.2)
      bodyPivot.add(collar, hogyoku)
    } else if (cid === 'nezha') {
      // Floating crimson Armillary Sash ribbon arcing gracefully over shoulders!
      const sash = new THREE.Mesh(gp.thickHorn, makeMat(mats, flashMaterials, 0xdc2626, { emissive: 0x991b1b, emissiveIntensity: 0.45 }))
      sash.scale.set(2.8, 2.2, 1.2)
      sash.position.set(0, 31.5, -5.5)
      sash.rotation.set(-0.25, 0, Math.PI * 0.1)
      bodyPivot.add(sash)
    } else if (cid === 'frieren' || cid === 'kaem') {
      const scarf = new THREE.Mesh(gp.sash, secMat)
      scarf.scale.set(1.1, 1.2, 0.85)
      scarf.position.set(0, 34.8, 0.5)
      const gem = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0x38bdf8, { additive: true }))
      gem.scale.setScalar(0.55)
      gem.position.set(0, 31.2, 8.4)
      bodyPivot.add(scarf, gem)
    } else if (cid === 'frame' || cid === 'sia_mon' || cid === 'jinwoo') {
      const collar = new THREE.Mesh(gp.sash, suitMat)
      collar.scale.set(1.1, 1.35, 0.82)
      collar.position.set(0, 35.0, 0)
      bodyPivot.add(collar)
      if (cid === 'frame') {
        const goldChain = new THREE.Mesh(gp.ringThin, secMat)
        goldChain.scale.setScalar(0.32)
        goldChain.position.set(4.5, 32.5, 7.6)
        bodyPivot.add(goldChain)
      }
    } else if (cid === 'tansan') {
      // Back sparkling soda compression canister!
      const tankMat = makeMat(mats, flashMaterials, 0xf8fafc, { metalness: 0.6, roughness: 0.2 })
      for (const sx of [-4.2, 4.2]) {
        const tank = new THREE.Mesh(gp.cyl, tankMat)
        tank.scale.set(3.2, 13.5, 3.2)
        tank.position.set(sx, 27.5, -8.5)
        bodyPivot.add(tank)
      }
    }
  }

  // 3. Shoulders, Belt & Neck (Skip when voxel or mascot handles its own)
  if (!isVoxel && !isMascot) {
    const shCol = bType === 'bare_chest_hero' ? profile.skinHex : cid === 'pa' || cid === 'iron_man' ? profile.secondaryHex : profile.suitHex
    const shMat = makeMat(mats, flashMaterials, shCol, {
      metalness: bType === 'armored_plate' ? 0.78 : 0.24,
      roughness: 0.3,
    })
    for (const sx of [isTitan ? -15.5 : -11.8, isTitan ? 15.5 : 11.8]) {
      const shCap = new THREE.Mesh(gp.pauldron, shMat)
      shCap.scale.set(bType === 'armored_plate' ? 1.25 : 1.05, 0.88, 0.95)
      shCap.position.set(sx, isTitan ? 35.5 : 33.4, 0)
      bodyPivot.add(shCap)
    }

    const belt = new THREE.Mesh(gp.sash, makeMat(mats, flashMaterials, profile.beltHex, { metalness: 0.45 }))
    belt.scale.set(1.04, 1.0, 0.72)
    belt.position.set(0, 16.5, 0)
    const buckle = new THREE.Mesh(gp.buckle, makeMat(mats, flashMaterials, accentColor, { metalness: 0.82 }))
    buckle.position.set(0, 16.5, 7.2)
    bodyPivot.add(belt, buckle)

    const neck = new THREE.Mesh(gp.neck, skinMat)
    neck.position.set(0, isTitan ? 39 : 36.8, 0)
    bodyPivot.add(neck)
  }

  // 4. Capes, Trenchcoats, Haori & Half-Cloaks
  let capePivot: THREE.Group | undefined
  if (profile.hasCape) {
    capePivot = new THREE.Group()
    capePivot.position.set(0, 35, -6.5)
    const cloakCol = profile.capeHex ?? 0x111827
    const cloakMat = makeMat(mats, flashMaterials, cloakCol, {
      emissive: profile.cloakStyle === 'shadow_violet' ? 0x4c1d95 : profile.cloakStyle === 'haori_tri' ? 0x92400e : 0x000000,
      emissiveIntensity: profile.cloakStyle === 'shadow_violet' || profile.cloakStyle === 'haori_tri' ? 0.34 : 0.08,
    })
    const cloakMesh = new THREE.Mesh(gp.cloak, cloakMat)
    if (profile.cloakStyle === 'black_bull_half') {
      cloakMesh.scale.set(0.55, 0.85, 0.9)
      cloakMesh.position.set(-7.2, -10, -1)
    } else if (profile.cloakStyle === 'babylon_waist') {
      cloakMesh.scale.set(0.95, 0.62, 0.8)
      cloakMesh.position.set(0, -18, -1)
    } else if (profile.cloakStyle === 'justice_shoulder') {
      cloakMesh.scale.set(1.25, 1.15, 1.1)
      cloakMesh.position.set(0, -12, -1.2)
    } else {
      cloakMesh.position.set(0, -12, -1)
    }
    capePivot.add(cloakMesh)

    if (profile.cloakStyle === 'akatsuki') {
      for (const [cxOff, cyOff] of [[-5, -9], [5, -16]]) {
        const cloud = new THREE.Mesh(gp.orb, makeBasicMat(mats, 0xdc2626))
        cloud.scale.set(0.95, 0.55, 0.5)
        cloud.position.set(cxOff, cyOff, -2.5)
        capePivot.add(cloud)
      }
    } else if (profile.cloakStyle === 'haori_tri') {
      for (const sx of [-6, 6]) {
        const tri = new THREE.Mesh(gp.hairSpike, makeBasicMat(mats, 0xffffff))
        tri.scale.set(0.9, 0.7, 0.4)
        tri.position.set(sx, -21, -2.6)
        capePivot.add(tri)
      }
    }
    bodyPivot.add(capePivot)
  }

  // 5. Arms & Hands
  leftArm.position.set(isTitan ? -16.8 : isMascot ? -14.2 : -13.2, isTitan ? 35 : isMascot ? 30.5 : 33.2, 0)
  rightArm.position.set(isTitan ? 16.8 : isMascot ? 14.2 : 13.2, isTitan ? 35 : isMascot ? 30.5 : 33.2, 0)

  const armCol =
    bType === 'bare_chest_hero'
      ? profile.skinHex
      : bType === 'armored_plate' || isTitan
        ? profile.suitHex
        : cid === 'iron_man'
          ? profile.suitHex
          : profile.suitHex
  const armMat = makeMat(mats, flashMaterials, armCol, { metalness: bType === 'armored_plate' ? 0.72 : 0.18 })
  const lArmMesh = new THREE.Mesh(isVoxel ? gp.box : gp.arm, armMat)
  const rArmMesh = new THREE.Mesh(isVoxel ? gp.box : gp.arm, armMat)
  if (isVoxel) {
    lArmMesh.scale.set(6.5, 16.5, 6.5)
    rArmMesh.scale.set(6.5, 16.5, 6.5)
    lArmMesh.position.y = -7.5
    rArmMesh.position.y = -7.5
  } else if (isMascot) {
    lArmMesh.scale.set(1.15, 0.78, 1.15)
    rArmMesh.scale.set(1.15, 0.78, 1.15)
    lArmMesh.position.y = -5.5
    rArmMesh.position.y = -5.5
  } else {
    lArmMesh.position.y = -7.2
    rArmMesh.position.y = -7.2
  }
  leftArm.add(lArmMesh)
  rightArm.add(rArmMesh)

  if (!isVoxel) {
    const handCol =
      cid === 'doraemon'
        ? 0xf8fafc
        : cid === 'luangphi_sorn' || cid === 'nezha'
          ? 0xdc2626
          : cid === 'luffy'
            ? 0x18181b
            : profile.skinHex
    const handMat = makeMat(mats, flashMaterials, handCol, { roughness: 0.34 })
    for (const grp of [leftArm, rightArm]) {
      const hand = new THREE.Mesh(gp.glove, handMat)
      hand.scale.setScalar(cid === 'doraemon' ? 1.15 : cid === 'luangphi_sorn' ? 1.05 : 0.78)
      hand.position.set(0, isMascot ? -10.8 : -14.2, 1.0)
      grp.add(hand)
    }
  }

  return { capePivot, headY, isTitan }
}
