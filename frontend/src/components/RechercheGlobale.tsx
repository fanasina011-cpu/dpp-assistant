/**
 * Recherche transversale du Header.
 *
 * Barre de recherche avec debounce, résultats regroupés par type.
 * Le périmètre RBAC est appliqué par le serveur : un utilisateur ne voit
 * que ce qu'il peut déjà atteindre dans les pages listes.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'

import SearchInput from './ui/SearchInput'
import { fetchRecherche, LONGUEUR_MIN_RECHERCHE } from '../api/recherche'
import { useDebounce } from '../hooks/useDebounce'
import type { ResultatRecherche, TypeResultatRecherche } from '../types'

/** Libellés et routes de destination par type de résultat. */
const TYPES: Record<TypeResultatRecherche, { libelle: string; route: string }> = {
  taches: { libelle: 'Tâches', route: '/taches' },
  instructions: { libelle: 'Instructions', route: '/instructions' },
  activites: { libelle: 'Activités', route: '/activites' },
  blocages: { libelle: 'Blocages', route: '/blocages' },
  evenements: { libelle: 'Événements', route: '/agenda' },
}

const ORDRE_TYPES: TypeResultatRecherche[] = [
  'taches',
  'instructions',
  'activites',
  'blocages',
  'evenements',
]

export default function RechercheGlobale() {
  const navigate = useNavigate()
  const [terme, setTerme] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const conteneurRef = useRef<HTMLDivElement>(null)

  const termeDiffere = useDebounce(terme, 350)
  const termeAssezLong = termeDiffere.trim().length >= LONGUEUR_MIN_RECHERCHE

  const { data, isFetching } = useQuery({
    queryKey: ['recherche', termeDiffere.trim()],
    queryFn: () => fetchRecherche({ q: termeDiffere }),
    enabled: termeAssezLong,
    staleTime: 30_000,
  })

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return

    function surClic(evt: MouseEvent) {
      if (
        conteneurRef.current &&
        !conteneurRef.current.contains(evt.target as Node)
      ) {
        setOuvert(false)
      }
    }

    document.addEventListener('mousedown', surClic)
    return () => document.removeEventListener('mousedown', surClic)
  }, [ouvert])

  function naviguer(item: ResultatRecherche) {
    const { route } = TYPES[item.type]
    // Les événements n'ont pas de page détail : on renvoie vers l'agenda.
    const cible = item.type === 'evenements' ? route : `${route}/${item.id}`
    setOuvert(false)
    setTerme('')
    navigate(cible)
  }

  const groupes = ORDRE_TYPES.filter((t) => data?.resultats[t]).map((t) => ({
    type: t,
    ...data!.resultats[t]!,
  }))

  const aucunResultat = termeAssezLong && data && data.total === 0 && !isFetching

  return (
    <div ref={conteneurRef} className="relative w-full max-w-xs">
      <SearchInput
        value={terme}
        onChange={(v) => {
          setTerme(v)
          setOuvert(true)
        }}
        placeholder="Rechercher..."
      />

      {ouvert && termeAssezLong && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg">
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-ink-500">
              <Loader2 size={13} className="animate-spin" />
              Recherche en cours...
            </div>
          )}

          {!isFetching && aucunResultat && (
            <div className="px-3 py-3 text-[12px] text-ink-500">
              Aucun résultat pour « {termeDiffere.trim()} ».
            </div>
          )}

          {!isFetching &&
            groupes.map((groupe) => (
              <div key={groupe.type} className="border-b border-ink-100 last:border-b-0">
                <div className="flex items-center justify-between px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    {TYPES[groupe.type].libelle}
                  </span>
                  {groupe.total > groupe.items.length && (
                    <span className="text-[10px] text-ink-400">
                      {groupe.total} résultats
                    </span>
                  )}
                </div>

                {groupe.items.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => naviguer(item)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-ink-50"
                  >
                    <span className="w-full truncate text-[12px] font-medium text-ink-800">
                      {item.libelle}
                    </span>
                    {item.sous_titre && (
                      <span className="w-full truncate text-[11px] text-ink-500">
                        {item.sous_titre}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}

          {isFetching && groupes.length > 0 && (
            <div className="flex items-center gap-2 border-t border-ink-100 px-3 py-2 text-[11px] text-ink-400">
              <AlertCircle size={12} />
              Résultats peut-être incomplets
            </div>
          )}
        </div>
      )}
    </div>
  )
}