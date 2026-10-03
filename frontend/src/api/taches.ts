/**
 * Service API pour les tâches.
 *
 * Regroupe tous les appels HTTP liés aux tâches dans un seul fichier.
 * Les composants n'appellent jamais axios directement : ils passent
 * par ces fonctions typées.
 */

import api from './client'
import type { PaginatedResponse, StatsTaches, Tache } from '../types'

/**
 * Récupère la liste paginée des tâches accessibles à l'utilisateur connecté.
 *
 * Filtre optionnel : `enRetard` pour ne récupérer que les tâches en retard.
 */
export interface FetchTachesParams {
  enRetard?: boolean
  statut?: string
  priorite?: string
  responsable?: number
  mesTaches?: boolean
  activite?: number
  instruction?: number
  /** Tri serveur : `titre`, `date_creation`, `date_echeance` (préfixe `-` pour l'inverse). */
  ordering?: string
  /** Recherche plein texte sur `titre` et `description`. */
  search?: string
  /** Borne basse inclusive sur la date d'échéance, format `YYYY-MM-DD`. */
  dateDebut?: string
  /** Borne haute inclusive sur la journée entière, format `YYYY-MM-DD`. */
  dateFin?: string
  /** Ne renvoie que les tâches sans date d'échéance. */
  sansDate?: boolean
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de tâches (count + next + previous + results).
 * Utilisé par les pages listes pour la pagination.
 */
export async function fetchTachesPage(
  params?: FetchTachesParams,
): Promise<PaginatedResponse<Tache>> {
  const query: Record<string, string> = {}
  if (params?.enRetard) query.en_retard = 'true'
  if (params?.statut) query.statut = params.statut
  if (params?.priorite) query.priorite = params.priorite
  if (params?.responsable) query.responsable = String(params.responsable)
  if (params?.mesTaches) query.mes_taches = 'true'
  if (params?.activite) query.activite = String(params.activite)
  if (params?.instruction) query.instruction = String(params.instruction)
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.dateDebut) query.date_debut = params.dateDebut
  if (params?.dateFin) query.date_fin = params.dateFin
  if (params?.sansDate) query.sans_date = 'true'
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Tache>>('/taches/', {
    params: query,
  })
  return response.data
}

/**
 * KPI globaux sur les tâches (endpoint `/taches/stats/`).
 *
 * Le serveur les calcule sur l'INTÉGRALITÉ du périmètre de l'utilisateur,
 * pas sur la page courante. Les mêmes filtres que `fetchTachesPage`
 * s'appliquent : filtrer la liste filtre les KPI de la même façon.
 */
export async function fetchTachesStats(
  params?: FetchTachesParams,
): Promise<StatsTaches> {
  const query: Record<string, string> = {}
  if (params?.statut) query.statut = params.statut
  if (params?.priorite) query.priorite = params.priorite
  if (params?.responsable) query.responsable = String(params.responsable)
  if (params?.activite) query.activite = String(params.activite)
  if (params?.search) query.search = params.search
  if (params?.dateDebut) query.date_debut = params.dateDebut
  if (params?.dateFin) query.date_fin = params.dateFin
  if (params?.sansDate) query.sans_date = 'true'

  const response = await api.get<StatsTaches>('/taches/stats/', { params: query })
  return response.data
}

/**
 * Récupère la première page de tâches accessibles à l'utilisateur.
 *
 * Réservé aux widgets et sections. Les pages listes utilisent
 * `fetchTachesPage` pour disposer du total.
 */
export async function fetchTaches(
  params?: FetchTachesParams,
): Promise<Tache[]> {
  const response = await fetchTachesPage(params)
  return response.results
}
/**
 * Récupère une tâche par son ID.
 */
export async function fetchTache(id: number): Promise<Tache> {
  const response = await api.get<Tache>(`/taches/${id}/`)
  return response.data
}


/**
 * Payload pour créer une tâche.
 */
export interface CreateTachePayload {
  titre: string
  description?: string
  date_debut?: string | null
  date_echeance?: string | null
  priorite: string
  statut?: string
  responsable?: number | null
  instruction?: number | null
  activite?: number | null
}

/**
 * Crée une tâche.
 */
export async function createTache(payload: CreateTachePayload): Promise<Tache> {
  const response = await api.post<Tache>('/taches/', payload)
  return response.data
}

/**
 * Change le statut d'une tâche via l'action dédiée.
 */
export async function changerStatutTache(
  id: number,
  nouveauStatut: string,
  motif?: string,
): Promise<Tache> {
  const payload: { statut: string; motif?: string } = {
    statut: nouveauStatut,
  }
  if (motif) payload.motif = motif

  const response = await api.patch<Tache>(`/taches/${id}/statut/`, payload)
  return response.data
}

/**
 * Supprime une tâche.
 */
export async function deleteTache(id: number): Promise<void> {
  await api.delete(`/taches/${id}/`)
}

export async function reporterEcheanceTache(
  id: number,
  dateEcheance: string,
  motif: string,
): Promise<Tache> {
  const response = await api.post<Tache>(`/taches/${id}/reporter-echeance/`, {
    date_echeance: dateEcheance,
    motif,
  })
  return response.data
}

export async function updateTache(
  id: number,
  payload: Partial<CreateTachePayload>,
): Promise<Tache> {
  const response = await api.patch<Tache>(`/taches/${id}/`, payload)
  return response.data
}