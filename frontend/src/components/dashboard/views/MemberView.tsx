/**
 * Dashboard — Vue MEMBRE.
 *
 * Centré sur : mes tâches du jour, mon agenda, ma progression.
 * Répond à la question : "Qu'est-ce que je dois faire aujourd'hui ?"
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Inbox,
  ListTodo,
} from 'lucide-react'
import AttentionBanner, {
  AttentionItem,
} from '../AttentionBanner'
import KpiStat from '../KpiStat'
import ProgressBar from '../ProgressBar'
import StatutBadge from '../../StatutBadge'
import PrioriteBadge from '../../PrioriteBadge'
import Card from '../../ui/Card'
import type { DashboardData } from '../../../api/dashboard'

interface MemberViewProps {
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

/** En-tête de section avec lien "Voir tout" */
function SectionHeader({
  icon,
  title,
  to,
}: {
  icon: React.ReactNode
  title: string
  to: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[14px] font-semibold text-ink-900 flex items-center gap-2">
        {icon}
        {title}
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

/** État vide compact */
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

export default function MemberView({ data, userNom }: MemberViewProps) {
  const { kpis, mes_taches, evenements_jour, dernieres_notifications } = data

  // ---- Zone d'attention : construit dynamiquement ----
  const attention = useMemo(() => {
    const items: AttentionItem[] = []
    const tachesEnRetard = mes_taches.filter((t) => t.est_en_retard)
    const tachesEcheanceAujourdHui = mes_taches.filter((t) => {
      if (!t.date_echeance) return false
      const d = new Date(t.date_echeance)
      const today = new Date()
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      )
    })

    if (tachesEnRetard.length > 0) {
      items.push({
        id: 'retard',
        label: `${tachesEnRetard.length} tâche${tachesEnRetard.length > 1 ? 's' : ''} en retard`,
        count: tachesEnRetard.length,
        to: '/taches',
        variant: 'danger',
      })
    }
    if (tachesEcheanceAujourdHui.length > 0) {
      items.push({
        id: 'aujourd_hui',
        label: `${tachesEcheanceAujourdHui.length} échéance${tachesEcheanceAujourdHui.length > 1 ? 's' : ''} aujourd'hui`,
        count: tachesEcheanceAujourdHui.length,
        to: '/taches',
        variant: 'warning',
      })
    }
    if (kpis.notifications_non_lues > 0) {
      items.push({
        id: 'notifs',
        label: `${kpis.notifications_non_lues} notification${kpis.notifications_non_lues > 1 ? 's' : ''} non lue${kpis.notifications_non_lues > 1 ? 's' : ''}`,
        count: kpis.notifications_non_lues,
        to: '/notifications',
        variant: 'info',
      })
    }
    return items
  }, [mes_taches, kpis])

  // ---- Calcul progression personnelle ----
  const mesTachesActives = useMemo(
    () =>
      mes_taches.filter(
        (t) => t.statut !== 'TERMINEE' && t.statut !== 'ANNULEE',
      ),
    [mes_taches],
  )

  const totalSemaine = mes_taches.length
  const termineesSemaine = useMemo(
    () => mes_taches.filter((t) => t.statut === 'TERMINEE').length,
    [mes_taches],
  )
  const tauxCompletion =
    totalSemaine === 0 ? 0 : Math.round((termineesSemaine / totalSemaine) * 100)

  return (
    <div className="space-y-5">
      {/* ===== ① Salutation ===== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900 leading-tight">
            Bonjour, {userNom.split(' ')[0]}
          </h1>
          <p className="text-[13px] text-ink-500 mt-1">
            {tachesEcheanceAujourdHuiCount(mes_taches) > 0
              ? `Vous avez ${tachesEcheanceAujourdHuiCount(mes_taches)} échéance${tachesEcheanceAujourdHuiCount(mes_taches) > 1 ? 's' : ''} aujourd'hui.`
              : mesTachesActives.length > 0
                ? `Vous avez ${mesTachesActives.length} tâche${mesTachesActives.length > 1 ? 's' : ''} active${mesTachesActives.length > 1 ? 's' : ''}.`
                : 'Aucune tâche active. Bonne journée !'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-500 bg-ink-100 px-2 py-1 rounded">
          Vue personnelle
        </span>
      </div>

      {/* ===== ② Zone d'attention ===== */}
      {attention.length > 0 ? (
        <AttentionBanner
          variant={attention.some((a) => a.variant === 'danger') ? 'danger' : 'warning'}
          title={`${attention.length} élément${attention.length > 1 ? 's' : ''} requièrent votre attention`}
          items={attention}
        />
      ) : (
        <AttentionBanner
          variant="success"
          title="Aucune alerte"
          message="Aucune tâche en retard, aucune échéance urgente."
        />
      )}

      {/* ===== ③ KPIs personnels ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiStat
          label="Mes tâches actives"
          value={mesTachesActives.length}
          to="/taches"
          color="info"
          icon={<ListTodo size={18} />}
          hint="en cours ou à faire"
        />
        <KpiStat
          label="Terminées aujourd'hui"
          value={kpis.taches_terminees_aujourd_hui}
          to="/taches"
          color="success"
          icon={<CheckCircle2 size={18} />}
          hint="bravo !"
        />
        <KpiStat
          label="Instructions à traiter"
          value={kpis.instructions_en_attente}
          to="/instructions"
          color="brand"
          icon={<Inbox size={18} />}
          hint="assignées à moi"
        />
        <KpiStat
          label="Notifications non lues"
          value={kpis.notifications_non_lues}
          to="/notifications"
          color="warning"
          icon={<Bell size={18} />}
          hint="à consulter"
        />
      </div>

      {/* ===== ④ Pilotage : progression + charge ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <CheckSquare size={14} className="text-ink-400" />
            Ma progression
          </h3>
          <div className="space-y-4">
            <ProgressBar
              label="Taux de complétion"
              value={tauxCompletion}
              color={tauxCompletion >= 70 ? 'success' : tauxCompletion >= 40 ? 'brand' : 'warning'}
              hint={`${termineesSemaine} terminée${termineesSemaine > 1 ? 's' : ''} sur ${totalSemaine} tâche${totalSemaine > 1 ? 's' : ''}`}
            />
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-ink-100">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">
                  En cours
                </p>
                <p className="text-[18px] font-semibold text-info mt-0.5 tabular-nums">
                  {mes_taches.filter((t) => t.statut === 'EN_COURS').length}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">
                  En retard
                </p>
                <p className="text-[18px] font-semibold text-danger mt-0.5 tabular-nums">
                  {mes_taches.filter((t) => t.est_en_retard).length}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">
                  Terminées
                </p>
                <p className="text-[18px] font-semibold text-success mt-0.5 tabular-nums">
                  {termineesSemaine}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <Clock size={14} className="text-ink-400" />
            Échéances proches
          </h3>
          {mes_taches
            .filter((t) => t.date_echeance && !t.est_en_retard)
            .slice(0, 4).length === 0 ? (
            <EmptyState
              message="Aucune échéance à venir."
              icon={<Calendar size={28} strokeWidth={1.25} />}
            />
          ) : (
            <ul className="space-y-2">
              {mes_taches
                .filter((t) => t.date_echeance && !t.est_en_retard)
                .sort(
                  (a, b) =>
                    new Date(a.date_echeance!).getTime() -
                    new Date(b.date_echeance!).getTime(),
                )
                .slice(0, 4)
                .map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <Link
                      to={`/taches/${t.id}`}
                      className="text-[12px] text-ink-800 hover:text-brand-600 transition-colors truncate flex-1"
                    >
                      {t.titre}
                    </Link>
                    <span className="text-[11px] text-ink-500 whitespace-nowrap tabular-nums">
                      {new Date(t.date_echeance!).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ===== ⑤ Action : Mes tâches + Agenda ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mes tâches prioritaires */}
        <Card>
          <SectionHeader
            icon={<CheckSquare size={14} className="text-ink-400" />}
            title="Mes tâches prioritaires"
            to="/taches"
          />
          {mesTachesActives.length === 0 ? (
            <EmptyState
              message="Aucune tâche active."
              icon={<CheckSquare size={28} strokeWidth={1.25} />}
            />
          ) : (
            <ul className="space-y-1.5">
              {mesTachesActives.slice(0, 5).map((t) => (
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
          )}
        </Card>

        {/* Agenda du jour */}
        <Card>
          <SectionHeader
            icon={<Calendar size={14} className="text-ink-400" />}
            title="Mon agenda du jour"
            to="/agenda"
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
                  className="border border-ink-200 rounded-md p-2.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        evt.niveau_priorite === 'DIRECTION'
                          ? 'bg-danger'
                          : 'bg-info'
                      }`}
                    />
                    <span className="font-medium text-[13px] text-ink-900 truncate">
                      {evt.titre}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-500 ml-3.5">
                    {new Date(evt.date_debut).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' – '}
                    {new Date(evt.date_fin).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ===== ⑥ Mes dernières notifications ===== */}
      <Card>
        <SectionHeader
          icon={<Bell size={14} className="text-ink-400" />}
          title="Mes dernières notifications"
          to="/notifications"
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
                className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="pt-1 w-2 shrink-0">
                  {!n.lue && (
                    <span className="block w-1.5 h-1.5 rounded-full bg-brand-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                      {n.type_display}
                    </span>
                    <span className="text-[10px] text-ink-400">
                      {formatRelatif(n.date_creation)}
                    </span>
                  </div>
                  <p
                    className={`text-[12px] leading-snug ${
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
  )
}

/** Helper : compte les tâches dont l'échéance est aujourd'hui */
function tachesEcheanceAujourdHuiCount(
  taches: DashboardData['mes_taches'],
): number {
  const today = new Date()
  return taches.filter((t) => {
    if (!t.date_echeance) return false
    const d = new Date(t.date_echeance)
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    )
  }).length
}