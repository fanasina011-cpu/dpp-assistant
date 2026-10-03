/**
 * Helpers pour l'affichage de l'historique des actions.
 */

import type { HistoriqueAction } from '../types'

/** Libellé affiché quand l'action a été faite automatiquement. */
export const LIBELLE_SYSTEME = 'Système'

/**
 * Retourne le nom de l'auteur d'une action.
 *
 * Les actions automatiques (escalade de blocage) n'ont pas d'auteur
 * humain : `auteur_detail` vaut alors null.
 */
export function nomAuteur(action: HistoriqueAction): string {
  return action.auteur_detail?.nom_complet ?? LIBELLE_SYSTEME
}