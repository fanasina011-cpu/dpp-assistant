/**
 * Types TypeScript partagés pour l'application DPP.
 *
 * Ces types reflètent exactement la structure retournée par l'API Django.
 * Si un serializer change côté backend, il faut mettre à jour le type
 * correspondant ici.
 */

// ===========================================================================
// ENUMS (miroir des TextChoices Django)
// ===========================================================================

export type Role =
  | 'DIRECTEUR'
  | 'SECRETAIRE_DIRECTION'
  | 'CHEF_SERVICE_PROJETS'
  | 'CHEF_SERVICE_PARTENARIATS'
  | 'CHEF_SERVICE_APPUI'
  | 'CONSEILLERE_TECHNIQUE'
  | 'MEMBRE_EQUIPE_APPUI'

/** Rôles portant une autorité de pilotage de service. */
export const ROLES_CHEF: Role[] = [
  'CHEF_SERVICE_PROJETS',
  'CHEF_SERVICE_PARTENARIATS',
  'CHEF_SERVICE_APPUI',
]

export type Priorite = 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE'

export type StatutTache =
  | 'A_FAIRE'
  | 'EN_COURS'
  | 'EN_ATTENTE'
  | 'BLOQUEE'
  | 'A_VALIDER'
  | 'TERMINEE'
  | 'ANNULEE'

export type StatutActivite = 'OUVERTE' | 'EN_COURS' | 'CLOTUREE' | 'ANNULEE'

export type StatutInstruction = 'A_FAIRE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE'

export type StatutBlocage =
  | 'EN_ATTENTE'
  | 'EN_TRAITEMENT'
  | 'REMONTE_AU_DIRECTEUR'
  | 'RESOLU'
  | 'CONTESTE'

export type UrgenceBlocage = 'BASSE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE'

export type StatutEvenement = 'PLANIFIE' | 'REALISE' | 'ANNULE'

export type TypeEvenement =
  | 'REUNION'
  | 'RENDEZ_VOUS'
  | 'AUDIENCE'
  | 'DEPLACEMENT'
  | 'RAPPEL'
  | 'ECHEANCE'
  | 'AUTRE'

export type NiveauPriorite = 'DIRECTION' | 'PERSONNEL'

export type TypeSynthese = 'QUOTIDIENNE' | 'HEBDOMADAIRE' | 'MENSUELLE'

export type StatutDemandeReouverture = 'EN_ATTENTE' | 'VALIDEE' | 'REFUSEE'

export type CibleType =
  | 'TACHE'
  | 'INSTRUCTION'
  | 'ACTIVITE'
  | 'EVENEMENT'
  | 'BLOCAGE'
  | 'AUCUNE'

// ===========================================================================
// ENTITÉS
// ===========================================================================

export interface UtilisateurShallow {
  id: number
  username: string
  nom_complet: string
  role: Role
  service: string | null
}

export interface Utilisateur {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  nom_complet: string
  /** Rôle métier propre : jamais modifié par une délégation. */
  role: Role
  role_display: string
  /** Rôle métier principal (identité de l'utilisateur). */
  role_effectif: Role
  /** Rôle propre + rôles délégués en cours, triés par hiérarchie. */
  roles_effectifs: Role[]
  /** Pilote au moins un service (rôle effectif de chef). */
  est_chef_service: boolean
  /** Au moins une délégation est en cours. */
  a_delegation_active: boolean
  /** Service d'affectation. */
  service: string | null
  /** Périmètre d'exercice : service délégué si chef délégué. */
  service_actuel: string | null
  chef_service_delegue_detail: UtilisateurShallow | null
  is_active: boolean
  date_joined: string
}

export interface Evenement {
  id: number
  titre: string
  description: string
  type: TypeEvenement
  type_display: string
  date_debut: string
  date_fin: string
  statut: StatutEvenement
  statut_display: string
  niveau_priorite: NiveauPriorite
  niveau_priorite_display: string
  rappel_envoye: boolean
  createur: number
  createur_detail: Utilisateur
  participants: number[]
  participants_detail: Utilisateur[]
  date_creation: string
}

export interface Activite {
  id: number
  titre: string
  description: string
  statut: StatutActivite
  statut_display: string
  priorite: Priorite
  priorite_display: string
  date_debut: string | null
  date_echeance: string | null
  responsable: number
  responsable_detail: Utilisateur
  createur: number
  createur_detail: Utilisateur
  peut_etre_cloturee: boolean
  date_creation: string
}

export interface Tache {
  id: number
  titre: string
  description: string
  date_debut: string | null
  date_echeance: string | null
  priorite: Priorite
  priorite_display: string
  statut: StatutTache
  statut_display: string
  createur: number
  createur_detail: Utilisateur
  responsable: number | null
  responsable_detail: Utilisateur | null
  instruction: number | null
  instruction_detail: InstructionShallow | null
  activite: number | null
  activite_detail: Activite | null
  est_en_retard: boolean
  date_terminaison: string | null
  date_derniere_notif_retard: string | null
  date_derniere_notif_echeance: string | null
  date_creation: string
}

export interface InstructionShallow {
  id: number
  titre: string
  description: string
  priorite: Priorite
  priorite_display: string
  date_echeance: string | null
  statut: StatutInstruction
  statut_display: string
  emetteur: number
  emetteur_detail: Utilisateur
  tache_cible: number | null
  activite_cible: number | null
  date_creation: string
}

export interface Instruction {
  id: number
  titre: string
  description: string
  priorite: Priorite
  priorite_display: string
  date_echeance: string | null
  statut: StatutInstruction
  statut_display: string
  emetteur: number
  emetteur_detail: Utilisateur
  saisie_par: number | null
  saisie_par_detail: Utilisateur | null
  activite_cible: number | null
  activite_cible_detail: Activite | null
  tache_cible: number | null
  tache_cible_detail: TacheShallow | null
  cible_type: 'TACHE' | 'ACTIVITE' | 'AUCUNE'
  destinataires: InstructionDestinataire[]
  date_creation: string
}

export interface TacheShallow {
  id: number
  titre: string
  description: string
  responsable: number | null
  responsable_detail: UtilisateurShallow | null
  date_debut: string | null
  date_echeance: string | null
  priorite: Priorite
  priorite_display: string
  statut: StatutTache
  statut_display: string
  est_en_retard: boolean
  date_terminaison: string | null
  date_creation: string
}

export interface InstructionDestinataire {
  id: number
  instruction: number
  destinataire: number
  destinataire_detail: Utilisateur
  statut: StatutInstruction
  statut_display: string
  commentaire: string
  date_maj: string
}

export interface Blocage {
  id: number
  description: string
  niveau_urgence: UrgenceBlocage
  niveau_urgence_display: string
  statut: StatutBlocage
  statut_display: string
  tache: number
  tache_detail: TacheShallow
  signale_par: number
  signale_par_detail: Utilisateur
  personne_sollicitee: number | null
  personne_sollicitee_detail: Utilisateur | null
  date_signalement: string
  date_limite_action: string | null
  date_resolution: string | null
  resolu_par: number | null
  resolu_par_detail: Utilisateur | null
  motif_contestation: string | null
  date_contestation: string | null
  date_derniere_notif_rappel_contestation: string | null
}

export interface Delegation {
  id: number
  delegant: number
  delegant_detail: Utilisateur
  delegataire: number
  delegataire_detail: Utilisateur
  role_delegue: Role
  role_delegue_display: string
  service: string | null
  date_debut: string
  date_fin: string
  actif: boolean
  est_active: boolean
  date_creation: string
}

export interface CompteRenduQuotidien {
  id: number
  redacteur: number
  redacteur_detail: Utilisateur
  date_journaliere: string
  activites_realisees: string
  activites_en_cours: string
  activites_non_realisees: string
  difficultes: string
  prevues_lendemain: string
  est_cloture: boolean
  demandes_reouverture: DemandeReouvertureCRQShallow[]
  date_creation: string
}

export interface DemandeReouvertureCRQShallow {
  id: number
  demandeur: number
  demandeur_detail: Utilisateur
  motif: string
  statut: StatutDemandeReouverture
  statut_display: string
  date_demande: string
}

export interface DemandeReouvertureCRQ {
  id: number
  crq: number
  crq_detail: {
    id: number
    date_journaliere: string
    est_cloture: boolean
    redacteur: number
  }
  demandeur: number
  demandeur_detail: Utilisateur
  motif: string
  statut: StatutDemandeReouverture
  statut_display: string
  validee_par: number | null
  validee_par_detail: Utilisateur | null
  date_demande: string
  date_validation: string | null
}

export interface Commentaire {
  id: number
  contenu: string
  auteur: number
  auteur_detail: Utilisateur
  tache: number | null
  instruction: number | null
  activite: number | null
  cible_type: 'TACHE' | 'INSTRUCTION' | 'ACTIVITE' | 'AUCUNE'
  date_creation: string
}

export interface Notification {
  id: number
  destinataire: number
  destinataire_detail: Utilisateur
  type: string
  type_display: string
  message: string
  lue: boolean
  date_creation: string
}

export interface Synthese {
  id: number
  type: TypeSynthese
  type_display: string
  periode_debut: string
  periode_fin: string
  contenu: string
  genere_par: number | null
  genere_par_detail: Utilisateur | null
  date_generation: string
}

export interface PieceJointe {
  id: number
  nom_fichier: string
  chemin: string
  uploade_par: number
  uploade_par_detail: Utilisateur
  tache: number | null
  instruction: number | null
  activite: number | null
  evenement: number | null
  blocage: number | null
  cible_type: CibleType
  cible_id: number | null
  date_upload: string
}

export interface HistoriqueAction {
  id: number
  action: string
  auteur: number | null
  auteur_detail: Utilisateur | null
  tache: number | null
  instruction: number | null
  blocage: number | null
  activite: number | null
  cible_type: CibleType
  cible_id: number | null
  details: string
  date_action: string
}

// ===========================================================================
// PAGINATION
// ===========================================================================

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ===========================================================================
// KPI SERVEUR
// ===========================================================================
//
// Les KPI sont calculés par le serveur sur l'INTÉGRALITÉ du périmètre de
// l'utilisateur, et non sur la page courante. Ils sont exposés séparément
// de `PaginatedResponse` : les mélanger à l'enveloppe paginée ferait
// confondre `count` (total filtré) et les compteurs métier.

export interface StatsTaches {
  total: number
  par_statut: Record<string, number>
  en_cours: number
  a_valider: number
  terminees: number
  en_retard: number
}

export interface StatsActivites {
  total: number
  par_statut: Record<string, number>
  en_cours: number
  cloturables: number
}

export interface StatsBlocages {
  total: number
  par_statut: Record<string, number>
  non_resolus: number
  critiques: number
  en_attente_escalade: number
  contestes: number
}

export interface StatsDelegations {
  total: number
  actives: number
  planifiees: number
  par_role_delegue: Record<string, number>
}

export interface StatsCRQ {
  total: number
  en_cours: number
  clotures: number
  demandes_reouverture: number
}

export interface StatsSyntheses {
  total: number
  par_type: Record<string, number>
}

export interface StatsInstructions {
  total: number
  par_statut: Record<string, number>
  en_cours: number
  a_faire: number
}

export interface StatsNotifications {
  total: number
  non_lues: number
  par_type: Record<string, number>
}

export interface StatsHistorique {
  total: number
  systeme: number
  par_action: Record<string, number>
  par_cible: Record<string, number>
}

export interface StatsUtilisateurs {
  total: number
  par_role: Record<string, number>
  par_service: Record<string, number>
}

// ===========================================================================
// RECHERCHE TRANSVERSALE
// ===========================================================================

export type TypeResultatRecherche =
  | 'taches'
  | 'instructions'
  | 'activites'
  | 'blocages'
  | 'evenements'

export interface ResultatRecherche {
  id: number
  type: TypeResultatRecherche
  libelle: string
  sous_titre: string
}

export interface GroupeResultatsRecherche {
  /** Nombre total de correspondances (non plafonné). */
  total: number
  /** Aperçu limité à 5 éléments par type. */
  items: ResultatRecherche[]
}

export interface ReponseRecherche {
  q: string
  total: number
  resultats: Partial<Record<TypeResultatRecherche, GroupeResultatsRecherche>>
}

// ===========================================================================
// AUTHENTIFICATION
// ===========================================================================

export interface LoginResponse {
  access: string
  refresh: string
}

export interface LoginPayload {
  username: string
  password: string
}