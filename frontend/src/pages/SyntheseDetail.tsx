/**
 * Page détail d'une synthèse — v6.
 * Layout 2 colonnes, contenu en bloc mono, métadonnées en sidebar.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CalendarRange,
  FileText,
  Trash2,
  User,
} from 'lucide-react'
import Layout from '../components/Layout'
import DetailPage from '../components/detail/DetailPage'
import MetaGroup from '../components/detail/MetaGroup'
import MetaItem from '../components/detail/MetaItem'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import { deleteSynthese, fetchSynthese } from '../api/syntheses'
import { estDirecteur as estDirecteurRole, usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/communs/ConfirmDialog'

function TypeBadge({ type, display }: { type: string; display: string }) {
  const STYLES: Record<string, { bg: string; icon: React.ReactNode }> = {
    QUOTIDIENNE: {
      bg: 'bg-info-bg text-info border-info-border',
      icon: <CalendarDays size={11} />,
    },
    HEBDOMADAIRE: {
      bg: 'bg-brand-50 text-brand-700 border-brand-200',
      icon: <CalendarRange size={11} />,
    },
    MENSUELLE: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Calendar size={11} />,
    },
  }
  const style = STYLES[type] || {
    bg: 'bg-ink-100 text-ink-600 border-ink-200',
    icon: <FileText size={11} />,
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${style.bg}`}
    >
      {style.icon}
      {display}
    </span>
  )
}

export default function SyntheseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { roles } = usePermissions()
  const { showToast } = useToast()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const syntheseId = Number(id)

  const {
    data: synthese,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['synthese', syntheseId],
    queryFn: () => fetchSynthese(syntheseId),
    enabled: !isNaN(syntheseId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSynthese(syntheseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syntheses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast('Synthèse supprimée', 'success')
      navigate('/syntheses')
    },
    onError: () => showToast('Impossible de supprimer la synthèse', 'error'),
  })

  // Seul le Directeur peut supprimer
  const peutSupprimer = estDirecteurRole(roles)

  if (isLoading) {
    return (
      <Layout title="Synthèse">
        <div className="space-y-5">
          <div className="h-4 w-32 bg-ink-100 rounded animate-pulse" />
          <div className="h-8 w-2/3 bg-ink-100 rounded animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-6">
            <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
            <div className="h-72 bg-ink-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !synthese) {
    return (
      <Layout title="Synthèse">
        <Card>
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <p className="text-[13px] text-ink-700">Synthèse introuvable.</p>
            <Link
              to="/syntheses"
              className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:underline mt-2"
            >
              ← Retour à la liste
            </Link>
          </div>
        </Card>
      </Layout>
    )
  }

  return (
    <Layout title="Détail de la synthèse">
      <DetailPage
        breadcrumb={{ label: 'Retour aux synthèses', to: '/syntheses' }}
        title={`Synthèse ${synthese.type_display.toLowerCase()}`}
        badges={
          <TypeBadge type={synthese.type} display={synthese.type_display} />
        }
        sidebar={
          <>
            {/* TYPE */}
            <MetaGroup title="Type">
              <MetaItem
                icon={<FileText size={14} />}
                label="Nature"
                value={synthese.type_display}
              />
            </MetaGroup>

            {/* PÉRIODE */}
            <MetaGroup title="Période">
              <MetaItem
                icon={<Calendar size={14} />}
                label="Du"
                value={new Date(synthese.periode_debut).toLocaleDateString(
                  'fr-FR',
                  { day: '2-digit', month: 'short', year: 'numeric' },
                )}
              />
              <MetaItem
                icon={<Calendar size={14} />}
                label="Au"
                value={new Date(synthese.periode_fin).toLocaleDateString(
                  'fr-FR',
                  { day: '2-digit', month: 'short', year: 'numeric' },
                )}
              />
            </MetaGroup>

            {/* GÉNÉRATION */}
            <MetaGroup title="Génération">
              <MetaItem
                icon={<User size={14} />}
                label="Générée par"
                value={
                  synthese.genere_par_detail ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar
                        name={synthese.genere_par_detail.nom_complet}
                        size="xs"
                      />
                      <span className="truncate">
                        {synthese.genere_par_detail.nom_complet}
                      </span>
                    </div>
                  ) : (
                    <span className="text-ink-400 italic text-[12px]">
                      Système
                    </span>
                  )
                }
              />
              <MetaItem
                icon={<CalendarDays size={14} />}
                label="Le"
                value={new Date(synthese.date_generation).toLocaleString(
                  'fr-FR',
                  {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )}
              />
            </MetaGroup>

            {/* ACTIONS */}
            {peutSupprimer && (
              <MetaGroup title="Actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                  leftIcon={<Trash2 size={12} />}
                  className="w-full !justify-start text-danger hover:bg-danger-bg"
                >
                  {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
                </Button>
              </MetaGroup>
            )}
          </>
        }
      >
        <Card title="Contenu de la synthèse">
          <div className="bg-ink-50/60 border border-ink-100 rounded-md p-5 max-h-[70vh] overflow-y-auto">
            <pre className="text-[12.5px] text-ink-800 whitespace-pre-wrap font-mono leading-relaxed">
              {synthese.contenu}
            </pre>
          </div>
        </Card>
      </DetailPage>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Supprimer la synthèse"
        message={`Vous allez supprimer la synthèse ${synthese.type_display.toLowerCase()} du ${new Date(synthese.periode_debut).toLocaleDateString('fr-FR')}. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </Layout>
  )
}
