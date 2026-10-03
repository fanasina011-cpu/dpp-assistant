/**
 * Service API pour les blocages.
 */

import api from './client'
import type { Blocage, PaginatedResponse } from '../types'

export interface FetchBlocagesParams {
  statut?: string
  niveauUrgence?: string
  tache?: number
  /** Tri serveur : `date_signalement`, `date_limite_action`, `date_resolution` (préfixe `-` pour l'inverse). */
  ordering?: string
  /** Recherche plein texte sur `description` et sur le titre de la tâche. */
  search?: string
  /** Ne renvoie que les blocages dont le délai d'escalade est dépassé. */
  enAttenteEscalade?: boolean
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de blocages (count + next + previous + results).
 */
export async function fetchBlocagesPage(
  params?: FetchBlocagesParams,
): Promise<PaginatedResponse<Blocage>> {
  const query: Record<string, string> = {}
  if (params?.statut) query.statut = params.statut
  if (params?.niveauUrgence) query.niveau_urgence = params.niveauUrgence
  if (params?.tache) query.tache = String(params.tache)
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.enAttenteEscalade) query.en_attente_escalade = 'true'
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Blocage>>('/blocages/', {
    params: query,
  })
  return response.data
}

/**
 * Récupère la première page de blocages.
 * Réservé aux widgets ; les pages listes utilisent `fetchBlocagesPage`.
 */
export async function fetchBlocages(
  params?: FetchBlocagesParams,
): Promise<Blocage[]> {
  const response = await fetchBlocagesPage(params)
  return response.results
}

export async function fetchBlocage(id: number): Promise<Blocage> {
  const response = await api.get<Blocage>(`/blocages/${id}/`)
  return response.data
}

export interface CreateBlocagePayload {
  description: string
  niveau_urgence: string
  tache: number
  personne_sollicitee?: number | null
}

export async function createBlocage(
  payload: CreateBlocagePayload,
): Promise<Blocage> {
  const response = await api.post<Blocage>('/blocages/', payload)
  return response.data
}

export async function resoudreBlocage(id: number): Promise<Blocage> {
  const response = await api.post<Blocage>(`/blocages/${id}/resoudre/`)
  return response.data
}

export async function remonterBlocage(id: number): Promise<Blocage> {
  const response = await api.post<Blocage>(`/blocages/${id}/remonter/`)
  return response.data
}

export interface ContesterBlocagePayload {
  motif: string
}

export async function contesterBlocage(
  id: number,
  payload: ContesterBlocagePayload,
): Promise<Blocage> {
  const response = await api.post<Blocage>(
    `/blocages/${id}/contester/`,
    payload,
  )
  return response.data
}

export async function resoudreContestationBlocage(id: number): Promise<Blocage> {
  const response = await api.post<Blocage>(
    `/blocages/${id}/resoudre_contestation/`,
  )
  return response.data
}

export async function deleteBlocage(id: number): Promise<void> {
  await api.delete(`/blocages/${id}/`)
}

export async function updateBlocage(
  id: number,
  payload: Partial<CreateBlocagePayload>,
): Promise<Blocage> {
  const response = await api.patch<Blocage>(`/blocages/${id}/`, payload)
  return response.data
}