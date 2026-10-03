/**
 * Modale de création ET d'édition d'une tâche.
 *
 * Props :
 *   - tache : optionnel. Si fourni → mode édition.
 *   - onClose, isOpen
 *
 * Utilise le design system + toasts + invalidation dashboard.
 */

import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { createTache, updateTache } from '../../api/taches'
import { fetchUtilisateurs } from '../../api/utilisateurs'
import { useToast } from '../../context/ToastContext'
import type { Priorite, Tache } from '../../types'
import UserSelect from '../ui/UserSelect'

interface TacheFormModalProps {
  isOpen: boolean
  onClose: () => void
  tache?: Tache | null
  /** Rattache automatiquement la tâche créée à cette activité */
  activiteId?: number
  /** Rattache automatiquement la tâche créée à cette instruction */
  instructionId?: number
}

const PRIORITES: Array<{ value: Priorite; label: string }> = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
]

const STATUTS = [
  { value: 'A_FAIRE', label: 'À faire' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'BLOQUEE', label: 'Bloquée' },
  { value: 'TERMINEE', label: 'Terminée' },
  { value: 'ANNULEE', label: 'Annulée' },
]

/** Convertit un ISO en valeur pour input datetime-local */
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TacheFormModal({
  isOpen,
  onClose,
  tache = null,
  activiteId,
  instructionId,
}: TacheFormModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const isEdition = Boolean(tache)

  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [priorite, setPriorite] = useState<Priorite>('NORMALE')
  const [statut, setStatut] = useState('A_FAIRE')
  const [dateDebut, setDateDebut] = useState('')
  const [dateEcheance, setDateEcheance] = useState('')
  const [responsableId, setResponsableId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  // Reset des champs à chaque ouverture
  useEffect(() => {
    if (!isOpen) return
    if (tache) {
      setTitre(tache.titre)
      setDescription(tache.description || '')
      setPriorite(tache.priorite)
      setStatut(tache.statut)
      setDateDebut(toDatetimeLocal(tache.date_debut))
      setDateEcheance(toDatetimeLocal(tache.date_echeance))
      setResponsableId(tache.responsable || '')
    } else {
      setTitre('')
      setDescription('')
      setPriorite('NORMALE')
      setStatut('A_FAIRE')
      setDateDebut('')
      setDateEcheance('')
      setResponsableId('')
    }
    setError(null)
  }, [isOpen, tache])

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isOpen,
  })

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      isEdition ? updateTache(tache!.id, payload) : createTache(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (tache) {
        queryClient.invalidateQueries({ queryKey: ['tache', tache.id] })
      }
      showToast(
        isEdition ? 'Tâche modifiée avec succès' : 'Tâche créée avec succès',
        'success',
      )
      onClose()
    },
    onError: () => {
      const msg = isEdition
        ? 'Erreur lors de la modification'
        : 'Erreur lors de la création'
      showToast(msg, 'error')
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

    const payload: any = {
      titre: titre.trim(),
      description: description.trim(),
      priorite,
      date_debut: dateDebut || null,
      date_echeance: dateEcheance || null,
      responsable: responsableId ? Number(responsableId) : null,
      statut,
    }

    // Rattachement automatique en création
    if (!isEdition) {
      if (activiteId) payload.activite = activiteId
      if (instructionId) payload.instruction = instructionId
    }

    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <h2 className="text-base font-semibold text-ink-900 mb-4">
          {isEdition ? 'Modifier la tâche' : 'Nouvelle tâche'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Titre *"
            type="text"
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre de la tâche"
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

          <UserSelect
            users={utilisateurs}
            value={responsableId}
            onChange={(id) => setResponsableId(id)}
            label="Responsable"
            placeholder="Non assigné"
            allowNone
          />

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