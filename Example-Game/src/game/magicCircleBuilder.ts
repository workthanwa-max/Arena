import * as THREE from 'three'
import { getHeroAimTheme } from './heroAimThemes'
import { ROSTER28_SPECS } from './roster28Meta'

interface SigilPalette {
  primary: string
  secondary: string
  glow: string
  glyphs: string[]
}

const HERO_SIGIL_GLYPHS: Record<string, string[]> = {
  noone: ['✦', '◈', '❖', '✧', '⟐', '✶', '⊹', '⟡'],
  ko: ['⚡', '✦', '✧', '◈', '✶', '⊹', '⚡', '✦'],
  sia_mon: ['∞', '✦', '◈', '✧', '∞', '✶', '⊹', '❖'],
  ajarn_boy: ['✕', '◈', '✦', '❖', '✕', '✧', '✶', '⊹'],
  thanwa: ['⚔', '✦', '❖', '◈', '⚔', '✶', '⊹', '✧'],
  pa: ['✶', '✦', '◈', '❖', '✧', '⊹', '✶', '✦'],
  kaem: ['❖', '✦', '✧', '◈', '✶', '⟡', '⊹', '✦'],
  frame: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'],
  ole: ['◈', '✦', '✧', '❖', '◈', '✶', '⊹', '✦'],
  ajarn_au: ['⚡', '✧', '✦', '◈', '⚡', '✶', '⊹', '✧'],
  boy: ['★', '✦', '◈', '✧', '★', '✶', '⊹', '✦'],
  luangphi_sorn: ['👊', '✦', '✶', '❖', '◈', '✧', '✦', '✶'],
  simo: ['⊕', '❄', '✦', '◈', '⊕', '❄', '✧', '⊹'],
  jinwoo: ['♛', '✦', '◈', '✧', '♛', '✶', '⊹', '❖'],
  naruto: ['🌀', '★', '✦', '◈', '🦊', '✶', '✧', '⊹'],
  sanji: ['🔥', '⚡', '✦', '◈', '🔥', '✶', '✧', '⊹'],
  luffy: ['★', '☠', '✦', '◈', '★', '✶', '✧', '⊹'],
  ben10: ['⧖', '✦', '◈', '✧', '⧖', '✶', '⊹', '❖'],
  diablo: ['❖', '✕', '✦', '◈', '❖', '✶', '✧', '⊹'],
  aizen: ['❖', '⟐', '◈', '✦', '❖', '✧', '⊹', '⟐'],
  toriko: ['⚔', '✕', '★', '✦', '⚔', '✶', '✧', '◈'],
  frieren: ['✶', '✦', '✧', '◈', '✶', '⊹', '❖', '✧'],
  ...Object.fromEntries(ROSTER28_SPECS.map((s) => [s.id, [s.corridorGlyph, '✦', '◈', '✧', s.corridorGlyph, '✶', '⊹', '❖']])),
  default: ['✦', '◈', '✧', '❖', '✶', '⊹', '✦', '◈'],
}

const CANCEL_SIGIL: SigilPalette = {
  primary: '#EF4444',
  secondary: '#FCA5A5',
  glow: 'rgba(239, 68, 68, 0.48)',
  glyphs: ['✕', '✕', '✕', '✕', '✕', '✕', '✕', '✕'],
}

function getSigilPalette(charId: string, cancel: boolean): SigilPalette {
  if (cancel) return CANCEL_SIGIL
  const theme = getHeroAimTheme(charId)
  return {
    primary: theme.primary,
    secondary: theme.secondary,
    glow: theme.glow,
    glyphs: HERO_SIGIL_GLYPHS[theme.id] ?? HERO_SIGIL_GLYPHS.default,
  }
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
  const pal = getSigilPalette(charId, cancel)
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

  // Outer Range Ring with character-distinct rim style
  g.strokeStyle = pal.primary
  g.lineWidth = isOuterRange ? 5.5 : 7
  if (isOuterRange && (charId === 'simo' || charId === 'ajarn_au')) {
    g.setLineDash([28, 14])
  } else if (isOuterRange && charId === 'pa') {
    g.setLineDash([42, 10, 10, 10])
  }
  g.beginPath()
  g.arc(cx, cy, R * 0.96, 0, Math.PI * 2)
  g.stroke()
  g.setLineDash([])

  g.strokeStyle = pal.secondary
  g.lineWidth = 2.6
  g.beginPath()
  g.arc(cx, cy, R * 0.85, 0, Math.PI * 2)
  g.stroke()

  // Calibration Tick Marks along Outer Ring
  const tickCount = charId === 'frame' ? 24 : charId === 'luangphi_sorn' ? 16 : 36
  for (let i = 0; i < tickCount; i++) {
    const a = (i * Math.PI * 2) / tickCount
    const major = i % 3 === 0
    const rIn = R * (major ? 0.83 : 0.9)
    const rOut = R * 0.96
    g.strokeStyle = major ? pal.secondary : pal.primary
    g.lineWidth = major ? 3.4 : 1.6
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

  // Character-Specific Sacred Geometric Centerpiece (ALL 14 Heroes!)
  if (!isOuterRange) {
    g.lineWidth = 3.6
    g.strokeStyle = pal.primary
    g.beginPath()
    g.arc(cx, cy, R * 0.56, 0, Math.PI * 2)
    g.stroke()

    if (charId === 'noone' && !cancel) {
      // Thanos Sanctuary Hexagram + 5 Colored Infinity Stone Nodes
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
      // Zenitsu 5-Point Thunder Pentagram
      g.strokeStyle = '#FACC15'
      g.lineWidth = 5
      drawStarPolygon(g, cx, cy, R * 0.82, 5, 2, -Math.PI / 2)
      g.strokeStyle = '#7DD3FC'
      g.lineWidth = 2.6
      drawPolygon(g, cx, cy, R * 0.5, 5, -Math.PI / 2)
    } else if (charId === 'sia_mon' && !cancel) {
      // Gojo Limitless Infinity Lemniscate + Red/Blue Orbs
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
      g.fillStyle = '#EF4444'
      g.beginPath()
      g.arc(cx - R * 0.64, cy, 13, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#38BDF8'
      g.beginPath()
      g.arc(cx + R * 0.64, cy, 13, 0, Math.PI * 2)
      g.fill()
    } else if (charId === 'ajarn_boy' && !cancel) {
      // Sukuna Cursed Crimson Diamond Seal + Razor X-Cross
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
    } else if (charId === 'simo' && !cancel) {
      // Simo Hayha: Arctic Mil-Dot Sniper Scope Crosshair + Range Stadia
      g.strokeStyle = '#38BDF8'
      g.lineWidth = 4
      drawPolygon(g, cx, cy, R * 0.78, 8, Math.PI / 8)
      g.strokeStyle = '#EF4444'
      g.lineWidth = 3.5
      g.beginPath()
      g.moveTo(cx - R * 0.85, cy)
      g.lineTo(cx + R * 0.85, cy)
      g.moveTo(cx, cy - R * 0.85)
      g.lineTo(cx, cy + R * 0.85)
      g.stroke()
      for (const tick of [-0.55, -0.32, 0.32, 0.55]) {
        g.beginPath()
        g.moveTo(cx + R * tick, cy - 12)
        g.lineTo(cx + R * tick, cy + 12)
        g.moveTo(cx - 12, cy + R * tick)
        g.lineTo(cx + 12, cy + R * tick)
        g.stroke()
      }
    } else if (charId === 'thanwa' && !cancel) {
      // Zoro Enma Santoryu Triple-Sword Crossed Seal
      g.strokeStyle = '#10B981'
      g.lineWidth = 4.5
      drawPolygon(g, cx, cy, R * 0.83, 3, -Math.PI / 2)
      g.strokeStyle = '#C084FC'
      g.lineWidth = 4.5
      drawPolygon(g, cx, cy, R * 0.83, 3, Math.PI / 2)
      for (let b = 0; b < 3; b++) {
        const ba = (b * Math.PI) / 3
        g.strokeStyle = b === 1 ? '#C084FC' : '#FFFFFF'
        g.lineWidth = 3
        g.beginPath()
        g.moveTo(cx - Math.cos(ba) * R * 0.76, cy - Math.sin(ba) * R * 0.76)
        g.lineTo(cx + Math.cos(ba) * R * 0.76, cy + Math.sin(ba) * R * 0.76)
        g.stroke()
      }
    } else if (charId === 'pa' && !cancel) {
      // Gilgamesh Gate of Babylon: 8 Surrounding Gold Portals + Crimson Ea Keyhole
      g.strokeStyle = '#FACC15'
      g.lineWidth = 4.2
      drawPolygon(g, cx, cy, R * 0.83, 4, 0)
      drawPolygon(g, cx, cy, R * 0.83, 4, Math.PI / 4)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        g.strokeStyle = '#FEF08A'
        g.lineWidth = 2.6
        g.beginPath()
        g.arc(cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66, 15, 0, Math.PI * 2)
        g.stroke()
      }
      g.strokeStyle = '#EF4444'
      g.lineWidth = 4
      drawPolygon(g, cx, cy, R * 0.34, 4, Math.PI / 4)
    } else if (charId === 'kaem' && !cancel) {
      // Rimuru Demon-Lord Tempest Spiral + Golden Raphael Core
      g.strokeStyle = '#38BDF8'
      g.lineWidth = 4.4
      for (let s = 0; s < 3; s++) {
        const a = (s * Math.PI * 2) / 3
        g.beginPath()
        g.arc(cx + Math.cos(a) * R * 0.22, cy + Math.sin(a) * R * 0.22, R * 0.44, a, a + Math.PI * 1.15)
        g.stroke()
      }
      g.strokeStyle = '#FACC15'
      g.lineWidth = 3.8
      drawPolygon(g, cx, cy, R * 0.38, 4, 0)
      drawPolygon(g, cx, cy, R * 0.38, 4, Math.PI / 4)
    } else if (charId === 'boy' && !cancel) {
      // Goku Super Saiyan Solar Ki Burst + 4-Star Dragon Ball Crest
      g.strokeStyle = '#FACC15'
      g.lineWidth = 4.2
      for (let s = 0; s < 12; s++) {
        const a = (s * Math.PI * 2) / 12
        g.beginPath()
        g.moveTo(cx + Math.cos(a) * R * 0.46, cy + Math.sin(a) * R * 0.46)
        g.lineTo(cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84)
        g.stroke()
      }
      g.strokeStyle = '#F97316'
      g.lineWidth = 5
      g.beginPath()
      g.arc(cx, cy, R * 0.44, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = '#EF4444'
      for (const [ox, oy] of [[-26, -24], [26, -24], [-26, 24], [26, 24]] as const) {
        drawStarPolygon(g, cx + ox, cy + oy, 11, 5, 2, -Math.PI / 2)
      }
    } else if (charId === 'ajarn_au' && !cancel) {
      // Killua Godspeed Zoldyck High-Volt Star Circuit
      g.strokeStyle = '#22D3EE'
      g.lineWidth = 4.6
      drawStarPolygon(g, cx, cy, R * 0.84, 6, 2, 0)
      g.strokeStyle = '#FEF08A'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(cx + 12, cy - R * 0.62)
      g.lineTo(cx - 26, cy - 4)
      g.lineTo(cx + 8, cy - 4)
      g.lineTo(cx - 12, cy + R * 0.62)
      g.stroke()
    } else if (charId === 'luangphi_sorn' && !cancel) {
      // Saitama Serious Punch Shockwave Sunburst + Hero Glove Impact Core
      g.strokeStyle = '#FACC15'
      g.lineWidth = 4
      for (let r = 0; r < 16; r++) {
        const a = (r * Math.PI * 2) / 16
        g.beginPath()
        g.moveTo(cx + Math.cos(a) * R * 0.34, cy + Math.sin(a) * R * 0.34)
        g.lineTo(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82)
        g.stroke()
      }
      g.fillStyle = '#DC2626'
      g.beginPath()
      g.arc(cx, cy, R * 0.28, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#FFFFFF'
      g.lineWidth = 4
      g.stroke()
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
    } else if (charId === 'aizen' && !cancel) {
      // Aizen Hogyoku Rhombus & Mirror Hypnosis Shatter Rings
      g.strokeStyle = '#C084FC'
      g.lineWidth = 4.5
      drawPolygon(g, cx, cy, R * 0.72, 4, Math.PI / 4)
      g.strokeStyle = '#E9D5FF'
      g.lineWidth = 3
      drawPolygon(g, cx, cy, R * 0.48, 4, 0)
    } else if (charId === 'toriko' && !cancel) {
      // Toriko Crossed Gourmet Fork & Knife Emblem
      g.strokeStyle = '#F97316'
      g.lineWidth = 5
      drawPolygon(g, cx, cy, R * 0.76, 5, -Math.PI / 2)
      g.strokeStyle = '#FEF08A'
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(cx - R * 0.48, cy - R * 0.48)
      g.lineTo(cx + R * 0.48, cy + R * 0.48)
      g.moveTo(cx + R * 0.48, cy - R * 0.48)
      g.lineTo(cx - R * 0.48, cy + R * 0.48)
      g.stroke()
    } else if (charId === 'frieren' && !cancel) {
      // Frieren Ancient Double Hexagram Magic Circle
      g.strokeStyle = '#38BDF8'
      g.lineWidth = 3.8
      drawPolygon(g, cx, cy, R * 0.84, 6, 0)
      drawPolygon(g, cx, cy, R * 0.62, 3, -Math.PI / 2)
      g.strokeStyle = '#BAE6FD'
      drawPolygon(g, cx, cy, R * 0.62, 3, Math.PI / 2)
    } else {
      // Clean Aero Hexagram + Center Star
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
  } else if (!cancel) {
    // Distinct Outer Cast-Range Geometric Frame per Character!
    g.strokeStyle = pal.primary
    g.globalAlpha = 0.62
    g.lineWidth = 2.6
    if (charId === 'simo') {
      // Sniper Compass Brackets at N/S/E/W
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        g.beginPath()
        g.moveTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78)
        g.lineTo(cx + Math.cos(a) * R * 0.96, cy + Math.sin(a) * R * 0.96)
        g.stroke()
      }
    } else if (charId === 'ajarn_boy' || charId === 'thanwa') {
      drawPolygon(g, cx, cy, R * 0.86, charId === 'ajarn_boy' ? 4 : 3, Math.PI / 4)
    } else if (charId === 'ko' || charId === 'ajarn_au') {
      drawStarPolygon(g, cx, cy, R * 0.85, 5, 2, -Math.PI / 2)
    } else if (charId === 'noone' || charId === 'boy') {
      drawPolygon(g, cx, cy, R * 0.85, 6, 0)
    } else {
      drawPolygon(g, cx, cy, R * 0.85, 8, Math.PI / 8)
    }
    g.globalAlpha = 1
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function bakeArcaneCorridorTexture(charId: string, cancel: boolean): THREE.CanvasTexture {
  const pal = getSigilPalette(charId, cancel)
  const style = cancel ? 'pulse' : getHeroAimTheme(charId).corridorStyle
  const w = 256
  const h = 512
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!

  // Soft corridor luminescence backing
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

  // Side Boundary Rails (styled by character!)
  g.strokeStyle = pal.primary
  g.lineWidth = style === 'sniper' ? 3.5 : 6
  if (style === 'crows' || style === 'predator') {
    g.setLineDash([22, 12])
  }
  g.beginPath()
  g.moveTo(22, 16)
  g.lineTo(22, h - 24)
  g.moveTo(w - 22, 16)
  g.lineTo(w - 22, h - 24)
  g.stroke()
  g.setLineDash([])

  if (style === 'sniper') {
    // Simo: Precision Laser Sight Spine + Stadia Elevation Ticks
    g.strokeStyle = '#EF4444'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(w * 0.5, 16)
    g.lineTo(w * 0.5, h - 10)
    g.stroke()
    g.strokeStyle = '#E0F2FE'
    g.lineWidth = 3
    for (let y = 52; y < h - 30; y += 56) {
      g.beginPath()
      g.moveTo(w * 0.34, y)
      g.lineTo(w * 0.66, y)
      g.stroke()
    }
  } else if (style === 'infinity') {
    // Gojo: Twin Red & Blue Sine Polarity Waves Converging to White/Violet Core
    for (const [phase, col] of [
      [0, '#EF4444'],
      [Math.PI, '#38BDF8'],
    ] as const) {
      g.strokeStyle = col
      g.lineWidth = 5
      g.beginPath()
      for (let y = 20; y <= h - 20; y += 12) {
        const x = w * 0.5 + Math.sin(y * 0.036 + phase) * 52
        if (y === 20) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
    g.strokeStyle = '#FFFFFF'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(w * 0.5, 20)
    g.lineTo(w * 0.5, h - 10)
    g.stroke()
  } else if (style === 'cleave') {
    // Sukuna: Jagged Crimson/White X-Slash Scars Down the Lane
    for (let y = 64; y < h - 40; y += 84) {
      g.strokeStyle = '#EF4444'
      g.lineWidth = 6
      g.beginPath()
      g.moveTo(w * 0.24, y - 28)
      g.lineTo(w * 0.76, y + 28)
      g.moveTo(w * 0.76, y - 28)
      g.lineTo(w * 0.24, y + 28)
      g.stroke()
      g.strokeStyle = '#FFFFFF'
      g.lineWidth = 2.5
      g.stroke()
    }
  } else if (style === 'lightning' || style === 'godspeed') {
    // Zenitsu / Killua: High-Voltage Jagged Thunderbolt Spine
    g.strokeStyle = style === 'lightning' ? '#FACC15' : '#22D3EE'
    g.lineWidth = 6
    g.beginPath()
    for (let i = 0; i <= 10; i++) {
      const y = 18 + (i * (h - 32)) / 10
      const x = w * 0.5 + (i === 0 || i === 10 ? 0 : (i % 2 === 0 ? 1 : -1) * 44)
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
    g.strokeStyle = '#FFFFFF'
    g.lineWidth = 2.5
    g.stroke()
  } else if (style === 'santoryu') {
    // Zoro: Three Parallel Santoryu Katana Slash Blades
    for (const [ox, col] of [
      [-48, '#10B981'],
      [0, '#FFFFFF'],
      [48, '#C084FC'],
    ] as const) {
      g.strokeStyle = col
      g.lineWidth = ox === 0 ? 6 : 4.5
      g.beginPath()
      g.moveTo(w * 0.5 + ox, 24)
      g.lineTo(w * 0.5 + ox * 0.75, h - 18)
      g.stroke()
    }
  } else if (style === 'stones') {
    // Thanos: 5 Colored Infinity Stone Rays Converging Together
    const cols = ['#A855F7', '#3B82F6', '#EF4444', '#10B981', '#FACC15']
    cols.forEach((col, i) => {
      g.strokeStyle = col
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(w * (0.22 + i * 0.14), 24)
      g.lineTo(w * 0.5 + (i - 2) * 14, h - 16)
      g.stroke()
    })
  } else if (style === 'babylon') {
    // Gilgamesh: Golden Gate Key-Portals Flanking the Trajectory
    for (let y = 76; y < h - 48; y += 96) {
      for (const px of [w * 0.25, w * 0.75]) {
        g.strokeStyle = '#FACC15'
        g.lineWidth = 4
        g.beginPath()
        g.arc(px, y, 22, 0, Math.PI * 2)
        g.stroke()
      }
      g.strokeStyle = '#EF4444'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(w * 0.5, y - 28)
      g.lineTo(w * 0.5, y + 28)
      g.stroke()
    }
  } else if (style === 'kamehameha') {
    // Goku: Expanding Kamehameha Ki Blast Compression Rings
    for (let i = 0; i < 5; i++) {
      const y = 72 + i * 86
      const rad = 22 + i * 9
      g.strokeStyle = i === 4 ? '#FFFFFF' : i % 2 === 0 ? '#F97316' : '#FACC15'
      g.lineWidth = 4.5
      g.beginPath()
      g.ellipse(w * 0.5, y, rad, 14, 0, 0, Math.PI * 2)
      g.stroke()
    }
  } else if (style === 'crows') {
    // Itachi: Black Crow Silhouette V-Wings & Crimson Genjutsu Spine
    for (let y = 78; y < h - 40; y += 84) {
      g.strokeStyle = '#EF4444'
      g.lineWidth = 5
      g.beginPath()
      g.arc(w * 0.5, y, 16, Math.PI * 1.1, Math.PI * 1.9)
      g.stroke()
      g.beginPath()
      g.moveTo(w * 0.24, y + 10)
      g.quadraticCurveTo(w * 0.37, y - 18, w * 0.5, y + 4)
      g.quadraticCurveTo(w * 0.63, y - 18, w * 0.76, y + 10)
      g.stroke()
    }
  } else if (style === 'clockwork') {
    // Frame: Golden Mechanical Roman Clockwork Track
    g.strokeStyle = '#FACC15'
    g.lineWidth = 3.5
    g.beginPath()
    g.moveTo(w * 0.5, 24)
    g.lineTo(w * 0.5, h - 18)
    g.stroke()
    for (let y = 56; y < h - 32; y += 64) {
      g.strokeStyle = '#A855F7'
      g.lineWidth = 4
      g.beginPath()
      g.arc(w * 0.5, y, 24, 0, Math.PI * 2)
      g.stroke()
    }
  } else if (style === 'punch' || style === 'gourmet') {
    // Saitama / Toriko: Serious Impact Warning Stripes + Gourmet Cones
    for (let y = 70; y < h - 30; y += 76) {
      g.strokeStyle = style === 'gourmet' ? '#F97316' : '#FACC15'
      g.lineWidth = 7
      g.beginPath()
      g.moveTo(w * 0.22, y - 20)
      g.lineTo(w * 0.5, y + 16)
      g.lineTo(w * 0.78, y - 20)
      g.stroke()
    }
  } else if (style === 'hypnosis') {
    // Aizen: Shattering Purple Mirror Diamond Lane
    for (let y = 66; y < h - 30; y += 72) {
      g.strokeStyle = '#C084FC'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(w * 0.5, y - 20)
      g.lineTo(w * 0.72, y)
      g.lineTo(w * 0.5, y + 20)
      g.lineTo(w * 0.28, y)
      g.closePath()
      g.stroke()
    }
  } else if (style === 'ancient') {
    // Frieren: Crisp Azure Zoltraak Runic Vector Track
    g.strokeStyle = '#BAE6FD'
    g.lineWidth = 3.5
    g.beginPath()
    g.moveTo(w * 0.5, 22)
    g.lineTo(w * 0.5, h - 22)
    g.stroke()
    for (let y = 62; y < h - 30; y += 68) {
      g.strokeStyle = '#38BDF8'
      g.lineWidth = 3.5
      drawPolygon(g, w * 0.5, y, 22, 6, 0)
    }
  } else {
    // Rimuru / Default: Flowing Chevrons + Center Spine
    g.strokeStyle = pal.secondary
    g.lineWidth = 2.5
    g.setLineDash([14, 12])
    g.beginPath()
    g.moveTo(w * 0.5, 24)
    g.lineTo(w * 0.5, h - 28)
    g.stroke()
    g.setLineDash([])
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
