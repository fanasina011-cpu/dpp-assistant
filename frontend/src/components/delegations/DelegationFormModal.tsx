/**
 * Modale de création d'une délégation temporaire de rôle.
 */

import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { createDelegation } from '../../api/delegations'
import { fetchUtilisateurs } from '../../api/utilisateurs'
import { useToast } from '../../context/ToastContext'
import type { Role } from '../../types'
import UserSelect from '../ui/UserSelect'

interface DelegationFormModalProps {
  isOpen: boolean
  onClose: () => void
}

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'CHEF_SERVICE_PROJETS', label: 'Chef Service Projets' },
  { value: 'CHEF_SERVICE_PARTENARIATS', label: 'Chef Service Partenariats' },
  { value: 'CONSEILLERE_TECHNIQUE', label: 'Conseillère Technique' },
  { value: 'SECRETAIRE_DIRECTION', label: 'Secrétaire de Direction' },
]

export default function DelegationFormModal({
  isOpen,
  onClose,
}: DelegationFormModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [delegataireId, setDelegataireId] = useState<number | ''>('')
  const [roleDelegue, setRoleDelegue] = useState<Role>('CHEF_SERVICE_PROJETS')
  const [service, setService] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: utilisateurs = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: fetchUtilisateurs,
    enabled: isOpen,
  })

  const mutation = useMutation({
    mutationFn: createDelegation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDelegataireId('')
      setRoleDelegue('CHEF_SERVICE_PROJETS')
      setService('')
      setDateDebut('')
      setDateFin('')
      setError(null)
      showToast('Délégation créée avec succès', 'success')
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      let msg = 'Erreur lors de la création'
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

    if (!delegataireId) {
      setError('Vous devez sélectionner un délégataire.')
      return
    }
    if (!dateDebut || !dateFin) {
      setError('Les dates de début et de fin sont obligatoires.')
      return
    }
    if (new Date(dateFin) <= new Date(dateDebut)) {
      setError('La date de fin doit être postérieure à la date de début.')
      return
    }

    mutation.mutate({
      delegataire: Number(delegataireId),
      role_delegue: roleDelegue,
      service: service.trim() || null,
      date_debut: dateDebut,
      date_fin: dateFin,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <h2 className="text-base font-semibold text-ink-900 mb-4">
          Nouvelle délégation
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <UserSelect
            users={utilisateurs}
            value={delegataireId}
            onChange={(id) => setDelegataireId(id)}
            label="Délégataire *"
            placeholder="Sélectionner un utilisateur"
          />

          <Select
            label="Rôle délégué *"
            value={roleDelegue}
            onChange={(e) => setRoleDelegue(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>

          <Input
            label="Service (optionnel)"
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="Ex : Projets, Partenariats"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date de début *"
              type="datetime-local"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
            <Input
              label="Date de fin *"
              type="datetime-local"
              required
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
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
              {mutation.isPending ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}