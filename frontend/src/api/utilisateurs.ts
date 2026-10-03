/**
 * Service API pour l'annuaire des utilisateurs.
 *
 * Utilisé pour peupler les sélecteurs (choix de responsable, de
 * destinataire, etc.).
 */

import api from './client'
import type { PaginatedResponse, Utilisateur } from '../types'

export interface FetchUtilisateursParams {
  /** Tri serveur : `last_name`, `first_name`, `username` (préfixe `-` pour l'inverse). */
  ordering?: string
  /** Recherche plein texte sur `username`, `first_name`, `last_name`, `email`, `service`. */
  search?: string
  /** Rôle métier : `CHEF_SERVICE_PROJETS`, `MEMBRE_EQUIPE_APPUI`, … */
  role?: string
  /**
   * `actif` ou `inactif`. L'API n'expose jamais de compte désactivé
   * (`get_queryset` filtre sur `is_active=True`) : `inactif` rend donc 0.
   */
  statut?: string
  page?: number
  pageSize?: number
}

/**
 * Récupère une page d'utilisateurs (count + next + previous + results).
 */
export async function fetchUtilisateursPage(
  params?: FetchUtilisateursParams,
): Promise<PaginatedResponse<Utilisateur>> {
  const query: Record<string, string> = { page_size: '200' }
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.role) query.role = params.role
  if (params?.statut) query.statut = params.statut
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Utilisateur>>(
    '/utilisateurs/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère tout l'annuaire accessible (jusqu'à 200 utilisateurs).
 * Utilisé pour peupler les sélecteurs ; la page Utilisateurs utilise
 * `fetchUtilisateursPage` avec pagination.
 */
export async function fetchUtilisateurs(): Promise<Utilisateur[]> {
  const response = await fetchUtilisateursPage()
  return response.results
}
export async function fetchUtilisateur(id: number): Promise<Utilisateur> {
  const response = await api.get<Utilisateur>(`/utilisateurs/${id}/`)
  return response.data
}
export interface DesactiverUtilisateurResponse {
  statut?: 'BLOQUEE'
  message?: string
  elements?: {
    taches: Array<{ id: number; titre: string; statut: string }>
    activites: Array<{ id: number; titre: string; statut: string }>
    blocages: Array<{ id: number; description: string; statut: string }>
    evenements: Array<{ id: number; titre: string; date_debut: string }>
  }
}

export async function desactiverUtilisateur(
  id: number,
  reassignerAId?: number,
): Promise<Utilisateur> {
  const payload: { reassigner_a_id?: number } = {}
  if (reassignerAId) payload.reassigner_a_id = reassignerAId

  const response = await api.post<Utilisateur>(
    `/utilisateurs/${id}/desactiver/`,
    payload,
  )
  return response.data
}

/**
 * Modifie le profil de l'utilisateur connecté.
 */
export async function modifierMonProfil(payload: {
  first_name?: string
  last_name?: string
  email?: string
}): Promise<Utilisateur> {
  const response = await api.patch<Utilisateur>(
    '/utilisateurs/me/modifier-profil/',
    payload,
  )
  return response.data
}

/**
 * Change le mot de passe de l'utilisateur connecté.
 */
export async function changerMonMotDePasse(payload: {
  ancien_mot_de_passe: string
  nouveau_mot_de_passe: string
  confirmation: string
}): Promise<{ detail: string }> {
  const response = await api.patch<{ detail: string }>(
    '/utilisateurs/me/changer-mot-de-passe/',
    payload,
  )
  return response.data
}