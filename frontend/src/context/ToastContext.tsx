/**
 * Système de toasts — design system v2.
 *
 * Usage :
 *   const { showToast } = useToast()
 *   showToast('Tâche créée avec succès', 'success')
 *   showToast('Erreur lors de la suppression', 'error')
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, message, type }])

      // Auto-suppression après 4 secondes
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error(
      "useToast doit être utilisé à l'intérieur d'un ToastProvider",
    )
  }
  return context
}

// ---------------------------------------------------------------------------
// Composant d'affichage
// ---------------------------------------------------------------------------

interface ToastStyle {
  bg: string
  border: string
  text: string
  iconColor: string
  icon: ReactNode
  accent: string
}

const STYLES: Record<ToastType, ToastStyle> = {
  success: {
    bg: 'bg-white',
    border: 'border-ink-200',
    text: 'text-ink-900',
    iconColor: 'text-success',
    icon: <CheckCircle2 size={18} />,
    accent: 'bg-success',
  },
  error: {
    bg: 'bg-white',
    border: 'border-ink-200',
    text: 'text-ink-900',
    iconColor: 'text-danger',
    icon: <AlertCircle size={18} />,
    accent: 'bg-danger',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-ink-200',
    text: 'text-ink-900',
    iconColor: 'text-warning',
    icon: <AlertTriangle size={18} />,
    accent: 'bg-warning',
  },
  info: {
    bg: 'bg-white',
    border: 'border-ink-200',
    text: 'text-ink-900',
    iconColor: 'text-info',
    icon: <Info size={18} />,
    accent: 'bg-info',
  },
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[]
  onRemove: (id: number) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[380px] pointer-events-none">
      {toasts.map((toast) => {
        const style = STYLES[toast.type]
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto relative flex items-start gap-3 rounded-lg border shadow-lg px-4 py-3 overflow-hidden ${style.bg} ${style.border} animate-in slide-in-from-right-5 fade-in duration-200`}
          >
            {/* Accent bar gauche */}
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${style.accent}`} />

            {/* Icône */}
            <span className={`shrink-0 mt-0.5 ${style.iconColor}`}>
              {style.icon}
            </span>

            {/* Message */}
            <p className={`flex-1 text-[13px] leading-snug ${style.text}`}>
              {toast.message}
            </p>

            {/* Bouton fermer */}
            <button
              type="button"
              onClick={() => onRemove(toast.id)}
              className="shrink-0 -mr-1 -mt-0.5 p-1 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}