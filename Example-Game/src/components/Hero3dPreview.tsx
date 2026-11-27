import { memo, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { animateHeroPose3D, buildHeroRig3D, disposeHeroRig3D, type HeroRig3D } from '../game/hero3dBuilder'
import type { CharacterDef, PlayerState } from '../types/game'

export type HeroShowcaseMode = '3d' | 'art'

const SHOWCASE_STORAGE_KEY = 'arenavv_hero_showcase_mode'
const SHOWCASE_SYNC_EVENT = 'arenavv:showcase-mode-change'

function readSavedShowcaseMode(): HeroShowcaseMode {
  try {
    return window.localStorage.getItem(SHOWCASE_STORAGE_KEY) === 'art' ? 'art' : '3d'
  } catch {
    return '3d'
  }
}

interface Hero3dPreviewProps {
  character: CharacterDef
  size?: 'hero' | 'lg' | 'md' | 'sm'
  frameless?: boolean
  allowViewToggle?: boolean
  className?: string
}

function hexToInt(hex: string | undefined, fallback = 0x38bdf8): number {
  if (!hex) return fallback
  return Number.parseInt(hex.replace('#', ''), 16) || fallback
}

function makePreviewPlayer(ch: CharacterDef): PlayerState {
  return {
    id: `preview-${ch.id}`,
    name: ch.displayName,
    characterId: ch.id,
    characterName: ch.displayName,
    team: 'blue',
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    aimDx: 0,
    aimDy: 1,
    color: ch.color || '#38BDF8',
    accentColor: ch.accentColor || '#FACC15',
    hp: ch.maxHp || 240,
    maxHp: ch.maxHp || 240,
    alive: true,
    kills: 0,
    stunned: false,
    godspeed: false,
    cooldownsMs: [0, 0, 0, 0, 0],
    infinityStones: ch.id === 'noone' ? [1, 2, 3, 4, 5] : [],
    lastSeq: 0,
  }
}

/**
 * Interactive 3D Hero Preview Turntable using the game's actual Three.js HeroRig3D models.
 * Reuses a single WebGLRenderer across hero switches for instant 0-stutter hero inspection
 * and supports pointer/touch drag to spin the 3D hero 360 degrees.
 */
export const Hero3dPreview = memo(function Hero3dPreview({
  character,
  size = 'lg',
  frameless = false,
  allowViewToggle,
  className = '',
}: Hero3dPreviewProps) {
  const showToggle = allowViewToggle ?? size !== 'sm'
  const [viewMode, setViewMode] = useState<HeroShowcaseMode>(readSavedShowcaseMode)
  const viewModeRef = useRef<HeroShowcaseMode>(viewMode)
  viewModeRef.current = viewMode

  useEffect(() => {
    const onSync = (ev: Event) => {
      const next = (ev as CustomEvent<HeroShowcaseMode>).detail
      if (next === '3d' || next === 'art') setViewMode(next)
    }
    window.addEventListener(SHOWCASE_SYNC_EVENT, onSync)
    return () => window.removeEventListener(SHOWCASE_SYNC_EVENT, onSync)
  }, [])

  const selectViewMode = (next: HeroShowcaseMode) => {
    setViewMode(next)
    try {
      window.localStorage.setItem(SHOWCASE_STORAGE_KEY, next)
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent<HeroShowcaseMode>(SHOWCASE_SYNC_EVENT, { detail: next }))
  }

  const hostRef = useRef<HTMLDivElement | null>(null)
  const sceneApiRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    rimLight: THREE.DirectionalLight
    pedestalRingMat: THREE.MeshBasicMaterial
    pedestalInnerMat: THREE.MeshBasicMaterial
    rig: HeroRig3D | null
    yaw: number
    targetSpinBoost: number
  } | null>(null)
  const sizeRef = useRef(size)
  sizeRef.current = size

  // Mount Three.js studio stage once per preview container
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let width = Math.max(120, host.clientWidth || 260)
    let height = Math.max(120, host.clientHeight || 260)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'pan-y'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, width / height, 10, 600)
    if (sizeRef.current === 'hero') {
      camera.position.set(0, 48, 152)
      camera.lookAt(0, 29, 0)
    } else {
      camera.position.set(0, 50, 128)
      camera.lookAt(0, 27, 0)
    }

    // Studio 3-point esports showroom lighting
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x0b1630, 1.55)
    scene.add(hemi)

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.85)
    keyLight.position.set(70, 130, 95)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.35)
    rimLight.position.set(-85, 75, -75)
    scene.add(rimLight)

    // Holographic Esports Pedestal Base + Rotating Neon Rings
    const pedestalGrp = new THREE.Group()
    const baseGeo = new THREE.CylinderGeometry(31, 35, 5, 32)
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f1d3a,
      metalness: 0.65,
      roughness: 0.3,
    })
    const baseMesh = new THREE.Mesh(baseGeo, baseMat)
    baseMesh.position.y = -2.6
    pedestalGrp.add(baseMesh)

    const outerRingGeo = new THREE.RingGeometry(27, 30.5, 40)
    outerRingGeo.rotateX(-Math.PI / 2)
    const pedestalRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
    const outerRing = new THREE.Mesh(outerRingGeo, pedestalRingMat)
    outerRing.position.y = 0.25
    pedestalGrp.add(outerRing)

    const innerRingGeo = new THREE.RingGeometry(18, 20, 32)
    innerRingGeo.rotateX(-Math.PI / 2)
    const pedestalInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    })
    const innerRing = new THREE.Mesh(innerRingGeo, pedestalInnerMat)
    innerRing.position.y = 0.35
    pedestalGrp.add(innerRing)
    scene.add(pedestalGrp)

    const api = {
      scene,
      camera,
      rimLight,
      pedestalRingMat,
      pedestalInnerMat,
      rig: null as HeroRig3D | null,
      yaw: 0.32,
      targetSpinBoost: 0,
    }
    sceneApiRef.current = api

    // Interactive 360-degree drag to spin
    let dragging = false
    let dragPointerId = -1
    let lastX = 0
    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      dragPointerId = e.pointerId
      lastX = e.clientX
      renderer.domElement.style.cursor = 'grabbing'
      try {
        renderer.domElement.setPointerCapture(e.pointerId)
      } catch {
        // Ignore capture failure
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragPointerId) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      api.yaw += dx * 0.015
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return
      dragging = false
      dragPointerId = -1
      renderer.domElement.style.cursor = 'grab'
    }

    const domEl = renderer.domElement
    domEl.addEventListener('pointerdown', onPointerDown)
    domEl.addEventListener('pointermove', onPointerMove)
    domEl.addEventListener('pointerup', onPointerUp)
    domEl.addEventListener('pointercancel', onPointerUp)

    const syncSize = () => {
      width = Math.max(120, host.clientWidth || 260)
      height = Math.max(120, host.clientHeight || 260)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(syncSize)
    ro.observe(host)

    let rafId = 0
    let lastTs = performance.now()
    const animate = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTs) / 1000))
      lastTs = nowMs

      if (viewModeRef.current === '3d') {
        if (!dragging) {
          api.yaw += dt * (0.58 + api.targetSpinBoost)
        }
        api.targetSpinBoost *= Math.pow(0.08, dt)
        outerRing.rotation.y = -nowMs * 0.0008
        innerRing.rotation.y = nowMs * 0.0013

        const rig = api.rig
        if (rig) {
          rig.modelPivot.rotation.y = api.yaw
          rig.leftArm.rotation.x = Math.sin(nowMs * 0.0024) * 0.08
          rig.rightArm.rotation.x = -Math.sin(nowMs * 0.0024) * 0.08
          animateHeroPose3D(rig, nowMs, false)

          if (rig.capePivot) {
            rig.capePivot.rotation.x = 0.14 + Math.sin(nowMs * 0.006) * 0.07
          }
          if (rig.companionGroup) {
            if (rig.characterId === 'kaem') {
              rig.companionGroup.position.y = 22 + Math.abs(Math.sin(nowMs * 0.006)) * 8
            } else if (rig.characterId === 'frame') {
              rig.companionGroup.position.y = 44 + Math.sin(nowMs * 0.0055) * 5
            }
          }
          if (rig.extraOrbitalGroup) {
            rig.extraOrbitalGroup.visible = true
            rig.extraOrbitalGroup.rotation.y = nowMs * 0.0035
          }
        }

        renderer.render(scene, camera)
      }
      rafId = window.requestAnimationFrame(animate)
    }
    rafId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(rafId)
      ro.disconnect()
      domEl.removeEventListener('pointerdown', onPointerDown)
      domEl.removeEventListener('pointermove', onPointerMove)
      domEl.removeEventListener('pointerup', onPointerUp)
      domEl.removeEventListener('pointercancel', onPointerUp)
      if (api.rig) {
        scene.remove(api.rig.root)
        disposeHeroRig3D(api.rig)
        api.rig = null
      }
      sceneApiRef.current = null
      baseGeo.dispose()
      baseMat.dispose()
      outerRingGeo.dispose()
      pedestalRingMat.dispose()
      innerRingGeo.dispose()
      pedestalInnerMat.dispose()
      renderer.dispose()
      if (domEl.parentElement === host) {
        host.removeChild(domEl)
      }
    }
  }, [])

  useEffect(() => {
    const api = sceneApiRef.current
    if (!api) return
    if (size === 'hero') {
      api.camera.position.set(0, 48, 152)
      api.camera.lookAt(0, 29, 0)
    } else {
      api.camera.position.set(0, 50, 128)
      api.camera.lookAt(0, 27, 0)
    }
  }, [size])

  // Swap only the 3D HeroRig whenever character changes (instant, zero WebGL context churn)
  useEffect(() => {
    const api = sceneApiRef.current
    if (!api) return

    if (api.rig) {
      api.scene.remove(api.rig.root)
      disposeHeroRig3D(api.rig)
      api.rig = null
    }

    const colHex = hexToInt(character.color, 0x38bdf8)
    const accHex = hexToInt(character.accentColor, 0xfacc15)
    const rig = buildHeroRig3D(makePreviewPlayer(character), true, colHex)

    // Hide battlefield ground telemetry rings/arrows inside the clean showroom turntable
    rig.floorRing.visible = false
    rig.dirChevron.visible = false
    rig.statusHalo.visible = false
    rig.shieldSphere.visible = false
    if (rig.throneGroup) rig.throneGroup.visible = false
    if (rig.gauntletGemMats) {
      const palette = [0xa855f7, 0x3b82f6, 0xef4444, 0x10b981, 0xfacc15]
      for (let i = 0; i < rig.gauntletGemMats.length; i++) {
        rig.gauntletGemMats[i].color.setHex(palette[i % palette.length])
        rig.gauntletGemMats[i].emissive.setHex(palette[i % palette.length])
        rig.gauntletGemMats[i].emissiveIntensity = 1.4
      }
    }

    api.scene.add(rig.root)
    api.rig = rig
    api.rimLight.color.setHex(colHex)
    api.pedestalRingMat.color.setHex(colHex)
    api.pedestalInnerMat.color.setHex(accHex)
    api.yaw = -0.55
    api.targetSpinBoost = 1.35
  }, [character])

  const artUrl = character.imageUrl || `/characters/${character.id}.png`
  const glowColor = character.color || '#38BDF8'

  return (
    <div
      className={`hero-3d-preview-box size-${size} ${frameless ? 'frameless' : ''} ${className}`}
      aria-label={viewMode === '3d' ? `โมเดล 3D ของ ${character.displayName}` : `รูปตัวละคร ${character.displayName}`}
    >
      {showToggle && (
        <div
          className="hero-showcase-toggle"
          role="group"
          aria-label="สลับมุมมองตัวละคร"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`hero-showcase-toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
            aria-pressed={viewMode === '3d'}
            title="มุมมองโมเดล 3D"
            onClick={() => selectViewMode('3d')}
          >
            3D
          </button>
          <button
            type="button"
            className={`hero-showcase-toggle-btn ${viewMode === 'art' ? 'active' : ''}`}
            aria-pressed={viewMode === 'art'}
            title="มุมมองรูปโชว์ 2D"
            onClick={() => selectViewMode('art')}
          >
            2D
          </button>
        </div>
      )}

      <div ref={hostRef} className={`hero-3d-canvas-host ${viewMode === 'art' ? 'is-hidden' : ''}`} />

      {viewMode === 'art' && (
        <div className="hero-showcase-art-stage">
          <div className="hero-showcase-art-glow" style={{ background: glowColor }} />
          <div
            key={character.id}
            className="hero-showcase-art-card"
            style={{
              borderColor: glowColor,
              boxShadow: `0 22px 48px -12px rgba(2, 6, 23, 0.78), 0 0 28px ${glowColor}55`,
            }}
          >
            <img src={artUrl} alt={character.displayName} className="hero-showcase-art-img" />
            <div className="hero-showcase-art-vignette" />
          </div>
        </div>
      )}

      {!frameless && viewMode === '3d' && <span className="hero-3d-drag-hint">⟲ ลากหมุน 3D</span>}
    </div>
  )
})
