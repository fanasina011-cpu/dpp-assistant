/**
 * Service API pour les KPI serveur.
 *
 * Chaque ViewSet expose un endpoint `GET /<ressource>/stats/` qui calcule
 * les indicateurs sur l'INTÉGRALITÉ du périmètre de l'utilisateur, et non
 * sur la page courante.
 *
 * Un appel générique suffit : le type précis est fourni par l'appelant.
 */

import api from './client'

export interface FetchStatsParams {
  statut?: string
  priorite?: string
  responsable?: number
  activite?: number
  redacteur?: number
  search?: string
  /** Borne basse inclusive, format `YYYY-MM-DD`. */
  dateDebut?: string
  /** Borne haute inclusive sur la journée entière, format `YYYY-MM-DD`. */
  dateFin?: string

  // --- Paramètres par ressource ---
  // Les ViewSets n'acceptent que les filtres qu'ils déclarent dans
  // `filter_queryset` ; un paramètre non géré est ignoré silencieusement.
  // La liste ci-dessous couvre les ressources qui ont un endpoint `/stats/`.

  /** Tâches : ne compter que les tâches sans date d'échéance. */
  sansDate?: boolean
  /** Blocages : `BASSE`, `MOYENNE`, `HAUTE`, `CRITIQUE`. */
  niveauUrgence?: string
  /** Blocages : délai d'escalade dépassé sans être encore escaladé. */
  enAttenteEscalade?: boolean
  /** Blocages, instructions : restreint à une tâche (id). */
  tache?: number
  /** CRQ : `true` pour clôturés, `false` pour en cours. */
  estCloture?: boolean
  /** Délégations : `true` pour les délégations actives. */
  actif?: boolean
  /** Délégations : filtre par rôle délégué. */
  roleDelegue?: string
  /** Notifications : `false` pour les non lues. */
  lue?: boolean
  /** Synthèses : `QUOTIDIENNE`, `HEBDOMADAIRE`, … */
  type?: string
  /** Instructions, historique : nature de la cible. */
  cibleType?: string
  /** Historique : identifiant de la cible dénormalisée. */
  cibleId?: number
  /** Historique : catégorie dérivée de l'action (voir `CATEGORIES_ACTION`). */
  categorie?: string
  /** Utilisateurs : rôle métier (`CHEF_SERVICE_PROJETS`, …). */
  role?: string
}

/**
 * Récupère les KPI d'une ressource.
 *
 * @param ressource  Segment d'URL (`taches`, `blocages`, `notifications`...).
 * @param params     Mêmes filtres que la liste : filtrer la liste filtre les KPI.
 */
export async function fetchStats<T>(
  ressource: string,
  params?: FetchStatsParams,
): Promise<T> {
  const query: Record<string, string> = {}
  if (params?.statut) query.statut = params.statut
  if (params?.priorite) query.priorite = params.priorite
  if (params?.responsable) query.responsable = String(params.responsable)
  if (params?.activite) query.activite = String(params.activite)
  if (params?.redacteur) query.redacteur = String(params.redacteur)
  if (params?.search) query.search = params.search
  if (params?.dateDebut) query.date_debut = params.dateDebut
  if (params?.dateFin) query.date_fin = params.dateFin
  if (params?.sansDate) query.sans_date = 'true'
  if (params?.niveauUrgence) query.niveau_urgence = params.niveauUrgence
  if (params?.enAttenteEscalade) query.en_attente_escalade = 'true'
  if (params?.tache) query.tache = String(params.tache)
  if (params?.estCloture !== undefined) {
    query.est_cloture = String(params.estCloture)
  }
  if (params?.actif !== undefined) query.actif = String(params.actif)
  if (params?.roleDelegue) query.role_delegue = params.roleDelegue
  if (params?.lue !== undefined) query.lue = String(params.lue)
  if (params?.type) query.type = params.type
  if (params?.cibleType) query.cible_type = params.cibleType
  if (params?.cibleId) query.cible_id = String(params.cibleId)
  if (params?.categorie) query.categorie = params.categorie
  if (params?.role) query.role = params.role

  const response = await api.get<T>(`/${ressource}/stats/`, { params: query })
  return response.data
}