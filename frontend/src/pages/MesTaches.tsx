/**
 * Page "Mes tâches" v6 — tâches dont je suis responsable ou que j'ai créées.
 * Même design que /taches, mais filtré via `?mes_taches=true`.
 * Tri, recherche, filtres et KPI côté serveur (même socle que Taches).
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Inbox, Plus } from 'lucide-react'
import Layout from '../components/Layout'
import StatutBadge from '../components/StatutBadge'
import PrioriteBadge from '../components/PrioriteBadge'
import TacheFormModal from '../components/taches/TacheFormModal'
import TacheActionsMenu from '../components/taches/TacheActionsMenu'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import Select from '../components/ui/Select'
import Table, { Column, SortState } from '../components/ui/Table'
import { fetchTachesPage, fetchTachesStats } from '../api/taches'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'
import { usePermissions } from '../hooks/usePermissions'
import type { Tache } from '../types'

const STATUTS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'A_FAIRE', label: 'À faire' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'BLOQUEE', label: 'Bloquée' },
  { value: 'A_VALIDER', label: 'À valider' },
  { value: 'TERMINEE', label: 'Terminée' },
  { value: 'ANNULEE', label: 'Annulée' },
]

const PRIORITES = [
  { value: '', label: 'Toutes priorités' },
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
]

const ECHEANCES = [
  { value: '', label: 'Toutes échéances' },
  { value: 'retard', label: 'En retard' },
  { value: 'aujourd_hui', label: "Aujourd'hui" },
  { value: 'semaine', label: 'Cette semaine' },
  { value: 'mois', label: 'Ce mois' },
  { value: 'sans_date', label: 'Sans date' },
]

const COLUMNS: Column[] = [
  { key: 'titre', label: 'Titre', width: '32%', sortable: true },
  { key: 'statut', label: 'Statut', width: '120px', sortable: true },
  { key: 'priorite', label: 'Priorité', width: '120px', sortable: true },
  { key: 'createur', label: 'Créée par', width: '180px', sortable: true },
  { key: 'echeance', label: 'Échéance', width: '130px', sortable: true },
  { key: 'actions', label: '', width: '160px', align: 'right' },
]

/**
 * Traduit le raccourci d'échéance de la toolbar en bornes `YYYY-MM-DD`
 * acceptées par le serveur (`?date_debut=` / `?date_fin=`).
 *
 * `date_fin` est inclusif sur la journée entière côté serveur, et les bornes
 * excluent d'elles-mêmes les NULL : la sémantique est identique à l'ancien
 * filtrage client.
 *
 * `sans_date` n'a pas d'équivalent en bornes (une borne ne peut pas
 * sélectionner les NULL) : il est traduit par le query param dédié
 * `?sans_date=true`, construit dans `filtres`.
 */
function fenetreEcheance(
  valeur: string,
  ref: Date,
): { debut: string; fin: string } | null {
  if (!valeur) return null

  const jour = new Date(ref)
  jour.setHours(0, 0, 0, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`

  if (valeur === 'aujourd_hui') return { debut: iso(jour), fin: iso(jour) }

  if (valeur === 'retard') {
    const veille = new Date(jour)
    veille.setDate(veille.getDate() - 1)
    return { debut: '0001-01-01', fin: iso(veille) }
  }

  if (valeur === 'semaine') {
    const debut = new Date(jour)
    debut.setDate(jour.getDate() - (jour.getDay() || 7) + 1)
    const fin = new Date(debut)
    fin.setDate(debut.getDate() + 6)
    return { debut: iso(debut), fin: iso(fin) }
  }

  if (valeur === 'mois') {
    return {
      debut: iso(new Date(jour.getFullYear(), jour.getMonth(), 1)),
      fin: iso(new Date(jour.getFullYear(), jour.getMonth() + 1, 0)),
    }
  }

  return null
}

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

/** Ordres métier arbitraires : jamais exposés à `ordering_fields`. */
const ORDRE_STATUT: Record<string, number> = {
  BLOQUEE: 0,
  EN_ATTENTE: 1,
  EN_COURS: 2,
  A_VALIDER: 3,
  A_FAIRE: 3,
  TERMINEE: 4,
  ANNULEE: 5,
}

const ORDRE_PRIORITE: Record<string, number> = {
  URGENTE: 0,
  HAUTE: 1,
  NORMALE: 2,
  BASSE: 3,
}

/** Comparateurs client, réservés aux colonnes non triables côté serveur. */
const COMPARATEURS_CLIENT: Record<string, (a: Tache, b: Tache) => number> = {
  statut: (a, b) =>
    (ORDRE_STATUT[a.statut] ?? 99) - (ORDRE_STATUT[b.statut] ?? 99),
  priorite: (a, b) =>
    (ORDRE_PRIORITE[a.priorite] ?? 99) - (ORDRE_PRIORITE[b.priorite] ?? 99),
  createur: (a, b) => {
    const an = a.createur_detail?.nom_complet || ''
    const bn = b.createur_detail?.nom_complet || ''
    if (!an && !bn) return 0
    if (!an) return 1
    if (!bn) return -1
    return an.localeCompare(bn, 'fr', { sensitivity: 'base' })
  },
}

function EcheanceCell({
  date,
  estEnRetard,
}: {
  date: string | null
  estEnRetard: boolean
}) {
  if (!date) return <span className="text-[12px] text-ink-400">—</span>

  const d = new Date(date)
  const dateStr = d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  if (!estEnRetard) {
    return (
      <span className="text-[12px] text-ink-700 font-medium whitespace-nowrap">
        {dateStr}
      </span>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
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

export default function MesTaches() {
  const { user } = useAuth()
  const { can } = usePermissions()
  const [statutFiltre, setStatutFiltre] = useState('')
  const [prioriteFiltre, setPrioriteFiltre] = useState('')
  const [echeanceFiltre, setEcheanceFiltre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // La frappe reste instantanée côté UI ; seule la requête est différée.
  const rechercheDifferee = useDebounce(recherche, 350)

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [
      user?.id,
      statutFiltre,
      prioriteFiltre,
      echeanceFiltre,
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

  const fenetre = useMemo(
    () => fenetreEcheance(echeanceFiltre, new Date()),
    [echeanceFiltre],
  )

  // Source unique de vérité des filtres : partagée par la liste ET les KPI,
  // pour que les compteurs affichés correspondent toujours aux lignes.
  // `mesTaches` restreint la page aux tâches dont je suis responsable ou que
  // j'ai créées.
  const filtres = useMemo(
    () => ({
      // Couvre les tâches assignées ET celles que j'ai créées : un simple
      // `?responsable=<id>` exclurait les secondes.
      mesTaches: true,
      statut: statutFiltre || undefined,
      priorite: prioriteFiltre || undefined,
      search: rechercheDifferee.trim() || undefined,
      dateDebut: fenetre?.debut,
      dateFin: fenetre?.fin,
      sansDate: echeanceFiltre === 'sans_date' ? true : undefined,
    }),
    [
      statutFiltre,
      prioriteFiltre,
      rechercheDifferee,
      fenetre,
      echeanceFiltre,
    ],
  )

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['mes-taches', page, pageSize, filtres, ordering],
    queryFn: () =>
      fetchTachesPage({
        ...filtres,
        ordering,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
    enabled: Boolean(user?.id),
  })

  const taches = data?.results ?? []
  const total = data?.count ?? 0

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`statut`, `priorite`,
  // `createur`) sont réordonnées localement.
  const tachesTriees = useMemo(() => {
    if (!sortState) return taches
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return taches
    const sorted = [...taches].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [taches, sortState])

  // ---- Stats ----
  // KPI serveur : calculés sur TOUT le périmètre, pas sur la page courante.
  const { data: stats } = useQuery({
    queryKey: ['mes-taches', 'stats', filtres],
    queryFn: () => fetchTachesStats(filtres),
    placeholderData: (previous) => previous,
    enabled: Boolean(user?.id),
  })

  const enCours = stats?.en_cours ?? 0
  const enRetard = stats?.en_retard ?? 0

  const aFiltresActifs = Boolean(
    statutFiltre || prioriteFiltre || echeanceFiltre || recherche,
  )

  const resetFiltres = () => {
    setStatutFiltre('')
    setPrioriteFiltre('')
    setEcheanceFiltre('')
    setRecherche('')
  }

  return (
    <Layout title="Mes tâches">
      <div className="space-y-4">
        {/* Stats + bouton créer */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              tâche{total > 1 ? 's' : ''} assignée
              {total > 1 ? 's' : ''} à moi
              {enCours > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-info">{enCours}</span>{' '}
                  en cours
                </>
              )}
              {enRetard > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-danger">{enRetard}</span>{' '}
                  en retard
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          {can.createTache && (
            <Button
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus size={14} />}
            >
              Nouvelle tâche
            </Button>
          )}
        </div>

        {/* Card + toolbar + table */}
        <Card noPadding>
          <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2 flex-wrap">
            <SearchInput
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher une tâche..."
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

              <Select
                value={echeanceFiltre}
                onChange={(e) => setEcheanceFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {ECHEANCES.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
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
              <p className="text-sm">Erreur lors du chargement des tâches.</p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={tachesTriees}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucune tâche ne correspond à vos filtres.'
                  : "Aucune tâche ne vous est assignée."
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(t) => t.id}
                            renderCard={(tache: Tache) => (
                <Link
                  to={`/taches/${tache.id}`}
                  className="block p-4 hover:bg-ink-50/60 transition-colors"
                >
                  {/* Titre + badge retard */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-ink-900 leading-snug">
                        {tache.titre}
                      </div>
                      {tache.description && (
                        <div className="text-[11px] text-ink-500 truncate mt-0.5">
                          {tache.description}
                        </div>
                      )}
                    </div>
                    {tache.est_en_retard && (
                      <span className="shrink-0 text-[10px] font-semibold text-danger bg-danger-bg border border-danger-border px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 uppercase tracking-wide">
                        <AlertCircle size={10} />
                        Retard
                      </span>
                    )}
                  </div>

                  {/* Statut + priorité */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <StatutBadge
                      statut={tache.statut}
                      statutDisplay={tache.statut_display}
                    />
                    <PrioriteBadge
                      priorite={tache.priorite}
                      prioriteDisplay={tache.priorite_display}
                    />
                  </div>

                  {/* Créateur + échéance */}
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar
                        name={tache.createur_detail.nom_complet}
                        size="xs"
                      />
                      <span className="text-ink-600 truncate">
                        {tache.createur_detail.nom_complet}
                      </span>
                    </div>

                    {tache.date_echeance && (
                      <span
                        className={`tabular-nums shrink-0 ${
                          tache.est_en_retard
                            ? 'text-danger font-semibold'
                            : 'text-ink-500'
                        }`}
                      >
                        {new Date(tache.date_echeance).toLocaleDateString(
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
              renderRow={(tache: Tache, _index, isHovered) => (
                <>
                  <td className="px-4 py-2">
                    <Link to={`/taches/${tache.id}`} className="block group">
                      <span className="font-medium text-ink-900 text-[13px] group-hover:text-brand-600 transition-colors">
                        {tache.titre}
                      </span>
                    </Link>
                  </td>

                  <td className="px-4 py-2">
                    <StatutBadge
                      statut={tache.statut}
                      statutDisplay={tache.statut_display}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <PrioriteBadge
                      priorite={tache.priorite}
                      prioriteDisplay={tache.priorite_display}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={tache.createur_detail.nom_complet}
                        size="sm"
                      />
                      <span className="text-[12px] text-ink-700 truncate">
                        {tache.createur_detail.nom_complet}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-2">
                    <EcheanceCell
                      date={tache.date_echeance}
                      estEnRetard={tache.est_en_retard}
                    />
                  </td>

                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TacheActionsMenu
                      tache={tache}
                      isRowHovered={isHovered}
                      peutValiderRejeter={can.validerRejeterTache(tache)}
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

      <TacheFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Layout>
  )
}