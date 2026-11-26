import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { HeroPickerPanel } from '../components/HeroPickerPanel'
import {
  IconArrowLeft,
  IconCopy,
  IconHeadphones,
  IconMic,
  IconPlay,
  IconVolume,
} from '../components/Icons'
import { getMapDisplayLabel } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'
import type { PlayerState, TeamSide } from '../types/game'

export function RoomLobbyPage() {
  const [copied, setCopied] = useState(false)

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
  }

  function renderBannerSlot(p: PlayerState | undefined, team: TeamSide, idx: number, canJoinSide: boolean) {
    if (!p) {
      return (
        <div key={`${team}-empty-${idx}`} className="clean-player-card empty">
          <div className="mlbb-banner-avatar-ring empty" style={{ width: 46, height: 46, fontSize: 16 }}>
            <span>?</span>
          </div>
          <div className="mlbb-banner-name">รอผู้เล่น</div>
          {canJoinSide && (
            <button
              type="button"
              className="ui-btn"
              style={{ height: 26, fontSize: 11, padding: '0 10px' }}
              onClick={() => selectTeam(team as 'blue' | 'red')}
            >
              สลับฝั่ง
            </button>
          )}
        </div>
      )
    }

    const ch = characters.find((c) => c.id === p.characterId)
    const isMe = p.id === myPlayerId
    const vState = isMe
      ? { micOn: voiceMicEnabled, speakerOn: voiceSpeakerEnabled, speaking: voiceSpeaking }
      : peerVoiceStates[p.id]
    const isSpeaking = Boolean(vState?.micOn && vState?.speaking)

    return (
      <div
        key={p.id}
        className={`clean-player-card team-slot-card ${isMe ? 'me' : ''} ${isSpeaking ? 'voice-speaking' : ''}`}
      >
        <div className="mlbb-banner-top-row">
          <span className="mlbb-banner-ping" style={{ fontSize: 10 }}>
            {p.isDummy ? 'DUMMY' : isMe && pingMs !== null ? `${pingMs}ms` : 'ONLINE'}
          </span>
          <span className={`mlbb-ready-dot ${p.isHost || p.ready || p.isDummy ? 'ready' : ''}`}>
            {p.isHost ? 'H' : p.ready || p.isDummy ? '✓' : '…'}
          </span>
        </div>

        <div
          className="mlbb-banner-avatar-ring"
          style={{ width: 48, height: 48, borderColor: ch?.color || (team === 'blue' ? '#38bdf8' : '#f87171') }}
        >
          <img
            src={
              p.isDummy
                ? '/app-icon.png?v=20261120v2'
                : ch?.imageUrl || (p.characterId === 'noone' ? '/characters/noone.png?v=mcu1' : `/characters/${p.characterId}.png`)
            }
            alt={p.characterName}
            className="mlbb-banner-avatar-img"
          />
        </div>

        <div className="mlbb-banner-name slot-player-name">
          {p.name}
          {isMe ? ' (คุณ)' : ''}
        </div>
        <div className="mlbb-banner-hero slot-hero-name" style={{ color: 'var(--text-secondary)' }}>
          {p.isDummy ? `HP ${p.maxHp}` : p.characterName}
        </div>
      </div>
    )
  }

  const leftSlots = isPractice ? [0] : is1v1Side ? [0] : [0, 1, 2]
  const rightSlots = isPractice ? [0, 1] : is1v1Side ? [0] : [0, 1, 2]
  const leftList = isPractice ? humanRoster : bluePlayers
  const rightList = isPractice ? dummyRoster : redPlayers

  return (
    <div className="ui-page waiting-room-backdrop">
      <div ref={shellRef} className="ui-shell waiting-room-shell">
        {/* Top Bar: Clean 4-item Room Header */}
        <header className="ui-topbar waiting-room-header">
          <div className="ui-topbar-group">
            <button
              type="button"
              className="ui-btn page-back-btn"
              onClick={() => leaveRoom()}
              aria-label="ออกจากห้อง"
            >
              <IconArrowLeft size={15} />
              <span>ออกจากห้อง</span>
            </button>

            <button
              type="button"
              className="ui-pill gold room-code-banner clickable-code"
              onClick={copyCode}
              title="คลิกเพื่อคัดลอกรหัสห้อง"
            >
              <span>#{activeRoomId}</span>
              <IconCopy size={13} copied={copied} />
            </button>

            <h1 className="ui-page-title">
              {isPractice
                ? 'ห้องฝึกซ้อม'
                : isIconic
                  ? `ICONIC 1v1 (${goalKills} Kills)`
                  : is1v1Side
                    ? `1v1 Duel (${goalKills} Kills)`
                    : `ทีม 3v3 (${goalKills} Kills)`}
            </h1>
          </div>

          <div className="ui-topbar-group">
            <span className="ui-pill">{getMapDisplayLabel(roomMapId, isIconic)}</span>
            <span className="ui-pill accent">
              {humanRoster.length}/{totalCap} คน
            </span>
          </div>
        </header>

        {error && (
          <div className="ui-alert" role="alert">
            <span>{error}</span>
            <button type="button" className="ui-btn" style={{ height: 28 }} onClick={() => setError('')}>
              ปิด
            </button>
          </div>
        )}

        {/* Symmetrical VS Stage */}
        <section className="clean-vs-stage" aria-label="รายชื่อทีมในห้อง">
          <div className="clean-wing">
            <div className="clean-wing-head blue">
              <span>{isPractice ? 'ผู้เล่น' : 'BLUE TEAM'}</span>
              <span>
                {leftList.length}/{isPractice ? 1 : sideCap}
              </span>
            </div>
            <div className="clean-slot-row">
              {leftSlots.map((idx) =>
                renderBannerSlot(
                  leftList[idx],
                  'blue',
                  idx,
                  !isPractice && bluePlayers.length < sideCap && me?.team !== 'blue',
                ),
              )}
            </div>
          </div>

          <div className="clean-vs-badge" aria-hidden="true">
            VS
          </div>

          <div className="clean-wing">
            <div className="clean-wing-head red">
              <span>{isPractice ? 'หุ่นซ้อม (DUMMY)' : 'RED TEAM'}</span>
              <span>
                {rightList.length}/{isPractice ? dummyRoster.length : sideCap}
              </span>
            </div>
            <div className="clean-slot-row">
              {rightSlots.map((idx) =>
                renderBannerSlot(
                  rightList[idx],
                  'red',
                  idx,
                  !isPractice && redPlayers.length < sideCap && me?.team !== 'red',
                ),
              )}
            </div>
          </div>
        </section>

        {/* Action Strip: Voice + Map Switch (Practice) + Ready / Start */}
        <div className="ui-topbar waiting-footer-bar">
          <div className="ui-topbar-group waiting-my-hero">
            <button
              type="button"
              className={`ui-btn ${voiceMicEnabled ? 'success' : ''}`}
              onClick={() => void toggleVoiceMic()}
              title={voiceMicEnabled ? 'ปิดไมค์' : 'เปิดไมค์'}
            >
              <IconMic size={15} off={!voiceMicEnabled} />
              <span>{voiceMicEnabled ? 'ไมค์เปิด' : 'ไมค์ปิด'}</span>
            </button>

            <button
              type="button"
              className={`ui-btn ${voiceSpeakerEnabled ? 'active' : 'danger'}`}
              onClick={toggleVoiceSpeaker}
              title={voiceSpeakerEnabled ? 'ปิดเสียงเพื่อน' : 'เปิดฟังเพื่อน'}
            >
              <IconHeadphones size={15} off={!voiceSpeakerEnabled} />
              <span>{voiceSpeakerEnabled ? 'ลำโพงเปิด' : 'ลำโพงปิด'}</span>
            </button>

            {isPractice && (
              <div className="ui-topbar-group" style={{ gap: 6 }}>
                {(
                  [
                    ['shibuya', 'ชิบูย่า'],
                    ['konoha', 'โคโนฮะ'],
                    ['sisaket_island', 'เกาะศรีสะเกษ'],
                    ['scp_site', 'สถานี SCP'],
                  ] as const
                ).map(([mId, label]) => (
                  <button
                    key={mId}
                    type="button"
                    className={`ui-btn ${roomMapId === mId ? 'active' : ''}`}
                    style={{ height: 30, fontSize: 12, padding: '0 10px' }}
                    onClick={() => selectRoomMap(mId)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ui-topbar-group">
            {!me?.isHost && (
              <button
                type="button"
                className={`ui-btn ${me?.ready ? 'success' : 'primary'}`}
                onClick={toggleReady}
              >
                {me?.ready ? 'พร้อมแล้ว' : 'กดพร้อม'}
              </button>
            )}

            {me?.isHost ? (
              <button
                type="button"
                className="ui-btn cta-gold waiting-start-btn"
                disabled={!isReadyToStart}
                onClick={startMatch}
              >
                <IconPlay size={15} />
                <span>
                  {isReadyToStart
                    ? isPractice
                      ? 'เริ่มฝึกซ้อม'
                      : 'เริ่มเกม'
                    : `รอผู้เล่นครบ (${humanRoster.length}/${totalCap})`}
                </span>
              </button>
            ) : (
              <span className="ui-card-sub">รอหัวหน้าห้องกดเริ่มเกม...</span>
            )}
          </div>
        </div>

        {/* Bottom Panel: Compact 3D Preview + Searchable Hero Grid */}
        <section className="clean-lobby-draft" aria-label="เลือกตัวละคร">
          {myHeroDef && (
            <div className="ui-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Hero3dPreview character={myHeroDef} size="md" frameless />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                      {myHeroDef.displayName}
                    </h2>
                    <div className="ui-card-sub">
                      {myHeroDef.animeTitle} · HP {myHeroDef.maxHp} · Speed {myHeroDef.moveSpeed}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ui-btn icon-only"
                    style={{ height: 30, width: 30 }}
                    title="ทดลองเสียงพากย์"
                    onClick={() => {
                      soundEngine.unlock()
                      soundEngine.speakCharacterQuote(myHeroDef.id, myHeroDef.voiceLine)
                    }}
                  >
                    <IconVolume size={14} />
                  </button>
                </div>

                {myHeroDef.classTraitLabel && (
                  <div className="ui-card-sub" style={{ fontSize: 12 }}>
                    {myHeroDef.classIcon} {myHeroDef.classTraitLabel}
                  </div>
                )}

                <div className="mlbb-draft-skills-row">
                  {myHeroDef.skills.map((sk) => (
                    <div key={sk.slot} className="mlbb-mini-skill-chip" title={sk.description}>
                      <img src={sk.iconUrl || `/skills/${myHeroDef.id}_${sk.slot}.png`} alt={sk.name} />
                      <span>
                        <strong>{sk.keyHint}</strong> {sk.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                  {isIconic && (
                    <div className="mlbb-mini-skill-chip">
                      <img src="/skills/iconic_rct.png" alt="RCT" />
                      <span>
                        <strong>G</strong> ไสยเวทย้อนกลับ
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isIconic ? (
            <div className="ui-card room-hero-draft-box">
              <HeroPickerPanel
                characters={characters}
                selectedId={me?.characterId ?? ''}
                compactTabs
                maxHeight={220}
                onSelect={handlePickHeroInRoom}
              />
            </div>
          ) : (
            <div className="ui-card" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <span className="ui-card-sub">
                โหมด ICONIC ระบบจะสุ่ม Gojo และ Sukuna ให้อัตโนมัติทั้ง 2 ฝั่ง
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
