/**
 * Section "Tâches rattachées" d'une activité.
 * Liste + bouton d'ajout + détachement (conditionnels aux permissions).
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckSquare,
  Plus,
  Unlink,
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import StatutBadge from '../StatutBadge'
import PrioriteBadge from '../PrioriteBadge'
import ConfirmDialog from '../communs/ConfirmDialog'
import TacheFormModal from '../taches/TacheFormModal'
import { fetchTaches, updateTache } from '../../api/taches'
import { useToast } from '../../context/ToastContext'
import { usePermissions } from '../../hooks/usePermissions'
import type { Activite, Tache } from '../../types'

interface ActiviteTachesSectionProps {
  activite: Activite
}

/** Carte compacte d'une tâche dans la liste */
function TacheRow({
  tache,
  onDetach,
  isDetachPending,
  canDetach,
}: {
  tache: Tache
  onDetach: () => void
  isDetachPending: boolean
  canDetach: boolean
}) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 border border-ink-200 rounded-md hover:bg-ink-50/60 hover:border-ink-300 transition-colors">
      {/* Statut à gauche */}
      <StatutBadge statut={tache.statut} statutDisplay={tache.statut_display} />

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <Link
          to={`/taches/${tache.id}`}
          className="block group-hover:text-brand-600 transition-colors"
        >
          <div className="text-[13px] font-medium text-ink-900 truncate">
            {tache.titre}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-500 flex-wrap">
            {tache.responsable_detail ? (
              <span className="inline-flex items-center gap-1">
                <Avatar
                  name={tache.responsable_detail.nom_complet}
                  size="xs"
                />
                {tache.responsable_detail.nom_complet}
              </span>
            ) : (
              <span className="italic text-ink-400">Non assigné</span>
            )}
            {tache.date_echeance && (
              <>
                <span className="text-ink-300">·</span>
                <span
                  className={`tabular-nums ${
                    tache.est_en_retard ? 'text-danger font-semibold' : ''
                  }`}
                >
                  {new Date(tache.date_echeance).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </>
            )}
            {tache.est_en_retard && (
              <span className="text-[10px] font-semibold text-danger inline-flex items-center gap-0.5">
                <AlertCircle size={10} />
                En retard
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Priorité + Détacher (si autorisé) */}
      <PrioriteBadge
        priorite={tache.priorite}
        prioriteDisplay={tache.priorite_display}
      />

      {canDetach && (
        <button
          type="button"
          onClick={onDetach}
          disabled={isDetachPending}
          className="w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-danger hover:bg-danger-bg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0"
          aria-label="Retirer de l'activité"
          title="Retirer de l'activité"
        >
          <Unlink size={13} />
        </button>
      )}
    </div>
  )
}

export default function ActiviteTachesSection({
  activite,
}: ActiviteTachesSectionProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { can } = usePermissions()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [tacheADetacher, setTacheADetacher] = useState<Tache | null>(null)

  // Permissions contextuelles
  const peutModifier = can.editActivite(activite)

  const {
    data: taches = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['taches', 'activite', activite.id],
    queryFn: () => fetchTaches({ activite: activite.id }),
  })

  const detachMutation = useMutation({
    mutationFn: (tacheId: number) =>
      updateTache(tacheId, { activite: null } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      queryClient.invalidateQueries({
        queryKey: ['taches', 'activite', activite.id],
      })
      queryClient.invalidateQueries({ queryKey: ['activite', activite.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast("Tâche détachée de l'activité", 'success')
      setTacheADetacher(null)
    },
    onError: () => {
      showToast('Impossible de détacher la tâche', 'error')
      setTacheADetacher(null)
    },
  })

  return (
    <>
      <Card>
        {/* En-tête */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} className="text-ink-400" />
            <h3 className="text-[14px] font-semibold text-ink-900">Tâches</h3>
            {!isLoading && taches.length > 0 && (
              <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
                {taches.length}
              </span>
            )}
          </div>

          {/* Bouton Ajouter (uniquement si peut modifier) */}
          {peutModifier && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsFormOpen(true)}
              leftIcon={<Plus size={12} />}
            >
              Ajouter une tâche
            </Button>
          )}
        </div>

        {/* Contenu */}
        {error ? (
          <div className="py-8 flex flex-col items-center gap-2 text-danger">
            <AlertCircle size={20} />
            <p className="text-[12px]">Erreur lors du chargement.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="border border-ink-100 rounded-md p-3 flex items-center gap-3 animate-pulse"
              >
                <div className="w-16 h-5 bg-ink-100 rounded" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/2 bg-ink-100 rounded" />
                  <div className="h-2.5 w-1/3 bg-ink-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : taches.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-ink-400">
            <CheckSquare size={32} strokeWidth={1.25} />
            <p className="text-[12px]">
              Aucune tâche rattachée à cette activité.
            </p>
            {/* Lien "Créer la première tâche" uniquement si peut modifier */}
            {peutModifier && (
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="text-[11px] text-brand-600 hover:underline mt-1 font-medium"
              >
                Créer la première tâche →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {taches.map((t) => (
              <TacheRow
                key={t.id}
                tache={t}
                onDetach={() => setTacheADetacher(t)}
                isDetachPending={detachMutation.isPending}
                canDetach={peutModifier}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Modale de création (uniquement si autorisé) */}
      {peutModifier && (
        <TacheFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          activiteId={activite.id}
        />
      )}

      {/* Confirmation de détachement */}
      <ConfirmDialog
        isOpen={tacheADetacher !== null}
        title="Retirer cette tâche de l'activité"
        message={
          tacheADetacher
            ? `« ${tacheADetacher.titre} » ne sera plus rattachée à cette activité. La tâche elle-même n'est pas supprimée.`
            : ''
        }
        confirmLabel="Retirer"
        variant="warning"
        isPending={detachMutation.isPending}
        onConfirm={() => {
          if (tacheADetacher) detachMutation.mutate(tacheADetacher.id)
        }}
        onCancel={() => setTacheADetacher(null)}
      />
    </>
  )
}