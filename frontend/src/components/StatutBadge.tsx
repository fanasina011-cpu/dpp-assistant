/**
 * Badge de statut v2 — plus sobre, avec bordure subtile.
 */

interface StatutBadgeProps {
  statut: string
  statutDisplay: string
}

const COLORS: Record<string, string> = {
  A_FAIRE: 'bg-ink-100 text-ink-700 border-ink-200',
  EN_COURS: 'bg-info-bg text-info border-info-border',
  EN_ATTENTE: 'bg-warning-bg text-warning border-warning-border',
  BLOQUEE: 'bg-danger-bg text-danger border-danger-border',
  A_VALIDER: 'bg-warning-bg text-warning border-warning-border',
  TERMINEE: 'bg-success-bg text-success border-success-border',
  ANNULEE: 'bg-ink-100 text-ink-400 border-ink-200 line-through',
  OUVERTE: 'bg-info-bg text-info border-info-border',
  CLOTUREE: 'bg-success-bg text-success border-success-border',
  RESOLU: 'bg-success-bg text-success border-success-border',
  REMONTE_AU_DIRECTEUR: 'bg-purple-50 text-purple-700 border-purple-200',
  EN_TRAITEMENT: 'bg-info-bg text-info border-info-border',
}

export default function StatutBadge({ statut, statutDisplay }: StatutBadgeProps) {
  const colorClass = COLORS[statut] || 'bg-ink-100 text-ink-700 border-ink-200'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${colorClass}`}
    >
      {statutDisplay}
    </span>
  )
}