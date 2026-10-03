/**
 * Service API pour les commentaires.
 *
 * Un commentaire peut être attaché à une Tâche, une Instruction ou une
 * Activité (une seule cible à la fois).
 */

import api from './client'
import type { Commentaire, PaginatedResponse } from '../types'

export interface FetchCommentairesParams {
  tache?: number
  instruction?: number
  activite?: number
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de commentaires (count + next + previous + results).
 */
export async function fetchCommentairesPage(
  params: FetchCommentairesParams,
): Promise<PaginatedResponse<Commentaire>> {
  const query: Record<string, string> = {}
  if (params.tache) query.tache = String(params.tache)
  if (params.instruction) query.instruction = String(params.instruction)
  if (params.activite) query.activite = String(params.activite)
  if (params.page) query.page = String(params.page)
  if (params.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Commentaire>>(
    '/commentaires/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère les commentaires d'une entité.
 * La section de détail affiche une liste courte : pas de pagination.
 */
export async function fetchCommentaires(
  params: FetchCommentairesParams,
): Promise<Commentaire[]> {
  const response = await fetchCommentairesPage(params)
  return response.results
}

export interface CreateCommentairePayload {
  contenu: string
  tache?: number | null
  instruction?: number | null
  activite?: number | null
}

export async function createCommentaire(
  payload: CreateCommentairePayload,
): Promise<Commentaire> {
  const response = await api.post<Commentaire>('/commentaires/', payload)
  return response.data
}

export async function deleteCommentaire(id: number): Promise<void> {
  await api.delete(`/commentaires/${id}/`)
}