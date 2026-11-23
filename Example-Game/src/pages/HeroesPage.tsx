import { useEffect, useRef } from 'react'
import { animateShowroomSwap } from '../animations/gsapPresets'
import { CHARACTER_VOICES, soundEngine } from '../audio/soundEngine'
import { useGameStore } from '../store/useGameStore'

export function HeroesPage() {
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const viewingCharId = useGameStore((s) => s.viewingCharId)
  const inspectCharacter = useGameStore((s) => s.inspectCharacter)
  const startPracticeMode = useGameStore((s) => s.startPracticeMode)
  const setView = useGameStore((s) => s.setView)
  const goBack = useGameStore((s) => s.goBack)

  const showroomContentRef = useRef<HTMLDivElement | null>(null)
  const swapDirRef = useRef(1)
  const touchSwipeStartX = useRef<number | null>(null)

  const activeId = viewingCharId || characters[0]?.id || 'pa'
  const selectedIndex = Math.max(
    0,
    characters.findIndex((c) => c.id === activeId),
  )
  const activeChar = characters[selectedIndex] ?? characters[0]

  useEffect(() => {
    animateShowroomSwap(showroomContentRef.current, swapDirRef.current)
  }, [activeChar?.id])

  function inspectHero(nextId: string, dir = 1) {
    soundEngine.unlock()
    swapDirRef.current = dir
    inspectCharacter(nextId)
    const ch = characters.find((c) => c.id === nextId)
    soundEngine.speakCharacterQuote(nextId, ch?.voiceLine)
  }

  function stepHero(delta: number) {
    if (characters.length === 0) return
    const nextIdx = (selectedIndex + delta + characters.length) % characters.length
    inspectHero(characters[nextIdx].id, delta >= 0 ? 1 : -1)
  }

  return (
    <div className="lobby-backdrop heroes-page-wrap">
      <div className="heroes-page-shell">
        <header className="top-header heroes-header">
          <div className="brand-group">
            <button
              type="button"
              className="btn-pill secondary compact page-back-btn"
              onClick={goBack}
              aria-label="ย้อนกลับ"
            >
              ← ย้อนกลับ
            </button>
            <div>
              <h1 className="brand-title">ตัวละครที่ฉันมี (My Characters)</h1>
              <p className="brand-subtitle">
                ดูรายชื่อฮีโร่ที่คุณครอบครองและรายละเอียดสกิลทั้งหมด • เลือกตัวเล่นจริงได้เมื่ออยู่ในห้อง
              </p>
            </div>
          </div>

          <div className="heroes-header-actions">
            <span className="pill-badge online">✓ ครอบครอง {characters.length} ตัวละคร</span>
            {activeChar && (
              <button
                type="button"
                className="btn-pill secondary compact"
                onClick={() => {
                  soundEngine.unlock()
                  void startPracticeMode(activeChar.id)
                }}
              >
                🎯 ทดลอง {activeChar.displayName} กับ Dummy
              </button>
            )}
            <button
              type="button"
              className="btn-pill primary compact"
              onClick={() => {
                soundEngine.unlock()
                setView('battle_setup')
              }}
            >
              ⚔️ ไปหน้าสร้างห้องเข้าสมรภูมิ →
            </button>
          </div>
        </header>

        <main className="my-heroes-split">
          {/* Left: Collectible Grid of Owned Characters */}
          <section className="surface-card owned-collection-panel" aria-label="รายการตัวละครที่ฉันมี">
            <div className="sidebar-title-row">
              <span className="field-label">คอลเลกชันของคุณ ({characters.length})</span>
              <span className="collection-hint">แตะเพื่อดูรายละเอียด</span>
            </div>

            <div className="owned-collection-grid" role="listbox" aria-label="รายชื่อฮีโร่ของฉัน">
              {characters.map((ch, idx) => {
                const isActive = ch.id === activeChar?.id
                return (
                  <button
                    key={ch.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`owned-hero-tile ${isActive ? 'active' : ''}`}
                    style={{ '--hero-accent': ch.color } as React.CSSProperties}
                    onClick={() => inspectHero(ch.id, idx >= selectedIndex ? 1 : -1)}
                  >
                    <div className="owned-tile-art-wrap">
                      <img src={ch.imageUrl} alt={ch.displayName} className="owned-tile-art" />
                      <span className="owned-tile-badge">
                        {ch.adminOnly ? '👑 ADMIN' : 'OWNED'}
                      </span>
                    </div>
                    <div className="owned-tile-body">
                      <div className="owned-tile-name">{ch.displayName}</div>
                      <div className="owned-tile-anime">{ch.animeTitle}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Right: Full Hero Profile & Skills Inspector */}
          <section className="showroom-card hero-detail-panel" aria-label="รายละเอียดตัวละคร">
            {activeChar && (
              <div
                className="showroom-stage"
                onTouchStart={(e) => {
                  touchSwipeStartX.current = e.touches[0].clientX
                }}
                onTouchEnd={(e) => {
                  if (touchSwipeStartX.current === null) return
                  const dx = e.changedTouches[0].clientX - touchSwipeStartX.current
                  touchSwipeStartX.current = null
                  if (Math.abs(dx) > 42) {
                    stepHero(dx < 0 ? 1 : -1)
                  }
                }}
              >
                <div
                  className="showroom-spotlight"
                  style={{
                    background: `radial-gradient(circle at 32% 40%, ${activeChar.color}, transparent 68%)`,
                  }}
                />
                <div className="showroom-holo-base" />

                <button
                  type="button"
                  className="showroom-nav-btn prev"
                  aria-label="ตัวละครก่อนหน้า"
                  onClick={() => stepHero(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="showroom-nav-btn next"
                  aria-label="ตัวละครถัดไป"
                  onClick={() => stepHero(1)}
                >
                  ›
                </button>

                <div className="showroom-top-meta">
                  <span className="showroom-counter">
                    #{String(selectedIndex + 1).padStart(2, '0')} / {String(characters.length).padStart(2, '0')} • มีในครอบครอง
                  </span>
                  <span className="showroom-role-badge" style={{ borderColor: activeChar.color }}>
                    {activeChar.roleTag}
                  </span>
                </div>

                <div ref={showroomContentRef} className="showroom-center-row">
                  <div className="showroom-portrait-wrap" style={{ borderColor: activeChar.color }}>
                    <img
                      src={activeChar.imageUrl}
                      alt={activeChar.displayName}
                      className="showroom-portrait-img"
                    />
                  </div>

                  <div className="showroom-info-col">
                    <h2 className="showroom-hero-name">{activeChar.displayName}</h2>
                    <p className="showroom-hero-anime">
                      {activeChar.animeTitle} • {activeChar.animeRef}
                    </p>

                    <button
                      type="button"
                      className="showroom-voice-btn"
                      onClick={() => soundEngine.speakCharacterQuote(activeChar.id, activeChar.voiceLine)}
                    >
                      🔊 “{activeChar.voiceLine || CHARACTER_VOICES[activeChar.id]?.quote || ''}”
                    </button>

                    <div className="spec-bars">
                      <div className="spec-row">
                        <span>พลังชีวิต</span>
                        <div className="spec-track">
                          <div
                            className="spec-fill"
                            style={{
                              width: `${Math.min(100, (activeChar.maxHp / 320) * 100)}%`,
                              background: 'linear-gradient(90deg, #10B981, #34D399)',
                            }}
                          />
                        </div>
                        <span>{activeChar.maxHp}</span>
                      </div>
                      <div className="spec-row">
                        <span>ความเร็ว</span>
                        <div className="spec-track">
                          <div
                            className="spec-fill"
                            style={{
                              width: `${Math.min(100, (activeChar.moveSpeed / 290) * 100)}%`,
                              background: 'linear-gradient(90deg, #0284C7, #38BDF8)',
                            }}
                          />
                        </div>
                        <span>{activeChar.moveSpeed}</span>
                      </div>
                      <div className="spec-row">
                        <span>สกิลหลัก</span>
                        <div className="spec-track">
                          <div
                            className="spec-fill"
                            style={{
                              width: `${Math.min(100, (activeChar.skills.length / 5) * 100)}%`,
                              background: activeChar.color,
                            }}
                          />
                        </div>
                        <span>{activeChar.skills.length} ท่า</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeChar && (
              <div className="skill-preview-box">
                <div className="sidebar-title-row">
                  <span className="field-label">รายละเอียดสกิลของ {activeChar.displayName}</span>
                  <span className="collection-hint">ตีธรรมดา Lock-On + Dash ทุกตัว</span>
                </div>
                {activeChar.skills.length === 0 ? (
                  <div className="no-skill-notice">
                    ตัวละครเริ่มต้นเน้นการโจมตีปกติแบบล็อกเป้า (J / Spacebar / คลิก) และ Dash คล่องตัว
                  </div>
                ) : (
                  <div className="skill-preview-list">
                    {activeChar.skills.map((sk) => (
                      <div key={sk.slot} className="skill-preview-item">
                        <div className="skill-preview-head">
                          <div className="skill-preview-head-left">
                            <img
                              src={sk.iconUrl || `/skills/${activeChar.id}_${sk.slot}.png`}
                              alt={sk.name}
                              className="skill-preview-icon-img"
                            />
                            <span className="skill-key">{sk.keyHint}</span>
                          </div>
                          <span className="skill-cd">⏱ {sk.cooldownSec}s</span>
                        </div>
                        <div className="skill-title">{sk.name}</div>
                        <div className="skill-desc">{sk.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="hero-room-pick-hint">
              💡 การเลือกฮีโร่ลงสนามให้ไปเลือกได้ทันทีเมื่อเข้าห้องรอเล่น (Room Lobby)
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
