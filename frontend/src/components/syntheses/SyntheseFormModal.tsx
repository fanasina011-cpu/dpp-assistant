/**
 * Modale de génération d'une synthèse.
 */

import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { genererSynthese } from '../../api/syntheses'
import { useToast } from '../../context/ToastContext'
import type { TypeSynthese } from '../../types'

interface SyntheseFormModalProps {
  isOpen: boolean
  onClose: () => void
}

const TYPES: Array<{ value: TypeSynthese; label: string }> = [
  { value: 'QUOTIDIENNE', label: 'Quotidienne' },
  { value: 'HEBDOMADAIRE', label: 'Hebdomadaire' },
  { value: 'MENSUELLE', label: 'Mensuelle' },
]

function calculerPeriode(type: TypeSynthese): { debut: string; fin: string } {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  if (type === 'QUOTIDIENNE') {
    return { debut: fmt(today), fin: fmt(today) }
  }

  if (type === 'HEBDOMADAIRE') {
    const day = today.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const lundi = new Date(today)
    lundi.setDate(today.getDate() + diffToMonday)
    const dimanche = new Date(lundi)
    dimanche.setDate(lundi.getDate() + 6)
    return { debut: fmt(lundi), fin: fmt(dimanche) }
  }

  const premier = new Date(today.getFullYear(), today.getMonth(), 1)
  const dernier = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { debut: fmt(premier), fin: fmt(dernier) }
}

export default function SyntheseFormModal({
  isOpen,
  onClose,
}: SyntheseFormModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [type, setType] = useState<TypeSynthese>('HEBDOMADAIRE')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const periode = calculerPeriode(type)
      setDateDebut(periode.debut)
      setDateFin(periode.fin)
    }
  }, [type, isOpen])

  const mutation = useMutation({
    mutationFn: genererSynthese,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syntheses'] })
      setError(null)
      showToast('Synthèse générée avec succès', 'success')
      onClose()
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail || 'Erreur lors de la génération'
      showToast(msg, 'error')
      setError('Vérifiez les dates et réessayez.')
    },
  })

  if (!isOpen) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!dateDebut || !dateFin) {
      setError('Les dates sont obligatoires.')
      return
    }
    if (new Date(dateFin) < new Date(dateDebut)) {
      setError('La date de fin doit être postérieure à la date de début.')
      return
    }

    mutation.mutate({
      type,
      periode_debut: dateDebut,
      periode_fin: dateFin,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <h2 className="text-base font-semibold text-ink-900 mb-4">
          Générer une synthèse
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Type *"
            value={type}
            onChange={(e) => setType(e.target.value as TypeSynthese)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Début *"
              type="date"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
            <Input
              label="Fin *"
              type="date"
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
              {mutation.isPending ? 'Génération...' : 'Générer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}