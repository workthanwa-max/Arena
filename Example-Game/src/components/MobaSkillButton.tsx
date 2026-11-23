import { memo, useEffect, useRef, useState } from 'react'
import { gameEventBus } from '../game/core/eventBus'
import type { SkillAimType } from '../types/game'

export interface SkillAimTrigger {
  dirX: number
  dirY: number
  rangeFactor: number
}

export interface MobaSkillButtonProps {
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
  variant?: 'basic' | 'dash' | 'skill' | 'ultimate'
  cancelZoneRef: React.RefObject<HTMLButtonElement | null>
  onDragChange: (dragging: boolean, hoveringCancel: boolean) => void
  onTrigger: (aim?: SkillAimTrigger) => void
}

const AIM_THRESHOLD_PX = 14
const MAX_AIM_PULL_PX = 52
const CANCEL_HITBOX_PAD_PX = 20

function isPointInsideCancelZone(
  clientX: number,
  clientY: number,
  cancelEl: HTMLButtonElement | null,
): boolean {
  if (!cancelEl) return false
  const r = cancelEl.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return false
  return (
    clientX >= r.left - CANCEL_HITBOX_PAD_PX &&
    clientX <= r.right + CANCEL_HITBOX_PAD_PX &&
    clientY >= r.top - CANCEL_HITBOX_PAD_PX &&
    clientY <= r.bottom + CANCEL_HITBOX_PAD_PX
  )
}

function computeRangeFactor(dist: number): number {
  if (dist <= 16) return 0
  const normalized = (dist - 16) / (MAX_AIM_PULL_PX - 16)
  return Math.max(0, Math.min(1, normalized))
}

export const MobaSkillButton = memo(function MobaSkillButton({
  slotId,
  keyHint,
  label,
  iconUrl,
  cooldownMs,
  disabled,
  locked = false,
  lockBadge = '🔒',
  accentColor,
  slotClass,
  castRange = 360,
  aoeRadius = 60,
  aimType = 'line',
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

  const pointerIdRef = useRef<number | null>(null)
  const hoverPreviewRef = useRef(false)
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const onCooldown = cooldownMs > 0
  const isBlocked = disabled || onCooldown

  useEffect(() => {
    return () => {
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
  }, [slotId, castRange, aoeRadius, aimType])

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
    setDragState({ active: true, dx: 0, dy: 0, cancel: false })
    onDragChange(true, false)
    gameEventBus.emitAimPreview({
      active: true,
      slot: slotId,
      dirX: 0,
      dirY: -1,
      rangeFactor: aimType === 'ground' ? 0 : 1,
      castRange,
      aoeRadius,
      aimType,
      cancel: false,
    })
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    const rawX = e.clientX - originRef.current.x
    const rawY = e.clientY - originRef.current.y
    const dist = Math.hypot(rawX, rawY)
    const cancel = isPointInsideCancelZone(e.clientX, e.clientY, cancelZoneRef.current)

    const clampedDist = Math.min(dist, MAX_AIM_PULL_PX)
    const nx = dist > 0.01 ? rawX / dist : 1
    const ny = dist > 0.01 ? rawY / dist : 0

    setDragState({
      active: true,
      dx: nx * clampedDist,
      dy: ny * clampedDist,
      cancel,
    })
    onDragChange(true, cancel)

    if (dist >= AIM_THRESHOLD_PX) {
      gameEventBus.emitAimPreview({
        active: true,
        slot: slotId,
        dirX: nx,
        dirY: ny,
        rangeFactor: computeRangeFactor(dist),
        castRange,
        aoeRadius,
        aimType,
        cancel,
      })
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    pointerIdRef.current = null
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
    const cancel = isPointInsideCancelZone(e.clientX, e.clientY, cancelZoneRef.current)

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
    if (dist >= AIM_THRESHOLD_PX) {
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
        <div className={`moba-aim-ring ${dragState.cancel ? 'cancel' : ''}`}>
          <div
            className="moba-aim-pip"
            style={{
              transform: `translate3d(${dragState.dx}px, ${dragState.dy}px, 0)`,
              backgroundColor: dragState.cancel ? '#EF4444' : accentColor,
            }}
          />
        </div>
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
          setDragState({ active: false, dx: 0, dy: 0, cancel: false })
          onDragChange(false, false)
        }}
      >
        <img src={iconUrl} alt={label} className="moba-skill-art" draggable={false} />
        <span className="moba-skill-scrim" />
        {locked ? (
          <span className="moba-skill-lock-badge">{lockBadge}</span>
        ) : onCooldown ? (
          <span className="moba-skill-cd-badge">{(cooldownMs / 1000).toFixed(1)}s</span>
        ) : (
          <span className="moba-skill-key-badge">{keyHint}</span>
        )}
        <span className="moba-skill-caption">{label}</span>
      </button>
    </div>
  )
})
