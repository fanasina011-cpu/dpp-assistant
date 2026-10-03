/**
 * Service API pour les synthèses.
 */

import api from './client'
import type { PaginatedResponse, Synthese, TypeSynthese } from '../types'

export interface FetchSynthesesParams {
  type?: TypeSynthese
  /** Tri serveur : `date_generation`, `periode_debut`, `periode_fin` (préfixe `-` pour l'inverse). */
  ordering?: string
  /** Recherche plein texte sur `contenu`. */
  search?: string
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de synthèses (count + next + previous + results).
 */
export async function fetchSynthesesPage(
  params?: FetchSynthesesParams,
): Promise<PaginatedResponse<Synthese>> {
  const query: Record<string, string> = {}
  if (params?.type) query.type = params.type
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Synthese>>('/syntheses/', {
    params: query,
  })
  return response.data
}

/**
 * Récupère la première page de synthèses.
 * Réservé aux widgets ; la page Syntheses utilise `fetchSynthesesPage`.
 */
export async function fetchSyntheses(
  params?: FetchSynthesesParams,
): Promise<Synthese[]> {
  const response = await fetchSynthesesPage(params)
  return response.results
}

export async function fetchSynthese(id: number): Promise<Synthese> {
  const response = await api.get<Synthese>(`/syntheses/${id}/`)
  return response.data
}

export interface GenererSynthesePayload {
  type: TypeSynthese
  periode_debut: string
  periode_fin: string
}

export async function genererSynthese(
  payload: GenererSynthesePayload,
): Promise<Synthese> {
  const response = await api.post<Synthese>('/syntheses/generer/', payload)
  return response.data
}

export async function deleteSynthese(id: number): Promise<void> {
  await api.delete(`/syntheses/${id}/`)
}