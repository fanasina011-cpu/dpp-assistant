/**
 * Vue semaine — grille horaire 7 jours.
 * Clic sur zone vide → créer un événement à cette heure.
 */

import type { Evenement } from '../../types'
import {
  NOMS_JOURS_LONGS,
  formatDateISO,
  formatHeure,
  getJoursSemaine,
  getMinutesFromMidnight,
  memeJour,
} from '../../utils/calendrier'
import { Calendar } from 'lucide-react'
import EmptyState from '../ui/EmptyState'

const HEURE_DEBUT = 8
const HEURE_FIN = 18
const HAUTEUR_HEURE = 56

interface VueSemaineProps {
  dateReference: Date
  evenements: Evenement[]
  onEvenementClick: (evt: Evenement) => void
  onJourClick: (date: Date) => void
  onSlotClick?: (date: Date) => void
}

export default function VueSemaine({
  dateReference,
  evenements,
  onEvenementClick,
  onJourClick,
  onSlotClick,
}: VueSemaineProps) {
  const jours = getJoursSemaine(dateReference)
  const aujourdHui = new Date()
  const heures = Array.from(
    { length: HEURE_FIN - HEURE_DEBUT },
    (_, i) => HEURE_DEBUT + i,
  )

  const eventsParJour: Record<string, Evenement[]> = {}
  for (const evt of evenements) {
    const key = evt.date_debut.slice(0, 10)
    if (!eventsParJour[key]) eventsParJour[key] = []
    eventsParJour[key].push(evt)
  }

  return (
    <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
      {/* En-tête jours */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-ink-100 sticky top-0 bg-white z-10">
        <div className="border-r border-ink-100" />
        {jours.map((date, idx) => {
          const estAujourdHui = memeJour(date, aujourdHui)
          return (
            <button
              key={idx}
              onClick={() => onJourClick(date)}
              className="px-2 py-2 border-r border-ink-100 last:border-r-0 hover:bg-ink-50/60 transition-colors text-center"
            >
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
                {NOMS_JOURS_LONGS[idx].slice(0, 3)}
              </div>
              <div
                className={`text-[16px] font-semibold mt-0.5 inline-flex items-center justify-center ${
                  estAujourdHui
                    ? 'w-7 h-7 rounded-full bg-brand-500 text-white'
                    : 'text-ink-900'
                }`}
              >
                {date.getDate()}
              </div>
            </button>
          )
        })}
      </div>

      {/* Corps grille */}
      <div className="relative max-h-[600px] overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {evenements.length === 0 && (
            <div className="col-span-8 py-12">
              <EmptyState
                title="Aucun événement cette semaine"
                description="Cliquez sur une case vide pour créer un événement."
                icon={<Calendar size={28} strokeWidth={1.5} />}
              />
            </div>
          )}
          {/* Colonne heures */}
          <div className="border-r border-ink-100">
            {heures.map((h) => (
              <div
                key={h}
                className="border-b border-ink-100 text-[10px] text-ink-400 tabular-nums pr-2 text-right"
                style={{ height: HAUTEUR_HEURE }}
              >
                <span className="inline-block -mt-1.5">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Colonnes jours */}
          {jours.map((date, jourIdx) => {
            const dateISO = formatDateISO(date)
            const events = eventsParJour[dateISO] || []
            const estAujourdHui = memeJour(date, aujourdHui)

            return (
              <div
                key={jourIdx}
                className={`relative border-r border-ink-100 last:border-r-0 ${
                  estAujourdHui ? 'bg-brand-50/20' : ''
                }`}
              >
                {/* Slots horaires cliquables */}
                {heures.map((h) => (
                  <div
                    key={h}
                    onClick={() =>
                      onSlotClick?.(
                        new Date(
                          date.getFullYear(),
                          date.getMonth(),
                          date.getDate(),
                          h,
                          0,
                        ),
                      )
                    }
                    role="button"
                    tabIndex={0}
                    aria-label={`Créer un événement à ${h}h le ${date.getDate()}`}
                    className="border-b border-ink-100 hover:bg-brand-50/60 transition-colors cursor-pointer group/slot relative"
                    style={{ height: HAUTEUR_HEURE }}
                  >
                    {/* Petit + au survol */}
                    <span className="absolute top-1 left-1 text-[9px] font-semibold text-brand-500 opacity-0 group-hover/slot:opacity-100 transition-opacity pointer-events-none">
                      +
                    </span>
                  </div>
                ))}

                {/* Événements positionnés */}
                {events.map((evt) => {
                  const startMin = getMinutesFromMidnight(evt.date_debut)
                  const endMin = getMinutesFromMidnight(evt.date_fin)
                  const top =
                    ((startMin - HEURE_DEBUT * 60) / 60) * HAUTEUR_HEURE
                  const height = Math.max(
                    24,
                    ((endMin - startMin) / 60) * HAUTEUR_HEURE - 2,
                  )

                  if (startMin < HEURE_DEBUT * 60) return null

                  const isDirection = evt.niveau_priorite === 'DIRECTION'
                  return (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEvenementClick(evt)
                      }}
                      className={`absolute left-1 right-1 rounded-md px-1.5 py-1 text-left text-[10px] leading-tight overflow-hidden transition-all hover:z-20 hover:shadow-md ${
                        isDirection
                          ? 'bg-danger-bg border border-danger-border text-danger'
                          : 'bg-info-bg border border-info-border text-info'
                      }`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      title={evt.titre}
                    >
                      <div className="font-semibold truncate">
                        {formatHeure(evt.date_debut)} {evt.titre}
                      </div>
                      {height > 40 && evt.participants_detail.length > 0 && (
                        <div className="truncate opacity-80">
                          {evt.participants_detail.length} participant
                          {evt.participants_detail.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Aide */}
      {onSlotClick && (
        <div className="px-4 py-2 border-t border-ink-100 bg-ink-50/40 text-[10px] text-ink-500">
          Cliquez sur une case vide pour créer un événement à cette heure.
        </div>
      )}
    </div>
  )
}