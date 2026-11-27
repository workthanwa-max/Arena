import React from 'react'
import type { HeroClassFilter } from '../constants/heroClasses'

interface HeroClassEmblemProps {
  heroClass?: HeroClassFilter | string | null
  size?: number
  className?: string
}

/**
 * Modern, layered geometric vector emblems for ArenaVV's 5 tactical hero classes (+ 'all').
 * Zero system emojis — renders consistently across Windows, macOS, iOS, and Android.
 */
export const HeroClassEmblem: React.FC<HeroClassEmblemProps> = ({
  heroClass = 'all',
  size = 16,
  className = '',
}) => {
  const cls = heroClass || 'all'
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    className: `hero-class-emblem ${className}`.trim(),
    'aria-hidden': true as const,
  }

  switch (cls) {
    case 'sovereign':
      // Architectural Triple-Spire Crown + Diamond Domain Core (Purple / Gold Aura)
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="hc-sov" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e879f9" />
              <stop offset="55%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>
          </defs>
          <path
            d="M3.5 17.5L2.5 8.5L8 12L12 4.5L16 12L21.5 8.5L20.5 17.5H3.5Z"
            fill="url(#hc-sov)"
            fillOpacity="0.28"
            stroke="url(#hc-sov)"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M4.5 20.5H19.5"
            stroke="#f0abfc"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 10.2L13.9 13L12 15.8L10.1 13L12 10.2Z"
            fill="#fef08a"
          />
        </svg>
      )

    case 'chronos':
      // Orbiting Temporal Ring split by Kinetic Lightning Bolt (Gold / Amber)
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="hc-chr" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
          <circle
            cx="12"
            cy="12"
            r="8.75"
            stroke="url(#hc-chr)"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="4 2.5"
          />
          <path
            d="M13.6 3.5L7.5 13H12L10.4 20.5L16.8 11H12.2L13.6 3.5Z"
            fill="url(#hc-chr)"
            stroke="#fef9c3"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      )

    case 'deadeye':
      // Tactical Sniper Reticle with 4 Precision Calipers + Glowing Laser Core (Sky Cyan)
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="hc-eye" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <circle
            cx="12"
            cy="12"
            r="7.25"
            stroke="url(#hc-eye)"
            strokeWidth="1.75"
          />
          <path
            d="M12 2.2V6.2M12 17.8V21.8M2.2 12H6.2M17.8 12H21.8"
            stroke="#bae6fd"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 8.8L15.2 12L12 15.2L8.8 12L12 8.8Z"
            fill="#38bdf8"
            stroke="#e0f2fe"
            strokeWidth="1.1"
          />
        </svg>
      )

    case 'vanguard':
      // Layered Limit-Breaker Shield + Twin Energy Vanes (Emerald / Mint)
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="hc-van" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.8L19.5 6V11.8C19.5 16.5 16.2 19.9 12 21.4C7.8 19.9 4.5 16.5 4.5 11.8V6L12 2.8Z"
            fill="url(#hc-van)"
            fillOpacity="0.24"
            stroke="url(#hc-van)"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 13.8L12 7.5L15.5 13.8H12.9L12 16.5L11.1 13.8H8.5Z"
            fill="#a7f3d0"
          />
        </svg>
      )

    case 'cataclysm':
      // Faceted Hexagonal Singularity Gem with Fracture Prisms (Crimson / Rose)
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="hc-cat" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="50%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#be123c" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.6L19.2 7.5V16.5L12 21.4L4.8 16.5V7.5L12 2.6Z"
            fill="url(#hc-cat)"
            fillOpacity="0.28"
            stroke="url(#hc-cat)"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M12 2.6V21.4M4.8 7.5L12 12L19.2 7.5M4.8 16.5L12 12L19.2 16.5"
            stroke="#fecdd3"
            strokeOpacity="0.72"
            strokeWidth="1.2"
          />
          <circle cx="12" cy="12" r="2.2" fill="#ffe4e6" />
        </svg>
      )

    case 'all':
    default:
      // Layered 4-Point Prismatic Starburst Crest
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="hc-all" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.5L14.4 9.6L21.5 12L14.4 14.4L12 21.5L9.6 14.4L2.5 12L9.6 9.6L12 2.5Z"
            fill="url(#hc-all)"
            fillOpacity="0.26"
            stroke="url(#hc-all)"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2" fill="#e0f2fe" />
        </svg>
      )
  }
}

export const EmblemCheck: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

export const EmblemShield: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7.5 3v6c0 4.6-3.2 7.8-7.5 9.2C7.7 19.8 4.5 16.6 4.5 12V6L12 3z" />
  </svg>
)

export const EmblemBolt: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2z" />
  </svg>
)

export const EmblemLock: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export const EmblemHome: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </svg>
)
