/**
 * Page Blocages v6 — tri, recherche et KPI côté serveur.
 * Même pattern que Taches.
 * Particularité : badge Urgence + bouton rapide "Résoudre".
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Inbox, ShieldAlert } from 'lucide-react'
import Layout from '../components/Layout'
import StatutBadge from '../components/StatutBadge'
import UrgenceBadge from '../components/UrgenceBadge'
import BlocageFormModal from '../components/blocages/BlocageFormModal'
import BlocageActionsMenu from '../components/blocages/BlocageActionsMenu'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import Select from '../components/ui/Select'
import Table, { Column, SortState } from '../components/ui/Table'
import { fetchBlocagesPage } from '../api/blocages'
import { fetchStats } from '../api/stats'
import type { Blocage, StatsBlocages } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'

const STATUTS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'EN_TRAITEMENT', label: 'En traitement' },
  { value: 'REMONTE_AU_DIRECTEUR', label: 'Remonté au Directeur' },
  { value: 'CONTESTE', label: 'Contesté' },
  { value: 'RESOLU', label: 'Résolu' },
]

const URGENCES = [
  { value: '', label: 'Toutes urgences' },
  { value: 'BASSE', label: 'Basse' },
  { value: 'MOYENNE', label: 'Moyenne' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'CRITIQUE', label: 'Critique' },
]

const COLUMNS: Column[] = [
  { key: 'tache', label: 'Tâche', width: '30%', sortable: true },
  { key: 'urgence', label: 'Urgence', width: '120px', sortable: true },
  { key: 'statut', label: 'Statut', width: '160px', sortable: true },
  { key: 'delai', label: 'Délai', width: '100px', sortable: true },
  { key: 'signale_par', label: 'Signalé par', width: '180px', sortable: true },
  { key: 'date', label: 'Date', width: '120px', sortable: true },
  { key: 'actions', label: '', width: '150px', align: 'right' },
]

// ---- Tri ----
/**
 * Mapping colonne → paramètre `?ordering=` du serveur.
 * Absente de la table = colonne non triable côté serveur, le tri reste
 * local sur la page courante.
 */
const ORDRE_SERVEUR: Record<string, string | undefined> = {
  delai: 'date_limite_action',
  date: 'date_signalement',
}

const ORDRE_URGENCE: Record<string, number> = {
  CRITIQUE: 0,
  HAUTE: 1,
  MOYENNE: 2,
  BASSE: 3,
}

const ORDRE_STATUT: Record<string, number> = {
  EN_ATTENTE: 0,
  EN_TRAITEMENT: 1,
  REMONTE_AU_DIRECTEUR: 2,
  CONTESTE: 3,
  RESOLU: 4,
}

/** Comparateurs client, réservés aux colonnes non triables côté serveur. */
const COMPARATEURS_CLIENT: Record<string, (a: Blocage, b: Blocage) => number> = {
  tache: (a, b) =>
    a.tache_detail.titre.localeCompare(b.tache_detail.titre, 'fr', {
      sensitivity: 'base',
    }),
  urgence: (a, b) =>
    (ORDRE_URGENCE[a.niveau_urgence] ?? 99) -
    (ORDRE_URGENCE[b.niveau_urgence] ?? 99),
  statut: (a, b) => (ORDRE_STATUT[a.statut] ?? 99) - (ORDRE_STATUT[b.statut] ?? 99),
  signale_par: (a, b) =>
    a.signale_par_detail.nom_complet.localeCompare(
      b.signale_par_detail.nom_complet,
      'fr',
      { sensitivity: 'base' },
    ),
}

function DateCell({ date }: { date: string }) {
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return (
    <span className="text-[12px] text-ink-700 whitespace-nowrap">{dateStr}</span>
  )
}

export default function Blocages() {
  const [statutFiltre, setStatutFiltre] = useState('')
  const [urgenceFiltre, setUrgenceFiltre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [enAttenteEscalade, setEnAttenteEscalade] = useState(false)
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // La frappe reste instantanée côté UI ; seule la requête est différée.
  const rechercheDifferee = useDebounce(recherche, 350)

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [
      statutFiltre,
      urgenceFiltre,
      rechercheDifferee,
      enAttenteEscalade,
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
      niveauUrgence: urgenceFiltre || undefined,
      search: rechercheDifferee.trim() || undefined,
      enAttenteEscalade: enAttenteEscalade || undefined,
    }),
    [statutFiltre, urgenceFiltre, rechercheDifferee, enAttenteEscalade],
  )

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['blocages', page, pageSize, filtres, ordering],
    queryFn: () =>
      fetchBlocagesPage({ ...filtres, ordering, page, pageSize }),
    placeholderData: (previous) => previous,
  })

  const blocages = data?.results ?? []
  const total = data?.count ?? 0

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`tache`, `urgence`,
  // `statut`, `signale_par`) sont réordonnées localement.
  const blocagesTries = useMemo(() => {
    if (!sortState) return blocages
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return blocages
    const sorted = [...blocages].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [blocages, sortState])

  // ---- Stats ----
  // KPI serveur : calculés sur TOUT le périmètre de l'utilisateur, et non
  // sur la page courante. Les mêmes filtres que la liste sont transmis : les
  // compteurs doivent toujours décrire les lignes affichées.
  const { data: stats } = useQuery({
    queryKey: ['blocages', 'stats', filtres],
    queryFn: () =>
      fetchStats<StatsBlocages>('blocages', {
        statut: filtres.statut,
        niveauUrgence: filtres.niveauUrgence,
        search: filtres.search,
        enAttenteEscalade: filtres.enAttenteEscalade,
      }),
    placeholderData: (previous) => previous,
  })

  const nonResolus = stats?.non_resolus ?? 0
  const critiques = stats?.critiques ?? 0

  const aFiltresActifs = Boolean(
    statutFiltre || urgenceFiltre || recherche || enAttenteEscalade,
  )

  const resetFiltres = () => {
    setStatutFiltre('')
    setUrgenceFiltre('')
    setRecherche('')
    setEnAttenteEscalade(false)
  }

  return (
    <Layout title="Blocages">
      <div className="space-y-4">
        {/* Stats + bouton signaler */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              blocage{total > 1 ? 's' : ''}
              {nonResolus > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-warning">
                    {nonResolus}
                  </span>{' '}
                  non résolu{nonResolus > 1 ? 's' : ''}
                </>
              )}
              {critiques > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-danger">
                    {critiques}
                  </span>{' '}
                  critique{critiques > 1 ? 's' : ''}
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          <Button
            onClick={() => setIsModalOpen(true)}
            variant="danger"
            leftIcon={<ShieldAlert size={14} />}
          >
            Signaler un blocage
          </Button>
        </div>

        {/* Card + toolbar + table */}
        <Card noPadding>
          <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2 flex-wrap">
            <SearchInput
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher un blocage..."
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
                value={urgenceFiltre}
                onChange={(e) => setUrgenceFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {URGENCES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </Select>

              <Button
                variant={enAttenteEscalade ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setEnAttenteEscalade((v) => !v)}
              >
                En attente d'escalade
              </Button>

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
                Erreur lors du chargement des blocages.
              </p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={blocagesTries}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucun blocage ne correspond à vos filtres.'
                  : 'Aucun blocage pour le moment.'
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(b) => b.id}
                            renderCard={(blocage: Blocage) => (
                <Link
                  to={`/blocages/${blocage.id}`}
                  className="block p-4 hover:bg-ink-50/60 transition-colors"
                >
                  <div className="text-[13px] font-medium text-ink-900 leading-snug mb-2">
                    {blocage.tache_detail.titre}
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <UrgenceBadge
                      niveau={blocage.niveau_urgence}
                      niveauDisplay={blocage.niveau_urgence_display}
                    />
                    <StatutBadge
                      statut={blocage.statut}
                      statutDisplay={blocage.statut_display}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar
                        name={blocage.signale_par_detail.nom_complet}
                        size="xs"
                      />
                      <span className="text-ink-600 truncate">
                        {blocage.signale_par_detail.nom_complet}
                      </span>
                    </div>
                    <span className="tabular-nums text-ink-500 shrink-0">
                      {new Date(blocage.date_signalement).toLocaleDateString(
                        'fr-FR',
                        { day: '2-digit', month: 'short' },
                      )}
                    </span>
                  </div>
                </Link>
              )}
              sortState={sortState}
              onSort={handleSort}
              renderRow={(blocage: Blocage, _index, isHovered) => (
                <>
                  <td className="px-4 py-2">
                    <Link
                      to={`/blocages/${blocage.id}`}
                      className="block group"
                    >
                      <span className="font-medium text-ink-900 text-[13px] group-hover:text-brand-600 transition-colors">
                        {blocage.tache_detail.titre}
                      </span>
                    </Link>
                  </td>

                  <td className="px-4 py-2">
                    <UrgenceBadge
                      niveau={blocage.niveau_urgence}
                      niveauDisplay={blocage.niveau_urgence_display}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <StatutBadge
                      statut={blocage.statut}
                      statutDisplay={blocage.statut_display}
                    />
                  </td>

                  <td className="px-4 py-2">
                    {blocage.date_limite_action ? (
                      (() => {
                        const limite = new Date(blocage.date_limite_action).getTime()
                        const maintenant = Date.now()
                        const depasse = limite < maintenant
                        const heures = Math.max(
                          0,
                          Math.ceil((limite - maintenant) / (1000 * 60 * 60)),
                        )
                        return (
                          <span
                            className={
                              depasse
                                ? 'text-danger font-medium'
                                : 'text-ink-500'
                            }
                          >
                            {depasse
                              ? `Dépassé`
                              : `${heures}h`}
                          </span>
                        )
                      })()
                    ) : (
                      <span className="text-ink-400 italic text-[12px]">
                        —
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={blocage.signale_par_detail.nom_complet}
                        size="sm"
                      />
                      <span className="text-[12px] text-ink-700 truncate">
                        {blocage.signale_par_detail.nom_complet}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-2">
                    <DateCell date={blocage.date_signalement} />
                  </td>

                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <BlocageActionsMenu
                      blocage={blocage}
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

      <BlocageFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Layout>
  )
}