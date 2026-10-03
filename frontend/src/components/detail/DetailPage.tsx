/**
 * Layout standard pour une page détail.
 */

import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface DetailPageProps {
  breadcrumb: { label: string; to: string }
  title: string
  badges?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  sidebar: ReactNode
  children: ReactNode
}

export default function DetailPage({
  breadcrumb,
  title,
  badges,
  subtitle,
  actions,
  sidebar,
  children,
}: DetailPageProps) {
  return (
    <div className="space-y-5">
      <Link
        to={breadcrumb.to}
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-800 transition-colors"
      >
        <ArrowLeft size={13} />
        {breadcrumb.label}
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[24px] font-semibold text-ink-900 leading-tight">
              {title}
            </h1>
            {badges}
          </div>
          {subtitle && (
            <div className="text-[13px] text-ink-500 mt-1.5">{subtitle}</div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-6">
        <div className="space-y-5 min-w-0">{children}</div>
        <aside className="lg:sticky lg:top-4 lg:self-start space-y-5">
          {sidebar}
        </aside>
      </div>
    </div>
  )
}