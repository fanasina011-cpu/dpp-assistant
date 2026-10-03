/**
 * Service API pour les instructions.
 *
 * Une instruction a une structure particulière :
 *   - Elle peut cibler une tâche, une activité, ou rien.
 *   - Elle a un ou plusieurs destinataires (relation plusieurs-à-plusieurs
 *     via InstructionDestinataire).
 *
 * La création se fait avec un payload enrichi contenant `destinataire_ids`.
 */

import api from './client'
import type {
  Instruction,
  PaginatedResponse,
  Priorite,
  StatutInstruction,
} from '../types'

export interface FetchInstructionsParams {
  statut?: string
  priorite?: string
  cibleType?: 'TACHE' | 'ACTIVITE' | 'AUCUNE'
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
 * Récupère une page d'instructions (count + next + previous + results).
 */
export async function fetchInstructionsPage(
  params?: FetchInstructionsParams,
): Promise<PaginatedResponse<Instruction>> {
  const query: Record<string, string> = {}
  if (params?.statut) query.statut = params.statut
  if (params?.priorite) query.priorite = params.priorite
  if (params?.cibleType) query.cible_type = params.cibleType
  if (params?.ordering) query.ordering = params.ordering
  if (params?.search) query.search = params.search
  if (params?.dateDebut) query.date_debut = params.dateDebut
  if (params?.dateFin) query.date_fin = params.dateFin
  if (params?.page) query.page = String(params.page)
  if (params?.pageSize) query.page_size = String(params.pageSize)

  const response = await api.get<PaginatedResponse<Instruction>>(
    '/instructions/',
    { params: query },
  )
  return response.data
}

/**
 * Récupère la première page d'instructions.
 * Réservé aux widgets ; les pages listes utilisent `fetchInstructionsPage`.
 */
export async function fetchInstructions(
  params?: FetchInstructionsParams,
): Promise<Instruction[]> {
  const response = await fetchInstructionsPage(params)
  return response.results
}

export async function fetchInstruction(id: number): Promise<Instruction> {
  const response = await api.get<Instruction>(`/instructions/${id}/`)
  return response.data
}

export interface CreateInstructionPayload {
  titre: string
  description: string
  priorite: Priorite
  date_echeance?: string | null
  tache_cible?: number | null
  activite_cible?: number | null
  destinataire_ids: number[]
}

export async function createInstruction(
  payload: CreateInstructionPayload,
): Promise<Instruction> {
  const response = await api.post<Instruction>('/instructions/', payload)
  return response.data
}

export async function updateInstruction(
  id: number,
  payload: Partial<CreateInstructionPayload>,
): Promise<Instruction> {
  const response = await api.patch<Instruction>(`/instructions/${id}/`, payload)
  return response.data
}

export async function deleteInstruction(id: number): Promise<void> {
  await api.delete(`/instructions/${id}/`)
}

/**
 * Change le statut d'un destinataire pour une instruction donnée.
 */
export async function changerStatutDestinataire(
  instructionId: number,
  userId: number,
  nouveauStatut: StatutInstruction,
): Promise<Instruction> {
  const response = await api.patch<Instruction>(
    `/instructions/${instructionId}/destinataires/${userId}/statut/`,
    { statut: nouveauStatut },
  )
  return response.data
}

export async function annulerInstruction(
  id: number,
  motif: string,
): Promise<Instruction> {
  const response = await api.post<Instruction>(`/instructions/${id}/annuler/`, {
    motif,
  })
  return response.data
}
export async function reporterEcheanceInstruction(
  id: number,
  dateEcheance: string,
  motif: string,
): Promise<Instruction> {
  const response = await api.post<Instruction>(
    `/instructions/${id}/reporter-echeance/`,
    { date_echeance: dateEcheance, motif },
  )
  return response.data
}