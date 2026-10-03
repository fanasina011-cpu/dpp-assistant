/**
 * Modale d'édition d'un blocage.
 */

import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Select from '../ui/Select'
import { updateBlocage } from '../../api/blocages'
import { fetchUtilisateurs } from '../../api/utilisateurs'
import { useToast } from '../../context/ToastContext'
import type { Blocage } from '../../types'
import UserSelect from '../ui/UserSelect'

interface BlocageEditModalProps {
  isOpen: boolean
  blocage: Blocage | null
  onClose: () => void
}

const URGENCES = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'MOYENNE', label: 'Moyenne' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'CRITIQUE', label: 'Critique' },
]

export default function BlocageEditModal({
  isOpen,
  blocage,
  onClose,
}: BlocageEditModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [description, setDescription] = useState('')
  const [niveauUrgence, setNiveauUrgence] = useState('MOYENNE')
  const [personneSollicitee, setPersonneSollicitee] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && blocage) {
      setDescription(blocage.description)
      setNiveauUrgence(blocage.niveau_urgence)
      setPersonneSollicitee(blocage.personne_sollicitee ?? '')
      setError(null)
    }
  }, [isOpen, blocage])

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isOpen,
  })

  const mutation = useMutation({
    mutationFn: (payload: any) => updateBlocage(blocage!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocage', blocage?.id] })
      queryClient.invalidateQueries({ queryKey: ['blocages'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast('Blocage mis à jour', 'success')
      onClose()
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.detail || 'Erreur lors de la modification',
        'error',
      )
      setError('Vérifiez les champs et réessayez.')
    },
  })

  if (!isOpen || !blocage) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (description.trim().length < 10) {
      setError('La description doit contenir au moins 10 caractères.')
      return
    }

    mutation.mutate({
      description: description.trim(),
      niveau_urgence: niveauUrgence,
      personne_sollicitee: personneSollicitee
        ? Number(personneSollicitee)
        : null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <h2 className="text-base font-semibold text-ink-900 mb-4">
          Modifier le blocage
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Description *
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-ink-200 rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500
                         focus:border-brand-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Niveau d'urgence"
              value={niveauUrgence}
              onChange={(e) => setNiveauUrgence(e.target.value)}
            >
              {URGENCES.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>

            <UserSelect
              users={utilisateurs}
              value={personneSollicitee}
              onChange={(id) => setPersonneSollicitee(id)}
              label="Personne sollicitée"
              placeholder="Optionnel"
              allowNone
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
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}