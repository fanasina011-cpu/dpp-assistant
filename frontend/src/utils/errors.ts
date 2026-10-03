/**
 * Extraction d'un message d'erreur lisible à partir d'une erreur Axios.
 *
 * Les ViewSets DRF renvoient soit `{detail: "..."}` (succès, permission),
 * soit un dictionnaire de champs `{statut: ["..."]}` (validation) : dans
 * ce second cas, on retombe sur le message de l'erreur Axios plutôt que
 * d'afficher un objet.
 */
export function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { detail?: unknown } }
    message?: unknown
  }
  const detail = axiosErr?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (typeof axiosErr?.message === 'string' && axiosErr.message.trim()) {
    return axiosErr.message
  }
  return 'Une erreur est survenue.'
}