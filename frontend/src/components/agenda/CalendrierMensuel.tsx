/**
 * Grille mensuelle 7×6 avec événements.
 */

import type { Evenement } from '../../types'
import {
  NOMS_JOURS_COURTS,
  construireGrilleMois,
  estDansMois,
  formatDateISO,
  memeJour,
} from '../../utils/calendrier'

interface CalendrierMensuelProps {
  annee: number
  mois: number
  evenements: Evenement[]
  onJourClick: (date: Date) => void
  onEvenementClick: (evenement: Evenement) => void
}

export default function CalendrierMensuel({
  annee,
  mois,
  evenements,
  onJourClick,
  onEvenementClick,
}: CalendrierMensuelProps) {
  const jours = construireGrilleMois(annee, mois)
  const aujourdHui = new Date()

  // Regrouper les événements par jour (clé = YYYY-MM-DD)
  const eventsParJour: Record<string, Evenement[]> = {}
  for (const evt of evenements) {
    const key = evt.date_debut.slice(0, 10)
    if (!eventsParJour[key]) eventsParJour[key] = []
    eventsParJour[key].push(evt)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* En-tête des jours */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {NOMS_JOURS_COURTS.map((jour) => (
          <div
            key={jour}
            className="px-2 py-2 text-center text-xs font-medium text-slate-500
                       uppercase tracking-wider"
          >
            {jour}
          </div>
        ))}
      </div>

      {/* Grille 6 semaines */}
      <div className="grid grid-cols-7 grid-rows-6">
        {jours.map((date, idx) => {
          const dateISO = formatDateISO(date)
          const events = eventsParJour[dateISO] || []
          const dansMois = estDansMois(date, annee, mois)
          const estAujourdHui = memeJour(date, aujourdHui)

          return (
            <button
              key={idx}
              onClick={() => onJourClick(date)}
              className={`min-h-[100px] border-r border-b border-slate-100
                          p-1 text-left hover:bg-blue-50/40 transition-colors
                          ${!dansMois ? 'bg-slate-50/60' : ''}`}
            >
              <div
                className={`text-xs font-medium mb-1 ${
                  estAujourdHui
                    ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center'
                    : dansMois
                    ? 'text-slate-700'
                    : 'text-slate-300'
                }`}
              >
                {date.getDate()}
              </div>

              <div className="space-y-0.5">
                {events.slice(0, 2).map((evt) => (
                  <div
                    key={evt.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEvenementClick(evt)
                    }}
                    className={`text-[10px] px-1 py-0.5 rounded truncate
                                cursor-pointer ${
                                  evt.niveau_priorite === 'DIRECTION'
                                    ? 'bg-red-100 text-red-700 border-l-2 border-red-500'
                                    : 'bg-blue-100 text-blue-700 border-l-2 border-blue-400'
                                }`}
                    title={evt.titre}
                  >
                    {evt.titre}
                  </div>
                ))}
                {events.length > 2 && (
                  <div className="text-[10px] text-slate-400 pl-1">
                    +{events.length - 2} autres
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}