import * as THREE from 'three'

interface SigilPalette {
  primary: string
  secondary: string
  glow: string
  glyphs: string[]
}

const HERO_SIGILS: Record<string, SigilPalette> = {
  noone: {
    primary: '#A855F7',
    secondary: '#FACC15',
    glow: 'rgba(168, 85, 247, 0.42)',
    glyphs: ['✦', '◈', '❖', '✧', '⟐', '✶', '⊹', '⟡'],
  },
  ko: {
    primary: '#FACC15',
    secondary: '#7DD3FC',
    glow: 'rgba(250, 204, 21, 0.45)',
    glyphs: ['⚡', '✦', '✧', '◈', '✶', '⊹', '⚡', '✦'],
  },
  sia_mon: {
    primary: '#38BDF8',
    secondary: '#A855F7',
    glow: 'rgba(56, 189, 248, 0.44)',
    glyphs: ['∞', '✦', '◈', '✧', '∞', '✶', '⊹', '❖'],
  },
  ajarn_boy: {
    primary: '#EF4444',
    secondary: '#FCA5A5',
    glow: 'rgba(239, 68, 68, 0.46)',
    glyphs: ['✕', '◈', '✦', '❖', '✕', '✧', '✶', '⊹'],
  },
  thanwa: {
    primary: '#10B981',
    secondary: '#C084FC',
    glow: 'rgba(16, 185, 129, 0.42)',
    glyphs: ['✦', '❖', '◈', '✧', '✶', '⊹', '✦', '❖'],
  },
  pa: {
    primary: '#FACC15',
    secondary: '#EF4444',
    glow: 'rgba(250, 204, 21, 0.46)',
    glyphs: ['✶', '✦', '◈', '❖', '✧', '⊹', '✶', '✦'],
  },
  kaem: {
    primary: '#38BDF8',
    secondary: '#FACC15',
    glow: 'rgba(56, 189, 248, 0.44)',
    glyphs: ['❖', '✦', '✧', '◈', '✶', '⟡', '⊹', '✦'],
  },
  frame: {
    primary: '#FACC15',
    secondary: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.44)',
    glyphs: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'],
  },
  ole: {
    primary: '#DC2626',
    secondary: '#F87171',
    glow: 'rgba(220, 38, 38, 0.46)',
    glyphs: ['◈', '✦', '✧', '❖', '◈', '✶', '⊹', '✦'],
  },
  ajarn_au: {
    primary: '#22D3EE',
    secondary: '#FEF08A',
    glow: 'rgba(34, 211, 238, 0.46)',
    glyphs: ['⚡', '✧', '✦', '◈', '⚡', '✶', '⊹', '✧'],
  },
  boy: {
    primary: '#F97316',
    secondary: '#FACC15',
    glow: 'rgba(249, 115, 22, 0.45)',
    glyphs: ['★', '✦', '◈', '✧', '★', '✶', '⊹', '✦'],
  },
  luangphi_sorn: {
    primary: '#FACC15',
    secondary: '#DC2626',
    glow: 'rgba(250, 204, 21, 0.48)',
    glyphs: ['✦', '✶', '❖', '◈', '✧', '✦', '✶', '❖'],
  },
  default: {
    primary: '#38BDF8',
    secondary: '#E0F2FE',
    glow: 'rgba(56, 189, 248, 0.4)',
    glyphs: ['✦', '◈', '✧', '❖', '✶', '⊹', '✦', '◈'],
  },
}

const CANCEL_SIGIL: SigilPalette = {
  primary: '#EF4444',
  secondary: '#FCA5A5',
  glow: 'rgba(239, 68, 68, 0.48)',
  glyphs: ['✕', '✕', '✕', '✕', '✕', '✕', '✕', '✕'],
}

function drawPolygon(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rot: number,
): void {
  g.beginPath()
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides
    const x = cx + Math.cos(a) * radius
    const y = cy + Math.sin(a) * radius
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  g.stroke()
}

function drawStarPolygon(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  points: number,
  step: number,
  rot: number,
): void {
  g.beginPath()
  for (let i = 0; i <= points; i++) {
    const idx = (i * step) % points
    const a = rot + (idx * Math.PI * 2) / points
    const x = cx + Math.cos(a) * radius
    const y = cy + Math.sin(a) * radius
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
}

function bakeMagicCircleTexture(charId: string, cancel: boolean, isOuterRange: boolean): THREE.CanvasTexture {
  const pal = cancel ? CANCEL_SIGIL : (HERO_SIGILS[charId] ?? HERO_SIGILS.default)
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  const cx = size * 0.5
  const cy = size * 0.5
  const R = size * 0.46

  // Soft arcane inner glow halo
  const radGrad = g.createRadialGradient(cx, cy, R * 0.08, cx, cy, R)
  radGrad.addColorStop(0, isOuterRange ? 'rgba(0,0,0,0)' : pal.glow)
  radGrad.addColorStop(0.7, isOuterRange ? 'rgba(0,0,0,0)' : 'rgba(15, 23, 42, 0.08)')
  radGrad.addColorStop(0.92, pal.glow)
  radGrad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = radGrad
  g.beginPath()
  g.arc(cx, cy, R, 0, Math.PI * 2)
  g.fill()

  g.shadowColor = pal.primary
  g.shadowBlur = 14

  // Outer Double Arcane Rings + Precision Degree Notches
  g.strokeStyle = pal.primary
  g.lineWidth = isOuterRange ? 5.5 : 7
  g.beginPath()
  g.arc(cx, cy, R * 0.96, 0, Math.PI * 2)
  g.stroke()

  g.strokeStyle = pal.secondary
  g.lineWidth = 2.6
  g.beginPath()
  g.arc(cx, cy, R * 0.85, 0, Math.PI * 2)
  g.stroke()

  // Delicate Arcane Tick Marks along Outer Ring
  const tickCount = charId === 'frame' ? 24 : 36
  for (let i = 0; i < tickCount; i++) {
    const a = (i * Math.PI * 2) / tickCount
    const major = i % 3 === 0
    const rIn = R * (major ? 0.85 : 0.90)
    const rOut = R * 0.96
    g.strokeStyle = major ? pal.secondary : pal.primary
    g.lineWidth = major ? 3.2 : 1.6
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn)
    g.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut)
    g.stroke()
  }

  // Orbiting Arcane Rune Glyphs between Outer & Inner Rings
  const glyphs = pal.glyphs
  const glyphN = glyphs.length
  g.font = charId === 'frame' ? '800 20px Georgia, serif' : '700 22px Inter, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i < glyphN; i++) {
    const a = (i * Math.PI * 2) / glyphN - Math.PI / 2
    const gx = cx + Math.cos(a) * (R * 0.905)
    const gy = cy + Math.sin(a) * (R * 0.905)
    g.save()
    g.translate(gx, gy)
    g.rotate(a + Math.PI / 2)
    g.fillStyle = i % 2 === 0 ? '#FFFFFF' : pal.secondary
    g.fillText(glyphs[i], 0, 0)
    g.restore()
  }

  // Character-Specific Sacred Geometric Centerpiece!
  if (!isOuterRange) {
    g.lineWidth = 3.6
    g.strokeStyle = pal.primary
    g.beginPath()
    g.arc(cx, cy, R * 0.56, 0, Math.PI * 2)
    g.stroke()

    if (charId === 'noone' && !cancel) {
      // Thanos Sanctuary Hexagram + 5 Colored Infinity Stone Nodes!
      g.strokeStyle = pal.secondary
      g.lineWidth = 4
      drawPolygon(g, cx, cy, R * 0.82, 3, -Math.PI / 2)
      drawPolygon(g, cx, cy, R * 0.82, 3, Math.PI / 2)
      drawPolygon(g, cx, cy, R * 0.54, 6, 0)
      const gemCols = ['#A855F7', '#3B82F6', '#EF4444', '#10B981', '#FACC15']
      for (let s = 0; s < 5; s++) {
        const a = -Math.PI / 2 + (s * Math.PI * 2) / 5
        const gx = cx + Math.cos(a) * (R * 0.72)
        const gy = cy + Math.sin(a) * (R * 0.72)
        g.fillStyle = gemCols[s]
        g.beginPath()
        g.arc(gx, gy, 14, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = '#FEF9C3'
        g.lineWidth = 3
        g.stroke()
      }
    } else if (charId === 'ko' && !cancel) {
      // Zenitsu 5-Point Thunder Pentagram + Razor Spark Vertices
      g.strokeStyle = '#FACC15'
      g.lineWidth = 5
      drawStarPolygon(g, cx, cy, R * 0.82, 5, 2, -Math.PI / 2)
      g.strokeStyle = '#7DD3FC'
      g.lineWidth = 2.6
      drawPolygon(g, cx, cy, R * 0.5, 5, -Math.PI / 2)
    } else if (charId === 'sia_mon' && !cancel) {
      // Gojo Limitless Infinity Lemniscate + Red/Blue Orbs + Six Eyes Core
      g.strokeStyle = '#38BDF8'
      g.lineWidth = 4.5
      g.beginPath()
      for (let t = 0; t <= 80; t++) {
        const ang = (t / 80) * Math.PI * 2
        const denom = 1 + Math.sin(ang) * Math.sin(ang)
        const ix = cx + ((R * 0.62 * Math.cos(ang)) / denom)
        const iy = cy + ((R * 0.52 * Math.sin(ang) * Math.cos(ang)) / denom)
        if (t === 0) g.moveTo(ix, iy)
        else g.lineTo(ix, iy)
      }
      g.stroke()
      // Red & Blue Polarity Nodes
      g.fillStyle = '#EF4444'
      g.beginPath()
      g.arc(cx - R * 0.64, cy, 13, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#38BDF8'
      g.beginPath()
      g.arc(cx + R * 0.64, cy, 13, 0, Math.PI * 2)
      g.fill()
    } else if (charId === 'ajarn_boy' && !cancel) {
      // Sukuna Cursed Crimson Seal + Razor X-Cross + 4 Shrine Corners
      g.strokeStyle = '#EF4444'
      g.lineWidth = 5
      drawPolygon(g, cx, cy, R * 0.8, 4, Math.PI / 4)
      drawPolygon(g, cx, cy, R * 0.8, 4, 0)
      g.strokeStyle = '#FFFFFF'
      g.lineWidth = 3.2
      g.beginPath()
      g.moveTo(cx - R * 0.52, cy - R * 0.52)
      g.lineTo(cx + R * 0.52, cy + R * 0.52)
      g.moveTo(cx + R * 0.52, cy - R * 0.52)
      g.lineTo(cx - R * 0.52, cy + R * 0.52)
      g.stroke()
    } else if (charId === 'thanwa' && !cancel) {
      // Zoro Enma Triad Double-Triangle Santoryu Seal
      g.strokeStyle = '#10B981'
      g.lineWidth = 4.5
      drawPolygon(g, cx, cy, R * 0.83, 3, -Math.PI / 2)
      g.strokeStyle = '#C084FC'
      g.lineWidth = 4.5
      drawPolygon(g, cx, cy, R * 0.83, 3, Math.PI / 2)
      drawPolygon(g, cx, cy, R * 0.45, 3, -Math.PI / 2)
    } else if (charId === 'kaem' || charId === 'pa') {
      // Rimuru Raphael Octagram / Gilgamesh Babylonian 8-Point Royal Seal
      g.strokeStyle = pal.primary
      g.lineWidth = 4.2
      drawPolygon(g, cx, cy, R * 0.83, 4, 0)
      g.strokeStyle = pal.secondary
      g.lineWidth = 4.2
      drawPolygon(g, cx, cy, R * 0.83, 4, Math.PI / 4)
      drawPolygon(g, cx, cy, R * 0.48, 8, Math.PI / 8)
    } else if (charId === 'frame' && !cancel) {
      // ZA WARUDO Golden Clockwork Hands + Joestar Star
      g.strokeStyle = '#FACC15'
      g.lineWidth = 5
      drawStarPolygon(g, cx, cy, R * 0.65, 5, 2, -Math.PI / 2)
      g.strokeStyle = '#FFFFFF'
      g.lineWidth = 6
      g.beginPath()
      g.moveTo(cx, cy)
      g.lineTo(cx + R * 0.42, cy - R * 0.28)
      g.moveTo(cx, cy)
      g.lineTo(cx - R * 0.55, cy + R * 0.14)
      g.stroke()
    } else if (charId === 'ole' && !cancel) {
      // Itachi Mangekyo Sharingan Triple Swirling Mandala
      g.strokeStyle = '#DC2626'
      g.lineWidth = 5
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3
        g.beginPath()
        g.arc(cx + Math.cos(a) * R * 0.34, cy + Math.sin(a) * R * 0.34, R * 0.42, a + 0.4, a + 2.4)
        g.stroke()
        g.fillStyle = '#EF4444'
        g.beginPath()
        g.arc(cx + Math.cos(a) * R * 0.64, cy + Math.sin(a) * R * 0.64, 11, 0, Math.PI * 2)
        g.fill()
      }
    } else {
      // Clean 6-Point Arcane Hexagram + Center Star
      g.strokeStyle = pal.primary
      g.lineWidth = 4
      drawPolygon(g, cx, cy, R * 0.82, 3, -Math.PI / 2)
      g.strokeStyle = pal.secondary
      g.lineWidth = 4
      drawPolygon(g, cx, cy, R * 0.82, 3, Math.PI / 2)
    }

    // Center Luminous Arcane Reticle Core
    g.fillStyle = '#FFFFFF'
    g.beginPath()
    g.arc(cx, cy, 8, 0, Math.PI * 2)
    g.fill()
  } else {
    // Outer Cast-Range Ring subtle geometric octagon/star corners (keeps arena floor clearly readable!)
    g.strokeStyle = pal.primary
    g.globalAlpha = 0.55
    g.lineWidth = 2.4
    drawPolygon(g, cx, cy, R * 0.85, 8, Math.PI / 8)
    g.globalAlpha = 1
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function bakeArcaneCorridorTexture(charId: string, cancel: boolean): THREE.CanvasTexture {
  const pal = cancel ? CANCEL_SIGIL : (HERO_SIGILS[charId] ?? HERO_SIGILS.default)
  const w = 256
  const h = 512
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!

  // Glowing side energy corridor gradient
  const grad = g.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.14, pal.glow)
  grad.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  grad.addColorStop(0.86, pal.glow)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 12, w, h - 24)

  g.shadowColor = pal.primary
  g.shadowBlur = 12

  // Luminous Left & Right Arcane Side Rails
  g.strokeStyle = pal.primary
  g.lineWidth = 6
  g.beginPath()
  g.moveTo(22, 16)
  g.lineTo(22, h - 24)
  g.moveTo(w - 22, 16)
  g.lineTo(w - 22, h - 24)
  g.stroke()

  // Center Arcane Spine
  g.strokeStyle = pal.secondary
  g.lineWidth = 2.5
  g.setLineDash([14, 12])
  g.beginPath()
  g.moveTo(w * 0.5, 24)
  g.lineTo(w * 0.5, h - 28)
  g.stroke()
  g.setLineDash([])

  // Forward-pointing Arcane Chevrons (pointing toward +Z = bottom of plane after rotateX(-PI/2)!)
  for (let i = 0; i < 6; i++) {
    const y = 70 + i * 74
    g.strokeStyle = i === 5 ? '#FFFFFF' : pal.secondary
    g.lineWidth = i === 5 ? 6 : 4
    g.beginPath()
    g.moveTo(w * 0.24, y - 22)
    g.lineTo(w * 0.5, y + 10)
    g.lineTo(w * 0.76, y - 22)
    g.stroke()
  }

  // Front Arrowhead Cap
  g.strokeStyle = pal.primary
  g.lineWidth = 6
  g.beginPath()
  g.moveTo(22, h - 34)
  g.lineTo(w * 0.5, h - 6)
  g.lineTo(w - 22, h - 34)
  g.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export class ArcaneAimTextureCache {
  private outerCache = new Map<string, THREE.CanvasTexture>()
  private innerCache = new Map<string, THREE.CanvasTexture>()
  private lineCache = new Map<string, THREE.CanvasTexture>()

  getOuter(charId: string, cancel: boolean): THREE.CanvasTexture {
    const key = cancel ? '__cancel__' : charId || 'default'
    let tex = this.outerCache.get(key)
    if (!tex) {
      tex = bakeMagicCircleTexture(charId || 'default', cancel, true)
      this.outerCache.set(key, tex)
    }
    return tex
  }

  getInner(charId: string, cancel: boolean): THREE.CanvasTexture {
    const key = cancel ? '__cancel__' : charId || 'default'
    let tex = this.innerCache.get(key)
    if (!tex) {
      tex = bakeMagicCircleTexture(charId || 'default', cancel, false)
      this.innerCache.set(key, tex)
    }
    return tex
  }

  getCorridor(charId: string, cancel: boolean): THREE.CanvasTexture {
    const key = cancel ? '__cancel__' : charId || 'default'
    let tex = this.lineCache.get(key)
    if (!tex) {
      tex = bakeArcaneCorridorTexture(charId || 'default', cancel)
      this.lineCache.set(key, tex)
    }
    return tex
  }

  dispose(): void {
    for (const t of this.outerCache.values()) t.dispose()
    for (const t of this.innerCache.values()) t.dispose()
    for (const t of this.lineCache.values()) t.dispose()
    this.outerCache.clear()
    this.innerCache.clear()
    this.lineCache.clear()
  }
}
