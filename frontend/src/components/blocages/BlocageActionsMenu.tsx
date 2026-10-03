/**
 * Menu d'actions pour un blocage + action rapide "Résoudre".
 */

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Eye, Pencil, ShieldAlert, Trash2 } from 'lucide-react'
import DropdownMenu, { DropdownMenuItem } from '../ui/DropdownMenu'
import Button from '../ui/Button'
import ConfirmDialog from '../communs/ConfirmDialog'
import BlocageEditModal from './BlocageEditModal'
import {
  deleteBlocage,
  remonterBlocage,
  resoudreBlocage,
} from '../../api/blocages'
import { useToast } from '../../context/ToastContext'
import type { Blocage } from '../../types'

interface QuickAction {
  label: string
  icon: ReactNode
  onClick: () => void
}

interface BlocageActionsMenuProps {
  blocage: Blocage
  isRowHovered?: boolean
}

export default function BlocageActionsMenu({
  blocage,
  isRowHovered = false,
}: BlocageActionsMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blocages'] })
    queryClient.invalidateQueries({ queryKey: ['blocage', blocage.id] })
    queryClient.invalidateQueries({ queryKey: ['taches'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const resoudreMutation = useMutation({
    mutationFn: () => resoudreBlocage(blocage.id),
    onSuccess: () => {
      invalidate()
      showToast('Blocage résolu', 'success')
    },
    onError: () => {
      showToast('Impossible de résoudre le blocage', 'error')
    },
  })

  const remonterMutation = useMutation({
    mutationFn: () => remonterBlocage(blocage.id),
    onSuccess: () => {
      invalidate()
      showToast('Blocage remonté au Directeur', 'success')
    },
    onError: () => {
      showToast('Impossible de remonter le blocage', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBlocage(blocage.id),
    onSuccess: () => {
      invalidate()
      setIsDeleteOpen(false)
      showToast('Blocage supprimé', 'success')
    },
    onError: () => {
      showToast('Impossible de supprimer le blocage', 'error')
    },
  })

  const estResolu = blocage.statut === 'RESOLU'
  const estRemonte = blocage.statut === 'REMONTE_AU_DIRECTEUR'

  const quickAction: QuickAction | null = !estResolu
    ? {
        label: 'Résoudre',
        icon: <CheckCircle size={12} />,
        onClick: () => resoudreMutation.mutate(),
      }
    : null

  const items: DropdownMenuItem[] = [
    {
      label: 'Voir les détails',
      icon: <Eye size={14} />,
      onClick: () => navigate(`/blocages/${blocage.id}`),
    },
    {
      label: 'Modifier',
      icon: <Pencil size={14} />,
      onClick: () => setIsEditOpen(true),
    },
    ...(!estResolu
      ? [
          {
            label: 'Résoudre',
            icon: <CheckCircle size={14} />,
            onClick: () => resoudreMutation.mutate(),
            separator: true,
          } as DropdownMenuItem,
        ]
      : []),
    ...(!estResolu && !estRemonte
      ? [
          {
            label: 'Remonter au Directeur',
            icon: <ShieldAlert size={14} />,
            onClick: () => remonterMutation.mutate(),
          } as DropdownMenuItem,
        ]
      : []),
    {
      label: 'Supprimer',
      icon: <Trash2 size={14} />,
      onClick: () => setIsDeleteOpen(true),
      variant: 'danger',
      separator: true,
    },
  ]

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        {quickAction && (
          <Button
            size="sm"
            variant="success"
            onClick={(e) => {
              e.stopPropagation()
              quickAction.onClick()
            }}
            disabled={resoudreMutation.isPending}
            leftIcon={quickAction.icon}
            className={`transition-opacity mr-0.5 whitespace-nowrap ${
              isRowHovered || resoudreMutation.isPending
                ? 'opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
            title={quickAction.label}
          >
            {resoudreMutation.isPending ? '...' : quickAction.label}
          </Button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsEditOpen(true)
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          aria-label="Modifier"
          title="Modifier"
        >
          <Pencil size={14} />
        </button>

        <DropdownMenu items={items} />
      </div>

      <BlocageEditModal
        isOpen={isEditOpen}
        blocage={blocage}
        onClose={() => setIsEditOpen(false)}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Supprimer le blocage"
        message={`Vous allez supprimer le blocage sur « ${blocage.tache_detail.titre} ». Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  )
}