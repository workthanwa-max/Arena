import * as THREE from 'three'

export interface HeroFlashMat {
  mat: THREE.MeshStandardMaterial
  baseEmissive: number
  baseIntensity: number
}

export interface Hero3dGeoPool {
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
  // Modular Remodel Primitives (created once, scaled per character)
  box: THREE.BoxGeometry
  cyl: THREE.CylinderGeometry
  slab: THREE.BoxGeometry
  thinCone: THREE.ConeGeometry
  thickHorn: THREE.TorusGeometry
  hatDisc: THREE.CylinderGeometry
  roundBelly: THREE.SphereGeometry
  crescentBlade: THREE.TorusGeometry
  ringThin: THREE.TorusGeometry
}

let geoPool: Hero3dGeoPool | null = null

export function getGeoPool(): Hero3dGeoPool {
  if (geoPool) return geoPool
  geoPool = {
    shadow: new THREE.CircleGeometry(23, 24),
    floorRing: new THREE.RingGeometry(21, 27.5, 32),
    chevron: new THREE.ConeGeometry(7.8, 14.5, 3),
    statusHalo: new THREE.RingGeometry(28.5, 34.5, 32),
    shieldSphere: new THREE.SphereGeometry(34, 20, 16),
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
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
    slab: new THREE.BoxGeometry(10, 14, 2.2),
    thinCone: new THREE.ConeGeometry(3.0, 16, 8),
    thickHorn: new THREE.TorusGeometry(6, 1.45, 8, 16, Math.PI * 0.85),
    hatDisc: new THREE.CylinderGeometry(17.5, 19.5, 1.6, 22),
    roundBelly: new THREE.SphereGeometry(13.5, 20, 16),
    crescentBlade: new THREE.TorusGeometry(11, 2.4, 8, 18, Math.PI * 0.9),
    ringThin: new THREE.TorusGeometry(10, 1.1, 8, 24),
  }
  geoPool.shadow.rotateX(-Math.PI / 2)
  geoPool.floorRing.rotateX(-Math.PI / 2)
  geoPool.statusHalo.rotateX(-Math.PI / 2)
  geoPool.chevron.rotateX(Math.PI / 2)
  geoPool.chin.rotateX(Math.PI)
  geoPool.katanaGuard.rotateX(Math.PI / 2)
  return geoPool
}

export function makeMat(
  mats: THREE.Material[],
  flashList: HeroFlashMat[],
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

export function makeBasicMat(
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
