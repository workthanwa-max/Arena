import { memo, useCallback, useRef, useState } from 'react'
import { getBasicAttackRange, isTeamMatchMode, useGameStore } from '../store/useGameStore'
import type { PlayerState } from '../types/game'
import {
  IconBot,
  IconClose,
  IconCopy,
  IconFullscreen,
  IconHeadphones,
  IconLogOut,
  IconMic,
  IconMusic,
  IconSettings,
  IconSparkles,
  IconTarget,
  IconVolume,
} from './Icons'
import { EmblemShield } from './HeroClassEmblem'
import { MobaSkillButton } from './MobaSkillButton'

function formatClock(totalSec: number): string {
  const m = Math.floor(Math.max(0, totalSec) / 60)
  const s = Math.floor(Math.max(0, totalSec) % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getHeroThumb(charId: string): string {
  if (charId === 'default') return '/app-icon.png?v=20261120v2'
  if (charId === 'noone') return '/characters/noone.png?v=mcu1'
  if (charId === 'naruto_clone') return '/characters/naruto.png?v=nrt2'
  return `/characters/${charId}.png`
}

/**
 * Reliable multi-touch & iPadOS/iOS Safari tap button component:
 * Persists touch/pointer start coordinates inside a useRef (never wiped by 60Hz HUD re-renders),
 * triggers cleanly on pointerUp / touchEnd (26px slip tolerance) OR synthetic click, and stops propagation.
 */
const TouchTapButton = memo(function TouchTapButton({
  onTap,
  className,
  title,
  ariaLabel,
  children,
}: {
  onTap: () => void
  className: string
  title?: string
  ariaLabel?: string
  children: React.ReactNode
}) {
  const tapRef = useRef<{ id: number | null; x: number; y: number; firedAt: number }>({
    id: null,
    x: 0,
    y: 0,
    firedAt: 0,
  })

  const fireOnce = useCallback(() => {
    const now = performance.now()
    if (now - tapRef.current.firedAt < 320) return
    tapRef.current.firedAt = now
    onTap()
  }, [onTap])

  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.stopPropagation()
        tapRef.current.id = e.pointerId
        tapRef.current.x = e.clientX
        tapRef.current.y = e.clientY
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        if (tapRef.current.id !== e.pointerId) return
        tapRef.current.id = null
        if (Math.hypot(e.clientX - tapRef.current.x, e.clientY - tapRef.current.y) <= 28) {
          e.preventDefault()
          fireOnce()
        }
      }}
      onPointerCancel={() => {
        tapRef.current.id = null
      }}
      onTouchStart={(e) => {
        e.stopPropagation()
        const t = e.changedTouches[0]
        if (t && tapRef.current.id === null) {
          tapRef.current.x = t.clientX
          tapRef.current.y = t.clientY
        }
      }}
      onTouchEnd={(e) => {
        e.stopPropagation()
        const t = e.changedTouches[0]
        if (!t) return
        if (Math.hypot(t.clientX - tapRef.current.x, t.clientY - tapRef.current.y) <= 28) {
          tapRef.current.id = null
          fireOnce()
        }
      }}
      onClick={(e) => {
        e.stopPropagation()
        fireOnce()
      }}
    >
      {children}
    </button>
  )
})

interface ArenaTopBarProps {
  soundMuted: boolean
  bgmMuted: boolean
  isFullscreen: boolean
  onToggleSound: () => void
  onToggleBgm: () => void
  onToggleFullscreen: () => void
  onEmote: () => void
  onLeave: () => void
}

export const ArenaTopBar = memo(function ArenaTopBar({
  soundMuted,
  bgmMuted,
  isFullscreen,
  onToggleSound,
  onToggleBgm,
  onToggleFullscreen,
  onEmote,
  onLeave,
}: ArenaTopBarProps) {
  const [practiceMenuOpen, setPracticeMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [roomCopied, setRoomCopied] = useState(false)

  const roomMode = useGameStore((s) => s.roomMode)
  const roster = useGameStore((s) => s.roster)
  const characters = useGameStore((s) => s.characters)
  const authUser = useGameStore((s) => s.authUser)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const activeRoomId = useGameStore((s) => s.activeRoomId)
  const blueKills = useGameStore((s) => s.blueKills)
  const redKills = useGameStore((s) => s.redKills)
  const targetKills = useGameStore((s) => s.targetKills)
  const matchElapsedSec = useGameStore((s) => s.matchElapsedSec)
  const pingMs = useGameStore((s) => s.pingMs)
  const transportMode = useGameStore((s) => s.transportMode)
  const fps = useGameStore((s) => s.fps)
  const myKills = useGameStore((s) => s.myKills)
  const myDeaths = useGameStore((s) => s.myDeaths)
  const myHp = useGameStore((s) => s.myHp)
  const myMaxHp = useGameStore((s) => s.myMaxHp)
  const lastDummyDamage = useGameStore((s) => s.lastDummyDamage)
  const totalDummyDamage = useGameStore((s) => s.totalDummyDamage)
  const voiceMicEnabled = useGameStore((s) => s.voiceMicEnabled)
  const voiceSpeakerEnabled = useGameStore((s) => s.voiceSpeakerEnabled)
  const voiceSpeaking = useGameStore((s) => s.voiceSpeaking)
  const peerVoiceStates = useGameStore((s) => s.peerVoiceStates)
  const adminAiEnabled = useGameStore((s) => s.adminAiEnabled)
  const toggleAdminAi = useGameStore((s) => s.toggleAdminAi)
  const toggleVoiceMic = useGameStore((s) => s.toggleVoiceMic)
  const toggleVoiceSpeaker = useGameStore((s) => s.toggleVoiceSpeaker)
  const switchPracticeCharacter = useGameStore((s) => s.switchPracticeCharacter)
  const resetPractice = useGameStore((s) => s.resetPractice)

  const isAdmin = authUser?.role === 'admin'

  const myCharacterId = roster.find((p) => p.id === myPlayerId)?.characterId ?? ''
  const accessibleChars = characters.filter((c) => !c.adminOnly || authUser?.role === 'admin')

  const blueTeam = roster.filter((p) => p.team === 'blue')
  const redTeam = roster.filter((p) => p.team === 'red')
  const hpPct = Math.max(0, Math.min(100, (myHp / Math.max(1, myMaxHp)) * 100))

  function copyRoomCode() {
    if (!activeRoomId) return
    void navigator.clipboard.writeText(activeRoomId)
    setRoomCopied(true)
    window.setTimeout(() => setRoomCopied(false), 1600)
  }

  function renderPortraitPip(p: PlayerState, side: 'blue' | 'red' | 'ffa') {
    const isMe = p.id === myPlayerId
    const pRatio = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100))
    const vState = isMe
      ? { micOn: voiceMicEnabled, speakerOn: voiceSpeakerEnabled, speaking: voiceSpeaking }
      : peerVoiceStates[p.id]
    const isSpeaking = Boolean(vState?.micOn && vState?.speaking)
    return (
      <div
        key={p.id}
        className={`rov-hero-pip ${side} ${isMe ? 'me' : ''} ${p.alive ? 'alive' : 'dead'} ${isSpeaking ? 'voice-speaking' : ''}`}
        title={`${p.name} (${p.characterName}) • K:${p.kills}${vState?.micOn ? ' • เปิดไมค์' : ''}`}
      >
        <img src={getHeroThumb(p.characterId)} alt={p.name} className="rov-hero-thumb" />
        <div className="rov-mini-hp-track">
          <div className="rov-mini-hp-fill" style={{ width: `${pRatio}%` }} />
        </div>
        {vState?.micOn && (
          <span className={`rov-voice-pip ${isSpeaking ? 'speaking' : ''}`} aria-hidden="true">
            <IconMic size={10} />
          </span>
        )}
        {!p.alive && (
          <span className="rov-dead-cd">
            {p.respawnInMs && p.respawnInMs > 0 ? Math.ceil(p.respawnInMs / 1000) : <IconClose size={10} />}
          </span>
        )}
        {side === 'ffa' && <span className="rov-ffa-k">{p.kills}</span>}
      </div>
    )
  }

  return (
    <header
      className="moba-top-bar rov-top-bar"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Top-Left: Compact Room ID + Telemetry Pill cleanly beside the Minimap */}
      <div className="rov-left-anchor">
        <div className="rov-minimap-net-pill">
          <TouchTapButton
            className="rov-room-copy-pill"
            onTap={copyRoomCode}
            title={`คลิกคัดลอกรหัสห้อง ${activeRoomId}`}
          >
            <span>#{activeRoomId}</span>
            <IconCopy size={11} copied={roomCopied} />
          </TouchTapButton>
          <span className={`rov-ping ${pingMs !== null && pingMs < 90 ? 'good' : ''}`}>
            {pingMs !== null ? `${pingMs}ms` : '...'}
          </span>
          <span className="rov-fps hide-xs">
            {fps}fps · {transportMode === 'webtransport' ? 'H3' : transportMode === 'ws-binary' ? 'BIN' : 'JSON'}
          </span>
        </div>
      </div>

      {/* Top-Center: Slim Dark Slate VS / FFA / Practice Scoreboard */}
      {isTeamMatchMode(roomMode) ? (
        <div className="rov-scoreboard" aria-label={`คะแนนการต่อสู้ ${roomMode === 'duel_1v1' ? '1v1' : '3v3'}`}>
          <div className="rov-team-side blue">
            <div className="rov-portraits-row">
              {blueTeam.map((p) => renderPortraitPip(p, 'blue'))}
            </div>
            <div className="rov-team-score blue">{blueKills}</div>
          </div>

          <div className="rov-clock-core">
            <span className="rov-clock-time">{formatClock(matchElapsedSec)}</span>
            <span className="rov-clock-goal">
              {roomMode === 'iconic'
                ? 'ICONIC · '
                : roomMode === 'duel_1v1'
                  ? '1v1 · '
                  : ''}
              เป้า {targetKills}
            </span>
          </div>

          <div className="rov-team-side red">
            <div className="rov-team-score red">{redKills}</div>
            <div className="rov-portraits-row">
              {redTeam.map((p) => renderPortraitPip(p, 'red'))}
            </div>
          </div>
        </div>
      ) : roomMode === 'practice' ? (
        <div className="rov-scoreboard practice" aria-label="แผงทดสอบตัวละคร">
          <div className="rov-ffa-label">TRAINING</div>
          <div className="practice-dmg-readout">
            <span>ล่าสุด: <strong>{lastDummyDamage}</strong></span>
            <span>รวม: <strong>{totalDummyDamage}</strong></span>
          </div>
          <TouchTapButton
            className="rov-icon-btn practice-act-btn"
            onTap={resetPractice}
            title="รีเซ็ตคูลดาวน์และเลือดหุ่น Dummy"
          >
            รีเซ็ต
          </TouchTapButton>
          <TouchTapButton
            className="rov-icon-btn practice-act-btn"
            onTap={() => setPracticeMenuOpen((v) => !v)}
            title="เปลี่ยนฮีโร่ทดลอง"
          >
            ตัวละคร
          </TouchTapButton>
        </div>
      ) : (
        <div className="rov-scoreboard ffa" aria-label="อันดับผู้เล่น FFA">
          <div className="rov-ffa-label">FFA</div>
          <div className="rov-portraits-row">{roster.map((p) => renderPortraitPip(p, 'ffa'))}</div>
          <div className="rov-clock-core compact">
            <span className="rov-clock-time">{roster.length}/5</span>
          </div>
        </div>
      )}

      {roomMode === 'practice' && practiceMenuOpen && (
        <div
          className="practice-hero-drawer"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {accessibleChars.map((ch) => (
            <TouchTapButton
              key={ch.id}
              className={`practice-hero-chip ${myCharacterId === ch.id ? 'active' : ''}`}
              onTap={() => {
                switchPracticeCharacter(ch.id)
                setPracticeMenuOpen(false)
              }}
            >
              <img src={getHeroThumb(ch.id)} alt={ch.displayName} />
              <span>{ch.displayName}</span>
            </TouchTapButton>
          ))}
        </div>
      )}

      {/* Top-Right: Compact K/D + Voice Mic/Speaker + Single Settings Gear Popover + Leave */}
      <div
        className="rov-right-cluster"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="rov-kda-chip">
          <span>K {myKills}</span>
          {isTeamMatchMode(roomMode) && <span className="hide-xs">D {myDeaths}</span>}
          <div className="rov-self-hp">
            <div className="rov-self-hp-fill" style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        <div className="rov-utility-strip">
          <TouchTapButton
            className={`rov-icon-btn ${voiceMicEnabled ? 'active-emerald' : ''}`}
            onTap={() => void toggleVoiceMic()}
            title={voiceMicEnabled ? 'ปิดไมค์' : 'เปิดไมค์'}
            ariaLabel="เปิด/ปิดไมค์"
          >
            <IconMic size={15} off={!voiceMicEnabled} />
          </TouchTapButton>
          <TouchTapButton
            className={`rov-icon-btn ${voiceSpeakerEnabled ? 'active-sky' : ''}`}
            onTap={toggleVoiceSpeaker}
            title={voiceSpeakerEnabled ? 'ปิดเสียงพูดเพื่อน' : 'เปิดฟังเสียงพูดเพื่อน'}
            ariaLabel="เปิด/ปิดลำโพงเสียงคุย"
          >
            <IconHeadphones size={15} off={!voiceSpeakerEnabled} />
          </TouchTapButton>

          <div className="arena-settings-wrap">
            <TouchTapButton
              className={`rov-icon-btn ${settingsOpen ? 'active-sky' : ''}`}
              onTap={() => setSettingsOpen((v) => !v)}
              title="ตั้งค่าเพิ่มเติม (เสียง, เพลง, เต็มจอ, อีโมต)"
              ariaLabel="เปิดเมนูตั้งค่า"
            >
              <IconSettings size={15} />
            </TouchTapButton>

            {settingsOpen && (
              <div className="arena-settings-drawer" role="dialog" aria-label="ตั้งค่าในสนาม">
                <TouchTapButton
                  className={`arena-drawer-item ${!soundMuted ? 'active' : ''}`}
                  onTap={onToggleSound}
                >
                  <span className="arena-drawer-item-left">
                    <IconVolume size={15} muted={soundMuted} />
                    <span>เสียงเอฟเฟกต์</span>
                  </span>
                  <span className="arena-drawer-state">{soundMuted ? 'ปิด' : 'เปิด'}</span>
                </TouchTapButton>

                <TouchTapButton
                  className={`arena-drawer-item ${!bgmMuted ? 'active' : ''}`}
                  onTap={onToggleBgm}
                >
                  <span className="arena-drawer-item-left">
                    <IconMusic size={15} muted={bgmMuted} />
                    <span>เพลงประกอบ</span>
                  </span>
                  <span className="arena-drawer-state">{bgmMuted ? 'ปิด' : 'เปิด'}</span>
                </TouchTapButton>

                <TouchTapButton
                  className="arena-drawer-item"
                  onTap={() => {
                    onEmote()
                    setSettingsOpen(false)
                  }}
                >
                  <span className="arena-drawer-item-left">
                    <IconSparkles size={15} />
                    <span>ส่งอีโมตทักทาย</span>
                  </span>
                  <span className="arena-drawer-state">ส่ง</span>
                </TouchTapButton>

                <TouchTapButton
                  className={`arena-drawer-item ${isFullscreen ? 'active' : ''}`}
                  onTap={() => {
                    onToggleFullscreen()
                    setSettingsOpen(false)
                  }}
                >
                  <span className="arena-drawer-item-left">
                    <IconFullscreen size={15} exit={isFullscreen} />
                    <span>{isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นแบบเต็มจอ'}</span>
                  </span>
                  <span className="arena-drawer-state">{isFullscreen ? 'ON' : 'OFF'}</span>
                </TouchTapButton>

                {isAdmin && (
                  <TouchTapButton
                    className={`arena-drawer-item ${adminAiEnabled ? 'active' : ''}`}
                    onTap={() => toggleAdminAi()}
                  >
                    <span className="arena-drawer-item-left">
                      <IconBot size={15} />
                      <span>Admin Auto-AI (F9)</span>
                    </span>
                    <span className="arena-drawer-state">{adminAiEnabled ? 'ON' : 'OFF'}</span>
                  </TouchTapButton>
                )}
              </div>
            )}
          </div>

          <TouchTapButton
            className="rov-icon-btn danger page-back-btn"
            onTap={onLeave}
            title="ออกจากห้อง"
            ariaLabel="ออกจากห้อง"
          >
            <IconLogOut size={14} />
            <span className="hide-xs">ออก</span>
          </TouchTapButton>
        </div>
      </div>
    </header>
  )
})

export const ArenaSkillDock = memo(function ArenaSkillDock() {
  const characters = useGameStore((s) => s.characters)
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const roster = useGameStore((s) => s.roster)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const roomMode = useGameStore((s) => s.roomMode)
  const myTeam = useGameStore((s) => s.myTeam)
  const myCharacterId = useGameStore(
    (s) => s.roster.find((p) => p.id === s.myPlayerId)?.characterId ?? s.selectedCharId,
  )
  const myAlive = useGameStore((s) => s.myAlive)
  const myCooldowns = useGameStore((s) => s.myCooldowns)
  const myBasicCooldown = useGameStore((s) => s.myBasicCooldown)
  const myDashCooldown = useGameStore((s) => s.myDashCooldown)
  const myRctCooldown = useGameStore((s) => s.myRctCooldown)
  const myInfinityStones = useGameStore((s) => s.myInfinityStones)
  const mySnapCooldown = useGameStore((s) => s.mySnapCooldown)
  const castSkill = useGameStore((s) => s.castSkill)
  const castDash = useGameStore((s) => s.castDash)
  const castBasicAttack = useGameStore((s) => s.castBasicAttack)
  const castRct = useGameStore((s) => s.castRct)
  const castSnap = useGameStore((s) => s.castSnap)

  const cancelZoneRef = useRef<HTMLButtonElement | null>(null)
  const [dragHud, setDragHud] = useState<{ dragging: boolean; hoverCancel: boolean }>({
    dragging: false,
    hoverCancel: false,
  })

  const handleSkillDragChange = useCallback((dragging: boolean, hoverCancel: boolean) => {
    setDragHud((prev) =>
      prev.dragging === dragging && prev.hoverCancel === hoverCancel
        ? prev
        : { dragging, hoverCancel },
    )
  }, [])

  const myCharacterDef =
    characters.find((c) => c.id === (myCharacterId || selectedCharId)) ?? characters[0]

  const basicRange = getBasicAttackRange(myCharacterDef?.id)
  const isSaitama = myCharacterDef?.id === 'luangphi_sorn'
  const isThanos = myCharacterDef?.id === 'noone'
  const isIronMan = myCharacterDef?.id === 'iron_man'
  const snapReady = isThanos && myInfinityStones.length >= 5
  const ironArcPct = isIronMan ? Math.min(100, Math.max(0, myCooldowns[3] ?? 0)) : 0
  const ironInFlight = isIronMan && (myCooldowns[4] ?? 0) > 0
  const ironSnapReady = isIronMan && myInfinityStones.length >= 5
  const livingEnemies = isSaitama
    ? roster.filter(
        (p) =>
          p.id !== myPlayerId &&
          p.alive &&
          !(isTeamMatchMode(roomMode) && p.team && p.team === myTeam),
      )
    : []
  const punchCdMs = myCooldowns[0] ?? 0

  return (
    <div className={`moba-skill-dock ${isThanos ? 'is-thanos-dock' : ''}`}>
      {isThanos && myAlive && (
        <div
          className={`thanos-stones-pill ${snapReady ? 'ready' : ''}`}
          aria-label={`อัญมณีแห่งอินฟินิตี้ ${myInfinityStones.length} จาก 5 เม็ด`}
        >
          <span className="thanos-stones-dots">
            {[
              { slot: 1, col: '#A855F7', title: 'Power' },
              { slot: 2, col: '#3B82F6', title: 'Space' },
              { slot: 3, col: '#EF4444', title: 'Reality' },
              { slot: 4, col: '#10B981', title: 'Time' },
              { slot: 5, col: '#FACC15', title: 'Mind' },
            ].map((st) => {
              const lit = myInfinityStones.includes(st.slot)
              return (
                <span
                  key={st.slot}
                  className={`stone-orb ${lit ? 'lit' : ''}`}
                  style={{
                    background: lit ? st.col : 'rgba(15, 23, 42, 0.72)',
                    boxShadow: lit ? `0 0 10px ${st.col}` : 'none',
                  }}
                  title={st.title}
                />
              )
            })}
          </span>
        <span className="thanos-stones-text">
          {snapReady
            ? '5/5 พร้อมดีดนิ้ว'
            : `${myInfinityStones.length}/5 มณี`}
        </span>
        </div>
      )}
      {isIronMan && myAlive && (
        <div
          className={`thanos-stones-pill ${ironArcPct >= 100 || ironSnapReady ? 'ready' : ''}`}
          aria-label={`พลังงาน Arc Reactor ${ironArcPct}%`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderColor: ironSnapReady
              ? '#FACC15'
              : ironArcPct >= 100
                ? '#38BDF8'
                : 'rgba(56, 189, 248, 0.45)',
          }}
        >
          <span
            style={{
              width: '58px',
              height: '7px',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.55)',
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${ironArcPct}%`,
                height: '100%',
                background:
                  ironArcPct >= 100
                    ? 'linear-gradient(90deg, #38BDF8, #FACC15)'
                    : '#38BDF8',
                boxShadow: ironArcPct >= 100 ? '0 0 8px #FACC15' : '0 0 6px #38BDF8',
                transition: 'width 0.15s linear',
              }}
            />
          </span>
          <span className="thanos-stones-text">
            {ironSnapReady
              ? 'E: I AM IRON MAN!'
              : ironArcPct >= 100
                ? '100% MEGA BEAM'
                : `Arc ${ironArcPct}%`}
            {ironInFlight ? ' · บิน' : ''}
          </span>
        </div>
      )}
      {isSaitama && myAlive && (
        <div className="saitama-target-strip" role="group" aria-label="เลือกเป้าหมายหมัดเอาจริง">
          <div className="saitama-strip-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconTarget size={13} />
            <span>เลือกเป้าหมายปลิดชีพ ({punchCdMs > 0 ? `รอ ${(punchCdMs / 1000).toFixed(1)}วิ` : 'พร้อมต่อย'})</span>
          </div>
          <div className="saitama-strip-list">
            {livingEnemies.length === 0 ? (
              <span className="saitama-no-target">รอศัตรูเกิดในสนาม...</span>
            ) : (
              livingEnemies.map((enemy) => (
                <button
                  key={enemy.id}
                  type="button"
                  disabled={punchCdMs > 0}
                  className={`saitama-target-card ${enemy.invulnerable ? 'invuln' : ''}`}
                  onClick={() =>
                    castSkill(1, { worldX: enemy.x, worldY: enemy.y, targetId: enemy.id })
                  }
                  title={`ล็อกเป้าต่อย ${enemy.name}${enemy.invulnerable ? ' (กำลังอมตะ!)' : ''}`}
                >
                  <img
                    src={getHeroThumb(enemy.characterId)}
                    alt={enemy.name}
                    className="saitama-target-thumb"
                  />
                  <span className="saitama-target-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {enemy.invulnerable ? <EmblemShield size={11} /> : null}
                    {enemy.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      <button
        ref={cancelZoneRef}
        id="moba-cancel-zone"
        type="button"
        className={`moba-cancel-zone ${dragHud.dragging ? 'visible' : ''} ${dragHud.hoverCancel ? 'hovered' : ''}`}
        aria-label="ลากมาที่นี่เพื่อยกเลิกสกิล"
        title="ยกเลิกสกิล"
      >
        <svg viewBox="0 0 24 24" className="moba-cancel-svg" aria-hidden="true">
          <path
            d="M6 6L18 18M18 6L6 18"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {myCharacterDef &&
        myCharacterDef.skills.map((sk) => {
          const isIconicVoid =
            roomMode === 'iconic' && myCharacterDef.id === 'sia_mon' && sk.slot === 3
          const myPlayerState = roster.find((p) => p.id === myPlayerId)
          const isNarutoUlt = myCharacterDef.id === 'naruto' && sk.slot === 3
          const isNarutoKurama = isNarutoUlt && Boolean(myPlayerState?.godspeed)
          const isIronMegaBeam = isIronMan && sk.slot === 1 && ironArcPct >= 100
          const isIronSecretSnap = isIronMan && sk.slot === 2 && ironSnapReady
          const isIronFlightSlot = isIronMan && sk.slot === 3
          const effectiveCastRange = isIconicVoid
            ? 320
            : isNarutoUlt && !isNarutoKurama
              ? 170
              : isIronMegaBeam
                ? 760
                : isIronSecretSnap
                  ? 480
                  : (sk.castRange ?? 360)
          const effectiveAoeRadius = isIconicVoid
            ? 320
            : isNarutoUlt && !isNarutoKurama
              ? 170
              : isIronMegaBeam
                ? 118
                : isIronSecretSnap
                  ? 480
                  : (sk.aoeRadius ?? 72)
          const effectiveAimType =
            (isNarutoUlt && !isNarutoKurama) || isIronSecretSnap
              ? 'self'
              : (sk.aimType ?? 'line')
          const effectiveLabel = isNarutoKurama
            ? 'กระสุนสัตว์หาง'
            : isNarutoUlt
              ? 'แปลงร่างคุรามะ'
              : isIronSecretSnap
                ? 'I AM IRON MAN'
                : isIronMegaBeam
                  ? 'Mega Beam'
                  : isIronFlightSlot
                    ? ironInFlight
                      ? 'ลงจอด (บิน)'
                      : 'โหมดบิน'
                    : sk.name.split(' ')[0]
          const effectiveIconUrl = isNarutoKurama
            ? '/skills/naruto_3_bijuudama.png?v=nrt2'
            : isIronSecretSnap
              ? '/skills/iron_man_snap.png?v=im2'
              : (sk.iconUrl || `/skills/${myCharacterDef.id}_${sk.slot}.png`)
          const isStoneLocked = isThanos && !myInfinityStones.includes(sk.slot)
          return (
            <MobaSkillButton
              key={sk.slot}
              characterId={myCharacterDef.id}
              slotId={sk.slot}
              keyHint={sk.keyHint}
              label={effectiveLabel}
              iconUrl={effectiveIconUrl}
              cooldownMs={myCooldowns[sk.slot - 1] ?? 0}
              disabled={!myAlive || isStoneLocked}
              locked={isStoneLocked}
              accentColor={
                isNarutoKurama
                  ? '#A855F7'
                  : isIronSecretSnap
                    ? '#FACC15'
                    : isIronMegaBeam
                      ? '#38BDF8'
                      : sk.accentColor
              }
              slotClass={`slot-${sk.slot}`}
              castRange={effectiveCastRange}
              aoeRadius={effectiveAoeRadius}
              aimType={effectiveAimType}
              chargeDurationMs={myCharacterDef.id === 'simo' && sk.slot === 2 ? 1150 : undefined}
              variant={!isThanos && sk.slot === 3 ? 'ultimate' : 'skill'}
              cancelZoneRef={cancelZoneRef}
              onDragChange={handleSkillDragChange}
              onTrigger={(aim) =>
                castSkill(
                  sk.slot as 1 | 2 | 3 | 4 | 5,
                  aim ? { worldX: 0, worldY: 0, ...aim } : undefined,
                )
              }
            />
          )
        })}

      {isThanos && (
        <MobaSkillButton
          characterId={myCharacterDef?.id}
          slotId={6}
          keyHint="G"
          label="ดีดนิ้ว"
          iconUrl="/skills/noone_snap.png"
          cooldownMs={mySnapCooldown}
          disabled={!myAlive || !snapReady}
          locked={!snapReady}
          lockBadge={`${myInfinityStones.length}/5`}
          accentColor="#FACC15"
          slotClass="slot-snap"
          castRange={420}
          aoeRadius={420}
          aimType="self"
          variant="ultimate"
          cancelZoneRef={cancelZoneRef}
          onDragChange={handleSkillDragChange}
          onTrigger={castSnap}
        />
      )}

      <MobaSkillButton
        characterId={myCharacterDef?.id}
        slotId={4}
        keyHint="SHIFT"
        label="Dash"
        iconUrl="/skills/dash.png"
        cooldownMs={myDashCooldown}
        disabled={!myAlive}
        accentColor="#38BDF8"
        slotClass="slot-dash"
        castRange={255}
        aoeRadius={32}
        aimType="ground"
        variant="dash"
        cancelZoneRef={cancelZoneRef}
        onDragChange={handleSkillDragChange}
        onTrigger={(aim) => castDash(aim ? { worldX: 0, worldY: 0, ...aim } : undefined)}
      />

      {roomMode === 'iconic' && (
        <MobaSkillButton
          characterId={myCharacterDef?.id}
          slotId={5}
          keyHint="G"
          label="ย้อนกลับ"
          iconUrl="/skills/iconic_rct.png"
          cooldownMs={myRctCooldown}
          disabled={!myAlive}
          accentColor="#34D399"
          slotClass="slot-rct"
          castRange={0}
          aoeRadius={105}
          aimType="self"
          variant="skill"
          cancelZoneRef={cancelZoneRef}
          onDragChange={handleSkillDragChange}
          onTrigger={castRct}
        />
      )}

      <MobaSkillButton
        characterId={myCharacterDef?.id}
        slotId={0}
        keyHint="J / ␣"
        label="ตีธรรมดา"
        iconUrl="/skills/atk.png"
        cooldownMs={myBasicCooldown}
        disabled={!myAlive}
        accentColor={myCharacterDef?.accentColor ?? '#38BDF8'}
        slotClass="slot-basic"
        castRange={basicRange}
        aoeRadius={48}
        aimType="lockon"
        variant="basic"
        cancelZoneRef={cancelZoneRef}
        onDragChange={handleSkillDragChange}
        onTrigger={(aim) =>
          castBasicAttack(aim ? { worldX: 0, worldY: 0, ...aim } : undefined)
        }
      />
    </div>
  )
})
