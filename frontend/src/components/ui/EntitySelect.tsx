/**
 * Combobox générique pour sélectionner n'importe quelle entité
 * avec recherche + filtres personnalisables + navigation clavier.
 */

import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Filter, Search, X } from 'lucide-react'

export interface EntityOption {
  id: number
  label: string
  subtitle?: string
  badge?: ReactNode
  searchText?: string
  /** Valeurs pour chaque filtre (clé = filter.key) */
  filterValues?: Record<string, string>
}

export interface EntityFilter {
  key: string
  label: string
  options: { value: string; label: string }[]
}

interface EntitySelectProps {
  items: EntityOption[]
  value: number | '' | null
  onChange: (id: number | '') => void
  placeholder?: string
  disabled?: boolean
  allowNone?: boolean
  label?: string
  error?: string
  noneLabel?: string
  /** Filtres personnalisés (le 1er est affiché en priorité) */
  filters?: EntityFilter[]
}

export default function EntitySelect({
  items,
  value,
  onChange,
  placeholder = 'Sélectionner',
  disabled,
  allowNone = false,
  label,
  error,
  noneLabel = 'Aucun',
  filters = [],
}: EntitySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const [maxHeight, setMaxHeight] = useState(420)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filtres actifs
  const hasActiveFilters = Object.values(filterValues).some(Boolean)

  // Filtre + recherche
  const filtered = useMemo(() => {
    return items.filter((item) => {
      // Filtres
      for (const filter of filters) {
        const activeValue = filterValues[filter.key]
        if (activeValue) {
          const itemValue = item.filterValues?.[filter.key]
          if (itemValue !== activeValue) return false
        }
      }
      // Recherche
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.searchText?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, search, filterValues, filters])

  const currentItem =
    value !== '' && value !== null ? items.find((i) => i.id === value) : null

  // Position + flip
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const PANEL_HEIGHT_ESTIMATE = 420
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const openUpward =
      spaceBelow < PANEL_HEIGHT_ESTIMATE && spaceAbove > spaceBelow

    const availableHeight = openUpward
      ? Math.max(180, Math.min(PANEL_HEIGHT_ESTIMATE, spaceAbove))
      : Math.max(180, Math.min(PANEL_HEIGHT_ESTIMATE, spaceBelow))

    const PANEL_WIDTH = Math.max(rect.width, 380)
    const maxLeft = window.innerWidth - PANEL_WIDTH - 8
    const finalLeft = Math.max(8, Math.min(rect.left, maxLeft))

    setMaxHeight(availableHeight)
    setPosition({
      top: openUpward ? rect.top - availableHeight - 4 : rect.bottom + 4,
      left: finalLeft,
      width: rect.width,
    })
  }, [isOpen])

  // Fermetures
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return
      setIsOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    function handleScroll(e: Event) {
      if (panelRef.current?.contains(e.target as Node)) return
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen])

  // Reset à la fermeture
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setFilterValues({})
    } else {
      setTimeout(() => inputRef.current?.focus(), 10)
      setHighlighted(0)
    }
  }, [isOpen])

  useEffect(() => {
    setHighlighted(0)
  }, [search, filterValues])

  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const el = listRef.current.children[highlighted] as HTMLElement
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [highlighted, isOpen])

  const handleSelect = (id: number | '') => {
    onChange(id)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[highlighted]
      if (item) handleSelect(item.id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setHighlighted(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setHighlighted(filtered.length - 1)
    }
  }

  const showNoneOption = allowNone && !search.trim() && !hasActiveFilters

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[12px] font-medium text-ink-700 mb-1.5">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full min-h-10 px-3 py-1.5 flex items-center gap-2 bg-white border rounded-md text-left transition-colors ${
          error
            ? 'border-danger-border'
            : isOpen
              ? 'border-brand-400 ring-2 ring-brand-500'
              : 'border-ink-200 hover:border-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-500'
        } focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {currentItem ? (
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-ink-900 truncate font-medium">
              {currentItem.label}
            </div>
            {currentItem.subtitle && (
              <div className="text-[10px] text-ink-500 truncate">
                {currentItem.subtitle}
              </div>
            )}
          </div>
        ) : (
          <span className="flex-1 text-[13px] text-ink-400 italic">
            {placeholder}
          </span>
        )}
        {currentItem?.badge && (
          <span className="shrink-0">{currentItem.badge}</span>
        )}
        <ChevronDown
          size={14}
          className={`text-ink-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: Math.max(position.width, 380),
              maxHeight: `${maxHeight}px`,
            }}
            className="z-[100] bg-white border border-ink-200 rounded-lg shadow-xl overflow-hidden flex flex-col"
          >
            {/* Recherche */}
            <div className="p-2 border-b border-ink-100">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher..."
                  className="w-full h-8 pl-8 pr-2 text-[12px] bg-ink-50 border border-ink-200 rounded
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                />
              </div>
            </div>

            {/* Filtres */}
            {filters.length > 0 && (
              <div className="px-2 py-2 border-b border-ink-100 flex items-center gap-2 flex-wrap bg-ink-50/40">
                <Filter size={11} className="text-ink-400 shrink-0" />

                {filters.map((f) => (
                  <select
                    key={f.key}
                    value={filterValues[f.key] || ''}
                    onChange={(e) =>
                      setFilterValues((prev) => ({
                        ...prev,
                        [f.key]: e.target.value,
                      }))
                    }
                    className={`h-7 px-2 text-[11px] bg-white border rounded cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      filterValues[f.key]
                        ? 'border-brand-300 text-brand-700 font-medium'
                        : 'border-ink-200 text-ink-600'
                    }`}
                  >
                    <option value="">{f.label}</option>
                    {f.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ))}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => setFilterValues({})}
                    className="ml-auto text-[10px] text-ink-500 hover:text-brand-600 font-medium inline-flex items-center gap-0.5"
                  >
                    <X size={10} />
                    Effacer
                  </button>
                )}
              </div>
            )}

            {/* Liste */}
            <div
              ref={listRef}
              className="overflow-y-auto py-1 flex-1"
              style={{ minHeight: 100 }}
            >
              {showNoneOption && (
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    value === '' || value === null
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full border border-ink-200 flex items-center justify-center text-ink-400 text-[10px]">
                    —
                  </div>
                  <span className="flex-1 text-[12px] italic">{noneLabel}</span>
                  {(value === '' || value === null) && <Check size={13} />}
                </button>
              )}

              {filtered.length === 0 ? (
                <p className="text-[12px] text-ink-400 text-center py-6">
                  Aucun résultat.
                </p>
              ) : (
                filtered.map((item, idx) => {
                  const isSelected = item.id === value
                  const isHighlighted = idx === highlighted
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setHighlighted(idx)}
                      onClick={() => handleSelect(item.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-brand-50 text-brand-700'
                          : isHighlighted
                            ? 'bg-ink-100 text-ink-900'
                            : 'text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium text-ink-900 truncate">
                          {item.label}
                        </div>
                        {item.subtitle && (
                          <div className="text-[10px] text-ink-500 truncate">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      {item.badge && (
                        <span className="shrink-0">{item.badge}</span>
                      )}
                      {isSelected && <Check size={13} className="shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>

            {/* Pied */}
            <div className="px-3 py-1.5 border-t border-ink-100 bg-ink-50/40 text-[10px] text-ink-500">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              {hasActiveFilters && ' (filtrés)'}
              {search && ` · « ${search} »`}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}