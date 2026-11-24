import * as THREE from 'three'
import { getCachedMatchImage } from '../services/assetPreloader'
import type { MapConfig } from '../types/game'

export const SCP_CENTER_X = 1500
export const SCP_CENTER_Z = 900
export const SCP_RADIUS = 840
export const SCP_MEDKIT_SPOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 1500, y: 290 },
  { x: 1500, y: 1510 },
  { x: 1030, y: 560 },
  { x: 1970, y: 560 },
  { x: 1030, y: 1240 },
  { x: 1970, y: 1240 },
]

/**
 * Authoritative client-side mirror of Go state.IsOnDryLand for Sisaket Ko Klang Nam Huai Nam Kham.
 * Returns true when (x, z) is safely on dry island, banks, pavilions, or bridges; false when in reservoir water.
 */
export function isOnSisaketDryLand(x: number, z: number): boolean {
  // 1. Main Central Island (Ko Klang Nam Huai Nam Kham)
  const dx = (x - 1500) / 740
  const dy = (z - 900) / 510
  if (dx * dx + dy * dy <= 1) return true
  // 2. West Mainland Pier Bank (Blue Spawn)
  if (x >= 60 && x <= 540 && z >= 560 && z <= 1240) return true
  // 3. East Sisaket Aquarium Bank (Red Spawn)
  if (x >= 2460 && x <= 2940 && z >= 560 && z <= 1240) return true
  // 4. West & East Main Khmer Bridges
  if (x >= 480 && x <= 860 && z >= 795 && z <= 1005) return true
  if (x >= 2140 && x <= 2520 && z >= 795 && z <= 1005) return true
  // 5. North & South Floating Lakeside Pavilions + Walkways
  const ndx = x - 1500
  const ndy = z - 220
  if (ndx * ndx + ndy * ndy <= 145 * 145) return true
  if (x >= 1435 && x <= 1565 && z >= 220 && z <= 440) return true
  const sdx = x - 1500
  const sdy = z - 1580
  if (sdx * sdx + sdy * sdy <= 145 * 145) return true
  if (x >= 1435 && x <= 1565 && z >= 1360 && z <= 1580) return true
  // 6. Four Narrow Stepping-Stone Flank Bridges
  if (x >= 490 && x <= 980 && ((z >= 605 && z <= 685) || (z >= 1115 && z <= 1195))) return true
  if (x >= 2020 && x <= 2510 && ((z >= 605 && z <= 685) || (z >= 1115 && z <= 1195))) return true
  return false
}

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

function createSisaketFloorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1228
  const g = c.getContext('2d')!
  const w = c.width
  const h = c.height
  const sx = w / 3000
  const sy = h / 1800

  // 1. Deep Emerald-Teal Huai Nam Kham Reservoir Water
  const waterGrad = g.createRadialGradient(w * 0.5, h * 0.5, 160, w * 0.5, h * 0.5, w * 0.65)
  waterGrad.addColorStop(0, '#0f766e')
  waterGrad.addColorStop(0.5, '#0c5b6e')
  waterGrad.addColorStop(1, '#083344')
  g.fillStyle = waterGrad
  g.fillRect(0, 0, w, h)

  // Subtle shimmering lake wave bands & lotus ripples
  g.strokeStyle = 'rgba(125, 211, 252, 0.16)'
  g.lineWidth = 2.5
  for (let row = 0; row < 34; row++) {
    const wy = row * (h / 34) + 14
    g.beginPath()
    for (let x = 0; x <= w; x += 64) {
      const yOff = Math.sin(x * 0.015 + row * 1.3) * 5
      if (x === 0) g.moveTo(x, wy + yOff)
      else g.lineTo(x, wy + yOff)
    }
    g.stroke()
  }

  // Scattered lotus leaves & pink blossoms floating in Huai Nam Kham water
  for (let i = 0; i < 48; i++) {
    const lx = ((i * 223 + 95) % 2820) + 90
    const ly = ((i * 157 + 70) % 1660) + 70
    if (isOnSisaketDryLand(lx, ly)) continue
    g.fillStyle = 'rgba(22, 101, 52, 0.72)'
    g.beginPath()
    g.arc(lx * sx, ly * sy, 9 + (i % 4) * 2, 0.25, Math.PI * 1.92)
    g.lineTo(lx * sx, ly * sy)
    g.fill()
    if (i % 3 === 0) {
      g.fillStyle = 'rgba(244, 114, 182, 0.85)'
      g.beginPath()
      g.arc(lx * sx + 3, ly * sy - 2, 4.5, 0, Math.PI * 2)
      g.fill()
    }
  }

  // Helper: bright turquoise shallow water foam halo around every dry-land piece
  const drawShoreHalo = () => {
    g.fillStyle = 'rgba(45, 212, 191, 0.34)'
    // Main central island halo
    g.beginPath()
    g.ellipse(1500 * sx, 900 * sy, 764 * sx, 534 * sy, 0, 0, Math.PI * 2)
    g.fill()
    // West & East banks halo
    g.fillRect(46 * sx, 546 * sy, 508 * sx, 708 * sy)
    g.fillRect(2446 * sx, 546 * sy, 508 * sx, 708 * sy)
    // North & South pavilions halo
    g.beginPath()
    g.arc(1500 * sx, 220 * sy, 162 * sx, 0, Math.PI * 2)
    g.arc(1500 * sx, 1580 * sy, 162 * sx, 0, Math.PI * 2)
    g.fill()
  }
  drawShoreHalo()

  // 2. Stepping-Stone Narrow Flank Bridges (4 tactical water crossings)
  const flankBridges: Array<[number, number, number, number]> = [
    [490, 605, 490, 80],
    [490, 1115, 490, 80],
    [2020, 605, 490, 80],
    [2020, 1115, 490, 80],
  ]
  for (const [bx, by, bw, bh] of flankBridges) {
    g.fillStyle = '#78350f'
    g.fillRect(bx * sx, by * sy, bw * sx, bh * sy)
    g.fillStyle = '#c29b68'
    g.fillRect(bx * sx, (by + 6) * sy, bw * sx, (bh - 12) * sy)
    g.strokeStyle = 'rgba(92, 53, 21, 0.65)'
    g.lineWidth = 2.5
    for (let px = bx + 28; px < bx + bw; px += 36) {
      g.beginPath()
      g.moveTo(px * sx, (by + 6) * sy)
      g.lineTo(px * sx, (by + bh - 6) * sy)
      g.stroke()
    }
    g.strokeStyle = '#fde68a'
    g.lineWidth = 2
    g.strokeRect(bx * sx, by * sy, bw * sx, bh * sy)
  }

  // 3. North & South Floating Lakeside Pavilion Walkways
  for (const [wx, wy, ww, wh] of [
    [1435, 220, 130, 220],
    [1435, 1360, 130, 220],
  ] as const) {
    g.fillStyle = '#7c2d12'
    g.fillRect(wx * sx, wy * sy, ww * sx, wh * sy)
    g.fillStyle = '#d6b27c'
    g.fillRect((wx + 8) * sx, wy * sy, (ww - 16) * sx, wh * sy)
    g.strokeStyle = 'rgba(120, 53, 15, 0.55)'
    g.lineWidth = 2.5
    for (let py = wy + 18; py < wy + wh; py += 26) {
      g.beginPath()
      g.moveTo((wx + 8) * sx, py * sy)
      g.lineTo((wx + ww - 8) * sx, py * sy)
      g.stroke()
    }
  }

  // 4. West & East Main Khmer Bridges (connecting Mainland & Aquarium banks to Ko Klang Nam)
  for (const [bx, by, bw, bh] of [
    [480, 795, 380, 210],
    [2140, 795, 380, 210],
  ] as const) {
    g.fillStyle = '#8c3d2b' // Laterite stone edge
    g.fillRect(bx * sx, by * sy, bw * sx, bh * sy)
    g.fillStyle = '#d8c39e' // Khmer sandstone deck
    g.fillRect(bx * sx, (by + 16) * sy, bw * sx, (bh - 32) * sy)
    // Center ceremonial red runner
    g.fillStyle = 'rgba(180, 83, 9, 0.35)'
    g.fillRect(bx * sx, (by + 74) * sy, bw * sx, 62 * sy)
    g.strokeStyle = 'rgba(120, 53, 15, 0.45)'
    g.lineWidth = 2.5
    for (let px = bx + 26; px < bx + bw; px += 38) {
      g.beginPath()
      g.moveTo(px * sx, (by + 16) * sy)
      g.lineTo(px * sx, (by + bh - 16) * sy)
      g.stroke()
    }
  }

  // 5. West Mainland Pier Bank & East Sisaket Aquarium Bank
  const drawBank = (x: number, y: number, bw: number, bh: number) => {
    g.fillStyle = '#c8b08a' // Stone embankment rim
    g.beginPath()
    g.roundRect(x * sx, y * sy, bw * sx, bh * sy, 18)
    g.fill()
    g.fillStyle = '#2d6e46' // Park grass
    g.beginPath()
    g.roundRect((x + 18) * sx, (y + 18) * sy, (bw - 36) * sx, (bh - 36) * sy, 14)
    g.fill()
    // Paved plaza inside bank
    g.fillStyle = '#b9a686'
    g.beginPath()
    g.roundRect((x + 56) * sx, (y + 140) * sy, (bw - 112) * sx, (bh - 280) * sy, 12)
    g.fill()
  }
  drawBank(60, 560, 480, 680)
  drawBank(2460, 560, 480, 680)

  // 6. North & South Floating Lakeside Pavilions (ศาลากลางน้ำ)
  for (const py of [220, 1580]) {
    g.fillStyle = '#92400e'
    g.beginPath()
    g.arc(1500 * sx, py * sy, 145 * sx, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#dfc396'
    g.beginPath()
    g.arc(1500 * sx, py * sy, 130 * sx, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#f59e0b'
    g.lineWidth = 4
    g.beginPath()
    g.arc(1500 * sx, py * sy, 92 * sx, 0, Math.PI * 2)
    g.stroke()
  }

  // 7. Main Central Island — เกาะกลางน้ำ ห้วยน้ำคำ (Ko Klang Nam)
  // Laterite-sandstone shoreline embankment
  g.fillStyle = '#cbb389'
  g.beginPath()
  g.ellipse(1500 * sx, 900 * sy, 740 * sx, 510 * sy, 0, 0, Math.PI * 2)
  g.fill()
  // Lush Sisaket Botanical Park Green Grass
  const grassGrad = g.createRadialGradient(1500 * sx, 900 * sy, 90, 1500 * sx, 900 * sy, 720 * sx)
  grassGrad.addColorStop(0, '#3b8d56')
  grassGrad.addColorStop(0.72, '#2d7648')
  grassGrad.addColorStop(1, '#245e39')
  g.fillStyle = grassGrad
  g.beginPath()
  g.ellipse(1500 * sx, 900 * sy, 712 * sx, 484 * sy, 0, 0, Math.PI * 2)
  g.fill()

  // Famous Ko Klang Nam Circular Lakeside Jogging / Cycling Track
  g.strokeStyle = '#d4c3a3'
  g.lineWidth = 34 * sx
  g.beginPath()
  g.ellipse(1500 * sx, 900 * sy, 610 * sx, 405 * sy, 0, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  g.lineWidth = 2.5
  g.setLineDash([16, 14])
  g.beginPath()
  g.ellipse(1500 * sx, 900 * sy, 610 * sx, 405 * sy, 0, 0, Math.PI * 2)
  g.stroke()
  g.setLineDash([])

  // Cross-island Sandstone Promenades leading to Si Lamduan Tower
  g.fillStyle = '#d5c09b'
  g.fillRect(780 * sx, 845 * sy, 1440 * sx, 110 * sy)
  g.fillRect(1445 * sx, 410 * sy, 110 * sx, 980 * sy)

  // Central Kopura Khmer Sandstone Plaza around Si Lamduan Observation Tower
  g.fillStyle = '#9a4a32'
  g.beginPath()
  g.arc(1500 * sx, 900 * sy, 290 * sx, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#dfd0b4'
  g.beginPath()
  g.arc(1500 * sx, 900 * sy, 264 * sx, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#d97706'
  g.lineWidth = 6
  g.beginPath()
  g.arc(1500 * sx, 900 * sy, 210 * sx, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = '#0f766e'
  g.lineWidth = 4
  g.beginPath()
  g.arc(1500 * sx, 900 * sy, 140 * sx, 0, Math.PI * 2)
  g.stroke()

  // Khmer 8-point Lamduan Flower Mandala painted at center plaza
  g.save()
  g.translate(1500 * sx, 900 * sy)
  g.strokeStyle = 'rgba(180, 83, 9, 0.55)'
  g.lineWidth = 3
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    g.beginPath()
    g.moveTo(Math.cos(a) * 76 * sx, Math.sin(a) * 76 * sy)
    g.lineTo(Math.cos(a) * 210 * sx, Math.sin(a) * 210 * sy)
    g.stroke()
  }
  g.restore()

  // Caution aquatic border frame
  g.strokeStyle = 'rgba(56, 189, 248, 0.6)'
  g.lineWidth = 8
  g.strokeRect(10, 10, w - 20, h - 20)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function createScpFloorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1228
  const g = c.getContext('2d')!
  const w = c.width
  const h = c.height
  const sx = w / 3000
  const sy = h / 1800
  const cx = SCP_CENTER_X * sx
  const cy = SCP_CENTER_Z * sy
  const rx = SCP_RADIUS * sx
  const ry = SCP_RADIUS * sy

  // 1. Deep subterranean laboratory void outside the circular containment chamber
  g.fillStyle = '#050b11'
  g.fillRect(0, 0, w, h)

  // Subtle dark laboratory sub-grid outside the ring
  g.strokeStyle = 'rgba(16, 185, 129, 0.06)'
  g.lineWidth = 2
  for (let gx = 0; gx < w; gx += 64) {
    g.beginPath()
    g.moveTo(gx, 0)
    g.lineTo(gx, h)
    g.stroke()
  }
  for (let gy = 0; gy < h; gy += 64) {
    g.beginPath()
    g.moveTo(0, gy)
    g.lineTo(w, gy)
    g.stroke()
  }

  // 2. Outer Heavy Blast-Door Ring Halo
  const outerGlow = g.createRadialGradient(cx, cy, rx * 0.85, cx, cy, rx * 1.1)
  outerGlow.addColorStop(0, 'rgba(16, 185, 129, 0.25)')
  outerGlow.addColorStop(0.65, 'rgba(6, 78, 59, 0.16)')
  outerGlow.addColorStop(1, 'rgba(5, 11, 17, 0)')
  g.fillStyle = outerGlow
  g.beginPath()
  g.ellipse(cx, cy, rx * 1.09, ry * 1.09, 0, 0, Math.PI * 2)
  g.fill()

  // 3. Clipped Circular SCP Site-19 Titanium Containment Deck
  g.save()
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  g.clip()

  const deckGrad = g.createRadialGradient(cx, cy, 40, cx, cy, rx)
  deckGrad.addColorStop(0, '#202c38')
  deckGrad.addColorStop(0.55, '#18222d')
  deckGrad.addColorStop(1, '#101821')
  g.fillStyle = deckGrad
  g.fillRect(cx - rx - 10, cy - ry - 10, rx * 2 + 20, ry * 2 + 20)

  // Brushed Titanium Lab Deck Tiles
  g.strokeStyle = 'rgba(148, 163, 184, 0.13)'
  g.lineWidth = 2
  for (let tx = cx - rx; tx <= cx + rx; tx += 74) {
    g.beginPath()
    g.moveTo(tx, cy - ry)
    g.lineTo(tx, cy + ry)
    g.stroke()
  }
  for (let ty = cy - ry; ty <= cy + ry; ty += 74) {
    g.beginPath()
    g.moveTo(cx - rx, ty)
    g.lineTo(cx + rx, ty)
    g.stroke()
  }

  // Concentric Containment Sector Rings + Radial Blast Bulkhead Seams
  for (const frac of [0.94, 0.72, 0.45, 0.24]) {
    g.strokeStyle = frac === 0.94 ? 'rgba(245, 158, 11, 0.58)' : 'rgba(56, 189, 248, 0.22)'
    g.lineWidth = frac === 0.94 ? 8 : 3
    g.beginPath()
    g.ellipse(cx, cy, rx * frac, ry * frac, 0, 0, Math.PI * 2)
    g.stroke()
  }
  g.strokeStyle = 'rgba(148, 163, 184, 0.2)'
  g.lineWidth = 3
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * rx * 0.24, cy + Math.sin(a) * ry * 0.24)
    g.lineTo(cx + Math.cos(a) * rx * 0.95, cy + Math.sin(a) * ry * 0.95)
    g.stroke()
  }

  // Yellow-Black Industrial Hazard Caution Stripes around Inner Circular Perimeter
  g.strokeStyle = '#f59e0b'
  g.lineWidth = 14
  g.setLineDash([22, 18])
  g.beginPath()
  g.ellipse(cx, cy, rx * 0.968, ry * 0.968, 0, 0, Math.PI * 2)
  g.stroke()
  g.setLineDash([])

  // Iconic Center SCP Foundation Containment 3-Arrow Emblem
  g.save()
  g.translate(cx, cy)
  g.fillStyle = 'rgba(15, 23, 42, 0.76)'
  g.beginPath()
  g.arc(0, 0, 128, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(226, 232, 240, 0.42)'
  g.lineWidth = 7
  g.beginPath()
  g.arc(0, 0, 116, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = 'rgba(16, 185, 129, 0.58)'
  g.lineWidth = 5
  g.beginPath()
  g.arc(0, 0, 74, 0, Math.PI * 2)
  g.stroke()
  // 3 Inward Containment Arrows
  for (let i = 0; i < 3; i++) {
    g.save()
    g.rotate((i * Math.PI * 2) / 3 - Math.PI / 2)
    g.fillStyle = 'rgba(226, 232, 240, 0.5)'
    g.beginPath()
    g.moveTo(0, -40)
    g.lineTo(-18, -68)
    g.lineTo(-7, -68)
    g.lineTo(-7, -104)
    g.lineTo(7, -104)
    g.lineTo(7, -68)
    g.lineTo(18, -68)
    g.closePath()
    g.fill()
    g.restore()
  }
  g.restore()

  // 6 Glowing Emerald Bio-Medkit Floor Pads synced 1:1 with SCP_MEDKIT_SPOTS
  for (const spot of SCP_MEDKIT_SPOTS) {
    const mx = spot.x * sx
    const my = spot.y * sy
    const mGrad = g.createRadialGradient(mx, my, 4, mx, my, 42 * sx)
    mGrad.addColorStop(0, 'rgba(52, 211, 153, 0.52)')
    mGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.22)')
    mGrad.addColorStop(1, 'rgba(16, 185, 129, 0)')
    g.fillStyle = mGrad
    g.beginPath()
    g.arc(mx, my, 42 * sx, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(52, 211, 153, 0.85)'
    g.lineWidth = 3
    g.beginPath()
    g.arc(mx, my, 24 * sx, 0, Math.PI * 2)
    g.stroke()
    // Crisp Emerald Medical Cross inside floor pad
    g.fillStyle = 'rgba(167, 243, 208, 0.85)'
    g.fillRect(mx - 3.5, my - 10, 7, 20)
    g.fillRect(mx - 10, my - 3.5, 20, 7)
  }

  g.restore()

  // Crisp Glowing Cyan-Emerald Circular Chamber Outer Rim
  g.strokeStyle = 'rgba(16, 185, 129, 0.88)'
  g.lineWidth = 7
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  g.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/**
 * Generates a procedural tangent-space Normal Map (RGB #8080FF baseline) so directional & rim lights
 * cast crisp 3D specular highlights across tile seams, central emblems, circular containment rings, and water ripples.
 */
function createArenaNormalMapTexture(mapId?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 614
  const g = c.getContext('2d')!
  const w = c.width
  const h = c.height
  const cx = w * 0.5
  const cy = h * 0.5

  // Flat tangent-space normal Z+ (#8080ff)
  g.fillStyle = 'rgb(128, 128, 255)'
  g.fillRect(0, 0, w, h)

  // Tile / Slab beveled normal grid
  const step = mapId === 'scp_site' ? 38 : 64
  for (let x = 0; x < w; x += step) {
    g.fillStyle = 'rgb(96, 128, 245)'
    g.fillRect(x, 0, 2, h)
    g.fillStyle = 'rgb(162, 128, 245)'
    g.fillRect(x + 2, 0, 2, h)
  }
  for (let y = 0; y < h; y += step) {
    g.fillStyle = 'rgb(128, 96, 245)'
    g.fillRect(0, y, w, 2)
    g.fillStyle = 'rgb(128, 162, 245)'
    g.fillRect(0, y + 2, w, 2)
  }

  // Concentric Arena Center Medallion / SCP Circular Containment Normal Ribs
  const rings = mapId === 'scp_site' ? [55, 110, 175, 245, 285] : [65, 115, 165]
  for (const r of rings) {
    g.strokeStyle = 'rgb(172, 168, 250)'
    g.lineWidth = 4
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = 'rgb(88, 92, 235)'
    g.lineWidth = 2.5
    g.beginPath()
    g.arc(cx, cy, r + 3, 0, Math.PI * 2)
    g.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

const ambientDummy = new THREE.Object3D()

/**
 * Rebuilds the entire 3D Arena Floor, Panoramic Sky Backdrop Wall, Architecture, Pillars & Easter-Egg Props cleanly.
 */
export function buildMapEnvironment3D(
  envGroup: THREE.Group,
  scene: THREE.Scene,
  mCfg: MapConfig,
  disposables: Array<{ dispose: () => void }>,
  anisotropy = 1,
): void {
  while (envGroup.children.length > 0) {
    envGroup.remove(envGroup.children[0])
  }
  while (disposables.length > 0) {
    disposables.pop()?.dispose()
  }

  const isKonoha = mCfg.id === 'konoha'
  const isSisaket = mCfg.id === 'sisaket_island'
  const isScp = mCfg.id === 'scp_site'
  const w = mCfg.width
  const h = mCfg.height
  const cx = w * 0.5
  const cz = h * 0.5

  const bgHex = isScp ? 0x061319 : isSisaket ? 0x0a2f3d : isKonoha ? 0x182b1e : 0x090f1d
  scene.background = new THREE.Color(bgHex)
  scene.fog = new THREE.Fog(bgHex, 1300, 3100)

  // 1. Crisp Walkable Floor Plane (Shibuya vs Konoha vs Sisaket vs Circular SCP Site-19)
  const floorTex = isScp
    ? createScpFloorTexture()
    : isSisaket
      ? createSisaketFloorTexture()
      : isKonoha
        ? createKonohaFloorTexture()
        : createShibuyaFloorTexture()
  floorTex.anisotropy = Math.max(1, anisotropy)
  const normalTex = createArenaNormalMapTexture(mCfg.id)
  const floorGeo = new THREE.PlaneGeometry(w, h)
  floorGeo.rotateX(-Math.PI / 2)
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(isScp ? 0.65 : 0.48, isScp ? 0.65 : 0.48),
    roughness: isScp ? 0.32 : isSisaket ? 0.46 : isKonoha ? 0.78 : 0.62,
    metalness: isScp ? 0.48 : isSisaket ? 0.22 : isKonoha ? 0.08 : 0.2,
  })
  const floorMesh = new THREE.Mesh(floorGeo, floorMat)
  floorMesh.position.set(cx, 0, cz)
  floorMesh.receiveShadow = true
  floorMesh.userData.noCastShadow = true
  envGroup.add(floorMesh)
  disposables.push(floorTex, normalTex, floorGeo, floorMat)

  // Outer Abyss / Surround Terrain Skirt so edges look grounded cleanly
  const skirtGeo = new THREE.PlaneGeometry(w + 2200, h + 1800)
  skirtGeo.rotateX(-Math.PI / 2)
  const skirtMat = new THREE.MeshBasicMaterial({
    color: isScp ? 0x040b10 : isSisaket ? 0x073642 : isKonoha ? 0x16301d : 0x060a14,
  })
  const skirt = new THREE.Mesh(skirtGeo, skirtMat)
  skirt.position.set(cx, -3, cz)
  skirt.userData.noShadow = true
  envGroup.add(skirt)
  disposables.push(skirtGeo, skirtMat)

  // 2. Vertical Horizon Backdrop Panorama Wall far behind the North edge (where sky art belongs!)
  const skyImg = getCachedMatchImage(
    isScp
      ? '/maps/scp_bg.webp'
      : isSisaket
        ? '/maps/sisaket_bg.webp'
        : isKonoha
          ? '/maps/konoha_bg.webp'
          : '/maps/shibuya_bg.webp',
  )
  if (skyImg) {
    const skyTex = new THREE.Texture(skyImg)
    skyTex.colorSpace = THREE.SRGBColorSpace
    skyTex.anisotropy = Math.max(1, anisotropy)
    skyTex.needsUpdate = true
    const skyGeo = new THREE.PlaneGeometry(w + 1800, 960)
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, fog: false })
    const skyWall = new THREE.Mesh(skyGeo, skyMat)
    skyWall.position.set(cx, 440, -680)
    skyWall.rotation.x = 0.22
    skyWall.userData.noShadow = true
    envGroup.add(skyWall)
    disposables.push(skyTex, skyGeo, skyMat)
  }

  // 3. Central Dimensional Aegis Core Altar Ring at (1500, 900)
  const aegisRingGeo = new THREE.RingGeometry(52, 64, 36)
  aegisRingGeo.rotateX(-Math.PI / 2)
  const aegisRingMat = new THREE.MeshBasicMaterial({
    color: isScp ? 0x34d399 : 0xfacc15,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const aegisAltar = new THREE.Mesh(aegisRingGeo, aegisRingMat)
  aegisAltar.position.set(cx, 1.8, cz)
  aegisAltar.userData.noShadow = true
  envGroup.add(aegisAltar)
  disposables.push(aegisRingGeo, aegisRingMat)

  // Pooled Single-Draw-Call InstancedMesh 3D Ambient Environment Motes (Sakura / Embers / Fireflies / Bio-Spores)
  const moteCount = 44
  const moteGeo = isKonoha
    ? new THREE.ConeGeometry(4.5, 8.5, 4)
    : new THREE.OctahedronGeometry(4.2, 0)
  const moteColor = isScp ? 0x34d399 : isSisaket ? 0xfde047 : isKonoha ? 0xf9a8d4 : 0x38bdf8
  const moteMat = new THREE.MeshBasicMaterial({
    color: moteColor,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ambientInst = new THREE.InstancedMesh(moteGeo, moteMat, moteCount)
  ambientInst.userData.noShadow = true
  ambientInst.userData.isAmbientMotes = true
  const seeds: Array<{ x: number; y: number; z: number; spd: number; phase: number }> = []
  for (let i = 0; i < moteCount; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2)
    const dist = isScp ? 120 + ((i * 67) % 680) : 160 + ((i * 173) % 1180)
    const mx = cx + Math.cos(angle) * dist
    const mz = cz + Math.sin(angle) * (isScp ? dist : dist * 0.62)
    const my = 18 + ((i * 29) % 115)
    seeds.push({ x: mx, y: my, z: mz, spd: 0.8 + (i % 5) * 0.25, phase: i * 0.7 })
    ambientDummy.position.set(mx, my, mz)
    ambientDummy.scale.setScalar(0.8 + (i % 3) * 0.35)
    ambientDummy.updateMatrix()
    ambientInst.setMatrixAt(i, ambientDummy.matrix)
  }
  ambientInst.instanceMatrix.needsUpdate = true
  ambientInst.userData.seeds = seeds
  envGroup.add(ambientInst)
  disposables.push(moteGeo, moteMat)

  // 4. Perimeter Framing Scenery & Arena Boundary Curbs
  if (!isScp) {
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
  }

  if (isScp) {
    // True 3D Circular SCP Site-19 Titanium Containment Ring Wall + Observation Glass + Hazard Beacons!
    const segCount = 28
    const ringR = SCP_RADIUS + 20
    const segLen = (Math.PI * 2 * ringR) / segCount + 6
    const wallLowerGeo = new THREE.BoxGeometry(segLen, 44, 24)
    const glassPanelGeo = new THREE.BoxGeometry(segLen * 0.78, 34, 8)
    const wallCapGeo = new THREE.BoxGeometry(segLen + 4, 14, 28)
    const ribGeo = new THREE.BoxGeometry(16, 102, 34)
    const beaconGeo = new THREE.SphereGeometry(9, 10, 8)

    const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.72, roughness: 0.34 })
    const darkArmorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.68, roughness: 0.42 })
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.52,
      roughness: 0.12,
      metalness: 0.3,
      transparent: true,
      opacity: 0.62,
    })
    const amberBeaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    const emeraldBeaconMat = new THREE.MeshBasicMaterial({ color: 0x34d399 })
    const redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 })
    disposables.push(
      wallLowerGeo, glassPanelGeo, wallCapGeo, ribGeo, beaconGeo,
      titaniumMat, darkArmorMat, glassMat, amberBeaconMat, emeraldBeaconMat, redBeaconMat,
    )

    for (let i = 0; i < segCount; i++) {
      const a = (i * Math.PI * 2) / segCount
      const wx = SCP_CENTER_X + Math.cos(a) * ringR
      const wz = SCP_CENTER_Z + Math.sin(a) * ringR
      // Keep southern camera-facing wall low (curb height) so isometric view stays 100% unobstructed!
      const isSouthFront = Math.sin(a) > 0.38
      const segGrp = new THREE.Group()
      segGrp.position.set(wx, 0, wz)
      segGrp.rotation.y = -a + Math.PI / 2

      const base = new THREE.Mesh(wallLowerGeo, darkArmorMat)
      base.scale.set(1, isSouthFront ? 0.5 : 1.0, 1)
      base.position.y = isSouthFront ? 11 : 22
      segGrp.add(base)

      if (!isSouthFront) {
        const glass = new THREE.Mesh(glassPanelGeo, glassMat)
        glass.position.y = 60
        const cap = new THREE.Mesh(wallCapGeo, titaniumMat)
        cap.position.y = 84
        segGrp.add(glass, cap)
      }

      if (i % 2 === 0) {
        const rib = new THREE.Mesh(ribGeo, titaniumMat)
        rib.scale.set(1, isSouthFront ? 0.3 : 1.0, 1)
        rib.position.set(segLen * 0.48, isSouthFront ? 15 : 51, 0)
        segGrp.add(rib)
        const beacon = new THREE.Mesh(
          beaconGeo,
          i % 6 === 0 ? redBeaconMat : i % 4 === 0 ? emeraldBeaconMat : amberBeaconMat,
        )
        beacon.position.set(segLen * 0.48, isSouthFront ? 32 : 106, 0)
        segGrp.add(beacon)
      }
      envGroup.add(segGrp)
    }
  } else if (isSisaket) {
    // Sisaket Ko Klang Nam Perimeter Scenery: Tropical Lamduan Trees (ต้นลำดวน) & Bridge Khmer Balustrades
    const trunkGeo = new THREE.CylinderGeometry(11, 16, 110, 8)
    const foliageGeo = new THREE.SphereGeometry(52, 10, 8)
    const flowerGeo = new THREE.SphereGeometry(12, 8, 6)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.9 })
    const leafMatA = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 })
    const leafMatB = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.78 })
    const lamduanMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xca8a04, emissiveIntensity: 0.25, roughness: 0.5 })
    const bridgeRailGeo = new THREE.BoxGeometry(360, 14, 10)
    const lateriteMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.8 })
    const lanternPostGeo = new THREE.CylinderGeometry(4, 5, 34, 8)
    const lanternOrbGeo = new THREE.SphereGeometry(8, 8, 8)
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xfde047 })
    disposables.push(
      trunkGeo, foliageGeo, flowerGeo, trunkMat, leafMatA, leafMatB, lamduanMat,
      bridgeRailGeo, lateriteMat, lanternPostGeo, lanternOrbGeo, lanternMat,
    )

    // Tropical Lamduan trees framing far north shore
    for (let i = 0; i < 10; i++) {
      const tx = 200 + i * 285
      const tz = i % 2 === 0 ? -95 : -135
      const trunk = new THREE.Mesh(trunkGeo, trunkMat)
      trunk.position.set(tx, 55, tz)
      const c1 = new THREE.Mesh(foliageGeo, i % 2 === 0 ? leafMatA : leafMatB)
      c1.position.set(tx, 125, tz)
      c1.scale.set(1.25, 0.85, 1.15)
      const blossom = new THREE.Mesh(flowerGeo, lamduanMat)
      blossom.position.set(tx + 22, 138, tz + 18)
      envGroup.add(trunk, c1, blossom)
    }

    // 3D Khmer Laterite Bridge Balustrades & Golden Lanterns along West & East Main Bridges
    for (const bx of [670, 2330]) {
      for (const bz of [796, 1004]) {
        const bRail = new THREE.Mesh(bridgeRailGeo, lateriteMat)
        bRail.position.set(bx, 7, bz)
        envGroup.add(bRail)
        for (const ox of [-145, 0, 145]) {
          const post = new THREE.Mesh(lanternPostGeo, lateriteMat)
          post.position.set(bx + ox, 17, bz)
          const orb = new THREE.Mesh(lanternOrbGeo, lanternMat)
          orb.position.set(bx + ox, 38, bz)
          envGroup.add(post, orb)
        }
      }
    }
  } else if (isKonoha) {
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
    blood.userData.noShadow = true
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

  if (isScp) {
    // 4 Symmetrical SCP Bio-Containment Cryo-Tube Pillars synced 1:1 with Server mCfg.pillars!
    const baseGeo = new THREE.CylinderGeometry(1.06, 1.14, 18, 16)
    const tubeGeo = new THREE.CylinderGeometry(0.84, 0.84, 86, 18)
    const coreGeo = new THREE.CylinderGeometry(0.46, 0.46, 78, 12)
    const capGeo = new THREE.CylinderGeometry(1.08, 1.02, 18, 16)
    const ringGeo = new THREE.TorusGeometry(0.96, 0.08, 8, 22)
    ringGeo.rotateX(Math.PI / 2)
    const specimenGeo = new THREE.OctahedronGeometry(16, 0)

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.78, roughness: 0.26 })
    const tubeGlassMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 0.65,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.56,
    })
    const bioCoreMat = new THREE.MeshBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.85 })
    const hazardRingMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.4, metalness: 0.6 })
    disposables.push(baseGeo, tubeGeo, coreGeo, capGeo, ringGeo, specimenGeo, steelMat, tubeGlassMat, bioCoreMat, hazardRingMat)

    for (const pil of mCfg.pillars ?? []) {
      const sh = new THREE.Mesh(shadowGeo, shadowMat)
      sh.scale.setScalar(pil.radius)
      sh.position.set(pil.x, 1.4, pil.y)
      sh.userData.noShadow = true

      const base = new THREE.Mesh(baseGeo, steelMat)
      base.scale.set(pil.radius, 1, pil.radius)
      base.position.set(pil.x, 9, pil.y)

      const tube = new THREE.Mesh(tubeGeo, tubeGlassMat)
      tube.scale.set(pil.radius, 1, pil.radius)
      tube.position.set(pil.x, 60, pil.y)

      const core = new THREE.Mesh(coreGeo, bioCoreMat)
      core.scale.set(pil.radius, 1, pil.radius)
      core.position.set(pil.x, 60, pil.y)

      const specimen = new THREE.Mesh(specimenGeo, hazardRingMat)
      specimen.position.set(pil.x, 68, pil.y)
      specimen.userData.isCrystal = true

      const cap = new THREE.Mesh(capGeo, steelMat)
      cap.scale.set(pil.radius, 1, pil.radius)
      cap.position.set(pil.x, 110, pil.y)

      const band = new THREE.Mesh(ringGeo, hazardRingMat)
      band.scale.set(pil.radius, pil.radius, 1)
      band.position.set(pil.x, 22, pil.y)

      envGroup.add(sh, base, tube, core, specimen, cap, band)
    }
  } else if (isSisaket) {
    // Sisaket Real Landmarks synced 1:1 with Server mCfg.pillars!
    const towerBaseGeo = new THREE.CylinderGeometry(1.04, 1.16, 26, 12)
    const towerMidGeo = new THREE.CylinderGeometry(0.74, 0.92, 118, 12)
    const towerGlassGeo = new THREE.CylinderGeometry(0.96, 0.84, 34, 16)
    const towerCrownGeo = new THREE.ConeGeometry(0.88, 62, 8)
    const spireGeo = new THREE.ConeGeometry(0.18, 48, 8)
    const spireOrbGeo = new THREE.OctahedronGeometry(14, 0)

    const aquaBaseGeo = new THREE.CylinderGeometry(1.02, 1.12, 24, 16)
    const aquaDomeGeo = new THREE.SphereGeometry(0.96, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)
    const aquaRingGeo = new THREE.TorusGeometry(0.98, 0.08, 8, 24)
    aquaRingGeo.rotateX(Math.PI / 2)

    const khmerBaseGeo = new THREE.BoxGeometry(1.85, 18, 1.85)
    const khmerShaftGeo = new THREE.CylinderGeometry(0.72, 0.82, 88, 8)
    const khmerCapGeo = new THREE.ConeGeometry(1.05, 36, 4)
    khmerCapGeo.rotateY(Math.PI / 4)

    const sandstoneMat = new THREE.MeshStandardMaterial({ color: 0xd6b588, roughness: 0.72 })
    const lateriteRedMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.82 })
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.45, metalness: 0.75, roughness: 0.22 })
    const glassDeckMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7, roughness: 0.12, metalness: 0.35 })
    const aquaGlassMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.55, roughness: 0.14, metalness: 0.25 })
    const whiteConcreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 })

    disposables.push(
      towerBaseGeo, towerMidGeo, towerGlassGeo, towerCrownGeo, spireGeo, spireOrbGeo,
      aquaBaseGeo, aquaDomeGeo, aquaRingGeo, khmerBaseGeo, khmerShaftGeo, khmerCapGeo,
      sandstoneMat, lateriteRedMat, goldMat, glassDeckMat, aquaGlassMat, whiteConcreteMat,
    )

    for (const pil of mCfg.pillars ?? []) {
      const sh = new THREE.Mesh(shadowGeo, shadowMat)
      sh.scale.setScalar(pil.radius)
      sh.position.set(pil.x, 1.4, pil.y)
      sh.userData.noShadow = true
      envGroup.add(sh)

      if (pil.radius >= 70) {
        // Central Landmark: หอศรีลำดวนเฉลิมพระเกียรติ (Si Lamduan 16-Story Khmer Observation Tower)
        const base = new THREE.Mesh(towerBaseGeo, lateriteRedMat)
        base.scale.set(pil.radius, 1, pil.radius)
        base.position.set(pil.x, 13, pil.y)

        const mid = new THREE.Mesh(towerMidGeo, sandstoneMat)
        mid.scale.set(pil.radius, 1, pil.radius)
        mid.position.set(pil.x, 82, pil.y)

        const deck = new THREE.Mesh(towerGlassGeo, glassDeckMat)
        deck.scale.set(pil.radius, 1, pil.radius)
        deck.position.set(pil.x, 152, pil.y)

        const crown = new THREE.Mesh(towerCrownGeo, lateriteRedMat)
        crown.scale.set(pil.radius, 1, pil.radius)
        crown.position.set(pil.x, 196, pil.y)

        const spire = new THREE.Mesh(spireGeo, goldMat)
        spire.scale.set(pil.radius, 1, pil.radius)
        spire.position.set(pil.x, 246, pil.y)

        const beacon = new THREE.Mesh(spireOrbGeo, goldMat)
        beacon.position.set(pil.x, 278, pil.y)
        beacon.userData.isCrystal = true

        envGroup.add(base, mid, deck, crown, spire, beacon)
      } else if (pil.x > 2500) {
        // East Bank Landmark: ศูนย์แสดงพันธุ์สัตว์น้ำศรีสะเกษ (Sisaket Aquarium Marine Dome)
        const base = new THREE.Mesh(aquaBaseGeo, whiteConcreteMat)
        base.scale.set(pil.radius, 1, pil.radius)
        base.position.set(pil.x, 12, pil.y)

        const dome = new THREE.Mesh(aquaDomeGeo, aquaGlassMat)
        dome.scale.set(pil.radius, pil.radius * 0.95, pil.radius)
        dome.position.set(pil.x, 24, pil.y)

        const ring = new THREE.Mesh(aquaRingGeo, goldMat)
        ring.scale.set(pil.radius, pil.radius, 1)
        ring.position.set(pil.x, 26, pil.y)

        envGroup.add(base, dome, ring)
      } else {
        // Kopura Khmer Laterite Sandstone Pillars & West Island Entrance Gate
        const base = new THREE.Mesh(khmerBaseGeo, lateriteRedMat)
        base.scale.set(pil.radius, 1, pil.radius)
        base.position.set(pil.x, 9, pil.y)

        const shaft = new THREE.Mesh(khmerShaftGeo, sandstoneMat)
        shaft.scale.set(pil.radius, 1, pil.radius)
        shaft.position.set(pil.x, 60, pil.y)

        const cap = new THREE.Mesh(khmerCapGeo, lateriteRedMat)
        cap.scale.set(pil.radius, 1, pil.radius)
        cap.position.set(pil.x, 118, pil.y)

        const trim = new THREE.Mesh(spireOrbGeo, goldMat)
        trim.scale.setScalar(0.55)
        trim.position.set(pil.x, 144, pil.y)

        envGroup.add(base, shaft, cap, trim)
      }
    }
  } else if (isKonoha) {
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
      sh.userData.noShadow = true

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
      sh.userData.noShadow = true

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
  const t = nowMs * 0.001
  for (const child of envGroup.children) {
    if (child.userData.isCrystal) {
      child.rotation.y += dt * 1.15
      child.position.y = 72 + Math.sin(nowMs * 0.0032) * 7
    } else if (child.userData.isAmbientMotes && child instanceof THREE.InstancedMesh) {
      const seeds = child.userData.seeds as Array<{ x: number; y: number; z: number; spd: number; phase: number }>
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i]
        const ox = Math.sin(t * s.spd + s.phase) * 26
        const oy = Math.cos(t * (s.spd * 0.85) + s.phase) * 14
        const oz = Math.cos(t * s.spd + s.phase * 1.3) * 26
        ambientDummy.position.set(s.x + ox, s.y + oy, s.z + oz)
        ambientDummy.rotation.set(t * s.spd, t * 1.2 + s.phase, 0)
        ambientDummy.scale.setScalar(0.75 + Math.sin(t * 2.4 + s.phase) * 0.35)
        ambientDummy.updateMatrix()
        child.setMatrixAt(i, ambientDummy.matrix)
      }
      child.instanceMatrix.needsUpdate = true
    }
  }
}
