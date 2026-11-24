import { SKILL_VOICE_MAP } from '../audio/soundEngine'
import type { CharacterDef, GameMode, MapId } from '../types/game'

const ASSET_CACHE_NAME = 'pulsearena-match-assets-v1'

export interface MatchPreloadProgress {
  pct: number
  loaded: number
  total: number
  stage: string
}

export interface MatchPreloadOptions {
  mapId: MapId
  mode: GameMode
  heroIds: string[]
  characters: CharacterDef[]
  onProgress?: (p: MatchPreloadProgress) => void
  onVoiceLoaded?: (charId: string, bytes: ArrayBuffer) => void
  signal?: AbortSignal
}

// Short-term decoded resource pool for the currently active match
const decodedImages = new Map<string, HTMLImageElement>()
const fetchedAudioBytes = new Map<string, ArrayBuffer>()

async function openAssetCache(): Promise<Cache | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null
  try {
    return await window.caches.open(ASSET_CACHE_NAME)
  } catch {
    return null
  }
}

async function fetchWithShortTermCache(url: string, signal?: AbortSignal): Promise<Response | null> {
  try {
    const cache = await openAssetCache()
    if (cache) {
      const hit = await cache.match(url)
      if (hit && hit.ok) {
        return hit
      }
    }
    const net = await fetch(url, { signal })
    if (!net.ok) return null
    if (cache && url.startsWith('/')) {
      try {
        await cache.put(url, net.clone())
      } catch {
        // Ignore quota exceeded / private browsing cache restrictions
      }
    }
    return net
  } catch {
    return null
  }
}

async function loadAndDecodeImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement | null> {
  const existing = decodedImages.get(url)
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return existing
  }

  const res = await fetchWithShortTermCache(url, signal)
  if (!res) return null
  const blob = await res.blob()
  if (signal?.aborted) return null

  const objUrl = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = objUrl
    try {
      await img.decode()
    } catch {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
    }
    if (img.naturalWidth > 0) {
      decodedImages.set(url, img)
      return img
    }
    return null
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

async function loadVoiceBytes(url: string, charId: string, signal?: AbortSignal): Promise<ArrayBuffer | null> {
  const cleanKey = charId
  const cached = fetchedAudioBytes.get(cleanKey)
  if (cached) return cached.slice(0)

  const res = await fetchWithShortTermCache(url, signal)
  if (!res) return null
  const buf = await res.arrayBuffer()
  if (signal?.aborted) return null
  if (fetchedAudioBytes.size > 12) {
    const firstKey = fetchedAudioBytes.keys().next().value
    if (firstKey) fetchedAudioBytes.delete(firstKey)
  }
  fetchedAudioBytes.set(cleanKey, buf)
  return buf.slice(0)
}

export function buildMatchManifestUrls(opts: {
  mapId: MapId
  mode: GameMode
  heroIds: string[]
  characters: CharacterDef[]
}): { images: string[]; voices: Array<{ charId: string; url: string }> } {
  const imageSet = new Set<string>()
  const voiceList: Array<{ charId: string; url: string }> = []
  const seenVoice = new Set<string>()

  // 1. Active Map Environment Backdrop Texture (Compressed WebP for fast WAN load)
  imageSet.add(
    opts.mapId === 'konoha'
      ? '/maps/konoha_bg.webp'
      : opts.mapId === 'sisaket_island'
        ? '/maps/sisaket_bg.webp'
        : opts.mapId === 'scp_site'
          ? '/maps/scp_bg.webp'
          : '/maps/shibuya_bg.webp',
  )

  // 2. Common core combat button icons
  imageSet.add('/skills/atk.png')
  imageSet.add('/skills/dash.png')
  if (opts.mode === 'iconic') {
    imageSet.add('/skills/iconic_rct.png')
    imageSet.add('/fx/iconic_domain_clash.jpg')
  }

  // 3. Strictly heroes present in this match (or selected hero in practice)
  const uniqueHeroes = Array.from(new Set(opts.heroIds.filter(Boolean)))
  for (const hid of uniqueHeroes) {
    const def = opts.characters.find((c) => c.id === hid)
    const portrait =
      def?.imageUrl ||
      (hid === 'default'
        ? '/app-icon.png?v=20261120v2'
        : hid === 'noone'
          ? '/characters/noone.png?v=mcu1'
          : `/characters/${hid}.png`)
    imageSet.add(portrait)

    if (def) {
      for (const sk of def.skills) {
        if (sk.iconUrl) imageSet.add(sk.iconUrl)
      }
    }
    if (hid === 'noone') {
      imageSet.add('/skills/noone_snap.png')
    }
    if (hid === 'luangphi_sorn') {
      imageSet.add('/fx/saitama_dead.jpg')
    }

    const voiceUrl = hid === 'default' ? '/voices/default.mp3?v=en2' : hid === 'noone' ? '/voices/noone.mp3?v=en1' : `/voices/${hid}.mp3?v=jp1`
    if (!seenVoice.has(hid)) {
      seenVoice.add(hid)
      voiceList.push({ charId: hid, url: voiceUrl })
    }

    // Preload this hero's per-skill voice callouts so skill shouts fire with 0ms delay in combat
    const skillTags = ['1', '2', '3', '4', '5', 'rct', 'purple', 'snap']
    for (const tag of skillTags) {
      const skKey = `${hid}_${tag}`
      const clip = SKILL_VOICE_MAP[skKey]
      const cacheId = `skill:${skKey}`
      if (clip && !seenVoice.has(cacheId)) {
        seenVoice.add(cacheId)
        voiceList.push({ charId: cacheId, url: clip.url })
      }
    }
  }

  return { images: Array.from(imageSet), voices: voiceList }
}

/**
 * Match-Scoped Preloader ("โหลดเฉพาะของที่ใช้ในแมตช์ก่อนเข้าเกม"):
 * Fetches into Browser Cache API + decodes bitmaps before entering the 3D arena
 * so live combat suffers zero texture upload or audio decode stutter.
 */
export async function preloadMatchAssets(opts: MatchPreloadOptions): Promise<boolean> {
  const { images, voices } = buildMatchManifestUrls(opts)
  const total = Math.max(1, images.length + voices.length)
  let loaded = 0

  // Evict decoded images from unrelated previous matches so client RAM stays bounded on mobile
  const keepSet = new Set(images)
  for (const key of Array.from(decodedImages.keys())) {
    if (!keepSet.has(key)) {
      decodedImages.delete(key)
    }
  }

  const report = (stage: string) => {
    const pct = Math.min(99, Math.round((loaded / total) * 95))
    opts.onProgress?.({ pct, loaded, total, stage })
  }

  report('กำลังโหลดแผนที่และสมรภูมิ 3D...')

  // Stage 1: Load map + portraits + skill icons in parallel batches
  await Promise.all(
    images.map(async (url) => {
      if (opts.signal?.aborted) return
      await loadAndDecodeImage(url, opts.signal)
      loaded += 1
      const stage = url.includes('/maps/')
        ? 'กำลังเตรียมแผนที่และเท็กซ์เจอร์ 3D...'
        : 'กำลังถอดรหัสโมเดลฮีโร่และไอคอนสกิล...'
      report(stage)
    }),
  )

  if (opts.signal?.aborted) return false

  // Stage 2: Load & cache hero voices scoped to this match
  report('กำลังโหลดเสียงพากย์ตัวละครในแมตช์...')
  await Promise.all(
    voices.map(async ({ charId, url }) => {
      if (opts.signal?.aborted) return
      const bytes = await loadVoiceBytes(url, charId, opts.signal)
      if (bytes) {
        opts.onVoiceLoaded?.(charId, bytes)
      }
      loaded += 1
      report('กำลังคอมไพล์ Shaders และเตรียมเข้าสนาม...')
    }),
  )

  if (opts.signal?.aborted) return false
  opts.onProgress?.({
    pct: 100,
    loaded: total,
    total,
    stage: 'พร้อมรบแล้ว!',
  })
  return true
}

export function getCachedMatchImage(url: string): HTMLImageElement | null {
  const img = decodedImages.get(url)
  if (img && img.complete && img.naturalWidth > 0) {
    return img
  }
  return null
}

/** Ensures a single newly swapped hero's portrait/icons in Practice mode decode cleanly into short-term memory. */
export async function warmupSingleHeroAssets(charId: string, charDef?: CharacterDef): Promise<void> {
  const urls: string[] = [
    charDef?.imageUrl ||
      (charId === 'default'
        ? '/app-icon.png?v=20261120v2'
        : charId === 'noone'
          ? '/characters/noone.png?v=mcu1'
          : `/characters/${charId}.png`),
  ]
  if (charDef) {
    for (const sk of charDef.skills) {
      if (sk.iconUrl) urls.push(sk.iconUrl)
    }
  }
  if (charId === 'noone') urls.push('/skills/noone_snap.png')
  await Promise.all(urls.map((u) => loadAndDecodeImage(u)))
}

/** Frees transient match image/audio references upon exiting a match cleanly. */
export function releaseUnusedMatchAssets(keepCharacterIds: string[] = []): void {
  const keepUrls = new Set<string>(['/skills/atk.png', '/skills/dash.png'])
  for (const cid of keepCharacterIds) {
    keepUrls.add(
      cid === 'default'
        ? '/app-icon.png?v=20261120v2'
        : cid === 'noone'
          ? '/characters/noone.png?v=mcu1'
          : `/characters/${cid}.png`,
    )
  }
  for (const key of Array.from(decodedImages.keys())) {
    if (!keepUrls.has(key)) {
      decodedImages.delete(key)
    }
  }
}
