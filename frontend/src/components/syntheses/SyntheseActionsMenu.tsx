/**
 * Menu d'actions pour une synthèse.
 * Voir détails + Supprimer (Directeur uniquement).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, Trash2 } from 'lucide-react'
import DropdownMenu, { DropdownMenuItem } from '../ui/DropdownMenu'
import ConfirmDialog from '../communs/ConfirmDialog'
import { deleteSynthese } from '../../api/syntheses'
import { useToast } from '../../context/ToastContext'
import { extractErrorMessage } from '../../utils/errors'
import type { Synthese } from '../../types'

interface SyntheseActionsMenuProps {
  synthese: Synthese
  peutSupprimer: boolean
  /** Remonte l'erreur à la page parente (bandeau). Optionnel. */
  onErreur?: (msg: string) => void
}

export default function SyntheseActionsMenu({
  synthese,
  peutSupprimer,
  onErreur,
}: SyntheseActionsMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => deleteSynthese(synthese.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syntheses'] })
      setIsDeleteOpen(false)
      showToast('Synthèse supprimée', 'success')
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.detail || 'Erreur lors de la suppression',
        'error',
      )
      onErreur?.(extractErrorMessage(err))
      setIsDeleteOpen(false)
    },
  })

  const items: DropdownMenuItem[] = [
    {
      label: 'Voir les détails',
      icon: <Eye size={14} />,
      onClick: () => navigate(`/syntheses/${synthese.id}`),
    },
    ...(peutSupprimer
      ? [
          {
            label: 'Supprimer',
            icon: <Trash2 size={14} />,
            onClick: () => setIsDeleteOpen(true),
            variant: 'danger',
            separator: true,
          } as DropdownMenuItem,
        ]
      : []),
  ]

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        <DropdownMenu items={items} />
      </div>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Supprimer la synthèse"
        message={`Vous allez supprimer la synthèse ${synthese.type_display} du ${new Date(synthese.periode_debut).toLocaleDateString('fr-FR')}. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  )
}