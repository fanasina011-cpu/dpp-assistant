/**
 * Bouton d'action rapide (Clôturer) + Modifier (✏️) + menu ⋯.
 * Menu et boutons filtrés selon les permissions.
 */

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CheckCircle,
  Eye,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react'
import DropdownMenu, { DropdownMenuItem } from '../ui/DropdownMenu'
import Button from '../ui/Button'
import ConfirmDialog from '../communs/ConfirmDialog'
import MotifModal from '../communs/MotifModal'
import ReportEcheanceModal from '../communs/ReportEcheanceModal'
import ActiviteFormModal from './ActiviteFormModal'
import {
  annulerActivite,
  cloturerActivite,
  deleteActivite,
  reporterEcheanceActivite,
} from '../../api/activites'
import { useToast } from '../../context/ToastContext'
import { usePermissions } from '../../hooks/usePermissions'
import type { Activite } from '../../types'

interface QuickAction {
  label: string
  icon: ReactNode
  variant: 'success'
  onClick: () => void
}

interface ActiviteActionsMenuProps {
  activite: Activite
  isRowHovered?: boolean
}

export default function ActiviteActionsMenu({
  activite,
  isRowHovered = false,
}: ActiviteActionsMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { can } = usePermissions()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAnnulerOpen, setIsAnnulerOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // ============================================================
  // Permissions contextuelles
  // ============================================================
  const peutModifier = can.editActivite(activite)
  const peutSupprimer = can.deleteActivite(activite)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['activites'] })
    queryClient.invalidateQueries({ queryKey: ['activite', activite.id] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const cloturerMutation = useMutation({
    mutationFn: () => cloturerActivite(activite.id),
    onSuccess: () => {
      invalidate()
      showToast('Activité clôturée', 'success')
    },
    onError: () => {
      showToast("Impossible de clôturer l'activité", 'error')
    },
  })

  const annulerMutation = useMutation({
    mutationFn: (motif: string) => annulerActivite(activite.id, motif),
    onSuccess: () => {
      invalidate()
      setIsAnnulerOpen(false)
      showToast('Activité annulée', 'success')
    },
    onError: () => {
      showToast("Impossible d'annuler l'activité", 'error')
    },
  })

  const reportMutation = useMutation({
    mutationFn: (args: { dateEcheance: string; motif: string }) =>
      reporterEcheanceActivite(activite.id, args.dateEcheance, args.motif),
    onSuccess: () => {
      invalidate()
      setIsReportOpen(false)
      showToast('Échéance reportée', 'success')
    },
    onError: () => {
      showToast("Impossible de reporter l'échéance", 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteActivite(activite.id),
    onSuccess: () => {
      invalidate()
      setIsDeleteOpen(false)
      showToast('Activité supprimée', 'success')
    },
    onError: () => {
      showToast("Impossible de supprimer l'activité", 'error')
    },
  })

  const estCloturee = activite.statut === 'CLOTUREE'
  const estAnnulee = activite.statut === 'ANNULEE'
  const peutEtreCloturee =
    activite.peut_etre_cloturee && !estCloturee && !estAnnulee

  // Action rapide : uniquement si autorisé
  const quickAction: QuickAction | null =
    peutModifier && peutEtreCloturee
      ? {
          label: 'Clôturer',
          icon: <CheckCircle size={12} />,
          variant: 'success',
          onClick: () => cloturerMutation.mutate(),
        }
      : null

  // ============================================================
  // Menu filtré selon les permissions
  // ============================================================
  const items: DropdownMenuItem[] = [
    // Toujours visible
    {
      label: 'Voir les détails',
      icon: <Eye size={14} />,
      onClick: () => navigate(`/activites/${activite.id}`),
    },
    // Modifier (Directeur ou Chef responsable)
    ...(peutModifier
      ? [
          {
            label: 'Modifier',
            icon: <Pencil size={14} />,
            onClick: () => setIsEditOpen(true),
          } as DropdownMenuItem,
          {
            label: "Reporter l'échéance",
            icon: <Calendar size={14} />,
            onClick: () => setIsReportOpen(true),
          } as DropdownMenuItem,
        ]
      : []),
    // Annuler (Directeur ou Chef responsable, si pas clôturée/annulée)
    ...(peutModifier && !estCloturee && !estAnnulee
      ? [
          {
            label: "Annuler l'activité",
            icon: <XCircle size={14} />,
            onClick: () => setIsAnnulerOpen(true),
            separator: true,
          } as DropdownMenuItem,
        ]
      : []),
    // Supprimer (Directeur ou créateur)
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
        {quickAction && (
          <Button
            size="sm"
            variant={quickAction.variant}
            onClick={(e) => {
              e.stopPropagation()
              quickAction.onClick()
            }}
            disabled={cloturerMutation.isPending}
            leftIcon={quickAction.icon}
            className={`transition-opacity mr-0.5 whitespace-nowrap ${
              isRowHovered || cloturerMutation.isPending
                ? 'opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
            title={quickAction.label}
          >
            {cloturerMutation.isPending ? '...' : quickAction.label}
          </Button>
        )}

        {/* Bouton Pencil uniquement si peut modifier */}
        {peutModifier && (
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
        )}

        <DropdownMenu items={items} />
      </div>

      {/* Modale d'édition (uniquement si autorisé) */}
      {peutModifier && (
        <ActiviteFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          activite={activite}
        />
      )}

      <MotifModal
        isOpen={isAnnulerOpen}
        title="Annuler l'activité"
        description={`Vous allez annuler « ${activite.titre} ». Un motif est requis et sera tracé dans l'historique.`}
        confirmLabel="Annuler l'activité"
        variant="danger"
        isPending={annulerMutation.isPending}
        onConfirm={(motif) => annulerMutation.mutate(motif)}
        onCancel={() => setIsAnnulerOpen(false)}
      />

      <ReportEcheanceModal
        isOpen={isReportOpen}
        titreEntite={`Activité : ${activite.titre}`}
        dateActuelle={activite.date_echeance}
        isPending={reportMutation.isPending}
        onConfirm={(dateEcheance, motif) =>
          reportMutation.mutate({ dateEcheance, motif })
        }
        onCancel={() => setIsReportOpen(false)}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Supprimer l'activité"
        message={`Vous allez supprimer « ${activite.titre} ». Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  )
}