/**
 * Menu contextuel avec Portal React.
 * S'affiche au-dessus de tout (pas de clipping par overflow-hidden).
 */

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

export interface DropdownMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  separator?: boolean
}

interface DropdownMenuProps {
  items: DropdownMenuItem[]
  align?: 'left' | 'right'
}

export default function DropdownMenu({
  items,
  align = 'right',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Recalcule la position dès que le menu s'ouvre
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const MENU_WIDTH = 224 // w-56
    const MENU_HEIGHT_ESTIMATE = 40 + items.length * 32

    let left = align === 'right' ? rect.right - MENU_WIDTH : rect.left
    let top = rect.bottom + 4

    // Empêcher de sortir à droite
    if (left + MENU_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - MENU_WIDTH - 8
    }
    // Empêcher de sortir à gauche
    if (left < 8) left = 8

    // Si pas assez de place en bas, ouvrir vers le haut
    if (top + MENU_HEIGHT_ESTIMATE > window.innerHeight - 8) {
      top = rect.top - MENU_HEIGHT_ESTIMATE - 4
    }

    setPosition({ top, left })
  }, [isOpen, align, items.length])

  // Fermeture au clic extérieur / Échap / scroll / resize
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return
      }
      setIsOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    function handleClose() {
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleClose, true)
    window.addEventListener('resize', handleClose)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleClose, true)
      window.removeEventListener('resize', handleClose)
    }
  }, [isOpen])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((o) => !o)
        }}
        className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
          isOpen
            ? 'bg-ink-100 text-ink-700'
            : 'text-ink-400 hover:text-ink-700 hover:bg-ink-100'
        }`}
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: 224,
            }}
            className="z-[100] bg-white border border-ink-200 rounded-lg shadow-lg py-1 overflow-hidden animate-in fade-in"
            role="menu"
          >
            {items.map((item, idx) => (
              <div key={idx}>
                {item.separator && idx > 0 && (
                  <div className="h-px bg-ink-100 my-1" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (item.disabled) return
                    setIsOpen(false)
                    item.onClick()
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    item.variant === 'danger'
                      ? 'text-danger hover:bg-danger-bg'
                      : 'text-ink-700 hover:bg-ink-50'
                  }`}
                >
                  {item.icon && (
                    <span
                      className={`shrink-0 ${
                        item.variant === 'danger'
                          ? 'text-danger'
                          : 'text-ink-400'
                      }`}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}