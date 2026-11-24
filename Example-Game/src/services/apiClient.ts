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

const SESSION_TOKEN_KEY = 'pulsearena_session_token_v1'
const SESSION_EXPIRES_KEY = 'pulsearena_session_expires_v1'
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000 // 1 year persistent login

export function getStoredSessionToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    const tok = window.localStorage.getItem(SESSION_TOKEN_KEY) ?? ''
    if (!tok) return ''
    const expRaw = window.localStorage.getItem(SESSION_EXPIRES_KEY)
    const exp = expRaw ? Number(expRaw) : 0
    if (exp > 0 && Date.now() > exp) {
      window.localStorage.removeItem(SESSION_TOKEN_KEY)
      window.localStorage.removeItem(SESSION_EXPIRES_KEY)
      return ''
    }
    return tok
  } catch {
    return ''
  }
}

export function saveStoredSessionToken(token: string): void {
  if (typeof window === 'undefined' || !token) return
  try {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token)
    window.localStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + SESSION_TTL_MS))
  } catch {
    // Ignore storage restrictions
  }
}

export function clearStoredSessionToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SESSION_TOKEN_KEY)
    window.localStorage.removeItem(SESSION_EXPIRES_KEY)
  } catch {
    // Ignore storage restrictions
  }
}

async function requestJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const storedToken = getStoredSessionToken()
  if (storedToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${storedToken}`)
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
