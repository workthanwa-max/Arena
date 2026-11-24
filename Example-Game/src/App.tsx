import { useCallback, useEffect, useRef, useState } from 'react'
import { animateSpringPop } from './animations/gsapPresets'
import { soundEngine } from './audio/soundEngine'
import { ArenaSkillDock, ArenaTopBar } from './components/ArenaHudPanels'
import { BattleResultModal } from './components/BattleResultModal'
import { IconicBgmPlayer } from './components/IconicBgmPlayer'
import { adminAutoAi } from './game/adminAutoAi'
import { gameEventBus } from './game/core/eventBus'
import { PhaserArenaView } from './game/PhaserArenaView'
import { AuthPage } from './pages/AuthPage'
import { BattleSetupPage } from './pages/BattleSetupPage'
import { HeroesPage } from './pages/HeroesPage'
import { HomePage } from './pages/HomePage'
import { JoinHeroSelectPage } from './pages/JoinHeroSelectPage'
import { RoomLobbyPage } from './pages/RoomLobbyPage'
import { preloadMatchAssets } from './services/assetPreloader'
import { getSimoLiveAimDirection, setSimoSnipeCharging, useGameStore } from './store/useGameStore'
import './styles/arena.css'
import './styles/mlbb-theme.css'

export function App() {
  const [soundMuted, setSoundMuted] = useState(() => soundEngine.isMuted())
  const [bgmMuted, setBgmMuted] = useState(() => soundEngine.isBgmMuted())
  const [bootSettled, setBootSettled] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPortraitMobile, setIsPortraitMobile] = useState(false)
  const [rotateHintDismissed, setRotateHintDismissed] = useState(false)
  const [joyOffset, setJoyOffset] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  })

  const authChecked = useGameStore((s) => s.authChecked)
  const authUser = useGameStore((s) => s.authUser)
  const adminAiEnabled = useGameStore((s) => s.adminAiEnabled)
  const toggleAdminAi = useGameStore((s) => s.toggleAdminAi)
  const currentView = useGameStore((s) => s.currentView)
  const characters = useGameStore((s) => s.characters)
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const joining = useGameStore((s) => s.joining)
  const arenaReady = useGameStore((s) => s.arenaReady)
  const assetsReady = useGameStore((s) => s.assetsReady)
  const preloadProgress = useGameStore((s) => s.preloadProgress)
  const preloadStage = useGameStore((s) => s.preloadStage)
  const connected = useGameStore((s) => s.connected)
  const roomMapId = useGameStore((s) => s.roomMapId)
  const matchPhase = useGameStore((s) => s.matchPhase)
  const myAlive = useGameStore((s) => s.myAlive)
  const myInVoid = useGameStore((s) => s.myInVoid)
  const myRespawnInMs = useGameStore((s) => s.myRespawnInMs)
  const killedBy = useGameStore((s) => s.killedBy)
  const roster = useGameStore((s) => s.roster)
  const roomMode = useGameStore((s) => s.roomMode)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const saitamaOverlay = useGameStore((s) => s.saitamaOverlay)
  const domainClashOverlay = useGameStore((s) => s.domainClashOverlay)
  const snapOverlay = useGameStore((s) => s.snapOverlay)

  const bootstrap = useGameStore((s) => s.bootstrap)
  const setArenaReady = useGameStore((s) => s.setArenaReady)
  const setAssetsReady = useGameStore((s) => s.setAssetsReady)
  const setPreloadStatus = useGameStore((s) => s.setPreloadStatus)
  const leaveRoom = useGameStore((s) => s.leaveRoom)
  const sendMovementVector = useGameStore((s) => s.sendMovementVector)
  const castSkill = useGameStore((s) => s.castSkill)
  const castBasicAttack = useGameStore((s) => s.castBasicAttack)
  const castDash = useGameStore((s) => s.castDash)
  const castRct = useGameStore((s) => s.castRct)
  const castSnap = useGameStore((s) => s.castSnap)
  const sendRespawn = useGameStore((s) => s.sendRespawn)
  const sendEmote = useGameStore((s) => s.sendEmote)

  const myLiveCharId =
    roster.find((p) => p.id === myPlayerId)?.characterId || selectedCharId

  const deathModalRef = useRef<HTMLDivElement | null>(null)
  const joyBaseRef = useRef<HTMLDivElement | null>(null)
  const joyPointerIdRef = useRef<number | null>(null)
  const lastAnalogSendRef = useRef<number>(0)
  const keysRef = useRef<Record<string, boolean>>({})
  const exitTimerRef = useRef<number | null>(null)

  useEffect(() => {
    void bootstrap()
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
      }
    }
  }, [bootstrap])

  useEffect(() => {
    const checkViewport = () => {
      const portraitNarrow = window.innerWidth < 680 && window.innerHeight > window.innerWidth
      setIsPortraitMobile(portraitNarrow)
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    checkViewport()
    window.addEventListener('resize', checkViewport)
    window.addEventListener('orientationchange', checkViewport)
    document.addEventListener('fullscreenchange', checkViewport)
    return () => {
      window.removeEventListener('resize', checkViewport)
      window.removeEventListener('orientationchange', checkViewport)
      document.removeEventListener('fullscreenchange', checkViewport)
    }
  }, [])

  useEffect(() => {
    if (bootSettled || !authChecked) return
    const t = window.setTimeout(() => setBootSettled(true), 220)
    return () => window.clearTimeout(t)
  }, [bootSettled, authChecked])

  useEffect(() => {
    if (authChecked) {
      const staticSplash = document.getElementById('boot-splash')
      if (staticSplash) {
        staticSplash.remove()
      }
    }
  }, [authChecked])

  const selectedChar = characters.find((c) => c.id === selectedCharId) ?? characters[0]
  const loadingPhase: 'boot' | 'entering' | 'exiting' | 'idle' = !bootSettled
    ? 'boot'
    : exiting
      ? 'exiting'
      : joining || (currentView === 'arena' && (!assetsReady || !arenaReady))
        ? 'entering'
        : 'idle'

  useEffect(() => {
    if (currentView !== 'arena' || !connected || assetsReady) return
    const ac = new AbortController()
    const matchHeroIds = Array.from(
      new Set(
        [
          selectedCharId,
          ...roster.filter((p) => !p.isDummy).map((p) => p.characterId),
        ].filter(Boolean),
      ),
    )

    void preloadMatchAssets({
      mapId: roomMapId,
      mode: roomMode,
      heroIds: matchHeroIds,
      characters,
      signal: ac.signal,
      onProgress: (prog) => {
        setPreloadStatus(prog.pct, prog.stage)
      },
      onVoiceLoaded: (cid, bytes) => {
        void soundEngine.primeVoiceFromBytes(cid, bytes)
      },
    }).then((ok) => {
      if (ok && !ac.signal.aborted) {
        setAssetsReady(true)
      }
    })

    return () => {
      ac.abort()
    }
  }, [currentView, connected, assetsReady, roomMapId, roomMode, selectedCharId, characters, roster, setPreloadStatus, setAssetsReady])

  useEffect(() => {
    const unsubReady = gameEventBus.onSceneReady(() => {
      setArenaReady(true)
    })
    return () => unsubReady()
  }, [setArenaReady])

  useEffect(() => {
    if (currentView !== 'arena' || !connected) return
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [currentView, connected])

  useEffect(() => {
    if (!myAlive && deathModalRef.current) {
      animateSpringPop(deathModalRef.current)
    }
  }, [myAlive])

  const handleIconicYtPlaying = useCallback(() => {
    soundEngine.stopBattleBgm()
  }, [])

  const handleIconicYtFallback = useCallback(() => {
    const st = useGameStore.getState()
    if (st.currentView === 'arena' && st.connected && st.roomMode === 'iconic') {
      soundEngine.startBattleBgm('iconic')
    }
  }, [])

  // Admin-Only Grandmaster Autonomous AI lifecycle sync (strictly gated to role === 'admin')
  useEffect(() => {
    const shouldRun =
      authUser?.role === 'admin' &&
      adminAiEnabled &&
      currentView === 'arena' &&
      connected &&
      matchPhase === 'playing'
    adminAutoAi.setEnabled(shouldRun)
    return () => {
      if (!shouldRun) adminAutoAi.stop()
    }
  }, [authUser?.role, adminAiEnabled, currentView, connected, matchPhase])

  // Seamless Battlefield BGM controller in Arena (YouTube plays primary track in ICONIC mode)
  useEffect(() => {
    if (currentView === 'arena' && connected) {
      if (roomMode === 'iconic') {
        soundEngine.stopBattleBgm()
      } else {
        soundEngine.startBattleBgm(roomMode)
      }
    } else {
      soundEngine.stopBattleBgm()
    }
    return () => {
      soundEngine.stopBattleBgm()
    }
  }, [currentView, connected, roomMode])

  // Desktop keyboard controls active during live Arena combat
  useEffect(() => {
    if (currentView !== 'arena' || !connected || matchPhase !== 'playing') return

    const syncKeyMovement = () => {
      const k = keysRef.current
      let dx = 0
      let dy = 0
      if (k['KeyW'] || k['ArrowUp']) dy -= 1
      if (k['KeyS'] || k['ArrowDown']) dy += 1
      if (k['KeyA'] || k['ArrowLeft']) dx -= 1
      if (k['KeyD'] || k['ArrowRight']) dx += 1
      sendMovementVector(dx, dy)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      soundEngine.unlock()
      if (e.code === 'F9' && authUser?.role === 'admin') {
        e.preventDefault()
        toggleAdminAi()
        return
      }
      if (e.code === 'KeyQ' || e.code === 'Digit1') {
        e.preventDefault()
        castSkill(1)
        return
      }
      if (e.code === 'KeyE' || e.code === 'Digit2') {
        e.preventDefault()
        if (myLiveCharId === 'simo') {
          if (e.repeat || keysRef.current.__simoSnipeCharging) return
          keysRef.current.__simoSnipeCharging = true
          setSimoSnipeCharging(true)
          const startAt = performance.now()
          const stepKeySnipe = () => {
            if (!keysRef.current.__simoSnipeCharging) return
            const ratio = Math.min(1, (performance.now() - startAt) / 1150)
            const liveDir = getSimoLiveAimDirection()
            gameEventBus.emitAimPreview({
              active: true,
              slot: 2,
              dirX: liveDir.dirX,
              dirY: liveDir.dirY,
              rangeFactor: 1,
              castRange: 2800,
              aoeRadius: 44,
              aimType: 'line',
              cancel: false,
              chargeRatio: ratio,
            })
            window.requestAnimationFrame(stepKeySnipe)
          }
          ;(keysRef.current as Record<string, unknown>).__simoSnipeStartMs = startAt
          window.requestAnimationFrame(stepKeySnipe)
          return
        }
        castSkill(2)
        return
      }
      if (e.code === 'KeyR' || e.code === 'Digit3') {
        e.preventDefault()
        castSkill(3)
        return
      }
      if (e.code === 'Digit4' || e.code === 'KeyT') {
        if (myLiveCharId === 'noone') {
          e.preventDefault()
          castSkill(4)
          return
        }
        if (e.code === 'Digit4' && roomMode === 'iconic') {
          e.preventDefault()
          castRct()
          return
        }
      }
      if ((e.code === 'Digit5' || e.code === 'KeyV') && myLiveCharId === 'noone') {
        e.preventDefault()
        castSkill(5)
        return
      }
      if (e.code === 'KeyG' || e.code === 'KeyX') {
        if (myLiveCharId === 'noone') {
          e.preventDefault()
          castSnap()
          return
        }
        if (e.code === 'KeyG' && roomMode === 'iconic') {
          e.preventDefault()
          castRct()
          return
        }
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') {
        e.preventDefault()
        castDash()
        return
      }
      if (e.code === 'KeyJ' || e.code === 'Space') {
        e.preventDefault()
        castBasicAttack()
        return
      }
      if (
        e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault()
        keysRef.current[e.code] = true
        syncKeyMovement()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.code === 'KeyE' || e.code === 'Digit2') && keysRef.current.__simoSnipeCharging) {
        delete keysRef.current.__simoSnipeCharging
        setSimoSnipeCharging(false)
        const startMs =
          ((keysRef.current as Record<string, unknown>).__simoSnipeStartMs as number) ||
          performance.now()
        delete (keysRef.current as Record<string, unknown>).__simoSnipeStartMs
        const pct = Math.min(100, Math.round(((performance.now() - startMs) / 1150) * 100))
        gameEventBus.emitAimPreview({
          active: false,
          slot: 2,
          dirX: 1,
          dirY: 0,
          rangeFactor: 1,
          castRange: 2800,
          aoeRadius: 44,
          aimType: 'line',
          cancel: false,
        })
        castSkill(2, { worldX: 0, worldY: 0, targetId: `charge:${pct}` })
        syncKeyMovement()
        return
      }
      if (keysRef.current[e.code]) {
        delete keysRef.current[e.code]
        syncKeyMovement()
      }
    }

    const onBlur = () => {
      keysRef.current = {}
      setSimoSnipeCharging(false)
      sendMovementVector(0, 0, true)
    }

    const unsubCast = gameEventBus.onCastClick(({ worldX, worldY }) => {
      soundEngine.unlock()
      castBasicAttack({ worldX, worldY })
    })

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      unsubCast()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      keysRef.current = {}
    }
  }, [
    authUser?.role,
    toggleAdminAi,
    currentView,
    connected,
    matchPhase,
    roomMode,
    myLiveCharId,
    sendMovementVector,
    castSkill,
    castBasicAttack,
    castDash,
    castRct,
    castSnap,
  ])

  function toggleSound() {
    soundEngine.unlock()
    const next = !soundMuted
    soundEngine.setMuted(next)
    setSoundMuted(next)
  }

  function toggleBgm() {
    soundEngine.unlock()
    const next = !bgmMuted
    soundEngine.setBgmMuted(next)
    setBgmMuted(next)
  }

  async function toggleLandscapeFullscreen() {
    soundEngine.unlock()
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
        if ('orientation' in screen && typeof screen.orientation?.lock === 'function') {
          await screen.orientation.lock('landscape').catch(() => undefined)
        }
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
      setRotateHintDismissed(true)
    } catch {
      setRotateHintDismissed(true)
    }
  }

  // Compute analog joystick ratio dynamically from actual element size so mobile & desktop track 1:1
  function updateJoystickFromPoint(clientX: number, clientY: number) {
    const base = joyBaseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    const maxRadius = Math.max(26, rect.width * 0.34)
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const rawX = clientX - cx
    const rawY = clientY - cy
    const dist = Math.hypot(rawX, rawY)

    let clampedX = rawX
    let clampedY = rawY
    if (dist > maxRadius) {
      clampedX = (rawX / dist) * maxRadius
      clampedY = (rawY / dist) * maxRadius
    }

    setJoyOffset({ x: clampedX, y: clampedY, active: true })

    const normDX = clampedX / maxRadius
    const normDY = clampedY / maxRadius
    const now = performance.now()
    if (now - lastAnalogSendRef.current >= 22) {
      lastAnalogSendRef.current = now
      sendMovementVector(normDX, normDY)
    }
  }

  function handleJoystickDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    soundEngine.unlock()
    e.currentTarget.setPointerCapture(e.pointerId)
    joyPointerIdRef.current = e.pointerId
    updateJoystickFromPoint(e.clientX, e.clientY)
  }

  function handleJoystickMove(e: React.PointerEvent<HTMLDivElement>) {
    if (joyPointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    updateJoystickFromPoint(e.clientX, e.clientY)
  }

  function handleJoystickUp(e: React.PointerEvent<HTMLDivElement>) {
    if (joyPointerIdRef.current !== e.pointerId) return
    joyPointerIdRef.current = null
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignore already released capture
    }
    setJoyOffset({ x: 0, y: 0, active: false })
    sendMovementVector(0, 0, true)
  }

  function handleLeaveRoom() {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
    }
    keysRef.current = {}
    joyPointerIdRef.current = null
    setJoyOffset({ x: 0, y: 0, active: false })
    setExiting(true)
    exitTimerRef.current = window.setTimeout(() => {
      leaveRoom()
      exitTimerRef.current = window.setTimeout(() => {
        setExiting(false)
      }, 240)
    }, 180)
  }

  const loadingActive = loadingPhase !== 'idle'
  const loadingEmblem =
    loadingPhase === 'entering' && selectedChar?.imageUrl
      ? selectedChar.imageUrl
      : '/app-icon.png?v=20261120v2'
  const loadingTitle =
    loadingPhase === 'entering' && selectedChar
      ? `${selectedChar.displayName} • ${selectedChar.animeTitle}`
      : 'PULSE ARENA'
  const loadingSub =
    loadingPhase === 'entering'
      ? connected
        ? !assetsReady
          ? preloadStage || 'กำลังโหลดแผนที่ ตัวละคร สกิล และเสียงในแมตช์...'
          : 'กำลังคอมไพล์ Shaders 3D มุมมอง MLBB...'
        : 'กำลังเชื่อมต่อห้องประลอง...'
      : loadingPhase === 'exiting'
        ? 'กำลังเดินทางกลับสู่หน้าหลัก...'
        : 'กำลังโหลดระบบและตรวจสอบ Session...'

  const matchHeroesForLoader = roster.filter((p) => !p.isDummy)

  return (
    <>
      <div
        className={`pulse-loading-screen ${loadingActive ? 'active' : 'hidden'}`}
        role={loadingActive ? 'status' : undefined}
        aria-live="polite"
        aria-hidden={!loadingActive}
      >
        <div className="pls-core">
          <div className="pls-rings">
            <div className="pls-ring" />
            <div className="pls-ring inner" />
            <img src={loadingEmblem} alt={loadingTitle} className="pls-emblem" />
          </div>
          <div className="pls-title">{loadingTitle}</div>
          <div className="pls-sub">{loadingSub}</div>

          {loadingPhase === 'entering' && connected && matchHeroesForLoader.length > 0 && (
            <div className="pls-matchup-row" aria-label="ผู้เล่นและฮีโร่ที่กำลังโหลดเข้าสู่แมตช์">
              {matchHeroesForLoader.map((p) => (
                <div key={p.id} className={`pls-hero-card team-${p.team || 'ffa'}`}>
                  <img
                    src={
                      p.characterId === 'default'
                        ? '/app-icon.png?v=20261120v2'
                        : p.characterId === 'noone'
                          ? '/characters/noone.png?v=mcu1'
                          : `/characters/${p.characterId}.png`
                    }
                    alt={p.characterName}
                    className="pls-hero-thumb"
                  />
                  <div className="pls-hero-meta">
                    <span className="pls-hero-pname">{p.name}</span>
                    <span className="pls-hero-cname">{p.characterName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pls-bar">
            <span
              className={loadingPhase === 'entering' && connected ? 'determinate' : ''}
              style={
                loadingPhase === 'entering' && connected
                  ? { width: `${Math.max(8, assetsReady ? 100 : preloadProgress)}%` }
                  : undefined
              }
            />
          </div>
          {loadingPhase === 'entering' && connected && (
            <div className="pls-progress-meta">
              <span>{roomMapId === 'konoha' ? '🍃 หมู่บ้านโคโนฮะ' : '🏙️ ชิบูย่า'}</span>
              <strong>{assetsReady ? '100%' : `${preloadProgress}%`}</strong>
            </div>
          )}
        </div>
      </div>

      {currentView === 'arena' && connected ? (
        <div className="moba-viewport">
          {assetsReady && <PhaserArenaView />}

          {roomMode === 'iconic' && (
            <IconicBgmPlayer
              muted={soundMuted || bgmMuted}
              onPlayingConfirmed={handleIconicYtPlaying}
              onFallbackNeeded={handleIconicYtFallback}
            />
          )}

          <ArenaTopBar
            soundMuted={soundMuted}
            bgmMuted={bgmMuted}
            isFullscreen={isFullscreen}
            onToggleSound={toggleSound}
            onToggleBgm={toggleBgm}
            onToggleFullscreen={() => void toggleLandscapeFullscreen()}
            onEmote={() => sendEmote('⚡ Pulse!')}
            onLeave={handleLeaveRoom}
          />

          {isPortraitMobile && !rotateHintDismissed && (
            <div className="mobile-rotate-pill">
              <span>📱 แนะนำหมุนจอแนวนอน</span>
              <button
                type="button"
                className="rov-icon-btn"
                onClick={() => void toggleLandscapeFullscreen()}
                aria-label="เต็มจอ"
                title="เล่นแบบเต็มจอ"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </button>
              <button
                type="button"
                className="btn-pill secondary compact"
                onClick={() => setRotateHintDismissed(true)}
              >
                ✕
              </button>
            </div>
          )}

          <div className="moba-joystick-dock">
            <div
              ref={joyBaseRef}
              className="moba-joy-base"
              onPointerDown={handleJoystickDown}
              onPointerMove={handleJoystickMove}
              onPointerUp={handleJoystickUp}
              onPointerCancel={handleJoystickUp}
              onLostPointerCapture={handleJoystickUp}
            >
              <div className="moba-joy-ring" />
              <div
                className={`moba-joy-knob ${joyOffset.active ? '' : 'idle'}`}
                style={{
                  transform: `translate3d(${joyOffset.x}px, ${joyOffset.y}px, 0)`,
                }}
              >
                ✥
              </div>
            </div>
          </div>

          <ArenaSkillDock />

          {myInVoid && matchPhase === 'playing' && myAlive && (
            <div className="infinite-void-overlay" aria-live="polite">
              <div className="void-cosmos-ring" />
              <div className="void-status-banner">
                👁️ พรมแดนไร้ขีดจำกัด (Infinite Void) • ถูกดึงสู่อีกมิติ ขยับไม่ได้!
              </div>
            </div>
          )}

          {snapOverlay?.visible && (
            <div className="thanos-snap-overlay" role="status" aria-live="assertive">
              <div className="thanos-snap-card">
                <img src="/skills/noone_snap.png" alt="Infinity Snap" className="thanos-snap-emblem" />
                <div className="thanos-snap-title">🫰 INFINITY SNAP!</div>
                <div className="thanos-snap-sub">
                  {snapOverlay.instantWin ? (
                    <>
                      <strong>{snapOverlay.attackerName}</strong> สะสมครบ 5 มณี ดีดนิ้วพิชิตชัยทันที!
                    </>
                  ) : (
                    <>
                      <strong>{snapOverlay.attackerName}</strong> ดีดนิ้วกวาดล้างศัตรูทั้งสมรภูมิ ({snapOverlay.killedCount} ราย)!
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {domainClashOverlay?.visible && (
            <div className="domain-clash-overlay" role="status" aria-live="assertive">
              <div className="domain-clash-frame">
                <img
                  src="/fx/iconic_domain_clash.jpg"
                  alt="Gojo vs Sukuna Domain Expansion Clash"
                  className="domain-clash-img"
                />
                <div className="domain-clash-scrim" />
                <div className="domain-clash-banner">
                  <span className="clash-tag">DOMAIN EXPANSION CLASH</span>
                  <div className="clash-names">
                    <span className="clash-gojo">{domainClashOverlay.gojoName} (Infinite Void)</span>
                    <span className="clash-vs">VS</span>
                    <span className="clash-sukuna">{domainClashOverlay.sukunaName} (Malevolent Shrine)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {saitamaOverlay?.visible && (
            <div
              className={`saitama-dead-overlay ${saitamaOverlay.blocked ? 'blocked' : ''}`}
              role="alertdialog"
            >
              {saitamaOverlay.blocked ? (
                <div className="saitama-blocked-card">
                  <div className="saitama-blocked-icon">🛡️</div>
                  <div className="saitama-blocked-title">อมตะป้องกันสำเร็จ!</div>
                  <div className="saitama-blocked-sub">
                    รอดพ้นหมัดเอาจริงของ <strong>{saitamaOverlay.attackerName}</strong>
                  </div>
                </div>
              ) : (
                <div className="saitama-dead-frame">
                  <img
                    src="/fx/saitama_dead.jpg"
                    alt="Serious Death Punch"
                    className="saitama-dead-img"
                  />
                  <div className="saitama-dead-vignette" />
                  <div className="saitama-dead-word">DEAD</div>
                  <div className="saitama-dead-caption">
                    ถูกหมัดเอาจริงของ <strong>{saitamaOverlay.attackerName}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {!myAlive && !saitamaOverlay?.visible && matchPhase === 'playing' && (() => {
            const secLeft = Math.max(0, Math.ceil(myRespawnInMs / 1000))
            const ringPct = Math.max(0, Math.min(1, 1 - myRespawnInMs / 7000))
            const ringCirc = 201.06
            const ringOffset = ringCirc * (1 - ringPct)
            const killerActor = roster.find((p) => p.name === killedBy)
            const killerThumb = killerActor
              ? killerActor.characterId === 'default'
                ? '/app-icon.png?v=20261120v2'
                : killerActor.characterId === 'noone'
                  ? '/characters/noone.png?v=mcu1'
                  : `/characters/${killerActor.characterId}.png`
              : null

            return (
              <div className="death-overlay" role="dialog" aria-modal="true" aria-label="หน้าต่างเกิดใหม่">
                <div ref={deathModalRef} className="death-modal">
                  <div className="death-top-tag">ELIMINATED • คูลดาวน์ 7 วินาที</div>

                  <div className="death-ring-wrap">
                    <svg className="death-ring-svg" viewBox="0 0 88 88" aria-hidden="true">
                      <circle className="death-ring-track" cx="44" cy="44" r="32" />
                      <circle
                        className="death-ring-fill"
                        cx="44"
                        cy="44"
                        r="32"
                        strokeDasharray={ringCirc}
                        strokeDashoffset={ringOffset}
                      />
                    </svg>
                    <div className="death-ring-center">
                      {myRespawnInMs > 0 ? (
                        <span className="death-countdown-num">{secLeft}</span>
                      ) : (
                        <span className="death-ready-icon">⚡</span>
                      )}
                    </div>
                  </div>

                  <h2 className="death-title">คุณพ่ายแพ้ในสมรภูมิ!</h2>

                  <div className="death-killer-pill">
                    {killerThumb ? (
                      <img src={killerThumb} alt={killedBy} className="death-killer-avatar" />
                    ) : (
                      <span className="death-killer-dot">⚔️</span>
                    )}
                    <span>
                      ถูกกำจัดโดย <strong>{killedBy || 'คู่ต่อสู้'}</strong>
                    </span>
                  </div>

                  {myRespawnInMs > 0 ? (
                    <div className="death-wait-box">
                      <div className="death-progress-track">
                        <div className="death-progress-bar" style={{ width: `${ringPct * 100}%` }} />
                      </div>
                      <span className="death-wait-text">⏳ รอเกิดใหม่ {secLeft} วินาที...</span>
                    </div>
                  ) : (
                    <button type="button" className="death-respawn-btn" onClick={sendRespawn}>
                      ⚡ กดเกิดใหม่ทันที
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          <BattleResultModal />
        </div>
      ) : currentView === 'room_lobby' && connected ? (
        <RoomLobbyPage />
      ) : currentView === 'join_select' ? (
        <JoinHeroSelectPage />
      ) : currentView === 'battle_setup' ? (
        <BattleSetupPage />
      ) : currentView === 'heroes' ? (
        <HeroesPage />
      ) : currentView === 'home' ? (
        <HomePage
          soundMuted={soundMuted}
          isFullscreen={isFullscreen}
          onToggleSound={toggleSound}
          onToggleFullscreen={() => void toggleLandscapeFullscreen()}
        />
      ) : (
        <AuthPage />
      )}
    </>
  )
}

export default App
