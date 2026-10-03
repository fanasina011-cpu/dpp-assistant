/**
 * Service API pour les événements d'agenda.
 */

import api from './client'
import type {
  Evenement,
  PaginatedResponse,
  NiveauPriorite,
  TypeEvenement,
} from '../types'

export interface FetchEvenementsParams {
  debut?: string
  fin?: string
  niveauPriorite?: NiveauPriorite
  type?: TypeEvenement
  page?: number
  pageSize?: number
}

/**
 * Récupère une page d'événements (count + next + previous + results).
 *
 * L'agenda filtre par fenêtre de dates et ne pagine pas : il utilise
 * `fetchEvenements`.
 */
export async function fetchEvenementsPage(
  params?: FetchEvenementsParams,
): Promise<PaginatedResponse<Evenement>> {
  const query: Record<string, string> = {}
  if (params?.debut) query.debut = params.debut
  if (params?.fin) query.fin = params.fin
  if (params?.niveauPriorite) query.niveau_priorite = params.niveauPriorite
  if (params?.type) query.type = params.type
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Evenement>>('/evenements/', {
    params: query,
  })
  return response.data
}

export async function fetchEvenements(
  params?: FetchEvenementsParams,
): Promise<Evenement[]> {
  const response = await fetchEvenementsPage(params)
  return response.results
}

export async function fetchEvenement(id: number): Promise<Evenement> {
  const response = await api.get<Evenement>(`/evenements/${id}/`)
  return response.data
}

export interface CreateEvenementPayload {
  titre: string
  description?: string
  type: TypeEvenement
  date_debut: string
  date_fin: string
  statut?: string
  niveau_priorite: NiveauPriorite
  participants?: number[]
}

export async function createEvenement(
  payload: CreateEvenementPayload,
): Promise<Evenement> {
  const response = await api.post<Evenement>('/evenements/', payload)
  return response.data
}

export async function deleteEvenement(id: number): Promise<void> {
  await api.delete(`/evenements/${id}/`)
}

export async function annulerEvenement(
  id: number,
  motif: string,
): Promise<Evenement> {
  const response = await api.post<Evenement>(`/evenements/${id}/annuler/`, {
    motif,
  })
  return response.data
}

export async function updateEvenement(
  id: number,
  payload: Partial<CreateEvenementPayload>,
): Promise<Evenement> {
  const response = await api.patch<Evenement>(`/evenements/${id}/`, payload)
  return response.data
}