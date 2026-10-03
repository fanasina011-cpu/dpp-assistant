/**
 * Modale générique de demande de motif (≥ 10 caractères).
 * Utilisée pour toutes les actions qui requièrent un motif obligatoire.
 */

import { FormEvent, useEffect, useState } from 'react'
import { AlertCircle, MessageSquare } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

interface MotifModalProps {
  isOpen: boolean
  title: string
  description?: string
  placeholder?: string
  confirmLabel?: string
  isPending?: boolean
  variant?: 'primary' | 'danger' | 'warning'
  onConfirm: (motif: string) => void
  onCancel: () => void
}

export default function MotifModal({
  isOpen,
  title,
  description,
  placeholder = 'Expliquez la raison (min. 10 caractères)...',
  confirmLabel = 'Confirmer',
  isPending = false,
  variant = 'primary',
  onConfirm,
  onCancel,
}: MotifModalProps) {
  const [motif, setMotif] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setMotif('')
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (motif.trim().length < 10) {
      setError('Le motif doit contenir au moins 10 caractères.')
      return
    }

    onConfirm(motif.trim())
  }

  const handleClose = () => {
    setMotif('')
    setError(null)
    onCancel()
  }

  const iconBg =
    variant === 'danger'
      ? 'bg-danger-bg text-danger'
      : variant === 'warning'
        ? 'bg-warning-bg text-warning'
        : 'bg-brand-50 text-brand-600'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        {/* En-tête */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
          >
            <MessageSquare size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-ink-900">{title}</h3>
            {description && (
              <p className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-ink-700 mb-1">
              Motif *
            </label>
            <textarea
              rows={4}
              required
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full px-3 py-2 border border-ink-200 rounded-md text-[13px]
                         focus:outline-none focus:ring-2 focus:ring-brand-500
                         focus:border-brand-400 transition-colors resize-none"
              placeholder={placeholder}
            />
            {/* Compteur */}
            <div className="flex items-center justify-between mt-1">
              <span
                className={`text-[10px] ${
                  motif.trim().length >= 10 ? 'text-success' : 'text-ink-400'
                }`}
              >
                {motif.trim().length} / 10 caractères minimum
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-danger-bg border border-danger-border text-danger text-[12px] rounded-md p-3 flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant={variant}
              disabled={isPending || motif.trim().length < 10}
            >
              {isPending ? 'Traitement...' : confirmLabel}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}