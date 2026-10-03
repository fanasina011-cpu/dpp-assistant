/**
 * Page Agenda — vue Jour / Semaine / Mois / Liste.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import Layout from '../components/Layout'
import VueMois from '../components/agenda/VueMois'
import VueSemaine from '../components/agenda/VueSemaine'
import VueJour from '../components/agenda/VueJour'
import VueListe from '../components/agenda/VueListe'
import JourPanel from '../components/agenda/JourPanel'
import MiniCalendrier from '../components/agenda/MiniCalendrier'
import EvenementFormModal from '../components/agenda/EvenementFormModal'
import EvenementDetailModal from '../components/agenda/EvenementDetailModal'
import Button from '../components/ui/Button'
import {
  NOMS_MOIS,
  ajouterJours,
  construireGrilleMois,
  formatDateISO,
  getJoursSemaine,
  memeJour,
} from '../utils/calendrier'
import { fetchEvenements } from '../api/evenements'
import type { Evenement } from '../types'

type VueType = 'jour' | 'semaine' | 'mois' | 'liste'

const STORAGE_KEY = 'agenda:vue'

const TABS: { value: VueType; label: string }[] = [
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'liste', label: 'Liste' },
]

export default function Agenda() {
  const aujourdHui = new Date()

  // Onglet mémorisé
  const [vue, setVue] = useState<VueType>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'jour' || saved === 'semaine' || saved === 'mois' || saved === 'liste') {
      return saved as VueType
    }
    return 'mois'
  })
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, vue)
  }, [vue])

  const [dateRef, setDateRef] = useState<Date>(aujourdHui)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [dateInitialeForm, setDateInitialeForm] = useState<Date | undefined>()
  const [selectedEvenement, setSelectedEvenement] = useState<Evenement | null>(null)
  const [evenementEnEdition, setEvenementEnEdition] = useState<Evenement | null>(null)

  // Plage selon la vue
  const { debut, fin } = useMemo(() => {
    if (vue === 'jour') {
      // Charge la semaine entière pour être sûr d'avoir les événements du jour
      const jours = getJoursSemaine(dateRef)
      return {
        debut: formatDateISO(jours[0]),
        fin: formatDateISO(jours[6]),
      }
    }
    if (vue === 'semaine') {
      const jours = getJoursSemaine(dateRef)
      return {
        debut: formatDateISO(jours[0]),
        fin: formatDateISO(jours[6]),
      }
    }
    if (vue === 'liste') {
      const finDate = ajouterJours(dateRef, 60)
      return {
        debut: formatDateISO(dateRef),
        fin: formatDateISO(finDate),
      }
    }
    // mois
    const jours = construireGrilleMois(dateRef.getFullYear(), dateRef.getMonth())
    return {
      debut: formatDateISO(jours[0]),
      fin: formatDateISO(jours[jours.length - 1]),
    }
  }, [vue, dateRef])

  const { data: evenements = [] } = useQuery({
    queryKey: ['evenements', debut, fin],
    queryFn: () => fetchEvenements({ debut, fin }),
  })

  // Navigation
  const precedent = () => {
    if (vue === 'jour') setDateRef(ajouterJours(dateRef, -1))
    else if (vue === 'semaine') setDateRef(ajouterJours(dateRef, -7))
    else if (vue === 'liste') setDateRef(ajouterJours(dateRef, -30))
    else {
      const d = new Date(dateRef)
      d.setMonth(d.getMonth() - 1)
      setDateRef(d)
    }
  }

  const suivant = () => {
    if (vue === 'jour') setDateRef(ajouterJours(dateRef, 1))
    else if (vue === 'semaine') setDateRef(ajouterJours(dateRef, 7))
    else if (vue === 'liste') setDateRef(ajouterJours(dateRef, 30))
    else {
      const d = new Date(dateRef)
      d.setMonth(d.getMonth() + 1)
      setDateRef(d)
    }
  }

  const allerAujourdHui = () => setDateRef(new Date())

  // Titre contextuel
  const titreNavigation = useMemo(() => {
    if (vue === 'jour') {
      return dateRef.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }
    if (vue === 'semaine') {
      const jours = getJoursSemaine(dateRef)
      const d = jours[0]
      const f = jours[6]
      if (d.getMonth() === f.getMonth()) {
        return `${d.getDate()} – ${f.getDate()} ${NOMS_MOIS[f.getMonth()]} ${f.getFullYear()}`
      }
      return `${d.getDate()} ${NOMS_MOIS[d.getMonth()].slice(0, 3)} – ${f.getDate()} ${NOMS_MOIS[f.getMonth()].slice(0, 3)} ${f.getFullYear()}`
    }
    if (vue === 'liste') {
      return `À partir du ${dateRef.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    }
    return `${NOMS_MOIS[dateRef.getMonth()]} ${dateRef.getFullYear()}`
  }, [vue, dateRef])

  // Événements du jour (vue Mois)
  const evenementsJour = useMemo(
    () => evenements.filter((evt) => memeJour(new Date(evt.date_debut), dateRef)),
    [evenements, dateRef],
  )

  // Ouvre le formulaire
  const openForm = (date?: Date) => {
    setEvenementEnEdition(null)
    setDateInitialeForm(date)
    setIsFormOpen(true)
  }

  return (
    <Layout title="Agenda">
      <div className="space-y-4">
        {/* Barre de contrôle */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Onglets */}
            <div className="inline-flex items-center bg-ink-100 rounded-lg p-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setVue(tab.value)}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                    vue === tab.value
                      ? 'bg-white text-ink-900 shadow-sm'
                      : 'text-ink-500 hover:text-ink-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Flèches */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={precedent}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-colors"
                aria-label="Précédent"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={suivant}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-colors"
                aria-label="Suivant"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Titre */}
            <h2 className="text-[14px] font-semibold text-ink-900 capitalize">
              {titreNavigation}
            </h2>

            <Button
              variant="ghost"
              size="sm"
              onClick={allerAujourdHui}
              leftIcon={<CalendarDays size={12} />}
            >
              Aujourd'hui
            </Button>
          </div>

          <Button
            onClick={() => openForm(dateRef)}
            leftIcon={<Plus size={13} />}
          >
            Nouvel événement
          </Button>
        </div>

        {/* Contenu */}
        {vue === 'jour' && (
          <VueJour
            date={dateRef}
            evenements={evenements}
            onEvenementClick={setSelectedEvenement}
          />
        )}

        {vue === 'semaine' && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
            <MiniCalendrier
              annee={dateRef.getFullYear()}
              mois={dateRef.getMonth()}
              selectedDate={dateRef}
              evenements={evenements}
              onJourClick={setDateRef}
              onMoisChange={(a, m) => {
                const d = new Date(dateRef)
                d.setFullYear(a)
                d.setMonth(m)
                setDateRef(d)
              }}
            />
            <VueSemaine
              dateReference={dateRef}
              evenements={evenements}
              onEvenementClick={setSelectedEvenement}
              onJourClick={(d) => {
                setDateRef(d)
                setVue('jour')
              }}
              onSlotClick={(d) => openForm(d)}
            />
          </div>
        )}

        {vue === 'mois' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
            <VueMois
              annee={dateRef.getFullYear()}
              mois={dateRef.getMonth()}
              evenements={evenements}
              selectedDate={dateRef}
              onJourClick={setDateRef}
            />
            <JourPanel
              date={dateRef}
              evenements={evenementsJour}
              onEvenementClick={setSelectedEvenement}
            />
          </div>
        )}

        {vue === 'liste' && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
            <MiniCalendrier
              annee={dateRef.getFullYear()}
              mois={dateRef.getMonth()}
              selectedDate={dateRef}
              evenements={evenements}
              onJourClick={setDateRef}
              onMoisChange={(a, m) => {
                const d = new Date(dateRef)
                d.setFullYear(a)
                d.setMonth(m)
                setDateRef(d)
              }}
            />
            <VueListe
              evenements={evenements}
              onEvenementClick={setSelectedEvenement}
            />
          </div>
        )}
      </div>

      {/* Modales */}
      <EvenementFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEvenementEnEdition(null)
          setDateInitialeForm(undefined)
        }}
        dateInitiale={dateInitialeForm || dateRef}
        evenement={evenementEnEdition}
      />

      <EvenementDetailModal
        evenement={selectedEvenement}
        onClose={() => setSelectedEvenement(null)}
        onEdit={(evt) => {
          setSelectedEvenement(null)
          setEvenementEnEdition(evt)
          setDateInitialeForm(new Date(evt.date_debut))
          setIsFormOpen(true)
        }}
      />
    </Layout>
  )
}