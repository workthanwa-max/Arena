import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { HeroPickerPanel } from '../components/HeroPickerPanel'
import { IconArrowLeft, IconClose, IconSwords } from '../components/Icons'
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
  const [heroPickerOpen, setHeroPickerOpen] = useState(false)

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
      ? 'ICONIC 1v1'
      : mode === 'duel_1v1'
        ? '1 vs 1 (5 Kills)'
        : mode === 'tdm_3v3'
          ? '3 vs 3 (50 Kills)'
          : mode === 'practice'
            ? 'ฝึกซ้อม Dummy'
            : 'FFA 5 คน'

  return (
    <div className="ui-page battle-setup-backdrop">
      <div ref={shellRef} className="ui-shell create-room-modal">
        <header className="ui-topbar battle-setup-header">
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
            <h1 className="ui-page-title">ตั้งค่าห้องประลอง</h1>
          </div>

          <div className="ui-topbar-group">
            <span className="ui-pill accent">{modeLabel}</span>
            <span className="ui-pill">{getMapDisplayLabel(mapId, mode === 'iconic')}</span>
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

        <main className="clean-two-col">
          {/* Left: Clean Mode Selector */}
          <section className="ui-card" aria-label="เลือกโหมดการเล่น">
            <h2 className="ui-card-title">1. เลือกโหมดการเล่น</h2>

            <button
              type="button"
              className={`clean-choice-card choice-card ${mode === 'iconic' ? 'selected' : ''}`}
              onClick={() => selectMode('iconic')}
            >
              <div className="clean-choice-top">
                <span className="clean-choice-name">ICONIC 1v1: Gojo vs Sukuna</span>
                <span className="clean-choice-meta">2 คน • 5 Kills</span>
              </div>
              <div className="clean-choice-desc">
                มุมมอง 3D ด้านหลังตัวละคร • ปะทะอาณาเขต • สกิลฟื้นเลือด RCT
              </div>
            </button>

            <div className="clean-mode-grid">
              <button
                type="button"
                className={`clean-choice-card choice-card ${mode === 'duel_1v1' ? 'selected' : ''}`}
                onClick={() => selectMode('duel_1v1')}
              >
                <div className="clean-choice-top">
                  <span className="clean-choice-name">1 vs 1 ดวลเดือด</span>
                  <span className="clean-choice-meta">5 Kills</span>
                </div>
                <div className="clean-choice-desc">ดวล 2 คนในห้องรอ</div>
              </button>

              <button
                type="button"
                className={`clean-choice-card choice-card ${mode === 'tdm_3v3' ? 'selected' : ''}`}
                onClick={() => selectMode('tdm_3v3')}
              >
                <div className="clean-choice-top">
                  <span className="clean-choice-name">ทีม 3 vs 3</span>
                  <span className="clean-choice-meta">50 Kills</span>
                </div>
                <div className="clean-choice-desc">แบ่งทีม 6 คน Blue vs Red</div>
              </button>

              <button
                type="button"
                className={`clean-choice-card choice-card ${mode === 'practice' ? 'selected' : ''}`}
                onClick={() => selectMode('practice')}
              >
                <div className="clean-choice-top">
                  <span className="clean-choice-name">ฝึกซ้อม Dummy</span>
                  <span className="clean-choice-meta">1 คน</span>
                </div>
                <div className="clean-choice-desc">ทดสอบสกิลและคอมโบ</div>
              </button>

              <button
                type="button"
                className={`clean-choice-card choice-card ${mode === 'ffa' ? 'selected' : ''}`}
                onClick={() => selectMode('ffa')}
              >
                <div className="clean-choice-top">
                  <span className="clean-choice-name">ตะลุมบอน FFA</span>
                  <span className="clean-choice-meta">สูงสุด 5 คน</span>
                </div>
                <div className="clean-choice-desc">เข้าสมรภูมิทันที ไม่ต้องรอห้อง</div>
              </button>
            </div>
          </section>

          {/* Right: Clean 2x2 Map Selector + Summary CTA */}
          <section className="ui-card" aria-label="เลือกแผนที่และยืนยัน">
            <h2 className="ui-card-title">2. เลือกแผนที่</h2>

            <div className="clean-map-grid">
              <button
                type="button"
                className={`clean-choice-card choice-card ${mapId === 'shibuya' ? 'selected' : ''}`}
                onClick={() => setMapId('shibuya')}
              >
                <img src="/maps/shibuya_bg.webp" alt="Shibuya" className="clean-map-thumb" />
                <div className="clean-choice-name">ชิบูย่า (Shibuya)</div>
                <div className="clean-choice-meta">สมรภูมิใจกลางเมือง</div>
              </button>

              <button
                type="button"
                disabled={mode === 'iconic'}
                className={`clean-choice-card choice-card ${mapId === 'konoha' ? 'selected' : ''}`}
                onClick={() => setMapId('konoha')}
              >
                <img src="/maps/konoha_bg.webp" alt="Konoha" className="clean-map-thumb" />
                <div className="clean-choice-name">หมู่บ้านโคโนฮะ</div>
                <div className="clean-choice-meta">ลานประลองซากุระสมมาตร</div>
              </button>

              <button
                type="button"
                disabled={mode === 'iconic'}
                className={`clean-choice-card choice-card ${mapId === 'sisaket_island' ? 'selected' : ''}`}
                onClick={() => setMapId('sisaket_island')}
              >
                <img src="/maps/sisaket_bg.webp" alt="เกาะกลางน้ำ ศรีสะเกษ" className="clean-map-thumb" />
                <div className="clean-choice-name">เกาะกลางน้ำ ศรีสะเกษ</div>
                <div className="clean-choice-meta">ระวังตกน้ำ (-5 HP)</div>
              </button>

              <button
                type="button"
                disabled={mode === 'iconic'}
                className={`clean-choice-card choice-card ${mapId === 'scp_site' ? 'selected' : ''}`}
                onClick={() => setMapId('scp_site')}
              >
                <img src="/maps/scp_bg.webp" alt="สถานีวิจัย SCP" className="clean-map-thumb" />
                <div className="clean-choice-name">สถานีวิจัย SCP</div>
                <div className="clean-choice-meta">ลานวงกลม • จุดฟื้นเลือด +45</div>
              </button>
            </div>

            {mode === 'ffa' && activeFfaHero && (
              <div className="clean-ffa-hero-bar">
                <div className="clean-ffa-hero-info">
                  <img src={activeFfaHero.imageUrl} alt={activeFfaHero.displayName} />
                  <div>
                    <div className="clean-choice-meta">ฮีโร่ที่เลือกสำหรับ FFA</div>
                    <div className="clean-choice-name">{activeFfaHero.displayName}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => setHeroPickerOpen(true)}
                >
                  เปลี่ยนฮีโร่
                </button>
              </div>
            )}

            <div className="clean-setup-footer modal-actions">
              <div>
                <div className="clean-choice-name">{modeLabel}</div>
                <div className="clean-choice-meta">{getMapDisplayLabel(mapId, mode === 'iconic')}</div>
              </div>

              <button
                type="button"
                className="ui-btn cta-gold setup-confirm-btn"
                disabled={joining}
                onClick={() => void handleConfirm()}
              >
                <IconSwords size={16} />
                <span>{joining ? 'กำลังสร้างห้อง...' : 'สร้างห้องประลอง'}</span>
              </button>
            </div>
          </section>
        </main>
      </div>

      {heroPickerOpen && (
        <div
          className="clean-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="เลือกฮีโร่ลงสนาม FFA"
          onClick={() => setHeroPickerOpen(false)}
        >
          <div className="clean-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
              <h2 className="ui-page-title">เลือกฮีโร่ลงสนาม FFA</h2>
              <button
                type="button"
                className="ui-btn icon-only"
                onClick={() => setHeroPickerOpen(false)}
                aria-label="ปิด"
              >
                <IconClose size={15} />
              </button>
            </div>
            <HeroPickerPanel
              characters={characters}
              selectedId={selectedCharId}
              compactTabs
              maxHeight={340}
              onSelect={(charId) => {
                setSelectedCharId(charId)
                setHeroPickerOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
