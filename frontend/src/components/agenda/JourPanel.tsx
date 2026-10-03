/**
 * Panneau latéral d'un jour — timeline verticale.
 */

import { CalendarX, Clock, Users } from 'lucide-react'
import type { Evenement } from '../../types'
import { formatHeure } from '../../utils/calendrier'

interface JourPanelProps {
  date: Date
  evenements: Evenement[]
  onEvenementClick: (evt: Evenement) => void
}

export default function JourPanel({
  date,
  evenements,
  onEvenementClick,
}: JourPanelProps) {
  const trie = [...evenements].sort(
    (a, b) =>
      new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime(),
  )

  return (
    <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
      {/* En-tête */}
      <div className="px-4 py-3 border-b border-ink-100">
        <p className="text-[10px] uppercase tracking-widest text-ink-400 font-semibold">
          {date.toLocaleDateString('fr-FR', { weekday: 'long' })}
        </p>
        <p className="text-[18px] font-semibold text-ink-900 leading-tight mt-0.5 capitalize">
          {date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
          })}
        </p>
        {evenements.length > 0 && (
          <p className="text-[11px] text-ink-500 mt-1">
            {evenements.length} événement{evenements.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Liste */}
      {trie.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-ink-400">
          <CalendarX size={32} strokeWidth={1.25} />
          <p className="text-[12px]">Aucun événement</p>
        </div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {trie.map((evt) => {
            const isDirection = evt.niveau_priorite === 'DIRECTION'
            const accentColor = isDirection ? 'bg-danger' : 'bg-info'
            return (
              <li key={evt.id}>
                <button
                  type="button"
                  onClick={() => onEvenementClick(evt)}
                  className="w-full text-left flex gap-3 px-4 py-3 hover:bg-ink-50/60 transition-colors group"
                >
                  {/* Barre verticale colorée */}
                  <span
                    className={`w-0.5 rounded-full shrink-0 self-stretch ${accentColor}`}
                  />

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] text-ink-400 font-medium tabular-nums mb-0.5">
                      <Clock size={10} />
                      {formatHeure(evt.date_debut)}
                      {' – '}
                      {formatHeure(evt.date_fin)}
                    </div>

                    <div
                      className={`text-[12.5px] font-medium leading-snug ${
                        isDirection
                          ? 'text-ink-900'
                          : 'text-ink-800'
                      } group-hover:text-brand-600 transition-colors line-clamp-2`}
                    >
                      {evt.titre}
                    </div>

                    {evt.participants_detail.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-ink-500 mt-1">
                        <Users size={10} />
                        {evt.participants_detail.length} participant
                        {evt.participants_detail.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}