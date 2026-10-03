/**
 * Service API pour l'historique des actions.
 *
 * Endpoint en lecture seule : pas de création, modification ou suppression.
 */

import api from './client'
import type { HistoriqueAction, PaginatedResponse } from '../types'

export interface FetchHistoriqueParams {
  tache?: number
  instruction?: number
  blocage?: number
  activite?: number
  /** Tri serveur : `date_action`, `action`, `cible_type` (préfixe `-` pour l'inverse). */
  ordering?: string
  /** Recherche plein texte sur `action` et `details`. */
  search?: string
  /** Cible : `TACHE`, `INSTRUCTION`, `BLOCAGE`, `ACTIVITE`. */
  cibleType?: string
  /** Identifiant de la cible dénormalisée (conservé après suppression). */
  cibleId?: number
  /**
   * Catégorie dérivée de l'action (`CREATION`, `STATUT`, …).
   * Reproduit `CATEGORIES_ACTION` côté serveur.
   */
  categorie?: string
  /** Borne basse inclusive sur la date d'action, format `YYYY-MM-DD`. */
  dateDebut?: string
  /** Borne haute inclusive sur la journée entière, format `YYYY-MM-DD`. */
  dateFin?: string
  page?: number
  pageSize?: number
}

/**
 * Récupère une page d'entrées d'historique
 * (count + next + previous + results).
 */
export async function fetchHistoriquePage(
  params?: FetchHistoriqueParams,
): Promise<PaginatedResponse<HistoriqueAction>> {
  const query: Record<string, string> = {}
  if (params?.tache) query.tache = String(params.tache)
  if (params?.instruction) query.instruction = String(params.instruction)
  if (params?.blocage) query.blocage = String(params.blocage)
  if (params?.activite) query.activite = String(params.activite)
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.cibleType) query.cible_type = params.cibleType
  if (params?.cibleId) query.cible_id = String(params.cibleId)
  if (params?.categorie) query.categorie = params.categorie
  if (params?.dateDebut) query.date_debut = params.dateDebut
  if (params?.dateFin) query.date_fin = params.dateFin
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<HistoriqueAction>>(
    '/historique/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère la première page d'historique.
 * Réservé aux sections de détail ; la page Historique utilise
 * `fetchHistoriquePage`.
 */
export async function fetchHistorique(
  params?: FetchHistoriqueParams,
): Promise<HistoriqueAction[]> {
  const response = await fetchHistoriquePage(params)
  return response.results
}

/**
 * Purge l'historique avant une date donnée.
 * Réservé au Directeur.
 */
export async function purgerHistorique(
  avantDate: string,
): Promise<{ supprimees: number; message: string }> {
  const response = await api.post<{ supprimees: number; message: string }>(
    '/historique/purger/',
    { avant_date: avantDate },
  )
  return response.data
}

/**
 * Supprime une entrée d'historique.
 * Réservé au Directeur.
 */
export async function deleteHistorique(id: number): Promise<void> {
  await api.delete(`/historique/${id}/`)
}