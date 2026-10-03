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
                ? 'border-red-300 focus:ring-red-500 focus:border-red-400'
                : 'border-slate-300 focus:ring-blue-500 focus:border-blue-400'
            }
            disabled:bg-slate-50 disabled:text-slate-500
            ${className}
          `}
        />
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'

export default Input