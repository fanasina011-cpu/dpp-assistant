/**
 * Menu d'actions pour une instruction + action rapide basée sur
 * le statut du destinataire connecté.
 */

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CheckCircle,
  Eye,
  Pencil,
  Play,
  Trash2,
  XCircle,
} from 'lucide-react'
import DropdownMenu, { DropdownMenuItem } from '../ui/DropdownMenu'
import Button from '../ui/Button'
import ConfirmDialog from '../communs/ConfirmDialog'
import MotifModal from '../communs/MotifModal'
import ReportEcheanceModal from '../communs/ReportEcheanceModal'
import InstructionFormModal from './InstructionFormModal'
import {
  annulerInstruction,
  changerStatutDestinataire,
  deleteInstruction,
  reporterEcheanceInstruction,
} from '../../api/instructions'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { Instruction, StatutInstruction } from '../../types'

interface QuickAction {
  label: string
  icon: ReactNode
  next: StatutInstruction
  variant: 'primary' | 'success'
}

interface InstructionActionsMenuProps {
  instruction: Instruction
  isRowHovered?: boolean
}

export default function InstructionActionsMenu({
  instruction,
  isRowHovered = false,
}: InstructionActionsMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAnnulerOpen, setIsAnnulerOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['instructions'] })
    queryClient.invalidateQueries({
      queryKey: ['instruction', instruction.id],
    })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const statutMutation = useMutation({
    mutationFn: (args: { userId: number; statut: StatutInstruction }) =>
      changerStatutDestinataire(instruction.id, args.userId, args.statut),
    onSuccess: () => {
      invalidate()
      showToast('Statut mis à jour', 'success')
    },
    onError: () => {
      showToast('Impossible de modifier le statut', 'error')
    },
  })

  const annulerMutation = useMutation({
    mutationFn: (motif: string) => annulerInstruction(instruction.id, motif),
    onSuccess: () => {
      invalidate()
      setIsAnnulerOpen(false)
      showToast('Instruction annulée', 'success')
    },
    onError: () => {
      showToast("Impossible d'annuler l'instruction", 'error')
    },
  })

  const reportMutation = useMutation({
    mutationFn: (args: { dateEcheance: string; motif: string }) =>
      reporterEcheanceInstruction(instruction.id, args.dateEcheance, args.motif),
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
    mutationFn: () => deleteInstruction(instruction.id),
    onSuccess: () => {
      invalidate()
      setIsDeleteOpen(false)
      showToast('Instruction supprimée', 'success')
    },
    onError: () => {
      showToast("Impossible de supprimer l'instruction", 'error')
    },
  })

  const moi = user
    ? instruction.destinataires.find((d) => d.destinataire === user.id)
    : undefined

  const quickAction: QuickAction | null = (() => {
    if (!moi || !user) return null
    if (moi.statut === 'A_FAIRE') {
      return {
        label: 'Commencer',
        icon: <Play size={12} />,
        next: 'EN_COURS',
        variant: 'primary',
      }
    }
    if (moi.statut === 'EN_COURS') {
      return {
        label: 'Terminer',
        icon: <CheckCircle size={12} />,
        next: 'TERMINEE',
        variant: 'success',
      }
    }
    return null
  })()

  const handleQuickAction = () => {
    if (!quickAction || !moi) return
    statutMutation.mutate({ userId: moi.destinataire, statut: quickAction.next })
  }

  const estEmetteur = user?.id === instruction.emetteur
  const estChefOuDirecteur =
    user?.role === 'DIRECTEUR' ||
    user?.role === 'CHEF_SERVICE_PROJETS' ||
    user?.role === 'CHEF_SERVICE_PARTENARIATS'
  const peutGerer = estEmetteur || estChefOuDirecteur

  const estAnnulee = instruction.statut === 'ANNULEE'

  const items: DropdownMenuItem[] = [
    {
      label: 'Voir les détails',
      icon: <Eye size={14} />,
      onClick: () => navigate(`/instructions/${instruction.id}`),
    },
    ...(peutGerer
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
    ...(peutGerer && !estAnnulee
      ? [
          {
            label: "Annuler l'instruction",
            icon: <XCircle size={14} />,
            onClick: () => setIsAnnulerOpen(true),
            separator: true,
          } as DropdownMenuItem,
        ]
      : []),
    ...(peutGerer
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
              handleQuickAction()
            }}
            disabled={statutMutation.isPending}
            leftIcon={quickAction.icon}
            className={`transition-opacity mr-0.5 whitespace-nowrap ${
              isRowHovered || statutMutation.isPending
                ? 'opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
            title={quickAction.label}
          >
            {statutMutation.isPending ? '...' : quickAction.label}
          </Button>
        )}

        {peutGerer && (
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

      <InstructionFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        instruction={instruction}
      />

      <MotifModal
        isOpen={isAnnulerOpen}
        title="Annuler l'instruction"
        description={`Vous allez annuler « ${instruction.titre} ». Un motif est requis et sera tracé dans l'historique.`}
        confirmLabel="Annuler l'instruction"
        variant="danger"
        isPending={annulerMutation.isPending}
        onConfirm={(motif) => annulerMutation.mutate(motif)}
        onCancel={() => setIsAnnulerOpen(false)}
      />

      <ReportEcheanceModal
        isOpen={isReportOpen}
        titreEntite={`Instruction : ${instruction.titre}`}
        dateActuelle={instruction.date_echeance}
        isPending={reportMutation.isPending}
        onConfirm={(dateEcheance, motif) =>
          reportMutation.mutate({ dateEcheance, motif })
        }
        onCancel={() => setIsReportOpen(false)}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Supprimer l'instruction"
        message={`Vous allez supprimer « ${instruction.titre} ». Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  )
}