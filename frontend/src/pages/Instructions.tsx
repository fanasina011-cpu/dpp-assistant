/**
 * Page Instructions v6 — même pattern que Taches.
 * Particularité : colonne "Destinataires" avec avatars empilés.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
// import { AlertCircle, FileText, FolderKanban, Inbox, Plus } from 'lucide-react'
import Layout from '../components/Layout'
import StatutBadge from '../components/StatutBadge'
import PrioriteBadge from '../components/PrioriteBadge'
import InstructionFormModal from '../components/instructions/InstructionFormModal'
import InstructionActionsMenu from '../components/instructions/InstructionActionsMenu'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import Select from '../components/ui/Select'
import Table, { Column, SortState } from '../components/ui/Table'
import { fetchInstructionsPage } from '../api/instructions'
import { fetchStats } from '../api/stats'
import type { Instruction, StatsInstructions } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'
import { usePermissions } from '../hooks/usePermissions'
import {
  AlertCircle,
  FileText,
  FolderKanban,
  Inbox,
  Plus,
  Users,
} from 'lucide-react'

const STATUTS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'A_FAIRE', label: 'À faire' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'TERMINEE', label: 'Terminée' },
  { value: 'ANNULEE', label: 'Annulée' },
]

const CIBLES = [
  { value: '', label: 'Toutes les cibles' },
  { value: 'TACHE', label: 'Tâches' },
  { value: 'ACTIVITE', label: 'Activités' },
  { value: 'AUCUNE', label: 'Aucune cible' },
]

const COLUMNS: Column[] = [
  { key: 'titre', label: 'Titre', width: '28%', sortable: true },
  { key: 'cible', label: 'Cible', width: '110px', sortable: true },
  { key: 'statut', label: 'Statut', width: '120px', sortable: true },
  { key: 'priorite', label: 'Priorité', width: '120px', sortable: true },
  { key: 'destinataires', label: 'Destinataires', width: '150px' },
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

/** Ordres métier arbitraires : jamais exposés à `ordering_fields`. */
const ORDRE_STATUT: Record<string, number> = {
  A_FAIRE: 0,
  EN_COURS: 1,
  TERMINEE: 2,
  ANNULEE: 3,
}

const ORDRE_PRIORITE: Record<string, number> = {
  URGENTE: 0,
  HAUTE: 1,
  NORMALE: 2,
  BASSE: 3,
}

const ORDRE_CIBLE: Record<string, number> = {
  TACHE: 0,
  ACTIVITE: 1,
  AUCUNE: 2,
}

/** Comparateurs client, réservés aux colonnes non triables côté serveur. */
const COMPARATEURS_CLIENT: Record<
  string,
  (a: Instruction, b: Instruction) => number
> = {
  statut: (a, b) =>
    (ORDRE_STATUT[a.statut] ?? 99) - (ORDRE_STATUT[b.statut] ?? 99),
  priorite: (a, b) =>
    (ORDRE_PRIORITE[a.priorite] ?? 99) - (ORDRE_PRIORITE[b.priorite] ?? 99),
  cible: (a, b) =>
    (ORDRE_CIBLE[a.cible_type] ?? 99) - (ORDRE_CIBLE[b.cible_type] ?? 99),
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

/** Cellule "Destinataires" : avatars empilés + compteur. */
function DestinatairesCell({ instruction }: { instruction: Instruction }) {
  const liste = instruction.destinataires
  if (liste.length === 0) {
    return <span className="text-[12px] text-ink-400">—</span>
  }

  const visibles = liste.slice(0, 3)
  const reste = liste.length - visibles.length

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {visibles.map((d) => (
          <Avatar
            key={d.id}
            name={d.destinataire_detail.nom_complet}
            size="sm"
            className="ring-2 ring-white"
          />
        ))}
      </div>
      <span className="text-[12px] text-ink-600">
        {liste.length}
        {reste > 0 && ` (+${reste})`}
      </span>
    </div>
  )
}

/** Cellule "Cible" : icône + type lisible. */
function CibleCell({ type }: { type: Instruction['cible_type'] }) {
  if (type === 'TACHE') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
        <FileText size={13} className="text-ink-400" />
        Tâche
      </span>
    )
  }
  if (type === 'ACTIVITE') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
        <FolderKanban size={13} className="text-ink-400" />
        Activité
      </span>
    )
  }
  return <span className="text-[12px] text-ink-400">—</span>
}

export default function Instructions() {
  const { can } = usePermissions()
  const [statutFiltre, setStatutFiltre] = useState('')
  const [cibleFiltre, setCibleFiltre] = useState<
    '' | 'TACHE' | 'ACTIVITE' | 'AUCUNE'
  >('')
  const [recherche, setRecherche] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // La frappe reste instantanée côté UI ; seule la requête est différée.
  const rechercheDifferee = useDebounce(recherche, 350)

  const { page, setPage, pageSize } = usePagination({
    resetDeps: [
      statutFiltre,
      cibleFiltre,
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
  const filtres = useMemo(
    () => ({
      statut: statutFiltre || undefined,
      cibleType: cibleFiltre || undefined,
      search: rechercheDifferee.trim() || undefined,
    }),
    [statutFiltre, cibleFiltre, rechercheDifferee],
  )

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['instructions', page, pageSize, filtres, ordering],
    queryFn: () =>
      fetchInstructionsPage({
        ...filtres,
        ordering,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  })

  const instructions = data?.results ?? []
  const total = data?.count ?? 0

  // ---- Tri ----
  // Seules les colonnes sans équivalent serveur (`cible`, `statut`,
  // `priorite`) sont réordonnées localement.
  const instructionsTriees = useMemo(() => {
    if (!sortState) return instructions
    const comparer = COMPARATEURS_CLIENT[sortState.key]
    if (!comparer) return instructions
    const sorted = [...instructions].sort(comparer)
    return sortState.direction === 'desc' ? sorted.reverse() : sorted
  }, [instructions, sortState])

  // ---- Stats ----
  // KPI serveur sur l'INTÉGRALITÉ du périmètre. `FetchStatsParams` n'expose
  // pas `cibleType` : le filtre Cible n'est donc pas transmis aux KPI.
  const { data: stats } = useQuery({
    queryKey: ['instructions', 'stats', filtres],
    queryFn: () =>
      fetchStats<StatsInstructions>('instructions', {
        statut: filtres.statut,
        cibleType: filtres.cibleType,
        search: filtres.search,
      }),
    placeholderData: (previous) => previous,
  })

  const enCours = stats?.en_cours ?? 0
  const aFaire = stats?.a_faire ?? 0

  const aFiltresActifs = Boolean(statutFiltre || cibleFiltre || recherche)

  const resetFiltres = () => {
    setStatutFiltre('')
    setCibleFiltre('')
    setRecherche('')
  }

  return (
    <Layout title="Instructions">
      <div className="space-y-4">
        {/* Stats + bouton créer */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isLoading && total > 0 ? (
            <p className="text-[13px] text-ink-500">
              <span className="font-medium text-ink-700">{total}</span>{' '}
              instruction{total > 1 ? 's' : ''}
              {aFaire > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-warning">{aFaire}</span>{' '}
                  à faire
                </>
              )}
              {enCours > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-info">{enCours}</span>{' '}
                  en cours
                </>
              )}
            </p>
          ) : (
            <div />
          )}

          {can.createInstruction && (
            <Button
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus size={14} />}
            >
              Nouvelle instruction
            </Button>
          )}
        </div>

        {/* Card + toolbar + table */}
        <Card noPadding>
          <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2 flex-wrap">
            <SearchInput
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher une instruction..."
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
                value={cibleFiltre}
                onChange={(e) =>
                  setCibleFiltre(e.target.value as typeof cibleFiltre)
                }
                className="!w-auto !h-8 !py-0 !text-[13px]"
              >
                {CIBLES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
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
                Erreur lors du chargement des instructions.
              </p>
            </div>
          ) : (
            <Table
              columns={COLUMNS}
              rows={instructionsTriees}
              isLoading={isLoading}
              emptyMessage={
                aFiltresActifs
                  ? 'Aucune instruction ne correspond à vos filtres.'
                  : 'Aucune instruction pour le moment.'
              }
              emptyIcon={<Inbox size={36} strokeWidth={1.25} />}
              rowKey={(i) => i.id}
                            renderCard={(instr: Instruction) => (
                <Link
                  to={`/instructions/${instr.id}`}
                  className="block p-4 hover:bg-ink-50/60 transition-colors"
                >
                  <div className="text-[13px] font-medium text-ink-900 leading-snug mb-2">
                    {instr.titre}
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <StatutBadge
                      statut={instr.statut}
                      statutDisplay={instr.statut_display}
                    />
                    <PrioriteBadge
                      priorite={instr.priorite}
                      prioriteDisplay={instr.priorite_display}
                    />
                    {instr.cible_type === 'TACHE' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">
                        <FileText size={10} />
                        Tâche
                      </span>
                    )}
                    {instr.cible_type === 'ACTIVITE' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">
                        <FolderKanban size={10} />
                        Activité
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Users size={11} className="text-ink-400" />
                      <span className="text-ink-600">
                        {instr.destinataires.length} destinataire
                        {instr.destinataires.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    {instr.date_echeance && (
                      <span className="tabular-nums text-ink-500">
                        {new Date(instr.date_echeance).toLocaleDateString(
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
              renderRow={(instr: Instruction, _index, isHovered) => (
                <>
                  <td className="px-4 py-2">
                    <Link
                      to={`/instructions/${instr.id}`}
                      className="block group"
                    >
                      <span className="font-medium text-ink-900 text-[13px] group-hover:text-brand-600 transition-colors">
                        {instr.titre}
                      </span>
                    </Link>
                  </td>

                  <td className="px-4 py-2">
                    <CibleCell type={instr.cible_type} />
                  </td>

                  <td className="px-4 py-2">
                    <StatutBadge
                      statut={instr.statut}
                      statutDisplay={instr.statut_display}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <PrioriteBadge
                      priorite={instr.priorite}
                      prioriteDisplay={instr.priorite_display}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <DestinatairesCell instruction={instr} />
                  </td>

                  <td className="px-4 py-2">
                    <EcheanceCell date={instr.date_echeance} />
                  </td>

                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <InstructionActionsMenu
                      instruction={instr}
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

      <InstructionFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Layout>
  )
}
