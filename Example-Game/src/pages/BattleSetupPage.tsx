import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
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
  const setView = useGameStore((s) => s.setView)
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

  const modeLabel =
    mode === 'iconic'
      ? '⚡ ICONIC 1v1 (Gojo vs Sukuna)'
      : mode === 'duel_1v1'
        ? '⚔️ ดวลเดือด 1 vs 1 (5 Kills)'
        : mode === 'tdm_3v3'
          ? '🛡️ ประจัญบานทีม 3 vs 3 (50 Kills)'
          : mode === 'practice'
            ? '🎯 ฝึกซ้อมกับหุ่น Dummy'
            : '🔥 ตะลุมบอน 5 คน (FFA)'

  return (
    <div className="lobby-backdrop battle-setup-backdrop">
      <div ref={shellRef} className="battle-setup-shell create-room-modal">
        <header className="top-header battle-setup-header">
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
              <h1 className="brand-title">⚔️ เตรียมเข้าสู่สมรภูมิ (Battle Setup)</h1>
              <p className="brand-subtitle">
                เลือกโหมดการต่อสู้และแผนที่สนามรบ • ระบบจะสร้างรหัสห้อง 6 หลักให้อัตโนมัติ
              </p>
            </div>
          </div>

          <nav className="journey-stepper" aria-label="ขั้นตอนการเข้าสู่สมรภูมิ">
            <span className="journey-step done">① หน้าหลัก ✓</span>
            <span className="journey-sep">›</span>
            <span className="journey-step active">② เลือกโหมด &amp; แผนที่</span>
            <span className="journey-sep">›</span>
            <span className="journey-step">
              {mode === 'ffa' ? '③ เข้าสมรภูมิทันที' : '③ ห้องรอ & เลือกตัวละคร'}
            </span>
            {mode !== 'ffa' && (
              <>
                <span className="journey-sep">›</span>
                <span className="journey-step">④ เริ่มศึกพร้อมกัน</span>
              </>
            )}
          </nav>
        </header>

        {error && (
          <div className="alert-banner" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" className="btn-pill secondary compact" onClick={() => setError('')}>
              ปิด
            </button>
          </div>
        )}

        <main className="battle-setup-grid">
          {/* STEP 1: Choose Mode */}
          <section className="surface-card setup-step-card" aria-label="ขั้นตอนที่ 1 เลือกโหมดการเล่น">
            <div className="setup-step-head">
              <span className="setup-step-badge">STEP 1</span>
              <div>
                <h2 className="home-panel-title">เลือกโหมดการต่อสู้</h2>
                <p className="home-panel-sub">
                  ทุกโหมด (ยกเว้นตะลุมบอน FFA) จะเข้าสู่ห้องรอก่อนเพื่อให้เลือกตัวละครและกดเริ่มพร้อมกัน
                </p>
              </div>
            </div>

            <button
              type="button"
              className={`choice-card iconic-featured-card ${mode === 'iconic' ? 'selected' : ''}`}
              onClick={() => selectMode('iconic')}
            >
              <div className="iconic-card-row">
                <span className="iconic-badge-tag">⚡ SPECIAL 3D MODE</span>
                <span className="iconic-meta-pill">เข้าห้องรอ 2 คน • สุ่มตัวละคร • 5 Kills ชนะ</span>
              </div>
              <div className="choice-title">ICONIC 1v1: โกะโจ ซาโตรุ vs เรียวเมน สุคุนะ</div>
              <div className="choice-desc">
                มุมมองด้านหลังตัวละคร 3D ฉากชิบูย่า • สุ่ม Gojo/Sukuna ไม่ซ้ำกัน • สกิลไสยเวทย้อนกลับ (G) • กางอาณาเขตชนกัน • เพลง Judas!
              </div>
            </button>

            <div className="option-cards-grid two-cols">
              <button
                type="button"
                className={`choice-card ${mode === 'duel_1v1' ? 'selected' : ''}`}
                onClick={() => selectMode('duel_1v1')}
              >
                <div className="choice-card-top">
                  <span className="choice-icon">⚔️</span>
                  <span className="mode-flow-pill">เข้าห้องรอ 2/2 คน</span>
                </div>
                <div className="choice-title">1 vs 1 ดวลเดือด (5 Kills ชนะ)</div>
                <div className="choice-desc">
                  เข้าห้องรอเลือกฮีโร่ได้อย่างอิสระ เมื่อครบ 2 คนกดเริ่มเข้าสนามพร้อมกัน
                </div>
              </button>

              <button
                type="button"
                className={`choice-card ${mode === 'tdm_3v3' ? 'selected' : ''}`}
                onClick={() => selectMode('tdm_3v3')}
              >
                <div className="choice-card-top">
                  <span className="choice-icon">🛡️</span>
                  <span className="mode-flow-pill">เข้าห้องรอ 6/6 คน</span>
                </div>
                <div className="choice-title">ทีม 3 vs 3 (ครบ 50 Kills ชนะ)</div>
                <div className="choice-desc">
                  แบ่งทีมน้ำเงิน vs แดง เลือกฮีโร่ในห้องรอครบ 6 คนแล้วเปิดศึกพร้อมกัน
                </div>
              </button>

              <button
                type="button"
                className={`choice-card ${mode === 'practice' ? 'selected' : ''}`}
                onClick={() => selectMode('practice')}
              >
                <div className="choice-card-top">
                  <span className="choice-icon">🎯</span>
                  <span className="mode-flow-pill">เข้าห้องเตรียมตัว</span>
                </div>
                <div className="choice-title">ฝึกซ้อมกับหุ่น Dummy</div>
                <div className="choice-desc">
                  เข้าห้องรอเพื่อเลือกตัวละครและแผนที่ ก่อนกดเริ่มลงซ้อมสกิลและเช็กดาเมจ
                </div>
              </button>

              <button
                type="button"
                className={`choice-card ${mode === 'ffa' ? 'selected' : ''}`}
                onClick={() => selectMode('ffa')}
              >
                <div className="choice-card-top">
                  <span className="choice-icon">🔥</span>
                  <span className="mode-flow-pill instant">เข้าสมรภูมิทันที</span>
                </div>
                <div className="choice-title">ตะลุมบอน 5 คน (FFA)</div>
                <div className="choice-desc">
                  โหมดเดียวที่เข้าสมรภูมิได้ทันทีโดยไม่ต้องรอหน้าห้อง (เลือกฮีโร่ทางขวาได้เลย)
                </div>
              </button>
            </div>
          </section>

          {/* STEP 2: Choose Map & Review Next Journey Step */}
          <section className="surface-card setup-step-card" aria-label="ขั้นตอนที่ 2 เลือกแผนที่และยืนยัน">
            <div className="setup-step-head">
              <span className="setup-step-badge">STEP 2</span>
              <div>
                <h2 className="home-panel-title">
                  เลือกแผนที่สนามรบ {mode === 'iconic' ? '(โหมด ICONIC ล็อกฉากชิบูย่า 3D)' : ''}
                </h2>
                <p className="home-panel-sub">เลือกสมรภูมิที่คุณต้องการใช้ประลอง</p>
              </div>
            </div>

            <div className="option-cards-grid two-cols">
              <button
                type="button"
                className={`choice-card ${mapId === 'shibuya' ? 'selected' : ''}`}
                onClick={() => setMapId('shibuya')}
              >
                <img src="/maps/shibuya_bg.webp" alt="Shibuya" className="map-thumb" />
                <div className="choice-title">🏙️ ชิบูย่า (Shibuya Incident)</div>
                <div className="choice-desc">
                  {mode === 'iconic'
                    ? 'สมรภูมิชิบูย่า 3D มุมมองด้านหลังตัวละคร พร้อมเอฟเฟกต์กางอาณาเขตชนกัน'
                    : 'ลานคอนกรีตห้าแยกชิบูย่า เสาบังสกิลและพื้นที่ดวลเปิดกว้าง'}
                </div>
              </button>

              <button
                type="button"
                disabled={mode === 'iconic'}
                className={`choice-card ${mapId === 'konoha' ? 'selected' : ''} ${mode === 'iconic' ? 'disabled' : ''}`}
                onClick={() => setMapId('konoha')}
              >
                <img src="/maps/konoha_bg.webp" alt="Konoha" className="map-thumb" />
                <div className="choice-title">🍃 หมู่บ้านโคโนฮะ (นารุโตะ)</div>
                <div className="choice-desc">
                  ลานประลองใต้ผาหินโฮคาเงะ ฐานสองฝั่งสมดุล เหมาะกับทั้งดวลเดี่ยวและ 3v3
                </div>
              </button>
            </div>

            {mode === 'ffa' ? (
              <div className="setup-ffa-hero-box">
                <div className="setup-step-head compact">
                  <span className="setup-step-badge accent">FFA HERO</span>
                  <div>
                    <h3 className="setup-sub-title">เลือกฮีโร่ลงตะลุมบอนทันที</h3>
                    <p className="home-panel-sub">เพราะโหมด FFA เข้าสนามทันทีโดยไม่ผ่านห้องรอ</p>
                  </div>
                </div>
                <div className="inline-hero-grid">
                  {characters.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      className={`inline-hero-chip ${selectedCharId === ch.id ? 'active' : ''}`}
                      onClick={() => setSelectedCharId(ch.id)}
                    >
                      <img src={ch.imageUrl} alt={ch.displayName} className="inline-hero-thumb" />
                      <div className="inline-hero-text">
                        <span className="inline-hero-name">{ch.displayName}</span>
                        <span className="inline-hero-anime">{ch.animeTitle}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="journey-next-preview">
                <div className="journey-next-title">🧭 ขั้นตอนถัดไป (Step 3: ห้องรอเตรียมพร้อม)</div>
                <ul className="journey-next-list">
                  <li>
                    <strong>1. รับรหัสห้อง 6 หลัก:</strong> คัดลอกรหัสส่งให้เพื่อนเข้าร่วมห้องได้ทันที
                  </li>
                  <li>
                    <strong>2. เลือกตัวละครในห้องรอ:</strong>{' '}
                    {mode === 'iconic'
                      ? 'ระบบจะสุ่มให้ฝ่ายละ 1 ตัวระหว่าง โกะโจ ซาโตรุ และ เรียวเมน สุคุนะ อัตโนมัติ'
                      : 'เลือกเปลี่ยนฮีโร่และดูสกิล Q / E / R ได้อย่างอิสระภายในห้องรอ'}
                  </li>
                  <li>
                    <strong>3. เข้าสู่สมรภูมิพร้อมกัน:</strong> เมื่อผู้เล่นครบตามโหมด หัวหน้าห้องกดเริ่มเพื่อเข้าสนามพร้อมกัน
                  </li>
                </ul>
              </div>
            )}

            <div className="setup-summary-footer modal-actions">
              <div className="setup-summary-meta">
                <span className="setup-summary-Mode">{modeLabel}</span>
                <span className="setup-summary-map">
                  แผนที่: {mode === 'iconic' || mapId === 'shibuya' ? '🏙️ ชิบูย่า' : '🍃 หมู่บ้านโคโนฮะ'}
                </span>
              </div>

              <div className="setup-action-btns">
                <button type="button" className="btn-pill secondary" onClick={() => setView('home')}>
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="btn-pill primary setup-confirm-btn"
                  disabled={joining}
                  onClick={() => void handleConfirm()}
                >
                  {joining
                    ? 'กำลังสร้างห้อง...'
                    : mode === 'iconic'
                      ? '⚡ สร้างห้อง ICONIC & ไปห้องรอ (Step 3) →'
                      : mode === 'duel_1v1'
                        ? '⚔️ สร้างห้อง 1v1 & ไปห้องรอ (Step 3) →'
                        : mode === 'tdm_3v3'
                          ? '🛡️ สร้างห้อง 3v3 & ไปห้องรอ (Step 3) →'
                          : mode === 'practice'
                            ? '🎯 สร้างห้องฝึกซ้อม & ไปเลือกตัว (Step 3) →'
                            : '🔥 สร้างห้อง FFA & เข้าสมรภูมิทันที →'}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
