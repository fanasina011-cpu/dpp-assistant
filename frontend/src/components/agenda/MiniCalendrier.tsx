/**
 * Mini calendrier compact — navigation rapide.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  NOMS_JOURS_COURTS,
  NOMS_MOIS,
  construireGrilleMois,
  estDansMois,
  formatDateISO,
  memeJour,
} from '../../utils/calendrier'
import type { Evenement } from '../../types'

interface MiniCalendrierProps {
  annee: number
  mois: number
  selectedDate: Date
  evenements: Evenement[]
  onJourClick: (date: Date) => void
  onMoisChange: (annee: number, mois: number) => void
}

export default function MiniCalendrier({
  annee,
  mois,
  selectedDate,
  evenements,
  onJourClick,
  onMoisChange,
}: MiniCalendrierProps) {
  const jours = construireGrilleMois(annee, mois)
  const aujourdHui = new Date()

  const joursAvecEvents = new Set(
    evenements.map((e) => e.date_debut.slice(0, 10)),
  )

  const moisPrecedent = () => {
    if (mois === 0) onMoisChange(annee - 1, 11)
    else onMoisChange(annee, mois - 1)
  }

  const moisSuivant = () => {
    if (mois === 11) onMoisChange(annee + 1, 0)
    else onMoisChange(annee, mois + 1)
  }

  return (
    <div className="bg-white rounded-lg border border-ink-200 p-3">
      {/* Navigation mois */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={moisPrecedent}
          className="w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-800 transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-[11px] font-semibold text-ink-900">
          {NOMS_MOIS[mois].slice(0, 4)} {annee}
        </span>
        <button
          type="button"
          onClick={moisSuivant}
          className="w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-800 transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* En-tête jours */}
      <div className="grid grid-cols-7 mb-1">
        {NOMS_JOURS_COURTS.map((j) => (
          <div
            key={j}
            className="text-center text-[9px] font-semibold text-ink-400 uppercase"
          >
            {j.charAt(0)}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-0.5">
        {jours.map((date, idx) => {
          const dateISO = formatDateISO(date)
          const dansMois = estDansMois(date, annee, mois)
          const estAujourdHui = memeJour(date, aujourdHui)
          const estSelectionne = memeJour(date, selectedDate)
          const aEvents = joursAvecEvents.has(dateISO)

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onJourClick(date)}
              className={`relative aspect-square flex items-center justify-center text-[10px] font-medium rounded transition-colors ${
                estAujourdHui
                  ? 'bg-brand-500 text-white'
                  : estSelectionne
                    ? 'bg-brand-100 text-brand-700'
                    : dansMois
                      ? 'text-ink-700 hover:bg-ink-100'
                      : 'text-ink-300 hover:bg-ink-50'
              }`}
            >
              {date.getDate()}
              {aEvents && !estAujourdHui && !estSelectionne && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}