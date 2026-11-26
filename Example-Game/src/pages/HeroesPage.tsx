import { useEffect, useRef } from 'react'
import { animateShowroomSwap } from '../animations/gsapPresets'
import { CHARACTER_VOICES, soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { HeroClassEmblem } from '../components/HeroClassEmblem'
import { HeroPickerPanel } from '../components/HeroPickerPanel'
import { IconArrowLeft, IconSwords, IconTarget, IconVolume } from '../components/Icons'
import { useGameStore } from '../store/useGameStore'

export function HeroesPage() {
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const allCharacters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const viewingCharId = useGameStore((s) => s.viewingCharId)
  const inspectCharacter = useGameStore((s) => s.inspectCharacter)
  const startPracticeMode = useGameStore((s) => s.startPracticeMode)
  const setView = useGameStore((s) => s.setView)
  const goBack = useGameStore((s) => s.goBack)

  const showroomContentRef = useRef<HTMLDivElement | null>(null)
  const activeId = viewingCharId || allCharacters[0]?.id || 'pa'
  const selectedIndex = Math.max(0, allCharacters.findIndex((c) => c.id === activeId))
  const activeChar = allCharacters[selectedIndex] ?? allCharacters[0]

  useEffect(() => {
    animateShowroomSwap(showroomContentRef.current, 1)
  }, [activeChar?.id])

  function inspectHero(nextId: string) {
    soundEngine.unlock()
    inspectCharacter(nextId)
    const ch = allCharacters.find((c) => c.id === nextId)
    soundEngine.speakCharacterQuote(nextId, ch?.voiceLine)
  }

  function stepHero(delta: number) {
    if (allCharacters.length === 0) return
    const nextIdx = (selectedIndex + delta + allCharacters.length) % allCharacters.length
    inspectHero(allCharacters[nextIdx].id)
  }

  return (
    <div className="ui-page heroes-page-wrap">
      <div className="ui-shell">
        <header className="ui-topbar heroes-header">
          <div className="ui-topbar-group">
            <button
              type="button"
              className="ui-btn page-back-btn"
              onClick={goBack}
              aria-label="ย้อนกลับ"
            >
              <IconArrowLeft size={15} />
              <span>ย้อนกลับ</span>
            </button>
            <h1 className="ui-page-title">คลังฮีโร่ ({allCharacters.length})</h1>
          </div>

          <div className="ui-topbar-group">
            {activeChar && (
              <button
                type="button"
                className="ui-btn"
                onClick={() => {
                  soundEngine.unlock()
                  void startPracticeMode(activeChar.id)
                }}
              >
                <IconTarget size={15} />
                <span>ซ้อม {activeChar.displayName}</span>
              </button>
            )}
            <button
              type="button"
              className="val-cta-crimson"
              style={{ height: 36, minWidth: 120, padding: '0 16px', fontSize: 13 }}
              onClick={() => {
                soundEngine.unlock()
                setView('battle_setup')
              }}
            >
              <IconSwords size={15} />
              <span>สร้างห้อง</span>
            </button>
          </div>
        </header>

        <main className="clean-heroes-layout">
          {/* Left: Searchable 5-Class Hero Picker */}
          <section className="ui-card" aria-label="รายชื่อฮีโร่">
            <HeroPickerPanel
              characters={allCharacters}
              selectedId={activeChar?.id ?? ''}
              compactTabs
              maxHeight={520}
              onSelect={inspectHero}
            />
          </section>

          {/* Right: Calm 3D Model Showroom + Stats + 3 Skills */}
          <section className="ui-card" aria-label="รายละเอียดตัวละคร">
            {activeChar && (
              <>
                <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
                  <span className="ui-pill">
                    {String(selectedIndex + 1).padStart(2, '0')} / {String(allCharacters.length).padStart(2, '0')}
                  </span>

                  <div className="ui-topbar-group" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="ui-btn icon-only"
                      style={{ height: 30, width: 30 }}
                      aria-label="ตัวละครก่อนหน้า"
                      onClick={() => stepHero(-1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="ui-btn icon-only"
                      style={{ height: 30, width: 30 }}
                      aria-label="ตัวละครถัดไป"
                      onClick={() => stepHero(1)}
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div ref={showroomContentRef} className="clean-showroom-top">
                  <Hero3dPreview character={activeChar} size="lg" frameless allowViewToggle />

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                        {activeChar.displayName}
                      </h2>
                      <p className="ui-card-sub">
                        {activeChar.animeTitle} · {activeChar.animeRef}
                      </p>
                    </div>

                    <div className="ui-topbar-group" style={{ gap: 8 }}>
                      {activeChar.className && (
                        <span className="ui-pill accent" style={{ gap: 6 }}>
                          <HeroClassEmblem heroClass={activeChar.heroClass ?? 'all'} size={14} />
                          <span>{activeChar.className}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        className="ui-btn"
                        style={{ height: 28, fontSize: 12, padding: '0 10px' }}
                        onClick={() => soundEngine.speakCharacterQuote(activeChar.id, activeChar.voiceLine)}
                      >
                        <IconVolume size={13} />
                        <span>ทดลองเสียงพากย์</span>
                      </button>
                    </div>

                    {(activeChar.classTraitLabel || CHARACTER_VOICES[activeChar.id]?.quote) && (
                      <p className="ui-card-sub" style={{ lineHeight: 1.45 }}>
                        {activeChar.classTraitLabel || `“${activeChar.voiceLine || CHARACTER_VOICES[activeChar.id]?.quote}”`}
                      </p>
                    )}

                    <div className="spec-bars" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', marginTop: 2 }}>
                      <div className="spec-row" style={{ color: 'var(--text-primary)' }}>
                        <span>HP</span>
                        <div className="spec-track" style={{ background: 'rgba(148,163,184,0.16)' }}>
                          <div
                            className="spec-fill"
                            style={{
                              width: `${Math.min(100, (activeChar.maxHp / 320) * 100)}%`,
                              background: '#10b981',
                            }}
                          />
                        </div>
                        <span>{activeChar.maxHp}</span>
                      </div>
                      <div className="spec-row" style={{ color: 'var(--text-primary)' }}>
                        <span>Speed</span>
                        <div className="spec-track" style={{ background: 'rgba(148,163,184,0.16)' }}>
                          <div
                            className="spec-fill"
                            style={{
                              width: `${Math.min(100, (activeChar.moveSpeed / 290) * 100)}%`,
                              background: '#38bdf8',
                            }}
                          />
                        </div>
                        <span>{activeChar.moveSpeed}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {activeChar.skills.length === 0 ? (
                  <div className="ui-card-sub" style={{ padding: 12, background: 'var(--bg-inset)', borderRadius: 10 }}>
                    โจมตีปกติแบบล็อกเป้า (J / Spacebar) + Dash (Shift)
                  </div>
                ) : (
                  <div className="clean-skill-grid">
                    {activeChar.skills.map((sk) => (
                      <div key={sk.slot} className="clean-skill-card">
                        <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
                          <div className="ui-topbar-group" style={{ gap: 8 }}>
                            <img
                              src={sk.iconUrl || `/skills/${activeChar.id}_${sk.slot}.png`}
                              alt={sk.name}
                              style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }}
                            />
                            <span className="ui-pill accent" style={{ height: 22, padding: '0 7px' }}>
                              {sk.keyHint}
                            </span>
                          </div>
                          <span className="ui-card-sub">{sk.cooldownSec}s</span>
                        </div>
                        <div className="clean-choice-name" style={{ fontSize: 13 }}>{sk.name}</div>
                        <div className="ui-card-sub" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
                          {sk.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
