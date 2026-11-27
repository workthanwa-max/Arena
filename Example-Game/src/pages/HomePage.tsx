import { useEffect, useRef, useState } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { EmblemCheck } from '../components/HeroClassEmblem'
import { HeroPickerPanel } from '../components/HeroPickerPanel'
import {
  IconArrowLeft,
  IconClose,
  IconCopy,
  IconFullscreen,
  IconHeadphones,
  IconKey,
  IconLogOut,
  IconMic,
  IconPlay,
  IconSettings,
  IconTarget,
  IconUsers,
  IconVolume,
} from '../components/Icons'
import { TacticalBannerCard, type TacticalBannerSlot } from '../components/TacticalBannerDeck'
import { useGameStore } from '../store/useGameStore'
import type { CharacterDef, GameMode, GraphicsQuality, MapId, PlayerState, TeamSide } from '../types/game'

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
  { id: 'ffa', title: 'FFA 5 คน', sub: 'ตะลุมบอน 5 คน' },
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [joinPopoverOpen, setJoinPopoverOpen] = useState(false)
  const [heroDrawerOpen, setHeroDrawerOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [autoBootBlocked, setAutoBootBlocked] = useState(false)

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
  const lobbyBooting = useGameStore((s) => s.lobbyBooting)
  const checkingJoinRoom = useGameStore((s) => s.checkingJoinRoom)
  const graphicsQuality = useGameStore((s) => s.graphicsQuality)
  const error = useGameStore((s) => s.error)

  // Always-live waiting lobby state directly on HomePage
  const currentView = useGameStore((s) => s.currentView)
  const connected = useGameStore((s) => s.connected)
  const activeRoomId = useGameStore((s) => s.activeRoomId)
  const roomMode = useGameStore((s) => s.roomMode)
  const roomMapId = useGameStore((s) => s.roomMapId)
  const roster = useGameStore((s) => s.roster)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const pingMs = useGameStore((s) => s.pingMs)
  const voiceMicEnabled = useGameStore((s) => s.voiceMicEnabled)
  const voiceSpeakerEnabled = useGameStore((s) => s.voiceSpeakerEnabled)
  const voiceSpeaking = useGameStore((s) => s.voiceSpeaking)
  const peerVoiceStates = useGameStore((s) => s.peerVoiceStates)

  const inspectCharacter = useGameStore((s) => s.inspectCharacter)
  const setRoomInput = useGameStore((s) => s.setRoomInput)
  const setSelectedMode = useGameStore((s) => s.setSelectedMode)
  const setSelectedMapId = useGameStore((s) => s.setSelectedMapId)
  const setGraphicsQuality = useGameStore((s) => s.setGraphicsQuality)
  const setError = useGameStore((s) => s.setError)
  const ensureLobbyRoom = useGameStore((s) => s.ensureLobbyRoom)
  const prepareJoinRoom = useGameStore((s) => s.prepareJoinRoom)
  const startPracticeMode = useGameStore((s) => s.startPracticeMode)
  const logoutAccount = useGameStore((s) => s.logoutAccount)
  const selectRoomMode = useGameStore((s) => s.selectRoomMode)
  const selectTeam = useGameStore((s) => s.selectTeam)
  const selectRoomMap = useGameStore((s) => s.selectRoomMap)
  const selectRoomCharacter = useGameStore((s) => s.selectRoomCharacter)
  const toggleReady = useGameStore((s) => s.toggleReady)
  const startMatch = useGameStore((s) => s.startMatch)
  const leaveRoom = useGameStore((s) => s.leaveRoom)
  const toggleVoiceMic = useGameStore((s) => s.toggleVoiceMic)
  const toggleVoiceSpeaker = useGameStore((s) => s.toggleVoiceSpeaker)

  const inRoom = connected && Boolean(activeRoomId) && (currentView === 'room_lobby' || currentView === 'home')
  const displayMode: GameMode = inRoom ? roomMode : (selectedMode || 'tdm_3v3')
  const displayMapId: MapId = inRoom ? roomMapId : (selectedMapId || 'shibuya')

  // Automatically keep the Main Lobby connected as a live waiting room at all times
  useEffect(() => {
    if (connected) {
      return
    }
    if (!authUser || joining || lobbyBooting) return
    if (error || autoBootBlocked) return
    void ensureLobbyRoom(selectedMode || 'tdm_3v3', selectedMapId || 'shibuya')
  }, [authUser, connected, joining, lobbyBooting, error, autoBootBlocked, ensureLobbyRoom, selectedMode, selectedMapId])

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
  const meInRoom = inRoom ? roster.find((p) => p.id === myPlayerId) : undefined
  const isHost = inRoom ? Boolean(meInRoom?.isHost) : true
  const gojoDef = characters.find((c) => c.id === 'sia_mon') ?? null
  const sukunaDef = characters.find((c) => c.id === 'ajarn_boy') ?? null
  const activeHero =
    characters.find((c) => c.id === (meInRoom?.characterId || selectedCharId)) ?? characters[0]
  const validRecentRooms = recentRooms.filter((r) => /^\d{6}$/.test(r.roomId)).slice(0, 3)

  const isPractice = displayMode === 'practice'
  const isIconic = displayMode === 'iconic'
  const isFfa = displayMode === 'ffa'
  const is1v1Side = displayMode === 'duel_1v1' || isIconic
  const sideCap = is1v1Side ? 1 : 3
  const totalCap = isPractice ? 1 : isFfa ? 5 : sideCap * 2

  const humanRoster = roster.filter((p) => !p.isDummy)
  const dummyRoster = roster.filter((p) => p.isDummy)
  const bluePlayers = roster.filter((p) => p.team === 'blue')
  const redPlayers = roster.filter((p) => p.team === 'red')
  const inSharedParty = inRoom && (!isHost || humanRoster.length > 1)

  const isReadyToStart = !inRoom
    ? false
    : isPractice || isFfa
      ? humanRoster.length >= 1
      : humanRoster.length === totalCap && bluePlayers.length === sideCap && redPlayers.length === sideCap

  function copyRoomCode() {
    if (!activeRoomId) return
    void navigator.clipboard.writeText(activeRoomId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function handleSelectMode(nextMode: GameMode) {
    soundEngine.unlock()
    if (nextMode === 'iconic') {
      setHeroDrawerOpen(false)
    }
    if (inRoom) {
      if (!isHost) return
      selectRoomMode(nextMode)
      return
    }
    setAutoBootBlocked(false)
    setError('')
    setSelectedMode(nextMode)
    if (nextMode === 'iconic') {
      setSelectedMapId('shibuya')
    }
  }

  function handleSelectMap(nextMap: MapId) {
    soundEngine.unlock()
    if (displayMode === 'iconic') return
    if (inRoom) {
      if (!isHost) return
      selectRoomMap(nextMap)
      return
    }
    setSelectedMapId(nextMap)
  }

  function handlePickHeroInRoom(charId: string) {
    soundEngine.unlock()
    const ch = characters.find((c) => c.id === charId)
    soundEngine.speakCharacterQuote(charId, ch?.voiceLine)
    selectRoomCharacter(charId)
    setHeroDrawerOpen(false)
  }

  function handleLeaveParty() {
    soundEngine.unlock()
    setHeroDrawerOpen(false)
    setAutoBootBlocked(false)
    leaveRoom('home')
  }

  async function handleLaunchMatch() {
    soundEngine.unlock()
    if (!inRoom) {
      setAutoBootBlocked(false)
      await ensureLobbyRoom(displayMode, displayMapId)
      return
    }
    if (isHost) {
      if (!isReadyToStart) return
      startMatch()
    } else {
      toggleReady()
    }
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
      actionLabel: `${topTitle} — แชร์รหัสห้อง #${activeRoomId || '------'} หรือกรอกรหัสเพื่อน`,
    }
  }

  function buildIconicLockedWaitingSlot(side: 'blue' | 'red', canJoinSide: boolean): TacticalBannerSlot {
    const lockedHero: CharacterDef | null = side === 'blue' ? gojoDef : sukunaDef
    const isGojo = side === 'blue'
    return {
      id: `iconic-locked-${side}`,
      topRole: isGojo ? 'ICONIC LOCKED · BLUE' : 'ICONIC LOCKED · RED',
      topTitle: lockedHero?.displayName || (isGojo ? 'โกะโจ ซาโตรุ (Gojo)' : 'เรียวเมน สุคุนะ (Sukuna)'),
      character: lockedHero,
      use3dPreview: false,
      waitingLocked: true,
      statusBadge: 'LOCKED',
      playerName: 'รอผู้เล่นอีกคน...',
      subLabel: canJoinSide
        ? isGojo
          ? 'คลิกสลับเล่นเป็นโกะโจ'
          : 'คลิกสลับเล่นเป็นสุคุนะ'
        : activeRoomId
          ? `ส่งรหัส #${activeRoomId} ชวนคู่ดวล`
          : 'ล็อกตัวละครประจำโหมด',
      tone: isGojo ? 'blue' : 'red',
      onClick: canJoinSide ? () => selectTeam(side) : copyRoomCode,
      actionLabel: canJoinSide
        ? `สลับฝั่งไปเล่นเป็น ${isGojo ? 'โกะโจ ซาโตรุ' : 'เรียวเมน สุคุนะ'}`
        : `คัดลอกรหัสห้อง #${activeRoomId} เพื่อชวนอีกคนเข้ามา`,
    }
  }

  function buildRoomPlayerSlot(
    p: PlayerState | undefined,
    team: TeamSide,
    idx: number,
    canJoinSide: boolean,
  ): TacticalBannerSlot {
    const tone: TacticalBannerSlot['tone'] = team === 'blue' ? 'blue' : team === 'red' ? 'red' : 'cobalt'
    if (!p) {
      if (isIconic && (team === 'blue' || team === 'red')) {
        return buildIconicLockedWaitingSlot(team, canJoinSide)
      }
      return {
        id: `${team}-empty-${idx}`,
        topRole: team === 'blue' ? `BLUE ${idx + 1}` : team === 'red' ? `RED ${idx + 1}` : `CHALLENGER ${idx + 1}`,
        topTitle: 'รอผู้เล่น',
        tone,
        emptyHint: canJoinSide
          ? 'คลิกย้ายฝั่งนี้'
          : activeRoomId
            ? `รหัสห้อง #${activeRoomId}`
            : '+ ชวนเพื่อน',
        onClick: canJoinSide ? () => selectTeam(team as 'blue' | 'red') : openWaitingAction,
        actionLabel: canJoinSide
          ? `ย้ายเข้าทีม ${team === 'blue' ? 'BLUE' : 'RED'}`
          : 'ชวนเพื่อนหรือกรอกรหัสห้อง 6 หลัก',
      }
    }

    const isSelf = p.id === myPlayerId
    const forcedIconicHero = isIconic ? (team === 'blue' ? gojoDef : sukunaDef) : null
    const heroDef = forcedIconicHero ?? characters.find((c) => c.id === p.characterId) ?? activeHero
    const peerVoice = !isSelf ? peerVoiceStates[p.id] : undefined
    const speaking = isSelf ? voiceMicEnabled && voiceSpeaking : Boolean(peerVoice?.speaking)
    const muted = isSelf ? !voiceMicEnabled : Boolean(peerVoice && !peerVoice.micOn)
    const badge = p.isDummy
      ? 'BOT'
      : isIconic
        ? p.isHost
          ? 'HOST · LOCKED'
          : p.ready
            ? 'READY · LOCKED'
            : 'LOCKED'
        : p.isHost
          ? 'HOST'
          : p.ready
            ? 'READY'
            : undefined

    return {
      id: p.id,
      topRole: p.isDummy
        ? 'TRAINING BOT'
        : isIconic
          ? team === 'blue'
            ? 'THE STRONGEST · GOJO'
            : 'KING OF CURSES · SUKUNA'
          : heroDef?.roleTag || (team === 'blue' ? 'BLUE TEAM' : team === 'red' ? 'RED TEAM' : 'CHALLENGER'),
      topTitle: heroDef?.displayName || p.characterName,
      featured: isSelf,
      character: heroDef ?? null,
      use3dPreview: isSelf,
      playerName: p.name,
      subLabel: p.isDummy ? 'เป้านิ่งทดสอบสกิล' : undefined,
      statusBadge: badge,
      tone: p.isHost && !p.isDummy && !isIconic ? 'gold' : tone,
      pingMs: isSelf ? (pingMs ?? undefined) : undefined,
      speaking,
      muted,
      onClick: isSelf && !isIconic ? () => setHeroDrawerOpen((v) => !v) : undefined,
      actionLabel: isSelf && !isIconic ? 'คลิกเปลี่ยนฮีโร่' : undefined,
    }
  }

  // Fallback self banner during the ~50ms initial silent lobby handshake
  const bootSelfHero = isIconic ? gojoDef : activeHero
  const bootSelfSlot: TacticalBannerSlot = {
    id: 'self-banner-boot',
    topRole: isIconic ? 'THE STRONGEST · GOJO' : bootSelfHero?.roleTag || bootSelfHero?.className || 'YOU',
    topTitle: bootSelfHero?.displayName || 'HERO',
    featured: true,
    character: bootSelfHero ?? null,
    use3dPreview: true,
    playerName: authUser?.displayName || bootSelfHero?.displayName || 'Player',
    statusBadge: isIconic ? 'HOST · LOCKED' : 'HOST',
    tone: isFfa ? 'gold' : 'blue',
  }

  const isTeamSplit =
    displayMode === 'tdm_3v3' ||
    displayMode === 'duel_1v1' ||
    displayMode === 'iconic' ||
    displayMode === 'practice'

  const leftSlots: TacticalBannerSlot[] = inRoom
    ? isPractice
      ? [buildRoomPlayerSlot(meInRoom ?? humanRoster[0], 'blue', 0, false)]
      : Array.from({ length: sideCap }).map((_, i) => {
          const p = bluePlayers[i]
          return buildRoomPlayerSlot(p, 'blue', i, Boolean(meInRoom && meInRoom.team !== 'blue'))
        })
    : displayMode === 'tdm_3v3'
      ? [
          bootSelfSlot,
          makeWaitingSlot('blue-wait-2', 'BLUE 2', 'รอเพื่อนร่วมทีม', 'blue', '+ ชวนเพื่อน'),
          makeWaitingSlot('blue-wait-3', 'BLUE 3', 'รอเพื่อนร่วมทีม', 'blue', '+ ชวนเพื่อน'),
        ]
      : [bootSelfSlot]

  const rightSlots: TacticalBannerSlot[] = inRoom
    ? isPractice
      ? (dummyRoster.length > 0 ? dummyRoster : [undefined]).map((d, i) =>
          buildRoomPlayerSlot(d, 'red', i, false),
        )
      : Array.from({ length: sideCap }).map((_, i) => {
          const p = redPlayers[i]
          return buildRoomPlayerSlot(p, 'red', i, Boolean(meInRoom && meInRoom.team !== 'red'))
        })
    : displayMode === 'tdm_3v3'
      ? [
          makeWaitingSlot('red-wait-1', 'RED 1', 'รอคู่แข่ง', 'red', '+ หาคู่แข่ง 3v3'),
          makeWaitingSlot('red-wait-2', 'RED 2', 'รอคู่แข่ง', 'red', '+ หาคู่แข่ง 3v3'),
          makeWaitingSlot('red-wait-3', 'RED 3', 'รอคู่แข่ง', 'red', '+ หาคู่แข่ง 3v3'),
        ]
      : displayMode === 'duel_1v1'
        ? [makeWaitingSlot('duel-wait', 'RED DUELIST', 'รอคู่ดวล 1v1', 'red', '+ ชวนเพื่อน / ใส่รหัส')]
        : displayMode === 'iconic'
          ? [buildIconicLockedWaitingSlot('red', false)]
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

  const ffaSlots: TacticalBannerSlot[] = (() => {
    if (!inRoom) {
      return [
        makeWaitingSlot('ffa-wait-2', 'CHALLENGER 2', 'รอผู้ท้าชิง', 'cobalt', '+ ร่วมห้อง FFA'),
        makeWaitingSlot('ffa-wait-3', 'CHALLENGER 3', 'รอผู้ท้าชิง', 'cobalt', '+ ร่วมห้อง FFA'),
        bootSelfSlot,
        makeWaitingSlot('ffa-wait-4', 'CHALLENGER 4', 'รอผู้ท้าชิง', 'cobalt', '+ ร่วมห้อง FFA'),
        makeWaitingSlot('ffa-wait-5', 'CHALLENGER 5', 'รอผู้ท้าชิง', 'cobalt', '+ ร่วมห้อง FFA'),
      ]
    }
    if (humanRoster.length <= 1) {
      const selfCard = buildRoomPlayerSlot(meInRoom ?? humanRoster[0], 'ffa', 2, false)
      return [
        makeWaitingSlot('ffa-open-0', 'CHALLENGER 2', 'รอผู้ท้าชิง', 'cobalt', `รหัส #${activeRoomId}`),
        makeWaitingSlot('ffa-open-1', 'CHALLENGER 3', 'รอผู้ท้าชิง', 'cobalt', `รหัส #${activeRoomId}`),
        selfCard,
        makeWaitingSlot('ffa-open-3', 'CHALLENGER 4', 'รอผู้ท้าชิง', 'cobalt', `รหัส #${activeRoomId}`),
        makeWaitingSlot('ffa-open-4', 'CHALLENGER 5', 'รอผู้ท้าชิง', 'cobalt', `รหัส #${activeRoomId}`),
      ]
    }
    return Array.from({ length: 5 }).map((_, i) => buildRoomPlayerSlot(humanRoster[i], 'ffa', i, false))
  })()

  const primaryCtaLabel = !inRoom
    ? lobbyBooting || joining
      ? 'กำลังเปิดล็อบบี้...'
      : 'เชื่อมต่อล็อบบี้'
    : isHost
      ? isPractice
        ? 'START TRAINING'
        : isFfa
          ? `START FFA (${humanRoster.length}/5)`
          : isReadyToStart
            ? isIconic
              ? 'START ICONIC'
              : 'START MATCH'
            : `รอผู้เล่น (${humanRoster.length}/${totalCap})`
      : meInRoom?.ready
        ? 'พร้อมแล้ว (ยกเลิก)'
        : 'กดพร้อม'

  const primaryCtaDisabled = inRoom
    ? Boolean(isHost && !isReadyToStart)
    : lobbyBooting || joining

  return (
    <div className="val-page">
      <div ref={stageRef} className="val-stage">
        {/* 1. TOP TACTICAL BAR (Always-Live Main Lobby Navbar) */}
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

            {inRoom && activeRoomId ? (
              <>
                <button
                  type="button"
                  className="val-brand-link room-code-banner"
                  onClick={copyRoomCode}
                  title="คลิกคัดลอกรหัสห้อง 6 หลักเพื่อชวนเพื่อนเข้าล็อบบี้นี้"
                >
                  <IconCopy size={13} />
                  <span>#{activeRoomId}</span>
                  <span style={{ color: copied ? '#4ade80' : '#7dd3fc', fontSize: 10 }}>
                    {copied ? 'COPIED' : 'COPY'}
                  </span>
                </button>

                {pingMs != null && pingMs > 0 && (
                  <span className="val-ping-chip" title="ความหน่วงการเชื่อมต่อ">
                    {pingMs}ms
                  </span>
                )}
              </>
            ) : (
              <span className="val-ping-chip" title="กำลังเปิดห้องรออัตโนมัติ">
                {lobbyBooting ? 'กำลังเปิดล็อบบี้...' : 'OFFLINE'}
              </span>
            )}

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
            {inSharedParty && (
              <button
                type="button"
                className="val-nav-icon-btn danger"
                onClick={handleLeaveParty}
                title="ออกจากปาร์ตี้นี้และกลับสู่ห้องส่วนตัวของคุณ"
              >
                <IconArrowLeft size={15} />
                <span>LEAVE PARTY</span>
              </button>
            )}

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

        {/* 2. MODE TAB STRIP (Flush Directly Underneath Navbar — Live Switching!) */}
        <div className="val-mode-bar-wrap">
          <nav className="val-mode-tabs" aria-label="โหมดเกมทั้งหมด">
            {MODE_TABS.map((m) => {
              const disabledForGuest = inRoom && !isHost && displayMode !== m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={disabledForGuest}
                  className={`val-mode-tab ${displayMode === m.id ? 'active' : ''}`}
                  title={disabledForGuest ? 'เฉพาะหัวหน้าห้องที่เปลี่ยนโหมดได้' : m.sub}
                  onClick={() => handleSelectMode(m.id)}
                >
                  <span>{m.title}</span>
                </button>
              )
            })}
          </nav>

          {error && (
            <div className="ui-alert error" style={{ maxWidth: 560, width: '100%' }}>
              <span>{error}</span>
              <button
                type="button"
                className="ui-alert-close"
                onClick={() => {
                  setAutoBootBlocked(false)
                  setError('')
                }}
                aria-label="ปิดการแจ้งเตือน"
              >
                <IconClose size={13} />
              </button>
            </div>
          )}
        </div>

        {/* 3. MIDDLE WORKSPACE: LEFT RECTANGULAR MAP CARDS + CENTER LIVE BANNER DECK */}
        <main className="val-workspace">
          <aside className="val-map-dock" aria-label="เลือกสมรภูมิ">
            <span className="val-map-dock-label">MAP ARENA</span>
            {MAP_CARDS.map((mp) => {
              const lockedGuest = inRoom && !isHost
              const lockedIconic = isIconic && mp.id !== 'shibuya'
              const isSelected = (isIconic ? 'shibuya' : displayMapId) === mp.id
              return (
                <button
                  key={mp.id}
                  type="button"
                  disabled={lockedIconic || (lockedGuest && !isSelected)}
                  className={`val-map-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectMap(mp.id)}
                >
                  <img src={mp.img} alt={mp.label} className="val-map-card-img" loading="lazy" />
                  <div className="val-map-card-scrim" aria-hidden="true" />
                  <div className="val-map-card-info">
                    <span className="val-map-card-tag">
                      {isIconic && mp.id === 'shibuya' ? 'ICONIC LOCKED' : isSelected ? 'SELECTED' : mp.tag}
                    </span>
                    <span className="val-map-card-name">{mp.label}</span>
                  </div>
                </button>
              )
            })}
          </aside>

          <section className="val-roster-stage" aria-label="ห้องเตรียมพร้อมตามโหมดที่เลือก">
            {isTeamSplit ? (
              <div className={`val-banner-deck split-vs ${displayMode === 'tdm_3v3' ? 'six-up' : ''}`}>
                <div className="val-team-side left">
                  {leftSlots.map((slot) => (
                    <TacticalBannerCard key={slot.id} slot={slot} />
                  ))}
                </div>

                <div className="val-vs-divider" aria-hidden="true">
                  <div className="val-vs-diamond">
                    <span>VS</span>
                  </div>
                </div>

                <div className="val-team-side right">
                  {rightSlots.map((slot) => (
                    <TacticalBannerCard key={slot.id} slot={slot} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="val-banner-deck">
                {ffaSlots.map((slot) => (
                  <TacticalBannerCard key={slot.id} slot={slot} />
                ))}
              </div>
            )}
          </section>

          <div className="val-workspace-spacer" aria-hidden="true" />
        </main>

        {/* 3.5 INLINE HERO PICKER DRAWER (Quick hero swap right on the Always-Live Main Lobby) */}
        {!isIconic && heroDrawerOpen && (
          <section className="val-lobby-drawer" aria-label="เลือกเปลี่ยนฮีโร่ในล็อบบี้">
            <div className="ui-topbar-group" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="ui-topbar-group" style={{ gap: 8 }}>
                <strong style={{ fontSize: 13 }}>เลือกฮีโร่สำหรับแมตช์นี้</strong>
                {activeHero && (
                  <span className="ui-card-sub" style={{ fontSize: 11.5 }}>
                    ปัจจุบัน: {activeHero.displayName} (HP {activeHero.maxHp} · SPD {activeHero.moveSpeed})
                  </span>
                )}
              </div>
              <div className="ui-topbar-group" style={{ gap: 6 }}>
                <button
                  type="button"
                  className="val-nav-icon-btn"
                  onClick={() => {
                    soundEngine.unlock()
                    setHeroDrawerOpen(false)
                    inspectCharacter(activeHero?.id)
                  }}
                >
                  <span>คลังฮีโร่ 3D</span>
                </button>
                <button
                  type="button"
                  className="ui-btn icon-only"
                  style={{ width: 28, height: 28 }}
                  onClick={() => setHeroDrawerOpen(false)}
                >
                  <IconClose size={14} />
                </button>
              </div>
            </div>

            <HeroPickerPanel
              characters={characters}
              selectedId={meInRoom?.characterId ?? selectedCharId}
              compactTabs
              maxHeight={190}
              onSelect={handlePickHeroInRoom}
            />
          </section>
        )}

        {/* 4. BOTTOM TACTICAL CONTROL STRIP */}
        <footer className="val-bottom-bar">
          {/* Bottom-Left: Live Voice Controls */}
          <div className="val-bottom-left">
            {inRoom && (
              <>
                <button
                  type="button"
                  className={`val-nav-icon-btn ${voiceMicEnabled ? 'active' : ''}`}
                  onClick={() => void toggleVoiceMic()}
                  title={voiceMicEnabled ? 'ปิดไมค์' : 'เปิดไมค์'}
                >
                  <IconMic size={14} off={!voiceMicEnabled} />
                  <span>{voiceMicEnabled ? 'ไมค์เปิด' : 'ไมค์ปิด'}</span>
                </button>

                <button
                  type="button"
                  className={`val-nav-icon-btn ${voiceSpeakerEnabled ? 'active' : ''}`}
                  onClick={toggleVoiceSpeaker}
                  title={voiceSpeakerEnabled ? 'ปิดเสียงเพื่อน' : 'เปิดเสียงเพื่อน'}
                >
                  <IconHeadphones size={14} />
                  <span>{voiceSpeakerEnabled ? 'ลำโพงเปิด' : 'ลำโพงปิด'}</span>
                </button>
              </>
            )}
          </div>

          {/* Bottom-Center: Trio CTA */}
          <div className="val-bottom-center">
            {inSharedParty ? (
              <button
                type="button"
                className="val-cta-secondary"
                onClick={handleLeaveParty}
              >
                <IconArrowLeft size={14} />
                <span>ออกจากปาร์ตี้</span>
              </button>
            ) : (
              <button
                type="button"
                className="val-cta-secondary home-practice-btn"
                onClick={() => {
                  soundEngine.unlock()
                  void startPracticeMode(activeHero?.id, displayMapId)
                }}
              >
                <IconTarget size={14} />
                <span>ซ้อมมือ</span>
              </button>
            )}

            <button
              type="button"
              className="val-cta-crimson home-play-btn"
              disabled={primaryCtaDisabled}
              onClick={() => void handleLaunchMatch()}
            >
              <IconPlay size={15} />
              <span>{primaryCtaLabel}</span>
            </button>

            <button
              type="button"
              disabled={isIconic}
              className={`val-cta-secondary home-heroes-nav-btn ${!isIconic && heroDrawerOpen ? 'active' : ''}`}
              onClick={() => {
                soundEngine.unlock()
                if (!isIconic) {
                  setHeroDrawerOpen((v) => !v)
                }
              }}
              title={
                isIconic
                  ? 'โหมด ICONIC ล็อกตัวละคร โกะโจ ซาโตรุ vs เรียวเมน สุคุนะ (คลิกการ์ดฝั่งตรงข้ามเพื่อสลับตัว)'
                  : `เปลี่ยนฮีโร่ในล็อบบี้ (${characters.length} ตัว)`
              }
            >
              <IconUsers size={15} />
              <span>{isIconic ? 'ล็อก GOJO × SUKUNA' : `ฮีโร่ (${characters.length})`}</span>
            </button>
          </div>

          {/* Bottom-Right: Spacer for exact center alignment */}
          <div className="val-bottom-right" aria-hidden="true" />
        </footer>
      </div>

      {/* JOIN CODE Modal (6-Digit Input + Share Current Room Code + Recent Rooms) */}
      {joinPopoverOpen && (
        <div className="tw-modal-backdrop" onClick={() => setJoinPopoverOpen(false)}>
          <div className="ui-card tw-modal-card" style={{ maxWidth: 430 }} onClick={(e) => e.stopPropagation()}>
            <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
              <h3 className="ui-card-title">JOIN CODE · เข้าร่วมห้อง 6 หลัก</h3>
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
              {activeRoomId
                ? `รหัสห้องของคุณตอนนี้คือ #${activeRoomId} (แชร์ให้เพื่อนได้เลย) หรือใส่รหัส 6 หลักของเพื่อนด้านล่างเพื่อย้ายไปเข้าห้องเพื่อน`
                : 'ใส่รหัสห้อง 6 หลักของเพื่อนเพื่อเข้าร่วมทันที'}
            </p>
            <div className="ui-topbar-group">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="ui-input home-code-input"
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
                className="ui-btn primary home-join-btn"
                disabled={checkingJoinRoom || roomInput.length !== 6}
                onClick={() => {
                  setJoinPopoverOpen(false)
                  void prepareJoinRoom(roomInput)
                }}
              >
                {checkingJoinRoom ? 'กำลังตรวจ...' : 'เข้าห้อง'}
              </button>
            </div>

            {validRecentRooms.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="ui-card-sub" style={{ fontSize: 11.5 }}>ห้องล่าสุด</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {validRecentRooms.map((r) => (
                    <button
                      key={r.roomId}
                      type="button"
                      className="val-map-pill"
                      onClick={() => {
                        setRoomInput(r.roomId)
                        setJoinPopoverOpen(false)
                        void prepareJoinRoom(r.roomId)
                      }}
                      title={`เข้าร่วมห้องล่าสุด #${r.roomId}`}
                    >
                      #{r.roomId}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="tw-modal-backdrop" onClick={() => setLogoutConfirmOpen(false)}>
          <div className="ui-card tw-modal-card" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="ui-card-title">ยืนยันการออกจากระบบ</h3>
            <p className="ui-card-sub">
              ต้องการออกจากระบบบัญชี <strong>{authUser?.displayName}</strong> (@{authUser?.username}) ใช่หรือไม่?
            </p>
            <div className="tw-modal-actions">
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
