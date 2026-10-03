/**
 * Page Historique — tableau avec filtres horizontaux et menu d'actions.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  FileText,
  FolderKanban,
  History,
  Inbox,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react'
import Layout from '../components/Layout'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import SearchInput from '../components/ui/SearchInput'
import Select from '../components/ui/Select'
import DropdownMenu, { DropdownMenuItem } from '../components/ui/DropdownMenu'
import Pagination from '../components/ui/Pagination'
import Table, { Column, SortState } from '../components/ui/Table'
import ConfirmDialog from '../components/communs/ConfirmDialog'
import PurgeHistoriqueModal from '../components/historique/PurgeHistoriqueModal'
import { deleteHistorique, fetchHistoriquePage } from '../api/historique'
import { useToast } from '../context/ToastContext'
import type { HistoriqueAction } from '../types'
import { usePagination } from '../hooks/usePagination'
import { usePermissions, estDirecteur as estDirecteurRole } from '../hooks/usePermissions'
import { nomAuteur } from '../utils/historique'
import { useDebounce } from '../hooks/useDebounce'

const CIBLES = [
  { value: '', label: 'Toutes les cibles' },
  { value: 'TACHE', label: 'Tâches' },
  { value: 'ACTIVITE', label: 'Activités' },
  { value: 'INSTRUCTION', label: 'Instructions' },
  { value: 'BLOCAGE', label: 'Blocages' },
]

const CATEGORIES_ACTION = [
  { value: '', label: 'Toutes les actions' },
  { value: 'CREATION', label: 'Créations' },
  { value: 'MODIFICATION', label: 'Modifications' },
  { value: 'STATUT', label: 'Changements de statut' },
  { value: 'REASSIGNATION', label: 'Réassignations' },
  { value: 'ECHEANCE', label: "Reports d'échéance" },
  { value: 'ANNULATION', label: 'Annulations' },
  { value: 'CLOTURE', label: 'Clôtures' },
  { value: 'SUPPRESSION', label: 'Suppressions' },
  { value: 'DELEGATION', label: 'Délégations' },
]

const PERIODES = [
  { value: '', label: 'Toutes périodes' },
  { value: 'aujourd_hui', label: "Aujourd'hui" },
  { value: '7j', label: '7 jours' },
  { value: '30j', label: '30 jours' },
  { value: '90j', label: '3 mois' },
]

const COLUMNS: Column[] = [
  { key: 'date', label: 'Date', width: '140px', sortable: true },
  { key: 'action', label: 'Action', width: '200px', sortable: true },
  { key: 'cible', label: 'Cible', width: '140px', sortable: true },
  { key: 'auteur', label: 'Auteur', width: '180px', sortable: true },
  { key: 'details', label: 'Détails' },
  { key: 'actions', label: '', width: '50px', align: 'right' },
]

/**
 * Catégorise une action. Référence NORMATIVE de la cascade.
 *
 * Elle n'habille plus la liste (la couleur du badge vient de `styleAction`) :
 * elle a été conservée et exportée parce qu'elle définit la sémantique du
 * query param `?categorie=`, dont le backend doit reproduire exactement la
 * cascade dans `CATEGORIES_ACTION` pour filtrer.
 *
 * Le test backend `test_categories_action_synchronisees` lit ce fichier et
 * échoue si les deux implémentations divergent.
 *
 * Si cette fonction change, `CATEGORIES_ACTION` dans
 * `backend/api/views.py` DOIT être mis à jour, et le test
 * `test_categories_action_synchronisees` régénéré.
 */
export function categoriserAction(action: string): string {
  if (action.includes('CREEE') || action.includes('CREE') || action === 'CREATION') return 'CREATION'
  if (action.includes('MODIFIEE') || action.includes('MODIFIE')) return 'MODIFICATION'
  if (action.includes('STATUT')) return 'STATUT'
  if (action.includes('REASSIGNEE') || action.includes('REASSIGNATION')) return 'REASSIGNATION'
  if (action.includes('ECHEANCE')) return 'ECHEANCE'
  if (action.includes('ANNULATION')) return 'ANNULATION'
  if (action.includes('CLOTURE') || action.includes('RESOLU') || action.includes('TERMINEE')) return 'CLOTURE'
  if (action.includes('SUPPRIMEE') || action.includes('SUPPRIME')) return 'SUPPRESSION'
  if (action.includes('DELEGATION')) return 'DELEGATION'
  return 'AUTRE'
}

function styleAction(action: string): string {
  const map: Record<string, string> = {
    CREATION: 'bg-info-bg text-info border-info-border',
    TACHE_CREEE: 'bg-info-bg text-info border-info-border',
    ACTIVITE_CREEE: 'bg-info-bg text-info border-info-border',
    INSTRUCTION_EMISE: 'bg-info-bg text-info border-info-border',
    BLOCAGE_SIGNE: 'bg-warning-bg text-warning border-warning-border',
    TACHE_MODIFIEE: 'bg-brand-50 text-brand-700 border-brand-200',
    ACTIVITE_MODIFIEE: 'bg-brand-50 text-brand-700 border-brand-200',
    TACHE_STATUT_CHANGE: 'bg-brand-50 text-brand-700 border-brand-200',
    INSTRUCTION_DEST_STATUT: 'bg-brand-50 text-brand-700 border-brand-200',
    CLOTURE: 'bg-success-bg text-success border-success-border',
    TACHE_TERMINEE: 'bg-success-bg text-success border-success-border',
    ACTIVITE_CLOTUREE: 'bg-success-bg text-success border-success-border',
    BLOCAGE_RESOLU: 'bg-success-bg text-success border-success-border',
    TACHE_REASSIGNEE: 'bg-brand-50 text-brand-700 border-brand-200',
    ACTIVITE_REASSIGNEE: 'bg-brand-50 text-brand-700 border-brand-200',
    ECHEANCE_REPORTEE: 'bg-warning-bg text-warning border-warning-border',
    ANNULATION_MOTIVEE: 'bg-danger-bg text-danger border-danger-border',
    SUPPRESSION: 'bg-danger-bg text-danger border-danger-border',
    TACHE_SUPPRIMEE: 'bg-danger-bg text-danger border-danger-border',
    ACTIVITE_SUPPRIMEE: 'bg-danger-bg text-danger border-danger-border',
    INSTRUCTION_SUPPRIMEE: 'bg-danger-bg text-danger border-danger-border',
    BLOCAGE_SUPPRIME: 'bg-danger-bg text-danger border-danger-border',
    BLOCAGE_REMONTE: 'bg-purple-50 text-purple-700 border-purple-200',
    PRIORITE_ELEVEE: 'bg-warning-bg text-warning border-warning-border',
    DELEGATION_CREEE: 'bg-info-bg text-info border-info-border',
    DELEGATION_REVOQUEE: 'bg-danger-bg text-danger border-danger-border',
  }
  return map[action] || 'bg-ink-100 text-ink-600 border-ink-200'
}

// ---- Tri ----
/**
 * Mapping colonne → paramètre `?ordering=` du serveur.
 * Absente de la table = colonne non exposée par le backend : le tri reste
 * local sur la page courante. `cible` (ordre de regroupement métier) et
 * `auteur` (clé étrangère non exposée) en font partie.
 */
const ORDRE_SERVEUR: Record<string, string | undefined> = {
  date: 'date_action',
  action: 'action',
}

/**
 * Comparateurs client, réservés aux colonnes sans équivalent serveur.
 * `auteur` passe par `nomAuteur()` : le nom affiché vient d'une colonne
 * jointe, et `auteur = null` y est résolu en « Système ».
 */
const COMPARATEURS_CLIENT: Record<
  string,
  (a: HistoriqueAction, b: HistoriqueAction) => number
> = {
  cible: (a, b) =>
    (a.cible_type || '').localeCompare(b.cible_type || '', 'fr', {
      sensitivity: 'base',
    }),
  auteur: (a, b) =>
    nomAuteur(a).localeCompare(nomAuteur(b), 'fr', {
      sensitivity: 'base',
    }),
}

function CibleCell({ action }: { action: HistoriqueAction }) {
  const renderLink = (id: number, label: string, path: string) => (
    <Link
      to={`${path}/${id}`}
      className="inline-flex items-center gap-1.5 text-[12px] text-brand-600 hover:text-brand-700 hover:underline font-medium"
    >
      {label} #{id}
    </Link>
  )

  switch (action.cible_type) {
    case 'TACHE':
      if (action.tache) {
        return (
          <span className="inline-flex items-center gap-1.5">
            <FileText size={12} className="text-ink-400 shrink-0" />
            {renderLink(action.tache, 'Tâche', '/taches')}
          </span>
        )
      }
      break
    case 'INSTRUCTION':
      if (action.instruction) {
        return (
          <span className="inline-flex items-center gap-1.5">
            <FileText size={12} className="text-ink-400 shrink-0" />
            {renderLink(action.instruction, 'Instr.', '/instructions')}
          </span>
        )
      }
      break
    case 'BLOCAGE':
      if (action.blocage) {
        return (
          <span className="inline-flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-ink-400 shrink-0" />
            {renderLink(action.blocage, 'Blocage', '/blocages')}
          </span>
        )
      }
      break
    case 'ACTIVITE':
      if (action.activite) {
        return (
          <span className="inline-flex items-center gap-1.5">
            <FolderKanban size={12} className="text-ink-400 shrink-0" />
            {renderLink(action.activite, 'Activité', '/activites')}
          </span>
        )
      }
      break
  }
  return <span className="text-[12px] text-ink-400">—</span>
}

/**
 * Borne basse (`YYYY-MM-DD`) du raccourci de période.
 *
 * Seule une borne basse est envoyée : `date_debut` suffit à exprimer « les N
 * derniers jours », et la borne haute resterait bloquée sur la date du jour
 * alors que l'historique ne contient rien de futur.
 */
function fenetrePeriode(
  valeur: string,
  ref: Date,
): { debut: string } | null {
  if (!valeur) return null

  const seuil = new Date(ref)
  switch (valeur) {
    case 'aujourd_hui':
      seuil.setHours(0, 0, 0, 0)
      break
    case '7j':
      seuil.setDate(ref.getDate() - 7)
      break
    case '30j':
      seuil.setDate(ref.getDate() - 30)
      break
    case '90j':
      seuil.setDate(ref.getDate() - 90)
      break
    default:
      return null
  }

  const debut = seuil
  return {
    debut: `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`,
  }
}

export default function Historique() {
  const queryClient = useQueryClient()
  const { roles } = usePermissions()
  const { showToast } = useToast()

  const [recherche, setRecherche] = useState('')
  const [cibleFiltre, setCibleFiltre] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState('')
  const [periodeFiltre, setPeriodeFiltre] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [isPurgeOpen, setIsPurgeOpen] = useState(false)
  const [actionASupprimer, setActionASupprimer] = useState<HistoriqueAction | null>(null)

  const estDirecteur = estDirecteurRole(roles)

  // La frappe reste instantanée côté UI ; seule la requête est différée.
  const rechercheDifferee = useDebounce(recherche, 350)

  // Colonnes triables côté serveur → `?ordering=`. Les autres gardent un
  // tri local, qui reste un simple réordonnancement de la page courante.
  const triServeur = sortState ? ORDRE_SERVEUR[sortState.key] : undefined
  const ordering =
    triServeur && sortState?.direction === 'desc'
      ? `-${triServeur}`
      : triServeur

  // Source unique de vérité des filtres serveur.
  const fenetre = useMemo(
    () => fenetrePeriode(periodeFiltre, new Date()),
    [periodeFiltre],
  )

  const filtres = useMemo(
    () => ({
      search: rechercheDifferee.trim() || undefined,
      cibleType: cibleFiltre || undefined,
      categorie: categorieFiltre || undefined,
      dateDebut: fenetre?.debut,
    }),
    [rechercheDifferee, cibleFiltre, categorieFiltre, fenetre],
  )

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [
      rechercheDifferee,
      cibleFiltre,
      categorieFiltre,
      periodeFiltre,
      sortState?.key,
      sortState?.direction,
    ],
  })

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['historique', page, pageSize, filtres, ordering],
    queryFn: () => fetchHistoriquePage({ ...filtres, ordering, page, pageSize }),
    placeholderData: (previous) => previous,
  })

  const actions = data?.results ?? []
  const total = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteHistorique(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historique'] })
      showToast('Entrée supprimée', 'success')
      setActionASupprimer(null)
    },
    onError: () => {
      showToast('Impossible de supprimer', 'error')
      setActionASupprimer(null)
    },
  })

  // `cible`, `categorie` et `periode` sont désormais des query params
  // serveur : filtrer la page tronquerait le `count` et la pagination.
  // Sans tri explicite, l'ordre serveur (`-date_action`) est conservé tel quel.
  const actionsAffichees = actions

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`cible`, `auteur`) sont
  // réordonnées localement.
  const actionsTriees = useMemo(() => {
    if (!sortState) return actionsAffichees
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return actionsAffichees
    const sorted = [...actionsAffichees].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [actionsAffichees, sortState])

  const handleSort = (key: string) => {
    setSortState((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' }
      if (current.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  const aFiltresActifs = Boolean(
    cibleFiltre || categorieFiltre || periodeFiltre || recherche,
  )

  const resetFiltres = () => {
    setCibleFiltre('')
    setCategorieFiltre('')
    setPeriodeFiltre('')
    setRecherche('')
  }

  return (
    <Layout title="Historique des actions">
      <div className="space-y-4">
        {/* Bandeau info */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && actionsAffichees.length > 0 ? (
            <p className="text-[13px] text-ink-500 flex items-center gap-2">
              <History size={14} className="text-ink-400" />
              <span>
                <span className="font-medium text-ink-700">
                  {actionsAffichees.length}
                </span>{' '}
                action{actionsAffichees.length > 1 ? 's' : ''}
                {aFiltresActifs
                  ? ` sur ${total} au total`
                  : ' enregistrée' + (total > 1 ? 's' : '')}
              </span>
            </p>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-500 bg-ink-100 px-2 py-1 rounded">
              <Sparkles size={11} />
              Lecture seule
            </span>
            {estDirecteur && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPurgeOpen(true)}
                leftIcon={<Trash2 size={12} />}
                className="text-danger hover:bg-danger-bg"
              >
                Purger
              </Button>
            )}
          </div>
        </div>

        {/* Card + toolbar + table */}
        <Card noPadding>
          {/* Toolbar horizontale sur 1 ligne */}
          <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2 overflow-x-auto sticky top-0 z-[2] bg-white">            {/* Recherche à gauche */}
            <div className="shrink-0 w-56">
              <SearchInput
                value={recherche}
                onChange={setRecherche}
                placeholder="Rechercher..."
              />
            </div>

            {/* Filtres alignés à droite */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <Select
                value={cibleFiltre}
                onChange={(e) => setCibleFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {CIBLES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>

              <Select
                value={categorieFiltre}
                onChange={(e) => setCategorieFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {CATEGORIES_ACTION.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>

              <Select
                value={periodeFiltre}
                onChange={(e) => setPeriodeFiltre(e.target.value)}
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {PERIODES.map((p) => (
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
                Erreur lors du chargement de l'historique.
              </p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={actionsTriees}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucune action ne correspond à vos filtres.'
                  : 'Aucune action enregistrée.'
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(a) => a.id}
                            renderCard={(action: HistoriqueAction) => (
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border whitespace-nowrap ${styleAction(action.action)}`}
                    >
                      {action.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-ink-400 tabular-nums">
                      {new Date(action.date_action).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {action.details && (
                    <p className="text-[12px] text-ink-700 leading-snug mb-2">
                      {action.details}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar
                        name={nomAuteur(action)}
                        size="xs"
                      />
                      <span className="text-ink-500 truncate">
                        {nomAuteur(action)}
                      </span>
                    </div>
                    <CibleCell action={action} />
                  </div>
                </div>
              )}
              sortState={sortState}
              onSort={handleSort}
              renderRow={(action: HistoriqueAction) => (
                <>
                  <td className="px-4 py-2 text-[11px] text-ink-500 whitespace-nowrap tabular-nums">
                    {new Date(action.date_action).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>

                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border whitespace-nowrap ${styleAction(action.action)}`}
                    >
                      {action.action.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="px-4 py-2">
                    <CibleCell action={action} />
                  </td>

                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={nomAuteur(action)}
                        size="sm"
                      />
                      <span className="text-[12px] text-ink-700 truncate">
                        {nomAuteur(action)}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-2 text-[11px] text-ink-600 max-w-md">
                    <span className="line-clamp-2">
                      {action.details || (
                        <span className="text-ink-400">—</span>
                      )}
                    </span>
                  </td>

                  {/* Menu actions */}
                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {estDirecteur && (
                      <DropdownMenu
                        items={
                          [
                            {
                              label: 'Supprimer',
                              icon: <Trash2 size={14} />,
                              onClick: () => setActionASupprimer(action),
                              variant: 'danger',
                            },
                          ] as DropdownMenuItem[]
                        }
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

      {/* Modale de purge globale */}
      <PurgeHistoriqueModal
        isOpen={isPurgeOpen}
        onClose={() => setIsPurgeOpen(false)}
      />

      {/* Confirmation de suppression d'une entrée */}
      <ConfirmDialog
        isOpen={actionASupprimer !== null}
        title="Supprimer cette entrée d'historique"
        message={
          actionASupprimer
            ? `L'action « ${actionASupprimer.action.replace(/_/g, ' ')} » du ${new Date(actionASupprimer.date_action).toLocaleString('fr-FR')} sera définitivement supprimée.`
            : ''
        }
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (actionASupprimer) deleteMutation.mutate(actionASupprimer.id)
        }}
        onCancel={() => setActionASupprimer(null)}
      />
    </Layout>
  )
}