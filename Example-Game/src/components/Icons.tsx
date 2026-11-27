import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function baseProps(size = 16, props: IconProps) {
  const { size: _s, ...rest } = props
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    ...rest,
  }
}

export function IconArrowLeft({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M11 6L4.5 12L11 18V14.2H19.5V9.8H11V6Z" fill="currentColor" fillOpacity="0.22" />
      <path d="M11 6L4.5 12L11 18" />
      <path d="M6 12H19.5" />
    </svg>
  )
}

export function IconPlay({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path
        d="M6.5 4.2L20 12L6.5 19.8L9 12L6.5 4.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

export function IconSwords({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      {/* Crossed tactical broadblades with diamond guard */}
      <path d="M4 4L8.5 4.5L18 14L15 17L5.5 7.5L4 4Z" fill="currentColor" fillOpacity="0.24" />
      <path d="M20 4L15.5 4.5L6 14L9 17L18.5 7.5L20 4Z" fill="currentColor" fillOpacity="0.24" />
      <path d="M14 18.5L18.5 14M16.5 16.5L20 20" />
      <path d="M10 18.5L5.5 14M7.5 16.5L4 20" />
      <path d="M12 10.2L13.6 11.8L12 13.4L10.4 11.8L12 10.2Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconTarget({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      {/* Tactical octagonal crosshair reticle */}
      <path
        d="M8.5 3.5H15.5L20.5 8.5V15.5L15.5 20.5H8.5L3.5 15.5V8.5L8.5 3.5Z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path d="M12 2V6M12 18V22M2 12H6M18 12H22" />
      <path d="M12 8.8L15.2 12L12 15.2L8.8 12L12 8.8Z" fill="currentColor" />
    </svg>
  )
}

export function IconUsers({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      {/* Hero Squad / Agent Roster crest (layered tactical visor helmets) */}
      <path
        d="M12 3.2L16.2 5.6V10L12 12.4L7.8 10V5.6L12 3.2Z"
        fill="currentColor"
        fillOpacity="0.28"
      />
      <path
        d="M5.5 19.8L7.2 15.2H16.8L18.5 19.8H5.5Z"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <path d="M18.2 7.2L21 8.8V11.8L18.8 13.1" />
      <path d="M5.8 7.2L3 8.8V11.8L5.2 13.1" />
      <path d="M10.2 7.8H13.8" strokeWidth="1.6" />
    </svg>
  )
}

export function IconSearch({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path
        d="M8.5 3.5H13.5L17.5 7.5V12.5L13.5 16.5H8.5L4.5 12.5V7.5L8.5 3.5Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path d="M16.2 16.2L20.8 20.8" strokeWidth="2.3" />
      <circle cx="11" cy="10" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconSettings({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      {/* Tactical hexagonal core gear (Graphics / System) */}
      <path
        d="M12 2.4L15 4.2L18.6 4.6L19.8 8L21.6 11.2L19.8 14.4L18.6 17.8L15 18.2L12 20L9 18.2L5.4 17.8L4.2 14.4L2.4 11.2L4.2 8L5.4 4.6L9 4.2L12 2.4Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path
        d="M12 7.8L15.2 9.6V13.2L12 15L8.8 13.2V9.6L12 7.8Z"
        fill="currentColor"
        fillOpacity="0.35"
      />
      <circle cx="12" cy="11.4" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconVolume({ size = 16, muted = false, ...props }: IconProps & { muted?: boolean }) {
  return muted ? (
    <svg {...baseProps(size, props)}>
      <path d="M3 9.5H6.8L12 5V19L6.8 14.5H3V9.5Z" fill="currentColor" fillOpacity="0.22" />
      <path d="M21 9.5L16 14.5M16 9.5L21 14.5" strokeWidth="2.1" />
    </svg>
  ) : (
    <svg {...baseProps(size, props)}>
      <path d="M3 9.5H6.8L12 5V19L6.8 14.5H3V9.5Z" fill="currentColor" fillOpacity="0.28" />
      <path d="M15.4 8.8C16.8 10.2 16.8 13.8 15.4 15.2" />
      <path d="M18.6 5.8C21.4 8.8 21.4 15.2 18.6 18.2" strokeOpacity="0.72" />
    </svg>
  )
}

export function IconMusic({ size = 16, muted = false, ...props }: IconProps & { muted?: boolean }) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M9.5 17.5V5.2L20 3.5V15.5" />
      <path d="M9.5 8.8L20 7.1" strokeOpacity="0.7" />
      <path d="M4.5 17.5L7 15.5L9.5 17.5L7 19.5L4.5 17.5Z" fill="currentColor" fillOpacity="0.35" />
      <path d="M15 15.5L17.5 13.5L20 15.5L17.5 17.5L15 15.5Z" fill="currentColor" fillOpacity="0.35" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2.1" />}
    </svg>
  )
}

export function IconMic({ size = 16, off = false, ...props }: IconProps & { off?: boolean }) {
  return (
    <svg {...baseProps(size, props)}>
      <path
        d="M9.2 4.5L12 2.8L14.8 4.5V11.8L12 13.5L9.2 11.8V4.5Z"
        fill="currentColor"
        fillOpacity="0.28"
      />
      <path d="M5.5 10.5C5.5 14.1 8.4 17 12 17C15.6 17 18.5 14.1 18.5 10.5" />
      <path d="M12 17V21M8.5 21H15.5" />
      {off && <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2.1" />}
    </svg>
  )
}

export function IconHeadphones({ size = 16, off = false, ...props }: IconProps & { off?: boolean }) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M3.5 15V11.5C3.5 6.8 7.3 3 12 3C16.7 3 20.5 6.8 20.5 11.5V15" />
      <path d="M3.5 13.5H6.8L8 15.2V19.2L6.5 20.5H4.5L3.5 19.2V13.5Z" fill="currentColor" fillOpacity="0.28" />
      <path d="M20.5 13.5H17.2L16 15.2V19.2L17.5 20.5H19.5L20.5 19.2V13.5Z" fill="currentColor" fillOpacity="0.28" />
      {off && <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2.1" />}
    </svg>
  )
}

export function IconFullscreen({ size = 16, exit = false, ...props }: IconProps & { exit?: boolean }) {
  return exit ? (
    <svg {...baseProps(size, props)}>
      <path d="M9 3.5V9H3.5M15 3.5V9H20.5M15 20.5V15H20.5M9 20.5V15H3.5" />
      <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" fillOpacity="0.3" stroke="none" />
    </svg>
  ) : (
    <svg {...baseProps(size, props)}>
      <path d="M3.5 9V3.5H9M15 3.5H20.5V9M20.5 15V20.5H15M9 20.5H3.5V15" />
      <path d="M9.5 9.5H14.5V14.5H9.5V9.5Z" fill="currentColor" fillOpacity="0.22" strokeWidth="1.4" />
    </svg>
  )
}

export function IconCopy({ size = 15, copied = false, ...props }: IconProps & { copied?: boolean }) {
  return copied ? (
    <svg {...baseProps(size, props)}>
      <path d="M4.5 12.5L9.5 17.5L19.5 6.5" strokeWidth="2.3" />
    </svg>
  ) : (
    <svg {...baseProps(size, props)}>
      <path d="M9 8.5H18.5L20.5 10.5V20.5H9V8.5Z" fill="currentColor" fillOpacity="0.22" />
      <path d="M5.5 15.5H3.5V3.5H15.5V5.5" />
    </svg>
  )
}

export function IconLogOut({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M10 3.5H4.5L3.5 4.5V19.5L4.5 20.5H10" fill="currentColor" fillOpacity="0.16" />
      <path d="M15.5 7.5L20.5 12L15.5 16.5" />
      <path d="M20 12H9.5" />
    </svg>
  )
}

export function IconClose({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" strokeWidth="2.1" />
    </svg>
  )
}

export function IconSparkles({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path
        d="M12 2.5L14.4 9.6L21.5 12L14.4 14.4L12 21.5L9.6 14.4L2.5 12L9.6 9.6L12 2.5Z"
        fill="currentColor"
        fillOpacity="0.28"
      />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconBot({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      <path
        d="M6.5 6.5H17.5L20 9V16.5L17.5 19H6.5L4 16.5V9L6.5 6.5Z"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <path d="M12 3V6.5M8.5 12.2H10.5M13.5 12.2H15.5M9.5 15.8H14.5" />
    </svg>
  )
}

export function IconKey({ size = 15, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, props)}>
      {/* Tactical Squad Access Keycard / Hex Key */}
      <path
        d="M7.5 11L11.2 13.2V17.4L7.5 19.6L3.8 17.4V13.2L7.5 11Z"
        fill="currentColor"
        fillOpacity="0.28"
      />
      <path d="M10.8 12.2L19.5 3.8M15.8 7.4L19 10.4M17.8 5.4L20.5 8" />
      <circle cx="7.5" cy="15.3" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
