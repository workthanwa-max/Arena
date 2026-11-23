import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { useGameStore } from '../store/useGameStore'
import type { PlayerState, TeamSide } from '../types/game'

export function RoomLobbyPage() {
  const [copied, setCopied] = useState(false)

  const activeRoomId = useGameStore((s) => s.activeRoomId)
  const roomMode = useGameStore((s) => s.roomMode)
  const roomMapId = useGameStore((s) => s.roomMapId)
  const roster = useGameStore((s) => s.roster)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const error = useGameStore((s) => s.error)

  const selectTeam = useGameStore((s) => s.selectTeam)
  const selectRoomMap = useGameStore((s) => s.selectRoomMap)
  const selectRoomCharacter = useGameStore((s) => s.selectRoomCharacter)
  const toggleReady = useGameStore((s) => s.toggleReady)
  const startMatch = useGameStore((s) => s.startMatch)
  const leaveRoom = useGameStore((s) => s.leaveRoom)
  const goBack = useGameStore((s) => s.goBack)
  const setError = useGameStore((s) => s.setError)

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

  function renderTeamColumn(team: TeamSide, title: string, players: PlayerState[]) {
    const slots = is1v1Side ? [0] : [0, 1, 2]
    const canJoinSide = players.length < sideCap && me?.team !== team
    return (
      <div className={`team-draft-col ${team}`}>
        <div className="team-draft-head">
          <span>{title}</span>
          <span className="team-count-pill">
            {players.length} / {sideCap}
          </span>
        </div>

        <div className="team-slot-list">
          {slots.map((idx) => {
            const p = players[idx]
            if (!p) {
              return (
                <div key={idx} className="team-slot-card empty">
                  <span>รอผู้เล่นเข้าร่วมด้วยรหัส #{activeRoomId}...</span>
                  {canJoinSide && (
                    <button
                      type="button"
                      className="btn-pill secondary compact"
                      onClick={() => selectTeam(team as 'blue' | 'red')}
                    >
                      ย้ายมาฝั่งนี้
                    </button>
                  )}
                </div>
              )
            }
            const ch = characters.find((c) => c.id === p.characterId)
            const isMe = p.id === myPlayerId
            return (
              <div key={p.id} className={`team-slot-card filled ${isMe ? 'me' : ''}`}>
                <img
                  src={ch?.imageUrl || (p.characterId === 'noone' ? '/characters/noone.png?v=mcu1' : `/characters/${p.characterId}.png`)}
                  alt={p.characterName}
                  className="slot-hero-avatar"
                />
                <div className="slot-player-meta">
                  <div className="slot-player-name">
                    {p.isHost ? '👑 ' : ''}
                    {p.name}
                    {isMe ? ' (คุณ)' : ''}
                  </div>
                  <div className="slot-hero-name">{p.characterName}</div>
                </div>
                <span className={`slot-ready-badge ${p.ready ? 'ready' : ''}`}>
                  {p.isHost ? 'HOST' : p.ready ? '✓ พร้อม' : 'รอพร้อม'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="lobby-backdrop waiting-room-backdrop">
      <div ref={shellRef} className="waiting-room-shell">
        <header className="top-header waiting-room-header">
          <div className="brand-group">
            <button
              type="button"
              className="btn-pill secondary compact page-back-btn"
              onClick={goBack}
              aria-label="ย้อนกลับ"
              title="ย้อนกลับและออกจากห้องรอ"
            >
              ← ย้อนกลับ
            </button>
            <span className="room-code-banner">รหัสห้อง: {activeRoomId}</span>
            <div>
              <h1 className="brand-title">
                {isPractice
                  ? '🎯 ห้องรอฝึกซ้อม (ทดสอบสกิลกับหุ่น Dummy)'
                  : isIconic
                    ? `⚡ ICONIC 1 vs 1 : GOJO vs SUKUNA (เป้า ${goalKills} Kills ชนะ)`
                    : is1v1Side
                      ? `ห้องดวล 1 vs 1 (เป้า ${goalKills} Kills ชนะ)`
                      : `ห้องรอ 3 vs 3 (เป้า ${goalKills} Kills ชนะ)`}
              </h1>
              <p className="brand-subtitle">
                แผนที่:{' '}
                {isIconic
                  ? '🏙️ ชิบูย่า (มุมมองหลังตัวละคร 3D • สุ่มตัวอัตโนมัติ)'
                  : roomMapId === 'konoha'
                    ? '🍃 หมู่บ้านโคโนฮะ (นารุโตะ)'
                    : '🏙️ ชิบูย่า'}{' '}
                • ผู้เล่น {humanRoster.length}/{totalCap} • เลือกตัวละครแล้วกดเริ่มเข้าสนามพร้อมกัน
              </p>
            </div>
          </div>

          <div className="telemetry-pills">
            <nav className="journey-stepper compact" aria-label="ขั้นตอนการเข้าเล่น">
              <span className="journey-step done">① หน้าหลัก ✓</span>
              <span className="journey-sep">›</span>
              <span className="journey-step done">② สร้างห้อง ✓</span>
              <span className="journey-sep">›</span>
              <span className="journey-step active">③ ห้องรอ &amp; เลือกฮีโร่</span>
              <span className="journey-sep">›</span>
              <span className="journey-step">④ สมรภูมิ</span>
            </nav>
            <button type="button" className="btn-pill secondary compact" onClick={copyCode}>
              {copied ? '✅ คัดลอกรหัสแล้ว' : `📋 คัดลอกรหัส #${activeRoomId}`}
            </button>
            <button type="button" className="btn-pill danger-outline compact" onClick={() => leaveRoom()}>
              🚪 ออกจากห้อง
            </button>
          </div>
        </header>

        {error && (
          <div className="alert-banner" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" className="btn-pill secondary compact" onClick={() => setError('')}>
              ปิด
            </button>
          </div>
        )}

        {/* Side-by-Side 2-Zone Room Workspace: (Left) Team Slots & Room Status | (Right) In-Room Hero Draft & Skills */}
        <div className="waiting-workspace-split">
          <div className="waiting-left-col">
            <div className="surface-card room-roster-box">
              <div className="setup-step-head compact">
                <span className="setup-step-badge">STEP 3A</span>
                <div>
                  <h2 className="home-panel-title">สมาชิกในห้อง ({humanRoster.length}/{totalCap})</h2>
                  <p className="home-panel-sub">
                    แชร์รหัส <strong>#{activeRoomId}</strong> ให้เพื่อนกรอกที่หน้าหลักเพื่อเข้าห้องนี้
                  </p>
                </div>
              </div>

              {isPractice ? (
                <main className="waiting-teams-grid single-col">
                  <div className="team-draft-col blue">
                    <div className="team-draft-head">
                      <span>👤 ผู้ทดสอบ (PLAYER)</span>
                      <span className="team-count-pill">1 / 1</span>
                    </div>
                    <div className="team-slot-list">
                      {humanRoster.map((p) => {
                        const ch = characters.find((c) => c.id === p.characterId)
                        return (
                          <div key={p.id} className="team-slot-card filled me">
                            <img
                              src={ch?.imageUrl || (p.characterId === 'noone' ? '/characters/noone.png?v=mcu1' : `/characters/${p.characterId}.png`)}
                              alt={p.characterName}
                              className="slot-hero-avatar"
                            />
                            <div className="slot-player-meta">
                              <div className="slot-player-name">👑 {p.name} (คุณ)</div>
                              <div className="slot-hero-name">{p.characterName}</div>
                            </div>
                            <span className="slot-ready-badge ready">พร้อม</span>
                          </div>
                        )
                      })}
                      <div className="practice-map-pills">
                        <span className="field-label">เปลี่ยนแผนที่ฝึกซ้อม:</span>
                        <div className="practice-map-row">
                          <button
                            type="button"
                            className={`btn-pill compact ${roomMapId === 'shibuya' ? 'primary' : 'secondary'}`}
                            onClick={() => selectRoomMap('shibuya')}
                          >
                            🏙️ ชิบูย่า
                          </button>
                          <button
                            type="button"
                            className={`btn-pill compact ${roomMapId === 'konoha' ? 'primary' : 'secondary'}`}
                            onClick={() => selectRoomMap('konoha')}
                          >
                            🍃 หมู่บ้านโคโนฮะ
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="team-draft-col red">
                    <div className="team-draft-head">
                      <span>🎯 หุ่นเป้าหมาย (TRAINING DUMMIES)</span>
                      <span className="team-count-pill">{dummyRoster.length} ตัว</span>
                    </div>
                    <div className="team-slot-list">
                      {dummyRoster.map((d) => (
                        <div key={d.id} className="team-slot-card filled">
                          <img src="/app-icon.png?v=20261120v2" alt={d.name} className="slot-hero-avatar" />
                          <div className="slot-player-meta">
                            <div className="slot-player-name">{d.name}</div>
                            <div className="slot-hero-name">HP {d.maxHp} • รีเลือดอัตโนมัติ</div>
                          </div>
                          <span className="slot-ready-badge ready">TARGET</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </main>
              ) : (
                <main className="waiting-teams-grid single-col">
                  {renderTeamColumn(
                    'blue',
                    is1v1Side ? '🔵 ผู้ท้าชิง 1 (BLUE)' : '🔵 ทีมสีน้ำเงิน (BLUE TEAM)',
                    bluePlayers,
                  )}
                  {renderTeamColumn(
                    'red',
                    is1v1Side ? '🔴 ผู้ท้าชิง 2 (RED)' : '🔴 ทีมสีแดง (RED TEAM)',
                    redPlayers,
                  )}
                </main>
              )}
            </div>
          </div>

          <div className="waiting-right-col">
            {!isIconic ? (
              <section className="surface-card room-hero-draft-box" aria-label="เลือกตัวละครภายในห้อง">
                <div className="setup-step-head compact">
                  <span className="setup-step-badge accent">STEP 3B</span>
                  <div>
                    <h2 className="home-panel-title">🎭 เลือกฮีโร่ที่จะใช้ลงสนาม</h2>
                    <p className="home-panel-sub">
                      แตะเลือกตัวละครด้านล่างเพื่อสลับฮีโร่ก่อนหัวหน้าห้องกดเริ่มเกม
                    </p>
                  </div>
                </div>

                {myHeroDef && (
                  <div className="room-active-hero-spotlight">
                    <img
                      src={myHeroDef.imageUrl}
                      alt={myHeroDef.displayName}
                      className="room-spotlight-avatar"
                    />
                    <div className="room-spotlight-info">
                      <div className="room-spotlight-top">
                        <div>
                          <div className="room-spotlight-name">
                            {myHeroDef.displayName} • <span>{myHeroDef.animeTitle}</span>
                          </div>
                          <div className="room-spotlight-stats">
                            ❤️ HP {myHeroDef.maxHp} • ⚡ Speed {myHeroDef.moveSpeed} • {myHeroDef.roleTag}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-pill secondary compact"
                          onClick={() => {
                            soundEngine.unlock()
                            soundEngine.speakCharacterQuote(myHeroDef.id, myHeroDef.voiceLine)
                          }}
                        >
                          🔊 ฟังเสียงพากย์
                        </button>
                      </div>
                      <div className="room-picked-skills">
                        {myHeroDef.skills.map((sk) => (
                          <span key={sk.slot} className="room-skill-mini" title={sk.description}>
                            <img src={sk.iconUrl || `/skills/${myHeroDef.id}_${sk.slot}.png`} alt={sk.name} />
                            <span>
                              {sk.keyHint}: {sk.name}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="inline-hero-grid">
                  {characters.map((c) => {
                    const isPicked = me?.characterId === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`inline-hero-chip ${isPicked ? 'active' : ''}`}
                        style={isPicked ? { borderColor: c.color } : undefined}
                        onClick={() => handlePickHeroInRoom(c.id)}
                      >
                        <img src={c.imageUrl} alt={c.displayName} className="inline-hero-thumb" />
                        <div className="inline-hero-text">
                          <span className="inline-hero-name">
                            {c.displayName}
                            {c.adminOnly ? ' 👑' : ''}
                          </span>
                          <span className="inline-hero-anime">{c.animeTitle}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : (
              <section className="surface-card room-iconic-briefing" aria-label="ข้อมูลโหมด ICONIC">
                <div className="setup-step-head compact">
                  <span className="setup-step-badge accent">ICONIC 1v1</span>
                  <div>
                    <h2 className="home-panel-title">⚡ ระบบสุ่มตัวละครอัตโนมัติ (Gojo vs Sukuna)</h2>
                    <p className="home-panel-sub">
                      โหมดนี้ล็อกตัวละคร 2 ตำนานและสุ่มให้แต่ละฝ่ายไม่ซ้ำกันโดยอัตโนมัติ
                    </p>
                  </div>
                </div>

                {myHeroDef && (
                  <div className="room-active-hero-spotlight">
                    <img
                      src={myHeroDef.imageUrl}
                      alt={myHeroDef.displayName}
                      className="room-spotlight-avatar"
                    />
                    <div className="room-spotlight-info">
                      <div className="room-spotlight-name">
                        ตัวที่คุณได้รับ: {myHeroDef.displayName} ({myHeroDef.animeTitle})
                      </div>
                      <div className="room-spotlight-stats">
                        🎲 สุ่มอัตโนมัติไม่ซ้ำกับคู่ต่อสู้ • 🎵 เพลงประกอบ Judas (Gojo vs Sukuna)
                      </div>
                      <div className="room-picked-skills">
                        {myHeroDef.skills.map((sk) => (
                          <span key={sk.slot} className="room-skill-mini" title={sk.description}>
                            <img src={sk.iconUrl || `/skills/${myHeroDef.id}_${sk.slot}.png`} alt={sk.name} />
                            <span>
                              {sk.keyHint}: {sk.name}
                            </span>
                          </span>
                        ))}
                        <span className="room-skill-mini">
                          <img src="/skills/iconic_rct.png" alt="RCT" />
                          <span>G: ไสยเวทย้อนกลับ (รีเลือดเต็มทุก 5 วิ)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        <footer className="surface-card waiting-footer-bar">
          <div className="waiting-my-hero">
            {isIconic ? (
              <span className="pill-badge accent">
                🎲 สุ่มอัตโนมัติ: {me?.characterName ?? 'Gojo / Sukuna'} (ห้ามเลือกตัวซ้ำ)
              </span>
            ) : (
              <span className="pill-badge accent">
                🎭 ตัวที่เลือก: {me?.characterName ?? myHeroDef?.displayName ?? 'ป๊ะ'}
              </span>
            )}
            {!me?.isHost && (
              <button
                type="button"
                className={`btn-pill ${me?.ready ? 'secondary' : 'primary'}`}
                onClick={toggleReady}
              >
                {me?.ready ? '✓ พร้อมแล้ว (คลิกยกเลิก)' : '⚡ กดพร้อมเล่น'}
              </button>
            )}
          </div>

          {me?.isHost ? (
            <button
              type="button"
              className="btn-pill primary waiting-start-btn"
              disabled={!isReadyToStart}
              onClick={startMatch}
            >
              {isReadyToStart
                ? isPractice
                  ? '🚀 เริ่มทดสอบในสมรภูมิ! (Step 4)'
                  : isIconic
                    ? '⚡ เริ่มศึก ICONIC: GOJO vs SUKUNA! (Step 4)'
                    : is1v1Side
                      ? '🚀 เริ่มดวล 1v1 ทันที! (Step 4)'
                      : '🚀 เริ่มเกม 3v3 ทันที! (Step 4)'
                : `⏳ รอผู้เล่นเข้าครบ ${totalCap} คนก่อนเริ่ม (${humanRoster.length}/${totalCap})`}
            </button>
          ) : (
            <div className="waiting-host-status">
              {isReadyToStart
                ? `✅ ครบ ${totalCap}/${totalCap} คนแล้ว — รอหัวหน้าห้องกดเริ่มเกม (เข้าพร้อมกัน)...`
                : `⏳ รอผู้เล่นเข้าให้ครบ ${totalCap} คน (${humanRoster.length}/${totalCap})`}
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
