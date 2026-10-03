/**
 * Service API pour les délégations temporaires de rôle.
 */

import api from './client'
import type { Delegation, PaginatedResponse, Role } from '../types'

export interface FetchDelegationsParams {
  actif?: boolean
  roleDelegue?: string
  /** Tri serveur : `date_creation`, `date_debut`, `date_fin` (préfixe `-` pour l'inverse). */
  ordering?: string
  /**
   * Recherche plein texte sur le nom du délégant, celui du délégataire, le
   * rôle délégué et le service.
   */
  search?: string
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de délégations (count + next + previous + results).
 */
export async function fetchDelegationsPage(
  params?: FetchDelegationsParams,
): Promise<PaginatedResponse<Delegation>> {
  const query: Record<string, string> = {}
  if (params?.actif !== undefined) query.actif = String(params.actif)
  if (params?.roleDelegue) query.role_delegue = params.roleDelegue
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Delegation>>(
    '/delegations/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère la première page de délégations.
 * Réservé aux widgets ; la page Delegations utilise `fetchDelegationsPage`.
 */
export async function fetchDelegations(
  params?: FetchDelegationsParams,
): Promise<Delegation[]> {
  const response = await fetchDelegationsPage(params)
  return response.results
}

export interface CreateDelegationPayload {
  delegataire: number
  role_delegue: Role
  service?: string | null
  date_debut: string
  date_fin: string
  actif?: boolean
}

export async function createDelegation(
  payload: CreateDelegationPayload,
): Promise<Delegation> {
  const response = await api.post<Delegation>('/delegations/', payload)
  return response.data
}

export async function revoquerDelegation(id: number): Promise<Delegation> {
  const response = await api.post<Delegation>(`/delegations/${id}/revoquer/`)
  return response.data
}

export async function deleteDelegation(id: number): Promise<void> {
  await api.delete(`/delegations/${id}/`)
}