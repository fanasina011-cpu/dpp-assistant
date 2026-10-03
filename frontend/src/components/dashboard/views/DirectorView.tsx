/**
 * Dashboard — Vue DIRECTION.
 *
 * Centré sur : décisions requises, pilotage stratégique, vue d'ensemble.
 * Répond à la question : "Qu'est-ce qui requiert MA décision ?"
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FolderKanban,
  Gavel,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import AttentionBanner, { AttentionItem } from '../AttentionBanner'
import KpiStat from '../KpiStat'
import ProgressBar from '../ProgressBar'
import UrgenceBadge from '../../UrgenceBadge'
import Avatar from '../../ui/Avatar'
import Card from '../../ui/Card'
import type { DashboardData } from '../../../api/dashboard'

interface DirectorViewProps {
  data: DashboardData
  userNom: string
}

/** Formate une date relative simple */
function formatRelatif(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffJ = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  if (diffJ === 1) return 'hier'
  if (diffJ < 7) return `il y a ${diffJ} j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function SectionHeader({
  icon,
  title,
  to,
  count,
}: {
  icon: React.ReactNode
  title: string
  to: string
  count?: number
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[14px] font-semibold text-ink-900 flex items-center gap-2">
        {icon}
        {title}
        {typeof count === 'number' && count > 0 && (
          <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
            {count}
          </span>
        )}
      </h3>
      <Link
        to={to}
        className="text-[11px] text-ink-500 hover:text-brand-600 transition-colors inline-flex items-center gap-0.5"
      >
        Voir tout
        <ArrowRight size={11} />
      </Link>
    </div>
  )
}

function EmptyState({
  message,
  icon,
}: {
  message: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-ink-400">
      {icon}
      <p className="text-[12px]">{message}</p>
    </div>
  )
}

export default function DirectorView({ data, userNom }: DirectorViewProps) {
  const {
    kpis,
    taches_retard,
    blocages_urgents,
    dernieres_notifications,
    evenements_jour,
    delegations_actives,
  } = data

  // ---- Zone d'attention : décisions requises par la Direction ----
  const attention = useMemo(() => {
    const items: AttentionItem[] = []

    // Blocages remontés au Directeur = décision requise
    const blocagesRemontes = blocages_urgents.filter(
      (b) => b.statut === 'REMONTE_AU_DIRECTEUR',
    )
    if (blocagesRemontes.length > 0) {
      items.push({
        id: 'blocages_remontes',
        label: `Blocage${blocagesRemontes.length > 1 ? 's' : ''} remonté${blocagesRemontes.length > 1 ? 's' : ''} à votre arbitrage`,
        count: blocagesRemontes.length,
        to: '/blocages',
        variant: 'danger',
      })
    }

    // Demandes de réouverture CRQ à valider
    if (kpis.demandes_crq_attente > 0) {
      items.push({
        id: 'crq',
        label: `Demande${kpis.demandes_crq_attente > 1 ? 's' : ''} de réouverture CRQ à valider`,
        count: kpis.demandes_crq_attente,
        to: '/crq',
        variant: 'warning',
      })
    }

    // Tâches critiques en retard (uniquement si > 3, sinon c'est du bruit)
    if (kpis.taches_en_retard >= 3) {
      items.push({
        id: 'retard',
        label: `Tâches en retard dans l'organisation`,
        count: kpis.taches_en_retard,
        to: '/taches',
        variant: 'warning',
      })
    }

    return items
  }, [blocages_urgents, kpis])

  // ---- Statistiques dérivées pour pilotage ----
  const services = useMemo(() => {
    // Vue synthétique par service (calcul client-side car le backend renvoie
    // une liste plate de tâches). On regroupe par `responsable_detail.service`
    // si disponible, sinon on affiche "Non affecté".
    const map = new Map<
      string,
      { total: number; enRetard: number; terminees: number }
    >()
    const toutes = [...data.mes_taches, ...taches_retard]

    toutes.forEach((t) => {
      const service = t.responsable_detail?.service || 'Non affecté'
      const entry = map.get(service) || {
        total: 0,
        enRetard: 0,
        terminees: 0,
      }
      entry.total += 1
      if (t.est_en_retard) entry.enRetard += 1
      if (t.statut === 'TERMINEE') entry.terminees += 1
      map.set(service, entry)
    })

    return Array.from(map.entries())
      .map(([service, stats]) => ({
        service,
        ...stats,
        pctTermine:
          stats.total === 0
            ? 0
            : Math.round((stats.terminees / stats.total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
  }, [data.mes_taches, taches_retard])

  return (
    <div className="space-y-5">
      {/* ===== ① Salutation ===== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900 leading-tight">
            Bonjour, {userNom.split(' ')[0]}
          </h1>
          <p className="text-[13px] text-ink-500 mt-1">
            {attention.length > 0
              ? `${attention.length} élément${attention.length > 1 ? 's' : ''} requièrent votre décision.`
              : 'Aucune décision en attente. Bonne journée.'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200 px-2 py-1 rounded">
          <Eye size={11} />
          Vue Direction
        </span>
      </div>

      {/* ===== ② Zone d'attention ===== */}
      {attention.length > 0 ? (
        <AttentionBanner
          variant={
            attention.some((a) => a.variant === 'danger') ? 'danger' : 'warning'
          }
          title={`${attention.length} élément${attention.length > 1 ? 's' : ''} en attente de votre décision`}
          items={attention}
        />
      ) : (
        <AttentionBanner
          variant="success"
          title="Aucune décision en attente"
          message="Tout est à jour au niveau de la Direction."
        />
      )}

      {/* ===== ③ KPIs stratégiques ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiStat
          label="Décisions en attente"
          value={
            attention
              .filter(
                (a) => a.id === 'blocages_remontes' || a.id === 'crq',
              )
              .reduce((sum, a) => sum + (a.count || 0), 0)
          }
          to="/blocages"
          color="danger"
          icon={<Gavel size={18} />}
          hint="arbitrage requis"
        />
        <KpiStat
          label="Tâches en retard"
          value={kpis.taches_en_retard}
          to="/taches"
          color="warning"
          icon={<AlertCircle size={18} />}
          hint="dans l'organisation"
        />
        <KpiStat
          label="Blocages ouverts"
          value={kpis.blocages_urgents}
          to="/blocages"
          color="danger"
          icon={<ShieldAlert size={18} />}
          hint="en cours de traitement"
        />
        <KpiStat
          label="Tâches en cours"
          value={kpis.taches_en_cours}
          to="/taches"
          color="info"
          icon={<Activity size={18} />}
          hint="activité de l'organisation"
        />
      </div>

      {/* ===== ④ Décisions + Notifications (visible en haut) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Décisions à traiter */}
        <Card className="lg:col-span-3">
          <SectionHeader
            icon={<Gavel size={14} className="text-ink-400" />}
            title="À arbitrer"
            to="/blocages"
            count={attention.filter(
              (a) => a.id === 'blocages_remontes' || a.id === 'crq',
            ).reduce((s, a) => s + (a.count || 0), 0)}
          />
          {blocages_urgents.filter(
            (b) => b.statut === 'REMONTE_AU_DIRECTEUR',
          ).length === 0 &&
          kpis.demandes_crq_attente === 0 ? (
            <EmptyState
              message="Aucune décision en attente."
              icon={<CheckCircle2 size={28} strokeWidth={1.25} />}
            />
          ) : (
            <ul className="space-y-2">
              {blocages_urgents
                .filter((b) => b.statut === 'REMONTE_AU_DIRECTEUR')
                .slice(0, 3)
                .map((b) => (
                  <li key={`b-${b.id}`}>
                    <Link
                      to={`/blocages/${b.id}`}
                      className="block border border-danger-border bg-danger-bg/30 rounded-md p-3 hover:bg-danger-bg/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Gavel size={12} className="text-danger shrink-0" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-danger">
                            Blocage remonté
                          </span>
                        </div>
                        <UrgenceBadge
                          niveau={b.niveau_urgence}
                          niveauDisplay={b.niveau_urgence_display}
                        />
                      </div>
                      <p className="text-[13px] font-medium text-ink-900 mb-1 truncate">
                        {b.tache_detail.titre}
                      </p>
                      <p className="text-[11px] text-ink-600 line-clamp-1">
                        {b.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-500">
                        <Avatar
                          name={b.signale_par_detail.nom_complet}
                          size="xs"
                        />
                        <span>{b.signale_par_detail.nom_complet}</span>
                        <span className="text-ink-300">·</span>
                        <span>{formatRelatif(b.date_signalement)}</span>
                      </div>
                    </Link>
                  </li>
                ))}

              {kpis.demandes_crq_attente > 0 && (
                <li>
                  <Link
                    to="/crq"
                    className="block border border-warning-border bg-warning-bg/30 rounded-md p-3 hover:bg-warning-bg/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ClipboardCheck size={12} className="text-warning" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Validation CRQ
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-900">
                      {kpis.demandes_crq_attente} demande
                      {kpis.demandes_crq_attente > 1 ? 's' : ''} de réouverture
                      en attente de validation
                    </p>
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>

        {/* Notifications visibles */}
        <Card className="lg:col-span-2">
          <SectionHeader
            icon={<Bell size={14} className="text-ink-400" />}
            title="Notifications"
            to="/notifications"
            count={kpis.notifications_non_lues}
          />
          {dernieres_notifications.length === 0 ? (
            <EmptyState
              message="Aucune notification."
              icon={<Bell size={28} strokeWidth={1.25} />}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {dernieres_notifications.slice(0, 5).map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0"
                >
                  <div className="pt-1 w-1.5 shrink-0">
                    {!n.lue && (
                      <span className="block w-1.5 h-1.5 rounded-full bg-brand-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-ink-500">
                        {n.type_display}
                      </span>
                      <span className="text-[9px] text-ink-400">
                        {formatRelatif(n.date_creation)}
                      </span>
                    </div>
                    <p
                      className={`text-[12px] leading-snug line-clamp-2 ${
                        n.lue ? 'text-ink-600' : 'text-ink-900 font-medium'
                      }`}
                    >
                      {n.message}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ===== ⑤ Pilotage : services + activités ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vue par service */}
        <Card>
          <SectionHeader
            icon={<Users size={14} className="text-ink-400" />}
            title="Charge par service"
            to="/utilisateurs"
          />
          {services.length === 0 ? (
            <EmptyState
              message="Aucune donnée par service."
              icon={<Users size={28} strokeWidth={1.25} />}
            />
          ) : (
            <div className="space-y-3.5">
              {services.slice(0, 5).map((s) => (
                <ProgressBar
                  key={s.service}
                  label={s.service}
                  value={s.pctTermine}
                  color={
                    s.enRetard > 0
                      ? 'warning'
                      : s.pctTermine >= 70
                        ? 'success'
                        : 'brand'
                  }
                  hint={`${s.total} tâche${s.total > 1 ? 's' : ''}${s.enRetard > 0 ? ` · ${s.enRetard} en retard` : ''}`}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Agenda du jour */}
        <Card>
          <SectionHeader
            icon={<Calendar size={14} className="text-ink-400" />}
            title="Agenda du jour"
            to="/agenda"
            count={evenements_jour.length}
          />
          {evenements_jour.length === 0 ? (
            <EmptyState
              message="Aucun événement aujourd'hui."
              icon={<Calendar size={28} strokeWidth={1.25} />}
            />
          ) : (
            <ul className="space-y-2">
              {evenements_jour.map((evt) => (
                <li
                  key={evt.id}
                  className="flex items-start gap-3 border border-ink-200 rounded-md p-2.5"
                >
                  <div className="flex flex-col items-center shrink-0 pt-0.5">
                    <span className="text-[11px] font-semibold text-ink-900 tabular-nums">
                      {new Date(evt.date_debut).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-[10px] text-ink-400 tabular-nums">
                      {new Date(evt.date_fin).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="w-px bg-ink-200 self-stretch" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          evt.niveau_priorite === 'DIRECTION'
                            ? 'bg-danger'
                            : 'bg-info'
                        }`}
                      />
                      <span className="text-[13px] font-medium text-ink-900 truncate">
                        {evt.titre}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-ink-500">
                      <span className="capitalize">
                        {evt.type_display.toLowerCase()}
                      </span>
                      {evt.participants_detail.length > 0 && (
                        <>
                          <span className="text-ink-300">·</span>
                          <span>
                            {evt.participants_detail.length} participant
                            {evt.participants_detail.length > 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ===== ⑥ Contexte : délégations actives ===== */}
      {delegations_actives.length > 0 && (
        <Card>
          <SectionHeader
            icon={<FolderKanban size={14} className="text-ink-400" />}
            title="Délégations actives"
            to="/delegations"
            count={delegations_actives.length}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {delegations_actives.map((d) => (
              <div
                key={d.id}
                className="border border-ink-200 rounded-md p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Avatar name={d.delegataire} size="xs" />
                    <span className="text-[12px] font-medium text-ink-900 truncate">
                      {d.delegataire}
                    </span>
                  </div>
                  <div className="text-[10px] text-ink-500 ml-7">
                    {d.role_delegue_display}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <Clock size={11} className="text-ink-400 mb-0.5" />
                  <span className="text-[10px] text-ink-500 whitespace-nowrap">
                    {new Date(d.date_fin).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===== ⑦ Tâches en retard (vue liste) ===== */}
      {taches_retard.length > 0 && (
        <Card>
          <SectionHeader
            icon={<TrendingUp size={14} className="text-danger" />}
            title="Tâches en retard à surveiller"
            to="/taches"
            count={taches_retard.length}
          />
          <ul className="divide-y divide-ink-100">
            {taches_retard.slice(0, 6).map((t) => (
              <li key={t.id} className="py-2 first:pt-0 last:pb-0">
                <Link
                  to={`/taches/${t.id}`}
                  className="flex items-center justify-between gap-3 hover:bg-ink-50/50 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                    <span className="text-[13px] text-ink-900 truncate">
                      {t.titre}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {t.responsable_detail && (
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={t.responsable_detail.nom_complet}
                          size="xs"
                        />
                        <span className="text-[11px] text-ink-600 hidden md:inline">
                          {t.responsable_detail.nom_complet}
                        </span>
                      </div>
                    )}
                    {t.date_echeance && (
                      <span className="text-[11px] text-danger font-medium tabular-nums">
                        {new Date(t.date_echeance).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}