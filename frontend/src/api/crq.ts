/**
 * Service API pour les comptes-rendus quotidiens (CRQ) et les demandes
 * de réouverture.
 */

import api from './client'
import type {
  CompteRenduQuotidien,
  DemandeReouvertureCRQ,
  PaginatedResponse,
} from '../types'

// ===========================================================================
// CRQ
// ===========================================================================

export interface FetchCRQsParams {
  estCloture?: boolean
  date?: string
  redacteur?: number
  /** Tri serveur : `date_journaliere`, `est_cloture` (préfixe `-` pour l'inverse). */
  ordering?: string
  /** Recherche plein texte sur `activites_realisees`, `activites_en_cours`, `activites_non_realisees`, `difficultes`, `prevues_lendemain`. */
  search?: string
  /** Borne basse inclusive sur la date journalière, format `YYYY-MM-DD`. */
  dateDebut?: string
  /** Borne haute inclusive sur la journée entière, format `YYYY-MM-DD`. */
  dateFin?: string
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de CRQ (count + next + previous + results).
 */
export async function fetchCRQsPage(
  params?: FetchCRQsParams,
): Promise<PaginatedResponse<CompteRenduQuotidien>> {
  const query: Record<string, string> = {}
  if (params?.estCloture !== undefined) query.est_cloture = String(params.estCloture)
  if (params?.date) query.date = params.date
  if (params?.redacteur) query.redacteur = String(params.redacteur)
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.dateDebut) query.date_debut = params.dateDebut
  if (params?.dateFin) query.date_fin = params.dateFin
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<CompteRenduQuotidien>>(
    '/comptes-rendus/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère la première page de CRQ.
 * Réservé aux widgets ; la page CRQ utilise `fetchCRQsPage`.
 */
export async function fetchCRQs(
  params?: FetchCRQsParams,
): Promise<CompteRenduQuotidien[]> {
  const response = await fetchCRQsPage(params)
  return response.results
}

export async function fetchCRQ(id: number): Promise<CompteRenduQuotidien> {
  const response = await api.get<CompteRenduQuotidien>(`/comptes-rendus/${id}/`)
  return response.data
}

export interface CreateCRQPayload {
  date_journaliere: string
  activites_realisees?: string
  activites_en_cours?: string
  activites_non_realisees?: string
  difficultes?: string
  prevues_lendemain?: string
}

export async function createCRQ(
  payload: CreateCRQPayload,
): Promise<CompteRenduQuotidien> {
  const response = await api.post<CompteRenduQuotidien>(
    '/comptes-rendus/',
    payload,
  )
  return response.data
}

export async function updateCRQ(
  id: number,
  payload: Partial<CreateCRQPayload>,
): Promise<CompteRenduQuotidien> {
  const response = await api.patch<CompteRenduQuotidien>(
    `/comptes-rendus/${id}/`,
    payload,
  )
  return response.data
}

export async function demanderReouverture(
  crqId: number,
  motif: string,
): Promise<DemandeReouvertureCRQ> {
  const response = await api.post<DemandeReouvertureCRQ>(
    `/comptes-rendus/${crqId}/demande-reouverture/`,
    { motif },
  )
  return response.data
}

// ===========================================================================
// DEMANDES DE RÉOUVERTURE
// ===========================================================================

export interface FetchDemandesReouvertureParams {
  statut?: string
  crq?: number
  page?: number
  pageSize?: number
}

/**
 * Récupère une page de demandes de réouverture
 * (count + next + previous + results).
 */
export async function fetchDemandesReouverturePage(
  params?: FetchDemandesReouvertureParams,
): Promise<PaginatedResponse<DemandeReouvertureCRQ>> {
  const query: Record<string, string> = {}
  if (params?.statut) query.statut = params.statut
  if (params?.crq) query.crq = String(params.crq)
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<DemandeReouvertureCRQ>>(
    '/demandes-reouverture/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère la première page de demandes de réouverture.
 * Réservé aux widgets ; les pages listes utilisent
 * `fetchDemandesReouverturePage`.
 */
export async function fetchDemandesReouverture(
  params?: FetchDemandesReouvertureParams,
): Promise<DemandeReouvertureCRQ[]> {
  const response = await fetchDemandesReouverturePage(params)
  return response.results
}

export async function validerDemande(
  id: number,
): Promise<DemandeReouvertureCRQ> {
  const response = await api.post<DemandeReouvertureCRQ>(
    `/demandes-reouverture/${id}/valider/`,
  )
  return response.data
}

export async function refuserDemande(
  id: number,
): Promise<DemandeReouvertureCRQ> {
  const response = await api.post<DemandeReouvertureCRQ>(
    `/demandes-reouverture/${id}/refuser/`,
  )
  return response.data
}