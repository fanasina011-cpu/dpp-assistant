/**
 * Page détail d'une tâche — v6.
 * Layout 2 colonnes avec sidebar sticky et édition inline.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertOctagon,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  FileText,
  Flag,
  FolderKanban,
  Hash,
  Link2,
  Play,
  Trash2,
  Unlink,
  User,
  UserCircle,
  UserPlus,
} from 'lucide-react'
import Layout from '../components/Layout'
import StatutBadge from '../components/StatutBadge'
import PrioriteBadge from '../components/PrioriteBadge'
import ErrorState from '../components/ui/ErrorState'
import DetailPage from '../components/detail/DetailPage'
import MetaGroup from '../components/detail/MetaGroup'
import MetaItem from '../components/detail/MetaItem'
import MetaSelect from '../components/detail/MetaSelect'
import MetaDatePicker from '../components/detail/MetaDatePicker'
import MetaUserSelect from '../components/detail/MetaUserSelect'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EntitySelect from '../components/ui/EntitySelect'
import Avatar from '../components/ui/Avatar'
import api from '../api/client'
import { fetchActivites } from '../api/activites'
import {
  changerStatutTache,
  deleteTache,
  fetchTache,
  reporterEcheanceTache,
} from '../api/taches'
import { fetchUtilisateurs } from '../api/utilisateurs'
import CommentairesSection from '../components/commentaires/CommentairesSection'
import PiecesJointesSection from '../components/piecesJointes/PiecesJointesSection'
import BlocageFormModal from '../components/blocages/BlocageFormModal'
import MotifModal from '../components/communs/MotifModal'
import ConfirmDialog from '../components/communs/ConfirmDialog'
import ReportEcheanceModal from '../components/communs/ReportEcheanceModal'
import TacheFormModal from '../components/taches/TacheFormModal'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import type { StatutTache } from '../types'

const STATUTS: Array<{
  value: StatutTache
  label: string
  icon: React.ReactNode
}> = [
  { value: 'A_FAIRE', label: 'À faire', icon: <Circle size={12} /> },
  { value: 'EN_COURS', label: 'En cours', icon: <Play size={12} /> },
  { value: 'EN_ATTENTE', label: 'En attente', icon: <Clock size={12} /> },
  { value: 'BLOQUEE', label: 'Bloquée', icon: <AlertOctagon size={12} /> },
  { value: 'A_VALIDER', label: 'À valider', icon: <Clock size={12} /> },
  { value: 'TERMINEE', label: 'Terminée', icon: <CheckCircle size={12} /> },
  { value: 'ANNULEE', label: 'Annulée', icon: <AlertCircle size={12} /> },
]

const PRIORITES = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
]

export default function TacheDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { can } = usePermissions()

  const tacheId = Number(id)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isBlocageModalOpen, setIsBlocageModalOpen] = useState(false)
  const [isReattributionOpen, setIsReattributionOpen] = useState(false)
  const [, setNouveauResponsable] = useState<number | ''>('')
  const [isAnnulationModalOpen, setIsAnnulationModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [statutEnAttente, setStatutEnAttente] = useState<string>('')
  const [isRattacherOpen, setIsRattacherOpen] = useState(false)
  const [activiteAChoisir, setActiviteAChoisir] = useState<number | ''>('')
  const [isRejetModalOpen, setIsRejetModalOpen] = useState(false)

  const {
    data: tache,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tache', tacheId],
    queryFn: () => fetchTache(tacheId),
    enabled: !isNaN(tacheId),
  })

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isReattributionOpen,
  })
  const { data: activites = [] } = useQuery({
    queryKey: ['activites'],
    queryFn: () => fetchActivites(),
    enabled: isRattacherOpen,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tache', tacheId] })
    queryClient.invalidateQueries({ queryKey: ['taches'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const statutMutation = useMutation({
    mutationFn: (args: { statut: string; motif?: string }) =>
      changerStatutTache(tacheId, args.statut, args.motif),
    onSuccess: () => {
      invalidate()
      setIsAnnulationModalOpen(false)
      setStatutEnAttente('')
      showToast('Statut mis à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier le statut', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTache(tacheId),
    onSuccess: () => {
      invalidate()
      showToast('Tâche supprimée', 'success')
      navigate('/taches')
    },
    onError: () => showToast('Impossible de supprimer la tâche', 'error'),
  })

  const dateDebutMutation = useMutation({
    mutationFn: (dateDebut: string) =>
      api.patch(`/taches/${tacheId}/`, { date_debut: dateDebut }),
    onSuccess: () => {
      invalidate()
      showToast('Date de début mise à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier la date', 'error'),
  })

  const prioriteMutation = useMutation({
    mutationFn: (nouvellePriorite: string) =>
      api.patch(`/taches/${tacheId}/`, { priorite: nouvellePriorite }),
    onSuccess: () => {
      invalidate()
      showToast('Priorité mise à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier la priorité', 'error'),
  })

  const reportMutation = useMutation({
    mutationFn: (args: { dateEcheance: string; motif: string }) =>
      reporterEcheanceTache(tacheId, args.dateEcheance, args.motif),
    onSuccess: () => {
      invalidate()
      setIsReportModalOpen(false)
      showToast('Échéance reportée', 'success')
    },
    onError: () => showToast("Impossible de reporter l'échéance", 'error'),
  })

  const rattacherMutation = useMutation({
    mutationFn: (activiteId: number) =>
      api.patch(`/taches/${tacheId}/`, { activite: activiteId }),
    onSuccess: () => {
      invalidate()
      setIsRattacherOpen(false)
      setActiviteAChoisir('')
      showToast("Tâche rattachée à l'activité", 'success')
    },
    onError: () => {
      showToast("Impossible de rattacher la tâche", 'error')
    },
  })

  const detacherMutation = useMutation({
    mutationFn: () => api.patch(`/taches/${tacheId}/`, { activite: null }),
    onSuccess: () => {
      invalidate()
      showToast("Tâche retirée de l'activité", 'success')
    },
    onError: () => {
      showToast('Impossible de détacher la tâche', 'error')
    },
  })

  const assignerMutation = useMutation({
    mutationFn: (responsableId: number) =>
      api.patch(`/taches/${tacheId}/assigner/`, {
        responsable: responsableId,
      }),
    onSuccess: () => {
      invalidate()
      setIsReattributionOpen(false)
      setNouveauResponsable('')
      showToast('Tâche réattribuée', 'success')
    },
    onError: () => showToast('Impossible de réattribuer la tâche', 'error'),
  })

  const handleStatutChange = (nouveau: string) => {
    if (!tache) return
    if (nouveau === 'ANNULEE') {
      setStatutEnAttente(nouveau)
      setIsAnnulationModalOpen(true)
    } else if (
      tache.statut === 'A_VALIDER' &&
      (nouveau === 'EN_COURS' || nouveau === 'A_FAIRE')
    ) {
      setStatutEnAttente(nouveau)
      setIsRejetModalOpen(true)
    } else {
      statutMutation.mutate({ statut: nouveau })
    }
  }

  if (isLoading) {
    return (
      <Layout title="Tâche">
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

  const errorAffichee = error ?? {
    response: { status: 404, data: { detail: 'Tâche introuvable' } },
  }

  if (errorAffichee || !tache) {
    return (
      <Layout title="Tâche">
        <Card>
          <ErrorState error={errorAffichee} onRetry={() => refetch()} />
          <div className="mt-4 text-center">
            <Link to="/taches" className="text-[12px] text-brand-600 hover:underline">
              ← Retour à la liste
            </Link>
          </div>
        </Card>
      </Layout>
    )
  }

  // ============================================================
  // Permissions contextuelles
  // ============================================================
  const peutModifierContenu = can.editTache(tache)
  const peutChangerStatut = can.changeTacheStatut(tache)
  const peutReporter = can.reporterEcheanceTache(tache)
  const peutReassigner = can.reassignTache
  const peutSupprimer = can.deleteTache(tache)

  // Action primaire contextuelle selon le statut
  const primaryAction = (() => {
    if (!peutChangerStatut) return null

    if (tache.statut === 'A_FAIRE')
      return {
        label: 'Commencer',
        icon: <Play size={13} />,
        onClick: () => statutMutation.mutate({ statut: 'EN_COURS' }),
        variant: 'primary' as const,
      }
    if (tache.statut === 'EN_COURS')
      return {
        label: 'Soumettre pour validation',
        icon: <CheckCircle size={13} />,
        onClick: () => statutMutation.mutate({ statut: 'A_VALIDER' }),
        variant: 'success' as const,
      }
    if (tache.statut === 'A_VALIDER' && can.validerRejeterTache(tache))
      return {
        label: 'Valider',
        icon: <CheckCircle size={13} />,
        onClick: () => statutMutation.mutate({ statut: 'TERMINEE' }),
        variant: 'success' as const,
      }
    if (tache.statut === 'BLOQUEE')
      return {
        label: 'Débloquer',
        icon: <Play size={13} />,
        onClick: () => statutMutation.mutate({ statut: 'EN_COURS' }),
        variant: 'primary' as const,
      }
    return null
  })()

  const showActionsGroup =
    peutReporter || peutReassigner || peutSupprimer ||
    (tache.statut !== 'BLOQUEE' &&
      tache.statut !== 'TERMINEE' &&
      tache.statut !== 'ANNULEE')

  return (
    <Layout title="Détail de la tâche">
      <DetailPage
        breadcrumb={{ label: 'Retour aux tâches', to: '/taches' }}
        title={tache.titre}
        badges={
          <>
            {tache.est_en_retard && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-danger-bg text-danger border border-danger-border">
                <AlertCircle size={10} />
                En retard
              </span>
            )}
          </>
        }
        actions={
          <>
            {primaryAction && (
              <Button
                variant={primaryAction.variant}
                size="md"
                onClick={primaryAction.onClick}
                disabled={statutMutation.isPending}
                leftIcon={primaryAction.icon}
              >
                {statutMutation.isPending ? '...' : primaryAction.label}
              </Button>
            )}
            {peutModifierContenu && (
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
              {peutChangerStatut ? (
                <MetaSelect
                  icon={<Circle size={14} />}
                  label="Statut"
                  value={tache.statut_display}
                  currentValue={tache.statut}
                  options={STATUTS.map((s) => ({
                    value: s.value,
                    label: s.label,
                    icon: s.icon,
                  }))}
                  onChange={handleStatutChange}
                  disabled={statutMutation.isPending}
                />
              ) : (
                <MetaItem
                  icon={<Circle size={14} />}
                  label="Statut"
                  value={
                    <StatutBadge
                      statut={tache.statut}
                      statutDisplay={tache.statut_display}
                    />
                  }
                />
              )}

              {peutModifierContenu ? (
                <MetaSelect
                  icon={<Flag size={14} />}
                  label="Priorité"
                  value={tache.priorite_display}
                  currentValue={tache.priorite}
                  options={PRIORITES.map((p) => ({
                    value: p.value,
                    label: p.label,
                  }))}
                  onChange={(v) => prioriteMutation.mutate(v)}
                  disabled={prioriteMutation.isPending}
                />
              ) : (
                <MetaItem
                  icon={<Flag size={14} />}
                  label="Priorité"
                  value={
                    <PrioriteBadge
                      priorite={tache.priorite}
                      prioriteDisplay={tache.priorite_display}
                    />
                  }
                />
              )}
            </MetaGroup>

            {/* PERSONNES */}
            <MetaGroup title="Personnes">
              {peutReassigner ? (
                <MetaUserSelect
                  icon={<UserCircle size={14} />}
                  label="Responsable"
                  currentUserId={tache.responsable}
                  users={utilisateurs}
                  onChange={(id) => {
                    if (id > 0) assignerMutation.mutate(id)
                  }}
                  disabled={assignerMutation.isPending}
                  allowNone={false}
                />
              ) : (
                <MetaItem
                  icon={<UserCircle size={14} />}
                  label="Responsable"
                  value={
                    tache.responsable_detail ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={tache.responsable_detail.nom_complet}
                          size="xs"
                        />
                        <span className="truncate">
                          {tache.responsable_detail.nom_complet}
                        </span>
                      </div>
                    ) : (
                      <span className="text-ink-400 italic text-[12px]">
                        Non assigné
                      </span>
                    )
                  }
                />
              )}

              <MetaItem
                icon={<User size={14} />}
                label="Créateur"
                value={
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      name={tache.createur_detail.nom_complet}
                      size="xs"
                    />
                    <span className="truncate">
                      {tache.createur_detail.nom_complet}
                    </span>
                  </div>
                }
              />
            </MetaGroup>

            {/* DATES */}
            <MetaGroup title="Dates">
              {peutModifierContenu ? (
                <MetaDatePicker
                  icon={<Calendar size={14} />}
                  label="Début"
                  value={tache.date_debut}
                  onChange={(iso) => dateDebutMutation.mutate(iso)}
                  disabled={dateDebutMutation.isPending}
                />
              ) : (
                <MetaItem
                  icon={<Calendar size={14} />}
                  label="Début"
                  value={
                    tache.date_debut ? (
                      <span className="tabular-nums">
                        {new Date(tache.date_debut).toLocaleDateString(
                          'fr-FR',
                          {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          },
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-400 italic text-[12px]">
                        Non définie
                      </span>
                    )
                  }
                />
              )}

              <MetaItem
                icon={<Clock size={14} />}
                label="Échéance"
                value={
                  tache.date_echeance ? (
                    <span
                      className={
                        tache.est_en_retard ? 'text-danger font-semibold' : ''
                      }
                    >
                      {new Date(tache.date_echeance).toLocaleDateString(
                        'fr-FR',
                        { day: '2-digit', month: 'short', year: 'numeric' },
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-400 italic text-[12px]">
                      Non définie
                    </span>
                  )
                }
                onClick={
                  peutReporter ? () => setIsReportModalOpen(true) : undefined
                }
              />
            </MetaGroup>

            {/* LIENS */}
            <MetaGroup title="Liens">
              {tache.activite_detail ? (
                <div className="flex items-center gap-0.5 group">
                  <Link
                    to={`/activites/${tache.activite_detail.id}`}
                    className="flex-1 min-w-0"
                  >
                    <MetaItem
                      icon={<FolderKanban size={14} />}
                      label="Activité"
                      value={tache.activite_detail.titre}
                    />
                  </Link>
                  {peutModifierContenu && (
                    <button
                      type="button"
                      onClick={() => detacherMutation.mutate()}
                      disabled={detacherMutation.isPending}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-ink-300 hover:text-danger hover:bg-danger-bg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 disabled:opacity-50"
                      aria-label="Retirer de l'activité"
                      title="Retirer de l'activité"
                    >
                      <Unlink size={12} />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {peutModifierContenu ? (
                    <button
                      type="button"
                      onClick={() => setIsRattacherOpen(true)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors hover:bg-ink-50 group"
                    >
                      <span className="text-ink-400 shrink-0">
                        <Link2 size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium">
                          Activité
                        </div>
                        <div className="text-[12px] text-brand-600 italic mt-0.5 font-medium">
                          Non rattachée · Cliquer pour rattacher
                        </div>
                      </div>
                    </button>
                  ) : (
                    <MetaItem
                      icon={<Link2 size={14} />}
                      label="Activité"
                      value={
                        <span className="text-ink-400 italic text-[12px]">
                          Non rattachée
                        </span>
                      }
                    />
                  )}
                </>
              )}

              {tache.instruction_detail && (
                <Link to={`/instructions/${tache.instruction_detail.id}`}>
                  <MetaItem
                    icon={<FileText size={14} />}
                    label="Instruction"
                    value={tache.instruction_detail.titre}
                  />
                </Link>
              )}
            </MetaGroup>

            {/* ACTIONS */}
            {showActionsGroup && (
              <MetaGroup title="Actions">
                <div className="space-y-1.5">
                  {peutReporter && (
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

                  {tache.statut !== 'BLOQUEE' &&
                    tache.statut !== 'TERMINEE' &&
                    tache.statut !== 'ANNULEE' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsBlocageModalOpen(true)}
                        leftIcon={<AlertCircle size={12} />}
                        className="w-full !justify-start"
                      >
                        Signaler un blocage
                      </Button>
                    )}

                  {peutReassigner && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsReattributionOpen(true)}
                      leftIcon={<UserPlus size={12} />}
                      className="w-full !justify-start"
                    >
                      Réattribuer
                    </Button>
                  )}

                  {can.validerRejeterTache(tache) && tache.statut === 'A_VALIDER' && (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => statutMutation.mutate({ statut: 'TERMINEE' })}
                        disabled={statutMutation.isPending}
                        leftIcon={<CheckCircle size={12} />}
                        className="w-full !justify-start"
                      >
                        Valider
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsRejetModalOpen(true)}
                        disabled={statutMutation.isPending}
                        leftIcon={<AlertCircle size={12} />}
                        className="w-full !justify-start"
                      >
                        Rejeter
                      </Button>
                    </>
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
        {tache.description && (
          <Card title="Description">
            <p className="text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">
              {tache.description}
            </p>
          </Card>
        )}

        {/* Commentaires */}
        <Card>
          <CommentairesSection tacheId={tacheId} />
        </Card>

        {/* Pièces jointes */}
        <Card>
          <PiecesJointesSection tacheId={tacheId} />
        </Card>
      </DetailPage>

      {/* Modales */}
      {peutModifierContenu && (
        <TacheFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          tache={tache}
        />
      )}

      <BlocageFormModal
        isOpen={isBlocageModalOpen}
        onClose={() => setIsBlocageModalOpen(false)}
        tacheId={tacheId}
      />

      {isReattributionOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h3 className="text-base font-semibold text-ink-900 mb-1">
              Réattribuer la tâche
            </h3>
            <p className="text-[12px] text-ink-500 mb-4">
              Responsable actuel :{' '}
              <span className="text-ink-700 font-medium">
                {tache.responsable_detail?.nom_complet || 'Non assigné'}
              </span>
            </p>
            <MetaUserSelect
              icon={<UserCircle size={14} />}
              label="Nouveau responsable"
              currentUserId={tache.responsable}
              users={utilisateurs}
              onChange={(id) => {
                if (id > 0) assignerMutation.mutate(id)
              }}
              disabled={assignerMutation.isPending}
              allowNone={false}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsReattributionOpen(false)
                  setNouveauResponsable('')
                }}
              >
                Annuler
              </Button>
            </div>
          </Card>
        </div>
      )}

      <MotifModal
        isOpen={isAnnulationModalOpen}
        title="Annuler la tâche"
        description={`Vous allez annuler « ${tache.titre} ». Cette action est tracée dans l'historique.`}
        confirmLabel="Annuler la tâche"
        variant="danger"
        isPending={statutMutation.isPending}
        onConfirm={(motif) =>
          statutMutation.mutate({ statut: statutEnAttente, motif })
        }
        onCancel={() => {
          setIsAnnulationModalOpen(false)
          setStatutEnAttente('')
        }}
      />

      <MotifModal
        isOpen={isRejetModalOpen}
        title="Rejeter la tâche"
        description={`Vous allez renvoyer « ${tache.titre} » pour modification. Un motif est obligatoire.`}
        confirmLabel="Rejeter"
        variant="warning"
        isPending={statutMutation.isPending}
        onConfirm={(motif) =>
          statutMutation.mutate({ statut: statutEnAttente, motif })
        }
        onCancel={() => {
          setIsRejetModalOpen(false)
          setStatutEnAttente('')
        }}
      />

      <ReportEcheanceModal
        isOpen={isReportModalOpen}
        titreEntite={`Tâche : ${tache.titre}`}
        dateActuelle={tache.date_echeance}
        isPending={reportMutation.isPending}
        onConfirm={(dateEcheance, motif) =>
          reportMutation.mutate({ dateEcheance, motif })
        }
        onCancel={() => setIsReportModalOpen(false)}
      />

      {isRattacherOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <FolderKanban size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink-900">
                  Rattacher à une activité
                </h3>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Sélectionnez l'activité à laquelle rattacher cette tâche.
                </p>
              </div>
            </div>

            <EntitySelect
              items={activites.map((a) => ({
                id: a.id,
                label: a.titre,
                subtitle: `${a.statut_display} · ${a.priorite_display}`,
                searchText: a.description,
                filterValues: { statut: a.statut },
              }))}
              value={activiteAChoisir}
              onChange={(id) => setActiviteAChoisir(id)}
              placeholder="Sélectionner une activité"
              filters={[
                {
                  key: 'statut',
                  label: 'Tous les statuts',
                  options: [
                    { value: 'OUVERTE', label: 'Ouverte' },
                    { value: 'EN_COURS', label: 'En cours' },
                    { value: 'CLOTUREE', label: 'Clôturée' },
                  ],
                },
              ]}
              label="Activité"
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsRattacherOpen(false)
                  setActiviteAChoisir('')
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={() =>
                  activiteAChoisir &&
                  rattacherMutation.mutate(Number(activiteAChoisir))
                }
                disabled={!activiteAChoisir || rattacherMutation.isPending}
              >
                {rattacherMutation.isPending ? 'Rattachement...' : 'Rattacher'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Supprimer la tâche"
        message={`Vous allez supprimer « ${tache.titre} ». Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </Layout>
  )
}