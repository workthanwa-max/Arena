import * as THREE from 'three'
import { getCachedMatchImage } from '../services/assetPreloader'
import type { MapConfig } from '../types/game'

function drawSeededRockCracks(g: CanvasRenderingContext2D, w: number, h: number): void {
  const crackSets: Array<Array<[number, number]>> = [
    [[0.18, 0.22], [0.24, 0.19], [0.31, 0.24], [0.35, 0.19]],
    [[0.24, 0.19], [0.22, 0.29], [0.27, 0.36], [0.25, 0.42]],
    [[0.74, 0.68], [0.68, 0.62], [0.62, 0.66], [0.56, 0.59]],
    [[0.74, 0.68], [0.80, 0.74], [0.86, 0.70], [0.91, 0.78]],
    [[0.46, 0.48], [0.41, 0.39], [0.37, 0.41], [0.33, 0.34]],
    [[0.52, 0.51], [0.58, 0.44], [0.63, 0.48], [0.68, 0.40]],
    [[0.48, 0.54], [0.44, 0.63], [0.47, 0.69], [0.42, 0.76]],
  ]
  for (const pts of crackSets) {
    g.strokeStyle = 'rgba(9, 9, 11, 0.85)'
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(pts[0][0] * w, pts[0][1] * h)
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i][0] * w, pts[i][1] * h)
    }
    g.stroke()

    g.strokeStyle = 'rgba(113, 113, 122, 0.45)'
    g.lineWidth = 1.6
    g.beginPath()
    g.moveTo(pts[0][0] * w + 2, pts[0][1] * h + 2)
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i][0] * w + 2, pts[i][1] * h + 2)
    }
    g.stroke()
  }
}

function createShibuyaFloorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1228
  const g = c.getContext('2d')!
  const w = c.width
  const h = c.height
  const cx = w * 0.5
  const cy = h * 0.5

  // Rain-washed dark urban concrete base + tiled paving blocks
  g.fillStyle = '#1b202c'
  g.fillRect(0, 0, w, h)

  const tileW = 128
  const tileH = 128
  const palette = ['#222735', '#1f2430', '#262b3a', '#1d222e']
  for (let row = 0; row * tileH < h; row++) {
    for (let col = 0; col * tileW < w; col++) {
      g.fillStyle = palette[(row * 7 + col * 3) % palette.length]
      g.fillRect(col * tileW + 2, row * tileH + 2, tileW - 4, tileH - 4)
    }
  }

  // Sidewalk walkways along Outer North/South Perimeter
  g.fillStyle = '#2d3344'
  g.fillRect(0, 0, w, 130)
  g.fillRect(0, h - 130, w, 130)
  g.strokeStyle = 'rgba(148, 163, 184, 0.25)'
  g.lineWidth = 3
  g.strokeRect(18, 18, w - 36, h - 36)

  // Major Shibuya Scramble Asphalt Roadways (Horizontal & Vertical Crossing)
  g.fillStyle = '#161a24'
  g.fillRect(0, cy - 190, w, 380)
  g.fillRect(cx - 230, 125, 460, h - 250)

  // Road Center Dashed Dividers (Golden Amber)
  g.fillStyle = 'rgba(250, 204, 21, 0.35)'
  for (let x = 40; x < w - 40; x += 96) {
    if (Math.abs(x - cx) < 260) continue
    g.fillRect(x, cy - 4, 48, 8)
  }
  for (let y = 160; y < h - 160; y += 92) {
    if (Math.abs(y - cy) < 220) continue
    g.fillRect(cx - 4, y, 8, 44)
  }

  // Iconic Shibuya Scramble Zebra Crosswalks around Central Intersection
  g.fillStyle = 'rgba(226, 232, 240, 0.28)'
  for (let k = -4; k <= 4; k++) {
    // North & South zebra bars
    g.fillRect(cx + k * 48 - 14, cy - 275, 26, 76)
    g.fillRect(cx + k * 48 - 14, cy + 199, 26, 76)
  }
  for (let k = -3; k <= 3; k++) {
    // West & East zebra bars
    g.fillRect(cx - 305, cy + k * 48 - 12, 76, 24)
    g.fillRect(cx + 229, cy + k * 48 - 12, 76, 24)
  }

  // Diagonal Shibuya Scramble Crossing stripes inside junction
  g.save()
  g.translate(cx, cy)
  g.rotate(0.45)
  g.fillStyle = 'rgba(226, 232, 240, 0.14)'
  for (let d = -4; d <= 4; d++) {
    g.fillRect(d * 46 - 10, -200, 20, 400)
  }
  g.restore()

  // Central Battle Crater & Crimson Cursed Seal Rings
  const craterGrad = g.createRadialGradient(cx, cy, 24, cx, cy, 280)
  craterGrad.addColorStop(0, 'rgba(9, 9, 11, 0.62)')
  craterGrad.addColorStop(0.65, 'rgba(24, 24, 27, 0.35)')
  craterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  g.fillStyle = craterGrad
  g.beginPath()
  g.arc(cx, cy, 280, 0, Math.PI * 2)
  g.fill()

  g.strokeStyle = 'rgba(220, 38, 38, 0.45)'
  g.lineWidth = 4
  g.beginPath()
  g.arc(cx, cy, 175, 0, Math.PI * 2)
  g.stroke()

  g.strokeStyle = 'rgba(56, 189, 248, 0.25)'
  g.lineWidth = 2.5
  g.beginPath()
  g.arc(cx, cy, 265, 0, Math.PI * 2)
  g.stroke()

  drawSeededRockCracks(g, w, h)

  // Crimson battle stains across shattered concrete
  for (const [bx, by, rx, ry, col] of [
    [cx - 340, cy - 170, 38, 22, 'rgba(127, 29, 29, 0.65)'],
    [cx + 390, cy + 165, 44, 26, 'rgba(127, 29, 29, 0.6)'],
    [cx + 120, cy - 220, 28, 16, 'rgba(153, 27, 27, 0.58)'],
    [cx - 260, cy + 250, 30, 18, 'rgba(127, 29, 29, 0.55)'],
  ] as const) {
    g.fillStyle = col
    g.beginPath()
    g.ellipse(bx, by, rx, ry, 0.3, 0, Math.PI * 2)
    g.fill()
  }

  // Blue West Spawn Sanctuary & Red East Spawn Sanctuary Rings
  const blueGrad = g.createRadialGradient(135, cy, 12, 135, cy, 125)
  blueGrad.addColorStop(0, 'rgba(56, 189, 248, 0.38)')
  blueGrad.addColorStop(1, 'rgba(37, 99, 235, 0)')
  g.fillStyle = blueGrad
  g.beginPath()
  g.arc(135, cy, 125, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(56, 189, 248, 0.65)'
  g.lineWidth = 4
  g.beginPath()
  g.arc(135, cy, 95, 0, Math.PI * 2)
  g.stroke()

  const redGrad = g.createRadialGradient(w - 135, cy, 12, w - 135, cy, 125)
  redGrad.addColorStop(0, 'rgba(248, 113, 113, 0.38)')
  redGrad.addColorStop(1, 'rgba(220, 38, 38, 0)')
  g.fillStyle = redGrad
  g.beginPath()
  g.arc(w - 135, cy, 125, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(248, 113, 113, 0.65)'
  g.lineWidth = 4
  g.beginPath()
  g.arc(w - 135, cy, 95, 0, Math.PI * 2)
  g.stroke()

  // Caution border curbs
  g.strokeStyle = 'rgba(239, 68, 68, 0.65)'
  g.lineWidth = 8
  g.strokeRect(8, 8, w - 16, h - 16)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function createKonohaFloorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1228
  const g = c.getContext('2d')!
  const w = c.width
  const h = c.height
  const cx = w * 0.5
  const cy = h * 0.5

  // Sun-warmed packed ninja earth courtyard + sandstone flagstones
  g.fillStyle = '#9c7850'
  g.fillRect(0, 0, w, h)

  const slabColors = ['#b48d60', '#a98256', '#bd976a', '#9f794d']
  const tile = 128
  for (let r = 0; r * tile < h; r++) {
    for (let col = 0; col * tile < w; col++) {
      g.fillStyle = slabColors[(r * 5 + col * 11) % slabColors.length]
      g.fillRect(col * tile + 3, r * tile + 3, tile - 6, tile - 6)
    }
  }

  // Lush Forest Moss & Grass Perimeter Verges
  g.fillStyle = '#2d5a34'
  g.fillRect(0, 0, w, 92)
  g.fillRect(0, h - 92, w, 92)
  g.fillRect(0, 0, 86, h)
  g.fillRect(w - 86, 0, 86, h)

  // Sandstone East-West Shinobi Lane connecting Bases
  g.fillStyle = '#c8a679'
  g.fillRect(110, cy - 115, w - 220, 230)
  g.strokeStyle = 'rgba(120, 53, 15, 0.45)'
  g.lineWidth = 4
  g.strokeRect(110, cy - 115, w - 220, 230)

  // Central Chuunin Arena Plaza + Hidden Leaf Spiral Emblem
  g.fillStyle = '#8b6a44'
  g.beginPath()
  g.arc(cx, cy, 275, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#c49f71'
  g.beginPath()
  g.arc(cx, cy, 240, 0, Math.PI * 2)
  g.fill()

  g.strokeStyle = '#166534'
  g.lineWidth = 10
  g.beginPath()
  g.arc(cx, cy, 248, 0, Math.PI * 2)
  g.stroke()

  g.strokeStyle = '#facc15'
  g.lineWidth = 4
  g.beginPath()
  g.arc(cx, cy, 170, 0, Math.PI * 2)
  g.stroke()

  // Konoha Swirl Seal painted inside central courtyard
  g.strokeStyle = 'rgba(20, 83, 45, 0.6)'
  g.lineWidth = 9
  g.beginPath()
  for (let t = 0; t <= 42; t++) {
    const a = t * 0.25
    const r = t * 2.3
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (t === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.stroke()

  // West Blue Shinobi Pad & East Red Shinobi Pad
  for (const [bx, col, rim] of [
    [155, 'rgba(37, 99, 235, 0.28)', 'rgba(56, 189, 248, 0.72)'],
    [w - 155, 'rgba(220, 38, 38, 0.28)', 'rgba(248, 113, 113, 0.72)'],
  ] as const) {
    g.fillStyle = col
    g.beginPath()
    g.arc(bx, cy, 108, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = rim
    g.lineWidth = 5
    g.beginPath()
    g.arc(bx, cy, 108, 0, Math.PI * 2)
    g.stroke()
  }

  // Moss patches & fallen pink Sakura petals
  for (let i = 0; i < 42; i++) {
    const px = ((i * 197 + 60) % (w - 220)) + 110
    const py = ((i * 131 + 80) % (h - 200)) + 100
    g.fillStyle = i % 3 === 0 ? 'rgba(77, 124, 15, 0.34)' : 'rgba(249, 168, 212, 0.72)'
    g.beginPath()
    g.ellipse(px, py, i % 3 === 0 ? 24 : 9, i % 3 === 0 ? 14 : 5, i * 0.6, 0, Math.PI * 2)
    g.fill()
  }

  g.strokeStyle = 'rgba(250, 204, 21, 0.62)'
  g.lineWidth = 8
  g.strokeRect(12, 12, w - 24, h - 24)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/**
 * Rebuilds the entire 3D Arena Floor, Panoramic Sky Backdrop Wall, Architecture, Pillars & Easter-Egg Props cleanly.
 */
export function buildMapEnvironment3D(
  envGroup: THREE.Group,
  scene: THREE.Scene,
  mCfg: MapConfig,
  disposables: Array<{ dispose: () => void }>,
): void {
  while (envGroup.children.length > 0) {
    envGroup.remove(envGroup.children[0])
  }
  while (disposables.length > 0) {
    disposables.pop()?.dispose()
  }

  const isKonoha = mCfg.id === 'konoha'
  const w = mCfg.width
  const h = mCfg.height
  const cx = w * 0.5
  const cz = h * 0.5

  const bgHex = isKonoha ? 0x182b1e : 0x090f1d
  scene.background = new THREE.Color(bgHex)
  scene.fog = new THREE.Fog(bgHex, 1300, 3100)

  // 1. Crisp Walkable Floor Plane (Distinct Shibuya Asphalt/Crosswalk vs Konoha Courtyard)
  const floorTex = isKonoha ? createKonohaFloorTexture() : createShibuyaFloorTexture()
  const floorGeo = new THREE.PlaneGeometry(w, h)
  floorGeo.rotateX(-Math.PI / 2)
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: isKonoha ? 0.88 : 0.72,
    metalness: isKonoha ? 0.05 : 0.14,
  })
  const floorMesh = new THREE.Mesh(floorGeo, floorMat)
  floorMesh.position.set(cx, 0, cz)
  envGroup.add(floorMesh)
  disposables.push(floorTex, floorGeo, floorMat)

  // Outer Abyss / Surround Terrain Skirt so edges look grounded cleanly
  const skirtGeo = new THREE.PlaneGeometry(w + 2200, h + 1800)
  skirtGeo.rotateX(-Math.PI / 2)
  const skirtMat = new THREE.MeshBasicMaterial({ color: isKonoha ? 0x16301d : 0x060a14 })
  const skirt = new THREE.Mesh(skirtGeo, skirtMat)
  skirt.position.set(cx, -3, cz)
  envGroup.add(skirt)
  disposables.push(skirtGeo, skirtMat)

  // 2. Vertical Horizon Backdrop Panorama Wall far behind the North edge (where sky art belongs!)
  const skyImg = getCachedMatchImage(isKonoha ? '/maps/konoha_bg.webp' : '/maps/shibuya_bg.webp')
  if (skyImg) {
    const skyTex = new THREE.Texture(skyImg)
    skyTex.colorSpace = THREE.SRGBColorSpace
    skyTex.needsUpdate = true
    const skyGeo = new THREE.PlaneGeometry(w + 1800, 960)
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, fog: false })
    const skyWall = new THREE.Mesh(skyGeo, skyMat)
    skyWall.position.set(cx, 440, -680)
    skyWall.rotation.x = 0.22
    envGroup.add(skyWall)
    disposables.push(skyTex, skyGeo, skyMat)
  }

  // 3. West Blue Nexus & East Red Nexus Crystal Altars + Floating Rings
  const crystalGeo = new THREE.OctahedronGeometry(30, 0)
  const pedGeo = new THREE.CylinderGeometry(54, 68, 20, 20)
  const auraRingGeo = new THREE.RingGeometry(58, 72, 32)
  auraRingGeo.rotateX(-Math.PI / 2)

  const bluePedMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.55, roughness: 0.35 })
  const redPedMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, metalness: 0.55, roughness: 0.35 })
  const blueCryMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.0, roughness: 0.15 })
  const redCryMat = new THREE.MeshStandardMaterial({ color: 0xf87171, emissive: 0xdc2626, emissiveIntensity: 1.0, roughness: 0.15 })
  const blueAuraMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  const redAuraMat = new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  disposables.push(crystalGeo, pedGeo, auraRingGeo, bluePedMat, redPedMat, blueCryMat, redCryMat, blueAuraMat, redAuraMat)

  for (const [bx, pMat, cMat, aMat] of [
    [180, bluePedMat, blueCryMat, blueAuraMat],
    [w - 180, redPedMat, redCryMat, redAuraMat],
  ] as const) {
    const ped = new THREE.Mesh(pedGeo, pMat)
    ped.position.set(bx, 10, cz)
    const aura = new THREE.Mesh(auraRingGeo, aMat)
    aura.position.set(bx, 2, cz)
    const cry = new THREE.Mesh(crystalGeo, cMat)
    cry.position.set(bx, 72, cz)
    cry.scale.set(1, 1.55, 1)
    cry.userData.isCrystal = true
    envGroup.add(ped, aura, cry)
  }

  // 4. Perimeter Framing Scenery & Arena Boundary Curbs
  const railMat = new THREE.MeshStandardMaterial({
    color: isKonoha ? 0x78350f : 0x334155,
    roughness: 0.65,
    emissive: isKonoha ? 0x000000 : 0x450a0a,
    emissiveIntensity: isKonoha ? 0 : 0.25,
  })
  const northSouthGeo = new THREE.BoxGeometry(w + 24, 18, 22)
  const westEastGeo = new THREE.BoxGeometry(22, 18, h + 24)
  disposables.push(railMat, northSouthGeo, westEastGeo)

  const northRail = new THREE.Mesh(northSouthGeo, railMat)
  northRail.position.set(cx, 9, -11)
  const southRail = new THREE.Mesh(northSouthGeo, railMat)
  southRail.position.set(cx, 9, h + 11)
  const westRail = new THREE.Mesh(westEastGeo, railMat)
  westRail.position.set(-11, 9, cz)
  const eastRail = new THREE.Mesh(westEastGeo, railMat)
  eastRail.position.set(w + 11, 9, cz)
  envGroup.add(northRail, southRail, westRail, eastRail)

  if (isKonoha) {
    // 10 Lush Pink Sakura Trees & Wooden Watchposts framing Konoha perimeter
    const trunkGeo = new THREE.CylinderGeometry(12, 18, 120, 10)
    const crownGeo = new THREE.SphereGeometry(58, 12, 10)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x573b26, roughness: 0.9 })
    const sakuraMatA = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.7 })
    const sakuraMatB = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7 })
    disposables.push(trunkGeo, crownGeo, trunkMat, sakuraMatA, sakuraMatB)

    for (let i = 0; i < 10; i++) {
      const tx = 220 + i * 280
      const tz = i % 2 === 0 ? -95 : -130
      const trunk = new THREE.Mesh(trunkGeo, trunkMat)
      trunk.position.set(tx, 60, tz)
      const c1 = new THREE.Mesh(crownGeo, i % 2 === 0 ? sakuraMatA : sakuraMatB)
      c1.position.set(tx, 135, tz)
      c1.scale.set(1.25, 0.85, 1.1)
      const c2 = new THREE.Mesh(crownGeo, i % 2 === 0 ? sakuraMatB : sakuraMatA)
      c2.position.set(tx + 34, 120, tz + 16)
      c2.scale.set(0.85, 0.7, 0.85)
      envGroup.add(trunk, c1, c2)
    }

    // Non-blocking Konoha Prop: 3 Bound Wooden Training Logs tucked neatly above center plaza
    const logGeo = new THREE.CylinderGeometry(14, 14, 72, 12)
    const topGeo = new THREE.CylinderGeometry(13.5, 13.5, 2, 12)
    const ropeGeo = new THREE.TorusGeometry(15.5, 2.5, 6, 16)
    ropeGeo.rotateX(Math.PI / 2)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
    const sliceMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.7 })
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 })
    disposables.push(logGeo, topGeo, ropeGeo, woodMat, sliceMat, ropeMat)

    for (const [ox, hScale] of [
      [-36, 0.92],
      [0, 1.12],
      [36, 0.88],
    ] as const) {
      const px = cx + ox
      const pz = 420
      const log = new THREE.Mesh(logGeo, woodMat)
      log.scale.set(1, hScale, 1)
      log.position.set(px, 36 * hScale, pz)
      const top = new THREE.Mesh(topGeo, sliceMat)
      top.position.set(px, 72 * hScale + 1, pz)
      const rope = new THREE.Mesh(ropeGeo, ropeMat)
      rope.position.set(px, 28, pz)
      envGroup.add(log, top, rope)
    }
  } else {
    // 14 Dark Shibuya Ruined Neon Skyscraper Towers & Streetlamps framing North/Side Horizon
    const bldgGeo = new THREE.BoxGeometry(1, 1, 1)
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.45 })
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    const neonRed = new THREE.MeshBasicMaterial({ color: 0xef4444 })
    const neonGold = new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    disposables.push(bldgGeo, bldgMat, neonCyan, neonRed, neonGold)

    for (let i = 0; i < 14; i++) {
      const bx = 130 + i * 210
      const bz = i % 2 === 0 ? -155 : -215
      const bh = 220 + ((i * 73) % 210)
      const bw = 96 + ((i * 29) % 44)
      const tower = new THREE.Mesh(bldgGeo, bldgMat)
      tower.scale.set(bw, bh, 96)
      tower.position.set(bx, bh * 0.5, bz)
      tower.rotation.z = ((i % 3) - 1) * 0.03
      const strip = new THREE.Mesh(bldgGeo, i % 3 === 0 ? neonCyan : i % 3 === 1 ? neonRed : neonGold)
      strip.scale.set(bw * 0.72, 7, 4)
      strip.position.set(bx, bh * 0.72, bz + 50)
      envGroup.add(tower, strip)
    }

    // Non-blocking Shibuya Easter-Egg Prop beside central Scramble plaza: Prop Gojo Half-Body
    const poolGeo = new THREE.CircleGeometry(68, 22)
    poolGeo.rotateX(-Math.PI / 2)
    const slabGeo = new THREE.BoxGeometry(34, 10, 22)
    const hairGeo = new THREE.SphereGeometry(10, 12, 10)
    const eyeGeo = new THREE.SphereGeometry(2, 6, 6)
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x7f1d1d, transparent: true, opacity: 0.82 })
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 })
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
    const sixEyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    disposables.push(poolGeo, slabGeo, hairGeo, eyeGeo, bloodMat, coatMat, hairMat, sixEyeMat)

    const gx = cx + 105
    const gz = cz - 95
    const blood = new THREE.Mesh(poolGeo, bloodMat)
    blood.position.set(gx, 1.2, gz)
    const upper = new THREE.Mesh(slabGeo, coatMat)
    upper.position.set(gx - 22, 5.5, gz)
    upper.rotation.y = 0.25
    const lower = new THREE.Mesh(slabGeo, coatMat)
    lower.position.set(gx + 22, 5.5, gz + 6)
    lower.rotation.y = -0.15
    const gojoHead = new THREE.Mesh(hairGeo, hairMat)
    gojoHead.position.set(gx - 42, 7, gz - 4)
    const gojoEye = new THREE.Mesh(eyeGeo, sixEyeMat)
    gojoEye.position.set(gx - 38, 12, gz + 3)
    envGroup.add(blood, upper, lower, gojoHead, gojoEye)
  }

  // 5. High-Detail Obstacles synced 1:1 with Server mCfg.pillars!
  const shadowGeo = new THREE.CircleGeometry(1.18, 22)
  shadowGeo.rotateX(-Math.PI / 2)
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.45, depthWrite: false })
  disposables.push(shadowGeo, shadowMat)

  if (isKonoha) {
    const stoneBaseGeo = new THREE.CylinderGeometry(1.08, 1.18, 18, 12)
    const shaftGeo = new THREE.CylinderGeometry(0.78, 0.85, 96, 14)
    const beamGeo = new THREE.BoxGeometry(2.15, 13, 0.72)
    const roofGeo = new THREE.ConeGeometry(1.42, 36, 4)
    roofGeo.rotateY(Math.PI / 4)
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 })
    const crimsonTimberMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55 })
    const sageRoofMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.5 })
    const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.25 })
    disposables.push(stoneBaseGeo, shaftGeo, beamGeo, roofGeo, stoneMat, crimsonTimberMat, sageRoofMat, goldTrimMat)

    for (const pil of mCfg.pillars ?? []) {
      const sh = new THREE.Mesh(shadowGeo, shadowMat)
      sh.scale.setScalar(pil.radius)
      sh.position.set(pil.x, 1.4, pil.y)

      const base = new THREE.Mesh(stoneBaseGeo, stoneMat)
      base.scale.set(pil.radius, 1, pil.radius)
      base.position.set(pil.x, 9, pil.y)

      const shaft = new THREE.Mesh(shaftGeo, crimsonTimberMat)
      shaft.scale.set(pil.radius, 1, pil.radius)
      shaft.position.set(pil.x, 60, pil.y)

      const crossBeam = new THREE.Mesh(beamGeo, crimsonTimberMat)
      crossBeam.scale.set(pil.radius, 1, pil.radius)
      crossBeam.position.set(pil.x, 94, pil.y)

      const roof = new THREE.Mesh(roofGeo, sageRoofMat)
      roof.scale.set(pil.radius, 1, pil.radius)
      roof.position.set(pil.x, 122, pil.y)

      const finial = new THREE.Mesh(beamGeo, goldTrimMat)
      finial.scale.set(pil.radius * 0.45, 0.75, pil.radius * 0.45)
      finial.position.set(pil.x, 108, pil.y)

      envGroup.add(sh, base, shaft, crossBeam, roof, finial)
    }
  } else {
    // Shibuya Shattered Concrete + Crimson Seal Band + Exposed Bent Rebar Pylons
    const plinthGeo = new THREE.CylinderGeometry(1.06, 1.15, 16, 10)
    const shaftGeo = new THREE.CylinderGeometry(0.86, 0.94, 104, 14)
    const sealBandGeo = new THREE.CylinderGeometry(0.95, 0.95, 10, 14)
    const rebarGeo = new THREE.CylinderGeometry(0.06, 0.06, 26, 6)
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.78, metalness: 0.22 })
    const darkConcreteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
    const crimsonSealMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0x7f1d1d, emissiveIntensity: 0.5, roughness: 0.4 })
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.85, roughness: 0.3 })
    disposables.push(plinthGeo, shaftGeo, sealBandGeo, rebarGeo, concreteMat, darkConcreteMat, crimsonSealMat, rebarMat)

    for (const pil of mCfg.pillars ?? []) {
      const sh = new THREE.Mesh(shadowGeo, shadowMat)
      sh.scale.setScalar(pil.radius)
      sh.position.set(pil.x, 1.4, pil.y)

      const plinth = new THREE.Mesh(plinthGeo, darkConcreteMat)
      plinth.scale.set(pil.radius, 1, pil.radius)
      plinth.position.set(pil.x, 8, pil.y)

      const col = new THREE.Mesh(shaftGeo, concreteMat)
      col.scale.set(pil.radius, 1, pil.radius)
      col.position.set(pil.x, 62, pil.y)

      const seal = new THREE.Mesh(sealBandGeo, crimsonSealMat)
      seal.scale.set(pil.radius, 1, pil.radius)
      seal.position.set(pil.x, 54, pil.y)

      envGroup.add(sh, plinth, col, seal)

      // 4 Exposed Jagged Iron Rebar Rods jutting out of shattered concrete top
      for (let r = 0; r < 4; r++) {
        const ang = (r * Math.PI) / 2 + 0.4
        const rebar = new THREE.Mesh(rebarGeo, rebarMat)
        rebar.scale.set(pil.radius, 1, pil.radius)
        rebar.position.set(pil.x + Math.cos(ang) * pil.radius * 0.48, 120, pil.y + Math.sin(ang) * pil.radius * 0.48)
        rebar.rotation.set(Math.sin(ang) * 0.28, 0, Math.cos(ang) * 0.28)
        envGroup.add(rebar)
      }
    }
  }
}

export function animateMapEnvironment3D(envGroup: THREE.Group, nowMs: number, dt: number): void {
  for (const child of envGroup.children) {
    if (child.userData.isCrystal) {
      child.rotation.y += dt * 1.15
      child.position.y = 72 + Math.sin(nowMs * 0.0032) * 7
    }
  }
}
