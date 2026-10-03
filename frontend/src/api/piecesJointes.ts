/**
 * Service API pour les pièces jointes.
 */

import api from './client'
import type { PaginatedResponse, PieceJointe } from '../types'

export interface FetchPiecesJointesParams {
  tache?: number
  instruction?: number
  activite?: number
  evenement?: number
  blocage?: number
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de pièces jointes (count + next + previous + results).
 */
export async function fetchPiecesJointesPage(
  params: FetchPiecesJointesParams,
): Promise<PaginatedResponse<PieceJointe>> {
  const query: Record<string, string> = {}
  if (params.tache) query.tache = String(params.tache)
  if (params.instruction) query.instruction = String(params.instruction)
  if (params.activite) query.activite = String(params.activite)
  if (params.evenement) query.evenement = String(params.evenement)
  if (params.blocage) query.blocage = String(params.blocage)
  if (params.page) query.page = String(params.page)
  if (params.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<PieceJointe>>(
    '/pieces-jointes/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère les pièces jointes d'une entité.
 * La section de détail affiche une liste courte : pas de pagination.
 */
export async function fetchPiecesJointes(
  params: FetchPiecesJointesParams,
): Promise<PieceJointe[]> {
  const response = await fetchPiecesJointesPage(params)
  return response.results
}

/**
 * Upload d'un fichier avec FormData.
 */
export async function uploadPieceJointe(
  fichier: File,
  cible: FetchPiecesJointesParams,
): Promise<PieceJointe> {
  const formData = new FormData()
  formData.append('fichier', fichier)

  if (cible.tache) formData.append('tache', String(cible.tache))
  if (cible.instruction) formData.append('instruction', String(cible.instruction))
  if (cible.activite) formData.append('activite', String(cible.activite))
  if (cible.evenement) formData.append('evenement', String(cible.evenement))
  if (cible.blocage) formData.append('blocage', String(cible.blocage))

  const response = await api.post<PieceJointe>(
    '/pieces-jointes/upload/',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function deletePieceJointe(id: number): Promise<void> {
  await api.delete(`/pieces-jointes/${id}/`)
}

/**
 * URL de téléchargement (le navigateur gère le token via le cookie/localStorage
 * uniquement si on passe par un lien direct — sinon utiliser un blob).
 *
 * Pour simplifier, on utilise un blob téléchargé via Axios puis on force
 * le téléchargement côté navigateur.
 */
export async function downloadPieceJointe(
  id: number,
  nomFichier: string,
): Promise<void> {
  const response = await api.get(`/pieces-jointes/${id}/download/`, {
    responseType: 'blob',
  })

  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', nomFichier)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}