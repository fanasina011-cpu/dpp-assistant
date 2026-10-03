/**
 * Section de commentaires — v5.
 * Design system, toasts, avatars, date relative.
 */

import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import ConfirmDialog from '../communs/ConfirmDialog'
import {
  createCommentaire,
  deleteCommentaire,
  fetchCommentaires,
} from '../../api/commentaires'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { Commentaire } from '../../types'

interface CommentairesSectionProps {
  tacheId?: number
  instructionId?: number
  activiteId?: number
}

/** Date relative ("il y a 5 min", "hier"...) */
function formatRelatif(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffJ = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  if (diffJ === 1) return 'hier'
  if (diffJ < 7) return `il y a ${diffJ} j`
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function CommentairesSection({
  tacheId,
  instructionId,
  activiteId,
}: CommentairesSectionProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [contenu, setContenu] = useState('')
  const [commentaireASupprimer, setCommentaireASupprimer] = useState<
    number | null
  >(null)

  const queryKey = [
    'commentaires',
    tacheId ?? null,
    instructionId ?? null,
    activiteId ?? null,
  ]

  const {
    data: commentaires = [],
    isLoading,
  } = useQuery({
    queryKey,
    queryFn: () =>
      fetchCommentaires({
        tache: tacheId,
        instruction: instructionId,
        activite: activiteId,
      }),
  })

  const createMutation = useMutation({
    mutationFn: createCommentaire,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setContenu('')
      showToast('Commentaire ajouté', 'success')
    },
    onError: () => {
      showToast("Impossible d'ajouter le commentaire", 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCommentaire,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setCommentaireASupprimer(null)
      showToast('Commentaire supprimé', 'success')
    },
    onError: () => {
      showToast('Impossible de supprimer le commentaire', 'error')
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (contenu.trim().length < 2) {
      showToast('Le commentaire est trop court', 'warning')
      return
    }

    createMutation.mutate({
      contenu: contenu.trim(),
      tache: tacheId ?? null,
      instruction: instructionId ?? null,
      activite: activiteId ?? null,
    })
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-ink-900 flex items-center gap-2">
          <MessageSquare size={14} className="text-ink-400" />
          Commentaires
          {commentaires.length > 0 && (
            <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
              {commentaires.length}
            </span>
          )}
        </h3>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3 mb-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="border border-ink-100 rounded-md p-3 animate-pulse"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-ink-100" />
                <div className="h-3 w-24 bg-ink-100 rounded" />
              </div>
              <div className="h-3 w-3/4 bg-ink-100 rounded" />
            </div>
          ))}
        </div>
      ) : commentaires.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-ink-400 mb-4">
          <MessageSquare size={28} strokeWidth={1.25} />
          <p className="text-[12px]">Aucun commentaire pour le moment.</p>
        </div>
      ) : (
        <ul className="space-y-2.5 mb-5">
          {commentaires.map((c: Commentaire) => (
            <li
              key={c.id}
              className="border border-ink-200 rounded-md p-3 bg-white hover:bg-ink-50/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Avatar name={c.auteur_detail.nom_complet} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-[12px] text-ink-900">
                      {c.auteur_detail.nom_complet}
                    </span>
                    <span className="text-[10px] text-ink-400">
                      {formatRelatif(c.date_creation)}
                    </span>
                    {c.auteur === user?.id && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-brand-600 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                        Vous
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-ink-700 whitespace-pre-wrap leading-relaxed">
                    {c.contenu}
                  </p>
                </div>

                {c.auteur === user?.id && (
                  <button
                    type="button"
                    onClick={() => setCommentaireASupprimer(c.id)}
                    disabled={deleteMutation.isPending}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:text-danger hover:bg-danger-bg transition-colors disabled:opacity-50"
                    aria-label="Supprimer"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex items-start gap-2.5">
          {user && (
            <Avatar name={user.nom_complet || user.username} size="sm" />
          )}
          <textarea
            rows={2}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            className="flex-1 px-3 py-2 border border-ink-200 rounded-md text-[12px]
                       focus:outline-none focus:ring-2 focus:ring-brand-500
                       focus:border-brand-400 transition-colors resize-none"
            placeholder="Ajouter un commentaire..."
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={createMutation.isPending || contenu.trim().length < 2}
            leftIcon={<Send size={12} />}
          >
            {createMutation.isPending ? 'Envoi...' : 'Envoyer'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={commentaireASupprimer !== null}
        title="Supprimer le commentaire"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (commentaireASupprimer !== null) {
            deleteMutation.mutate(commentaireASupprimer)
          }
        }}
        onCancel={() => setCommentaireASupprimer(null)}
      />
    </div>
  )
}