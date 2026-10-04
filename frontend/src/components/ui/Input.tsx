/**
 * Champ de saisie standardisé (texte, email, date, datetime-local, etc.).
 */

import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...rest }, ref) => {
    const inputId = id || rest.name

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          {...rest}
            className={`
            w-full px-3 py-2 border rounded-md text-sm
            focus:outline-none focus:ring-2 transition-colors
            ${
              error
                ? 'border-danger-border focus:ring-danger focus:border-danger'
                : 'border-ink-300 focus:ring-brand-500 focus:border-brand-400'
            }
            disabled:bg-ink-50 disabled:text-ink-500
            ${className}
          `}
        />
        {error && (
          <p className="text-xs text-danger mt-1">{error}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'

export default Input