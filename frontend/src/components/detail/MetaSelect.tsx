import { ReactNode, useEffect, useRef, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'

interface MetaSelectProps {
  icon: ReactNode
  label: string
  value: ReactNode
  options: { value: string; label: string; icon?: ReactNode }[]
  currentValue: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function MetaSelect({
  icon,
  label,
  value,
  options,
  currentValue,
  onChange,
  disabled,
}: MetaSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
          <div className="text-[12.5px] text-ink-900 font-medium truncate mt-0.5">
            {value}
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
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-ink-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
          {options.map((opt) => {
            const isActive = opt.value === currentValue
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (opt.value !== currentValue) onChange(opt.value)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-left transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-ink-700 hover:bg-ink-50'
                }`}
              >
                {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                <span className="flex-1">{opt.label}</span>
                {isActive && <Check size={13} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}