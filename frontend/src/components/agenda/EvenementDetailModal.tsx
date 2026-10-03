/**
 * Modale de détail d'un événement — v5.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  Clock,
  Pencil,
  Trash2,
  User,
  Users,
  XCircle,
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import MotifModal from '../communs/MotifModal'
import ConfirmDialog from '../communs/ConfirmDialog'
import { annulerEvenement, deleteEvenement } from '../../api/evenements'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { Evenement } from '../../types'

interface EvenementDetailModalProps {
  evenement: Evenement | null
  onClose: () => void
  onEdit?: (evenement: Evenement) => void
}

export default function EvenementDetailModal({
  evenement,
  onClose,
  onEdit,
}: EvenementDetailModalProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [isAnnulationModalOpen, setIsAnnulationModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['evenements'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const annulerMutation = useMutation({
    mutationFn: (motif: string) =>
      evenement ? annulerEvenement(evenement.id, motif) : Promise.reject(),
    onSuccess: () => {
      invalidate()
      setIsAnnulationModalOpen(false)
      showToast('Événement annulé', 'success')
      onClose()
    },
    onError: () => showToast("Impossible d'annuler", 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvenement(id),
    onSuccess: () => {
      invalidate()
      showToast('Événement supprimé', 'success')
      onClose()
    },
    onError: () => showToast('Impossible de supprimer', 'error'),
  })

  if (!evenement) return null

  const estCreateur = user?.id === evenement.createur
  const estDirecteur = user?.role === 'DIRECTEUR'
  const estSecretaire = user?.role === 'SECRETAIRE_DIRECTION'
  const peutSupprimer = estCreateur || estDirecteur || estSecretaire
  const isDirection = evenement.niveau_priorite === 'DIRECTION'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg my-8">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-semibold text-ink-900 leading-tight">
              {evenement.titre}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                  isDirection
                    ? 'bg-danger-bg text-danger border-danger-border'
                    : 'bg-info-bg text-info border-info-border'
                }`}
              >
                {evenement.niveau_priorite_display}
              </span>
              <span className="text-[11px] text-ink-500">
                {evenement.type_display}
              </span>
              {evenement.statut === 'ANNULE' && (
                <span className="text-[10px] font-semibold uppercase text-ink-500 bg-ink-100 px-2 py-0.5 rounded-full">
                  Annulé
                </span>
              )}
            </div>
          </div>
        </div>

        {evenement.description && (
          <p className="text-[12.5px] text-ink-600 leading-relaxed mb-4 whitespace-pre-wrap">
            {evenement.description}
          </p>
        )}

        {/* Détails */}
        <div className="border-t border-ink-100 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium mb-1 flex items-center gap-1">
                <Calendar size={10} />
                Début
              </div>
              <div className="text-[12px] text-ink-800 tabular-nums">
                {new Date(evenement.date_debut).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium mb-1 flex items-center gap-1">
                <Clock size={10} />
                Fin
              </div>
              <div className="text-[12px] text-ink-800 tabular-nums">
                {new Date(evenement.date_fin).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium mb-1 flex items-center gap-1">
              <User size={10} />
              Créé par
            </div>
            <div className="flex items-center gap-2">
              <Avatar name={evenement.createur_detail.nom_complet} size="xs" />
              <span className="text-[12px] text-ink-800">
                {evenement.createur_detail.nom_complet}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium mb-1 flex items-center gap-1">
              <Users size={10} />
              Participants ({evenement.participants_detail.length})
            </div>
            {evenement.participants_detail.length === 0 ? (
              <span className="text-[11px] text-ink-400 italic">Aucun</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {evenement.participants_detail.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-2 py-0.5 bg-ink-50 border border-ink-100 rounded-full"
                  >
                    <Avatar name={p.nom_complet} size="xs" />
                    <span className="text-[11px] text-ink-700">
                      {p.nom_complet}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-ink-100">
          <div className="flex gap-1.5">
            {onEdit && evenement.statut !== 'ANNULE' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(evenement)}
                leftIcon={<Pencil size={12} />}
              >
                Modifier
              </Button>
            )}
            {evenement.statut !== 'ANNULE' && peutSupprimer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAnnulationModalOpen(true)}
                leftIcon={<XCircle size={12} />}
              >
                Annuler
              </Button>
            )}
            {peutSupprimer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
                leftIcon={<Trash2 size={12} />}
                className="text-danger hover:bg-danger-bg"
              >
                Supprimer
              </Button>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </Card>

      <MotifModal
        isOpen={isAnnulationModalOpen}
        title="Annuler l'événement"
        description={`Vous allez annuler « ${evenement.titre} ».`}
        confirmLabel="Annuler l'événement"
        isPending={annulerMutation.isPending}
        onConfirm={(motif) => annulerMutation.mutate(motif)}
        onCancel={() => setIsAnnulationModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Supprimer l'événement"
        message="Cette action est irréversible. Confirmer la suppression ?"
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(evenement.id, {
            onSuccess: () => setIsDeleteDialogOpen(false),
          })
        }}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  )
}