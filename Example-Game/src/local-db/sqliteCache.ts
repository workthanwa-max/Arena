import initSqlJs, { type Database } from 'sql.js'
import type { CharacterDef, RecentRoom } from '../types/game'

/**
 * Browser Local SQLite (WASM + IndexedDB)
 * Strictly restricted to UI Preferences & Read-Cache ONLY.
 * Authoritative game state (HP, kills, cooldowns, positions) MUST come from Go Server.
 */

const IDB_NAME = 'pulsearena_local_sqlite'
const IDB_STORE = 'db_blobs'
const IDB_KEY = 'cache_v11'

let dbInstance: Database | null = null

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadBlobFromIDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIDB()
    return await new Promise((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readonly')
      const store = tx.objectStore(IDB_STORE)
      const req = store.get(IDB_KEY)
      req.onsuccess = () => {
        const val = req.result
        resolve(val instanceof Uint8Array ? val : null)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function persistToIDB(): Promise<void> {
  if (!dbInstance) return
  try {
    const data = dbInstance.export()
    const idb = await openIDB()
    await new Promise<void>((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(data, IDB_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Non-fatal: cache still works in-memory for current tab
  }
}

export async function initLocalSQLite(): Promise<boolean> {
  if (dbInstance) return true
  try {
    const SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
      useOldExtensionFunctions: false,
    })
    const saved = await loadBlobFromIDB()
    dbInstance = saved ? new SQL.Database(saved) : new SQL.Database()

    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS character_catalog_cache (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recent_rooms (
        room_id TEXT PRIMARY KEY,
        last_joined_at INTEGER NOT NULL
      );
    `)
    await persistToIDB()
    return true
  } catch {
    return false
  }
}

export function loadPreferences(): { playerName: string; characterId: string } {
  const out = { playerName: '', characterId: 'pa' }
  if (!dbInstance) return out
  try {
    const stmt = dbInstance.prepare('SELECT key, value FROM user_preferences')
    while (stmt.step()) {
      const row = stmt.getAsObject() as { key?: string; value?: string }
      if (row.key === 'playerName' && typeof row.value === 'string') {
        out.playerName = row.value
      }
      if (row.key === 'characterId' && typeof row.value === 'string') {
        out.characterId = row.value
      }
    }
    stmt.free()
  } catch {
    // Return defaults on cache read error
  }
  return out
}

export async function savePreference(key: 'playerName' | 'characterId', value: string): Promise<void> {
  if (!dbInstance) return
  dbInstance.run(
    'INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)',
    [key, value],
  )
  await persistToIDB()
}

export function getCachedCharacters(): CharacterDef[] {
  if (!dbInstance) return []
  try {
    const list: CharacterDef[] = []
    const stmt = dbInstance.prepare('SELECT payload FROM character_catalog_cache ORDER BY sort_order ASC')
    while (stmt.step()) {
      const row = stmt.getAsObject() as { payload?: string }
      if (row.payload) {
        list.push(JSON.parse(row.payload) as CharacterDef)
      }
    }
    stmt.free()
    return list
  } catch {
    return []
  }
}

export async function cacheCharacters(chars: CharacterDef[]): Promise<void> {
  if (!dbInstance || chars.length === 0) return
  dbInstance.run('DELETE FROM character_catalog_cache')
  chars.forEach((ch, idx) => {
    dbInstance?.run(
      'INSERT INTO character_catalog_cache (id, sort_order, payload) VALUES (?, ?, ?)',
      [ch.id, idx, JSON.stringify(ch)],
    )
  })
  await persistToIDB()
}

export function getRecentRooms(limit = 3): RecentRoom[] {
  if (!dbInstance) return []
  try {
    const list: RecentRoom[] = []
    const stmt = dbInstance.prepare(
      'SELECT room_id, last_joined_at FROM recent_rooms ORDER BY last_joined_at DESC LIMIT ?',
    )
    stmt.bind([limit])
    while (stmt.step()) {
      const row = stmt.getAsObject() as { room_id?: string; last_joined_at?: number }
      if (row.room_id && typeof row.last_joined_at === 'number') {
        list.push({ roomId: row.room_id, lastJoinedAt: row.last_joined_at })
      }
    }
    stmt.free()
    return list
  } catch {
    return []
  }
}

export async function recordRecentRoom(roomId: string): Promise<void> {
  if (!dbInstance || !roomId) return
  dbInstance.run(
    'INSERT OR REPLACE INTO recent_rooms (room_id, last_joined_at) VALUES (?, ?)',
    [roomId, Date.now()],
  )
  await persistToIDB()
}
