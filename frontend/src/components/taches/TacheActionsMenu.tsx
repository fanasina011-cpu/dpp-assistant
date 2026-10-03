/**
 * Bouton d'action rapide + Modifier + menu ⋯.
 * Menu filtré selon les permissions de l'utilisateur.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertOctagon,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  Eye,
  Pencil,
  Play,
  Trash2,
  Unlock,
  UserCog,
} from 'lucide-react'
import DropdownMenu, { DropdownMenuItem } from '../ui/DropdownMenu'
import Button from '../ui/Button'
import Card from '../ui/Card'
import UserSelect from '../ui/UserSelect'
import ConfirmDialog from '../communs/ConfirmDialog'
import MotifModal from '../communs/MotifModal'
import ReportEcheanceModal from '../communs/ReportEcheanceModal'
import TacheFormModal from './TacheFormModal'
import api from '../../api/client'
import {
  changerStatutTache,
  deleteTache,
  reporterEcheanceTache,
} from '../../api/taches'
import { fetchUtilisateurs } from '../../api/utilisateurs'
import { useToast } from '../../context/ToastContext'
import { usePermissions } from '../../hooks/usePermissions'
import type { StatutTache, Tache } from '../../types'
import type { ReactNode } from 'react'

const STATUTS: Array<{
  value: StatutTache
  label: string
  icon: ReactNode
}> = [
  { value: 'A_FAIRE', label: 'À faire', icon: <Circle size={14} /> },
  { value: 'EN_COURS', label: 'En cours', icon: <Play size={14} /> },
  { value: 'EN_ATTENTE', label: 'En attente', icon: <Clock size={14} /> },
  { value: 'BLOQUEE', label: 'Bloquée', icon: <AlertOctagon size={14} /> },
  { value: 'A_VALIDER', label: 'À valider', icon: <Clock size={14} /> },
  { value: 'TERMINEE', label: 'Terminée', icon: <CheckCircle size={14} /> },
  { value: 'ANNULEE', label: 'Annulée', icon: <AlertCircle size={14} /> },
]

const STATUTS_AVEC_MOTIF: StatutTache[] = ['ANNULEE']

interface QuickAction {
  label: string
  icon: ReactNode
  next: StatutTache
  variant: 'primary' | 'success'
}

function getQuickAction(
  statut: StatutTache,
  peutValiderRejeter: boolean,
): QuickAction | null {
  switch (statut) {
    case 'A_FAIRE':
      return {
        label: 'Commencer',
        icon: <Play size={12} />,
        next: 'EN_COURS',
        variant: 'primary',
      }
    case 'EN_ATTENTE':
      return {
        label: 'Reprendre',
        icon: <Play size={12} />,
        next: 'EN_COURS',
        variant: 'primary',
      }
    case 'EN_COURS':
      return {
        label: 'Soumettre pour validation',
        icon: <CheckCircle size={12} />,
        next: 'A_VALIDER',
        variant: 'success',
      }
    case 'A_VALIDER':
      if (!peutValiderRejeter) return null
      return {
        label: 'Valider',
        icon: <CheckCircle size={12} />,
        next: 'TERMINEE',
        variant: 'success',
      }
    case 'BLOQUEE':
      return {
        label: 'Débloquer',
        icon: <Unlock size={12} />,
        next: 'EN_COURS',
        variant: 'primary',
      }
    default:
      return null
  }
}

interface TacheActionsMenuProps {
  tache: Tache
  isRowHovered?: boolean
  peutValiderRejeter?: boolean
}

export default function TacheActionsMenu({
  tache,
  isRowHovered = false,
  peutValiderRejeter,
}: TacheActionsMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { can } = usePermissions()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isStatutModalOpen, setIsStatutModalOpen] = useState(false)
  const [isAssignerModalOpen, setIsAssignerModalOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isMotifOpen, setIsMotifOpen] = useState(false)

  const [statutChoisi, setStatutChoisi] = useState<StatutTache>(tache.statut)
  const [statutEnAttenteMotif, setStatutEnAttenteMotif] =
    useState<StatutTache>('ANNULEE')
  const [nouveauResponsable, setNouveauResponsable] = useState<
    number | '' | null
  >('')

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isAssignerModalOpen,
  })

  // ============================================================
  // Permissions contextuelles
  // ============================================================
  const peutChangerStatut = can.changeTacheStatut(tache)
  const peutReporter = can.reporterEcheanceTache(tache)
  const peutReassigner = can.reassignTache
  const peutSupprimer = can.deleteTache(tache)
  const peutModifier = can.editTache(tache)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['taches'] })
    queryClient.invalidateQueries({ queryKey: ['tache', tache.id] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const statutMutation = useMutation({
    mutationFn: (args: { statut: string; motif?: string }) =>
      changerStatutTache(tache.id, args.statut, args.motif),
    onSuccess: () => {
      invalidate()
      setIsStatutModalOpen(false)
      setIsMotifOpen(false)
      showToast('Statut mis à jour', 'success')
    },
    onError: () => {
      showToast('Impossible de modifier le statut', 'error')
    },
  })

  const assignerMutation = useMutation({
    mutationFn: (responsableId: number) =>
      api.patch(`/taches/${tache.id}/assigner/`, {
        responsable: responsableId,
      }),
    onSuccess: () => {
      invalidate()
      setIsAssignerModalOpen(false)
      setNouveauResponsable('')
      showToast('Tâche réassignée', 'success')
    },
    onError: () => {
      showToast('Impossible de réassigner', 'error')
    },
  })

  const reportMutation = useMutation({
    mutationFn: (args: { dateEcheance: string; motif: string }) =>
      reporterEcheanceTache(tache.id, args.dateEcheance, args.motif),
    onSuccess: () => {
      invalidate()
      setIsReportOpen(false)
      showToast("Échéance reportée", 'success')
    },
    onError: () => {
      showToast("Impossible de reporter l'échéance", 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTache(tache.id),
    onSuccess: () => {
      invalidate()
      setIsDeleteOpen(false)
      showToast('Tâche supprimée', 'success')
    },
    onError: () => {
      showToast('Impossible de supprimer la tâche', 'error')
    },
  })

  const handleValiderStatut = () => {
    if (statutChoisi === tache.statut) {
      setIsStatutModalOpen(false)
      return
    }
    const estRejetDepuisAValider =
      tache.statut === 'A_VALIDER' &&
      (statutChoisi === 'EN_COURS' || statutChoisi === 'A_FAIRE')

    if (estRejetDepuisAValider) {
      setStatutEnAttenteMotif(statutChoisi)
      setIsStatutModalOpen(false)
      setIsMotifOpen(true)
    } else if (STATUTS_AVEC_MOTIF.includes(statutChoisi)) {
      setStatutEnAttenteMotif(statutChoisi)
      setIsStatutModalOpen(false)
      setIsMotifOpen(true)
    } else {
      statutMutation.mutate({ statut: statutChoisi })
    }
  }

  const quickAction = peutChangerStatut
    ? getQuickAction(tache.statut, peutValiderRejeter ?? false)
    : null

  const handleQuickAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!quickAction) return
    statutMutation.mutate({ statut: quickAction.next })
  }

  // ============================================================
  // Construction du menu selon les permissions
  // ============================================================
  const items: DropdownMenuItem[] = [
    // Toujours visible
    {
      label: 'Voir les détails',
      icon: <Eye size={14} />,
      onClick: () => navigate(`/taches/${tache.id}`),
    },
    // Changer statut (responsable, créateur, chef, directeur)
    ...(peutChangerStatut
      ? [
          {
            label: 'Changer le statut',
            icon: <Calendar size={14} />,
            onClick: () => {
              setStatutChoisi(tache.statut)
              setIsStatutModalOpen(true)
            },
          } as DropdownMenuItem,
        ]
      : []),
    // Valider / Rejeter (validateur non-responsable)
    ...(peutChangerStatut &&
      tache.statut === 'A_VALIDER' &&
      (peutValiderRejeter ?? false)
      ? [
          {
            label: 'Valider',
            icon: <CheckCircle size={14} />,
            onClick: () => statutMutation.mutate({ statut: 'TERMINEE' }),
          } as DropdownMenuItem,
          {
            label: 'Rejeter',
            icon: <AlertCircle size={14} />,
            onClick: () => {
              setStatutEnAttenteMotif('EN_COURS')
              setIsMotifOpen(true)
            },
          } as DropdownMenuItem,
        ]
      : []),
    // Reporter l'échéance (responsable, créateur, chef, directeur)
    ...(peutReporter
      ? [
          {
            label: "Reporter l'échéance",
            icon: <Calendar size={14} />,
            onClick: () => setIsReportOpen(true),
          } as DropdownMenuItem,
        ]
      : []),
    // Réassigner (chef, directeur)
    ...(peutReassigner
      ? [
          {
            label: 'Réassigner',
            icon: <UserCog size={14} />,
            onClick: () => setIsAssignerModalOpen(true),
          } as DropdownMenuItem,
        ]
      : []),
    // Supprimer (créateur, directeur)
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
            onClick={handleQuickAction}
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

        {/* Bouton Modifier (pencil) — visible seulement si peut modifier */}
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
        <TacheFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          tache={tache}
        />
      )}

      {/* Modale : Changer statut */}
      {isStatutModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <Calendar size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-ink-900">
                  Changer le statut
                </h3>
                <p className="text-[11px] text-ink-500 mt-0.5 truncate">
                  {tache.titre}
                </p>
              </div>
            </div>

            <div className="space-y-0.5 mb-4">
              {STATUTS.map((s) => {
                const isActive = statutChoisi === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatutChoisi(s.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'text-ink-700 hover:bg-ink-50 border border-transparent'
                    }`}
                  >
                    <span className={isActive ? 'text-brand-600' : 'text-ink-400'}>
                      {s.icon}
                    </span>
                    <span className="flex-1 text-[13px] font-medium">
                      {s.label}
                    </span>
                    {isActive && (
                      <CheckCircle size={14} className="text-brand-500" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
              <Button
                variant="ghost"
                onClick={() => setIsStatutModalOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleValiderStatut}
                disabled={
                  statutMutation.isPending || statutChoisi === tache.statut
                }
              >
                {statutMutation.isPending ? 'Enregistrement...' : 'Confirmer'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modale : Réassigner */}
      {isAssignerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <UserCog size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-ink-900">
                  Réassigner la tâche
                </h3>
                <p className="text-[11px] text-ink-500 mt-0.5 truncate">
                  {tache.titre}
                </p>
              </div>
            </div>

            <div className="bg-ink-50 border border-ink-200 rounded-md px-3 py-2 mb-4 flex items-center gap-2 text-[12px]">
              <span className="text-ink-500">Responsable actuel :</span>
              <span className="text-ink-800 font-medium">
                {tache.responsable_detail?.nom_complet || 'Non assigné'}
              </span>
            </div>

            <UserSelect
              users={utilisateurs}
              value={nouveauResponsable}
              onChange={(id) => setNouveauResponsable(id)}
              label="Nouveau responsable"
              placeholder="Sélectionner un utilisateur"
              showRoleFilter
              showServiceFilter
            />

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-ink-100">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsAssignerModalOpen(false)
                  setNouveauResponsable('')
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={() =>
                  nouveauResponsable &&
                  assignerMutation.mutate(Number(nouveauResponsable))
                }
                disabled={!nouveauResponsable || assignerMutation.isPending}
              >
                {assignerMutation.isPending ? 'Réassignation...' : 'Réassigner'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <MotifModal
        isOpen={isMotifOpen}
        title={`Changer le statut → ${STATUTS.find((s) => s.value === statutEnAttenteMotif)?.label}`}
        description="Un motif est requis pour ce changement de statut. Il sera tracé dans l'historique."
        confirmLabel="Confirmer"
        variant="danger"
        isPending={statutMutation.isPending}
        onConfirm={(motif) =>
          statutMutation.mutate({ statut: statutEnAttenteMotif, motif })
        }
        onCancel={() => setIsMotifOpen(false)}
      />

      <ReportEcheanceModal
        isOpen={isReportOpen}
        titreEntite={`Tâche : ${tache.titre}`}
        dateActuelle={tache.date_echeance}
        isPending={reportMutation.isPending}
        onConfirm={(dateEcheance, motif) =>
          reportMutation.mutate({ dateEcheance, motif })
        }
        onCancel={() => setIsReportOpen(false)}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Supprimer la tâche"
        message={`Vous allez supprimer « ${tache.titre} ». Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  )
}