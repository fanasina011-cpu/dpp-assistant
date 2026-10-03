/**
 * Page détail d'un blocage — v6.
 * Layout 2 colonnes, sidebar sticky.
 */

import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowUp,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  FileText,
  User,
  UserCircle,
  ShieldAlert,
} from 'lucide-react'
import Layout from '../components/Layout'
import DetailPage from '../components/detail/DetailPage'
import MetaGroup from '../components/detail/MetaGroup'
import MetaItem from '../components/detail/MetaItem'
import MetaSelect from '../components/detail/MetaSelect'
import MetaUserSelect from '../components/detail/MetaUserSelect'
import StatutBadge from '../components/StatutBadge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import {
  fetchBlocage,
  remonterBlocage,
  resoudreBlocage,
  updateBlocage,
  contesterBlocage,
  resoudreContestationBlocage,
} from '../api/blocages'
import { fetchUtilisateurs } from '../api/utilisateurs'
import BlocageEditModal from '../components/blocages/BlocageEditModal'
import MotifModal from '../components/communs/MotifModal'
import { useAuth } from '../context/AuthContext'
import {
  estChefDeService,
  estDirecteur as estDirecteurRole,
  usePermissions,
} from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'

const URGENCES = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'MOYENNE', label: 'Moyenne' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'CRITIQUE', label: 'Critique' },
]

export default function BlocageDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { roles } = usePermissions()
  const { showToast } = useToast()

  const blocageId = Number(id)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const {
    data: blocage,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['blocage', blocageId],
    queryFn: () => fetchBlocage(blocageId),
    enabled: !isNaN(blocageId),
  })

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => fetchUtilisateurs(),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blocage', blocageId] })
    queryClient.invalidateQueries({ queryKey: ['blocages'] })
    queryClient.invalidateQueries({ queryKey: ['taches'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const personneMutation = useMutation({
    mutationFn: (userId: number) =>
      updateBlocage(blocageId, {
        personne_sollicitee: userId > 0 ? userId : null,
      } as any),
    onSuccess: () => {
      invalidate()
      showToast('Personne sollicitée mise à jour', 'success')
    },
    onError: () => showToast('Impossible de modifier', 'error'),
  })

  const urgenceMutation = useMutation({
    mutationFn: (nouvelleUrgence: string) =>
      updateBlocage(blocageId, { niveau_urgence: nouvelleUrgence } as any),
    onSuccess: () => {
      invalidate()
      showToast("Niveau d'urgence mis à jour", 'success')
    },
    onError: () => showToast("Impossible de modifier l'urgence", 'error'),
  })

  const resoudreMutation = useMutation({
    mutationFn: () => resoudreBlocage(blocageId),
    onSuccess: () => {
      invalidate()
      showToast('Blocage résolu', 'success')
    },
    onError: (err: any) =>
      showToast(
        err?.response?.data?.detail || 'Impossible de résoudre ce blocage',
        'error',
      ),
  })

  const remonterMutation = useMutation({
    mutationFn: () => remonterBlocage(blocageId),
    onSuccess: () => {
      invalidate()
      showToast('Blocage remonté au Directeur', 'success')
    },
    onError: (err: any) =>
      showToast(
        err?.response?.data?.detail || 'Impossible de remonter ce blocage',
        'error',
      ),
  })

  const [isContestationModalOpen, setIsContestationModalOpen] = useState(false)

  const contesterMutation = useMutation({
    mutationFn: (motif: string) => contesterBlocage(blocageId, { motif }),
    onSuccess: () => {
      invalidate()
      setIsContestationModalOpen(false)
      showToast('Blocage contesté', 'success')
    },
    onError: (err: any) =>
      showToast(
        err?.response?.data?.detail || 'Impossible de contester ce blocage',
        'error',
      ),
  })

  const resoudreContestationMutation = useMutation({
    mutationFn: () => resoudreContestationBlocage(blocageId),
    onSuccess: () => {
      invalidate()
      showToast('Contestation résolue', 'success')
    },
    onError: (err: any) =>
      showToast(
        err?.response?.data?.detail || 'Impossible de résoudre cette contestation',
        'error',
      ),
  })

  if (isLoading) {
    return (
      <Layout title="Blocage">
        <div className="space-y-5">
          <div className="h-4 w-32 bg-ink-100 rounded animate-pulse" />
          <div className="h-8 w-2/3 bg-ink-100 rounded animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-6">
            <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
            <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !blocage) {
    return (
      <Layout title="Blocage">
        <Card>
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <p className="text-[13px] text-ink-700">
              Blocage introuvable ou accès refusé.
            </p>
            <Link
              to="/blocages"
              className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:underline mt-2"
            >
              ← Retour à la liste
            </Link>
          </div>
        </Card>
      </Layout>
    )
  }

  const estResolu = blocage.statut === 'RESOLU'
  const estRemonte = blocage.statut === 'REMONTE_AU_DIRECTEUR'

  // ============================================================
  // Permissions contextuelles
  // ============================================================
  // Peut modifier/résoudre/remonter : signaleur, personne sollicitée,
  // chef du service de la tâche, ou directeur
  //
  // D4 : le périmètre du chef délégué est `service_actuel`, pas `service`.
  const responsableTache = blocage.tache_detail?.responsable_detail

  const estSignaleur = user?.id === blocage.signale_par
  const estSollicite = user?.id === blocage.personne_sollicitee
  const estDirecteur = estDirecteurRole(roles)
  const estChefMemeService =
    estChefDeService(roles) &&
    !!user?.service_actuel &&
    responsableTache?.service === user.service_actuel

  const peutAgir =
    estSignaleur || estSollicite || estDirecteur || estChefMemeService
  const peutResoudre = peutAgir && !estResolu
  const peutRemonter = peutAgir && !estResolu && !estRemonte

  const estConteste = blocage.statut === 'CONTESTE'
  const peutContester =
    estSignaleur &&
    ['EN_ATTENTE', 'EN_TRAITEMENT', 'REMONTE_AU_DIRECTEUR'].includes(
      blocage.statut,
    ) &&
    blocage.date_signalement &&
    new Date(blocage.date_signalement).getTime() + 48 * 60 * 60 * 1000 >
      Date.now()
  const peutResoudreContestation = estDirecteur && estConteste

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const heuresRestantesContestation = blocage.date_signalement
    ? Math.max(
        0,
        Math.ceil(
          (new Date(blocage.date_signalement).getTime() +
            48 * 60 * 60 * 1000 -
            now) /
            60000,
        ),
      )
    : null

  const estEnRetard =
    blocage.date_limite_action &&
    new Date(blocage.date_limite_action).getTime() < now

  return (
    <Layout title="Détail du blocage">
      {estEnRetard && (
        <div className="mb-4 bg-warning-bg border border-warning-border rounded-lg p-3 flex items-center gap-2">
          <ShieldAlert size={16} className="text-warning shrink-0" />
          <p className="text-[13px] text-warning font-medium">
            Délai d'escalade dépassé. Ce blocage devrait être remonté au Directeur.
          </p>
        </div>
      )}
      <DetailPage
        breadcrumb={{ label: 'Retour aux blocages', to: '/blocages' }}
        title={blocage.tache_detail.titre}
        subtitle={`Blocage #${blocage.id}`}
        actions={
          <>
            {peutAgir && !estResolu && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsEditModalOpen(true)}
                leftIcon={<FileText size={13} />}
              >
                Modifier
              </Button>
            )}
            {peutContester && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsContestationModalOpen(true)}
                leftIcon={<ShieldAlert size={13} />}
              >
                Contester
              </Button>
            )}
            {peutResoudreContestation && (
              <Button
                variant="success"
                size="md"
                onClick={() => resoudreContestationMutation.mutate()}
                disabled={resoudreContestationMutation.isPending}
                leftIcon={<CheckCircle size={13} />}
              >
                {resoudreContestationMutation.isPending ? '...' : 'Résoudre la contestation'}
              </Button>
            )}
            {peutResoudre && (
              <Button
                variant="success"
                size="md"
                onClick={() => resoudreMutation.mutate()}
                disabled={resoudreMutation.isPending}
                leftIcon={<CheckCircle size={13} />}
              >
                {resoudreMutation.isPending ? '...' : 'Résoudre'}
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
                    statut={blocage.statut}
                    statutDisplay={blocage.statut_display}
                  />
                }
              />

              {peutAgir && !estResolu ? (
                <MetaSelect
                  icon={<AlertCircle size={14} />}
                  label="Urgence"
                  value={blocage.niveau_urgence_display}
                  currentValue={blocage.niveau_urgence}
                  options={URGENCES}
                  onChange={(v) => urgenceMutation.mutate(v)}
                  disabled={urgenceMutation.isPending}
                />
              ) : (
                <MetaItem
                  icon={<AlertCircle size={14} />}
                  label="Urgence"
                  value={blocage.niveau_urgence_display}
                />
              )}
            </MetaGroup>

            {/* PERSONNES */}
            <MetaGroup title="Personnes">
              <MetaItem
                icon={<User size={14} />}
                label="Signalé par"
                value={
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      name={blocage.signale_par_detail.nom_complet}
                      size="xs"
                    />
                    <span className="truncate">
                      {blocage.signale_par_detail.nom_complet}
                    </span>
                  </div>
                }
              />

              {peutAgir && !estResolu ? (
                <MetaUserSelect
                  icon={<UserCircle size={14} />}
                  label="Sollicité"
                  currentUserId={blocage.personne_sollicitee}
                  users={utilisateurs}
                  onChange={(id) => personneMutation.mutate(id)}
                  disabled={personneMutation.isPending}
                  allowNone
                />
              ) : (
                <MetaItem
                  icon={<UserCircle size={14} />}
                  label="Sollicité"
                  value={
                    blocage.personne_sollicitee_detail ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={blocage.personne_sollicitee_detail.nom_complet}
                          size="xs"
                        />
                        <span className="truncate">
                          {blocage.personne_sollicitee_detail.nom_complet}
                        </span>
                      </div>
                    ) : (
                      <span className="text-ink-400 italic text-[12px]">
                        Non assignée
                      </span>
                    )
                  }
                />
              )}

              {blocage.resolu_par_detail && (
                <MetaItem
                  icon={<CheckCircle size={14} />}
                  label="Résolu par"
                  value={
                    <div className="flex items-center gap-1.5">
                      <Avatar
                        name={blocage.resolu_par_detail.nom_complet}
                        size="xs"
                      />
                      <span className="truncate">
                        {blocage.resolu_par_detail.nom_complet}
                      </span>
                    </div>
                  }
                />
              )}
            </MetaGroup>

            {/* DATES */}
            <MetaGroup title="Dates">
              <MetaItem
                icon={<Calendar size={14} />}
                label="Signalé le"
                value={new Date(blocage.date_signalement).toLocaleDateString(
                  'fr-FR',
                  { day: '2-digit', month: 'short', year: 'numeric' },
                )}
              />
              {blocage.date_resolution && (
                <MetaItem
                  icon={<CheckCircle size={14} />}
                  label="Résolu le"
                  value={
                    <span className="text-success font-medium">
                      {new Date(blocage.date_resolution).toLocaleDateString(
                        'fr-FR',
                        { day: '2-digit', month: 'short', year: 'numeric' },
                      )}
                    </span>
                  }
                />
              )}
            </MetaGroup>

            {/* CONTESTATION */}
            {blocage.motif_contestation && (
              <MetaGroup title="Contestation">
                <MetaItem
                  icon={<ShieldAlert size={14} />}
                  label="Motif"
                  value={
                    <span className="text-ink-700 whitespace-pre-wrap">
                      {blocage.motif_contestation}
                    </span>
                  }
                />
                {blocage.date_contestation && (
                  <MetaItem
                    icon={<Calendar size={14} />}
                    label="Contesté le"
                    value={
                      <span className="text-ink-700">
                        {new Date(blocage.date_contestation).toLocaleDateString(
                          'fr-FR',
                          { day: '2-digit', month: 'short', year: 'numeric' },
                        )}
                      </span>
                    }
                  />
                )}
                {heuresRestantesContestation !== null && (
                  <MetaItem
                    icon={<Clock size={14} />}
                    label="Fenêtre restante"
                    value={
                      <span
                        className={
                          heuresRestantesContestation > 0
                            ? 'text-ink-700'
                            : 'text-danger font-medium'
                        }
                      >
                        {heuresRestantesContestation > 0
                          ? `${heuresRestantesContestation} min`
                          : 'Fermée'}
                      </span>
                    }
                  />
                )}
              </MetaGroup>
            )}

            {/* TÂCHE CONCERNÉE */}
            <MetaGroup title="Tâche concernée">
              <Link to={`/taches/${blocage.tache}`}>
                <MetaItem
                  icon={<FileText size={14} />}
                  label="Tâche"
                  value={blocage.tache_detail.titre}
                />
              </Link>
            </MetaGroup>

            {/* ACTIONS */}
            {peutAgir && (
              <MetaGroup title="Actions">
                <div className="space-y-1.5">
                  {peutResoudreContestation && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => resoudreContestationMutation.mutate()}
                      disabled={resoudreContestationMutation.isPending}
                      leftIcon={<CheckCircle size={12} />}
                      className="w-full !justify-start"
                    >
                      Résoudre la contestation
                    </Button>
                  )}
                  {peutResoudre && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => resoudreMutation.mutate()}
                      disabled={resoudreMutation.isPending}
                      leftIcon={<CheckCircle size={12} />}
                      className="w-full !justify-start"
                    >
                      Résoudre
                    </Button>
                  )}
                  {peutRemonter && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => remonterMutation.mutate()}
                      disabled={remonterMutation.isPending}
                      leftIcon={<ArrowUp size={12} />}
                      className="w-full !justify-start"
                    >
                      Remonter au Directeur
                    </Button>
                  )}
                </div>
              </MetaGroup>
            )}
          </>
        }
      >
        {/* Description */}
        <Card title="Description du blocage">
          <p className="text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">
            {blocage.description}
          </p>
        </Card>
      </DetailPage>

      {peutAgir && (
        <BlocageEditModal
          isOpen={isEditModalOpen}
          blocage={blocage}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      <MotifModal
        isOpen={isContestationModalOpen}
        title="Contester le blocage"
        description={`Vous allez contester le blocage sur « ${blocage.tache_detail.titre} ». Un motif est obligatoire.`}
        confirmLabel="Contester"
        variant="warning"
        isPending={contesterMutation.isPending}
        onConfirm={(motif) => contesterMutation.mutate(motif)}
        onCancel={() => setIsContestationModalOpen(false)}
      />
    </Layout>
  )
}
