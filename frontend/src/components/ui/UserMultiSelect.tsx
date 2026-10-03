/**
 * Combobox multi-sélection pour choisir plusieurs utilisateurs.
 * Chips des sélectionnés + recherche + navigation clavier.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search, X } from 'lucide-react'
import Avatar from './Avatar'
import type { Utilisateur } from '../../types'

interface UserMultiSelectProps {
  users: Utilisateur[]
  value: number[]
  onChange: (userIds: number[]) => void
  placeholder?: string
  disabled?: boolean
  label?: string
  error?: string
  excludeIds?: number[]
}

export default function UserMultiSelect({
  users,
  value,
  onChange,
  placeholder = 'Sélectionner des utilisateurs',
  disabled,
  label,
  error,
  excludeIds = [],
}: UserMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const [maxHeight, setMaxHeight] = useState(380)

  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = users
    .filter((u) => !excludeIds.includes(u.id))
    .filter((u) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        u.nom_complet.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.role_display.toLowerCase().includes(q)
      )
    })

  const selectedUsers = users.filter((u) => value.includes(u.id))

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const PANEL_HEIGHT_ESTIMATE = 380
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const openUpward =
      spaceBelow < PANEL_HEIGHT_ESTIMATE && spaceAbove > spaceBelow

    const availableHeight = openUpward
      ? Math.max(180, Math.min(PANEL_HEIGHT_ESTIMATE, spaceAbove))
      : Math.max(180, Math.min(PANEL_HEIGHT_ESTIMATE, spaceBelow))

    setMaxHeight(availableHeight)
    const PANEL_WIDTH = Math.max(rect.width, 320)
    const maxLeft = window.innerWidth - PANEL_WIDTH - 8
    const finalLeft = Math.max(8, Math.min(rect.left, maxLeft))

    setPosition({
      top: openUpward ? rect.top - availableHeight - 4 : rect.bottom + 4,
      left: finalLeft,
      width: rect.width,
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) {
        return
      }
      setIsOpen(false)
      setSearch('')
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSearch('')
      }
    }
    function handleClose() {
      setIsOpen(false)
      setSearch('')
    }
    function handleScroll(e: Event) {
      if (panelRef.current?.contains(e.target as Node)) return
      handleClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleClose)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleClose)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  const toggleUser = (userId: number) => {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId))
    } else {
      onChange([...value, userId])
    }
  }

  const removeUser = (userId: number) => {
    onChange(value.filter((id) => id !== userId))
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[12px] font-medium text-ink-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={`w-full min-h-10 px-2 py-1.5 bg-white border rounded-md flex items-center gap-1 flex-wrap cursor-pointer transition-colors ${
          error
            ? 'border-danger-border'
            : isOpen
              ? 'border-brand-400 ring-2 ring-brand-500'
              : 'border-ink-200 hover:border-ink-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedUsers.length === 0 ? (
          <span className="text-[13px] text-ink-400 italic pl-1 py-0.5">
            {placeholder}
          </span>
        ) : (
          <>
            {selectedUsers.slice(0, 3).map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-medium rounded-full"
              >
                <Avatar name={u.nom_complet} size="xs" />
                <span className="truncate max-w-[120px]">
                  {u.nom_complet}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeUser(u.id)
                  }}
                  className="text-brand-500 hover:text-brand-700 ml-0.5"
                  aria-label="Retirer"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {selectedUsers.length > 3 && (
              <span className="text-[11px] text-ink-500 px-1">
                +{selectedUsers.length - 3}
              </span>
            )}
          </>
        )}
      </div>

      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}

      {/* Panel */}
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: Math.max(position.width, 320),
              maxHeight: `${maxHeight}px`,
            }}
            className="z-[100] bg-white border border-ink-200 rounded-lg shadow-xl overflow-hidden"
          >
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
                  placeholder="Rechercher..."
                  className="w-full h-8 pl-8 pr-2 text-[12px] bg-ink-50 border border-ink-200 rounded
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                />
              </div>
            </div>

            <div
              className="overflow-y-auto py-1"
              style={{
                maxHeight: `${Math.max(120, maxHeight - 100)}px`,
              }}
            >
              {filtered.length === 0 ? (
                <p className="text-[12px] text-ink-400 text-center py-6">
                  Aucun utilisateur trouvé.
                </p>
              ) : (
                filtered.map((u) => {
                  const isSelected = value.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-brand-50'
                          : 'hover:bg-ink-50'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-brand-500 border-brand-500'
                            : 'border-ink-300'
                        }`}
                      >
                        {isSelected && (
                          <Check size={10} className="text-white" />
                        )}
                      </div>
                      <Avatar name={u.nom_complet} size="xs" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium text-ink-900 truncate">
                          {u.nom_complet}
                        </div>
                        <div className="text-[10px] text-ink-500 truncate">
                          {u.role_display}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <div className="px-3 py-1.5 border-t border-ink-100 bg-ink-50/40 text-[10px] text-ink-500 flex items-center justify-between">
              <span>
                {value.length} sélectionné{value.length > 1 ? 's' : ''}
              </span>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-brand-600 hover:text-brand-700 font-medium"
                >
                  Tout effacer
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}