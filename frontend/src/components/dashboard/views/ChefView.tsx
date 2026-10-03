/**
 * Dashboard — Vue CHEF DE SERVICE.
 *
 * Centré sur : pilotage de l'équipe, charge des membres, blocages du périmètre,
 * instructions à traiter. Répond à : "Comment va mon service aujourd'hui ?"
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
  ClipboardList,
  FileText,
  Inbox,
  ShieldAlert,
  Users,
} from 'lucide-react'
import AttentionBanner, { AttentionItem } from '../AttentionBanner'
import KpiStat from '../KpiStat'
import ProgressBar from '../ProgressBar'
import UrgenceBadge from '../../UrgenceBadge'
import StatutBadge from '../../StatutBadge'
import PrioriteBadge from '../../PrioriteBadge'
import Avatar from '../../ui/Avatar'
import Card from '../../ui/Card'
import type { DashboardData } from '../../../api/dashboard'
import type { Tache } from '../../../types'

interface ChefViewProps {
  data: DashboardData
  userNom: string
  userId: number
}

/** Formatage date relative */
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

export default function ChefView({ data, userNom }: ChefViewProps) {
  const {
    kpis,
    taches_retard,
    blocages_urgents,
    dernieres_notifications,
    evenements_jour,
    mes_taches,
  } = data

  // ---- Charge de l'équipe : regroupée par membre ----
  const chargeEquipe = useMemo(() => {
    const map = new Map<
      number,
      {
        id: number
        nom: string
        total: number
        enCours: number
        enRetard: number
        terminees: number
      }
    >()

    // On parcourt toutes les tâches connues (mes_taches + retards)
    const toutes = [...mes_taches, ...taches_retard]

    toutes.forEach((t: Tache) => {
      const r = t.responsable_detail
      if (!r) return
      const entry = map.get(r.id) || {
        id: r.id,
        nom: r.nom_complet,
        total: 0,
        enCours: 0,
        enRetard: 0,
        terminees: 0,
      }
      entry.total += 1
      if (t.statut === 'EN_COURS') entry.enCours += 1
      if (t.est_en_retard) entry.enRetard += 1
      if (t.statut === 'TERMINEE') entry.terminees += 1
      map.set(r.id, entry)
    })

    return Array.from(map.values()).sort((a, b) => {
      // Les personnes en retard d'abord, puis par charge totale
      if (a.enRetard !== b.enRetard) return b.enRetard - a.enRetard
      return b.total - a.total
    })
  }, [mes_taches, taches_retard])

  // ---- Blocages à traiter (dans le périmètre du chef) ----
  const blocagesATraiter = useMemo(
    () =>
      blocages_urgents.filter(
        (b) =>
          b.statut === 'EN_ATTENTE' || b.statut === 'EN_TRAITEMENT',
      ),
    [blocages_urgents],
  )

  // ---- Zone d'attention ----
  const attention = useMemo(() => {
    const items: AttentionItem[] = []

    const totalRetardsEquipe = chargeEquipe.reduce(
      (sum, m) => sum + m.enRetard,
      0,
    )
    if (totalRetardsEquipe > 0) {
      items.push({
        id: 'retards_equipe',
        label: `Tâche${totalRetardsEquipe > 1 ? 's' : ''} en retard dans mon périmètre`,
        count: totalRetardsEquipe,
        to: '/taches',
        variant: 'danger',
      })
    }

    if (blocagesATraiter.length > 0) {
      items.push({
        id: 'blocages',
        label: `Blocage${blocagesATraiter.length > 1 ? 's' : ''} à traiter dans mon service`,
        count: blocagesATraiter.length,
        to: '/blocages',
        variant: 'warning',
      })
    }

    if (kpis.instructions_en_attente > 0) {
      items.push({
        id: 'instructions',
        label: `Instruction${kpis.instructions_en_attente > 1 ? 's' : ''} en attente`,
        count: kpis.instructions_en_attente,
        to: '/instructions',
        variant: 'warning',
      })
    }

    return items
  }, [chargeEquipe, blocagesATraiter, kpis])

  const membresEnRetard = chargeEquipe.filter((m) => m.enRetard > 0).length

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
              ? `${attention.length} point${attention.length > 1 ? 's' : ''} d'attention dans votre périmètre.`
              : 'Votre périmètre est à jour. Bonne journée.'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-info bg-info-bg border border-info-border px-2 py-1 rounded">
          <Users size={11} />
          Vue Service
        </span>
      </div>

      {/* ===== ② Zone d'attention ===== */}
      {attention.length > 0 ? (
        <AttentionBanner
          variant={
            attention.some((a) => a.variant === 'danger') ? 'danger' : 'warning'
          }
          title={`${attention.length} point${attention.length > 1 ? 's' : ''} d'attention`}
          items={attention}
        />
      ) : (
        <AttentionBanner
          variant="success"
          title="Service à jour"
          message="Aucun retard, aucun blocage dans votre périmètre."
        />
      )}

      {/* ===== ③ KPIs du service ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiStat
          label="Membres de l'équipe"
          value={chargeEquipe.length}
          color="info"
          icon={<Users size={18} />}
          hint={
            membresEnRetard > 0
              ? `${membresEnRetard} avec du retard`
              : 'tous à jour'
          }
        />
        <KpiStat
          label="Tâches actives"
          value={kpis.taches_en_cours}
          to="/taches"
          color="brand"
          icon={<Activity size={18} />}
          hint="en cours dans l'équipe"
        />
        <KpiStat
          label="Tâches en retard"
          value={kpis.taches_en_retard}
          to="/taches"
          color="danger"
          icon={<AlertCircle size={18} />}
          hint="à rattraper"
        />
        <KpiStat
          label="Blocages à traiter"
          value={blocagesATraiter.length}
          to="/blocages"
          color="warning"
          icon={<ShieldAlert size={18} />}
          hint="dans mon périmètre"
        />
      </div>

      {/* ===== ④ Zone principale : blocages + notifications (visible en haut) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Blocages à traiter */}
        <Card className="lg:col-span-3">
          <SectionHeader
            icon={<ShieldAlert size={14} className="text-warning" />}
            title="Blocages à traiter"
            to="/blocages"
            count={blocagesATraiter.length}
          />
          {blocagesATraiter.length === 0 ? (
            <EmptyState
              message="Aucun blocage dans votre périmètre."
              icon={<CheckCircle2 size={28} strokeWidth={1.25} />}
            />
          ) : (
            <ul className="space-y-2">
              {blocagesATraiter.slice(0, 3).map((b) => (
                <li key={b.id}>
                  <Link
                    to={`/blocages/${b.id}`}
                    className="block border border-warning-border bg-warning-bg/30 rounded-md p-3 hover:bg-warning-bg/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Blocage
                      </span>
                      <UrgenceBadge
                        niveau={b.niveau_urgence}
                        niveauDisplay={b.niveau_urgence_display}
                      />
                    </div>
                    <p className="text-[13px] font-medium text-ink-900 mb-1 truncate">
                      {b.tache_detail.titre}
                    </p>
                    <p className="text-[11px] text-ink-600 line-clamp-1 mb-2">
                      {b.description}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-ink-500">
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
            </ul>
          )}
        </Card>

        {/* Notifications */}
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

      {/* ===== ⑤ Charge de l'équipe + Agenda ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Charge de l'équipe */}
        <Card>
          <SectionHeader
            icon={<Users size={14} className="text-ink-400" />}
            title="Charge de l'équipe"
            to="/utilisateurs"
            count={chargeEquipe.length}
          />
          {chargeEquipe.length === 0 ? (
            <EmptyState
              message="Aucun membre avec des tâches."
              icon={<Users size={28} strokeWidth={1.25} />}
            />
          ) : (
            <ul className="space-y-3">
              {chargeEquipe.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar name={m.nom} size="sm" />
                    <span className="text-[12px] font-medium text-ink-900 truncate flex-1">
                      {m.nom}
                    </span>
                    {m.enRetard > 0 && (
                      <span className="text-[10px] font-semibold text-danger bg-danger-bg border border-danger-border px-1.5 py-0.5 rounded shrink-0">
                        {m.enRetard} en retard
                      </span>
                    )}
                  </div>
                  <ProgressBar
                    label={`${m.enCours} en cours · ${m.terminees} terminée${m.terminees > 1 ? 's' : ''}`}
                    value={
                      m.total === 0
                        ? 0
                        : Math.round((m.terminees / m.total) * 100)
                    }
                    color={
                      m.enRetard > 0
                        ? 'danger'
                        : m.enCours > 3
                          ? 'warning'
                          : 'brand'
                    }
                  />
                </li>
              ))}
            </ul>
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

      {/* ===== ⑥ Mes tâches prioritaires ===== */}
      {mes_taches.filter(
        (t) => t.statut !== 'TERMINEE' && t.statut !== 'ANNULEE',
      ).length > 0 && (
        <Card>
          <SectionHeader
            icon={<ClipboardList size={14} className="text-ink-400" />}
            title="Mes tâches prioritaires"
            to="/mes-taches"
          />
          <ul className="space-y-1.5">
            {mes_taches
              .filter(
                (t) => t.statut !== 'TERMINEE' && t.statut !== 'ANNULEE',
              )
              .slice(0, 5)
              .map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/taches/${t.id}`}
                    className="block border border-ink-200 rounded-md p-2.5 hover:bg-ink-50/60 hover:border-ink-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-[13px] text-ink-900 truncate">
                        {t.titre}
                      </span>
                      <PrioriteBadge
                        priorite={t.priorite}
                        prioriteDisplay={t.priorite_display}
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatutBadge
                        statut={t.statut}
                        statutDisplay={t.statut_display}
                      />
                      {t.est_en_retard && (
                        <span className="text-[10px] font-semibold text-danger inline-flex items-center gap-0.5">
                          <AlertCircle size={10} />
                          EN RETARD
                        </span>
                      )}
                      {t.date_echeance && (
                        <span className="text-[11px] text-ink-400 tabular-nums">
                          {new Date(t.date_echeance).toLocaleDateString(
                            'fr-FR',
                            { day: '2-digit', month: 'short' },
                          )}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {/* ===== ⑦ Instructions (reçues/à traiter) ===== */}
      {kpis.instructions_en_attente > 0 && (
        <Card>
          <SectionHeader
            icon={<FileText size={14} className="text-ink-400" />}
            title="Instructions à traiter"
            to="/instructions"
            count={kpis.instructions_en_attente}
          />
          <Link
            to="/instructions"
            className="flex items-center justify-between gap-3 border border-ink-200 rounded-md p-3 hover:bg-ink-50/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <Inbox size={18} />
              </div>
              <div>
                <p className="text-[13px] font-medium text-ink-900">
                  {kpis.instructions_en_attente} instruction
                  {kpis.instructions_en_attente > 1 ? 's' : ''} en attente
                </p>
                <p className="text-[11px] text-ink-500">
                  Assignées à vous ou à votre service
                </p>
              </div>
            </div>
            <ArrowRight size={14} className="text-ink-400" />
          </Link>
        </Card>
      )}
    </div>
  )
}