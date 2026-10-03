/**
 * Service API pour les activités.
 */

import api from './client'
import type { Activite, PaginatedResponse, Priorite, StatutActivite } from '../types'

export interface FetchActivitesParams {
  statut?: string
  priorite?: string
  responsable?: number
  /** Tri serveur : `titre`, `date_creation`, `date_echeance` (préfixe `-` pour l'inverse). */
  ordering?: string
  /** Recherche plein texte sur `titre` et `description`. */
  search?: string
  /** Borne basse inclusive sur la date d'échéance, format `YYYY-MM-DD`. */
  dateDebut?: string
  /** Borne haute inclusive sur la journée entière, format `YYYY-MM-DD`. */
  dateFin?: string
  page?: number
  pageSize?: number
}

/**
 * Récupère une page d'activités (count + next + previous + results).
 */
export async function fetchActivitesPage(
  params?: FetchActivitesParams,
): Promise<PaginatedResponse<Activite>> {
  const query: Record<string, string> = {}
  if (params?.statut) query.statut = params.statut
  if (params?.priorite) query.priorite = params.priorite
  if (params?.responsable) query.responsable = String(params.responsable)
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.dateDebut) query.date_debut = params.dateDebut
  if (params?.dateFin) query.date_fin = params.dateFin
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Activite>>('/activites/', {
    params: query,
  })
  return response.data
}

/**
 * Récupère la première page d'activités.
 * Réservé aux widgets ; les pages listes utilisent `fetchActivitesPage`.
 */
export async function fetchActivites(
  params?: FetchActivitesParams,
): Promise<Activite[]> {
  const response = await fetchActivitesPage(params)
  return response.results
}

export async function fetchActivite(id: number): Promise<Activite> {
  const response = await api.get<Activite>(`/activites/${id}/`)
  return response.data
}

export interface CreateActivitePayload {
  titre: string
  description?: string
  statut?: StatutActivite
  priorite: Priorite
  date_debut?: string | null
  date_echeance?: string | null
  responsable: number
}

export async function createActivite(
  payload: CreateActivitePayload,
): Promise<Activite> {
  const response = await api.post<Activite>('/activites/', payload)
  return response.data
}

export async function updateActivite(
  id: number,
  payload: Partial<CreateActivitePayload>,
): Promise<Activite> {
  const response = await api.patch<Activite>(`/activites/${id}/`, payload)
  return response.data
}

export async function deleteActivite(id: number): Promise<void> {
  await api.delete(`/activites/${id}/`)
}

export async function cloturerActivite(id: number): Promise<Activite> {
  const response = await api.post<Activite>(`/activites/${id}/cloturer/`)
  return response.data
}

export async function annulerActivite(
  id: number,
  motif: string,
): Promise<Activite> {
  const response = await api.post<Activite>(`/activites/${id}/annuler/`, {
    motif,
  })
  return response.data
}

export async function reporterEcheanceActivite(
  id: number,
  dateEcheance: string,
  motif: string,
): Promise<Activite> {
  const response = await api.post<Activite>(
    `/activites/${id}/reporter-echeance/`,
    { date_echeance: dateEcheance, motif },
  )
  return response.data
}