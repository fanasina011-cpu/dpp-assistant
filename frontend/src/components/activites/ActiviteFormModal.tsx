/**
 * Modale de création ET d'édition d'une activité.
 *
 * En création : possibilité d'ajouter des tâches initiales (héritage
 * responsable + échéance), créées au submit.
 * En édition : lien vers la page détail pour gérer les tâches.
 */

import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  CheckSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Select from '../ui/Select'
import UserSelect from '../ui/UserSelect'
import {
  createActivite,
  updateActivite,
} from '../../api/activites'
import { createTache } from '../../api/taches'
import { fetchUtilisateurs } from '../../api/utilisateurs'
import { useToast } from '../../context/ToastContext'
import type { Activite, Priorite } from '../../types'

interface ActiviteFormModalProps {
  isOpen: boolean
  onClose: () => void
  activite?: Activite | null
}

const PRIORITES: Array<{ value: Priorite; label: string }> = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
]

const STATUTS = [
  { value: 'OUVERTE', label: 'Ouverte' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'CLOTUREE', label: 'Clôturée' },
  { value: 'ANNULEE', label: 'Annulée' },
]

interface TacheInitiale {
  tempId: string
  titre: string
  priorite: Priorite
  dateEcheance: string
  responsable: number | ''
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ActiviteFormModal({
  isOpen,
  onClose,
  activite = null,
}: ActiviteFormModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const isEdition = Boolean(activite)

  // Champs de l'activité
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [priorite, setPriorite] = useState<Priorite>('NORMALE')
  const [statut, setStatut] = useState('OUVERTE')
  const [dateDebut, setDateDebut] = useState('')
  const [dateEcheance, setDateEcheance] = useState('')
  const [responsableId, setResponsableId] = useState<number | '' | null>('')
  const [error, setError] = useState<string | null>(null)

  // Tâches initiales (création uniquement)
  const [tachesInitiales, setTachesInitiales] = useState<TacheInitiale[]>([])
  const [isAddingTache, setIsAddingTache] = useState(false)
  const [nouvelleTache, setNouvelleTache] = useState<Partial<TacheInitiale>>({
    titre: '',
    priorite: 'NORMALE',
    dateEcheance: '',
    responsable: '',
  })

  // Reset à chaque ouverture
  useEffect(() => {
    if (!isOpen) return
    if (activite) {
      setTitre(activite.titre)
      setDescription(activite.description || '')
      setPriorite(activite.priorite)
      setStatut(activite.statut)
      setDateDebut(toDatetimeLocal(activite.date_debut))
      setDateEcheance(toDatetimeLocal(activite.date_echeance))
      setResponsableId(activite.responsable || '')
    } else {
      setTitre('')
      setDescription('')
      setPriorite('NORMALE')
      setStatut('OUVERTE')
      setDateDebut('')
      setDateEcheance('')
      setResponsableId('')
    }
    setTachesInitiales([])
    setIsAddingTache(false)
    setNouvelleTache({
      titre: '',
      priorite: 'NORMALE',
      dateEcheance: '',
      responsable: '',
    })
    setError(null)
  }, [isOpen, activite])

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isOpen,
  })

  // ----- Tâches initiales -----
  const startAddingTache = () => {
    // Héritage : responsable + échéance de l'activité
    setNouvelleTache({
      titre: '',
      priorite: 'NORMALE',
      dateEcheance: dateEcheance || '',
      responsable: responsableId || '',
    })
    setIsAddingTache(true)
  }

  const confirmTache = () => {
    const t = nouvelleTache.titre?.trim() || ''
    if (t.length < 3) return

    setTachesInitiales((prev) => [
      ...prev,
      {
        tempId: Math.random().toString(36).slice(2),
        titre: t,
        priorite: nouvelleTache.priorite || 'NORMALE',
        dateEcheance: nouvelleTache.dateEcheance || '',
        responsable: nouvelleTache.responsable ?? '',
      },
    ])
    setIsAddingTache(false)
    setNouvelleTache({
      titre: '',
      priorite: 'NORMALE',
      dateEcheance: '',
      responsable: '',
    })
  }

  const cancelAddingTache = () => {
    setIsAddingTache(false)
    setNouvelleTache({
      titre: '',
      priorite: 'NORMALE',
      dateEcheance: '',
      responsable: '',
    })
  }

  const removeTache = (tempId: string) => {
    setTachesInitiales((prev) => prev.filter((t) => t.tempId !== tempId))
  }

  // ----- Mutation -----
  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        titre: titre.trim(),
        description: description.trim(),
        priorite,
        statut,
        date_debut: dateDebut || null,
        date_echeance: dateEcheance || null,
        responsable: Number(responsableId),
      }

      // 1. Créer ou modifier l'activité
      const activiteResult = isEdition
        ? await updateActivite(activite!.id, payload)
        : await createActivite(payload)

      // 2. Créer les tâches initiales (uniquement en création)
      if (!isEdition && tachesInitiales.length > 0) {
        await Promise.all(
          tachesInitiales.map((t) =>
            createTache({
              titre: t.titre,
              priorite: t.priorite,
              date_echeance: t.dateEcheance || null,
              responsable: t.responsable ? Number(t.responsable) : null,
              activite: activiteResult.id,
            }),
          ),
        )
      }

      return activiteResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activites'] })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (activite) {
        queryClient.invalidateQueries({ queryKey: ['activite', activite.id] })
        queryClient.invalidateQueries({
          queryKey: ['taches', 'activite', activite.id],
        })
      }

      const nbTaches = tachesInitiales.length
      if (isEdition) {
        showToast('Activité modifiée avec succès', 'success')
      } else if (nbTaches > 0) {
        showToast(
          `Activité créée avec ${nbTaches} tâche${nbTaches > 1 ? 's' : ''}`,
          'success',
        )
      } else {
        showToast('Activité créée avec succès', 'success')
      }
      onClose()
    },
    onError: () => {
      showToast(
        isEdition
          ? 'Erreur lors de la modification'
          : 'Erreur lors de la création',
        'error',
      )
      setError('Vérifiez les champs et réessayez.')
    },
  })

  if (!isOpen) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (titre.trim().length < 3) {
      setError('Le titre doit contenir au moins 3 caractères.')
      return
    }
    if (!responsableId) {
      setError('Vous devez sélectionner un responsable.')
      return
    }

    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <h2 className="text-base font-semibold text-ink-900 mb-4">
          {isEdition ? "Modifier l'activité" : 'Nouvelle activité'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Titre *"
            type="text"
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre de l'activité"
          />

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-ink-200 rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500
                         focus:border-brand-400 transition-colors"
              placeholder="Description détaillée"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priorité"
              value={priorite}
              onChange={(e) => setPriorite(e.target.value as Priorite)}
            >
              {PRIORITES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>

            <Input
              label="Date de début"
              type="datetime-local"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>

          <Input
            label="Échéance"
            type="datetime-local"
            value={dateEcheance}
            onChange={(e) => setDateEcheance(e.target.value)}
          />

          {isEdition && (
            <Select
              label="Statut"
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
            >
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}

          <UserSelect
            users={utilisateurs}
            value={responsableId}
            onChange={(id) => setResponsableId(id)}
            label="Responsable *"
            placeholder="Sélectionner un responsable"
          />

          {/* ==================== TÂCHES INITIALES (création) ==================== */}
          {!isEdition && (
            <div className="border-t border-ink-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare size={14} className="text-ink-400" />
                  <h3 className="text-[13px] font-semibold text-ink-900">
                    Tâches initiales
                  </h3>
                  <span className="text-[10px] text-ink-400 font-normal">
                    (optionnel)
                  </span>
                  {tachesInitiales.length > 0 && (
                    <span className="text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
                      {tachesInitiales.length}
                    </span>
                  )}
                </div>

                {!isAddingTache && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={startAddingTache}
                    leftIcon={<Plus size={12} />}
                  >
                    Ajouter une tâche
                  </Button>
                )}
              </div>

              {/* Liste des tâches ajoutées */}
              {tachesInitiales.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {tachesInitiales.map((t) => {
                    const resp = utilisateurs.find((u) => u.id === t.responsable)
                    return (
                      <div
                        key={t.tempId}
                        className="flex items-center gap-2 px-3 py-2 border border-ink-200 rounded-md bg-ink-50/40"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium text-ink-900 truncate">
                            {t.titre}
                          </div>
                          <div className="text-[10px] text-ink-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>{t.priorite}</span>
                            {resp && (
                              <>
                                <span className="text-ink-300">·</span>
                                <span>{resp.nom_complet}</span>
                              </>
                            )}
                            {t.dateEcheance && (
                              <>
                                <span className="text-ink-300">·</span>
                                <span className="tabular-nums">
                                  {new Date(t.dateEcheance).toLocaleDateString(
                                    'fr-FR',
                                    { day: '2-digit', month: 'short' },
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTache(t.tempId)}
                          className="w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:text-danger hover:bg-danger-bg transition-colors shrink-0"
                          aria-label="Retirer"
                          title="Retirer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Mini-formulaire d'ajout */}
              {isAddingTache && (
                <div className="border border-brand-200 bg-brand-50/30 rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                      Nouvelle tâche
                    </span>
                    <button
                      type="button"
                      onClick={cancelAddingTache}
                      className="w-5 h-5 flex items-center justify-center rounded text-ink-400 hover:text-ink-700"
                      aria-label="Annuler"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <Input
                    label="Titre *"
                    type="text"
                    value={nouvelleTache.titre || ''}
                    onChange={(e) =>
                      setNouvelleTache((p) => ({ ...p, titre: e.target.value }))
                    }
                    placeholder="Titre de la tâche"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Priorité"
                      value={nouvelleTache.priorite || 'NORMALE'}
                      onChange={(e) =>
                        setNouvelleTache((p) => ({
                          ...p,
                          priorite: e.target.value as Priorite,
                        }))
                      }
                    >
                      {PRIORITES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </Select>

                    <Input
                      label="Échéance"
                      type="datetime-local"
                      value={nouvelleTache.dateEcheance || ''}
                      onChange={(e) =>
                        setNouvelleTache((p) => ({
                          ...p,
                          dateEcheance: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <UserSelect
                    users={utilisateurs}
                    value={nouvelleTache.responsable ?? ''}
                    onChange={(id) =>
                      setNouvelleTache((p) => ({ ...p, responsable: id }))
                    }
                    label="Responsable"
                    placeholder="Non assigné"
                    allowNone
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={cancelAddingTache}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={confirmTache}
                      disabled={
                        !nouvelleTache.titre ||
                        nouvelleTache.titre.trim().length < 3
                      }
                      leftIcon={<Plus size={11} />}
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              )}

              {tachesInitiales.length === 0 && !isAddingTache && (
                <p className="text-[11px] text-ink-500 text-center py-2">
                  Vous pouvez créer des tâches initiales qui seront rattachées
                  automatiquement à l'activité.
                </p>
              )}
            </div>
          )}

          {/* ==================== ENCART ÉDITION ==================== */}
          {isEdition && (
            <div className="border-t border-ink-100 pt-4">
              <div className="flex items-start gap-3 px-3 py-3 bg-info-bg border border-info-border rounded-md">
                <CheckSquare
                  size={14}
                  className="text-info shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-ink-700 leading-relaxed">
                    Pour ajouter, retirer ou consulter les tâches de cette
                    activité, utilisez la page détail.
                  </p>
                  <Link
                    to={`/activites/${activite!.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:underline mt-1.5"
                  >
                    Gérer les tâches
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-danger-bg border border-danger-border text-danger text-[12px] rounded-md p-3 flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? isEdition
                  ? 'Enregistrement...'
                  : 'Création...'
                : isEdition
                  ? 'Enregistrer'
                  : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}