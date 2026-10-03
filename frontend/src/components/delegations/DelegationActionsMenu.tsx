/**
 * Menu d'actions pour une délégation.
 * Pas de "Modifier" — seulement action rapide "Révoquer" + menu ⋯.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, XCircle } from 'lucide-react'
import DropdownMenu, { DropdownMenuItem } from '../ui/DropdownMenu'
import Button from '../ui/Button'
import ConfirmDialog from '../communs/ConfirmDialog'
import { deleteDelegation, revoquerDelegation } from '../../api/delegations'
import { useToast } from '../../context/ToastContext'
import { extractErrorMessage } from '../../utils/errors'
import type { Delegation } from '../../types'

interface DelegationActionsMenuProps {
  delegation: Delegation
  isRowHovered?: boolean
  /** Remonte l'erreur à la page parente (bandeau). Optionnel. */
  onErreur?: (msg: string) => void
}

export default function DelegationActionsMenu({
  delegation,
  isRowHovered = false,
  onErreur,
}: DelegationActionsMenuProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [confirmAction, setConfirmAction] = useState<
    'revoquer' | 'supprimer' | null
  >(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['delegations'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const revoquerMutation = useMutation({
    mutationFn: () => revoquerDelegation(delegation.id),
    onSuccess: () => {
      invalidate()
      setConfirmAction(null)
      showToast('Délégation révoquée', 'success')
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.detail ||
          'Impossible de révoquer cette délégation',
        'error',
      )
      onErreur?.(extractErrorMessage(err))
      setConfirmAction(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteDelegation(delegation.id),
    onSuccess: () => {
      invalidate()
      setConfirmAction(null)
      showToast('Délégation supprimée', 'success')
    },
    onError: (err: any) => {
      showToast(
        "Vous n'êtes pas autorisé à supprimer cette délégation",
        'error',
      )
      onErreur?.(extractErrorMessage(err))
      setConfirmAction(null)
    },
  })

  const items: DropdownMenuItem[] = [
    ...(delegation.actif
      ? [
          {
            label: 'Révoquer',
            icon: <XCircle size={14} />,
            onClick: () => setConfirmAction('revoquer'),
          } as DropdownMenuItem,
        ]
      : []),
    {
      label: 'Supprimer',
      icon: <Trash2 size={14} />,
      onClick: () => setConfirmAction('supprimer'),
      variant: 'danger',
      separator: delegation.actif,
    },
  ]

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        {delegation.actif && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmAction('revoquer')
            }}
            leftIcon={<XCircle size={12} />}
            className={`transition-opacity mr-0.5 whitespace-nowrap text-orange-600 hover:bg-orange-50 ${
              isRowHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title="Révoquer"
          >
            Révoquer
          </Button>
        )}

        <DropdownMenu items={items} />
      </div>

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={
          confirmAction === 'revoquer'
            ? 'Révoquer la délégation'
            : 'Supprimer la délégation'
        }
        message={
          confirmAction === 'revoquer'
            ? 'Le délégataire perdra immédiatement ses droits délégués.'
            : 'Cette action est irréversible.'
        }
        confirmLabel={confirmAction === 'revoquer' ? 'Révoquer' : 'Supprimer'}
        variant={confirmAction === 'revoquer' ? 'warning' : 'danger'}
        isPending={revoquerMutation.isPending || deleteMutation.isPending}
        onConfirm={() => {
          if (confirmAction === 'revoquer') revoquerMutation.mutate()
          else if (confirmAction === 'supprimer') deleteMutation.mutate()
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  )
}