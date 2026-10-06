/**
 * Page CRQ v5 — même pattern que Taches.
 * Actions : voir détails, demander réouverture, valider/refuser.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Inbox, Plus } from 'lucide-react'
import Layout from '../components/Layout'
import CRQFormModal from '../components/crq/CRQFormModal'
import CRQActionsMenu from '../components/crq/CRQActionsMenu'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import Select from '../components/ui/Select'
import Table, { Column, SortState } from '../components/ui/Table'
import { fetchCRQsPage } from '../api/crq'
import { fetchUtilisateurs } from '../api/utilisateurs'
import { fetchStats } from '../api/stats'
import { useAuth } from '../context/AuthContext'
import {
  estChefOuDirecteur as estChefOuDirecteurRole,
  estRoleDirection,
  usePermissions,
} from '../hooks/usePermissions'
import type { CompteRenduQuotidien, StatsCRQ } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'

const FILTRES_CLOTURE = [
  { value: '', label: 'Tous' },
  { value: 'false', label: 'En cours' },
  { value: 'true', label: 'Clôturés' },
]

const COLUMNS: Column[] = [
  { key: 'date', label: 'Date', width: '30%', sortable: true },
  { key: 'redacteur', label: 'Rédacteur', width: '25%', sortable: true },
  { key: 'statut', label: 'Statut', width: '130px', sortable: true },
  { key: 'demandes', label: 'Demandes', width: '140px', sortable: true },
  { key: 'actions', label: '', width: '60px', align: 'right' },
]

// ---- Tri ----
/**
 * Mapping colonne → paramètre `?ordering=` du serveur.
 * Absente de la table = colonne non exposée par le backend : le tri reste
 * local sur la page courante.
 */
const ORDRE_SERVEUR: Record<string, string | undefined> = {
  date: 'date_journaliere',
  statut: 'est_cloture',
}

/**
 * Comparateurs client, réservés aux colonnes sans équivalent serveur.
 * `redacteur` est une colonne jointe, `demandes` un agrégat de tableau :
 * ni l'un ni l'autre n'est exposé par `ordering_fields`.
 */
const COMPARATEURS_CLIENT: Record<
  string,
  (a: CompteRenduQuotidien, b: CompteRenduQuotidien) => number
> = {
  redacteur: (a, b) =>
    a.redacteur_detail.nom_complet.localeCompare(
      b.redacteur_detail.nom_complet,
      'fr',
      { sensitivity: 'base' },
    ),
  demandes: (a, b) => a.demandes_reouverture.length - b.demandes_reouverture.length,
}

function StatutCRQBadge({ cloture }: { cloture: boolean }) {
  if (cloture) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-ink-100 text-ink-600 border-ink-200">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-400" />
        Clôturé
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-info-bg text-info border-info-border">
      <span className="w-1.5 h-1.5 rounded-full bg-info" />
      En cours
    </span>
  )
}

function DemandesCell({ crq }: { crq: CompteRenduQuotidien }) {
  const total = crq.demandes_reouverture.length
  if (total === 0) {
    return <span className="text-[12px] text-ink-400">—</span>
  }
  const enAttente = crq.demandes_reouverture.filter(
    (d) => d.statut === 'EN_ATTENTE',
  ).length

  if (enAttente > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-warning font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
        {enAttente} en attente
      </span>
    )
  }
  return (
    <span className="text-[12px] text-ink-500">
      {total} traitée{total > 1 ? 's' : ''}
    </span>
  )
}

export default function CRQ() {
  const { user } = useAuth()
  const { roles } = usePermissions()
  const [filtreCloture, setFiltreCloture] = useState('')
  const [redacteurFiltre, setRedacteurFiltre] = useState<number | ''>('')
  const [recherche, setRecherche] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [erreurAction, setErreurAction] = useState<string | null>(null)

  const peutVoirEquipe = estRoleDirection(roles)

  const estChefOuDirecteur = estChefOuDirecteurRole(roles)

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: peutVoirEquipe,
  })

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
      filtreCloture,
      redacteurFiltre,
      rechercheDifferee,
      sortState?.key,
      sortState?.direction,
    ],
  })

  // Source unique de vérité des filtres : partagée par la liste ET les KPI,
  // pour que les compteurs affichés correspondent toujours aux lignes.
  const filtres = useMemo(
    () => ({
      estCloture: filtreCloture === '' ? undefined : filtreCloture === 'true',
      redacteur: redacteurFiltre ? Number(redacteurFiltre) : undefined,
      search: rechercheDifferee.trim() || undefined,
    }),
    [filtreCloture, redacteurFiltre, rechercheDifferee],
  )

  // Projection explicite des filtres dans le contrat de `fetchStats` : la
  // liste et les KPI voient le même ensemble de filtres, seul le `total` affiché
  // provient du `count` de la liste.
  const filtresKpi = useMemo(
    () => ({
      redacteur: filtres.redacteur,
      search: filtres.search,
      estCloture: filtres.estCloture,
    }),
    [filtres],
  )

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['crqs', page, pageSize, filtres, ordering],
    queryFn: () =>
      fetchCRQsPage({
        ...filtres,
        ordering,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  })

  const crqs = data?.results ?? []
  const total = data?.count ?? 0

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`redacteur`, `demandes`)
  // sont réordonnées localement.
  const crqsTries = useMemo(() => {
    if (!sortState) return crqs
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return crqs
    const sorted = [...crqs].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [crqs, sortState])

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
    queryKey: ['crqs', 'stats', filtresKpi],
    queryFn: () => fetchStats<StatsCRQ>('comptes-rendus', filtresKpi),
    placeholderData: (previous) => previous,
  })

  const enCours = stats?.en_cours ?? 0
  const demandes = stats?.demandes_reouverture ?? 0

  const aujourdHui = new Date().toISOString().split('T')[0]
  const crqAujourdHui = crqs.find(
    (c) => c.date_journaliere === aujourdHui && c.redacteur === user?.id,
  )
  const peutCreer = !redacteurFiltre || Number(redacteurFiltre) === user?.id

  const aFiltresActifs = Boolean(filtreCloture || redacteurFiltre || recherche)

  const resetFiltres = () => {
    setFiltreCloture('')
    setRedacteurFiltre('')
    setRecherche('')
  }

  return (
    <Layout title="Comptes-rendus quotidiens">
      <div className="space-y-4">
        {/* Stats + bouton créer */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              CRQ
              {enCours > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-info">
                    {enCours}
                  </span>{' '}
                  en cours
                </>
              )}
              {demandes > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-warning">
                    {demandes}
                  </span>{' '}
                  demande{demandes > 1 ? 's' : ''} en attente
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          {!crqAujourdHui && peutCreer && user && (
            <Button
              onClick={() => {
                setErreurAction(null)
                setIsModalOpen(true)
              }}
              leftIcon={<Plus size={14} />}
            >
              Mon CRQ du jour
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
              placeholder="Rechercher un CRQ..."
              className="w-full sm:flex-1 sm:w-auto min-w-0"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Select
                value={filtreCloture}
                onChange={(e) => setFiltreCloture(e.target.value)}
                className="w-full sm:w-auto !h-8 !py-0 !text-[13px]"
              >
                {FILTRES_CLOTURE.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>

              {peutVoirEquipe && (
                <Select
                  value={redacteurFiltre}
                  onChange={(e) =>
                    setRedacteurFiltre(
                      e.target.value ? Number(e.target.value) : '',
                    )
                  }
                  className="w-full sm:w-auto !h-8 !py-0 !text-[13px]"
                >
                  <option value="">Tous les rédacteurs</option>
                  {utilisateurs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nom_complet}
                      {u.id === user?.id ? ' (moi)' : ''}
                    </option>
                  ))}
                </Select>
              )}

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
              <p className="text-sm">Erreur lors du chargement des CRQ.</p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={crqsTries}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucun CRQ ne correspond à vos filtres.'
                  : 'Aucun compte-rendu pour le moment.'
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(c) => c.id}
                            renderCard={(crq: CompteRenduQuotidien) => (
                <Link
                  to={`/crq/${crq.id}`}
                  className="block p-4 hover:bg-ink-50/60 transition-colors"
                >
                  <div className="text-[13px] font-medium text-ink-900 leading-snug mb-2 capitalize">
                    {new Date(crq.date_journaliere).toLocaleDateString(
                      'fr-FR',
                      {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      },
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <StatutCRQBadge cloture={crq.est_cloture} />
                    <DemandesCell crq={crq} />
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Avatar
                      name={crq.redacteur_detail.nom_complet}
                      size="xs"
                    />
                    <span className="text-ink-600 truncate">
                      {crq.redacteur_detail.nom_complet}
                    </span>
                  </div>
                </Link>
              )}
              sortState={sortState}
              onSort={handleSort}
              renderRow={(crq: CompteRenduQuotidien) => (
                <>
                  <td className="px-4 py-2">
                    <Link to={`/crq/${crq.id}`} className="block group">
                      <span className="font-medium text-ink-900 text-[13px] group-hover:text-brand-600 transition-colors">
                        {new Date(crq.date_journaliere).toLocaleDateString(
                          'fr-FR',
                          {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          },
                        )}
                      </span>
                    </Link>
                  </td>

                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={crq.redacteur_detail.nom_complet}
                        size="sm"
                      />
                      <span className="text-[12px] text-ink-700 truncate">
                        {crq.redacteur_detail.nom_complet}
                      </span>
                      {crq.redacteur === user?.id && (
                        <span className="text-[10px] text-brand-600 font-medium">
                          (moi)
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-2">
                    <StatutCRQBadge cloture={crq.est_cloture} />
                  </td>

                  <td className="px-4 py-2">
                    <DemandesCell crq={crq} />
                  </td>

                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {user && (
<CRQActionsMenu
                        crq={crq}
                        userId={user.id}
                        estChefOuDirecteur={estChefOuDirecteur}
                        onErreur={setErreurAction}
                      />
                    )}
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

      <CRQFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Layout>
  )
}
