import { memo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { soundEngine } from '../audio/soundEngine'
import { getCachedMatchImage } from '../services/assetPreloader'
import { getLocalMoveInputState, useGameStore } from '../store/useGameStore'
import type { BeamEffect, GraphicsQuality, MapConfig, PlayerState, Projectile, ZoneEffect } from '../types/game'
import { gameEventBus, type AimPreviewPayload } from './core/eventBus'
import { getHeroArenaCursorCss } from './heroAimThemes'
import {
  animateHeroPose3D,
  buildHeroRig3D,
  disposeHeroRig3D,
  updateHeroHitFlash3D,
  type HeroRig3D,
} from './hero3dBuilder'
import {
  animateMapEnvironment3D,
  buildMapEnvironment3D,
  isOnSisaketDryLand,
  SCP_CENTER_X,
  SCP_CENTER_Z,
  SCP_RADIUS,
} from './map3dBuilder'
import { PixelArtGpuPass } from './pixelShaderPass'
import { Vfx3dManager } from './vfx3dManager'

interface FloatingDmgPopup {
  x: number
  z: number
  y3d: number
  text: string
  color: string
  life: number
  maxLife: number
}

interface FloatingEmotePopup {
  playerId: string
  text: string
  life: number
}

interface ActorRenderState {
  state: PlayerState
  rig: HeroRig3D
  renderX: number
  renderZ: number
  serverX: number
  serverZ: number
  serverAtMs: number
  facingYaw: number
  wasAlive: boolean
  wasDummyHp: number
  trailHp: number
}

interface KillStreakBanner {
  title: string
  subtitle: string
  accent: string
  untilMs: number
  maxDurMs: number
}

const DEFAULT_MAP: MapConfig = {
  id: 'shibuya',
  name: 'Shibuya Incident',
  width: 3000,
  height: 1800,
  playerRadius: 18,
  moveSpeed: 255,
  pillars: [],
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function resolveObstaclesLocal(x: number, z: number, cfg: MapConfig): { x: number; z: number } {
  const pr = cfg.playerRadius || 18
  let nx = x
  let nz = z
  for (const pil of cfg.pillars ?? []) {
    const dx = nx - pil.x
    const dz = nz - pil.y
    const dist = Math.hypot(dx, dz)
    const minDist = pil.radius + pr
    if (dist < minDist) {
      const len = dist > 0.001 ? dist : 1
      nx = pil.x + (dx / len) * minDist
      nz = pil.y + (dz / len) * minDist
    }
  }
  if (cfg.id === 'scp_site') {
    const maxR = Math.max(40, SCP_RADIUS - pr)
    const dx = nx - SCP_CENTER_X
    const dz = nz - SCP_CENTER_Z
    const dist = Math.hypot(dx, dz)
    if (dist > maxR && dist > 0.001) {
      nx = SCP_CENTER_X + (dx / dist) * maxR
      nz = SCP_CENTER_Z + (dz / dist) * maxR
    }
  }
  return {
    x: clamp(nx, pr, cfg.width - pr),
    z: clamp(nz, pr, cfg.height - pr),
  }
}

function normalizeAngleDelta(d: number): number {
  let out = d
  while (out > Math.PI) out -= Math.PI * 2
  while (out < -Math.PI) out += Math.PI * 2
  return out
}

function portraitUrlFor(charId: string): string {
  if (charId === 'default') return '/app-icon.png?v=20261120v2'
  if (charId === 'noone') return '/characters/noone.png?v=mcu1'
  return `/characters/${charId}.png`
}

export const Mlbb3dArenaView = memo(function Mlbb3dArenaView() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let width = Math.max(320, host.clientWidth || window.innerWidth)
    let height = Math.max(240, host.clientHeight || window.innerHeight)

    const storeSnap = useGameStore.getState()
    let mapCfg: MapConfig = storeSnap.mapCfg ?? DEFAULT_MAP
    let myPlayerId = storeSnap.myPlayerId
    const graphicsQuality: GraphicsQuality = storeSnap.graphicsQuality
    const isPixelShaderTier = graphicsQuality === 'pixel' || graphicsQuality === 'fine_pixel'
    const isUltraTier = graphicsQuality === 'ultra'

    const resolveGlDpr = (): number => {
      const nativeDpr = window.devicePixelRatio || 1
      if (graphicsQuality === 'pixel') return 1
      if (isUltraTier) return Math.min(nativeDpr, 1.65)
      return Math.min(nativeDpr, 1.35)
    }

    // 1. WebGLRenderer + Scene + MLBB Tilted Isometric Perspective Camera (~52 deg downward pitch)
    const renderer = new THREE.WebGLRenderer({
      antialias: !isPixelShaderTier,
      powerPreference: 'high-performance',
      alpha: false,
    })
    const pixelPass = isPixelShaderTier ? new PixelArtGpuPass(renderer) : null
    renderer.setPixelRatio(resolveGlDpr())
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = isUltraTier ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    renderer.toneMappingExposure = isUltraTier ? 1.06 : 1.0
    if (isUltraTier) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.shadowMap.autoUpdate = false
      renderer.shadowMap.needsUpdate = true
    }
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.imageRendering = isPixelShaderTier ? 'pixelated' : 'auto'
    host.appendChild(renderer.domElement)

    // Overlaid 2D Canvas for Razor-Sharp Nameplates, HP Bars, Damage Popups & Top-Left Minimap
    const overlayCanvas = document.createElement('canvas')
    overlayCanvas.style.position = 'absolute'
    overlayCanvas.style.inset = '0'
    overlayCanvas.style.width = '100%'
    overlayCanvas.style.height = '100%'
    overlayCanvas.style.pointerEvents = 'none'
    overlayCanvas.style.zIndex = '12'
    host.appendChild(overlayCanvas)
    const ctx2d = overlayCanvas.getContext('2d')

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(mapCfg.id === 'konoha' ? 0x102116 : 0x0b1222)
    scene.fog = new THREE.Fog(mapCfg.id === 'konoha' ? 0x102116 : 0x0b1222, 950, 2250)

    const camera = new THREE.PerspectiveCamera(42, width / height, 20, 7200)

    let ultraComposer: EffectComposer | null = null
    let ultraRenderPass: RenderPass | null = null
    let ultraBloomPass: UnrealBloomPass | null = null
    let ultraOutputPass: OutputPass | null = null
    if (isUltraTier) {
      ultraComposer = new EffectComposer(renderer)
      ultraRenderPass = new RenderPass(scene, camera)
      // Half-resolution bloom target cuts 5-pass Gaussian blur fillrate cost by 4x with identical smooth glow
      ultraBloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.max(160, Math.round(width * 0.5)), Math.max(120, Math.round(height * 0.5))),
        0.28,
        0.42,
        0.88,
      )
      ultraOutputPass = new OutputPass()
      ultraComposer.addPass(ultraRenderPass)
      ultraComposer.addPass(ultraBloomPass)
      ultraComposer.addPass(ultraOutputPass)
    }

    const syncCanvasSizes = () => {
      width = Math.max(320, host.clientWidth || window.innerWidth)
      height = Math.max(240, host.clientHeight || window.innerHeight)
      const glDpr = resolveGlDpr()
      const hudDpr = isUltraTier
        ? Math.min(window.devicePixelRatio || 1, 1.5)
        : Math.min(window.devicePixelRatio || 1, 1.2)
      renderer.setPixelRatio(glDpr)
      renderer.setSize(width, height)
      if (ultraComposer) {
        ultraComposer.setPixelRatio(glDpr)
        ultraComposer.setSize(width, height)
      }
      if (ultraBloomPass) {
        ultraBloomPass.resolution.set(Math.max(160, Math.round(width * 0.5)), Math.max(120, Math.round(height * 0.5)))
      }
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      overlayCanvas.width = Math.round(width * hudDpr)
      overlayCanvas.height = Math.round(height * hudDpr)
      if (ctx2d) ctx2d.setTransform(hudDpr, 0, 0, hudDpr, 0, 0)
    }
    syncCanvasSizes()

    // Studio Three-Point MLBB Arena Lighting (Enhanced Soft Shadows & Rim Punch in ULTRA MAX)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, isUltraTier ? 1.48 : 1.35)
    scene.add(hemiLight)
    const dirLight = new THREE.DirectionalLight(0xfffbeb, isUltraTier ? 1.85 : 1.65)
    dirLight.position.set(800, 1400, 700)
    if (isUltraTier) {
      dirLight.castShadow = true
      const shadowRes = width < 780 ? 1024 : 2048
      dirLight.shadow.mapSize.set(shadowRes, shadowRes)
      dirLight.shadow.camera.left = -640
      dirLight.shadow.camera.right = 640
      dirLight.shadow.camera.top = 640
      dirLight.shadow.camera.bottom = -640
      dirLight.shadow.camera.near = 100
      dirLight.shadow.camera.far = 2200
      dirLight.shadow.bias = -0.0006
      dirLight.shadow.normalBias = 0.03
      scene.add(dirLight.target)
    }
    scene.add(dirLight)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, isUltraTier ? 0.88 : 0.55)
    rimLight.position.set(-700, 600, -800)
    scene.add(rimLight)
    if (isUltraTier) {
      const warmFill = new THREE.DirectionalLight(0xfde68a, 0.35)
      warmFill.position.set(-600, 900, 800)
      scene.add(warmFill)
    }

    const applyShadowFlags = (rootObj: THREE.Object3D, shadowReciprocate = true) => {
      if (!isUltraTier) return
      rootObj.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        if (child.userData.noShadow) {
          child.castShadow = false
          child.receiveShadow = false
          return
        }
        const mat = child.material
        const isTransparent = Array.isArray(mat) ? mat.some((m) => m.transparent) : Boolean(mat?.transparent)
        if (isTransparent) {
          child.castShadow = false
          child.receiveShadow = false
          return
        }
        child.castShadow = !child.userData.noCastShadow
        child.receiveShadow = shadowReciprocate
      })
    }

    // Reusable 3D Environment Group (rebuilt cleanly whenever mapCfg.id changes)
    const envGroup = new THREE.Group()
    scene.add(envGroup)
    const envDisposables: Array<{ dispose: () => void }> = []
    let builtEnvKey = ''
    const floorAnisotropy = isUltraTier
      ? renderer.capabilities.getMaxAnisotropy()
      : graphicsQuality === 'fine_pixel' || graphicsQuality === 'hd'
        ? Math.min(4, renderer.capabilities.getMaxAnisotropy())
        : 1

    const rebuildEnvironment3D = (mCfg: MapConfig) => {
      const nextKey = `${mCfg.id}:${mCfg.width}:${mCfg.height}:${mCfg.pillars?.length ?? 0}`
      if (builtEnvKey === nextKey) return
      builtEnvKey = nextKey
      buildMapEnvironment3D(envGroup, scene, mCfg, envDisposables, floorAnisotropy)
      applyShadowFlags(envGroup, true)
    }

    rebuildEnvironment3D(mapCfg)

    const vfx = new Vfx3dManager(scene, graphicsQuality)
    const actors = new Map<string, ActorRenderState>()
    const portraits = new Map<string, HTMLImageElement>()
    const seenEffects = new Set<string>()
    const popups: FloatingDmgPopup[] = []
    const emotePopups: FloatingEmotePopup[] = []

    let projectiles: Projectile[] = []
    let beams: BeamEffect[] = []
    let zones: ZoneEffect[] = []
    let aimPreview: AimPreviewPayload = {
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

    let focusX = mapCfg.width * 0.5
    let focusZ = mapCfg.height * 0.5
    let shakePower = 0
    let zoomPunch = 0
    let firstBloodAnnounced = false
    const killerStreakMap = new Map<string, { count: number; lastAtMs: number }>()
    let activeKillBanner: KillStreakBanner | null = null
    let minimapRect = { x: 12, y: 8, w: 176, h: 106 }
    let cameraPeek = { active: false, worldX: 0, worldZ: 0, minimapMode: false }
    let dragPan = { pointerId: -1, button: 0, downX: 0, downY: 0, lastX: 0, lastY: 0, moved: false }
    let hasEmittedReady = false

    const ensurePortraitLoaded = (charId: string): HTMLImageElement | null => {
      const existing = portraits.get(charId)
      if (existing && existing.complete && existing.naturalWidth > 0) return existing
      const url = portraitUrlFor(charId)
      const cached = getCachedMatchImage(url)
      if (cached) {
        portraits.set(charId, cached)
        return cached
      }
      if (!existing) {
        const img = new Image()
        img.src = url
        portraits.set(charId, img)
      }
      return null
    }

    const colorForRing = (p: PlayerState): number => {
      if (p.id === myPlayerId) return 0x38bdf8
      const myTeam = actors.get(myPlayerId)?.state.team
      if (myTeam && myTeam !== 'ffa' && p.team === myTeam) return 0x22c55e
      if (p.team === 'blue') return 0x3b82f6
      if (p.team === 'red') return 0xef4444
      return Number.parseInt(p.color.replace('#', ''), 16) || 0xf59e0b
    }

    const charSpeedMap = new Map<string, number>()
    const refreshCharSpeedMap = () => {
      for (const c of useGameStore.getState().characters) {
        if (c.moveSpeed > 0) charSpeedMap.set(c.id, c.moveSpeed)
      }
    }
    refreshCharSpeedMap()
    let smoothedRttMs = 40

    // Cached offscreen canvas for static minimap frame + pillars (eliminates per-frame roundRect/arc redraw cost)
    const minimapBgCanvas = document.createElement('canvas')
    let minimapBgKey = ''

    let lastCursorCharId = ''
    const syncRosterState = (players: PlayerState[]) => {
      const nowRecv = performance.now()
      if (charSpeedMap.size === 0) refreshCharSpeedMap()
      const present = new Set<string>()
      for (const p of players) {
        present.add(p.id)
        if (p.id === myPlayerId && p.characterId !== lastCursorCharId) {
          lastCursorCharId = p.characterId
          renderer.domElement.style.cursor = getHeroArenaCursorCss(p.characterId)
        }
        ensurePortraitLoaded(p.characterId)
        let entry = actors.get(p.id)
        if (!entry || entry.state.characterId !== p.characterId) {
          if (entry) {
            scene.remove(entry.rig.root)
            disposeHeroRig3D(entry.rig)
          }
          const rig = buildHeroRig3D(p, p.id === myPlayerId, colorForRing(p))
          if (isUltraTier) {
            applyShadowFlags(rig.bodyPivot, false)
            const sdMat = rig.shadowDisc.material as THREE.MeshBasicMaterial
            if (sdMat) sdMat.opacity = 0.16
          }
          scene.add(rig.root)
          entry = {
            state: p,
            rig,
            renderX: p.x,
            renderZ: p.y,
            serverX: p.x,
            serverZ: p.y,
            serverAtMs: nowRecv,
            facingYaw: Math.atan2(p.aimDx || 0, p.aimDy || 1),
            wasAlive: p.alive,
            wasDummyHp: p.hp,
            trailHp: p.hp,
          }
          actors.set(p.id, entry)
        } else {
          if ((entry.state.basicCooldownMs ?? 0) === 0 && (p.basicCooldownMs ?? 0) > 0) {
            entry.rig.attackSwingUntil = nowRecv + 250
            entry.rig.attackSwingSide *= -1
          }
          for (let sIdx = 0; sIdx < 3; sIdx++) {
            if ((entry.state.cooldownsMs?.[sIdx] ?? 0) <= 0 && (p.cooldownsMs?.[sIdx] ?? 0) > 400) {
              entry.rig.castAnimUntil = nowRecv + 340
              entry.rig.castAnimSlot = sIdx + 1
              if (p.id === myPlayerId && sIdx === 2) {
                zoomPunch = Math.max(zoomPunch, 0.055)
              }
            }
          }
          // Detect genuine server teleports/dashes/respawns (>85px jump between consecutive server snapshots)
          // vs normal walking latency drift so high-RTT walking NEVER rubber-bands backward!
          const serverJump = Math.hypot(p.x - entry.serverX, p.y - entry.serverZ)
          const respawned = !entry.wasAlive && p.alive
          if (respawned || serverJump > 85) {
            entry.renderX = p.x
            entry.renderZ = p.y
            if (respawned) entry.trailHp = p.hp
          }
          entry.serverX = p.x
          entry.serverZ = p.y
          entry.serverAtMs = nowRecv
          if (entry.wasAlive && p.hp < entry.wasDummyHp) {
            const dmg = entry.wasDummyHp - p.hp
            entry.rig.hitFlashUntil = nowRecv + 95
            const inWaterHit = mapCfg.id === 'sisaket_island' && !isOnSisaketDryLand(p.x, p.y) && dmg === 5
            if (p.isDummy || inWaterHit || p.id !== myPlayerId) {
              popups.push({
                x: p.x + (Math.random() - 0.5) * 20,
                z: p.y,
                y3d: 58,
                text: inWaterHit ? '-5 🌊' : `-${dmg}!`,
                color: inWaterHit ? '#38BDF8' : dmg >= 40 ? '#FACC15' : '#FB7185',
                life: 0.78,
                maxLife: 0.78,
              })
              vfx.spawnImpact(p.x, p.y, inWaterHit ? 0x38bdf8 : 0xfacc15, inWaterHit ? 9 : 7)
            }
          } else if (entry.wasAlive && p.alive && !p.isDummy && p.hp > entry.wasDummyHp && p.hp - entry.wasDummyHp >= 10) {
            const healed = p.hp - entry.wasDummyHp
            popups.push({
              x: p.x,
              z: p.y,
              y3d: 62,
              text: `+${healed} 💚`,
              color: '#34D399',
              life: 0.85,
              maxLife: 0.85,
            })
            vfx.spawnImpact(p.x, p.y, 0x34d399, 8)
          }
          entry.wasAlive = p.alive
          entry.wasDummyHp = p.hp
          entry.state = p
        }
      }
      for (const [id, entry] of actors.entries()) {
        if (!present.has(id)) {
          scene.remove(entry.rig.root)
          disposeHeroRig3D(entry.rig)
          actors.delete(id)
        }
      }
    }

    // Raycast mouse screen coordinate onto Y = 0 battlefield ground plane cleanly
    const raycaster = new THREE.Raycaster()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hitVec = new THREE.Vector3()
    const screenToWorldXZ = (sx: number, sy: number): { wx: number; wz: number } | null => {
      const ndc = new THREE.Vector2((sx / Math.max(1, width)) * 2 - 1, -(sy / Math.max(1, height)) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(groundPlane, hitVec)) return null
      return {
        wx: clamp(hitVec.x, 0, mapCfg.width),
        wz: clamp(hitVec.z, 0, mapCfg.height),
      }
    }

    const toLocalXY = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      return {
        sx: r.width > 0 ? ((ev.clientX - r.left) / r.width) * width : 0,
        sy: r.height > 0 ? ((ev.clientY - r.top) / r.height) * height : 0,
      }
    }

    const updateMinimapPeek = (sx: number, sy: number) => {
      const rx = clamp((sx - minimapRect.x) / Math.max(1, minimapRect.w), 0, 1)
      const ry = clamp((sy - minimapRect.y) / Math.max(1, minimapRect.h), 0, 1)
      cameraPeek.active = true
      cameraPeek.minimapMode = true
      cameraPeek.worldX = rx * mapCfg.width
      cameraPeek.worldZ = ry * mapCfg.height
    }

    const onPointerDown = (ev: PointerEvent) => {
      if (dragPan.pointerId !== -1) return
      const { sx, sy } = toLocalXY(ev)
      const inMinimap =
        sx >= minimapRect.x &&
        sx <= minimapRect.x + minimapRect.w &&
        sy >= minimapRect.y &&
        sy <= minimapRect.y + minimapRect.h

      dragPan = {
        pointerId: ev.pointerId,
        button: ev.button,
        downX: sx,
        downY: sy,
        lastX: sx,
        lastY: sy,
        moved: false,
      }
      if (inMinimap) {
        updateMinimapPeek(sx, sy)
      }
    }

    let lastAimRaycastMs = 0
    const onPointerMove = (ev: PointerEvent) => {
      const { sx, sy } = toLocalXY(ev)
      const now = performance.now()
      if (aimPreview.active || now - lastAimRaycastMs >= 16) {
        lastAimRaycastMs = now
        const worldPt = screenToWorldXZ(sx, sy)
        if (worldPt) {
          gameEventBus.emitAimMove({ worldX: worldPt.wx, worldY: worldPt.wz, active: true })
        }
      }
      if (dragPan.pointerId === ev.pointerId) {
        if (cameraPeek.minimapMode) {
          dragPan.moved = true
          updateMinimapPeek(sx, sy)
        } else {
          const dist = Math.hypot(sx - dragPan.downX, sy - dragPan.downY)
          if (dist >= (ev.pointerType === 'touch' ? 6 : 10)) {
            if (!dragPan.moved) {
              dragPan.moved = true
              cameraPeek.active = true
              cameraPeek.minimapMode = false
              cameraPeek.worldX = focusX
              cameraPeek.worldZ = focusZ
            }
            const panScale = ev.pointerType === 'touch' ? 1.5 : 1.3
            cameraPeek.worldX = clamp(cameraPeek.worldX - (sx - dragPan.lastX) * panScale, 120, mapCfg.width - 120)
            cameraPeek.worldZ = clamp(cameraPeek.worldZ - (sy - dragPan.lastY) * panScale, 120, mapCfg.height - 120)
          }
        }
        dragPan.lastX = sx
        dragPan.lastY = sy
      }
    }

    const onPointerUp = (ev: PointerEvent) => {
      if (dragPan.pointerId === ev.pointerId) {
        const wasMoved = dragPan.moved
        const btn = dragPan.button
        dragPan.pointerId = -1
        dragPan.moved = false
        cameraPeek.active = false
        cameraPeek.minimapMode = false
        if (!wasMoved && btn === 0) {
          const { sx, sy } = toLocalXY(ev)
          const pt = screenToWorldXZ(sx, sy)
          if (pt) gameEventBus.emitCastClick({ worldX: pt.wx, worldY: pt.wz })
        }
      }
    }

    const onPointerLeave = () => {
      gameEventBus.emitAimMove({ worldX: 0, worldY: 0, active: false })
    }

    const canvasEl = renderer.domElement
    canvasEl.addEventListener('pointerdown', onPointerDown)
    canvasEl.addEventListener('pointermove', onPointerMove)
    canvasEl.addEventListener('pointerup', onPointerUp)
    canvasEl.addEventListener('pointercancel', onPointerUp)
    canvasEl.addEventListener('pointerleave', onPointerLeave)

    // Subscribe to Game Event Bus
    const unsubInit = gameEventBus.onInit((payload) => {
      myPlayerId = payload.myPlayerId
      mapCfg = payload.mapCfg
      rebuildEnvironment3D(mapCfg)
      syncRosterState(payload.players)
      projectiles = payload.projectiles
      beams = payload.beams
      zones = payload.zones

      const me = actors.get(myPlayerId)
      if (me) {
        focusX = me.state.x
        focusZ = me.state.y
      }

      // Warm-compile GPU WebGL Shaders BEFORE removing loading veil!
      renderer.compile(scene, camera)
      if (!hasEmittedReady && payload.players.length > 0) {
        hasEmittedReady = true
        gameEventBus.emitSceneReady()
      }
    })

    const unsubSync = gameEventBus.onSync((payload) => {
      syncRosterState(payload.players)
      projectiles = payload.projectiles
      beams = payload.beams
      zones = payload.zones

      const curCfg = useGameStore.getState().mapCfg
      if (curCfg && curCfg.id !== mapCfg.id) {
        mapCfg = curCfg
        rebuildEnvironment3D(mapCfg)
      }

      if (!hasEmittedReady && payload.players.length > 0) {
        hasEmittedReady = true
        gameEventBus.emitSceneReady()
      }
    })

    const unsubDied = gameEventBus.onDied((ev) => {
      vfx.spawnImpact(ev.x, ev.y, 0xef4444, 16)
      vfx.spawnGroundDecal(ev.x, ev.y, 64, 0xef4444, 2.4)
      soundEngine.playEffectSound('player_died')
      shakePower = Math.max(shakePower, 15)
      zoomPunch = Math.max(zoomPunch, 0.048)

      const now = performance.now()
      const kName = (ev.killerName || 'Arena').trim()
      const vName = (ev.victimName || 'Enemy').trim()
      const victimPrev = killerStreakMap.get(vName)?.count ?? 0
      killerStreakMap.delete(vName)

      const prev = killerStreakMap.get(kName)
      const nextCount = prev && now - prev.lastAtMs <= 14000 ? prev.count + 1 : 1
      killerStreakMap.set(kName, { count: nextCount, lastAtMs: now })

      let title = `⚔️ ${kName} สังหาร ${vName}!`
      let accent = '#FACC15'
      if (!firstBloodAnnounced) {
        firstBloodAnnounced = true
        title = '🩸 FIRST BLOOD!'
        accent = '#EF4444'
      } else if (victimPrev >= 2) {
        title = '🛡️ SHUT DOWN!'
        accent = '#38BDF8'
      } else if (nextCount === 2) {
        title = '⚔️ DOUBLE KILL!'
        accent = '#F59E0B'
      } else if (nextCount === 3) {
        title = '🔥 TRIPLE KILL!'
        accent = '#A855F7'
      } else if (nextCount === 4) {
        title = '⚡ ULTRA KILL!'
        accent = '#EC4899'
      } else if (nextCount >= 5) {
        title = '👑 LEGENDARY RAMPAGE!'
        accent = '#FEF08A'
      }
      activeKillBanner = {
        title,
        subtitle: `${kName} ➔ ${vName} • โบนัสสังหาร +18% HP & รีเซ็ต Dash!`,
        accent,
        untilMs: now + 2600,
        maxDurMs: 2600,
      }
      soundEngine.playEffectSound('kill_streak_fanfare')
    })

    const unsubEmote = gameEventBus.onEmote((ev) => {
      emotePopups.push({ playerId: ev.playerId, text: ev.emote, life: 2.0 })
    })

    const unsubSnap = gameEventBus.onInfinitySnap(() => {
      shakePower = Math.max(shakePower, 22)
    })

    const unsubAim = gameEventBus.onAimPreview((p) => {
      aimPreview = p
    })

    const ro = new ResizeObserver(syncCanvasSizes)
    ro.observe(host)

    // Main 60/120Hz 3D Frame Loop
    let rafId = 0
    let lastTs = performance.now()
    let fpsAccum = 0
    let fpsCount = 0
    let curCamHeight = width < 780 ? 590 : 540
    let curCamBackZ = width < 780 ? 460 : 420
    let curZoomBlend = 0
    let shadowFrameTick = 0
    let lastShadowSnapX = -99999
    let lastShadowSnapZ = -99999
    const labelWidthCache = new Map<string, number>()
    const projVec = new THREE.Vector3()

    const renderFrame = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTs) / 1000))
      lastTs = nowMs

      fpsAccum += dt
      fpsCount += 1
      if (fpsAccum >= 1.0) {
        gameEventBus.emitFPS(Math.round(fpsCount / fpsAccum))
        fpsAccum = 0
        fpsCount = 0
      }

      // Smooth RTT EMA for latency-compensated prediction over WAN/Cloudflare Tunnel
      const rawPing = useGameStore.getState().pingMs
      if (rawPing !== null && rawPing > 0) {
        smoothedRttMs += (clamp(rawPing, 8, 420) - smoothedRttMs) * Math.min(1, dt * 4)
      }
      const localInpState = getLocalMoveInputState()

      // 1. Update All Hero 3D Transforms, 360° Yaw Rotation, Walking Limbs & Infinity Stones
      for (const entry of actors.values()) {
        const p = entry.state
        const rig = entry.rig
        rig.root.visible = p.alive || !p.isDummy

        if (!p.alive) {
          rig.bodyPivot.visible = false
          rig.shadowDisc.scale.setScalar(0.6)
          continue
        }
        rig.bodyPivot.visible = true
        rig.shadowDisc.scale.setScalar(1)

        // Exact hero speed synced with server Engine.StepPlayer
        let spd = charSpeedMap.get(p.characterId) ?? mapCfg.moveSpeed
        if (p.godspeed) spd *= 1.85
        if (p.slowed) spd *= 0.55
        const inSisaketWater = mapCfg.id === 'sisaket_island' && !isOnSisaketDryLand(entry.renderX, entry.renderZ)
        if (inSisaketWater) spd *= 0.78

        const prevX = entry.renderX
        const prevZ = entry.renderZ
        if (p.id === myPlayerId && !p.stunned && !p.seated) {
          const mag = Math.hypot(localInpState.dx, localInpState.dy)
          if (mag > 0.02) {
            const nx = mag > 1 ? localInpState.dx / mag : localInpState.dx
            const nz = mag > 1 ? localInpState.dy / mag : localInpState.dy
            const stepped = resolveObstaclesLocal(entry.renderX + nx * spd * dt, entry.renderZ + nz * spd * dt, mapCfg)
            entry.renderX = stepped.x
            entry.renderZ = stepped.z
          }

          // RTT-Compensated & Sequence-Aware Server Reconciliation:
          // Never fight our own in-flight input across WAN/Cloudflare Tunnel!
          const inputInFlight =
            (p.lastSeq ?? 0) < localInpState.seq || nowMs - localInpState.changedAtMs < smoothedRttMs + 65
          const ageSec = clamp((nowMs - entry.serverAtMs) / 1000, 0, 0.22)
          const halfRttSec = (smoothedRttMs * 0.5) / 1000
          const leadSec = mag > 0.02 ? clamp(halfRttSec + ageSec, 0, 0.28) : clamp(ageSec, 0, 0.12)
          const estServer = resolveObstaclesLocal(
            entry.serverX + p.dx * spd * leadSec,
            entry.serverZ + p.dy * spd * leadSec,
            mapCfg,
          )
          const errX = estServer.x - entry.renderX
          const errZ = estServer.z - entry.renderZ
          const errDist = Math.hypot(errX, errZ)

          if (errDist > 260) {
            entry.renderX = estServer.x
            entry.renderZ = estServer.z
          } else if (!inputInFlight) {
            const deadzone = mag > 0.02 ? 16 : 1.2
            if (errDist > deadzone) {
              const rate = mag > 0.02 ? 3.2 : 10.5
              const k = 1 - Math.exp(-rate * dt)
              entry.renderX += errX * k
              entry.renderZ += errZ * k
            }
          }
        } else {
          // Smooth Velocity-Extrapolated Interpolation for Remote Heroes & Dummies (absorbs TCP burst jitter!)
          const ageSec = clamp((nowMs - entry.serverAtMs) / 1000, 0, 0.085)
          const targetX = entry.serverX + p.dx * spd * ageSec
          const targetZ = entry.serverZ + p.dy * spd * ageSec
          const k = 1 - Math.exp(-(p.id === myPlayerId ? 18 : 13) * dt)
          entry.renderX += (targetX - entry.renderX) * k
          entry.renderZ += (targetZ - entry.renderZ) * k
        }
        rig.root.position.set(entry.renderX, inSisaketWater ? -7 : 0, entry.renderZ)

        // 360° Smooth Character Yaw Rotation matching travel direction or spell aim!
        const localInp = p.id === myPlayerId ? localInpState : { dx: p.dx, dy: p.dy }
        const speedMag = Math.hypot(localInp.dx, localInp.dy)
        const moveDx = entry.renderX - prevX
        const moveDz = entry.renderZ - prevZ
        const targetDirX = speedMag > 0.05 ? localInp.dx : p.aimDx || moveDx
        const targetDirZ = speedMag > 0.05 ? localInp.dy : p.aimDy || moveDz
        if (Math.hypot(targetDirX, targetDirZ) > 0.02) {
          const desiredYaw = Math.atan2(targetDirX, targetDirZ)
          entry.facingYaw += normalizeAngleDelta(desiredYaw - entry.facingYaw) * (1 - Math.exp(-17 * dt))
        }
        rig.modelPivot.rotation.y = entry.facingYaw

        // Kinetic Stride, Parabolic Leap, Cape Flutter, Companions & Diagonal Attack Sweep!
        const jumpLift =
          nowMs < rig.leapUntil
            ? Math.sin(clamp(1 - (rig.leapUntil - nowMs) / 560, 0, 1) * Math.PI) * 86
            : 0
        updateHeroHitFlash3D(rig, nowMs)
        if (entry.trailHp > p.hp) {
          entry.trailHp = Math.max(p.hp, entry.trailHp - Math.max(25, p.maxHp * 0.55) * dt)
        } else {
          entry.trailHp = p.hp
        }
        if (!rig.isDummy) {
          const stepDist = Math.hypot(entry.renderX - prevX, entry.renderZ - prevZ)
          const isMoving = speedMag > 0.05 || stepDist > 0.35
          const isSprinting = Boolean(p.godspeed) || stepDist > 8.5

          // Spawn Ghost Afterimage Silhouettes on High-Speed Dashes / Godspeed
          rig.afterimageCooldown = Math.max(0, rig.afterimageCooldown - dt)
          if ((stepDist > 26 || p.godspeed) && rig.afterimageCooldown <= 0) {
            const ghostHex = Number.parseInt(p.color.replace('#', ''), 16) || 0x38bdf8
            vfx.spawnDashGhost(prevX, prevZ, entry.facingYaw, ghostHex)
            rig.afterimageCooldown = stepDist > 26 ? 0.03 : 0.075
          }

          if (isMoving) {
            rig.walkPhase += dt * (isSprinting ? 18 : 13)
            const swing = Math.sin(rig.walkPhase) * (isSprinting ? 0.92 : 0.72)
            rig.leftLeg.rotation.x = swing
            rig.rightLeg.rotation.x = -swing
            rig.leftArm.rotation.x = -swing * 0.72
            rig.rightArm.rotation.x = swing * 0.72
            rig.bodyPivot.position.y = jumpLift + Math.abs(Math.cos(rig.walkPhase)) * (isSprinting ? 5 : 3.5)
            rig.bodyPivot.rotation.x = isSprinting ? 0.28 : 0.1
          } else {
            rig.leftLeg.rotation.x *= 0.8
            rig.rightLeg.rotation.x *= 0.8
            rig.leftArm.rotation.x *= 0.8
            rig.bodyPivot.position.y = jumpLift + Math.sin(nowMs * 0.004 + rig.walkPhase) * 1.3
            rig.bodyPivot.rotation.x *= 0.82
          }
          animateHeroPose3D(rig, nowMs, isMoving)
          if (jumpLift > 0) {
            rig.bodyPivot.position.y += jumpLift
          }

          rig.shadowDisc.scale.setScalar(clamp(1 - jumpLift / 220, 0.55, 1))

          if (rig.capePivot) {
            rig.capePivot.rotation.x = (isMoving ? (isSprinting ? 0.65 : 0.38) : 0.1) + Math.sin(nowMs * 0.012 + rig.walkPhase) * (isMoving ? 0.18 : 0.06)
          }

          if (rig.companionGroup) {
            if (p.characterId === 'kaem') {
              // Bouncing Rimuru Slime beside shoulder
              rig.companionGroup.position.y = 22 + Math.abs(Math.sin(nowMs * 0.007)) * 9
              rig.companionGroup.rotation.y = Math.sin(nowMs * 0.004) * 0.25
            } else if (p.characterId === 'frame') {
              // Hovering Ai-Ouan cosmic Stand Cat
              rig.companionGroup.position.y = 44 + Math.sin(nowMs * 0.0065) * 5.5
            }
          }

          if (rig.fastFistsGroup) {
            rig.fastFistsGroup.visible = Boolean(p.fastAttack)
          }

          if (nowMs < rig.attackSwingUntil) {
            const prog = 1 - (rig.attackSwingUntil - nowMs) / 250
            const arc = Math.sin(prog * Math.PI)
            rig.rightArm.rotation.x = -1.45 * arc
            rig.rightArm.rotation.z = rig.attackSwingSide * 0.75 * arc
            rig.bodyPivot.rotation.y = rig.attackSwingSide * 0.42 * arc
          } else {
            rig.rightArm.rotation.z *= 0.78
            rig.bodyPivot.rotation.y *= 0.78
            if (!isMoving) rig.rightArm.rotation.x *= 0.8
          }

          if (rig.extraOrbitalGroup) {
            rig.extraOrbitalGroup.rotation.y = nowMs * 0.0032
            if (p.characterId === 'noone') {
              rig.extraOrbitalGroup.visible = (p.infinityStones?.length ?? 0) >= 5
            }
          }
          if (rig.throneGroup) {
            rig.throneGroup.visible = Boolean(p.seated)
          }
          if (rig.kuramaGroup) {
            const transformed = Boolean(p.godspeed)
            rig.kuramaGroup.visible = transformed
            if (transformed) {
              for (const ch of rig.kuramaGroup.children) {
                const idx = ch.userData.tailIdx as number | undefined
                if (idx !== undefined) {
                  const fan = (idx - 4) * 0.25
                  ch.rotation.x = -0.55 - Math.abs(idx - 4) * 0.05 + Math.sin(nowMs * 0.008 + idx * 0.7) * 0.14
                  ch.rotation.y = fan * 0.65 + Math.cos(nowMs * 0.007 + idx * 0.6) * 0.1
                }
              }
            }
          }

          // Dynamically light collected Infinity Stones [1..5] on Thanos's Gauntlet
          if (p.characterId === 'noone' && rig.gauntletGemMats) {
            const owned = p.infinityStones ?? []
            const palette = [0xa855f7, 0x3b82f6, 0xef4444, 0x10b981, 0xfacc15]
            for (let s = 0; s < 5; s++) {
              const lit = owned.includes(s + 1)
              const mat = rig.gauntletGemMats[s]
              mat.color.setHex(lit ? palette[s] : 0x334155)
              mat.emissive.setHex(lit ? palette[s] : 0x000000)
              mat.emissiveIntensity = lit ? 1.45 : 0
            }
          }
        }

        // Status Halo & Shield Dome visuals
        rig.shieldSphere.visible = Boolean(p.invulnerable)
        if (p.godspeed || p.stunned || p.slowed || p.inVoid) {
          rig.statusHalo.visible = true
          const haloMat = rig.statusHalo.material as THREE.MeshBasicMaterial
          haloMat.color.setHex(p.inVoid ? 0xa855f7 : p.stunned ? 0xfacc15 : p.godspeed ? 0x22d3ee : 0xc084fc)
          haloMat.opacity = 0.78 + Math.sin(nowMs * 0.01) * 0.18
        } else {
          rig.statusHalo.visible = false
        }
      }

      // 2. Sync Audio SFX + Screen Shake + Impact Particles + Leap Arcs on newly spawned Beams / Projectiles / Zones
      for (const b of beams) {
        if (!seenEffects.has(b.id)) {
          seenEffects.add(b.id)
          soundEngine.playEffectSound(b.kind)
          const bCol = Number.parseInt(b.accentColor.replace('#', ''), 16) || 0xfacc15
          if (b.kind === 'killua_leap_arc' && b.ownerId) {
            const ownerEntry = actors.get(b.ownerId)
            if (ownerEntry) ownerEntry.rig.leapUntil = performance.now() + 560
          } else if (
            b.kind === 'saitama_serious_punch' ||
            b.kind === 'hollow_purple_blast' ||
            b.kind === 'infinite_void_open' ||
            b.kind === 'kamehameha' ||
            b.kind === 'enuma_elish' ||
            b.kind === 'simo_snipe_max'
          ) {
            vfx.spawnImpact(b.x2, b.y2, bCol, 18)
            shakePower = Math.max(shakePower, b.kind === 'saitama_serious_punch' ? 22 : 12)
          } else if (
            b.kind === 'zenitsu_hekireki' ||
            b.kind === 'zenitsu_rokuren' ||
            b.kind === 'shishi_sonson' ||
            b.kind === 'narukami_strike' ||
            b.kind === 'black_lightning_strike' ||
            b.kind === 'goku_dragon_rush' ||
            b.kind === 'aiouan_ora_rush' ||
            b.kind === 'simo_backflip_shot'
          ) {
            vfx.spawnImpact(b.x2, b.y2, bCol, 12)
            shakePower = Math.max(shakePower, 8.5)
          } else if (b.kind.startsWith('atk_')) {
            vfx.spawnImpact(b.x2, b.y2, bCol, 5)
          }
        }
      }
      for (const pr of projectiles) {
        if (!seenEffects.has(pr.id)) {
          seenEffects.add(pr.id)
          soundEngine.playEffectSound(pr.kind)
        }
      }
      for (const z of zones) {
        const isWind = (z.delayLeft ?? 0) > 0 && (z.maxDelay ?? 0) > 0
        const key = isWind ? `${z.id}:windup` : z.id
        if (!seenEffects.has(key)) {
          seenEffects.add(key)
          if (!isWind) {
            soundEngine.playEffectSound(z.kind)
            const zCol = Number.parseInt(z.accentColor.replace('#', ''), 16) || 0xfacc15
            if (z.kind === 'hollow_purple' || z.kind === 'thanos_infinity_snap' || z.kind === 'saitama_crater') {
              vfx.spawnImpact(z.x, z.y, zCol, 22)
              vfx.spawnGroundDecal(z.x, z.y, z.radius * 0.92, zCol, 2.5)
              shakePower = Math.max(shakePower, 18)
              if (z.kind === 'hollow_purple') {
                soundEngine.speakSkillCallout('sia_mon', 'purple', '虚式、茈！')
              } else if (z.kind === 'thanos_infinity_snap' && z.ownerId !== myPlayerId) {
                soundEngine.speakSkillCallout('noone', 'snap', 'I am inevitable!')
              }
            } else if (
              z.kind === 'sanzen_sekai' ||
              z.kind === 'beelzebuth' ||
              z.kind === 'aiouan_timestop' ||
              z.kind === 'infinite_void' ||
              z.kind === 'malevolent_shrine' ||
              z.kind === 'zenitsu_honoo_no_kami' ||
              z.kind === 'fuga_explosion' ||
              z.kind === 'jinwoo_arise' ||
              z.kind === 'luffy_bajrang_smash' ||
              z.kind === 'diablo_eclipse_burst' ||
              z.kind === 'sanji_ifrit_burst' ||
              z.kind === 'naruto_shuriken_boom' ||
              z.kind === 'ben10_heat_boom'
            ) {
              vfx.spawnImpact(z.x, z.y, zCol, 15)
              vfx.spawnGroundDecal(z.x, z.y, Math.min(180, z.radius * 0.85), zCol, 2.2)
              shakePower = Math.max(shakePower, 11)
              if (z.ownerId && z.ownerId !== myPlayerId) {
                const ownerChar = actors.get(z.ownerId)?.state.characterId
                if (ownerChar) soundEngine.speakSkillCallout(ownerChar, 3)
              }
            }
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
        }
      }
      if (seenEffects.size > 400) seenEffects.clear()

      const meActor = actors.get(myPlayerId)
      vfx.syncProjectiles(projectiles, dt, nowMs)
      vfx.syncBeams(beams, dt)
      vfx.syncZones(zones, dt, nowMs)
      vfx.stepParticles(dt)
      vfx.updateAimPreview(meActor?.state, aimPreview, nowMs, meActor?.renderX, meActor?.renderZ)

      // 3. Elevated MLBB 3D Camera Follow + Simo Full-Map Sniper Zoom-Out + Shake + Drag/Minimap Peek
      const isSimoSnipeZoom = Boolean(
        meActor?.state.characterId === 'simo' &&
          aimPreview.active &&
          aimPreview.slot === 2 &&
          aimPreview.chargeRatio !== undefined,
      )
      const targetFocusX = isSimoSnipeZoom
        ? mapCfg.width * 0.5
        : cameraPeek.active
          ? cameraPeek.worldX
          : (meActor?.renderX ?? mapCfg.width * 0.5)
      const targetFocusZ = isSimoSnipeZoom
        ? mapCfg.height * 0.5
        : cameraPeek.active
          ? cameraPeek.worldZ
          : (meActor?.renderZ ?? mapCfg.height * 0.5)
      const camLerp = 1 - Math.exp(-(isSimoSnipeZoom || cameraPeek.active ? 12 : 10) * dt)
      focusX += (targetFocusX - focusX) * camLerp
      focusZ += (targetFocusZ - focusZ) * camLerp

      let sxOff = 0
      let szOff = 0
      if (shakePower > 0.2) {
        sxOff = (Math.random() - 0.5) * shakePower
        szOff = (Math.random() - 0.5) * shakePower
        shakePower *= Math.pow(0.06, dt)
      } else {
        shakePower = 0
      }

      // True MLBB Elevated Tilted Isometric Camera (~52 deg downward viewing pitch)
      // When Simo charges Skill 2 (White Death Snipe), smoothly zoom out to encompass the entire map!
      const baseHeight = width < 780 ? 590 : 540
      const baseBackZ = width < 780 ? 460 : 420
      const distForFullMapW = (mapCfg.width * 0.53) / (0.38386 * Math.max(0.85, camera.aspect))
      const fullMapHeight = Math.max(2020, distForFullMapW * 0.88)
      const fullMapBackZ = Math.max(960, fullMapHeight * 0.46)
      if (zoomPunch > 0.001) {
        zoomPunch *= Math.pow(0.02, dt)
      } else {
        zoomPunch = 0
      }
      const punchScale = 1 - zoomPunch
      const wantHeight = (isSimoSnipeZoom ? fullMapHeight : baseHeight) * punchScale
      const wantBackZ = (isSimoSnipeZoom ? fullMapBackZ : baseBackZ) * punchScale
      const zoomLerp = 1 - Math.exp(-9 * dt)
      curCamHeight += (wantHeight - curCamHeight) * zoomLerp
      curCamBackZ += (wantBackZ - curCamBackZ) * zoomLerp
      curZoomBlend += ((isSimoSnipeZoom ? 1 : 0) - curZoomBlend) * zoomLerp

      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = 950 + curZoomBlend * 2800
        scene.fog.far = 2250 + curZoomBlend * 4200
      }

      camera.position.set(focusX + sxOff, curCamHeight, focusZ + curCamBackZ + szOff)
      camera.lookAt(focusX + sxOff, 18, focusZ + szOff)

      // Animate glowing Blue/Red Nexus Crystals gently in envGroup
      animateMapEnvironment3D(envGroup, nowMs, dt)

      if (isUltraTier && dirLight.castShadow) {
        const snapX = Math.round(focusX / 16) * 16
        const snapZ = Math.round(focusZ / 16) * 16
        if (snapX !== lastShadowSnapX || snapZ !== lastShadowSnapZ) {
          lastShadowSnapX = snapX
          lastShadowSnapZ = snapZ
          dirLight.position.set(snapX + 380, 780, snapZ + 340)
          dirLight.target.position.set(snapX, 0, snapZ)
          dirLight.target.updateMatrixWorld()
        }
        shadowFrameTick = (shadowFrameTick + 1) & 1
        if (shadowFrameTick === 0) {
          renderer.shadowMap.needsUpdate = true
        }
      }

      if (graphicsQuality === 'pixel' && pixelPass) {
        pixelPass.render(renderer, scene, camera, width, height, curZoomBlend > 0.45 ? 2 : 3, {
          depthEdgeStrength: 0.42,
          ditherStrength: 0.032,
          colorSteps: 28,
          quantBlend: 0.55,
        })
      } else if (graphicsQuality === 'fine_pixel' && pixelPass) {
        pixelPass.render(renderer, scene, camera, width, height, curZoomBlend > 0.45 ? 1.5 : 1.75, {
          depthEdgeStrength: 0.3,
          ditherStrength: 0.018,
          colorSteps: 48,
          quantBlend: 0.42,
        })
      } else if (ultraComposer) {
        ultraComposer.render()
      } else {
        renderer.render(scene, camera)
      }

      // 4. Synchronized 2D Screen-Projected Nameplates, HP Bars, Damage Popups & Top-Left Minimap
      if (ctx2d) {
        ctx2d.clearRect(0, 0, width, height)

        // Screen-Projected Overhead HP + Names for visible living actors
        for (const entry of actors.values()) {
          const p = entry.state
          if (!p.alive) continue
          projVec.set(entry.renderX, p.isDummy ? 68 : 66, entry.renderZ).project(camera)
          if (projVec.z > 1) continue
          const sx = (projVec.x * 0.5 + 0.5) * width
          const sy = (-projVec.y * 0.5 + 0.5) * height
          if (sx < -80 || sx > width + 80 || sy < -60 || sy > height + 60) continue

          const hpRatio = clamp(p.hp / Math.max(1, p.maxHp), 0, 1)
          const trailRatio = clamp(entry.trailHp / Math.max(1, p.maxHp), hpRatio, 1)
          const hpColor = hpRatio > 0.5 ? '#22C55E' : hpRatio > 0.25 ? '#F59E0B' : '#EF4444'
          ctx2d.fillStyle = 'rgba(9, 14, 28, 0.92)'
          ctx2d.fillRect(sx - 28, sy - 6, 56, 8)
          // Delayed White-Gold Damage Trail Bar (shows recent burst damage chunk!)
          if (trailRatio > hpRatio + 0.005) {
            ctx2d.fillStyle = '#FEF08A'
            ctx2d.fillRect(sx - 27, sy - 5, 54 * trailRatio, 6)
          }
          ctx2d.fillStyle = hpColor
          ctx2d.fillRect(sx - 27, sy - 5, 54 * hpRatio, 6)
          // Subtle 100-HP tick divider notch on overhead HP bar
          ctx2d.fillStyle = 'rgba(15, 23, 42, 0.65)'
          ctx2d.fillRect(sx - 1, sy - 5, 1.5, 6)

          // Active CC / Transformation Indicator Bar below HP bar
          if (p.inVoid || p.stunned || p.godspeed) {
            const ccCol = p.inVoid ? '#C084FC' : p.stunned ? '#FACC15' : p.characterId === 'naruto' ? '#F97316' : '#38BDF8'
            ctx2d.fillStyle = ccCol
            ctx2d.fillRect(sx - 27, sy + 3, 54, 2.5)
          }

          const isMe = p.id === myPlayerId
          const label = p.invulnerable
            ? `🛡️อมตะ ${p.name}`
            : p.stunned
              ? `⚡STUN ${p.name}`
              : isMe
                ? `${p.name} (คุณ)`
                : p.isDummy
                  ? p.name
                  : `${p.name} • ${p.characterName}`
          ctx2d.font = '700 11px Inter, "Noto Sans Thai", sans-serif'
          let tw = labelWidthCache.get(label)
          if (tw === undefined) {
            if (labelWidthCache.size > 128) labelWidthCache.clear()
            tw = Math.min(180, ctx2d.measureText(label).width + 12)
            labelWidthCache.set(label, tw)
          }
          ctx2d.fillStyle = isMe ? 'rgba(2, 132, 199, 0.92)' : 'rgba(15, 23, 42, 0.82)'
          ctx2d.fillRect(sx - tw * 0.5, sy - 26, tw, 17)
          ctx2d.fillStyle = '#FFFFFF'
          ctx2d.textAlign = 'center'
          ctx2d.textBaseline = 'middle'
          ctx2d.fillText(label, sx, sy - 17.5)
        }

        // Emote Bubbles
        for (let i = emotePopups.length - 1; i >= 0; i--) {
          const ep = emotePopups[i]
          ep.life -= dt
          if (ep.life <= 0) {
            emotePopups.splice(i, 1)
            continue
          }
          const act = actors.get(ep.playerId)
          if (!act) continue
          projVec.set(act.renderX, 92, act.renderZ).project(camera)
          const sx = (projVec.x * 0.5 + 0.5) * width
          const sy = (-projVec.y * 0.5 + 0.5) * height
          ctx2d.save()
          ctx2d.globalAlpha = Math.min(1, ep.life * 2)
          ctx2d.font = '800 13px Inter, "Noto Sans Thai", sans-serif'
          ctx2d.fillStyle = '#FEF08A'
          ctx2d.strokeStyle = '#020617'
          ctx2d.lineWidth = 4
          ctx2d.textAlign = 'center'
          ctx2d.strokeText(ep.text, sx, sy)
          ctx2d.fillText(ep.text, sx, sy)
          ctx2d.restore()
        }

        // Floating Damage Popups
        for (let i = popups.length - 1; i >= 0; i--) {
          const dp = popups[i]
          dp.life -= dt
          if (dp.life <= 0) {
            popups.splice(i, 1)
            continue
          }
          dp.y3d += 38 * dt
          projVec.set(dp.x, dp.y3d, dp.z).project(camera)
          const sx = (projVec.x * 0.5 + 0.5) * width
          const sy = (-projVec.y * 0.5 + 0.5) * height
          ctx2d.save()
          ctx2d.globalAlpha = Math.min(1, (dp.life / dp.maxLife) * 1.4)
          ctx2d.font = '900 16px Inter, sans-serif'
          ctx2d.strokeStyle = '#020617'
          ctx2d.lineWidth = 4
          ctx2d.textAlign = 'center'
          ctx2d.strokeText(dp.text, sx, sy)
          ctx2d.fillStyle = dp.color
          ctx2d.fillText(dp.text, sx, sy)
          ctx2d.restore()
        }

        // Top-Left Tactical Minimap (exact footprint compatible with HUD layout!)
        const compactPhone = width < 780 || height < 520
        const mmW = compactPhone ? 112 : 176
        const mmH = Math.round(mmW * (mapCfg.height / mapCfg.width))
        const mmX = 12
        const mmY = 8
        minimapRect = { x: mmX, y: mmY, w: mmW, h: mmH }

        const sxScale = mmW / mapCfg.width
        const syScale = mmH / mapCfg.height
        const isKonoha = mapCfg.id === 'konoha'
        const isSisaket = mapCfg.id === 'sisaket_island'
        const isScp = mapCfg.id === 'scp_site'

        // Urgent pulsing Water Hazard Banner when local hero falls into Huai Nam Kham reservoir
        if (
          isSisaket &&
          meActor &&
          meActor.state.alive &&
          !isOnSisaketDryLand(meActor.renderX, meActor.renderZ)
        ) {
          const pulse = 0.78 + Math.sin(nowMs * 0.012) * 0.22
          const bw = compactPhone ? 250 : 340
          const bh = compactPhone ? 30 : 36
          const bx = (width - bw) * 0.5
          const by = compactPhone ? 58 : 70
          ctx2d.save()
          ctx2d.globalAlpha = pulse
          ctx2d.fillStyle = 'rgba(8, 47, 73, 0.92)'
          ctx2d.beginPath()
          ctx2d.roundRect(bx, by, bw, bh, 12)
          ctx2d.fill()
          ctx2d.lineWidth = 2
          ctx2d.strokeStyle = '#38BDF8'
          ctx2d.stroke()
          ctx2d.font = compactPhone
            ? '800 11.5px Inter, "Noto Sans Thai", sans-serif'
            : '800 14px Inter, "Noto Sans Thai", sans-serif'
          ctx2d.fillStyle = '#FEF08A'
          ctx2d.textAlign = 'center'
          ctx2d.textBaseline = 'middle'
          ctx2d.fillText('🌊 ตกน้ำห้วยน้ำคำ! เลือดลดทีละ -5 รีบขึ้นเกาะ!', width * 0.5, by + bh * 0.5)
          ctx2d.restore()
        }

        const nextMmKey = `${mapCfg.id}:${mmW}x${mmH}:${mapCfg.pillars?.length ?? 0}`
        if (minimapBgKey !== nextMmKey) {
          minimapBgKey = nextMmKey
          minimapBgCanvas.width = mmW + 4
          minimapBgCanvas.height = mmH + 4
          const mg = minimapBgCanvas.getContext('2d')
          if (mg) {
            mg.clearRect(0, 0, mmW + 4, mmH + 4)
            mg.fillStyle = isScp
              ? 'rgba(5, 13, 20, 0.94)'
              : isSisaket
                ? 'rgba(8, 72, 92, 0.92)'
                : isKonoha
                  ? 'rgba(28, 43, 30, 0.88)'
                  : 'rgba(15, 23, 42, 0.88)'
            mg.beginPath()
            mg.roundRect(2, 2, mmW, mmH, 10)
            mg.fill()

            if (isScp) {
              // Draw true circular SCP Site-19 containment deck on minimap
              mg.fillStyle = '#1b2733'
              mg.beginPath()
              mg.ellipse(2 + SCP_CENTER_X * sxScale, 2 + SCP_CENTER_Z * syScale, SCP_RADIUS * sxScale, SCP_RADIUS * syScale, 0, 0, Math.PI * 2)
              mg.fill()
              mg.strokeStyle = 'rgba(52, 211, 153, 0.9)'
              mg.lineWidth = 2
              mg.beginPath()
              mg.ellipse(2 + SCP_CENTER_X * sxScale, 2 + SCP_CENTER_Z * syScale, SCP_RADIUS * sxScale, SCP_RADIUS * syScale, 0, 0, Math.PI * 2)
              mg.stroke()
            } else if (isSisaket) {
              // Draw exact dry-land Ko Klang Nam island, banks, pavilions & bridges on minimap
              mg.save()
              mg.beginPath()
              mg.roundRect(2, 2, mmW, mmH, 10)
              mg.clip()
              mg.fillStyle = '#2d7a4b'
              // Central Island
              mg.beginPath()
              mg.ellipse(2 + 1500 * sxScale, 2 + 900 * syScale, 740 * sxScale, 510 * syScale, 0, 0, Math.PI * 2)
              mg.fill()
              // West & East Banks
              mg.fillRect(2 + 60 * sxScale, 2 + 560 * syScale, 480 * sxScale, 680 * syScale)
              mg.fillRect(2 + 2460 * sxScale, 2 + 560 * syScale, 480 * sxScale, 680 * syScale)
              // Bridges & Pavilions
              mg.fillStyle = '#d6b27c'
              mg.fillRect(2 + 480 * sxScale, 2 + 795 * syScale, 380 * sxScale, 210 * syScale)
              mg.fillRect(2 + 2140 * sxScale, 2 + 795 * syScale, 380 * sxScale, 210 * syScale)
              mg.fillRect(2 + 1435 * sxScale, 2 + 220 * syScale, 130 * sxScale, 220 * syScale)
              mg.fillRect(2 + 1435 * sxScale, 2 + 1360 * syScale, 130 * sxScale, 220 * syScale)
              mg.fillRect(2 + 490 * sxScale, 2 + 605 * syScale, 490 * sxScale, 80 * syScale)
              mg.fillRect(2 + 490 * sxScale, 2 + 1115 * syScale, 490 * sxScale, 80 * syScale)
              mg.fillRect(2 + 2020 * sxScale, 2 + 605 * syScale, 490 * sxScale, 80 * syScale)
              mg.fillRect(2 + 2020 * sxScale, 2 + 1115 * syScale, 490 * sxScale, 80 * syScale)
              mg.beginPath()
              mg.arc(2 + 1500 * sxScale, 2 + 220 * syScale, 145 * sxScale, 0, Math.PI * 2)
              mg.arc(2 + 1500 * sxScale, 2 + 1580 * syScale, 145 * sxScale, 0, Math.PI * 2)
              mg.fill()
              mg.restore()
            }

            mg.lineWidth = 2
            mg.strokeStyle = isSisaket
              ? 'rgba(45, 212, 191, 0.92)'
              : isKonoha
                ? 'rgba(250, 204, 21, 0.85)'
                : 'rgba(56, 189, 248, 0.85)'
            mg.beginPath()
            mg.roundRect(2, 2, mmW, mmH, 10)
            mg.stroke()

            mg.strokeStyle = 'rgba(148, 163, 184, 0.25)'
            mg.lineWidth = 1
            mg.beginPath()
            mg.moveTo(2 + mmW / 2, 2)
            mg.lineTo(2 + mmW / 2, 2 + mmH)
            mg.moveTo(2, 2 + mmH / 2)
            mg.lineTo(2 + mmW, 2 + mmH / 2)
            mg.stroke()

            mg.fillStyle = isSisaket ? '#FACC15' : isKonoha ? '#D97706' : '#CBD5E1'
            for (const pil of mapCfg.pillars ?? []) {
              mg.beginPath()
              mg.arc(2 + pil.x * sxScale, 2 + pil.y * syScale, Math.max(2.5, pil.radius * sxScale), 0, Math.PI * 2)
              mg.fill()
            }
          }
        }

        ctx2d.save()
        ctx2d.drawImage(minimapBgCanvas, mmX - 2, mmY - 2)

        // Live Glowing Green Health Pickup Dots & Central Golden Aegis Core on Minimap
        for (const z of zones) {
          if (z.kind === 'scp_medkit_orb' && isScp) {
            const mx = mmX + z.x * sxScale
            const my = mmY + z.y * syScale
            ctx2d.fillStyle = 'rgba(52, 211, 153, 0.35)'
            ctx2d.beginPath()
            ctx2d.arc(mx, my, 5.5, 0, Math.PI * 2)
            ctx2d.fill()
            ctx2d.fillStyle = '#34D399'
            ctx2d.beginPath()
            ctx2d.arc(mx, my, 3.0, 0, Math.PI * 2)
            ctx2d.fill()
          } else if (z.kind === 'aegis_core_orb') {
            const ax = mmX + z.x * sxScale
            const ay = mmY + z.y * syScale
            ctx2d.fillStyle = 'rgba(250, 204, 21, 0.38)'
            ctx2d.beginPath()
            ctx2d.arc(ax, ay, 7.0, 0, Math.PI * 2)
            ctx2d.fill()
            ctx2d.fillStyle = '#FACC15'
            ctx2d.beginPath()
            ctx2d.arc(ax, ay, 3.8, 0, Math.PI * 2)
            ctx2d.fill()
          }
        }

        // Top-Center AAA MOBA Kill-Streak & First-Blood Announcer Banner
        if (activeKillBanner && nowMs < activeKillBanner.untilMs) {
          const rem = activeKillBanner.untilMs - nowMs
          const elapsed = activeKillBanner.maxDurMs - rem
          const fadeIn = clamp(elapsed / 160, 0, 1)
          const fadeOut = clamp(rem / 320, 0, 1)
          const alpha = Math.min(fadeIn, fadeOut)
          const bw = compactPhone ? 240 : 340
          const bh = compactPhone ? 44 : 54
          const bx = (width - bw) * 0.5
          const by = compactPhone ? 54 : 66
          ctx2d.save()
          ctx2d.globalAlpha = alpha
          ctx2d.fillStyle = 'rgba(9, 16, 36, 0.92)'
          ctx2d.beginPath()
          ctx2d.roundRect(bx, by, bw, bh, 14)
          ctx2d.fill()
          ctx2d.lineWidth = 2.2
          ctx2d.strokeStyle = activeKillBanner.accent
          ctx2d.stroke()
          ctx2d.font = compactPhone
            ? '900 14px Inter, "Noto Sans Thai", sans-serif'
            : '900 18px Inter, "Noto Sans Thai", sans-serif'
          ctx2d.fillStyle = activeKillBanner.accent
          ctx2d.textAlign = 'center'
          ctx2d.textBaseline = 'middle'
          ctx2d.fillText(activeKillBanner.title, width * 0.5, by + bh * 0.38)
          ctx2d.font = compactPhone
            ? '700 9.5px Inter, "Noto Sans Thai", sans-serif'
            : '700 11.5px Inter, "Noto Sans Thai", sans-serif'
          ctx2d.fillStyle = '#E2E8F0'
          ctx2d.fillText(activeKillBanner.subtitle, width * 0.5, by + bh * 0.74)
          ctx2d.restore()
        } else if (activeKillBanner) {
          activeKillBanner = null
        }

        // Minimap Circular Hero Portraits
        const myTeam = actors.get(myPlayerId)?.state.team
        for (const entry of actors.values()) {
          const p = entry.state
          if (!p.alive) continue
          const isMe = p.id === myPlayerId
          const isAlly = isMe || (myTeam && myTeam !== 'ffa' && p.team === myTeam)
          const iconSize = compactPhone ? (isMe ? 18 : 15) : isMe ? 22 : 18
          const half = iconSize * 0.5
          const px = clamp(mmX + entry.renderX * sxScale, mmX + half + 2, mmX + mmW - half - 2)
          const py = clamp(mmY + entry.renderZ * syScale, mmY + half + 2, mmY + mmH - half - 2)
          const ringColor = isMe ? '#FACC15' : p.isDummy ? '#FB923C' : isAlly ? '#38BDF8' : '#EF4444'

          const portraitImg = ensurePortraitLoaded(p.characterId)
          if (portraitImg && portraitImg.complete && portraitImg.naturalWidth > 0) {
            ctx2d.save()
            ctx2d.beginPath()
            ctx2d.arc(px, py, half - 1, 0, Math.PI * 2)
            ctx2d.clip()
            ctx2d.drawImage(portraitImg, px - half + 1, py - half + 1, iconSize - 2, iconSize - 2)
            ctx2d.restore()
            ctx2d.lineWidth = isMe ? 2.4 : 1.8
            ctx2d.strokeStyle = ringColor
            ctx2d.beginPath()
            ctx2d.arc(px, py, half, 0, Math.PI * 2)
            ctx2d.stroke()
          } else {
            ctx2d.fillStyle = ringColor
            ctx2d.beginPath()
            ctx2d.arc(px, py, half * 0.65, 0, Math.PI * 2)
            ctx2d.fill()
          }
        }

        // Camera Focus Frame on Minimap
        const viewHalfW = (width * 0.42) * sxScale
        const viewHalfH = (height * 0.56) * syScale
        const vx = clamp(mmX + focusX * sxScale - viewHalfW, mmX + 2, mmX + mmW - viewHalfW * 2 - 2)
        const vy = clamp(mmY + focusZ * syScale - viewHalfH, mmY + 2, mmY + mmH - viewHalfH * 2 - 2)
        ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.72)'
        ctx2d.lineWidth = 1.2
        ctx2d.strokeRect(vx, vy, Math.min(mmW - 4, viewHalfW * 2), Math.min(mmH - 4, viewHalfH * 2))
        ctx2d.restore()
      }

      rafId = window.requestAnimationFrame(renderFrame)
    }

    rafId = window.requestAnimationFrame(renderFrame)

    return () => {
      window.cancelAnimationFrame(rafId)
      ro.disconnect()
      unsubInit()
      unsubSync()
      unsubDied()
      unsubEmote()
      unsubSnap()
      unsubAim()
      canvasEl.removeEventListener('pointerdown', onPointerDown)
      canvasEl.removeEventListener('pointermove', onPointerMove)
      canvasEl.removeEventListener('pointerup', onPointerUp)
      canvasEl.removeEventListener('pointercancel', onPointerUp)
      canvasEl.removeEventListener('pointerleave', onPointerLeave)

      for (const entry of actors.values()) {
        disposeHeroRig3D(entry.rig)
      }
      actors.clear()
      vfx.dispose()
      pixelPass?.dispose()
      ultraBloomPass?.dispose()
      ultraRenderPass?.dispose()
      ultraOutputPass?.dispose()
      ultraComposer?.dispose()
      while (envDisposables.length > 0) {
        envDisposables.pop()?.dispose()
      }
      renderer.dispose()
      if (canvasEl.parentElement === host) host.removeChild(canvasEl)
      if (overlayCanvas.parentElement === host) host.removeChild(overlayCanvas)
    }
  }, [])

  return <div ref={hostRef} className="moba-phaser-stage mlbb-3d-stage" />
})
