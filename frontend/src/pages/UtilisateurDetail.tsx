/**
 * Page détail d'un utilisateur — v6.
 * Charge de travail, tâches assignées, activités responsables.
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  FolderKanban,
  Hash,
  Inbox,
  Mail,
  Shield,
  ShieldCheck,
  ShieldX,
  User as UserIcon,
} from 'lucide-react'
import Layout from '../components/Layout'
import DetailPage from '../components/detail/DetailPage'
import MetaGroup from '../components/detail/MetaGroup'
import MetaItem from '../components/detail/MetaItem'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ProgressBar from '../components/dashboard/ProgressBar'
import StatutBadge from '../components/StatutBadge'
import PrioriteBadge from '../components/PrioriteBadge'
import { fetchUtilisateur } from '../api/utilisateurs'
import { fetchTaches } from '../api/taches'
import { fetchActivites } from '../api/activites'
import type { Activite, Tache } from '../types'

/** Badge statut utilisateur (actif / inactif) */
function UtilisateurStatutBadge({ actif }: { actif: boolean }) {
  if (actif) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-success-bg text-success border-success-border">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Actif
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-ink-100 text-ink-500 border-ink-200">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-400" />
      Inactif
    </span>
  )
}

/** Tâche compacte */
function TacheRow({ tache }: { tache: Tache }) {
  return (
    <Link
      to={`/taches/${tache.id}`}
      className="flex items-center gap-3 px-3 py-2.5 border border-ink-200 rounded-md hover:bg-ink-50/60 hover:border-ink-300 transition-colors group"
    >
      <StatutBadge statut={tache.statut} statutDisplay={tache.statut_display} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-ink-900 truncate group-hover:text-brand-600 transition-colors">
          {tache.titre}
        </div>
        {tache.date_echeance && (
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-500">
            <span
              className={`tabular-nums ${
                tache.est_en_retard ? 'text-danger font-semibold' : ''
              }`}
            >
              {new Date(tache.date_echeance).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {tache.est_en_retard && (
              <span className="text-[10px] font-semibold text-danger inline-flex items-center gap-0.5">
                <AlertCircle size={10} />
                En retard
              </span>
            )}
          </div>
        )}
      </div>
      <PrioriteBadge
        priorite={tache.priorite}
        prioriteDisplay={tache.priorite_display}
      />
    </Link>
  )
}

/** Activité compacte */
function ActiviteRow({ activite }: { activite: Activite }) {
  return (
    <Link
      to={`/activites/${activite.id}`}
      className="flex items-center gap-3 px-3 py-2.5 border border-ink-200 rounded-md hover:bg-ink-50/60 hover:border-ink-300 transition-colors group"
    >
      <StatutBadge
        statut={activite.statut}
        statutDisplay={activite.statut_display}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-ink-900 truncate group-hover:text-brand-600 transition-colors">
          {activite.titre}
        </div>
        {activite.date_echeance && (
          <div className="text-[11px] text-ink-500 mt-0.5 tabular-nums">
            Échéance{' '}
            {new Date(activite.date_echeance).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        )}
      </div>
      <PrioriteBadge
        priorite={activite.priorite}
        prioriteDisplay={activite.priorite_display}
      />
    </Link>
  )
}

export default function UtilisateurDetail() {
  const { id } = useParams<{ id: string }>()
  const utilisateurId = Number(id)

  const {
    data: utilisateur,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['utilisateur', utilisateurId],
    queryFn: () => fetchUtilisateur(utilisateurId),
    enabled: !isNaN(utilisateurId),
  })

  const { data: taches = [], isLoading: isLoadingTaches } = useQuery({
    queryKey: ['taches', 'responsable', utilisateurId],
    queryFn: () => fetchTaches({ responsable: utilisateurId }),
    enabled: !isNaN(utilisateurId),
  })

  const { data: activites = [], isLoading: isLoadingActivites } = useQuery({
    queryKey: ['activites', 'responsable', utilisateurId],
    queryFn: () => fetchActivites({ responsable: utilisateurId }),
    enabled: !isNaN(utilisateurId),
  })

  if (isLoading) {
    return (
      <Layout title="Utilisateur">
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

  if (error || !utilisateur) {
    return (
      <Layout title="Utilisateur">
        <Card>
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <p className="text-[13px] text-ink-700">
              Utilisateur introuvable ou accès refusé.
            </p>
            <Link
              to="/utilisateurs"
              className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:underline mt-2"
            >
              ← Retour aux utilisateurs
            </Link>
          </div>
        </Card>
      </Layout>
    )
  }

  // Stats sur les tâches
  const tachesActives = taches.filter(
    (t) => t.statut !== 'TERMINEE' && t.statut !== 'ANNULEE',
  )
  const tachesEnRetard = taches.filter((t) => t.est_en_retard)
  const tachesTerminees = taches.filter((t) => t.statut === 'TERMINEE')
  const tauxCompletion =
    taches.length === 0
      ? 0
      : Math.round((tachesTerminees.length / taches.length) * 100)

  const dateInscription = utilisateur.date_joined
    ? new Date(utilisateur.date_joined).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

  return (
    <Layout title="Détail de l'utilisateur">
      <DetailPage
        breadcrumb={{ label: 'Retour aux utilisateurs', to: '/utilisateurs' }}
        title={utilisateur.nom_complet}
        subtitle={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Shield size={12} className="text-ink-400" />
              {utilisateur.role_display}
            </span>
            {utilisateur.service && (
              <>
                <span className="text-ink-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={12} className="text-ink-400" />
                  {utilisateur.service}
                </span>
              </>
            )}
          </div>
        }
             badges={<UtilisateurStatutBadge actif={utilisateur.is_active} />}
        sidebar={
          <>
            {/* ÉTAT */}
            <MetaGroup title="État">
              <MetaItem
                icon={
                  utilisateur.is_active ? (
                    <ShieldCheck size={14} className="text-success" />
                  ) : (
                    <ShieldX size={14} className="text-ink-400" />
                  )
                }
                label="Statut"
                value={utilisateur.is_active ? 'Actif' : 'Inactif'}
              />
              <MetaItem
                icon={<Shield size={14} />}
                label="Rôle"
                value={utilisateur.role_display}
              />
              {utilisateur.service && (
                <MetaItem
                  icon={<Building2 size={14} />}
                  label="Service"
                  value={utilisateur.service}
                />
              )}
            </MetaGroup>

            {/* CONTACT */}
            <MetaGroup title="Contact">
              <MetaItem
                icon={<UserIcon size={14} />}
                label="Nom d'utilisateur"
                value={`@${utilisateur.username}`}
              />
              <MetaItem
                icon={<Mail size={14} />}
                label="Email"
                value={
                  utilisateur.email || (
                    <span className="text-ink-400 italic text-[12px]">
                      Non renseigné
                    </span>
                  )
                }
              />
            </MetaGroup>

            {/* DATES */}
            <MetaGroup title="Dates">
              <MetaItem
                icon={<Calendar size={14} />}
                label="Inscrit le"
                value={dateInscription}
              />
            </MetaGroup>

            {/* ACTIONS */}
            <MetaGroup title="Actions">
              <div className="space-y-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled
                  leftIcon={<Hash size={12} />}
                  className="w-full !justify-start"
                  title="Bientôt disponible"
                >
                  Modifier
                </Button>
                <div className="px-2 py-1.5 text-[10px] text-ink-400 leading-relaxed">
                  Pour désactiver ce compte, utilisez la liste des utilisateurs.
                </div>
              </div>
            </MetaGroup>
          </>
        }
      >
        {/* Charge de travail */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-ink-400" />
            <h3 className="text-[14px] font-semibold text-ink-900">
              Charge de travail
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500 font-medium mb-1">
                Tâches actives
              </div>
              <div className="text-[22px] font-semibold text-info tabular-nums leading-none">
                {tachesActives.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500 font-medium mb-1">
                En retard
              </div>
              <div
                className={`text-[22px] font-semibold tabular-nums leading-none ${
                  tachesEnRetard.length > 0 ? 'text-danger' : 'text-ink-400'
                }`}
              >
                {tachesEnRetard.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500 font-medium mb-1">
                Terminées
              </div>
              <div className="text-[22px] font-semibold text-success tabular-nums leading-none">
                {tachesTerminees.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500 font-medium mb-1">
                Activités
              </div>
              <div className="text-[22px] font-semibold text-brand-600 tabular-nums leading-none">
                {activites.length}
              </div>
            </div>
          </div>

          {taches.length > 0 && (
            <ProgressBar
              label="Taux de complétion"
              value={tauxCompletion}
              color={
                tauxCompletion >= 70
                  ? 'success'
                  : tauxCompletion >= 40
                    ? 'brand'
                    : 'warning'
              }
              hint={`${tachesTerminees.length} terminée${tachesTerminees.length > 1 ? 's' : ''} sur ${taches.length} tâche${taches.length > 1 ? 's' : ''}`}
            />
          )}
        </Card>

        {/* Tâches assignées */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={14} className="text-ink-400" />
            <h3 className="text-[14px] font-semibold text-ink-900">
              Tâches assignées
            </h3>
            {taches.length > 0 && (
              <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
                {taches.length}
              </span>
            )}
          </div>

          {isLoadingTaches ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="border border-ink-100 rounded-md p-3 flex items-center gap-3 animate-pulse"
                >
                  <div className="w-16 h-5 bg-ink-100 rounded" />
                  <div className="flex-1 h-3 bg-ink-100 rounded" />
                </div>
              ))}
            </div>
          ) : taches.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-ink-400">
              <Inbox size={32} strokeWidth={1.25} />
              <p className="text-[12px]">Aucune tâche assignée.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {tachesActives.slice(0, 8).map((t) => (
                <TacheRow key={t.id} tache={t} />
              ))}
              {tachesActives.length > 8 && (
                <Link
                  to="/taches"
                  className="block text-center text-[11px] text-brand-600 hover:underline pt-2"
                >
                  Voir les {tachesActives.length - 8} autres tâches →
                </Link>
              )}
              {tachesActives.length === 0 && taches.length > 0 && (
                <p className="text-[12px] text-ink-500 text-center py-4">
                  Toutes les tâches assignées sont terminées.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Activités responsables */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <FolderKanban size={14} className="text-ink-400" />
            <h3 className="text-[14px] font-semibold text-ink-900">
              Activités responsables
            </h3>
            {activites.length > 0 && (
              <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
                {activites.length}
              </span>
            )}
          </div>

          {isLoadingActivites ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="border border-ink-100 rounded-md p-3 flex items-center gap-3 animate-pulse"
                >
                  <div className="w-16 h-5 bg-ink-100 rounded" />
                  <div className="flex-1 h-3 bg-ink-100 rounded" />
                </div>
              ))}
            </div>
          ) : activites.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-ink-400">
              <FolderKanban size={32} strokeWidth={1.25} />
              <p className="text-[12px]">
                Aucune activité dont il est responsable.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {activites.map((a) => (
                <ActiviteRow key={a.id} activite={a} />
              ))}
            </div>
          )}
        </Card>
      </DetailPage>
    </Layout>
  )
}