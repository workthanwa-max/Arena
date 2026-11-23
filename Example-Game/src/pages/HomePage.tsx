import { useEffect, useRef } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { useGameStore } from '../store/useGameStore'

interface HomePageProps {
  soundMuted: boolean
  isFullscreen: boolean
  onToggleSound: () => void
  onToggleFullscreen: () => void
}

export function HomePage({ soundMuted, isFullscreen, onToggleSound, onToggleFullscreen }: HomePageProps) {
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const roomInput = useGameStore((s) => s.roomInput)
  const recentRooms = useGameStore((s) => s.recentRooms)
  const joining = useGameStore((s) => s.joining)
  const error = useGameStore((s) => s.error)

  const setView = useGameStore((s) => s.setView)
  const goBack = useGameStore((s) => s.goBack)
  const inspectCharacter = useGameStore((s) => s.inspectCharacter)
  const setRoomInput = useGameStore((s) => s.setRoomInput)
  const setError = useGameStore((s) => s.setError)
  const joinRoom = useGameStore((s) => s.joinRoom)
  const logoutAccount = useGameStore((s) => s.logoutAccount)

  const shellRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    animateCardEnter(shellRef.current)
  }, [])

  return (
    <div className="lobby-backdrop home-hub-backdrop">
      <div ref={shellRef} className="home-hub-shell">
        <header className="top-header home-top-nav">
          <div className="brand-group">
            <button
              type="button"
              className="btn-pill secondary compact page-back-btn"
              onClick={goBack}
              aria-label="ย้อนกลับ"
              title="ย้อนกลับไปหน้าเข้าสู่ระบบ / สลับบัญชี"
            >
              ← ย้อนกลับ
            </button>
            <img src="/app-icon.png?v=20261120v2" alt="PulseArena" className="brand-logo-img" />
            <div>
              <h1 className="brand-title">PULSE ARENA</h1>
              <p className="brand-subtitle">
                ผู้เล่น: <strong>{authUser?.displayName}</strong> (@{authUser?.username})
              </p>
            </div>
          </div>

          <div className="telemetry-pills">
            <button
              type="button"
              className="pill-badge accent clickable-pill"
              onClick={() => {
                soundEngine.unlock()
                inspectCharacter(characters[0]?.id)
              }}
            >
              🦸 ตัวละครที่ฉันมี ({characters.length})
            </button>
            <button type="button" className="pill-badge sound-toggle" onClick={onToggleSound}>
              {soundMuted ? '🔇 เสียง: ปิด' : '🔊 เสียง: เปิด'}
            </button>
            <button
              type="button"
              className="rov-icon-btn home-fs-btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นแบบเต็มจอ'}
              aria-label={isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นแบบเต็มจอ'}
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="btn-pill danger-outline compact"
              onClick={() => void logoutAccount()}
            >
              🚪 Logout
            </button>
          </div>
        </header>

        {/* Clear 4-Step User Journey Banner */}
        <section className="surface-card home-journey-banner" aria-label="ลำดับขั้นตอนการเข้าเล่น">
          <div className="journey-banner-item active">
            <span className="jb-num">1</span>
            <div>
              <div className="jb-title">หน้าหลัก (เลือกทางเข้า)</div>
              <div className="jb-desc">สร้างห้องใหม่ หรือใส่รหัส 6 หลักเข้าห้องเพื่อน</div>
            </div>
          </div>
          <span className="jb-arrow">→</span>
          <div className="journey-banner-item">
            <span className="jb-num">2</span>
            <div>
              <div className="jb-title">ตั้งค่าโหมด &amp; สมรภูมิ</div>
              <div className="jb-desc">เลือก ICONIC 3D, 1v1, 3v3, ฝึกซ้อม หรือ FFA</div>
            </div>
          </div>
          <span className="jb-arrow">→</span>
          <div className="journey-banner-item">
            <span className="jb-num">3</span>
            <div>
              <div className="jb-title">ห้องรอ &amp; เลือกฮีโร่</div>
              <div className="jb-desc">เลือกตัวละครในห้องรอให้พร้อมก่อนเริ่ม</div>
            </div>
          </div>
          <span className="jb-arrow">→</span>
          <div className="journey-banner-item">
            <span className="jb-num">4</span>
            <div>
              <div className="jb-title">เข้าสู่สมรภูมิพร้อมกัน</div>
              <div className="jb-desc">เปิดศึกตัดสินแพ้ชนะแบบเรียลไทม์ 60Hz</div>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert-banner" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" className="btn-pill secondary compact" onClick={() => setError('')}>
              ปิด
            </button>
          </div>
        )}

        {/* Primary Action Journey Split: (Left) Create New Match vs (Right) Join Existing Room by 6-Digit Code */}
        <main className="home-journey-cards">
          <section className="surface-card home-path-card primary-path" aria-label="สร้างห้องเริ่มเกมใหม่">
            <div className="path-step-tag">ทางเลือกที่ 1 • สร้างแมตช์ใหม่ (HOST)</div>
            <h2 className="path-card-title">⚔️ สร้างห้องเข้าสู่สมรภูมิ</h2>
            <p className="path-card-desc">
              ไปที่หน้าตั้งค่าการรบเพื่อเลือกโหมด (ICONIC Gojo vs Sukuna, 1v1, 3v3, ฝึกซ้อม, FFA) และเลือกแผนที่ ระบบจะสร้างรหัสห้อง 6 หลักและพาไปเลือกตัวละครในห้องรอ
            </p>

            <div className="path-mode-tags">
              <span className="mode-mini-tag iconic">⚡ ICONIC 3D (Gojo vs Sukuna)</span>
              <span className="mode-mini-tag">⚔️ ดวล 1 vs 1</span>
              <span className="mode-mini-tag">🛡️ ทีม 3 vs 3</span>
              <span className="mode-mini-tag">🔥 ตะลุมบอน FFA</span>
            </div>

            <div className="path-card-actions">
              <button
                type="button"
                className="btn-pill primary home-play-btn"
                disabled={joining}
                onClick={() => {
                  soundEngine.unlock()
                  setView('battle_setup')
                }}
              >
                <span className="home-btn-main">⚔️ ไปหน้าเลือกโหมด &amp; สร้างห้อง (Step 2) →</span>
                <span className="home-btn-sub">เลือกโหมด • เลือกแผนที่ • เข้าห้องรอพร้อมกัน</span>
              </button>

              <button
                type="button"
                className="btn-pill secondary home-practice-btn"
                disabled={joining}
                onClick={() => {
                  soundEngine.unlock()
                  void useGameStore.getState().startPracticeMode()
                }}
              >
                🎯 ทางลัด: เข้าห้องฝึกซ้อมกับหุ่น Dummy ทันที
              </button>
            </div>
          </section>

          <section className="surface-card home-path-card join-path" aria-label="เข้าร่วมห้องด้วยรหัส 6 หลัก">
            <div className="path-step-tag">ทางเลือกที่ 2 • เข้าห้องเพื่อน (JOIN)</div>
            <h2 className="path-card-title">🔑 เข้าร่วมห้องด้วยรหัส 6 หลัก</h2>
            <p className="path-card-desc">
              มีรหัสห้องจากเพื่อนแล้ว? กรอกเลขห้อง 6 หลักด้านล่างเพื่อข้ามไปที่ <strong>ห้องรอเตรียมพร้อม (Step 3)</strong> และเลือกฮีโร่ลงสนามได้ทันที
            </p>

            <div className="home-join-box">
              <span className="field-label">รหัสห้อง 6 หลัก</span>
              <div className="home-join-row">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="text-input mono home-code-input"
                  placeholder="กรอกเลข 6 หลัก เช่น 482915"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && /^\d{6}$/.test(roomInput.trim())) {
                      void joinRoom(roomInput)
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-pill primary home-join-btn"
                  disabled={joining || !/^\d{6}$/.test(roomInput.trim())}
                  onClick={() => void joinRoom()}
                >
                  {joining ? 'กำลังเข้า...' : 'เข้าร่วมห้อง →'}
                </button>
              </div>

              {recentRooms.length > 0 && (
                <div className="recent-rooms-row">
                  <span className="field-label">ห้องล่าสุด:</span>
                  {recentRooms
                    .filter((r) => /^\d{6}$/.test(r.roomId))
                    .map((r) => (
                      <button
                        key={r.roomId}
                        type="button"
                        className="recent-chip"
                        onClick={() => setRoomInput(r.roomId)}
                      >
                        #{r.roomId}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Bottom Clean Roster Bar: My Owned Characters (Click to inspect details; pick actual fighter in Room Lobby!) */}
        <section className="surface-card home-roster-panel" aria-label="ตัวละครที่ฉันมี">
          <div className="home-hero-badge-row">
            <div>
              <h2 className="home-panel-title">🦸 ตัวละครที่ฉันมี ({characters.length} ตัว)</h2>
              <p className="home-panel-sub">
                คลิกที่ตัวละครเพื่อเปิดหน้าดูข้อมูลสกิลและฟังเสียงพากย์ญี่ปุ่น • การเลือกตัวใช้สู้จะเลือกตอนอยู่ในห้องรอ
              </p>
            </div>
            <button
              type="button"
              className="btn-pill secondary compact home-heroes-cta"
              onClick={() => {
                soundEngine.unlock()
                inspectCharacter(characters[0]?.id)
              }}
            >
              📖 เปิดหน้าคลังตัวละครทั้งหมด →
            </button>
          </div>

          <div className="home-owned-strip">
            {characters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className="home-owned-card"
                style={{ '--hero-accent': ch.color } as React.CSSProperties}
                onClick={() => {
                  soundEngine.unlock()
                  inspectCharacter(ch.id)
                }}
              >
                <img src={ch.imageUrl} alt={ch.displayName} className="home-owned-avatar" />
                <div className="home-owned-meta">
                  <div className="home-owned-name">
                    {ch.displayName}
                    {ch.adminOnly ? ' 👑' : ''}
                  </div>
                  <div className="home-owned-anime">{ch.animeTitle}</div>
                  <div className="home-owned-stats">
                    <span>❤️ {ch.maxHp}</span>
                    <span>• {ch.skills.length} สกิล</span>
                  </div>
                </div>
                <span className="home-owned-arrow">ดู ›</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
