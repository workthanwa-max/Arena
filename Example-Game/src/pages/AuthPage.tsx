import { type FormEvent, useEffect, useRef, useState } from 'react'
import { animateCardEnter, animateSpringPop } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { useGameStore } from '../store/useGameStore'

const SPARK_DOTS = Array.from({ length: 14 }, (_, idx) => ({
  id: idx,
  leftPct: `${7 + ((idx * 19) % 86)}%`,
  delaySec: `${(idx * 0.45) % 4.5}s`,
  durSec: `${4.2 + (idx % 4) * 1.1}s`,
  tone: idx % 2 === 0 ? 'cyan' : 'crimson',
}))

export function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const authUser = useGameStore((s) => s.authUser)
  const authLoading = useGameStore((s) => s.authLoading)
  const error = useGameStore((s) => s.error)
  const setError = useGameStore((s) => s.setError)
  const goBack = useGameStore((s) => s.goBack)
  const loginAccount = useGameStore((s) => s.loginAccount)
  const registerAccount = useGameStore((s) => s.registerAccount)

  function handleAuthBack() {
    soundEngine.unlock()
    if (tab === 'register') {
      setTab('login')
      setError('')
      return
    }
    if (authUser) {
      goBack()
      return
    }
    setError('')
    if (window.history.length > 1) {
      window.history.back()
    }
  }

  const cardRef = useRef<HTMLElement | null>(null)
  const metaRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    animateCardEnter(cardRef.current)
    animateSpringPop(metaRef.current)
    const syncFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    syncFs()
    document.addEventListener('fullscreenchange', syncFs)
    return () => document.removeEventListener('fullscreenchange', syncFs)
  }, [])

  async function toggleFullscreen() {
    soundEngine.unlock()
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // Ignore fullscreen denial on restricted platforms
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    soundEngine.unlock()
    if (tab === 'login') {
      await loginAccount(username, password)
    } else {
      await registerAccount(username, password, displayName)
    }
  }

  return (
    <div className="auth-mobile-stage">
      {/* Full-Bleed Animated Gojo vs Sukuna Key-Art Wallpaper */}
      <img
        src="/fx/auth_gojo_sukuna_bg.jpg"
        alt="Gojo vs Sukuna Shibuya Clash"
        className="auth-wallpaper-img"
      />
      <div className="auth-wallpaper-scrim" aria-hidden="true" />
      <div className="auth-ember-field" aria-hidden="true">
        {SPARK_DOTS.map((sp) => (
          <span
            key={sp.id}
            className={`auth-spark ${sp.tone}`}
            style={{
              left: sp.leftPct,
              animationDelay: sp.delaySec,
              animationDuration: sp.durSec,
            }}
          />
        ))}
      </div>

      {/* Top Mobile Game Brand & Server Status Chrome */}
      <header className="auth-topbar">
        <div className="auth-topbar-left">
          <button
            type="button"
            className="auth-back-btn"
            onClick={handleAuthBack}
            aria-label="ย้อนกลับ"
            title={tab === 'register' ? 'ย้อนกลับไปเข้าสู่ระบบ' : authUser ? 'ย้อนกลับหน้าหลัก' : 'ย้อนกลับ'}
          >
            ← ย้อนกลับ
          </button>
          <div className="auth-brand-cluster">
            <img src="/app-icon.png?v=20261120v2" alt="PulseArena" className="auth-brand-logo" />
            <div className="auth-brand-copy">
              <div className="auth-edition-chip">JUJUTSU SHOWDOWN • ICONIC ARENA</div>
              <h1 className="auth-brand-title">PULSE ARENA</h1>
            </div>
          </div>
        </div>

        <div className="auth-topbar-right">
          <span className="auth-server-pill">
            <span className="auth-server-dot" aria-hidden="true" />
            SERVER ONLINE • 60Hz
          </span>
          <button
            type="button"
            className="auth-fs-btn"
            onClick={() => void toggleFullscreen()}
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
        </div>
      </header>

      {/* Main Mobile-Game Glass Auth Panel (Floats Cleanly Between Gojo & Sukuna) */}
      <main className="auth-center-stage">
        <section
          ref={cardRef}
          className="auth-mobile-card"
          aria-label="เข้าสู่ระบบและสมัครสมาชิก"
        >
          <div className="auth-card-crest">
            <span className="auth-crest-line cyan" />
            <span className="auth-crest-text">
              {tab === 'login' ? 'LOGIN TO BATTLEFIELD' : 'CREATE WARRIOR ID'}
            </span>
            <span className="auth-crest-line crimson" />
          </div>

          <div className="auth-segmented-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setTab('login')
                setError('')
              }}
            >
              🔑 เข้าสู่ระบบ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setTab('register')
                setError('')
              }}
            >
              ✨ สมัครสมาชิก
            </button>
          </div>

          {error && (
            <div className="auth-alert-banner" role="alert">
              <span>⚠️ {error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="auth-field-group">
              <span className="auth-field-label">Username (3–20 ตัวอักษร/ตัวเลข)</span>
              <div className="auth-input-shell">
                <span className="auth-input-icon" aria-hidden="true">👤</span>
                <input
                  type="text"
                  className="auth-dark-input"
                  autoComplete="username"
                  placeholder="เช่น thanwa_01"
                  value={username}
                  maxLength={20}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </label>

            {tab === 'register' && (
              <label className="auth-field-group">
                <span className="auth-field-label">ชื่อในเกม (Display Name)</span>
                <div className="auth-input-shell">
                  <span className="auth-input-icon" aria-hidden="true">🎭</span>
                  <input
                    type="text"
                    className="auth-dark-input"
                    placeholder="ชื่อบนหัวฮีโร่ (ไม่บังคับ)"
                    value={displayName}
                    maxLength={24}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </label>
            )}

            <label className="auth-field-group">
              <span className="auth-field-label">Password (อย่างน้อย 6 ตัวอักษร)</span>
              <div className="auth-input-shell">
                <span className="auth-input-icon" aria-hidden="true">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-dark-input"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  maxLength={72}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            <button type="submit" className="auth-play-cta" disabled={authLoading}>
              <span className="auth-cta-glow" aria-hidden="true" />
              <span className="auth-cta-label">
                {authLoading
                  ? '⏳ กำลังเชื่อมต่อสมรภูมิ...'
                  : tab === 'login'
                    ? '⚔️ เข้าสู่เกม (PRESS TO PLAY)'
                    : '🛡️ สมัคร & รับฮีโร่ฟรี 10 ตัว'}
              </span>
            </button>
          </form>

          <p className="auth-session-note">
            🔐 Session ถาวรจนกว่าจะกด Logout • เข้าเล่นได้ทุกอุปกรณ์
          </p>
        </section>
      </main>

      {/* Bottom-Right Clean Beta Version Badge */}
      <aside ref={metaRef} className="auth-beta-badge" aria-label="ข้อมูลเวอร์ชัน Beta">
        <span className="auth-beta-pill">BETA v1.0</span>
        <span className="auth-beta-text">เวอร์ชัน Beta • ทดสอบและปรับสมดุลต่อเนื่อง</span>
      </aside>
    </div>
  )
}
