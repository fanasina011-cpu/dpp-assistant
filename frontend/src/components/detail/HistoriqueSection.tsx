/**
 * Section "Historique" réutilisable pour les pages détail.
 * Affiche la timeline des actions liées à une entité.
 *
 * Usage :
 *   <HistoriqueSection tacheId={5} />
 *   <HistoriqueSection activiteId={12} />
 *   <HistoriqueSection blocageId={8} />
 *   <HistoriqueSection instructionId={3} />
 */

import { useQuery } from '@tanstack/react-query'
import { AlertCircle, History } from 'lucide-react'
import Avatar from '../ui/Avatar'
import {
  fetchHistorique,
} from '../../api/historique'
import type { HistoriqueAction } from '../../types'
import { nomAuteur } from '../../utils/historique'

interface HistoriqueSectionProps {
  tacheId?: number
  instructionId?: number
  blocageId?: number
  activiteId?: number
}

/** Couleur du badge selon le type d'action */
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
    ECHEANCE_REPORTEE: 'bg-warning-bg text-warning border-warning-border',
    ANNULATION_MOTIVEE: 'bg-danger-bg text-danger border-danger-border',
    SUPPRESSION: 'bg-danger-bg text-danger border-danger-border',
    TACHE_SUPPRIMEE: 'bg-danger-bg text-danger border-danger-border',
    ACTIVITE_SUPPRIMEE: 'bg-danger-bg text-danger border-danger-border',
    INSTRUCTION_SUPPRIMEE: 'bg-danger-bg text-danger border-danger-border',
    BLOCAGE_SUPPRIME: 'bg-danger-bg text-danger border-danger-border',
    BLOCAGE_REMONTE: 'bg-purple-50 text-purple-700 border-purple-200',
    PRIORITE_ELEVEE: 'bg-warning-bg text-warning border-warning-border',
  }
  return map[action] || 'bg-ink-100 text-ink-600 border-ink-200'
}

/** Date relative */
function formatRelatif(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffJ = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  if (diffJ === 1) return 'hier'
  if (diffJ < 7) return `il y a ${diffJ} j`
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function renderRow(action: HistoriqueAction) {
  return (
    <li
      key={action.id}
      className="relative pl-7 pb-4 last:pb-0 border-l border-ink-200 last:border-l-0 ml-2"
    >
      {/* Point */}
      <span className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-brand-400" />

      {/* Contenu */}
      <div className="flex items-start gap-2 flex-wrap mb-0.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${styleAction(action.action)}`}
        >
          {action.action.replace(/_/g, ' ')}
        </span>
        <span className="text-[10px] text-ink-400">
          {formatRelatif(action.date_action)}
        </span>
      </div>

      {action.details && (
        <p className="text-[12px] text-ink-700 leading-snug mt-1">
          {action.details}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-1.5">
        <Avatar name={nomAuteur(action)} size="xs" />
        <span className="text-[11px] text-ink-500">
          {nomAuteur(action)}
        </span>
      </div>
    </li>
  )
}

export default function HistoriqueSection({
  tacheId,
  instructionId,
  blocageId,
  activiteId,
}: HistoriqueSectionProps) {
  const {
    data: actions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      'historique',
      tacheId ?? null,
      instructionId ?? null,
      blocageId ?? null,
      activiteId ?? null,
    ],
    queryFn: () =>
      fetchHistorique({
        tache: tacheId,
        instruction: instructionId,
        blocage: blocageId,
        activite: activiteId,
      }),
  })

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center gap-2 mb-4">
        <History size={14} className="text-ink-400" />
        <h3 className="text-[14px] font-semibold text-ink-900">Historique</h3>
        {!isLoading && actions.length > 0 && (
          <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
            {actions.length}
          </span>
        )}
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-2.5 h-2.5 rounded-full bg-ink-100 shrink-0 mt-1" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-ink-100 rounded" />
                <div className="h-2.5 w-2/3 bg-ink-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-6 flex flex-col items-center gap-2 text-danger">
          <AlertCircle size={18} />
          <p className="text-[12px]">Erreur lors du chargement.</p>
        </div>
      ) : actions.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-ink-400">
          <History size={28} strokeWidth={1.25} />
          <p className="text-[12px]">Aucune action enregistrée.</p>
        </div>
      ) : (
        <ul className="space-y-0">
          {actions.map((a) => renderRow(a))}
        </ul>
      )}
    </div>
  )
}