/**
 * Barre de pagination des listes.
 *
 * Attend le total renvoyé par l'API (`count` de la réponse paginée DRF)
 * et affiche « début–fin sur total » avec la navigation.
 *
 * Ne s'affiche pas si la liste tient sur une seule page.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  count: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

function numerosDePage(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1])

  if (page <= 3) {
    ;[2, 3, 4].forEach((p) => pages.add(p))
  }
  if (page >= totalPages - 2) {
    ;[totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p))
  }

  const triees = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)

  const avecEllipses: (number | '…')[] = []
  triees.forEach((p, index) => {
    if (index > 0 && p - triees[index - 1] > 1) avecEllipses.push('…')
    avecEllipses.push(p)
  })

  return avecEllipses
}

export default function Pagination({
  count,
  page,
  pageSize,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (count <= 0) return null

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const pageCourante = Math.min(Math.max(1, page), totalPages)
  const debut = (pageCourante - 1) * pageSize + 1
  const fin = Math.min(pageCourante * pageSize, count)

  return (
    <div
      className={`flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-t border-ink-100 ${className}`}
    >
      <p className="text-[12px] text-ink-500 tabular-nums">
        {debut}–{fin} sur {count}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(pageCourante - 1)}
            disabled={pageCourante <= 1}
            aria-label="Page précédente"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft size={15} />
          </button>

          {numerosDePage(pageCourante, totalPages).map((item, index) =>
            item === '…' ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-[12px] text-ink-400"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === pageCourante ? 'page' : undefined}
                className={`h-7 min-w-7 px-1.5 rounded-md text-[12px] font-medium tabular-nums transition-colors ${
                  item === pageCourante
                    ? 'bg-brand-500 text-white'
                    : 'text-ink-600 hover:bg-ink-100'
                }`}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(pageCourante + 1)}
            disabled={pageCourante >= totalPages}
            aria-label="Page suivante"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}