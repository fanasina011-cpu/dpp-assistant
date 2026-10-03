/**
 * Badge de priorité v2 — avec point indicateur coloré.
 */

interface PrioriteBadgeProps {
  priorite: string
  prioriteDisplay: string
}

const STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  BASSE: {
    dot: 'bg-ink-400',
    text: 'text-ink-600',
    bg: 'bg-ink-50 border-ink-200',
  },
  NORMALE: {
    dot: 'bg-ink-500',
    text: 'text-ink-700',
    bg: 'bg-ink-100 border-ink-200',
  },
  HAUTE: {
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
  },
  URGENTE: {
    dot: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
}

export default function PrioriteBadge({
  priorite,
  prioriteDisplay,
}: PrioriteBadgeProps) {
  const style = STYLES[priorite] || STYLES.NORMALE
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {prioriteDisplay}
    </span>
  )
}