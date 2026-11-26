import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { HeroPickerPanel } from '../components/HeroPickerPanel'
import {
  IconArrowLeft,
  IconClose,
  IconCopy,
  IconHeadphones,
  IconLogOut,
  IconMic,
  IconPlay,
  IconSwords,
  IconUsers,
  IconVolume,
} from '../components/Icons'
import { TacticalBannerCard, type TacticalBannerSlot } from '../components/TacticalBannerDeck'
import { getMapDisplayLabel } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'
import type { MapId, PlayerState, TeamSide } from '../types/game'

const PRACTICE_MAPS: Array<{ id: MapId; label: string; tag: string; img: string }> = [
  { id: 'shibuya', label: 'ชิบูย่า', tag: 'SHIBUYA', img: '/maps/shibuya_bg.webp' },
  { id: 'konoha', label: 'โคโนฮะ', tag: 'KONOHA', img: '/maps/konoha_bg.webp' },
  { id: 'sisaket_island', label: 'เกาะศรีสะเกษ', tag: 'SISAKET', img: '/maps/sisaket_bg.webp' },
  { id: 'scp_site', label: 'สถานี SCP', tag: 'SCP SITE', img: '/maps/scp_bg.webp' },
]

export function RoomLobbyPage() {
  const [copied, setCopied] = useState(false)
  const [heroDrawerOpen, setHeroDrawerOpen] = useState(false)

  const activeRoomId = useGameStore((s) => s.activeRoomId)
  const roomMode = useGameStore((s) => s.roomMode)
  const roomMapId = useGameStore((s) => s.roomMapId)
  const roster = useGameStore((s) => s.roster)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const pingMs = useGameStore((s) => s.pingMs)
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const error = useGameStore((s) => s.error)
  const voiceMicEnabled = useGameStore((s) => s.voiceMicEnabled)
  const voiceSpeakerEnabled = useGameStore((s) => s.voiceSpeakerEnabled)
  const voiceSpeaking = useGameStore((s) => s.voiceSpeaking)
  const peerVoiceStates = useGameStore((s) => s.peerVoiceStates)

  const selectTeam = useGameStore((s) => s.selectTeam)
  const selectRoomMap = useGameStore((s) => s.selectRoomMap)
  const selectRoomCharacter = useGameStore((s) => s.selectRoomCharacter)
  const toggleReady = useGameStore((s) => s.toggleReady)
  const startMatch = useGameStore((s) => s.startMatch)
  const leaveRoom = useGameStore((s) => s.leaveRoom)
  const setError = useGameStore((s) => s.setError)
  const toggleVoiceMic = useGameStore((s) => s.toggleVoiceMic)
  const toggleVoiceSpeaker = useGameStore((s) => s.toggleVoiceSpeaker)

  const shellRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    animateCardEnter(shellRef.current)
  }, [])

  const isPractice = roomMode === 'practice'
  const isIconic = roomMode === 'iconic'
  const is1v1Side = roomMode === 'duel_1v1' || isIconic
  const sideCap = is1v1Side ? 1 : 3
  const totalCap = isPractice ? 1 : sideCap * 2
  const goalKills = is1v1Side ? 5 : 50

  const humanRoster = roster.filter((p) => !p.isDummy)
  const dummyRoster = roster.filter((p) => p.isDummy)
  const me = roster.find((p) => p.id === myPlayerId)
  const myHeroDef = characters.find((c) => c.id === me?.characterId) ?? characters[0]
  const bluePlayers = roster.filter((p) => p.team === 'blue')
  const redPlayers = roster.filter((p) => p.team === 'red')
  const isReadyToStart = isPractice
    ? humanRoster.length >= 1
    : humanRoster.length === totalCap && bluePlayers.length === sideCap && redPlayers.length === sideCap

  function copyCode() {
    void navigator.clipboard.writeText(activeRoomId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function handlePickHeroInRoom(charId: string) {
    soundEngine.unlock()
    const ch = characters.find((c) => c.id === charId)
    soundEngine.speakCharacterQuote(charId, ch?.voiceLine)
    selectRoomCharacter(charId)
    setHeroDrawerOpen(false)
  }

  function buildPlayerSlot(
    p: PlayerState | undefined,
    team: TeamSide,
    idx: number,
    canJoinSide: boolean,
  ): TacticalBannerSlot {
    const tone: TacticalBannerSlot['tone'] = team === 'blue' ? 'blue' : team === 'red' ? 'red' : 'cobalt'
    if (!p) {
      return {
        id: `${team}-empty-${idx}`,
        topRole: team === 'blue' ? `BLUE ${idx + 1}` : `RED ${idx + 1}`,
        topTitle: 'รอผู้เล่น',
        tone,
        emptyHint: canJoinSide ? 'คลิกย้ายฝั่งนี้' : 'ช่องว่าง',
        onClick: canJoinSide ? () => selectTeam(team as 'blue' | 'red') : undefined,
        actionLabel: canJoinSide ? `ย้ายเข้าทีม ${team === 'blue' ? 'BLUE' : 'RED'}` : undefined,
      }
    }

    const isSelf = p.id === myPlayerId
    const heroDef = characters.find((c) => c.id === p.characterId) ?? myHeroDef
    const peerVoice = !isSelf ? peerVoiceStates[p.id] : undefined
    const speaking = isSelf ? voiceMicEnabled && voiceSpeaking : Boolean(peerVoice?.speaking)
    const muted = isSelf ? !voiceMicEnabled : Boolean(peerVoice && !peerVoice.micOn)
    const badge = p.isDummy ? 'BOT' : p.isHost ? 'HOST' : p.ready ? 'READY' : isSelf ? 'YOU' : undefined

    return {
      id: p.id,
      topRole: p.isDummy ? 'TRAINING BOT' : heroDef?.roleTag || (team === 'blue' ? 'BLUE TEAM' : 'RED TEAM'),
      topTitle: heroDef?.displayName || p.characterName,
      featured: isSelf,
      character: heroDef ?? null,
      use3dPreview: isSelf,
      playerName: p.name + (isSelf ? ' (คุณ)' : ''),
      subLabel: p.isDummy ? 'เป้านิ่งทดสอบสกิล' : heroDef?.displayName || p.characterName,
      statusBadge: badge,
      tone: p.isHost && !p.isDummy ? 'gold' : tone,
      pingMs: isSelf ? (pingMs ?? undefined) : undefined,
      speaking,
      muted,
      actionLabel: isSelf && !isIconic ? 'คลิกสลับฮีโร่' : undefined,
    }
  }

  const leftSlots: TacticalBannerSlot[] = isPractice
    ? [buildPlayerSlot(me ?? humanRoster[0], 'blue', 0, false)]
    : Array.from({ length: sideCap }).map((_, i) => {
        const p = bluePlayers[i]
        return buildPlayerSlot(p, 'blue', i, Boolean(me && me.team !== 'blue' && !isPractice))
      })

  const rightSlots: TacticalBannerSlot[] = isPractice
    ? (dummyRoster.length > 0 ? dummyRoster : [undefined]).map((d, i) =>
        buildPlayerSlot(d, 'red', i, false),
      )
    : Array.from({ length: sideCap }).map((_, i) => {
        const p = redPlayers[i]
        return buildPlayerSlot(p, 'red', i, Boolean(me && me.team !== 'red' && !isPractice))
      })

  const mainStartText = me?.isHost
    ? isReadyToStart
      ? isPractice
        ? 'START PRACTICE'
        : 'START'
      : `รอผู้เล่น (${humanRoster.length}/${totalCap})`
    : me?.ready
      ? 'พร้อมแล้ว (ยกเลิก)'
      : 'กดพร้อม'

  return (
    <div className="val-page">
      <div ref={shellRef} className="val-stage">
        {/* 1. TOP TACTICAL HEADER */}
        <header className="val-topbar waiting-room-header">
          <div className="val-top-left">
            <button
              type="button"
              className="val-nav-icon-btn danger page-back-btn"
              onClick={() => leaveRoom()}
              title="ออกจากห้องกลับหน้าหลัก"
            >
              <IconArrowLeft size={15} />
              <span>LEAVE</span>
            </button>

            <button
              type="button"
              className="val-brand-link room-code-banner"
              onClick={copyCode}
              title="คลิกคัดลอกรหัสห้อง 6 หลัก"
            >
              <IconCopy size={13} />
              <span>#{activeRoomId}</span>
              <span style={{ color: copied ? '#4ade80' : '#7dd3fc', fontSize: 10 }}>
                {copied ? 'COPIED' : 'COPY'}
              </span>
            </button>

            {pingMs != null && pingMs > 0 && (
              <span className="val-ping-chip" title="ความหน่วงการเชื่อมต่อ">
                {pingMs}ms
              </span>
            )}
          </div>

          <div className="val-top-right">
            <span className="val-nav-icon-btn active" style={{ cursor: 'default' }}>
              <IconSwords size={14} />
              <span>{isPractice ? 'TRAINING' : isIconic ? 'ICONIC 1v1' : is1v1Side ? '1v1 DUEL' : '3v3 TEAM'}</span>
            </span>

            {!isPractice && (
              <span className="val-nav-icon-btn" style={{ cursor: 'default' }}>
                <span>First to {goalKills}</span>
              </span>
            )}
          </div>
        </header>

        {/* 2. ROOM STATUS HEADER LINE */}
        <div className="val-mode-bar-wrap">
          <div className="val-map-strip">
            <span className="val-map-pill active" style={{ cursor: 'default' }}>
              {getMapDisplayLabel(roomMapId, isIconic)}
            </span>
            <span className="ui-card-sub" style={{ fontSize: 11.5 }}>
              BLUE {bluePlayers.length}/{sideCap} · RED {redPlayers.length}/{isPractice ? dummyRoster.length || 1 : sideCap}
            </span>
          </div>

          {error && (
            <div className="ui-alert error" style={{ maxWidth: 560, width: '100%' }}>
              <span>{error}</span>
              <button type="button" className="ui-alert-close" onClick={() => setError('')} aria-label="ปิดการแจ้งเตือน">
                <IconClose size={13} />
              </button>
            </div>
          )}
        </div>

        {/* 3. MIDDLE WORKSPACE: LEFT RECTANGULAR MAP CARD(S) + VERTICAL SHIELD BANNER ROSTER */}
        <main className="val-workspace">
          <aside className="val-map-dock" aria-label="แผนที่ของห้อง">
            <span className="val-map-dock-label">{isPractice ? 'เลือกแมพซ้อม' : 'MAP ARENA'}</span>
            {PRACTICE_MAPS.map((mp) => {
              const currentMap = isIconic ? 'shibuya' : roomMapId
              const isSelected = currentMap === mp.id
              const disabled = !isPractice
              if (!isPractice && !isSelected) return null
              return (
                <button
                  key={mp.id}
                  type="button"
                  disabled={disabled}
                  className={`val-map-card ${isSelected ? 'active' : ''}`}
                  style={!isPractice ? { height: 116, opacity: 1, cursor: 'default' } : undefined}
                  onClick={() => selectRoomMap(mp.id)}
                >
                  <img src={mp.img} alt={mp.label} className="val-map-card-img" loading="lazy" />
                  <div className="val-map-card-scrim" aria-hidden="true" />
                  <div className="val-map-card-info">
                    <span className="val-map-card-tag">{isSelected ? 'SELECTED' : mp.tag}</span>
                    <span className="val-map-card-name">{mp.label}</span>
                  </div>
                </button>
              )
            })}
          </aside>

          <section className="val-roster-stage" aria-label="รายชื่อผู้เล่นในห้องแบบแบนเนอร์โล่">
            <div className={`val-banner-deck ${sideCap === 3 ? 'six-up' : ''}`}>
              {leftSlots.map((slot) => (
                <TacticalBannerCard key={slot.id} slot={slot} />
              ))}

              <div className="val-vs-divider" aria-hidden="true">
                <div className="val-vs-diamond">
                  <span>VS</span>
                </div>
              </div>

              {rightSlots.map((slot) => (
                <TacticalBannerCard key={slot.id} slot={slot} />
              ))}
            </div>
          </section>
        </main>

        {/* 3.5 COLLAPSIBLE BOTTOM HERO PICKER DRAWER */}
        {heroDrawerOpen && (
          <section className="val-lobby-drawer" aria-label="เลือกเปลี่ยนฮีโร่ในห้องรอ">
            <div className="ui-topbar-group" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="ui-topbar-group" style={{ gap: 8 }}>
                <strong style={{ fontSize: 13 }}>เลือกฮีโร่สำหรับแมตช์นี้</strong>
                {myHeroDef && (
                  <span className="ui-card-sub" style={{ fontSize: 11.5 }}>
                    ปัจจุบัน: {myHeroDef.displayName} (HP {myHeroDef.maxHp} · SPD {myHeroDef.moveSpeed})
                  </span>
                )}
              </div>
              <button
                type="button"
                className="ui-btn icon-only"
                style={{ width: 28, height: 28 }}
                onClick={() => setHeroDrawerOpen(false)}
              >
                <IconClose size={14} />
              </button>
            </div>

            {!isIconic ? (
              <HeroPickerPanel
                characters={characters}
                selectedId={me?.characterId ?? ''}
                compactTabs
                maxHeight={190}
                onSelect={handlePickHeroInRoom}
              />
            ) : (
              <div className="ui-card-sub" style={{ textAlign: 'center', padding: 12 }}>
                โหมด ICONIC ระบบจะสุ่ม Gojo และ Sukuna ให้อัตโนมัติทั้ง 2 ฝั่ง
              </div>
            )}
          </section>
        )}

        {/* 4. BOTTOM TACTICAL CONTROL STRIP */}
        <footer className="val-bottom-bar">
          {/* Bottom-Left: Voice Mic + Speaker (Matches reference bottom-left audio icons) */}
          <div className="val-bottom-left">
            <button
              type="button"
              className={`val-nav-icon-btn ${voiceMicEnabled ? 'active' : 'danger'}`}
              onClick={() => void toggleVoiceMic()}
              title={voiceMicEnabled ? 'ปิดไมค์' : 'เปิดไมค์'}
            >
              <IconMic size={15} off={!voiceMicEnabled} />
              <span>{voiceMicEnabled ? 'ไมค์เปิด' : 'ไมค์ปิด'}</span>
            </button>

            <button
              type="button"
              className={`val-nav-icon-btn ${voiceSpeakerEnabled ? 'active' : 'danger'}`}
              onClick={toggleVoiceSpeaker}
              title={voiceSpeakerEnabled ? 'ปิดเสียงเพื่อน' : 'เปิดฟังเพื่อน'}
            >
              <IconHeadphones size={15} off={!voiceSpeakerEnabled} />
              <span>{voiceSpeakerEnabled ? 'ลำโพงเปิด' : 'ลำโพงปิด'}</span>
            </button>
          </div>

          {/* Bottom-Center: Trio CTA (Change Hero | Crimson START / READY | Leave Party) */}
          <div className="val-bottom-center">
            <button
              type="button"
              className="val-cta-secondary"
              disabled={isIconic}
              onClick={() => setHeroDrawerOpen((v) => !v)}
            >
              <IconUsers size={14} />
              <span>{heroDrawerOpen ? 'ซ่อนตัวเลือก' : 'เปลี่ยนฮีโร่'}</span>
            </button>

            <button
              type="button"
              className="val-cta-crimson waiting-start-btn"
              disabled={me?.isHost ? !isReadyToStart : false}
              onClick={me?.isHost ? startMatch : toggleReady}
            >
              <IconPlay size={15} />
              <span>{mainStartText}</span>
            </button>

            <button
              type="button"
              className="val-cta-secondary"
              onClick={() => leaveRoom()}
            >
              <IconLogOut size={14} />
              <span>Leave Party</span>
            </button>
          </div>

          {/* Bottom-Right: Voice Preview + Mini Skill Summary */}
          <div className="val-bottom-right">
            {myHeroDef && (
              <>
                <button
                  type="button"
                  className="val-nav-icon-btn"
                  onClick={() => {
                    soundEngine.unlock()
                    soundEngine.speakCharacterQuote(myHeroDef.id, myHeroDef.voiceLine)
                  }}
                  title="ทดลองเสียงพากย์"
                >
                  <IconVolume size={14} />
                  <span>{myHeroDef.displayName}</span>
                </button>
                {myHeroDef.skills.slice(0, 3).map((sk) => (
                  <span
                    key={sk.slot}
                    className="val-map-pill"
                    title={`${sk.keyHint}: ${sk.name} — ${sk.description}`}
                    style={{ cursor: 'default' }}
                  >
                    {sk.keyHint} {sk.name.split(' ')[0]}
                  </span>
                ))}
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
