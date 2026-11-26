import { useEffect, useRef } from 'react'
import { animateCardEnter } from '../animations/gsapPresets'
import { soundEngine } from '../audio/soundEngine'
import { Hero3dPreview } from '../components/Hero3dPreview'
import { HeroPickerPanel } from '../components/HeroPickerPanel'
import { IconArrowLeft, IconPlay, IconVolume } from '../components/Icons'
import { getMapDisplayLabel } from '../constants/heroClasses'
import { useGameStore } from '../store/useGameStore'

export function JoinHeroSelectPage() {
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const pendingJoinRoom = useGameStore((s) => s.pendingJoinRoom)
  const joining = useGameStore((s) => s.joining)
  const error = useGameStore((s) => s.error)

  const setSelectedCharId = useGameStore((s) => s.setSelectedCharId)
  const confirmPendingJoin = useGameStore((s) => s.confirmPendingJoin)
  const goBack = useGameStore((s) => s.goBack)
  const setError = useGameStore((s) => s.setError)

  const shellRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    animateCardEnter(shellRef.current)
  }, [])

  const activeHero = characters.find((c) => c.id === selectedCharId) ?? characters[0]

  if (!pendingJoinRoom) {
    return null
  }

  const isFFA = pendingJoinRoom.mode === 'ffa'
  const modeLabel =
    pendingJoinRoom.mode === 'duel_1v1'
      ? '1 vs 1'
      : pendingJoinRoom.mode === 'tdm_3v3'
        ? '3 vs 3'
        : pendingJoinRoom.mode === 'practice'
          ? 'ฝึกซ้อม'
          : 'FFA 5 คน'
  const mapLabel = getMapDisplayLabel(pendingJoinRoom.mapId)

  function handlePickHero(charId: string) {
    soundEngine.unlock()
    setSelectedCharId(charId)
    const ch = characters.find((c) => c.id === charId)
    soundEngine.speakCharacterQuote(charId, ch?.voiceLine)
  }

  return (
    <div className="ui-page waiting-room-backdrop">
      <div ref={shellRef} className="ui-shell join-hero-select-shell">
        <header className="ui-topbar waiting-room-header">
          <div className="ui-topbar-group">
            <button
              type="button"
              className="ui-btn page-back-btn"
              onClick={goBack}
              aria-label="ย้อนกลับ"
            >
              <IconArrowLeft size={15} />
              <span>ย้อนกลับ</span>
            </button>
            <span className="ui-pill gold">ห้อง #{pendingJoinRoom.roomId}</span>
            <h1 className="ui-page-title">เลือกฮีโร่ก่อนเข้าร่วม</h1>
          </div>

          <div className="ui-topbar-group">
            <span className="ui-pill accent">{modeLabel}</span>
            <span className="ui-pill">{mapLabel}</span>
            <span className="ui-pill">
              {pendingJoinRoom.currentPlayers}/{pendingJoinRoom.maxPlayers} คน
            </span>
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

        <main className="clean-two-col">
          {activeHero && (
            <section className="ui-card" aria-label="ข้อมูลฮีโร่ที่เลือก">
              <div className="ui-topbar-group" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
                    {activeHero.displayName}
                  </h2>
                  <p className="ui-card-sub">
                    {activeHero.animeTitle} · HP {activeHero.maxHp} · Speed {activeHero.moveSpeed}
                  </p>
                </div>
                <button
                  type="button"
                  className="ui-btn"
                  style={{ height: 30, fontSize: 12 }}
                  onClick={() => {
                    soundEngine.unlock()
                    soundEngine.speakCharacterQuote(activeHero.id, activeHero.voiceLine)
                  }}
                >
                  <IconVolume size={13} />
                  <span>เสียงพากย์</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Hero3dPreview character={activeHero} size="lg" frameless />
              </div>

              <div className="clean-skill-grid">
                {activeHero.skills.map((sk) => (
                  <div key={sk.slot} className="clean-skill-card" title={sk.description}>
                    <div className="ui-topbar-group" style={{ gap: 6 }}>
                      <img
                        src={sk.iconUrl || `/skills/${activeHero.id}_${sk.slot}.png`}
                        alt={sk.name}
                        style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{sk.keyHint} · {sk.name.split(' ')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ui-card" aria-label="เลือกฮีโร่ทั้งหมด">
            <HeroPickerPanel
              characters={characters}
              selectedId={activeHero?.id ?? ''}
              compactTabs
              maxHeight={340}
              onSelect={handlePickHero}
            />

            <footer className="clean-setup-footer">
              <span className="ui-pill accent">เลือกแล้ว: {activeHero?.displayName ?? 'กิลกาเมซ (Gilgamesh)'}</span>
              <button
                type="button"
                className="ui-btn cta-gold join-confirm-btn"
                disabled={joining || !activeHero}
                onClick={() => void confirmPendingJoin(activeHero?.id)}
              >
                <IconPlay size={15} />
                <span>
                  {joining
                    ? 'กำลังเข้า...'
                    : isFFA
                      ? 'เข้าสมรภูมิทันที'
                      : `เข้าห้องรอ #${pendingJoinRoom.roomId}`}
                </span>
              </button>
            </footer>
          </section>
        </main>
      </div>
    </div>
  )
}
