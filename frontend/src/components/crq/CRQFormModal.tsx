/**
 * Modale de création du CRQ du jour.
 */

import { FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { createCRQ } from '../../api/crq'
import { useToast } from '../../context/ToastContext'

interface CRQFormModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CRQFormModal({
  isOpen,
  onClose,
}: CRQFormModalProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [activitesRealisees, setActivitesRealisees] = useState('')
  const [activitesEnCours, setActivitesEnCours] = useState('')
  const [activitesNonRealisees, setActivitesNonRealisees] = useState('')
  const [difficultes, setDifficultes] = useState('')
  const [prevuesLendemain, setPrevuesLendemain] = useState('')
  const [error, setError] = useState<string | null>(null)

  const aujourdHui = new Date().toISOString().split('T')[0]

  const mutation = useMutation({
    mutationFn: createCRQ,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crqs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setActivitesRealisees('')
      setActivitesEnCours('')
      setActivitesNonRealisees('')
      setDifficultes('')
      setPrevuesLendemain('')
      setError(null)
      showToast('CRQ créé avec succès', 'success')
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      let msg = 'Erreur lors de la création du CRQ'
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

    const nonVide =
      activitesRealisees.trim() ||
      activitesEnCours.trim() ||
      activitesNonRealisees.trim() ||
      difficultes.trim() ||
      prevuesLendemain.trim()

    if (!nonVide) {
      setError('Renseignez au moins une rubrique.')
      return
    }

    mutation.mutate({
      date_journaliere: aujourdHui,
      activites_realisees: activitesRealisees.trim(),
      activites_en_cours: activitesEnCours.trim(),
      activites_non_realisees: activitesNonRealisees.trim(),
      difficultes: difficultes.trim(),
      prevues_lendemain: prevuesLendemain.trim(),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-ink-900">
            Mon compte-rendu du jour
          </h2>
          <p className="text-[12px] text-ink-500 mt-0.5 capitalize">
            {new Date(aujourdHui).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            {
              label: 'Activités réalisées',
              value: activitesRealisees,
              set: setActivitesRealisees,
            },
            {
              label: 'Activités en cours',
              value: activitesEnCours,
              set: setActivitesEnCours,
            },
            {
              label: 'Activités non réalisées',
              value: activitesNonRealisees,
              set: setActivitesNonRealisees,
            },
            {
              label: 'Difficultés rencontrées',
              value: difficultes,
              set: setDifficultes,
            },
            {
              label: 'Activités prévues pour demain',
              value: prevuesLendemain,
              set: setPrevuesLendemain,
            },
          ].map((rub) => (
            <div key={rub.label}>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                {rub.label}
              </label>
              <textarea
                rows={2}
                value={rub.value}
                onChange={(e) => rub.set(e.target.value)}
                className="w-full px-3 py-2 border border-ink-200 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500
                           focus:border-brand-400 transition-colors"
              />
            </div>
          ))}

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