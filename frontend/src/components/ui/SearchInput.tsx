/**
 * Champ de recherche avec icône et bouton "effacer".
 */

import { InputHTMLAttributes, forwardRef } from 'react'
import { Search, X } from 'lucide-react'

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onChange: (value: string) => void
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = 'Rechercher...', className = '', ...rest }, ref) => {
    return (
      <div className={`relative w-full max-w-xs ${className}`}>
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
          size={14}
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          {...rest}
          className="
            w-full h-8 pl-8 pr-8 text-sm bg-white border border-ink-200 rounded-md
            placeholder:text-ink-400 text-ink-900
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400
            transition-colors
          "
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
            aria-label="Effacer la recherche"
          >
            <X size={14} />
          </button>
        )}
      </div>
    )
  },
)

SearchInput.displayName = 'SearchInput'

export default SearchInput