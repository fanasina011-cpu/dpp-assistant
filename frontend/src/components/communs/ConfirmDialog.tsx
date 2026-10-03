/**
 * Modale de confirmation réutilisable.
 *
 * Remplace les window.confirm() natifs du navigateur par une modale
 * cohérente avec le design de l'application.
 *
 * Usage :
 *   <ConfirmDialog
 *     isOpen={isOpen}
 *     title="Supprimer la tâche"
 *     message="Cette action est irréversible."
 *     confirmLabel="Supprimer"
 *     variant="danger"
 *     onConfirm={() => { ... }}
 *     onCancel={() => setIsOpen(false)}
 *   />
 */

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-orange-600 hover:bg-orange-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  }

  const iconVariants = {
    danger: { bg: 'bg-red-100', text: 'text-red-600', icon: '⚠' },
    warning: { bg: 'bg-orange-100', text: 'text-orange-600', icon: '!' },
    info: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'i' },
  }

  const v = iconVariants[variant]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-4 mb-4">
          <div
            className={`w-10 h-10 rounded-full ${v.bg} ${v.text}
                        flex items-center justify-center text-xl font-bold shrink-0`}
          >
            {v.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
            <p className="text-sm text-slate-600">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100
                       rounded-md transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`px-4 py-2 text-white rounded-md transition-colors
                       ${variantStyles[variant]}
                       disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isPending ? 'Traitement...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}