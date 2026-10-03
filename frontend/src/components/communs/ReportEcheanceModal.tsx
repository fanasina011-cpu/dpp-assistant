/**
 * Modale de report d'échéance avec motif obligatoire.
 */

import { FormEvent, useEffect, useState } from 'react'
import { AlertCircle, Calendar } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import { formatDateTimeLocal } from '../../utils/calendrier'

interface ReportEcheanceModalProps {
  isOpen: boolean
  titreEntite: string
  dateActuelle: string | null
  isPending?: boolean
  onConfirm: (dateEcheance: string, motif: string) => void
  onCancel: () => void
}

export default function ReportEcheanceModal({
  isOpen,
  titreEntite,
  dateActuelle,
  isPending = false,
  onConfirm,
  onCancel,
}: ReportEcheanceModalProps) {
  const [nouvelleDate, setNouvelleDate] = useState('')
  const [motif, setMotif] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (dateActuelle) {
        setNouvelleDate(dateActuelle.slice(0, 16))
      } else {
        const demain = new Date()
        demain.setDate(demain.getDate() + 1)
        setNouvelleDate(formatDateTimeLocal(demain))
      }
      setMotif('')
      setError(null)
    }
  }, [isOpen, dateActuelle])

  if (!isOpen) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!nouvelleDate) {
      setError('La nouvelle date est obligatoire.')
      return
    }
    if (motif.trim().length < 10) {
      setError('Le motif doit contenir au moins 10 caractères.')
      return
    }

    const dateIso = new Date(nouvelleDate).toISOString().slice(0, 19)
    onConfirm(dateIso, motif.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        {/* En-tête */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-warning-bg text-warning flex items-center justify-center shrink-0">
            <Calendar size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-ink-900">
              Reporter l'échéance
            </h3>
            <p className="text-[11px] text-ink-500 mt-0.5 truncate">
              {titreEntite}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date actuelle (info) */}
          {dateActuelle && (
            <div className="bg-ink-50 border border-ink-200 rounded-md px-3 py-2 flex items-center gap-2 text-[12px]">
              <span className="text-ink-500">Échéance actuelle :</span>
              <span className="text-ink-800 font-medium tabular-nums">
                {new Date(dateActuelle).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          <Input
            label="Nouvelle échéance *"
            type="datetime-local"
            required
            value={nouvelleDate}
            onChange={(e) => setNouvelleDate(e.target.value)}
          />

          <div>
            <label className="block text-[12px] font-medium text-ink-700 mb-1">
              Motif du report *
            </label>
            <textarea
              rows={3}
              required
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full px-3 py-2 border border-ink-200 rounded-md text-[13px]
                         focus:outline-none focus:ring-2 focus:ring-brand-500
                         focus:border-brand-400 transition-colors resize-none"
              placeholder="Expliquez pourquoi l'échéance est reportée (min. 10 caractères)..."
            />
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
            <Button type="button" variant="ghost" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="warning"
              disabled={
                isPending || motif.trim().length < 10 || !nouvelleDate
              }
            >
              {isPending ? 'Report...' : 'Reporter'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}