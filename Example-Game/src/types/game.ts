export type GameMode = 'iconic' | 'duel_1v1' | 'ffa' | 'tdm_3v3' | 'practice'
export type MapId = 'shibuya' | 'konoha' | 'sisaket_island' | 'scp_site'
export type HeroClassId = 'sovereign' | 'chronos' | 'deadeye' | 'vanguard' | 'cataclysm'
export type MatchPhase = 'waiting' | 'playing' | 'finished'
export type TeamSide = 'ffa' | 'blue' | 'red'
export type ScreenView = 'auth' | 'home' | 'heroes' | 'battle_setup' | 'join_select' | 'room_lobby' | 'arena'
export type GraphicsQuality = 'pixel' | 'fine_pixel' | 'hd' | 'ultra'

export interface UserProfile {
  id: string
  username: string
  displayName: string
  role?: 'player' | 'admin'
  selectedCharacterId: string
  ownedCharacterIds: string[]
}

export interface Pillar {
  x: number
  y: number
  radius: number
}

export interface MapConfig {
  id?: MapId
  name?: string
  width: number
  height: number
  playerRadius: number
  moveSpeed: number
  pillars: Pillar[]
}

export type SkillAimType = 'line' | 'cone' | 'ground' | 'self' | 'lockon' | 'target_pick'

export interface SkillDef {
  slot: number
  keyHint: string
  name: string
  description: string
  cooldownSec: number
  castRange?: number
  aoeRadius?: number
  aimType?: SkillAimType
  accentColor: string
  iconUrl?: string
}

export interface CharacterDef {
  id: string
  anilistId: number
  imageUrl?: string
  displayName: string
  animeTitle: string
  animeRef: string
  roleTag: string
  heroClass?: HeroClassId
  className?: string
  classIcon?: string
  classColor?: string
  classTraitLabel?: string
  classStatKey?: string
  classStatValue?: number
  voiceLine?: string
  color: string
  accentColor: string
  maxHp: number
  moveSpeed: number
  adminOnly?: boolean
  skills: SkillDef[]
}

export interface PlayerState {
  id: string
  netId?: number
  userId?: string
  name: string
  characterId: string
  characterName: string
  team?: TeamSide
  isDummy?: boolean
  ready?: boolean
  isHost?: boolean
  x: number
  y: number
  dx: number
  dy: number
  aimDx: number
  aimDy: number
  color: string
  accentColor: string
  hp: number
  maxHp: number
  alive: boolean
  kills: number
  deaths?: number
  killedBy?: string
  stunned: boolean
  slowed?: boolean
  godspeed: boolean
  fastAttack?: boolean
  invulnerable?: boolean
  seated?: boolean
  inVoid?: boolean
  respawnInMs?: number
  cooldownsMs: number[]
  infinityStones?: number[]
  snapCooldownMs?: number
  basicCooldownMs?: number
  dashCooldownMs?: number
  rctCooldownMs?: number
  lastSeq: number
}

export interface Projectile {
  id: string
  ownerId: string
  kind: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  accentColor: string
  targetId?: string
}

export interface BeamEffect {
  id: string
  ownerId: string
  kind: string
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  color: string
  accentColor: string
  life: number
  maxLife: number
}

export interface ZoneEffect {
  id: string
  ownerId: string
  kind: string
  x: number
  y: number
  radius: number
  color: string
  accentColor: string
  life: number
  maxLife: number
  delayLeft?: number
  maxDelay?: number
  stepCount?: number
  aimAngle?: number
}

export interface RoomInfo {
  roomId: string
  shareUrl: string
  mode: GameMode
  mapId: MapId
  mapName: string
  phase: MatchPhase
  targetKills: number
  maxPlayers: number
  currentPlayers: number
  blueCount: number
  redCount: number
  isFull: boolean
}

export interface RecentRoom {
  roomId: string
  lastJoinedAt: number
}

export interface PeerVoiceState {
  micOn: boolean
  speakerOn: boolean
  speaking: boolean
}

export type ServerMessage =
  | {
      type: 'welcome'
      playerId: string
      roomId: string
      maxPlayers: number
      mode: GameMode
      mapId: MapId
      phase: MatchPhase
      hostUserId: string
      targetKills: number
      blueKills: number
      redKills: number
      winnerTeam?: TeamSide | ''
      matchElapsedSec: number
      map: MapConfig
      characters: CharacterDef[]
      players: PlayerState[]
      projectiles?: Projectile[]
      beams?: BeamEffect[]
      zones?: ZoneEffect[]
    }
  | {
      type: 'state'
      tick: number
      mode?: GameMode
      mapId?: MapId
      phase: MatchPhase
      hostUserId?: string
      targetKills?: number
      blueKills: number
      redKills: number
      winnerTeam?: TeamSide | ''
      matchElapsedSec?: number
      map?: MapConfig
      players: PlayerState[]
      projectiles?: Projectile[]
      beams?: BeamEffect[]
      zones?: ZoneEffect[]
    }
  | {
      type: 'player_joined' | 'player_left'
      player: PlayerState
    }
  | {
      type: 'player_died'
      victimId: string
      victimName: string
      killerName: string
      x: number
      y: number
    }
  | {
      type: 'emote'
      playerId: string
      emote: string
    }
  | {
      type: 'saitama_punch'
      targetId: string
      targetName: string
      attackerId: string
      attackerName: string
      blocked: boolean
      x: number
      y: number
    }
  | {
      type: 'domain_clash'
      gojoName: string
      sukunaName: string
      x: number
      y: number
    }
  | {
      type: 'infinity_snap'
      attackerId: string
      attackerName: string
      mode: GameMode
      instantWin: boolean
      killedCount: number
    }
  | {
      type: 'voice_signal'
      fromId: string
      fromName: string
      targetId?: string
      signalType: 'join' | 'state' | 'offer' | 'answer' | 'ice'
      sdp?: string
      candidate?: string
      micOn: boolean
      speakerOn: boolean
      speaking: boolean
    }
  | {
      type: 'error'
      code: string
      message: string
    }
  | {
      type: 'pong'
      ts: number
    }
