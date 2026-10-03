/**
 * KPI Statistique v3 — chiffre + delta + tendance + sparkline optionnelle.
 * Pensé pour un dashboard pro type Linear/Vercel.
 *
 * Props :
 *   - label : texte descriptif
 *   - value : valeur principale
 *   - delta : variation (ex: +3, -5, 0). Positif = ↑, négatif = ↓
 *   - deltaLabel : texte après le delta ("cette semaine", "vs hier")
 *   - invertDelta : true si une baisse est bonne (ex: tâches en retard)
 *   - to : lien cliquable
 *   - icon : icône lucide
 *   - color : couleur d'accent
 *   - suffix : "%" par exemple
 */

import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react'

type Color = 'danger' | 'warning' | 'success' | 'info' | 'brand' | 'neutral'

interface KpiStatProps {
  label: string
  value: number | string
  to?: string
  icon?: ReactNode
  color?: Color
  delta?: number
  deltaLabel?: string
  invertDelta?: boolean
  suffix?: string
  hint?: string
}

const COLORS: Record<
  Color,
  { iconBg: string; iconText: string; accent: string }
> = {
  danger: {
    iconBg: 'bg-danger-bg',
    iconText: 'text-danger',
    accent: 'text-danger',
  },
  warning: {
    iconBg: 'bg-warning-bg',
    iconText: 'text-warning',
    accent: 'text-warning',
  },
  success: {
    iconBg: 'bg-success-bg',
    iconText: 'text-success',
    accent: 'text-success',
  },
  info: {
    iconBg: 'bg-info-bg',
    iconText: 'text-info',
    accent: 'text-info',
  },
  brand: {
    iconBg: 'bg-brand-50',
    iconText: 'text-brand-600',
    accent: 'text-brand-600',
  },
  neutral: {
    iconBg: 'bg-ink-100',
    iconText: 'text-ink-600',
    accent: 'text-ink-600',
  },
}

function DeltaIndicator({
  delta,
  invertDelta,
  deltaLabel,
}: {
  delta: number
  invertDelta: boolean
  deltaLabel?: string
}) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
        <Minus size={11} />
        <span>stable</span>
        {deltaLabel && <span className="text-ink-400">· {deltaLabel}</span>}
      </span>
    )
  }

  // Détermine si c'est "positif" ou "négatif" du point de vue métier
  const isUp = delta > 0
  const isPositiveOutcome = invertDelta ? !isUp : isUp

  const colorClass = isPositiveOutcome ? 'text-success' : 'text-danger'
  const Icon = isUp ? ArrowUp : ArrowDown
  const sign = isUp ? '+' : ''

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${colorClass}`}
    >
      <Icon size={11} />
      <span>
        {sign}
        {delta}
      </span>
      {deltaLabel && (
        <span className="text-ink-400 font-normal">· {deltaLabel}</span>
      )}
    </span>
  )
}

export default function KpiStat({
  label,
  value,
  to,
  icon,
  color = 'neutral',
  delta,
  deltaLabel,
  invertDelta = false,
  suffix,
  hint,
}: KpiStatProps) {
  const style = COLORS[color]
  const isZero = value === 0
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-ink-500 mb-1.5 truncate">{label}</p>
          <div className="flex items-baseline gap-1">
            <p
              className={`text-[28px] font-semibold leading-none tracking-tight tabular-nums ${
                isZero ? 'text-ink-400' : 'text-ink-900'
              }`}
            >
              {value}
            </p>
            {suffix && (
              <span className="text-[14px] text-ink-400 font-medium">
                {suffix}
              </span>
            )}
          </div>
        </div>

        {icon && (
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.iconBg} ${style.iconText}`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Ligne 2 : delta ou hint */}
      {(typeof delta === 'number' || hint) && (
        <div className="mt-2.5 flex items-center gap-2">
          {typeof delta === 'number' && (
            <DeltaIndicator
              delta={delta}
              invertDelta={invertDelta}
              deltaLabel={deltaLabel}
            />
          )}
          {!delta && hint && (
            <span className="text-[11px] text-ink-400">{hint}</span>
          )}
        </div>
      )}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="group block bg-white border border-ink-200 rounded-lg p-4 transition-all hover:shadow-sm hover:border-ink-300"
      >
        {content}
        <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Voir détail</span>
          <ArrowRight size={11} />
        </div>
      </Link>
    )
  }

  return (
    <div className="bg-white border border-ink-200 rounded-lg p-4">
      {content}
    </div>
  )
}