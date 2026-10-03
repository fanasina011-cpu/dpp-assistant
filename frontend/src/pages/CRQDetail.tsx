/**
 * Page détail d'un CRQ — v6.
 * Layout 2 colonnes, sidebar sticky, 5 rubriques.
 */

import { FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Calendar,
  Check,
  Circle,
  ClipboardList,
  Lock,
  Pencil,
  Unlock,
  User,
  X,
} from 'lucide-react'
import Layout from '../components/Layout'
import DetailPage from '../components/detail/DetailPage'
import MetaGroup from '../components/detail/MetaGroup'
import MetaItem from '../components/detail/MetaItem'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import MotifModal from '../components/communs/MotifModal'
import { useAuth } from '../context/AuthContext'
import { estChefOuDirecteur as estChefOuDirecteurRole, usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import {
  demanderReouverture,
  fetchCRQ,
  refuserDemande,
  updateCRQ,
  validerDemande,
} from '../api/crq'

const RUBRIQUES = [
  { key: 'activites_realisees', label: 'Activités réalisées' },
  { key: 'activites_en_cours', label: 'Activités en cours' },
  { key: 'activites_non_realisees', label: 'Activités non réalisées' },
  { key: 'difficultes', label: 'Difficultés rencontrées' },
  { key: 'prevues_lendemain', label: 'Activités prévues pour demain' },
] as const

function StatutDemandeBadge({
  statut,
  display,
}: {
  statut: string
  display: string
}) {
  const styles: Record<string, string> = {
    EN_ATTENTE: 'bg-warning-bg text-warning border-warning-border',
    VALIDEE: 'bg-success-bg text-success border-success-border',
    REFUSEE: 'bg-danger-bg text-danger border-danger-border',
  }
  const style = styles[statut] || 'bg-ink-100 text-ink-600 border-ink-200'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${style}`}
    >
      {display}
    </span>
  )
}

export default function CRQDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { roles } = usePermissions()
  const { showToast } = useToast()

  const crqId = Number(id)
  const [isEditing, setIsEditing] = useState(false)
  const [isMotifModalOpen, setIsMotifModalOpen] = useState(false)

  const [activitesRealisees, setActivitesRealisees] = useState('')
  const [activitesEnCours, setActivitesEnCours] = useState('')
  const [activitesNonRealisees, setActivitesNonRealisees] = useState('')
  const [difficultes, setDifficultes] = useState('')
  const [prevuesLendemain, setPrevuesLendemain] = useState('')

  const {
    data: crq,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['crq', crqId],
    queryFn: () => fetchCRQ(crqId),
    enabled: !isNaN(crqId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['crq', crqId] })
    queryClient.invalidateQueries({ queryKey: ['crqs'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateCRQ(crqId, payload),
    onSuccess: () => {
      invalidate()
      setIsEditing(false)
      showToast('CRQ mis à jour', 'success')
    },
    onError: () => showToast('Erreur lors de la mise à jour', 'error'),
  })

  const demandeMutation = useMutation({
    mutationFn: (motif: string) => demanderReouverture(crqId, motif),
    onSuccess: () => {
      invalidate()
      setIsMotifModalOpen(false)
      showToast('Demande de réouverture envoyée', 'success')
    },
    onError: (err: any) =>
      showToast(
        err?.response?.data?.detail || 'Erreur lors de la demande',
        'error',
      ),
  })

  const validerMutation = useMutation({
    mutationFn: validerDemande,
    onSuccess: () => {
      invalidate()
      showToast('Demande validée', 'success')
    },
    onError: (err: any) =>
      showToast(err?.response?.data?.detail || 'Erreur', 'error'),
  })

  const refuserMutation = useMutation({
    mutationFn: refuserDemande,
    onSuccess: () => {
      invalidate()
      showToast('Demande refusée', 'success')
    },
    onError: (err: any) =>
      showToast(err?.response?.data?.detail || 'Erreur', 'error'),
  })

  const handleStartEdit = () => {
    if (!crq) return
    setActivitesRealisees(crq.activites_realisees)
    setActivitesEnCours(crq.activites_en_cours)
    setActivitesNonRealisees(crq.activites_non_realisees)
    setDifficultes(crq.difficultes)
    setPrevuesLendemain(crq.prevues_lendemain)
    setIsEditing(true)
  }

  const handleSaveEdit = (event: FormEvent) => {
    event.preventDefault()
    updateMutation.mutate({
      activites_realisees: activitesRealisees.trim(),
      activites_en_cours: activitesEnCours.trim(),
      activites_non_realisees: activitesNonRealisees.trim(),
      difficultes: difficultes.trim(),
      prevues_lendemain: prevuesLendemain.trim(),
    })
  }

  if (isLoading) {
    return (
      <Layout title="Compte-rendu">
        <div className="space-y-5">
          <div className="h-4 w-32 bg-ink-100 rounded animate-pulse" />
          <div className="h-8 w-2/3 bg-ink-100 rounded animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-6">
            <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
            <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !crq) {
    return (
      <Layout title="Compte-rendu">
        <Card>
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <p className="text-[13px] text-ink-700">
              CRQ introuvable ou accès refusé.
            </p>
            <Link
              to="/crq"
              className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:underline mt-2"
            >
              ← Retour à la liste
            </Link>
          </div>
        </Card>
      </Layout>
    )
  }

  const estAuteur = user?.id === crq.redacteur
  const estChefOuDirecteur = estChefOuDirecteurRole(roles)

  const peutModifier = estAuteur && !crq.est_cloture
  const peutDemanderReouverture = estAuteur && crq.est_cloture

  const demandeEnAttente = crq.demandes_reouverture.find(
    (d) => d.statut === 'EN_ATTENTE',
  )

  const dateFormatee = new Date(crq.date_journaliere).toLocaleDateString(
    'fr-FR',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  )

  return (
    <Layout title="Détail du compte-rendu">
      <DetailPage
        breadcrumb={{ label: 'Retour aux CRQ', to: '/crq' }}
        title={dateFormatee.charAt(0).toUpperCase() + dateFormatee.slice(1)}
        badges={
          crq.est_cloture ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border bg-ink-100 text-ink-600 border-ink-200">
              <Lock size={10} />
              Clôturé
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border bg-info-bg text-info border-info-border">
              En cours
            </span>
          )
        }
        actions={
          <>
            {peutModifier && !isEditing && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleStartEdit}
                leftIcon={<Pencil size={13} />}
              >
                Modifier
              </Button>
            )}
            {peutDemanderReouverture && !demandeEnAttente && (
              <Button
                size="md"
                onClick={() => setIsMotifModalOpen(true)}
                leftIcon={<Unlock size={13} />}
                className="!bg-orange-600 hover:!bg-orange-700"
              >
                Demander réouverture
              </Button>
            )}
          </>
        }
        sidebar={
          <>
            {/* ÉTAT */}
            <MetaGroup title="État">
              <MetaItem
                icon={<Circle size={14} />}
                label="Statut"
                value={crq.est_cloture ? 'Clôturé' : 'En cours'}
              />
              <MetaItem
                icon={<ClipboardList size={14} />}
                label="Demandes"
                value={
                  crq.demandes_reouverture.length > 0
                    ? `${crq.demandes_reouverture.length} demande${crq.demandes_reouverture.length > 1 ? 's' : ''}`
                    : 'Aucune'
                }
              />
            </MetaGroup>

            {/* AUTEUR */}
            <MetaGroup title="Rédacteur">
              <MetaItem
                icon={<User size={14} />}
                label="Rédigé par"
                value={
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      name={crq.redacteur_detail.nom_complet}
                      size="xs"
                    />
                    <span className="truncate">
                      {crq.redacteur_detail.nom_complet}
                    </span>
                    {estAuteur && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-brand-600 bg-brand-50 border border-brand-200 px-1 py-0.5 rounded">
                        Vous
                      </span>
                    )}
                  </div>
                }
              />
            </MetaGroup>

            {/* DATES */}
            <MetaGroup title="Dates">
              <MetaItem
                icon={<Calendar size={14} />}
                label="Date du CRQ"
                value={new Date(crq.date_journaliere).toLocaleDateString(
                  'fr-FR',
                  { day: '2-digit', month: 'short', year: 'numeric' },
                )}
              />
              <MetaItem
                icon={<Calendar size={14} />}
                label="Créé le"
                value={new Date(crq.date_creation).toLocaleDateString(
                  'fr-FR',
                  { day: '2-digit', month: 'short', year: 'numeric' },
                )}
              />
            </MetaGroup>

            {/* NOTE */}
            {demandeEnAttente && (
              <div className="bg-warning-bg border border-warning-border rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <ClipboardList
                    size={14}
                    className="text-warning shrink-0 mt-0.5"
                  />
                  <div className="text-[11px] text-ink-700 leading-relaxed">
                    <p className="font-medium text-warning">
                      Réouverture demandée
                    </p>
                    <p className="mt-0.5">
                      En attente de validation par un responsable.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        }
      >
        {/* Rubriques */}
        <Card>
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <h3 className="text-[14px] font-semibold text-ink-900 mb-2">
                Modifier les rubriques
              </h3>
              {RUBRIQUES.map((rub) => {
                const value =
                  rub.key === 'activites_realisees'
                    ? activitesRealisees
                    : rub.key === 'activites_en_cours'
                      ? activitesEnCours
                      : rub.key === 'activites_non_realisees'
                        ? activitesNonRealisees
                        : rub.key === 'difficultes'
                          ? difficultes
                          : prevuesLendemain
                const setter =
                  rub.key === 'activites_realisees'
                    ? setActivitesRealisees
                    : rub.key === 'activites_en_cours'
                      ? setActivitesEnCours
                      : rub.key === 'activites_non_realisees'
                        ? setActivitesNonRealisees
                        : rub.key === 'difficultes'
                          ? setDifficultes
                          : setPrevuesLendemain
                return (
                  <div key={rub.key}>
                    <label className="block text-[12px] font-medium text-ink-700 mb-1">
                      {rub.label}
                    </label>
                    <textarea
                      rows={2}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="w-full px-3 py-2 border border-ink-200 rounded-md text-[13px]
                                 focus:outline-none focus:ring-2 focus:ring-brand-500
                                 focus:border-brand-400 transition-colors resize-none"
                    />
                  </div>
                )
              })}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending
                    ? 'Enregistrement...'
                    : 'Enregistrer'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {RUBRIQUES.map((rub) => {
                const value = crq[rub.key] as string
                return (
                  <div
                    key={rub.key}
                    className="pb-4 border-b border-ink-100 last:border-0 last:pb-0"
                  >
                    <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-1.5">
                      {rub.label}
                    </div>
                    <div className="text-[13px] text-ink-800 whitespace-pre-wrap leading-relaxed">
                      {value || (
                        <span className="text-ink-400 italic">
                          Non renseigné
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Demandes */}
        {crq.demandes_reouverture.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Unlock size={14} className="text-ink-400" />
              <h3 className="text-[14px] font-semibold text-ink-900">
                Demandes de réouverture
              </h3>
              <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
                {crq.demandes_reouverture.length}
              </span>
            </div>

            <div className="space-y-2">
              {crq.demandes_reouverture.map((demande) => (
                <div
                  key={demande.id}
                  className="border border-ink-200 rounded-md p-3 flex items-start justify-between gap-4 flex-wrap"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <StatutDemandeBadge
                        statut={demande.statut}
                        display={demande.statut_display}
                      />
                      <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                        <Avatar
                          name={demande.demandeur_detail.nom_complet}
                          size="xs"
                        />
                        <span>{demande.demandeur_detail.nom_complet}</span>
                        <span className="text-ink-300">·</span>
                        <span>
                          {new Date(demande.date_demande).toLocaleDateString(
                            'fr-FR',
                            { day: '2-digit', month: 'short', year: 'numeric' },
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12px] text-ink-700 leading-relaxed whitespace-pre-wrap">
                      {demande.motif}
                    </p>
                  </div>

                  {demande.statut === 'EN_ATTENTE' && estChefOuDirecteur && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => validerMutation.mutate(demande.id)}
                        disabled={validerMutation.isPending}
                        leftIcon={<Check size={11} />}
                      >
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => refuserMutation.mutate(demande.id)}
                        disabled={refuserMutation.isPending}
                        leftIcon={<X size={11} />}
                        className="text-danger hover:bg-danger-bg"
                      >
                        Refuser
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </DetailPage>

      <MotifModal
        isOpen={isMotifModalOpen}
        title="Demander la réouverture"
        description={`CRQ du ${dateFormatee}. Expliquez pourquoi vous souhaitez le rouvrir.`}
        placeholder="Expliquez pourquoi vous souhaitez rouvrir ce CRQ..."
        confirmLabel="Envoyer la demande"
        variant="warning"
        isPending={demandeMutation.isPending}
        onConfirm={(motif) => demandeMutation.mutate(motif)}
        onCancel={() => setIsMotifModalOpen(false)}
      />
    </Layout>
  )
}
