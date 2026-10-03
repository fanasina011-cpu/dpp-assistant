/**
 * Modale de signalement d'un blocage.
 * Peut être ouverte depuis la liste ou depuis le détail d'une tâche.
 */

import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Select from '../ui/Select'
import EntitySelect from '../ui/EntitySelect'
import StatutBadge from '../StatutBadge'
import { createBlocage } from '../../api/blocages'
import { fetchTache, fetchTaches } from '../../api/taches'
import { fetchUtilisateurs } from '../../api/utilisateurs'
import { useToast } from '../../context/ToastContext'
import UserSelect from '../ui/UserSelect'


interface BlocageFormModalProps {
  isOpen: boolean
  onClose: () => void
  tacheId?: number
}

const URGENCES = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'MOYENNE', label: 'Moyenne' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'CRITIQUE', label: 'Critique' },
]

export default function BlocageFormModal({
  isOpen,
  onClose,
  tacheId,
}: BlocageFormModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
    // Récupère la tâche pré-sélectionnée (pour afficher son titre)
  const { data: tachePreSelectionnee } = useQuery({
    queryKey: ['tache', tacheId],
    queryFn: () => fetchTache(tacheId!),
    enabled: isOpen && Boolean(tacheId),
  })

  const [description, setDescription] = useState('')
  const [niveauUrgence, setNiveauUrgence] = useState('MOYENNE')
  const [selectedTache, setSelectedTache] = useState<number | ''>('')
  const [personneSollicitee, setPersonneSollicitee] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (tacheId) {
      setSelectedTache(tacheId)
    } else {
      setSelectedTache('')
    }
    setDescription('')
    setNiveauUrgence('MOYENNE')
    setPersonneSollicitee('')
    setError(null)
  }, [tacheId, isOpen])

  const { data: taches = [] } = useQuery({
    queryKey: ['taches'],
    queryFn: () => fetchTaches(),
    enabled: isOpen && !tacheId,
  })

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isOpen,
  })

  const mutation = useMutation({
    mutationFn: createBlocage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocages'] })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (tacheId) {
        queryClient.invalidateQueries({ queryKey: ['tache', tacheId] })
      }
      showToast('Blocage signalé avec succès', 'success')
      onClose()
    },
    onError: () => {
      showToast('Erreur lors du signalement', 'error')
      setError('Vérifiez les champs et réessayez.')
    },
  })

  if (!isOpen) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (description.trim().length < 10) {
      setError('La description doit contenir au moins 10 caractères.')
      return
    }
    if (!selectedTache) {
      setError('Vous devez sélectionner une tâche.')
      return
    }

    mutation.mutate({
      description: description.trim(),
      niveau_urgence: niveauUrgence,
      tache: Number(selectedTache),
      personne_sollicitee: personneSollicitee
        ? Number(personneSollicitee)
        : null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <h2 className="text-base font-semibold text-ink-900 mb-4">
          Signaler un blocage
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tâche concernée */}
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Tâche concernée *
            </label>
            {tacheId ? (
              <div className="px-3 py-2 bg-ink-50 border border-ink-200 rounded-md flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink-900 truncate">
                    {tachePreSelectionnee?.titre || `Tâche #${tacheId}`}
                  </div>
                  <div className="text-[10px] text-ink-500">
                    #{tacheId}
                    {tachePreSelectionnee && ` · ${tachePreSelectionnee.statut_display}`}
                  </div>
                </div>
                {tachePreSelectionnee && (
                  <StatutBadge
                    statut={tachePreSelectionnee.statut}
                    statutDisplay={tachePreSelectionnee.statut_display}
                  />
                )}
              </div>
            ) : (
              <EntitySelect
                items={taches.map((t) => ({
                  id: t.id,
                  label: t.titre,
                  subtitle: `#${t.id} · ${t.statut_display}`,
                  badge: (
                    <StatutBadge
                      statut={t.statut}
                      statutDisplay={t.statut_display}
                    />
                  ),
                  searchText: t.description,
                  filterValues: { statut: t.statut },
                }))}
                value={selectedTache}
                onChange={(id) => setSelectedTache(id)}
                placeholder="Sélectionner la tâche concernée"
                filters={[
                  {
                    key: 'statut',
                    label: 'Tous les statuts',
                    options: [
                      { value: 'A_FAIRE', label: 'À faire' },
                      { value: 'EN_COURS', label: 'En cours' },
                      { value: 'EN_ATTENTE', label: 'En attente' },
                      { value: 'BLOQUEE', label: 'Bloquée' },
                    ],
                  },
                ]}
              />
            )}
          </div>

          {/* Description */}
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
              placeholder="Décrivez le problème rencontré (min. 10 caractères)"
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
            <Button
              type="submit"
              variant="danger"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Signalement...' : 'Signaler'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}