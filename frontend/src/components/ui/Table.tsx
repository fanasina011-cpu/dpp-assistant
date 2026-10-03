/**
 * Tableau standardisé v5 — header collant + vue cards sur mobile.
 *
 * Sur desktop (≥ 768px) : tableau classique.
 * Sur mobile (< 768px) et si `renderCard` est fourni : liste de cards.
 */

import { ReactNode, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useIsMobile } from '../../hooks/useMediaQuery'

export interface Column {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  width?: string
  sortable?: boolean
}

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

interface TableProps<T> {
  columns: Column[]
  rows: T[]
  renderRow: (row: T, index: number, isHovered: boolean) => ReactNode
  /** Optionnel — utilisé sur mobile à la place du tableau */
  renderCard?: (row: T, index: number) => ReactNode
  isLoading?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode
  rowKey: (row: T, index: number) => string | number
  sortState?: SortState | null
  onSort?: (key: string) => void
  maxHeight?: string
}

export default function Table<T>({
  columns,
  rows,
  renderRow,
  renderCard,
  isLoading = false,
  emptyMessage = 'Aucune donnée à afficher.',
  emptyIcon,
  rowKey,
  sortState,
  onSort,
  maxHeight = '70vh',
}: TableProps<T>) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const isMobile = useIsMobile()

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center'
    if (align === 'right') return 'text-right'
    return 'text-left'
  }

  const renderSortIcon = (col: Column) => {
    if (!col.sortable) return null
    const isActive = sortState?.key === col.key
    if (!isActive) {
      return (
        <ArrowUpDown
          size={12}
          className="text-ink-300 group-hover:text-ink-500 transition-colors"
        />
      )
    }
    return sortState?.direction === 'asc' ? (
      <ArrowUp size={12} className="text-brand-500" />
    ) : (
      <ArrowDown size={12} className="text-brand-500" />
    )
  }

  // ============================================================
  // MODE MOBILE — Cards
  // ============================================================
  if (isMobile && renderCard) {
    return (
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {isLoading ? (
          <div className="divide-y divide-ink-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2 animate-pulse">
                <div className="h-3.5 w-2/3 bg-ink-100 rounded" />
                <div className="h-3 w-1/3 bg-ink-100 rounded" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="flex flex-col items-center gap-2 text-ink-400">
              {emptyIcon && <div className="text-ink-300 mb-1">{emptyIcon}</div>}
              <p className="text-sm">{emptyMessage}</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((row, index) => (
              <li key={rowKey(row, index)}>
                {renderCard(row, index)}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // ============================================================
  // MODE DESKTOP — Tableau
  // ============================================================
  return (
    <div className="overflow-hidden">
      <div className="overflow-y-auto" style={{ maxHeight }}>
        <table className="w-full">
          <thead className="bg-ink-50/60 border-b border-ink-200 sticky top-0 z-[1] backdrop-blur-sm">
            <tr>
              {columns.map((col) => {
                const clickable = col.sortable && onSort
                return (
                  <th
                    key={col.key}
                    className={`
                      px-4 py-2 text-[11px] font-semibold text-ink-500
                      uppercase tracking-wider ${alignClass(col.align)}
                    `}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={`
                          group inline-flex items-center gap-1.5 select-none
                          transition-colors hover:text-ink-800
                          ${col.align === 'right' ? 'flex-row-reverse' : ''}
                        `}
                      >
                        <span>{col.label}</span>
                        {renderSortIcon(col)}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2">
                      <div
                        className="h-3.5 bg-ink-100 rounded animate-pulse"
                        style={{ width: `${60 + Math.random() * 40}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-ink-400">
                    {emptyIcon && (
                      <div className="text-ink-300 mb-1">{emptyIcon}</div>
                    )}
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isHovered = hoveredIndex === index
                return (
                  <tr
                    key={rowKey(row, index)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`
                      align-middle transition-colors
                      ${index % 2 === 1 ? 'bg-ink-50/30' : 'bg-white'}
                      hover:bg-brand-50/40
                    `}
                  >
                    {renderRow(row, index, isHovered)}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}