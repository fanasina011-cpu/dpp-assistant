/**
 * Page Utilisateurs v5 — même pattern que Taches.
 * Tri, recherche, filtre par rôle et statut, avatars, toasts.
 * La modale de réassignation est conservée avec son design system.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Building2,
  Inbox,
  Mail,
  Shield,
  UserX,
} from 'lucide-react'
import Layout from '../components/Layout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Select from '../components/ui/Select'
import SearchInput from '../components/ui/SearchInput'
import Avatar from '../components/ui/Avatar'
import Pagination from '../components/ui/Pagination'
import Table, { Column, SortState } from '../components/ui/Table'
import { useAuth } from '../context/AuthContext'
import { estDirecteur as estDirecteurRole, usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import {
  desactiverUtilisateur,
  fetchUtilisateursPage,
  type DesactiverUtilisateurResponse,
} from '../api/utilisateurs'
import { fetchStats } from '../api/stats'
import type { StatsUtilisateurs, Utilisateur } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'

const ROLES_FILTRE = [
  { value: '', label: 'Tous les rôles' },
  { value: 'DIRECTEUR', label: 'Directeur' },
  { value: 'SECRETAIRE_DIRECTION', label: 'Secrétaire de Direction' },
  { value: 'CHEF_SERVICE_PROJETS', label: 'Chef Service Projets' },
  { value: 'CHEF_SERVICE_PARTENARIATS', label: 'Chef Service Partenariats' },
  { value: 'CONSEILLERE_TECHNIQUE', label: 'Conseillère Technique' },
  { value: 'MEMBRE_EQUIPE_APPUI', label: "Membre d'équipe" },
]

const STATUTS_FILTRE = [
  { value: '', label: 'Tous les statuts' },
  { value: 'actifs', label: 'Actifs' },
  { value: 'inactifs', label: 'Inactifs' },
]

const COLUMNS: Column[] = [
  { key: 'nom', label: 'Utilisateur', width: '28%', sortable: true },
  { key: 'email', label: 'Email', width: '22%', sortable: true },
  { key: 'role', label: 'Rôle', width: '20%', sortable: true },
  { key: 'service', label: 'Service', width: '15%', sortable: true },
  { key: 'statut', label: 'Statut', width: '110px', sortable: true },
  { key: 'actions', label: '', width: '120px', align: 'right' },
]

// ---- Tri ----
/**
 * Mapping colonne → paramètre `?ordering=` du serveur.
 * Absente de la table = colonne non exposée par le backend : le tri reste
 * local sur la page courante. `nom` est résolu par `last_name`, seule
 * colonne exposée qui porte le nom affiché.
 */
const ORDRE_SERVEUR: Record<string, string | undefined> = {
  nom: 'last_name',
}

const ORDRE_ROLE: Record<string, number> = {
  DIRECTEUR: 0,
  SECRETAIRE_DIRECTION: 1,
  CHEF_SERVICE_PROJETS: 2,
  CHEF_SERVICE_PARTENARIATS: 3,
  CONSEILLERE_TECHNIQUE: 4,
  MEMBRE_EQUIPE_APPUI: 5,
}

/**
 * Comparateurs client, réservés aux colonnes sans équivalent serveur :
 * `role` est un ordre métier, `service` un nom résolu côté client, et
 * `email` / `statut` ne sont pas dans `ordering_fields`.
 */
const COMPARATEURS_CLIENT: Record<
  string,
  (a: Utilisateur, b: Utilisateur) => number
> = {
  email: (a, b) =>
    (a.email || '').localeCompare(b.email || '', 'fr', { sensitivity: 'base' }),
  role: (a, b) => (ORDRE_ROLE[a.role] ?? 99) - (ORDRE_ROLE[b.role] ?? 99),
  service: (a, b) => {
    const as = a.service || ''
    const bs = b.service || ''
    if (!as && !bs) return 0
    if (!as) return 1
    if (!bs) return -1
    return as.localeCompare(bs, 'fr', { sensitivity: 'base' })
  },
  statut: (a, b) => Number(b.is_active) - Number(a.is_active),
}

function StatutUtilisateurBadge({ actif }: { actif: boolean }) {
  if (actif) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-success-bg text-success border-success-border">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Actif
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-ink-100 text-ink-500 border-ink-200">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-400" />
      Inactif
    </span>
  )
}

export default function Utilisateurs() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { roles } = usePermissions()
  const { showToast } = useToast()

  const [recherche, setRecherche] = useState('')
  const [roleFiltre, setRoleFiltre] = useState('')
  const [statutFiltre, setStatutFiltre] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)

  const [utilisateurEnCours, setUtilisateurEnCours] =
    useState<Utilisateur | null>(null)
  const [elementsABloquer, setElementsABloquer] =
    useState<DesactiverUtilisateurResponse | null>(null)
  const [reassignerA, setReassignerA] = useState<number | ''>('')

  const estDirecteur = estDirecteurRole(roles)

  // Clé de cache dédiée ('liste') : la clé 'utilisateurs' est partagée avec
  // tous les sélecteurs, qui chargent l'annuaire complet.
  // La frappe reste instantanée côté UI ; seule la requête est différée.
  const rechercheDifferee = useDebounce(recherche, 350)

  // Colonnes triables côté serveur → `?ordering=`. Les autres gardent un
  // tri local, qui reste un simple réordonnancement de la page courante.
  const triServeur = sortState ? ORDRE_SERVEUR[sortState.key] : undefined
  const ordering =
    triServeur && sortState?.direction === 'desc'
      ? `-${triServeur}`
      : triServeur

  // Source unique de vérité des filtres serveur. Les filtres `role` et
  // `statut` n'ont pas d'équivalent exposé par le backend : ils restent
  // appliqués sur la page courante.
  const filtres = useMemo(
    () => ({
      search: rechercheDifferee.trim() || undefined,
      role: roleFiltre || undefined,
      // Le backend attend `actif` / `inactif` (singulier), pas `actifs`.
      statut:
        statutFiltre === 'inactifs' ? 'inactif'
        : statutFiltre === 'actifs' ? 'actif'
        : undefined,
    }),
    [rechercheDifferee, roleFiltre, statutFiltre],
  )

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [
      rechercheDifferee,
      roleFiltre,
      statutFiltre,
      sortState?.key,
      sortState?.direction,
    ],
  })

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['utilisateurs', 'liste', page, pageSize, filtres, ordering],
    queryFn: () =>
      fetchUtilisateursPage({ ...filtres, ordering, page, pageSize }),
    placeholderData: (previous) => previous,
  })

  const utilisateurs = data?.results ?? []
  const total = data?.count ?? 0

  const desactiverMutation = useMutation({
    mutationFn: (args: { id: number; reassignerAId?: number }) =>
      desactiverUtilisateur(args.id, args.reassignerAId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast('Utilisateur désactivé', 'success')
      setUtilisateurEnCours(null)
      setElementsABloquer(null)
      setReassignerA('')
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        // Cas spécifique : réassignation nécessaire
        setElementsABloquer(err.response.data)
      } else {
        showToast(
          err?.response?.data?.detail || 'Erreur lors de la désactivation',
          'error',
        )
      }
    },
  })

  const handleDesactiver = (u: Utilisateur) => {
    setUtilisateurEnCours(u)
    setElementsABloquer(null)
    setReassignerA('')
    desactiverMutation.mutate({ id: u.id })
  }

  const handleConfirmerReassignation = () => {
    if (!utilisateurEnCours || !reassignerA) return
    desactiverMutation.mutate({
      id: utilisateurEnCours.id,
      reassignerAId: Number(reassignerA),
    })
  }

  const candidats = utilisateurs.filter(
    (u) => u.is_active && u.id !== utilisateurEnCours?.id,
  )

  // ---- Filtres ----
  // `role` et `statut` sont désormais des query params serveur : les filtrer
  // sur la page tronquerait le `count` et la pagination.
  //
  // `statut=inactif` ne peut rien renvoyer : le backend exclut déjà les
  // comptes désactivés de l'annuaire. L'option reste dans la liste pour ne
  // pas changer le design, et rendra toujours zéro ligne.
  const utilisateursFiltres = utilisateurs

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`email`, `role`, `service`,
  // `statut`) sont réordonnées localement.
  const utilisateursTries = useMemo(() => {
    if (!sortState) return utilisateursFiltres
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return utilisateursFiltres
    const sorted = [...utilisateursFiltres].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [utilisateursFiltres, sortState])

  const handleSort = (key: string) => {
    setSortState((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' }
      if (current.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  // ---- Stats ----
  // KPI serveur : calculés sur TOUT le périmètre de l'utilisateur, et non
  // sur la page courante. L'API n'expose jamais de compte inactif
  // (`get_queryset` filtre sur `is_active=True`) : `stats.total` est donc
  // l'effectif actif, et aucun indicateur inactif n'est publié.
  const { data: stats } = useQuery({
    queryKey: ['utilisateurs', 'stats', filtres],
    queryFn: () => fetchStats<StatsUtilisateurs>('utilisateurs', filtres),
    placeholderData: (previous) => previous,
  })

  const actifs = stats?.total ?? 0

  const aFiltresActifs = Boolean(roleFiltre || statutFiltre || recherche)

  const resetFiltres = () => {
    setRoleFiltre('')
    setStatutFiltre('')
    setRecherche('')
  }

  return (
    <Layout title="Utilisateurs">
      <div className="space-y-4">
        {/* Stats + note */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              utilisateur{total > 1 ? 's' : ''}
              {actifs > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-success">
                    {actifs}
                  </span>{' '}
                  actif{actifs > 1 ? 's' : ''}
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          {estDirecteur && (
            <span className="text-[11px] text-ink-500 inline-flex items-center gap-1.5">
              <Shield size={12} className="text-brand-500" />
              Vous pouvez désactiver un compte
            </span>
          )}
        </div>

        {/* Card + toolbar + table */}
        <Card noPadding>
          <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2 flex-wrap">
            <SearchInput
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher un utilisateur..."
            />

            <div className="flex items-center gap-2 ml-auto">
              <Select
                value={roleFiltre}
                onChange={(e) => setRoleFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {ROLES_FILTRE.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>

              <Select
                value={statutFiltre}
                onChange={(e) => setStatutFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {STATUTS_FILTRE.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
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

          {queryError ? (
            <div className="py-12 flex flex-col items-center gap-2 text-danger">
              <AlertCircle size={22} />
              <p className="text-sm">Erreur lors du chargement.</p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={utilisateursTries}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucun utilisateur ne correspond à vos filtres.'
                  : 'Aucun utilisateur.'
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(u) => u.id}
                            renderCard={(u: Utilisateur) => (
                <Link
                  to={`/utilisateurs/${u.id}`}
                  className="block p-4 hover:bg-ink-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar name={u.nom_complet} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-ink-900 truncate">
                        {u.nom_complet}
                      </div>
                      <div className="text-[11px] text-ink-500 truncate">
                        @{u.username}
                      </div>
                    </div>
                    <StatutUtilisateurBadge actif={u.is_active} />
                  </div>

                  <div className="space-y-1 text-[11px] text-ink-600">
                    <div className="flex items-center gap-1.5">
                      <Shield size={11} className="text-ink-400" />
                      <span>{u.role_display}</span>
                    </div>
                    {u.service && (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={11} className="text-ink-400" />
                        <span>{u.service}</span>
                      </div>
                    )}
                    {u.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={11} className="text-ink-400" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    )}
                  </div>
                </Link>
              )}
              sortState={sortState}
              onSort={handleSort}
              renderRow={(u: Utilisateur) => (
                <>
                  <td className="px-4 py-2">
                    <Link
                      to={`/utilisateurs/${u.id}`}
                      className="flex items-center gap-2.5 min-w-0 group"
                    >
                      <Avatar name={u.nom_complet} size="md" />
                      <div className="min-w-0">
                        <div className="font-medium text-ink-900 text-[13px] truncate group-hover:text-brand-600 transition-colors">
                          {u.nom_complet}
                        </div>
                        <div className="text-[11px] text-ink-500 truncate">
                          @{u.username}
                        </div>
                      </div>
                    </Link>
                  </td>

                  <td className="px-4 py-2 text-[12px] text-ink-600 truncate">
                    {u.email || <span className="text-ink-400">—</span>}
                  </td>

                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
                      <Shield size={11} className="text-ink-400" />
                      {u.role_display}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-[12px] text-ink-600">
                    {u.service || <span className="text-ink-400">—</span>}
                  </td>

                  <td className="px-4 py-2">
                    <StatutUtilisateurBadge actif={u.is_active} />
                  </td>

                  <td className="px-2 py-2 text-right">
                    {estDirecteur && u.is_active && u.id !== user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDesactiver(u)}
                        disabled={desactiverMutation.isPending}
                        leftIcon={<UserX size={12} />}
                        className="text-danger hover:bg-danger-bg"
                      >
                        Désactiver
                      </Button>
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

          {/* ===== Modale de réassignation (409) ===== */}
      {utilisateurEnCours && elementsABloquer?.elements && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg my-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-warning-bg text-warning flex items-center justify-center shrink-0">
                <AlertCircle size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink-900">
                  Réassignation obligatoire
                </h3>
                <p className="text-[12px] text-ink-500 mt-0.5">
                  {utilisateurEnCours.nom_complet} détient des éléments actifs.
                  Sélectionnez un utilisateur pour les reprendre avant la
                  désactivation.
                </p>
              </div>
            </div>

            {/* Liste des éléments */}
            <div className="border border-ink-200 rounded-md p-3 mb-4 text-[12px] max-h-48 overflow-y-auto bg-ink-50/50 space-y-3">
              {elementsABloquer.elements.taches.length > 0 && (
                <div>
                  <div className="font-semibold text-ink-800 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-info" />
                    Tâches ({elementsABloquer.elements.taches.length})
                  </div>
                  <ul className="list-disc list-inside text-ink-600 space-y-0.5 ml-1">
                    {elementsABloquer.elements.taches.map((t) => (
                      <li key={t.id}>{t.titre}</li>
                    ))}
                  </ul>
                </div>
              )}

              {elementsABloquer.elements.activites.length > 0 && (
                <div>
                  <div className="font-semibold text-ink-800 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    Activités ({elementsABloquer.elements.activites.length})
                  </div>
                  <ul className="list-disc list-inside text-ink-600 space-y-0.5 ml-1">
                    {elementsABloquer.elements.activites.map((a) => (
                      <li key={a.id}>{a.titre}</li>
                    ))}
                  </ul>
                </div>
              )}

              {elementsABloquer.elements.blocages.length > 0 && (
                <div>
                  <div className="font-semibold text-ink-800 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                    Blocages ({elementsABloquer.elements.blocages.length})
                  </div>
                  <ul className="list-disc list-inside text-ink-600 space-y-0.5 ml-1">
                    {elementsABloquer.elements.blocages.map((b) => (
                      <li key={b.id}>
                        {b.description.length > 60
                          ? `${b.description.substring(0, 60)}…`
                          : b.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {elementsABloquer.elements.evenements.length > 0 && (
                <div>
                  <div className="font-semibold text-ink-800 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    Événements futurs (
                    {elementsABloquer.elements.evenements.length})
                  </div>
                  <ul className="list-disc list-inside text-ink-600 space-y-0.5 ml-1">
                    {elementsABloquer.elements.evenements.map((e) => (
                      <li key={e.id}>{e.titre}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Select
              label="Réassigner à *"
              value={reassignerA}
              onChange={(e) =>
                setReassignerA(e.target.value ? Number(e.target.value) : '')
              }
              className="mb-4"
            >
              <option value="">— Sélectionner un utilisateur actif —</option>
              {candidats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom_complet} ({c.role_display})
                </option>
              ))}
            </Select>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setUtilisateurEnCours(null)
                  setElementsABloquer(null)
                  setReassignerA('')
                }}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmerReassignation}
                disabled={!reassignerA || desactiverMutation.isPending}
              >
                {desactiverMutation.isPending
                  ? 'Désactivation...'
                  : 'Réassigner et désactiver'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Layout>
  )
}
