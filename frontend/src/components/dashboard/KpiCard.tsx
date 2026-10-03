/**
 * Carte KPI v2 — icône lucide dans un rond coloré, valeur large,
 * lien cliquable, hover subtil.
 */

import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

type Color = 'red' | 'orange' | 'purple' | 'blue' | 'green' | 'slate' | 'brand'

interface KpiCardProps {
  label: string
  value: number
  to: string
  color?: Color
  icon: ReactNode
  hint?: string
}

const STYLES: Record<
  Color,
  { iconBg: string; iconText: string; accent: string }
> = {
  red: {
    iconBg: 'bg-danger-bg',
    iconText: 'text-danger',
    accent: 'group-hover:border-danger-border',
  },
  orange: {
    iconBg: 'bg-orange-50',
    iconText: 'text-orange-600',
    accent: 'group-hover:border-orange-200',
  },
  purple: {
    iconBg: 'bg-purple-50',
    iconText: 'text-purple-600',
    accent: 'group-hover:border-purple-200',
  },
  blue: {
    iconBg: 'bg-info-bg',
    iconText: 'text-info',
    accent: 'group-hover:border-info-border',
  },
  green: {
    iconBg: 'bg-success-bg',
    iconText: 'text-success',
    accent: 'group-hover:border-success-border',
  },
  slate: {
    iconBg: 'bg-ink-100',
    iconText: 'text-ink-600',
    accent: 'group-hover:border-ink-300',
  },
  brand: {
    iconBg: 'bg-brand-50',
    iconText: 'text-brand-600',
    accent: 'group-hover:border-brand-200',
  },
}

export default function KpiCard({
  label,
  value,
  to,
  color = 'slate',
  icon,
  hint,
}: KpiCardProps) {
  const style = STYLES[color]
  const isZero = value === 0

  return (
    <Link
      to={to}
      className={`group block bg-white border border-ink-200 rounded-lg p-4 transition-all hover:shadow-sm ${style.accent}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-ink-500 mb-1 truncate">{label}</p>
          <p
            className={`text-[26px] font-semibold leading-none tracking-tight ${
              isZero ? 'text-ink-400' : 'text-ink-900'
            }`}
          >
            {value}
          </p>
          {hint && (
            <p className="text-[11px] text-ink-400 mt-1.5">{hint}</p>
          )}
        </div>

        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.iconBg} ${style.iconText}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 text-[11px] text-ink-400 group-hover:text-brand-600 transition-colors">
        <span>Voir</span>
        <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}