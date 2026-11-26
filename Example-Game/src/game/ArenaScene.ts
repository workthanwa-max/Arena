import Phaser from 'phaser'
import { soundEngine } from '../audio/soundEngine'
import { ROSTER28_SPECS } from './roster28Meta'
import type {
  BeamEffect,
  MapConfig,
  PlayerState,
  Projectile,
  ZoneEffect,
} from '../types/game'
import { gameEventBus, type AimPreviewPayload } from './core/eventBus'

// 2.5D Oblique Foreshortening Ratio
const ISO_Y = 0.78

const MINIMAP_PORTRAIT_URLS: Record<string, string> = {
  default: '/app-icon.png?v=20261120v2',
  pa: '/characters/pa.png',
  boy: '/characters/boy.png',
  ole: '/characters/ole.png',
  thanwa: '/characters/thanwa.png',
  ajarn_au: '/characters/ajarn_au.png',
  ajarn_boy: '/characters/ajarn_boy.png',
  kaem: '/characters/kaem.png',
  frame: '/characters/frame.png',
  luangphi_sorn: '/characters/luangphi_sorn.png',
  sia_mon: '/characters/sia_mon.png',
  ko: '/characters/ko.png',
  noone: '/characters/noone.png?v=mcu1',
  simo: '/characters/simo.png',
  jinwoo: '/characters/jinwoo.png',
  naruto: '/characters/naruto.png',
  sanji: '/characters/sanji.png',
  luffy: '/characters/luffy.png',
  ben10: '/characters/ben10.png',
  diablo: '/characters/diablo.png',
  aizen: '/characters/aizen.png',
  toriko: '/characters/toriko.png',
  frieren: '/characters/frieren.png',
  ...Object.fromEntries(ROSTER28_SPECS.map((s) => [s.id, s.portrait])),
}

interface ActorView {
  state: PlayerState
  renderX: number
  renderY: number
  facingAngle: number
  bobPhase: number
  wasAlive: boolean
  lastNameLabel: string
  lastJumpLift: number
  lastHpWidth: number
  lastHpColor: number
  container: Phaser.GameObjects.Container
  bodyGfx: Phaser.GameObjects.Graphics
  hpBg: Phaser.GameObjects.Rectangle
  hpFill: Phaser.GameObjects.Rectangle
  nameText: Phaser.GameObjects.Text
}

interface ImpactParticle {
  sprite: Phaser.GameObjects.Image
  vx: number
  vy: number
  life: number
  maxLife: number
  startScale: number
  active: boolean
}

function hexToNum(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16) || 0x38bdf8
}

function clamp(v: number, minV: number, maxV: number): number {
  return Math.max(minV, Math.min(maxV, v))
}

export class ArenaScene extends Phaser.Scene {
  private mapCfg: MapConfig = {
    width: 3000,
    height: 1800,
    playerRadius: 18,
    moveSpeed: 255,
    pillars: [],
  }
  private myPlayerId = ''
  private actors = new Map<string, ActorView>()
  private projectiles: Projectile[] = []
  private beams: BeamEffect[] = []
  private zones: ZoneEffect[] = []
  private aimPreview: AimPreviewPayload = {
    active: false,
    slot: 1,
    dirX: 1,
    dirY: 0,
    rangeFactor: 1,
    castRange: 360,
    aoeRadius: 60,
    aimType: 'line',
    cancel: false,
  }

  private backdropImg?: Phaser.GameObjects.Image
  private floorTile!: Phaser.GameObjects.TileSprite
  private overlayGfx!: Phaser.GameObjects.Graphics
  private borderFogGfx!: Phaser.GameObjects.Graphics
  private mapPropImg?: Phaser.GameObjects.Image
  private pillarImages: Phaser.GameObjects.Image[] = []
  private zoneGfx!: Phaser.GameObjects.Graphics
  private projSpritePool: Phaser.GameObjects.Image[] = []
  private fxGfx!: Phaser.GameObjects.Graphics
  private aimGfx!: Phaser.GameObjects.Graphics
  private minimapGfx!: Phaser.GameObjects.Graphics
  private minimapRingGfx!: Phaser.GameObjects.Graphics
  private minimapPortraits = new Map<string, Phaser.GameObjects.Image>()
  private unsubs: Array<() => void> = []
  private camX = 0
  private camY = 0
  private fpsAccum = 0
  private fpsFrames = 0
  private seenEffects = new Set<string>()
  private seenPlayerIds = new Set<string>()
  private leapingProgress = new Map<string, number>()
  private impactPool: ImpactParticle[] = []
  private animTime = 0
  private minimapAccum = 0
  private minimapBgKey = ''
  private camLeft = 0
  private camRight = 3000
  private camTop = 0
  private camBottom = 1800
  private hasEmittedReady = false
  private mouseScreen = { x: 0, y: 0, onCanvas: false }
  private minimapRect = { x: 12, y: 8, w: 176, h: 106 }
  private cameraPeek = { active: false, worldX: 0, worldY: 0, minimapMode: false }
  private dragPan = {
    pointerId: -1,
    button: 0,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    startWorldX: 0,
    startWorldY: 0,
  }

  constructor() {
    super({ key: 'ArenaScene' })
  }

  preload(): void {
    if (!this.textures.exists('shibuya_bg')) {
      this.load.image('shibuya_bg', '/maps/shibuya_bg.png')
    }
    if (!this.textures.exists('konoha_bg')) {
      this.load.image('konoha_bg', '/maps/konoha_bg.png')
    }
  }

  create(): void {
    this.hasEmittedReady = false
    this.bakeRepeatedTextures()
    this.loadMinimapPortraitTextures()

    const camW = Math.max(640, this.cameras.main.width)
    const camH = Math.max(360, this.cameras.main.height)
    const initialBg =
      this.mapCfg.id === 'konoha' && this.textures.exists('konoha_bg') ? 'konoha_bg' : 'shibuya_bg'
    if (this.textures.exists(initialBg)) {
      this.backdropImg = this.add
        .image(camW * 0.5, camH * 0.5, initialBg)
        .setScrollFactor(0)
        .setDepth(-15000)
        .setDisplaySize(Math.max(camW, camH * (16 / 9)), Math.max(camH, camW * (9 / 16)))
    }

    const initialFloor = this.mapCfg.id === 'konoha' ? 'konoha_village_tile' : 'arena_stone_tile'
    this.floorTile = this.add
      .tileSprite(0, 0, this.mapCfg.width, this.mapCfg.height * ISO_Y, initialFloor)
      .setOrigin(0, 0)
      .setDepth(-11000)

    this.overlayGfx = this.add.graphics().setDepth(-10000)
    this.zoneGfx = this.add.graphics().setDepth(-5000)
    this.aimGfx = this.add.graphics().setDepth(5)
    this.fxGfx = this.add.graphics().setDepth(9000)
    this.borderFogGfx = this.add.graphics().setDepth(9500)
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(20000)
    this.minimapRingGfx = this.add.graphics().setScrollFactor(0).setDepth(20005)

    this.cameras.main.setBackgroundColor('#07080d')

    const onResize = (gameSize: Phaser.Structs.Size) => {
      const rw = Math.max(320, gameSize.width)
      const rh = Math.max(240, gameSize.height)
      this.backdropImg
        ?.setPosition(rw * 0.5, rh * 0.5)
        .setDisplaySize(Math.max(rw, rh * (16 / 9)), Math.max(rh, rw * (9 / 16)))
      this.minimapBgKey = ''
    }
    this.scale.on('resize', onResize)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize)
    })

    const canvasEl = this.game.canvas
    const toCanvasScreen = (ev: PointerEvent) => {
      if (!canvasEl) return { sx: 0, sy: 0 }
      const rect = canvasEl.getBoundingClientRect()
      const cam = this.cameras.main
      const sx = rect.width > 0 ? ((ev.clientX - rect.left) / rect.width) * cam.width : 0
      const sy = rect.height > 0 ? ((ev.clientY - rect.top) / rect.height) * cam.height : 0
      return { sx, sy }
    }

    const updateMinimapPeek = (sx: number, sy: number) => {
      const mm = this.minimapRect
      const rx = clamp((sx - mm.x) / Math.max(1, mm.w), 0, 1)
      const ry = clamp((sy - mm.y) / Math.max(1, mm.h), 0, 1)
      this.cameraPeek.active = true
      this.cameraPeek.minimapMode = true
      this.cameraPeek.worldX = rx * this.mapCfg.width
      this.cameraPeek.worldY = ry * this.mapCfg.height
    }

    const onNativePointerDown = (ev: PointerEvent) => {
      if (!canvasEl || ev.target !== canvasEl || this.dragPan.pointerId !== -1) return
      const { sx, sy } = toCanvasScreen(ev)
      const mm = this.minimapRect
      const inMinimap = sx >= mm.x && sx <= mm.x + mm.w && sy >= mm.y && sy <= mm.y + mm.h
      const cam = this.cameras.main

      this.dragPan = {
        pointerId: ev.pointerId,
        button: ev.button,
        downX: sx,
        downY: sy,
        lastX: sx,
        lastY: sy,
        moved: false,
        startWorldX: cam.scrollX + cam.width * 0.5,
        startWorldY: (cam.scrollY + cam.height * 0.5) / ISO_Y,
      }
      if (inMinimap) {
        updateMinimapPeek(sx, sy)
      }
    }

    const onNativePointerMove = (ev: PointerEvent) => {
      if (!canvasEl) return
      const { sx, sy } = toCanvasScreen(ev)
      const cam = this.cameras.main

      if (this.dragPan.pointerId === ev.pointerId) {
        if (this.cameraPeek.minimapMode) {
          this.dragPan.moved = true
          updateMinimapPeek(sx, sy)
        } else {
          const totalDist = Math.hypot(sx - this.dragPan.downX, sy - this.dragPan.downY)
          const panThreshold = ev.pointerType === 'touch' || this.dragPan.button !== 0 ? 5 : 10
          if (totalDist >= panThreshold) {
            if (!this.dragPan.moved) {
              this.dragPan.moved = true
              this.cameraPeek.active = true
              this.cameraPeek.minimapMode = false
              this.cameraPeek.worldX = this.dragPan.startWorldX
              this.cameraPeek.worldY = this.dragPan.startWorldY
            }
            // Pan camera opposite to drag vector (RoV / MLBB map drag intuition) clamped strictly inside map
            const panScale = ev.pointerType === 'touch' ? 1.45 : 1.25
            const dx = (sx - this.dragPan.lastX) * panScale
            const dy = (sy - this.dragPan.lastY) * panScale
            const halfW = cam.width * 0.5
            const halfH = (cam.height * 0.5) / ISO_Y
            this.cameraPeek.worldX = clamp(
              this.cameraPeek.worldX - dx,
              Math.min(halfW, this.mapCfg.width * 0.5),
              Math.max(halfW, this.mapCfg.width - halfW),
            )
            this.cameraPeek.worldY = clamp(
              this.cameraPeek.worldY - dy / ISO_Y,
              Math.min(halfH, this.mapCfg.height * 0.5),
              Math.max(halfH, this.mapCfg.height - halfH),
            )
          }
        }
        this.dragPan.lastX = sx
        this.dragPan.lastY = sy
      }

      if (ev.pointerType !== 'touch') {
        this.mouseScreen = { x: sx, y: sy, onCanvas: true }
        gameEventBus.emitAimMove({
          worldX: cam.scrollX + sx,
          worldY: (cam.scrollY + sy) / ISO_Y,
          active: true,
        })
      }
    }

    const onNativePointerUp = (ev: PointerEvent) => {
      if (this.dragPan.pointerId !== ev.pointerId) return
      const { sx, sy } = toCanvasScreen(ev)
      const wasDragged = this.dragPan.moved
      const wasMinimap = this.cameraPeek.minimapMode
      const wasPrimaryMouse = ev.pointerType !== 'touch' && this.dragPan.button === 0

      this.dragPan.pointerId = -1
      this.dragPan.moved = false
      this.cameraPeek.active = false
      this.cameraPeek.minimapMode = false

      // Crisp left-click on arena ground (not dragged & outside minimap) -> Lock-On Basic Attack
      if (ev.type === 'pointerup' && wasPrimaryMouse && !wasDragged && !wasMinimap) {
        const cam = this.cameras.main
        gameEventBus.emitCastClick({
          worldX: cam.scrollX + sx,
          worldY: (cam.scrollY + sy) / ISO_Y,
        })
      }
    }

    const onContextMenu = (ev: MouseEvent) => {
      ev.preventDefault()
    }

    const onCanvasLeave = () => {
      this.mouseScreen.onCanvas = false
      gameEventBus.emitAimMove({ worldX: 0, worldY: 0, active: false })
    }
    canvasEl?.addEventListener('pointerdown', onNativePointerDown)
    canvasEl?.addEventListener('pointermove', onNativePointerMove)
    canvasEl?.addEventListener('pointerup', onNativePointerUp)
    canvasEl?.addEventListener('pointercancel', onNativePointerUp)
    canvasEl?.addEventListener('contextmenu', onContextMenu)
    canvasEl?.addEventListener('pointerleave', onCanvasLeave)

    this.unsubs.push(
      gameEventBus.onInit((payload) => {
        this.myPlayerId = payload.myPlayerId
        this.mapCfg = payload.mapCfg
        this.buildBattlefield25D()
        this.syncActors(payload.players, true)
        this.projectiles = payload.projectiles
        this.beams = payload.beams
        this.zones = payload.zones

        const me = this.actors.get(this.myPlayerId)
        if (me) {
          this.snapCameraTo(me.renderX, me.renderY)
        }
      }),

      gameEventBus.onSync((payload) => {
        this.syncActors(payload.players, false)
        this.projectiles = payload.projectiles
        this.beams = payload.beams
        this.zones = payload.zones
      }),

      gameEventBus.onDied((ev) => {
        soundEngine.playEffectSound('ko')
        this.spawnImpactParticles(ev.x, ev.y * ISO_Y, 0xff3b30, 12)
        if (ev.victimId === this.myPlayerId) {
          this.cameras.main.shake(220, 0.008)
        } else {
          this.cameras.main.shake(90, 0.0025)
        }
      }),

      gameEventBus.onEmote((ev) => {
        this.spawnFloatingEmote(ev.playerId, ev.emote)
      }),

      gameEventBus.onAimPreview((preview) => {
        this.aimPreview = preview
      }),
    )

    const cleanup = () => {
      canvasEl?.removeEventListener('pointerdown', onNativePointerDown)
      canvasEl?.removeEventListener('pointermove', onNativePointerMove)
      canvasEl?.removeEventListener('pointerup', onNativePointerUp)
      canvasEl?.removeEventListener('pointercancel', onNativePointerUp)
      canvasEl?.removeEventListener('contextmenu', onContextMenu)
      canvasEl?.removeEventListener('pointerleave', onCanvasLeave)
      this.mouseScreen.onCanvas = false
      this.unsubs.forEach((u) => u())
      this.unsubs = []
      this.actors.forEach((a) => a.container.destroy())
      this.actors.clear()
      this.projSpritePool.forEach((s) => s.destroy())
      this.projSpritePool = []
      this.impactPool.forEach((p) => p.sprite.destroy())
      this.impactPool = []
      this.minimapPortraits.forEach((img) => img.destroy())
      this.minimapPortraits.clear()
      this.mapPropImg?.destroy()
      this.mapPropImg = undefined
      this.seenEffects.clear()
      this.seenPlayerIds.clear()
      this.minimapBgKey = ''
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  }

  /**
   * Generates lightweight GPU-cached procedural Shibuya textures ONCE so the
   * 3000x1800 shattered city arena renders crisply at high frame rates.
   */
  private bakeRepeatedTextures(): void {
    // 1. Seamless 512x512 Shibuya Battle-Scarred Concrete Slab Tile (Cracks + Crosswalk + Blood Stains)
    if (!this.textures.exists('arena_stone_tile')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x23262f, 1)
      g.fillRect(0, 0, 512, 512)

      // Weathered urban concrete slabs
      const slabs = [
        [0, 0, 256, 170, 0x2a2e39],
        [256, 0, 256, 170, 0x252832],
        [0, 170, 180, 170, 0x272a34],
        [180, 170, 332, 170, 0x2d313d],
        [0, 340, 300, 172, 0x242731],
        [300, 340, 212, 172, 0x2b2f3b],
      ]
      for (const [bx, by, bw, bh, col] of slabs) {
        g.fillStyle(col, 1)
        g.fillRect(bx + 2, by + 2, bw - 4, bh - 4)
        g.lineStyle(1.5, 0x111318, 0.72)
        g.strokeRect(bx + 2, by + 2, bw - 4, bh - 4)
      }

      // Faded Shibuya Scramble crosswalk road paint
      g.fillStyle(0xe2e8f0, 0.08)
      for (let x = 24; x < 500; x += 64) {
        g.fillRect(x, 12, 34, 62)
        g.fillRect(x + 18, 256, 34, 62)
      }

      // Deep jagged battle fracture cracks & rubble scorches
      const cracks = [
        [96, 118, 146, 94, 198, 126, 232, 96],
        [146, 94, 134, 152, 162, 194, 148, 224],
        [384, 348, 340, 310, 294, 334, 248, 302],
        [384, 348, 434, 386, 474, 362, 496, 412],
        [404, 110, 444, 154, 422, 206, 466, 238],
      ]
      for (const [x0, y0, x1, y1, x2, y2, x3, y3] of cracks) {
        g.lineStyle(5, 0x09090b, 0.88)
        g.beginPath()
        g.moveTo(x0, y0)
        g.lineTo(x1, y1)
        g.lineTo(x2, y2)
        g.lineTo(x3, y3)
        g.strokePath()
        g.lineStyle(1.5, 0x52525b, 0.52)
        g.lineBetween(x0 + 2, y0 + 2, x1 + 2, y1 + 2)
      }

      // Crimson battle blood splatters & dark smears across cracked concrete
      const bloodPools: Array<[number, number, number, number, number]> = [
        [142, 132, 42, 26, 0x7f1d1d],
        [152, 128, 22, 14, 0x991b1b],
        [118, 146, 12, 8, 0xb91c1c],
        [374, 356, 54, 32, 0x7f1d1d],
        [388, 350, 28, 18, 0x991b1b],
        [418, 376, 14, 10, 0x991b1b],
        [72, 408, 34, 20, 0x7f1d1d],
        [434, 174, 26, 16, 0x991b1b],
      ]
      for (const [sx, sy, rw, rh, col] of bloodPools) {
        g.fillStyle(col, 0.72)
        g.fillEllipse(sx, sy, rw, rh)
      }

      g.generateTexture('arena_stone_tile', 512, 512)
      g.destroy()
    }

    // 2. Cached 2.5D Extruded Shibuya Ruined Concrete & Rebar Pylon (140x185)
    if (!this.textures.exists('arena_pillar_25d')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const cx = 64
      const baseY = 148
      const rx = 46
      const ry = 36
      const h = 84

      g.fillStyle(0x09090b, 0.5)
      g.fillEllipse(cx + 16, baseY + 8, rx * 2.2, ry * 2.0)

      // Shattered Concrete Column
      g.fillStyle(0x52525b, 1)
      g.fillRect(cx - rx, baseY - h, rx * 2, h)
      g.fillStyle(0x27272a, 0.65)
      g.fillRect(cx + 6, baseY - h, rx - 6, h)
      g.fillEllipse(cx, baseY, rx * 2, ry * 2)

      // Cursed Crimson Seal Crack & Exposed Steel Rebar
      g.lineStyle(3, 0x991b1b, 0.88)
      g.strokeEllipse(cx, baseY - h * 0.44, rx * 2, ry * 2)
      g.lineStyle(2.5, 0x18181b, 0.9)
      g.lineBetween(cx - 20, baseY - h + 12, cx - 10, baseY - 20)
      g.lineBetween(cx - 10, baseY - 20, cx - 26, baseY - 6)

      // Broken Top Slab + Steel Rebar Spikes
      g.fillStyle(0x71717a, 1)
      g.fillEllipse(cx, baseY - h, rx * 2, ry * 2)
      g.lineStyle(2.5, 0xdc2626, 0.7)
      g.strokeEllipse(cx, baseY - h, rx * 2, ry * 2)
      g.lineStyle(3, 0x27272a, 1)
      g.lineBetween(cx - 22, baseY - h - 4, cx - 26, baseY - h - 22)
      g.lineBetween(cx + 12, baseY - h - 6, cx + 18, baseY - h - 20)

      g.generateTexture('arena_pillar_25d', 140, 185)
      g.destroy()
    }

    // 2B. Cached Shibuya Incident Easter Egg Prop: Gojo Satoru Bisected Half-Body (220x120)
    if (!this.textures.exists('prop_gojo_half')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      // Wide crimson blood pool beneath bisected upper & lower halves
      g.fillStyle(0x7f1d1d, 0.85)
      g.fillEllipse(108, 66, 176, 74)
      g.fillStyle(0x991b1b, 0.92)
      g.fillEllipse(106, 62, 118, 48)

      // Left piece: Upper Torso Half + White Hair + Six Eyes + Dark Coat
      g.fillStyle(0x0f172a, 1)
      g.fillRoundedRect(44, 42, 62, 34, 10)
      // Stretched sleeves/arms resting on concrete
      g.fillRoundedRect(38, 22, 18, 24, 6)
      g.fillRoundedRect(54, 72, 20, 22, 6)
      g.fillStyle(0xfde6cd, 1)
      g.fillCircle(44, 19, 5)
      g.fillCircle(66, 94, 5)
      // Gojo Head + Spiky Pure White Hair + Six Eyes Pale Blue
      g.fillStyle(0xfde6cd, 1)
      g.fillCircle(34, 58, 14)
      g.fillStyle(0xf8fafc, 1)
      g.fillTriangle(16, 48, 24, 64, 34, 42)
      g.fillTriangle(12, 58, 26, 72, 32, 50)
      g.fillTriangle(18, 42, 36, 40, 40, 52)
      // Faded blindfold beside head + icy Six Eyes
      g.fillStyle(0x09090b, 1)
      g.fillRect(28, 72, 18, 5)
      g.fillStyle(0x38bdf8, 0.95)
      g.fillCircle(36, 53, 2.2)
      g.fillCircle(36, 61, 2.2)
      // Torn Waist Cut Rim
      g.fillStyle(0xdc2626, 0.95)
      g.fillEllipse(104, 59, 10, 28)

      // Right piece: Lower Legs & Black Slacks Split Across the Concrete
      g.fillStyle(0xdc2626, 0.92)
      g.fillEllipse(130, 59, 9, 26)
      g.fillStyle(0x111827, 1)
      g.fillRoundedRect(130, 44, 24, 30, 6)
      g.fillRoundedRect(148, 42, 46, 12, 4)
      g.fillRoundedRect(148, 60, 46, 12, 4)
      // Black Shoes
      g.fillStyle(0x09090b, 1)
      g.fillEllipse(196, 48, 14, 9)
      g.fillEllipse(196, 66, 14, 9)

      g.generateTexture('prop_gojo_half', 220, 120)
      g.destroy()
    }

    // 2C. Seamless 512x512 Konoha Hidden Leaf Packed Earth & Ninja Village Flagstone Tile
    if (!this.textures.exists('konoha_village_tile')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xb99364, 1)
      g.fillRect(0, 0, 512, 512)

      const tiles = [
        [0, 0, 256, 170, 0xc49f71],
        [256, 0, 256, 170, 0xb88f60],
        [0, 170, 180, 170, 0xba9262],
        [180, 170, 332, 170, 0xc8a477],
        [0, 340, 290, 172, 0xb68d5e],
        [290, 340, 222, 172, 0xc29c6e],
      ]
      for (const [bx, by, bw, bh, col] of tiles) {
        g.fillStyle(col, 1)
        g.fillRect(bx + 2, by + 2, bw - 4, bh - 4)
        g.lineStyle(1.5, 0x7c5832, 0.42)
        g.strokeRect(bx + 2, by + 2, bw - 4, bh - 4)
      }
      // Subtle Ninja footsteps & mossy seams
      for (const [mx, my, r] of [
        [70, 88, 12],
        [340, 220, 16],
        [210, 420, 14],
        [450, 96, 10],
      ]) {
        g.fillStyle(0x4d7c0f, 0.22)
        g.fillEllipse(mx, my, r * 2, r * 1.2)
      }
      g.fillStyle(0xf9a8d4, 0.45)
      for (const [px, py] of [
        [110, 140],
        [390, 310],
        [280, 64],
        [80, 380],
      ]) {
        g.fillEllipse(px, py, 9, 5)
      }
      g.generateTexture('konoha_village_tile', 512, 512)
      g.destroy()
    }

    // 2D. Cached 2.5D Konoha Crimson Torii / Shinobi Roof Pillar (140x185)
    if (!this.textures.exists('konoha_pillar_25d')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const cx = 64
      const baseY = 148
      const rx = 46
      const ry = 36
      const h = 86

      g.fillStyle(0x451a03, 0.38)
      g.fillEllipse(cx + 14, baseY + 8, rx * 2.1, ry * 1.9)

      // Timber-framed Plaster Dojo Base
      g.fillStyle(0xd6d3d1, 1)
      g.fillRect(cx - rx * 0.85, baseY - h, rx * 1.7, h)
      g.fillStyle(0xa8a29e, 0.65)
      g.fillRect(cx + 6, baseY - h, rx * 0.78, h)
      g.fillStyle(0x991b1b, 1)
      g.fillRect(cx - rx * 0.9, baseY - h + 6, rx * 1.8, 12)
      g.fillEllipse(cx, baseY, rx * 1.85, ry * 1.85)

      // Sage-Green Traditional Roof Cap + Konoha Gold Trim
      g.fillStyle(0x166534, 1)
      g.fillEllipse(cx, baseY - h, rx * 2.15, ry * 2.05)
      g.lineStyle(3, 0xfacc15, 0.9)
      g.strokeEllipse(cx, baseY - h, rx * 2.05, ry * 1.95)
      g.lineStyle(2.5, 0x14532d, 0.9)
      g.strokeEllipse(cx, baseY - h + 6, rx * 2.15, ry * 2.05)
      g.generateTexture('konoha_pillar_25d', 140, 185)
      g.destroy()
    }

    // 2E. Cached Konoha Training Ground Prop (3 Wooden Ninja Training Logs + Rope, 180x110)
    if (!this.textures.exists('prop_konoha_logs')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x451a03, 0.35)
      g.fillEllipse(90, 92, 130, 32)
      for (const [lx, topY, h] of [
        [52, 22, 68],
        [90, 12, 78],
        [128, 24, 66],
      ]) {
        g.fillStyle(0x78350f, 1)
        g.fillRoundedRect(lx - 14, topY, 28, h, 6)
        g.fillStyle(0x92400e, 0.85)
        g.fillRoundedRect(lx - 10, topY + 2, 12, h - 4, 4)
        g.fillStyle(0xfde68a, 1)
        g.fillEllipse(lx, topY + 4, 26, 11)
        g.lineStyle(3, 0xef4444, 0.85)
        g.strokeCircle(lx, topY + 26, 7)
      }
      g.lineStyle(4, 0xd97706, 0.95)
      g.lineBetween(34, 62, 146, 62)
      g.lineBetween(36, 70, 144, 70)
      g.generateTexture('prop_konoha_logs', 180, 110)
      g.destroy()
    }

    // 3. Cached Soft Radial Energy Orb Texture (64x64)
    if (!this.textures.exists('fx_orb_glow')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 0.16)
      g.fillCircle(32, 32, 28)
      g.fillStyle(0xffffff, 0.35)
      g.fillCircle(32, 32, 18)
      g.fillStyle(0xffffff, 0.95)
      g.fillCircle(32, 32, 10)
      g.generateTexture('fx_orb_glow', 64, 64)
      g.destroy()
    }

    // 4. Cached Crescent Slash / Blade Texture (64x64)
    if (!this.textures.exists('fx_slash_wave')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.lineStyle(12, 0xffffff, 0.38)
      g.beginPath()
      g.arc(22, 32, 24, -Math.PI * 0.46, Math.PI * 0.46)
      g.strokePath()
      g.lineStyle(5, 0xffffff, 0.98)
      g.beginPath()
      g.arc(26, 32, 22, -Math.PI * 0.42, Math.PI * 0.42)
      g.strokePath()
      g.generateTexture('fx_slash_wave', 64, 64)
      g.destroy()
    }

    // 5. Cached Golden Sword of Babylon Texture (64x32)
    if (!this.textures.exists('fx_gold_sword')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 0.25)
      g.fillEllipse(34, 16, 56, 16)
      g.fillStyle(0xffffff, 0.98)
      g.fillTriangle(18, 12, 60, 16, 18, 20)
      g.fillRect(10, 7, 5, 18)
      g.fillRect(4, 13, 10, 6)
      g.generateTexture('fx_gold_sword', 64, 32)
      g.destroy()
    }

    // 6. Cached 4-Blade Crow Shuriken Texture (64x64)
    if (!this.textures.exists('fx_crow_shuriken')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 0.96)
      g.fillTriangle(32, 4, 24, 28, 40, 28)
      g.fillTriangle(60, 32, 36, 24, 36, 40)
      g.fillTriangle(32, 60, 24, 36, 40, 36)
      g.fillTriangle(4, 32, 28, 24, 28, 40)
      g.fillStyle(0x111827, 1)
      g.fillCircle(32, 32, 6)
      g.generateTexture('fx_crow_shuriken', 64, 64)
      g.destroy()
    }

    // 7. Cached Fiery Fuga Arrow Texture (64x32)
    if (!this.textures.exists('fx_fire_arrow')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 0.32)
      g.fillEllipse(30, 16, 58, 22)
      g.fillStyle(0xffffff, 0.98)
      g.fillTriangle(36, 8, 62, 16, 36, 24)
      g.fillRect(6, 13, 32, 6)
      g.fillTriangle(4, 7, 18, 16, 4, 25)
      g.generateTexture('fx_fire_arrow', 64, 32)
      g.destroy()
    }

    // 8. Cached Uchiha Black-Crimson Kunai Texture (64x32)
    if (!this.textures.exists('fx_kunai')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xdc2626, 0.38)
      g.fillEllipse(36, 16, 54, 18)
      g.fillStyle(0x1e293b, 1)
      g.fillTriangle(26, 7, 60, 16, 26, 25)
      g.lineStyle(2, 0xfca5a5, 0.95)
      g.strokeTriangle(26, 7, 60, 16, 26, 25)
      g.fillRect(10, 14, 18, 4)
      g.lineStyle(2.5, 0xdc2626, 1)
      g.strokeCircle(7, 16, 4.5)
      g.generateTexture('fx_kunai', 64, 32)
      g.destroy()
    }

    // 9. Cached Zoro King-of-Hell Triple Enma Crescent Blade Texture (128x128)
    if (!this.textures.exists('fx_zoro_pound_ho')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const arcs = [
        { cx: 38, r: 44, lw: 20, col: 0x7e22ce, a: 0.48 },
        { cx: 46, r: 42, lw: 16, col: 0x10b981, a: 0.92 },
        { cx: 52, r: 40, lw: 9, col: 0x6ee7b7, a: 0.96 },
        { cx: 56, r: 38, lw: 4, col: 0xffffff, a: 1.0 },
      ]
      for (const a of arcs) {
        g.lineStyle(a.lw, a.col, a.a)
        g.beginPath()
        g.arc(a.cx, 64, a.r, -Math.PI * 0.45, Math.PI * 0.45)
        g.strokePath()
      }
      // Flanking secondary blade crescents (top & bottom Santoryu wings)
      for (const oy of [-28, 28]) {
        g.lineStyle(8, 0xa855f7, 0.55)
        g.beginPath()
        g.arc(30, 64 + oy * 0.55, 24, -Math.PI * 0.36, Math.PI * 0.36)
        g.strokePath()
        g.lineStyle(4, 0xa7f3d0, 0.95)
        g.beginPath()
        g.arc(34, 64 + oy * 0.55, 23, -Math.PI * 0.34, Math.PI * 0.34)
        g.strokePath()
      }
      // Katana gleam diamond tip
      g.fillStyle(0xffffff, 1)
      g.fillTriangle(94, 52, 98, 64, 94, 76)
      g.fillTriangle(84, 64, 96, 60, 114, 64)
      g.fillTriangle(84, 64, 96, 68, 114, 64)
      g.generateTexture('fx_zoro_pound_ho', 128, 128)
      g.destroy()
    }

    // 10. Cached Rimuru Demon Lord Black Flame Crescent Texture (128x128)
    if (!this.textures.exists('fx_rimuru_flame')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const arcs = [
        { cx: 36, r: 46, lw: 22, col: 0x020617, a: 0.94 },
        { cx: 44, r: 43, lw: 16, col: 0x7e22ce, a: 0.88 },
        { cx: 52, r: 40, lw: 10, col: 0x38bdf8, a: 0.94 },
        { cx: 57, r: 38, lw: 4, col: 0x0f172a, a: 0.96 },
      ]
      for (const a of arcs) {
        g.lineStyle(a.lw, a.col, a.a)
        g.beginPath()
        g.arc(a.cx, 64, a.r, -Math.PI * 0.44, Math.PI * 0.44)
        g.strokePath()
      }
      g.fillStyle(0x38bdf8, 0.9)
      g.fillCircle(88, 44, 5)
      g.fillCircle(94, 64, 6)
      g.fillCircle(88, 84, 5)
      g.fillStyle(0xfacc15, 0.95)
      g.fillCircle(96, 64, 3)
      g.generateTexture('fx_rimuru_flame', 128, 128)
      g.destroy()
    }

    // 11. Cached Stand Cat Ai-Ouan Astral Pounce Texture (128x128)
    if (!this.textures.exists('fx_aiouan_paw')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x9333ea, 0.36)
      g.fillEllipse(58, 64, 98, 72)
      g.lineStyle(6, 0xfacc15, 0.92)
      g.strokeEllipse(64, 64, 72, 62)
      g.fillStyle(0xc084fc, 0.95)
      g.fillCircle(66, 64, 28)
      g.fillStyle(0xfde047, 1)
      g.fillEllipse(66, 68, 16, 13)
      for (const [bx, by] of [
        [80, 48],
        [92, 64],
        [80, 80],
      ]) {
        g.fillCircle(bx, by, 5)
        g.fillTriangle(bx + 4, by - 4, bx + 20, by, bx + 4, by + 4)
      }
      g.fillStyle(0xffffff, 0.9)
      g.fillCircle(72, 60, 4)
      g.generateTexture('fx_aiouan_paw', 128, 128)
      g.destroy()
    }

    // 12. Cached Gojo Reversal Red Orb Texture (128x128)
    if (!this.textures.exists('fx_gojo_red')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x991b1b, 0.34)
      g.fillCircle(64, 64, 54)
      g.fillStyle(0xef4444, 0.72)
      g.fillCircle(64, 64, 38)
      g.lineStyle(4.5, 0xfca5a5, 0.95)
      g.strokeCircle(64, 64, 38)
      g.lineStyle(2.5, 0x0f172a, 0.85)
      g.strokeCircle(64, 64, 48)
      g.fillStyle(0xffffff, 0.98)
      g.fillCircle(64, 64, 15)
      g.generateTexture('fx_gojo_red', 128, 128)
      g.destroy()
    }

    // 13. Cached Gojo Lapse Blue Singularity Orb Texture (128x128)
    if (!this.textures.exists('fx_gojo_blue')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x0284c7, 0.32)
      g.fillCircle(64, 64, 54)
      g.fillStyle(0x38bdf8, 0.78)
      g.fillCircle(64, 64, 36)
      g.lineStyle(4, 0xbae6fd, 0.96)
      g.strokeCircle(64, 64, 36)
      g.fillStyle(0x020617, 0.92)
      g.fillCircle(64, 64, 16)
      g.lineStyle(2.5, 0x7dd3fc, 0.95)
      g.strokeCircle(64, 64, 16)
      g.generateTexture('fx_gojo_blue', 128, 128)
      g.destroy()
    }
  }

  private buildBattlefield25D(): void {
    const w = this.mapCfg.width
    const h25 = this.mapCfg.height * ISO_Y
    const isKonoha = this.mapCfg.id === 'konoha'

    const camW = Math.max(640, this.cameras.main.width)
    const camH = Math.max(360, this.cameras.main.height)
    const bgKey = isKonoha && this.textures.exists('konoha_bg') ? 'konoha_bg' : 'shibuya_bg'
    if (this.backdropImg && this.textures.exists(bgKey)) {
      this.backdropImg
        .setTexture(bgKey)
        .setPosition(camW * 0.5, camH * 0.5)
        .setDisplaySize(Math.max(camW, camH * (16 / 9)), Math.max(camH, camW * (9 / 16)))
    }

    this.floorTile
      .setTexture(isKonoha ? 'konoha_village_tile' : 'arena_stone_tile')
      .setSize(w, h25)
    this.cameras.main.setBounds(-180, -150, w + 360, h25 + 300)

    this.overlayGfx.clear()
    this.borderFogGfx.clear()
    this.pillarImages.forEach((p) => p.destroy())
    this.pillarImages = []
    this.mapPropImg?.destroy()

    const cx = w / 2
    const cy = h25 / 2

    if (isKonoha) {
      // Konoha Wooden Fence Retaining Edge & Hokage Plaza Center Leaf Emblem
      this.overlayGfx.fillStyle(0x78350f, 1)
      this.overlayGfx.fillRect(0, -56, w, 56)
      this.overlayGfx.fillStyle(0x166534, 1)
      this.overlayGfx.fillRect(0, -68, w, 12)
      this.overlayGfx.lineStyle(3, 0xfacc15, 0.8)
      this.overlayGfx.strokeRect(0, -56, w, 56)

      // Blue Team (West) vs Red Team (East) Spawn Gate Badges on ground
      this.overlayGfx.fillStyle(0x0284c7, 0.16)
      this.overlayGfx.fillEllipse(240, cy, 280, 260 * ISO_Y)
      this.overlayGfx.lineStyle(3, 0x38bdf8, 0.58)
      this.overlayGfx.strokeEllipse(240, cy, 280, 260 * ISO_Y)

      this.overlayGfx.fillStyle(0xdc2626, 0.16)
      this.overlayGfx.fillEllipse(w - 240, cy, 280, 260 * ISO_Y)
      this.overlayGfx.lineStyle(3, 0xf87171, 0.58)
      this.overlayGfx.strokeEllipse(w - 240, cy, 280, 260 * ISO_Y)

      // Center Konoha Hidden Leaf Spiral Seal Circle
      this.overlayGfx.fillStyle(0x9a7b4f, 0.35)
      this.overlayGfx.fillEllipse(cx, cy, 460, 460 * ISO_Y)
      this.overlayGfx.lineStyle(3, 0x166534, 0.58)
      this.overlayGfx.strokeEllipse(cx, cy, 420, 420 * ISO_Y)
      this.overlayGfx.lineStyle(2.5, 0xfacc15, 0.52)
      this.overlayGfx.strokeEllipse(cx, cy, 250, 250 * ISO_Y)

      // Training Logs Prop tucked cleanly near upper central village plaza
      const logsY = 480 * ISO_Y
      this.mapPropImg = this.add
        .image(cx, logsY, 'prop_konoha_logs')
        .setDepth(logsY - 80)

      // Soft warm forest-leaf perimeter vignette (clean edges, no harsh ovals)
      const fogBand = 86
      this.borderFogGfx.fillGradientStyle(0x14532d, 0x14532d, 0x14532d, 0x14532d, 0.65, 0.65, 0, 0)
      this.borderFogGfx.fillRect(0, 0, w, fogBand)
      this.borderFogGfx.fillGradientStyle(0x14532d, 0x14532d, 0x14532d, 0x14532d, 0, 0, 0.68, 0.68)
      this.borderFogGfx.fillRect(0, h25 - fogBand, w, fogBand)
      this.borderFogGfx.fillGradientStyle(0x14532d, 0x14532d, 0x14532d, 0x14532d, 0.65, 0, 0.65, 0)
      this.borderFogGfx.fillRect(0, 0, fogBand, h25)
      this.borderFogGfx.fillGradientStyle(0x14532d, 0x14532d, 0x14532d, 0x14532d, 0, 0.65, 0, 0.65)
      this.borderFogGfx.fillRect(w - fogBand, 0, fogBand, h25)
    } else {
      // Shattered Shibuya Urban Retaining Concrete Ledge along Top Edge
      this.overlayGfx.fillStyle(0x27272a, 1)
      this.overlayGfx.fillRect(0, -56, w, 56)
      this.overlayGfx.fillStyle(0x3f3f46, 1)
      this.overlayGfx.fillRect(0, -68, w, 12)
      this.overlayGfx.lineStyle(3, 0x991b1b, 0.85)
      this.overlayGfx.strokeRect(0, -56, w, 56)

      // Shibuya Scramble Intersection Crosswalk Lines & Center Blast Crater
      this.overlayGfx.fillStyle(0xe2e8f0, 0.14)
      for (let k = -4; k <= 4; k++) {
        this.overlayGfx.fillRect(cx + k * 70 - 18, cy - 220, 36, 90)
        this.overlayGfx.fillRect(cx + k * 70 - 18, cy + 130, 36, 90)
      }
      this.overlayGfx.fillStyle(0x09090b, 0.36)
      this.overlayGfx.fillEllipse(cx, cy, 420, 420 * ISO_Y)
      this.overlayGfx.lineStyle(2.5, 0x991b1b, 0.45)
      this.overlayGfx.strokeEllipse(cx, cy, 340, 340 * ISO_Y)
      this.overlayGfx.lineStyle(2, 0xf8fafc, 0.18)
      this.overlayGfx.strokeEllipse(cx, cy, 520, 520 * ISO_Y)

      // Iconic Shibuya/Shinjuku Prop: Bisected Gojo Satoru resting cleanly in central plaza
      const gojoY = 670 * ISO_Y
      this.mapPropImg = this.add
        .image(cx + 80, gojoY, 'prop_gojo_half')
        .setDepth(gojoY - 120)

      // Clean Monochrome Black & White Domain Veil Mist Border (smooth fading gradients without harsh blobs)
      const fogBand = 96
      this.borderFogGfx.fillGradientStyle(0x09090b, 0x09090b, 0xf8fafc, 0xf8fafc, 0.78, 0.78, 0, 0)
      this.borderFogGfx.fillRect(0, 0, w, fogBand)
      this.borderFogGfx.fillGradientStyle(0xf8fafc, 0xf8fafc, 0x09090b, 0x09090b, 0, 0, 0.8, 0.8)
      this.borderFogGfx.fillRect(0, h25 - fogBand, w, fogBand)
      this.borderFogGfx.fillGradientStyle(0x09090b, 0xf8fafc, 0x09090b, 0xf8fafc, 0.78, 0, 0.78, 0)
      this.borderFogGfx.fillRect(0, 0, fogBand, h25)
      this.borderFogGfx.fillGradientStyle(0xf8fafc, 0x09090b, 0xf8fafc, 0x09090b, 0, 0.78, 0, 0.78)
      this.borderFogGfx.fillRect(w - fogBand, 0, fogBand, h25)
    }

    const pillarTex = isKonoha ? 'konoha_pillar_25d' : 'arena_pillar_25d'
    for (const pil of this.mapCfg.pillars ?? []) {
      const py = pil.y * ISO_Y
      const img = this.add
        .image(pil.x, py, pillarTex)
        .setOrigin(64 / 140, 148 / 185)
        .setScale(pil.radius / 46)
        .setDepth(py)
      this.pillarImages.push(img)
    }
  }

  private syncActors(incoming: PlayerState[], snapImmediately: boolean): void {
    const seen = this.seenPlayerIds
    seen.clear()
    for (const p of incoming) {
      seen.add(p.id)
      let actor = this.actors.get(p.id)
      if (!actor) {
        actor = this.createActor(p)
        this.actors.set(p.id, actor)
        this.tweens.add({
          targets: actor.container,
          scale: { from: 0.25, to: 1 },
          duration: 240,
          ease: 'Back.easeOut',
        })
      } else {
        const respawned = !actor.wasAlive && p.alive
        const hpDrop = actor.wasAlive && p.hp < actor.state.hp ? actor.state.hp - p.hp : 0
        if (hpDrop > 0) {
          this.spawnDamagePopup(actor.renderX, actor.renderY * ISO_Y - 58, hpDrop, Boolean(p.isDummy))
        }
        actor.wasAlive = p.alive
        actor.state = p
        if (snapImmediately || respawned) {
          actor.renderX = p.x
          actor.renderY = p.y
          if (respawned) {
            this.tweens.add({
              targets: actor.container,
              scale: { from: 0.3, to: 1 },
              duration: 260,
              ease: 'Back.easeOut',
            })
          }
        }
        if (p.dx !== 0 || p.dy !== 0) {
          actor.facingAngle = Math.atan2(p.dy, p.dx)
        } else if (p.aimDx !== 0 || p.aimDy !== 0) {
          actor.facingAngle = Math.atan2(p.aimDy, p.aimDx)
        }
      }
    }

    for (const [id, actor] of this.actors.entries()) {
      if (!seen.has(id)) {
        actor.container.destroy()
        this.actors.delete(id)
      }
    }
  }

  private createActor(p: PlayerState): ActorView {
    const container = this.add.container(p.x, p.y * ISO_Y)
    const bodyGfx = this.add.graphics()

    const hpBg = this.add.rectangle(0, -64, 52, 7, 0x0f172a, 0.92).setOrigin(0.5)
    const hpFill = this.add.rectangle(-25, -64, 50, 5, 0x34c759, 1).setOrigin(0, 0.5)

    const isMe = p.id === this.myPlayerId
    const initialLabel = isMe ? `${p.name} (คุณ)` : `${p.name} • ${p.characterName}`
    const nameText = this.add
      .text(0, -80, initialLabel, {
        fontFamily: 'Inter, Noto Sans Thai, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: isMe ? '#0071E3' : '#0F172ACC',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5)

    container.add([bodyGfx, hpBg, hpFill, nameText])

    return {
      state: p,
      renderX: p.x,
      renderY: p.y,
      facingAngle: Math.atan2(p.aimDy || 0, p.aimDx || 1),
      bobPhase: Math.random() * Math.PI * 2,
      wasAlive: p.alive,
      lastNameLabel: initialLabel,
      lastJumpLift: 0,
      lastHpWidth: 50,
      lastHpColor: 0x34c759,
      container,
      bodyGfx,
      hpBg,
      hpFill,
      nameText,
    }
  }

  private snapCameraTo(worldX: number, worldY: number): void {
    const viewW = this.cameras.main.width
    const viewH = this.cameras.main.height
    const maxScrollX = Math.max(0, this.mapCfg.width - viewW)
    const maxScrollY = Math.max(0, this.mapCfg.height * ISO_Y - viewH)
    this.camX = clamp(worldX - viewW / 2, 0, maxScrollX)
    this.camY = clamp(worldY * ISO_Y - viewH / 2, 0, maxScrollY)
    this.cameras.main.scrollX = this.camX
    this.cameras.main.scrollY = this.camY
  }

  private spawnDamagePopup(x: number, y25: number, dmg: number, isDummy: boolean): void {
    const label = isDummy ? `-${dmg}!` : `-${dmg}`
    const txt = this.add
      .text(x + (Math.random() - 0.5) * 18, y25, label, {
        fontFamily: 'Inter, Noto Sans Thai, sans-serif',
        fontSize: dmg >= 50 ? '18px' : '15px',
        fontStyle: 'bold',
        color: dmg >= 50 ? '#FACC15' : '#FB7185',
        stroke: '#020617',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(16000)

    this.tweens.add({
      targets: txt,
      y: y25 - 38,
      alpha: 0,
      duration: 680,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    })
  }

  private spawnImpactParticles(x: number, y25: number, colorNum: number, count: number): void {
    const maxPool = 56
    for (let i = 0; i < count; i++) {
      let slot = this.impactPool.find((p) => !p.active)
      if (!slot) {
        if (this.impactPool.length < maxPool) {
          const sprite = this.add.image(x, y25, 'fx_orb_glow').setDepth(9500).setVisible(false)
          slot = { sprite, vx: 0, vy: 0, life: 0, maxLife: 0.36, startScale: 0.32, active: false }
          this.impactPool.push(slot)
        } else {
          break
        }
      }
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.3
      const dist = 36 + Math.random() * 44
      const dur = 0.36
      slot.vx = (Math.cos(ang) * dist) / dur
      slot.vy = (Math.sin(ang) * dist * ISO_Y) / dur
      slot.life = dur
      slot.maxLife = dur
      slot.startScale = 0.32
      slot.active = true
      slot.sprite.setPosition(x, y25).setTint(colorNum).setScale(0.32).setAlpha(1).setVisible(true)
    }
  }

  private stepImpactParticles(dt: number): void {
    for (const p of this.impactPool) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        p.sprite.setVisible(false)
        continue
      }
      const t = p.life / p.maxLife
      p.sprite.x += p.vx * dt
      p.sprite.y += p.vy * dt
      p.sprite.setAlpha(t).setScale(0.05 + (p.startScale - 0.05) * t)
    }
  }

  private spawnFloatingEmote(playerId: string, label: string): void {
    const actor = this.actors.get(playerId)
    if (!actor) return
    const txt = this.add
      .text(actor.renderX, actor.renderY * ISO_Y - 96, label, {
        fontFamily: 'Inter, Noto Sans Thai, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#1D1D1F',
        backgroundColor: '#FFFFFFF5',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(15000)

    this.tweens.add({
      targets: txt,
      y: txt.y - 44,
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    })
  }

  update(time: number, deltaMs: number): void {
    this.animTime = time
    const dt = Math.min(deltaMs / 1000, 0.1)
    this.fpsAccum += deltaMs
    this.fpsFrames++
    if (this.fpsAccum >= 500) {
      gameEventBus.emitFPS(Math.round((this.fpsFrames * 1000) / this.fpsAccum))
      this.fpsAccum = 0
      this.fpsFrames = 0
    }

    const alpha = 1 - Math.exp(-26 * dt)

    // Pre-index jumping Killua leap beams once per frame (O(beams) instead of O(actors * beams))
    this.leapingProgress.clear()
    for (const b of this.beams) {
      if (b.kind === 'killua_leap_arc' && b.ownerId) {
        this.leapingProgress.set(b.ownerId, 1 - clamp(b.life / Math.max(0.05, b.maxLife), 0, 1))
      }
    }

    const me = this.actors.get(this.myPlayerId)
    if (me) {
      const viewW = this.cameras.main.width
      const viewH = this.cameras.main.height
      const maxScrollX = Math.max(0, this.mapCfg.width - viewW)
      const maxScrollY = Math.max(0, this.mapCfg.height * ISO_Y - viewH)
      const focusX = this.cameraPeek.active ? this.cameraPeek.worldX : me.renderX
      const focusY = this.cameraPeek.active ? this.cameraPeek.worldY : me.renderY
      const targetX = clamp(focusX - viewW / 2, 0, maxScrollX)
      const targetY = clamp(focusY * ISO_Y - viewH / 2, 0, maxScrollY)
      const camAlpha = 1 - Math.exp(-(this.cameraPeek.active ? 22 : 12) * dt)
      this.camX += (targetX - this.camX) * camAlpha
      this.camY += (targetY - this.camY) * camAlpha
      this.cameras.main.scrollX = this.camX
      this.cameras.main.scrollY = this.camY
      if (this.mouseScreen.onCanvas) {
        const cam = this.cameras.main
        gameEventBus.emitAimMove({
          worldX: cam.scrollX + this.mouseScreen.x,
          worldY: (cam.scrollY + this.mouseScreen.y) / ISO_Y,
          active: true,
        })
      }
    }

    const wv = this.cameras.main.worldView
    const cullPad = 280
    this.camLeft = wv.x - cullPad
    this.camRight = wv.x + (wv.width || this.cameras.main.width) + cullPad
    this.camTop = wv.y - cullPad
    this.camBottom = wv.y + (wv.height || this.cameras.main.height) + cullPad

    for (const actor of this.actors.values()) {
      const p = actor.state
      if (p.alive) {
        const moving = p.dx !== 0 || p.dy !== 0
        actor.bobPhase += dt * (moving ? 12 : 3.5)
        if (moving && !p.stunned) {
          const mag = Math.hypot(p.dx, p.dy)
          const nx = mag > 1 ? p.dx / mag : p.dx
          const ny = mag > 1 ? p.dy / mag : p.dy
          const spd = this.mapCfg.moveSpeed * (p.godspeed ? 1.75 : 1)
          p.x = clamp(p.x + nx * spd * dt, this.mapCfg.playerRadius, this.mapCfg.width - this.mapCfg.playerRadius)
          p.y = clamp(p.y + ny * spd * dt, this.mapCfg.playerRadius, this.mapCfg.height - this.mapCfg.playerRadius)
        }
      }

      actor.renderX += (p.x - actor.renderX) * alpha
      actor.renderY += (p.y - actor.renderY) * alpha

      const py = actor.renderY * ISO_Y
      actor.container.setPosition(actor.renderX, py)
      actor.container.setDepth(py)

      const onScreen =
        actor.renderX >= this.camLeft &&
        actor.renderX <= this.camRight &&
        py >= this.camTop &&
        py <= this.camBottom
      if (actor.container.visible !== onScreen) {
        actor.container.setVisible(onScreen)
      }
      if (onScreen) {
        this.drawActor25D(actor, time)
      }
    }

    this.drawZones25D(dt, time)
    this.drawProjectilesAndBeams25D(dt)
    this.stepImpactParticles(dt)
    this.drawAimPreview25D(me)
    this.minimapAccum += dt
    if (this.minimapAccum >= 0.042 || !this.minimapBgKey) {
      this.minimapAccum = 0
      this.drawMinimap()
    }
    if (!this.hasEmittedReady && this.actors.size > 0) {
      this.hasEmittedReady = true
      gameEventBus.emitSceneReady()
    }
  }

  /**
   * Renders recognizable anime character silhouettes (Zoro's 3 Katanas & green hair,
   * Killua's spiky white hair & lightning, Gilgamesh's golden portals, Itachi's Akatsuki cloak, etc.)
   */
  private drawActor25D(actor: ActorView, time: number): void {
    const p = actor.state
    const g = actor.bodyGfx
    g.clear()

    if (!p.alive) {
      actor.hpFill.setVisible(false)
      const deadLabel = `💀 ${p.name}`
      if (actor.lastNameLabel !== deadLabel) {
        actor.lastNameLabel = deadLabel
        actor.nameText.setText(deadLabel)
      }
      g.fillStyle(0x000000, 0.35)
      g.fillEllipse(0, 0, 28, 18)
      return
    }

    actor.hpFill.setVisible(true)
    const isMe = p.id === this.myPlayerId
    const nextLabel = p.invulnerable
      ? `🛡️อมตะ ${p.name}`
      : p.stunned
        ? `⚡STUN ${p.name}`
        : isMe
          ? `${p.name} (คุณ)`
          : `${p.name} • ${p.characterName}`
    if (actor.lastNameLabel !== nextLabel) {
      actor.lastNameLabel = nextLabel
      actor.nameText.setText(nextLabel)
    }

    const hpRatio = clamp(p.hp / Math.max(1, p.maxHp), 0, 1)
    const nextHpWidth = 50 * hpRatio
    const nextHpColor = hpRatio > 0.5 ? 0x34c759 : hpRatio > 0.25 ? 0xff9500 : 0xff3b30
    if (actor.lastHpWidth !== nextHpWidth) {
      actor.lastHpWidth = nextHpWidth
      actor.hpFill.width = nextHpWidth
    }
    if (actor.lastHpColor !== nextHpColor) {
      actor.lastHpColor = nextHpColor
      actor.hpFill.fillColor = nextHpColor
    }

    const col = hexToNum(p.color)
    const acc = hexToNum(p.accentColor)
    const leapProgress = this.leapingProgress.get(p.id)
    const jumpLift =
      leapProgress !== undefined ? Math.sin(clamp(leapProgress / 0.56, 0, 1) * Math.PI) * 82 : 0
    const rawBob = Math.sin(actor.bobPhase) * ((p.dx !== 0 || p.dy !== 0) ? 2.5 : 1.2)
    const bob = p.seated ? 6 : rawBob - jumpLift

    if (actor.lastJumpLift !== jumpLift) {
      actor.lastJumpLift = jumpLift
      actor.hpBg.setY(-64 - jumpLift)
      actor.hpFill.setY(-64 - jumpLift)
      actor.nameText.setY(-80 - jumpLift)
    }

    // Ground 2.5D Shadow (shrinks subtly while jumping)
    g.fillStyle(0x000000, 0.48 - clamp(jumpLift / 220, 0, 0.22))
    g.fillEllipse(0, 4, 40 - jumpLift * 0.2, 24 - jumpLift * 0.12)

    // Dedicated Armored Training Dummy 2.5D Prop Sprite
    if (p.isDummy) {
      g.lineStyle(2.5, acc, 0.9)
      g.strokeEllipse(0, 2, 54, 34)
      // Heavy timber base & stand post
      g.fillStyle(0x451a03, 1)
      g.fillEllipse(0, 2, 34, 18)
      g.fillStyle(0x78350f, 1)
      g.fillRect(-5, -18, 10, 20)
      // Armored barrel chest + crimson bullseye target rings
      g.fillStyle(0x92400e, 1)
      g.fillRoundedRect(-17, -42, 34, 30, 8)
      g.lineStyle(2.5, col, 0.95)
      g.strokeRoundedRect(-17, -42, 34, 30, 8)
      // Shoulder training arms
      g.fillStyle(0xb45309, 1)
      g.fillRect(-25, -36, 9, 6)
      g.fillRect(16, -36, 9, 6)
      // Target bullseye front
      g.fillStyle(0xffffff, 0.96)
      g.fillCircle(0, -27, 9)
      g.fillStyle(0xdc2626, 1)
      g.fillCircle(0, -27, 6)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(0, -27, 3)
      // Dummy helmet head
      g.fillStyle(0xd97706, 1)
      g.fillCircle(0, -51, 11)
      g.lineStyle(2, 0xfef08a, 0.95)
      g.strokeCircle(0, -51, 11)
      return
    }

    // Floor Status Ring (Invulnerable Shield, Godspeed, Slowed, Stunned, Self)
    if (p.invulnerable) {
      g.fillStyle(0xfef08a, 0.16)
      g.fillEllipse(0, -18 + bob, 66, 76)
      g.lineStyle(3.5, 0xfacc15, 0.96)
      g.strokeEllipse(0, -18 + bob, 66, 76)
      g.lineStyle(2, 0xffffff, 0.92)
      g.strokeEllipse(0, 2, 62, 38)
    } else if (p.godspeed) {
      g.lineStyle(3, 0x22d3ee, 0.92)
      g.strokeEllipse(0, 2, 56, 36)
    } else if (p.stunned) {
      g.lineStyle(3, 0xfacc15, 0.95)
      g.strokeEllipse(0, 2, 52, 34)
    } else if (p.slowed) {
      g.lineStyle(3, 0xa855f7, 0.88)
      g.strokeEllipse(0, 2, 54, 34)
    } else if (isMe) {
      g.lineStyle(2, 0xffffff, 0.65)
      g.strokeEllipse(0, 2, 50, 32)
    }

    // Fast-Attack Golden Super Saiyan Fists Aura (Goku Skill 2 buff)
    if (p.fastAttack) {
      const fPulse = Math.sin(time * 0.03) * 4
      g.lineStyle(2.5, 0xfacc15, 0.92)
      g.strokeCircle(-17, -18 + bob + fPulse, 9)
      g.strokeCircle(17, -18 + bob - fPulse, 9)
    }

    // Back-layer Iconic Weapons / Portals / Cloaks / Sukuna Malevolent Bone Throne
    if (p.characterId === 'ajarn_boy' && p.seated) {
      // Sukuna Seated on His Iconic Malevolent Bone & Crimson Shrine Throne!
      g.fillStyle(0x450a0a, 1)
      g.fillRoundedRect(-24, -46 + bob, 48, 48, 8)
      g.lineStyle(2.5, 0xdc2626, 0.95)
      g.strokeRoundedRect(-24, -46 + bob, 48, 48, 8)
      g.fillStyle(0xe2e8f0, 0.95)
      g.fillTriangle(-24, -42 + bob, -34, -56 + bob, -18, -48 + bob)
      g.fillTriangle(24, -42 + bob, 34, -56 + bob, 18, -48 + bob)
      g.fillCircle(-18, -32 + bob, 4.5)
      g.fillCircle(18, -32 + bob, 4.5)
      g.fillStyle(0x7f1d1d, 1)
      g.fillRect(-20, -10 + bob, 40, 10)
    }
    if (p.characterId === 'pa') {
      // Gilgamesh: Golden Gate of Babylon portals behind shoulders (blazes bright & expands during E Overdrive!)
      const pulse = Math.sin(time * 0.008) * 2
      if (p.fastAttack) {
        const beamPulse = 0.78 + Math.sin(time * 0.02) * 0.22
        const coords: Array<[number, number, number]> = [
          [-26, -24 + bob + pulse, 16],
          [26, -24 + bob - pulse, 16],
          [-18, -42 + bob - pulse, 19],
          [18, -42 + bob + pulse, 19],
          [0, -49 + bob + pulse * 0.6, 21],
        ]
        for (const [gx, gy, gr] of coords) {
          g.fillStyle(0xf59e0b, 0.38 * beamPulse)
          g.fillCircle(gx, gy, gr * 1.45)
          g.fillStyle(0xfacc15, 0.92 * beamPulse)
          g.fillEllipse(gx, gy, gr * 0.85, gr * 1.35)
          g.lineStyle(2.5, 0xffffff, 0.95 * beamPulse)
          g.strokeEllipse(gx, gy, gr * 0.85, gr * 1.35)
        }
      } else {
        g.fillStyle(0xfacc15, 0.85)
        g.fillEllipse(-21, -30 + bob + pulse, 10, 18)
        g.fillEllipse(21, -30 + bob - pulse, 10, 18)
        g.lineStyle(2, 0xfef08a, 1)
        g.lineBetween(-21, -30 + bob + pulse, -30, -35 + bob)
        g.lineBetween(21, -30 + bob - pulse, 30, -35 + bob)
      }
    } else if (p.characterId === 'thanwa') {
      // Zoro (ธันวา): King-of-Hell Emerald & Enma Purple Haki Aura + 3 Iconic Gleaming Katanas
      const spin = time * 0.0036
      g.lineStyle(2.5, 0x10b981, 0.65)
      g.strokeEllipse(0, 2, 62, 38)
      g.lineStyle(1.8, 0xa855f7, 0.52)
      g.strokeEllipse(0, 2, 72, 44)
      for (let w = 0; w < 3; w++) {
        const wa = spin + (w * Math.PI * 2) / 3
        const wx = Math.cos(wa) * 32
        const wy = -16 + bob + Math.sin(wa) * 14 * ISO_Y
        g.fillStyle(w === 1 ? 0xc084fc : 0x34d399, 0.9)
        g.fillCircle(wx, wy, 3.2)
      }

      // Three Legendary Katanas (Wado Ichimonji, Enma blazing violet, Sandai Kitetsu crimson)
      g.lineStyle(4, 0xf8fafc, 1)
      g.lineBetween(-28, -5 + bob, 26, -39 + bob)
      g.lineStyle(5, 0x7e22ce, 0.55)
      g.lineBetween(-28, -14 + bob, 28, -28 + bob)
      g.lineStyle(3, 0xd8b4fe, 1)
      g.lineBetween(-27, -14 + bob, 28, -28 + bob)
      g.lineStyle(3.5, 0xef4444, 1)
      g.lineBetween(-25, -24 + bob, 24, -14 + bob)

      // Flowing Dark Pirate Bandana Tails
      const flutter = Math.sin(time * 0.012) * 3
      g.fillStyle(0x0f172a, 0.95)
      g.fillTriangle(-10, -40 + bob, -26, -44 + bob + flutter, -22, -35 + bob)
      g.fillTriangle(-9, -38 + bob, -24, -33 + bob - flutter, -18, -28 + bob)

      // Haramaki Emerald Waist Sash
      g.fillStyle(0x059669, 1)
      g.fillRect(-15, -14 + bob, 30, 6)
      g.lineStyle(1.5, 0x6ee7b7, 0.9)
      g.strokeRect(-15, -14 + bob, 30, 6)
    } else if (p.characterId === 'ole') {
      // Itachi: High-collar Akatsuki Black Cloak with red cloud accents
      g.fillStyle(0x111827, 1)
      g.fillRoundedRect(-17, -30 + bob, 34, 30, 10)
      g.lineStyle(2, 0xdc2626, 0.95)
      g.strokeRoundedRect(-17, -30 + bob, 34, 30, 10)
      g.fillStyle(0xdc2626, 1)
      g.fillCircle(-8, -12 + bob, 3)
      g.fillCircle(8, -16 + bob, 3)
    } else if (p.characterId === 'boy') {
      // Goku: Bright Saiyan Orange Gi + Blue Sash + Aura flames
      g.fillStyle(0x0284c7, 0.9)
      g.fillRect(-15, -13 + bob, 30, 5)
    } else if (p.characterId === 'ajarn_au') {
      // Killua: Crackling electric cyan lightning arcs
      g.lineStyle(2, 0x67e8f9, 0.95)
      const jit = Math.sin(time * 0.045) * 6
      g.lineBetween(-22, -24 + bob, -10 + jit, -48 + bob)
      g.lineBetween(22, -22 + bob, 10 - jit, -46 + bob)
    } else if (p.characterId === 'kaem') {
      // Rimuru Tempest (แก้ม): Raphael Wisdom Orbit + Fur-Mantle Demon Lord Coat + Glowing Slime Companion
      const spin = time * 0.0034
      g.lineStyle(2, 0x38bdf8, 0.62)
      g.strokeEllipse(0, 2, 60, 36)
      g.lineStyle(1.6, 0xfacc15, 0.48)
      g.strokeEllipse(0, 2, 70, 42)

      // Orbiting Raphael runes + dark tempest coat aura
      for (let w = 0; w < 4; w++) {
        const wa = spin + (w * Math.PI) / 2
        const wx = Math.cos(wa) * 30
        const wy = -16 + bob + Math.sin(wa) * 12 * ISO_Y
        g.fillStyle(w % 2 === 0 ? 0x38bdf8 : 0xa855f7, 0.88)
        g.fillCircle(wx, wy, 2.8)
      }

      // Long silvery-sky-blue back hair flowing down behind coat
      g.fillStyle(0x7dd3fc, 0.96)
      g.fillRoundedRect(-17, -42 + bob, 34, 34, 12)
      g.lineStyle(1.5, 0xe0f2fe, 0.8)
      g.strokeRoundedRect(-17, -42 + bob, 34, 34, 12)

      // Demon Lord Obsidian Coat + Gold Trim + Dark Fur Mantle Collar
      g.fillStyle(0x0f172a, 1)
      g.fillRoundedRect(-16, -29 + bob, 32, 28, 10)
      g.lineStyle(2.2, 0xfacc15, 0.9)
      g.strokeRoundedRect(-16, -29 + bob, 32, 28, 10)
      g.fillStyle(0x1e293b, 1)
      g.fillEllipse(0, -27 + bob, 34, 11)
      g.lineStyle(1.8, 0x38bdf8, 0.85)
      g.strokeEllipse(0, -27 + bob, 34, 11)

      // Bouncing Translucent Blue Slime Companion perched right beside Rimuru
      const sb = Math.sin(time * 0.009) * 3.5
      const sx = 23
      const sy = -22 + bob + sb
      g.fillStyle(0x38bdf8, 0.34)
      g.fillEllipse(sx, sy, 22, 17)
      g.fillStyle(0x0ea5e9, 0.92)
      g.fillEllipse(sx, sy, 17, 13)
      g.lineStyle(1.5, 0xe0f2fe, 0.95)
      g.strokeEllipse(sx, sy, 17, 13)
      g.fillStyle(0xffffff, 0.85)
      g.fillCircle(sx - 3, sy - 3, 2.2)
      g.lineStyle(1.4, 0x0f172a, 0.95)
      g.lineBetween(sx - 4, sy, sx - 1.5, sy - 1)
      g.lineBetween(sx + 1.5, sy - 1, sx + 4, sy)
    } else if (p.characterId === 'frame') {
      // Frame (เฟรม): Joestar Indigo Trench Coat + Gold Chains + Floating Chubby Stand Cat "ไออ้วน"
      const spin = time * 0.004
      g.lineStyle(2.4, 0xa855f7, 0.72)
      g.strokeEllipse(0, 2, 64, 38)
      g.lineStyle(1.8, 0xfacc15, 0.65)
      g.strokeEllipse(0, 2, 74, 44)

      for (let w = 0; w < 4; w++) {
        const wa = spin + (w * Math.PI) / 2
        const wx = Math.cos(wa) * 33
        const wy = -14 + bob + Math.sin(wa) * 14 * ISO_Y
        g.fillStyle(w % 2 === 0 ? 0xfacc15 : 0xc084fc, 0.94)
        g.fillCircle(wx, wy, 3)
      }

      // Joestar Dark Indigo High-Collar Coat + Gold Collar Chain
      g.fillStyle(0x1e1b4b, 1)
      g.fillRoundedRect(-17, -30 + bob, 34, 29, 10)
      g.lineStyle(2.2, 0xfacc15, 0.94)
      g.strokeRoundedRect(-17, -30 + bob, 34, 29, 10)
      g.fillStyle(0x312e81, 1)
      g.fillTriangle(-14, -29 + bob, -18, -39 + bob, -6, -32 + bob)
      g.fillTriangle(14, -29 + bob, 18, -39 + bob, 6, -32 + bob)
      g.lineStyle(2.5, 0xfacc15, 0.95)
      g.lineBetween(-11, -22 + bob, 11, -16 + bob)

      // Stand Cat "ไออ้วน" (Ai-Ouan): Chubby Cosmic Violet Muscular Stand Cat floating over shoulder!
      const cb = Math.sin(time * 0.0085) * 4
      const cx = -25
      const cy = -36 + bob + cb
      // Radiant Magenta-Violet Stand Aura
      g.fillStyle(0xa855f7, 0.34)
      g.fillEllipse(cx, cy, 34, 30)
      // Stand Cat Ears
      g.fillStyle(0x9333ea, 1)
      g.fillTriangle(cx - 11, cy - 10, cx - 8, cy - 22, cx - 2, cy - 12)
      g.fillTriangle(cx + 11, cy - 10, cx + 8, cy - 22, cx + 2, cy - 12)
      // Plump Chubby Stand Cat Body & Belly
      g.fillStyle(0xa855f7, 0.95)
      g.fillEllipse(cx, cy, 26, 22)
      g.fillStyle(0xe9d5ff, 0.72)
      g.fillEllipse(cx + 1, cy + 4, 15, 11)
      g.lineStyle(1.8, 0xfacc15, 0.95)
      g.strokeEllipse(cx, cy, 26, 22)
      // Golden Joestar Star Collar & Glowing Eyes
      g.fillStyle(0xfacc15, 1)
      g.fillCircle(cx, cy + 2, 3.2)
      g.fillStyle(0xfef08a, 1)
      g.fillCircle(cx - 4.2, cy - 6, 2.2)
      g.fillCircle(cx + 4.2, cy - 6, 2.2)
      // Raised Stand Punching Paws
      g.fillStyle(0xc084fc, 1)
      g.fillCircle(cx + 12, cy - 2, 4.5)
      g.lineStyle(1.5, 0xfacc15, 1)
      g.strokeCircle(cx + 12, cy - 2, 4.5)
    } else if (p.characterId === 'luangphi_sorn') {
      // LuangPhi Sorn (Saitama Monk): Sacred Halo, Flowing White Cape, Saffron Robe & Crimson Boxing Gloves
      const spin = time * 0.0028
      g.lineStyle(3.2, 0xfef08a, 0.92)
      g.strokeCircle(0, -35 + bob, 22)
      g.lineStyle(1.8, 0xf59e0b, 0.72)
      g.strokeCircle(0, -35 + bob, 26)
      for (let r = 0; r < 4; r++) {
        const ra = spin + (r * Math.PI) / 2
        g.fillStyle(0xfef08a, 0.9)
        g.fillCircle(Math.cos(ra) * 24, -35 + bob + Math.sin(ra) * 24, 2.5)
      }
      // Fluttering White Hero Cape
      const wave = Math.sin(time * 0.009) * 5
      g.fillStyle(0xf8fafc, 0.94)
      g.fillTriangle(-24, -4 + wave, -12, -28 + bob, 10, -24 + bob)
      g.lineStyle(1.8, 0xcbd5e1, 0.9)
      g.strokeTriangle(-24, -4 + wave, -12, -28 + bob, 10, -24 + bob)
      // Saffron Monk Robe Torso
      g.fillStyle(0xf59e0b, 1)
      g.fillRoundedRect(-15, -28 + bob, 30, 27, 9)
      g.fillStyle(0xea580c, 0.92)
      g.fillTriangle(-14, -27 + bob, 14, -27 + bob, -10, -4 + bob)
      g.lineStyle(2, 0xfde047, 0.9)
      g.strokeRoundedRect(-15, -28 + bob, 30, 27, 9)
      // Red Saitama Punching Gloves
      g.fillStyle(0xdc2626, 1)
      g.fillCircle(-17, -11 + bob, 6.2)
      g.fillCircle(17, -11 + bob, 6.2)
      g.lineStyle(1.6, 0xfca5a5, 0.95)
      g.strokeCircle(-17, -11 + bob, 6.2)
      g.strokeCircle(17, -11 + bob, 6.2)
    } else if (p.characterId === 'sia_mon') {
      // Sia Mon (Gojo Satoru): Dark Indigo Jujutsu High Coat + Orbiting Limitless Red & Blue Energy
      const spin = time * 0.0042
      g.lineStyle(2.2, 0x38bdf8, 0.78)
      g.strokeEllipse(0, 2, 66, 38)
      g.lineStyle(1.6, 0xa855f7, 0.65)
      g.strokeEllipse(0, 2, 76, 44)
      // Orbiting Azure Blue & Crimson Red Limitless Motes
      g.fillStyle(0x38bdf8, 0.95)
      g.fillCircle(Math.cos(spin) * 33, -18 + bob + Math.sin(spin) * 14 * ISO_Y, 4.2)
      g.fillStyle(0xef4444, 0.95)
      g.fillCircle(Math.cos(spin + Math.PI) * 33, -18 + bob + Math.sin(spin + Math.PI) * 14 * ISO_Y, 4.2)
      // High-Collar Indigo Uniform + Gold Pin
      g.fillStyle(0x0f172a, 1)
      g.fillRoundedRect(-16, -30 + bob, 32, 29, 9)
      g.fillStyle(0x1e1b4b, 1)
      g.fillRoundedRect(-14, -33 + bob, 28, 10, 4)
      g.lineStyle(2, 0x38bdf8, 0.9)
      g.strokeRoundedRect(-16, -30 + bob, 32, 29, 9)
      g.fillStyle(0xfacc15, 1)
      g.fillCircle(8, -22 + bob, 2.4)
    } else if (p.characterId === 'ko') {
      // Ko (Agatsuma Zenitsu): Swirling Gold-White Thunder Aura, Black Slayer Uniform & Yellow White-Triangle Haori + Nichirin Katana
      const spin = time * 0.0055
      g.lineStyle(2.4, 0xfacc15, 0.82)
      g.strokeEllipse(0, 2, 66, 40)
      g.lineStyle(1.8, 0x7dd3fc, 0.65)
      g.strokeEllipse(0, 2, 76, 46)
      for (let w = 0; w < 4; w++) {
        const wa = spin + (w * Math.PI) / 2
        const wx = Math.cos(wa) * 33
        const wy = -16 + bob + Math.sin(wa) * 14 * ISO_Y
        g.fillStyle(w % 2 === 0 ? 0xfef08a : 0x7dd3fc, 0.96)
        g.fillCircle(wx, wy, 3.1)
      }
      // Drawn Golden-Edged Nichirin Katana across Torso
      g.lineStyle(4.2, 0xf8fafc, 1)
      g.lineBetween(-26, -4 + bob, 28, -32 + bob)
      g.lineStyle(2.2, 0xfacc15, 0.98)
      g.lineBetween(-25, -4 + bob, 28, -32 + bob)
      // Golden Haori with Crisp White Triangles
      g.fillStyle(0x0f172a, 1)
      g.fillRoundedRect(-15, -29 + bob, 30, 28, 9)
      g.fillStyle(0xf59e0b, 1)
      g.fillTriangle(-17, -2 + bob, -15, -28 + bob, -3, -2 + bob)
      g.fillTriangle(17, -2 + bob, 15, -28 + bob, 3, -2 + bob)
      g.fillStyle(0xffffff, 0.95)
      g.fillTriangle(-12, -8 + bob, -15, -14 + bob, -8, -14 + bob)
      g.fillTriangle(12, -8 + bob, 15, -14 + bob, 8, -14 + bob)
      g.lineStyle(2, 0xfef08a, 0.92)
      g.strokeRoundedRect(-16, -29 + bob, 32, 28, 9)
    }

    if (p.characterId === 'noone') {
      // Thanos (noone): Broad Sanctuary II Golden-Purple Titan Armor + Live 5-Stone Infinity Gauntlet
      const owned = p.infinityStones ?? []
      if (owned.length >= 5) {
        const spin = time * 0.005
        const gemCols = [0xa855f7, 0x3b82f6, 0xef4444, 0x10b981, 0xfacc15]
        for (let i = 0; i < 5; i++) {
          const ga = spin + (i * Math.PI * 2) / 5
          const gx = Math.cos(ga) * 32
          const gy = -20 + bob + Math.sin(ga) * 14 * ISO_Y
          g.fillStyle(gemCols[i], 0.96)
          g.fillCircle(gx, gy, 3.8)
          g.lineStyle(1.4, 0xffffff, 0.9)
          g.strokeCircle(gx, gy, 3.8)
        }
      }
      // Broad Cosmic Titan Torso + Golden Breastplate & Pauldrons
      g.fillStyle(0x1e1b4b, 1)
      g.fillRoundedRect(-18, -31 + bob, 36, 30, 10)
      g.fillStyle(0xf59e0b, 1)
      g.fillTriangle(-20, -28 + bob, -10, -32 + bob, -12, -16 + bob)
      g.fillTriangle(20, -28 + bob, 10, -32 + bob, 12, -16 + bob)
      g.fillStyle(0xfacc15, 0.96)
      g.fillRoundedRect(-11, -27 + bob, 22, 20, 6)
      g.lineStyle(2, 0xfef08a, 0.95)
      g.strokeRoundedRect(-17, -31 + bob, 34, 30, 10)

      // Oversized Golden Left Infinity Gauntlet with Dynamically Lit Infinity Stones!
      g.fillStyle(0xf59e0b, 1)
      g.fillRoundedRect(-25, -24 + bob, 11, 16, 4)
      g.lineStyle(1.8, 0xfef9c3, 1)
      g.strokeRoundedRect(-25, -24 + bob, 11, 16, 4)
      const gemPalette: Array<{ slot: number; col: number; ox: number; oy: number }> = [
        { slot: 1, col: 0xa855f7, ox: -23, oy: -21 },
        { slot: 2, col: 0x3b82f6, ox: -20, oy: -22 },
        { slot: 3, col: 0xef4444, ox: -17, oy: -21 },
        { slot: 4, col: 0x10b981, ox: -22, oy: -14 },
        { slot: 5, col: 0xfef08a, ox: -18, oy: -14 },
      ]
      for (const gm of gemPalette) {
        const hasStone = owned.includes(gm.slot)
        g.fillStyle(hasStone ? gm.col : 0x334155, hasStone ? 1 : 0.55)
        g.fillCircle(gm.ox, gm.oy + bob, hasStone ? 2.5 : 1.7)
      }
    }

    // Upright Torso (unless custom cloak hero already drew torso)
    if (
      p.characterId !== 'ole' &&
      p.characterId !== 'kaem' &&
      p.characterId !== 'frame' &&
      p.characterId !== 'luangphi_sorn' &&
      p.characterId !== 'sia_mon' &&
      p.characterId !== 'ko' &&
      p.characterId !== 'noone'
    ) {
      g.fillStyle(col, 1)
      g.fillRoundedRect(-14, -28 + bob, 28, 26, 10)
      g.lineStyle(2, acc, 0.85)
      g.strokeRoundedRect(-14, -28 + bob, 28, 26, 10)
    }

    // Head Base (purple Titan skin for noone, skin tone for anime heroes, slate for default)
    const faceCol =
      p.characterId === 'default' ? col : p.characterId === 'noone' ? 0x9333ea : 0xfde6cd
    g.fillStyle(faceCol, 1)
    g.fillCircle(0, -35 + bob, 13.5)
    g.lineStyle(isMe ? 2.5 : 1.8, isMe ? 0xffffff : acc, 0.95)
    g.strokeCircle(0, -35 + bob, 13.5)

    // Iconic Anime Hair / Headgear Silhouette
    if (p.characterId === 'thanwa') {
      // Zoro: Spiky emerald hair + King-of-Hell Dark Bandana headband
      g.fillStyle(0x10b981, 1)
      g.fillTriangle(-14, -38 + bob, -6, -55 + bob, 2, -44 + bob)
      g.fillTriangle(-4, -44 + bob, 4, -57 + bob, 10, -42 + bob)
      g.fillTriangle(4, -42 + bob, 14, -53 + bob, 14, -36 + bob)
      g.fillStyle(0x111827, 0.96)
      g.fillRect(-13, -44 + bob, 26, 5)
      g.lineStyle(1.5, 0x6ee7b7, 0.85)
      g.lineBetween(-13, -44 + bob, 13, -44 + bob)
    } else if (p.characterId === 'ajarn_au') {
      // Killua: Fluffy spiky silver-white hair
      g.fillStyle(0xf8fafc, 1)
      g.fillTriangle(-15, -36 + bob, -12, -55 + bob, -2, -45 + bob)
      g.fillTriangle(-6, -45 + bob, 0, -58 + bob, 6, -45 + bob)
      g.fillTriangle(2, -45 + bob, 13, -55 + bob, 15, -36 + bob)
    } else if (p.characterId === 'pa') {
      // Gilgamesh: Swept-up spiky golden hair
      g.fillStyle(0xfacc15, 1)
      g.fillTriangle(-12, -40 + bob, -10, -56 + bob, 0, -46 + bob)
      g.fillTriangle(-3, -46 + bob, 5, -58 + bob, 11, -43 + bob)
      g.fillTriangle(6, -42 + bob, 15, -52 + bob, 13, -38 + bob)
    } else if (p.characterId === 'boy') {
      // Goku: Iconic wild black spiky Saiyan hair
      g.fillStyle(0x111827, 1)
      g.fillTriangle(-15, -38 + bob, -18, -55 + bob, -4, -46 + bob)
      g.fillTriangle(-6, -46 + bob, 0, -60 + bob, 6, -46 + bob)
      g.fillTriangle(4, -46 + bob, 18, -55 + bob, 15, -38 + bob)
    } else if (p.characterId === 'ole') {
      // Itachi: Dark hair + Leaf headband
      g.fillStyle(0x111827, 1)
      g.fillEllipse(0, -45 + bob, 26, 14)
      g.fillStyle(0x94a3b8, 1)
      g.fillRect(-12, -44 + bob, 24, 5)
    } else if (p.characterId === 'ajarn_boy') {
      // Sukuna: Spiky pink hair + dark curse forehead mark
      g.fillStyle(0xfb7185, 1)
      g.fillTriangle(-13, -40 + bob, -8, -55 + bob, 0, -46 + bob)
      g.fillTriangle(-2, -46 + bob, 6, -56 + bob, 13, -40 + bob)
      g.lineStyle(2, 0x111827, 1)
      g.lineBetween(-5, -39 + bob, 5, -39 + bob)
    } else if (p.characterId === 'kaem') {
      // Rimuru: Iconic soft silvery-sky-blue front bangs & crown
      g.fillStyle(0xbae6fd, 1)
      g.fillEllipse(0, -43 + bob, 28, 15)
      g.fillTriangle(-14, -40 + bob, -9, -22 + bob, -5, -36 + bob)
      g.fillTriangle(14, -40 + bob, 9, -22 + bob, 5, -36 + bob)
      g.fillTriangle(-4, -45 + bob, 0, -34 + bob, 4, -45 + bob)
      g.lineStyle(1.5, 0x38bdf8, 0.9)
      g.strokeEllipse(0, -43 + bob, 28, 15)
    } else if (p.characterId === 'frame') {
      // Frame (Joestar): Bold Swept Dark Indigo Hair + Golden Visor Glint
      g.fillStyle(0x0f172a, 1)
      g.fillTriangle(-15, -39 + bob, -11, -55 + bob, -1, -46 + bob)
      g.fillTriangle(-4, -46 + bob, 3, -57 + bob, 11, -45 + bob)
      g.fillTriangle(5, -45 + bob, 16, -52 + bob, 14, -37 + bob)
      g.lineStyle(1.6, 0xfacc15, 0.85)
      g.lineBetween(-11, -44 + bob, 11, -44 + bob)
    } else if (p.characterId === 'luangphi_sorn') {
      // Bald shiny Saitama Monk dome highlight!
      g.fillStyle(0xffffff, 0.88)
      g.fillEllipse(-4.5, -42 + bob, 5.5, 3.2)
    } else if (p.characterId === 'sia_mon') {
      // Gojo: Tall spiky snow-white hair + Black Blindfold + glowing Six Eyes cyan gleam
      g.fillStyle(0xf8fafc, 1)
      g.fillTriangle(-15, -37 + bob, -13, -57 + bob, -2, -46 + bob)
      g.fillTriangle(-6, -45 + bob, 0, -61 + bob, 7, -45 + bob)
      g.fillTriangle(2, -46 + bob, 14, -56 + bob, 15, -36 + bob)
      g.fillStyle(0x020617, 0.98)
      g.fillRoundedRect(-14, -39 + bob, 28, 7.5, 3)
      g.lineStyle(1.6, 0x38bdf8, 0.9)
      g.lineBetween(-13, -39 + bob, 13, -39 + bob)
    } else if (p.characterId === 'ko') {
      // Zenitsu (โก้): Golden Yellow Hair with Orange Sunset Tips & Front Bangs
      g.fillStyle(0xf59e0b, 1)
      g.fillTriangle(-15, -36 + bob, -14, -54 + bob, -3, -44 + bob)
      g.fillTriangle(-6, -44 + bob, 1, -57 + bob, 8, -44 + bob)
      g.fillTriangle(3, -44 + bob, 15, -53 + bob, 15, -36 + bob)
      g.fillStyle(0xfef08a, 0.96)
      g.fillEllipse(0, -45 + bob, 22, 10)
    } else if (p.characterId === 'noone') {
      // Thanos (noone): Golden Mad Titan War Helmet Crest
      g.fillStyle(0xfacc15, 1)
      g.fillRoundedRect(-15, -49 + bob, 30, 12, 4)
      g.fillTriangle(-15, -39 + bob, -12, -52 + bob, 0, -40 + bob)
      g.fillTriangle(15, -39 + bob, 12, -52 + bob, 0, -40 + bob)
      g.fillStyle(0x38bdf8, 0.96)
      g.fillCircle(0, -45 + bob, 3.0)
      g.lineStyle(1.6, 0xfef9c3, 0.9)
      g.strokeRoundedRect(-15, -49 + bob, 30, 12, 4)
    }

    // Directional Eyes
    const ex = Math.cos(actor.facingAngle) * 4.5
    const ey = Math.sin(actor.facingAngle) * 2.5 - 33 + bob
    g.fillStyle(
      p.characterId === 'ole'
        ? 0xef4444
        : p.characterId === 'kaem' || p.characterId === 'noone'
          ? 0xfacc15
          : p.characterId === 'sia_mon'
            ? 0x38bdf8
            : 0xffffff,
      1,
    )
    g.fillCircle(ex - 4.2, ey, 3.0)
    g.fillCircle(ex + 4.2, ey, 3.0)
    g.fillStyle(p.characterId === 'sia_mon' ? 0x0ea5e9 : 0x1d1d1f, 1)
    g.fillCircle(ex * 1.15 - 4.2, ey + 0.4, 1.5)
    g.fillCircle(ex * 1.15 + 4.2, ey + 0.4, 1.5)

    // Cosmic Infinite Void Lockdown Halo around Trapped Victim
    if (p.inVoid) {
      const spinVoid = time * 0.012
      g.lineStyle(3, 0x38bdf8, 0.95)
      g.strokeEllipse(0, -18 + bob, 50, 22)
      g.lineStyle(2.4, 0xa855f7, 0.9)
      g.strokeEllipse(0, -18 + bob, 36, 44)
      for (let v = 0; v < 3; v++) {
        const va = spinVoid + (v * Math.PI * 2) / 3
        g.fillStyle(0xe0f2fe, 0.95)
        g.fillCircle(Math.cos(va) * 24, -18 + bob + Math.sin(va) * 10, 2.6)
      }
    }
  }

  private drawKatanaGlintStar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    size: number,
    outerCol: number,
    alpha: number,
  ): void {
    if (alpha <= 0.04) return
    g.fillStyle(outerCol, alpha * 0.72)
    g.fillTriangle(x - size, y, x, y - size * 0.28, x + size, y)
    g.fillTriangle(x - size, y, x, y + size * 0.28, x + size, y)
    g.fillTriangle(x, y - size * 0.85, x - size * 0.24, y, x, y + size * 0.85)
    g.fillTriangle(x, y - size * 0.85, x + size * 0.24, y, x, y + size * 0.85)
    g.fillStyle(0xffffff, alpha)
    g.fillCircle(x, y, Math.max(2.5, size * 0.16))
  }

  private drawZones25D(dt: number, time: number): void {
    const g = this.zoneGfx
    g.clear()

    for (const z of this.zones) {
      z.life = Math.max(0, z.life - dt)
      if ((z.delayLeft ?? 0) > 0) {
        z.delayLeft = Math.max(0, (z.delayLeft ?? 0) - dt)
      }
      const ratio = clamp(z.life / Math.max(0.05, z.maxLife), 0, 1)
      const zx = z.x
      const zy = z.y * ISO_Y
      const col = hexToNum(z.color)
      const acc = hexToNum(z.accentColor)

      if (!this.seenEffects.has(z.id)) {
        this.seenEffects.add(z.id)
        if ((z.delayLeft ?? 0) <= 0) {
          soundEngine.playEffectSound(z.kind)
        } else if (z.kind === 'sanzen_sekai') {
          soundEngine.playEffectSound('sanzen_sekai_windup')
        } else if (z.kind === 'beelzebuth') {
          soundEngine.playEffectSound('beelzebuth_windup')
        } else if (z.kind === 'black_lightning') {
          soundEngine.playEffectSound('black_lightning')
        } else if (z.kind === 'aiouan_timestop') {
          soundEngine.playEffectSound('aiouan_timestop_windup')
        } else if (z.kind === 'zenitsu_honoo_no_kami') {
          soundEngine.playEffectSound('zenitsu_honoo_windup')
        }
        if (z.kind === 'fuga_explosion') {
          this.spawnImpactParticles(zx, zy, acc, 14)
          this.cameras.main.shake(140, 0.004)
        } else if (z.kind === 'aiouan_pounce_seal') {
          this.spawnImpactParticles(zx, zy, 0xa855f7, 10)
          this.spawnImpactParticles(zx, zy, 0xfacc15, 8)
          this.cameras.main.shake(115, 0.0035)
        } else if (z.kind === 'tsukuyomi' || z.kind === 'malevolent_shrine') {
          this.spawnImpactParticles(zx, zy, acc, 10)
        } else if (z.kind === 'saitama_crater') {
          this.spawnImpactParticles(zx, zy, 0xdc2626, 18)
          this.spawnImpactParticles(zx, zy, 0xfacc15, 14)
          this.cameras.main.shake(240, 0.0085)
        } else if (z.kind === 'hollow_purple') {
          this.spawnImpactParticles(zx, zy, 0xa855f7, 22)
          this.spawnImpactParticles(zx, zy, 0xf0abfc, 16)
          this.cameras.main.shake(260, 0.0082)
        } else if (z.kind === 'infinite_void') {
          this.spawnImpactParticles(zx, zy, 0x38bdf8, 16)
          this.spawnImpactParticles(zx, zy, 0xa855f7, 12)
          this.cameras.main.shake(175, 0.0052)
        }
      }

      if (
        zx + z.radius < this.camLeft ||
        zx - z.radius > this.camRight ||
        zy + z.radius < this.camTop ||
        zy - z.radius > this.camBottom
      ) {
        continue
      }

      // Telegraphed Delayed Strike / Vortex Windup (Narukami sky reticle, Thunder Slam target, Sanzen Sekai pull)
      if ((z.delayLeft ?? 0) > 0 && (z.maxDelay ?? 0) > 0) {
        const progress = 1 - (z.delayLeft ?? 0) / Math.max(0.05, z.maxDelay ?? 0.5)
        if (z.kind === 'sanzen_sekai') {
          // Zoro Sanzen Sekai Phase 1: Rotating King-of-Hell Triad Seal & 6 Spectral Swirling Katanas
          g.fillStyle(0x022c22, 0.3 + progress * 0.25)
          g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(3.5, 0x10b981, 0.9)
          g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(3, 0xa855f7, 0.85)
          g.strokeEllipse(zx, zy, z.radius * 1.48 * (1 - progress * 0.35), z.radius * 1.48 * (1 - progress * 0.35) * ISO_Y)
          g.lineStyle(2.5, 0xffffff, 0.95)
          g.strokeEllipse(zx, zy, z.radius * (0.35 + progress * 0.45), z.radius * (0.35 + progress * 0.45) * ISO_Y)

          // Rotating Triad Magic Circle + Inward Spectral Katanas
          const rotBase = time * 0.016
          for (let i = 0; i < 6; i++) {
            const ang = rotBase + (i * Math.PI) / 3
            const r = z.radius * (1.02 - progress * 0.52)
            const ox = zx + Math.cos(ang) * r
            const oy = zy + Math.sin(ang) * r * ISO_Y
            const ix = zx + Math.cos(ang + 0.42) * r * 0.34
            const iy = zy + Math.sin(ang + 0.42) * r * 0.34 * ISO_Y
            g.lineStyle(5, i % 2 === 0 ? 0x10b981 : 0xa855f7, 0.82)
            g.lineBetween(ox, oy, ix, iy)
            g.lineStyle(2, 0xffffff, 0.95)
            g.lineBetween(ox, oy, ix, iy)
          }
          continue
        }

        if (z.kind === 'black_lightning') {
          // Rimuru Q Windup: Raphael Octagonal Summoning Seal & Obsidian Storm Cloud Shadow
          g.fillStyle(0x020617, 0.36 + progress * 0.22)
          g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(3.2, 0x38bdf8, 0.92)
          g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(2.6, 0xa855f7, 0.85)
          g.strokeEllipse(zx, zy, z.radius * 1.45 * (1 - progress * 0.35), z.radius * 1.45 * (1 - progress * 0.35) * ISO_Y)
          g.lineStyle(2, 0xfacc15, 0.9)
          const sealRot = time * 0.012
          for (let s = 0; s < 4; s++) {
            const ang = sealRot + (s * Math.PI) / 4
            g.lineBetween(
              zx + Math.cos(ang) * z.radius * 0.86,
              zy + Math.sin(ang) * z.radius * 0.86 * ISO_Y,
              zx - Math.cos(ang) * z.radius * 0.86,
              zy - Math.sin(ang) * z.radius * 0.86 * ISO_Y,
            )
          }
          continue
        }

        if (z.kind === 'beelzebuth') {
          // Rimuru R Phase 1: Abyssal Gluttony Gravity Well Seal
          g.fillStyle(0x020617, 0.44 + progress * 0.28)
          g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(3.5, 0xa855f7, 0.92)
          g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(2.5, 0x38bdf8, 0.9)
          g.strokeEllipse(zx, zy, z.radius * (1.6 - progress * 0.85), z.radius * (1.6 - progress * 0.85) * ISO_Y)
          g.fillStyle(0x0f172a, 0.95)
          g.fillEllipse(zx, zy, 34 * (0.5 + progress * 0.8), 34 * ISO_Y * (0.5 + progress * 0.8))
          continue
        }

        if (z.kind === 'zenitsu_honoo_no_kami') {
          // Zenitsu R Phase 1: Initial 5-Point Star Vertex Sparks (NO circle!)
          const baseAng = z.aimAngle ?? 0
          for (let k = 0; k < 5; k++) {
            const ang = baseAng + (k * Math.PI * 2) / 5
            const vx = zx + Math.cos(ang) * z.radius
            const vy = zy + Math.sin(ang) * z.radius * ISO_Y
            this.drawKatanaGlintStar(g, vx, vy, 12 + progress * 10, 0xfacc15, 0.88)
          }
          continue
        }

        if (z.kind === 'aiouan_timestop') {
          // Frame R Phase 1: Inverted JoJo Time-Stop Golden Clock Seal Windup
          g.fillStyle(0x1e1b4b, 0.45 + progress * 0.25)
          g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(4, 0xfacc15, 0.94)
          g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(2.5, 0xa855f7, 0.9)
          g.strokeEllipse(zx, zy, z.radius * (1.7 - progress * 0.7), z.radius * (1.7 - progress * 0.7) * ISO_Y)
          const clkRot = -time * 0.015
          for (let h = 0; h < 8; h++) {
            const ha = clkRot + (h * Math.PI) / 4
            const r1 = z.radius * 0.76
            const r2 = z.radius * 0.94
            g.lineStyle(2.5, h % 2 === 0 ? 0xfacc15 : 0xc084fc, 0.92)
            g.lineBetween(
              zx + Math.cos(ha) * r1,
              zy + Math.sin(ha) * r1 * ISO_Y,
              zx + Math.cos(ha) * r2,
              zy + Math.sin(ha) * r2 * ISO_Y,
            )
          }
          continue
        }

        if (z.kind === 'narukami_step2') {
          // Killua Narukami Step 2 Telegraph: 6-pointed Cyan-Gold Hexagram Star Discharge
          g.fillStyle(0x0891b2, 0.34 + progress * 0.28)
          g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          g.lineStyle(3.5, 0xfef08a, 0.96)
          g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
          for (let h = 0; h < 6; h++) {
            const ang = (h * Math.PI) / 3
            g.lineStyle(2.5, 0x22d3ee, 0.92)
            g.lineBetween(
              zx,
              zy,
              zx + Math.cos(ang) * z.radius * (0.4 + progress * 0.7),
              zy + Math.sin(ang) * z.radius * (0.4 + progress * 0.7) * ISO_Y,
            )
          }
          continue
        }

        g.fillStyle(col, 0.18 + progress * 0.22)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3, acc, 0.92)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.strokeEllipse(zx, zy, z.radius * 2 * progress, z.radius * 2 * ISO_Y * progress)
        continue
      }

      if (z.kind === 'thunder_slam') {
        // Post-landing electric shockwave crater + radial lightning spokes
        g.fillStyle(col, 0.34 * ratio)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4, acc, 0.96 * ratio)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(2.5, 0xffffff, 0.85 * ratio)
        g.strokeEllipse(zx, zy, z.radius * (2 - ratio * 0.8), z.radius * (2 - ratio * 0.8) * ISO_Y)
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3 + 0.3
          this.drawJaggedBolt(
            g,
            zx,
            zy,
            zx + Math.cos(ang) * z.radius * 0.92,
            zy + Math.sin(ang) * z.radius * 0.92 * ISO_Y,
            col,
            acc,
            7,
            time,
          )
        }
      } else if (z.kind === 'sanzen_sekai') {
        // Zoro Sanzen Sekai Phase 2: Cataclysmic Three-Thousand-Worlds King of Hell Enma Detonation!
        const burstKey = `${z.id}_burst`
        if (!this.seenEffects.has(burstKey)) {
          this.seenEffects.add(burstKey)
          soundEngine.playEffectSound('sanzen_sekai')
          this.spawnImpactParticles(zx, zy, 0x34d399, 14)
          this.spawnImpactParticles(zx, zy, 0xc084fc, 10)
          this.cameras.main.shake(190, 0.0052)
        }

        const fade = clamp(ratio * 1.35, 0, 1)
        const expand = 1 - ratio * 0.25

        // Deep Emerald & Imperial Purple Domain Field
        g.fillStyle(0x064e3b, 0.38 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.fillStyle(0x581c87, 0.22 * fade)
        g.fillEllipse(zx, zy, z.radius * 1.45, z.radius * 1.45 * ISO_Y)

        // Triple Expanding Emerald & Jade Shockwave Ripples
        g.lineStyle(5.5, 0x10b981, 0.95 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2 * expand, z.radius * 2 * ISO_Y * expand)
        g.lineStyle(3.5, 0xa855f7, 0.85 * fade)
        g.strokeEllipse(zx, zy, z.radius * (1.35 + (1 - ratio) * 0.65), z.radius * (1.35 + (1 - ratio) * 0.65) * ISO_Y)
        g.lineStyle(2.5, 0xffffff, 0.9 * fade)
        g.strokeEllipse(zx, zy, z.radius * (0.7 + (1 - ratio) * 1.15), z.radius * (0.7 + (1 - ratio) * 1.15) * ISO_Y)

        // 6 Radiating Enma Conqueror's Haki Jagged Lightning Arcs
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3 + 0.18
          this.drawJaggedBolt(
            g,
            zx,
            zy - 8,
            zx + Math.cos(ang) * z.radius * 0.96,
            zy + Math.sin(ang) * z.radius * 0.96 * ISO_Y,
            i % 2 === 0 ? 0x10b981 : 0x9333ea,
            i % 2 === 0 ? 0xa7f3d0 : 0xffffff,
            9,
            time,
          )
        }

        // Titanic Three-Blade Ashura Tapered Katana Reality-Split Cross Cleaves + Rising Enma Haki Flames
        const slashAngles = [-0.52, 0.52, Math.PI * 0.5]
        for (const ang of slashAngles) {
          const rLen = z.radius * 0.94
          const x1 = zx - Math.cos(ang) * rLen
          const y1 = zy - Math.sin(ang) * rLen * ISO_Y
          const x2 = zx + Math.cos(ang) * rLen
          const y2 = zy + Math.sin(ang) * rLen * ISO_Y
          const px = -Math.sin(ang) * 14
          const py = Math.cos(ang) * 14 * ISO_Y
          // Pointed tapered diamond cleave (zero blunt bar ends!)
          g.fillStyle(0x0f172a, 0.82 * fade)
          g.fillTriangle(x1, y1, zx + px, zy + py, x2, y2)
          g.fillTriangle(x1, y1, zx - px, zy - py, x2, y2)
          g.lineStyle(5, 0xa855f7, 0.88 * fade)
          g.lineBetween(x1, y1, x2, y2)
          g.lineStyle(2.5, 0x10b981, 0.96 * fade)
          g.lineBetween(x1, y1, x2, y2)
          g.lineStyle(2, 0xffffff, fade)
          g.lineBetween(x1 * 0.85 + zx * 0.15, y1 * 0.85 + zy * 0.15, x2 * 0.85 + zx * 0.15, y2 * 0.85 + zy * 0.15)
        }

        // Orbiting King-of-Hell Emerald & Violet Haki Spirit Flames along Zone Perimeter
        for (let f = 0; f < 8; f++) {
          const fa = time * 0.006 + (f * Math.PI) / 4
          const fx = zx + Math.cos(fa) * z.radius * 0.84
          const fy = zy + Math.sin(fa) * z.radius * 0.84 * ISO_Y
          const fh = (22 + Math.sin(time * 0.024 + f) * 8) * fade
          g.fillStyle(f % 2 === 0 ? 0x10b981 : 0x9333ea, 0.86 * fade)
          g.fillTriangle(fx - 9, fy, fx, fy - fh, fx + 9, fy)
          g.fillStyle(0xa7f3d0, 0.82 * fade)
          g.fillTriangle(fx - 4, fy, fx, fy - fh * 0.65, fx + 4, fy)
        }

        // Giant Central Santoryu Diamond Star Flare
        this.drawKatanaGlintStar(g, zx, zy - 8, 52 * (0.6 + fade * 0.45), 0x34d399, fade)
      } else if (z.kind === 'zenitsu_honoo_no_kami') {
        // Zenitsu (โก้) Ultimate R: Pure 5-Point Sequential Star Slashes (NO Circle Ring!)
        const burstKey = `${z.id}_burst`
        if (!this.seenEffects.has(burstKey)) {
          this.seenEffects.add(burstKey)
          soundEngine.playEffectSound('zenitsu_honoo_no_kami')
          this.spawnImpactParticles(zx, zy, 0xfacc15, 14)
          this.spawnImpactParticles(zx, zy, 0x7dd3fc, 8)
          this.cameras.main.shake(145, 0.004)
        }

        const fade = clamp(ratio * 1.45, 0, 1)
        const baseAng = z.aimAngle ?? 0
        const activeSteps = Math.max(1, z.stepCount ?? 5)

        // Draw subtle faint golden guide star-frame vertices + bright diamond flares on reached star tips
        for (let step = 0; step < 5; step++) {
          const i1 = (step * 2) % 5
          const i2 = ((step + 1) * 2) % 5
          const a1 = baseAng + (i1 * Math.PI * 2) / 5
          const a2 = baseAng + (i2 * Math.PI * 2) / 5
          const x1 = zx + Math.cos(a1) * z.radius
          const y1 = zy + Math.sin(a1) * z.radius * ISO_Y
          const x2 = zx + Math.cos(a2) * z.radius
          const y2 = zy + Math.sin(a2) * z.radius * ISO_Y

          if (step < activeSteps) {
            // Slashed leg glow reinforcement
            g.lineStyle(2.2, 0xfef08a, 0.45 * fade)
            g.lineBetween(x1, y1, x2, y2)
            this.drawKatanaGlintStar(g, x2, y2, 16 * fade, 0x7dd3fc, fade)
          } else {
            // Faint preview line showing upcoming star sequence step
            g.lineStyle(1.4, 0xf59e0b, 0.28 * fade)
            g.lineBetween(x1, y1, x2, y2)
          }
          this.drawKatanaGlintStar(g, x1, y1, 10 * fade, 0xfacc15, 0.72 * fade)
        }
      } else if (z.kind === 'thanos_power_blast') {
        const burstKey = `${z.id}_burst`
        if (!this.seenEffects.has(burstKey)) {
          this.seenEffects.add(burstKey)
          soundEngine.playEffectSound('thanos_power_blast')
          this.spawnImpactParticles(zx, zy, 0xa855f7, 14)
          this.cameras.main.shake(140, 0.004)
        }
        const fade = clamp(ratio * 1.5, 0, 1)
        const expand = 1.15 - ratio * 0.45
        g.fillStyle(0x7e22ce, 0.45 * fade)
        g.fillEllipse(zx, zy, z.radius * 2 * expand, z.radius * 2 * ISO_Y * expand)
        g.lineStyle(5, 0xc084fc, fade)
        g.strokeEllipse(zx, zy, z.radius * 2 * expand, z.radius * 2 * ISO_Y * expand)
        g.lineStyle(3, 0xf3e8ff, fade)
        g.strokeEllipse(zx, zy, z.radius * 1.3 * expand, z.radius * 1.3 * ISO_Y * expand)
      } else if (z.kind === 'thanos_space_vortex') {
        const burstKey = `${z.id}_burst`
        if (!this.seenEffects.has(burstKey)) {
          this.seenEffects.add(burstKey)
          soundEngine.playEffectSound('thanos_space_vortex')
          this.spawnImpactParticles(zx, zy, 0x3b82f6, 12)
        }
        const fade = clamp(ratio * 1.5, 0, 1)
        const rot = time * 0.01
        g.fillStyle(0x1d4ed8, 0.36 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4, 0x38bdf8, 0.94 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        for (let k = 0; k < 6; k++) {
          const ang = rot + (k * Math.PI) / 3
          g.lineStyle(3, 0xbae6fd, 0.85 * fade)
          g.lineBetween(zx + Math.cos(ang) * z.radius * 0.9, zy + Math.sin(ang) * z.radius * 0.9 * ISO_Y, zx, zy)
        }
      } else if (z.kind === 'thanos_time_mandala') {
        const burstKey = `${z.id}_burst`
        if (!this.seenEffects.has(burstKey)) {
          this.seenEffects.add(burstKey)
          soundEngine.playEffectSound('thanos_time_mandala')
          this.spawnImpactParticles(zx, zy, 0x10b981, 14)
        }
        const fade = clamp(ratio * 1.4, 0, 1)
        const rot = time * 0.0045
        g.fillStyle(0x064e3b, 0.34 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4, 0x10b981, 0.96 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(2.5, 0xa7f3d0, 0.9 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.35, z.radius * 1.35 * ISO_Y)
        for (let r = 0; r < 4; r++) {
          const a1 = rot + (r * Math.PI) / 2
          const a2 = a1 + Math.PI / 2
          g.lineBetween(
            zx + Math.cos(a1) * z.radius * 0.86,
            zy + Math.sin(a1) * z.radius * 0.86 * ISO_Y,
            zx + Math.cos(a2) * z.radius * 0.86,
            zy + Math.sin(a2) * z.radius * 0.86 * ISO_Y,
          )
        }
      } else if (z.kind === 'thanos_infinity_snap') {
        const burstKey = `${z.id}_burst`
        if (!this.seenEffects.has(burstKey)) {
          this.seenEffects.add(burstKey)
          soundEngine.playEffectSound('thanos_infinity_snap')
          this.spawnImpactParticles(zx, zy, 0xfacc15, 22)
          this.spawnImpactParticles(zx, zy, 0xa855f7, 16)
          this.cameras.main.flash(380, 250, 204, 21)
          this.cameras.main.shake(260, 0.0085)
        }
        const fade = clamp(ratio * 1.35, 0, 1)
        const expand = 0.25 + (1 - ratio) * 1.45
        const cols = [0xa855f7, 0x3b82f6, 0xef4444, 0x10b981, 0xfacc15]
        for (let i = 0; i < cols.length; i++) {
          const rad = z.radius * expand * (0.55 + i * 0.14)
          g.lineStyle(5, cols[i], fade * 0.92)
          g.strokeEllipse(zx, zy, rad * 2, rad * 2 * ISO_Y)
        }
        this.drawKatanaGlintStar(g, zx, zy - 24, 68 * fade, 0xfef08a, fade)
      } else if (z.kind === 'beelzebuth') {
        // Rimuru R Phase 2: Beelzebuth — Lord of Gluttony Void Black Hole Vortex!
        const burstKey = `${z.id}_burst`
        if (!this.seenEffects.has(burstKey)) {
          this.seenEffects.add(burstKey)
          soundEngine.playEffectSound('beelzebuth')
          this.spawnImpactParticles(zx, zy, 0x38bdf8, 12)
          this.spawnImpactParticles(zx, zy, 0xa855f7, 10)
          this.cameras.main.shake(175, 0.0046)
        }

        const fade = clamp(ratio * 1.4, 0, 1)
        const rot = time * 0.0085

        // Deep Obsidian Event Horizon Field + Accretion Glow Rings
        g.fillStyle(0x020617, 0.62 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.fillStyle(0x312e81, 0.28 * fade)
        g.fillEllipse(zx, zy, z.radius * 1.52, z.radius * 1.52 * ISO_Y)
        g.lineStyle(4.5, 0x38bdf8, 0.92 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3, 0xa855f7, 0.85 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.38, z.radius * 1.38 * ISO_Y)

        // 8 Spiraling Abyssal Tendrils Pulling Into the Singularity
        for (let t = 0; t < 8; t++) {
          const baseAng = rot + (t * Math.PI) / 4
          const ox = zx + Math.cos(baseAng) * z.radius * 0.94
          const oy = zy + Math.sin(baseAng) * z.radius * 0.94 * ISO_Y
          const mx = zx + Math.cos(baseAng + 0.55) * z.radius * 0.48
          const my = zy + Math.sin(baseAng + 0.55) * z.radius * 0.48 * ISO_Y
          g.lineStyle(6, t % 2 === 0 ? 0x0f172a : 0x7e22ce, 0.88 * fade)
          g.lineBetween(ox, oy, mx, my)
          g.lineBetween(mx, my, zx, zy)
          g.lineStyle(2.4, t % 2 === 0 ? 0x38bdf8 : 0xfacc15, 0.92 * fade)
          g.lineBetween(ox, oy, mx, my)
        }

        // Floating Golden Demon-Lord Soul Motes Being Consumed
        for (let m = 0; m < 6; m++) {
          const ma = -rot * 1.2 + (m * Math.PI) / 3
          const dist = z.radius * (0.28 + ((m * 0.17 + time * 0.0005) % 0.6))
          const sx = zx + Math.cos(ma) * dist
          const sy = zy + Math.sin(ma) * dist * ISO_Y
          g.fillStyle(m % 2 === 0 ? 0xfacc15 : 0x38bdf8, 0.92 * fade)
          g.fillCircle(sx, sy, 3.6)
        }

        // Pitch-Black Core Event Horizon + Bright Cyan Photon Rim
        g.fillStyle(0x020617, 0.98 * fade)
        g.fillEllipse(zx, zy - 4, 62, 62 * ISO_Y)
        g.lineStyle(4, 0x38bdf8, fade)
        g.strokeEllipse(zx, zy - 4, 64, 64 * ISO_Y)
        g.lineStyle(2, 0xffffff, 0.95 * fade)
        g.strokeEllipse(zx, zy - 4, 54, 54 * ISO_Y)
      } else if (z.kind === 'aiouan_pounce_seal') {
        // Frame Q Impact: Golden Joestar Crosshair & Violet Stand Cat Paw Shockwave
        const fade = clamp(ratio * 1.4, 0, 1)
        g.fillStyle(0x7e22ce, 0.36 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4, 0xfacc15, 0.96 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3, 0xc084fc, 0.9 * fade)
        g.lineBetween(zx - z.radius * 0.8, zy, zx + z.radius * 0.8, zy)
        g.lineBetween(zx, zy - z.radius * 0.8 * ISO_Y, zx, zy + z.radius * 0.8 * ISO_Y)
        this.drawKatanaGlintStar(g, zx, zy - 8, 36 * fade, 0xfacc15, fade)
      } else if (z.kind === 'ora_meow_barrage') {
        // Frame E: Rapid ORA! Stand Cat Multi-Fist Cyclone Barrage
        const fade = clamp(ratio * 1.35, 0, 1)
        g.fillStyle(0x581c87, 0.34 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3.5, 0xa855f7, 0.92 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(2.5, 0xfacc15, 0.88 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.35, z.radius * 1.35 * ISO_Y)
        for (let k = 0; k < 6; k++) {
          const ang = time * 0.024 + (k * Math.PI) / 3
          const r = z.radius * (0.28 + ((k * 0.21 + time * 0.002) % 0.65))
          const px = zx + Math.cos(ang) * r
          const py = zy + Math.sin(ang) * r * ISO_Y - 12
          g.fillStyle(k % 2 === 0 ? 0xc084fc : 0xfacc15, 0.9 * fade)
          g.fillCircle(px, py, 11)
          g.lineStyle(2, 0xffffff, 0.95 * fade)
          g.strokeCircle(px, py, 11)
        }
      } else if (z.kind === 'aiouan_timestop') {
        // Frame R Phase 2: ZA WARUDO! Golden Clock Gears + Cosmic Cat Stand Domain
        const burstKey = `${z.id}_burst`
        if (!this.seenEffects.has(burstKey)) {
          this.seenEffects.add(burstKey)
          soundEngine.playEffectSound('aiouan_timestop')
          this.spawnImpactParticles(zx, zy, 0xfacc15, 14)
          this.spawnImpactParticles(zx, zy, 0xa855f7, 12)
          this.cameras.main.shake(190, 0.005)
        }
        const fade = clamp(ratio * 1.45, 0, 1)
        g.fillStyle(0x1e1b4b, 0.52 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.fillStyle(0x4c1d95, 0.3 * fade)
        g.fillEllipse(zx, zy, z.radius * 1.45, z.radius * 1.45 * ISO_Y)
        g.lineStyle(5, 0xfacc15, 0.96 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3, 0xc084fc, 0.9 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.5, z.radius * 1.5 * ISO_Y)

        // Frozen Golden Clock Hands + 12 Roman Gear Spokes
        for (let h = 0; h < 12; h++) {
          const ha = (h * Math.PI) / 6
          const ox = zx + Math.cos(ha) * z.radius * 0.96
          const oy = zy + Math.sin(ha) * z.radius * 0.96 * ISO_Y
          const ix = zx + Math.cos(ha) * z.radius * 0.78
          const iy = zy + Math.sin(ha) * z.radius * 0.78 * ISO_Y
          g.lineStyle(h % 3 === 0 ? 4 : 2, 0xfacc15, 0.92 * fade)
          g.lineBetween(ix, iy, ox, oy)
        }
        g.lineStyle(4.5, 0xfde047, 0.95 * fade)
        g.lineBetween(zx, zy, zx + z.radius * 0.45, zy - z.radius * 0.35 * ISO_Y)
        g.lineBetween(zx, zy, zx - z.radius * 0.62, zy + z.radius * 0.1 * ISO_Y)

        // Giant Hovering Astral Stand Cat "Ai-Ouan" Silhouette over Frozen Zone
        const cy = zy - 44 + Math.sin(time * 0.008) * 5
        g.fillStyle(0x9333ea, 0.45 * fade)
        g.fillEllipse(zx, cy, 78, 66)
        g.fillStyle(0xc084fc, 0.75 * fade)
        g.fillTriangle(zx - 26, cy - 16, zx - 22, cy - 42, zx - 6, cy - 22)
        g.fillTriangle(zx + 26, cy - 16, zx + 22, cy - 42, zx + 6, cy - 22)
        g.fillEllipse(zx, cy, 56, 46)
        g.lineStyle(2.5, 0xfacc15, 0.95 * fade)
        g.strokeEllipse(zx, cy, 56, 46)
        g.fillStyle(0xfef08a, fade)
        g.fillEllipse(zx - 12, cy - 6, 10, 6)
        g.fillEllipse(zx + 12, cy - 6, 10, 6)
      } else if (z.kind === 'saitama_crater') {
        // Saitama Serious Punch Shattered Shockwave Crater
        const fade = clamp(ratio * 1.35, 0, 1)
        g.fillStyle(0x450a0a, 0.56 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(5, 0xdc2626, 0.96 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3, 0xfacc15, 0.88 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.4, z.radius * 1.4 * ISO_Y)
        for (let r = 0; r < 10; r++) {
          const ra = (r * Math.PI) / 5
          g.lineStyle(3.2, r % 2 === 0 ? 0xfacc15 : 0xef4444, 0.88 * fade)
          g.lineBetween(
            zx + Math.cos(ra) * 20,
            zy + Math.sin(ra) * 20 * ISO_Y,
            zx + Math.cos(ra) * z.radius * 0.98,
            zy + Math.sin(ra) * z.radius * 0.98 * ISO_Y,
          )
        }
      } else if (z.kind === 'hollow_purple') {
        // Gojo Hollow Purple (เคียวชิกิ มุราซากิ): Cosmic Spatial Void Implosion Blast
        const fade = clamp(ratio * 1.45, 0, 1)
        const expand = 0.65 + (1 - ratio) * 0.4
        const rad = z.radius * expand
        g.fillStyle(0x3b0764, 0.54 * fade)
        g.fillEllipse(zx, zy, rad * 2, rad * 2 * ISO_Y)
        g.fillStyle(0x9333ea, 0.44 * fade)
        g.fillEllipse(zx, zy, rad * 1.45, rad * 1.45 * ISO_Y)
        g.fillStyle(0xffffff, 0.86 * fade)
        g.fillCircle(zx, zy - 16, 48 * fade)
        g.lineStyle(5.5, 0xf0abfc, 0.98 * fade)
        g.strokeEllipse(zx, zy, rad * 2, rad * 2 * ISO_Y)
        g.lineStyle(3.5, 0xc084fc, 0.9 * fade)
        g.strokeEllipse(zx, zy, rad * 1.28, rad * 1.28 * ISO_Y)
        for (let i = 0; i < 8; i++) {
          const a = time * 0.015 + (i * Math.PI) / 4
          g.lineStyle(3, 0xf5d0fe, 0.92 * fade)
          g.lineBetween(
            zx + Math.cos(a) * rad * 0.35,
            zy + Math.sin(a) * rad * 0.35 * ISO_Y,
            zx + Math.cos(a + 0.35) * rad * 0.95,
            zy + Math.sin(a + 0.35) * rad * 0.95 * ISO_Y,
          )
        }
      } else if (z.kind === 'infinite_void') {
        // Gojo Closed Domain Expansion: พรมแดนไร้ขีดจำกัด (Infinite Void Cosmic Dimension)
        const fade = Math.min(1, ratio * 2.2)
        g.fillStyle(0x020617, 0.72 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.fillStyle(0x1e1b4b, 0.48 * fade)
        g.fillEllipse(zx, zy, z.radius * 1.55, z.radius * 1.55 * ISO_Y)
        g.lineStyle(5.5, 0x38bdf8, 0.96 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3.2, 0xa855f7, 0.9 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.72, z.radius * 1.72 * ISO_Y)
        // Rotating Milky Way Galaxy Spirals + Stars
        for (let s = 0; s < 14; s++) {
          const sa = time * 0.0024 + (s * Math.PI) / 7
          const sr = z.radius * (0.24 + ((s * 0.17) % 0.72))
          const sx = zx + Math.cos(sa) * sr
          const sy = zy + Math.sin(sa) * sr * ISO_Y
          g.fillStyle(s % 3 === 0 ? 0xfef08a : s % 2 === 0 ? 0x38bdf8 : 0xc084fc, 0.92 * fade)
          g.fillCircle(sx, sy, s % 4 === 0 ? 4.4 : 2.6)
        }
        // Central Six-Eyes Astral Emblem glowing in the cosmos
        const eyePulse = 1 + Math.sin(time * 0.008) * 0.08
        g.lineStyle(3, 0x7dd3fc, 0.94 * fade)
        g.strokeEllipse(zx, zy - 12, 64 * eyePulse, 28 * eyePulse)
        g.fillStyle(0x38bdf8, 0.9 * fade)
        g.fillCircle(zx, zy - 12, 11 * eyePulse)
        g.fillStyle(0x020617, 0.95 * fade)
        g.fillCircle(zx, zy - 12, 4.5 * eyePulse)
        this.drawKatanaGlintStar(g, zx, zy - 12, 44 * fade, 0xe0f2fe, fade)
      } else if (z.kind === 'enkidu_field') {
        // Gilgamesh E: Celestial Chains of Heaven AoE Slow Zone
        const fade = clamp(ratio * 1.4, 0, 1)
        g.fillStyle(0x78350f, 0.28 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4, 0xfacc15, 0.94 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(2.5, 0xfef08a, 0.86 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.35, z.radius * 1.35 * ISO_Y)
        for (let c = 0; c < 8; c++) {
          const ca = time * 0.002 + (c * Math.PI) / 4
          const ox = zx + Math.cos(ca) * z.radius * 0.94
          const oy = zy + Math.sin(ca) * z.radius * 0.94 * ISO_Y
          g.lineStyle(3.5, 0xf59e0b, 0.9 * fade)
          g.lineBetween(ox, oy, zx, zy)
          g.lineStyle(1.5, 0xffffff, 0.85 * fade)
          g.strokeCircle(ox, oy, 5)
        }
      } else if (z.kind === 'gilga_sword_rain') {
        // Gilgamesh R: Gate of Babylon Sky-Portals & Divine Sword Rain Arena
        const fade = clamp(ratio * 1.35, 0, 1)
        g.fillStyle(0x78350f, 0.34 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4.5, 0xfacc15, 0.96 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3, 0xef4444, 0.85 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.4, z.radius * 1.4 * ISO_Y)
        // Floating Golden Sky Portals high above the AoE circle
        for (let pIdx = 0; pIdx < 4; pIdx++) {
          const pa = time * 0.003 + (pIdx * Math.PI) / 2
          const px = zx + Math.cos(pa) * z.radius * 0.56
          const py = zy - 220 + Math.sin(pa) * 32
          g.fillStyle(0xfacc15, 0.72 * fade)
          g.fillEllipse(px, py, 44, 20)
          g.lineStyle(2.5, 0xfef08a, fade)
          g.strokeEllipse(px, py, 44, 20)
        }
        this.drawKatanaGlintStar(g, zx, zy, 34 * fade, 0xfacc15, fade)
      } else if (z.kind === 'killua_solo_ring') {
        // Killua Q: Solo Melee Lightning Whirlwind + 0.5s I-Frame Barrier
        const fade = clamp(ratio * 1.6, 0, 1)
        g.fillStyle(0x0891b2, 0.28 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4.5, 0x22d3ee, 0.96 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3, 0xfef08a, 0.92 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.45, z.radius * 1.45 * ISO_Y)
        for (let k = 0; k < 6; k++) {
          const ang = time * 0.025 + (k * Math.PI) / 3
          this.drawJaggedBolt(
            g,
            zx,
            zy - 18,
            zx + Math.cos(ang) * z.radius * 0.94,
            zy + Math.sin(ang) * z.radius * 0.94 * ISO_Y,
            0x22d3ee,
            0xfef08a,
            8,
            time,
          )
        }
      } else if (z.kind === 'malevolent_shrine') {
        // Sukuna R: Grand Crimson Malevolent Shrine Pavilion + Swirling Cleaves + Slow Domain
        const fade = Math.min(1, ratio * 2)
        g.fillStyle(0x450a0a, 0.42 * fade)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4, 0xdc2626, 0.95 * fade)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(2.5, 0xfacc15, 0.72 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.68, z.radius * 1.68 * ISO_Y)
        g.lineStyle(2, 0xfb7185, 0.78 * fade)
        g.strokeEllipse(zx, zy, z.radius * 1.25, z.radius * 1.25 * ISO_Y)

        // Towering Ornate Malevolent Shrine Pavilion behind Sukuna's Throne
        g.fillStyle(0x2e0606, 0.9)
        g.fillRect(zx - 48, zy - 96, 10, 74)
        g.fillRect(zx + 38, zy - 96, 10, 74)
        g.fillStyle(0x991b1b, 0.96)
        g.fillTriangle(zx - 78, zy - 92, zx, zy - 126, zx + 78, zy - 92)
        g.fillRect(zx - 64, zy - 94, 128, 12)
        g.lineStyle(2.5, 0xfca5a5, 0.85)
        g.strokeTriangle(zx - 78, zy - 92, zx, zy - 126, zx + 78, zy - 92)

        // Relentless Dismantle & Cleave Dimension Slashes slicing everywhere in 270px domain
        for (let i = 0; i < 9; i++) {
          const ang = (time * 0.022 + i * 0.78) % (Math.PI * 2)
          const r = z.radius * 0.78 * (((i + 1) * 0.27) % 1)
          const sx = zx + Math.cos(ang) * r
          const sy = zy + Math.sin(ang) * r * ISO_Y
          const flip = i % 2 === 0 ? 1 : -1
          g.lineStyle(4.5, i % 3 === 0 ? 0x09090b : 0xf43f5e, 0.86)
          g.lineBetween(sx - 34, sy - 20 * flip, sx + 34, sy + 20 * flip)
          g.lineStyle(2, 0xffffff, 0.95)
          g.lineBetween(sx - 28, sy - 16 * flip, sx + 28, sy + 16 * flip)
        }
      } else if (z.kind === 'amaterasu' || z.kind === 'fuga_cinder') {
        const isAma = z.kind === 'amaterasu'
        g.fillStyle(isAma ? 0x020617 : col, 0.56 * Math.min(1, ratio * 1.5))
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3.5, isAma ? 0xdc2626 : acc, 0.94)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        for (let i = 0; i < 8; i++) {
          const ang = i * 0.85 + time * 0.005
          const dist = z.radius * 0.54 * ((i % 3) * 0.34 + 0.28)
          const fx = zx + Math.cos(ang) * dist
          const fy = zy + Math.sin(ang) * dist * ISO_Y
          const h = 26 + Math.sin(time * 0.022 + i * 2) * 10
          g.fillStyle(isAma ? 0x020617 : col, 0.95)
          g.fillTriangle(fx - 10, fy, fx, fy - h, fx + 10, fy)
          g.lineStyle(2, isAma ? 0xef4444 : acc, 0.96)
          g.strokeTriangle(fx - 10, fy, fx, fy - h, fx + 10, fy)
        }
      } else if (z.kind === 'tsukuyomi') {
        g.fillStyle(0x4c0519, 0.4 * Math.min(1, ratio * 1.6))
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(4, acc, 0.95)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(2.5, 0xef4444, 0.9)
        g.strokeEllipse(zx, zy, z.radius * 1.25, z.radius * 1.25 * ISO_Y)
        g.fillStyle(0x09090b, 0.9)
        g.fillEllipse(zx, zy, 24, 24 * ISO_Y)
        for (let i = 0; i < 3; i++) {
          const ang = time * 0.009 + (i * Math.PI * 2) / 3
          g.fillStyle(0xef4444, 0.98)
          g.fillCircle(zx + Math.cos(ang) * z.radius * 0.58, zy + Math.sin(ang) * z.radius * 0.58 * ISO_Y, 8)
          g.lineStyle(2, 0xffffff, 0.8)
          g.strokeCircle(zx + Math.cos(ang) * z.radius * 0.58, zy + Math.sin(ang) * z.radius * 0.58 * ISO_Y, 10)
        }
      } else if (z.kind === 'godspeed_aura') {
        g.fillStyle(col, 0.16)
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3, 0x22d3ee, 0.85)
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        this.drawJaggedBolt(g, zx - z.radius * 0.8, zy - 8, zx + z.radius * 0.8, zy - 28, col, acc, 12, time)
        this.drawJaggedBolt(g, zx + z.radius * 0.7, zy + 4, zx - z.radius * 0.7, zy - 32, 0xfef08a, col, 10, time + 19)
      } else {
        g.fillStyle(col, 0.3 * Math.min(1, ratio * 1.6))
        g.fillEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
        g.lineStyle(3.5, acc, 0.92 * Math.min(1, ratio * 1.6))
        g.strokeEllipse(zx, zy, z.radius * 2, z.radius * 2 * ISO_Y)
      }
    }
  }

  private drawJaggedBolt(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    col: number,
    acc: number,
    jitter: number,
    time: number,
  ): void {
    const segs = 5
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.max(1, Math.hypot(dx, dy))
    const px = -dy / len
    const py = dx / len

    g.lineStyle(8, col, 0.65)
    g.beginPath()
    g.moveTo(x1, y1)
    for (let i = 1; i < segs; i++) {
      const t = i / segs
      const off = Math.sin(time * 0.06 + i * 3.7) * jitter
      g.lineTo(x1 + dx * t + px * off, y1 + dy * t + py * off)
    }
    g.lineTo(x2, y2)
    g.strokePath()

    g.lineStyle(3, acc, 0.98)
    g.beginPath()
    g.moveTo(x1, y1)
    for (let i = 1; i < segs; i++) {
      const t = i / segs
      const off = Math.sin(time * 0.06 + i * 3.7) * jitter
      g.lineTo(x1 + dx * t + px * off, y1 + dy * t + py * off)
    }
    g.lineTo(x2, y2)
    g.strokePath()
  }

  private pruneSeenEffects(): void {
    if (this.seenEffects.size <= 350) return
    for (const id of this.seenEffects) {
      const baseId = id.endsWith('_burst') ? id.slice(0, -6) : id
      const active =
        this.beams.some((b) => b.id === baseId) ||
        this.zones.some((z) => z.id === baseId) ||
        this.projectiles.some((pr) => pr.id === baseId)
      if (!active) {
        this.seenEffects.delete(id)
        if (this.seenEffects.size <= 180) break
      }
    }
  }

  private drawProjectilesAndBeams25D(dt: number): void {
    const g = this.fxGfx
    g.clear()

    this.pruneSeenEffects()

    for (const b of this.beams) {
      b.life = Math.max(0, b.life - dt)
      const alpha = clamp(b.life / Math.max(0.05, b.maxLife), 0, 1)
      const col = hexToNum(b.color)
      const acc = hexToNum(b.accentColor)
      const isSkyStrike =
        b.kind === 'narukami_strike' ||
        b.kind === 'black_lightning_strike' ||
        b.kind === 'aiouan_timestop_burst' ||
        b.kind === 'gilga_sky_sword'
      const y1 = isSkyStrike ? b.y1 * ISO_Y : b.y1 * ISO_Y - 24
      const y2 = isSkyStrike ? b.y2 * ISO_Y : b.y2 * ISO_Y - 24

      if (!this.seenEffects.has(b.id)) {
        this.seenEffects.add(b.id)
        soundEngine.playEffectSound(b.kind)
        if (b.kind === 'kamehameha' || b.kind === 'enuma_elish') {
          this.spawnImpactParticles(b.x1, y1, col, b.kind === 'enuma_elish' ? 24 : 12)
          this.cameras.main.shake(b.kind === 'enuma_elish' ? 420 : 150, b.kind === 'enuma_elish' ? 0.008 : 0.0045)
          if (b.kind === 'enuma_elish' && b.ownerId && b.ownerId !== this.myPlayerId) {
            soundEngine.speakSkillCallout('pa', 3, 'Enuma Elish!')
          }
        } else if (b.kind === 'gilga_sky_sword') {
          this.spawnImpactParticles(b.x2, y2, 0xfacc15, 10)
        } else if (b.kind === 'goku_dragon_rush' || b.kind === 'godspeed_collide' || b.kind === 'killua_solo_flash') {
          this.spawnImpactParticles(b.x2, y2, acc, 14)
          this.cameras.main.shake(140, 0.0042)
        } else if (b.kind === 'narukami_strike' || b.kind === 'thunder_slam_burst') {
          this.spawnImpactParticles(b.x2, y2, acc, b.kind === 'thunder_slam_burst' ? 12 : 16)
          this.cameras.main.shake(b.kind === 'thunder_slam_burst' ? 120 : 180, 0.0048)
        } else if (b.kind === 'black_lightning_strike') {
          this.spawnImpactParticles(b.x2, y2, 0x38bdf8, 14)
          this.spawnImpactParticles(b.x2, y2, 0xa855f7, 10)
          this.cameras.main.shake(165, 0.0046)
        } else if (b.kind === 'basic_lock_reticle') {
        // Subtle Universal Basic-Attack Lock-On Crosshair Ping
        g.lineStyle(2.5, acc, alpha * 0.65)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(3.2, col, alpha)
        g.strokeEllipse(b.x2, y2 + 24, 48, 48 * ISO_Y)
        g.lineBetween(b.x2 - 26, y2 + 24, b.x2 + 26, y2 + 24)
        g.lineBetween(b.x2, y2 + 24 - 18, b.x2, y2 + 24 + 18)
      } else if (b.kind === 'aiouan_lock_beam') {
          this.spawnImpactParticles(b.x2, y2, 0xfacc15, 10)
        } else if (b.kind === 'aiouan_ora_rush' || b.kind === 'aiouan_timestop_burst') {
          this.spawnImpactParticles(b.x2, y2, 0xfacc15, 12)
          this.spawnImpactParticles(b.x2, y2, 0xa855f7, 10)
          this.cameras.main.shake(145, 0.0044)
        } else if (b.kind === 'shishi_sonson') {
          this.spawnImpactParticles(b.x1, y1, 0xa855f7, 8)
          this.spawnImpactParticles(b.x2, y2, 0x34d399, 14)
          this.cameras.main.shake(125, 0.0042)
        } else if (b.kind === 'atk_zoro_sweep') {
          this.spawnImpactParticles(b.x2, y2, 0x6ee7b7, 7)
          this.spawnImpactParticles(b.x2, y2, 0xc084fc, 4)
        } else if (b.kind === 'atk_zenitsu_slash') {
          this.spawnImpactParticles(b.x2, y2, 0xfacc15, 8)
          this.spawnImpactParticles(b.x2, y2, 0xfef08a, 5)
        } else if (b.kind === 'zenitsu_hekireki' || b.kind === 'zenitsu_rokuren') {
          this.spawnImpactParticles(b.x1, y1, 0xfacc15, 10)
          this.spawnImpactParticles(b.x2, y2, 0xfef08a, 16)
          this.spawnImpactParticles(b.x2, y2, 0x7dd3fc, 8)
          this.cameras.main.shake(135, 0.0046)
        } else if (b.kind === 'zenitsu_murad_slash') {
          this.spawnImpactParticles((b.x1 + b.x2) * 0.5, (y1 + y2) * 0.5, 0xfef08a, 8)
          this.cameras.main.shake(80, 0.0028)
        } else if (b.kind === 'saitama_serious_punch') {
          this.spawnImpactParticles(b.x2, y2, 0xdc2626, 20)
          this.spawnImpactParticles(b.x2, y2, 0xfacc15, 16)
          this.cameras.main.shake(260, 0.009)
        } else if (b.kind === 'hollow_purple_blast' || b.kind === 'infinite_void_open') {
          this.spawnImpactParticles(b.x2, y2, acc, 16)
          this.cameras.main.shake(190, 0.006)
        } else if (b.kind === 'dash_afterimage' || b.kind === 'instant_transmission') {
          this.spawnImpactParticles(b.x1, y1, col, 6)
        } else if (b.kind.startsWith('atk_')) {
          this.spawnImpactParticles(b.x2, y2, acc, 5)
        }
      }

      if (b.kind === 'atk_zoro_sweep') {
        // Zoro (ธันวา): King-of-Hell 4-Tiered Emerald + Enma Violet Cyclone Slash + Blade Gleam Stars
        const baseAng = Math.atan2(y2 - y1, b.x2 - b.x1)
        const tiers = [
          { r: 58, col: 0x7e22ce, w: 12, a: 0.55 },
          { r: 84, col: 0x059669, w: 11, a: 0.85 },
          { r: 108, col: 0x34d399, w: 8, a: 0.94 },
          { r: 132, col: 0xffffff, w: 4, a: 1.0 },
        ]
        for (const t of tiers) {
          g.lineStyle(t.w, t.col, alpha * t.a)
          g.beginPath()
          g.arc(b.x1, y1, t.r, baseAng - 1.12, baseAng + 1.12)
          g.strokePath()
        }
        // 3 Gleaming Katana Tip Diamond Stars along the arc
        for (const offset of [-0.9, 0, 0.9]) {
          const sx = b.x1 + Math.cos(baseAng + offset) * 124
          const sy = y1 + Math.sin(baseAng + offset) * 124
          this.drawKatanaGlintStar(g, sx, sy, 14 * (0.4 + alpha * 0.6), 0x34d399, alpha)
        }
      } else if (b.kind === 'shishi_sonson') {
        // Zoro (ธันวา) E: Shishi Sonson Lion's Song Reality-Split Iaijutsu Dash
        const dx = b.x2 - b.x1
        const dy = y2 - y1
        const perpX = -dy / Math.max(1, Math.hypot(dx, dy))
        const perpY = dx / Math.max(1, Math.hypot(dx, dy))

        // 4 Ghostly King-of-Hell Afterimages fading along dash trajectory
        for (let s = 0; s < 4; s++) {
          const t = s / 4
          const ax = b.x1 + dx * t
          const ay = y1 + dy * t
          g.fillStyle(s % 2 === 0 ? 0x10b981 : 0x7e22ce, alpha * (0.18 + s * 0.08))
          g.fillEllipse(ax, ay + 6, 30, 40)
          g.lineStyle(2, 0x6ee7b7, alpha * 0.55)
          g.strokeEllipse(ax, ay + 6, 32, 42)
        }

        // Outer Enma Violet + Emerald Sonic Corridor & Obsidian Reality Fissure
        g.lineStyle(32, 0x7e22ce, alpha * 0.42)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(20, 0x10b981, alpha * 0.72)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(9, 0x0f172a, alpha * 0.85)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(4, 0xffffff, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)

        // Crackling Enma Haki Lightning twisting across the Iaijutsu slash path
        this.drawJaggedBolt(g, b.x1, y1, b.x2, y2, 0xa855f7, 0x6ee7b7, 14, this.animTime)

        // Cross-slash perpendicular impact cleave & dramatic katana flash stars at origin & execution endpoint
        const slashW = 54 * (0.4 + alpha * 0.6)
        g.lineStyle(12, 0x10b981, alpha * 0.78)
        g.lineBetween(b.x2 - perpX * slashW, y2 - perpY * slashW, b.x2 + perpX * slashW, y2 + perpY * slashW)
        g.lineStyle(4, 0xffffff, alpha)
        g.lineBetween(b.x2 - perpX * slashW, y2 - perpY * slashW, b.x2 + perpX * slashW, y2 + perpY * slashW)

        g.lineStyle(3.5, 0x34d399, alpha * 0.9)
        g.strokeEllipse(b.x2, y2 + 12, 74 * (1.25 - alpha * 0.4), 74 * ISO_Y * (1.25 - alpha * 0.4))
        this.drawKatanaGlintStar(g, b.x1, y1, 18 * alpha, 0xa855f7, alpha)
        this.drawKatanaGlintStar(g, b.x2, y2, 30 * alpha, 0x34d399, alpha)
      } else if (b.kind === 'atk_zenitsu_slash') {
        // Zenitsu Basic: Blazing Golden Thunder Breathing Arc + White-Cyan Sparks
        const baseAng = Math.atan2(y2 - y1, b.x2 - b.x1)
        const tiers = [
          { r: 64, col: 0xf59e0b, w: 12, a: 0.65 },
          { r: 92, col: 0xfacc15, w: 9, a: 0.9 },
          { r: 118, col: 0xffffff, w: 4.5, a: 1.0 },
        ]
        for (const t of tiers) {
          g.lineStyle(t.w, t.col, alpha * t.a)
          g.beginPath()
          g.arc(b.x1, y1, t.r, baseAng - 1.08, baseAng + 1.08)
          g.strokePath()
        }
        this.drawJaggedBolt(g, b.x1, y1, b.x2, y2, 0xfacc15, 0x7dd3fc, 10, this.animTime)
        this.drawKatanaGlintStar(g, b.x2, y2, 20 * alpha, 0xfef08a, alpha)
      } else if (b.kind === 'zenitsu_hekireki' || b.kind === 'zenitsu_rokuren') {
        // Zenitsu Q & E: Hekireki Issen / Sixfold Supersonic Golden Lightning Dash Corridor!
        const dx = b.x2 - b.x1
        const dy = y2 - y1
        const isSix = b.kind === 'zenitsu_rokuren'

        // Golden lightning afterimage silhouettes streaking along the dash path
        for (let s = 0; s < (isSix ? 5 : 4); s++) {
          const frac = s / (isSix ? 5 : 4)
          const ax = b.x1 + dx * frac + (isSix ? Math.sin(s * 2.4) * 18 : 0)
          const ay = y1 + dy * frac + (isSix ? Math.cos(s * 2.4) * 10 : 0)
          g.fillStyle(s % 2 === 0 ? 0xfacc15 : 0xf59e0b, alpha * (0.2 + s * 0.07))
          g.fillEllipse(ax, ay + 6, 28, 38)
          g.lineStyle(2, 0xfef08a, alpha * 0.6)
          g.strokeEllipse(ax, ay + 6, 30, 40)
        }

        // Core Blazing Amber/White Sonic Path + Dual Jagged Thunder Bolts
        g.lineStyle(28, 0xf59e0b, alpha * 0.42)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(14, 0xfacc15, alpha * 0.88)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(4.5, 0xffffff, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        this.drawJaggedBolt(g, b.x1, y1, b.x2, y2, 0xfacc15, 0xffffff, 16, this.animTime)
        this.drawJaggedBolt(g, b.x1, y1, b.x2, y2, 0x38bdf8, 0xfef08a, 14, this.animTime + 33)

        g.lineStyle(4, isSix ? 0x7dd3fc : 0xfef08a, alpha * 0.95)
        g.strokeEllipse(b.x2, y2 + 10, (isSix ? 110 : 82) * (1.2 - alpha * 0.35), (isSix ? 110 : 82) * ISO_Y * (1.2 - alpha * 0.35))
        this.drawKatanaGlintStar(g, b.x1, y1, 20 * alpha, 0xfacc15, alpha)
        this.drawKatanaGlintStar(g, b.x2, y2, 34 * alpha, 0xffffff, alpha)
      } else if (b.kind === 'zenitsu_murad_slash') {
        // One sequential Star-Leg Phantom Thunder Slash (0->2->4->1->3->0)!
        const dx = b.x2 - b.x1
        const dy = y2 - y1
        // Ghostly electric phantom afterimage streaking down this star leg
        const mx = b.x1 + dx * 0.55
        const my = y1 + dy * 0.55
        g.fillStyle(0xfacc15, alpha * 0.24)
        g.fillEllipse(mx, my + 4, 24, 34)
        g.lineStyle(1.6, 0x7dd3fc, alpha * 0.6)
        g.strokeEllipse(mx, my + 4, 26, 36)

        g.lineStyle(26, 0xf59e0b, alpha * 0.36)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(11, 0xfef08a, alpha * 0.94)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(4, 0xffffff, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        this.drawJaggedBolt(g, b.x1, y1, b.x2, y2, 0x7dd3fc, 0xfacc15, 11, this.animTime)
        this.drawKatanaGlintStar(g, b.x1, y1, 18 * alpha, 0xfacc15, alpha)
        this.drawKatanaGlintStar(g, b.x2, y2, 26 * alpha, 0xffffff, alpha)
      } else if (b.kind === 'atk_goku_fist') {
        // Goku Basic: Super Saiyan Golden Dragon Fist + Sonic Wind Rings
        const dx = b.x2 - b.x1
        const dy = y2 - y1
        g.lineStyle(26, 0xf97316, alpha * 0.5)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(12, 0xfef08a, alpha * 0.96)
        g.lineBetween(b.x1, y1, b.x2, y2)
        for (let ring = 1; ring <= 3; ring++) {
          const t = ring / 3
          const rx = b.x1 + dx * t
          const ry = y1 + dy * t
          const rSize = 20 + ring * 11
          g.lineStyle(3.5, ring === 3 ? 0xffffff : 0xfacc15, alpha * 0.9)
          g.strokeEllipse(rx, ry, rSize, rSize * 1.45)
        }
        this.drawKatanaGlintStar(g, b.x2, y2, 22 * alpha, 0xfef08a, alpha)
      } else if (b.kind === 'goku_dragon_rush') {
        // Goku Skill 2: Blazing Golden Dragon Meteor Dash Punch + Impact Shock Ring
        const dx = b.x2 - b.x1
        const dy = y2 - y1
        g.lineStyle(34, 0xf97316, alpha * 0.42)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(16, 0xfacc15, alpha * 0.9)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(5, 0xffffff, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        for (let a = 1; a <= 3; a++) {
          const t = a / 4
          g.fillStyle(0x38bdf8, alpha * 0.35)
          g.fillEllipse(b.x1 + dx * t, y1 + dy * t, 28, 36)
        }
        g.lineStyle(4.5, 0xfacc15, alpha)
        g.strokeEllipse(b.x2, y2 + 12, 95 * (1.2 - alpha * 0.4), 95 * ISO_Y * (1.2 - alpha * 0.4))
        this.drawKatanaGlintStar(g, b.x2, y2, 32 * alpha, 0x38bdf8, alpha)
      } else if (b.kind === 'killua_solo_flash' || b.kind === 'godspeed_collide') {
        // Killua: Explosive Cyan-Gold Godspeed Lightning Flash + Ground Shatter
        this.drawJaggedBolt(g, b.x1, y1, b.x2, y2, 0x22d3ee, 0xfef08a, 18, this.animTime)
        g.lineStyle(4, 0xfef08a, alpha)
        g.strokeEllipse(b.x2, y2 + 10, 74 * (1.2 - alpha * 0.4), 74 * ISO_Y * (1.2 - alpha * 0.4))
        this.drawKatanaGlintStar(g, b.x2, y2, 24 * alpha, 0x22d3ee, alpha)
      } else if (b.kind === 'gilga_sky_sword') {
        // Gilgamesh R Falling Divine Sky Sword from Golden Heaven Gate + Crater Impact
        const ang = Math.atan2(y2 - y1, b.x2 - b.x1)
        const sx = b.x1 + (b.x2 - b.x1) * (1 - alpha * 0.6)
        const sy = y1 + (y2 - y1) * (1 - alpha * 0.6)
        g.lineStyle(14, 0xef4444, alpha * 0.42)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(7, 0xfacc15, alpha * 0.96)
        g.lineBetween(sx - Math.cos(ang) * 44, sy - Math.sin(ang) * 44, sx + Math.cos(ang) * 32, sy + Math.sin(ang) * 32)
        g.lineStyle(3, 0xffffff, alpha)
        g.lineBetween(sx - Math.cos(ang) * 36, sy - Math.sin(ang) * 36, sx + Math.cos(ang) * 28, sy + Math.sin(ang) * 28)
        g.lineStyle(3.5, 0xfacc15, alpha * 0.92)
        g.strokeEllipse(b.x2, y2, 62 * (1.2 - alpha * 0.4), 62 * ISO_Y * (1.2 - alpha * 0.4))
      } else if (b.kind === 'atk_sukuna_cleave') {
        // Sukuna: Intersecting Razor Crimson-Black X-Cleave Claws
        const cx = (b.x1 + b.x2) * 0.5
        const cy = (y1 + y2) * 0.5
        const s = 48 + (1 - alpha) * 20
        g.lineStyle(12, 0x09090b, alpha * 0.85)
        g.lineBetween(cx - s, cy - s * 0.75, cx + s, cy + s * 0.75)
        g.lineBetween(cx - s, cy + s * 0.75, cx + s, cy - s * 0.75)
        g.lineStyle(5.5, 0xf43f5e, alpha * 0.98)
        g.lineBetween(cx - s, cy - s * 0.75, cx + s, cy + s * 0.75)
        g.lineBetween(cx - s, cy + s * 0.75, cx + s, cy - s * 0.75)
        g.lineStyle(2.5, 0xffffff, alpha)
        g.lineBetween(cx - s * 0.8, cy - s * 0.6, cx + s * 0.8, cy + s * 0.6)
      } else if (b.kind === 'atk_gilga_flash') {
        // Gilgamesh: Twin Glowing Shoulder Ripple Halos
        g.lineStyle(3.5, 0xfacc15, alpha * 0.95)
        g.strokeEllipse(b.x1, y1, 22, 16)
        g.strokeEllipse(b.x2, y2, 22, 16)
        g.lineStyle(2, 0xffffff, alpha * 0.85)
        g.strokeEllipse(b.x1, y1, 12, 9)
        g.strokeEllipse(b.x2, y2, 12, 9)
      } else if (b.kind === 'killua_leap_arc') {
        // Parabolic 2.5D electric jump arc trail across the air
        const steps = 10
        g.lineStyle(7, col, alpha * 0.6)
        g.beginPath()
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          const ax = b.x1 + (b.x2 - b.x1) * t
          const ay = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * 86
          if (i === 0) g.moveTo(ax, ay)
          else g.lineTo(ax, ay)
        }
        g.strokePath()
        g.lineStyle(3, acc, alpha * 0.96)
        g.beginPath()
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          const ax = b.x1 + (b.x2 - b.x1) * t
          const ay = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * 86
          if (i === 0) g.moveTo(ax, ay)
          else g.lineTo(ax, ay)
        }
        g.strokePath()
        } else if (b.kind === 'atk_killua_spark' || b.kind === 'lightning_arc' || b.kind === 'narukami_strike' || b.kind === 'thunder_slam_burst' || b.kind === 'narukami_radial_beam') {
        const jit = b.kind === 'narukami_strike' ? 24 : b.kind === 'narukami_radial_beam' ? 18 : b.kind === 'thunder_slam_burst' ? 16 : b.kind === 'atk_killua_spark' ? 11 : 14
        this.drawJaggedBolt(g, b.x1, y1, b.x2, y2, col, acc, jit, this.animTime)
        if (b.kind === 'atk_killua_spark' || b.kind === 'thunder_slam_burst' || b.kind === 'narukami_radial_beam') {
          g.lineStyle(3.5, 0xfef08a, alpha * 0.95)
          g.strokeEllipse(b.x2, y2, 46 * (1.3 - alpha * 0.5), 46 * ISO_Y * (1.3 - alpha * 0.5))
        } else if (b.kind === 'narukami_strike') {
          g.lineStyle(4.5, acc, alpha)
          g.strokeEllipse(b.x2, y2, 115 * (1.2 - alpha * 0.5), 115 * ISO_Y * (1.2 - alpha * 0.5))
          g.lineStyle(2.5, 0xffffff, alpha)
          g.strokeEllipse(b.x2, y2, 68 * (1.2 - alpha * 0.4), 68 * ISO_Y * (1.2 - alpha * 0.4))
        }
      } else if (b.kind === 'black_lightning_strike') {
        // Rimuru Q Impact: Obsidian Core Black Lightning Bolt + Neon Cyan Halo + Ground Crater
        this.drawJaggedBolt(g, b.x1, y1, b.x2, y2, 0x38bdf8, 0x020617, 24, this.animTime)
        this.drawJaggedBolt(g, b.x1 - 12, y1, b.x2, y2, 0xa855f7, 0xe0f2fe, 14, this.animTime + 33)
        g.fillStyle(0x020617, alpha * 0.55)
        g.fillEllipse(b.x2, y2, 108 * (1.15 - alpha * 0.35), 108 * ISO_Y * (1.15 - alpha * 0.35))
        g.lineStyle(4.5, 0x38bdf8, alpha)
        g.strokeEllipse(b.x2, y2, 114 * (1.2 - alpha * 0.45), 114 * ISO_Y * (1.2 - alpha * 0.45))
        g.lineStyle(2.5, 0xfacc15, alpha * 0.9)
        g.strokeEllipse(b.x2, y2, 74 * (1.25 - alpha * 0.4), 74 * ISO_Y * (1.25 - alpha * 0.4))
      } else if (b.kind === 'atk_aiouan_paw') {
        // Frame Basic Attack: Twin Purple-Gold Stand Cat Claw Swipe
        const baseAng = Math.atan2(y2 - y1, b.x2 - b.x1)
        g.lineStyle(12, 0x9333ea, alpha * 0.72)
        g.beginPath()
        g.arc(b.x1, y1, 88, baseAng - 0.92, baseAng + 0.92)
        g.strokePath()
        g.lineStyle(5.5, 0xfacc15, alpha * 0.96)
        g.beginPath()
        g.arc(b.x1, y1, 108, baseAng - 0.85, baseAng + 0.85)
        g.strokePath()
        this.drawKatanaGlintStar(g, b.x1 + Math.cos(baseAng) * 112, y1 + Math.sin(baseAng) * 112, 16 * alpha, 0xfacc15, alpha)
      } else if (b.kind === 'basic_lock_reticle') {
        // Subtle Universal Basic-Attack Lock-On Crosshair Ping
        g.lineStyle(2.5, acc, alpha * 0.65)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(3.2, col, alpha)
        g.strokeEllipse(b.x2, y2 + 24, 48, 48 * ISO_Y)
        g.lineBetween(b.x2 - 26, y2 + 24, b.x2 + 26, y2 + 24)
        g.lineBetween(b.x2, y2 + 24 - 18, b.x2, y2 + 24 + 18)
      } else if (b.kind === 'aiouan_lock_beam') {
        // Stand Lock-On Psychic Sightline + Golden Crosshair Ring on Locked Target
        g.lineStyle(8, 0x9333ea, alpha * 0.42)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(2.5, 0xfacc15, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(4, 0xfacc15, alpha)
        g.strokeEllipse(b.x2, y2 + 24, 58, 58 * ISO_Y)
        g.lineBetween(b.x2 - 36, y2 + 24, b.x2 + 36, y2 + 24)
        g.lineBetween(b.x2, y2 + 24 - 26, b.x2, y2 + 24 + 26)
      } else if (b.kind === 'aiouan_ora_rush') {
        // Rapid Stand Cat "ORA ORA" Punch Barrage Corridor
        const dx = b.x2 - b.x1
        const dy = y2 - y1
        g.lineStyle(32, 0x7e22ce, alpha * 0.45)
        g.lineBetween(b.x1, y1, b.x2, y2)
        for (let f = 1; f <= 5; f++) {
          const t = f / 5
          const fx = b.x1 + dx * t + (f % 2 === 0 ? 12 : -12)
          const fy = y1 + dy * t + (f % 2 === 0 ? -10 : 10)
          g.fillStyle(f % 2 === 0 ? 0xfacc15 : 0xc084fc, alpha * 0.9)
          g.fillCircle(fx, fy, 11)
          g.lineStyle(2, 0xffffff, alpha)
          g.strokeCircle(fx, fy, 11)
        }
      } else if (b.kind === 'aiouan_timestop_burst') {
        // Monumental Gold & Purple Time-Stop Impact Pillar
        g.lineStyle(44, 0x7e22ce, alpha * 0.48)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(18, 0xfacc15, alpha * 0.92)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(5, 0xffffff, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
      } else if (b.kind === 'saitama_serious_punch') {
        // LuangPhi Sorn (Saitama): Sky-splitting Red & Gold Serious Punch Shock Corridor
        g.lineStyle(86, 0x991b1b, alpha * 0.48)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(46, 0xef4444, alpha * 0.86)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(16, 0xfef08a, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        for (let r = 1; r <= 4; r++) {
          const t = r / 4
          const rx = b.x1 + (b.x2 - b.x1) * t
          const ry = y1 + (y2 - y1) * t
          g.lineStyle(4, 0xfacc15, alpha * 0.92)
          g.strokeEllipse(rx, ry, 42 + r * 14, (42 + r * 14) * ISO_Y)
        }
      } else if (b.kind === 'saitama_dodge') {
        // Invulnerability Dodge Shield Flash against Saitama Punch
        g.lineStyle(6, 0xfacc15, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineBetween(b.x2, y1, b.x1, y2)
      } else if (b.kind === 'hollow_purple_blast' || b.kind === 'infinite_void_open') {
        g.lineStyle(b.width * 1.15, col, alpha * 0.48)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.6, acc, alpha * 0.9)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.22, 0xffffff, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
      } else if (b.kind === 'atk_sorn_jab' || b.kind === 'atk_gojo_punch') {
        g.lineStyle(b.width * 0.85, col, alpha * 0.56)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.36, acc, alpha * 0.95)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.fillStyle(0xffffff, alpha * 0.92)
        g.fillCircle(b.x2, y2, 16)
      } else if (b.kind === 'atk_thanos_gauntlet') {
        const baseAng = Math.atan2(y2 - y1, b.x2 - b.x1)
        g.lineStyle(14, 0x9333ea, alpha * 0.65)
        g.beginPath()
        g.arc(b.x1, y1, 86, baseAng - 0.95, baseAng + 0.95)
        g.strokePath()
        g.lineStyle(6, 0xfacc15, alpha)
        g.beginPath()
        g.arc(b.x1, y1, 108, baseAng - 0.88, baseAng + 0.88)
        g.strokePath()
      } else if (b.kind === 'thanos_space_warp') {
        g.lineStyle(24, 0x1d4ed8, alpha * 0.45)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(10, 0x38bdf8, alpha * 0.95)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(3.5, 0xffffff, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
      } else if (b.kind === 'thanos_reality_rift') {
        g.lineStyle(20, 0xef4444, alpha * 0.72)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(6, 0xfee2e2, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
      } else if (b.kind === 'thanos_mind_beam') {
        g.lineStyle(46, 0xd97706, alpha * 0.42)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(22, 0xfacc15, alpha * 0.9)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(8, 0xffffff, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        this.drawKatanaGlintStar(g, b.x2, y2, 26 * alpha, 0xfef08a, alpha)
      } else if (b.kind === 'gojo_cast_red' || b.kind === 'gojo_cast_blue') {
        g.lineStyle(b.width * 0.7, col, alpha * 0.8)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(4, 0xffffff, alpha)
        g.strokeCircle(b.x1, y1, 20)
      } else if (b.kind === 'enkidu_tether') {
        g.lineStyle(4, col, alpha * 0.85)
        g.lineBetween(b.x1, y1, b.x2, y2)
        for (let k = 1; k <= 6; k++) {
          const t = k / 7
          g.lineStyle(2.5, acc, alpha)
          g.strokeCircle(b.x1 + (b.x2 - b.x1) * t, y1 + (y2 - y1) * t, 5)
        }
      } else if (b.kind === 'dash_afterimage' || b.kind === 'instant_transmission') {
        for (let s = 0; s < 3; s++) {
          const t = s / 3
          const ex = b.x1 + (b.x2 - b.x1) * t
          const ey = y1 + (y2 - y1) * t
          g.fillStyle(col, alpha * (0.28 + s * 0.14))
          g.fillEllipse(ex, ey, 26, 36)
          g.lineStyle(2, acc, alpha * 0.7)
          g.strokeEllipse(ex, ey, 28, 38)
        }
        g.lineStyle(b.width * 0.5, col, alpha * 0.45)
        g.lineBetween(b.x1, y1, b.x2, y2)
      } else if (b.kind === 'enuma_elish') {
        const eaAlpha = b.life > 0.45 ? 1 : clamp(b.life / 0.45, 0, 1)
        g.lineStyle(b.width * 1.42, 0x450a0a, eaAlpha * 0.56)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.98, 0xdc2626, eaAlpha * 0.85)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.48, 0xfacc15, eaAlpha * 0.95)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.2, 0xffffff, eaAlpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        for (let k = 0; k < 10; k++) {
          const t = ((k + 0.3 + ((this.animTime * 0.0018) % 1)) % 1)
          const rx = b.x1 + (b.x2 - b.x1) * t
          const ry = y1 + (y2 - y1) * t
          g.lineStyle(3.2, k % 2 === 0 ? 0xfacc15 : 0xef4444, eaAlpha * 0.88)
          g.strokeEllipse(rx, ry, b.width * 0.55, b.width * 1.15)
        }
      } else if (b.kind === 'kamehameha') {
        g.lineStyle(b.width * 1.15, col, alpha * 0.45)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.72, col, alpha * 0.85)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.34, acc, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
        // Compression shock rings along mega-beam axis
        for (let k = 0; k < 5; k++) {
          const t = (k + 0.3) / 5
          const rx = b.x1 + (b.x2 - b.x1) * t
          const ry = y1 + (y2 - y1) * t
          g.lineStyle(2.5, 0xffffff, alpha * 0.8)
          g.strokeEllipse(rx, ry, b.width * 0.4, b.width * 0.95)
        }
      } else {
        g.lineStyle(b.width, col, alpha * 0.68)
        g.lineBetween(b.x1, y1, b.x2, y2)
        g.lineStyle(b.width * 0.4, acc, alpha)
        g.lineBetween(b.x1, y1, b.x2, y2)
      }
    }

    // Reuse pooled GPU sprites for projectiles with unique realistic textures & trailing motion wakes
    let idx = 0
    for (const pr of this.projectiles) {
      if (!this.seenEffects.has(pr.id)) {
        this.seenEffects.add(pr.id)
        soundEngine.playEffectSound(pr.kind)
      }
      pr.x += pr.vx * dt
      pr.y += pr.vy * dt
      const groundY = pr.y * ISO_Y
      const airY = groundY - 24
      const spd = Math.max(1, Math.hypot(pr.vx, pr.vy))
      const dirX = pr.vx / spd
      const dirY = pr.vy / spd

      g.fillStyle(0x000000, 0.3)
      g.fillEllipse(pr.x, groundY, pr.radius * 1.6, pr.radius * 1.0)

      // Motion wake streak
      g.lineStyle(Math.max(4, pr.radius * 0.9), hexToNum(pr.color), 0.45)
      g.lineBetween(pr.x, airY, pr.x - dirX * 34, airY - dirY * 34 * ISO_Y)

      let texKey = 'fx_orb_glow'
      let scale = (pr.radius * 2.4) / 32
      let rot = Math.atan2(pr.vy, pr.vx)
      let tint = hexToNum(pr.color)

      if (pr.kind === 'gate_sword' || pr.kind === 'atk_gilga_sword') {
        texKey = 'fx_gold_sword'
        scale = pr.kind === 'atk_gilga_sword' ? 0.74 : 0.92
        // Trailing golden Babylon stardust & halo wake
        g.fillStyle(0xfef08a, 0.88)
        g.fillCircle(pr.x - dirX * 20, airY - dirY * 20 * ISO_Y, 3.5)
        g.lineStyle(2, 0xfacc15, 0.7)
        g.strokeEllipse(pr.x - dirX * 14, airY - dirY * 14 * ISO_Y, 16, 10)
      } else if (pr.kind === 'ki_blast') {
        texKey = 'fx_orb_glow'
        scale = 1.05
        tint = 0x38bdf8
        // Radiant Super Saiyan Ki wake + spiral cyan-gold sparks
        g.lineStyle(4, 0xfef08a, 0.82)
        g.lineBetween(pr.x, airY, pr.x - dirX * 44, airY - dirY * 44 * ISO_Y)
        g.fillStyle(0x38bdf8, 0.75)
        g.fillCircle(pr.x - dirX * 24, airY - dirY * 24 * ISO_Y, 5)
      } else if (pr.kind === 'crow_shuriken') {
        texKey = 'fx_crow_shuriken'
        scale = 0.82
        rot = this.animTime * 0.022
        tint = 0xffffff
        // Swirling crimson-black crow feather orbit around shuriken
        g.fillStyle(0x09090b, 0.9)
        g.fillEllipse(pr.x - dirX * 20, airY - dirY * 20 * ISO_Y - 7, 11, 4)
        g.fillStyle(0xdc2626, 0.85)
        g.fillEllipse(pr.x - dirX * 16, airY - dirY * 16 * ISO_Y + 7, 10, 4)
      } else if (pr.kind === 'atk_itachi_kunai') {
        texKey = 'fx_kunai'
        scale = 0.82
        tint = 0xffffff
        g.fillStyle(0x111827, 0.88)
        g.fillEllipse(pr.x - dirX * 16, airY - dirY * 16 * ISO_Y - 5, 9, 3.5)
        g.fillEllipse(pr.x - dirX * 26, airY - dirY * 26 * ISO_Y + 6, 8, 3)
      } else if (pr.kind === 'atk_default_pulse') {
        texKey = 'fx_slash_wave'
        scale = 0.9
      } else if (pr.kind === 'fuga_arrow') {
        texKey = 'fx_fire_arrow'
        scale = 1.15
        g.fillStyle(0xf97316, 0.8)
        g.fillCircle(pr.x - dirX * 24, airY - dirY * 24 * ISO_Y, 6)
        g.fillStyle(0xfef08a, 0.9)
        g.fillCircle(pr.x - dirX * 36, airY - dirY * 36 * ISO_Y, 4)
      } else if (pr.kind === 'pound_ho') {
        texKey = 'fx_zoro_pound_ho'
        scale = 1.18
        tint = 0xffffff
        // Helical Emerald & Enma Violet Cyclone Ribbons + Crescent Afterglow trailing 108 Pound Ho
        const perpX = -dirY
        const perpY = dirX * ISO_Y
        for (let k = 1; k <= 5; k++) {
          const back = k * 22
          const wave = Math.sin(this.animTime * 0.032 + k * 1.4) * 20
          const wx = pr.x - dirX * back + perpX * wave
          const wy = airY - dirY * back * ISO_Y + perpY * wave
          g.fillStyle(k % 2 === 0 ? 0xa855f7 : 0x34d399, 0.8 - k * 0.12)
          g.fillCircle(wx, wy, 8 - k)
        }
        g.lineStyle(5, 0x10b981, 0.72)
        g.lineBetween(pr.x, airY, pr.x - dirX * 92, airY - dirY * 92 * ISO_Y)
        g.lineStyle(3, 0xa855f7, 0.8)
        g.lineBetween(pr.x, airY - 6, pr.x - dirX * 84, airY - dirY * 84 * ISO_Y + 6)
        this.drawKatanaGlintStar(g, pr.x + dirX * 26, airY + dirY * 26 * ISO_Y, 18, 0x6ee7b7, 0.95)
      } else if (pr.kind === 'dismantle') {
        texKey = 'fx_slash_wave'
        scale = 1.05
      } else if (pr.kind === 'narukami_bolt') {
        texKey = 'fx_orb_glow'
        scale = 1.08
        tint = 0x22d3ee
        this.drawJaggedBolt(g, pr.x - dirX * 36, airY - dirY * 36 * ISO_Y, pr.x, airY, 0x22d3ee, 0xfef08a, 8, this.animTime)
      } else if (pr.kind === 'atk_rimuru_water') {
        texKey = 'fx_slash_wave'
        scale = 0.88
        tint = 0x38bdf8
        g.fillStyle(0xbae6fd, 0.85)
        g.fillCircle(pr.x - dirX * 18, airY - dirY * 18 * ISO_Y - 4, 3.2)
        g.fillCircle(pr.x - dirX * 28, airY - dirY * 28 * ISO_Y + 5, 2.5)
      } else if (pr.kind === 'black_flame_wave') {
        texKey = 'fx_rimuru_flame'
        scale = 1.24
        tint = 0xffffff
        // Swirling dark violet & cyan Hellfire ember trail behind Black Flame wave
        for (let k = 1; k <= 4; k++) {
          const bx = pr.x - dirX * (k * 20)
          const by = airY - dirY * (k * 20) * ISO_Y + Math.sin(this.animTime * 0.03 + k) * 9
          g.fillStyle(k % 2 === 0 ? 0x020617 : 0x7e22ce, 0.88 - k * 0.14)
          g.fillCircle(bx, by, 7.5 - k * 1.2)
          g.fillStyle(0x38bdf8, 0.85 - k * 0.15)
          g.fillCircle(bx, by, 3.5 - k * 0.5)
        }
      } else if (pr.kind === 'aiouan_pounce') {
        texKey = 'fx_aiouan_paw'
        scale = 1.15
        tint = 0xffffff
      } else if (pr.kind === 'gojo_red') {
        texKey = 'fx_gojo_red'
        scale = 1.05
        tint = 0xffffff
        g.fillStyle(0xef4444, 0.35)
        g.fillCircle(pr.x - dirX * 16, airY - dirY * 16 * ISO_Y, 12)
      } else if (pr.kind === 'gojo_blue') {
        texKey = 'fx_gojo_blue'
        scale = 1.05
        tint = 0xffffff
        for (let t = 1; t <= 3; t++) {
          g.lineStyle(2.5, 0x38bdf8, 0.82 - t * 0.2)
          g.strokeCircle(pr.x - dirX * (t * 18), airY - dirY * (t * 18) * ISO_Y, 18 - t * 4)
        }
      } else if (pr.kind === 'thanos_reality_shard') {
        texKey = 'fx_orb_glow'
        scale = 1.1
        tint = 0xef4444
        g.fillStyle(0xfef2f2, 0.9)
        g.fillCircle(pr.x - dirX * 14, airY - dirY * 14 * ISO_Y, 4.5)
      }

      // Highlight live Target Lock-On diamond directly on any locked projectile victim
      if (pr.targetId) {
        const lockedActor = this.actors.get(pr.targetId)
        if (lockedActor?.state.alive) {
          const lx = lockedActor.renderX
          const ly = lockedActor.renderY * ISO_Y
          g.lineStyle(3.2, hexToNum(pr.accentColor || pr.color), 0.94)
          g.strokeEllipse(lx, ly, 56, 56 * ISO_Y)
          g.lineBetween(lx - 28, ly, lx + 28, ly)
          g.lineBetween(lx, ly - 20, lx, ly + 20)
        }
      }

      let spr = this.projSpritePool[idx]
      if (!spr) {
        spr = this.add.image(pr.x, airY, texKey).setDepth(9200)
        this.projSpritePool.push(spr)
      } else if (spr.texture.key !== texKey) {
        spr.setTexture(texKey)
      }
      spr
        .setVisible(true)
        .setPosition(pr.x, airY)
        .setRotation(rot)
        .setScale(scale)
        .setTint(tint)
      idx++
    }

    for (let i = idx; i < this.projSpritePool.length; i++) {
      this.projSpritePool[i].setVisible(false)
    }
  }

  private drawAimPreview25D(me: ActorView | undefined): void {
    const g = this.aimGfx
    g.clear()
    if (!me || !me.state.alive) return

    const sx = me.renderX
    const sy = me.renderY * ISO_Y

    if (!this.aimPreview.active) {
      // Subtle passive mouse/aim direction chevron when aiming with mouse on desktop
      if (this.mouseScreen.onCanvas) {
        const cam = this.cameras.main
        const mx = cam.scrollX + this.mouseScreen.x
        const my = cam.scrollY + this.mouseScreen.y
        const dx = mx - sx
        const dy = my - sy
        const d = Math.hypot(dx, dy)
        if (d > 24) {
          const ux = dx / d
          const uy = dy / d
          const px = -uy
          const py = ux
          const tipLen = Math.min(d, 220)
          const tx = sx + ux * tipLen
          const ty = sy + uy * tipLen
          g.lineStyle(2, 0x38bdf8, 0.38)
          g.lineBetween(sx + ux * 36, sy + uy * 36, tx, ty)
          g.lineStyle(2.5, 0x7dd3fc, 0.72)
          g.lineBetween(sx + ux * 58, sy + uy * 58, sx + ux * 42 + px * 16, sy + uy * 42 + py * 16)
          g.lineBetween(sx + ux * 58, sy + uy * 58, sx + ux * 42 - px * 16, sy + uy * 42 - py * 16)
          g.strokeCircle(mx, my, 12)
        }
      }
      return
    }
    const castRange = Math.max(80, this.aimPreview.castRange || 360)
    const aoeRadius = Math.max(24, this.aimPreview.aoeRadius || 60)
    const color = this.aimPreview.cancel ? 0xff3b30 : 0x38bdf8

    // 1. Outer Skill Cast Range Circle around hero (shows exact skill boundary)
    g.fillStyle(color, 0.06)
    g.fillEllipse(sx, sy, castRange * 2, castRange * 2 * ISO_Y)
    g.lineStyle(2.5, color, 0.52)
    g.strokeEllipse(sx, sy, castRange * 2, castRange * 2 * ISO_Y)

    if (this.aimPreview.aimType === 'self') {
      g.fillStyle(color, 0.22)
      g.fillEllipse(sx, sy, aoeRadius * 2, aoeRadius * 2 * ISO_Y)
      g.lineStyle(3, color, 0.95)
      g.strokeEllipse(sx, sy, aoeRadius * 2, aoeRadius * 2 * ISO_Y)
      return
    }

    if (this.aimPreview.aimType === 'lockon') {
      const myTeam = me.state.team
      const targetDist = clamp(this.aimPreview.rangeFactor ?? 1, 0, 1) * castRange
      const aimWorldX = me.renderX + this.aimPreview.dirX * targetDist
      const aimWorldY = me.renderY + this.aimPreview.dirY * targetDist
      let lockedActor: ActorView | undefined
      let bestAimD = Number.POSITIVE_INFINITY
      for (const act of this.actors.values()) {
        if (act.state.id === this.myPlayerId || !act.state.alive) continue
        if (myTeam && myTeam !== 'ffa' && act.state.team === myTeam) continue
        if (Math.hypot(act.renderX - me.renderX, act.renderY - me.renderY) > castRange + 22) continue
        const ad = Math.hypot(act.renderX - aimWorldX, act.renderY - aimWorldY)
        if (ad < bestAimD) {
          bestAimD = ad
          lockedActor = act
        }
      }
      const lx = lockedActor ? lockedActor.renderX : aimWorldX
      const ly = (lockedActor ? lockedActor.renderY : aimWorldY) * ISO_Y
      const lockCol = this.aimPreview.cancel ? 0xff3b30 : lockedActor ? 0xfacc15 : 0xc084fc
      g.lineStyle(3, lockCol, 0.86)
      g.lineBetween(sx, sy, lx, ly)
      g.fillStyle(lockCol, 0.24)
      g.fillEllipse(lx, ly, aoeRadius * 1.15, aoeRadius * 1.15 * ISO_Y)
      g.lineStyle(3.5, lockCol, 0.98)
      g.strokeEllipse(lx, ly, lockedActor ? 62 : aoeRadius, (lockedActor ? 62 : aoeRadius) * ISO_Y)
      g.lineBetween(lx - 26, ly, lx + 26, ly)
      g.lineBetween(lx, ly - 18, lx, ly + 18)
      return
    }

    if (this.aimPreview.aimType === 'ground') {
      const targetDist = clamp(this.aimPreview.rangeFactor ?? 1, 0, 1) * castRange
      const tx = sx + this.aimPreview.dirX * targetDist
      const ty = sy + this.aimPreview.dirY * targetDist * ISO_Y

      // Trajectory tether + movable Ground Placement Circle
      g.lineStyle(3, color, 0.72)
      g.lineBetween(sx, sy, tx, ty)
      g.fillStyle(color, 0.24)
      g.fillEllipse(tx, ty, aoeRadius * 2, aoeRadius * 2 * ISO_Y)
      g.lineStyle(3, color, 0.96)
      g.strokeEllipse(tx, ty, aoeRadius * 2, aoeRadius * 2 * ISO_Y)
      g.lineStyle(2, 0xffffff, 0.85)
      g.lineBetween(tx - 10, ty, tx + 10, ty)
      g.lineBetween(tx, ty - 8, tx, ty + 8)
      return
    }

    if (this.aimPreview.aimType === 'cone') {
      const baseAng = Math.atan2(this.aimPreview.dirY, this.aimPreview.dirX)
      for (const angOff of [-0.34, 0, 0.34]) {
        const ax = sx + Math.cos(baseAng + angOff) * castRange
        const ay = sy + Math.sin(baseAng + angOff) * castRange * ISO_Y
        g.lineStyle(angOff === 0 ? 4 : 2.5, color, 0.82)
        g.lineBetween(sx, sy, ax, ay)
      }
      g.lineStyle(2.5, color, 0.9)
      g.beginPath()
      for (let i = 0; i <= 12; i++) {
        const a = baseAng - 0.34 + (0.68 * i) / 12
        const px = sx + Math.cos(a) * castRange
        const py = sy + Math.sin(a) * castRange * ISO_Y
        if (i === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.strokePath()
      return
    }

    // Directional line skill corridor matching exact skill CastRange + width
    const ex = sx + this.aimPreview.dirX * castRange
    const ey = sy + this.aimPreview.dirY * castRange * ISO_Y
    g.lineStyle(Math.max(12, aoeRadius * 1.1), color, 0.22)
    g.lineBetween(sx, sy, ex, ey)
    g.lineStyle(4, color, 0.88)
    g.lineBetween(sx, sy, ex, ey)
    g.fillStyle(color, 0.35)
    g.fillEllipse(ex, ey, Math.max(36, aoeRadius), Math.max(36, aoeRadius) * ISO_Y)
    g.lineStyle(2.5, color, 0.95)
    g.strokeEllipse(ex, ey, Math.max(36, aoeRadius), Math.max(36, aoeRadius) * ISO_Y)
  }

  private loadMinimapPortraitTextures(): void {
    for (const [charId, url] of Object.entries(MINIMAP_PORTRAIT_URLS)) {
      const texKey = `mm_face_${charId}`
      if (this.textures.exists(texKey)) continue
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (!this.sys.isActive() || this.textures.exists(texKey)) return
        const size = 64
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.save()
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.clip()
        ctx.fillStyle = '#0F172A'
        ctx.fillRect(0, 0, size, size)

        const side = Math.min(img.width, img.height)
        const sx = Math.max(0, (img.width - side) * 0.5)
        const sy = Math.max(0, (img.height - side) * 0.14)
        ctx.drawImage(img, sx, sy, side, side, 2, 2, size - 4, size - 4)
        ctx.restore()

        this.textures.addCanvas(texKey, canvas)
      }
      img.src = url
    }
  }

  private drawMinimap(): void {
    const g = this.minimapGfx
    const rg = this.minimapRingGfx
    rg.clear()

    const viewW = this.cameras.main.width
    const viewH = this.cameras.main.height
    const portraitNarrow = viewW < 640
    const compactPhone = portraitNarrow || viewH < 520 || viewW < 780
    // Place Tactical Minimap Top-Left in RoV / MLBB style!
    const mmW = portraitNarrow ? 88 : compactPhone ? 112 : viewW < 1080 ? 148 : 176
    const mmH = Math.round((mmW * this.mapCfg.height) / this.mapCfg.width)
    const mmX = portraitNarrow ? 8 : 12
    const mmY = 8
    this.minimapRect = { x: mmX, y: mmY, w: mmW, h: mmH }

    const sx = mmW / this.mapCfg.width
    const sy = mmH / this.mapCfg.height
    const isKonoha = this.mapCfg.id === 'konoha'
    const bgKey = `${this.mapCfg.id}:${viewW}:${viewH}:${mmW}:${mmH}:${this.mapCfg.pillars?.length ?? 0}`

    // Re-bake rounded radar panel & static pillars ONLY when dimensions/map change
    if (this.minimapBgKey !== bgKey) {
      this.minimapBgKey = bgKey
      g.clear()
      g.fillStyle(isKonoha ? 0x1c2b1e : 0x0f172a, 0.88)
      g.fillRoundedRect(mmX, mmY, mmW, mmH, 10)
      g.lineStyle(2, isKonoha ? 0xfacc15 : 0x38bdf8, 0.85)
      g.strokeRoundedRect(mmX, mmY, mmW, mmH, 10)

      // Subtle radar sector crosshair
      g.lineStyle(1, 0x94a3b8, 0.25)
      g.lineBetween(mmX + mmW / 2, mmY, mmX + mmW / 2, mmY + mmH)
      g.lineBetween(mmX, mmY + mmH / 2, mmX + mmW, mmY + mmH / 2)

      for (const pil of this.mapCfg.pillars ?? []) {
        g.fillStyle(isKonoha ? 0xd97706 : 0xcbd5e1, 0.9)
        g.fillCircle(mmX + pil.x * sx, mmY + pil.y * sy, Math.max(2.5, pil.radius * sx))
      }
    }

    // Remove stale minimap portrait sprites for disconnected players
    for (const [id, img] of this.minimapPortraits.entries()) {
      if (!this.actors.has(id)) {
        img.destroy()
        this.minimapPortraits.delete(id)
      }
    }

    const myTeam = this.actors.get(this.myPlayerId)?.state.team
    for (const actor of this.actors.values()) {
      const p = actor.state
      let faceImg = this.minimapPortraits.get(p.id)
      if (!p.alive) {
        if (faceImg) faceImg.setVisible(false)
        continue
      }

      const isMe = p.id === this.myPlayerId
      const isAlly =
        isMe || (myTeam && myTeam !== 'ffa' && p.team === myTeam)
      const iconSize = compactPhone ? (isMe ? 18 : 15) : isMe ? 22 : 18
      const half = iconSize * 0.5
      const px = clamp(mmX + actor.renderX * sx, mmX + half + 2, mmX + mmW - half - 2)
      const py = clamp(mmY + actor.renderY * sy, mmY + half + 2, mmY + mmH - half - 2)
      const texKey = `mm_face_${p.characterId}`

      if (this.textures.exists(texKey)) {
        if (!faceImg) {
          faceImg = this.add.image(px, py, texKey).setScrollFactor(0)
          this.minimapPortraits.set(p.id, faceImg)
        } else if (faceImg.texture.key !== texKey) {
          faceImg.setTexture(texKey)
        }
        faceImg
          .setVisible(true)
          .setPosition(px, py)
          .setDisplaySize(iconSize, iconSize)
          .setDepth(isMe ? 20003 : 20002)
      } else {
        rg.fillStyle(hexToNum(p.color), 1)
        rg.fillCircle(px, py, half * 0.6)
      }

      if (isMe) {
        rg.lineStyle(2.5, 0x22d3ee, 1)
        rg.strokeCircle(px, py, half + 1)
        rg.lineStyle(1.5, 0xffffff, 1)
        rg.strokeCircle(px, py, half - 0.5)
      } else if (isAlly) {
        rg.lineStyle(2, 0x38bdf8, 0.95)
        rg.strokeCircle(px, py, half + 0.5)
      } else {
        rg.lineStyle(2.2, 0xef4444, 0.95)
        rg.strokeCircle(px, py, half + 0.5)
      }
    }

    // RoV/MLBB Camera Viewport Frame on Minimap (highlights gold while panning/scouting)
    const camViewW = this.cameras.main.width * sx
    const camViewH = (this.cameras.main.height / ISO_Y) * sy
    const camBoxX = clamp(mmX + this.camX * sx, mmX + 1, mmX + mmW - Math.min(mmW - 2, camViewW))
    const camBoxY = clamp(mmY + (this.camY / ISO_Y) * sy, mmY + 1, mmY + mmH - Math.min(mmH - 2, camViewH))
    rg.lineStyle(
      this.cameraPeek.active ? 2 : 1.3,
      this.cameraPeek.active ? 0xfacc15 : 0xe2e8f0,
      this.cameraPeek.active ? 0.95 : 0.6,
    )
    rg.strokeRect(camBoxX, camBoxY, Math.min(mmW - 2, camViewW), Math.min(mmH - 2, camViewH))
  }
}
