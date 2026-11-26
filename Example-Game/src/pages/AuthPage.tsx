import { type FormEvent, useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { IconFullscreen } from '../components/Icons'
import { useGameStore } from '../store/useGameStore'

export function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const authLoading = useGameStore((s) => s.authLoading)
  const error = useGameStore((s) => s.error)
  const setError = useGameStore((s) => s.setError)
  const loginAccount = useGameStore((s) => s.loginAccount)
  const registerAccount = useGameStore((s) => s.registerAccount)

  const cardRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    animateCardEnter(cardRef.current)
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
      <img
        src="/fx/auth_gojo_sukuna_bg.jpg"
        alt="Infinity Clash Backdrop"
        className="auth-wallpaper-img"
      />
      <div className="auth-wallpaper-scrim" aria-hidden="true" />

      <header className="auth-topbar">
        <div className="auth-topbar-left">
          <div className="clean-brand">
            <img src="/fx/logo_gojo_sukuna.jpg" alt="Infinity Clash" className="clean-brand-logo" />
            <div>
              <div className="clean-brand-title">INFINITY CLASH</div>
              <div className="clean-brand-user">Multiverse 3D Arena</div>
            </div>
          </div>
        </div>

        <div className="ui-topbar-group">
          <span className="ui-pill">
            <span className="auth-server-dot" aria-hidden="true" />
            ONLINE • 60Hz
          </span>
          <button
            type="button"
            className="ui-btn icon-only"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นแบบเต็มจอ'}
            aria-label={isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นแบบเต็มจอ'}
          >
            <IconFullscreen size={16} exit={isFullscreen} />
          </button>
        </div>
      </header>

      <main className="auth-center-stage">
        <section
          ref={cardRef}
          className="auth-mobile-card"
          aria-label="เข้าสู่ระบบและสมัครสมาชิก"
        >
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
              เข้าสู่ระบบ
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
              สมัครสมาชิก
            </button>
          </div>

          {error && (
            <div className="ui-alert" role="alert">
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="auth-field-group">
              <span className="auth-field-label">Username</span>
              <div className="auth-input-shell">
                <input
                  type="text"
                  className="auth-dark-input"
                  autoComplete="username"
                  placeholder="ชื่อผู้ใช้"
                  value={username}
                  maxLength={20}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </label>

            {tab === 'register' && (
              <label className="auth-field-group">
                <span className="auth-field-label">ชื่อในเกม</span>
                <div className="auth-input-shell">
                  <input
                    type="text"
                    className="auth-dark-input"
                    placeholder="ชื่อที่แสดงในเกม"
                    value={displayName}
                    maxLength={24}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </label>
            )}

            <label className="auth-field-group">
              <span className="auth-field-label">Password</span>
              <div className="auth-input-shell">
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
                >
                  {showPassword ? 'ซ่อน' : 'แสดง'}
                </button>
              </div>
            </label>

            <button type="submit" className="auth-play-cta" disabled={authLoading}>
              <span className="auth-cta-label">
                {authLoading
                  ? 'กำลังเข้าสู่เกม...'
                  : tab === 'login'
                    ? 'เข้าสู่สนามรบ'
                    : 'สมัครและเข้าเล่น'}
              </span>
            </button>
          </form>
        </section>
      </main>

      <aside className="auth-beta-badge" aria-label="เวอร์ชันเกม">
        <span className="ui-pill">v1.0</span>
      </aside>
    </div>
  )
}
