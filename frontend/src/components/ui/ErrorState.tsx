/**
 * État d'erreur standardisé.
 *
 * Compatible Axios : lit error.response.status / error.response.data.detail.
 * - 403 → Accès refusé (pas de retry)
 * - 404 → Ressource introuvable (pas de retry)
 * - 500 / network / timeout → Erreur de connexion (bouton Réessayer)
 */

import type { ReactNode } from 'react'
import { AlertCircle, FileX2, RefreshCw, ShieldX } from 'lucide-react'
import Button from './Button'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  title?: string
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const e = error as any
    return e.response?.status ?? e.status
  }
  return undefined
}

function getDetail(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null) {
    const e = error as any
    return e.response?.data?.detail
  }
  return undefined
}

function getErrorInfo(error: unknown): {
  icon: ReactNode
  title: string
  showRetry: boolean
} {
  const status = getStatus(error)

  if (status === 403) {
    return {
      icon: <ShieldX className="text-ink-400" size={32} strokeWidth={1.5} />,
      title: 'Accès refusé',
      showRetry: false,
    }
  }
  if (status === 404) {
    return {
      icon: <FileX2 className="text-ink-400" size={32} strokeWidth={1.5} />,
      title: 'Ressource introuvable',
      showRetry: false,
    }
  }

  return {
    icon: <AlertCircle className="text-danger" size={32} strokeWidth={1.5} />,
    title: 'Erreur de connexion',
    showRetry: true,
  }
}

export default function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const info = getErrorInfo(error)
  const detail = getDetail(error)

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
      {info.icon}
      <p className="text-sm font-medium text-ink-700">{title || info.title}</p>
      {detail && <p className="text-xs text-ink-500 max-w-sm">{detail}</p>}
      {info.showRetry && onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={14} />}>
          Réessayer
        </Button>
      )}
    </div>
  )
}
