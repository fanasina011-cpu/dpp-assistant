import { ReactNode, useEffect, useRef, useState } from 'react'
import { Calendar, Check, X } from 'lucide-react'

interface MetaDatePickerProps {
  icon: ReactNode
  label: string
  value: string | null
  onChange: (isoDate: string) => void
  disabled?: boolean
  dateOnly?: boolean
}

function toInputValue(iso: string | null, dateOnly: boolean): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (dateOnly) return ymd
  return `${ymd}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MetaDatePicker({
  icon,
  label,
  value,
  onChange,
  disabled,
  dateOnly = false,
}: MetaDatePickerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleStart = () => {
    if (disabled) return
    setTempValue(toInputValue(value, dateOnly))
    setIsEditing(true)
  }

  const handleSave = () => {
    if (!tempValue) {
      setIsEditing(false)
      return
    }
    const isoValue = dateOnly ? `${tempValue}T00:00:00` : tempValue
    onChange(isoValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setTempValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  const displayValue = value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 px-2 py-2 rounded-md transition-colors">
        <span className="text-ink-400 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium">
            {label}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-1 mt-1">
              <input
                ref={inputRef}
                type={dateOnly ? 'date' : 'datetime-local'}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-0 px-2 py-1 border border-brand-300 rounded text-[12px]
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              />
              <button
                type="button"
                onClick={handleSave}
                className="w-6 h-6 flex items-center justify-center rounded text-success hover:bg-success-bg transition-colors shrink-0"
                aria-label="Valider"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:bg-ink-100 transition-colors shrink-0"
                aria-label="Annuler"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={disabled}
              className={`text-[12.5px] font-medium truncate mt-0.5 text-left w-full transition-colors ${
                displayValue
                  ? 'text-ink-900 hover:text-brand-600'
                  : 'text-ink-400 italic hover:text-ink-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {displayValue || 'Non définie'}
            </button>
          )}
        </div>

        {!isEditing && (
          <Calendar
            size={13}
            className="text-ink-300 shrink-0 cursor-pointer"
            onClick={handleStart}
          />
        )}
      </div>
    </div>
  )
}