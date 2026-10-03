/**
 * Carte blanche avec ombre subtile.
 *
 * Variantes d'élévation :
 *   - flat    : pas d'ombre (pour cartes imbriquées)
 *   - default : ombre subtile (défaut)
 *   - raised  : ombre moyenne (pour éléments mis en avant)
 */

import { ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  noPadding?: boolean
  elevation?: 'flat' | 'default' | 'raised'
}

export default function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  noPadding = false,
  elevation = 'default',
}: CardProps) {
  const elevationClass =
    elevation === 'flat'
      ? 'border border-ink-200'
      : elevation === 'raised'
        ? 'shadow-md border border-ink-200/50'
        : 'shadow-sm border border-ink-200/60'

  return (
    <div className={`bg-white rounded-lg ${elevationClass} ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-ink-100">
          <div className="min-w-0">
            {title && (
              <h3 className="font-semibold text-ink-900 text-[15px] leading-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  )
}