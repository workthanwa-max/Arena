import { create } from 'zustand'
import { CHARACTER_VOICES, soundEngine } from '../audio/soundEngine'
import { voiceChatEngine } from '../audio/voiceChatEngine'
import { gameEventBus } from '../game/core/eventBus'
import {
  cacheCharacters,
  getCachedCharacters,
  getRecentRooms,
  initLocalSQLite,
  loadPreferences,
  recordRecentRoom,
  savePreference,
} from '../local-db/sqliteCache'
import {
  apiClient,
  clearStoredSessionToken,
  getStoredSessionToken,
  saveStoredSessionToken,
} from '../services/apiClient'
import { releaseUnusedMatchAssets, warmupSingleHeroAssets } from '../services/assetPreloader'
import {
  BIN_CLIENT_RCT,
  BIN_CLIENT_RESPAWN,
  BIN_CLIENT_SNAP,
  BIN_SERVER_PONG,
  BIN_SERVER_STATE,
  decodeBinaryPong,
  decodeBinaryState,
  encodeBinaryAttack,
  encodeBinaryDash,
  encodeBinaryInput,
  encodeBinaryPing,
  encodeBinarySimple,
  encodeBinarySkill,
} from '../services/realtimeProtocol'
import { prefetchTransportInfo, RealtimeTransport, type TransportKind } from '../services/realtimeTransport'
import type {
  BeamEffect,
  CharacterDef,
  GameMode,
  GraphicsQuality,
  MapConfig,
  MapId,
  MatchPhase,
  PeerVoiceState,
  PlayerState,
  Projectile,
  RecentRoom,
  RoomInfo,
  ScreenView,
  ServerMessage,
  SkillAimType,
  TeamSide,
  UserProfile,
  ZoneEffect,
} from '../types/game'

function getWSBase(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
}

function getInitialRoomFromURL(): string {
  const params = new URLSearchParams(window.location.search)
  return (params.get('room') ?? '').trim()
}

const GFX_QUALITY_STORAGE_KEY = 'pulsearena_gfx_quality'
const LEGACY_PIXEL_STORAGE_KEY = 'pulsearena_pixel_mode'

function normalizeGraphicsQuality(raw: string | null | undefined): GraphicsQuality {
  if (raw === 'pixel' || raw === 'fine_pixel' || raw === 'hd' || raw === 'ultra') {
    return raw
  }
  return 'pixel'
}

function getInitialGraphicsQuality(): GraphicsQuality {
  try {
    const saved = window.localStorage.getItem(GFX_QUALITY_STORAGE_KEY)
    if (saved) return normalizeGraphicsQuality(saved)
    const legacy = window.localStorage.getItem(LEGACY_PIXEL_STORAGE_KEY)
    if (legacy === '0' || legacy === 'false') return 'hd'
  } catch {
    // Ignore storage read blocks in restricted contexts
  }
  return 'pixel'
}

const DEFAULT_MAP: MapConfig = {
  id: 'shibuya',
  name: 'ชิบูย่า (Shibuya Incident)',
  width: 3000,
  height: 1800,
  playerRadius: 18,
  moveSpeed: 255,
  pillars: [],
}

interface GameStoreState {
  authChecked: boolean
  authUser: UserProfile | null
  authLoading: boolean
  currentView: ScreenView
  previousView: ScreenView | null
  localDbReady: boolean
  characters: CharacterDef[]
  selectedCharId: string
  viewingCharId: string
  playerName: string
  roomInput: string
  pendingJoinRoom: RoomInfo | null
  recentRooms: RecentRoom[]
  selectedMode: GameMode
  selectedMapId: MapId
  joining: boolean
  checkingJoinRoom: boolean
  arenaReady: boolean
  assetsReady: boolean
  preloadProgress: number
  preloadStage: string
  connected: boolean
  activeRoomId: string
  shareUrl: string
  maxPlayers: number
  roomMode: GameMode
  roomMapId: MapId
  matchPhase: MatchPhase
  hostUserId: string
  targetKills: number
  blueKills: number
  redKills: number
  winnerTeam: TeamSide | ''
  matchElapsedSec: number
  myPlayerId: string
  myTeam: TeamSide
  myAlive: boolean
  myKills: number
  myDeaths: number
  myHp: number
  myMaxHp: number
  myInVoid: boolean
  myRespawnInMs: number
  killedBy: string
  lastDummyDamage: number
  totalDummyDamage: number
  saitamaOverlay: {
    visible: boolean
    targetId: string
    attackerName: string
    blocked: boolean
  } | null
  domainClashOverlay: {
    visible: boolean
    gojoName: string
    sukunaName: string
  } | null
  snapOverlay: {
    visible: boolean
    attackerName: string
    mode: GameMode
    instantWin: boolean
    killedCount: number
  } | null
  myCooldowns: number[]
  myInfinityStones: number[]
  mySnapCooldown: number
  myBasicCooldown: number
  myDashCooldown: number
  myRctCooldown: number
  roster: PlayerState[]
  mapCfg: MapConfig
  pingMs: number | null
  transportMode: TransportKind
  fps: number
  graphicsQuality: GraphicsQuality
  voiceMicEnabled: boolean
  voiceSpeakerEnabled: boolean
  voiceSpeaking: boolean
  peerVoiceStates: Record<string, PeerVoiceState>
  adminAiEnabled: boolean
  error: string

  bootstrap: () => Promise<void>
  setGraphicsQuality: (quality: GraphicsQuality) => void
  toggleAdminAi: (forceState?: boolean) => void
  toggleVoiceMic: () => Promise<void>
  toggleVoiceSpeaker: () => void
  setView: (view: ScreenView) => void
  goBack: () => void
  inspectCharacter: (id?: string) => void
  registerAccount: (username: string, password: string, displayName?: string) => Promise<boolean>
  loginAccount: (username: string, password: string) => Promise<boolean>
  logoutAccount: () => Promise<void>
  setSelectedCharId: (id: string) => void
  equipCharacter: (id: string) => Promise<void>
  setRoomInput: (roomId: string) => void
  setSelectedMode: (mode: GameMode) => void
  setSelectedMapId: (mapId: MapId) => void
  setError: (err: string) => void
  setFPS: (fps: number) => void
  setArenaReady: (ready: boolean) => void
  setAssetsReady: (ready: boolean) => void
  setPreloadStatus: (pct: number, stage: string) => void
  startPracticeMode: (charIdOverride?: string, mapOverride?: MapId) => Promise<void>
  createAndJoinRoom: (mode?: GameMode, mapId?: MapId) => Promise<void>
  prepareJoinRoom: (roomIdOverride?: string) => Promise<void>
  confirmPendingJoin: (charIdOverride?: string) => Promise<void>
  joinRoom: (roomIdOverride?: string, charIdOverride?: string, skipRoomCheck?: boolean) => Promise<void>
  leaveRoom: (targetView?: ScreenView) => void
  selectTeam: (team: 'blue' | 'red') => void
  selectRoomMap: (mapId: MapId) => void
  selectRoomCharacter: (characterId: string) => void
  switchPracticeCharacter: (characterId: string) => void
  resetPractice: () => void
  toggleReady: () => void
  startMatch: () => void
  returnToWaitingLobby: () => void
  sendMovementVector: (dx: number, dy: number, force?: boolean, worldSpace?: boolean) => void
  castSkill: (
    slot: 1 | 2 | 3 | 4 | 5,
    target?: {
      worldX: number
      worldY: number
      dirX?: number
      dirY?: number
      rangeFactor?: number
      targetId?: string
    },
  ) => void
  dismissSaitamaOverlay: () => void
  castBasicAttack: (target?: {
    worldX: number
    worldY: number
    dirX?: number
    dirY?: number
    rangeFactor?: number
  }) => void
  castDash: (target?: {
    worldX: number
    worldY: number
    dirX?: number
    dirY?: number
    rangeFactor?: number
  }) => void
  castRct: () => void
  castSnap: () => void
  sendRespawn: () => void
  sendEmote: (emote: string) => void
  setMouseAim: (worldX: number, worldY: number, active?: boolean) => void
}

let activeTransport: RealtimeTransport | null = null
let memSessionToken = getStoredSessionToken()
let seqCounter = 0
let lastInputVec = { dx: 0, dy: 0 }
let lastInputChangedAtMs = 0
let latestPlayers = new Map<string, PlayerState>()
const playersByNetId = new Map<number, PlayerState>()
let latestRecvTick = 0
let simoSnipeCharging = false

export function isSimoSnipeCharging(): boolean {
  return simoSnipeCharging
}

export function setSimoSnipeCharging(active: boolean): void {
  if (simoSnipeCharging === active) return
  simoSnipeCharging = active
  if (active) {
    useGameStore.getState().sendMovementVector(0, 0, true)
  }
}

export function getSimoLiveAimDirection(): { dirX: number; dirY: number } {
  const st = useGameStore.getState()
  const me = latestPlayers.get(st.myPlayerId)
  if (!me) return { dirX: 1, dirY: 0 }
  if (mouseWorld.active) {
    const dx = mouseWorld.x - me.x
    const dy = mouseWorld.y - me.y
    const d = Math.hypot(dx, dy)
    if (d > 4) return { dirX: dx / d, dirY: dy / d }
  }
  const isTeam = isTeamMatchMode(st.roomMode)
  let bestDist = Infinity
  let bestDir = { dirX: me.aimDx || 1, dirY: me.aimDy || 0 }
  for (const other of latestPlayers.values()) {
    if (other.id === st.myPlayerId || !other.alive) continue
    if (isTeam && me.team && other.team === me.team) continue
    const dx = other.x - me.x
    const dy = other.y - me.y
    const d = Math.hypot(dx, dy)
    if (d > 4 && d < bestDist) {
      bestDist = d
      bestDir = { dirX: dx / d, dirY: dy / d }
    }
  }
  return bestDir
}

export function getLocalMoveInput(): { dx: number; dy: number } {
  if (simoSnipeCharging) return { dx: 0, dy: 0 }
  return lastInputVec
}

export function getLocalMoveInputState(): { dx: number; dy: number; seq: number; changedAtMs: number } {
  return {
    dx: simoSnipeCharging ? 0 : lastInputVec.dx,
    dy: simoSnipeCharging ? 0 : lastInputVec.dy,
    seq: seqCounter,
    changedAtMs: lastInputChangedAtMs,
  }
}
let latestMatchMeta = {
  mode: 'ffa' as GameMode,
  phase: 'playing' as MatchPhase,
  hostUserId: '',
  targetKills: 0,
  blueKills: 0,
  redKills: 0,
  winnerTeam: '' as TeamSide | '',
  matchElapsedSec: 0,
}
let mouseWorld = { x: 1500, y: 900, active: false }
let iconicBasis = { fx: 1, fy: 0 }
let pingTimer: number | null = null
let uiSyncTimer: number | null = null
let saitamaTimer: number | null = null
let domainClashTimer: number | null = null
let snapOverlayTimer: number | null = null
let lastHudSig = ''
let lastSyncAtMs = 0
let lastDummyHPMap = new Map<string, number>()

export function setIconicCameraBasis(fx: number, fy: number): void {
  const m = Math.hypot(fx, fy)
  if (m > 0.001) {
    iconicBasis = { fx: fx / m, fy: fy / m }
  }
}

function rotateScreenVecToIconicWorld(dx: number, dy: number): { wx: number; wy: number } {
  // Screen UP (dy = -1) moves forward (+F) toward opponent; Right (dx = +1) strafes along right normal R = (-fy, fx).
  const forward = -dy
  const strafe = dx
  return {
    wx: forward * iconicBasis.fx - strafe * iconicBasis.fy,
    wy: forward * iconicBasis.fy + strafe * iconicBasis.fx,
  }
}

function sortRosterByKills(players: Iterable<PlayerState>): PlayerState[] {
  return Array.from(players).sort((a, b) => b.kills - a.kills || a.id.localeCompare(b.id))
}

export function isTeamMatchMode(mode: GameMode): boolean {
  return mode === 'iconic' || mode === 'duel_1v1' || mode === 'tdm_3v3'
}

export function hasWaitingLobby(mode: GameMode): boolean {
  return mode !== 'ffa'
}

export function getBasicAttackRange(characterId?: string): number {
  if (characterId === 'simo') return 480
  if (characterId === 'ben10') return 320
  if (characterId === 'pa' || characterId === 'ole' || characterId === 'default') return 300
  if (characterId === 'kaem') return 316
  if (characterId === 'diablo') return 265
  if (characterId === 'ajarn_au') return 240
  if (characterId === 'luffy') return 225
  if (characterId === 'ko' || characterId === 'jinwoo') return 195
  if (characterId === 'noone') return 190
  if (characterId === 'naruto' || characterId === 'sanji') return 185
  return 175
}

function computeLiveTimers(meNow: PlayerState | undefined, elapsedMs: number) {
  const dec = (ms: number | undefined) => Math.max(0, (ms ?? 0) - elapsedMs)
  return {
    cd0: meNow ? dec(meNow.cooldownsMs[0]) : 0,
    cd1: meNow ? dec(meNow.cooldownsMs[1]) : 0,
    cd2: meNow ? dec(meNow.cooldownsMs[2]) : 0,
    cd3: meNow ? dec(meNow.cooldownsMs[3]) : 0,
    cd4: meNow ? dec(meNow.cooldownsMs[4]) : 0,
    scd: meNow ? dec(meNow.snapCooldownMs) : 0,
    bcd: meNow ? dec(meNow.basicCooldownMs) : 0,
    dcd: meNow ? dec(meNow.dashCooldownMs) : 0,
    rcd: meNow ? dec(meNow.rctCooldownMs) : 0,
    rsp: meNow && !meNow.alive ? dec(meNow.respawnInMs) : 0,
  }
}

function computeHudSignature(meNow: PlayerState | undefined, elapsedMs: number): string {
  const parts: string[] = []
  for (const p of sortRosterByKills(latestPlayers.values())) {
    parts.push(
      `${p.id}:${p.team ?? 'ffa'}:${p.ready ? 1 : 0}:${p.isHost ? 1 : 0}:${p.alive ? 1 : 0}:${p.hp}:${p.kills}:${p.deaths ?? 0}:${p.characterId}`,
    )
  }
  const t = computeLiveTimers(meNow, elapsedMs)
  const cd0 = Math.ceil(t.cd0 / 100)
  const cd1 = Math.ceil(t.cd1 / 100)
  const cd2 = Math.ceil(t.cd2 / 100)
  const cd3 = Math.ceil(t.cd3 / 100)
  const cd4 = Math.ceil(t.cd4 / 100)
  const scd = Math.ceil(t.scd / 100)
  const bcd = Math.ceil(t.bcd / 100)
  const dcd = Math.ceil(t.dcd / 100)
  const rcd = Math.ceil(t.rcd / 100)
  const rsp = Math.ceil(t.rsp / 250)
  const stones = (meNow?.infinityStones ?? []).join(',')
  return `${latestMatchMeta.phase}:${latestMatchMeta.blueKills}:${latestMatchMeta.redKills}:${latestMatchMeta.winnerTeam}:${latestMatchMeta.matchElapsedSec}|${parts.join('|')}#${meNow?.alive ? 1 : 0}:${meNow?.inVoid ? 1 : 0}:${meNow?.killedBy ?? ''}:${stones}:${cd0},${cd1},${cd2},${cd3},${cd4},${scd},${bcd},${dcd},${rcd},${rsp}`
}

function clearTimers(): void {
  if (pingTimer !== null) {
    window.clearInterval(pingTimer)
    pingTimer = null
  }
  if (uiSyncTimer !== null) {
    window.clearInterval(uiSyncTimer)
    uiSyncTimer = null
  }
}

function closeSocketSafely(tr: RealtimeTransport | null): void {
  if (tr) tr.close()
}

const LOCAL_PORTRAITS: Record<string, { anilistId: number; imageUrl: string }> = {
  default: { anilistId: 0, imageUrl: '/app-icon.png?v=20261120v2' },
  pa: { anilistId: 2514, imageUrl: '/characters/pa.png' },
  boy: { anilistId: 246, imageUrl: '/characters/boy.png' },
  ole: { anilistId: 14, imageUrl: '/characters/ole.png' },
  thanwa: { anilistId: 62, imageUrl: '/characters/thanwa.png' },
  ajarn_au: { anilistId: 27, imageUrl: '/characters/ajarn_au.png' },
  ajarn_boy: { anilistId: 133701, imageUrl: '/characters/ajarn_boy.png' },
  kaem: { anilistId: 133702, imageUrl: '/characters/kaem.png' },
  frame: { anilistId: 2040, imageUrl: '/characters/frame.png' },
  luangphi_sorn: { anilistId: 3010, imageUrl: '/characters/luangphi_sorn.png' },
  sia_mon: { anilistId: 4044, imageUrl: '/characters/sia_mon.png' },
  ko: { anilistId: 129131, imageUrl: '/characters/ko.png' },
  noone: { anilistId: 0, imageUrl: '/characters/noone.png?v=mcu1' },
  simo: { anilistId: 146028, imageUrl: '/characters/simo.png' },
  jinwoo: { anilistId: 129928, imageUrl: '/characters/jinwoo.png' },
  naruto: { anilistId: 17, imageUrl: '/characters/naruto.png' },
  sanji: { anilistId: 305, imageUrl: '/characters/sanji.png' },
  luffy: { anilistId: 40, imageUrl: '/characters/luffy.png' },
  ben10: { anilistId: 0, imageUrl: '/characters/ben10.png' },
  diablo: { anilistId: 132541, imageUrl: '/characters/diablo.png' },
}

const DEFAULT_SKILL_META: Record<
  string,
  Array<{ castRange: number; aoeRadius: number; aimType: SkillAimType }>
> = {
  pa: [
    { castRange: 620, aoeRadius: 48, aimType: 'cone' },
    { castRange: 640, aoeRadius: 155, aimType: 'ground' },
    { castRange: 680, aoeRadius: 195, aimType: 'ground' },
  ],
  boy: [
    { castRange: 540, aoeRadius: 34, aimType: 'line' },
    { castRange: 380, aoeRadius: 105, aimType: 'line' },
    { castRange: 920, aoeRadius: 62, aimType: 'line' },
  ],
  ole: [
    { castRange: 440, aoeRadius: 40, aimType: 'line' },
    { castRange: 460, aoeRadius: 145, aimType: 'ground' },
    { castRange: 420, aoeRadius: 120, aimType: 'ground' },
  ],
  thanwa: [
    { castRange: 580, aoeRadius: 52, aimType: 'line' },
    { castRange: 310, aoeRadius: 50, aimType: 'ground' },
    { castRange: 195, aoeRadius: 195, aimType: 'self' },
  ],
  ajarn_au: [
    { castRange: 175, aoeRadius: 175, aimType: 'self' },
    { castRange: 85, aoeRadius: 85, aimType: 'self' },
    { castRange: 500, aoeRadius: 165, aimType: 'ground' },
  ],
  ajarn_boy: [
    { castRange: 640, aoeRadius: 44, aimType: 'line' },
    { castRange: 660, aoeRadius: 140, aimType: 'line' },
    { castRange: 270, aoeRadius: 270, aimType: 'self' },
  ],
  kaem: [
    { castRange: 560, aoeRadius: 110, aimType: 'ground' },
    { castRange: 540, aoeRadius: 56, aimType: 'line' },
    { castRange: 440, aoeRadius: 180, aimType: 'ground' },
  ],
  frame: [
    { castRange: 560, aoeRadius: 120, aimType: 'lockon' },
    { castRange: 320, aoeRadius: 140, aimType: 'line' },
    { castRange: 500, aoeRadius: 210, aimType: 'lockon' },
  ],
  luangphi_sorn: [{ castRange: 3600, aoeRadius: 160, aimType: 'target_pick' }],
  sia_mon: [
    { castRange: 880, aoeRadius: 95, aimType: 'line' },
    { castRange: 920, aoeRadius: 110, aimType: 'line' },
    { castRange: 265, aoeRadius: 265, aimType: 'self' },
  ],
  ko: [
    { castRange: 420, aoeRadius: 56, aimType: 'line' },
    { castRange: 540, aoeRadius: 95, aimType: 'ground' },
    { castRange: 235, aoeRadius: 235, aimType: 'self' },
  ],
  noone: [
    { castRange: 420, aoeRadius: 115, aimType: 'ground' },
    { castRange: 500, aoeRadius: 140, aimType: 'ground' },
    { castRange: 440, aoeRadius: 105, aimType: 'cone' },
    { castRange: 230, aoeRadius: 230, aimType: 'self' },
    { castRange: 640, aoeRadius: 56, aimType: 'line' },
  ],
  simo: [
    { castRange: 460, aoeRadius: 145, aimType: 'ground' },
    { castRange: 2800, aoeRadius: 44, aimType: 'line' },
    { castRange: 560, aoeRadius: 68, aimType: 'line' },
  ],
  jinwoo: [
    { castRange: 380, aoeRadius: 65, aimType: 'line' },
    { castRange: 440, aoeRadius: 150, aimType: 'ground' },
    { castRange: 260, aoeRadius: 260, aimType: 'self' },
  ],
  naruto: [
    { castRange: 360, aoeRadius: 72, aimType: 'line' },
    { castRange: 560, aoeRadius: 118, aimType: 'line' },
    { castRange: 210, aoeRadius: 210, aimType: 'self' },
  ],
  sanji: [
    { castRange: 360, aoeRadius: 78, aimType: 'line' },
    { castRange: 210, aoeRadius: 165, aimType: 'self' },
    { castRange: 440, aoeRadius: 96, aimType: 'line' },
  ],
  luffy: [
    { castRange: 470, aoeRadius: 56, aimType: 'line' },
    { castRange: 330, aoeRadius: 115, aimType: 'cone' },
    { castRange: 430, aoeRadius: 185, aimType: 'ground' },
  ],
  ben10: [
    { castRange: 560, aoeRadius: 105, aimType: 'line' },
    { castRange: 420, aoeRadius: 66, aimType: 'line' },
    { castRange: 860, aoeRadius: 68, aimType: 'line' },
  ],
  diablo: [
    { castRange: 540, aoeRadius: 54, aimType: 'cone' },
    { castRange: 450, aoeRadius: 155, aimType: 'ground' },
    { castRange: 480, aoeRadius: 180, aimType: 'ground' },
  ],
}

function applyPortraitDefaults(chars: CharacterDef[]): CharacterDef[] {
  return chars.map((ch) => {
    const def = LOCAL_PORTRAITS[ch.id]
    const metaList = DEFAULT_SKILL_META[ch.id] ?? []
    const skills = ch.skills.map((sk, idx) => {
      const m = metaList[idx]
      return {
        ...sk,
        iconUrl:
          ch.id === 'ajarn_au' && sk.slot === 1
            ? '/skills/ajarn_au_1.png?v=leap2'
            : sk.iconUrl || `/skills/${ch.id}_${sk.slot}.png`,
        castRange: sk.castRange && sk.castRange > 0 ? sk.castRange : (m?.castRange ?? 360),
        aoeRadius: sk.aoeRadius && sk.aoeRadius > 0 ? sk.aoeRadius : (m?.aoeRadius ?? 64),
        aimType: sk.aimType || m?.aimType || 'line',
      }
    })
    if (!def) return { ...ch, skills }
    return {
      ...ch,
      anilistId: ch.anilistId || def.anilistId,
      imageUrl: def.imageUrl,
      voiceLine:
        ch.voiceLine && !ch.voiceLine.includes('กันมุรุ')
          ? ch.voiceLine
          : CHARACTER_VOICES[ch.id]?.quote,
      skills,
    }
  })
}

function resolveAimCoords(
  me: PlayerState,
  myPlayerId: string,
  target: { worldX: number; worldY: number; dirX?: number; dirY?: number; rangeFactor?: number } | undefined,
  preferMovement: boolean,
  castRange: number,
  isTeamMode: boolean,
): { tx: number; ty: number } {
  if (target?.dirX !== undefined && target?.dirY !== undefined) {
    const dist = Math.max(0, Math.min(1, target.rangeFactor ?? 1)) * castRange
    return { tx: me.x + target.dirX * dist, ty: me.y + target.dirY * dist }
  }
  if (target) {
    const dx = target.worldX - me.x
    const dy = target.worldY - me.y
    const d = Math.hypot(dx, dy)
    if (d > castRange && d > 1) {
      return { tx: me.x + (dx / d) * castRange, ty: me.y + (dy / d) * castRange }
    }
    return { tx: target.worldX, ty: target.worldY }
  }
  if (preferMovement && (lastInputVec.dx !== 0 || lastInputVec.dy !== 0)) {
    return { tx: me.x + lastInputVec.dx * castRange, ty: me.y + lastInputVec.dy * castRange }
  }
  if (mouseWorld.active) {
    const dx = mouseWorld.x - me.x
    const dy = mouseWorld.y - me.y
    const d = Math.hypot(dx, dy)
    if (d > castRange && d > 1) {
      return { tx: me.x + (dx / d) * castRange, ty: me.y + (dy / d) * castRange }
    }
    return { tx: mouseWorld.x, ty: mouseWorld.y }
  }
  let tx = me.x + (me.aimDx || 1) * Math.min(castRange, 280)
  let ty = me.y + (me.aimDy || 0) * Math.min(castRange, 280)
  let bestDist = Math.max(castRange + 40, 260)
  for (const other of latestPlayers.values()) {
    if (other.id === myPlayerId || !other.alive) continue
    if (isTeamMode && me.team && other.team === me.team) continue
    const d = Math.hypot(other.x - me.x, other.y - me.y)
    if (d < bestDist) {
      bestDist = d
      tx = other.x
      ty = other.y
    }
  }
  return { tx, ty }
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  authChecked: false,
  authUser: null,
  authLoading: false,
  currentView: 'auth',
  previousView: null,
  localDbReady: false,
  characters: [],
  selectedCharId: 'pa',
  viewingCharId: 'pa',
  playerName: '',
  roomInput: getInitialRoomFromURL(),
  pendingJoinRoom: null,
  recentRooms: [],
  selectedMode: 'ffa',
  selectedMapId: 'shibuya',
  joining: false,
  checkingJoinRoom: false,
  arenaReady: false,
  assetsReady: false,
  preloadProgress: 0,
  preloadStage: '',
  connected: false,
  activeRoomId: '',
  shareUrl: '',
  maxPlayers: 5,
  roomMode: 'ffa',
  roomMapId: 'shibuya',
  matchPhase: 'playing',
  hostUserId: '',
  targetKills: 0,
  blueKills: 0,
  redKills: 0,
  winnerTeam: '',
  matchElapsedSec: 0,
  myPlayerId: '',
  myTeam: 'ffa',
  myAlive: true,
  myKills: 0,
  myDeaths: 0,
  myHp: 225,
  myMaxHp: 225,
  myInVoid: false,
  myRespawnInMs: 0,
  killedBy: '',
  lastDummyDamage: 0,
  totalDummyDamage: 0,
  saitamaOverlay: null,
  domainClashOverlay: null,
  snapOverlay: null,
  myCooldowns: [0, 0, 0, 0, 0],
  myInfinityStones: [],
  mySnapCooldown: 0,
  myBasicCooldown: 0,
  myDashCooldown: 0,
  myRctCooldown: 0,
  roster: [],
  mapCfg: DEFAULT_MAP,
  pingMs: null,
  transportMode: 'ws-binary',
  fps: 60,
  graphicsQuality: getInitialGraphicsQuality(),
  voiceMicEnabled: false,
  voiceSpeakerEnabled: voiceChatEngine.isSpeakerEnabled(),
  voiceSpeaking: false,
  peerVoiceStates: {},
  adminAiEnabled: false,
  error: '',

  bootstrap: async () => {
    if (typeof Image !== 'undefined') {
      for (const src of ['/fx/saitama_dead.jpg', '/fx/iconic_domain_clash.jpg', '/skills/iconic_rct.png']) {
        const preloadImg = new Image()
        preloadImg.src = src
      }
    }
    const ok = await initLocalSQLite()
    if (ok) {
      const prefs = loadPreferences()
      const cachedChars = applyPortraitDefaults(getCachedCharacters())
      const recents = getRecentRooms(4)
      let hasExplicitLsGfx = false
      try {
        hasExplicitLsGfx =
          window.localStorage.getItem(GFX_QUALITY_STORAGE_KEY) !== null ||
          window.localStorage.getItem(LEGACY_PIXEL_STORAGE_KEY) !== null
      } catch {
        hasExplicitLsGfx = false
      }
      set((state) => ({
        localDbReady: true,
        playerName: prefs.playerName || state.playerName,
        selectedCharId: prefs.characterId || state.selectedCharId,
        graphicsQuality: hasExplicitLsGfx ? state.graphicsQuality : prefs.graphicsQuality,
        characters: cachedChars.length > 0 ? cachedChars : state.characters,
        recentRooms: recents,
      }))
    }

    try {
      const data = await apiClient.fetchCharacters()
      if (data.characters && data.characters.length > 0) {
        const merged = applyPortraitDefaults(data.characters)
        set({ characters: merged })
        await cacheCharacters(merged)
      }
    } catch {
      if (get().characters.length === 0) {
        set({ error: 'ไม่สามารถโหลดข้อมูลตัวละครจากเซิร์ฟเวอร์ได้' })
      }
    }

    try {
      const meRes = await apiClient.fetchCurrentUser()
      memSessionToken = meRes.token || getStoredSessionToken()
      if (memSessionToken) saveStoredSessionToken(memSessionToken)
      const u = meRes.user
      void savePreference('playerName', u.displayName)
      void savePreference('characterId', u.selectedCharacterId || 'pa')
      set({
        authChecked: true,
        authUser: u,
        playerName: u.displayName,
        selectedCharId: u.selectedCharacterId || 'pa',
        currentView: 'home',
      })
      void prefetchTransportInfo()
      // Refresh role-aware character list (unlocks Admin heroes immediately on reload)
      if (u.role === 'admin') {
        void apiClient
          .fetchCharacters()
          .then((d) => {
            if (d.characters?.length) {
              const merged = applyPortraitDefaults(d.characters)
              set({ characters: merged })
              void cacheCharacters(merged)
            }
          })
          .catch(() => undefined)
      }
    } catch (err) {
      const status = (err as { status?: number } | null)?.status
      if (status === 401) {
        memSessionToken = ''
        clearStoredSessionToken()
      }
      set({
        authChecked: true,
        authUser: null,
        currentView: 'auth',
      })
    }
  },

  toggleAdminAi: (forceState) => {
    const { authUser, adminAiEnabled } = get()
    if (authUser?.role !== 'admin') {
      if (adminAiEnabled) set({ adminAiEnabled: false })
      return
    }
    const next = typeof forceState === 'boolean' ? forceState : !adminAiEnabled
    set({ adminAiEnabled: next })
  },

  setView: (view) =>
    set((state) => ({
      previousView: state.currentView !== view ? state.currentView : state.previousView,
      currentView: view,
      error: '',
    })),

  goBack: () => {
    const { currentView, previousView, authUser, leaveRoom } = get()
    if (currentView === 'room_lobby') {
      leaveRoom(previousView === 'battle_setup' ? 'battle_setup' : 'home')
      return
    }
    if (currentView === 'arena') {
      leaveRoom('home')
      return
    }
    if (currentView === 'join_select') {
      set({
        previousView: 'join_select',
        currentView: 'home',
        pendingJoinRoom: null,
        error: '',
      })
      return
    }
    if (currentView === 'battle_setup') {
      set({
        previousView: 'battle_setup',
        currentView: previousView === 'heroes' ? 'heroes' : 'home',
        error: '',
      })
      return
    }
    if (currentView === 'heroes') {
      set({
        previousView: 'heroes',
        currentView: previousView === 'battle_setup' ? 'battle_setup' : 'home',
        error: '',
      })
      return
    }
    if (currentView === 'home') {
      set({ previousView: 'home', currentView: 'auth', error: '' })
      return
    }
    if (currentView === 'auth' && authUser) {
      set({ previousView: 'auth', currentView: 'home', error: '' })
    }
  },

  inspectCharacter: (id) =>
    set((state) => ({
      viewingCharId: id || state.viewingCharId || state.characters[0]?.id || 'pa',
      previousView: state.currentView !== 'heroes' ? state.currentView : state.previousView,
      currentView: 'heroes',
      error: '',
    })),

  registerAccount: async (username, password, displayName) => {
    soundEngine.unlock()
    set({ authLoading: true, error: '' })
    try {
      const res = await apiClient.register({ username, password, displayName })
      memSessionToken = res.token ?? ''
      if (memSessionToken) saveStoredSessionToken(memSessionToken)
      const u = res.user
      void savePreference('playerName', u.displayName)
      void savePreference('characterId', u.selectedCharacterId || 'pa')
      set({
        authLoading: false,
        authUser: u,
        playerName: u.displayName,
        selectedCharId: u.selectedCharacterId || 'pa',
        currentView: 'home',
      })
      void apiClient
        .fetchCharacters()
        .then((d) => {
          if (d.characters?.length) {
            const merged = applyPortraitDefaults(d.characters)
            set({ characters: merged })
            void cacheCharacters(merged)
          }
        })
        .catch(() => undefined)
      return true
    } catch (err) {
      set({
        authLoading: false,
        error: err instanceof Error ? err.message : 'สมัครสมาชิกไม่สำเร็จ',
      })
      return false
    }
  },

  loginAccount: async (username, password) => {
    soundEngine.unlock()
    set({ authLoading: true, error: '' })
    try {
      const res = await apiClient.login({ username, password })
      memSessionToken = res.token ?? ''
      if (memSessionToken) saveStoredSessionToken(memSessionToken)
      const u = res.user
      void savePreference('playerName', u.displayName)
      void savePreference('characterId', u.selectedCharacterId || 'pa')
      set({
        authLoading: false,
        authUser: u,
        playerName: u.displayName,
        selectedCharId: u.selectedCharacterId || 'pa',
        currentView: 'home',
      })
      void apiClient
        .fetchCharacters()
        .then((d) => {
          if (d.characters?.length) {
            const merged = applyPortraitDefaults(d.characters)
            set({ characters: merged })
            void cacheCharacters(merged)
          }
        })
        .catch(() => undefined)
      return true
    } catch (err) {
      set({
        authLoading: false,
        error: err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ',
      })
      return false
    }
  },

  logoutAccount: async () => {
    memSessionToken = ''
    get().leaveRoom()
    try {
      await apiClient.logout()
    } catch {
      // Clear client auth state regardless of transient network errors
    }
    clearStoredSessionToken()
    window.history.replaceState(null, '', '/')
    const resetHero = get().selectedCharId === 'luangphi_sorn' ? 'pa' : get().selectedCharId
    set({
      authUser: null,
      currentView: 'auth',
      selectedCharId: resetHero,
      characters: get().characters.filter((c) => !c.adminOnly),
      roomInput: '',
      pendingJoinRoom: null,
      error: '',
    })
  },

  setSelectedCharId: (id) => {
    set({ selectedCharId: id })
    void savePreference('characterId', id)
  },

  equipCharacter: async (id) => {
    set({ selectedCharId: id })
    void savePreference('characterId', id)
    const { authUser } = get()
    if (!authUser) return
    try {
      const res = await apiClient.equipCharacter(id)
      set({ authUser: res.user, selectedCharId: res.user.selectedCharacterId })
    } catch {
      // Retain local choice gracefully if offline
    }
  },

  setRoomInput: (roomId) => set({ roomInput: roomId }),
  setSelectedMode: (mode) => set({ selectedMode: mode }),
  setSelectedMapId: (mapId) => set({ selectedMapId: mapId }),
  setError: (err) => set({ error: err }),
  setFPS: (fps) => {
    if (get().fps !== fps) set({ fps })
  },
  setGraphicsQuality: (quality) => {
    const clean = normalizeGraphicsQuality(quality)
    try {
      window.localStorage.setItem(GFX_QUALITY_STORAGE_KEY, clean)
    } catch {
      // Ignore storage write errors
    }
    void savePreference('graphicsQuality', clean)
    set({ graphicsQuality: clean })
  },
  toggleVoiceMic: async () => {
    soundEngine.unlock()
    await voiceChatEngine.toggleMic()
    set({
      voiceMicEnabled: voiceChatEngine.isMicEnabled(),
      voiceSpeaking: voiceChatEngine.isSpeaking(),
    })
  },
  toggleVoiceSpeaker: () => {
    soundEngine.unlock()
    const enabled = voiceChatEngine.toggleSpeaker()
    set({ voiceSpeakerEnabled: enabled })
  },
  setArenaReady: (ready) => set({ arenaReady: ready }),
  setAssetsReady: (ready) => set({ assetsReady: ready }),
  setPreloadStatus: (pct, stage) => set({ preloadProgress: pct, preloadStage: stage }),
  setMouseAim: (worldX, worldY, active = true) => {
    mouseWorld = active ? { x: worldX, y: worldY, active: true } : { ...mouseWorld, active: false }
  },

  startPracticeMode: async (charIdOverride, mapOverride) => {
    soundEngine.unlock()
    const { authUser, selectedMapId, selectedCharId, joinRoom } = get()
    if (!authUser) {
      set({ currentView: 'auth', error: 'กรุณาเข้าสู่ระบบก่อนเริ่มโหมดฝึกซ้อม' })
      return
    }
    const heroId = charIdOverride || selectedCharId || 'pa'
    const mapId = mapOverride ?? selectedMapId
    set({
      error: '',
      joining: true,
      arenaReady: false,
      selectedMode: 'practice',
      selectedMapId: mapId,
      selectedCharId: heroId,
      lastDummyDamage: 0,
      totalDummyDamage: 0,
    })
    try {
      const info = await apiClient.createRoom({ mode: 'practice', mapId })
      window.history.replaceState(null, '', `/?room=${info.roomId}`)
      set({ roomInput: info.roomId })
      await joinRoom(info.roomId, heroId, true)
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'เปิดโหมดทดสอบไม่สำเร็จ',
        joining: false,
      })
    }
  },

  createAndJoinRoom: async (modeOverride, mapOverride) => {
    soundEngine.unlock()
    const { authUser, selectedMode, selectedMapId, joinRoom } = get()
    if (!authUser) {
      set({ currentView: 'auth', error: 'กรุณาเข้าสู่ระบบก่อนสร้างห้อง' })
      return
    }
    const mode = modeOverride ?? selectedMode
    const mapId = mapOverride ?? selectedMapId
    set({ error: '', joining: true, arenaReady: false, selectedMode: mode, selectedMapId: mapId })
    try {
      const info = await apiClient.createRoom({ mode, mapId })
      window.history.replaceState(null, '', `/?room=${info.roomId}`)
      set({ roomInput: info.roomId })
      await joinRoom(info.roomId, undefined, true)
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'สร้างห้องไม่สำเร็จ',
        joining: false,
      })
    }
  },

  prepareJoinRoom: async (roomIdOverride) => {
    soundEngine.unlock()
    const { authUser, roomInput, joinRoom } = get()
    if (!authUser) {
      set({ currentView: 'auth', error: 'กรุณาเข้าสู่ระบบก่อนเข้าร่วมห้อง' })
      return
    }
    const targetRoomId = (roomIdOverride ?? roomInput).trim()
    set({ error: '' })
    if (!/^\d{6}$/.test(targetRoomId)) {
      set({ error: 'กรุณากรอกรหัสห้องเป็นตัวเลข 6 หลัก (เช่น 482915)', joining: false })
      return
    }

    set({ checkingJoinRoom: true })
    try {
      const [info] = await Promise.all([apiClient.getRoomInfo(targetRoomId), prefetchTransportInfo()])
      if (info.isFull) {
        set({
          checkingJoinRoom: false,
          error: `ห้องหมายเลข #${targetRoomId} เต็มแล้ว (${info.currentPlayers}/${info.maxPlayers} คน)`,
        })
        return
      }
      if (info.mode !== 'ffa' && info.phase !== 'waiting') {
        set({
          checkingJoinRoom: false,
          error: `ห้องหมายเลข #${targetRoomId} เริ่มเกมไปแล้ว ไม่สามารถเข้าร่วมระหว่างแข่งได้`,
        })
        return
      }
      if (info.mode === 'iconic') {
        // ICONIC mode auto-randomizes Gojo vs Sukuna inside the waiting lobby
        set({ checkingJoinRoom: false })
        await joinRoom(info.roomId, undefined, true)
        return
      }
      set({
        checkingJoinRoom: false,
        pendingJoinRoom: info,
        roomInput: info.roomId,
        previousView: get().currentView,
        currentView: 'join_select',
        error: '',
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'ไม่พบห้องหมายเลขนี้',
        checkingJoinRoom: false,
      })
    }
  },

  confirmPendingJoin: async (charIdOverride) => {
    soundEngine.unlock()
    const { pendingJoinRoom, selectedCharId, equipCharacter, joinRoom } = get()
    if (!pendingJoinRoom) {
      set({ currentView: 'home', error: 'ไม่พบข้อมูลห้องที่ต้องการเข้าร่วม' })
      return
    }
    const heroId = charIdOverride || selectedCharId || 'pa'
    void equipCharacter(heroId)
    const targetId = pendingJoinRoom.roomId
    set({ pendingJoinRoom: null })
    await joinRoom(targetId, heroId, true)
  },

  joinRoom: async (roomIdOverride, charIdOverride, skipRoomCheck = false) => {
    soundEngine.unlock()
    const { authUser, roomInput, selectedCharId } = get()
    if (!authUser) {
      set({ currentView: 'auth', error: 'กรุณาเข้าสู่ระบบก่อนเข้าร่วมห้อง' })
      return
    }
    const targetRoomId = (roomIdOverride ?? roomInput).trim()
    const heroToUse = charIdOverride || selectedCharId
    set({ error: '' })
    if (!/^\d{6}$/.test(targetRoomId)) {
      set({ error: 'กรุณากรอกรหัสห้องเป็นตัวเลข 6 หลัก (เช่น 482915)', joining: false })
      return
    }

    set({ joining: true, arenaReady: false })
    if (!skipRoomCheck) {
      try {
        await Promise.all([apiClient.getRoomInfo(targetRoomId), prefetchTransportInfo()])
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'ไม่พบห้องหมายเลขนี้',
          joining: false,
        })
        return
      }
    } else {
      void prefetchTransportInfo()
    }

    // Detach any prior transport cleanly before opening a new one.
    closeSocketSafely(activeTransport)
    activeTransport = null
    clearTimers()
    latestPlayers.clear()
    playersByNetId.clear()
    latestRecvTick = 0
    lastDummyHPMap.clear()
    lastHudSig = ''
    lastInputVec = { dx: 0, dy: 0 }
    mouseWorld.active = false
    seqCounter = 0
    gameEventBus.clearInit()

    const querySuffix = `roomId=${encodeURIComponent(targetRoomId)}&characterId=${encodeURIComponent(heroToUse)}`
    const wsUrlBase = `${getWSBase()}/ws?${querySuffix}`
    const wtQuery = memSessionToken ? `${querySuffix}&token=${encodeURIComponent(memSessionToken)}` : querySuffix

    const applyWorldTick = (payload: {
      players: PlayerState[]
      projectiles?: Projectile[]
      beams?: BeamEffect[]
      zones?: ZoneEffect[]
      mode?: GameMode
      phase?: MatchPhase
      hostUserId?: string
      targetKills?: number
      blueKills?: number
      redKills?: number
      winnerTeam?: TeamSide | ''
      matchElapsedSec?: number
      map?: MapConfig
      mapId?: MapId
    }) => {
      lastSyncAtMs = performance.now()
      const nextMap = new Map<string, PlayerState>()
      let hitDmg = 0
      for (const raw of payload.players) {
        const pState: PlayerState = {
          ...raw,
          alive: raw.alive !== false,
          hp: raw.hp ?? 220,
          maxHp: raw.maxHp ?? 220,
          kills: raw.kills ?? 0,
          deaths: raw.deaths ?? 0,
          cooldownsMs: raw.cooldownsMs ?? [0, 0, 0, 0, 0],
        }
        if (typeof pState.netId === 'number' && pState.netId > 0) {
          playersByNetId.set(pState.netId, pState)
        }
        if (pState.isDummy) {
          const prevHp = lastDummyHPMap.get(pState.id)
          if (prevHp !== undefined && pState.hp < prevHp) {
            hitDmg += prevHp - pState.hp
          }
          lastDummyHPMap.set(pState.id, pState.hp)
        }
        nextMap.set(pState.id, pState)
      }
      if (hitDmg > 0) {
        set((prev) => ({
          lastDummyDamage: hitDmg,
          totalDummyDamage: prev.totalDummyDamage + hitDmg,
        }))
      }
      const myId = get().myPlayerId
      const prevMe = latestPlayers.get(myId)
      latestPlayers = nextMap
      const meNext = nextMap.get(myId)
      const prevPhase = latestMatchMeta.phase
      latestMatchMeta = {
        mode: payload.mode ?? latestMatchMeta.mode,
        phase: payload.phase ?? latestMatchMeta.phase,
        hostUserId: payload.hostUserId ?? latestMatchMeta.hostUserId,
        targetKills: payload.targetKills ?? latestMatchMeta.targetKills,
        blueKills: payload.blueKills ?? latestMatchMeta.blueKills,
        redKills: payload.redKills ?? latestMatchMeta.redKills,
        winnerTeam: payload.winnerTeam !== undefined ? payload.winnerTeam : latestMatchMeta.winnerTeam,
        matchElapsedSec: payload.matchElapsedSec ?? latestMatchMeta.matchElapsedSec,
      }

      if (payload.map) {
        gameEventBus.emitInit({
          myPlayerId: myId,
          mapCfg: payload.map,
          players: Array.from(nextMap.values()),
          projectiles: payload.projectiles ?? [],
          beams: payload.beams ?? [],
          zones: payload.zones ?? [],
        })
        set({ mapCfg: payload.map, roomMapId: payload.mapId || payload.map.id || get().roomMapId })
      } else if (payload.mapId && payload.mapId !== get().roomMapId) {
        set({ roomMapId: payload.mapId })
      }

      if ((prevMe?.alive ?? true) !== (meNext?.alive ?? true) && meNext) {
        const live = computeLiveTimers(meNext, 0)
        lastHudSig = computeHudSignature(meNext, 0)
        set({
          roster: sortRosterByKills(nextMap.values()),
          myAlive: meNext.alive,
          myHp: meNext.hp,
          myMaxHp: meNext.maxHp,
          myRespawnInMs: live.rsp,
          killedBy: meNext.killedBy ?? '',
          myKills: meNext.kills,
          myDeaths: meNext.deaths ?? 0,
        })
      }

      if (prevPhase !== latestMatchMeta.phase) {
        if (latestMatchMeta.phase === 'playing') {
          const liveStart = computeLiveTimers(meNext, 0)
          lastHudSig = computeHudSignature(meNext, 0)
          set({
            currentView: 'arena',
            arenaReady: false,
            assetsReady: false,
            preloadProgress: 5,
            preloadStage: 'กำลังเตรียมแผนที่และตัวละครในแมตช์...',
            matchPhase: 'playing',
            winnerTeam: '',
            blueKills: latestMatchMeta.blueKills,
            redKills: latestMatchMeta.redKills,
            matchElapsedSec: latestMatchMeta.matchElapsedSec,
            roster: sortRosterByKills(nextMap.values()),
            myTeam: meNext?.team ?? 'ffa',
            myAlive: meNext ? meNext.alive : true,
            myHp: meNext?.hp ?? 220,
            myMaxHp: meNext?.maxHp ?? 220,
            myKills: meNext?.kills ?? 0,
            myDeaths: meNext?.deaths ?? 0,
            myInVoid: false,
            myRespawnInMs: 0,
            killedBy: '',
            saitamaOverlay: null,
            domainClashOverlay: null,
            snapOverlay: null,
            myCooldowns: [liveStart.cd0, liveStart.cd1, liveStart.cd2, liveStart.cd3, liveStart.cd4],
            myInfinityStones: meNext?.infinityStones ?? [],
            mySnapCooldown: liveStart.scd,
            myBasicCooldown: liveStart.bcd,
            myDashCooldown: liveStart.dcd,
            myRctCooldown: liveStart.rcd,
          })
        } else if (latestMatchMeta.phase === 'waiting') {
          set({
            currentView: 'room_lobby',
            matchPhase: 'waiting',
            winnerTeam: '',
            saitamaOverlay: null,
            domainClashOverlay: null,
          })
        } else if (latestMatchMeta.phase === 'finished') {
          set({
            matchPhase: 'finished',
            winnerTeam: latestMatchMeta.winnerTeam,
            blueKills: latestMatchMeta.blueKills,
            redKills: latestMatchMeta.redKills,
          })
        }
      } else if (latestMatchMeta.phase === 'finished' && payload.winnerTeam && get().winnerTeam !== payload.winnerTeam) {
        set({
          winnerTeam: payload.winnerTeam,
          blueKills: latestMatchMeta.blueKills,
          redKills: latestMatchMeta.redKills,
        })
      }

      gameEventBus.emitSync({
        players: Array.from(nextMap.values()),
        projectiles: payload.projectiles ?? [],
        beams: payload.beams ?? [],
        zones: payload.zones ?? [],
      })
    }

    const transport = new RealtimeTransport({
      onOpen: (kind) => {
        if (activeTransport !== transport) return
        const currentShareUrl = `${window.location.origin}/?room=${targetRoomId}`
        window.history.replaceState(null, '', `/?room=${targetRoomId}`)
        set({
          activeRoomId: targetRoomId,
          shareUrl: currentShareUrl,
          transportMode: kind,
        })
        void recordRecentRoom(targetRoomId).then(() => {
          set({ recentRooms: getRecentRooms(4) })
        })
      },
      onBinary: (bytes) => {
        if (activeTransport !== transport || bytes.length === 0) return
        if (bytes[0] === BIN_SERVER_STATE) {
          const decoded = decodeBinaryState(bytes, playersByNetId)
          if (!decoded) return
          if (decoded.tick > 0 && decoded.tick < latestRecvTick) return
          latestRecvTick = decoded.tick
          applyWorldTick({
            players: decoded.players,
            projectiles: decoded.projectiles,
            beams: decoded.beams,
            zones: decoded.zones,
            phase: decoded.phase,
            blueKills: decoded.blueKills,
            redKills: decoded.redKills,
            matchElapsedSec: decoded.matchElapsedSec,
          })
        } else if (bytes[0] === BIN_SERVER_PONG) {
          const ts = decodeBinaryPong(bytes)
          if (ts !== null) {
            set({ pingMs: Math.max(1, Date.now() - ts) })
          }
        }
      },
      onText: (rawText) => {
        if (activeTransport !== transport) return
        const msg = JSON.parse(rawText) as ServerMessage
        if (msg.type === 'welcome') {
          latestPlayers.clear()
          playersByNetId.clear()
          latestRecvTick = 0
          for (const raw of msg.players) {
            const normalized: PlayerState = {
              ...raw,
              alive: raw.alive !== false,
              hp: raw.hp ?? 220,
              maxHp: raw.maxHp ?? 220,
              kills: raw.kills ?? 0,
              deaths: raw.deaths ?? 0,
              cooldownsMs: raw.cooldownsMs ?? [0, 0, 0, 0, 0],
            }
            latestPlayers.set(normalized.id, normalized)
            if (typeof normalized.netId === 'number' && normalized.netId > 0) {
              playersByNetId.set(normalized.netId, normalized)
            }
          }
          latestMatchMeta = {
            mode: msg.mode || 'ffa',
            phase: msg.phase || 'playing',
            hostUserId: msg.hostUserId || '',
            targetKills: msg.targetKills ?? 0,
            blueKills: msg.blueKills ?? 0,
            redKills: msg.redKills ?? 0,
            winnerTeam: msg.winnerTeam || '',
            matchElapsedSec: msg.matchElapsedSec ?? 0,
          }

          const existingChars = get().characters
          const mergedChars = msg.characters?.length
            ? applyPortraitDefaults(msg.characters)
            : existingChars

          const me = latestPlayers.get(msg.playerId)
          const nextView: ScreenView =
            hasWaitingLobby(latestMatchMeta.mode) && latestMatchMeta.phase === 'waiting'
              ? 'room_lobby'
              : 'arena'

          set({
            joining: false,
            connected: true,
            currentView: nextView,
            arenaReady: nextView === 'room_lobby',
            assetsReady: nextView === 'room_lobby',
            preloadProgress: nextView === 'room_lobby' ? 0 : 8,
            preloadStage: nextView === 'room_lobby' ? '' : 'กำลังตรวจสอบทรัพยากรในแมตช์...',
            myPlayerId: msg.playerId,
            maxPlayers: msg.maxPlayers,
            roomMode: latestMatchMeta.mode,
            roomMapId: msg.map?.id || msg.mapId || 'shibuya',
            matchPhase: latestMatchMeta.phase,
            hostUserId: latestMatchMeta.hostUserId,
            targetKills: latestMatchMeta.targetKills,
            blueKills: latestMatchMeta.blueKills,
            redKills: latestMatchMeta.redKills,
            winnerTeam: latestMatchMeta.winnerTeam,
            matchElapsedSec: latestMatchMeta.matchElapsedSec,
            mapCfg: msg.map,
            characters: mergedChars,
            roster: sortRosterByKills(latestPlayers.values()),
            myTeam: me?.team ?? 'ffa',
            myAlive: me ? me.alive : true,
            myKills: me?.kills ?? 0,
            myDeaths: me?.deaths ?? 0,
            myHp: me?.hp ?? 220,
            myMaxHp: me?.maxHp ?? 220,
            myInVoid: Boolean(me?.inVoid),
            myRespawnInMs: me?.respawnInMs ?? 0,
            killedBy: me?.killedBy ?? '',
            saitamaOverlay: null,
            domainClashOverlay: null,
            snapOverlay: null,
            myCooldowns: me?.cooldownsMs ?? [0, 0, 0, 0, 0],
            myInfinityStones: me?.infinityStones ?? [],
            mySnapCooldown: me?.snapCooldownMs ?? 0,
            myBasicCooldown: me?.basicCooldownMs ?? 0,
            myDashCooldown: me?.dashCooldownMs ?? 0,
            myRctCooldown: me?.rctCooldownMs ?? 0,
          })

          gameEventBus.emitInit({
            myPlayerId: msg.playerId,
            mapCfg: msg.map,
            players: Array.from(latestPlayers.values()),
            projectiles: msg.projectiles ?? [],
            beams: msg.beams ?? [],
            zones: msg.zones ?? [],
          })

          voiceChatEngine.initRoomSession(
            msg.playerId,
            Array.from(latestPlayers.values())
              .filter((p) => !p.isDummy)
              .map((p) => p.id),
            (sig) => {
              if (activeTransport === transport && transport.isOpen()) {
                transport.sendReliableJson(sig)
              }
            },
            () => {
              set({
                voiceMicEnabled: voiceChatEngine.isMicEnabled(),
                voiceSpeakerEnabled: voiceChatEngine.isSpeakerEnabled(),
                voiceSpeaking: voiceChatEngine.isSpeaking(),
                peerVoiceStates: voiceChatEngine.getPeerStatesSnapshot(),
              })
            },
            (errMsg) => {
              set({ error: errMsg })
            },
          )

          lastSyncAtMs = performance.now()
          lastDummyHPMap.clear()
          for (const p of latestPlayers.values()) {
            if (p.isDummy) lastDummyHPMap.set(p.id, p.hp)
          }
          lastHudSig = computeHudSignature(me, 0)
          clearTimers()
          pingTimer = window.setInterval(() => {
            if (activeTransport === transport && transport.isOpen()) {
              if (transport.supportsBinary()) {
                transport.sendUnreliableBinary(encodeBinaryPing(Date.now()))
              } else {
                transport.sendReliableJson({ type: 'ping', ts: Date.now() })
              }
            }
          }, 1000)
          uiSyncTimer = window.setInterval(() => {
            if (activeTransport !== transport) return
            const meNow = latestPlayers.get(get().myPlayerId)
            const elapsed = Math.max(0, performance.now() - lastSyncAtMs)
            const sig = computeHudSignature(meNow, elapsed)
            if (sig === lastHudSig) return
            lastHudSig = sig
            const live = computeLiveTimers(meNow, elapsed)
            set({
              roster: sortRosterByKills(latestPlayers.values()),
              matchPhase: latestMatchMeta.phase,
              hostUserId: latestMatchMeta.hostUserId,
              blueKills: latestMatchMeta.blueKills,
              redKills: latestMatchMeta.redKills,
              winnerTeam: latestMatchMeta.winnerTeam,
              matchElapsedSec: latestMatchMeta.matchElapsedSec,
              myTeam: meNow?.team ?? 'ffa',
              myAlive: meNow ? meNow.alive : true,
              myKills: meNow?.kills ?? 0,
              myDeaths: meNow?.deaths ?? 0,
              myHp: meNow?.hp ?? 0,
              myMaxHp: meNow?.maxHp ?? 220,
              myInVoid: Boolean(meNow?.inVoid),
              myRespawnInMs: live.rsp,
              killedBy: meNow?.killedBy ?? '',
              myCooldowns: [live.cd0, live.cd1, live.cd2, live.cd3, live.cd4],
              myInfinityStones: meNow?.infinityStones ?? [],
              mySnapCooldown: live.scd,
              myBasicCooldown: live.bcd,
              myDashCooldown: live.dcd,
              myRctCooldown: live.rcd,
            })
          }, 75)
        } else if (msg.type === 'state') {
          applyWorldTick({
            players: msg.players,
            projectiles: msg.projectiles,
            beams: msg.beams,
            zones: msg.zones,
            mode: msg.mode,
            phase: msg.phase,
            hostUserId: msg.hostUserId,
            targetKills: msg.targetKills,
            blueKills: msg.blueKills,
            redKills: msg.redKills,
            winnerTeam: msg.winnerTeam,
            matchElapsedSec: msg.matchElapsedSec,
            map: msg.map,
            mapId: msg.mapId,
          })
        } else if (msg.type === 'player_joined') {
          const p: PlayerState = {
            ...msg.player,
            alive: msg.player.alive !== false,
            hp: msg.player.hp ?? 220,
            maxHp: msg.player.maxHp ?? 220,
            kills: msg.player.kills ?? 0,
            deaths: msg.player.deaths ?? 0,
            cooldownsMs: msg.player.cooldownsMs ?? [0, 0, 0, 0, 0],
          }
          latestPlayers.set(p.id, p)
          if (typeof p.netId === 'number' && p.netId > 0) {
            playersByNetId.set(p.netId, p)
          }
          set({ roster: sortRosterByKills(latestPlayers.values()) })
          voiceChatEngine.syncRoomPeers(
            Array.from(latestPlayers.values())
              .filter((pl) => !pl.isDummy)
              .map((pl) => pl.id),
          )
          gameEventBus.emitSync({
            players: Array.from(latestPlayers.values()),
            projectiles: [],
            beams: [],
            zones: [],
          })
          gameEventBus.emitEmote({ playerId: p.id, emote: '✨ เข้าร่วม!' })
        } else if (msg.type === 'player_left') {
          const left = latestPlayers.get(msg.player.id)
          if (left && typeof left.netId === 'number' && left.netId > 0) {
            playersByNetId.delete(left.netId)
          }
          latestPlayers.delete(msg.player.id)
          set({ roster: sortRosterByKills(latestPlayers.values()) })
          voiceChatEngine.syncRoomPeers(
            Array.from(latestPlayers.values())
              .filter((pl) => !pl.isDummy)
              .map((pl) => pl.id),
          )
          gameEventBus.emitSync({
            players: Array.from(latestPlayers.values()),
            projectiles: [],
            beams: [],
            zones: [],
          })
        } else if (msg.type === 'player_died') {
          const victim = latestPlayers.get(msg.victimId)
          if (victim) {
            victim.alive = false
            victim.hp = 0
            victim.killedBy = msg.killerName
            victim.respawnInMs = victim.isDummy ? 1500 : 7000
            if (typeof victim.netId === 'number' && victim.netId > 0) {
              playersByNetId.set(victim.netId, victim)
            }
          }
          const myId = get().myPlayerId
          if (msg.victimId === myId) {
            lastSyncAtMs = performance.now()
          }
          const meNow = latestPlayers.get(myId)
          set({
            roster: sortRosterByKills(latestPlayers.values()),
            myAlive: meNow ? meNow.alive : true,
            killedBy: meNow?.killedBy ?? '',
            ...(msg.victimId === myId && meNow ? { myRespawnInMs: meNow.respawnInMs ?? 7000 } : {}),
          })
          gameEventBus.emitDied(msg)
        } else if (msg.type === 'emote') {
          gameEventBus.emitEmote(msg)
        } else if (msg.type === 'saitama_punch') {
          try {
            soundEngine.playEffectSound(msg.blocked ? 'saitama_dodge' : 'saitama_serious_punch')
          } catch {
            // Ignore WebAudio restrictions so impact overlay never drops
          }
          gameEventBus.emitSaitamaPunch(msg)
          if (msg.targetId === get().myPlayerId) {
            if (saitamaTimer !== null) {
              window.clearTimeout(saitamaTimer)
            }
            const victim = latestPlayers.get(msg.targetId)
            if (!msg.blocked && victim) {
              victim.alive = false
              victim.hp = 0
              victim.killedBy = msg.attackerName
              if (!victim.respawnInMs || victim.respawnInMs <= 0) {
                victim.respawnInMs = 7000
              }
              if (typeof victim.netId === 'number' && victim.netId > 0) {
                playersByNetId.set(victim.netId, victim)
              }
              lastSyncAtMs = performance.now()
            }
            set({
              ...(!msg.blocked && victim
                ? {
                    myAlive: false,
                    myHp: 0,
                    killedBy: msg.attackerName,
                    myRespawnInMs: victim.respawnInMs ?? 7000,
                  }
                : {}),
              saitamaOverlay: {
                visible: true,
                targetId: msg.targetId,
                attackerName: msg.attackerName,
                blocked: msg.blocked,
              },
            })
            saitamaTimer = window.setTimeout(() => {
              saitamaTimer = null
              set({ saitamaOverlay: null })
            }, 2000)
          }
        } else if (msg.type === 'domain_clash') {
          try {
            soundEngine.playEffectSound('domain_clash')
          } catch {
            // Ignore WebAudio restrictions
          }
          gameEventBus.emitDomainClash(msg)
          if (domainClashTimer !== null) {
            window.clearTimeout(domainClashTimer)
          }
          set({
            domainClashOverlay: {
              visible: true,
              gojoName: msg.gojoName,
              sukunaName: msg.sukunaName,
            },
          })
          domainClashTimer = window.setTimeout(() => {
            domainClashTimer = null
            set({ domainClashOverlay: null })
          }, 1000)
        } else if (msg.type === 'infinity_snap') {
          try {
            soundEngine.playEffectSound('infinity_snap')
          } catch {
            // Ignore WebAudio restrictions
          }
          gameEventBus.emitInfinitySnap(msg)
          if (snapOverlayTimer !== null) {
            window.clearTimeout(snapOverlayTimer)
          }
          set({
            snapOverlay: {
              visible: true,
              attackerName: msg.attackerName,
              mode: msg.mode,
              instantWin: msg.instantWin,
              killedCount: msg.killedCount,
            },
          })
          snapOverlayTimer = window.setTimeout(() => {
            snapOverlayTimer = null
            set({ snapOverlay: null })
          }, 2200)
        } else if (msg.type === 'voice_signal') {
          void voiceChatEngine.handleSignal(msg)
        } else if (msg.type === 'pong') {
          set({ pingMs: Math.max(1, Date.now() - msg.ts) })
        } else if (msg.type === 'error') {
          set({ error: msg.message, joining: false })
        }
      },
      onClose: () => {
        if (activeTransport !== transport) return
        clearTimers()
        voiceChatEngine.leaveRoom()
        activeTransport = null
        const { authUser: currentAuth } = get()
        set({
          connected: false,
          joining: false,
          arenaReady: false,
          voiceMicEnabled: false,
          voiceSpeaking: false,
          peerVoiceStates: {},
          currentView: currentAuth ? 'home' : 'auth',
        })
      },
      onError: (reason) => {
        if (activeTransport !== transport) return
        set({ error: reason, joining: false })
      },
    })

    activeTransport = transport
    void transport.connect(wsUrlBase, wtQuery)
  },

  leaveRoom: (targetView) => {
    clearTimers()
    voiceChatEngine.leaveRoom()
    closeSocketSafely(activeTransport)
    activeTransport = null
    latestPlayers.clear()
    playersByNetId.clear()
    latestRecvTick = 0
    lastHudSig = ''
    lastInputVec = { dx: 0, dy: 0 }
    mouseWorld.active = false
    seqCounter = 0
    gameEventBus.clearInit()
    const { authUser, currentView, selectedCharId } = get()
    releaseUnusedMatchAssets([selectedCharId])
    window.history.replaceState(null, '', '/')
    const resolvedView: ScreenView =
      typeof targetView === 'string' ? targetView : authUser ? 'home' : 'auth'
    set({
      joining: false,
      arenaReady: false,
      assetsReady: false,
      preloadProgress: 0,
      preloadStage: '',
      connected: false,
      voiceMicEnabled: false,
      voiceSpeaking: false,
      peerVoiceStates: {},
      adminAiEnabled: false,
      previousView: currentView !== resolvedView ? currentView : null,
      currentView: resolvedView,
      pendingJoinRoom: null,
      activeRoomId: '',
      myPlayerId: '',
      myAlive: true,
      myInVoid: false,
      killedBy: '',
      saitamaOverlay: null,
      domainClashOverlay: null,
      snapOverlay: null,
      myRctCooldown: 0,
      mySnapCooldown: 0,
      myInfinityStones: [],
      roster: [],
      blueKills: 0,
      redKills: 0,
      winnerTeam: '',
      myCooldowns: [0, 0, 0, 0, 0],
      myBasicCooldown: 0,
      myDashCooldown: 0,
    })
  },

  selectTeam: (team) => {
    activeTransport?.sendReliableJson({ type: 'select_team', team })
  },

  selectRoomMap: (mapId) => {
    activeTransport?.sendReliableJson({ type: 'select_map', mapId })
  },

  selectRoomCharacter: (characterId) => {
    void get().equipCharacter(characterId)
    activeTransport?.sendReliableJson({ type: 'select_character', characterId })
  },

  switchPracticeCharacter: (characterId) => {
    soundEngine.unlock()
    const def = get().characters.find((c) => c.id === characterId)
    void warmupSingleHeroAssets(characterId, def)
    set({ selectedCharId: characterId })
    activeTransport?.sendReliableJson({ type: 'switch_character', characterId })
  },

  resetPractice: () => {
    soundEngine.unlock()
    lastDummyHPMap.clear()
    set({ lastDummyDamage: 0, totalDummyDamage: 0 })
    activeTransport?.sendReliableJson({ type: 'reset_cooldowns' })
  },

  toggleReady: () => {
    activeTransport?.sendReliableJson({ type: 'toggle_ready' })
  },

  startMatch: () => {
    activeTransport?.sendReliableJson({ type: 'start_match' })
  },

  returnToWaitingLobby: () => {
    activeTransport?.sendReliableJson({ type: 'return_lobby' })
  },

  sendMovementVector: (dx, dy, force = false, worldSpace = false) => {
    const effDx = simoSnipeCharging ? 0 : dx
    const effDy = simoSnipeCharging ? 0 : dy
    let mdx = effDx
    let mdy = effDy
    if (!worldSpace && get().roomMode === 'iconic' && (effDx !== 0 || effDy !== 0)) {
      const rot = rotateScreenVecToIconicWorld(effDx, effDy)
      mdx = rot.wx
      mdy = rot.wy
    }
    const rdx = Math.round(mdx * 100) / 100
    const rdy = Math.round(mdy * 100) / 100
    if (!force && rdx === lastInputVec.dx && rdy === lastInputVec.dy) {
      return
    }
    lastInputVec = { dx: rdx, dy: rdy }
    lastInputChangedAtMs = performance.now()
    if (activeTransport?.isOpen()) {
      seqCounter += 1
      if (activeTransport.supportsBinary()) {
        activeTransport.sendUnreliableBinary(encodeBinaryInput(seqCounter, rdx, rdy))
      } else {
        activeTransport.sendReliableJson({ type: 'input', seq: seqCounter, dx: rdx, dy: rdy })
      }
    }
  },

  dismissSaitamaOverlay: () => {
    if (saitamaTimer !== null) {
      window.clearTimeout(saitamaTimer)
      saitamaTimer = null
    }
    set({ saitamaOverlay: null })
  },

  castSkill: (slot, target) => {
    soundEngine.unlock()
    const { myPlayerId, myAlive, matchPhase, roomMode, characters } = get()
    const me = latestPlayers.get(myPlayerId)
    if (!me || !myAlive || matchPhase !== 'playing') return
    if (me.characterId === 'noone' && !(me.infinityStones ?? []).includes(slot)) return
    // 180ms Skill Input Buffer Queue: if skill cooldown is within its final 180ms, queue and auto-fire on ready!
    const remCdMs = me.cooldownsMs?.[slot - 1] ?? 0
    if (remCdMs > 0 && remCdMs <= 180) {
      window.setTimeout(() => {
        useGameStore.getState().castSkill(slot, target)
      }, remCdMs + 12)
      return
    }
    const charDef = characters.find((c) => c.id === me.characterId)
    const sk = charDef?.skills.find((s) => s.slot === slot)
    const castRange = sk?.castRange ?? 360
    const rotatedTarget =
      roomMode === 'iconic' && target?.dirX !== undefined && target?.dirY !== undefined
        ? (() => {
            const r = rotateScreenVecToIconicWorld(target.dirX, target.dirY)
            return { ...target, dirX: r.wx, dirY: r.wy }
          })()
        : target
    const { tx, ty } = resolveAimCoords(
      me,
      myPlayerId,
      rotatedTarget,
      false,
      castRange,
      isTeamMatchMode(roomMode),
    )
    if (activeTransport?.isOpen()) {
      const cdMs = me.cooldownsMs?.[slot - 1] ?? 0
      if (cdMs <= 0 && !me.stunned && !me.seated && !me.inVoid) {
        soundEngine.speakSkillCallout(me.characterId, slot, sk?.name)
      }
      if (activeTransport.supportsBinary()) {
        activeTransport.sendReliableBinary(encodeBinarySkill(slot, tx, ty, target?.targetId ?? ''))
      } else {
        activeTransport.sendReliableJson({ type: 'skill', slot, tx, ty, targetId: target?.targetId ?? '' })
      }
    }
  },

  castBasicAttack: (target) => {
    soundEngine.unlock()
    const { myPlayerId, myAlive, matchPhase, roomMode } = get()
    const me = latestPlayers.get(myPlayerId)
    if (!me || !myAlive || matchPhase !== 'playing') return
    const basicRange = getBasicAttackRange(me.characterId)
    const rotatedTarget =
      roomMode === 'iconic' && target?.dirX !== undefined && target?.dirY !== undefined
        ? (() => {
            const r = rotateScreenVecToIconicWorld(target.dirX, target.dirY)
            return { ...target, dirX: r.wx, dirY: r.wy }
          })()
        : target
    const { tx, ty } = resolveAimCoords(
      me,
      myPlayerId,
      rotatedTarget,
      false,
      basicRange,
      isTeamMatchMode(roomMode),
    )
    if (activeTransport?.isOpen()) {
      if (activeTransport.supportsBinary()) {
        activeTransport.sendReliableBinary(encodeBinaryAttack(tx, ty))
      } else {
        activeTransport.sendReliableJson({ type: 'attack', tx, ty })
      }
    }
  },

  castDash: (target) => {
    soundEngine.unlock()
    const { myPlayerId, myAlive, matchPhase, roomMode } = get()
    const me = latestPlayers.get(myPlayerId)
    if (!me || !myAlive || matchPhase !== 'playing') return
    const rotatedTarget =
      roomMode === 'iconic' && target?.dirX !== undefined && target?.dirY !== undefined
        ? (() => {
            const r = rotateScreenVecToIconicWorld(target.dirX, target.dirY)
            return { ...target, dirX: r.wx, dirY: r.wy }
          })()
        : target
    const { tx, ty } = resolveAimCoords(
      me,
      myPlayerId,
      rotatedTarget,
      true,
      255,
      isTeamMatchMode(roomMode),
    )
    if (activeTransport?.isOpen()) {
      if (activeTransport.supportsBinary()) {
        activeTransport.sendReliableBinary(encodeBinaryDash(tx, ty))
      } else {
        activeTransport.sendReliableJson({ type: 'dash', tx, ty })
      }
    }
  },

  castRct: () => {
    soundEngine.unlock()
    const { myPlayerId, myAlive, matchPhase, roomMode } = get()
    const me = latestPlayers.get(myPlayerId)
    if (!me || !myAlive || matchPhase !== 'playing' || roomMode !== 'iconic') return
    if (activeTransport?.isOpen()) {
      try {
        soundEngine.playEffectSound('rct_heal')
        if ((me.rctCooldownMs ?? 0) <= 0) {
          soundEngine.speakSkillCallout(me.characterId, 'rct', '反転術式！')
        }
      } catch {
        // Ignore audio errors
      }
      if (activeTransport.supportsBinary()) {
        activeTransport.sendReliableBinary(encodeBinarySimple(BIN_CLIENT_RCT))
      } else {
        activeTransport.sendReliableJson({ type: 'rct' })
      }
    }
  },

  castSnap: () => {
    soundEngine.unlock()
    const { myPlayerId, myAlive, matchPhase } = get()
    const me = latestPlayers.get(myPlayerId)
    if (!me || !myAlive || matchPhase !== 'playing' || me.characterId !== 'noone') return
    if ((me.infinityStones?.length ?? 0) < 5) return
    if ((me.snapCooldownMs ?? 0) <= 0) {
      soundEngine.speakSkillCallout('noone', 'snap', 'I am inevitable!')
    }
    if (activeTransport?.supportsBinary()) {
      activeTransport.sendReliableBinary(encodeBinarySimple(BIN_CLIENT_SNAP))
    } else {
      activeTransport?.sendReliableJson({ type: 'snap' })
    }
  },

  sendRespawn: () => {
    lastInputVec = { dx: 0, dy: 0 }
    if (activeTransport?.supportsBinary()) {
      activeTransport.sendReliableBinary(encodeBinarySimple(BIN_CLIENT_RESPAWN))
    } else {
      activeTransport?.sendReliableJson({ type: 'respawn' })
    }
  },

  sendEmote: (emote) => {
    activeTransport?.sendReliableJson({ type: 'emote', emote })
  },
}))
