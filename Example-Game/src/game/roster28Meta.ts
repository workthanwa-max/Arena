import type { SkillAimType } from '../types/game'
import type { HeroAimTheme } from './heroAimThemes'

export interface Roster28VisualSpec {
  id: string
  portrait: string
  anilistId: number
  basicRange: number
  voiceQuote: string
  voiceLang: 'ja-JP' | 'th-TH' | 'en-US'
  skills: Array<{
    castRange: number
    aoeRadius: number
    aimType: SkillAimType
    voiceText: string
  }>
  aimTheme: HeroAimTheme
  suitHex: number
  pantsHex: number
  bootHex: number
  hairHex: number
  eyeHex: number
  skinHex?: number
  tipAccentHex?: number
  hasCape?: boolean
  capeHex?: number
  weaponType: 'katana' | 'staff' | 'gloves' | 'cards' | 'gauntlets' | 'chains' | 'shield' | 'none'
  orbitalHex: number
  corridorGlyph: string
  aiStyle: 'melee' | 'ranged' | 'assassin' | 'tank'
}

function mkCursor(stroke: string, fill: string, innerGlyph: string): string {
  return `<circle cx="16" cy="16" r="11" fill="${fill}" stroke="${stroke}" stroke-width="2.1"/>${innerGlyph}<circle cx="16" cy="16" r="2.2" fill="#FFFFFF"/>`
}

export const ROSTER28_SPECS: Roster28VisualSpec[] = [
  {
    id: 'gray', portrait: '/characters/gray.png', anilistId: 483, basicRange: 260,
    voiceQuote: '氷の造形魔法、アイスメイクだ！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 560, aoeRadius: 56, aimType: 'line', voiceText: 'アイスメイク、ランス！' },
      { castRange: 200, aoeRadius: 145, aimType: 'self', voiceText: 'アイスメイク、シールド！' },
      { castRange: 480, aoeRadius: 215, aimType: 'ground', voiceText: '氷魔の激昂！凍りつけ！' },
    ],
    aimTheme: { id: 'gray', primary: '#38BDF8', secondary: '#E0F2FE', glow: 'rgba(56,189,248,0.52)', corridorStyle: 'ancient', cursorSvgInner: mkCursor('#38BDF8', 'rgba(15,41,74,0.55)', '<path d="M16 5v22M5 16h22" stroke="#E0F2FE" stroke-width="1.6"/>') },
    suitHex: 0x0f172a, pantsHex: 0x1e293b, bootHex: 0x09090b, hairHex: 0x0f172a, eyeHex: 0x38bdf8,
    weaponType: 'gloves', orbitalHex: 0x38bdf8, corridorGlyph: '❄', aiStyle: 'melee',
  },
  {
    id: 'diavolo', portrait: '/characters/diavolo.png?v=kc2', anilistId: 132319, basicRange: 190,
    voiceQuote: '帝王はこのディアボロだ！結果だけが残る！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 250, aoeRadius: 125, aimType: 'cone', voiceText: 'キング・クリムゾン！' },
      { castRange: 220, aoeRadius: 140, aimType: 'self', voiceText: '時は消し飛んだ！' },
      { castRange: 520, aoeRadius: 170, aimType: 'ground', voiceText: '運命は決まった！終わりだ！' },
    ],
    aimTheme: { id: 'diavolo', primary: '#DC2626', secondary: '#F472B6', glow: 'rgba(220,38,38,0.52)', corridorStyle: 'clockwork', cursorSvgInner: mkCursor('#DC2626', 'rgba(69,10,10,0.65)', '<polygon points="16,5 25,16 16,27 7,16" fill="none" stroke="#F472B6" stroke-width="1.6"/>') },
    suitHex: 0x450a0a, pantsHex: 0x09090b, bootHex: 0x7f1d1d, hairHex: 0xdb2777, eyeHex: 0x10b981, tipAccentHex: 0x111827,
    weaponType: 'gauntlets', orbitalHex: 0xdc2626, corridorGlyph: '⏳', aiStyle: 'assassin',
  },
  {
    id: 'cid', portrait: '/characters/cid.png', anilistId: 204975, basicRange: 220,
    voiceQuote: '我はシャドウ、陰に潜み陰を狩る者。', voiceLang: 'ja-JP',
    skills: [
      { castRange: 520, aoeRadius: 85, aimType: 'cone', voiceText: 'シャドウスラッシュ！' },
      { castRange: 380, aoeRadius: 115, aimType: 'line', voiceText: '遅いな、シャドウステップ！' },
      { castRange: 440, aoeRadius: 260, aimType: 'ground', voiceText: 'アイ・アム・アトミック！' },
    ],
    aimTheme: { id: 'cid', primary: '#7C3AED', secondary: '#38BDF8', glow: 'rgba(124,58,237,0.55)', corridorStyle: 'hypnosis', cursorSvgInner: mkCursor('#7C3AED', 'rgba(30,27,75,0.75)', '<circle cx="16" cy="16" r="6" fill="none" stroke="#38BDF8" stroke-width="1.6"/>') },
    suitHex: 0x0f172a, pantsHex: 0x09090b, bootHex: 0x1e1b4b, hairHex: 0x0f172a, eyeHex: 0xef4444, hasCape: true, capeHex: 0x1e1b4b,
    weaponType: 'katana', orbitalHex: 0x7c3aed, corridorGlyph: '⚛', aiStyle: 'assassin',
  },
  {
    id: 'pop', portrait: '/characters/pop.png', anilistId: 0, basicRange: 190,
    voiceQuote: 'ข้าหิวเหลือเกิน... ขอตับไตไส้พุงของเจ้าหน่อยเถอะ!', voiceLang: 'th-TH',
    skills: [
      { castRange: 320, aoeRadius: 110, aimType: 'line', voiceText: 'กรงเล็บผีปอบ!' },
      { castRange: 460, aoeRadius: 140, aimType: 'ground', voiceText: 'จงตกเป็นร่างสิงของข้า!' },
      { castRange: 250, aoeRadius: 220, aimType: 'self', voiceText: 'ความหิวโหยอันไร้ที่สิ้นสุด!' },
    ],
    aimTheme: { id: 'pop', primary: '#22C55E', secondary: '#A3E635', glow: 'rgba(34,197,94,0.52)', corridorStyle: 'cleave', cursorSvgInner: mkCursor('#22C55E', 'rgba(6,78,59,0.65)', '<path d="M9 11 L23 21 M23 11 L9 21" stroke="#A3E635" stroke-width="2"/>') },
    suitHex: 0x14532d, pantsHex: 0x09090b, bootHex: 0x14532d, hairHex: 0x09090b, eyeHex: 0x22c55e, skinHex: 0xbbf7d0,
    weaponType: 'gloves', orbitalHex: 0x22c55e, corridorGlyph: '☠', aiStyle: 'assassin',
  },
  {
    id: 'speed_grandma', portrait: '/characters/speed_grandma.png', anilistId: 0, basicRange: 185,
    voiceQuote: 'หนีไม่พ้นหรอกนะลูกหลาน... ยายจะตามไปให้ทัน!', voiceLang: 'th-TH',
    skills: [
      { castRange: 420, aoeRadius: 85, aimType: 'line', voiceText: 'ยายสปีดพุ่งชน!' },
      { castRange: 300, aoeRadius: 120, aimType: 'line', voiceText: 'เงาหลอนติดล้อ!' },
      { castRange: 460, aoeRadius: 185, aimType: 'ground', voiceText: 'ไล่ล่ามรณะ! เร็วกว่านรก!' },
    ],
    aimTheme: { id: 'speed_grandma', primary: '#EF4444', secondary: '#FCA5A5', glow: 'rgba(239,68,68,0.55)', corridorStyle: 'lightning', cursorSvgInner: mkCursor('#EF4444', 'rgba(69,10,10,0.6)', '<path d="M8 16h16M16 8l6 8-6 8" fill="none" stroke="#FCA5A5" stroke-width="1.8"/>') },
    suitHex: 0x991b1b, pantsHex: 0x111827, bootHex: 0xef4444, hairHex: 0xcbd5e1, eyeHex: 0xef4444,
    weaponType: 'gloves', orbitalHex: 0xef4444, corridorGlyph: '⚡', aiStyle: 'assassin',
  },
  {
    id: 'krahang', portrait: '/characters/krahang.png', anilistId: 0, basicRange: 195,
    voiceQuote: 'กระด้งคู่ใจทะยานฟ้า... ไม่มีใครรอดพ้นราตรีนี้!', voiceLang: 'th-TH',
    skills: [
      { castRange: 250, aoeRadius: 130, aimType: 'cone', voiceText: 'ฟาดสากกระหัง!' },
      { castRange: 360, aoeRadius: 115, aimType: 'line', voiceText: 'พายุปีกกระด้ง!' },
      { castRange: 480, aoeRadius: 210, aimType: 'ground', voiceText: 'มหาพายุผีกระหัง!' },
    ],
    aimTheme: { id: 'krahang', primary: '#D97706', secondary: '#FEF08A', glow: 'rgba(217,119,6,0.5)', corridorStyle: 'crows', cursorSvgInner: mkCursor('#D97706', 'rgba(69,26,3,0.58)', '<path d="M6 18 Q16 6 26 18" fill="none" stroke="#FEF08A" stroke-width="2"/>') },
    suitHex: 0x78350f, pantsHex: 0x1e293b, bootHex: 0x451a03, hairHex: 0x1e293b, eyeHex: 0xfacc15, skinHex: 0xd99b72, hasCape: true, capeHex: 0xd97706,
    weaponType: 'staff', orbitalHex: 0xf59e0b, corridorGlyph: '🌪', aiStyle: 'melee',
  },
  {
    id: 'krasue', portrait: '/characters/krasue.png', anilistId: 0, basicRange: 310,
    voiceQuote: 'ราตรีนี้กลิ่นเลือดช่างหอมหวานยิ่งนัก...', voiceLang: 'th-TH',
    skills: [
      { castRange: 640, aoeRadius: 60, aimType: 'line', voiceText: 'ลำแสงโลหิตกระสือ!' },
      { castRange: 280, aoeRadius: 150, aimType: 'self', voiceText: 'คำสาปลอยนวล!' },
      { castRange: 440, aoeRadius: 225, aimType: 'ground', voiceText: 'รัตติกาลสยองขวัญวิญญาณแดง!' },
    ],
    aimTheme: { id: 'krasue', primary: '#F43F5E', secondary: '#FB923C', glow: 'rgba(244,63,94,0.52)', corridorStyle: 'pulse', cursorSvgInner: mkCursor('#F43F5E', 'rgba(76,5,25,0.65)', '<circle cx="16" cy="16" r="5" fill="#FB923C"/>') },
    suitHex: 0x881337, pantsHex: 0x111827, bootHex: 0xbe123c, hairHex: 0x111827, eyeHex: 0xf43f5e,
    weaponType: 'none', orbitalHex: 0xf43f5e, corridorGlyph: '🩸', aiStyle: 'ranged',
  },
  {
    id: 'po', portrait: '/characters/po.png', anilistId: 0, basicRange: 185,
    voiceQuote: '伝説の龍の戦士、ポーのカンフーを見せてやるぜ！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 240, aoeRadius: 120, aimType: 'cone', voiceText: 'パンダパンチ！' },
      { castRange: 200, aoeRadius: 165, aimType: 'self', voiceText: 'ベリーバウンス！' },
      { castRange: 420, aoeRadius: 215, aimType: 'ground', voiceText: 'ウーシーの指固め！スゥードゥー！' },
    ],
    aimTheme: { id: 'po', primary: '#FACC15', secondary: '#F8FAFC', glow: 'rgba(250,204,21,0.5)', corridorStyle: 'gourmet', cursorSvgInner: mkCursor('#FACC15', 'rgba(24,24,27,0.7)', '<circle cx="16" cy="16" r="5" fill="#F8FAFC"/>') },
    suitHex: 0xf8fafc, pantsHex: 0x1e293b, bootHex: 0x111827, hairHex: 0x111827, eyeHex: 0x10b981, skinHex: 0xf8fafc,
    weaponType: 'gauntlets', orbitalHex: 0xfacc15, corridorGlyph: '☯', aiStyle: 'tank',
  },
  {
    id: 'tai_lung', portrait: '/characters/tai_lung.png', anilistId: 0, basicRange: 190,
    voiceQuote: '真の龍の戦士はこのタイ・ランだ！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 250, aoeRadius: 95, aimType: 'cone', voiceText: '秘孔突き！' },
      { castRange: 380, aoeRadius: 135, aimType: 'line', voiceText: 'フライングリープ！' },
      { castRange: 360, aoeRadius: 180, aimType: 'ground', voiceText: '千手連撃！' },
    ],
    aimTheme: { id: 'tai_lung', primary: '#3B82F6', secondary: '#E2E8F0', glow: 'rgba(59,130,246,0.52)', corridorStyle: 'cleave', cursorSvgInner: mkCursor('#3B82F6', 'rgba(15,23,42,0.65)', '<path d="M9 9 L23 23 M16 7 L16 25" stroke="#E2E8F0" stroke-width="1.8"/>') },
    suitHex: 0x334155, pantsHex: 0x4c1d95, bootHex: 0x0f172a, hairHex: 0x94a3b8, eyeHex: 0xfacc15, skinHex: 0xcbd5e1,
    weaponType: 'gloves', orbitalHex: 0x3b82f6, corridorGlyph: '🐾', aiStyle: 'assassin',
  },
  {
    id: 'kai', portrait: '/characters/kai.png', anilistId: 0, basicRange: 235,
    voiceQuote: '全ての気を奪い尽くす、このカイ様がな！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 480, aoeRadius: 72, aimType: 'line', voiceText: '翡翠の鎖鞭！' },
      { castRange: 520, aoeRadius: 64, aimType: 'line', voiceText: 'スピリットチェーン！' },
      { castRange: 440, aoeRadius: 210, aimType: 'ground', voiceText: '翡翠の軍勢よ、現れよ！' },
    ],
    aimTheme: { id: 'kai', primary: '#10B981', secondary: '#A7F3D0', glow: 'rgba(16,185,129,0.52)', corridorStyle: 'stones', cursorSvgInner: mkCursor('#10B981', 'rgba(6,78,59,0.65)', '<polygon points="16,6 24,16 16,26 8,16" fill="#A7F3D0"/>') },
    suitHex: 0x065f46, pantsHex: 0x1e293b, bootHex: 0x064e3b, hairHex: 0x334155, eyeHex: 0x34d399, skinHex: 0x6ee7b7,
    weaponType: 'chains', orbitalHex: 0x10b981, corridorGlyph: '❇', aiStyle: 'melee',
  },
  {
    id: 'gambit', portrait: '/characters/gambit.png', anilistId: 0, basicRange: 320,
    voiceQuote: 'The name is Gambit, mon ami. Pick a card!', voiceLang: 'en-US',
    skills: [
      { castRange: 580, aoeRadius: 80, aimType: 'cone', voiceText: 'Boom! Kinetic card throw!' },
      { castRange: 300, aoeRadius: 115, aimType: 'line', voiceText: 'Staff strike!' },
      { castRange: 500, aoeRadius: 215, aimType: 'ground', voiceText: 'Royal Flush! Everything blows up!' },
    ],
    aimTheme: { id: 'gambit', primary: '#EC4899', secondary: '#A855F7', glow: 'rgba(236,72,153,0.52)', corridorStyle: 'babylon', cursorSvgInner: mkCursor('#EC4899', 'rgba(80,7,36,0.65)', '<rect x="11" y="9" width="10" height="14" fill="none" stroke="#F8FAFC" stroke-width="1.6"/>') },
    suitHex: 0x78350f, pantsHex: 0x0f172a, bootHex: 0xbe185d, hairHex: 0x78350f, eyeHex: 0xec4899, hasCape: true, capeHex: 0x78350f,
    weaponType: 'cards', orbitalHex: 0xec4899, corridorGlyph: '♠', aiStyle: 'ranged',
  },
  {
    id: 'iron_man', portrait: '/characters/iron_man.png?v=im2', anilistId: 0, basicRange: 330,
    voiceQuote: 'I am Iron Man. Mark 85 online, Jarvis charge to max.', voiceLang: 'en-US',
    skills: [
      { castRange: 620, aoeRadius: 68, aimType: 'line', voiceText: 'Repulsor Blast!' },
      { castRange: 540, aoeRadius: 145, aimType: 'ground', voiceText: 'Micro-missile barrage!' },
      { castRange: 180, aoeRadius: 150, aimType: 'self', voiceText: 'Thrusters maximum! Flight mode!' },
    ],
    aimTheme: { id: 'iron_man', primary: '#EF4444', secondary: '#FACC15', glow: 'rgba(239,68,68,0.52)', corridorStyle: 'sniper', cursorSvgInner: mkCursor('#EF4444', 'rgba(127,29,29,0.65)', '<circle cx="16" cy="16" r="5" fill="#38BDF8"/>') },
    suitHex: 0xdc2626, pantsHex: 0xdc2626, bootHex: 0xfacc15, hairHex: 0xfacc15, eyeHex: 0x38bdf8, skinHex: 0xdc2626,
    weaponType: 'gauntlets', orbitalHex: 0x38bdf8, corridorGlyph: '◎', aiStyle: 'ranged',
  },
  {
    id: 'law', portrait: '/characters/law.png', anilistId: 13767, basicRange: 290,
    voiceQuote: 'オペオペの実、お前の命は俺が執刀する。', voiceLang: 'ja-JP',
    skills: [
      { castRange: 520, aoeRadius: 75, aimType: 'line', voiceText: 'シャンブルズ！アンピュテート！' },
      { castRange: 440, aoeRadius: 190, aimType: 'ground', voiceText: 'ROOM！シャンブルズ！' },
      { castRange: 480, aoeRadius: 225, aimType: 'ground', voiceText: 'パンクチャー・ウィレ！' },
    ],
    aimTheme: { id: 'law', primary: '#0EA5E9', secondary: '#FACC15', glow: 'rgba(14,165,233,0.52)', corridorStyle: 'infinity', cursorSvgInner: mkCursor('#0EA5E9', 'rgba(12,74,110,0.65)', '<circle cx="16" cy="16" r="7" fill="none" stroke="#FACC15" stroke-width="1.5"/>') },
    suitHex: 0x0f172a, pantsHex: 0x1d4ed8, bootHex: 0x09090b, hairHex: 0x09090b, eyeHex: 0xfacc15, hasCape: true, capeHex: 0xfacc15,
    weaponType: 'katana', orbitalHex: 0x0ea5e9, corridorGlyph: '⛨', aiStyle: 'ranged',
  },
  {
    id: 'garp', portrait: '/characters/garp.png', anilistId: 12639, basicRange: 190,
    voiceQuote: 'ぶっ飛ばすぞ！海軍の拳をくらえっ！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 400, aoeRadius: 175, aimType: 'ground', voiceText: 'ギャラクシー・インパクト！' },
      { castRange: 300, aoeRadius: 110, aimType: 'line', voiceText: '鉄拳！' },
      { castRange: 440, aoeRadius: 235, aimType: 'ground', voiceText: 'ギャラクシー・ディバイド！' },
    ],
    aimTheme: { id: 'garp', primary: '#DC2626', secondary: '#F8FAFC', glow: 'rgba(220,38,38,0.52)', corridorStyle: 'punch', cursorSvgInner: mkCursor('#DC2626', 'rgba(127,29,29,0.6)', '<circle cx="16" cy="16" r="7" fill="none" stroke="#F8FAFC" stroke-width="2"/>') },
    suitHex: 0xf8fafc, pantsHex: 0xf1f5f9, bootHex: 0x09090b, hairHex: 0xe2e8f0, eyeHex: 0x0f172a, hasCape: true, capeHex: 0xf8fafc,
    weaponType: 'gauntlets', orbitalHex: 0xdc2626, corridorGlyph: '✊', aiStyle: 'tank',
  },
  {
    id: 'tansan', portrait: '/characters/tansan.png', anilistId: 0, basicRange: 305,
    voiceQuote: '弾けろ炭酸パワー！爽快に決めるぜ！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 540, aoeRadius: 125, aimType: 'ground', voiceText: 'バブルショット！' },
      { castRange: 220, aoeRadius: 185, aimType: 'self', voiceText: 'ソーダブースト！全開！' },
      { castRange: 480, aoeRadius: 225, aimType: 'ground', voiceText: 'カーボネーション・エクスプロージョン！' },
    ],
    aimTheme: { id: 'tansan', primary: '#38BDF8', secondary: '#F8FAFC', glow: 'rgba(56,189,248,0.5)', corridorStyle: 'pulse', cursorSvgInner: mkCursor('#38BDF8', 'rgba(3,105,161,0.55)', '<circle cx="13" cy="13" r="3" fill="#F8FAFC"/><circle cx="20" cy="18" r="2.5" fill="#F8FAFC"/>') },
    suitHex: 0x0284c7, pantsHex: 0xf8fafc, bootHex: 0x0369a1, hairHex: 0x7dd3fc, eyeHex: 0x38bdf8,
    weaponType: 'gloves', orbitalHex: 0x7dd3fc, corridorGlyph: '🫧', aiStyle: 'ranged',
  },
  {
    id: 'wukong', portrait: '/characters/wukong.png', anilistId: 0, basicRange: 225,
    voiceQuote: '斉天大聖、孫悟空が相手になってやる！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 420, aoeRadius: 72, aimType: 'line', voiceText: '如意棒、伸びろっ！' },
      { castRange: 340, aoeRadius: 115, aimType: 'line', voiceText: '筋斗雲ダッシュ！' },
      { castRange: 460, aoeRadius: 225, aimType: 'ground', voiceText: '斉天大聖、覚醒！' },
    ],
    aimTheme: { id: 'wukong', primary: '#F59E0B', secondary: '#DC2626', glow: 'rgba(245,158,11,0.52)', corridorStyle: 'kamehameha', cursorSvgInner: mkCursor('#F59E0B', 'rgba(120,53,15,0.6)', '<path d="M7 16h18" stroke="#FACC15" stroke-width="2.6"/>') },
    suitHex: 0xf59e0b, pantsHex: 0x78350f, bootHex: 0xdc2626, hairHex: 0x92400e, eyeHex: 0xef4444, hasCape: true, capeHex: 0xdc2626,
    weaponType: 'staff', orbitalHex: 0xf59e0b, corridorGlyph: '☁', aiStyle: 'melee',
  },
  {
    id: 'nezha', portrait: '/characters/nezha.png', anilistId: 0, basicRange: 210,
    voiceQuote: '紅蓮の焔と風火輪で焼き払う！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 380, aoeRadius: 68, aimType: 'line', voiceText: '火尖槍！' },
      { castRange: 250, aoeRadius: 140, aimType: 'self', voiceText: '風火輪、全開！' },
      { castRange: 460, aoeRadius: 215, aimType: 'ground', voiceText: '紅蓮爆炎！' },
    ],
    aimTheme: { id: 'nezha', primary: '#F97316', secondary: '#FEF08A', glow: 'rgba(249,115,22,0.52)', corridorStyle: 'godspeed', cursorSvgInner: mkCursor('#F97316', 'rgba(124,45,18,0.6)', '<circle cx="16" cy="16" r="6" fill="none" stroke="#FEF08A" stroke-width="1.8"/>') },
    suitHex: 0xdc2626, pantsHex: 0xf8fafc, bootHex: 0xf97316, hairHex: 0x111827, eyeHex: 0xef4444, hasCape: true, capeHex: 0xef4444,
    weaponType: 'staff', orbitalHex: 0xf97316, corridorGlyph: '🔥', aiStyle: 'assassin',
  },
  {
    id: 'king', portrait: '/characters/king.png', anilistId: 90198, basicRange: 260,
    voiceQuote: 'ゴゴゴゴゴ…キングエンジンが鳴っているぞ。', voiceLang: 'ja-JP',
    skills: [
      { castRange: 440, aoeRadius: 140, aimType: 'cone', voiceText: '悪人め…睨みつけてやる！' },
      { castRange: 300, aoeRadius: 110, aimType: 'line', voiceText: 'うわっ、ラッキー回避！？' },
      { castRange: 420, aoeRadius: 255, aimType: 'ground', voiceText: 'S級ヒーローの威圧だ！' },
    ],
    aimTheme: { id: 'king', primary: '#FACC15', secondary: '#94A3B8', glow: 'rgba(250,204,21,0.5)', corridorStyle: 'pulse', cursorSvgInner: mkCursor('#FACC15', 'rgba(15,23,42,0.65)', '<path d="M10 10 L14 22 M15 10 L19 22 M20 10 L24 22" stroke="#EF4444" stroke-width="1.5"/>') },
    suitHex: 0x1e293b, pantsHex: 0x0f172a, bootHex: 0x09090b, hairHex: 0xfef08a, eyeHex: 0x38bdf8,
    weaponType: 'none', orbitalHex: 0xfacc15, corridorGlyph: '👑', aiStyle: 'ranged',
  },
  {
    id: 'gon', portrait: '/characters/gon.png', anilistId: 30, basicRange: 195,
    voiceQuote: '絶対に勝つ！俺の念をすべて込める！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 230, aoeRadius: 115, aimType: 'cone', voiceText: '最初はグー、ジャンケン・グー！' },
      { castRange: 460, aoeRadius: 68, aimType: 'line', voiceText: 'ジャンケン・チー！' },
      { castRange: 420, aoeRadius: 240, aimType: 'ground', voiceText: 'ありったけの念を…解放！' },
    ],
    aimTheme: { id: 'gon', primary: '#22C55E', secondary: '#FACC15', glow: 'rgba(34,197,94,0.52)', corridorStyle: 'punch', cursorSvgInner: mkCursor('#22C55E', 'rgba(20,83,45,0.6)', '<circle cx="16" cy="16" r="6" fill="#FACC15"/>') },
    suitHex: 0x16a34a, pantsHex: 0x15803d, bootHex: 0x14532d, hairHex: 0x0f172a, eyeHex: 0x92400e, tipAccentHex: 0x16a34a,
    weaponType: 'gauntlets', orbitalHex: 0xfacc15, corridorGlyph: '✊', aiStyle: 'melee',
  },
  {
    id: 'steve', portrait: '/characters/steve.png', anilistId: 0, basicRange: 200,
    voiceQuote: 'Crafted diamond gear ready. Time to mine and fight!', voiceLang: 'en-US',
    skills: [
      { castRange: 230, aoeRadius: 120, aimType: 'cone', voiceText: 'Diamond Sword slash!' },
      { castRange: 220, aoeRadius: 145, aimType: 'self', voiceText: 'Block shield up!' },
      { castRange: 460, aoeRadius: 215, aimType: 'ground', voiceText: 'Netherite TNT Awakening!' },
    ],
    aimTheme: { id: 'steve', primary: '#06B6D4', secondary: '#A855F7', glow: 'rgba(6,182,212,0.52)', corridorStyle: 'santoryu', cursorSvgInner: mkCursor('#06B6D4', 'rgba(22,78,99,0.65)', '<rect x="10" y="10" width="12" height="12" fill="none" stroke="#A855F7" stroke-width="1.8"/>') },
    suitHex: 0x06b6d4, pantsHex: 0x1e3a8a, bootHex: 0x334155, hairHex: 0x451a03, eyeHex: 0x3b82f6, skinHex: 0xd9a077,
    weaponType: 'katana', orbitalHex: 0x06b6d4, corridorGlyph: '⛏', aiStyle: 'tank',
  },
  {
    id: 'doraemon', portrait: '/characters/doraemon.png', anilistId: 1886, basicRange: 295,
    voiceQuote: 'ぼくドラえもん！四次元ポケットから出すよ！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 380, aoeRadius: 115, aimType: 'line', voiceText: 'どこでもドア！' },
      { castRange: 220, aoeRadius: 130, aimType: 'self', voiceText: 'タケコプターで飛ぶよ！' },
      { castRange: 480, aoeRadius: 215, aimType: 'ground', voiceText: 'タイムマシン出動だ！' },
    ],
    aimTheme: { id: 'doraemon', primary: '#0284C7', secondary: '#FACC15', glow: 'rgba(2,132,199,0.5)', corridorStyle: 'clockwork', cursorSvgInner: mkCursor('#0284C7', 'rgba(7,89,133,0.6)', '<circle cx="16" cy="16" r="5" fill="#FACC15"/>') },
    suitHex: 0x0284c7, pantsHex: 0x0284c7, bootHex: 0xf8fafc, hairHex: 0x0284c7, eyeHex: 0x0f172a, skinHex: 0xffffff,
    weaponType: 'none', orbitalHex: 0xfacc15, corridorGlyph: '🔔', aiStyle: 'ranged',
  },
  {
    id: 'yami', portrait: '/characters/yami.png', anilistId: 121011, basicRange: 230,
    voiceQuote: '限界を超えろ、黒の暴牛団長ヤミだ。', voiceLang: 'ja-JP',
    skills: [
      { castRange: 440, aoeRadius: 78, aimType: 'line', voiceText: '闇纏・黒刃！' },
      { castRange: 240, aoeRadius: 180, aimType: 'self', voiceText: 'ブラックムーン！' },
      { castRange: 800, aoeRadius: 74, aimType: 'line', voiceText: '闇纏・次元斬！彼岸！' },
    ],
    aimTheme: { id: 'yami', primary: '#6B21A8', secondary: '#EF4444', glow: 'rgba(107,33,168,0.54)', corridorStyle: 'cleave', cursorSvgInner: mkCursor('#6B21A8', 'rgba(9,9,11,0.75)', '<line x1="6" y1="26" x2="26" y2="6" stroke="#EF4444" stroke-width="2.2"/>') },
    suitHex: 0x09090b, pantsHex: 0x1e293b, bootHex: 0x09090b, hairHex: 0x0f172a, eyeHex: 0xef4444, hasCape: true, capeHex: 0x111827,
    weaponType: 'katana', orbitalHex: 0x6b21a8, corridorGlyph: '☽', aiStyle: 'melee',
  },
  {
    id: 'escanor', portrait: '/characters/escanor.png', anilistId: 120312, basicRange: 210,
    voiceQuote: '誰が俺に勝てると思った？傲慢の罪エスカノールだ。', voiceLang: 'ja-JP',
    skills: [
      { castRange: 520, aoeRadius: 160, aimType: 'ground', voiceText: '無慈悲な太陽、クルーエル・サン！' },
      { castRange: 380, aoeRadius: 115, aimType: 'cone', voiceText: '聖剣エスカノール！' },
      { castRange: 300, aoeRadius: 230, aimType: 'self', voiceText: '天上天下唯我独尊、ザ・ワン！' },
    ],
    aimTheme: { id: 'escanor', primary: '#F59E0B', secondary: '#FEF08A', glow: 'rgba(245,158,11,0.55)', corridorStyle: 'gourmet', cursorSvgInner: mkCursor('#F59E0B', 'rgba(120,53,15,0.65)', '<circle cx="16" cy="16" r="6" fill="#FEF08A"/>') },
    suitHex: 0xf59e0b, pantsHex: 0x78350f, bootHex: 0xb45309, hairHex: 0xf97316, eyeHex: 0x38bdf8, hasCape: true, capeHex: 0xdc2626,
    weaponType: 'katana', orbitalHex: 0xfef08a, corridorGlyph: '☀', aiStyle: 'melee',
  },
  {
    id: 'meliodas', portrait: '/characters/meliodas.png', anilistId: 72921, basicRange: 205,
    voiceQuote: 'さあて、全力でやり合おうか！', voiceLang: 'ja-JP',
    skills: [
      { castRange: 250, aoeRadius: 145, aimType: 'self', voiceText: '全反撃、フルカウンター！' },
      { castRange: 500, aoeRadius: 120, aimType: 'line', voiceText: '地獄の業火、ヘルブレイズ！' },
      { castRange: 300, aoeRadius: 240, aimType: 'self', voiceText: '殲滅状態、アサルトモード！' },
    ],
    aimTheme: { id: 'meliodas', primary: '#7E22CE', secondary: '#38BDF8', glow: 'rgba(126,34,206,0.52)', corridorStyle: 'hypnosis', cursorSvgInner: mkCursor('#7E22CE', 'rgba(30,27,75,0.7)', '<polygon points="16,6 25,24 7,24" fill="none" stroke="#A855F7" stroke-width="1.8"/>') },
    suitHex: 0x1e1b4b, pantsHex: 0x09090b, bootHex: 0x4c1d95, hairHex: 0xfacc15, eyeHex: 0x9333ea,
    weaponType: 'katana', orbitalHex: 0x7e22ce, corridorGlyph: '⚔', aiStyle: 'melee',
  },
  {
    id: 'adam', portrait: '/characters/adam.png', anilistId: 146026, basicRange: 195,
    voiceQuote: '父親が子どもを守るのに、理由なんて要るのか？', voiceLang: 'ja-JP',
    skills: [
      { castRange: 250, aoeRadius: 115, aimType: 'cone', voiceText: '神虚視・模倣連撃！' },
      { castRange: 300, aoeRadius: 105, aimType: 'line', voiceText: '見切ったよ！' },
      { castRange: 300, aoeRadius: 190, aimType: 'ground', voiceText: '全人類のため、最後の一撃だ！' },
    ],
    aimTheme: { id: 'adam', primary: '#FBBF24', secondary: '#F8FAFC', glow: 'rgba(251,191,36,0.52)', corridorStyle: 'lightning', cursorSvgInner: mkCursor('#FBBF24', 'rgba(120,53,15,0.45)', '<ellipse cx="16" cy="16" rx="8" ry="4.5" fill="none" stroke="#F8FAFC" stroke-width="1.8"/>') },
    suitHex: 0xfde0c4, pantsHex: 0xf8fafc, bootHex: 0xf59e0b, hairHex: 0xfde047, eyeHex: 0x38bdf8,
    weaponType: 'gauntlets', orbitalHex: 0xfbbf24, corridorGlyph: '👁', aiStyle: 'assassin',
  },
  {
    id: 'beelzebub', portrait: '/characters/beelzebub.png', anilistId: 186778, basicRange: 300,
    voiceQuote: '呪われた蝿の王、ベルゼブブ…消え去れ。', voiceLang: 'ja-JP',
    skills: [
      { castRange: 580, aoeRadius: 72, aimType: 'line', voiceText: 'カオスウェーブ！' },
      { castRange: 220, aoeRadius: 150, aimType: 'self', voiceText: '振動障壁！' },
      { castRange: 480, aoeRadius: 240, aimType: 'ground', voiceText: '虚無の大震、カオス！' },
    ],
    aimTheme: { id: 'beelzebub', primary: '#6D28D9', secondary: '#A78BFA', glow: 'rgba(109,40,217,0.54)', corridorStyle: 'hypnosis', cursorSvgInner: mkCursor('#6D28D9', 'rgba(9,9,11,0.75)', '<circle cx="16" cy="16" r="7" fill="none" stroke="#A78BFA" stroke-width="1.8"/>') },
    suitHex: 0x09090b, pantsHex: 0x111827, bootHex: 0x3b0764, hairHex: 0x09090b, eyeHex: 0xef4444, hasCape: true, capeHex: 0x1e1b4b,
    weaponType: 'staff', orbitalHex: 0x6d28d9, corridorGlyph: '〰', aiStyle: 'ranged',
  },
  {
    id: 'buddha', portrait: '/characters/buddha.png', anilistId: 186777, basicRange: 215,
    voiceQuote: '天上天下唯我独尊。未来は見えてんだよ。', voiceLang: 'ja-JP',
    skills: [
      { castRange: 360, aoeRadius: 96, aimType: 'line', voiceText: '六道棍、変化！' },
      { castRange: 300, aoeRadius: 130, aimType: 'line', voiceText: '未来視、かわしたぜ！' },
      { castRange: 460, aoeRadius: 225, aimType: 'ground', voiceText: '六道・涅槃！' },
    ],
    aimTheme: { id: 'buddha', primary: '#FACC15', secondary: '#FEF08A', glow: 'rgba(250,204,21,0.54)', corridorStyle: 'ancient', cursorSvgInner: mkCursor('#FACC15', 'rgba(113,63,18,0.6)', '<circle cx="16" cy="16" r="6" fill="none" stroke="#FEF08A" stroke-width="2"/>') },
    suitHex: 0xf8fafc, pantsHex: 0x78350f, bootHex: 0xb45309, hairHex: 0x0ea5e9, eyeHex: 0x38bdf8,
    weaponType: 'staff', orbitalHex: 0xfacc15, corridorGlyph: '☸', aiStyle: 'melee',
  },
  {
    id: 'cj_palony', portrait: '/characters/cj_palony.png', anilistId: 0, basicRange: 240,
    voiceQuote: 'CJ Palony stepping in! Watch my hidden potential ignite!', voiceLang: 'en-US',
    skills: [
      { castRange: 480, aoeRadius: 75, aimType: 'line', voiceText: 'Power Strike!' },
      { castRange: 320, aoeRadius: 120, aimType: 'line', voiceText: 'Phantom Shadow Move!' },
      { castRange: 280, aoeRadius: 230, aimType: 'self', voiceText: 'Final Awakening!' },
    ],
    aimTheme: { id: 'cj_palony', primary: '#38BDF8', secondary: '#F43F5E', glow: 'rgba(56,189,248,0.52)', corridorStyle: 'pulse', cursorSvgInner: mkCursor('#38BDF8', 'rgba(12,74,110,0.6)', '<polygon points="16,5 26,16 16,27 6,16" fill="none" stroke="#F43F5E" stroke-width="1.8"/>') },
    suitHex: 0x0f172a, pantsHex: 0x1e293b, bootHex: 0x38bdf8, hairHex: 0x111827, eyeHex: 0xf43f5e,
    weaponType: 'gloves', orbitalHex: 0xf43f5e, corridorGlyph: '★', aiStyle: 'assassin',
  },
]

export const ROSTER28_MAP = Object.fromEntries(ROSTER28_SPECS.map((s) => [s.id, s])) as Record<string, Roster28VisualSpec>
