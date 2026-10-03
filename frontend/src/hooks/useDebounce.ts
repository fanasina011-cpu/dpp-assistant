/**
 * Retarde la propagation d'une valeur rapide.
 *
 * Utilisé pour ne pas déclencher une requête à chaque frappe : la valeur
 * n'est réellement mise à jour qu'après `delai` ms sans nouvelle frappe.
 *
 * La première frappe est déjà différée : `delaiMs = 0` est le cas
 * « immédiat » (pas de temporisation).
 */

import { useEffect, useState } from 'react'

export function useDebounce<T>(valeur: T, delaiMs = 350): T {
  const [valeurDifferee, setValeurDifferee] = useState(valeur)

  useEffect(() => {
    if (delaiMs <= 0) {
      setValeurDifferee(valeur)
      return
    }

    const minuteur = setTimeout(() => setValeurDifferee(valeur), delaiMs)
    return () => clearTimeout(minuteur)
  }, [valeur, delaiMs])

  return valeurDifferee
}