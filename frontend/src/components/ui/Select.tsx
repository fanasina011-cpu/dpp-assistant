/**
 * Liste déroulante standardisée.
 */

import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: ReactNode
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, children, className = '', id, ...rest }, ref) => {
    const selectId = id || rest.name

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          {...rest}
          className={`
            w-full px-3 py-2 border rounded-md text-sm bg-white
            focus:outline-none focus:ring-2 transition-colors
            ${
              error
                ? 'border-red-300 focus:ring-red-500 focus:border-red-400'
                : 'border-slate-300 focus:ring-blue-500 focus:border-blue-400'
            }
            disabled:bg-slate-50 disabled:text-slate-500
            ${className}
          `}
        >
          {children}
        </select>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'

export default Select