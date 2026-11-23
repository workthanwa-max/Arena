import type { BeamEffect, MapConfig, PlayerState, Projectile, SkillAimType, ZoneEffect } from '../../types/game'

export interface WorldSyncPayload {
  players: PlayerState[]
  projectiles: Projectile[]
  beams: BeamEffect[]
  zones: ZoneEffect[]
}

export interface WorldInitPayload {
  myPlayerId: string
  mapCfg: MapConfig
  players: PlayerState[]
  projectiles: Projectile[]
  beams: BeamEffect[]
  zones: ZoneEffect[]
}

export interface PlayerDiedPayload {
  victimId: string
  victimName: string
  killerName: string
  x: number
  y: number
}

export interface PlayerEmotePayload {
  playerId: string
  emote: string
}

export interface SaitamaPunchPayload {
  targetId: string
  targetName: string
  attackerId: string
  attackerName: string
  blocked: boolean
  x: number
  y: number
}

export interface DomainClashPayload {
  gojoName: string
  sukunaName: string
  x: number
  y: number
}

export interface InfinitySnapPayload {
  attackerId: string
  attackerName: string
  mode: string
  instantWin: boolean
  killedCount: number
}

export interface AimPreviewPayload {
  active: boolean
  slot: number
  dirX: number
  dirY: number
  rangeFactor: number
  castRange: number
  aoeRadius: number
  aimType: SkillAimType
  cancel: boolean
}

type Listener<T> = (payload: T) => void

class TypedEventBus {
  private lastInit: WorldInitPayload | null = null
  private initListeners = new Set<Listener<WorldInitPayload>>()
  private syncListeners = new Set<Listener<WorldSyncPayload>>()
  private diedListeners = new Set<Listener<PlayerDiedPayload>>()
  private emoteListeners = new Set<Listener<PlayerEmotePayload>>()
  private saitamaPunchListeners = new Set<Listener<SaitamaPunchPayload>>()
  private domainClashListeners = new Set<Listener<DomainClashPayload>>()
  private infinitySnapListeners = new Set<Listener<InfinitySnapPayload>>()
  private castClickListeners = new Set<Listener<{ worldX: number; worldY: number }>>()
  private aimMoveListeners = new Set<Listener<{ worldX: number; worldY: number; active: boolean }>>()
  private aimPreviewListeners = new Set<Listener<AimPreviewPayload>>()
  private fpsListeners = new Set<Listener<number>>()
  private sceneReadyListeners = new Set<Listener<void>>()

  onInit(fn: Listener<WorldInitPayload>): () => void {
    this.initListeners.add(fn)
    if (this.lastInit) {
      fn(this.lastInit)
    }
    return () => this.initListeners.delete(fn)
  }
  emitInit(payload: WorldInitPayload): void {
    this.lastInit = payload
    this.initListeners.forEach((fn) => fn(payload))
  }
  clearInit(): void {
    this.lastInit = null
  }

  onSync(fn: Listener<WorldSyncPayload>): () => void {
    this.syncListeners.add(fn)
    return () => this.syncListeners.delete(fn)
  }
  emitSync(payload: WorldSyncPayload): void {
    if (this.lastInit) {
      this.lastInit = {
        ...this.lastInit,
        players: payload.players,
        projectiles: payload.projectiles,
        beams: payload.beams,
        zones: payload.zones,
      }
    }
    this.syncListeners.forEach((fn) => fn(payload))
  }

  onDied(fn: Listener<PlayerDiedPayload>): () => void {
    this.diedListeners.add(fn)
    return () => this.diedListeners.delete(fn)
  }
  emitDied(payload: PlayerDiedPayload): void {
    this.diedListeners.forEach((fn) => fn(payload))
  }

  onEmote(fn: Listener<PlayerEmotePayload>): () => void {
    this.emoteListeners.add(fn)
    return () => this.emoteListeners.delete(fn)
  }
  emitEmote(payload: PlayerEmotePayload): void {
    this.emoteListeners.forEach((fn) => fn(payload))
  }

  onSaitamaPunch(fn: Listener<SaitamaPunchPayload>): () => void {
    this.saitamaPunchListeners.add(fn)
    return () => this.saitamaPunchListeners.delete(fn)
  }
  emitSaitamaPunch(payload: SaitamaPunchPayload): void {
    this.saitamaPunchListeners.forEach((fn) => fn(payload))
  }

  onDomainClash(fn: Listener<DomainClashPayload>): () => void {
    this.domainClashListeners.add(fn)
    return () => this.domainClashListeners.delete(fn)
  }
  emitDomainClash(payload: DomainClashPayload): void {
    this.domainClashListeners.forEach((fn) => fn(payload))
  }

  onInfinitySnap(fn: Listener<InfinitySnapPayload>): () => void {
    this.infinitySnapListeners.add(fn)
    return () => this.infinitySnapListeners.delete(fn)
  }
  emitInfinitySnap(payload: InfinitySnapPayload): void {
    this.infinitySnapListeners.forEach((fn) => fn(payload))
  }

  onCastClick(fn: Listener<{ worldX: number; worldY: number }>): () => void {
    this.castClickListeners.add(fn)
    return () => this.castClickListeners.delete(fn)
  }
  emitCastClick(payload: { worldX: number; worldY: number }): void {
    this.castClickListeners.forEach((fn) => fn(payload))
  }

  onAimMove(fn: Listener<{ worldX: number; worldY: number; active: boolean }>): () => void {
    this.aimMoveListeners.add(fn)
    return () => this.aimMoveListeners.delete(fn)
  }
  emitAimMove(payload: { worldX: number; worldY: number; active: boolean }): void {
    this.aimMoveListeners.forEach((fn) => fn(payload))
  }

  onAimPreview(fn: Listener<AimPreviewPayload>): () => void {
    this.aimPreviewListeners.add(fn)
    return () => this.aimPreviewListeners.delete(fn)
  }
  emitAimPreview(payload: AimPreviewPayload): void {
    this.aimPreviewListeners.forEach((fn) => fn(payload))
  }

  onFPS(fn: Listener<number>): () => void {
    this.fpsListeners.add(fn)
    return () => this.fpsListeners.delete(fn)
  }
  emitFPS(fps: number): void {
    this.fpsListeners.forEach((fn) => fn(fps))
  }

  onSceneReady(fn: Listener<void>): () => void {
    this.sceneReadyListeners.add(fn)
    return () => this.sceneReadyListeners.delete(fn)
  }
  emitSceneReady(): void {
    this.sceneReadyListeners.forEach((fn) => fn())
  }
}

export const gameEventBus = new TypedEventBus()
