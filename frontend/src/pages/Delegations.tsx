/**
 * Page Délégations v6 — même pattern que Taches.
 * Pas de "modifier" (pas d'endpoint update) — actions : Révoquer, Supprimer.
 *
 * `DelegationViewSet` n'expose pas de période : le tri reste partiellement
 * serveur (`role_delegue` est un ordre métier, `delegant`/`delegataire` des
 * colonnes jointes). La recherche porte sur les noms des deux parties, le
 * rôle délégué et le service.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
// import { AlertCircle, Inbox, Plus } from 'lucide-react'
import {
  AlertCircle,
  ArrowRight,
  Plus,
  Inbox,
} from 'lucide-react'
import Layout from '../components/Layout'
import DelegationFormModal from '../components/delegations/DelegationFormModal'
import DelegationActionsMenu from '../components/delegations/DelegationActionsMenu'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import Select from '../components/ui/Select'
import Table, { Column, SortState } from '../components/ui/Table'
import { fetchDelegationsPage } from '../api/delegations'
import { fetchStats } from '../api/stats'
import type { Delegation, StatsDelegations } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'
import { usePermissions } from '../hooks/usePermissions'

const FILTRES_ACTIF = [
  { value: '', label: 'Toutes' },
  { value: 'true', label: 'Actives / Planifiées' },
  { value: 'false', label: 'Inactives' },
]

const COLUMNS: Column[] = [
  { key: 'delegant', label: 'Délégant', width: '22%', sortable: true },
  { key: 'delegataire', label: 'Délégataire', width: '22%', sortable: true },
  { key: 'role', label: 'Rôle délégué', width: '22%', sortable: true },
  { key: 'periode', label: 'Période', width: '180px', sortable: true },
  { key: 'statut', label: 'Statut', width: '120px', sortable: true },
  { key: 'actions', label: '', width: '140px', align: 'right' },
]

// ---- Tri ----
/**
 * Mapping colonne → paramètre `?ordering=` du serveur.
 * Absente de la table = colonne non triable côté serveur, le tri reste
 * local sur la page courante.
 */
const ORDRE_SERVEUR: Record<string, string | undefined> = {
  periode: 'date_debut',
}

/** Ordres métier arbitraires : jamais exposés à `ordering_fields`. */
const ORDRE_STATUT: Record<string, number> = {
  ACTIVE: 0,
  PLANIFIEE: 1,
  INACTIVE: 2,
}

function statutDe(d: Delegation): 'ACTIVE' | 'PLANIFIEE' | 'INACTIVE' {
  if (d.est_active) return 'ACTIVE'
  if (d.actif) return 'PLANIFIEE'
  return 'INACTIVE'
}

/**
 * Comparateurs client, réservés aux colonnes non triables côté serveur :
 * `delegant` / `delegataire` (colonnes jointes, incompatibles avec le
 * `.distinct()` du RBAC) et `role` / `statut` (ordres métier).
 */
const COMPARATEURS_CLIENT: Record<
  string,
  (a: Delegation, b: Delegation) => number
> = {
  delegant: (a, b) =>
    a.delegant_detail.nom_complet.localeCompare(
      b.delegant_detail.nom_complet,
      'fr',
      { sensitivity: 'base' },
    ),
  delegataire: (a, b) =>
    a.delegataire_detail.nom_complet.localeCompare(
      b.delegataire_detail.nom_complet,
      'fr',
      { sensitivity: 'base' },
    ),
  role: (a, b) =>
    a.role_delegue_display.localeCompare(b.role_delegue_display, 'fr', {
      sensitivity: 'base',
    }),
  statut: (a, b) => {
    const sa = statutDe(a)
    const sb = statutDe(b)
    return (ORDRE_STATUT[sa] ?? 99) - (ORDRE_STATUT[sb] ?? 99)
  },
}

function StatutDelegationBadge({ delegation }: { delegation: Delegation }) {
  if (delegation.est_active) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-success-bg text-success border-success-border">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Active
      </span>
    )
  }
  if (delegation.actif) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-warning-bg text-warning border-warning-border">
        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
        Planifiée
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-ink-100 text-ink-500 border-ink-200">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-400" />
      Inactive
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
        {fmt(debut)}
      </span>
      <span className="text-[11px] text-ink-400 whitespace-nowrap">
        → {fmt(fin)}
      </span>
    </div>
  )
}

export default function Delegations() {
  const { can } = usePermissions()
  const [filtreActif, setFiltreActif] = useState('')
  const [recherche, setRecherche] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [erreurAction, setErreurAction] = useState<string | null>(null)

  // La frappe reste instantanée côté UI ; seule la requête est différée.
  const rechercheDifferee = useDebounce(recherche, 350)

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [
      filtreActif,
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

  // Source unique de vérité des filtres : partagée par la liste ET les KPI.
  // `search` est aussi transmis aux KPI pour que les compteurs décrivent les
  // lignes affichées.
  const filtres = useMemo(
    () => ({
      actif: filtreActif === '' ? undefined : filtreActif === 'true',
      search: rechercheDifferee.trim() || undefined,
    }),
    [filtreActif, rechercheDifferee],
  )

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['delegations', page, pageSize, filtres, ordering],
    queryFn: () =>
      fetchDelegationsPage({
        ...filtres,
        ordering,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  })

  const delegations = data?.results ?? []
  const total = data?.count ?? 0

// `search` est calculé par le serveur : le filtrer sur la page courante
  // tronquerait le `count` et la pagination.
  const delegationsFiltrees = delegations

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`delegant`, `delegataire`,
  // `role`, `statut`) sont réordonnées localement.
  const delegationsTriees = useMemo(() => {
    if (!sortState) return delegationsFiltrees
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return delegationsFiltrees
    const sorted = [...delegationsFiltrees].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [delegationsFiltrees, sortState])

  // ---- Stats ----
  // KPI serveur sur l'INTÉGRALITÉ du périmètre. `FetchStatsParams` n'expose
  // pas `actif` : le filtre Actif/Inactif n'est donc pas transmis aux KPI.
  const { data: stats } = useQuery({
    queryKey: ['delegations', 'stats', filtres],
    queryFn: () => fetchStats<StatsDelegations>('delegations', filtres),
    placeholderData: (previous) => previous,
  })

  const actives = stats?.actives ?? 0
  const planifiees = stats?.planifiees ?? 0

  const aFiltresActifs = Boolean(filtreActif || recherche)

  const resetFiltres = () => {
    setFiltreActif('')
    setRecherche('')
  }

  return (
    <Layout title="Délégations">
      <div className="space-y-4">
        {/* Stats + bouton créer */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              délégation{total > 1 ? 's' : ''}
              {actives > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-success">{actives}</span>{' '}
                  active{actives > 1 ? 's' : ''}
                </>
              )}
              {planifiees > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-warning">{planifiees}</span>{' '}
                  planifiée{planifiees > 1 ? 's' : ''}
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          {can.createDelegation && (
            <Button
              onClick={() => {
              setErreurAction(null)
              setIsModalOpen(true)
            }}
              leftIcon={<Plus size={14} />}
            >
              Nouvelle délégation
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
          <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2 flex-wrap">
            <SearchInput
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher une délégation..."
            />

            <div className="flex items-center gap-2 ml-auto">
              <Select
                value={filtreActif}
                onChange={(e) => setFiltreActif(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {FILTRES_ACTIF.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
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
                Erreur lors du chargement des délégations.
              </p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={delegationsTriees}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucune délégation ne correspond à vos filtres.'
                  : 'Aucune délégation pour le moment.'
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(d) => d.id}
                            renderCard={(deleg: Delegation) => (
                <div className="p-4">
                  {/* Délégant → Délégataire */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex flex-col items-center gap-1">
                      <Avatar
                        name={deleg.delegant_detail.nom_complet}
                        size="sm"
                      />
                      <span className="text-[9px] text-ink-400 uppercase tracking-wide">
                        Délégant
                      </span>
                    </div>
                    <ArrowRight size={14} className="text-ink-300" />
                    <div className="flex flex-col items-center gap-1">
                      <Avatar
                        name={deleg.delegataire_detail.nom_complet}
                        size="sm"
                      />
                      <span className="text-[9px] text-ink-400 uppercase tracking-wide">
                        Délégataire
                      </span>
                    </div>
                  </div>

                  <div className="text-[12px] text-ink-700 font-medium mb-1">
                    {deleg.role_delegue_display}
                  </div>
                  {deleg.service && (
                    <div className="text-[11px] text-ink-500 mb-2">
                      {deleg.service}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-3">
                    <StatutDelegationBadge delegation={deleg} />
                    <span className="text-[10px] text-ink-400 tabular-nums">
                      {new Date(deleg.date_debut).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      →{' '}
                      {new Date(deleg.date_fin).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </div>
              )}
              sortState={sortState}
              onSort={handleSort}
              renderRow={(deleg: Delegation, _index, isHovered) => (
                <>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={deleg.delegant_detail.nom_complet}
                        size="sm"
                      />
                      <span className="text-[12px] text-ink-700 truncate">
                        {deleg.delegant_detail.nom_complet}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={deleg.delegataire_detail.nom_complet}
                        size="sm"
                      />
                      <span className="text-[12px] text-ink-700 truncate">
                        {deleg.delegataire_detail.nom_complet}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-2">
                    <span className="text-[12px] text-ink-700">
                      {deleg.role_delegue_display}
                    </span>
                    {deleg.service && (
                      <div className="text-[11px] text-ink-400 truncate">
                        {deleg.service}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    <PeriodeCell
                      debut={deleg.date_debut}
                      fin={deleg.date_fin}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <StatutDelegationBadge delegation={deleg} />
                  </td>

                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
<DelegationActionsMenu
                      delegation={deleg}
                      isRowHovered={isHovered}
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

      <DelegationFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Layout>
  )
}