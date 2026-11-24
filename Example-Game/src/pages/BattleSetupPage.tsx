import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { getMapDisplayLabel } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'
import type { GameMode, MapId } from '../types/game'

export function BattleSetupPage() {
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const setSelectedCharId = useGameStore((s) => s.setSelectedCharId)
  const selectedMode = useGameStore((s) => s.selectedMode)
  const selectedMapId = useGameStore((s) => s.selectedMapId)
  const joining = useGameStore((s) => s.joining)
  const error = useGameStore((s) => s.error)
  const setError = useGameStore((s) => s.setError)
  const goBack = useGameStore((s) => s.goBack)
  const createAndJoinRoom = useGameStore((s) => s.createAndJoinRoom)

  const [mode, setMode] = useState<GameMode>(
    selectedMode && selectedMode !== 'ffa' ? selectedMode : 'duel_1v1',
  )
  const [mapId, setMapId] = useState<MapId>(selectedMapId || 'shibuya')

  const shellRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    animateCardEnter(shellRef.current)
  }, [])

  function selectMode(nextMode: GameMode) {
    soundEngine.unlock()
    setMode(nextMode)
    if (nextMode === 'iconic') {
      setMapId('shibuya')
    }
  }

  async function handleConfirm() {
    soundEngine.unlock()
    await createAndJoinRoom(mode, mode === 'iconic' ? 'shibuya' : mapId)
  }

  const activeFfaHero = characters.find((c) => c.id === selectedCharId) ?? characters[0]
  const modeLabel =
    mode === 'iconic'
      ? '⚡ ICONIC 1v1'
      : mode === 'duel_1v1'
        ? '⚔️ 1 vs 1 (5 Kills)'
        : mode === 'tdm_3v3'
          ? '🛡️ 3 vs 3 (50 Kills)'
          : mode === 'practice'
            ? '🎯 ฝึกซ้อม Dummy'
            : '🔥 FFA 5 คน'

  return (
    <div className="mlbb-dark-page battle-setup-backdrop">
      <div ref={shellRef} className="mlbb-page-shell create-room-modal">
        <header className="mlbb-sub-topbar battle-setup-header">
          <div className="mlbb-sub-left">
            <button
              type="button"
              className="mlbb-glass-btn compact page-back-btn"
              onClick={goBack}
              aria-label="ย้อนกลับ"
            >
              ← ย้อนกลับ
            </button>
            <h1 className="mlbb-sub-title brand-title">⚔️ เลือกโหมด &amp; สนามประลอง</h1>
          </div>

          <div className="mlbb-sub-right telemetry-pills">
            <span className="mlbb-meta-pill accent">{modeLabel}</span>
            <span className="mlbb-meta-pill">{getMapDisplayLabel(mapId, mode === 'iconic')}</span>
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

        <main className="mlbb-setup-grid">
          {/* Left: Clean MOBA Mode Selector */}
          <section className="mlbb-glass-card" aria-label="เลือกโหมดการเล่น">
            <h2 className="mlbb-card-title">1. เลือกโหมดการต่อสู้</h2>

            <button
              type="button"
              className={`mlbb-mode-card choice-card iconic-featured-card ${mode === 'iconic' ? 'selected' : ''}`}
              onClick={() => selectMode('iconic')}
            >
              <div className="mlbb-mode-card-top">
                <span className="mlbb-mode-tag gold">⚡ 3D SPECIAL</span>
                <span className="mlbb-mode-meta">2 คน • สุ่มตัว • 5 Kills</span>
              </div>
              <div className="mlbb-mode-name">ICONIC 1v1: Gojo vs Sukuna</div>
              <div className="mlbb-mode-desc">มุมมอง 3D ด้านหลังตัวละคร • ปะทะอาณาเขต • สกิลฟื้นเลือด RCT</div>
            </button>

            <div className="mlbb-mode-two-cols">
              <button
                type="button"
                className={`mlbb-mode-card choice-card ${mode === 'duel_1v1' ? 'selected' : ''}`}
                onClick={() => selectMode('duel_1v1')}
              >
                <div className="mlbb-mode-card-top">
                  <span className="mlbb-mode-ico">⚔️</span>
                  <span className="mlbb-mode-meta">2 คน • 5 Kills</span>
                </div>
                <div className="mlbb-mode-name">1 vs 1 ดวลเดือด</div>
              </button>

              <button
                type="button"
                className={`mlbb-mode-card choice-card ${mode === 'tdm_3v3' ? 'selected' : ''}`}
                onClick={() => selectMode('tdm_3v3')}
              >
                <div className="mlbb-mode-card-top">
                  <span className="mlbb-mode-ico">🛡️</span>
                  <span className="mlbb-mode-meta">6 คน • 50 Kills</span>
                </div>
                <div className="mlbb-mode-name">ทีม 3 vs 3</div>
              </button>

              <button
                type="button"
                className={`mlbb-mode-card choice-card ${mode === 'practice' ? 'selected' : ''}`}
                onClick={() => selectMode('practice')}
              >
                <div className="mlbb-mode-card-top">
                  <span className="mlbb-mode-ico">🎯</span>
                  <span className="mlbb-mode-meta">1 คน • ซ้อมสกิล</span>
                </div>
                <div className="mlbb-mode-name">ฝึกซ้อม Dummy</div>
              </button>

              <button
                type="button"
                className={`mlbb-mode-card choice-card ${mode === 'ffa' ? 'selected' : ''}`}
                onClick={() => selectMode('ffa')}
              >
                <div className="mlbb-mode-card-top">
                  <span className="mlbb-mode-ico">🔥</span>
                  <span className="mlbb-mode-meta hot">5 คน • เข้าทันที</span>
                </div>
                <div className="mlbb-mode-name">ตะลุมบอน FFA</div>
              </button>
            </div>
          </section>

          {/* Right: Map Selector + Optional FFA 3D Hero Picker + Golden CTA */}
          <section className="mlbb-glass-card" aria-label="เลือกแผนที่และยืนยัน">
            <h2 className="mlbb-card-title">2. เลือกแผนที่สมรภูมิ</h2>

            <div className="mlbb-map-four-grid">
              <button
                type="button"
                className={`mlbb-map-card choice-card ${mapId === 'shibuya' ? 'selected' : ''}`}
                onClick={() => setMapId('shibuya')}
              >
                <img src="/maps/shibuya_bg.webp" alt="Shibuya" className="mlbb-map-thumb" />
                <div className="mlbb-map-name">🏙️ ชิบูย่า (Shibuya)</div>
              </button>

              <button
                type="button"
                disabled={mode === 'iconic'}
                className={`mlbb-map-card choice-card ${mapId === 'konoha' ? 'selected' : ''} ${mode === 'iconic' ? 'disabled' : ''}`}
                onClick={() => setMapId('konoha')}
              >
                <img src="/maps/konoha_bg.webp" alt="Konoha" className="mlbb-map-thumb" />
                <div className="mlbb-map-name">🍃 หมู่บ้านโคโนฮะ</div>
              </button>

              <button
                type="button"
                disabled={mode === 'iconic'}
                className={`mlbb-map-card choice-card sisaket-map-card ${mapId === 'sisaket_island' ? 'selected' : ''} ${mode === 'iconic' ? 'disabled' : ''}`}
                onClick={() => setMapId('sisaket_island')}
              >
                <img src="/maps/sisaket_bg.webp" alt="เกาะกลางน้ำ ห้วยน้ำคำ ศรีสะเกษ" className="mlbb-map-thumb" />
                <span className="mlbb-map-hazard-pill">🌊 ตกน้ำ -5 HP</span>
                <div className="mlbb-map-name">🏝️ เกาะกลางน้ำ ศรีสะเกษ</div>
              </button>

              <button
                type="button"
                disabled={mode === 'iconic'}
                className={`mlbb-map-card choice-card scp-map-card ${mapId === 'scp_site' ? 'selected' : ''} ${mode === 'iconic' ? 'disabled' : ''}`}
                onClick={() => setMapId('scp_site')}
              >
                <img src="/maps/scp_bg.webp" alt="สถานีวิจัย SCP (วงกลม)" className="mlbb-map-thumb" />
                <span className="mlbb-map-heal-pill">💚 วงกลม • เก็บเลือด +45</span>
                <div className="mlbb-map-name">🧪 สถานีวิจัย SCP</div>
              </button>
            </div>

            {mode === 'ffa' && activeFfaHero && (
              <div className="mlbb-ffa-pick-panel">
                <div className="mlbb-ffa-pick-head">
                  <span>เลือกฮีโร่ลงสนาม FFA (เข้าทันที)</span>
                  <strong>{activeFfaHero.displayName}</strong>
                </div>
                <div className="mlbb-ffa-pick-body">
                  <Hero3dPreview character={activeFfaHero} size="sm" />
                  <div className="mlbb-hero-pick-grid compact">
                    {characters.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        className={`mlbb-hero-pick-tile inline-hero-chip ${selectedCharId === ch.id ? 'active' : ''}`}
                        style={{ '--hero-accent': ch.color } as React.CSSProperties}
                        onClick={() => setSelectedCharId(ch.id)}
                      >
                        <div className="mlbb-pick-thumb-wrap">
                          <img src={ch.imageUrl} alt={ch.displayName} className="mlbb-pick-thumb" />
                          {ch.adminOnly && <span className="moba-crown-tag">👑</span>}
                        </div>
                        <span className="mlbb-pick-name">{ch.displayName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mlbb-setup-footer modal-actions">
              <div className="mlbb-setup-summary">
                <strong>{modeLabel}</strong>
                <span>{getMapDisplayLabel(mapId, mode === 'iconic')}</span>
              </div>

              <button
                type="button"
                className="mlbb-gold-cta compact setup-confirm-btn"
                disabled={joining}
                onClick={() => void handleConfirm()}
              >
                {joining ? 'กำลังสร้างห้อง...' : '🚀 สร้างห้องประลอง →'}
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
