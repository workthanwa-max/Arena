import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { getMapDisplayLabel, HERO_CLASS_FILTERS, type HeroClassFilter } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'

export function JoinHeroSelectPage() {
  const [classFilter, setClassFilter] = useState<HeroClassFilter>('all')
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const pendingJoinRoom = useGameStore((s) => s.pendingJoinRoom)
  const joining = useGameStore((s) => s.joining)
  const error = useGameStore((s) => s.error)

  const setSelectedCharId = useGameStore((s) => s.setSelectedCharId)
  const confirmPendingJoin = useGameStore((s) => s.confirmPendingJoin)
  const goBack = useGameStore((s) => s.goBack)
  const setError = useGameStore((s) => s.setError)

  const shellRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    animateCardEnter(shellRef.current)
  }, [])

  const activeHero = characters.find((c) => c.id === selectedCharId) ?? characters[0]

  if (!pendingJoinRoom) {
    return null
  }

  const isFFA = pendingJoinRoom.mode === 'ffa'
  const modeLabel =
    pendingJoinRoom.mode === 'duel_1v1'
      ? '⚔️ 1 vs 1'
      : pendingJoinRoom.mode === 'tdm_3v3'
        ? '🛡️ 3 vs 3'
        : pendingJoinRoom.mode === 'practice'
          ? '🎯 ฝึกซ้อม'
          : '🔥 FFA 5 คน'
  const mapLabel = getMapDisplayLabel(pendingJoinRoom.mapId)

  function handlePickHero(charId: string) {
    soundEngine.unlock()
    setSelectedCharId(charId)
    const ch = characters.find((c) => c.id === charId)
    soundEngine.speakCharacterQuote(charId, ch?.voiceLine)
  }

  return (
    <div className="mlbb-dark-page waiting-room-backdrop">
      <div ref={shellRef} className="mlbb-page-shell join-hero-select-shell">
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
            <span className="mlbb-room-pill">ห้อง #{pendingJoinRoom.roomId}</span>
            <h1 className="mlbb-sub-title brand-title">เลือกฮีโร่ลงสมรภูมิ</h1>
          </div>

          <div className="mlbb-sub-right telemetry-pills">
            <span className="mlbb-meta-pill accent">{modeLabel}</span>
            <span className="mlbb-meta-pill">{mapLabel}</span>
            <span className="mlbb-meta-pill">
              👤 {pendingJoinRoom.currentPlayers}/{pendingJoinRoom.maxPlayers}
            </span>
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

        <main className="mlbb-join-select-split">
          {/* Left: Live 3D Hero Stage + Skills */}
          {activeHero && (
            <section className="mlbb-glass-card mlbb-join-3d-stage" aria-label="พรีวิวโมเดล 3D ฮีโร่ที่เลือก">
              <div className="mlbb-join-stage-top">
                <div>
                  <h2 className="mlbb-draft-hero-name">
                    {activeHero.displayName} <span>• {activeHero.animeTitle}</span>
                  </h2>
                  <div className="mlbb-draft-hero-stats">
                    ❤️ HP {activeHero.maxHp} • ⚡ Speed {activeHero.moveSpeed} •{' '}
                    {activeHero.classIcon ? `${activeHero.classIcon} ${activeHero.className}` : activeHero.roleTag}
                  </div>
                  {activeHero.classTraitLabel && (
                    <div
                      className="mlbb-draft-class-note"
                      style={{ color: activeHero.classColor || '#7dd3fc' }}
                    >
                      ✦ {activeHero.classTraitLabel}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="mlbb-glass-btn compact"
                  onClick={() => {
                    soundEngine.unlock()
                    soundEngine.speakCharacterQuote(activeHero.id, activeHero.voiceLine)
                  }}
                >
                  🔊 เสียงพากย์
                </button>
              </div>

              <Hero3dPreview character={activeHero} size="lg" />

              <div className="mlbb-draft-skills-row">
                {activeHero.skills.map((sk) => (
                  <div key={sk.slot} className="mlbb-mini-skill-chip" title={sk.description}>
                    <img src={sk.iconUrl || `/skills/${activeHero.id}_${sk.slot}.png`} alt={sk.name} />
                    <span>
                      <strong>{sk.keyHint}</strong> {sk.name}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Right: Clean Hero Roster Grid with 5-Class Filter */}
          <section className="mlbb-glass-card mlbb-join-roster-col" aria-label="เลือกฮีโร่ก่อนเข้าร่วมห้อง">
            <h2 className="mlbb-card-title">ฮีโร่ทั้งหมด ({characters.length} • 5 ประเภท)</h2>
            <div className="mlbb-class-filter-bar compact" role="tablist" aria-label="กรองฮีโร่ตาม 5 ประเภท">
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
            <div className="mlbb-hero-pick-grid join-hero-grid">
              {(classFilter === 'all' ? characters : characters.filter((c) => c.heroClass === classFilter)).map(
                (c) => {
                  const isPicked = activeHero?.id === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`mlbb-hero-pick-tile inline-hero-chip ${isPicked ? 'active' : ''}`}
                      style={{ '--hero-accent': c.color } as React.CSSProperties}
                      onClick={() => handlePickHero(c.id)}
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

            <footer className="mlbb-join-footer">
              <span className="mlbb-meta-pill accent">
                🎭 {activeHero?.displayName ?? 'ป๊ะ'}
              </span>
              <button
                type="button"
                className="mlbb-gold-cta compact waiting-start-btn join-confirm-btn"
                disabled={joining || !activeHero}
                onClick={() => void confirmPendingJoin(activeHero?.id)}
              >
                {joining
                  ? 'กำลังเข้า...'
                  : isFFA
                    ? '🚀 ยืนยันตัวละคร & เข้าสมรภูมิทันที! →'
                    : `🚀 เข้าห้องรอ (#${pendingJoinRoom.roomId}) →`}
              </button>
            </footer>
          </section>
        </main>
      </div>
    </div>
  )
}
