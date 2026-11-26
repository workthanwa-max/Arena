import React from 'react'
import type { CharacterDef } from '../types/game'
import { Hero3dPreview } from './Hero3dPreview'
import { HeroClassEmblem } from './HeroClassEmblem'

export interface TacticalBannerSlot {
  id: string
  /** Role / Class label rendered above the banner frame (e.g. "SOVEREIGN", "DUALIST", "BLUE 1") */
  topRole: string
  /** Title rendered just above the shield top border (Hero name or slot label) */
  topTitle?: string
  /** Highlight center card (bigger & glowing) */
  featured?: boolean
  /** Occupied hero slot */
  character?: CharacterDef | null
  /** Render full interactive Hero3dPreview (with 3D/2D toggle) vs sleek 2D bust artwork */
  use3dPreview?: boolean
  /** Override player / owner display name shown on Cream Ivory nameplate */
  playerName?: string
  /** Secondary subtitle shown inside Cream Ivory nameplate */
  subLabel?: string
  /** Badge text e.g. "HOST", "READY", "YOU", "BOT" */
  statusBadge?: string
  /** Color tone of badge / rim */
  tone?: 'cobalt' | 'blue' | 'red' | 'gold' | 'neutral'
  /** Optional ping or voice active state */
  pingMs?: number
  speaking?: boolean
  muted?: boolean
  /** Empty slot hint label when `character` is null */
  emptyHint?: string
  /** Optional action callback when clicking card or `+` slot */
  onClick?: () => void
  /** Action label on hover/focus or bottom hint */
  actionLabel?: string
  disabled?: boolean
}

function getHeroPortraitSrc(hero: CharacterDef): string {
  return hero.imageUrl || `/characters/${hero.id}.png`
}

export const TacticalBannerCard: React.FC<{ slot: TacticalBannerSlot }> = ({ slot }) => {
  const {
    topRole,
    topTitle,
    featured,
    character,
    use3dPreview,
    playerName,
    subLabel,
    statusBadge,
    tone = 'cobalt',
    pingMs,
    speaking,
    muted,
    emptyHint,
    onClick,
    actionLabel,
    disabled,
  } = slot

  const isOccupied = Boolean(character)
  const clickable = Boolean(onClick) && !disabled

  return (
    <div
      className={[
        'val-banner-col',
        featured ? 'featured' : '',
        isOccupied ? 'occupied' : 'empty',
        `tone-${tone}`,
        clickable ? 'clickable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Top Role & Hero Title above shield */}
      <div className="val-banner-head">
        <span className="val-banner-role">{topRole}</span>
        {topTitle ? <strong className="val-banner-title">{topTitle}</strong> : null}
      </div>

      {/* Shield / Chamfered Pentagon Container */}
      <div
        className="val-shield-outer"
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? onClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClick?.()
                }
              }
            : undefined
        }
        aria-label={actionLabel || topTitle || topRole}
        title={actionLabel}
      >
        <div className="val-shield-frame">
          {/* Status / Voice / Ping corner overlay inside upper frame */}
          {(statusBadge || typeof pingMs === 'number' || speaking || muted) && (
            <div className="val-shield-meta">
              {statusBadge ? <span className={`val-badge tone-${tone}`}>{statusBadge}</span> : <span />}
              <div className="val-shield-meta-right">
                {speaking ? <span className="val-voice-dot active" title="กำลังพูด" /> : null}
                {muted ? <span className="val-voice-dot muted" title="ปิดไมค์" /> : null}
                {typeof pingMs === 'number' && pingMs > 0 ? (
                  <span className="val-ping-chip">{pingMs}ms</span>
                ) : null}
              </div>
            </div>
          )}

          {/* Hero Visual or Empty `+` Slot */}
          {isOccupied && character ? (
            <div className="val-shield-art">
              {use3dPreview ? (
                <div className="val-shield-3d-wrap">
                  <Hero3dPreview
                    character={character}
                    size={featured ? 'hero' : 'md'}
                    frameless
                    allowViewToggle
                  />
                </div>
              ) : (
                <img
                  src={getHeroPortraitSrc(character)}
                  alt={character.displayName}
                  className="val-shield-img"
                  loading="lazy"
                />
              )}
              <div className="val-shield-vignette" aria-hidden="true" />
            </div>
          ) : (
            <div className="val-shield-empty-body">
              <div className="val-plus-box" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              {emptyHint ? <span className="val-empty-hint">{emptyHint}</span> : null}
            </div>
          )}

          {/* Cream Ivory Nameplate anchored near bottom chevron tip */}
          {isOccupied && character ? (
            <div className="val-cream-plate">
              <div className="val-cream-crest" aria-hidden="true">
                <HeroClassEmblem heroClass={character.heroClass ?? 'all'} size={15} />
              </div>
              <div className="val-cream-name" title={playerName || character.displayName}>
                {playerName || character.displayName}
              </div>
              <div className="val-cream-sub" title={subLabel || character.animeTitle}>
                {subLabel || character.animeTitle}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const TacticalBannerDeck: React.FC<{
  slots: TacticalBannerSlot[]
  className?: string
  ariaLabel?: string
}> = ({ slots, className = '', ariaLabel = 'Tactical Hero Banner Deck' }) => {
  return (
    <section className={`val-banner-deck ${className}`.trim()} aria-label={ariaLabel}>
      {slots.map((slot) => (
        <TacticalBannerCard key={slot.id} slot={slot} />
      ))}
    </section>
  )
}
