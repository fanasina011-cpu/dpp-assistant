/**
 * Modale de création ET d'édition d'une instruction.
 * Avec ciblage (aucune/tâche/activité) + destinataires multiples.
 */

import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Select from '../ui/Select'
import EntitySelect from '../ui/EntitySelect'
import {
  createInstruction,
  updateInstruction,
} from '../../api/instructions'
import { fetchUtilisateurs } from '../../api/utilisateurs'
import { fetchTaches } from '../../api/taches'
import { fetchActivites } from '../../api/activites'
import { useToast } from '../../context/ToastContext'
import type { Instruction, Priorite } from '../../types'
import UserMultiSelect from '../ui/UserMultiSelect'
import StatutBadge from '../StatutBadge'

interface InstructionFormModalProps {
  isOpen: boolean
  onClose: () => void
  instruction?: Instruction | null
}

const PRIORITES: Array<{ value: Priorite; label: string }> = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
]

type CibleType = 'AUCUNE' | 'TACHE' | 'ACTIVITE'

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function InstructionFormModal({
  isOpen,
  onClose,
  instruction = null,
}: InstructionFormModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const isEdition = Boolean(instruction)

  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [priorite, setPriorite] = useState<Priorite>('NORMALE')
  const [dateEcheance, setDateEcheance] = useState('')
  const [cibleType, setCibleType] = useState<CibleType>('AUCUNE')
  const [tacheCible, setTacheCible] = useState<number | ''>('')
  const [activiteCible, setActiviteCible] = useState<number | ''>('')
  const [destinataireIds, setDestinataireIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (instruction) {
      setTitre(instruction.titre)
      setDescription(instruction.description || '')
      setPriorite(instruction.priorite)
      setDateEcheance(toDatetimeLocal(instruction.date_echeance))
      setCibleType(instruction.cible_type as CibleType)
      setTacheCible(instruction.tache_cible || '')
      setActiviteCible(instruction.activite_cible || '')
      setDestinataireIds(
        instruction.destinataires.map((d) => d.destinataire),
      )
    } else {
      setTitre('')
      setDescription('')
      setPriorite('NORMALE')
      setDateEcheance('')
      setCibleType('AUCUNE')
      setTacheCible('')
      setActiviteCible('')
      setDestinataireIds([])
    }
  
    setError(null)
  }, [isOpen, instruction])

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isOpen,
  })

  const { data: taches = [] } = useQuery({
    queryKey: ['taches'],
    queryFn: () => fetchTaches(),
    enabled: isOpen && cibleType === 'TACHE',
  })

  const { data: activites = [] } = useQuery({
    queryKey: ['activites'],
    queryFn: () => fetchActivites(),
    enabled: isOpen && cibleType === 'ACTIVITE',
  })

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      isEdition
        ? updateInstruction(instruction!.id, payload)
        : createInstruction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (instruction) {
        queryClient.invalidateQueries({
          queryKey: ['instruction', instruction.id],
        })
      }
      showToast(
        isEdition
          ? 'Instruction modifiée avec succès'
          : 'Instruction émise avec succès',
        'success',
      )
      onClose()
    },
    onError: () => {
      showToast(
        isEdition
          ? 'Erreur lors de la modification'
          : "Erreur lors de l'émission",
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
    if (description.trim().length < 5) {
      setError('La description est obligatoire.')
      return
    }
    if (destinataireIds.length === 0) {
      setError('Sélectionnez au moins un destinataire.')
      return
    }
    if (cibleType === 'TACHE' && !tacheCible) {
      setError('Sélectionnez une tâche cible.')
      return
    }
    if (cibleType === 'ACTIVITE' && !activiteCible) {
      setError('Sélectionnez une activité cible.')
      return
    }

    mutation.mutate({
      titre: titre.trim(),
      description: description.trim(),
      priorite,
      date_echeance: dateEcheance || null,
      tache_cible: cibleType === 'TACHE' ? Number(tacheCible) : null,
      activite_cible: cibleType === 'ACTIVITE' ? Number(activiteCible) : null,
      destinataire_ids: destinataireIds,
    })
  }



  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <h2 className="text-base font-semibold text-ink-900 mb-4">
          {isEdition ? "Modifier l'instruction" : 'Nouvelle instruction'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Titre *"
            type="text"
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre de l'instruction"
          />

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Description *
            </label>
            <textarea
              rows={3}
              required
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
              label="Échéance"
              type="datetime-local"
              value={dateEcheance}
              onChange={(e) => setDateEcheance(e.target.value)}
            />
          </div>

          {/* Ciblage */}
          <div className="border-t border-ink-100 pt-4">
            <label className="block text-sm font-medium text-ink-700 mb-2">
              Cible (optionnel)
            </label>
            <div className="flex gap-4 mb-4 flex-wrap">
              {(
                [
                  { value: 'AUCUNE', label: 'Aucune (générale)' },
                  { value: 'TACHE', label: 'Tâche' },
                  { value: 'ACTIVITE', label: 'Activité' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-[13px] cursor-pointer"
                >
                  <input
                    type="radio"
                    checked={cibleType === opt.value}
                    onChange={() => setCibleType(opt.value)}
                    className="accent-brand-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {cibleType === 'TACHE' && (
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
                value={tacheCible}
                onChange={(id) => setTacheCible(id)}
                placeholder="Sélectionner une tâche"
                allowNone
                noneLabel="Aucune tâche"
                filters={[
                  {
                    key: 'statut',
                    label: 'Tous les statuts',
                    options: [
                      { value: 'A_FAIRE', label: 'À faire' },
                      { value: 'EN_COURS', label: 'En cours' },
                      { value: 'EN_ATTENTE', label: 'En attente' },
                      { value: 'BLOQUEE', label: 'Bloquée' },
                      { value: 'TERMINEE', label: 'Terminée' },
                    ],
                  },
                ]}
              />
            )}

            {cibleType === 'ACTIVITE' && (
                <EntitySelect
                items={activites.map((a) => ({
                  id: a.id,
                  label: a.titre,
                  subtitle: `${a.statut_display} · ${a.priorite_display}`,
                  badge: (
                    <StatutBadge
                      statut={a.statut}
                      statutDisplay={a.statut_display}
                    />
                  ),
                  searchText: a.description,
                  filterValues: { statut: a.statut },
                }))}
                value={activiteCible}
                onChange={(id) => setActiviteCible(id)}
                placeholder="Sélectionner une activité"
                allowNone
                noneLabel="Aucune activité"
                filters={[
                  {
                    key: 'statut',
                    label: 'Tous les statuts',
                    options: [
                      { value: 'OUVERTE', label: 'Ouverte' },
                      { value: 'EN_COURS', label: 'En cours' },
                      { value: 'CLOTUREE', label: 'Clôturée' },
                      { value: 'ANNULEE', label: 'Annulée' },
                    ],
                  },
                ]}
              />
            )}
          </div>

                    {/* Destinataires */}
          <div className="border-t border-ink-100 pt-4">
            <UserMultiSelect
              users={utilisateurs}
              value={destinataireIds}
              onChange={setDestinataireIds}
              label="Destinataires *"
              placeholder="Sélectionner des destinataires"
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
                ? isEdition
                  ? 'Enregistrement...'
                  : 'Émission...'
                : isEdition
                  ? 'Enregistrer'
                  : 'Émettre'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}