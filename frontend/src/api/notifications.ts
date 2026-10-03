/**
 * Service API pour les notifications.
 *
 * Les notifications sont créées par le backend (jobs, actions métier).
 * Le frontend ne peut que les lister et les marquer comme lues.
 */

import api from './client'
import type { Notification, PaginatedResponse } from '../types'

export interface FetchNotificationsParams {
  lue?: boolean
  /** Tri serveur : `date_creation` (préfixe `-` pour l'inverse). */
  ordering?: string
  /** Recherche plein texte sur `message`. */
  search?: string
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de notifications (count + next + previous + results).
 */
export async function fetchNotificationsPage(
  params?: FetchNotificationsParams,
): Promise<PaginatedResponse<Notification>> {
  const query: Record<string, string> = {}
  if (params?.lue !== undefined) query.lue = String(params.lue)
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Notification>>(
    '/notifications/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère la première page de notifications.
 * Réservé aux widgets (cloche, profil) ; la page Notifications utilise
 * `fetchNotificationsPage`.
 */
export async function fetchNotifications(
  params?: FetchNotificationsParams,
): Promise<Notification[]> {
  const response = await fetchNotificationsPage(params)
  return response.results
}

export async function marquerNotificationLue(
  id: number,
): Promise<Notification> {
  const response = await api.patch<Notification>(
    `/notifications/${id}/lire/`,
  )
  return response.data
}