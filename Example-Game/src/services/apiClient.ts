import type {
  CharacterDef,
  GameMode,
  MapId,
  RoomInfo,
  UserProfile,
} from '../types/game'

interface ApiErrorBody {
  code?: string
  message?: string
}

async function requestJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ApiErrorBody
    const e = new Error(err.message || `Request failed (${res.status})`) as Error & {
      status?: number
      code?: string
    }
    e.status = res.status
    e.code = err.code
    throw e
  }

  return (await res.json()) as T
}

export const apiClient = {
  fetchCharacters: () => requestJSON<{ characters: CharacterDef[] }>('/api/characters'),

  fetchCurrentUser: () => requestJSON<{ user: UserProfile; token?: string }>('/api/auth/me'),

  register: (payload: { username: string; password: string; displayName?: string }) =>
    requestJSON<{ user: UserProfile; token?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { username: string; password: string }) =>
    requestJSON<{ user: UserProfile; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    requestJSON<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  equipCharacter: (characterId: string) =>
    requestJSON<{ user: UserProfile }>('/api/users/me/character', {
      method: 'PUT',
      body: JSON.stringify({ characterId }),
    }),

  createRoom: (payload: { mode: GameMode; mapId: MapId }) =>
    requestJSON<RoomInfo>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRoomInfo: (roomId: string) =>
    requestJSON<RoomInfo>(`/api/rooms/${encodeURIComponent(roomId)}`),
}
