import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { HeroPickerPanel } from '../components/HeroPickerPanel'
import {
  IconClose,
  IconFullscreen,
  IconKey,
  IconLogOut,
  IconPlay,
  IconSettings,
  IconTarget,
  IconUsers,
  IconVolume,
} from '../components/Icons'
import { getMapDisplayLabel } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'
import type { GameMode, GraphicsQuality, MapId } from '../types/game'

const GRAPHICS_TIERS: Array<{ id: GraphicsQuality; label: string; hint: string }> = [
  { id: 'pixel', label: 'Pixel 3D', hint: 'เรโทรพิกเซล • ลื่นสุด' },
  { id: 'fine_pixel', label: 'Pixel ละเอียด', hint: 'พิกเซล Hi-Bit คม 2x' },
  { id: 'hd', label: '3D HD', hint: 'คมชัดมาตรฐาน สมดุล' },
  { id: 'ultra', label: 'ULTRA MAX', hint: 'Retina + เงา 3D + Bloom' },
]

const DIAMOND_MODES: Array<{
  id: GameMode
  posClass: string
  title: string
  sub: string
  thumb: string
}> = [
  {
    id: 'tdm_3v3',
    posClass: 'pos-3v3',
    title: 'TEAM 3v3',
    sub: '6 คน • 50 Kills',
    thumb: '/maps/konoha_bg.webp',
  },
  {
    id: 'duel_1v1',
    posClass: 'pos-1v1',
    title: '1 vs 1',
    sub: '2 คน • 5 Kills',
    thumb: '/maps/shibuya_bg.webp',
  },
  {
    id: 'ffa',
    posClass: 'pos-ffa',
    title: 'FFA 5 คน',
    sub: 'เข้าทันที',
    thumb: '/maps/sisaket_bg.webp',
  },
  {
    id: 'iconic',
    posClass: 'pos-iconic',
    title: 'ICONIC',
    sub: 'Gojo × Sukuna',
    thumb: '/fx/logo_gojo_sukuna.jpg',
  },
  {
    id: 'practice',
    posClass: 'pos-practice',
    title: 'TRAINING',
    sub: 'ฝึกซ้อม',
    thumb: '/maps/scp_bg.webp',
  },
]

const MAP_CHIPS: Array<{ id: MapId; label: string }> = [
  { id: 'shibuya', label: 'ชิบูย่า' },
  { id: 'konoha', label: 'โคโนฮะ' },
  { id: 'sisaket_island', label: 'เกาะศรีสะเกษ' },
  { id: 'scp_site', label: 'สถานี SCP' },
]

interface HomePageProps {
  soundMuted: boolean
  isFullscreen: boolean
  onToggleSound: () => void
  onToggleFullscreen: () => void
}

export function HomePage({ soundMuted, isFullscreen, onToggleSound, onToggleFullscreen }: HomePageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [heroSwapOpen, setHeroSwapOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const selectedMode = useGameStore((s) => s.selectedMode)
  const selectedMapId = useGameStore((s) => s.selectedMapId)
  const roomInput = useGameStore((s) => s.roomInput)
  const recentRooms = useGameStore((s) => s.recentRooms)
  const joining = useGameStore((s) => s.joining)
  const checkingJoinRoom = useGameStore((s) => s.checkingJoinRoom)
  const graphicsQuality = useGameStore((s) => s.graphicsQuality)
  const error = useGameStore((s) => s.error)

  const [mode, setMode] = useState<GameMode>(selectedMode || 'tdm_3v3')
  const [mapId, setMapId] = useState<MapId>(selectedMapId || 'shibuya')

  const inspectCharacter = useGameStore((s) => s.inspectCharacter)
  const setSelectedCharId = useGameStore((s) => s.setSelectedCharId)
  const setRoomInput = useGameStore((s) => s.setRoomInput)
  const setGraphicsQuality = useGameStore((s) => s.setGraphicsQuality)
  const setError = useGameStore((s) => s.setError)
  const prepareJoinRoom = useGameStore((s) => s.prepareJoinRoom)
  const createAndJoinRoom = useGameStore((s) => s.createAndJoinRoom)
  const startPracticeMode = useGameStore((s) => s.startPracticeMode)
  const logoutAccount = useGameStore((s) => s.logoutAccount)

  const stageRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    animateCardEnter(stageRef.current)
  }, [])

  const activeTier = GRAPHICS_TIERS.find((t) => t.id === graphicsQuality) ?? GRAPHICS_TIERS[0]
  const activeHero = characters.find((c) => c.id === selectedCharId) ?? characters[0]
  const validRecentRooms = recentRooms.filter((r) => /^\d{6}$/.test(r.roomId)).slice(0, 3)

  function handleSelectMode(nextMode: GameMode) {
    soundEngine.unlock()
    setMode(nextMode)
    if (nextMode === 'iconic') {
      setMapId('shibuya')
    }
  }

  async function handleLaunchMatch() {
    soundEngine.unlock()
    if (mode === 'practice') {
      await startPracticeMode(activeHero?.id, mapId)
      return
    }
    await createAndJoinRoom(mode, mode === 'iconic' ? 'shibuya' : mapId)
  }

  return (
    <div className="tw-home-stage">
      <img
        src="/fx/home_lobby_gojo_sukuna_bg.jpg"
        alt="Infinity Clash Backdrop"
        className="tw-home-bg"
      />
      <div className="tw-home-atmosphere" aria-hidden="true" />

      <div ref={stageRef} className="tw-home-chrome">
        {/* TOP BAR: Profile Pill (Left) | Quick Join 6-Digit + Settings + FS + Logout (Right) */}
        <header className="tw-topbar">
          <div className="tw-profile-pill">
            {activeHero && (
              <img
                src={activeHero.imageUrl}
                alt={activeHero.displayName}
                className="tw-profile-avatar"
              />
            )}
            <div>
              <div className="tw-profile-name">
                {authUser?.displayName}
              </div>
              <div className="tw-profile-sub">
                @{authUser?.username} · {characters.length} ฮีโร่
              </div>
            </div>
          </div>

          <div className="ui-topbar-group">
            <div className="tw-quick-join" aria-label="เข้าร่วมห้องเพื่อน">
              <IconKey size={14} style={{ color: 'var(--accent-blue)' }} />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="tw-quick-join-input home-code-input"
                placeholder="รหัสห้อง 6 หลัก"
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
                className="ui-btn primary home-join-btn"
                style={{ height: 30, padding: '0 12px', fontSize: 12.5, borderRadius: 8 }}
                disabled={joining || checkingJoinRoom || !/^\d{6}$/.test(roomInput.trim())}
                onClick={() => void prepareJoinRoom()}
              >
                {checkingJoinRoom || joining ? '...' : 'เข้าห้อง'}
              </button>
            </div>

            <div className="clean-settings-anchor">
              <button
                type="button"
                className={`ui-btn ${settingsOpen ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.unlock()
                  setSettingsOpen((v) => !v)
                }}
                aria-expanded={settingsOpen}
                title="ตั้งค่าภาพ 3D และเสียง"
              >
                <IconSettings size={15} />
                <span className="hide-xs">{activeTier.label}</span>
              </button>

              {settingsOpen && (
                <div className="clean-popover home-graphics-bar" role="dialog" aria-label="ตั้งค่าภาพและเสียง">
                  <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
                    <span className="clean-popover-label">ความละเอียด 3D</span>
                    <button
                      type="button"
                      className="ui-btn icon-only"
                      style={{ height: 26, width: 26 }}
                      onClick={() => setSettingsOpen(false)}
                      aria-label="ปิดตั้งค่า"
                    >
                      <IconClose size={13} />
                    </button>
                  </div>
                  <div className="clean-gfx-grid" role="radiogroup" aria-label="เลือกระดับความละเอียดภาพ">
                    {GRAPHICS_TIERS.map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        role="radio"
                        aria-checked={graphicsQuality === tier.id}
                        className={`clean-gfx-chip home-gfx-pill ${tier.id} ${graphicsQuality === tier.id ? 'active' : ''}`}
                        onClick={() => {
                          soundEngine.unlock()
                          setGraphicsQuality(tier.id)
                        }}
                      >
                        <div>{tier.label}</div>
                        <div style={{ fontSize: 10.5, opacity: 0.72, fontWeight: 500 }}>{tier.hint}</div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`ui-btn sound-toggle ${!soundMuted ? 'active' : ''}`}
                    onClick={onToggleSound}
                    style={{ width: '100%', justifyContent: 'space-between' }}
                  >
                    <span className="ui-topbar-group" style={{ gap: 7 }}>
                      <IconVolume size={15} muted={soundMuted} />
                      <span>เสียงเอฟเฟกต์</span>
                    </span>
                    <span style={{ fontSize: 11.5 }}>{soundMuted ? 'ปิด' : 'เปิด'}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="ui-btn icon-only home-fs-btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นแบบเต็มจอ'}
              aria-label={isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นแบบเต็มจอ'}
            >
              <IconFullscreen size={16} exit={isFullscreen} />
            </button>

            <button
              type="button"
              className="ui-btn icon-only danger home-logout-btn"
              onClick={() => {
                soundEngine.unlock()
                setLogoutConfirmOpen(true)
              }}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
            >
              <IconLogOut size={16} />
            </button>
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

        {/* MAIN SPLIT: Left Open 3D Hero Showcase | Right Diagonal Diamond Mode Cluster */}
        <main className="tw-main-split">
          <section className="tw-hero-stage" aria-label="ตัวละคร 3D ของฉัน">
            {activeHero && (
              <>
                <Hero3dPreview character={activeHero} size="hero" frameless />
                <div className="tw-hero-caption">
                  <div className="tw-hero-name-row">
                    <span className="tw-hero-title">{activeHero.displayName}</span>
                    {activeHero.className && (
                      <span className="ui-pill accent" style={{ height: 22, fontSize: 11 }}>
                        {activeHero.classIcon} {activeHero.className}
                      </span>
                    )}
                  </div>
                  <div className="tw-hero-actions">
                    <button
                      type="button"
                      className="ui-btn"
                      style={{ height: 32, fontSize: 12.5 }}
                      onClick={() => setHeroSwapOpen(true)}
                    >
                      <IconUsers size={14} />
                      <span>เปลี่ยนฮีโร่</span>
                    </button>
                    <button
                      type="button"
                      className="ui-btn icon-only"
                      style={{ height: 32, width: 32 }}
                      title="ทดลองเสียงพากย์"
                      aria-label="ทดลองเสียงพากย์"
                      onClick={() => {
                        soundEngine.unlock()
                        soundEngine.speakCharacterQuote(activeHero.id, activeHero.voiceLine)
                      }}
                    >
                      <IconVolume size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="tw-modes-panel" aria-label="เลือกโหมดและแผนที่">
            <div className="tw-diamond-cluster" role="radiogroup" aria-label="โหมดการเล่น">
              {DIAMOND_MODES.map((m) => {
                const isSelected = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`tw-diamond-card ${m.posClass} ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectMode(m.id)}
                  >
                    <div className="tw-diamond-inner">
                      <img src={m.thumb} alt={m.title} className="tw-diamond-art" />
                      <div className="tw-diamond-scrim" />
                      <div className="tw-diamond-copy">
                        <div className="tw-diamond-title">{m.title}</div>
                        <div className="tw-diamond-sub">{m.sub}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="tw-launch-bar">
              <div className="tw-map-row" role="radiogroup" aria-label="เลือกแผนที่">
                {MAP_CHIPS.map((mp) => {
                  const lockedByIconic = mode === 'iconic' && mp.id !== 'shibuya'
                  const isActive = (mode === 'iconic' ? 'shibuya' : mapId) === mp.id
                  return (
                    <button
                      key={mp.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      disabled={lockedByIconic}
                      className={`tw-map-chip ${isActive ? 'active' : ''}`}
                      onClick={() => setMapId(mp.id)}
                    >
                      {mp.label}
                    </button>
                  )
                })}
              </div>

              <div className="tw-launch-cta-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {DIAMOND_MODES.find((d) => d.id === mode)?.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    {getMapDisplayLabel(mode === 'iconic' ? 'shibuya' : mapId, mode === 'iconic')}
                  </div>
                </div>

                <button
                  type="button"
                  className="ui-btn cta-gold home-play-btn"
                  disabled={joining}
                  onClick={() => void handleLaunchMatch()}
                >
                  <IconPlay size={15} />
                  <span>
                    {joining
                      ? 'กำลังเข้า...'
                      : mode === 'ffa'
                        ? 'เข้าสมรภูมิทันที'
                        : mode === 'practice'
                          ? 'เริ่มฝึกซ้อม'
                          : 'สร้างห้องประลอง'}
                  </span>
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* BOTTOM NAVIGATION RAIL (Real Features Only) */}
        <footer className="tw-bottom-rail">
          <nav className="ui-topbar-group" aria-label="เมนูหลัก">
            <button
              type="button"
              className="tw-rail-btn home-heroes-nav-btn"
              onClick={() => {
                soundEngine.unlock()
                inspectCharacter(activeHero?.id)
              }}
            >
              <IconUsers size={15} />
              <span>คลังฮีโร่ ({characters.length})</span>
            </button>

            <button
              type="button"
              className="tw-rail-btn home-practice-btn"
              disabled={joining}
              onClick={() => {
                soundEngine.unlock()
                void startPracticeMode(activeHero?.id, mapId)
              }}
            >
              <IconTarget size={15} />
              <span>ซ้อมด่วน</span>
            </button>
          </nav>

          {validRecentRooms.length > 0 && (
            <div className="ui-topbar-group" style={{ gap: 6 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>ห้องล่าสุด:</span>
              {validRecentRooms.map((r) => (
                <button
                  key={r.roomId}
                  type="button"
                  className="clean-recent-btn"
                  onClick={() => setRoomInput(r.roomId)}
                >
                  #{r.roomId}
                </button>
              ))}
            </div>
          )}
        </footer>
      </div>

      {/* Quick Hero Switch Modal */}
      {heroSwapOpen && (
        <div
          className="clean-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="เลือกฮีโร่โชว์หน้าหลัก"
          onClick={() => setHeroSwapOpen(false)}
        >
          <div className="clean-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
              <h2 className="ui-page-title">เลือกฮีโร่ ({characters.length})</h2>
              <button
                type="button"
                className="ui-btn icon-only"
                onClick={() => setHeroSwapOpen(false)}
                aria-label="ปิด"
              >
                <IconClose size={15} />
              </button>
            </div>
            <HeroPickerPanel
              characters={characters}
              selectedId={activeHero?.id ?? ''}
              compactTabs
              maxHeight={340}
              onSelect={(charId) => {
                soundEngine.unlock()
                setSelectedCharId(charId)
                const ch = characters.find((c) => c.id === charId)
                soundEngine.speakCharacterQuote(charId, ch?.voiceLine)
                setHeroSwapOpen(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div
          className="clean-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          onClick={() => setLogoutConfirmOpen(false)}
        >
          <div className="clean-modal-card sm" onClick={(e) => e.stopPropagation()}>
            <h2 id="logout-confirm-title" className="ui-page-title">
              ยืนยันออกจากระบบ?
            </h2>
            <p className="ui-card-sub">
              บัญชี <strong style={{ color: 'var(--text-primary)' }}>@{authUser?.username}</strong> จะถูกออกจากระบบบนอุปกรณ์นี้
            </p>
            <div className="clean-home-actions" style={{ width: '100%' }}>
              <button
                type="button"
                className="ui-btn mlbb-logout-cancel"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="ui-btn danger mlbb-logout-confirm"
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
