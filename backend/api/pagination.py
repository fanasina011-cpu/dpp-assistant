"""
Pagination standard de l'API.

Appliquée à toutes les ViewSets list via
`REST_FRAMEWORK['DEFAULT_PAGINATION_CLASS']` (voir core/settings.py).

La réponse contient toujours `count`, `next`, `previous` et `results`.
Le frontend s'appuie sur `count` pour afficher la barre de pagination.

`page_size` est pilotable par query param pour les besoins internes
(annuaire : jusqu'à 200 utilisateurs), mais plafonné par max_page_size.
"""

from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200