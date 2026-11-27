import * as THREE from 'three'

/**
 * Procedural High-Res Canvas2D VFX Texture Atlas for ArenaVV (v3).
 * Generates 11 crisp, anime-MOBA-grade textures once on startup (zero external network fetches,
 * zero GC churn, full disposal on cleanup) so 3D VFX use authentic brush slashes, ground craters,
 * hexagonal magic circles, cel-shaded smoke clouds, jagged lightning ribbons, Dharma lotus wheels,
 * playing cards, Minecraft TNT/Diamond blocks, sniper crosshairs, and shattered time clockwork
 * instead of flat untextured primitive boxes/cones.
 */

export class VfxTextureAtlas {
  readonly brushSlash: THREE.CanvasTexture
  readonly groundCrater: THREE.CanvasTexture
  readonly magicSigil: THREE.CanvasTexture
  readonly smokePuff: THREE.CanvasTexture
  readonly lightningBolt: THREE.CanvasTexture
  readonly dharmaLotus: THREE.CanvasTexture
  readonly playingCard: THREE.CanvasTexture
  readonly voxelTnt: THREE.CanvasTexture
  readonly voxelDiamond: THREE.CanvasTexture
  readonly sniperCrosshair: THREE.CanvasTexture
  readonly clockworkCrack: THREE.CanvasTexture

  private all: THREE.CanvasTexture[] = []

  constructor() {
    this.brushSlash = this.register(this.buildBrushSlash())
    this.groundCrater = this.register(this.buildGroundCrater())
    this.magicSigil = this.register(this.buildMagicSigil())
    this.smokePuff = this.register(this.buildSmokePuff())
    this.lightningBolt = this.register(this.buildLightningBolt())
    this.dharmaLotus = this.register(this.buildDharmaLotus())
    this.playingCard = this.register(this.buildPlayingCard())
    this.voxelTnt = this.register(this.buildVoxelTnt())
    this.voxelDiamond = this.register(this.buildVoxelDiamond())
    this.sniperCrosshair = this.register(this.buildSniperCrosshair())
    this.clockworkCrack = this.register(this.buildClockworkCrack())
  }

  private register(tex: THREE.CanvasTexture): THREE.CanvasTexture {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    this.all.push(tex)
    return tex
  }

  private mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    return [c, ctx]
  }

  // 1. Tapered Anime Brush-Stroke Slash Crescent (white-to-gray so material.color tints cleanly)
  private buildBrushSlash(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(256, 256)
    const cx = 128
    const cy = 128

    // Outer dark ink rim for crisp anime silhouette contrast (rotated +PI/2 so arc faces +Z forward!)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.arc(0, 0, 114, -Math.PI * 0.72, Math.PI * 0.72)
    ctx.arc(-22, 0, 88, Math.PI * 0.64, -Math.PI * 0.64, true)
    ctx.closePath()
    const bodyGrad = ctx.createRadialGradient(-10, 0, 56, 0, 0, 116)
    bodyGrad.addColorStop(0.0, 'rgba(255,255,255,0.0)')
    bodyGrad.addColorStop(0.45, 'rgba(180,195,215,0.55)')
    bodyGrad.addColorStop(0.76, 'rgba(255,255,255,0.96)')
    bodyGrad.addColorStop(0.92, 'rgba(255,255,255,1.0)')
    bodyGrad.addColorStop(1.0, 'rgba(30,35,45,0.0)')
    ctx.fillStyle = bodyGrad
    ctx.fill()

    // Dry-brush speed streaks inside the crescent
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    for (let i = 0; i < 6; i++) {
      const r = 82 + i * 5.2
      ctx.lineWidth = 2.2 - i * 0.2
      ctx.beginPath()
      ctx.arc(-6, 0, r, -Math.PI * (0.58 - i * 0.04), Math.PI * (0.58 - i * 0.04))
      ctx.stroke()
    }
    ctx.restore()

    const tex = new THREE.CanvasTexture(c)
    tex.anisotropy = 4
    return tex
  }

  // 2. Radial Fractured Ground Crater & Impact Dust Decal
  private buildGroundCrater(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(256, 256)
    const cx = 128
    const cy = 128

    // Soft dark impact scorch center
    const pit = ctx.createRadialGradient(cx, cy, 8, cx, cy, 112)
    pit.addColorStop(0.0, 'rgba(12,14,18,0.88)')
    pit.addColorStop(0.38, 'rgba(28,32,40,0.68)')
    pit.addColorStop(0.75, 'rgba(55,62,74,0.28)')
    pit.addColorStop(1.0, 'rgba(0,0,0,0.0)')
    ctx.fillStyle = pit
    ctx.beginPath()
    ctx.arc(cx, cy, 114, 0, Math.PI * 2)
    ctx.fill()

    // Crisp jagged radial fracture lines
    const spokeCount = 13
    for (let i = 0; i < spokeCount; i++) {
      const baseA = (i / spokeCount) * Math.PI * 2 + (i % 2) * 0.12
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(baseA) * 14, cy + Math.sin(baseA) * 14)
      let r = 14
      let a = baseA
      for (let s = 0; s < 5; s++) {
        r += 16 + ((i * 7 + s * 13) % 12)
        a += (((i + s) % 2 === 0 ? 1 : -1) * 0.09)
        ctx.lineTo(cx + Math.cos(a) * Math.min(120, r), cy + Math.sin(a) * Math.min(120, r))
      }
      ctx.strokeStyle = 'rgba(10,12,16,0.92)'
      ctx.lineWidth = 3.4
      ctx.stroke()

      // Highlight bevel edge beside each crack
      ctx.strokeStyle = 'rgba(226,232,240,0.42)'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    // Inner broken ring
    ctx.strokeStyle = 'rgba(15,20,28,0.75)'
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.arc(cx, cy, 52, 0, Math.PI * 2)
    ctx.stroke()

    return new THREE.CanvasTexture(c)
  }

  // 3. Intricate 6-Point Arcane Magic Circle (Frieren / Gilgamesh / Cid / Aizen / Diablo)
  private buildMagicSigil(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(256, 256)
    const cx = 128
    const cy = 128

    ctx.strokeStyle = '#ffffff'
    // Outer double rings
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(cx, cy, 116, 0, Math.PI * 2)
    ctx.stroke()

    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, 102, 0, Math.PI * 2)
    ctx.stroke()

    // 24 Rune tick marks around outer band
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      ctx.lineWidth = i % 2 === 0 ? 2.6 : 1.4
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 102, cy + Math.sin(a) * 102)
      ctx.lineTo(cx + Math.cos(a) * 116, cy + Math.sin(a) * 116)
      ctx.stroke()
    }

    // Two overlapping equilateral triangles (hexagram)
    for (const offset of [0, Math.PI / 3]) {
      ctx.lineWidth = 2.6
      ctx.beginPath()
      for (let i = 0; i <= 3; i++) {
        const a = offset + (i / 3) * Math.PI * 2
        const px = cx + Math.cos(a) * 98
        const py = cy + Math.sin(a) * 98
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    // Inner ring + 6 vertex circles
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.arc(cx, cy, 52, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * 98, cy + Math.sin(a) * 98, 7, 0, Math.PI * 2)
      ctx.stroke()
    }

    return new THREE.CanvasTexture(c)
  }

  // 4. Layered Cel-Shaded Anime Smoke / Cloud Puff
  private buildSmokePuff(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(128, 128)
    const blobs: Array<[number, number, number]> = [
      [64, 64, 42],
      [44, 68, 28],
      [84, 66, 28],
      [56, 46, 26],
      [74, 48, 24],
    ]
    for (const [bx, by, br] of blobs) {
      const g = ctx.createRadialGradient(bx - br * 0.2, by - br * 0.2, br * 0.1, bx, by, br)
      g.addColorStop(0.0, 'rgba(255,255,255,0.94)')
      g.addColorStop(0.65, 'rgba(218,226,238,0.78)')
      g.addColorStop(1.0, 'rgba(180,192,210,0.0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(bx, by, br, 0, Math.PI * 2)
      ctx.fill()
    }
    return new THREE.CanvasTexture(c)
  }

  // 5. Crisp Jagged Branching Lightning Filament Strip
  private buildLightningBolt(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(128, 256)
    const pts: Array<[number, number]> = [
      [64, 4],
      [52, 36],
      [78, 74],
      [44, 114],
      [82, 152],
      [50, 196],
      [70, 228],
      [64, 252],
    ]

    // Soft electric halo
    ctx.strokeStyle = 'rgba(200,235,255,0.48)'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.lineJoin = 'miter'
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.stroke()

    // Crisp hot core
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 5
    ctx.stroke()

    // Side fork branches
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.moveTo(78, 74)
    ctx.lineTo(106, 102)
    ctx.lineTo(114, 128)
    ctx.moveTo(44, 114)
    ctx.lineTo(18, 146)
    ctx.lineTo(14, 174)
    ctx.moveTo(82, 152)
    ctx.lineTo(108, 184)
    ctx.stroke()

    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.RepeatWrapping
    return tex
  }

  // 6. Ornate 8-Spoke Golden Dharma Wheel + Lotus Petals (Buddha / Nezha / Po)
  private buildDharmaLotus(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(256, 256)
    const cx = 128
    const cy = 128

    // 12 Lotus petals around outer edge
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.4
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(a)
      ctx.beginPath()
      ctx.moveTo(0, -68)
      ctx.quadraticCurveTo(22, -92, 0, -118)
      ctx.quadraticCurveTo(-22, -92, 0, -68)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    // Wheel rim & hub
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(cx, cy, 74, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(cx, cy, 20, 0, Math.PI * 2)
    ctx.stroke()

    // 8 Dharma spokes with finials
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.lineWidth = 4.5
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20)
      ctx.lineTo(cx + Math.cos(a) * 86, cy + Math.sin(a) * 86)
      ctx.stroke()
    }

    return new THREE.CanvasTexture(c)
  }

  // 7. Authentic Playing Card Face (Gambit)
  private buildPlayingCard(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(128, 192)
    // Kinetic magenta outer frame
    ctx.fillStyle = '#db2777'
    ctx.fillRect(0, 0, 128, 192)
    // Crisp white card face
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(10, 10, 108, 172)
    // Inner dark hairline border
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 3
    ctx.strokeRect(16, 16, 96, 160)

    // Center diamond emblem
    ctx.fillStyle = '#be123c'
    ctx.beginPath()
    ctx.moveTo(64, 52)
    ctx.lineTo(94, 96)
    ctx.lineTo(64, 140)
    ctx.lineTo(34, 96)
    ctx.closePath()
    ctx.fill()

    // Corner pips ("A")
    ctx.fillStyle = '#be123c'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('A', 22, 42)
    ctx.fillText('A', 88, 168)

    return new THREE.CanvasTexture(c)
  }

  // 8. Pixel-Art Minecraft TNT Block (Steve)
  private buildVoxelTnt(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(128, 128)
    ctx.fillStyle = '#b91c1c'
    ctx.fillRect(0, 0, 128, 128)
    // Vertical dynamite stick stripes
    for (let x = 0; x < 128; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? '#dc2626' : '#991b1b'
      ctx.fillRect(x, 0, 16, 128)
    }
    // Classic white center TNT label band
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 38, 128, 52)
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 34px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('TNT', 64, 65)

    const tex = new THREE.CanvasTexture(c)
    tex.magFilter = THREE.NearestFilter
    return tex
  }

  // 9. Pixel-Art Minecraft Diamond Block (Steve)
  private buildVoxelDiamond(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(128, 128)
    const palette = ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc']
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const edge = x === 0 || y === 0 || x === 7 || y === 7
        const idx = edge ? 0 : ((x * 3 + y * 5) % 4) + 1
        ctx.fillStyle = palette[idx]
        ctx.fillRect(x * 16, y * 16, 16, 16)
      }
    }
    ctx.strokeStyle = '#164e63'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, 124, 124)

    const tex = new THREE.CanvasTexture(c)
    tex.magFilter = THREE.NearestFilter
    return tex
  }

  // 10. Precision Military Sniper Reticle (Simo Häyhä)
  private buildSniperCrosshair(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(256, 256)
    const cx = 128
    const cy = 128

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, 108, 0, Math.PI * 2)
    ctx.stroke()

    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, 56, 0, Math.PI * 2)
    ctx.stroke()

    // Crosshair axes with open center gap
    ctx.beginPath()
    ctx.moveTo(8, cy)
    ctx.lineTo(cx - 14, cy)
    ctx.moveTo(cx + 14, cy)
    ctx.lineTo(248, cy)
    ctx.moveTo(cx, 8)
    ctx.lineTo(cx, cy - 14)
    ctx.moveTo(cx, cy + 14)
    ctx.lineTo(cx, 248)
    ctx.stroke()

    // Mil-dot ticks
    for (const d of [28, 44, 72, 88]) {
      ctx.beginPath()
      ctx.moveTo(cx + d, cy - 6)
      ctx.lineTo(cx + d, cy + 6)
      ctx.moveTo(cx - d, cy - 6)
      ctx.lineTo(cx - d, cy + 6)
      ctx.moveTo(cx - 6, cy + d)
      ctx.lineTo(cx + 6, cy + d)
      ctx.moveTo(cx - 6, cy - d)
      ctx.lineTo(cx + 6, cy - d)
      ctx.stroke()
    }

    // Center lock dot
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fill()

    return new THREE.CanvasTexture(c)
  }

  // 11. Shattered Time Glass & Clockwork Gear (Diavolo / Joestar The World / Doraemon)
  private buildClockworkCrack(): THREE.CanvasTexture {
    const [c, ctx] = this.mkCanvas(256, 256)
    const cx = 128
    const cy = 128

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3.2
    ctx.beginPath()
    ctx.arc(cx, cy, 110, 0, Math.PI * 2)
    ctx.stroke()

    // 12 Clock dial markers
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.lineWidth = i % 3 === 0 ? 4.5 : 2.2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 90, cy + Math.sin(a) * 90)
      ctx.lineTo(cx + Math.cos(a) * 110, cy + Math.sin(a) * 110)
      ctx.stroke()
    }

    // Clock hands frozen at dramatic angle
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + 46, cy - 48)
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx - 24, cy - 72)
    ctx.stroke()

    // Shattered glass fracture lines radiating across face
    ctx.strokeStyle = 'rgba(255,255,255,0.72)'
    ctx.lineWidth = 1.8
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.25
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a + 0.14) * 58, cy + Math.sin(a + 0.14) * 58)
      ctx.lineTo(cx + Math.cos(a) * 116, cy + Math.sin(a) * 116)
      ctx.stroke()
    }

    return new THREE.CanvasTexture(c)
  }

  dispose(): void {
    for (const tex of this.all) {
      tex.dispose()
    }
    this.all.length = 0
  }
}
