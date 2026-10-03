/**
 * Service API pour le tableau de bord.
 *
 * Un seul appel à /tableau-de-bord/ retourne tous les KPIs et listes.
 */

import api from './client'
import type { Blocage, Evenement, Notification, Tache } from '../types'

export interface DashboardKPIs {
  taches_en_retard: number
  taches_en_cours: number
  taches_terminees_aujourd_hui: number
  blocages_urgents: number
  notifications_non_lues: number
  demandes_crq_attente: number
  instructions_en_attente: number
}

export interface DelegationActiveSummary {
  id: number
  delegataire: string
  role_delegue_display: string
  date_fin: string
}

export interface DashboardData {
  kpis: DashboardKPIs
  taches_retard: Tache[]
  blocages_urgents: Blocage[]
  mes_taches: Tache[]
  evenements_jour: Evenement[]
  dernieres_notifications: Notification[]
  delegations_actives: DelegationActiveSummary[]
}

export async function fetchDashboard(): Promise<DashboardData> {
  const response = await api.get<DashboardData>('/tableau-de-bord/')
  return response.data
}