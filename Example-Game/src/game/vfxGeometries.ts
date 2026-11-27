import * as THREE from 'three'

/**
 * Sculpted 3D Anime VFX Mesh Library (`vfxGeometries.ts`, v4).
 * Procedurally constructs genuine 3D MOBA-grade VFX geometries once at startup
 * (1 draw call each, proper UV mapping for scrolling/erosion GLSL shaders, cleanly disposed)
 * replacing flat stickers and raw Box/Cone/Octahedron primitives.
 */

export interface SculptedVfxGeos {
  curvedSlashRibbon: THREE.BufferGeometry
  helicalBeamSpiral: THREE.BufferGeometry
  vortexFunnel: THREE.BufferGeometry
  jaggedFlame: THREE.BufferGeometry
  facetedCrystal: THREE.BufferGeometry
  craterRim: THREE.BufferGeometry
  gothicObelisk: THREE.BufferGeometry
}

function mergeSimpleGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let vOffset = 0

  for (const g of geos) {
    const pos = g.getAttribute('position')
    const norm = g.getAttribute('normal')
    const uv = g.getAttribute('uv')
    const idx = g.getIndex()

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i))
      else normals.push(0, 1, 0)
      if (uv) uvs.push(uv.getX(i), uv.getY(i))
      else uvs.push(0, 0)
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vOffset)
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(i + vOffset)
      }
    }
    vOffset += pos.count
    g.dispose()
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  merged.setIndex(indices)
  merged.computeVertexNormals()
  return merged
}

/**
 * 1. True 3D Curved Tapered Anime Sword-Slash Ribbon:
 * Sweeps from -72 deg to +72 deg around Y axis, pointing toward +Z, with cambered 3D height
 * (outer cutting edge slightly elevated & razor-tapered at both ends) and clean (u=arc, v=radial) UVs.
 */
function buildCurvedSlashRibbon(): THREE.BufferGeometry {
  const segs = 28
  const span = Math.PI * 0.86
  const startAngle = -span * 0.5
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segs; i++) {
    const u = i / segs
    const a = startAngle + u * span
    // Sine taper makes tips razor-sharp and middle broad & powerful
    const taper = Math.sin(u * Math.PI)
    const outerR = 1.0
    const innerR = 1.0 - (0.08 + 0.56 * Math.pow(taper, 0.72))
    // Subtle 3D curved wave elevation so the slash catches isometric depth instead of looking flat
    const yOuter = Math.sin(u * Math.PI) * 0.14
    const yInner = -Math.sin(u * Math.PI) * 0.06

    const sinA = Math.sin(a)
    const cosA = Math.cos(a)

    // Inner vertex (v = 0: trailing ink tail)
    positions.push(sinA * innerR, yInner, cosA * innerR)
    uvs.push(u, 0)

    // Outer vertex (v = 1: bright cutting edge)
    positions.push(sinA * outerR, yOuter, cosA * outerR)
    uvs.push(u, 1)

    if (i < segs) {
      const base = i * 2
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * 2. Dual Helical Energy Beam Spiral Tubes wrapping along Z (-0.5 -> +0.5, radius 1.0):
 * Gives beams genuine 3D anime twisting ribbons around the beam axis in 1 single draw call.
 */
function buildHelicalBeamSpiral(): THREE.BufferGeometry {
  const strands: THREE.BufferGeometry[] = []
  const turns = 3.0
  const steps = 36

  for (let s = 0; s < 2; s++) {
    const phase = s * Math.PI
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const a = phase + t * Math.PI * 2 * turns
      const radiusEnv = 0.78 + 0.32 * Math.sin(t * Math.PI)
      pts.push(new THREE.Vector3(Math.cos(a) * radiusEnv, Math.sin(a) * radiusEnv, t - 0.5))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    strands.push(new THREE.TubeGeometry(curve, 32, 0.11, 5, false))
  }

  return mergeSimpleGeos(strands)
}

/**
 * 3. Sculpted 3D Swirling Vortex / Tornado Funnel (height 0 -> 1, radius 0.25 -> 1.05):
 * Used for Beelzebuth, Krahang Monsoon, Wukong Cloud, Cid Atomic, and Tansan Geyser.
 */
function buildVortexFunnel(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = 0.26 + Math.pow(t, 1.45) * 0.78 + Math.sin(t * Math.PI * 3) * 0.05
    pts.push(new THREE.Vector2(r, t))
  }
  const geo = new THREE.LatheGeometry(pts, 20)
  geo.computeVertexNormals()
  return geo
}

/**
 * 4. Sculpted 3D Anime Twisting Flame Tongue (height 0 -> 1, organic curved spire):
 * Replaces generic cones for Amaterasu, Cruel Sun, Nezha Lotus, Sanji Ifrit, Meliodas Hellblaze.
 */
function buildJaggedFlame(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(0.46, 1.0, 7, 6, false)
  geo.translate(0, 0.5, 0)
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    // Gentle S-curve twist upward like hand-drawn anime fire tongues
    const twist = y * 1.35
    const cosT = Math.cos(twist)
    const sinT = Math.sin(twist)
    const swayX = Math.sin(y * Math.PI * 1.4) * 0.14 * y
    const swayZ = Math.cos(y * Math.PI * 1.1) * 0.1 * y
    const rx = x * cosT - z * sinT + swayX
    const rz = x * sinT + z * cosT + swayZ
    pos.setXYZ(i, rx, y, rz)
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * 5. Asymmetric 3-Shard Hexagonal Crystal Cluster (1 draw call!):
 * Gives Gray Ice Devil, Kai Jade Army, and Simo Frost sharp mineral silhouettes.
 */
function buildFacetedCrystal(): THREE.BufferGeometry {
  const main = new THREE.ConeGeometry(0.28, 1.0, 6)
  main.translate(0, 0.5, 0)

  const sideA = new THREE.ConeGeometry(0.18, 0.64, 5)
  sideA.translate(0, 0.32, 0)
  sideA.rotateZ(-0.36)
  sideA.translate(0.18, 0, 0.1)

  const sideB = new THREE.ConeGeometry(0.16, 0.54, 5)
  sideB.translate(0, 0.27, 0)
  sideB.rotateZ(0.32)
  sideB.rotateX(0.24)
  sideB.translate(-0.16, 0, -0.1)

  return mergeSimpleGeos([main, sideA, sideB])
}

/**
 * 6. 3D Sculpted Jagged Crater Rim (raised rocky impact ridge around unit circle):
 * Gives physical punch/slam skills genuine 3D terrain upheaval relief.
 */
function buildCraterRim(): THREE.BufferGeometry {
  const shards: THREE.BufferGeometry[] = []
  const count = 10
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const wedge = new THREE.ConeGeometry(0.22 + (i % 3) * 0.05, 0.32 + (i % 2) * 0.12, 4)
    wedge.rotateX(0.48) // tilted outward like upturned earth
    wedge.rotateY(a)
    wedge.translate(Math.sin(a) * 0.84, 0.1, Math.cos(a) * 0.84)
    shards.push(wedge)
  }
  return mergeSimpleGeos(shards)
}

/**
 * 7. Towering Tapered Gothic Obelisk / Sarcophagus Monolith (Aizen Kurohitsugi / Jinwoo / Cid):
 * Pointed architectural crown instead of a plain cube.
 */
function buildGothicObelisk(): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(0.42, 0.56, 0.8, 4)
  shaft.rotateY(Math.PI / 4)
  shaft.translate(0, 0.4, 0)

  const crown = new THREE.ConeGeometry(0.42, 0.26, 4)
  crown.rotateY(Math.PI / 4)
  crown.translate(0, 0.93, 0)

  return mergeSimpleGeos([shaft, crown])
}

export function createSculptedVfxGeos(): SculptedVfxGeos {
  return {
    curvedSlashRibbon: buildCurvedSlashRibbon(),
    helicalBeamSpiral: buildHelicalBeamSpiral(),
    vortexFunnel: buildVortexFunnel(),
    jaggedFlame: buildJaggedFlame(),
    facetedCrystal: buildFacetedCrystal(),
    craterRim: buildCraterRim(),
    gothicObelisk: buildGothicObelisk(),
  }
}

export function disposeSculptedVfxGeos(g: SculptedVfxGeos): void {
  g.curvedSlashRibbon.dispose()
  g.helicalBeamSpiral.dispose()
  g.vortexFunnel.dispose()
  g.jaggedFlame.dispose()
  g.facetedCrystal.dispose()
  g.craterRim.dispose()
  g.gothicObelisk.dispose()
}
