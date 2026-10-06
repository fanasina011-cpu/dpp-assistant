/**
 * Page Notifications v6 — liste façon "feed" moderne.
 * Filtres + badge non lues + marquer comme lue.
 *
 * Feed sans tableau : aucune colonne triable, donc aucun `?ordering=`.
 * Seuls les KPI passent côté serveur.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Bell, Check, Inbox } from 'lucide-react'
import Layout from '../components/Layout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import {
  fetchNotificationsPage,
  marquerNotificationLue,
} from '../api/notifications'
import { fetchStats } from '../api/stats'
import type { Notification, StatsNotifications } from '../types'
import { usePagination } from '../hooks/usePagination'

const FILTRES = [
  { value: '', label: 'Toutes' },
  { value: 'false', label: 'Non lues' },
  { value: 'true', label: 'Lues' },
]

/** Retourne une icône et une couleur selon le type de notification. */
function styleForType(type: string): { bg: string; text: string } {
  // Les types sont dynamiques côté back. On garde un style neutre
  // mais différencié pour les plus fréquents.
  const map: Record<string, { bg: string; text: string }> = {
    TACHE_ASSIGNEE: { bg: 'bg-info-bg', text: 'text-info' },
    TACHE_ECHEANCE_PROCHE: { bg: 'bg-warning-bg', text: 'text-warning' },
    TACHE_EN_RETARD: { bg: 'bg-danger-bg', text: 'text-danger' },
    BLOCAGE_SIGNALE: { bg: 'bg-danger-bg', text: 'text-danger' },
    INSTRUCTION_RECUE: { bg: 'bg-brand-50', text: 'text-brand-600' },
    CRQ_CLOTURE: { bg: 'bg-ink-100', text: 'text-ink-600' },
    EVENEMENT_IMMINENT: { bg: 'bg-warning-bg', text: 'text-warning' },
  }
  return map[type] || { bg: 'bg-ink-100', text: 'text-ink-600' }
}

/** Formate une date relative simple ("il y a 5 min", "hier", etc.). */
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
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function NotificationItem({
  notif,
  onMarquerLue,
  isPending,
}: {
  notif: Notification
  onMarquerLue: (id: number) => void
  isPending: boolean
}) {
  const style = styleForType(notif.type)

  return (
    <li
      className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
        notif.lue ? 'bg-white' : 'bg-brand-50/30'
      } hover:bg-ink-50/60`}
    >
      {/* Point non-lu */}
      <div className="pt-1.5 w-2 shrink-0">
        {!notif.lue && (
          <span className="block w-2 h-2 rounded-full bg-brand-500" />
        )}
      </div>

      {/* Icône type */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}
      >
        <Bell size={14} />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
          >
            {notif.type_display}
          </span>
          <span className="text-[11px] text-ink-400">
            {formatRelatif(notif.date_creation)}
          </span>
        </div>
        <p
          className={`text-[13px] leading-snug ${
            notif.lue
              ? 'text-ink-600'
              : 'text-ink-900 font-medium'
          }`}
        >
          {notif.message}
        </p>
      </div>

      {/* Action */}
      {!notif.lue && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onMarquerLue(notif.id)}
          disabled={isPending}
          leftIcon={<Check size={12} />}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-brand-600 hover:bg-brand-50"
        >
          Marquer lue
        </Button>
      )}
    </li>
  )
}

export default function Notifications() {
  const queryClient = useQueryClient()
  const [filtre, setFiltre] = useState('')

  // Source unique de vérité des filtres : partagée par la liste ET les KPI.
  const filtres = useMemo(
    () => ({
      lue: filtre === '' ? undefined : filtre === 'true',
    }),
    [filtre],
  )

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [filtre],
  })

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['notifications', page, pageSize, filtres],
    queryFn: () =>
      fetchNotificationsPage({
        ...filtres,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  })

  const notifications = data?.results ?? []
  const total = data?.count ?? 0

  const marquerLueMutation = useMutation({
    mutationFn: marquerNotificationLue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // ---- Stats ----
  // KPI serveur sur l'INTÉGRALITÉ des notifications de l'utilisateur, et non
  // sur la page courante. `FetchStatsParams` n'expose pas `lue` : le filtre
  // Toutes / Non lues / Lues n'est donc pas transmis aux KPI.
  const { data: stats } = useQuery({
    queryKey: ['notifications', 'stats', filtres],
    queryFn: () => fetchStats<StatsNotifications>('notifications', filtres),
    placeholderData: (previous) => previous,
  })

  const nonLues = stats?.non_lues ?? 0

  return (
    <Layout title="Notifications">
      <div className="space-y-4">
        {/* Stats + filtre */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              notification{total > 1 ? 's' : ''}
              {nonLues > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-brand-600">
                    {nonLues}
                  </span>{' '}
                  non lue{nonLues > 1 ? 's' : ''}
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {nonLues > 0 && (
              <span className="text-[11px] bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 self-start sm:self-auto">
                <Bell size={11} />
                {nonLues}
              </span>
            )}
            {/* TODO UX-2 : supprimer les !important quand Select aura size="xs" */}
            <Select
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              className="w-full sm:w-auto !h-8 !py-0 !text-[13px]"
            >
              {FILTRES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Liste */}
        {error ? (
          <Card>
            <div className="py-12 flex flex-col items-center gap-2 text-danger">
              <AlertCircle size={22} />
              <p className="text-sm">
                Erreur lors du chargement des notifications.
              </p>
            </div>
          </Card>
        ) : isLoading ? (
          <Card noPadding>
            <ul className="divide-y divide-ink-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-2 shrink-0" />
                  <div className="w-8 h-8 rounded-full bg-ink-100 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-ink-100 rounded animate-pulse" />
                    <div className="h-3.5 w-3/4 bg-ink-100 rounded animate-pulse" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : notifications.length === 0 ? (
          <Card>
            <div className="py-12 flex flex-col items-center gap-2 text-ink-400">
              <Inbox size={36} strokeWidth={1.25} />
              <p className="text-sm">
                {filtre === 'false'
                  ? 'Aucune notification non lue.'
                  : filtre === 'true'
                    ? 'Aucune notification lue.'
                    : 'Aucune notification pour le moment.'}
              </p>
            </div>
          </Card>
        ) : (
          <Card noPadding>
            <ul className="divide-y divide-ink-100">
              {notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onMarquerLue={(id) => marquerLueMutation.mutate(id)}
                  isPending={marquerLueMutation.isPending}
                />
              ))}
            </ul>
          </Card>
        )}

        {notifications.length > 0 && (
          <Pagination
            count={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            className="!border-0 border-t border-ink-100 bg-white rounded-b-lg"
          />
        )}
      </div>
    </Layout>
  )
}