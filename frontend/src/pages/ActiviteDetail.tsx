/**
 * Page détail d'une activité — v6.
 * Layout 2 colonnes, sidebar sticky, édition inline.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  Flag,
  Hash,
  Trash2,
  User,
  UserCircle,
  XCircle,
} from 'lucide-react'
import Layout from '../components/Layout'
import DetailPage from '../components/detail/DetailPage'
import MetaGroup from '../components/detail/MetaGroup'
import MetaItem from '../components/detail/MetaItem'
import MetaSelect from '../components/detail/MetaSelect'
import MetaDatePicker from '../components/detail/MetaDatePicker'
import MetaUserSelect from '../components/detail/MetaUserSelect'
import StatutBadge from '../components/StatutBadge'
import PrioriteBadge from '../components/PrioriteBadge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import {
  annulerActivite,
  cloturerActivite,
  deleteActivite,
  fetchActivite,
  reporterEcheanceActivite,
  updateActivite,
} from '../api/activites'
import ActiviteTachesSection from '../components/activites/ActiviteTachesSection'
import CommentairesSection from '../components/commentaires/CommentairesSection'
import MotifModal from '../components/communs/MotifModal'
import ConfirmDialog from '../components/communs/ConfirmDialog'
import ReportEcheanceModal from '../components/communs/ReportEcheanceModal'
import PiecesJointesSection from '../components/piecesJointes/PiecesJointesSection'
import ActiviteFormModal from '../components/activites/ActiviteFormModal'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { fetchUtilisateurs } from '../api/utilisateurs'

const STATUTS = [
  { value: 'OUVERTE', label: 'Ouverte', icon: <Circle size={12} /> },
  { value: 'EN_COURS', label: 'En cours', icon: <Clock size={12} /> },
  { value: 'CLOTUREE', label: 'Clôturée', icon: <CheckCircle size={12} /> },
  { value: 'ANNULEE', label: 'Annulée', icon: <XCircle size={12} /> },
]

const PRIORITES = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
]

export default function ActiviteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { can } = usePermissions()

  const activiteId = Number(id)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAnnulationModalOpen, setIsAnnulationModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => fetchUtilisateurs(),
  })

  const {
    data: activite,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['activite', activiteId],
    queryFn: () => fetchActivite(activiteId),
    enabled: !isNaN(activiteId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['activite', activiteId] })
    queryClient.invalidateQueries({ queryKey: ['activites'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const cloturerMutation = useMutation({
    mutationFn: () => cloturerActivite(activiteId),
    onSuccess: () => {
      invalidate()
      showToast('Activité clôturée', 'success')
    },
    onError: (err: any) =>
      showToast(
        err?.response?.data?.detail || "Impossible de clôturer l'activité",
        'error',
      ),
  })

  const reportMutation = useMutation({
    mutationFn: (args: { dateEcheance: string; motif: string }) =>
      reporterEcheanceActivite(activiteId, args.dateEcheance, args.motif),
    onSuccess: () => {
      invalidate()
      setIsReportModalOpen(false)
      showToast('Échéance reportée', 'success')
    },
    onError: () => showToast("Impossible de reporter l'échéance", 'error'),
  })

  const annulerMutation = useMutation({
    mutationFn: (motif: string) => annulerActivite(activiteId, motif),
    onSuccess: () => {
      invalidate()
      setIsAnnulationModalOpen(false)
      showToast('Activité annulée', 'success')
    },
    onError: () => showToast("Impossible d'annuler l'activité", 'error'),
  })

  const statutMutation = useMutation({
    mutationFn: (nouveauStatut: string) =>
      updateActivite(activiteId, { statut: nouveauStatut } as any),
    onSuccess: () => {
      invalidate()
      showToast('Statut mis à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier le statut', 'error'),
  })

  const prioriteMutation = useMutation({
    mutationFn: (nouvellePriorite: string) =>
      updateActivite(activiteId, { priorite: nouvellePriorite } as any),
    onSuccess: () => {
      invalidate()
      showToast('Priorité mise à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier la priorité', 'error'),
  })

  const dateDebutMutation = useMutation({
    mutationFn: (dateDebut: string) =>
      updateActivite(activiteId, { date_debut: dateDebut } as any),
    onSuccess: () => {
      invalidate()
      showToast('Date de début mise à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier la date', 'error'),
  })

  const responsableMutation = useMutation({
    mutationFn: (responsableId: number) =>
      updateActivite(activiteId, { responsable: responsableId } as any),
    onSuccess: () => {
      invalidate()
      showToast('Responsable mis à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier le responsable', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteActivite(activiteId),
    onSuccess: () => {
      invalidate()
      showToast('Activité supprimée', 'success')
      navigate('/activites')
    },
    onError: () => showToast("Impossible de supprimer l'activité", 'error'),
  })

  if (isLoading) {
    return (
      <Layout title="Activité">
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

  if (error || !activite) {
    return (
      <Layout title="Activité">
        <Card>
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <p className="text-[13px] text-ink-700">
              Activité introuvable ou accès refusé.
            </p>
            <Link
              to="/activites"
              className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:underline mt-2"
            >
              ← Retour à la liste
            </Link>
          </div>
        </Card>
      </Layout>
    )
  }

  const estCloturee = activite.statut === 'CLOTUREE'
  const estAnnulee = activite.statut === 'ANNULEE'
  const peutEtreCloturee =
    activite.peut_etre_cloturee && !estCloturee && !estAnnulee

  // Permissions contextuelles
  const peutModifier = can.editActivite(activite)
  const peutSupprimer = can.deleteActivite(activite)

  return (
    <Layout title="Détail de l'activité">
      <DetailPage
        breadcrumb={{ label: 'Retour aux activités', to: '/activites' }}
        title={activite.titre}
        actions={
          <>
            {peutModifier && peutEtreCloturee && (
              <Button
                variant="success"
                size="md"
                onClick={() => cloturerMutation.mutate()}
                disabled={cloturerMutation.isPending}
                leftIcon={<CheckCircle size={13} />}
              >
                {cloturerMutation.isPending ? '...' : 'Clôturer'}
              </Button>
            )}
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
              {peutModifier ? (
                <MetaSelect
                  icon={<Circle size={14} />}
                  label="Statut"
                  value={activite.statut_display}
                  currentValue={activite.statut}
                  options={STATUTS.map((s) => ({
                    value: s.value,
                    label: s.label,
                    icon: s.icon,
                  }))}
                  onChange={(v) => statutMutation.mutate(v)}
                  disabled={statutMutation.isPending}
                />
              ) : (
                <MetaItem
                  icon={<Circle size={14} />}
                  label="Statut"
                  value={
                    <StatutBadge
                      statut={activite.statut}
                      statutDisplay={activite.statut_display}
                    />
                  }
                />
              )}

              {peutModifier ? (
                <MetaSelect
                  icon={<Flag size={14} />}
                  label="Priorité"
                  value={activite.priorite_display}
                  currentValue={activite.priorite}
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
                      priorite={activite.priorite}
                      prioriteDisplay={activite.priorite_display}
                    />
                  }
                />
              )}
            </MetaGroup>

            {/* PERSONNES */}
            <MetaGroup title="Personnes">
              {peutModifier ? (
                <MetaUserSelect
                  icon={<UserCircle size={14} />}
                  label="Responsable"
                  currentUserId={activite.responsable}
                  users={utilisateurs}
                  onChange={(id) => {
                    if (id > 0) responsableMutation.mutate(id)
                  }}
                  disabled={responsableMutation.isPending}
                />
              ) : (
                <MetaItem
                  icon={<UserCircle size={14} />}
                  label="Responsable"
                  value={
                    activite.responsable_detail ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={activite.responsable_detail.nom_complet}
                          size="xs"
                        />
                        <span className="truncate">
                          {activite.responsable_detail.nom_complet}
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
                      name={activite.createur_detail.nom_complet}
                      size="xs"
                    />
                    <span className="truncate">
                      {activite.createur_detail.nom_complet}
                    </span>
                  </div>
                }
              />
            </MetaGroup>

            {/* DATES */}
            <MetaGroup title="Dates">
              {peutModifier ? (
                <MetaDatePicker
                  icon={<Calendar size={14} />}
                  label="Début"
                  value={activite.date_debut}
                  onChange={(iso) => dateDebutMutation.mutate(iso)}
                  disabled={dateDebutMutation.isPending}
                />
              ) : (
                <MetaItem
                  icon={<Calendar size={14} />}
                  label="Début"
                  value={
                    activite.date_debut ? (
                      <span className="tabular-nums">
                        {new Date(activite.date_debut).toLocaleDateString(
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
                />
              )}

              <MetaItem
                icon={<Clock size={14} />}
                label="Échéance"
                value={
                  activite.date_echeance ? (
                    <span className="tabular-nums">
                      {new Date(activite.date_echeance).toLocaleDateString(
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
                onClick={peutModifier ? () => setIsReportModalOpen(true) : undefined}
              />
            </MetaGroup>

            {/* ACTIONS — n'affiche que si au moins un bouton est visible */}
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

                  {peutModifier && !estCloturee && !estAnnulee && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAnnulationModalOpen(true)}
                      leftIcon={<XCircle size={12} />}
                      className="w-full !justify-start"
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
        {activite.description && (
          <Card title="Description">
            <p className="text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">
              {activite.description}
            </p>
          </Card>
        )}

        {/* Tâches rattachées */}
        <ActiviteTachesSection activite={activite} />

        {/* Commentaires */}
        <Card>
          <CommentairesSection activiteId={activiteId} />
        </Card>

        {/* Pièces jointes */}
        <Card>
          <PiecesJointesSection activiteId={activiteId} />
        </Card>
      </DetailPage>

      {/* Modales — conditionnelles */}
      {peutModifier && (
        <ActiviteFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          activite={activite}
        />
      )}

      <MotifModal
        isOpen={isAnnulationModalOpen}
        title="Annuler l'activité"
        description={`Vous allez annuler « ${activite.titre} ».`}
        confirmLabel="Annuler l'activité"
        variant="danger"
        isPending={annulerMutation.isPending}
        onConfirm={(motif) => annulerMutation.mutate(motif)}
        onCancel={() => setIsAnnulationModalOpen(false)}
      />

      <ReportEcheanceModal
        isOpen={isReportModalOpen}
        titreEntite={`Activité : ${activite.titre}`}
        dateActuelle={activite.date_echeance}
        isPending={reportMutation.isPending}
        onConfirm={(dateEcheance, motif) =>
          reportMutation.mutate({ dateEcheance, motif })
        }
        onCancel={() => setIsReportModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Supprimer l'activité"
        message={`Vous allez supprimer « ${activite.titre} ». Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </Layout>
  )
}