/**
 * Page détail d'une instruction — v6.
 * Layout 2 colonnes, sidebar sticky, destinataires en liste moderne.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Calendar,
  Circle,
  Clock,
  FileText,
  Flag,
  FolderKanban,
  Hash,
  Target,
  Trash2,
  User,
  Users,
  XCircle,
} from 'lucide-react'
import Layout from '../components/Layout'
import DetailPage from '../components/detail/DetailPage'
import MetaGroup from '../components/detail/MetaGroup'
import MetaItem from '../components/detail/MetaItem'
import MetaSelect from '../components/detail/MetaSelect'
import StatutBadge from '../components/StatutBadge'
import PrioriteBadge from '../components/PrioriteBadge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Select from '../components/ui/Select'
import Avatar from '../components/ui/Avatar'
import {
  annulerInstruction,
  changerStatutDestinataire,
  deleteInstruction,
  fetchInstruction,
  reporterEcheanceInstruction,
  updateInstruction,
} from '../api/instructions'
import CommentairesSection from '../components/commentaires/CommentairesSection'
import MotifModal from '../components/communs/MotifModal'
import ConfirmDialog from '../components/communs/ConfirmDialog'
import ReportEcheanceModal from '../components/communs/ReportEcheanceModal'
import PiecesJointesSection from '../components/piecesJointes/PiecesJointesSection'
import InstructionFormModal from '../components/instructions/InstructionFormModal'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { estDirecteur as estDirecteurRole, usePermissions } from '../hooks/usePermissions'
import type { StatutInstruction } from '../types'

const STATUTS: Array<{ value: StatutInstruction; label: string }> = [
  { value: 'A_FAIRE', label: 'À faire' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'TERMINEE', label: 'Terminée' },
  { value: 'ANNULEE', label: 'Annulée' },
]

const PRIORITES = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
]

export default function InstructionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { can, roles } = usePermissions()

  const instructionId = Number(id)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAnnulationModalOpen, setIsAnnulationModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const {
    data: instruction,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['instruction', instructionId],
    queryFn: () => fetchInstruction(instructionId),
    enabled: !isNaN(instructionId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['instruction', instructionId],
    })
    queryClient.invalidateQueries({ queryKey: ['instructions'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const prioriteMutation = useMutation({
    mutationFn: (priorite: string) =>
      updateInstruction(instructionId, { priorite } as any),
    onSuccess: () => {
      invalidate()
      showToast('Priorité mise à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier la priorité', 'error'),
  })

  const reportMutation = useMutation({
    mutationFn: (args: { dateEcheance: string; motif: string }) =>
      reporterEcheanceInstruction(instructionId, args.dateEcheance, args.motif),
    onSuccess: () => {
      invalidate()
      setIsReportModalOpen(false)
      showToast('Échéance reportée', 'success')
    },
    onError: () => showToast("Impossible de reporter l'échéance", 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteInstruction(instructionId),
    onSuccess: () => {
      invalidate()
      showToast('Instruction supprimée', 'success')
      navigate('/instructions')
    },
    onError: () => showToast("Impossible de supprimer l'instruction", 'error'),
  })

  const annulerMutation = useMutation({
    mutationFn: (motif: string) => annulerInstruction(instructionId, motif),
    onSuccess: () => {
      invalidate()
      setIsAnnulationModalOpen(false)
      showToast('Instruction annulée', 'success')
    },
    onError: () => showToast("Impossible d'annuler l'instruction", 'error'),
  })

  const statutMutation = useMutation({
    mutationFn: (args: { userId: number; statut: StatutInstruction }) =>
      changerStatutDestinataire(instructionId, args.userId, args.statut),
    onSuccess: () => {
      invalidate()
      showToast('Statut mis à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier le statut', 'error'),
  })

  if (isLoading) {
    return (
      <Layout title="Instruction">
        <div className="space-y-5">
          <div className="h-4 w-32 bg-ink-100 rounded animate-pulse" />
          <div className="h-8 w-2/3 bg-ink-100 rounded animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-6">
            <div className="space-y-5">
              <div className="h-40 bg-ink-100 rounded-lg animate-pulse" />
              <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
            </div>
            <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !instruction) {
    return (
      <Layout title="Instruction">
        <Card>
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <p className="text-[13px] text-ink-700">
              Instruction introuvable ou accès refusé.
            </p>
            <Link
              to="/instructions"
              className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:underline mt-2"
            >
              ← Retour à la liste
            </Link>
          </div>
        </Card>
      </Layout>
    )
  }

  // Statut du user connecté en tant que destinataire
  const moi = user
    ? instruction.destinataires.find((d) => d.destinataire === user.id)
    : undefined

  // Permissions contextuelles
  const peutModifier = can.editInstruction(instruction)
  const peutSupprimer = can.deleteInstruction(instruction)

  return (
    <Layout title="Détail de l'instruction">
      <DetailPage
        breadcrumb={{ label: 'Retour aux instructions', to: '/instructions' }}
        title={instruction.titre}
        actions={
          <>
            {peutModifier && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsEditOpen(true)}
                leftIcon={<Hash size={13} />}
              >
                Modifier
              </Button>
            )}
          </>
        }
        sidebar={
          <>
            {/* ÉTAT */}
            <MetaGroup title="État">
              <MetaItem
                icon={<Circle size={14} />}
                label="Statut"
                value={
                  <StatutBadge
                    statut={instruction.statut}
                    statutDisplay={instruction.statut_display}
                  />
                }
              />

              {peutModifier ? (
                <MetaSelect
                  icon={<Flag size={14} />}
                  label="Priorité"
                  value={instruction.priorite_display}
                  currentValue={instruction.priorite}
                  options={PRIORITES}
                  onChange={(v) => prioriteMutation.mutate(v)}
                  disabled={prioriteMutation.isPending}
                />
              ) : (
                <MetaItem
                  icon={<Flag size={14} />}
                  label="Priorité"
                  value={
                    <PrioriteBadge
                      priorite={instruction.priorite}
                      prioriteDisplay={instruction.priorite_display}
                    />
                  }
                />
              )}

              {moi && (
                <MetaItem
                  icon={<Users size={14} />}
                  label="Mon statut"
                  value={
                    <StatutBadge
                      statut={moi.statut}
                      statutDisplay={moi.statut_display}
                    />
                  }
                />
              )}
            </MetaGroup>

            {/* ÉMETTEUR */}
            <MetaGroup title="Émetteur">
              <MetaItem
                icon={<User size={14} />}
                label="Émis par"
                value={
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      name={instruction.emetteur_detail.nom_complet}
                      size="xs"
                    />
                    <span className="truncate">
                      {instruction.emetteur_detail.nom_complet}
                    </span>
                  </div>
                }
              />
            </MetaGroup>

            {/* DATES */}
            <MetaGroup title="Dates">
              <MetaItem
                icon={<Clock size={14} />}
                label="Échéance"
                value={
                  instruction.date_echeance ? (
                    new Date(instruction.date_echeance).toLocaleDateString(
                      'fr-FR',
                      { day: '2-digit', month: 'short', year: 'numeric' },
                    )
                  ) : (
                    <span className="text-ink-400 italic text-[12px]">
                      Non définie
                    </span>
                  )
                }
                onClick={
                  peutModifier ? () => setIsReportModalOpen(true) : undefined
                }
              />
              <MetaItem
                icon={<Calendar size={14} />}
                label="Créée le"
                value={new Date(instruction.date_creation).toLocaleDateString(
                  'fr-FR',
                  { day: '2-digit', month: 'short', year: 'numeric' },
                )}
              />
            </MetaGroup>

            {/* CIBLE */}
            <MetaGroup title="Cible">
              {instruction.cible_type === 'TACHE' ? (
                <Link to={`/taches/${instruction.tache_cible}`}>
                  <MetaItem
                    icon={<FileText size={14} />}
                    label="Tâche"
                    value={instruction.tache_cible_detail?.titre || 'Tâche'}
                  />
                </Link>
              ) : instruction.cible_type === 'ACTIVITE' ? (
                <Link to={`/activites/${instruction.activite_cible}`}>
                  <MetaItem
                    icon={<FolderKanban size={14} />}
                    label="Activité"
                    value={
                      instruction.activite_cible_detail?.titre || 'Activité'
                    }
                  />
                </Link>
              ) : (
                <MetaItem
                  icon={<Target size={14} />}
                  label="Cible"
                  value={
                    <span className="text-ink-400 italic text-[12px]">
                      Aucune
                    </span>
                  }
                />
              )}
            </MetaGroup>

            {/* ACTIONS — uniquement si au moins un bouton visible */}
            {(peutModifier || peutSupprimer) && (
              <MetaGroup title="Actions">
                <div className="space-y-1.5">
                  {peutModifier && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsReportModalOpen(true)}
                      leftIcon={<Calendar size={12} />}
                      className="w-full !justify-start"
                    >
                      Reporter l'échéance
                    </Button>
                  )}

                  {peutModifier && instruction.statut !== 'ANNULEE' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAnnulationModalOpen(true)}
                      leftIcon={<XCircle size={12} />}
                      className="w-full !justify-start"
                    >
                      Annuler l'instruction
                    </Button>
                  )}

                  {peutSupprimer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      disabled={deleteMutation.isPending}
                      leftIcon={<Trash2 size={12} />}
                      className="w-full !justify-start text-danger hover:bg-danger-bg"
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              </MetaGroup>
            )}
          </>
        }
      >
        {/* Description */}
        {instruction.description && (
          <Card title="Description">
            <p className="text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">
              {instruction.description}
            </p>
          </Card>
        )}

        {/* Destinataires */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-ink-400" />
            <h3 className="text-[14px] font-semibold text-ink-900">
              Destinataires
            </h3>
            <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
              {instruction.destinataires.length}
            </span>
          </div>

          <div className="space-y-2">
            {instruction.destinataires.map((dest) => {
              const estMoi = user?.id === dest.destinataire
              const peutChanger =
                estMoi ||
                user?.id === instruction.emetteur ||
                estDirecteurRole(roles)

              return (
                <div
                  key={dest.id}
                  className={`border rounded-md p-3 flex items-center justify-between gap-4 flex-wrap transition-colors ${
                    estMoi
                      ? 'border-brand-200 bg-brand-50/40'
                      : 'border-ink-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={dest.destinataire_detail.nom_complet}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-[13px] text-ink-900 truncate flex items-center gap-1.5">
                        {dest.destinataire_detail.nom_complet}
                        {estMoi && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-brand-600 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                            Vous
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-500 truncate">
                        {dest.destinataire_detail.role_display}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatutBadge
                      statut={dest.statut}
                      statutDisplay={dest.statut_display}
                    />
                    {peutChanger && (
                      <Select
                        value={dest.statut}
                        onChange={(e) =>
                          statutMutation.mutate({
                            userId: dest.destinataire,
                            statut: e.target.value as StatutInstruction,
                          })
                        }
                        disabled={statutMutation.isPending}
                        className="!w-auto !h-7 !py-0 !text-[11px]"
                      >
                        {STATUTS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Commentaires */}
        <Card>
          <CommentairesSection instructionId={instructionId} />
        </Card>

        {/* Pièces jointes */}
        <Card>
          <PiecesJointesSection instructionId={instructionId} />
        </Card>
      </DetailPage>

      {/* Modales — conditionnelles */}
      {peutModifier && (
        <InstructionFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          instruction={instruction}
        />
      )}

      <MotifModal
        isOpen={isAnnulationModalOpen}
        title="Annuler l'instruction"
        description={`Vous allez annuler « ${instruction.titre} ».`}
        confirmLabel="Annuler l'instruction"
        variant="danger"
        isPending={annulerMutation.isPending}
        onConfirm={(motif) => annulerMutation.mutate(motif)}
        onCancel={() => setIsAnnulationModalOpen(false)}
      />

      <ReportEcheanceModal
        isOpen={isReportModalOpen}
        titreEntite={`Instruction : ${instruction.titre}`}
        dateActuelle={instruction.date_echeance}
        isPending={reportMutation.isPending}
        onConfirm={(dateEcheance, motif) =>
          reportMutation.mutate({ dateEcheance, motif })
        }
        onCancel={() => setIsReportModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Supprimer l'instruction"
        message={`Vous allez supprimer « ${instruction.titre} ». Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </Layout>
  )
}
