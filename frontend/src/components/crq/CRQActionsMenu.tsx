/**
 * Menu d'actions pour un CRQ.
 * - Demander réouverture (auteur + clôturé + pas de demande en attente)
 * - Valider / Refuser la demande (Chef ou Directeur, si demande en attente)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Eye, Unlock, X } from 'lucide-react'
import DropdownMenu, { DropdownMenuItem } from '../ui/DropdownMenu'
import MotifModal from '../communs/MotifModal'
import {
  demanderReouverture,
  refuserDemande,
  validerDemande,
} from '../../api/crq'
import { useToast } from '../../context/ToastContext'
import { extractErrorMessage } from '../../utils/errors'
import type { CompteRenduQuotidien } from '../../types'

interface CRQActionsMenuProps {
  crq: CompteRenduQuotidien
  userId: number
  estChefOuDirecteur: boolean
  /** Remonte l'erreur à la page parente (bandeau). Optionnel. */
  onErreur?: (msg: string) => void
}

export default function CRQActionsMenu({
  crq,
  userId,
  estChefOuDirecteur,
  onErreur,
}: CRQActionsMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [isMotifOpen, setIsMotifOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['crqs'] })
    queryClient.invalidateQueries({ queryKey: ['crq', crq.id] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const demandeMutation = useMutation({
    mutationFn: (motif: string) => demanderReouverture(crq.id, motif),
    onSuccess: () => {
      invalidate()
      setIsMotifOpen(false)
      showToast('Demande de réouverture envoyée', 'success')
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.detail || 'Erreur lors de la demande',
        'error',
      )
      onErreur?.(extractErrorMessage(err))
    },
  })

  const validerMutation = useMutation({
    mutationFn: (demandeId: number) => validerDemande(demandeId),
    onSuccess: () => {
      invalidate()
      showToast('Demande validée', 'success')
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || 'Erreur', 'error')
      onErreur?.(extractErrorMessage(err))
    },
  })

  const refuserMutation = useMutation({
    mutationFn: (demandeId: number) => refuserDemande(demandeId),
    onSuccess: () => {
      invalidate()
      showToast('Demande refusée', 'success')
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || 'Erreur', 'error')
      onErreur?.(extractErrorMessage(err))
    },
  })

  const estAuteur = crq.redacteur === userId
  const demandeEnAttente = crq.demandes_reouverture.find(
    (d) => d.statut === 'EN_ATTENTE',
  )
  const peutDemanderReouverture =
    estAuteur && crq.est_cloture && !demandeEnAttente
  const peutTraiterDemande = estChefOuDirecteur && Boolean(demandeEnAttente)

  const items: DropdownMenuItem[] = [
    {
      label: 'Voir les détails',
      icon: <Eye size={14} />,
      onClick: () => navigate(`/crq/${crq.id}`),
    },
    ...(peutDemanderReouverture
      ? [
          {
            label: 'Demander réouverture',
            icon: <Unlock size={14} />,
            onClick: () => setIsMotifOpen(true),
            separator: true,
          } as DropdownMenuItem,
        ]
      : []),
    ...(peutTraiterDemande && demandeEnAttente
      ? [
          {
            label: 'Valider la demande',
            icon: <Check size={14} />,
            onClick: () => validerMutation.mutate(demandeEnAttente.id),
            separator: true,
          } as DropdownMenuItem,
          {
            label: 'Refuser la demande',
            icon: <X size={14} />,
            onClick: () => refuserMutation.mutate(demandeEnAttente.id),
            variant: 'danger',
          } as DropdownMenuItem,
        ]
      : []),
  ]

  const dateFormatee = new Date(crq.date_journaliere).toLocaleDateString(
    'fr-FR',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    },
  )

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        <DropdownMenu items={items} />
      </div>

      <MotifModal
        isOpen={isMotifOpen}
        title="Demander la réouverture"
        description={`CRQ du ${dateFormatee}. Expliquez pourquoi vous souhaitez le rouvrir.`}
        placeholder="Expliquez pourquoi vous souhaitez rouvrir ce CRQ..."
        confirmLabel="Envoyer la demande"
        variant="warning"
        isPending={demandeMutation.isPending}
        onConfirm={(motif) => demandeMutation.mutate(motif)}
        onCancel={() => setIsMotifOpen(false)}
      />
    </>
  )
}