import { memo, useEffect, useRef, useState } from 'react'
import { gameEventBus } from '../game/core/eventBus'
import { getSimoLiveAimDirection, setSimoSnipeCharging } from '../store/useGameStore'
import type { SkillAimType } from '../types/game'
import { HeroAimWheel } from './HeroAimWheel'
import { EmblemLock } from './HeroClassEmblem'

export interface SkillAimTrigger {
  dirX?: number
  dirY?: number
  rangeFactor: number
  targetId?: string
}

export interface MobaSkillButtonProps {
  characterId?: string
  slotId: number
  keyHint: string
  label: string
  iconUrl: string
  cooldownMs: number
  disabled: boolean
  locked?: boolean
  lockBadge?: string
  accentColor: string
  slotClass: string
  castRange?: number
  aoeRadius?: number
  aimType?: SkillAimType
  chargeDurationMs?: number
  variant?: 'basic' | 'dash' | 'skill' | 'ultimate'
  cancelZoneRef: React.RefObject<HTMLButtonElement | null>
  onDragChange: (dragging: boolean, hoveringCancel: boolean) => void
  onTrigger: (aim?: SkillAimTrigger) => void
}

const AIM_THRESHOLD_PX = 14
const MAX_AIM_PULL_PX = 52
const CANCEL_HITBOX_PAD_PX = 2
const MIN_CANCEL_DRAG_PX = 64

function isPointInsideCancelZone(
  clientX: number,
  clientY: number,
  originX: number,
  originY: number,
  cancelEl: HTMLButtonElement | null,
): boolean {
  if (!cancelEl) return false
  // Require deliberate drag away from the skill button so normal upward aiming never self-cancels
  if (Math.hypot(clientX - originX, clientY - originY) < MIN_CANCEL_DRAG_PX) {
    return false
  }
  const r = cancelEl.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return false
  const cx = r.left + r.width * 0.5
  const cy = r.top + r.height * 0.5
  const radius = Math.max(r.width, r.height) * 0.5 + CANCEL_HITBOX_PAD_PX
  return Math.hypot(clientX - cx, clientY - cy) <= radius
}

function computeRangeFactor(dist: number): number {
  if (dist <= 16) return 0
  const normalized = (dist - 16) / (MAX_AIM_PULL_PX - 16)
  return Math.max(0, Math.min(1, normalized))
}

export const MobaSkillButton = memo(function MobaSkillButton({
  characterId,
  slotId,
  keyHint,
  label,
  iconUrl,
  cooldownMs,
  disabled,
  locked = false,
  lockBadge,
  accentColor,
  slotClass,
  castRange = 360,
  aoeRadius = 60,
  aimType = 'line',
  chargeDurationMs,
  variant = 'skill',
  cancelZoneRef,
  onDragChange,
  onTrigger,
}: MobaSkillButtonProps) {
  const [dragState, setDragState] = useState<{
    active: boolean
    dx: number
    dy: number
    cancel: boolean
  }>({ active: false, dx: 0, dy: 0, cancel: false })
  const [chargePct, setChargePct] = useState(0)

  const pointerIdRef = useRef<number | null>(null)
  const hoverPreviewRef = useRef(false)
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const chargeStartMsRef = useRef<number | null>(null)
  const chargeRafRef = useRef<number | null>(null)
  const basicHoldTimerRef = useRef<number | null>(null)
  const draggedAimRef = useRef(false)
  const aimVecRef = useRef<{ dirX: number; dirY: number; rangeFactor: number; cancel: boolean }>({
    dirX: 0,
    dirY: -1,
    rangeFactor: 1,
    cancel: false,
  })

  const onCooldown = cooldownMs > 0
  // Never block Basic Attack taps while walking/attacking so rapid taps & hold-to-attack buffer cleanly
  const isBlocked = disabled || (onCooldown && variant !== 'basic')

  function stopChargeLoop() {
    if (chargeRafRef.current !== null) {
      window.cancelAnimationFrame(chargeRafRef.current)
      chargeRafRef.current = null
    }
    if (basicHoldTimerRef.current !== null) {
      window.clearInterval(basicHoldTimerRef.current)
      basicHoldTimerRef.current = null
    }
    if (chargeDurationMs) {
      setSimoSnipeCharging(false)
    }
    chargeStartMsRef.current = null
    setChargePct(0)
  }

  useEffect(() => {
    return () => {
      if (chargeRafRef.current !== null) {
        window.cancelAnimationFrame(chargeRafRef.current)
        chargeRafRef.current = null
      }
      if (basicHoldTimerRef.current !== null) {
        window.clearInterval(basicHoldTimerRef.current)
        basicHoldTimerRef.current = null
      }
      if (chargeDurationMs) {
        setSimoSnipeCharging(false)
      }
      if (hoverPreviewRef.current || pointerIdRef.current !== null) {
        hoverPreviewRef.current = false
        pointerIdRef.current = null
        gameEventBus.emitAimPreview({
          active: false,
          slot: slotId,
          dirX: 1,
          dirY: 0,
          rangeFactor: 1,
          castRange,
          aoeRadius,
          aimType,
          cancel: false,
        })
      }
    }
  }, [slotId, castRange, aoeRadius, aimType, chargeDurationMs])

  function handlePointerEnter(e: React.PointerEvent<HTMLButtonElement>) {
    if (isBlocked || e.pointerType !== 'mouse' || pointerIdRef.current !== null) return
    hoverPreviewRef.current = true
    gameEventBus.emitAimPreview({
      active: true,
      slot: slotId,
      dirX: 0,
      dirY: -1,
      rangeFactor: aimType === 'ground' ? 0.55 : 1,
      castRange,
      aoeRadius,
      aimType,
      cancel: false,
    })
  }

  function handlePointerLeave() {
    if (!hoverPreviewRef.current || pointerIdRef.current !== null) return
    hoverPreviewRef.current = false
    gameEventBus.emitAimPreview({
      active: false,
      slot: slotId,
      dirX: 1,
      dirY: 0,
      rangeFactor: 1,
      castRange,
      aoeRadius,
      aimType,
      cancel: false,
    })
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (isBlocked) return
    e.preventDefault()
    e.stopPropagation()
    hoverPreviewRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerIdRef.current = e.pointerId
    originRef.current = { x: e.clientX, y: e.clientY }
    draggedAimRef.current = false
    const initDir = chargeDurationMs ? getSimoLiveAimDirection() : { dirX: 0, dirY: -1 }
    aimVecRef.current = {
      dirX: initDir.dirX,
      dirY: initDir.dirY,
      rangeFactor: aimType === 'ground' ? 0 : 1,
      cancel: false,
    }
    setDragState({ active: true, dx: 0, dy: 0, cancel: false })
    if (variant !== 'basic') {
      onDragChange(true, false)
    }
    gameEventBus.emitAimPreview({
      active: true,
      slot: slotId,
      dirX: initDir.dirX,
      dirY: initDir.dirY,
      rangeFactor: aimType === 'ground' ? 0 : 1,
      castRange,
      aoeRadius,
      aimType,
      cancel: false,
      chargeRatio: chargeDurationMs ? 0 : undefined,
    })

    // Fire Basic Attack immediately on press-down (and repeat while held) so walking + attacking never drops!
    if (variant === 'basic') {
      onTrigger()
      if (basicHoldTimerRef.current !== null) {
        window.clearInterval(basicHoldTimerRef.current)
      }
      basicHoldTimerRef.current = window.setInterval(() => {
        if (pointerIdRef.current === null) return
        if (draggedAimRef.current) {
          onTrigger({
            dirX: aimVecRef.current.dirX,
            dirY: aimVecRef.current.dirY,
            rangeFactor: aimVecRef.current.rangeFactor,
          })
        } else {
          onTrigger()
        }
      }, 170)
    }

    if (chargeDurationMs && chargeDurationMs > 0) {
      setSimoSnipeCharging(true)
      chargeStartMsRef.current = performance.now()
      const stepCharge = () => {
        if (pointerIdRef.current === null || chargeStartMsRef.current === null) return
        const ratio = Math.min(1, (performance.now() - chargeStartMsRef.current) / chargeDurationMs)
        setChargePct(Math.round(ratio * 100))
        if (!draggedAimRef.current) {
          const liveDir = getSimoLiveAimDirection()
          aimVecRef.current.dirX = liveDir.dirX
          aimVecRef.current.dirY = liveDir.dirY
        }
        gameEventBus.emitAimPreview({
          active: true,
          slot: slotId,
          dirX: aimVecRef.current.dirX,
          dirY: aimVecRef.current.dirY,
          rangeFactor: aimVecRef.current.rangeFactor,
          castRange,
          aoeRadius,
          aimType,
          cancel: aimVecRef.current.cancel,
          chargeRatio: ratio,
        })
        chargeRafRef.current = window.requestAnimationFrame(stepCharge)
      }
      chargeRafRef.current = window.requestAnimationFrame(stepCharge)
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    const rawX = e.clientX - originRef.current.x
    const rawY = e.clientY - originRef.current.y
    const dist = Math.hypot(rawX, rawY)
    const cancel =
      variant !== 'basic' &&
      isPointInsideCancelZone(
        e.clientX,
        e.clientY,
        originRef.current.x,
        originRef.current.y,
        cancelZoneRef.current,
      )

    const clampedDist = Math.min(dist, MAX_AIM_PULL_PX)
    const nx = dist > 0.01 ? rawX / dist : 1
    const ny = dist > 0.01 ? rawY / dist : 0

    setDragState({
      active: true,
      dx: nx * clampedDist,
      dy: ny * clampedDist,
      cancel,
    })
    if (variant !== 'basic') {
      onDragChange(true, cancel)
    }

    const liveCharge =
      chargeDurationMs && chargeStartMsRef.current !== null
        ? Math.min(1, (performance.now() - chargeStartMsRef.current) / chargeDurationMs)
        : undefined

    // On PC mouse during Simo Skill 2 zoom: if cursor moves onto the battlefield (> 72px from button), aim directly at 3D cursor!
    if (chargeDurationMs && e.pointerType === 'mouse' && dist > MAX_AIM_PULL_PX * 1.38) {
      draggedAimRef.current = false
      const liveDir = getSimoLiveAimDirection()
      aimVecRef.current = { dirX: liveDir.dirX, dirY: liveDir.dirY, rangeFactor: 1, cancel }
      gameEventBus.emitAimPreview({
        active: true,
        slot: slotId,
        dirX: liveDir.dirX,
        dirY: liveDir.dirY,
        rangeFactor: 1,
        castRange,
        aoeRadius,
        aimType,
        cancel,
        chargeRatio: liveCharge,
      })
    } else if (dist >= AIM_THRESHOLD_PX) {
      draggedAimRef.current = true
      const rf = computeRangeFactor(dist)
      aimVecRef.current = { dirX: nx, dirY: ny, rangeFactor: rf, cancel }
      gameEventBus.emitAimPreview({
        active: true,
        slot: slotId,
        dirX: nx,
        dirY: ny,
        rangeFactor: rf,
        castRange,
        aoeRadius,
        aimType,
        cancel,
        chargeRatio: liveCharge,
      })
    } else {
      aimVecRef.current.cancel = cancel
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    pointerIdRef.current = null
    const finalChargePct =
      chargeDurationMs && chargeStartMsRef.current !== null
        ? Math.min(100, Math.round(((performance.now() - chargeStartMsRef.current) / chargeDurationMs) * 100))
        : undefined
    stopChargeLoop()
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignore synthetic or already-released pointer captures
    }

    const rawX = e.clientX - originRef.current.x
    const rawY = e.clientY - originRef.current.y
    const dist = Math.hypot(rawX, rawY)
    const cancel =
      variant !== 'basic' &&
      isPointInsideCancelZone(
        e.clientX,
        e.clientY,
        originRef.current.x,
        originRef.current.y,
        cancelZoneRef.current,
      )

    gameEventBus.emitAimPreview({
      active: false,
      slot: slotId,
      dirX: 1,
      dirY: 0,
      rangeFactor: 1,
      castRange,
      aoeRadius,
      aimType,
      cancel: false,
    })
    setDragState({ active: false, dx: 0, dy: 0, cancel: false })
    onDragChange(false, false)

    if (cancel) {
      return
    }
    if (variant === 'basic') {
      // Already fired on pointerDown; if user dragged to aim a directional basic attack, fire along drag vector too
      if (dist >= AIM_THRESHOLD_PX) {
        onTrigger({
          dirX: rawX / dist,
          dirY: rawY / dist,
          rangeFactor: computeRangeFactor(dist),
        })
      }
      return
    }
    const chargeTag = finalChargePct !== undefined ? `charge:${finalChargePct}` : undefined
    if (chargeTag) {
      // Always fire along the exact direction vector rendered by the 3D sniper laser sight on release
      const finalDir = draggedAimRef.current
        ? { dirX: aimVecRef.current.dirX, dirY: aimVecRef.current.dirY }
        : getSimoLiveAimDirection()
      onTrigger({
        dirX: finalDir.dirX,
        dirY: finalDir.dirY,
        rangeFactor: 1,
        targetId: chargeTag,
      })
    } else if (dist >= AIM_THRESHOLD_PX) {
      onTrigger({
        dirX: rawX / dist,
        dirY: rawY / dist,
        rangeFactor: computeRangeFactor(dist),
      })
    } else if (aimType === 'ground') {
      onTrigger({ dirX: 1, dirY: 0, rangeFactor: 0 })
    } else {
      onTrigger()
    }
  }

  const variantClass =
    variant === 'ultimate'
      ? 'ultimate'
      : variant === 'basic'
        ? 'basic'
        : variant === 'dash'
          ? 'dash'
          : ''

  return (
    <div className={`moba-skill-slot ${slotClass} ${variantClass}`}>
      {dragState.active && (
        <HeroAimWheel
          characterId={characterId}
          dx={dragState.dx}
          dy={dragState.dy}
          cancel={dragState.cancel}
          accentColor={accentColor}
        />
      )}

      <button
        type="button"
        aria-disabled={isBlocked}
        aria-label={`${label} (${keyHint})${locked ? ' - ล็อกอยู่' : ''}`}
        className={`moba-skill-circle ${variantClass} ${dragState.active ? 'aiming' : ''} ${isBlocked ? 'is-disabled' : ''} ${locked ? 'stone-locked' : ''}`}
        style={{
          borderColor: isBlocked ? 'rgba(15, 23, 42, 0.25)' : accentColor,
        }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={() => {
          pointerIdRef.current = null
          stopChargeLoop()
          setDragState({ active: false, dx: 0, dy: 0, cancel: false })
          onDragChange(false, false)
        }}
      >
        <img src={iconUrl} alt={label} className="moba-skill-art" draggable={false} />
        <span className="moba-skill-scrim" />
        {locked ? (
          <span className="moba-skill-lock-badge">{lockBadge ?? <EmblemLock size={14} />}</span>
        ) : onCooldown ? (
          <span className="moba-skill-cd-badge">{(cooldownMs / 1000).toFixed(1)}s</span>
        ) : dragState.active && chargeDurationMs ? (
          <span className="moba-skill-cd-badge">{chargePct >= 95 ? 'MAX' : `${chargePct}%`}</span>
        ) : (
          <span className="moba-skill-key-badge">{keyHint}</span>
        )}
        <span className="moba-skill-caption">{label}</span>
      </button>
    </div>
  )
})
