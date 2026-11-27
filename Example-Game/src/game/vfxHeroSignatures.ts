import * as THREE from 'three'
import type { FeelTier } from './gameFeelController'
import type { InstancedParticleKind } from './vfxInstancedPool'
import type { VfxShaderLibrary } from './vfxShaders'

/**
 * Per-Hero Unique 3D VFX Signatures for all 51 heroes + igris.
 * Maps every server `kind` string to bespoke GLSL shaders, silhouette geometry,
 * GPU-instanced particle types, and Game Feel trauma tiers.
 */

export type ProjShapeStyle =
  | 'orb'
  | 'blade'
  | 'lance'
  | 'card'
  | 'fist'
  | 'wheel'
  | 'cube'
  | 'shuriken'

export interface HeroVfxSignature {
  id: string
  coreHex: number
  outerHex: number
  projShape: ProjShapeStyle
  beamSpeed: number
  zoneDome: boolean
  zoneShockwave: boolean
  particleKind: InstancedParticleKind
  feelTier: FeelTier
}

const SIGNATURES: Record<string, HeroVfxSignature> = {
  // Core 23 Heroes + Igris (verified against go-backend/internal/modules/state/characters.go)
  pa: { id: 'pa', coreHex: 0xfef08a, outerHex: 0xef4444, projShape: 'blade', beamSpeed: 2.4, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'heavy' },
  sia_mon: { id: 'sia_mon', coreHex: 0xe0f2fe, outerHex: 0x38bdf8, projShape: 'orb', beamSpeed: 2.0, zoneDome: true, zoneShockwave: true, particleKind: 'orb', feelTier: 'heavy' },
  ajarn_boy: { id: 'ajarn_boy', coreHex: 0xfda4af, outerHex: 0xdc2626, projShape: 'blade', beamSpeed: 2.5, zoneDome: true, zoneShockwave: true, particleKind: 'shard', feelTier: 'heavy' },
  thanwa: { id: 'thanwa', coreHex: 0x86efac, outerHex: 0x10b981, projShape: 'blade', beamSpeed: 2.2, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' },
  ko: { id: 'ko', coreHex: 0xfef9c3, outerHex: 0xf59e0b, projShape: 'blade', beamSpeed: 3.1, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' }, // Zenitsu Agatsuma
  kaem: { id: 'kaem', coreHex: 0x7dd3fc, outerHex: 0x1d4ed8, projShape: 'orb', beamSpeed: 1.9, zoneDome: true, zoneShockwave: true, particleKind: 'orb', feelTier: 'medium' }, // Rimuru Tempest
  frame: { id: 'frame', coreHex: 0xfef08a, outerHex: 0x9333ea, projShape: 'fist', beamSpeed: 2.1, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'heavy' }, // Joestar & Stand Aiouan
  ole: { id: 'ole', coreHex: 0xf43f5e, outerHex: 0x18181b, projShape: 'shuriken', beamSpeed: 1.8, zoneDome: true, zoneShockwave: false, particleKind: 'shard', feelTier: 'medium' }, // Itachi Uchiha
  ajarn_au: { id: 'ajarn_au', coreHex: 0xe0f2fe, outerHex: 0x06b6d4, projShape: 'lance', beamSpeed: 2.8, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' }, // Killua Zoldyck
  boy: { id: 'boy', coreHex: 0xe0f2fe, outerHex: 0x3b82f6, projShape: 'orb', beamSpeed: 2.6, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'heavy' },
  luangphi_sorn: { id: 'luangphi_sorn', coreHex: 0xffffff, outerHex: 0xf97316, projShape: 'fist', beamSpeed: 3.0, zoneDome: false, zoneShockwave: true, particleKind: 'shard', feelTier: 'cataclysm' },
  noone: { id: 'noone', coreHex: 0xfde047, outerHex: 0x9333ea, projShape: 'orb', beamSpeed: 2.0, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'heavy' },
  simo: { id: 'simo', coreHex: 0xf0f9ff, outerHex: 0x38bdf8, projShape: 'lance', beamSpeed: 3.2, zoneDome: true, zoneShockwave: true, particleKind: 'shard', feelTier: 'medium' },
  jinwoo: { id: 'jinwoo', coreHex: 0xc084fc, outerHex: 0x3b0764, projShape: 'blade', beamSpeed: 2.4, zoneDome: true, zoneShockwave: true, particleKind: 'orb', feelTier: 'large' },
  igris: { id: 'igris', coreHex: 0xfca5a5, outerHex: 0xdc2626, projShape: 'blade', beamSpeed: 2.3, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'large' },
  naruto: { id: 'naruto', coreHex: 0xfef08a, outerHex: 0xf97316, projShape: 'orb', beamSpeed: 2.2, zoneDome: false, zoneShockwave: true, particleKind: 'orb', feelTier: 'large' },
  sanji: { id: 'sanji', coreHex: 0x7dd3fc, outerHex: 0xf97316, projShape: 'wheel', beamSpeed: 2.5, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' },
  luffy: { id: 'luffy', coreHex: 0xfef2f2, outerHex: 0xdc2626, projShape: 'fist', beamSpeed: 2.4, zoneDome: false, zoneShockwave: true, particleKind: 'shard', feelTier: 'large' },
  ben10: { id: 'ben10', coreHex: 0x4ade80, outerHex: 0x22d3ee, projShape: 'orb', beamSpeed: 2.6, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' },
  diablo: { id: 'diablo', coreHex: 0xf43f5e, outerHex: 0x581c87, projShape: 'blade', beamSpeed: 2.1, zoneDome: true, zoneShockwave: true, particleKind: 'shard', feelTier: 'large' },
  aizen: { id: 'aizen', coreHex: 0xe9d5ff, outerHex: 0x7e22ce, projShape: 'blade', beamSpeed: 1.9, zoneDome: true, zoneShockwave: true, particleKind: 'shard', feelTier: 'large' },
  toriko: { id: 'toriko', coreHex: 0xfef08a, outerHex: 0xef4444, projShape: 'blade', beamSpeed: 2.3, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'large' },
  frieren: { id: 'frieren', coreHex: 0xe0f2fe, outerHex: 0x38bdf8, projShape: 'lance', beamSpeed: 2.4, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'large' },
  iron_man: { id: 'iron_man', coreHex: 0xbae6fd, outerHex: 0xef4444, projShape: 'lance', beamSpeed: 2.8, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'large' },
  diavolo: { id: 'diavolo', coreHex: 0xfda4af, outerHex: 0xbe123c, projShape: 'fist', beamSpeed: 2.5, zoneDome: true, zoneShockwave: true, particleKind: 'shard', feelTier: 'large' },

  // Roster 28 Heroes (every single hero gets a tailored signature!)
  gray: { id: 'gray', coreHex: 0xe0f2fe, outerHex: 0x0ea5e9, projShape: 'lance', beamSpeed: 2.1, zoneDome: true, zoneShockwave: true, particleKind: 'shard', feelTier: 'medium' },
  cid: { id: 'cid', coreHex: 0xf0abfc, outerHex: 0x6b21a8, projShape: 'blade', beamSpeed: 2.6, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'large' },
  pop: { id: 'pop', coreHex: 0x86efac, outerHex: 0x15803d, projShape: 'orb', beamSpeed: 1.8, zoneDome: false, zoneShockwave: true, particleKind: 'orb', feelTier: 'medium' },
  speed_grandma: { id: 'speed_grandma', coreHex: 0xfde047, outerHex: 0xdc2626, projShape: 'lance', beamSpeed: 3.1, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' },
  krahang: { id: 'krahang', coreHex: 0xfef08a, outerHex: 0xd97706, projShape: 'wheel', beamSpeed: 2.2, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' },
  krasue: { id: 'krasue', coreHex: 0xfda4af, outerHex: 0xe11d48, projShape: 'orb', beamSpeed: 2.0, zoneDome: false, zoneShockwave: true, particleKind: 'orb', feelTier: 'medium' },
  po: { id: 'po', coreHex: 0xfef08a, outerHex: 0xf59e0b, projShape: 'fist', beamSpeed: 2.0, zoneDome: false, zoneShockwave: true, particleKind: 'ring', feelTier: 'large' },
  tai_lung: { id: 'tai_lung', coreHex: 0x93c5fd, outerHex: 0x1d4ed8, projShape: 'fist', beamSpeed: 2.5, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' },
  kai: { id: 'kai', coreHex: 0x6ee7b7, outerHex: 0x059669, projShape: 'blade', beamSpeed: 2.1, zoneDome: false, zoneShockwave: true, particleKind: 'shard', feelTier: 'medium' },
  gambit: { id: 'gambit', coreHex: 0xf9a8d4, outerHex: 0xdb2777, projShape: 'card', beamSpeed: 2.4, zoneDome: false, zoneShockwave: true, particleKind: 'shard', feelTier: 'medium' },
  law: { id: 'law', coreHex: 0xe0f2fe, outerHex: 0x0284c7, projShape: 'blade', beamSpeed: 2.2, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'large' },
  garp: { id: 'garp', coreHex: 0xfef08a, outerHex: 0xb91c1c, projShape: 'fist', beamSpeed: 2.6, zoneDome: false, zoneShockwave: true, particleKind: 'shard', feelTier: 'large' },
  tansan: { id: 'tansan', coreHex: 0xf0f9ff, outerHex: 0x38bdf8, projShape: 'orb', beamSpeed: 2.2, zoneDome: false, zoneShockwave: true, particleKind: 'orb', feelTier: 'medium' },
  wukong: { id: 'wukong', coreHex: 0xfef08a, outerHex: 0xea580c, projShape: 'lance', beamSpeed: 2.4, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'large' },
  nezha: { id: 'nezha', coreHex: 0xfde047, outerHex: 0xef4444, projShape: 'wheel', beamSpeed: 2.5, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'medium' },
  king: { id: 'king', coreHex: 0xfef08a, outerHex: 0xdc2626, projShape: 'orb', beamSpeed: 1.9, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'large' },
  gon: { id: 'gon', coreHex: 0xfef08a, outerHex: 0x16a34a, projShape: 'fist', beamSpeed: 2.3, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'large' },
  steve: { id: 'steve', coreHex: 0x67e8f9, outerHex: 0x0891b2, projShape: 'cube', beamSpeed: 2.0, zoneDome: false, zoneShockwave: true, particleKind: 'shard', feelTier: 'medium' },
  doraemon: { id: 'doraemon', coreHex: 0xf9a8d4, outerHex: 0x0ea5e9, projShape: 'wheel', beamSpeed: 1.8, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'medium' },
  yami: { id: 'yami', coreHex: 0xd8b4fe, outerHex: 0x3b0764, projShape: 'blade', beamSpeed: 2.6, zoneDome: true, zoneShockwave: true, particleKind: 'shard', feelTier: 'large' },
  escanor: { id: 'escanor', coreHex: 0xfef9c3, outerHex: 0xf59e0b, projShape: 'orb', beamSpeed: 2.1, zoneDome: false, zoneShockwave: true, particleKind: 'orb', feelTier: 'large' },
  meliodas: { id: 'meliodas', coreHex: 0x86efac, outerHex: 0x6b21a8, projShape: 'blade', beamSpeed: 2.4, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'large' },
  adam: { id: 'adam', coreHex: 0xe0f2fe, outerHex: 0xf59e0b, projShape: 'fist', beamSpeed: 2.6, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'large' },
  beelzebub: { id: 'beelzebub', coreHex: 0xf0abfc, outerHex: 0x9333ea, projShape: 'orb', beamSpeed: 2.2, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'large' },
  buddha: { id: 'buddha', coreHex: 0xfef08a, outerHex: 0x38bdf8, projShape: 'wheel', beamSpeed: 1.9, zoneDome: true, zoneShockwave: true, particleKind: 'ring', feelTier: 'large' },
  cj_palony: { id: 'cj_palony', coreHex: 0xfda4af, outerHex: 0xe11d48, projShape: 'fist', beamSpeed: 2.4, zoneDome: false, zoneShockwave: true, particleKind: 'spark', feelTier: 'large' },
}

const DEFAULT_SIG: HeroVfxSignature = {
  id: 'default',
  coreHex: 0xe0f2fe,
  outerHex: 0x539bf5,
  projShape: 'orb',
  beamSpeed: 2.0,
  zoneDome: false,
  zoneShockwave: true,
  particleKind: 'spark',
  feelTier: 'medium',
}

/**
 * Resolves any server Projectile / Beam / Zone `kind` string to its hero's bespoke VFX signature.
 */
export function resolveVfxSignature(kind: string | undefined, fallbackColorHex: number, fallbackAccentHex: number): HeroVfxSignature {
  if (!kind) {
    return { ...DEFAULT_SIG, coreHex: fallbackAccentHex, outerHex: fallbackColorHex }
  }
  const k = kind.toLowerCase()

  // Direct hero-ID prefix checks
  for (const key of Object.keys(SIGNATURES)) {
    if (k.startsWith(key) || k.includes(`_${key}_`) || k.includes(key)) {
      return SIGNATURES[key]
    }
  }

  // Semantic ability-name mappings (verified against characters.go)
  if (k.includes('enuma') || k.includes('gate') || k.includes('gilga')) return SIGNATURES.pa
  if (k.includes('gojo') || k.includes('infinite_void') || k.includes('hollow_purple') || k.includes('iconic_rct')) return SIGNATURES.sia_mon
  if (k.includes('dismantle') || k.includes('shrine') || k.includes('fuga')) return SIGNATURES.ajarn_boy
  if (k.includes('sanzen') || k.includes('pound_ho') || k.includes('shishi') || k.includes('zoro')) return SIGNATURES.thanwa
  if (k.includes('narukami') || k.includes('godspeed') || k.includes('killua')) return SIGNATURES.ajarn_au
  if (k.includes('amaterasu') || k.includes('tsukuyomi') || k.includes('crow') || k.includes('itachi')) return SIGNATURES.ole
  if (k.includes('beelzebuth') || k.includes('rimuru') || k.includes('black_lightning') || k.includes('black_flame')) return SIGNATURES.kaem
  if (k.includes('aiouan') || k.includes('ora_meow') || k.includes('the_world')) return SIGNATURES.frame
  if (k.includes('zenitsu') || k.includes('honoo') || k.includes('hekireki') || k.includes('sixfold')) return SIGNATURES.ko
  if (k.includes('kamehameha') || k.includes('ki_blast') || k.includes('goku')) return SIGNATURES.boy
  if (k.includes('saitama')) return SIGNATURES.luangphi_sorn
  if (k.includes('thanos') || k.includes('infinity_snap')) return SIGNATURES.noone
  if (k.includes('ironman') || k.includes('unibeam')) return SIGNATURES.iron_man
  if (k.includes('tailung')) return SIGNATURES.tai_lung
  if (k.includes('atomic')) return SIGNATURES.cid
  if (k.includes('dimension_slash') || k.includes('black_moon')) return SIGNATURES.yami
  if (k.includes('cruel_sun')) return SIGNATURES.escanor
  if (k.includes('full_counter') || k.includes('hellblaze')) return SIGNATURES.meliodas
  if (k.includes('shambles') || k.includes('amputate') || k.includes('room')) return SIGNATURES.law
  if (k.includes('galaxy_impact') || k.includes('galaxy_divide')) return SIGNATURES.garp
  if (k.includes('wuxi')) return SIGNATURES.po
  if (k.includes('jajanken')) return SIGNATURES.gon

  return {
    ...DEFAULT_SIG,
    coreHex: fallbackAccentHex,
    outerHex: fallbackColorHex,
  }
}

// Shared reusable lightweight geometries for shader overlays (disposed on Vfx3dManager.dispose)
export interface SharedShaderGeos {
  plasmaSphere: THREE.SphereGeometry
  beamCyl: THREE.CylinderGeometry
  slashRibbon: THREE.RingGeometry
  groundPlane: THREE.PlaneGeometry
  domeHemi: THREE.SphereGeometry
  cardBox: THREE.BoxGeometry
  wheelTorus: THREE.TorusGeometry
}

export function createSharedShaderGeos(): SharedShaderGeos {
  const beamCyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true)
  beamCyl.rotateX(Math.PI / 2)
  const groundPlane = new THREE.PlaneGeometry(2, 2)
  groundPlane.rotateX(-Math.PI / 2)
  const domeHemi = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
  const slashRibbon = new THREE.RingGeometry(0.45, 1.0, 24, 1, -Math.PI * 0.65, Math.PI * 1.3)
  slashRibbon.rotateX(-Math.PI / 2)
  const wheelTorus = new THREE.TorusGeometry(1, 0.22, 8, 20)
  wheelTorus.rotateX(Math.PI / 2)

  return {
    plasmaSphere: new THREE.SphereGeometry(1, 16, 12),
    beamCyl,
    slashRibbon,
    groundPlane,
    domeHemi,
    cardBox: new THREE.BoxGeometry(1.1, 0.16, 1.65),
    wheelTorus,
  }
}

export function disposeSharedShaderGeos(geos: SharedShaderGeos): void {
  geos.plasmaSphere.dispose()
  geos.beamCyl.dispose()
  geos.slashRibbon.dispose()
  geos.groundPlane.dispose()
  geos.domeHemi.dispose()
  geos.cardBox.dispose()
  geos.wheelTorus.dispose()
}

function registerShaderMat(grp: THREE.Group, mat: THREE.ShaderMaterial, baseOpacity: number): THREE.ShaderMaterial {
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
 * Attaches hero-specific GLSL shader shell & silhouette to a projectile Group.
 */
export function enhanceProjectileWithShader(
  grp: THREE.Group,
  sig: HeroVfxSignature,
  radius: number,
  shaderLib: VfxShaderLibrary,
  geos: SharedShaderGeos,
): void {
  const r = Math.max(8, radius)
  if (sig.projShape === 'blade' || sig.projShape === 'shuriken') {
    const slashMat = registerShaderMat(
      grp,
      shaderLib.createMaterial('slash', sig.coreHex, sig.outerHex, { opacity: 0.94, speed: sig.beamSpeed }),
      0.94,
    )
    const arc = new THREE.Mesh(geos.slashRibbon, slashMat)
    arc.scale.setScalar(r * 1.65)
    arc.position.y = 2
    grp.add(arc)
  } else if (sig.projShape === 'wheel') {
    const wheelMat = registerShaderMat(
      grp,
      shaderLib.createMaterial('plasma', sig.coreHex, sig.outerHex, { opacity: 0.92, speed: sig.beamSpeed }),
      0.92,
    )
    const wheel = new THREE.Mesh(geos.wheelTorus, wheelMat)
    wheel.scale.setScalar(r * 1.15)
    grp.add(wheel)
  } else if (sig.projShape === 'card' || sig.projShape === 'cube') {
    const cardMat = registerShaderMat(
      grp,
      shaderLib.createMaterial('plasma', sig.coreHex, sig.outerHex, { opacity: 0.95, speed: sig.beamSpeed }),
      0.95,
    )
    const mesh = new THREE.Mesh(geos.cardBox, cardMat)
    mesh.scale.setScalar(sig.projShape === 'cube' ? r * 0.95 : r * 1.15)
    grp.add(mesh)
  } else {
    const orbMat = registerShaderMat(
      grp,
      shaderLib.createMaterial('plasma', sig.coreHex, sig.outerHex, { opacity: 0.88, speed: sig.beamSpeed }),
      0.88,
    )
    const shell = new THREE.Mesh(geos.plasmaSphere, orbMat)
    shell.scale.set(
      r * (sig.projShape === 'lance' ? 0.72 : 1.18),
      r * (sig.projShape === 'lance' ? 0.72 : 1.18),
      r * (sig.projShape === 'lance' ? 2.1 : 1.18),
    )
    grp.add(shell)
  }
}

/**
 * Attaches an animated GLSL EnergyBeamShader plasma tube along any beam.
 */
export function enhanceBeamWithShader(
  grp: THREE.Group,
  sig: HeroVfxSignature,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  shaderLib: VfxShaderLibrary,
  geos: SharedShaderGeos,
): void {
  const dx = x2 - x1
  const dz = y2 - y1
  const len = Math.max(12, Math.hypot(dx, dz))
  const yaw = Math.atan2(dx, dz)
  const w = Math.max(10, width * 0.65)

  const beamMat = registerShaderMat(
    grp,
    shaderLib.createMaterial('beam', sig.coreHex, sig.outerHex, { opacity: 0.92, speed: sig.beamSpeed }),
    0.92,
  )
  const tube = new THREE.Mesh(geos.beamCyl, beamMat)
  tube.scale.set(w * 1.18, w * 1.18, len)
  tube.position.set((x1 + x2) * 0.5, 25, (y1 + y2) * 0.5)
  tube.rotation.y = yaw
  grp.add(tube)
}

/**
 * Attaches GLSL DomainFieldShader ground runes + optional 3D Fresnel Dome + ShockwaveRingShader to a zone.
 */
export function enhanceZoneWithShader(
  grp: THREE.Group,
  sig: HeroVfxSignature,
  radius: number,
  isWindup: boolean,
  shaderLib: VfxShaderLibrary,
  geos: SharedShaderGeos,
): void {
  const r = Math.max(16, radius)

  const groundMat = registerShaderMat(
    grp,
    shaderLib.createMaterial('domain', sig.coreHex, sig.outerHex, {
      opacity: isWindup ? 0.52 : 0.78,
      speed: isWindup ? 2.2 : 1.35,
    }),
    isWindup ? 0.52 : 0.78,
  )
  const ground = new THREE.Mesh(geos.groundPlane, groundMat)
  ground.scale.setScalar(r * 1.04)
  ground.position.y = 2.8
  grp.add(ground)

  if (!isWindup && sig.zoneDome) {
    const domeMat = registerShaderMat(
      grp,
      shaderLib.createMaterial('domain', sig.coreHex, sig.outerHex, { opacity: 0.36, speed: 1.1 }),
      0.36,
    )
    const dome = new THREE.Mesh(geos.domeHemi, domeMat)
    dome.scale.set(r * 0.98, Math.min(180, r * 0.65), r * 0.98)
    dome.position.y = 1.5
    grp.add(dome)
  }

  if (!isWindup && sig.zoneShockwave) {
    const shockMat = registerShaderMat(
      grp,
      shaderLib.createMaterial('shockwave', sig.coreHex, sig.outerHex, { opacity: 0.95, speed: 1.6 }),
      0.95,
    )
    shockMat.userData.isShockwaveProgress = true
    const wave = new THREE.Mesh(geos.groundPlane, shockMat)
    wave.scale.setScalar(r * 1.25)
    wave.position.y = 3.4
    grp.add(wave)
  }
}
