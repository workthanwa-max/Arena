import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { useGameStore } from '../store/useGameStore'
import type { GraphicsQuality } from '../types/game'

const GRAPHICS_TIERS: Array<{ id: GraphicsQuality; label: string; hint: string }> = [
  { id: 'pixel', label: '👾 Pixel 3D', hint: 'เรโทรพิกเซลคลาสสิก • ลื่นสุด ประหยัด GPU' },
  { id: 'fine_pixel', label: '🧩 Pixel ละเอียด', hint: 'พิกเซล Hi-Bit คมละเอียด 2x • คงสไตล์เรโทรชัด' },
  { id: 'hd', label: '✨ 3D HD', hint: '3D คมเนียนมาตรฐาน • สมดุลทุกอุปกรณ์' },
  { id: 'ultra', label: '👑 ULTRA MAX', hint: 'Retina Max + เงา 3D จริง + Bloom Glow (GPU ผู้ใช้)' },
]

interface HomePageProps {
  soundMuted: boolean
  isFullscreen: boolean
  onToggleSound: () => void
  onToggleFullscreen: () => void
}

/**
 * Lightweight 2D ambient cursed-energy particle canvas for a living Home Lobby:
 * Drifts Gojo Cyan (#38BDF8) orbs on the left, Sukuna Crimson (#EF4444) embers on the right,
 * and Golden Sanctuary sparks rising gently across the center (~42 particles, pauses when hidden).
 */
function HomeAmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = window.innerWidth
    let h = window.innerHeight
    const resize = () => {
      w = Math.max(320, window.innerWidth)
      h = Math.max(240, window.innerHeight)
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    interface Spark {
      x: number
      y: number
      vx: number
      vy: number
      r: number
      alpha: number
      phase: number
      kind: 'cyan' | 'red' | 'gold'
    }

    const sparks: Spark[] = Array.from({ length: 42 }, (_, i) => {
      const kind: Spark['kind'] = i % 3 === 0 ? 'cyan' : i % 3 === 1 ? 'red' : 'gold'
      const baseX =
        kind === 'cyan'
          ? Math.random() * w * 0.48
          : kind === 'red'
            ? w * 0.52 + Math.random() * w * 0.48
            : Math.random() * w
      return {
        x: baseX,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 18,
        vy: -(14 + Math.random() * 28),
        r: kind === 'gold' ? 1.5 + Math.random() * 2.2 : 2 + Math.random() * 3.4,
        alpha: 0.25 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        kind,
      }
    })

    let rafId = 0
    let lastTs = performance.now()
    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick)
      if (document.hidden) {
        lastTs = now
        return
      }
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTs) / 1000))
      lastTs = now

      ctx.clearRect(0, 0, w, h)

      // Soft pulsing Gojo Cyan (left) & Sukuna Crimson (right) atmospheric energy blooms
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.0014)
      const leftGlow = ctx.createRadialGradient(w * 0.24, h * 0.46, 12, w * 0.24, h * 0.46, w * 0.34)
      leftGlow.addColorStop(0, `rgba(56, 189, 248, ${0.11 + pulse * 0.06})`)
      leftGlow.addColorStop(1, 'rgba(56, 189, 248, 0)')
      ctx.fillStyle = leftGlow
      ctx.fillRect(0, 0, w * 0.65, h)

      const rightGlow = ctx.createRadialGradient(w * 0.76, h * 0.46, 12, w * 0.76, h * 0.46, w * 0.34)
      rightGlow.addColorStop(0, `rgba(239, 68, 68, ${0.1 + (1 - pulse) * 0.06})`)
      rightGlow.addColorStop(1, 'rgba(239, 68, 68, 0)')
      ctx.fillStyle = rightGlow
      ctx.fillRect(w * 0.35, 0, w * 0.65, h)

      // Floating glowing sparks & cursed-energy motes
      for (const s of sparks) {
        s.phase += dt * 2.2
        s.x += (s.vx + Math.sin(s.phase) * 10) * dt
        s.y += s.vy * dt
        if (s.y < -20) {
          s.y = h + 15
          s.x =
            s.kind === 'cyan'
              ? Math.random() * w * 0.5
              : s.kind === 'red'
                ? w * 0.5 + Math.random() * w * 0.5
                : Math.random() * w
        }
        if (s.x < -20) s.x = w + 10
        if (s.x > w + 20) s.x = -10

        const twinkle = 0.45 + 0.55 * Math.sin(s.phase * 1.4)
        const a = s.alpha * twinkle
        const col =
          s.kind === 'cyan'
            ? `rgba(56, 189, 248, ${a})`
            : s.kind === 'red'
              ? `rgba(248, 113, 113, ${a})`
              : `rgba(253, 224, 71, ${a})`

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * 2.4, 0, Math.PI * 2)
        ctx.fillStyle =
          s.kind === 'cyan'
            ? `rgba(56, 189, 248, ${a * 0.22})`
            : s.kind === 'red'
              ? `rgba(239, 68, 68, ${a * 0.22})`
              : `rgba(250, 204, 21, ${a * 0.25})`
        ctx.fill()

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = col
        ctx.fill()
      }
    }
    rafId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="mlbb-home-fx-canvas" aria-hidden="true" />
}

export function HomePage({ soundMuted, isFullscreen, onToggleSound, onToggleFullscreen }: HomePageProps) {
  const [gfxDrawerOpen, setGfxDrawerOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const roomInput = useGameStore((s) => s.roomInput)
  const recentRooms = useGameStore((s) => s.recentRooms)
  const joining = useGameStore((s) => s.joining)
  const checkingJoinRoom = useGameStore((s) => s.checkingJoinRoom)
  const graphicsQuality = useGameStore((s) => s.graphicsQuality)
  const error = useGameStore((s) => s.error)

  const setView = useGameStore((s) => s.setView)
  const inspectCharacter = useGameStore((s) => s.inspectCharacter)
  const setRoomInput = useGameStore((s) => s.setRoomInput)
  const setGraphicsQuality = useGameStore((s) => s.setGraphicsQuality)
  const setError = useGameStore((s) => s.setError)
  const prepareJoinRoom = useGameStore((s) => s.prepareJoinRoom)
  const logoutAccount = useGameStore((s) => s.logoutAccount)

  const stageRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    animateCardEnter(stageRef.current)
  }, [])

  const activeTier = GRAPHICS_TIERS.find((t) => t.id === graphicsQuality) ?? GRAPHICS_TIERS[0]

  return (
    <div className="mlbb-home-stage">
      {/* Full-Bleed Animated Celestial Sanctuary Gojo vs Sukuna Wallpaper + Ambient Cursed Energy Canvas */}
      <img
        src="/fx/home_lobby_gojo_sukuna_bg.jpg"
        alt="Infinity Clash — Gojo vs Sukuna Sanctuary"
        className="mlbb-home-bg-img"
      />
      <HomeAmbientCanvas />
      <div className="mlbb-home-vignette" aria-hidden="true" />

      <div ref={stageRef} className="mlbb-home-chrome">
        {/* TOP HUD BAR: Profile & Gojo-Sukuna Emblem (Left — no back button!) | Single Graphics & System Controls (Right) */}
        <header className="mlbb-topbar home-top-nav">
          <div className="mlbb-topbar-left">
            <div className="mlbb-emblem-cluster">
              <div className="mlbb-emblem-frame">
                <img
                  src="/fx/logo_gojo_sukuna.jpg"
                  alt="Infinity Clash — Gojo vs Sukuna"
                  className="mlbb-emblem-img"
                />
              </div>
              <div className="mlbb-brand-stack">
                <div className="mlbb-wordmark">
                  <span className="mlbb-word-cyan">INFINITY</span>
                  <span className="mlbb-word-gold">CLASH</span>
                </div>
                <div className="mlbb-player-tag">
                  {authUser?.role === 'admin' ? '👑 ' : '⚔️ '}
                  <strong>{authUser?.displayName}</strong>
                  <span>@{authUser?.username}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mlbb-topbar-right">
            <button
              type="button"
              className={`mlbb-glass-btn gfx-trigger ${gfxDrawerOpen ? 'active' : ''}`}
              onClick={() => {
                soundEngine.unlock()
                setGfxDrawerOpen((v) => !v)
              }}
              title="ปรับระดับกราฟิกสนาม 3D (Client GPU)"
            >
              🎨 {activeTier.label} ▾
            </button>

            <button
              type="button"
              className="mlbb-glass-btn icon-only sound-toggle"
              onClick={onToggleSound}
              title={soundMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
              aria-label="เปิด/ปิดเสียง"
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>

            <button
              type="button"
              className="mlbb-glass-btn icon-only home-fs-btn"
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
              className="mlbb-glass-btn danger compact home-logout-btn"
              onClick={() => {
                soundEngine.unlock()
                setLogoutConfirmOpen(true)
              }}
            >
              ออกระบบ
            </button>
          </div>
        </header>

        {/* Compact Top-Right Graphics Quality Popover (Always mounted in DOM or collapsible for crisp layout) */}
        <section
          className={`mlbb-gfx-panel home-graphics-bar ${gfxDrawerOpen ? 'open' : ''}`}
          aria-label="ตั้งค่าความละเอียดภาพ (GPU)"
        >
          <div className="mlbb-gfx-head">
            <span className="mlbb-gfx-title">🎨 ระดับภาพสนาม 3D (Client GPU)</span>
            <span className="mlbb-gfx-hint">{activeTier.hint}</span>
          </div>
          <div className="home-gfx-pills" role="radiogroup" aria-label="เลือกระดับความละเอียดภาพ">
            {GRAPHICS_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                role="radio"
                aria-checked={graphicsQuality === tier.id}
                className={`home-gfx-pill ${tier.id} ${graphicsQuality === tier.id ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.unlock()
                  setGraphicsQuality(tier.id)
                }}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="mlbb-alert-toast" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" className="mlbb-glass-btn compact" onClick={() => setError('')}>
              ปิด
            </button>
          </div>
        )}

        {/* MIDDLE STAGE: Open Heroic Center for Gojo & Sukuna + Sleek Right Join-Room Glass Panel */}
        <main className="mlbb-home-mid">
          {/* Left Floating Game Crest Pill */}
          <div className="mlbb-home-left-crest">
            <div className="mlbb-crest-badge">
              <img
                src="/fx/logo_gojo_sukuna.jpg"
                alt="Gojo vs Sukuna Emblem"
                className="mlbb-crest-icon"
              />
              <div className="mlbb-crest-copy">
                <span className="mlbb-crest-eyebrow">SEASON 1 • MULTIVERSE ARENA</span>
                <strong className="mlbb-crest-name">GOJO × SUKUNA</strong>
              </div>
            </div>
          </div>

          {/* Right Translucent Panel (Inspired by MLBB Right Dock — 100% Real Feature: Join 6-Digit Room!) */}
          <aside className="mlbb-join-dock" aria-label="เข้าร่วมห้องด้วยรหัส 6 หลัก">
            <div className="mlbb-join-dock-head">
              <span className="mlbb-dock-title">🔑 เข้าร่วมห้องเพื่อน</span>
              <span className="mlbb-dock-tag">รหัส 6 หลัก</span>
            </div>

            <div className="mlbb-join-input-row">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="mlbb-code-input home-code-input"
                placeholder="กรอกรหัส 6 หลัก"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && /^\d{6}$/.test(roomInput.trim())) {
                    void prepareJoinRoom(roomInput)
                  }
                }}
              />
              <button
                type="button"
                className="mlbb-join-submit home-join-btn"
                disabled={joining || checkingJoinRoom || !/^\d{6}$/.test(roomInput.trim())}
                onClick={() => void prepareJoinRoom()}
              >
                {checkingJoinRoom || joining ? '...' : 'เข้าห้อง'}
              </button>
            </div>

            {recentRooms.filter((r) => /^\d{6}$/.test(r.roomId)).length > 0 && (
              <div className="mlbb-recent-row">
                <span className="mlbb-recent-label">ล่าสุด:</span>
                {recentRooms
                  .filter((r) => /^\d{6}$/.test(r.roomId))
                  .slice(0, 3)
                  .map((r) => (
                    <button
                      key={r.roomId}
                      type="button"
                      className="mlbb-recent-chip"
                      onClick={() => setRoomInput(r.roomId)}
                    >
                      #{r.roomId}
                    </button>
                  ))}
              </div>
            )}
          </aside>
        </main>

        {/* BOTTOM MLBB-STYLE NAVIGATION BAR + GOLDEN BEVELED CTA */}
        <footer className="mlbb-bottom-bar">
          <nav className="mlbb-bottom-nav" aria-label="เมนูหลัก">
            <button
              type="button"
              className="mlbb-nav-tab home-heroes-nav-btn"
              onClick={() => {
                soundEngine.unlock()
                inspectCharacter(characters[0]?.id)
              }}
            >
              <span className="mlbb-nav-ico">🦸</span>
              <span className="mlbb-nav-label">ฮีโร่ของฉัน</span>
              <span className="mlbb-nav-count">{characters.length}</span>
            </button>

            <button
              type="button"
              className="mlbb-nav-tab home-practice-btn"
              disabled={joining}
              onClick={() => {
                soundEngine.unlock()
                void useGameStore.getState().startPracticeMode()
              }}
            >
              <span className="mlbb-nav-ico">🎯</span>
              <span className="mlbb-nav-label">ฝึกซ้อม</span>
            </button>
          </nav>

          {/* Bottom-Right Iconic Golden Metallic Play CTA + Mode Diamond */}
          <div className="mlbb-cta-cluster">
            <button
              type="button"
              className="mlbb-mode-diamond"
              disabled={joining}
              onClick={() => {
                soundEngine.unlock()
                setView('battle_setup')
              }}
              title="เลือกโหมดการเล่น (ICONIC, 1v1, 3v3, FFA)"
            >
              <span className="mlbb-diamond-icon">⚡</span>
              <span className="mlbb-diamond-label">โหมด</span>
            </button>

            <button
              type="button"
              className="mlbb-gold-cta home-play-btn"
              disabled={joining}
              onClick={() => {
                soundEngine.unlock()
                setView('battle_setup')
              }}
            >
              <span className="mlbb-gold-cta-main">⚔️ สร้างห้องประลอง</span>
              <span className="mlbb-gold-cta-sub">ICONIC • 1v1 • 3v3 • FFA</span>
            </button>
          </div>
        </footer>
      </div>
      {logoutConfirmOpen && (
        <div
          className="mlbb-logout-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          onClick={() => setLogoutConfirmOpen(false)}
        >
          <div className="mlbb-logout-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="mlbb-logout-icon" aria-hidden="true">
              🚪
            </div>
            <h2 id="logout-confirm-title" className="mlbb-logout-title">
              ยืนยันออกจากระบบ?
            </h2>
            <p className="mlbb-logout-desc">
              คุณต้องการออกจากระบบบัญชี <strong>@{authUser?.username}</strong> ใช่หรือไม่?
              <br />
              <span>(หากไม่ออก ระบบจะจดจำการเข้าสู่ระบบให้อัตโนมัตินาน 1 ปี)</span>
            </p>
            <div className="mlbb-logout-actions">
              <button
                type="button"
                className="mlbb-glass-btn compact mlbb-logout-cancel"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="mlbb-glass-btn danger compact mlbb-logout-confirm"
                onClick={() => {
                  setLogoutConfirmOpen(false)
                  void logoutAccount()
                }}
              >
                ยืนยันออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
