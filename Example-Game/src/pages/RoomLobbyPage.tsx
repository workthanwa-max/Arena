import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { getMapDisplayLabel, HERO_CLASS_FILTERS, type HeroClassFilter } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'
import type { PlayerState, TeamSide } from '../types/game'

export function RoomLobbyPage() {
  const [copied, setCopied] = useState(false)
  const [classFilter, setClassFilter] = useState<HeroClassFilter>('all')

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
  const goBack = useGameStore((s) => s.goBack)
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
        <div key={`${team}-empty-${idx}`} className={`mlbb-banner-card empty ${team}`}>
          <div className="mlbb-banner-ping">-- ms</div>
          <div className="mlbb-banner-avatar-ring empty">
            <span>?</span>
          </div>
          <div className="mlbb-banner-name">รอผู้เล่น</div>
          <div className="mlbb-banner-sub">#{activeRoomId}</div>
          {canJoinSide && (
            <button
              type="button"
              className="mlbb-swap-btn"
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
        className={`mlbb-banner-card filled team-slot-card ${team} ${isMe ? 'me' : ''} ${isSpeaking ? 'voice-speaking' : ''}`}
      >
        <div className="mlbb-banner-top-row">
          <span className="mlbb-banner-ping">
            {p.isDummy ? 'DUMMY' : isMe && pingMs !== null ? `${pingMs}ms` : 'ONLINE'}
          </span>
          <span className={`mlbb-ready-dot ${p.isHost || p.ready || p.isDummy ? 'ready' : ''}`}>
            {p.isHost ? '👑' : p.ready || p.isDummy ? '✓' : '…'}
          </span>
        </div>

        <div className="mlbb-banner-avatar-ring" style={{ borderColor: ch?.color || (team === 'blue' ? '#38bdf8' : '#ef4444') }}>
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
        <div className="mlbb-banner-hero slot-hero-name">
          {p.isDummy ? `HP ${p.maxHp}` : p.characterName}
        </div>

        {!p.isDummy && vState && (
          <span
            className={`slot-voice-tag ${vState.micOn ? 'on' : 'off'} ${isSpeaking ? 'speaking' : ''}`}
            title={isSpeaking ? 'กำลังพูดอยู่' : vState.micOn ? 'เปิดไมค์อยู่' : 'ปิดไมค์'}
          >
            {vState.micOn ? (isSpeaking ? '🎙️ พูดอยู่' : '🎙️ ไมค์เปิด') : '🎙️✕'}
            {!vState.speakerOn ? ' 🎧✕' : ''}
          </span>
        )}
      </div>
    )
  }

  const leftSlots = isPractice ? [0] : is1v1Side ? [0] : [0, 1, 2]
  const rightSlots = isPractice ? [0, 1] : is1v1Side ? [0] : [0, 1, 2]
  const leftList = isPractice ? humanRoster : bluePlayers
  const rightList = isPractice ? dummyRoster : redPlayers

  return (
    <div className="mlbb-dark-page waiting-room-backdrop">
      <div ref={shellRef} className="mlbb-lobby-shell waiting-room-shell">
        {/* TOP BAR */}
        <header className="mlbb-sub-topbar waiting-room-header">
          <div className="mlbb-sub-left">
            <button
              type="button"
              className="mlbb-glass-btn compact page-back-btn"
              onClick={goBack}
              aria-label="ย้อนกลับ"
            >
              ← ย้อนกลับ
            </button>
            <button
              type="button"
              className="mlbb-room-pill room-code-banner clickable-code"
              onClick={copyCode}
              title="คลิกเพื่อคัดลอกรหัสห้อง"
            >
              รหัสห้อง: {activeRoomId} {copied ? '✓' : '📋'}
            </button>
            <h1 className="mlbb-sub-title brand-title">
              {isPractice
                ? '🎯 ห้องฝึกซ้อม'
                : isIconic
                  ? `⚡ ICONIC 1 vs 1 : GOJO vs SUKUNA (เป้า ${goalKills} Kills ชนะ)`
                  : is1v1Side
                    ? `ห้องดวล 1 vs 1 (เป้า ${goalKills} Kills ชนะ)`
                    : `ห้อง 3 vs 3 (เป้า ${goalKills} Kills ชนะ)`}
            </h1>
          </div>

          <div className="mlbb-sub-right telemetry-pills">
            <button
              type="button"
              className={`mlbb-glass-btn compact lobby-voice-pill ${voiceMicEnabled ? 'mic-on' : 'mic-off'} ${voiceSpeaking ? 'speaking' : ''}`}
              onClick={() => void toggleVoiceMic()}
              title={voiceMicEnabled ? 'ไมค์เปิดอยู่ (คลิกเพื่อปิดไมค์)' : 'ไมค์ปิดอยู่ (คลิกเพื่อเปิดไมค์คุยกับเพื่อนในห้อง)'}
              aria-label="เปิด/ปิดไมค์ในห้อง"
            >
              {voiceMicEnabled ? '🎙️ ไมค์: เปิด' : '🎙️✕ ไมค์: ปิด'}
            </button>
            <button
              type="button"
              className={`mlbb-glass-btn compact lobby-voice-pill ${voiceSpeakerEnabled ? 'spk-on' : 'spk-off'}`}
              onClick={toggleVoiceSpeaker}
              title={voiceSpeakerEnabled ? 'ลำโพงคุยเปิดอยู่ (คลิกเพื่อปิดเสียงพูดในห้อง)' : 'ลำโพงคุยปิดอยู่ (คลิกเพื่อเปิดฟังเพื่อนในห้อง)'}
              aria-label="เปิด/ปิดลำโพงในห้อง"
            >
              {voiceSpeakerEnabled ? '🎧 ลำโพง: เปิด' : '🎧✕ ลำโพง: ปิด'}
            </button>
            <span className="mlbb-meta-pill">{getMapDisplayLabel(roomMapId, isIconic)}</span>
            <span className="mlbb-meta-pill accent">
              👤 {humanRoster.length}/{totalCap}
            </span>
            <button type="button" className="mlbb-glass-btn danger compact" onClick={() => leaveRoom()}>
              ออกจากห้อง
            </button>
          </div>
        </header>

        {error && (
          <div className="mlbb-alert-toast inline" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" className="mlbb-glass-btn compact" onClick={() => setError('')}>
              ปิด
            </button>
          </div>
        )}

        {/* MLBB SYMMETRICAL VS LINEUP STAGE (Inspired by Reference Images 2 & 3!) */}
        <section className="mlbb-vs-stage" aria-label="รายชื่อทีมในห้อง">
          <div className="mlbb-vs-wing blue">
            <div className="mlbb-wing-head blue">
              <span>{isPractice ? '👤 ผู้เล่น' : '🔵 BLUE TEAM'}</span>
              <span>
                {leftList.length}/{isPractice ? 1 : sideCap}
              </span>
            </div>
            <div className="mlbb-banner-row">
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

          <div className="mlbb-vs-medallion" aria-hidden="true">
            <div className="mlbb-vs-orb">
              <span>VS</span>
            </div>
            <div className="mlbb-vs-sub">
              {isPractice ? 'TRAINING' : `เป้า ${goalKills} KILLS`}
            </div>
          </div>

          <div className="mlbb-vs-wing red">
            <div className="mlbb-wing-head red">
              <span>{isPractice ? '🎯 หุ่นซ้อม (DUMMY)' : '🔴 RED TEAM'}</span>
              <span>
                {rightList.length}/{isPractice ? dummyRoster.length : sideCap}
              </span>
            </div>
            <div className="mlbb-banner-row">
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

        {/* CENTER ACTION BAR: Start Game / Ready + Practice Map Toggle */}
        <div className="mlbb-vs-action-strip waiting-footer-bar">
          <div className="mlbb-vs-action-left waiting-my-hero">
            <span className="mlbb-meta-pill accent">
              {isIconic
                ? `🎲 ${me?.characterName ?? 'Gojo / Sukuna'}`
                : `🎭 ฮีโร่ของคุณ: ${me?.characterName ?? myHeroDef?.displayName ?? 'ป๊ะ'}`}
            </span>

            {isPractice && (
              <div className="mlbb-map-switch">
                <button
                  type="button"
                  className={`mlbb-glass-btn compact ${roomMapId === 'shibuya' ? 'active' : ''}`}
                  onClick={() => selectRoomMap('shibuya')}
                >
                  🏙️ ชิบูย่า
                </button>
                <button
                  type="button"
                  className={`mlbb-glass-btn compact ${roomMapId === 'konoha' ? 'active' : ''}`}
                  onClick={() => selectRoomMap('konoha')}
                >
                  🍃 โคโนฮะ
                </button>
                <button
                  type="button"
                  className={`mlbb-glass-btn compact ${roomMapId === 'sisaket_island' ? 'active' : ''}`}
                  onClick={() => selectRoomMap('sisaket_island')}
                >
                  🏝️ เกาะกลางน้ำ
                </button>
                <button
                  type="button"
                  className={`mlbb-glass-btn compact ${roomMapId === 'scp_site' ? 'active' : ''}`}
                  onClick={() => selectRoomMap('scp_site')}
                >
                  🧪 สถานี SCP
                </button>
              </div>
            )}

            {!me?.isHost && (
              <button
                type="button"
                className={`mlbb-glass-btn ${me?.ready ? 'active' : ''}`}
                onClick={toggleReady}
              >
                {me?.ready ? '✓ พร้อมแล้ว' : '⚡ กดพร้อม'}
              </button>
            )}
          </div>

          {me?.isHost ? (
            <button
              type="button"
              className="mlbb-gold-cta compact waiting-start-btn"
              disabled={!isReadyToStart}
              onClick={startMatch}
            >
              {isReadyToStart
                ? isPractice
                  ? '🎯 เริ่มฝึกซ้อม'
                  : '⚔️ เริ่มเกมเลย!'
                : `รอผู้เล่นครบ (${humanRoster.length}/${totalCap})`}
            </button>
          ) : (
            <div className="mlbb-wait-host-note">รอหัวหน้าห้องกดเริ่มเกม...</div>
          )}
        </div>

        {/* BOTTOM PANEL: Live 3D Hero Preview + In-Room Hero Picker */}
        <section className="mlbb-lobby-draft-deck" aria-label="เลือกตัวละครพร้อมโมเดล 3D">
          {myHeroDef && (
            <div className="mlbb-draft-3d-spotlight">
              <Hero3dPreview character={myHeroDef} size="md" />
              <div className="mlbb-draft-hero-meta">
                <div className="mlbb-draft-meta-top">
                  <div>
                    <h2 className="mlbb-draft-hero-name">
                      {myHeroDef.displayName} <span>• {myHeroDef.animeTitle}</span>
                    </h2>
                    <div className="mlbb-draft-hero-stats">
                      ❤️ HP {myHeroDef.maxHp} • ⚡ Speed {myHeroDef.moveSpeed} •{' '}
                      {myHeroDef.classIcon ? `${myHeroDef.classIcon} ${myHeroDef.className}` : myHeroDef.roleTag}
                    </div>
                    {myHeroDef.classTraitLabel && (
                      <div
                        className="mlbb-draft-class-note"
                        style={{ color: myHeroDef.classColor || '#7dd3fc' }}
                      >
                        ✦ {myHeroDef.classTraitLabel}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mlbb-glass-btn compact"
                    onClick={() => {
                      soundEngine.unlock()
                      soundEngine.speakCharacterQuote(myHeroDef.id, myHeroDef.voiceLine)
                    }}
                  >
                    🔊 เสียงพากย์
                  </button>
                </div>

                <div className="mlbb-draft-skills-row">
                  {myHeroDef.skills.map((sk) => (
                    <div key={sk.slot} className="mlbb-mini-skill-chip" title={sk.description}>
                      <img src={sk.iconUrl || `/skills/${myHeroDef.id}_${sk.slot}.png`} alt={sk.name} />
                      <span>
                        <strong>{sk.keyHint}</strong> {sk.name}
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
            <div className="mlbb-draft-grid-wrap room-hero-draft-box">
              <div className="mlbb-draft-grid-head">เลือกฮีโร่ลงสนาม ({characters.length} ตัว • 5 ประเภท)</div>
              <div className="mlbb-class-filter-bar compact" role="tablist" aria-label="กรองสายฮีโร่ในห้อง">
                {HERO_CLASS_FILTERS.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    role="tab"
                    aria-selected={classFilter === cls.id}
                    className={`mlbb-class-pill compact ${classFilter === cls.id ? 'active' : ''}`}
                    style={{ '--class-accent': cls.color } as React.CSSProperties}
                    title={cls.traitSummary}
                    onClick={() => setClassFilter(cls.id)}
                  >
                    <span>{cls.icon}</span>
                    <span>{cls.shortName}</span>
                  </button>
                ))}
              </div>
              <div className="mlbb-hero-pick-grid">
                {(classFilter === 'all' ? characters : characters.filter((c) => c.heroClass === classFilter)).map(
                  (c) => {
                    const isPicked = me?.characterId === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`mlbb-hero-pick-tile inline-hero-chip ${isPicked ? 'active' : ''}`}
                        style={{ '--hero-accent': c.color } as React.CSSProperties}
                        onClick={() => handlePickHeroInRoom(c.id)}
                      >
                        <div className="mlbb-pick-thumb-wrap">
                          <img src={c.imageUrl} alt={c.displayName} className="mlbb-pick-thumb" />
                          {c.classIcon && (
                            <span
                              className="mlbb-hero-class-pip"
                              style={{ borderColor: c.classColor || '#38bdf8' }}
                              title={c.className}
                            >
                              {c.classIcon}
                            </span>
                          )}
                          {c.adminOnly && <span className="moba-crown-tag">👑</span>}
                        </div>
                        <span className="mlbb-pick-name">{c.displayName}</span>
                      </button>
                    )
                  },
                )}
              </div>
            </div>
          ) : (
            <div className="mlbb-iconic-lock-note">
              <span>⚡ โหมด ICONIC ระบบสุ่มตัวละคร Gojo vs Sukuna ให้อัตโนมัติทั้ง 2 ฝั่ง</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
