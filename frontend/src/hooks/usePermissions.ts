/**
 * Hook centralisé des permissions frontend.
 * Reflète la matrice backend pour masquer les boutons inutiles.
 *
 * Les contrôles s'appuient sur les RÔLES EFFECTIFS (`roles_effectifs` =
 * rôle propre + rôles délégués en cours renvoyés par /auth/me), jamais
 * sur le seul `user.role` : un délégué doit voir exactement les écrans et
 * actions de la personne qui le supplée.
 */

import { useAuth } from '../context/AuthContext'
import { ROLES_CHEF } from '../types'
import type { Role, Tache, Activite, Instruction } from '../types'

export interface Permissions {
  // Activités
  createActivite: boolean
  modifyActivite: boolean

  // Tâches
  createTache: boolean
  createTacheOrpheline: boolean
  modifyTache: boolean
  reassignTache: boolean
  reporterEcheanceTacheBoolean: boolean

  // Tâches - validation
  validerRejeterTache: boolean

  // Instructions
  createInstruction: boolean

  // Blocages
  createBlocage: boolean

  // Événements
  createEvenement: boolean
  createEvenementPourAutres: boolean

  // Délégations
  createDelegation: boolean

  // CRQ
  createCRQ: boolean

  // Synthèses
  createSynthese: boolean

  // Utilisateurs
  desactiverUtilisateur: boolean
  voirUtilisateurs: boolean
}

/** Ensemble de rôles : `undefined` = utilisateur non chargé. */
export type Roles = Role[] | undefined

/** Un seul des rôles demandés est détenu. */
export function aRole(roles: Roles, ...attendus: Role[]): boolean {
  if (!roles || roles.length === 0) return false
  return attendus.some((r) => roles.includes(r))
}

export function estDirecteur(roles: Roles): boolean {
  return aRole(roles, 'DIRECTEUR')
}

export function estSecretaire(roles: Roles): boolean {
  return aRole(roles, 'SECRETAIRE_DIRECTION')
}

export function estConseillere(roles: Roles): boolean {
  return aRole(roles, 'CONSEILLERE_TECHNIQUE')
}

export function estChefDeService(roles: Roles): boolean {
  return aRole(roles, ...ROLES_CHEF)
}

export function estChefOuDirecteur(roles: Roles): boolean {
  return estDirecteur(roles) || estChefDeService(roles)
}

/** Rôles de direction : directeur, secrétaire ou chef de service. */
export function estRoleDirection(roles: Roles): boolean {
  return estDirecteur(roles) || estSecretaire(roles) || estChefDeService(roles)
}

export function estMembreEquipe(roles: Roles): boolean {
  return aRole(roles, 'MEMBRE_EQUIPE_APPUI')
}

function computePermissions(roles: Roles): Permissions {
  const isDirecteur = estDirecteur(roles)
  const isSecretaire = estSecretaire(roles)
  const isChef = estChefDeService(roles)
  const isConseillereRole = estConseillere(roles)
  const isMembre = estMembreEquipe(roles)

  return {
    // Activités
    createActivite: isDirecteur || isChef,
    modifyActivite: isDirecteur || isChef,

    // Tâches
    createTache: isDirecteur || isChef,
    createTacheOrpheline: isDirecteur,
    modifyTache: isDirecteur || isChef,
    reassignTache: isDirecteur || isChef,
    reporterEcheanceTacheBoolean: isDirecteur || isChef,
    validerRejeterTache: false,

    // Instructions
    createInstruction: isDirecteur || isSecretaire || isChef,

    // Blocages
    createBlocage: true,

    // Événements
    createEvenement: true,
    createEvenementPourAutres: isDirecteur || isSecretaire || isChef,

    // Délégations
    createDelegation: isDirecteur || isChef,

    // CRQ
    createCRQ: true,

    // Synthèses
    createSynthese: isDirecteur || isSecretaire,

    // Utilisateurs
    desactiverUtilisateur: isDirecteur,
    voirUtilisateurs:
      isDirecteur || isSecretaire || isChef || isConseillereRole || isMembre,
  }
}

// ============================================================
// HELPERS CONTEXTUELS
// ============================================================

/** Modifier le contenu (titre, description, priorité, dates). */
export function canEditTache(
  roles: Roles,
  userId: number | undefined,
  tache: Tache,
): boolean {
  if (!roles || !userId) return false
  if (estDirecteur(roles)) return true
  if (estChefDeService(roles)) return true
  if (tache.createur === userId) return true
  return false
}

/** Changer le statut (endpoint dédié autorisé au responsable). */
export function canChangeTacheStatut(
  roles: Roles,
  userId: number | undefined,
  tache: Tache,
): boolean {
  if (!roles || !userId) return false
  if (estDirecteur(roles)) return true
  if (estChefDeService(roles)) return true
  if (tache.createur === userId) return true
  if (tache.responsable === userId) return true
  return false
}

/** Reporter l'échéance (endpoint dédié autorisé au responsable). */
export function canReporterEcheanceTache(
  roles: Roles,
  userId: number | undefined,
  tache: Tache,
): boolean {
  return canChangeTacheStatut(roles, userId, tache)
}

/** Valider ou rejeter une tâche en A_VALIDER. */
export function canValiderRejeterTache(
  roles: Roles,
  userId: number | undefined,
  userServiceActuel: string | null | undefined,
  tache: Tache,
): boolean {
  if (!roles || !userId) return false
  if (tache.statut !== 'A_VALIDER') return false

  const estDirecteurRole = estDirecteur(roles)

  const estChefDuServiceResponsable =
    estChefDeService(roles) &&
    !!tache.responsable_detail?.service &&
    userServiceActuel === tache.responsable_detail.service

  if (!estDirecteurRole && !estChefDuServiceResponsable) return false

  const estResponsablePropre = tache.responsable === userId
  if (estResponsablePropre && !estDirecteurRole) return false

  return true
}

/** Supprimer une tâche. */
export function canDeleteTache(
  roles: Roles,
  userId: number | undefined,
  tache: Tache,
): boolean {
  if (!roles || !userId) return false
  if (estDirecteur(roles)) return true
  if (tache.createur === userId) return true
  return false
}

/** Modifier une activité. */
export function canEditActivite(
  roles: Roles,
  userId: number | undefined,
  activite: Activite,
): boolean {
  if (!roles || !userId) return false
  if (estDirecteur(roles)) return true
  if (estChefDeService(roles) && activite.responsable === userId) return true
  return false
}

/** Supprimer une activité. */
export function canDeleteActivite(
  roles: Roles,
  userId: number | undefined,
  activite: Activite,
): boolean {
  if (!roles || !userId) return false
  if (estDirecteur(roles)) return true
  if (activite.createur === userId) return true
  return false
}

/** Modifier une instruction. */
export function canEditInstruction(
  roles: Roles,
  userId: number | undefined,
  instruction: Instruction,
): boolean {
  if (!roles || !userId) return false
  if (estDirecteur(roles)) return true
  if (instruction.emetteur === userId) return true
  if (estChefDeService(roles)) return true
  return false
}

/** Supprimer une instruction. */
export function canDeleteInstruction(
  roles: Roles,
  userId: number | undefined,
  instruction: Instruction,
): boolean {
  return canEditInstruction(roles, userId, instruction)
}

// ============================================================
// HOOK PRINCIPAL
// ============================================================

export function usePermissions() {
  const { user } = useAuth()

  /**
   * Rôles effectifs. Le repli sur `[user.role]` couvre un /auth/me
   * servi par une version antérieure de l'API, où le champ
   * `roles_effectifs` n'existait pas encore.
   */
  const roles: Role[] | undefined = user
    ? user.roles_effectifs?.length
      ? user.roles_effectifs
      : [user.role]
    : undefined
  const userId = user?.id

  const base = computePermissions(roles)

  return {
    can: {
      ...base,
      // Helpers contextuels
      editTache: (t: Tache) => canEditTache(roles, userId, t),
      changeTacheStatut: (t: Tache) => canChangeTacheStatut(roles, userId, t),
      reporterEcheanceTache: (t: Tache) =>
        canReporterEcheanceTache(roles, userId, t),
      deleteTache: (t: Tache) => canDeleteTache(roles, userId, t),
      editActivite: (a: Activite) => canEditActivite(roles, userId, a),
      deleteActivite: (a: Activite) => canDeleteActivite(roles, userId, a),
      editInstruction: (i: Instruction) =>
        canEditInstruction(roles, userId, i),
      deleteInstruction: (i: Instruction) =>
        canDeleteInstruction(roles, userId, i),
      validerRejeterTache: (t: Tache) =>
        canValiderRejeterTache(roles, userId, user?.service_actuel, t),
    },
    roles,
    role: user?.role,
    userId,
    user,
  }
}