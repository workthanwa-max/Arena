import { useMemo, useState } from 'react'
import { HERO_CLASS_FILTERS, type HeroClassFilter } from '../constants/heroClasses'
import type { CharacterDef } from '../types/game'
import { IconClose, IconSearch } from './Icons'

interface HeroPickerPanelProps {
  characters: CharacterDef[]
  selectedId: string
  onSelect: (charId: string) => void
  compactTabs?: boolean
  maxHeight?: number
  ariaLabel?: string
}

export function HeroPickerPanel({
  characters,
  selectedId,
  onSelect,
  compactTabs = false,
  maxHeight,
  ariaLabel = 'รายชื่อตัวละคร',
}: HeroPickerPanelProps) {
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState<HeroClassFilter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return characters.filter((c) => {
      if (classFilter !== 'all' && c.heroClass !== classFilter) return false
      if (!q) return true
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.animeTitle.toLowerCase().includes(q) ||
        c.animeRef.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    })
  }, [characters, classFilter, query])

  return (
    <div className="hp-wrap">
      <div className="hp-search-row">
        <span className="hp-search-ico">
          <IconSearch size={15} />
        </span>
        <input
          type="text"
          className="hp-search-input"
          placeholder={`ค้นหาฮีโร่จาก ${characters.length} ตัว...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="ค้นหาฮีโร่"
        />
        {query && (
          <button
            type="button"
            className="hp-search-clear"
            onClick={() => setQuery('')}
            aria-label="ล้างคำค้นหา"
          >
            <IconClose size={12} />
          </button>
        )}
      </div>

      <div className="hp-tabs" role="tablist" aria-label="กรองฮีโร่ตามสาย">
        {HERO_CLASS_FILTERS.map((cls) => {
          const count =
            cls.id === 'all'
              ? characters.length
              : characters.filter((c) => c.heroClass === cls.id).length
          const isActive = classFilter === cls.id
          return (
            <button
              key={cls.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`hp-tab ${isActive ? 'active' : ''}`}
              style={{ '--class-accent': cls.color } as React.CSSProperties}
              title={cls.traitSummary}
              onClick={() => setClassFilter(cls.id)}
            >
              <span>{compactTabs ? cls.shortName : cls.name}</span>
              <span className="hp-tab-count">{count}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="hp-empty">ไม่พบฮีโร่ที่ตรงกับ &ldquo;{query}&rdquo;</div>
      ) : (
        <div
          className="hp-grid"
          role="listbox"
          aria-label={ariaLabel}
          style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
        >
          {filtered.map((ch) => {
            const isActive = ch.id === selectedId
            return (
              <button
                key={ch.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`hp-tile ${isActive ? 'active' : ''}`}
                onClick={() => onSelect(ch.id)}
                title={`${ch.displayName} (${ch.animeTitle})`}
              >
                <div className="hp-thumb-wrap">
                  <img src={ch.imageUrl} alt={ch.displayName} className="hp-thumb" loading="lazy" />
                  {ch.adminOnly && <span className="moba-crown-tag">👑</span>}
                </div>
                <span className="hp-name">{ch.displayName}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
