/**
 * Page Activités v6 — tri, recherche et KPI côté serveur.
 * Même pattern que Taches.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Inbox, Plus } from 'lucide-react'
import Layout from '../components/Layout'
import StatutBadge from '../components/StatutBadge'
import PrioriteBadge from '../components/PrioriteBadge'
import ActiviteFormModal from '../components/activites/ActiviteFormModal'
import ActiviteActionsMenu from '../components/activites/ActiviteActionsMenu'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import Select from '../components/ui/Select'
import Table, { Column, SortState } from '../components/ui/Table'
import { fetchActivitesPage } from '../api/activites'
import { fetchStats } from '../api/stats'
import type { Activite, StatsActivites } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'
import { usePermissions } from '../hooks/usePermissions'

const STATUTS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'OUVERTE', label: 'Ouverte' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'CLOTUREE', label: 'Clôturée' },
  { value: 'ANNULEE', label: 'Annulée' },
]

const PRIORITES = [
  { value: '', label: 'Toutes priorités' },
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
]

const COLUMNS: Column[] = [
  { key: 'titre', label: 'Titre', width: '32%', sortable: true },
  { key: 'statut', label: 'Statut', width: '130px', sortable: true },
  { key: 'priorite', label: 'Priorité', width: '120px', sortable: true },
  { key: 'responsable', label: 'Responsable', width: '180px', sortable: true },
  { key: 'echeance', label: 'Échéance', width: '120px', sortable: true },
  { key: 'actions', label: '', width: '150px', align: 'right' },
]

// ---- Tri ----
/**
 * Mapping colonne → paramètre `?ordering=` du serveur.
 * Absente de la table = colonne non triable côté serveur, le tri reste
 * local sur la page courante.
 */
const ORDRE_SERVEUR: Record<string, string | undefined> = {
  titre: 'titre',
  echeance: 'date_echeance',
}

const ORDRE_STATUT: Record<string, number> = {
  OUVERTE: 0,
  EN_COURS: 1,
  CLOTUREE: 2,
  ANNULEE: 3,
}

const ORDRE_PRIORITE: Record<string, number> = {
  URGENTE: 0,
  HAUTE: 1,
  NORMALE: 2,
  BASSE: 3,
}

/** Comparateurs client, réservés aux colonnes non triables côté serveur. */
const COMPARATEURS_CLIENT: Record<string, (a: Activite, b: Activite) => number> = {
  statut: (a, b) =>
    (ORDRE_STATUT[a.statut] ?? 99) - (ORDRE_STATUT[b.statut] ?? 99),
  priorite: (a, b) =>
    (ORDRE_PRIORITE[a.priorite] ?? 99) - (ORDRE_PRIORITE[b.priorite] ?? 99),
  responsable: (a, b) => {
    const an = a.responsable_detail?.nom_complet || ''
    const bn = b.responsable_detail?.nom_complet || ''
    if (!an && !bn) return 0
    if (!an) return 1
    if (!bn) return -1
    return an.localeCompare(bn, 'fr', { sensitivity: 'base' })
  },
}

function EcheanceCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-[12px] text-ink-400">—</span>
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  const estEnRetard = dd < today
  if (!estEnRetard) {
    return (
      <span className="text-[12px] text-ink-700 font-medium whitespace-nowrap">
        {dateStr}
      </span>
    )
  }
  const joursRetard = Math.max(
    1,
    Math.floor((today.getTime() - dd.getTime()) / 86_400_000),
  )
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[12px] text-danger font-semibold whitespace-nowrap">
        {dateStr}
      </span>
      <span className="text-[10px] text-danger">{joursRetard}j de retard</span>
    </div>
  )
}

export default function Activites() {
  const { can } = usePermissions()
  const [statutFiltre, setStatutFiltre] = useState('')
  const [prioriteFiltre, setPrioriteFiltre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // La frappe reste instantanée côté UI ; seule la requête est différée.
  const rechercheDifferee = useDebounce(recherche, 350)

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [
      statutFiltre,
      prioriteFiltre,
      rechercheDifferee,
      sortState?.key,
      sortState?.direction,
    ],
  })

  // ---- Tri : 3 états (asc → desc → aucun) ----
  const handleSort = (key: string) => {
    setSortState((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' }
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' }
      }
      return null
    })
  }

  // Colonnes triables côté serveur → `?ordering=`. Les autres gardent un
  // tri local, qui reste un simple réordonnancement de la page courante.
  const triServeur = sortState ? ORDRE_SERVEUR[sortState.key] : undefined
  const ordering =
    triServeur && sortState?.direction === 'desc'
      ? `-${triServeur}`
      : triServeur

  // Source unique de vérité des filtres : partagée par la liste ET les KPI,
  // pour que les compteurs affichés correspondent toujours aux lignes.
  const filtres = useMemo(
    () => ({
      statut: statutFiltre || undefined,
      priorite: prioriteFiltre || undefined,
      search: rechercheDifferee.trim() || undefined,
    }),
    [statutFiltre, prioriteFiltre, rechercheDifferee],
  )

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['activites', page, pageSize, filtres, ordering],
    queryFn: () =>
      fetchActivitesPage({ ...filtres, ordering, page, pageSize }),
    placeholderData: (previous) => previous,
  })

  const activites = data?.results ?? []
  const total = data?.count ?? 0

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`statut`, `priorite`,
  // `responsable`) sont réordonnées localement.
  const activitesTriees = useMemo(() => {
    if (!sortState) return activites
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return activites
    const sorted = [...activites].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [activites, sortState])

  // ---- Stats ----
  // KPI serveur : calculés sur TOUT le périmètre de l'utilisateur, et non
  // sur la page courante. Les mêmes filtres que la liste sont transmis.
  const { data: stats } = useQuery({
    queryKey: ['activites', 'stats', filtres],
    queryFn: () => fetchStats<StatsActivites>('activites', filtres),
    placeholderData: (previous) => previous,
  })

  const enCours = stats?.en_cours ?? 0
  const cloturables = stats?.cloturables ?? 0

  const aFiltresActifs = Boolean(statutFiltre || prioriteFiltre || recherche)

  const resetFiltres = () => {
    setStatutFiltre('')
    setPrioriteFiltre('')
    setRecherche('')
  }

  return (
    <Layout title="Activités">
      <div className="space-y-4">
        {/* Stats + bouton créer */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              activité{total > 1 ? 's' : ''}
              {enCours > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-info">{enCours}</span>{' '}
                  en cours
                </>
              )}
              {cloturables > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-success">
                    {cloturables}
                  </span>{' '}
                  clôturable{cloturables > 1 ? 's' : ''}
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          {can.createActivite && (
            <Button
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus size={14} />}
            >
              Nouvelle activité
            </Button>
          )}
        </div>

        {/* Card + toolbar + table */}
        <Card noPadding>
          <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2 flex-wrap">
            <SearchInput
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher une activité..."
            />

            <div className="flex items-center gap-2 ml-auto">
              <Select
                value={statutFiltre}
                onChange={(e) => setStatutFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {STATUTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>

              <Select
                value={prioriteFiltre}
                onChange={(e) => setPrioriteFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {PRIORITES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>

              {aFiltresActifs && (
                <Button variant="ghost" size="sm" onClick={resetFiltres}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>

          {error ? (
            <div className="py-12 flex flex-col items-center gap-2 text-danger">
              <AlertCircle size={22} />
              <p className="text-sm">
                Erreur lors du chargement des activités.
              </p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={activitesTriees}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucune activité ne correspond à vos filtres.'
                  : 'Aucune activité pour le moment.'
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(a) => a.id}
                            renderCard={(activite: Activite) => (
                <Link
                  to={`/activites/${activite.id}`}
                  className="block p-4 hover:bg-ink-50/60 transition-colors"
                >
                  <div className="text-[13px] font-medium text-ink-900 leading-snug mb-2">
                    {activite.titre}
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <StatutBadge
                      statut={activite.statut}
                      statutDisplay={activite.statut_display}
                    />
                    <PrioriteBadge
                      priorite={activite.priorite}
                      prioriteDisplay={activite.priorite_display}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    {activite.responsable_detail ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar
                          name={activite.responsable_detail.nom_complet}
                          size="xs"
                        />
                        <span className="text-ink-600 truncate">
                          {activite.responsable_detail.nom_complet}
                        </span>
                      </div>
                    ) : (
                      <span className="text-ink-400 italic">Non assigné</span>
                    )}

                    {activite.date_echeance && (
                      <span className="tabular-nums text-ink-500 shrink-0">
                        {new Date(activite.date_echeance).toLocaleDateString(
                          'fr-FR',
                          { day: '2-digit', month: 'short' },
                        )}
                      </span>
                    )}
                  </div>
                </Link>
              )}
              sortState={sortState}
              onSort={handleSort}
              renderRow={(activite: Activite, _index, isHovered) => (
                <>
                  <td className="px-4 py-2">
                    <Link
                      to={`/activites/${activite.id}`}
                      className="block group"
                    >
                      <span className="font-medium text-ink-900 text-[13px] group-hover:text-brand-600 transition-colors">
                        {activite.titre}
                      </span>
                    </Link>
                  </td>

                  <td className="px-4 py-2">
                    <StatutBadge
                      statut={activite.statut}
                      statutDisplay={activite.statut_display}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <PrioriteBadge
                      priorite={activite.priorite}
                      prioriteDisplay={activite.priorite_display}
                    />
                  </td>

                  <td className="px-4 py-2">
                    {activite.responsable_detail ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={activite.responsable_detail.nom_complet}
                          size="sm"
                        />
                        <span className="text-[12px] text-ink-700 truncate">
                          {activite.responsable_detail.nom_complet}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-ink-400 italic">
                        Non assigné
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    <EcheanceCell date={activite.date_echeance} />
                  </td>

                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActiviteActionsMenu
                      activite={activite}
                      isRowHovered={isHovered}
                    />
                  </td>
                </>
              )}
            />
          )}

          <Pagination
            count={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </Card>
      </div>

      <ActiviteFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Layout>
  )
}
