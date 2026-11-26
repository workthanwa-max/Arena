import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import type { GameMode, MapId } from '../types/game'
import { EmblemBolt, EmblemShield, HeroClassEmblem } from './HeroClassEmblem'
import { IconClose, IconSwords, IconTarget } from './Icons'

interface CreateRoomModalProps {
  onClose: () => void
}

export function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const authUser = useGameStore((s) => s.authUser)
  const rawCharacters = useGameStore((s) => s.characters)
  const characters = rawCharacters.filter((c) => !c.adminOnly || authUser?.role === 'admin')
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const setSelectedCharId = useGameStore((s) => s.setSelectedCharId)
  const selectedMode = useGameStore((s) => s.selectedMode)
  const selectedMapId = useGameStore((s) => s.selectedMapId)
  const joining = useGameStore((s) => s.joining)
  const createAndJoinRoom = useGameStore((s) => s.createAndJoinRoom)

  const [mode, setMode] = useState<GameMode>(selectedMode)
  const [mapId, setMapId] = useState<MapId>(selectedMapId)

  async function handleConfirm() {
    await createAndJoinRoom(mode, mapId)
  }

  function selectMode(nextMode: GameMode) {
    setMode(nextMode)
    if (nextMode === 'iconic') {
      setMapId('shibuya')
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="ตั้งค่าสร้างห้องเล่นเกม">
      <div className="surface-card create-room-modal">
        <div className="modal-head">
          <div>
            <h2>สร้างห้องเล่นใหม่</h2>
            <p>เลือกรูปแบบการต่อสู้และสนามประลอง ระบบจะสร้างรหัสห้อง 6 หลักให้อัตโนมัติ</p>
          </div>
          <button type="button" className="btn-pill secondary compact" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <IconClose size={13} />
          </button>
        </div>

        <div className="modal-section">
          <span className="field-label">1. เลือกโหมดการเล่น</span>

          <button
            type="button"
            className={`choice-card iconic-featured-card ${mode === 'iconic' ? 'selected' : ''}`}
            onClick={() => selectMode('iconic')}
          >
            <div className="iconic-card-row">
              <span className="iconic-badge-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <EmblemBolt size={12} /> NEW SPECIAL MODE
              </span>
              <span className="iconic-meta-pill">1 vs 1 • ชิบูย่า 3D • เป้า 5 Kills</span>
            </div>
            <div className="choice-title">ICONIC 1v1: โกะโจ ซาโตรุ vs เรียวเมน สุคุนะ</div>
            <div className="choice-desc">
              มุมมองด้านหลังตัวละคร 3D • เข้าห้องรอก่อนกดเริ่มพร้อมกัน • สุ่ม Gojo/Sukuna • กางอาณาเขตชนกัน • เพลง Judas!
            </div>
          </button>

          <div className="option-cards-grid two-cols">
            <button
              type="button"
              className={`choice-card ${mode === 'duel_1v1' ? 'selected' : ''}`}
              onClick={() => selectMode('duel_1v1')}
            >
              <div className="choice-icon"><IconSwords size={18} /></div>
              <div className="choice-title">1 vs 1 ดวลเดือด (5 Kills ชนะ)</div>
              <div className="choice-desc">
                รอหน้าห้องครบ 2/2 คน แล้วกดเริ่มพร้อมกัน ใครครบ 5 คิลก่อนชนะ!
              </div>
            </button>

            <button
              type="button"
              className={`choice-card ${mode === 'tdm_3v3' ? 'selected' : ''}`}
              onClick={() => selectMode('tdm_3v3')}
            >
              <div className="choice-icon"><EmblemShield size={18} /></div>
              <div className="choice-title">ทีม 3 vs 3 (ครบ 50 Kills ชนะ)</div>
              <div className="choice-desc">
                รอหน้าห้องฝั่งละ 3 คนจนครบ 6/6 จึงกดเริ่มเข้าสมรภูมิพร้อมกัน!
              </div>
            </button>

            <button
              type="button"
              className={`choice-card ${mode === 'practice' ? 'selected' : ''}`}
              onClick={() => selectMode('practice')}
            >
              <div className="choice-icon"><IconTarget size={18} /></div>
              <div className="choice-title">ฝึกซ้อมกับหุ่น Dummy</div>
              <div className="choice-desc">
                เข้าห้องเตรียมตัวเลือกฮีโร่/แผนที่ แล้วกดเริ่มลงทดสอบสกิลและดาเมจ
              </div>
            </button>

            <button
              type="button"
              className={`choice-card ${mode === 'ffa' ? 'selected' : ''}`}
              onClick={() => selectMode('ffa')}
            >
              <div className="choice-icon"><HeroClassEmblem heroClass="vanguard" size={18} /></div>
              <div className="choice-title">ตะลุมบอน 5 คน (FFA)</div>
              <div className="choice-desc">
                โหมดเดียวที่เข้าสู่สมรภูมิได้ทันที (ไม่ต้องรอหน้าห้อง) พร้อมรหัส 6 หลัก!
              </div>
            </button>
          </div>
        </div>

        <div className="modal-section">
          <span className="field-label">
            2. เลือกแผนที่สนามรบ {mode === 'iconic' ? '(โหมด ICONIC ล็อกฉากชิบูย่า 3D)' : ''}
          </span>
          <div className="option-cards-grid">
            <button
              type="button"
              className={`choice-card ${mapId === 'shibuya' ? 'selected' : ''}`}
              onClick={() => setMapId('shibuya')}
            >
              <img src="/maps/shibuya_bg.webp" alt="Shibuya" className="map-thumb" />
              <div className="choice-title">ชิบูย่า (Shibuya Incident)</div>
              <div className="choice-desc">
                {mode === 'iconic'
                  ? 'สนามชิบูย่า 3D Over-The-Shoulder พร้อมเอฟเฟกต์กางอาณาเขตสุดอลังการ'
                  : 'ลานคอนกรีตแตกร้าว หมอกขาวดำ & พื้นที่ห้าแยกชิบูย่า'}
              </div>
            </button>

            <button
              type="button"
              disabled={mode === 'iconic'}
              className={`choice-card ${mapId === 'konoha' ? 'selected' : ''} ${mode === 'iconic' ? 'disabled' : ''}`}
              onClick={() => setMapId('konoha')}
            >
              <img src="/maps/konoha_bg.webp" alt="Konoha" className="map-thumb" />
              <div className="choice-title">หมู่บ้านโคโนฮะ (นารุโตะ)</div>
              <div className="choice-desc">
                ลานนินจาใต้ผาหน้าโฮคาเงะ ฐาน 2 ฝั่งสมดุลเหมาะกับ 3v3
              </div>
            </button>
          </div>
        </div>

        {mode === 'ffa' && (
          <div className="modal-section">
            <span className="field-label">3. เลือกฮีโร่ลงตะลุมบอนทันที (FFA ไม่มีหน้าห้องรอ)</span>
            <div className="inline-hero-grid">
              {characters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  className={`inline-hero-chip ${selectedCharId === ch.id ? 'active' : ''}`}
                  onClick={() => setSelectedCharId(ch.id)}
                >
                  <img src={ch.imageUrl} alt={ch.displayName} className="inline-hero-thumb" />
                  <span>{ch.displayName}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-pill secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn-pill primary"
            disabled={joining}
            onClick={() => void handleConfirm()}
          >
            {joining
              ? 'กำลังสร้างห้อง...'
              : mode === 'iconic'
                ? 'สร้างห้อง ICONIC Gojo vs Sukuna (รหัส 6 หลัก)'
                : mode === 'duel_1v1'
                  ? 'สร้างห้อง 1v1 (รหัส 6 หลัก)'
                  : mode === 'tdm_3v3'
                    ? 'สร้างห้องรอ 3v3 (รหัส 6 หลัก)'
                    : mode === 'practice'
                      ? 'สร้างห้องฝึกซ้อม (รหัส 6 หลัก)'
                      : 'สร้างห้อง FFA 5 คน (เข้าเกมทันที)'}
          </button>
        </div>
      </div>
    </div>
  )
}
