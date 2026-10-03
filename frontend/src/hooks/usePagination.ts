/**
 * État de pagination d'une page liste.
 *
 * - `page` : page courante (1-based), à transmettre à l'API.
 * - `pageSize` : taille de page, à transmettre via `page_size`.
 * - `resetDeps` : dès qu'une de ces valeurs change, on revient à la page 1
 *   (sinon on peut atterrir sur une page 4 devenue vide après un filtre).
 *
 * Le nombre de valeurs dans `resetDeps` doit rester constant pour un
 * composant donné (contrainte de React sur les dépendances d'effet).
 */

import { useEffect, useState } from 'react'

export const PAGE_SIZE_DEFAUT = 20

interface UsePaginationOptions {
  pageSize?: number
  resetDeps?: unknown[]
}

export function usePagination({
  pageSize: tailleInitiale = PAGE_SIZE_DEFAUT,
  resetDeps = [],
}: UsePaginationOptions = {}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(tailleInitiale)

  useEffect(() => {
    setPage(1)
  }, resetDeps)

  return { page, setPage, pageSize, setPageSize }
}