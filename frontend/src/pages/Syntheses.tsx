/**
 * Page Synthèses v5 — même pattern que Taches.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, FileBarChart, Inbox } from 'lucide-react'
import Layout from '../components/Layout'
import SyntheseFormModal from '../components/syntheses/SyntheseFormModal'
import SyntheseActionsMenu from '../components/syntheses/SyntheseActionsMenu'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import Select from '../components/ui/Select'
import Table, { Column, SortState } from '../components/ui/Table'
import { fetchSynthesesPage } from '../api/syntheses'
import { fetchStats } from '../api/stats'
import type { StatsSyntheses, Synthese, TypeSynthese } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'
import {
  estDirecteur as estDirecteurRole,
  usePermissions,
} from '../hooks/usePermissions'

const TYPES = [
  { value: '', label: 'Tous les types' },
  { value: 'QUOTIDIENNE', label: 'Quotidiennes' },
  { value: 'HEBDOMADAIRE', label: 'Hebdomadaires' },
  { value: 'MENSUELLE', label: 'Mensuelles' },
]

const COLUMNS: Column[] = [
  { key: 'type', label: 'Type', width: '160px', sortable: true },
  { key: 'periode', label: 'Période', width: '30%', sortable: true },
  { key: 'genere_par', label: 'Générée par', width: '25%', sortable: true },
  { key: 'date', label: 'Date de génération', width: '180px', sortable: true },
  { key: 'actions', label: '', width: '60px', align: 'right' },
]

// ---- Tri ----
/**
 * Mapping colonne → paramètre `?ordering=` du serveur.
 * Absente de la table = colonne non exposée par le backend : le tri reste
 * local sur la page courante.
 */
const ORDRE_SERVEUR: Record<string, string | undefined> = {
  periode: 'periode_debut',
  date: 'date_generation',
}

const ORDRE_TYPE: Record<string, number> = {
  QUOTIDIENNE: 0,
  HEBDOMADAIRE: 1,
  MENSUELLE: 2,
}

/**
 * Comparateurs client, réservés aux colonnes sans équivalent serveur.
 * `type` est un ordre métier (pas un ordre alphabétique) et `genere_par`
 * est une colonne jointe : ni l'un ni l'autre n'est dans `ordering_fields`.
 */
const COMPARATEURS_CLIENT: Record<
  string,
  (a: Synthese, b: Synthese) => number
> = {
  type: (a, b) => (ORDRE_TYPE[a.type] ?? 99) - (ORDRE_TYPE[b.type] ?? 99),
  genere_par: (a, b) => {
    const an = a.genere_par_detail?.nom_complet || ''
    const bn = b.genere_par_detail?.nom_complet || ''
    if (!an && !bn) return 0
    if (!an) return 1
    if (!bn) return -1
    return an.localeCompare(bn, 'fr', { sensitivity: 'base' })
  },
}

function TypeSyntheseBadge({ type, display }: { type: string; display: string }) {
  const STYLES: Record<string, string> = {
    QUOTIDIENNE: 'bg-info-bg text-info border-info-border',
    HEBDOMADAIRE: 'bg-brand-50 text-brand-700 border-brand-200',
    MENSUELLE: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  const style = STYLES[type] || 'bg-ink-100 text-ink-600 border-ink-200'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${style}`}
    >
      {display}
    </span>
  )
}

function PeriodeCell({ debut, fin }: { debut: string; fin: string }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[12px] text-ink-700 whitespace-nowrap">
        Du {fmt(debut)}
      </span>
      <span className="text-[11px] text-ink-400 whitespace-nowrap">
        au {fmt(fin)}
      </span>
    </div>
  )
}

export default function Syntheses() {
  const { can, roles } = usePermissions()
  const [typeFiltre, setTypeFiltre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [erreurAction, setErreurAction] = useState<string | null>(null)

  const peutSupprimer = estDirecteurRole(roles)

  // La frappe reste instantanée côté UI ; seule la requête est différée.
  const rechercheDifferee = useDebounce(recherche, 350)

  // Colonnes triables côté serveur → `?ordering=`. Les autres gardent un
  // tri local, qui reste un simple réordonnancement de la page courante.
  const triServeur = sortState ? ORDRE_SERVEUR[sortState.key] : undefined
  const ordering =
    triServeur && sortState?.direction === 'desc'
      ? `-${triServeur}`
      : triServeur

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [
      typeFiltre,
      rechercheDifferee,
      sortState?.key,
      sortState?.direction,
    ],
  })

  // Source unique de vérité des filtres : partagée par la liste ET les KPI,
  // pour que les compteurs affichés correspondent toujours aux lignes.
  const filtres = useMemo(
    () => ({
      type: (typeFiltre || undefined) as TypeSynthese | undefined,
      search: rechercheDifferee.trim() || undefined,
    }),
    [typeFiltre, rechercheDifferee],
  )

  // Projection explicite des filtres dans le contrat de `fetchStats` : la
  // liste et les KPI voient le même ensemble de filtres, seul le `total`
  // affiché provient du `count` de la liste.
  const filtresKpi = useMemo(
    () => ({ search: filtres.search, type: filtres.type }),
    [filtres],
  )

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['syntheses', page, pageSize, filtres, ordering],
    queryFn: () =>
      fetchSynthesesPage({
        ...filtres,
        ordering,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  })

  const syntheses = data?.results ?? []
  const total = data?.count ?? 0

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`type`, `genere_par`) sont
  // réordonnées localement.
  const synthesesTriees = useMemo(() => {
    if (!sortState) return syntheses
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return syntheses
    const sorted = [...syntheses].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [syntheses, sortState])

  const handleSort = (key: string) => {
    setSortState((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' }
      if (current.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  // ---- Stats ----
  // KPI serveur : calculés sur TOUT le périmètre de l'utilisateur, et non
  // sur la page courante.
  const { data: stats } = useQuery({
    queryKey: ['syntheses', 'stats', filtresKpi],
    queryFn: () => fetchStats<StatsSyntheses>('syntheses', filtresKpi),
    placeholderData: (previous) => previous,
  })

  const quotidiennes = stats?.par_type?.QUOTIDIENNE ?? 0
  const hebdo = stats?.par_type?.HEBDOMADAIRE ?? 0

  const aFiltresActifs = Boolean(typeFiltre || recherche)

  const resetFiltres = () => {
    setTypeFiltre('')
    setRecherche('')
  }

  return (
    <Layout title="Synthèses">
      <div className="space-y-4">
        {/* Stats + bouton générer */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              synthèse{total > 1 ? 's' : ''}
              {quotidiennes > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-info">
                    {quotidiennes}
                  </span>{' '}
                  quotidienne{quotidiennes > 1 ? 's' : ''}
                </>
              )}
              {hebdo > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-brand-600">
                    {hebdo}
                  </span>{' '}
                  hebdo
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          {can.createSynthese && (
            <Button
              onClick={() => {
                setErreurAction(null)
                setIsModalOpen(true)
              }}
              leftIcon={<FileBarChart size={14} />}
            >
              Générer une synthèse
            </Button>
          )}
        </div>

        {erreurAction && (
          <div className="bg-danger-bg border border-danger-border text-danger text-[13px] rounded-md p-3 flex items-center gap-2">
            <AlertCircle size={16} />
            {erreurAction}
          </div>
        )}

        {/* Card + toolbar + table */}
        <Card noPadding>
          <div className="px-4 py-3 border-b border-ink-100 flex flex-wrap items-end gap-2">
            <SearchInput
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher une synthèse..."
              className="w-full sm:flex-1 sm:w-auto min-w-0"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Select
                value={typeFiltre}
                onChange={(e) => setTypeFiltre(e.target.value)}
                className="w-full sm:w-auto !h-8 !py-0 !text-[13px]"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>

              {aFiltresActifs && (
                <Button variant="ghost" size="sm" onClick={resetFiltres} className="w-full sm:w-auto">
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>

          {error ? (
            <div className="py-12 flex flex-col items-center gap-2 text-danger">
              <AlertCircle size={22} />
              <p className="text-sm">
                Erreur lors du chargement des synthèses.
              </p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={synthesesTriees}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucune synthèse ne correspond à vos filtres.'
                  : 'Aucune synthèse pour le moment.'
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(s) => s.id}
                            renderCard={(s: Synthese) => (
                <Link
                  to={`/syntheses/${s.id}`}
                  className="block p-4 hover:bg-ink-50/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <TypeSyntheseBadge type={s.type} display={s.type_display} />
                    <span className="text-[10px] text-ink-400 tabular-nums">
                      {new Date(s.date_generation).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>

                  <div className="text-[11px] text-ink-600 mb-3">
                    Du{' '}
                    {new Date(s.periode_debut).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    au{' '}
                    {new Date(s.periode_fin).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </div>

                  {s.genere_par_detail && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Avatar
                        name={s.genere_par_detail.nom_complet}
                        size="xs"
                      />
                      <span className="text-ink-600 truncate">
                        {s.genere_par_detail.nom_complet}
                      </span>
                    </div>
                  )}
                </Link>
              )}
              sortState={sortState}
              onSort={handleSort}
              renderRow={(s: Synthese) => (
                <>
                  <td className="px-4 py-2">
                    <Link
                      to={`/syntheses/${s.id}`}
                      className="block group"
                    >
                      <TypeSyntheseBadge
                        type={s.type}
                        display={s.type_display}
                      />
                    </Link>
                  </td>

                  <td className="px-4 py-2">
                    <PeriodeCell
                      debut={s.periode_debut}
                      fin={s.periode_fin}
                    />
                  </td>

                  <td className="px-4 py-2">
                    {s.genere_par_detail ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={s.genere_par_detail.nom_complet}
                          size="sm"
                        />
                        <span className="text-[12px] text-ink-700 truncate">
                          {s.genere_par_detail.nom_complet}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-ink-400 italic">
                        Système
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2 text-[12px] text-ink-600 whitespace-nowrap">
                    {new Date(s.date_generation).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>

                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
<SyntheseActionsMenu
                      synthese={s}
                      peutSupprimer={peutSupprimer}
                      onErreur={setErreurAction}
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

      <SyntheseFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Layout>
  )
}