/**
 * Hook de détection de media query.
 * Utilisé pour basculer entre vue tableau et vue cards.
 */

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    // Compatibilité avec les navigateurs anciens
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      mq.addListener(handler)
      return () => mq.removeListener(handler)
    }
  }, [query])

  return matches
}

/** Vrai si l'écran est < 768px (mobile). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}