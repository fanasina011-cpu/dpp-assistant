/**
 * Vue jour — timeline verticale pleine largeur.
 */

import { CalendarX, Users } from 'lucide-react'
import type { Evenement } from '../../types'
import { formatHeure, memeJour } from '../../utils/calendrier'

interface VueJourProps {
  date: Date
  evenements: Evenement[]
  onEvenementClick: (evt: Evenement) => void
}

export default function VueJour({
  date,
  evenements,
  onEvenementClick,
}: VueJourProps) {
  // Filtre uniquement les événements du jour affiché
  const evenementsJour = evenements.filter((evt) =>
    memeJour(new Date(evt.date_debut), date),
  )

  const trie = [...evenementsJour].sort(
    (a, b) =>
      new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime(),
  )

  return (
    <div className="bg-white rounded-lg border border-ink-200 overflow-hidden">
      {/* En-tête */}
      <div className="px-6 py-4 border-b border-ink-100 bg-ink-50/40">
        <p className="text-[10px] uppercase tracking-widest text-ink-400 font-semibold">
          {date.toLocaleDateString('fr-FR', { weekday: 'long' })}
        </p>
        <h2 className="text-[22px] font-semibold text-ink-900 leading-tight mt-0.5 capitalize">
          {date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </h2>
        {evenementsJour.length > 0 && (
          <p className="text-[12px] text-ink-500 mt-1">
            {evenementsJour.length} événement
            {evenementsJour.length > 1 ? 's' : ''} planifié
            {evenementsJour.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Liste */}
      {trie.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-ink-400">
          <CalendarX size={40} strokeWidth={1.25} />
          <p className="text-[13px]">Aucun événement ce jour.</p>
        </div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {trie.map((evt) => {
            const isDirection = evt.niveau_priorite === 'DIRECTION'
            const accent = isDirection
              ? 'bg-danger'
              : 'bg-info'
            return (
              <li key={evt.id}>
                <button
                  type="button"
                  onClick={() => onEvenementClick(evt)}
                  className="w-full text-left flex gap-5 px-6 py-4 hover:bg-ink-50/60 transition-colors group"
                >
                  {/* Heure à gauche */}
                  <div className="w-20 shrink-0 pt-0.5">
                    <div className="text-[14px] font-semibold text-ink-900 tabular-nums">
                      {formatHeure(evt.date_debut)}
                    </div>
                    <div className="text-[11px] text-ink-400 tabular-nums">
                      → {formatHeure(evt.date_fin)}
                    </div>
                  </div>

                  {/* Barre verticale */}
                  <span
                    className={`w-1 rounded-full shrink-0 self-stretch ${accent}`}
                  />

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-[14px] font-semibold text-ink-900 group-hover:text-brand-600 transition-colors">
                        {evt.titre}
                      </h3>
                      <span
                        className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                          isDirection
                            ? 'bg-danger-bg text-danger border-danger-border'
                            : 'bg-info-bg text-info border-info-border'
                        }`}
                      >
                        {evt.niveau_priorite_display}
                      </span>
                      <span className="text-[10px] text-ink-400">
                        {evt.type_display}
                      </span>
                    </div>

                    {evt.description && (
                      <p className="text-[12px] text-ink-600 leading-relaxed line-clamp-2 mb-2">
                        {evt.description}
                      </p>
                    )}

                    {evt.participants_detail.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                        <Users size={11} />
                        <span>
                          {evt.participants_detail.length} participant
                          {evt.participants_detail.length > 1 ? 's' : ''}
                        </span>
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