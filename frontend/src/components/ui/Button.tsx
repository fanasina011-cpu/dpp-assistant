/**
 * Bouton standardisé du design system v2.
 *
 * Variantes :
 *   - primary   : action principale (indigo profond)
 *   - secondary : action secondaire (blanc avec bordure)
 *   - danger    : action destructive (rouge)
 *   - ghost     : action discrète (transparent)
 *   - success   : action positive (vert) — utile pour "Clôturer"
 *
 * Tailles : sm, md, lg
 */

import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children?: ReactNode
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 hover:bg-brand-600 text-white shadow-sm ' +
    'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
  secondary:
    'bg-white hover:bg-ink-50 text-ink-700 border border-ink-200 ' +
    'shadow-sm focus-visible:ring-2 focus-visible:ring-ink-300 focus-visible:ring-offset-1',
  danger:
    'bg-danger hover:bg-red-700 text-white shadow-sm ' +
    'focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-1',
  success:
    'bg-success hover:bg-green-700 text-white shadow-sm ' +
    'focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-1',
  warning:
    'bg-warning hover:bg-amber-700 text-white shadow-sm ' +
    'focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-1',
  ghost:
    'bg-transparent hover:bg-ink-100 text-ink-600 ' +
    'focus-visible:ring-2 focus-visible:ring-ink-300',
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  lg: 'h-9 px-3.5 text-sm gap-2 rounded-md',
}

export default function Button({
  variant = 'primary',
  size = 'lg',
  children,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        active:scale-[0.98]
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
    >
      {leftIcon && <span className="shrink-0 -ml-0.5">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="shrink-0 -mr-0.5">{rightIcon}</span>}
    </button>
  )
}