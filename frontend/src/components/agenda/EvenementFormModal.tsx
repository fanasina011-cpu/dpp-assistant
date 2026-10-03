/**
 * Modale de création OU de modification d'un événement.
 */

import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { createEvenement, updateEvenement } from '../../api/evenements'
import { fetchUtilisateurs } from '../../api/utilisateurs'
import { formatDateTimeLocal } from '../../utils/calendrier'
import { useToast } from '../../context/ToastContext'
import type { Evenement, NiveauPriorite, TypeEvenement } from '../../types'
import UserMultiSelect from '../ui/UserMultiSelect'

interface EvenementFormModalProps {
  isOpen: boolean
  onClose: () => void
  dateInitiale?: Date
  evenement?: Evenement | null
}

const TYPES: Array<{ value: TypeEvenement; label: string }> = [
  { value: 'REUNION', label: 'Réunion' },
  { value: 'RENDEZ_VOUS', label: 'Rendez-vous' },
  { value: 'AUDIENCE', label: 'Audience' },
  { value: 'DEPLACEMENT', label: 'Déplacement' },
  { value: 'RAPPEL', label: 'Rappel' },
  { value: 'ECHEANCE', label: 'Échéance' },
  { value: 'AUTRE', label: 'Autre' },
]

const NIVEAUX: Array<{ value: NiveauPriorite; label: string }> = [
  { value: 'PERSONNEL', label: 'Personnel' },
  { value: 'DIRECTION', label: 'Direction' },
]

export default function EvenementFormModal({
  isOpen,
  onClose,
  dateInitiale,
  evenement,
}: EvenementFormModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const modeEdition = !!evenement

  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<TypeEvenement>('REUNION')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [niveauPriorite, setNiveauPriorite] =
    useState<NiveauPriorite>('PERSONNEL')
  const [participantIds, setParticipantIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isOpen,
  })

  useEffect(() => {
    if (!isOpen) return

    if (evenement) {
      setTitre(evenement.titre)
      setDescription(evenement.description || '')
      setType(evenement.type)
      setDateDebut(formatDateTimeLocal(new Date(evenement.date_debut)))
      setDateFin(formatDateTimeLocal(new Date(evenement.date_fin)))
      setNiveauPriorite(evenement.niveau_priorite)
      setParticipantIds(evenement.participants || [])
    } else {
      const base = dateInitiale ? new Date(dateInitiale) : new Date()
      const fin = new Date(base)
      fin.setHours(fin.getHours() + 1)
      setTitre('')
      setDescription('')
      setType('REUNION')
      setDateDebut(formatDateTimeLocal(base))
      setDateFin(formatDateTimeLocal(fin))
      setNiveauPriorite('PERSONNEL')
      setParticipantIds([])
    }
    setError(null)
  }, [isOpen, evenement, dateInitiale])

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      modeEdition
        ? updateEvenement(evenement!.id, payload)
        : createEvenement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast(
        modeEdition ? 'Événement modifié' : 'Événement créé avec succès',
        'success',
      )
      setError(null)
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      let msg = "Erreur lors de l'enregistrement"
      if (detail && typeof detail === 'object') {
        const firstKey = Object.keys(detail)[0]
        const firstMsg = Array.isArray(detail[firstKey])
          ? detail[firstKey][0]
          : detail[firstKey]
        msg = String(firstMsg)
      }
      showToast(msg, 'error')
      setError(msg)
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
    if (!dateDebut || !dateFin) {
      setError('Les dates sont obligatoires.')
      return
    }
    if (new Date(dateFin) <= new Date(dateDebut)) {
      setError('La date de fin doit être postérieure à la date de début.')
      return
    }

    mutation.mutate({
      titre: titre.trim(),
      description: description.trim(),
      type,
      date_debut: dateDebut,
      date_fin: dateFin,
      niveau_priorite: niveauPriorite,
      participants: participantIds,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <h2 className="text-base font-semibold text-ink-900 mb-4">
          {modeEdition ? "Modifier l'événement" : 'Nouvel événement'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Titre *"
            type="text"
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-ink-200 rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500
                         focus:border-brand-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as TypeEvenement)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>

            <Select
              label="Niveau de priorité"
              value={niveauPriorite}
              onChange={(e) =>
                setNiveauPriorite(e.target.value as NiveauPriorite)
              }
            >
              {NIVEAUX.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Début *"
              type="datetime-local"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
            <Input
              label="Fin *"
              type="datetime-local"
              required
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>

                    {/* Participants */}
          <div className="border-t border-ink-100 pt-4">
            <UserMultiSelect
              users={utilisateurs}
              value={participantIds}
              onChange={setParticipantIds}
              label="Participants"
              placeholder="Sélectionner des participants"
            />
          </div>

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
                ? 'Enregistrement...'
                : modeEdition
                  ? 'Enregistrer'
                  : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}