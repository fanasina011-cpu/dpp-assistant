/**
 * Combobox moderne pour sélectionner un utilisateur.
 * Recherche + avatars + clavier + flip + filtres par rôle/service.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Filter, Search, X } from 'lucide-react'
import Avatar from './Avatar'
import type { Utilisateur } from '../../types'

interface UserSelectProps {
  users: Utilisateur[]
  value: number | null | ''
  onChange: (userId: number | '') => void
  placeholder?: string
  disabled?: boolean
  allowNone?: boolean
  label?: string
  error?: string
  excludeIds?: number[]
  /** Affiche le filtre par rôle (défaut: true) */
  showRoleFilter?: boolean
  /** Affiche le filtre par service (défaut: false) */
  showServiceFilter?: boolean
}

export default function UserSelect({
  users,
  value,
  onChange,
  placeholder = 'Sélectionner un utilisateur',
  disabled,
  allowNone = false,
  label,
  error,
  excludeIds = [],
  showRoleFilter = true,
  showServiceFilter = false,
}: UserSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [roleFilter, setRoleFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const [maxHeight, setMaxHeight] = useState(380)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Liste unique de rôles
  const roles = useMemo(() => {
    const set = new Set<string>()
    users.forEach((u) => {
      if (u.role_display) set.add(u.role_display)
    })
    return Array.from(set).sort()
  }, [users])

  // Liste unique de services
  const services = useMemo(() => {
    const set = new Set<string>()
    users.forEach((u) => {
      if (u.service) set.add(u.service)
    })
    return Array.from(set).sort()
  }, [users])

  const hasActiveFilters = Boolean(roleFilter || serviceFilter)

  // Filtre + recherche
  const filtered = users
    .filter((u) => !excludeIds.includes(u.id))
    .filter((u) => !roleFilter || u.role_display === roleFilter)
    .filter((u) => !serviceFilter || u.service === serviceFilter)
    .filter((u) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        u.nom_complet.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.role_display.toLowerCase().includes(q) ||
        (u.service?.toLowerCase().includes(q) ?? false)
      )
    })

  const currentUser =
    value !== '' && value !== null ? users.find((u) => u.id === value) : null

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

    const PANEL_WIDTH = Math.max(rect.width, 340)
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
      setRoleFilter('')
      setServiceFilter('')
    } else {
      setTimeout(() => inputRef.current?.focus(), 10)
      setHighlighted(0)
    }
  }, [isOpen])

  useEffect(() => {
    setHighlighted(0)
  }, [search, roleFilter, serviceFilter])

  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const el = listRef.current.children[highlighted] as HTMLElement
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [highlighted, isOpen])

  const handleSelect = (userId: number | '') => {
    onChange(userId)
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
      const u = filtered[highlighted]
      if (u) handleSelect(u.id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setHighlighted(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setHighlighted(filtered.length - 1)
    }
  }

  const showNoneOption = allowNone && !search.trim() && !hasActiveFilters
  const showFilters = showRoleFilter || showServiceFilter

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
        className={`w-full h-10 px-3 flex items-center gap-2 bg-white border rounded-md text-left transition-colors ${
          error
            ? 'border-danger-border focus:ring-danger'
            : isOpen
              ? 'border-brand-400 ring-2 ring-brand-500'
              : 'border-ink-200 hover:border-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-500'
        } focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {currentUser ? (
          <>
            <Avatar name={currentUser.nom_complet} size="xs" />
            <span className="flex-1 text-[13px] text-ink-900 truncate">
              {currentUser.nom_complet}
            </span>
            <span className="text-[11px] text-ink-400 truncate hidden sm:block">
              {currentUser.role_display}
            </span>
          </>
        ) : (
          <span className="flex-1 text-[13px] text-ink-400 italic">
            {placeholder}
          </span>
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
              width: Math.max(position.width, 340),
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
                  placeholder="Rechercher par nom, rôle, service..."
                  className="w-full h-8 pl-8 pr-2 text-[12px] bg-ink-50 border border-ink-200 rounded
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                />
              </div>
            </div>

            {/* Filtres */}
            {showFilters && (
              <div className="px-2 py-2 border-b border-ink-100 flex items-center gap-2 flex-wrap bg-ink-50/40">
                <Filter size={11} className="text-ink-400 shrink-0" />

                {showRoleFilter && roles.length > 1 && (
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className={`h-7 px-2 text-[11px] bg-white border rounded cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      roleFilter
                        ? 'border-brand-300 text-brand-700 font-medium'
                        : 'border-ink-200 text-ink-600'
                    }`}
                  >
                    <option value="">Tous les rôles</option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}

                {showServiceFilter && services.length > 1 && (
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    className={`h-7 px-2 text-[11px] bg-white border rounded cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      serviceFilter
                        ? 'border-brand-300 text-brand-700 font-medium'
                        : 'border-ink-200 text-ink-600'
                    }`}
                  >
                    <option value="">Tous les services</option>
                    {services.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('')
                      setServiceFilter('')
                    }}
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
                  <span className="flex-1 text-[12px] italic">Non assigné</span>
                  {(value === '' || value === null) && <Check size={13} />}
                </button>
              )}

              {filtered.length === 0 ? (
                <p className="text-[12px] text-ink-400 text-center py-6">
                  Aucun utilisateur trouvé.
                </p>
              ) : (
                filtered.map((u, idx) => {
                  const isSelected = u.id === value
                  const isHighlighted = idx === highlighted
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onMouseEnter={() => setHighlighted(idx)}
                      onClick={() => handleSelect(u.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-brand-50 text-brand-700'
                          : isHighlighted
                            ? 'bg-ink-100 text-ink-900'
                            : 'text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      <Avatar name={u.nom_complet} size="xs" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium truncate">
                          {u.nom_complet}
                        </div>
                        <div className="text-[10px] text-ink-500 truncate">
                          {u.role_display}
                          {u.service ? ` · ${u.service}` : ''}
                        </div>
                      </div>
                      {isSelected && <Check size={13} />}
                    </button>
                  )
                })
              )}
            </div>

            {/* Pied */}
            <div className="px-3 py-1.5 border-t border-ink-100 bg-ink-50/40 text-[10px] text-ink-500">
              {filtered.length} utilisateur{filtered.length > 1 ? 's' : ''}
              {hasActiveFilters && ' (filtrés)'}
              {search && ` · « ${search} »`}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}