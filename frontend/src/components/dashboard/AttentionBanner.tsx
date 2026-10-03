/**
 * Bandeau d'attention en haut du dashboard.
 * Affiche 0, 1 ou plusieurs alertes avec icône + texte + lien d'action.
 *
 * Variantes :
 *   - danger : rouge, action critique
 *   - warning : orange, action recommandée
 *   - success : vert, tout va bien
 *   - info : bleu, information
 */

import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react'

type Variant = 'danger' | 'warning' | 'success' | 'info'

export interface AttentionItem {
  id: string
  label: string
  count?: number
  to: string
  variant?: Variant // override par item, sinon hérite du parent
}

interface AttentionBannerProps {
  variant?: Variant
  title?: string
  message?: string
  items?: AttentionItem[]
}

const STYLES: Record<
  Variant,
  {
    bg: string
    border: string
    text: string
    icon: ReactNode
    iconColor: string
  }
> = {
  danger: {
    bg: 'bg-danger-bg',
    border: 'border-danger-border',
    text: 'text-danger',
    icon: <AlertCircle size={18} />,
    iconColor: 'text-danger',
  },
  warning: {
    bg: 'bg-warning-bg',
    border: 'border-warning-border',
    text: 'text-warning',
    icon: <AlertTriangle size={18} />,
    iconColor: 'text-warning',
  },
  success: {
    bg: 'bg-success-bg',
    border: 'border-success-border',
    text: 'text-success',
    icon: <CheckCircle2 size={18} />,
    iconColor: 'text-success',
  },
  info: {
    bg: 'bg-info-bg',
    border: 'border-info-border',
    text: 'text-info',
    icon: <Info size={18} />,
    iconColor: 'text-info',
  },
}

function ItemIcon({ variant }: { variant: Variant }) {
  if (variant === 'danger') return <AlertCircle size={14} />
  if (variant === 'warning') return <AlertTriangle size={14} />
  if (variant === 'success') return <CheckCircle2 size={14} />
  return <Info size={14} />
}

export default function AttentionBanner({
  variant = 'info',
  title,
  message,
  items,
}: AttentionBannerProps) {
  const style = STYLES[variant]

  return (
    <div className={`rounded-lg border ${style.bg} ${style.border} p-4`}>
      {/* En-tête */}
      {(title || message) && (
        <div className="flex items-start gap-3">
          <div className={style.iconColor}>{style.icon}</div>
          <div className="flex-1 min-w-0">
            {title && (
              <p className={`text-[14px] font-semibold ${style.text}`}>
                {title}
              </p>
            )}
            {message && (
              <p className="text-[12px] text-ink-600 mt-0.5">{message}</p>
            )}
          </div>
        </div>
      )}

      {/* Items cliquables */}
      {items && items.length > 0 && (
        <ul className={`space-y-1 ${title || message ? 'mt-3' : ''}`}>
          {items.map((item) => {
            const itemVariant = item.variant || variant
            const itemStyle = STYLES[itemVariant]
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 bg-white/60 hover:bg-white transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={itemStyle.iconColor}>
                      <ItemIcon variant={itemVariant} />
                    </span>
                    <span className="text-[13px] text-ink-800 truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {typeof item.count === 'number' && (
                      <span
                        className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${itemStyle.bg} ${itemStyle.text}`}
                      >
                        {item.count}
                      </span>
                    )}
                    <ArrowRight
                      size={13}
                      className="text-ink-400 group-hover:text-ink-700 group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}