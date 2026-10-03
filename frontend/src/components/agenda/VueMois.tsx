/**
 * Grille mensuelle épurée — version moderne.
 * Pas de bordure lourde, points colorés sous les numéros.
 */

import type { Evenement } from '../../types'
import {
  NOMS_JOURS_COURTS,
  construireGrilleMois,
  estDansMois,
  formatDateISO,
  memeJour,
} from '../../utils/calendrier'

interface VueMoisProps {
  annee: number
  mois: number
  evenements: Evenement[]
  selectedDate: Date | null
  onJourClick: (date: Date) => void
}

export default function VueMois({
  annee,
  mois,
  evenements,
  selectedDate,
  onJourClick,
}: VueMoisProps) {
  const jours = construireGrilleMois(annee, mois)
  const aujourdHui = new Date()

  // Regrouper les événements par jour
  const eventsParJour: Record<string, Evenement[]> = {}
  for (const evt of evenements) {
    const key = evt.date_debut.slice(0, 10)
    if (!eventsParJour[key]) eventsParJour[key] = []
    eventsParJour[key].push(evt)
  }

  return (
    <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
      {/* En-tête des jours */}
      <div className="grid grid-cols-7 border-b border-ink-100">
        {NOMS_JOURS_COURTS.map((jour) => (
          <div
            key={jour}
            className="px-2 py-2.5 text-center text-[10px] font-semibold text-ink-400 uppercase tracking-widest"
          >
            {jour}
          </div>
        ))}
      </div>

      {/* Grille 6 semaines */}
      <div className="grid grid-cols-7">
        {jours.map((date, idx) => {
          const dateISO = formatDateISO(date)
          const events = eventsParJour[dateISO] || []
          const dansMois = estDansMois(date, annee, mois)
          const estAujourdHui = memeJour(date, aujourdHui)
          const estSelectionne = selectedDate && memeJour(date, selectedDate)

          // Compter par type
          const directionCount = events.filter(
            (e) => e.niveau_priorite === 'DIRECTION',
          ).length
          const personnelCount = events.length - directionCount

          return (
            <button
              key={idx}
              onClick={() => onJourClick(date)}
              className={`relative min-h-[92px] border-b border-r border-ink-100 p-2 text-left transition-colors group ${
                !dansMois ? 'bg-ink-50/40' : 'hover:bg-ink-50/60'
              } ${estSelectionne ? 'bg-brand-50/60' : ''}`}
            >
              {/* Numéro du jour */}
              <div className="flex items-start justify-between gap-1">
                <span
                  className={`inline-flex items-center justify-center text-[12px] font-medium leading-none transition-colors ${
                    estAujourdHui
                      ? 'w-6 h-6 rounded-full bg-brand-500 text-white -ml-0.5 -mt-0.5'
                      : dansMois
                        ? 'text-ink-800'
                        : 'text-ink-300'
                  }`}
                >
                  {date.getDate()}
                </span>

                {events.length > 0 && (
                  <span className="text-[9px] font-semibold text-ink-400 tabular-nums">
                    {events.length}
                  </span>
                )}
              </div>

              {/* Points colorés (max 4) */}
              {events.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {Array.from({
                    length: Math.min(directionCount, 4),
                  }).map((_, i) => (
                    <span
                      key={`d-${i}`}
                      className="w-1.5 h-1.5 rounded-full bg-danger"
                    />
                  ))}
                  {Array.from({
                    length: Math.min(personnelCount, 4 - directionCount),
                  }).map((_, i) => (
                    <span
                      key={`p-${i}`}
                      className="w-1.5 h-1.5 rounded-full bg-info"
                    />
                  ))}
                </div>
              )}

              {/* Titre du 1er événement (au survol ou si peu de place) */}
              {events.length === 1 && (
                <div
                  className={`text-[10px] mt-1.5 truncate leading-tight ${
                    events[0].niveau_priorite === 'DIRECTION'
                      ? 'text-danger'
                      : 'text-info'
                  }`}
                  title={events[0].titre}
                >
                  {events[0].titre}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-ink-100 bg-ink-50/40">
        <span className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
          Légende
        </span>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-600">
          <span className="w-1.5 h-1.5 rounded-full bg-danger" />
          Direction
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-600">
          <span className="w-1.5 h-1.5 rounded-full bg-info" />
          Personnel
        </div>
      </div>
    </div>
  )
}