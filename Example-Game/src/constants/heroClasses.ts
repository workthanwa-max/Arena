import type { HeroClassId, MapId } from '../types/game'

export type HeroClassFilter = 'all' | HeroClassId

export interface HeroClassMeta {
  id: HeroClassFilter
  icon: string
  name: string
  shortName: string
  color: string
  traitSummary: string
}

/**
 * 5 Never-Before-Seen Hero Archetypes — each backed by a real server-enforced mechanical variable
 * in Go engine.go (`zoneRadiusScale`, `dashCooldownScale`, `projectileSpeedScale`, `lowHpDamageBonus`, `executionThreshold`).
 */
export const HERO_CLASS_FILTERS: HeroClassMeta[] = [
  {
    id: 'all',
    icon: '',
    name: 'ทั้งหมด',
    shortName: 'ทั้งหมด',
    color: '#38BDF8',
    traitSummary: 'ฮีโร่ทุกสาย (5 ประเภท)',
  },
  {
    id: 'sovereign',
    icon: '',
    name: 'ราชันย์อาณาเขต',
    shortName: 'อาณาเขต',
    color: '#A855F7',
    traitSummary: 'รัศมีโซน/อาณาเขต +15%',
  },
  {
    id: 'chronos',
    icon: '',
    name: 'ผู้แหวกมิติเวลา',
    shortName: 'มิติเวลา',
    color: '#FACC15',
    traitSummary: 'Dash CD -28% • ระยะพุ่งไกลขึ้น',
  },
  {
    id: 'deadeye',
    icon: '',
    name: 'เพชฌฆาตเส้นเล็ง',
    shortName: 'เส้นเล็ง',
    color: '#38BDF8',
    traitSummary: 'ความเร็วกระสุน/สกิลยิง +20%',
  },
  {
    id: 'vanguard',
    icon: '',
    name: 'ผู้ทลายขีดจำกัด',
    shortName: 'ขีดจำกัด',
    color: '#10B981',
    traitSummary: 'HP <45% ดาเมจทั้งหมด +25%',
  },
  {
    id: 'cataclysm',
    icon: '',
    name: 'ผู้กุมชะตาโลก',
    shortName: 'ชะตาโลก',
    color: '#F43F5E',
    traitSummary: 'ปิดชีพทันที ≤12% HP • ต้านสโลว์ 30%',
  },
]

export function getMapDisplayLabel(mapId: MapId | undefined, isIconic = false): string {
  if (isIconic || mapId === 'shibuya') return 'ชิบูย่า (Shibuya)'
  if (mapId === 'sisaket_island') return 'เกาะกลางน้ำ ศรีสะเกษ'
  if (mapId === 'scp_site') return 'สถานีวิจัย SCP'
  if (mapId === 'konoha') return 'หมู่บ้านโคโนฮะ'
  return 'ชิบูย่า (Shibuya)'
}
