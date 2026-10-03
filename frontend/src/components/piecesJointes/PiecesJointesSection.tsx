/**
 * Section de pièces jointes — v5.
 * Design system, icônes Lucide, toasts, upload stylisé.
 */

import { ChangeEvent, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, File, Paperclip, Trash2, Upload } from 'lucide-react'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import ConfirmDialog from '../communs/ConfirmDialog'
import {
  deletePieceJointe,
  downloadPieceJointe,
  fetchPiecesJointes,
  uploadPieceJointe,
} from '../../api/piecesJointes'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { PieceJointe } from '../../types'

interface PiecesJointesSectionProps {
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

/** Retourne une couleur d'accent selon l'extension du fichier */
function styleForFile(nomFichier: string): {
  bg: string
  text: string
  ext: string
} {
  const ext = nomFichier.split('.').pop()?.toLowerCase() || ''
  const extUpper = ext.toUpperCase()

  if (['pdf'].includes(ext)) {
    return { bg: 'bg-danger-bg', text: 'text-danger', ext: extUpper }
  }
  if (['doc', 'docx'].includes(ext)) {
    return { bg: 'bg-info-bg', text: 'text-info', ext: extUpper }
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { bg: 'bg-success-bg', text: 'text-success', ext: extUpper }
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { bg: 'bg-orange-50', text: 'text-orange-600', ext: extUpper }
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) {
    return { bg: 'bg-purple-50', text: 'text-purple-600', ext: extUpper }
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return { bg: 'bg-ink-100', text: 'text-ink-600', ext: extUpper }
  }
  return { bg: 'bg-ink-100', text: 'text-ink-500', ext: extUpper || 'FILE' }
}

export default function PiecesJointesSection({
  tacheId,
  instructionId,
  activiteId,
}: PiecesJointesSectionProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pieceASupprimer, setPieceASupprimer] = useState<number | null>(null)

  const cible = {
    tache: tacheId,
    instruction: instructionId,
    activite: activiteId,
  }

  const queryKey = [
    'pieces-jointes',
    tacheId ?? null,
    instructionId ?? null,
    activiteId ?? null,
  ]

  const {
    data: pieces = [],
    isLoading,
  } = useQuery({
    queryKey,
    queryFn: () => fetchPiecesJointes(cible),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ fichier }: { fichier: File }) =>
      uploadPieceJointe(fichier, cible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      if (fileInputRef.current) fileInputRef.current.value = ''
      showToast('Fichier ajouté avec succès', 'success')
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.detail || "Erreur lors de l'upload",
        'error',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePieceJointe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setPieceASupprimer(null)
      showToast('Fichier supprimé', 'success')
    },
    onError: () => {
      showToast('Impossible de supprimer le fichier', 'error')
    },
  })

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fichier = event.target.files?.[0]
    if (!fichier) return

    if (fichier.size > 10 * 1024 * 1024) {
      showToast('Le fichier dépasse la taille maximale de 10 Mo', 'warning')
      return
    }

    uploadMutation.mutate({ fichier })
  }

  const handleDownload = (id: number, nom: string) => {
    downloadPieceJointe(id, nom).catch((err) => {
      console.error('Erreur téléchargement:', err)
      showToast(
        err?.response?.data?.detail ||
          `Erreur lors du téléchargement (${err?.response?.status || 'réseau'})`,
        'error',
      )
    })
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-ink-900 flex items-center gap-2">
          <Paperclip size={14} className="text-ink-400" />
          Pièces jointes
          {pieces.length > 0 && (
            <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
              {pieces.length}
            </span>
          )}
        </h3>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.zip"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            leftIcon={<Upload size={12} />}
          >
            {uploadMutation.isPending ? 'Envoi...' : 'Joindre'}
          </Button>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="border border-ink-100 rounded-md p-3 flex items-center gap-3 animate-pulse"
            >
              <div className="w-9 h-9 rounded-md bg-ink-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/2 bg-ink-100 rounded" />
                <div className="h-2.5 w-1/3 bg-ink-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : pieces.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-ink-400">
          <Paperclip size={28} strokeWidth={1.25} />
          <p className="text-[12px]">Aucun fichier joint pour le moment.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pieces.map((pj: PieceJointe) => {
            const style = styleForFile(pj.nom_fichier)
            return (
              <li
                key={pj.id}
                className="border border-ink-200 rounded-md p-3 hover:bg-ink-50/30 transition-colors flex items-center justify-between gap-3 group"
              >
                {/* Icône type + infos */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}
                  >
                    <File size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink-900 truncate">
                      {pj.nom_fichier}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-ink-500 mt-0.5 flex-wrap">
                      <span
                        className={`font-semibold ${style.text} tracking-wide`}
                      >
                        {style.ext}
                      </span>
                      <span className="text-ink-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Avatar
                          name={pj.uploade_par_detail.nom_complet}
                          size="xs"
                        />
                        {pj.uploade_par_detail.nom_complet}
                      </span>
                      <span className="text-ink-300">·</span>
                      <span>{formatRelatif(pj.date_upload)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(pj.id, pj.nom_fichier)}
                    className="w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    aria-label="Télécharger"
                    title="Télécharger"
                  >
                    <Download size={14} />
                  </button>

                  {pj.uploade_par === user?.id && (
                    <button
                      type="button"
                      onClick={() => setPieceASupprimer(pj.id)}
                      disabled={deleteMutation.isPending}
                      className="w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-danger hover:bg-danger-bg transition-colors disabled:opacity-50"
                      aria-label="Supprimer"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={pieceASupprimer !== null}
        title="Supprimer la pièce jointe"
        message="Le fichier sera définitivement supprimé."
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (pieceASupprimer !== null) {
            deleteMutation.mutate(pieceASupprimer)
          }
        }}
        onCancel={() => setPieceASupprimer(null)}
      />
    </div>
  )
}