/**
 * Badge de niveau d'urgence — avec point indicateur coloré,
 * cohérent avec PrioriteBadge.
 */

interface UrgenceBadgeProps {
  niveau: string
  niveauDisplay: string
}

const STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  BASSE: {
    dot: 'bg-ink-400',
    text: 'text-ink-600',
    bg: 'bg-ink-50 border-ink-200',
  },
  MOYENNE: {
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  HAUTE: {
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
  },
  CRITIQUE: {
    dot: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
}

export default function UrgenceBadge({
  niveau,
  niveauDisplay,
}: UrgenceBadgeProps) {
  const style = STYLES[niveau] || STYLES.MOYENNE
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {niveauDisplay}
    </span>
  )
}