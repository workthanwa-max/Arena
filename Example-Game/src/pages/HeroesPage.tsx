import { useEffect, useRef, useState } from 'react'
import { animateShowroomSwap } from '../animations/gsapPresets'
import { CHARACTER_VOICES, soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { HERO_CLASS_FILTERS, type HeroClassFilter } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'

export function HeroesPage() {
  const [classFilter, setClassFilter] = useState<HeroClassFilter>('all')
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const allCharacters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const characters =
    classFilter === 'all' ? allCharacters : allCharacters.filter((c) => c.heroClass === classFilter)
  const viewingCharId = useGameStore((s) => s.viewingCharId)
  const inspectCharacter = useGameStore((s) => s.inspectCharacter)
  const startPracticeMode = useGameStore((s) => s.startPracticeMode)
  const setView = useGameStore((s) => s.setView)
  const goBack = useGameStore((s) => s.goBack)

  const showroomContentRef = useRef<HTMLDivElement | null>(null)
  const swapDirRef = useRef(1)
  const touchSwipeStartX = useRef<number | null>(null)

  const activeId = viewingCharId || characters[0]?.id || allCharacters[0]?.id || 'pa'
  const foundIdx = characters.findIndex((c) => c.id === activeId)
  const selectedIndex = foundIdx >= 0 ? foundIdx : 0
  const activeChar = characters[selectedIndex] ?? allCharacters[0]

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
    <div className="mlbb-dark-page heroes-page-wrap">
      <div className="mlbb-page-shell heroes-page-shell">
        <header className="mlbb-sub-topbar heroes-header">
          <div className="mlbb-sub-left">
            <button
              type="button"
              className="mlbb-glass-btn compact page-back-btn"
              onClick={goBack}
              aria-label="ย้อนกลับ"
            >
              ← ย้อนกลับ
            </button>
            <h1 className="mlbb-sub-title brand-title">🦸 คลังฮีโร่ 5 ประเภท ({allCharacters.length})</h1>
          </div>

          <div className="mlbb-sub-right heroes-header-actions">
            {activeChar && (
              <button
                type="button"
                className="mlbb-glass-btn compact"
                onClick={() => {
                  soundEngine.unlock()
                  void startPracticeMode(activeChar.id)
                }}
              >
                🎯 ซ้อม {activeChar.displayName}
              </button>
            )}
            <button
              type="button"
              className="mlbb-gold-cta mini"
              onClick={() => {
                soundEngine.unlock()
                setView('battle_setup')
              }}
            >
              ⚔️ สร้างห้อง →
            </button>
          </div>
        </header>

        <main className="mlbb-heroes-split">
          {/* Left: 5-Archetype Filter Bar + Clean Dark Esports Hero Grid */}
          <section className="mlbb-glass-card mlbb-heroes-grid-panel" aria-label="รายการตัวละครที่ฉันมี">
            <div className="mlbb-class-filter-bar" role="tablist" aria-label="กรองฮีโร่ตาม 5 ประเภท">
              {HERO_CLASS_FILTERS.map((cls) => {
                const count =
                  cls.id === 'all'
                    ? allCharacters.length
                    : allCharacters.filter((c) => c.heroClass === cls.id).length
                const isActive = classFilter === cls.id
                return (
                  <button
                    key={cls.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`mlbb-class-pill ${isActive ? 'active' : ''}`}
                    style={{ '--class-accent': cls.color } as React.CSSProperties}
                    title={cls.traitSummary}
                    onClick={() => {
                      setClassFilter(cls.id)
                      const nextList =
                        cls.id === 'all' ? allCharacters : allCharacters.filter((c) => c.heroClass === cls.id)
                      if (nextList.length > 0 && !nextList.some((c) => c.id === activeChar?.id)) {
                        inspectHero(nextList[0].id, 1)
                      }
                    }}
                  >
                    <span>{cls.icon}</span>
                    <span>{cls.name}</span>
                    <em className="mlbb-class-count">{count}</em>
                  </button>
                )
              })}
            </div>

            <div className="mlbb-hero-pick-grid heroes-sidebar-grid" role="listbox" aria-label="รายชื่อฮีโร่ของฉัน">
              {characters.map((ch, idx) => {
                const isActive = ch.id === activeChar?.id
                return (
                  <button
                    key={ch.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`mlbb-hero-pick-tile owned-hero-tile ${isActive ? 'active' : ''}`}
                    style={{ '--hero-accent': ch.color } as React.CSSProperties}
                    onClick={() => inspectHero(ch.id, idx >= selectedIndex ? 1 : -1)}
                  >
                    <div className="mlbb-pick-thumb-wrap">
                      <img src={ch.imageUrl} alt={ch.displayName} className="mlbb-pick-thumb" />
                      {ch.classIcon && (
                        <span
                          className="mlbb-hero-class-pip"
                          style={{ borderColor: ch.classColor || '#38bdf8' }}
                          title={`${ch.className}: ${ch.classTraitLabel}`}
                        >
                          {ch.classIcon}
                        </span>
                      )}
                      {ch.adminOnly && <span className="moba-crown-tag">👑</span>}
                    </div>
                    <span className="mlbb-pick-name">{ch.displayName}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Right: 3D Model Turntable Showroom + Hero Info + Skills */}
          <section className="mlbb-glass-card mlbb-hero-showroom" aria-label="รายละเอียดตัวละครและโมเดล 3D">
            {activeChar && (
              <div
                className="mlbb-showroom-stage"
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
                  className="mlbb-showroom-glow"
                  style={{
                    background: `radial-gradient(circle at 30% 45%, ${activeChar.color}55, transparent 65%)`,
                  }}
                />

                <div className="mlbb-showroom-meta-bar">
                  <span className="mlbb-meta-pill">
                    #{String(selectedIndex + 1).padStart(2, '0')} / {String(characters.length).padStart(2, '0')}
                  </span>
                  <div className="mlbb-showroom-nav-arrows">
                    <button
                      type="button"
                      className="mlbb-glass-btn icon-only"
                      aria-label="ตัวละครก่อนหน้า"
                      onClick={() => stepHero(-1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="mlbb-glass-btn icon-only"
                      aria-label="ตัวละครถัดไป"
                      onClick={() => stepHero(1)}
                    >
                      ›
                    </button>
                  </div>
                  <span className="mlbb-meta-pill accent" style={{ borderColor: activeChar.color }}>
                    {activeChar.roleTag}
                  </span>
                </div>

                <div ref={showroomContentRef} className="mlbb-showroom-center">
                  {/* Live Interactive 3D Hero Model Turntable */}
                  <Hero3dPreview character={activeChar} size="lg" />

                  <div className="mlbb-showroom-info">
                    <div className="mlbb-showroom-title-row">
                      <img
                        src={activeChar.imageUrl}
                        alt={activeChar.displayName}
                        className="mlbb-showroom-portrait-chip"
                        style={{ borderColor: activeChar.color }}
                      />
                      <div>
                        <h2 className="showroom-hero-name">{activeChar.displayName}</h2>
                        <p className="showroom-hero-anime">
                          {activeChar.animeTitle} • {activeChar.animeRef}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="showroom-voice-btn"
                      onClick={() => soundEngine.speakCharacterQuote(activeChar.id, activeChar.voiceLine)}
                    >
                      🔊 “{activeChar.voiceLine || CHARACTER_VOICES[activeChar.id]?.quote || ''}”
                    </button>

                    {activeChar.className && (
                      <div
                        className="mlbb-class-trait-card"
                        style={{ '--class-accent': activeChar.classColor || '#38bdf8' } as React.CSSProperties}
                      >
                        <div className="mlbb-class-trait-head">
                          <strong>
                            {activeChar.classIcon} {activeChar.className}
                          </strong>
                          {activeChar.classStatKey && (
                            <code className="mlbb-class-var-chip">
                              {activeChar.classStatKey}: {activeChar.classStatValue}
                            </code>
                          )}
                        </div>
                        <div className="mlbb-class-trait-desc">{activeChar.classTraitLabel}</div>
                      </div>
                    )}

                    <div className="spec-bars">
                      <div className="spec-row">
                        <span>HP</span>
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
                        <span>Speed</span>
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
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeChar && (
              <div className="mlbb-skill-grid-box">
                {activeChar.skills.length === 0 ? (
                  <div className="mlbb-no-skill-notice">
                    โจมตีปกติแบบล็อกเป้า (J / Spacebar) + Dash (Shift)
                  </div>
                ) : (
                  <div className="mlbb-skill-cards">
                    {activeChar.skills.map((sk) => (
                      <div key={sk.slot} className="mlbb-skill-card skill-preview-item">
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
          </section>
        </main>
      </div>
    </div>
  )
}
