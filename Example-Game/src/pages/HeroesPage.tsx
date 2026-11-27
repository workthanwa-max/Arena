import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { animateShowroomSwap } from '../animations/gsapPresets'
import { CHARACTER_VOICES, soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { EmblemCheck, EmblemHome, HeroClassEmblem } from '../components/HeroClassEmblem'
import { IconClose, IconSearch, IconTarget, IconVolume } from '../components/Icons'
import { HERO_CLASS_FILTERS, type HeroClassFilter } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'

export function HeroesPage() {
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const allCharacters = useMemo(
    () => rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin'),
    [rawCharacters, authUser?.role],
  )
  const viewingCharId = useGameStore((s) => s.viewingCharId)
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const inspectCharacter = useGameStore((s) => s.inspectCharacter)
  const setSelectedCharId = useGameStore((s) => s.setSelectedCharId)
  const startPracticeMode = useGameStore((s) => s.startPracticeMode)
  const setView = useGameStore((s) => s.setView)
  const connected = useGameStore((s) => s.connected)

  const [classFilter, setClassFilter] = useState<HeroClassFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedSkillTab, setSelectedSkillTab] = useState<number>(1)

  const showroomContentRef = useRef<HTMLDivElement | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const activeCardRef = useRef<HTMLDivElement | null>(null)

  const filteredCharacters = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allCharacters.filter((c) => {
      if (classFilter !== 'all' && c.heroClass !== classFilter) return false
      if (!q) return true
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.animeTitle.toLowerCase().includes(q) ||
        c.animeRef.toLowerCase().includes(q) ||
        (c.className ?? '').toLowerCase().includes(q)
      )
    })
  }, [allCharacters, classFilter, query])

  const activeList = filteredCharacters.length > 0 ? filteredCharacters : allCharacters
  const activeId = viewingCharId || selectedCharId || activeList[0]?.id || 'pa'
  const selectedIndex = Math.max(0, activeList.findIndex((c) => c.id === activeId))
  const activeChar = activeList[selectedIndex] ?? activeList[0]
  const isEquippedMain = Boolean(activeChar && activeChar.id === selectedCharId)

  useEffect(() => {
    animateShowroomSwap(showroomContentRef.current, 1)
  }, [activeChar?.id])

  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeChar?.id, classFilter])

  function inspectHero(nextId: string) {
    soundEngine.unlock()
    inspectCharacter(nextId)
    const ch = allCharacters.find((c) => c.id === nextId)
    setSelectedSkillTab(ch?.skills.length ? 1 : 0)
    soundEngine.speakCharacterQuote(nextId, ch?.voiceLine)
  }

  function stepHero(delta: number) {
    if (activeList.length === 0) return
    const nextIdx = (selectedIndex + delta + activeList.length) % activeList.length
    inspectHero(activeList[nextIdx].id)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepHero(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepHero(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function handleLockIn(charId: string) {
    soundEngine.unlock()
    setSelectedCharId(charId)
    const ch = allCharacters.find((c) => c.id === charId)
    soundEngine.speakCharacterQuote(charId, ch?.voiceLine)
  }

  function scrollStrip(dir: -1 | 1) {
    stripRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })
  }

  const activeSkillDef =
    selectedSkillTab > 0 ? activeChar?.skills[selectedSkillTab - 1] ?? activeChar?.skills[0] : null

  return (
    <div
      className="hs-page heroes-page-wrap"
      style={{ '--hs-accent': activeChar?.accentColor || '#38bdf8' } as CSSProperties}
    >
      {/* TOP BAR */}
      <header className="hs-topbar heroes-header">
        <div className="hs-top-left">
          <button
            type="button"
            className="ui-btn page-back-btn"
            onClick={() => {
              soundEngine.unlock()
              setView(connected ? 'room_lobby' : 'home')
            }}
            aria-label="กลับหน้าล็อบบี้"
          >
            <EmblemHome size={15} />
            <span>หน้าล็อบบี้</span>
          </button>

          <span className="hs-counter-pill">
            {String(selectedIndex + 1).padStart(2, '0')} / {String(activeList.length).padStart(2, '0')}
          </span>

          <div className="hs-search-box">
            <span className="hs-search-ico">
              <IconSearch size={14} />
            </span>
            <input
              type="text"
              className="hs-search-input"
              placeholder={`ค้นหาฮีโร่จาก ${allCharacters.length} ตัว...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="hs-search-clear"
                aria-label="ล้างคำค้นหา"
                onClick={() => setQuery('')}
              >
                <IconClose size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="hs-top-right">
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
        </div>
      </header>

      {/* MAIN 3-COLUMN AGENT SHOWROOM */}
      <main className="hs-main">
        {/* LEFT: Hexagonal Vertical Class Filter Rail */}
        <aside className="hs-hex-rail" role="tablist" aria-label="กรองฮีโร่ตามสาย">
          <span className="hs-rail-caption">HERO CLASSES</span>
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
                className={`hs-hex-row ${isActive ? 'active' : ''}`}
                style={{ '--class-accent': cls.color } as CSSProperties}
                onClick={() => {
                  setClassFilter(cls.id)
                  const nextFirst =
                    cls.id === 'all'
                      ? allCharacters[0]
                      : allCharacters.find((c) => c.heroClass === cls.id)
                  if (nextFirst && nextFirst.id !== activeChar?.id) {
                    inspectCharacter(nextFirst.id)
                  }
                }}
              >
                <span className="hs-hex-badge" aria-hidden="true">
                  <span className="hs-hex-inner">
                    <HeroClassEmblem heroClass={cls.id} size={17} />
                  </span>
                </span>
                <span className="hs-hex-text">
                  <span className="hs-hex-top">
                    <span className="hs-hex-name">{cls.name}</span>
                    <span className="hs-hex-count">{count}</span>
                  </span>
                  <span className="hs-hex-trait">{cls.traitSummary}</span>
                </span>
              </button>
            )
          })}
        </aside>

        {/* CENTER: Full-Height 3D / 2D Hero Showcase */}
        <section className="hs-center-stage" aria-label="แสดงโมเดลตัวละคร">
          <button
            type="button"
            className="hs-step-btn prev"
            aria-label="ฮีโร่ก่อนหน้า"
            onClick={() => stepHero(-1)}
          >
            ‹
          </button>

          {activeChar && (
            <div ref={showroomContentRef} className="hs-preview-wrap">
              <Hero3dPreview character={activeChar} size="hero" frameless allowViewToggle />
            </div>
          )}

          <button
            type="button"
            className="hs-step-btn next"
            aria-label="ฮีโร่ถัดไป"
            onClick={() => stepHero(1)}
          >
            ›
          </button>
        </section>

        {/* RIGHT: Tactical Inspector + 4-Box Interactive Skill Selector */}
        <section className="hs-inspector" aria-label="รายละเอียดและสกิลฮีโร่">
          {activeChar && (
            <>
              <div>
                <div className="hs-role-eyebrow">
                  <HeroClassEmblem heroClass={activeChar.heroClass ?? 'all'} size={16} />
                  <span>{activeChar.className || activeChar.roleTag}</span>
                </div>
                <h1 className="hs-hero-name">{activeChar.displayName}</h1>
                <p className="hs-hero-sub">
                  {activeChar.animeTitle} · {activeChar.animeRef}
                </p>
              </div>

              <div className="hs-stats-compact">
                <div className="hs-stat-line">
                  <span>HP</span>
                  <div className="hs-stat-track">
                    <div
                      className="hs-stat-fill"
                      style={{
                        width: `${Math.min(100, (activeChar.maxHp / 280) * 100)}%`,
                        background: 'linear-gradient(90deg, #10b981, #34d399)',
                      }}
                    />
                  </div>
                  <span style={{ textAlign: 'right' }}>{activeChar.maxHp}</span>
                </div>
                <div className="hs-stat-line">
                  <span>SPEED</span>
                  <div className="hs-stat-track">
                    <div
                      className="hs-stat-fill"
                      style={{
                        width: `${Math.min(100, (activeChar.moveSpeed / 290) * 100)}%`,
                        background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                      }}
                    />
                  </div>
                  <span style={{ textAlign: 'right' }}>{activeChar.moveSpeed}</span>
                </div>
              </div>

              <div className="hs-action-row">
                <button
                  type="button"
                  className="ui-btn"
                  style={{ height: 32, fontSize: 12 }}
                  onClick={() => {
                    soundEngine.unlock()
                    soundEngine.speakCharacterQuote(activeChar.id, activeChar.voiceLine)
                  }}
                >
                  <IconVolume size={13} />
                  <span>ทดลองเสียงพากย์</span>
                </button>

                <button
                  type="button"
                  className={isEquippedMain ? 'ui-btn active' : 'val-cta-crimson'}
                  style={{ height: 32, minWidth: 120, padding: '0 14px', fontSize: 12 }}
                  onClick={() => handleLockIn(activeChar.id)}
                >
                  {isEquippedMain ? (
                    <>
                      <EmblemCheck size={13} />
                      <span>ฮีโร่หลักปัจจุบัน</span>
                    </>
                  ) : (
                    <span>ตั้งเป็นฮีโร่หลัก</span>
                  )}
                </button>
              </div>

              {/* Horizontal 4-Box Skill Selector (Passive + Q + E + R) */}
              <div className="hs-skill-tabs" role="tablist" aria-label="เลือกดูรายละเอียดสกิล">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedSkillTab === 0}
                  className={`hs-skill-tab ${selectedSkillTab === 0 ? 'active' : ''}`}
                  onClick={() => setSelectedSkillTab(0)}
                  title="ความสามารถประจำสาย"
                >
                  <HeroClassEmblem heroClass={activeChar.heroClass ?? 'all'} size={24} />
                  <span className="hs-skill-key">CLASS</span>
                </button>

                {activeChar.skills.slice(0, 3).map((sk, idx) => {
                  const tabIdx = idx + 1
                  return (
                    <button
                      key={sk.slot}
                      type="button"
                      role="tab"
                      aria-selected={selectedSkillTab === tabIdx}
                      className={`hs-skill-tab ${selectedSkillTab === tabIdx ? 'active' : ''}`}
                      onClick={() => setSelectedSkillTab(tabIdx)}
                      title={sk.name}
                    >
                      <img
                        src={sk.iconUrl || `/skills/${activeChar.id}_${sk.slot}.png`}
                        alt={sk.name}
                      />
                      <span className="hs-skill-key">{sk.keyHint}</span>
                    </button>
                  )
                })}
              </div>

              {/* Active Skill Description Box */}
              <div className="hs-skill-detail" role="tabpanel">
                {selectedSkillTab === 0 || !activeSkillDef ? (
                  <>
                    <div className="hs-skill-detail-head">
                      <span className="hs-skill-detail-name">
                        {activeChar.className || 'PASSIVE TRAIT'}
                      </span>
                      <span className="hs-skill-cd">PASSIVE</span>
                    </div>
                    <p className="hs-skill-detail-desc">
                      {activeChar.classTraitLabel ||
                        CHARACTER_VOICES[activeChar.id]?.quote ||
                        'โจมตีปกติแบบล็อกเป้า (J / Spacebar) + Dash (Shift)'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="hs-skill-detail-head">
                      <span className="hs-skill-detail-name">
                        [{activeSkillDef.keyHint}] {activeSkillDef.name}
                      </span>
                      <span className="hs-skill-cd">CD {activeSkillDef.cooldownSec}s</span>
                    </div>
                    <p className="hs-skill-detail-desc">{activeSkillDef.description}</p>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </main>

      {/* BOTTOM: Horizontal Hero Portrait Carousel Strip with LOCK IN Card */}
      <footer className="hs-roster-dock" aria-label="แถบเลือกฮีโร่ทั้งหมด">
        <div className="hs-roster-inner">
          <button
            type="button"
            className="hs-strip-nav"
            aria-label="เลื่อนซ้าย"
            onClick={() => scrollStrip(-1)}
          >
            ‹
          </button>

          <div
            ref={stripRef}
            className="hs-roster-strip"
            role="listbox"
            aria-label="รายชื่อฮีโร่"
            onWheel={(e) => {
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && stripRef.current) {
                stripRef.current.scrollLeft += e.deltaY
              }
            }}
          >
            {filteredCharacters.length === 0 ? (
              <div className="ui-card-sub" style={{ padding: '24px 12px', margin: '0 auto' }}>
                ไม่พบฮีโร่ที่ตรงกับ &ldquo;{query}&rdquo;
              </div>
            ) : (
              filteredCharacters.map((ch) => {
                const isViewing = ch.id === activeChar?.id
                const isMain = ch.id === selectedCharId
                return (
                  <div
                    key={ch.id}
                    ref={isViewing ? activeCardRef : undefined}
                    role="option"
                    aria-selected={isViewing}
                    tabIndex={0}
                    className={`hs-roster-card ${isViewing ? 'active' : ''} ${isMain ? 'equipped' : ''}`}
                    onClick={() => inspectHero(ch.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        inspectHero(ch.id)
                      }
                    }}
                    title={`${ch.displayName} (${ch.animeTitle})`}
                  >
                    <img src={ch.imageUrl} alt={ch.displayName} className="hs-roster-img" loading="lazy" />
                    <div className="hs-roster-scrim" aria-hidden="true" />

                    {isMain && !isViewing && (
                      <span className="hs-roster-top-tag">
                        <EmblemCheck size={9} /> MAIN
                      </span>
                    )}

                    <div className="hs-roster-foot">
                      <span className="hs-roster-name">{ch.displayName}</span>
                      {isViewing && (
                        <button
                          type="button"
                          className={`hs-lockin-btn ${isMain ? 'locked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLockIn(ch.id)
                          }}
                        >
                          {isMain ? (
                            <>
                              <EmblemCheck size={10} />
                              <span>ใช้งานอยู่</span>
                            </>
                          ) : (
                            <span>LOCK IN</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <button
            type="button"
            className="hs-strip-nav"
            aria-label="เลื่อนขวา"
            onClick={() => scrollStrip(1)}
          >
            ›
          </button>
        </div>
      </footer>
    </div>
  )
}
