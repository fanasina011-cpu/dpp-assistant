/**
 * Modale de purge d'historique.
 * Réservé au Directeur.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import { purgerHistorique } from '../../api/historique'
import { useToast } from '../../context/ToastContext'

interface PurgeHistoriqueModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PurgeHistoriqueModal({
  isOpen,
  onClose,
}: PurgeHistoriqueModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  // Par défaut : 6 mois en arrière
  const defaultDate = new Date()
  defaultDate.setMonth(defaultDate.getMonth() - 6)
  const [avantDate, setAvantDate] = useState(
    defaultDate.toISOString().split('T')[0],
  )
  const [isConfirm, setIsConfirm] = useState(false)

  const purgeMutation = useMutation({
    mutationFn: () => purgerHistorique(avantDate),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['historique'] })
      showToast(data.message, 'success')
      onClose()
      setIsConfirm(false)
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.detail || 'Erreur lors de la purge',
        'error',
      )
    },
  })

  if (!isOpen) return null

  const handleClose = () => {
    setIsConfirm(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        {/* En-tête */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-danger-bg text-danger flex items-center justify-center shrink-0">
            <Trash2 size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">
              Purger l'historique
            </h3>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Supprime définitivement toutes les entrées antérieures à la date
              choisie.
            </p>
          </div>
        </div>

        {/* Avertissement */}
        <div className="bg-danger-bg border border-danger-border rounded-md p-3 flex items-start gap-2 mb-4">
          <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
          <p className="text-[11px] text-danger leading-relaxed">
            Cette action est <strong>irréversible</strong>. Toutes les traces
            d'actions antérieures à la date choisie seront perdues.
          </p>
        </div>

        {/* Date */}
        <Input
          label="Supprimer l'historique antérieur au"
          type="date"
          value={avantDate}
          onChange={(e) => setAvantDate(e.target.value)}
          disabled={isConfirm}
        />

        {/* Confirmation */}
        {isConfirm && (
          <div className="mt-4 bg-warning-bg border border-warning-border rounded-md p-3">
            <p className="text-[12px] text-ink-800 leading-relaxed">
              Confirmer la purge de tout l'historique avant le{' '}
              <strong>
                {new Date(avantDate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>{' '}
              ?
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-ink-100">
          <Button variant="ghost" onClick={handleClose}>
            Annuler
          </Button>
          {!isConfirm ? (
            <Button
              variant="danger"
              onClick={() => setIsConfirm(true)}
              disabled={!avantDate}
            >
              Continuer
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => purgeMutation.mutate()}
              disabled={purgeMutation.isPending}
            >
              {purgeMutation.isPending
                ? 'Purge en cours...'
                : 'Confirmer la purge'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}