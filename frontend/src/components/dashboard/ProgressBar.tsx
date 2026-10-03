/**
 * Barre de progression horizontale avec label et valeur.
 * Utilisée pour : avancement d'activités, charge d'équipe, etc.
 */

import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Color = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface ProgressBarProps {
  label: string
  value: number
  max?: number // défaut 100
  color?: Color
  to?: string
  hint?: string
  icon?: ReactNode
}

const COLORS: Record<Color, string> = {
  brand: 'bg-brand-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-ink-500',
}

const COLORS_TEXT: Record<Color, string> = {
  brand: 'text-brand-600',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-ink-600',
}

export default function ProgressBar({
  label,
  value,
  max = 100,
  color = 'brand',
  to,
  hint,
  icon,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  const content = (
    <>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="text-ink-400 shrink-0">{icon}</span>}
          <span className="text-[12px] text-ink-800 truncate font-medium">
            {label}
          </span>
        </div>
        <span className={`text-[11px] font-semibold tabular-nums shrink-0 ${COLORS_TEXT[color]}`}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${COLORS[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && (
        <p className="text-[10px] text-ink-400 mt-1">{hint}</p>
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} className="block group">
        <div className="group-hover:opacity-90 transition-opacity">
          {content}
        </div>
      </Link>
    )
  }

  return <div>{content}</div>
}