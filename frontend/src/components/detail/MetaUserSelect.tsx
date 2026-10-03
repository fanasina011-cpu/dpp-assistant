import { ReactNode, useEffect, useRef, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import Avatar from '../ui/Avatar'

interface UserOption {
  id: number
  nom_complet: string
  role_display?: string
}

interface MetaUserSelectProps {
  icon: ReactNode
  label: string
  currentUserId: number | null
  users: UserOption[]
  onChange: (userId: number) => void
  disabled?: boolean
  allowNone?: boolean
}

export default function MetaUserSelect({
  icon,
  label,
  currentUserId,
  users,
  onChange,
  disabled,
  allowNone = false,
}: MetaUserSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [open])

  const currentUser = currentUserId
    ? users.find((u) => u.id === currentUserId)
    : null

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.nom_complet.toLowerCase().includes(q) ||
      u.role_display?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors group ${
          open ? 'bg-ink-50' : 'hover:bg-ink-50'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="text-ink-400 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium">
            {label}
          </div>
          <div className="mt-0.5">
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={currentUser.nom_complet} size="xs" />
                <span className="text-[12.5px] text-ink-900 font-medium truncate">
                  {currentUser.nom_complet}
                </span>
              </div>
            ) : (
              <span className="text-[12px] text-ink-400 italic">
                Non assigné
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          size={13}
          className={`text-ink-300 group-hover:text-ink-500 transition-all shrink-0 ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-ink-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-ink-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              autoFocus
              className="w-full px-2 py-1 text-[12px] border border-ink-200 rounded
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {allowNone && (
              <button
                type="button"
                onClick={() => {
                  onChange(0)
                  setOpen(false)
                  setSearch('')
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-left transition-colors ${
                  !currentUserId
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                <span className="w-5 h-5 rounded-full border border-ink-200 flex items-center justify-center text-ink-400 text-[10px]">
                  —
                </span>
                <span className="flex-1 italic">Non assigné</span>
                {!currentUserId && <Check size={13} />}
              </button>
            )}

            {filteredUsers.length === 0 ? (
              <p className="text-[12px] text-ink-400 text-center py-3">
                Aucun utilisateur trouvé.
              </p>
            ) : (
              filteredUsers.map((u) => {
                const isActive = u.id === currentUserId
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (!isActive) onChange(u.id)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-left transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-ink-700 hover:bg-ink-50'
                    }`}
                  >
                    <Avatar name={u.nom_complet} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{u.nom_complet}</div>
                      {u.role_display && (
                        <div className="text-[10px] text-ink-400 truncate">
                          {u.role_display}
                        </div>
                      )}
                    </div>
                    {isActive && <Check size={13} />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}