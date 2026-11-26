import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { EmblemCheck } from '../components/HeroClassEmblem'
import { HeroPickerPanel } from '../components/HeroPickerPanel'
import {
  IconClose,
  IconFullscreen,
  IconKey,
  IconLogOut,
  IconPlay,
  IconSettings,
  IconSwords,
  IconTarget,
  IconUsers,
  IconVolume,
} from '../components/Icons'
import { TacticalBannerCard, type TacticalBannerSlot } from '../components/TacticalBannerDeck'
import { useGameStore } from '../store/useGameStore'
import type { GameMode, GraphicsQuality, MapId } from '../types/game'

const GRAPHICS_TIERS: Array<{ id: GraphicsQuality; label: string; hint: string }> = [
  { id: 'pixel', label: 'Pixel 3D', hint: 'เรโทรพิกเซล • ลื่นสุด' },
  { id: 'fine_pixel', label: 'Pixel ละเอียด', hint: 'พิกเซล Hi-Bit คม 2x' },
  { id: 'hd', label: '3D HD', hint: 'คมชัดมาตรฐาน สมดุล' },
  { id: 'ultra', label: 'ULTRA MAX', hint: 'Retina + เงา 3D + Bloom' },
]

const MODE_TABS: Array<{
  id: GameMode
  title: string
  sub: string
}> = [
  { id: 'tdm_3v3', title: 'TEAM 3v3', sub: '6 คน • 50 Kills' },
  { id: 'duel_1v1', title: '1 vs 1', sub: '2 คน • 5 Kills' },
  { id: 'ffa', title: 'FFA 5 คน', sub: 'เข้าทันที' },
  { id: 'iconic', title: 'ICONIC', sub: 'Gojo × Sukuna' },
  { id: 'practice', title: 'PRACTICE', sub: 'ฝึกซ้อม' },
]

const MAP_CARDS: Array<{ id: MapId; label: string; tag: string; img: string }> = [
  { id: 'shibuya', label: 'ชิบูย่า', tag: 'SHIBUYA', img: '/maps/shibuya_bg.webp' },
  { id: 'konoha', label: 'โคโนฮะ', tag: 'KONOHA', img: '/maps/konoha_bg.webp' },
  { id: 'sisaket_island', label: 'เกาะศรีสะเกษ', tag: 'SISAKET', img: '/maps/sisaket_bg.webp' },
  { id: 'scp_site', label: 'สถานี SCP', tag: 'SCP SITE', img: '/maps/scp_bg.webp' },
]

interface HomePageProps {
  soundMuted: boolean
  isFullscreen: boolean
  onToggleSound: () => void
  onToggleFullscreen: () => void
}

export function HomePage({ soundMuted, isFullscreen, onToggleSound, onToggleFullscreen }: HomePageProps) {
  const [gfxMenuOpen, setGfxMenuOpen] = useState(false)
  const [heroSwapOpen, setHeroSwapOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [joinPopoverOpen, setJoinPopoverOpen] = useState(false)

  const gfxAnchorRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    animateCardEnter(stageRef.current)
  }, [])

  useEffect(() => {
    if (!gfxMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (gfxAnchorRef.current && !gfxAnchorRef.current.contains(e.target as Node)) {
        setGfxMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [gfxMenuOpen])

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

  const selfSlot: TacticalBannerSlot = {
    id: 'self-banner',
    topRole: mode === 'iconic' ? 'GOJO / SUKUNA' : activeHero?.roleTag || activeHero?.className || 'YOU',
    topTitle: activeHero?.displayName || 'HERO',
    featured: true,
    character: activeHero ?? null,
    use3dPreview: true,
    playerName: `${authUser?.displayName || activeHero?.displayName || 'Player'} (คุณ)`,
    subLabel: activeHero ? `${activeHero.displayName} · ${activeHero.animeTitle}` : '',
    statusBadge: mode === 'ffa' ? 'PLAYER 1' : mode === 'practice' ? 'TRAINING' : 'YOU · HOST',
    tone: mode === 'ffa' ? 'gold' : 'blue',
  }

  const openWaitingAction = () => {
    soundEngine.unlock()
    setJoinPopoverOpen(true)
  }

  function makeWaitingSlot(
    id: string,
    topRole: string,
    topTitle: string,
    tone: TacticalBannerSlot['tone'],
    emptyHint: string,
  ): TacticalBannerSlot {
    return {
      id,
      topRole,
      topTitle,
      tone,
      emptyHint,
      onClick: openWaitingAction,
      actionLabel: `${topTitle} — สร้างห้องรอหรือใส่รหัส 6 หลัก`,
    }
  }

  const isTeamSplit = mode === 'tdm_3v3' || mode === 'duel_1v1' || mode === 'iconic' || mode === 'practice'

  const leftSlots: TacticalBannerSlot[] =
    mode === 'tdm_3v3'
      ? [
          selfSlot,
          makeWaitingSlot('blue-wait-2', 'BLUE 2', 'รอเพื่อนร่วมทีม', 'blue', '+ ชวนเพื่อน / สร้างห้อง'),
          makeWaitingSlot('blue-wait-3', 'BLUE 3', 'รอเพื่อนร่วมทีม', 'blue', '+ ชวนเพื่อน / สร้างห้อง'),
        ]
      : [selfSlot]

  const rightSlots: TacticalBannerSlot[] =
    mode === 'tdm_3v3'
      ? [
          makeWaitingSlot('red-wait-1', 'RED 1', 'รอคู่แข่ง', 'red', '+ หาคู่แข่ง 3v3'),
          makeWaitingSlot('red-wait-2', 'RED 2', 'รอคู่แข่ง', 'red', '+ หาคู่แข่ง 3v3'),
          makeWaitingSlot('red-wait-3', 'RED 3', 'รอคู่แข่ง', 'red', '+ หาคู่แข่ง 3v3'),
        ]
      : mode === 'duel_1v1'
        ? [makeWaitingSlot('duel-wait', 'RED DUELIST', 'รอคู่ดวล 1v1', 'red', '+ ชวนเพื่อน / ใส่รหัส')]
        : mode === 'iconic'
          ? [
              makeWaitingSlot(
                'iconic-wait',
                'GOJO × SUKUNA',
                'รอคู่ดวล ICONIC',
                'red',
                'สุ่ม Gojo / Sukuna เมื่อครบ 2 คน',
              ),
            ]
          : [
              {
                id: 'practice-bot-slot',
                topRole: 'TRAINING BOT',
                topTitle: 'หุ่นซ้อมในสนาม',
                tone: 'red',
                emptyHint: 'พร้อมฝึกสกิลทันทีเมื่อกด START',
                onClick: () => void handleLaunchMatch(),
                actionLabel: 'เริ่มฝึกซ้อมกับบอททันที',
              },
            ]

  const ffaSlots: TacticalBannerSlot[] = [
    makeWaitingSlot('ffa-wait-2', 'CHALLENGER 2', 'รอผู้ท้าชิง', 'cobalt', '+ ร่วมห้อง FFA'),
    makeWaitingSlot('ffa-wait-3', 'CHALLENGER 3', 'รอผู้ท้าชิง', 'cobalt', '+ ร่วมห้อง FFA'),
    selfSlot,
    makeWaitingSlot('ffa-wait-4', 'CHALLENGER 4', 'รอผู้ท้าชิง', 'cobalt', '+ ร่วมห้อง FFA'),
    makeWaitingSlot('ffa-wait-5', 'CHALLENGER 5', 'รอผู้ท้าชิง', 'cobalt', '+ ร่วมห้อง FFA'),
  ]

  const primaryCtaLabel = joining
    ? 'กำลังเข้าห้อง...'
    : mode === 'practice'
      ? 'START TRAINING'
      : mode === 'ffa'
        ? 'START FFA'
        : mode === 'duel_1v1' || mode === 'iconic'
          ? 'สร้างห้องรอ 1v1'
          : 'สร้างห้องรอ 3v3'

  return (
    <div className="val-page">
      <div ref={stageRef} className="val-stage">
        {/* 1. TOP TACTICAL BAR (Clean 2-side layout, no top-center Play overlap) */}
        <header className="val-topbar">
          <div className="val-top-left">
            <div className="val-brand-link" title={`@${authUser?.username}`}>
              {activeHero?.imageUrl && (
                <img
                  src={activeHero.imageUrl}
                  alt={activeHero.displayName}
                  style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }}
                />
              )}
              <span>{authUser?.displayName || 'Player'}</span>
            </div>

            <button type="button" className="val-nav-icon-btn active" title="ล็อบบี้หลัก">
              <IconSwords size={15} />
              <span>LOBBY</span>
            </button>

            <button
              type="button"
              className="val-nav-icon-btn home-heroes-nav-btn"
              onClick={() => inspectCharacter(activeHero?.id)}
              title={`คลังฮีโร่ (${characters.length} ตัว)`}
            >
              <IconUsers size={15} />
              <span>ฮีโร่ ({characters.length})</span>
            </button>

            {/* Inline Top-Bar Graphics Quality Dropdown */}
            <div ref={gfxAnchorRef} className="val-gfx-anchor">
              <button
                type="button"
                className={`val-nav-icon-btn home-gfx-pill ${gfxMenuOpen ? 'active' : ''}`}
                onClick={() => setGfxMenuOpen((v) => !v)}
                aria-expanded={gfxMenuOpen}
                title={`ปรับระดับกราฟิก (${activeTier.label})`}
              >
                <IconSettings size={15} />
                <span>{activeTier.label}</span>
              </button>

              {gfxMenuOpen && (
                <div className="val-gfx-popover" role="menu" aria-label="เลือกระดับกราฟิก 3D">
                  {GRAPHICS_TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={graphicsQuality === tier.id}
                      className={`val-gfx-option ${graphicsQuality === tier.id ? 'active' : ''}`}
                      onClick={() => {
                        soundEngine.unlock()
                        setGraphicsQuality(tier.id)
                        setGfxMenuOpen(false)
                      }}
                    >
                      <div className="val-gfx-opt-head">
                        <span>{tier.label}</span>
                        {graphicsQuality === tier.id && (
                          <span style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <EmblemCheck size={12} /> ใช้งานอยู่
                          </span>
                        )}
                      </div>
                      <span className="val-gfx-opt-hint">{tier.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="val-top-right">
            <button
              type="button"
              className={`val-nav-icon-btn ${joinPopoverOpen ? 'active' : ''}`}
              onClick={() => setJoinPopoverOpen((v) => !v)}
              title="เข้าร่วมห้องเพื่อนด้วยรหัส 6 หลัก"
            >
              <IconKey size={15} />
              <span>JOIN CODE</span>
            </button>

            <button
              type="button"
              className={`val-nav-icon-btn ${!soundMuted ? 'active' : ''}`}
              onClick={onToggleSound}
              title={soundMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              <IconVolume size={15} muted={soundMuted} />
            </button>

            <button
              type="button"
              className="val-nav-icon-btn home-fs-btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'ย่อหน้าต่าง' : 'เต็มจอ'}
            >
              <IconFullscreen size={15} exit={isFullscreen} />
            </button>

            <button
              type="button"
              className="val-nav-icon-btn danger home-logout-btn"
              onClick={() => setLogoutConfirmOpen(true)}
              title="ออกจากระบบ"
            >
              <IconLogOut size={15} />
            </button>
          </div>
        </header>

        {/* 2. MODE TAB STRIP (Horizontal Underlined) */}
        <div className="val-mode-bar-wrap">
          <nav className="val-mode-tabs" aria-label="โหมดเกมทั้งหมด">
            {MODE_TABS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`val-mode-tab ${mode === m.id ? 'active' : ''}`}
                onClick={() => handleSelectMode(m.id)}
              >
                <span>{m.title}</span>
                <span className="val-mode-tag">{m.sub}</span>
              </button>
            ))}
          </nav>

          {error && (
            <div className="ui-alert error" style={{ maxWidth: 560, width: '100%' }}>
              <span>{error}</span>
              <button type="button" className="ui-alert-close" onClick={() => setError('')} aria-label="ปิดการแจ้งเตือน">
                <IconClose size={13} />
              </button>
            </div>
          )}
        </div>

        {/* 3. MIDDLE WORKSPACE: LEFT RECTANGULAR MAP CARDS + CENTER MODE-MATCHED BANNER DECK */}
        <main className="val-workspace">
          <aside className="val-map-dock" aria-label="เลือกสมรภูมิ">
            <span className="val-map-dock-label">MAP ARENA</span>
            {MAP_CARDS.map((mp) => {
              const lockedIconic = mode === 'iconic' && mp.id !== 'shibuya'
              const isSelected = (mode === 'iconic' ? 'shibuya' : mapId) === mp.id
              return (
                <button
                  key={mp.id}
                  type="button"
                  disabled={lockedIconic}
                  className={`val-map-card ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    soundEngine.unlock()
                    setMapId(mp.id)
                  }}
                >
                  <img src={mp.img} alt={mp.label} className="val-map-card-img" loading="lazy" />
                  <div className="val-map-card-scrim" aria-hidden="true" />
                  <div className="val-map-card-info">
                    <span className="val-map-card-tag">
                      {mode === 'iconic' && mp.id === 'shibuya' ? 'ICONIC LOCKED' : isSelected ? 'SELECTED' : mp.tag}
                    </span>
                    <span className="val-map-card-name">{mp.label}</span>
                  </div>
                </button>
              )
            })}
          </aside>

          <section className="val-roster-stage" aria-label="ห้องเตรียมพร้อมตามโหมดที่เลือก">
            {isTeamSplit ? (
              <div className={`val-banner-deck ${mode === 'tdm_3v3' ? 'six-up' : ''}`}>
                {leftSlots.map((slot) => (
                  <TacticalBannerCard key={slot.id} slot={slot} />
                ))}

                <div className="val-vs-divider" aria-hidden="true">
                  <div className="val-vs-diamond">
                    <span>VS</span>
                  </div>
                </div>

                {rightSlots.map((slot) => (
                  <TacticalBannerCard key={slot.id} slot={slot} />
                ))}
              </div>
            ) : (
              <div className="val-banner-deck">
                {ffaSlots.map((slot) => (
                  <TacticalBannerCard key={slot.id} slot={slot} />
                ))}
              </div>
            )}
          </section>
        </main>

        {/* 4. BOTTOM TACTICAL CONTROL STRIP */}
        <footer className="val-bottom-bar">
          {/* Bottom-Left: 6-Digit Room Join & Recent Rooms */}
          <div className="val-bottom-left">
            <div className="val-code-box" aria-label="เข้าร่วมด้วยรหัส 6 หลัก">
              <IconKey size={13} style={{ color: '#7dd3fc' }} />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="home-code-input"
                placeholder="รหัส 6 หลัก"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && roomInput.length === 6) {
                    void prepareJoinRoom(roomInput)
                  }
                }}
              />
              <button
                type="button"
                className="ui-btn primary home-join-btn"
                style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                disabled={checkingJoinRoom || roomInput.length !== 6}
                onClick={() => void prepareJoinRoom(roomInput)}
              >
                {checkingJoinRoom ? '...' : 'เข้าห้อง'}
              </button>
            </div>

            {validRecentRooms.map((r) => (
              <button
                key={r.roomId}
                type="button"
                className="val-map-pill"
                onClick={() => {
                  setRoomInput(r.roomId)
                  void prepareJoinRoom(r.roomId)
                }}
                title={`เข้าร่วมห้องล่าสุด #${r.roomId}`}
              >
                #{r.roomId}
              </button>
            ))}
          </div>

          {/* Bottom-Center: Trio CTA (Practice | Crimson START | Change Hero) */}
          <div className="val-bottom-center">
            <button
              type="button"
              className="val-cta-secondary home-practice-btn"
              onClick={() => {
                soundEngine.unlock()
                void startPracticeMode(activeHero?.id, mapId)
              }}
            >
              <IconTarget size={14} />
              <span>ซ้อมมือ</span>
            </button>

            <button
              type="button"
              className="val-cta-crimson home-play-btn"
              disabled={joining}
              onClick={() => void handleLaunchMatch()}
            >
              <IconPlay size={15} />
              <span>{primaryCtaLabel}</span>
            </button>

            <button
              type="button"
              className="val-cta-secondary"
              onClick={() => {
                soundEngine.unlock()
                setHeroSwapOpen(true)
              }}
            >
              <IconUsers size={14} />
              <span>เปลี่ยนฮีโร่</span>
            </button>
          </div>

          {/* Bottom-Right: Voice Preview + Quick Inspect Hero */}
          <div className="val-bottom-right">
            {activeHero && (
              <>
                <button
                  type="button"
                  className="val-nav-icon-btn"
                  onClick={() => {
                    soundEngine.unlock()
                    soundEngine.speakCharacterQuote(activeHero.id, activeHero.voiceLine)
                  }}
                  title="ฟังเสียงพากย์ประจำตัว"
                >
                  <IconVolume size={14} />
                  <span>เสียงพากย์</span>
                </button>
                <button
                  type="button"
                  className="val-nav-icon-btn"
                  onClick={() => inspectCharacter(activeHero.id)}
                  title="ดูค่าสถานะและสกิลทั้งหมด"
                >
                  <IconSwords size={14} />
                  <span>ดูสกิล</span>
                </button>
              </>
            )}
          </div>
        </footer>
      </div>

      {/* Waiting Slot / Join 6-Digit Room Modal */}
      {joinPopoverOpen && (
        <div className="tw-modal-backdrop" onClick={() => setJoinPopoverOpen(false)}>
          <div className="ui-card tw-modal-card" style={{ maxWidth: 430 }} onClick={(e) => e.stopPropagation()}>
            <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
              <h3 className="ui-card-title">เข้าห้องเพื่อน หรือ เปิดห้องรอผู้เล่น</h3>
              <button
                type="button"
                className="ui-btn icon-only"
                style={{ width: 30, height: 30 }}
                onClick={() => setJoinPopoverOpen(false)}
              >
                <IconClose size={14} />
              </button>
            </div>
            <p className="ui-card-sub">
              ใส่รหัสห้อง 6 หลักของเพื่อนเพื่อเข้าร่วม หรือสร้างห้องโหมด {MODE_TABS.find((m) => m.id === mode)?.title} เพื่อชวนเพื่อนเข้ามา
            </p>
            <div className="ui-topbar-group">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="ui-input"
                style={{ flex: 1, letterSpacing: '0.2em', textAlign: 'center', fontWeight: 800 }}
                placeholder="000000"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && roomInput.length === 6) {
                    setJoinPopoverOpen(false)
                    void prepareJoinRoom(roomInput)
                  }
                }}
              />
              <button
                type="button"
                className="ui-btn primary"
                disabled={checkingJoinRoom || roomInput.length !== 6}
                onClick={() => {
                  setJoinPopoverOpen(false)
                  void prepareJoinRoom(roomInput)
                }}
              >
                {checkingJoinRoom ? 'กำลังตรวจ...' : 'เข้าร่วม'}
              </button>
            </div>

            <button
              type="button"
              className="val-cta-crimson"
              style={{ width: '100%', height: 40, fontSize: 13 }}
              disabled={joining}
              onClick={() => {
                setJoinPopoverOpen(false)
                void handleLaunchMatch()
              }}
            >
              <IconPlay size={14} />
              <span>สร้างห้องรอ {MODE_TABS.find((m) => m.id === mode)?.title} ทันที</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Quick Swap Modal */}
      {heroSwapOpen && (
        <div className="tw-modal-backdrop" onClick={() => setHeroSwapOpen(false)}>
          <div className="ui-card tw-modal-card tw-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3 className="ui-card-title">เปลี่ยนฮีโร่หลัก</h3>
                <p className="ui-card-sub">คลิกเลือกตัวละครจากทั้ง {characters.length} ตัว (แสดงทันทีในแบนเนอร์)</p>
              </div>
              <button
                type="button"
                className="ui-btn icon-only"
                style={{ width: 32, height: 32 }}
                onClick={() => setHeroSwapOpen(false)}
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
                const ch = characters.find((c) => c.id === charId)
                soundEngine.speakCharacterQuote(charId, ch?.voiceLine)
                setSelectedCharId(charId)
                setHeroSwapOpen(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="tw-modal-backdrop" onClick={() => setLogoutConfirmOpen(false)}>
          <div className="ui-card tw-modal-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="ui-card-title">ออกจากระบบ</h3>
            <p className="ui-card-sub">ต้องการออกจากบัญชี @{authUser?.username} ใช่ไหม?</p>
            <div className="ui-topbar-group" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="ui-btn" onClick={() => setLogoutConfirmOpen(false)}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="ui-btn danger"
                onClick={() => {
                  setLogoutConfirmOpen(false)
                  void logoutAccount()
                }}
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
