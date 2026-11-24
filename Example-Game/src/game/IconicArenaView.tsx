import { memo, useEffect, useRef } from 'react'
import { setIconicCameraBasis, useGameStore } from '../store/useGameStore'
import type { BeamEffect, MapConfig, PlayerState, Projectile, ZoneEffect } from '../types/game'
import { gameEventBus, type AimPreviewPayload } from './core/eventBus'
import { getHeroArenaCursorCss } from './heroAimThemes'

interface SparkParticle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  color: string
  size: number
  life: number
  maxLife: number
}

interface FloatingTag3D {
  x: number
  y: number
  z: number
  text: string
  color: string
  life: number
  maxLife: number
}

interface Camera3D {
  camX: number
  camY: number
  camH: number
  fx: number
  fy: number
  rx: number
  ry: number
  w: number
  h: number
  horizonY: number
  focal: number
}

const DEFAULT_MAP: MapConfig = {
  id: 'shibuya',
  name: 'ชิบูย่า (Shibuya Incident)',
  width: 3000,
  height: 1800,
  playerRadius: 18,
  moveSpeed: 255,
  pillars: [],
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function projectPoint(
  cam: Camera3D,
  wx: number,
  wy: number,
  wz: number,
): { sx: number; sy: number; scale: number; depth: number } | null {
  const dx = wx - cam.camX
  const dy = wy - cam.camY
  const depth = dx * cam.fx + dy * cam.fy
  if (depth < 28) return null
  const side = dx * cam.rx + dy * cam.ry
  const scale = cam.focal / depth
  return {
    sx: cam.w * 0.5 + side * scale,
    sy: cam.horizonY + (cam.camH - wz) * scale,
    scale,
    depth,
  }
}

function drawPerspectiveSegment(
  ctx: CanvasRenderingContext2D,
  cam: Camera3D,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): void {
  let dx1 = x1 - cam.camX
  let dy1 = y1 - cam.camY
  let d1 = dx1 * cam.fx + dy1 * cam.fy
  let dx2 = x2 - cam.camX
  let dy2 = y2 - cam.camY
  let d2 = dx2 * cam.fx + dy2 * cam.fy

  const near = 36
  if (d1 < near && d2 < near) return
  let ax = x1
  let ay = y1
  let az = z1
  let bx = x2
  let by = y2
  let bz = z2
  if (d1 < near) {
    const t = (near - d1) / (d2 - d1)
    ax = x1 + (x2 - x1) * t
    ay = y1 + (y2 - y1) * t
    az = z1 + (z2 - z1) * t
    dx1 = ax - cam.camX
    dy1 = ay - cam.camY
    d1 = near
  } else if (d2 < near) {
    const t = (near - d2) / (d1 - d2)
    bx = x2 + (x1 - x2) * t
    by = y2 + (y1 - y2) * t
    bz = z2 + (z1 - z2) * t
    dx2 = bx - cam.camX
    dy2 = by - cam.camY
    d2 = near
  }

  const s1 = cam.focal / d1
  const s2 = cam.focal / d2
  const side1 = dx1 * cam.rx + dy1 * cam.ry
  const side2 = dx2 * cam.rx + dy2 * cam.ry
  ctx.moveTo(cam.w * 0.5 + side1 * s1, cam.horizonY + (cam.camH - az) * s1)
  ctx.lineTo(cam.w * 0.5 + side2 * s2, cam.horizonY + (cam.camH - bz) * s2)
}

function unprojectToFloor(
  cam: Camera3D,
  sx: number,
  sy: number,
  mapCfg: MapConfig,
): { wx: number; wy: number } | null {
  const denom = sy - cam.horizonY
  if (denom <= 6) return null
  const depth = clamp((cam.camH * cam.focal) / denom, 40, 2600)
  const side = ((sx - cam.w * 0.5) * depth) / cam.focal
  return {
    wx: clamp(cam.camX + depth * cam.fx + side * cam.rx, 0, mapCfg.width),
    wy: clamp(cam.camY + depth * cam.fy + side * cam.ry, 0, mapCfg.height),
  }
}

function drawGroundRing3D(
  ctx: CanvasRenderingContext2D,
  cam: Camera3D,
  cx: number,
  cy: number,
  radius: number,
  fillStyle: string | CanvasGradient | null,
  strokeStyle: string | null,
  lineWidth = 2,
  segments = 32,
): void {
  const pts: Array<{ sx: number; sy: number }> = []
  for (let i = 0; i <= segments; i++) {
    const ang = (i / segments) * Math.PI * 2
    const wx = cx + Math.cos(ang) * radius
    const wy = cy + Math.sin(ang) * radius
    const p = projectPoint(cam, wx, wy, 1)
    if (p) pts.push({ sx: p.sx, sy: p.sy })
  }
  if (pts.length < 3) return
  ctx.beginPath()
  ctx.moveTo(pts[0].sx, pts[0].sy)
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].sx, pts[i].sy)
  }
  ctx.closePath()
  if (fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.fill()
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}

export const IconicArenaView = memo(function IconicArenaView() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    host.appendChild(canvas)

    const mainCtx = canvas.getContext('2d', { alpha: false })
    if (!mainCtx) return
    let ctx: CanvasRenderingContext2D = mainCtx
    const graphicsQuality = useGameStore.getState().graphicsQuality
    const isPixelScale = graphicsQuality === 'pixel' || graphicsQuality === 'fine_pixel'
    const pixelDivisor = graphicsQuality === 'fine_pixel' ? 1.75 : 3
    const pixelCanvas = document.createElement('canvas')
    const pixelCtx = pixelCanvas.getContext('2d', { alpha: false })
    type HeroNameplateJob = {
      sx: number
      sy: number
      wPx: number
      hPx: number
      p: PlayerState
      isMe: boolean
      isGojo: boolean
    }
    const heroLabels: HeroNameplateJob[] = []

    let mapCfg: MapConfig = DEFAULT_MAP
    let myPlayerId = ''
    const smoothPlayers = new Map<
      string,
      PlayerState & { renderX: number; renderY: number; prevHp: number; flash: number }
    >()
    let projectiles: Projectile[] = []
    let beams: BeamEffect[] = []
    let zones: ZoneEffect[] = []
    const projTrails = new Map<string, Array<{ x: number; y: number }>>()
    const particles: SparkParticle[] = []
    const floatingTags: FloatingTag3D[] = []
    const ambientEmbers = Array.from({ length: 42 }, (_, idx) => ({
      xNorm: (idx * 0.137) % 1,
      yNorm: (idx * 0.293) % 1,
      speed: 0.04 + ((idx * 17) % 9) * 0.012,
      size: 1.4 + (idx % 3) * 0.9,
      isRed: idx % 2 === 0,
    }))
    const skylineTowers = Array.from({ length: 24 }, (_, idx) => ({
      posNorm: idx / 24,
      wNorm: 0.025 + ((idx * 7) % 5) * 0.008,
      hRatio: 0.08 + ((idx * 13) % 11) * 0.018,
      tilt: ((idx % 5) - 2) * 0.012,
      neon: idx % 3 === 0 ? '#38BDF8' : idx % 3 === 1 ? '#EF4444' : '#A855F7',
    }))

    let camBasis = { fx: 1, fy: 0 }
    let camEye = { x: 750, y: 900 }
    let latestCam: Camera3D | null = null
    let pointerFloor = { x: 1500, y: 900, active: false }
    let aimPreview: AimPreviewPayload = {
      active: false,
      slot: 1,
      dirX: 0,
      dirY: -1,
      rangeFactor: 1,
      castRange: 360,
      aoeRadius: 72,
      aimType: 'line',
      cancel: false,
    }
    let shakePower = 0
    let flashOverlay = 0
    let flashColor = '#ffffff'
    let disposed = false
    let rafId = 0
    let lastTs = performance.now()
    let fpsFrames = 0
    let fpsAcc = 0

    const resize = () => {
      const nativeDpr = window.devicePixelRatio || 1
      const dpr =
        graphicsQuality === 'pixel'
          ? 1
          : graphicsQuality === 'ultra'
            ? Math.min(1.65, nativeDpr)
            : Math.min(1.35, nativeDpr)
      const w = Math.max(320, host.clientWidth || window.innerWidth)
      const h = Math.max(240, host.clientHeight || window.innerHeight)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.imageRendering = isPixelScale ? 'pixelated' : 'auto'
      mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const spawnBurst = (x: number, y: number, z: number, color: string, count: number, speed = 180) => {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4
        const spd = speed * (0.4 + Math.random() * 0.8)
        particles.push({
          x,
          y,
          z,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          vz: 60 + Math.random() * 140,
          color,
          size: 2.2 + Math.random() * 3.5,
          life: 0.45 + Math.random() * 0.35,
          maxLife: 0.75,
        })
      }
      if (particles.length > 260) {
        particles.splice(0, particles.length - 260)
      }
    }

    let lastIconicCursorChar = ''
    const syncRoster = (list: PlayerState[]) => {
      const seen = new Set<string>()
      for (const raw of list) {
        seen.add(raw.id)
        if (raw.id === myPlayerId && raw.characterId !== lastIconicCursorChar) {
          lastIconicCursorChar = raw.characterId
          canvas.style.cursor = getHeroArenaCursorCss(raw.characterId)
        }
        const prev = smoothPlayers.get(raw.id)
        if (!prev) {
          smoothPlayers.set(raw.id, {
            ...raw,
            renderX: raw.x,
            renderY: raw.y,
            prevHp: raw.hp,
            flash: 0,
          })
          continue
        }
        if (raw.hp < prev.prevHp) {
          const dmg = prev.prevHp - raw.hp
          prev.flash = 1
          spawnBurst(raw.x, raw.y, 44, raw.id === myPlayerId ? '#FB7185' : '#7DD3FC', 12, 160)
          floatingTags.push({
            x: raw.x,
            y: raw.y,
            z: 86,
            text: `-${dmg}`,
            color: raw.id === myPlayerId ? '#FCA5A5' : '#FEF08A',
            life: 0.9,
            maxLife: 0.9,
          })
          shakePower = Math.max(shakePower, 5)
        } else if (raw.hp > prev.prevHp && raw.alive && prev.alive) {
          const heal = raw.hp - prev.prevHp
          spawnBurst(raw.x, raw.y, 28, '#34D399', 18, 195)
          floatingTags.push({
            x: raw.x,
            y: raw.y,
            z: 92,
            text: `+${heal} HP (RCT)`,
            color: '#6EE7B7',
            life: 1.05,
            maxLife: 1.05,
          })
        }
        if (Math.hypot(raw.x - prev.renderX, raw.y - prev.renderY) > 260) {
          prev.renderX = raw.x
          prev.renderY = raw.y
        }
        Object.assign(prev, raw, { prevHp: raw.hp })
      }
      for (const id of smoothPlayers.keys()) {
        if (!seen.has(id)) smoothPlayers.delete(id)
      }
    }

    const unsubInit = gameEventBus.onInit((payload) => {
      myPlayerId = payload.myPlayerId
      mapCfg = payload.mapCfg || DEFAULT_MAP
      projectiles = payload.projectiles ?? []
      beams = payload.beams ?? []
      zones = payload.zones ?? []
      syncRoster(payload.players)
      gameEventBus.emitSceneReady()
    })

    const unsubSync = gameEventBus.onSync((payload) => {
      projectiles = payload.projectiles ?? []
      beams = payload.beams ?? []
      zones = payload.zones ?? []
      syncRoster(payload.players)
      for (const pr of projectiles) {
        if (pr.kind === 'hollow_purple') {
          shakePower = Math.max(shakePower, 7)
        }
        const tr = projTrails.get(pr.id) ?? []
        tr.push({ x: pr.x, y: pr.y })
        if (tr.length > 10) tr.shift()
        projTrails.set(pr.id, tr)
      }
      const activeIds = new Set(projectiles.map((p) => p.id))
      for (const k of projTrails.keys()) {
        if (!activeIds.has(k)) projTrails.delete(k)
      }
    })

    const unsubClash = gameEventBus.onDomainClash(() => {
      shakePower = 18
      flashColor = '#E0F2FE'
      flashOverlay = 0.85
    })

    const unsubDied = gameEventBus.onDied((ev) => {
      spawnBurst(ev.x, ev.y, 40, '#EF4444', 28, 280)
      shakePower = Math.max(shakePower, 14)
    })

    const unsubAimPreview = gameEventBus.onAimPreview((preview) => {
      aimPreview = preview
    })

    const handleCanvasPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !latestCam) return
      const rect = canvas.getBoundingClientRect()
      const sx = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * latestCam.w : 0
      const sy = rect.height > 0 ? ((e.clientY - rect.top) / rect.height) * latestCam.h : 0
      const hit = unprojectToFloor(latestCam, sx, sy, mapCfg)
      if (hit) {
        pointerFloor = { x: hit.wx, y: hit.wy, active: true }
        gameEventBus.emitAimMove({ worldX: hit.wx, worldY: hit.wy, active: true })
      }
    }

    const handleCanvasPointerLeave = () => {
      if (pointerFloor.active) {
        pointerFloor.active = false
        gameEventBus.emitAimMove({ worldX: 0, worldY: 0, active: false })
      }
    }

    const handleCanvasPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const me = smoothPlayers.get(myPlayerId)
      if (!me) return
      if (e.pointerType !== 'touch' && latestCam) {
        const rect = canvas.getBoundingClientRect()
        const sx = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * latestCam.w : 0
        const sy = rect.height > 0 ? ((e.clientY - rect.top) / rect.height) * latestCam.h : 0
        const hit = unprojectToFloor(latestCam, sx, sy, mapCfg)
        if (hit) {
          pointerFloor = { x: hit.wx, y: hit.wy, active: true }
          gameEventBus.emitAimMove({ worldX: hit.wx, worldY: hit.wy, active: true })
          useGameStore.getState().castBasicAttack({ worldX: hit.wx, worldY: hit.wy })
          return
        }
      }
      let enemy: PlayerState | undefined
      for (const p of smoothPlayers.values()) {
        if (p.id !== myPlayerId && p.alive) {
          enemy = p
          break
        }
      }
      const tx = enemy ? enemy.x : me.renderX + camBasis.fx * 180
      const ty = enemy ? enemy.y : me.renderY + camBasis.fy * 180
      useGameStore.getState().castBasicAttack({ worldX: tx, worldY: ty })
    }
    canvas.addEventListener('pointermove', handleCanvasPointerMove)
    canvas.addEventListener('pointerleave', handleCanvasPointerLeave)
    canvas.addEventListener('pointerdown', handleCanvasPointerDown)

    const drawOverShoulderHero = (
      cam: Camera3D,
      p: PlayerState & { renderX: number; renderY: number; flash: number },
      isMe: boolean,
      timeSec: number,
    ) => {
      const zFloat = p.seated ? 18 : 0
      const foot = projectPoint(cam, p.renderX, p.renderY, zFloat)
      if (!foot) return
      const head = projectPoint(cam, p.renderX, p.renderY, zFloat + 96)
      const hPx = head ? clamp(foot.sy - head.sy, 22, isMe ? 210 : 175) : clamp(96 * foot.scale, 22, 195)
      const wPx = hPx * 0.54
      const cx = foot.sx
      const by = foot.sy
      const bob = Math.sin(timeSec * (Math.hypot(p.dx, p.dy) > 0.1 ? 14 : 3.2)) * hPx * 0.025
      const isGojo = p.characterId === 'sia_mon'

      ctx.save()
      ctx.globalAlpha = p.alive ? 1 : 0.25

      // Ground aura & cast shadow
      ctx.fillStyle = 'rgba(2, 6, 23, 0.62)'
      ctx.beginPath()
      ctx.ellipse(cx, by, wPx * 0.68, hPx * 0.13, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = isGojo ? 'rgba(56, 189, 248, 0.72)' : 'rgba(239, 68, 68, 0.75)'
      ctx.lineWidth = Math.max(1.5, hPx * 0.024)
      ctx.beginPath()
      ctx.ellipse(cx, by, wPx * (0.78 + Math.sin(timeSec * 4) * 0.04), hPx * 0.16, 0, 0, Math.PI * 2)
      ctx.stroke()

      if (p.invulnerable) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.2)'
        ctx.strokeStyle = '#FACC15'
        ctx.beginPath()
        ctx.ellipse(cx, by - hPx * 0.5, wPx * 0.9, hPx * 0.62, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }

      // Draw hero body (Detailed Anime Back Rig for Self vs Front Duel Glare for Opponent!)
      ctx.translate(cx, by + bob)
      if (isGojo) {
        // Limitless ambient cyan glow behind/around Gojo
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const gGlow = ctx.createRadialGradient(0, -hPx * 0.58, hPx * 0.05, 0, -hPx * 0.58, hPx * 0.82)
        gGlow.addColorStop(0, 'rgba(56, 189, 248, 0.34)')
        gGlow.addColorStop(0.55, 'rgba(99, 102, 241, 0.16)')
        gGlow.addColorStop(1, 'rgba(15, 23, 42, 0)')
        ctx.fillStyle = gGlow
        ctx.beginPath()
        ctx.arc(0, -hPx * 0.58, hPx * 0.82, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Jujutsu High dark navy overcoat + legs
        ctx.fillStyle = '#090F24'
        ctx.beginPath()
        ctx.moveTo(-wPx * 0.36, -hPx * 0.06)
        ctx.lineTo(-wPx * 0.44, -hPx * 0.66)
        ctx.lineTo(wPx * 0.44, -hPx * 0.66)
        ctx.lineTo(wPx * 0.36, -hPx * 0.06)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#38BDF8'
        ctx.lineWidth = Math.max(1.2, hPx * 0.018)
        ctx.stroke()

        // High collar & shoulder rim highlight
        ctx.fillStyle = '#111C3D'
        ctx.fillRect(-wPx * 0.22, -hPx * 0.74, wPx * 0.44, hPx * 0.12)

        // Head & spiky glowing snow-white anime hair
        ctx.fillStyle = isMe ? '#E2E8F0' : '#FDE6D8'
        ctx.beginPath()
        ctx.arc(0, -hPx * 0.82, wPx * 0.25, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#F8FAFC'
        ctx.beginPath()
        const spikes = 9
        for (let i = 0; i < spikes; i++) {
          const ang = Math.PI + (i / (spikes - 1)) * Math.PI
          const rSpike = wPx * (i % 2 === 0 ? 0.42 : 0.31)
          const px = Math.cos(ang) * rSpike
          const py = -hPx * 0.83 + Math.sin(ang) * rSpike * 1.1
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#38BDF8'
        ctx.stroke()

        if (!isMe) {
          // Piercing electric Six Eyes facing you across Shibuya!
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = '#22D3EE'
          ctx.beginPath()
          ctx.ellipse(-wPx * 0.09, -hPx * 0.8, wPx * 0.055, hPx * 0.024, 0, 0, Math.PI * 2)
          ctx.ellipse(wPx * 0.09, -hPx * 0.8, wPx * 0.055, hPx * 0.024, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        } else {
          // Floating Red & Blue Limitless micro-orbs beside hero shoulders from behind
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          const orbOffY = Math.sin(timeSec * 3.4) * hPx * 0.04
          ctx.fillStyle = '#EF4444'
          ctx.beginPath()
          ctx.arc(wPx * 0.68, -hPx * 0.56 + orbOffY, wPx * 0.09, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#38BDF8'
          ctx.beginPath()
          ctx.arc(-wPx * 0.68, -hPx * 0.56 - orbOffY, wPx * 0.09, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      } else {
        // Ryomen Sukuna: crimson cursed aura + traditional dark robe & black obi sash
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const sGlow = ctx.createRadialGradient(0, -hPx * 0.58, hPx * 0.06, 0, -hPx * 0.58, hPx * 0.86)
        sGlow.addColorStop(0, 'rgba(220, 38, 38, 0.36)')
        sGlow.addColorStop(0.55, 'rgba(127, 29, 29, 0.2)')
        sGlow.addColorStop(1, 'rgba(15, 23, 42, 0)')
        ctx.fillStyle = sGlow
        ctx.beginPath()
        ctx.arc(0, -hPx * 0.58, hPx * 0.86, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Haori / King of Curses kimono + crimson accent collar + black obi sash
        ctx.fillStyle = '#1E1118'
        ctx.beginPath()
        ctx.moveTo(-wPx * 0.38, -hPx * 0.06)
        ctx.lineTo(-wPx * 0.48, -hPx * 0.67)
        ctx.lineTo(wPx * 0.48, -hPx * 0.67)
        ctx.lineTo(wPx * 0.38, -hPx * 0.06)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#DC2626'
        ctx.lineWidth = Math.max(1.3, hPx * 0.02)
        ctx.stroke()

        // Black belt obi sash + crimson back trim
        ctx.fillStyle = '#09090B'
        ctx.fillRect(-wPx * 0.36, -hPx * 0.38, wPx * 0.72, hPx * 0.1)
        ctx.fillStyle = '#991B1B'
        ctx.fillRect(-wPx * 0.14, -hPx * 0.67, wPx * 0.28, hPx * 0.28)

        // Spiky pink/black Sukuna hair + head
        ctx.fillStyle = isMe ? '#E5989B' : '#F3C5B6'
        ctx.beginPath()
        ctx.arc(0, -hPx * 0.82, wPx * 0.25, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#FB7185'
        ctx.beginPath()
        const spikes = 9
        for (let i = 0; i < spikes; i++) {
          const ang = Math.PI + (i / (spikes - 1)) * Math.PI
          const rSpike = wPx * (i % 2 === 0 ? 0.41 : 0.29)
          const px = Math.cos(ang) * rSpike
          const py = -hPx * 0.83 + Math.sin(ang) * rSpike * 1.05
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#18181B'
        ctx.stroke()

        if (!isMe) {
          // Four glowing crimson Sukuna eyes + cursed forehead mark facing you
          ctx.fillStyle = '#09090B'
          ctx.fillRect(-wPx * 0.14, -hPx * 0.9, wPx * 0.28, hPx * 0.03)
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = '#EF4444'
          ctx.beginPath()
          ctx.arc(-wPx * 0.09, -hPx * 0.81, wPx * 0.032, 0, Math.PI * 2)
          ctx.arc(wPx * 0.09, -hPx * 0.81, wPx * 0.032, 0, Math.PI * 2)
          ctx.arc(-wPx * 0.11, -hPx * 0.77, wPx * 0.022, 0, Math.PI * 2)
          ctx.arc(wPx * 0.11, -hPx * 0.77, wPx * 0.022, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        } else {
          // Black wrist curse bands & floating cursed blade gleam on shoulders
          ctx.strokeStyle = '#F87171'
          ctx.lineWidth = Math.max(1.4, hPx * 0.022)
          ctx.beginPath()
          ctx.arc(0, -hPx * 0.52, wPx * 0.72, Math.PI * 1.1, Math.PI * 1.9)
          ctx.stroke()
        }
      }

      if (p.flash > 0.05) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, p.flash * 0.65)})`
        ctx.beginPath()
        ctx.arc(0, -hPx * 0.55, wPx * 0.62, 0, Math.PI * 2)
        ctx.fill()
      }

      heroLabels.push({
        sx: cx,
        sy: by + bob,
        wPx,
        hPx,
        p,
        isMe,
        isGojo,
      })
      ctx.restore()
    }

    const frame = (nowTs: number) => {
      if (disposed) return
      const dt = clamp((nowTs - lastTs) / 1000, 0.001, 0.05)
      lastTs = nowTs
      const timeSec = nowTs * 0.001

      fpsFrames++
      fpsAcc += dt
      if (fpsAcc >= 0.45) {
        gameEventBus.emitFPS(Math.round(fpsFrames / fpsAcc))
        fpsFrames = 0
        fpsAcc = 0
      }

      // Smooth hero positions
      for (const p of smoothPlayers.values()) {
        p.renderX += (p.x - p.renderX) * Math.min(1, dt * 16)
        p.renderY += (p.y - p.renderY) * Math.min(1, dt * 16)
        p.flash = Math.max(0, p.flash - dt * 5)
      }

      const w = host.clientWidth || window.innerWidth
      const h = host.clientHeight || window.innerHeight
      const me = smoothPlayers.get(myPlayerId)
      let enemy: (PlayerState & { renderX: number; renderY: number }) | undefined
      for (const p of smoothPlayers.values()) {
        if (p.id !== myPlayerId) {
          enemy = p
          break
        }
      }

      // Compute Over-The-Shoulder Camera Vector F = from Self -> Enemy!
      if (me) {
        let tx = me.aimDx || 1
        let ty = me.aimDy || 0
        if (enemy && enemy.alive) {
          const dx = enemy.renderX - me.renderX
          const dy = enemy.renderY - me.renderY
          const d = Math.hypot(dx, dy)
          if (d > 12) {
            tx = dx / d
            ty = dy / d
          }
        }
        camBasis.fx += (tx - camBasis.fx) * Math.min(1, dt * 10)
        camBasis.fy += (ty - camBasis.fy) * Math.min(1, dt * 10)
        const bm = Math.hypot(camBasis.fx, camBasis.fy) || 1
        camBasis.fx /= bm
        camBasis.fy /= bm
        setIconicCameraBasis(camBasis.fx, camBasis.fy)

        const targetCamX = me.renderX - camBasis.fx * 250
        const targetCamY = me.renderY - camBasis.fy * 250
        camEye.x += (targetCamX - camEye.x) * Math.min(1, dt * 12)
        camEye.y += (targetCamY - camEye.y) * Math.min(1, dt * 12)
      }

      shakePower = Math.max(0, shakePower - dt * 26)
      flashOverlay = Math.max(0, flashOverlay - dt * 2.4)
      const shakeX = (Math.random() - 0.5) * shakePower
      const shakeY = (Math.random() - 0.5) * shakePower

      const cam: Camera3D = {
        camX: camEye.x,
        camY: camEye.y,
        camH: 146,
        fx: camBasis.fx,
        fy: camBasis.fy,
        rx: -camBasis.fy,
        ry: camBasis.fx,
        w,
        h,
        horizonY: h * 0.34 + shakeY,
        focal: h * 1.12,
      }
      latestCam = cam

      const voidActive = zones.some((z) => z.kind === 'infinite_void' && z.life > 0)
      const shrineActive = zones.some((z) => z.kind === 'malevolent_shrine' && z.life > 0)

      heroLabels.length = 0
      const useLowResPixel = isPixelScale && Boolean(pixelCtx)
      if (useLowResPixel && pixelCtx) {
        const pw = Math.max(240, Math.floor(w / pixelDivisor))
        const ph = Math.max(135, Math.floor(h / pixelDivisor))
        if (pixelCanvas.width !== pw || pixelCanvas.height !== ph) {
          pixelCanvas.width = pw
          pixelCanvas.height = ph
        }
        ctx = pixelCtx
        ctx.setTransform(pw / w, 0, 0, ph / h, 0, 0)
      } else {
        ctx = mainCtx
      }

      ctx.save()
      ctx.translate(shakeX, 0)

      // 1. Dynamic Shibuya Sky Horizon (Reacts to Gojo Infinite Void & Sukuna Malevolent Shrine!)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, cam.horizonY + 24)
      if (voidActive) {
        skyGrad.addColorStop(0, '#0F172A')
        skyGrad.addColorStop(0.55, '#312E81')
        skyGrad.addColorStop(1, '#38BDF8')
      } else if (shrineActive) {
        skyGrad.addColorStop(0, '#2A0A12')
        skyGrad.addColorStop(0.55, '#7F1D1D')
        skyGrad.addColorStop(1, '#F87171')
      } else {
        skyGrad.addColorStop(0, '#1A2744')
        skyGrad.addColorStop(0.55, '#2C3E66')
        skyGrad.addColorStop(1, '#583A5E')
      }
      ctx.fillStyle = skyGrad
      ctx.fillRect(-30, 0, w + 60, cam.horizonY + 30)

      // Eclipse Blood/Infinity Moon orb in sky
      const moonX = w * 0.5 + (cam.rx * 0.12 - cam.fx * 0.08) * w * 0.35
      const moonY = cam.horizonY * 0.44
      const moonR = Math.min(w, h) * 0.09
      const moonGrad = ctx.createRadialGradient(moonX, moonY, moonR * 0.2, moonX, moonY, moonR * 2.4)
      moonGrad.addColorStop(0, voidActive ? '#E0F2FE' : '#FECACA')
      moonGrad.addColorStop(0.42, voidActive ? 'rgba(56, 189, 248, 0.55)' : 'rgba(220, 38, 38, 0.45)')
      moonGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = moonGrad
      ctx.beginPath()
      ctx.arc(moonX, moonY, moonR * 2.4, 0, Math.PI * 2)
      ctx.fill()

      // Parallax ruined Shibuya skyscraper skyline along horizon
      const yawOffset = Math.atan2(cam.fy, cam.fx) / (Math.PI * 2)
      for (const b of skylineTowers) {
        let nx = (b.posNorm - yawOffset + 2) % 1
        const bx = (nx * 1.25 - 0.12) * w
        const bw = b.wNorm * w
        const bh = b.hRatio * h
        ctx.fillStyle = voidActive ? '#1E293B' : '#182238'
        ctx.beginPath()
        ctx.moveTo(bx, cam.horizonY + 4)
        ctx.lineTo(bx + bw * b.tilt, cam.horizonY - bh)
        ctx.lineTo(bx + bw, cam.horizonY - bh * (0.85 + Math.abs(b.tilt) * 4))
        ctx.lineTo(bx + bw, cam.horizonY + 4)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = shrineActive ? '#EF4444' : b.neon
        ctx.globalAlpha = 0.62
        ctx.fillRect(bx + bw * 0.2, cam.horizonY - bh * 0.72, bw * 0.6, 3)
        ctx.globalAlpha = 1
      }

      // 2. Ground Plane (Luminous Perspective Asphalt + Clear Shibuya Crossing Lines)
      const gGrad = ctx.createLinearGradient(0, cam.horizonY, 0, h)
      if (voidActive) {
        gGrad.addColorStop(0, '#1E293B')
        gGrad.addColorStop(0.4, '#172554')
        gGrad.addColorStop(1, '#0F172A')
      } else {
        gGrad.addColorStop(0, '#334155')
        gGrad.addColorStop(0.35, '#283548')
        gGrad.addColorStop(1, '#1C2638')
      }
      ctx.fillStyle = gGrad
      ctx.fillRect(-30, cam.horizonY, w + 60, h - cam.horizonY + 30)

      // 3D World Shibuya Asphalt Grid + Red Arena Walls
      ctx.save()
      ctx.strokeStyle = voidActive ? 'rgba(125, 211, 252, 0.34)' : 'rgba(226, 232, 240, 0.22)'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      const step = 300
      for (let gx = 0; gx <= mapCfg.width; gx += step) {
        drawPerspectiveSegment(ctx, cam, gx, 0, 0, gx, mapCfg.height, 0)
      }
      for (let gy = 0; gy <= mapCfg.height; gy += step) {
        drawPerspectiveSegment(ctx, cam, 0, gy, 0, mapCfg.width, gy, 0)
      }
      ctx.stroke()

      // Shibuya Scramble diagonal white crosswalk markings at center (1100..1900, 600..1200)
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.4)'
      ctx.lineWidth = 3.2
      ctx.beginPath()
      for (let s = -4; s <= 4; s++) {
        drawPerspectiveSegment(ctx, cam, 1260 + s * 36, 700, 0.5, 1740 + s * 36, 1100, 0.5)
        drawPerspectiveSegment(ctx, cam, 1260 + s * 36, 1100, 0.5, 1740 + s * 36, 700, 0.5)
      }
      ctx.stroke()

      // Perimeter glowing arena walls
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)'
      ctx.lineWidth = 3
      ctx.beginPath()
      drawPerspectiveSegment(ctx, cam, 0, 0, 2, mapCfg.width, 0, 2)
      drawPerspectiveSegment(ctx, cam, mapCfg.width, 0, 2, mapCfg.width, mapCfg.height, 2)
      drawPerspectiveSegment(ctx, cam, mapCfg.width, mapCfg.height, 2, 0, mapCfg.height, 2)
      drawPerspectiveSegment(ctx, cam, 0, mapCfg.height, 2, 0, 0, 2)
      ctx.stroke()
      ctx.restore()

      // 3. Perspective Ground Zones (Infinite Void, Malevolent Shrine, Fuga Cinders, RCT Healing Aura, Domain Clash Shock)
      for (const z of zones) {
        const lifeRatio = clamp(z.life / Math.max(0.01, z.maxLife), 0, 1)
        const baseProj = projectPoint(cam, z.x, z.y, 0)
        if (z.kind === 'malevolent_shrine') {
          drawGroundRing3D(
            ctx,
            cam,
            z.x,
            z.y,
            z.radius,
            'rgba(24, 2, 5, 0.78)',
            '#DC2626',
            3.2,
          )
          drawGroundRing3D(ctx, cam, z.x, z.y, z.radius * 0.84, null, '#FB7185', 2.0)
          // Colossal 3D Multi-Tier Malevolent Shrine + 4 Horned Demon Skulls + Relentless Slash Hurricane!
          if (baseProj) {
            const hShrine = clamp(255 * baseProj.scale, 52, 380)
            const wShrine = hShrine * 1.18
            ctx.save()
            // 4 Bleached Horned Demon Skulls at the Shrine Base
            for (const sxOff of [-wShrine * 0.48, -wShrine * 0.2, wShrine * 0.2, wShrine * 0.48]) {
              const skR = Math.max(5, hShrine * 0.085)
              ctx.fillStyle = '#E2E8F0'
              ctx.beginPath()
              ctx.arc(baseProj.sx + sxOff, baseProj.sy - skR * 0.9, skR, 0, Math.PI * 2)
              ctx.fill()
              ctx.fillStyle = '#EF4444'
              ctx.beginPath()
              ctx.arc(baseProj.sx + sxOff - skR * 0.35, baseProj.sy - skR * 0.9, skR * 0.24, 0, Math.PI * 2)
              ctx.arc(baseProj.sx + sxOff + skR * 0.35, baseProj.sy - skR * 0.9, skR * 0.24, 0, Math.PI * 2)
              ctx.fill()
            }
            // Dark Crimson Shrine Pillars + Demonic Ribcage Maw Core + Double Pagoda Roofs
            ctx.fillStyle = '#2E0507'
            ctx.strokeStyle = '#FB7185'
            ctx.lineWidth = 2
            ctx.fillRect(baseProj.sx - wShrine * 0.36, baseProj.sy - hShrine * 0.92, wShrine * 0.11, hShrine * 0.92)
            ctx.fillRect(baseProj.sx + wShrine * 0.25, baseProj.sy - hShrine * 0.92, wShrine * 0.11, hShrine * 0.92)
            ctx.fillStyle = '#991B1B'
            ctx.fillRect(baseProj.sx - wShrine * 0.18, baseProj.sy - hShrine * 0.68, wShrine * 0.36, hShrine * 0.56)
            // Lower & Upper Pagoda Roof Eaves
            ctx.fillStyle = '#450A0A'
            ctx.fillRect(baseProj.sx - wShrine * 0.62, baseProj.sy - hShrine * 0.74, wShrine * 1.24, hShrine * 0.11)
            ctx.strokeRect(baseProj.sx - wShrine * 0.62, baseProj.sy - hShrine * 0.74, wShrine * 1.24, hShrine * 0.11)
            ctx.fillStyle = '#7F1D1D'
            ctx.fillRect(baseProj.sx - wShrine * 0.52, baseProj.sy - hShrine * 1.0, wShrine * 1.04, hShrine * 0.14)
            ctx.strokeRect(baseProj.sx - wShrine * 0.52, baseProj.sy - hShrine * 1.0, wShrine * 1.04, hShrine * 0.14)
            // Relentless 360° Hurricane of White, Crimson & Obsidian Dismantle/Cleave Slash Arcs!
            ctx.globalCompositeOperation = 'lighter'
            for (let sIdx = 0; sIdx < 12; sIdx++) {
              const ang = timeSec * 14 + sIdx * 1.75
              const rx = baseProj.sx + Math.sin(ang) * wShrine * 1.05
              const ry = baseProj.sy - ((sIdx * 0.08 + timeSec * 1.9) % 0.95) * hShrine * 1.05
              const tilt = Math.cos(ang * 1.3) * 26
              ctx.strokeStyle = sIdx % 2 === 0 ? '#FFFFFF' : '#F43F5E'
              ctx.lineWidth = sIdx % 3 === 0 ? 3.2 : 2.0
              ctx.beginPath()
              ctx.moveTo(rx - 32, ry - tilt)
              ctx.lineTo(rx + 32, ry + tilt)
              ctx.stroke()
            }
            ctx.restore()
          }
        } else if (z.kind === 'infinite_void') {
          // Anime Unlimited Void: Abyssal Pitch-Black Space Floor + Blinding Event Horizon + Levitating Black Hole Singularity!
          drawGroundRing3D(
            ctx,
            cam,
            z.x,
            z.y,
            z.radius,
            'rgba(2, 6, 23, 0.88)',
            '#FFFFFF',
            3.2,
          )
          drawGroundRing3D(ctx, cam, z.x, z.y, z.radius * 0.94, null, '#38BDF8', 2.4)
          drawGroundRing3D(ctx, cam, z.x, z.y, z.radius * 0.64, null, '#C084FC', 1.8)
          // Streaking Cosmic Starlight Rays across the Void Floor
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          for (let r = 0; r < 10; r++) {
            const a = (r * Math.PI) / 5 + timeSec * 0.35
            ctx.strokeStyle = r % 2 === 0 ? 'rgba(224, 242, 254, 0.78)' : 'rgba(56, 189, 248, 0.68)'
            ctx.lineWidth = 2.2
            ctx.beginPath()
            drawPerspectiveSegment(
              ctx,
              cam,
              z.x + Math.cos(a) * z.radius * 0.2,
              z.y + Math.sin(a) * z.radius * 0.2,
              4,
              z.x + Math.cos(a) * z.radius * 0.92,
              z.y + Math.sin(a) * z.radius * 0.92,
              4,
            )
            ctx.stroke()
          }
          // Colossal Floating Black Hole Singularity + Photon Ring & Relativistic Accretion Disc
          const bhProj = projectPoint(cam, z.x, z.y, 110)
          if (bhProj) {
            const bhR = clamp(54 * bhProj.scale, 18, 95)
            ctx.strokeStyle = '#38BDF8'
            ctx.lineWidth = 3.5
            ctx.beginPath()
            ctx.ellipse(bhProj.sx, bhProj.sy, bhR * 2.1, bhR * 0.58, Math.sin(timeSec * 2) * 0.22, 0, Math.PI * 2)
            ctx.stroke()
            ctx.strokeStyle = '#C084FC'
            ctx.lineWidth = 2.4
            ctx.beginPath()
            ctx.ellipse(bhProj.sx, bhProj.sy, bhR * 2.45, bhR * 0.76, -0.35, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()

            ctx.save()
            ctx.fillStyle = '#020617'
            ctx.strokeStyle = '#FFFFFF'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(bhProj.sx, bhProj.sy, bhR, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.restore()
          } else {
            ctx.restore()
          }
        } else if (z.kind === 'fuga_explosion') {
          drawGroundRing3D(ctx, cam, z.x, z.y, z.radius, 'rgba(249, 115, 22, 0.42)', '#FEF08A', 3.5)
          if (baseProj) {
            const hFire = clamp(320 * baseProj.scale, 60, 440)
            const wFire = clamp(z.radius * baseProj.scale * 1.1, 28, 190)
            ctx.save()
            ctx.globalCompositeOperation = 'lighter'
            const fg = ctx.createLinearGradient(baseProj.sx, baseProj.sy, baseProj.sx, baseProj.sy - hFire)
            fg.addColorStop(0, '#FEF08A')
            fg.addColorStop(0.45, 'rgba(249, 115, 22, 0.85)')
            fg.addColorStop(1, 'rgba(239, 68, 68, 0)')
            ctx.fillStyle = fg
            ctx.fillRect(baseProj.sx - wFire * 0.5, baseProj.sy - hFire, wFire, hFire)
            ctx.restore()
          }
        } else if (z.kind === 'iconic_rct') {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          drawGroundRing3D(
            ctx,
            cam,
            z.x,
            z.y,
            z.radius * (1.2 - lifeRatio * 0.35),
            'rgba(52, 211, 153, 0.28)',
            '#FEF08A',
            3,
          )
          if (baseProj) {
            const pScale = clamp(120 * baseProj.scale, 28, 180)
            ctx.strokeStyle = `rgba(110, 231, 183, ${lifeRatio})`
            ctx.lineWidth = 2.6
            for (let k = 0; k < 3; k++) {
              ctx.beginPath()
              ctx.ellipse(
                baseProj.sx,
                baseProj.sy - pScale * (0.3 + k * 0.35 + (1 - lifeRatio) * 0.4),
                pScale * 0.65,
                pScale * 0.14,
                0,
                0,
                Math.PI * 2,
              )
              ctx.stroke()
            }
          }
          ctx.restore()
        } else if (z.kind === 'domain_clash_shock') {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          drawGroundRing3D(
            ctx,
            cam,
            z.x,
            z.y,
            z.radius * (1.25 - lifeRatio * 0.65),
            'rgba(168, 85, 247, 0.25)',
            '#38BDF8',
            4,
          )
          drawGroundRing3D(
            ctx,
            cam,
            z.x,
            z.y,
            z.radius * (0.95 - lifeRatio * 0.4),
            null,
            '#EF4444',
            3.5,
          )
          ctx.restore()
        } else {
          drawGroundRing3D(
            ctx,
            cam,
            z.x,
            z.y,
            z.radius,
            'rgba(249, 115, 22, 0.22)',
            z.accentColor || '#FACC15',
            2,
          )
        }
      }

      // 3B. Live 3D Skill Direction Compass, Desktop Mouse Reticle & Active Skill Telegraph
      if (me && me.alive) {
        const isGojoHero = me.characterId === 'sia_mon'
        let liveDirX = cam.fx
        let liveDirY = cam.fy
        let liveDist = 420
        if (pointerFloor.active && !aimPreview.active) {
          const pdx = pointerFloor.x - me.renderX
          const pdy = pointerFloor.y - me.renderY
          const pd = Math.hypot(pdx, pdy)
          if (pd > 8) {
            liveDirX = pdx / pd
            liveDirY = pdy / pd
            liveDist = clamp(pd, 120, 720)
          }
        } else if (enemy && enemy.alive) {
          const edx = enemy.renderX - me.renderX
          const edy = enemy.renderY - me.renderY
          const ed = Math.hypot(edx, edy)
          if (ed > 8) {
            liveDirX = edx / ed
            liveDirY = edy / ed
            liveDist = clamp(ed, 160, 760)
          }
        } else if (Math.hypot(me.aimDx, me.aimDy) > 0.1) {
          const am = Math.hypot(me.aimDx, me.aimDy)
          liveDirX = me.aimDx / am
          liveDirY = me.aimDy / am
        }

        // Passive Always-On Directional Chevron & Sightline so player always sees facing/aim in 3D!
        if (!aimPreview.active) {
          const baseColor = isGojoHero ? 'rgba(56, 189, 248, 0.72)' : 'rgba(248, 113, 113, 0.75)'
          const pxN = -liveDirY
          const pyN = liveDirX
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'

          // Front foot directional arc + pointed tip
          const arcDist = 72
          ctx.strokeStyle = baseColor
          ctx.lineWidth = 2.6
          ctx.beginPath()
          drawPerspectiveSegment(
            ctx,
            cam,
            me.renderX + liveDirX * (arcDist - 12) + pxN * 36,
            me.renderY + liveDirY * (arcDist - 12) + pyN * 36,
            2,
            me.renderX + liveDirX * (arcDist + 16),
            me.renderY + liveDirY * (arcDist + 16),
            2,
          )
          drawPerspectiveSegment(
            ctx,
            cam,
            me.renderX + liveDirX * (arcDist + 16),
            me.renderY + liveDirY * (arcDist + 16),
            2,
            me.renderX + liveDirX * (arcDist - 12) - pxN * 36,
            me.renderY + liveDirY * (arcDist - 12) - pyN * 36,
            2,
          )
          ctx.stroke()

          // Subtle aim sightline + animated forward chevrons along Shibuya ground
          ctx.setLineDash([12, 10])
          ctx.strokeStyle = isGojoHero ? 'rgba(56, 189, 248, 0.45)' : 'rgba(251, 113, 133, 0.48)'
          ctx.lineWidth = 2
          ctx.beginPath()
          drawPerspectiveSegment(
            ctx,
            cam,
            me.renderX + liveDirX * 56,
            me.renderY + liveDirY * 56,
            3,
            me.renderX + liveDirX * liveDist,
            me.renderY + liveDirY * liveDist,
            3,
          )
          ctx.stroke()
          ctx.setLineDash([])

          // Travelling directional chevrons along sightline
          const phase = (timeSec * 2.1) % 1
          ctx.strokeStyle = isGojoHero ? '#7DD3FC' : '#FCA5A5'
          ctx.lineWidth = 2.2
          for (let cIdx = 0; cIdx < 3; cIdx++) {
            const frac = ((cIdx / 3 + phase) % 1) * 0.8 + 0.16
            const dStep = liveDist * frac
            const cx = me.renderX + liveDirX * dStep
            const cy = me.renderY + liveDirY * dStep
            ctx.beginPath()
            drawPerspectiveSegment(
              ctx,
              cam,
              cx - liveDirX * 16 + pxN * 18,
              cy - liveDirY * 16 + pyN * 18,
              4,
              cx + liveDirX * 10,
              cy + liveDirY * 10,
              4,
            )
            drawPerspectiveSegment(
              ctx,
              cam,
              cx + liveDirX * 10,
              cy + liveDirY * 10,
              4,
              cx - liveDirX * 16 - pxN * 18,
              cy - liveDirY * 16 - pyN * 18,
              4,
            )
            ctx.stroke()
          }

          if (pointerFloor.active) {
            drawGroundRing3D(
              ctx,
              cam,
              pointerFloor.x,
              pointerFloor.y,
              44,
              isGojoHero ? 'rgba(56, 189, 248, 0.14)' : 'rgba(244, 63, 94, 0.14)',
              isGojoHero ? '#38BDF8' : '#FB7185',
              2.2,
              20,
            )
          }
          ctx.restore()
        } else {
          // Active 3D Skill Aim Telegraph when holding, dragging, or hovering a skill button!
          const forward = -aimPreview.dirY
          const strafe = aimPreview.dirX
          const rawX = forward * cam.fx - strafe * cam.fy
          const rawY = forward * cam.fy + strafe * cam.fx
          const rMag = Math.hypot(rawX, rawY) || 1
          const dirX = rawX / rMag
          const dirY = rawY / rMag
          const perpX = -dirY
          const perpY = dirX

          const castRange = Math.max(90, aimPreview.castRange || 360)
          const aoeRadius = Math.max(28, aimPreview.aoeRadius || 72)
          const colRgb = aimPreview.cancel
            ? '239, 68, 68'
            : aimPreview.slot === 1 && isGojoHero
              ? '251, 113, 133'
              : aimPreview.slot === 5
                ? '52, 211, 153'
                : isGojoHero
                  ? '56, 189, 248'
                  : '244, 63, 94'
          const strokeHex = aimPreview.cancel
            ? '#EF4444'
            : aimPreview.slot === 1 && isGojoHero
              ? '#FB7185'
              : aimPreview.slot === 5
                ? '#34D399'
                : isGojoHero
                  ? '#38BDF8'
                  : '#F43F5E'

          // 1. Max Range Perimeter Ring around hero
          drawGroundRing3D(
            ctx,
            cam,
            me.renderX,
            me.renderY,
            castRange,
            `rgba(${colRgb}, 0.06)`,
            `rgba(${colRgb}, 0.55)`,
            2,
          )

          if (aimPreview.aimType === 'self') {
            // Domain Expansion / RCT AoE Ring + Enemy In-Domain Alert
            drawGroundRing3D(
              ctx,
              cam,
              me.renderX,
              me.renderY,
              aoeRadius,
              `rgba(${colRgb}, 0.22)`,
              strokeHex,
              3.4,
            )
            drawGroundRing3D(
              ctx,
              cam,
              me.renderX,
              me.renderY,
              aoeRadius * 0.72,
              null,
              `rgba(${colRgb}, 0.65)`,
              1.6,
            )
            if (
              enemy &&
              enemy.alive &&
              Math.hypot(enemy.renderX - me.renderX, enemy.renderY - me.renderY) <= aoeRadius
            ) {
              drawGroundRing3D(ctx, cam, enemy.renderX, enemy.renderY, 62, 'rgba(250, 204, 21, 0.25)', '#FACC15', 3)
              const ep = projectPoint(cam, enemy.renderX, enemy.renderY, 125)
              if (ep) {
                ctx.save()
                ctx.font = '800 13px Inter, Noto Sans Thai, sans-serif'
                ctx.textAlign = 'center'
                ctx.fillStyle = '#FDE047'
                ctx.fillText('⚡ IN DOMAIN RANGE!', ep.sx, ep.sy)
                ctx.restore()
              }
            }
          } else if (aimPreview.aimType === 'ground') {
            const tDist = clamp(aimPreview.rangeFactor ?? 1, 0, 1) * castRange
            const tx = me.renderX + dirX * tDist
            const ty = me.renderY + dirY * tDist
            ctx.save()
            ctx.strokeStyle = strokeHex
            ctx.lineWidth = 3
            ctx.beginPath()
            drawPerspectiveSegment(ctx, cam, me.renderX, me.renderY, 4, tx, ty, 4)
            ctx.stroke()
            ctx.restore()
            drawGroundRing3D(ctx, cam, tx, ty, aoeRadius, `rgba(${colRgb}, 0.28)`, strokeHex, 3)
          } else {
            // Directional 3D Skill Corridor + Ground Impact Tip + Flight-Height Trajectory
            const ex = me.renderX + dirX * castRange
            const ey = me.renderY + dirY * castRange
            const halfW = Math.max(26, aoeRadius * 0.62)

            const c1 = projectPoint(cam, me.renderX + perpX * halfW, me.renderY + perpY * halfW, 2)
            const c2 = projectPoint(cam, me.renderX - perpX * halfW, me.renderY - perpY * halfW, 2)
            const c3 = projectPoint(cam, ex - perpX * halfW, ey - perpY * halfW, 2)
            const c4 = projectPoint(cam, ex + perpX * halfW, ey + perpY * halfW, 2)
            if (c1 && c2 && c3 && c4) {
              ctx.save()
              ctx.fillStyle = `rgba(${colRgb}, 0.2)`
              ctx.beginPath()
              ctx.moveTo(c1.sx, c1.sy)
              ctx.lineTo(c2.sx, c2.sy)
              ctx.lineTo(c3.sx, c3.sy)
              ctx.lineTo(c4.sx, c4.sy)
              ctx.closePath()
              ctx.fill()
              ctx.restore()
            }

            // Corridor side rails + elevated projectile sightline (z = 48)
            ctx.save()
            ctx.globalCompositeOperation = 'lighter'
            ctx.strokeStyle = strokeHex
            ctx.lineWidth = 2.4
            ctx.beginPath()
            drawPerspectiveSegment(
              ctx,
              cam,
              me.renderX + perpX * halfW,
              me.renderY + perpY * halfW,
              2,
              ex + perpX * halfW,
              ey + perpY * halfW,
              2,
            )
            drawPerspectiveSegment(
              ctx,
              cam,
              me.renderX - perpX * halfW,
              me.renderY - perpY * halfW,
              2,
              ex - perpX * halfW,
              ey - perpY * halfW,
              2,
            )
            ctx.stroke()

            ctx.lineWidth = 3.2
            ctx.beginPath()
            drawPerspectiveSegment(ctx, cam, me.renderX, me.renderY, 44, ex, ey, 44)
            ctx.stroke()

            // Distinct Gojo Infinity Wave vs Sukuna Cursed Cleave X-Marks inside the skill corridor
            const chevPhase = (timeSec * 3.0) % 1
            if (isGojoHero) {
              for (let k = 0; k < 4; k++) {
                const frac = ((k / 4 + chevPhase) % 1) * 0.85 + 0.1
                const px = me.renderX + dirX * (castRange * frac)
                const py = me.renderY + dirY * (castRange * frac)
                drawGroundRing3D(
                  ctx,
                  cam,
                  px + Math.sin(k + timeSec * 4) * halfW * 0.35,
                  py,
                  18,
                  null,
                  k % 2 === 0 ? '#38BDF8' : '#EF4444',
                  2.4,
                  12,
                )
              }
            } else {
              ctx.strokeStyle = '#FFFFFF'
              ctx.lineWidth = 2.6
              for (let k = 0; k < 4; k++) {
                const frac = ((k / 4 + chevPhase) % 1) * 0.85 + 0.1
                const px = me.renderX + dirX * (castRange * frac)
                const py = me.renderY + dirY * (castRange * frac)
                ctx.beginPath()
                drawPerspectiveSegment(
                  ctx,
                  cam,
                  px - dirX * 18 + perpX * (halfW * 0.72),
                  py - dirY * 18 + perpY * (halfW * 0.72),
                  6,
                  px + dirX * 18 - perpX * (halfW * 0.72),
                  py + dirY * 18 - perpY * (halfW * 0.72),
                  6,
                )
                drawPerspectiveSegment(
                  ctx,
                  cam,
                  px - dirX * 18 - perpX * (halfW * 0.72),
                  py - dirY * 18 - perpY * (halfW * 0.72),
                  6,
                  px + dirX * 18 + perpX * (halfW * 0.72),
                  py + dirY * 18 + perpY * (halfW * 0.72),
                  6,
                )
                ctx.stroke()
              }
            }
            ctx.restore()

            drawGroundRing3D(
              ctx,
              cam,
              ex,
              ey,
              Math.max(38, aoeRadius * 0.8),
              `rgba(${colRgb}, 0.25)`,
              strokeHex,
              2.8,
            )

            // Special Gojo Hint: If aiming Blue while own Red orb is airborne -> mark Hollow Purple target!
            if (isGojoHero && aimPreview.slot === 2) {
              const redOrb = projectiles.find((pr) => pr.ownerId === me.id && pr.kind === 'gojo_red')
              if (redOrb) {
                drawGroundRing3D(
                  ctx,
                  cam,
                  redOrb.x,
                  redOrb.y,
                  140,
                  'rgba(168, 85, 247, 0.22)',
                  '#C084FC',
                  3.2,
                )
              }
            }
          }
        }
      }

      // In-flight projectile forward trajectory guides on floor so dodges/aims read clearly in 3D
      for (const pr of projectiles) {
        drawGroundRing3D(ctx, cam, pr.x, pr.y, Math.max(22, pr.radius), 'rgba(2, 6, 23, 0.22)', pr.color || '#38BDF8', 1.6, 16)
        const vMag = Math.hypot(pr.vx, pr.vy)
        if (vMag > 15) {
          const ux = pr.vx / vMag
          const uy = pr.vy / vMag
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.setLineDash([10, 8])
          ctx.strokeStyle = pr.color || '#38BDF8'
          ctx.lineWidth = 2
          ctx.beginPath()
          drawPerspectiveSegment(ctx, cam, pr.x, pr.y, 18, pr.x + ux * 220, pr.y + uy * 220, 18)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        }
      }

      // 4. Depth-Sorted 3D Renderables (Pillars, Players, Projectiles)
      type DrawItem = { depth: number; draw: () => void }
      const queue: DrawItem[] = []

      for (const pil of mapCfg.pillars) {
        const p = projectPoint(cam, pil.x, pil.y, 0)
        if (!p) continue
        queue.push({
          depth: p.depth,
          draw: () => {
            const rPx = pil.radius * p.scale
            const hPx = clamp(210 * p.scale, 18, 420)
            ctx.save()
            // Fade pillars near the camera so third-person over-the-shoulder sightlines stay clear!
            if (p.depth < 420) {
              ctx.globalAlpha = 0.34
            }
            ctx.fillStyle = 'rgba(2, 6, 23, 0.55)'
            ctx.beginPath()
            ctx.ellipse(p.sx, p.sy, rPx * 1.2, rPx * 0.26, 0, 0, Math.PI * 2)
            ctx.fill()

            const colGrad = ctx.createLinearGradient(p.sx - rPx, 0, p.sx + rPx, 0)
            colGrad.addColorStop(0, '#0F172A')
            colGrad.addColorStop(0.45, '#334155')
            colGrad.addColorStop(1, '#090D16')
            ctx.fillStyle = colGrad
            ctx.fillRect(p.sx - rPx, p.sy - hPx, rPx * 2, hPx)
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'
            ctx.lineWidth = Math.max(1, rPx * 0.04)
            ctx.strokeRect(p.sx - rPx, p.sy - hPx, rPx * 2, hPx)
            // Pillar top ellipse cap
            ctx.fillStyle = '#475569'
            ctx.beginPath()
            ctx.ellipse(p.sx, p.sy - hPx, rPx, rPx * 0.2, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          },
        })
      }

      for (const pl of smoothPlayers.values()) {
        const p = projectPoint(cam, pl.renderX, pl.renderY, 0)
        if (!p) continue
        queue.push({
          depth: p.depth,
          draw: () => drawOverShoulderHero(cam, pl, pl.id === myPlayerId, timeSec),
        })
      }

      for (const pr of projectiles) {
        const p = projectPoint(cam, pr.x, pr.y, 54)
        if (!p) continue
        queue.push({
          depth: p.depth,
          draw: () => {
            const rad = clamp(pr.radius * p.scale * 1.45, 5, 110)
            ctx.save()
            ctx.globalCompositeOperation = 'lighter'

            // Ribbon trail behind projectile in 3D perspective
            const tr = projTrails.get(pr.id)
            if (tr && tr.length >= 2) {
              ctx.beginPath()
              let started = false
              for (const pt of tr) {
                const tp = projectPoint(cam, pt.x, pt.y, 54)
                if (!tp) continue
                if (!started) {
                  ctx.moveTo(tp.sx, tp.sy)
                  started = true
                } else {
                  ctx.lineTo(tp.sx, tp.sy)
                }
              }
              ctx.strokeStyle = pr.color || '#38BDF8'
              ctx.lineWidth = Math.max(2, rad * 0.65)
              ctx.lineCap = 'round'
              ctx.stroke()
            }

            if (pr.kind === 'hollow_purple') {
              const g = ctx.createRadialGradient(p.sx, p.sy, rad * 0.1, p.sx, p.sy, rad * 2.5)
              g.addColorStop(0, '#FFFFFF')
              g.addColorStop(0.35, '#C084FC')
              g.addColorStop(0.7, 'rgba(147, 51, 234, 0.55)')
              g.addColorStop(1, 'rgba(0, 0, 0, 0)')
              ctx.fillStyle = g
              ctx.beginPath()
              ctx.arc(p.sx, p.sy, rad * 2.5, 0, Math.PI * 2)
              ctx.fill()
              ctx.strokeStyle = '#E9D5FF'
              ctx.lineWidth = 2.5
              ctx.beginPath()
              ctx.ellipse(p.sx, p.sy, rad * 1.9, rad * 0.65, timeSec * 5, 0, Math.PI * 2)
              ctx.stroke()
            } else if (pr.kind === 'dismantle') {
              // Sukuna "Kai" (Dismantle): Crisscrossing Obsidian, Crimson & Stark-White Twin Razor Crescent Blades!
              for (const [col, wMult] of [
                ['#09090B', 0.85],
                ['#DC2626', 0.55],
                ['#FFFFFF', 0.26],
              ] as const) {
                ctx.strokeStyle = col
                ctx.lineWidth = Math.max(2, rad * wMult)
                ctx.beginPath()
                ctx.moveTo(p.sx - rad * 2.1, p.sy - rad * 1.25)
                ctx.lineTo(p.sx + rad * 2.1, p.sy + rad * 1.25)
                ctx.moveTo(p.sx + rad * 2.1, p.sy - rad * 1.25)
                ctx.lineTo(p.sx - rad * 2.1, p.sy + rad * 1.25)
                ctx.stroke()
              }
            } else if (pr.kind === 'fuga_arrow') {
              // Sukuna "Kamino / Fuga" (Open): Blazing Hellfire Arrow + Spinning Fire Vortex Rings!
              const g = ctx.createRadialGradient(p.sx, p.sy, rad * 0.1, p.sx, p.sy, rad * 2.8)
              g.addColorStop(0, '#FFFFFF')
              g.addColorStop(0.35, '#FEF08A')
              g.addColorStop(0.7, 'rgba(249, 115, 22, 0.78)')
              g.addColorStop(1, 'rgba(239, 68, 68, 0)')
              ctx.fillStyle = g
              ctx.beginPath()
              ctx.arc(p.sx, p.sy, rad * 2.8, 0, Math.PI * 2)
              ctx.fill()
              ctx.strokeStyle = '#FEF08A'
              ctx.lineWidth = 2.6
              ctx.beginPath()
              ctx.ellipse(p.sx, p.sy, rad * 2.1, rad * 0.72, timeSec * 8, 0, Math.PI * 2)
              ctx.stroke()
            } else if (pr.kind === 'gojo_blue' || pr.kind === 'gojo_red') {
              const isBlue = pr.kind === 'gojo_blue'
              const g = ctx.createRadialGradient(p.sx, p.sy, rad * 0.1, p.sx, p.sy, rad * 2.4)
              g.addColorStop(0, isBlue ? '#020617' : '#FFFFFF')
              g.addColorStop(0.38, isBlue ? '#38BDF8' : '#EF4444')
              g.addColorStop(0.75, isBlue ? 'rgba(2, 132, 199, 0.5)' : 'rgba(220, 38, 38, 0.5)')
              g.addColorStop(1, 'rgba(0, 0, 0, 0)')
              ctx.fillStyle = g
              ctx.beginPath()
              ctx.arc(p.sx, p.sy, rad * 2.4, 0, Math.PI * 2)
              ctx.fill()
              ctx.strokeStyle = isBlue ? '#BAE6FD' : '#FECACA'
              ctx.lineWidth = 2.2
              ctx.beginPath()
              ctx.ellipse(p.sx, p.sy, rad * 1.75, rad * 0.58, timeSec * (isBlue ? -7 : 7), 0, Math.PI * 2)
              ctx.stroke()
            } else {
              const g = ctx.createRadialGradient(p.sx, p.sy, rad * 0.1, p.sx, p.sy, rad * 2.1)
              g.addColorStop(0, '#FFFFFF')
              g.addColorStop(0.42, pr.color || '#38BDF8')
              g.addColorStop(1, 'rgba(0, 0, 0, 0)')
              ctx.fillStyle = g
              ctx.beginPath()
              ctx.arc(p.sx, p.sy, rad * 2.1, 0, Math.PI * 2)
              ctx.fill()
            }
            ctx.restore()
          },
        })
      }

      queue.sort((a, b) => b.depth - a.depth)
      for (const item of queue) item.draw()

      // 5. 3D Perspective Beams, Gojo Black-Flash Strikes & Sukuna Cleave Waves (Adapted to Graphics Quality Tier)
      const strokeMult =
        graphicsQuality === 'pixel' ? 1.35 : graphicsQuality === 'fine_pixel' ? 1.15 : 1.0
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      if (graphicsQuality === 'ultra') {
        ctx.shadowBlur = 14
      }
      for (const b of beams) {
        if (graphicsQuality === 'ultra') {
          ctx.shadowColor = b.color || '#38BDF8'
        }
        const endPt = projectPoint(cam, b.x2, b.y2, 52)
        if (b.kind === 'atk_sukuna_cleave' && endPt) {
          // Sukuna Spiderweb Cleave X-Slashes at Target
          const r = clamp(58 * endPt.scale, 18, 96)
          for (const [ang, col, lw] of [
            [0.62, '#09090B', 5.8],
            [0.62, '#EF4444', 3.4],
            [-0.62, '#FFFFFF', 3.0],
            [0.12, '#FB7185', 2.6],
          ] as const) {
            ctx.strokeStyle = col
            ctx.lineWidth = lw * strokeMult
            ctx.beginPath()
            ctx.moveTo(endPt.sx - Math.cos(ang) * r, endPt.sy - Math.sin(ang) * r)
            ctx.lineTo(endPt.sx + Math.cos(ang) * r, endPt.sy + Math.sin(ang) * r)
            ctx.stroke()
          }
          continue
        }
        if (b.kind === 'atk_gojo_punch' && endPt) {
          // Gojo Lapse-Blue Spatial Vacuum Impact + Black Flash (Kokusen) Crimson-Black Sparks
          const r = clamp(50 * endPt.scale, 16, 88)
          ctx.strokeStyle = '#38BDF8'
          ctx.lineWidth = 3.4 * strokeMult
          ctx.beginPath()
          ctx.arc(endPt.sx, endPt.sy, r * 0.72, 0, Math.PI * 2)
          ctx.stroke()
          for (let k = 0; k < 4; k++) {
            const a = k * 1.57 + 0.4
            ctx.strokeStyle = k % 2 === 0 ? '#EF4444' : '#7DD3FC'
            ctx.lineWidth = 2.8 * strokeMult
            ctx.beginPath()
            ctx.moveTo(endPt.sx, endPt.sy)
            ctx.lineTo(endPt.sx + Math.cos(a) * r * 0.55, endPt.sy + Math.sin(a) * r * 0.35 - 10)
            ctx.lineTo(endPt.sx + Math.cos(a) * r * 1.15, endPt.sy + Math.sin(a) * r * 0.95)
            ctx.stroke()
          }
        }
        ctx.strokeStyle = b.color || '#38BDF8'
        ctx.lineWidth = Math.max(3, b.width * 0.35) * strokeMult
        ctx.beginPath()
        drawPerspectiveSegment(ctx, cam, b.x1, b.y1, 52, b.x2, b.y2, 52)
        ctx.stroke()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2.2 * strokeMult
        ctx.beginPath()
        drawPerspectiveSegment(ctx, cam, b.x1, b.y1, 52, b.x2, b.y2, 52)
        ctx.stroke()
      }
      ctx.restore()

      // 6. 3D Sparks (Square Voxel Pixel Blocks in Pixel tiers vs Glowing Orbs in HD/Ultra)
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]
        pt.life -= dt
        if (pt.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        pt.x += pt.vx * dt
        pt.y += pt.vy * dt
        pt.z = Math.max(0, pt.z + pt.vz * dt)
        pt.vz -= 260 * dt
        const sp = projectPoint(cam, pt.x, pt.y, pt.z)
        if (!sp) continue
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1)
        ctx.fillStyle = pt.color
        const rad = Math.max(2, pt.size * sp.scale * 1.45 * strokeMult)
        if (isPixelScale) {
          ctx.fillRect(sp.sx - rad, sp.sy - rad, rad * 2, rad * 2)
        } else {
          if (graphicsQuality === 'ultra') {
            ctx.shadowColor = pt.color
            ctx.shadowBlur = 10
          }
          ctx.beginPath()
          ctx.arc(sp.sx, sp.sy, rad, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      // Drifting Shibuya cursed embers in foreground air
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const em of ambientEmbers) {
        const ex = ((em.xNorm + timeSec * em.speed * 0.25) % 1) * w
        const ey = ((em.yNorm - timeSec * em.speed + 10) % 1) * h
        ctx.fillStyle = em.isRed ? 'rgba(239, 68, 68, 0.55)' : 'rgba(56, 189, 248, 0.55)'
        ctx.beginPath()
        ctx.arc(ex, ey, em.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      if (flashOverlay > 0.01) {
        ctx.fillStyle = flashColor
        ctx.globalAlpha = flashOverlay * 0.45
        ctx.fillRect(0, 0, w, h)
        ctx.globalAlpha = 1
      }

      // Close world pass (either pixelCanvas or mainCtx)
      ctx.restore()

      // Switch to native-resolution display canvas & upscale low-res pixel buffer cleanly
      ctx = mainCtx
      if (useLowResPixel) {
        ctx.save()
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(pixelCanvas, 0, 0, w, h)
        ctx.restore()
      }

      // 6b. Razor-Sharp Overhead HP Bars, Hero Nameplates & Floating Combat Readouts
      ctx.save()
      ctx.translate(shakeX, 0)
      for (const lbl of heroLabels) {
        const barW = clamp(lbl.wPx * 1.55, 58, 118)
        const barH = 7
        const barY = lbl.sy - lbl.hPx * 1.15
        ctx.save()
        ctx.globalAlpha = lbl.p.alive ? 1 : 0.35
        ctx.fillStyle = 'rgba(2, 6, 23, 0.86)'
        ctx.fillRect(lbl.sx - barW * 0.5 - 2, barY - 2, barW + 4, barH + 4)
        const hpPct = clamp(lbl.p.hp / Math.max(1, lbl.p.maxHp), 0, 1)
        ctx.fillStyle = lbl.isMe ? '#22C55E' : '#EF4444'
        ctx.fillRect(lbl.sx - barW * 0.5, barY, barW * hpPct, barH)
        ctx.fillStyle = '#F8FAFC'
        ctx.font = '700 12px Inter, Noto Sans Thai, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(
          `${lbl.p.name} • ${lbl.isGojo ? 'Gojo' : 'Sukuna'} (${lbl.p.hp})`,
          lbl.sx,
          barY - 6,
        )
        ctx.restore()
      }

      for (let i = floatingTags.length - 1; i >= 0; i--) {
        const ft = floatingTags[i]
        ft.life -= dt
        ft.z += dt * 45
        if (ft.life <= 0) {
          floatingTags.splice(i, 1)
          continue
        }
        const fp = projectPoint(cam, ft.x, ft.y, ft.z)
        if (!fp) continue
        ctx.save()
        ctx.globalAlpha = clamp(ft.life / ft.maxLife, 0, 1)
        ctx.font = '800 18px Inter, Noto Sans Thai, sans-serif'
        ctx.textAlign = 'center'
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)'
        ctx.lineWidth = 4
        ctx.strokeText(ft.text, fp.sx, fp.sy)
        ctx.fillStyle = ft.color
        ctx.fillText(ft.text, fp.sx, fp.sy)
        ctx.restore()
      }
      ctx.restore()

      // 7. Top-Left Tactical Minimap Radar
      const isNarrow = w <= 780 || h <= 520
      const mw = isNarrow ? 112 : 168
      const mh = isNarrow ? 67 : 102
      const mx = isNarrow ? 8 : 12
      const my = isNarrow ? 6 : 10
      ctx.save()
      ctx.fillStyle = 'rgba(9, 14, 28, 0.86)'
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(mx, my, mw, mh, 10)
      ctx.fill()
      ctx.stroke()

      for (const pil of mapCfg.pillars) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)'
        ctx.beginPath()
        ctx.arc(mx + (pil.x / mapCfg.width) * mw, my + (pil.y / mapCfg.height) * mh, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const pl of smoothPlayers.values()) {
        if (!pl.alive) continue
        const px = mx + (pl.renderX / mapCfg.width) * mw
        const py = my + (pl.renderY / mapCfg.height) * mh
        ctx.fillStyle = pl.id === myPlayerId ? '#22C55E' : '#EF4444'
        ctx.beginPath()
        ctx.arc(px, py, pl.id === myPlayerId ? 4.4 : 4.0, 0, Math.PI * 2)
        ctx.fill()
        if (pl.id === myPlayerId) {
          ctx.strokeStyle = '#FACC15'
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(px + cam.fx * 10, py + cam.fy * 10)
          ctx.stroke()
        }
      }
      ctx.restore()

      rafId = window.requestAnimationFrame(frame)
    }

    rafId = window.requestAnimationFrame(frame)

    return () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
      ro.disconnect()
      unsubInit()
      unsubSync()
      unsubClash()
      unsubDied()
      unsubAimPreview()
      canvas.removeEventListener('pointermove', handleCanvasPointerMove)
      canvas.removeEventListener('pointerleave', handleCanvasPointerLeave)
      canvas.removeEventListener('pointerdown', handleCanvasPointerDown)
      if (canvas.parentElement === host) {
        host.removeChild(canvas)
      }
    }
  }, [])

  return <div ref={hostRef} className="moba-phaser-stage iconic-3d-stage" />
})
