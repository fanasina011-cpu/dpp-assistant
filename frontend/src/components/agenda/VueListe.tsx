/**
 * Vue liste — événements groupés par jour, chronologiques.
 */

import { CalendarX, Users } from 'lucide-react'
import type { Evenement } from '../../types'
import { formatHeure, memeJour } from '../../utils/calendrier'

interface VueListeProps {
  evenements: Evenement[]
  onEvenementClick: (evt: Evenement) => void
}

interface JourGroupe {
  date: Date
  evenements: Evenement[]
}

export default function VueListe({
  evenements,
  onEvenementClick,
}: VueListeProps) {
  const aujourdHui = new Date()
  const demain = new Date(aujourdHui)
  demain.setDate(demain.getDate() + 1)

  // Grouper les événements par jour
  const groupes: JourGroupe[] = []
  const map = new Map<string, JourGroupe>()

  const tries = [...evenements].sort(
    (a, b) =>
      new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime(),
  )

  for (const evt of tries) {
    const d = new Date(evt.date_debut)
    d.setHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    if (!map.has(key)) {
      const groupe: JourGroupe = { date: d, evenements: [] }
      map.set(key, groupe)
      groupes.push(groupe)
    }
    map.get(key)!.evenements.push(evt)
  }

  if (groupes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-ink-200 py-16 flex flex-col items-center gap-3 text-ink-400">
        <CalendarX size={40} strokeWidth={1.25} />
        <p className="text-[13px]">Aucun événement à venir.</p>
      </div>
    )
  }

  const labelJour = (d: Date): string => {
    if (memeJour(d, aujourdHui)) return "Aujourd'hui"
    if (memeJour(d, demain)) return 'Demain'
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  return (
    <div className="space-y-3">
      {groupes.map((groupe) => {
        const estAujourdHui = memeJour(groupe.date, aujourdHui)
        const estDemain = memeJour(groupe.date, demain)
        return (
          <div
            key={groupe.date.toISOString()}
            className="bg-white rounded-lg border border-ink-200 overflow-hidden"
          >
            {/* En-tête du jour */}
            <div
              className={`px-4 py-2.5 border-b border-ink-100 ${
                estAujourdHui ? 'bg-brand-50/50' : 'bg-ink-50/40'
              }`}
            >
              <h3
                className={`text-[12px] font-semibold capitalize ${
                  estAujourdHui
                    ? 'text-brand-700'
                    : estDemain
                      ? 'text-warning'
                      : 'text-ink-700'
                }`}
              >
                {labelJour(groupe.date)}
                <span className="ml-2 text-[10px] font-normal text-ink-400">
                  {groupe.evenements.length} événement
                  {groupe.evenements.length > 1 ? 's' : ''}
                </span>
              </h3>
            </div>

            {/* Événements */}
            <ul className="divide-y divide-ink-100">
              {groupe.evenements.map((evt) => {
                const isDirection = evt.niveau_priorite === 'DIRECTION'
                return (
                  <li key={evt.id}>
                    <button
                      type="button"
                      onClick={() => onEvenementClick(evt)}
                      className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-ink-50/60 transition-colors group"
                    >
                      {/* Heure */}
                      <div className="w-14 shrink-0 text-right">
                        <div className="text-[13px] font-semibold text-ink-900 tabular-nums">
                          {formatHeure(evt.date_debut)}
                        </div>
                        <div className="text-[10px] text-ink-400 tabular-nums">
                          {formatHeure(evt.date_fin)}
                        </div>
                      </div>

                      {/* Barre colorée */}
                      <span
                        className={`w-0.5 rounded-full shrink-0 self-stretch ${
                          isDirection ? 'bg-danger' : 'bg-info'
                        }`}
                      />

                      {/* Contenu */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[13px] font-medium text-ink-900 group-hover:text-brand-600 transition-colors truncate">
                            {evt.titre}
                          </span>
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
                        {evt.participants_detail.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-ink-500">
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
          </div>
        )
      })}
    </div>
  )
}