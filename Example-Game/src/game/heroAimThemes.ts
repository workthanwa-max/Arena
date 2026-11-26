import { ROSTER28_SPECS } from './roster28Meta'

export interface HeroAimTheme {
  id: string
  primary: string
  secondary: string
  glow: string
  corridorStyle:
    | 'sniper'
    | 'infinity'
    | 'cleave'
    | 'lightning'
    | 'santoryu'
    | 'stones'
    | 'babylon'
    | 'kamehameha'
    | 'crows'
    | 'godspeed'
    | 'predator'
    | 'clockwork'
    | 'punch'
    | 'hypnosis'
    | 'gourmet'
    | 'ancient'
    | 'pulse'
  cursorSvgInner: string
}

export const HERO_AIM_THEMES: Record<string, HeroAimTheme> = {
  simo: {
    id: 'simo',
    primary: '#38BDF8',
    secondary: '#EF4444',
    glow: 'rgba(56, 189, 248, 0.46)',
    corridorStyle: 'sniper',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="none" stroke="#38BDF8" stroke-width="2"/><path d="M16 1v8M16 23v8M1 16h8M23 16h8" stroke="#E0F2FE" stroke-width="2"/><circle cx="16" cy="16" r="2.6" fill="#EF4444"/>',
  },
  sia_mon: {
    id: 'sia_mon',
    primary: '#38BDF8',
    secondary: '#A855F7',
    glow: 'rgba(56, 189, 248, 0.44)',
    corridorStyle: 'infinity',
    cursorSvgInner:
      '<path d="M8 16c0-4 5-4 8 0s8 4 8 0-5-4-8 0-8 4-8 0z" fill="none" stroke="#38BDF8" stroke-width="2.4"/><circle cx="8" cy="16" r="2.5" fill="#EF4444"/><circle cx="24" cy="16" r="2.5" fill="#38BDF8"/><circle cx="16" cy="16" r="2" fill="#FFFFFF"/>',
  },
  ajarn_boy: {
    id: 'ajarn_boy',
    primary: '#EF4444',
    secondary: '#FCA5A5',
    glow: 'rgba(239, 68, 68, 0.48)',
    corridorStyle: 'cleave',
    cursorSvgInner:
      '<polygon points="16,2 30,16 16,30 2,16" fill="rgba(24,4,7,0.7)" stroke="#EF4444" stroke-width="2"/><path d="M9 9L23 23M23 9L9 23" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>',
  },
  ko: {
    id: 'ko',
    primary: '#FACC15',
    secondary: '#7DD3FC',
    glow: 'rgba(250, 204, 21, 0.48)',
    corridorStyle: 'lightning',
    cursorSvgInner:
      '<polygon points="16,2 19,12 30,12 21,18 24,29 16,22 8,29 11,18 2,12 13,12" fill="rgba(15,23,42,0.72)" stroke="#FACC15" stroke-width="1.8"/><circle cx="16" cy="16" r="2.4" fill="#7DD3FC"/>',
  },
  thanwa: {
    id: 'thanwa',
    primary: '#10B981',
    secondary: '#C084FC',
    glow: 'rgba(16, 185, 129, 0.44)',
    corridorStyle: 'santoryu',
    cursorSvgInner:
      '<path d="M5 25L27 7M5 7L27 25M16 3v26" stroke="#10B981" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="#C084FC" stroke="#FFFFFF" stroke-width="1.2"/>',
  },
  noone: {
    id: 'noone',
    primary: '#A855F7',
    secondary: '#FACC15',
    glow: 'rgba(168, 85, 247, 0.45)',
    corridorStyle: 'stones',
    cursorSvgInner:
      '<polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="rgba(15,23,42,0.7)" stroke="#FACC15" stroke-width="2"/><circle cx="16" cy="5" r="2" fill="#A855F7"/><circle cx="25" cy="12" r="2" fill="#3B82F6"/><circle cx="23" cy="23" r="2" fill="#EF4444"/><circle cx="9" cy="23" r="2" fill="#10B981"/><circle cx="7" cy="12" r="2" fill="#FACC15"/>',
  },
  pa: {
    id: 'pa',
    primary: '#FACC15',
    secondary: '#EF4444',
    glow: 'rgba(250, 204, 21, 0.48)',
    corridorStyle: 'babylon',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="none" stroke="#FACC15" stroke-width="2.2" stroke-dasharray="5 3"/><circle cx="16" cy="16" r="5" fill="none" stroke="#EF4444" stroke-width="2"/><circle cx="16" cy="16" r="2" fill="#FEF08A"/>',
  },
  boy: {
    id: 'boy',
    primary: '#F97316',
    secondary: '#FACC15',
    glow: 'rgba(249, 115, 22, 0.48)',
    corridorStyle: 'kamehameha',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="rgba(249,115,22,0.22)" stroke="#F97316" stroke-width="2.2"/><circle cx="13" cy="13" r="1.7" fill="#FACC15"/><circle cx="19" cy="13" r="1.7" fill="#FACC15"/><circle cx="13" cy="19" r="1.7" fill="#FACC15"/><circle cx="19" cy="19" r="1.7" fill="#FACC15"/>',
  },
  ole: {
    id: 'ole',
    primary: '#DC2626',
    secondary: '#F87171',
    glow: 'rgba(220, 38, 38, 0.48)',
    corridorStyle: 'crows',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="rgba(9,9,11,0.75)" stroke="#DC2626" stroke-width="2.2"/><path d="M16 6c4 4 4 8 0 10-4-2-4-6 0-10zM25 21c-5 2-8 0-9-5 4-1 7 1 9 5zM7 21c2-4 5-6 9-5-1 5-4 7-9 5z" fill="#EF4444"/><circle cx="16" cy="16" r="2.2" fill="#FFFFFF"/>',
  },
  ajarn_au: {
    id: 'ajarn_au',
    primary: '#22D3EE',
    secondary: '#FEF08A',
    glow: 'rgba(34, 211, 238, 0.46)',
    corridorStyle: 'godspeed',
    cursorSvgInner:
      '<path d="M18 3L9 17h6l-2 12 10-14h-6z" fill="rgba(34,211,238,0.28)" stroke="#22D3EE" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="16" r="2" fill="#FEF08A"/>',
  },
  kaem: {
    id: 'kaem',
    primary: '#38BDF8',
    secondary: '#FACC15',
    glow: 'rgba(56, 189, 248, 0.44)',
    corridorStyle: 'predator',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="rgba(30,27,75,0.55)" stroke="#38BDF8" stroke-width="2"/><path d="M16 7a9 9 0 0 1 8 13M16 25a9 9 0 0 1-8-13" fill="none" stroke="#FACC15" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="#38BDF8"/>',
  },
  frame: {
    id: 'frame',
    primary: '#FACC15',
    secondary: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.46)',
    corridorStyle: 'clockwork',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="rgba(15,23,42,0.68)" stroke="#FACC15" stroke-width="2.2"/><path d="M16 7v9l6 4" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="2.2" fill="#A855F7"/>',
  },
  luangphi_sorn: {
    id: 'luangphi_sorn',
    primary: '#FACC15',
    secondary: '#DC2626',
    glow: 'rgba(250, 204, 21, 0.5)',
    corridorStyle: 'punch',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="rgba(127,29,29,0.55)" stroke="#FACC15" stroke-width="2.4"/><circle cx="16" cy="16" r="5.5" fill="#DC2626" stroke="#FFFFFF" stroke-width="1.6"/>',
  },
  jinwoo: {
    id: 'jinwoo',
    primary: '#7C3AED',
    secondary: '#38BDF8',
    glow: 'rgba(124, 58, 237, 0.48)',
    corridorStyle: 'infinity',
    cursorSvgInner:
      '<polygon points="16,2 28,16 16,30 4,16" fill="rgba(15,23,42,0.75)" stroke="#7C3AED" stroke-width="2.2"/><path d="M10 10L22 22M22 10L10 22" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="2.2" fill="#E0F2FE"/>',
  },
  naruto: {
    id: 'naruto',
    primary: '#F97316',
    secondary: '#FACC15',
    glow: 'rgba(249, 115, 22, 0.5)',
    corridorStyle: 'kamehameha',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="rgba(249,115,22,0.22)" stroke="#F97316" stroke-width="2.2"/><path d="M16 7a9 9 0 1 1-6.5 2.7" fill="none" stroke="#FACC15" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="#38BDF8"/>',
  },
  sanji: {
    id: 'sanji',
    primary: '#38BDF8',
    secondary: '#F97316',
    glow: 'rgba(56, 189, 248, 0.48)',
    corridorStyle: 'lightning',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="10.5" fill="rgba(15,23,42,0.68)" stroke="#38BDF8" stroke-width="2"/><path d="M16 5c4 4 4 9 0 11s-4 7 0 11" fill="none" stroke="#F97316" stroke-width="2.2"/><circle cx="16" cy="16" r="2.4" fill="#FEF08A"/>',
  },
  luffy: {
    id: 'luffy',
    primary: '#EF4444',
    secondary: '#FACC15',
    glow: 'rgba(239, 68, 68, 0.48)',
    corridorStyle: 'punch',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="rgba(239,68,68,0.2)" stroke="#FACC15" stroke-width="2.4"/><circle cx="16" cy="16" r="6" fill="none" stroke="#EF4444" stroke-width="2.2"/><circle cx="16" cy="16" r="2.3" fill="#FFFFFF"/>',
  },
  ben10: {
    id: 'ben10',
    primary: '#22C55E',
    secondary: '#86EFAC',
    glow: 'rgba(34, 197, 94, 0.48)',
    corridorStyle: 'sniper',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11.5" fill="rgba(5,20,10,0.8)" stroke="#22C55E" stroke-width="2.2"/><polygon points="9,6 23,6 16,16 23,26 9,26 16,16" fill="#22C55E" stroke="#86EFAC" stroke-width="1.2"/>',
  },
  diablo: {
    id: 'diablo',
    primary: '#DC2626',
    secondary: '#FACC15',
    glow: 'rgba(220, 38, 38, 0.5)',
    corridorStyle: 'cleave',
    cursorSvgInner:
      '<polygon points="16,2 29,11 24,28 8,28 3,11" fill="rgba(9,9,11,0.82)" stroke="#DC2626" stroke-width="2"/><circle cx="16" cy="16" r="4.5" fill="none" stroke="#FACC15" stroke-width="1.8"/><circle cx="16" cy="16" r="2" fill="#EF4444"/>',
  },
  aizen: {
    id: 'aizen',
    primary: '#9333EA',
    secondary: '#E9D5FF',
    glow: 'rgba(147, 51, 234, 0.52)',
    corridorStyle: 'hypnosis',
    cursorSvgInner:
      '<polygon points="16,3 25,16 16,29 7,16" fill="rgba(30,27,75,0.82)" stroke="#A855F7" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="none" stroke="#E9D5FF" stroke-width="1.5"/><circle cx="16" cy="16" r="2.2" fill="#C084FC"/>',
  },
  toriko: {
    id: 'toriko',
    primary: '#EF4444',
    secondary: '#F97316',
    glow: 'rgba(239, 68, 68, 0.52)',
    corridorStyle: 'gourmet',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11" fill="rgba(69,10,10,0.45)" stroke="#EF4444" stroke-width="2.4"/><path d="M10 9 L22 23 M22 9 L10 23" stroke="#FEF08A" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="2.6" fill="#F97316"/>',
  },
  frieren: {
    id: 'frieren',
    primary: '#38BDF8',
    secondary: '#BAE6FD',
    glow: 'rgba(56, 189, 248, 0.52)',
    corridorStyle: 'ancient',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="11.5" fill="rgba(3,7,18,0.65)" stroke="#38BDF8" stroke-width="1.8"/><polygon points="16,4 26.4,22 5.6,22" fill="none" stroke="#BAE6FD" stroke-width="1.4"/><polygon points="16,28 26.4,10 5.6,10" fill="none" stroke="#60A5FA" stroke-width="1.4"/><circle cx="16" cy="16" r="2.2" fill="#FFFFFF"/>',
  },
  ...Object.fromEntries(ROSTER28_SPECS.map((s) => [s.id, s.aimTheme])),
  default: {
    id: 'default',
    primary: '#38BDF8',
    secondary: '#E0F2FE',
    glow: 'rgba(56, 189, 248, 0.42)',
    corridorStyle: 'pulse',
    cursorSvgInner:
      '<circle cx="16" cy="16" r="10" fill="none" stroke="#38BDF8" stroke-width="2"/><path d="M16 3v5M16 24v5M3 16h5M24 16h5" stroke="#E0F2FE" stroke-width="2"/><circle cx="16" cy="16" r="2.2" fill="#FFFFFF"/>',
  },
}

export function getHeroAimTheme(charId?: string): HeroAimTheme {
  if (!charId) return HERO_AIM_THEMES.default
  return HERO_AIM_THEMES[charId] ?? HERO_AIM_THEMES.default
}

const cursorCssCache = new Map<string, string>()

/** Returns a cached custom 32x32 crosshair CSS cursor tuned for the hero's identity. */
export function getHeroArenaCursorCss(charId?: string): string {
  const theme = getHeroAimTheme(charId)
  const existing = cursorCssCache.get(theme.id)
  if (existing) return existing
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${theme.cursorSvgInner}</svg>`
  const css = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, crosshair`
  cursorCssCache.set(theme.id, css)
  return css
}
