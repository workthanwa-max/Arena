import { memo } from 'react'
import { getHeroAimTheme } from '../game/heroAimThemes'

interface HeroAimWheelProps {
  characterId?: string
  dx: number
  dy: number
  cancel: boolean
  accentColor: string
}

function renderCharacterWheelRing(charId: string, stroke: string, sub: string) {
  switch (charId) {
    case 'simo':
      // Arctic Sniper Scope Bezel: Corner brackets + mil-dot crosshairs + inner range ring
      return (
        <g>
          <rect
            x="10"
            y="10"
            width="100"
            height="100"
            rx="14"
            fill="rgba(8, 22, 42, 0.56)"
            stroke={stroke}
            strokeWidth="2.6"
          />
          <circle cx="60" cy="60" r="38" fill="none" stroke={stroke} strokeWidth="1.8" strokeDasharray="6 5" />
          <path
            d="M60 8v22M60 90v22M8 60h22M90 60h22"
            stroke="#E0F2FE"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="M40 60h8M72 60h8M60 40v8M60 72v8" stroke={sub} strokeWidth="2.4" />
        </g>
      )
    case 'sia_mon':
      // Gojo Six-Eyes Infinity Ring + Opposing Red / Blue Polarity Orbs
      return (
        <g>
          <circle cx="60" cy="60" r="51" fill="rgba(15, 23, 42, 0.58)" stroke={stroke} strokeWidth="2.6" />
          <path
            d="M34 60c0-13 18-13 26 0s18 13 26 0-18-13-26 0-26 13-26 0z"
            fill="none"
            stroke="#E0F2FE"
            strokeWidth="2.8"
          />
          <circle cx="14" cy="60" r="5.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="106" cy="60" r="5.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.5" />
        </g>
      )
    case 'ajarn_boy':
      // Sukuna Malevolent Shrine Rotated Cursed Diamond + X-Cleave Slashes
      return (
        <g>
          <polygon
            points="60,6 114,60 60,114 6,60"
            fill="rgba(32, 4, 8, 0.66)"
            stroke={stroke}
            strokeWidth="3"
          />
          <rect
            x="22"
            y="22"
            width="76"
            height="76"
            fill="none"
            stroke={sub}
            strokeWidth="1.8"
            strokeDasharray="8 6"
          />
          <path d="M28 28L92 92M92 28L28 92" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.65" />
        </g>
      )
    case 'ko':
      // Zenitsu 5-Point Golden Thunder Breathing Pentagram
      return (
        <g>
          <circle cx="60" cy="60" r="51" fill="rgba(15, 23, 42, 0.6)" stroke={stroke} strokeWidth="2.6" />
          <polygon
            points="60,10 74,44 110,44 81,66 91,102 60,80 29,102 39,66 10,44 46,44"
            fill="rgba(250, 204, 21, 0.14)"
            stroke={stroke}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <polygon
            points="60,14 89,96 20,45 100,45 31,96"
            fill="none"
            stroke={sub}
            strokeWidth="1.6"
            strokeOpacity="0.85"
          />
        </g>
      )
    case 'thanwa':
      // Zoro Enma Triad Double Triangle & Triple Katana Guard
      return (
        <g>
          <circle cx="60" cy="60" r="51" fill="rgba(6, 28, 22, 0.62)" stroke={stroke} strokeWidth="2.5" />
          <polygon points="60,11 103,86 17,86" fill="none" stroke={stroke} strokeWidth="2.5" />
          <polygon points="60,109 17,34 103,34" fill="none" stroke={sub} strokeWidth="2.3" />
        </g>
      )
    case 'noone':
      // Thanos Sanctuary Hexagon + 5 Colored Infinity Stones
      return (
        <g>
          <polygon
            points="60,8 106,34 106,86 60,112 14,86 14,34"
            fill="rgba(20, 12, 36, 0.68)"
            stroke="#FACC15"
            strokeWidth="2.8"
          />
          <polygon
            points="60,20 94,40 94,80 60,100 26,80 26,40"
            fill="none"
            stroke={stroke}
            strokeWidth="1.7"
          />
          <circle cx="60" cy="14" r="4.5" fill="#A855F7" stroke="#FEF9C3" strokeWidth="1.2" />
          <circle cx="101" cy="40" r="4.5" fill="#3B82F6" stroke="#FEF9C3" strokeWidth="1.2" />
          <circle cx="94" cy="86" r="4.5" fill="#EF4444" stroke="#FEF9C3" strokeWidth="1.2" />
          <circle cx="26" cy="86" r="4.5" fill="#10B981" stroke="#FEF9C3" strokeWidth="1.2" />
          <circle cx="19" cy="40" r="4.5" fill="#FACC15" stroke="#FEF9C3" strokeWidth="1.2" />
        </g>
      )
    case 'pa':
      // Gilgamesh Gate of Babylon Golden Concentric Keyhole Ripples
      return (
        <g>
          <circle cx="60" cy="60" r="52" fill="rgba(34, 22, 6, 0.64)" stroke="#FACC15" strokeWidth="2.8" strokeDasharray="10 4" />
          <rect x="23" y="23" width="74" height="74" fill="none" stroke="#FACC15" strokeWidth="2" />
          <rect
            x="23"
            y="23"
            width="74"
            height="74"
            fill="none"
            stroke={sub}
            strokeWidth="2"
            transform="rotate(45 60 60)"
          />
        </g>
      )
    case 'boy':
      // Goku Super Saiyan Spiky Aura Ring + 4-Star Dragon Ball Rim
      return (
        <g>
          <circle cx="60" cy="60" r="50" fill="rgba(44, 18, 6, 0.6)" stroke={stroke} strokeWidth="3" />
          <circle cx="60" cy="60" r="38" fill="none" stroke={sub} strokeWidth="2" strokeDasharray="6 6" />
          <polygon points="48,46 53,51 48,56 43,51" fill="#EF4444" />
          <polygon points="72,46 77,51 72,56 67,51" fill="#EF4444" />
          <polygon points="48,70 53,75 48,80 43,75" fill="#EF4444" />
          <polygon points="72,70 77,75 72,80 67,75" fill="#EF4444" />
        </g>
      )
    case 'ole':
      // Itachi Mangekyo Sharingan 3-Blade Scarlet Iris
      return (
        <g>
          <circle cx="60" cy="60" r="51" fill="rgba(24, 4, 6, 0.7)" stroke="#DC2626" strokeWidth="3" />
          <circle cx="60" cy="60" r="34" fill="none" stroke="#EF4444" strokeWidth="2" />
          <circle cx="60" cy="24" r="5" fill="#EF4444" />
          <circle cx="91" cy="78" r="5" fill="#EF4444" />
          <circle cx="29" cy="78" r="5" fill="#EF4444" />
        </g>
      )
    case 'ajarn_au':
      // Killua Godspeed Electric Octagon Circuit
      return (
        <g>
          <polygon
            points="40,10 80,10 110,40 110,80 80,110 40,110 10,80 10,40"
            fill="rgba(8, 36, 52, 0.62)"
            stroke="#22D3EE"
            strokeWidth="2.8"
          />
          <path d="M64 18L44 58h15l-4 44 22-44H61z" fill="rgba(254, 240, 138, 0.2)" stroke="#FEF08A" strokeWidth="2" />
        </g>
      )
    case 'kaem':
      // Rimuru Demon-Lord Fluid Crest + Raphael Golden Core
      return (
        <g>
          <circle cx="60" cy="60" r="51" fill="rgba(16, 20, 48, 0.64)" stroke={stroke} strokeWidth="2.8" />
          <circle cx="60" cy="60" r="38" fill="none" stroke="#FACC15" strokeWidth="2" strokeDasharray="12 5 3 5" />
          <path d="M60 16L98 60 60 104 22 60z" fill="none" stroke={stroke} strokeWidth="1.8" />
        </g>
      )
    case 'frame':
      // Frame / ZA WARUDO Roman Clock-Face Dial
      return (
        <g>
          <circle cx="60" cy="60" r="51" fill="rgba(24, 16, 44, 0.68)" stroke="#FACC15" strokeWidth="3" />
          <circle cx="60" cy="60" r="39" fill="none" stroke="#A855F7" strokeWidth="1.8" />
          <path d="M60 10v10M60 100v10M10 60h10M100 60h10M24 24l7 7M89 89l7 7M96 24l-7 7M31 89l-7 7" stroke="#FEF08A" strokeWidth="2.4" />
          <path d="M60 60V24M60 60l24 14" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )
    case 'luangphi_sorn':
      // Saitama Serious Punch Impact Hazard Octagon
      return (
        <g>
          <polygon
            points="40,8 80,8 112,40 112,80 80,112 40,112 8,80 8,40"
            fill="rgba(68, 12, 12, 0.65)"
            stroke="#FACC15"
            strokeWidth="3.2"
          />
          <circle cx="60" cy="60" r="34" fill="none" stroke="#EF4444" strokeWidth="3" strokeDasharray="8 6" />
        </g>
      )
    default:
      return (
        <g>
          <circle cx="60" cy="60" r="50" fill="rgba(15, 23, 42, 0.55)" stroke={stroke} strokeWidth="2.6" />
          <circle cx="60" cy="60" r="36" fill="none" stroke={sub} strokeWidth="1.6" strokeDasharray="6 6" />
        </g>
      )
  }
}

export const HeroAimWheel = memo(function HeroAimWheel({
  characterId = 'default',
  dx,
  dy,
  cancel,
  accentColor,
}: HeroAimWheelProps) {
  const theme = getHeroAimTheme(characterId)
  const stroke = cancel ? '#EF4444' : theme.primary
  const sub = cancel ? '#FCA5A5' : theme.secondary

  return (
    <div
      className={`moba-aim-ring hero-wheel-${theme.id} ${cancel ? 'cancel' : ''}`}
      style={{
        filter: `drop-shadow(0 0 12px ${cancel ? 'rgba(239,68,68,0.65)' : theme.glow})`,
      }}
    >
      <svg viewBox="0 0 120 120" className="moba-aim-wheel-svg" aria-hidden="true">
        {renderCharacterWheelRing(theme.id, stroke, sub)}
      </svg>

      <div
        className={`moba-aim-pip hero-pip-${theme.id}`}
        style={{
          transform: `translate3d(${dx}px, ${dy}px, 0)`,
          backgroundColor: cancel ? '#EF4444' : accentColor || theme.primary,
          borderColor: cancel ? '#FEE2E2' : theme.secondary,
        }}
      >
        <span className="moba-aim-pip-glyph" aria-hidden="true">
          {cancel
            ? '✕'
            : theme.id === 'simo'
              ? '⊕'
              : theme.id === 'sia_mon'
                ? '∞'
                : theme.id === 'ajarn_boy'
                  ? '✕'
                  : theme.id === 'ko' || theme.id === 'ajarn_au'
                    ? '⚡'
                    : theme.id === 'noone'
                      ? '💎'
                      : theme.id === 'thanwa'
                        ? '⚔'
                        : theme.id === 'boy'
                          ? '★'
                          : theme.id === 'ole'
                            ? '◈'
                            : theme.id === 'frame'
                              ? '◷'
                              : theme.id === 'luangphi_sorn'
                                ? '👊'
                                : '✦'}
        </span>
      </div>
    </div>
  )
})
