import type { BeamEffect, MatchPhase, PlayerState, Projectile, ZoneEffect } from '../types/game'

export const BIN_CLIENT_INPUT = 0x01
export const BIN_CLIENT_ATTACK = 0x02
export const BIN_CLIENT_DASH = 0x03
export const BIN_CLIENT_RCT = 0x04
export const BIN_CLIENT_SNAP = 0x05
export const BIN_CLIENT_RESPAWN = 0x06
export const BIN_CLIENT_SKILL = 0x07
export const BIN_CLIENT_PING = 0x08

export const BIN_SERVER_STATE = 0x10
export const BIN_SERVER_PONG = 0x11

export const EFFECT_KINDS: readonly string[] = [
  'atk_default_pulse',      // 0
  'atk_gilga_sword',        // 1
  'atk_gilga_flash',        // 2
  'atk_goku_fist',          // 3
  'atk_itachi_kunai',       // 4
  'atk_zoro_sweep',         // 5
  'atk_killua_spark',       // 6
  'atk_sukuna_cleave',      // 7
  'atk_rimuru_water',       // 8
  'atk_aiouan_paw',         // 9
  'atk_sorn_jab',           // 10
  'atk_gojo_punch',         // 11
  'atk_zenitsu_slash',      // 12
  'atk_thanos_gauntlet',    // 13
  'basic_lock_reticle',     // 14
  'gate_sword',             // 15
  'gate_portal',            // 16
  'enkidu_field',           // 17
  'enkidu_tether',          // 18
  'gilga_sword_rain',       // 19
  'gilga_sky_sword',        // 20
  'ki_blast',               // 21
  'dragon_rush',            // 22
  'kamehameha',             // 23
  'dash_afterimage',        // 24
  'instant_transmission',   // 25
  'crow_shuriken',          // 26
  'crow_storm',             // 27
  'tsukuyomi',              // 28
  'amaterasu',              // 29
  'pound_ho',               // 30
  'shishi_sonson',          // 31
  'sanzen_sekai',           // 32
  'killua_solo_flash',      // 33
  'killua_solo_ring',       // 34
  'godspeed_aura',          // 35
  'narukami',               // 36
  'narukami_strike',        // 37
  'dismantle',              // 38
  'fuga_arrow',             // 39
  'fuga_explosion',         // 40
  'fuga_cinder',            // 41
  'malevolent_shrine',      // 42
  'black_lightning',        // 43
  'black_lightning_strike', // 44
  'black_flame_wave',       // 45
  'beelzebuth',             // 46
  'aiouan_lock_beam',       // 47
  'aiouan_pounce',          // 48
  'aiouan_pounce_seal',     // 49
  'aiouan_ora_rush',        // 50
  'aiouan_timestop',        // 51
  'aiouan_timestop_burst',  // 52
  'saitama_serious_punch',  // 53
  'saitama_dodge',          // 54
  'gojo_red',               // 55
  'gojo_blue',              // 56
  'gojo_cast_red',          // 57
  'gojo_cast_blue',         // 58
  'hollow_purple',          // 59
  'hollow_purple_blast',    // 60
  'infinite_void',          // 61
  'infinite_void_open',     // 62
  'domain_clash_shock',     // 63
  'zenitsu_hekireki',       // 64
  'zenitsu_rokuren',        // 65
  'zenitsu_murad_slash',    // 66
  'zenitsu_honoo_no_kami',  // 67
  'thanos_power_blast',     // 68
  'thanos_space_warp',      // 69
  'thanos_space_vortex',    // 70
  'thanos_reality_shard',   // 71
  'thanos_reality_rift',    // 72
  'thanos_time_mandala',    // 73
  'thanos_mind_beam',       // 74
  'thanos_infinity_snap',   // 75
]

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function clampU16(v: number): number {
  const n = Math.round(v)
  return n < 0 ? 0 : n > 65535 ? 65535 : n
}

function clampI8(v: number): number {
  const clamped = v < -1 ? -1 : v > 1 ? 1 : v
  return Math.round(clamped * 127)
}

export function encodeBinaryInput(seq: number, dx: number, dy: number): Uint8Array {
  const buf = new Uint8Array(7)
  const dv = new DataView(buf.buffer)
  buf[0] = BIN_CLIENT_INPUT
  dv.setUint32(1, seq >>> 0, true)
  dv.setInt8(5, clampI8(dx))
  dv.setInt8(6, clampI8(dy))
  return buf
}

export function encodeBinaryAttack(tx: number, ty: number): Uint8Array {
  const buf = new Uint8Array(5)
  const dv = new DataView(buf.buffer)
  buf[0] = BIN_CLIENT_ATTACK
  dv.setUint16(1, clampU16(tx), true)
  dv.setUint16(3, clampU16(ty), true)
  return buf
}

export function encodeBinaryDash(tx: number, ty: number): Uint8Array {
  const buf = new Uint8Array(5)
  const dv = new DataView(buf.buffer)
  buf[0] = BIN_CLIENT_DASH
  dv.setUint16(1, clampU16(tx), true)
  dv.setUint16(3, clampU16(ty), true)
  return buf
}

export function encodeBinarySimple(opcode: number): Uint8Array {
  return new Uint8Array([opcode & 0xff])
}

export function encodeBinarySkill(slot: number, tx: number, ty: number, targetId = ''): Uint8Array {
  const targetBytes = targetId ? textEncoder.encode(targetId) : new Uint8Array(0)
  const tLen = Math.min(255, targetBytes.length)
  const buf = new Uint8Array(7 + tLen)
  const dv = new DataView(buf.buffer)
  buf[0] = BIN_CLIENT_SKILL
  buf[1] = slot & 0xff
  dv.setUint16(2, clampU16(tx), true)
  dv.setUint16(4, clampU16(ty), true)
  buf[6] = tLen
  if (tLen > 0) buf.set(targetBytes.subarray(0, tLen), 7)
  return buf
}

export function encodeBinaryPing(tsMs: number): Uint8Array {
  const buf = new Uint8Array(9)
  const dv = new DataView(buf.buffer)
  buf[0] = BIN_CLIENT_PING
  dv.setFloat64(1, 0)
  // Write 64-bit unsigned millisecond timestamp safely in two 32-bit limbs
  const lo = tsMs >>> 0
  const hi = Math.floor(tsMs / 0x100000000) >>> 0
  dv.setUint32(1, lo, true)
  dv.setUint32(5, hi, true)
  return buf
}

function rgbHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export interface DecodedBinaryState {
  tick: number
  phase: MatchPhase
  blueKills: number
  redKills: number
  matchElapsedSec: number
  players: PlayerState[]
  projectiles: Projectile[]
  beams: BeamEffect[]
  zones: ZoneEffect[]
}

export function decodeBinaryPong(data: Uint8Array): number | null {
  if (data.length < 9 || data[0] !== BIN_SERVER_PONG) return null
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const lo = dv.getUint32(1, true)
  const hi = dv.getUint32(5, true)
  return hi * 0x100000000 + lo
}

export function decodeBinaryState(
  data: Uint8Array,
  metaByNetId: Map<number, PlayerState>,
): DecodedBinaryState | null {
  if (data.length < 16 || data[0] !== BIN_SERVER_STATE) return null
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let off = 1

  const flags = data[off++]
  const phase: MatchPhase = (flags & 2) !== 0 ? 'finished' : (flags & 1) !== 0 ? 'playing' : 'waiting'
  const tick = dv.getUint32(off, true); off += 4
  const blueKills = dv.getUint16(off, true); off += 2
  const redKills = dv.getUint16(off, true); off += 2
  const matchElapsedSec = dv.getUint16(off, true); off += 2
  const playerCount = data[off++]
  const projCount = data[off++]
  const beamCount = data[off++]
  const zoneCount = data[off++]

  const readKind = (): string => {
    const code = data[off++]
    if (code !== 0xff) return EFFECT_KINDS[code] ?? 'atk_default_pulse'
    const len = data[off++]
    const s = textDecoder.decode(data.subarray(off, off + len))
    off += len
    return s
  }

  const netIdToUuid = new Map<number, string>()
  const players: PlayerState[] = []

  for (let i = 0; i < playerCount; i++) {
    const netId = dv.getUint16(off, true); off += 2
    const x = dv.getUint16(off, true) / 10; off += 2
    const y = dv.getUint16(off, true) / 10; off += 2
    const dx = dv.getInt8(off++) / 127
    const dy = dv.getInt8(off++) / 127
    const aimDx = dv.getInt8(off++) / 127
    const aimDy = dv.getInt8(off++) / 127
    const hp = dv.getUint16(off, true); off += 2
    const maxHp = dv.getUint16(off, true); off += 2
    const kills = dv.getUint16(off, true); off += 2
    const deaths = dv.getUint16(off, true); off += 2
    const st = dv.getUint16(off, true); off += 2
    const lastSeq = dv.getUint32(off, true); off += 4

    let respawnInMs = 0
    const cooldownsMs = [0, 0, 0, 0, 0]
    let basicCooldownMs = 0
    let dashCooldownMs = 0
    let rctCooldownMs = 0
    let snapCooldownMs = 0

    if ((st & (1 << 13)) !== 0) {
      respawnInMs = dv.getUint16(off, true); off += 2
      for (let sIdx = 0; sIdx < 5; sIdx++) {
        cooldownsMs[sIdx] = dv.getUint16(off, true); off += 2
      }
      basicCooldownMs = dv.getUint16(off, true); off += 2
      dashCooldownMs = dv.getUint16(off, true); off += 2
      rctCooldownMs = dv.getUint16(off, true); off += 2
      snapCooldownMs = dv.getUint16(off, true); off += 2
    }

    const infinityStones: number[] = []
    for (let s = 1; s <= 5; s++) {
      if ((st & (1 << (7 + s))) !== 0) infinityStones.push(s)
    }

    const base = metaByNetId.get(netId)
    const id = base?.id ?? `net-${netId}`
    netIdToUuid.set(netId, id)

    players.push({
      id,
      netId,
      userId: base?.userId,
      name: base?.name ?? `Player-${netId}`,
      characterId: base?.characterId ?? 'default',
      characterName: base?.characterName ?? 'Challenger',
      team: base?.team ?? 'ffa',
      isDummy: base?.isDummy,
      ready: base?.ready,
      isHost: base?.isHost,
      color: base?.color ?? '#38BDF8',
      accentColor: base?.accentColor ?? '#E0F2FE',
      killedBy: (st & 1) !== 0 ? '' : base?.killedBy,
      x,
      y,
      dx,
      dy,
      aimDx,
      aimDy,
      hp,
      maxHp,
      alive: (st & (1 << 0)) !== 0,
      kills,
      deaths,
      stunned: (st & (1 << 1)) !== 0,
      slowed: (st & (1 << 2)) !== 0,
      godspeed: (st & (1 << 3)) !== 0,
      fastAttack: (st & (1 << 4)) !== 0,
      invulnerable: (st & (1 << 5)) !== 0,
      seated: (st & (1 << 6)) !== 0,
      inVoid: (st & (1 << 7)) !== 0,
      infinityStones,
      respawnInMs,
      cooldownsMs,
      basicCooldownMs,
      dashCooldownMs,
      rctCooldownMs,
      snapCooldownMs,
      lastSeq,
    })
  }

  const projectiles: Projectile[] = []
  for (let i = 0; i < projCount; i++) {
    const idSeq = dv.getUint32(off, true); off += 4
    const ownerNet = dv.getUint16(off, true); off += 2
    const targetNet = dv.getUint16(off, true); off += 2
    const kind = readKind()
    const x = dv.getUint16(off, true) / 10; off += 2
    const y = dv.getUint16(off, true) / 10; off += 2
    const vx = dv.getInt16(off, true); off += 2
    const vy = dv.getInt16(off, true); off += 2
    const radius = data[off++]
    const color = rgbHex(data[off], data[off + 1], data[off + 2]); off += 3
    const accentColor = rgbHex(data[off], data[off + 1], data[off + 2]); off += 3
    projectiles.push({
      id: `p-${idSeq}`,
      ownerId: netIdToUuid.get(ownerNet) ?? '',
      targetId: targetNet ? netIdToUuid.get(targetNet) : undefined,
      kind,
      x,
      y,
      vx,
      vy,
      radius,
      color,
      accentColor,
    })
  }

  const beams: BeamEffect[] = []
  for (let i = 0; i < beamCount; i++) {
    const idSeq = dv.getUint32(off, true); off += 4
    const ownerNet = dv.getUint16(off, true); off += 2
    const kind = readKind()
    const x1 = dv.getUint16(off, true) / 10; off += 2
    const y1 = dv.getUint16(off, true) / 10; off += 2
    const x2 = dv.getUint16(off, true) / 10; off += 2
    const y2 = dv.getUint16(off, true) / 10; off += 2
    const width = data[off++]
    const life = dv.getUint16(off, true) / 1000; off += 2
    const maxLife = dv.getUint16(off, true) / 1000; off += 2
    const color = rgbHex(data[off], data[off + 1], data[off + 2]); off += 3
    const accentColor = rgbHex(data[off], data[off + 1], data[off + 2]); off += 3
    beams.push({
      id: `b-${idSeq}`,
      ownerId: netIdToUuid.get(ownerNet) ?? '',
      kind,
      x1,
      y1,
      x2,
      y2,
      width,
      life,
      maxLife,
      color,
      accentColor,
    })
  }

  const zones: ZoneEffect[] = []
  for (let i = 0; i < zoneCount; i++) {
    const idSeq = dv.getUint32(off, true); off += 4
    const ownerNet = dv.getUint16(off, true); off += 2
    const kind = readKind()
    const x = dv.getUint16(off, true) / 10; off += 2
    const y = dv.getUint16(off, true) / 10; off += 2
    const radius = dv.getUint16(off, true); off += 2
    const aimAngle = dv.getInt16(off, true) / 1000; off += 2
    const stepCount = data[off++]
    const life = dv.getUint16(off, true) / 1000; off += 2
    const maxLife = dv.getUint16(off, true) / 1000; off += 2
    const delayLeft = dv.getUint16(off, true) / 1000; off += 2
    const maxDelay = dv.getUint16(off, true) / 1000; off += 2
    const color = rgbHex(data[off], data[off + 1], data[off + 2]); off += 3
    const accentColor = rgbHex(data[off], data[off + 1], data[off + 2]); off += 3
    zones.push({
      id: `z-${idSeq}`,
      ownerId: netIdToUuid.get(ownerNet) ?? '',
      kind,
      x,
      y,
      radius,
      aimAngle,
      stepCount,
      life,
      maxLife,
      delayLeft,
      maxDelay,
      color,
      accentColor,
    })
  }

  return { tick, phase, blueKills, redKills, matchElapsedSec, players, projectiles, beams, zones }
}
