/**
 * Fonctions utilitaires pour construire et manipuler les dates du calendrier.
 */

/**
 * Retourne un tableau de 42 dates (6 semaines × 7 jours) pour un mois donné.
 * Commence toujours un lundi, inclut des jours du mois précédent/suivant
 * si nécessaire pour compléter la grille.
 */
export function construireGrilleMois(annee: number, mois: number): Date[] {
  // 0 = janvier, 11 = décembre
  const premierJour = new Date(annee, mois, 1)
  const jourSemaine = premierJour.getDay() // 0=dimanche, 1=lundi...

  // Nombre de jours à reculer pour arriver au lundi
  const recul = jourSemaine === 0 ? 6 : jourSemaine - 1

  const debut = new Date(premierJour)
  debut.setDate(premierJour.getDate() - recul)

  const jours: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(debut)
    d.setDate(debut.getDate() + i)
    jours.push(d)
  }
  return jours
}

/**
 * Indique si une date appartient au mois donné.
 */
export function estDansMois(date: Date, annee: number, mois: number): boolean {
  return date.getFullYear() === annee && date.getMonth() === mois
}

/**
 * Indique si deux dates sont le même jour.
 */
export function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Formate une date en `YYYY-MM-DD`.
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Retourne la date au format `YYYY-MM-DDTHH:MM` pour les inputs datetime-local.
 */
export function formatDateTimeLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

/**
 * Noms des mois et jours en français.
 */
export const NOMS_MOIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

export const NOMS_JOURS_COURTS = [
  'Lun',
  'Mar',
  'Mer',
  'Jeu',
  'Ven',
  'Sam',
  'Dim',
]

// ============================================================
// AJOUTS pour vue Semaine / Jour
// ============================================================

export const NOMS_JOURS_LONGS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
]

/**
 * Retourne le lundi 00:00 de la semaine contenant `date`.
 */
export function getDebutSemaine(date: Date): Date {
  const d = new Date(date)
  const jour = d.getDay() // 0=dimanche
  const recul = jour === 0 ? 6 : jour - 1
  d.setDate(d.getDate() - recul)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Retourne les 7 jours (lundi → dimanche) de la semaine de `date`.
 */
export function getJoursSemaine(date: Date): Date[] {
  const debut = getDebutSemaine(date)
  const jours: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(debut)
    d.setDate(debut.getDate() + i)
    jours.push(d)
  }
  return jours
}

/**
 * Formate un ISO en `HH:MM`.
 */
export function formatHeure(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Retourne le nombre de minutes depuis minuit pour un ISO.
 */
export function getMinutesFromMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Ajoute N jours à une date (nouvelle instance).
 */
export function ajouterJours(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/**
 * Indique si deux dates sont le même jour.
 */
export { memeJour as memeJourExport }