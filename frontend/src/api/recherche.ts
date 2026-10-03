/**
 * Service API pour la productivité : recherche transversale et KPI.
 */

import api from './client'
import type { ReponseRecherche, TypeResultatRecherche } from '../types'

/** Longueur minimale du terme, alignée sur `RechercheViewSet.LONGUEUR_MIN`. */
export const LONGUEUR_MIN_RECHERCHE = 2

export interface FetchRechercheParams {
  q: string
  /** Restreint la recherche à certains types. Défaut : tous. */
  types?: TypeResultatRecherche[]
}

/**
 * Recherche transversale (endpoint `/recherche/`).
 *
 * Les résultats sont regroupés par type et le périmètre RBAC est appliqué
 * côté serveur : un utilisateur ne voit que ce qu'il peut déjà atteindre
 * dans les listes.
 *
 * Retourne `{ q, total: 0, resultats: {} }` si le terme est trop court —
 * inutile d'aller sur le réseau dans ce cas.
 */
export async function fetchRecherche(
  params: FetchRechercheParams,
): Promise<ReponseRecherche> {
  const q = params.q.trim()

  if (q.length < LONGUEUR_MIN_RECHERCHE) {
    return { q, total: 0, resultats: {} }
  }

  const query: Record<string, string> = { q }
  if (params.types && params.types.length > 0) {
    query.types = params.types.join(',')
  }

  const response = await api.get<ReponseRecherche>('/recherche/', {
    params: query,
  })
  return response.data
}