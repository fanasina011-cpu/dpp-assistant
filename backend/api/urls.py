"""
Routage de l'application api.

Toutes les routes sont préfixées par /api/v1/ (voir core/urls.py).
"""

from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (
    ActiviteViewSet,
    BlocageViewSet,
    CommentaireViewSet,
    CompteRenduQuotidienViewSet,
    DelegationViewSet,
    DemandeReouvertureCRQViewSet,
    EvenementViewSet,
    HistoriqueActionViewSet,
    InstructionViewSet,
    NotificationViewSet,
    PieceJointeViewSet,
    RechercheViewSet,
    SyntheseViewSet,
    TableauDeBordView,
    TacheViewSet,
    UtilisateurViewSet,
)
from .views_auth import LogoutView, MeView


# Router DRF : génère automatiquement les routes pour chaque ViewSet.
router = DefaultRouter()
router.register(r'taches', TacheViewSet, basename='tache')
router.register(r'activites', ActiviteViewSet, basename='activite')
router.register(r'blocages', BlocageViewSet, basename='blocage')
router.register(r'evenements', EvenementViewSet, basename='evenement')
router.register(r'delegations', DelegationViewSet, basename='delegation')
router.register(r'commentaires', CommentaireViewSet, basename='commentaire')
router.register(r'comptes-rendus', CompteRenduQuotidienViewSet, basename='crq')
router.register(r'demandes-reouverture', DemandeReouvertureCRQViewSet, basename='demande-reouverture')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'syntheses', SyntheseViewSet, basename='synthese')
router.register(r'pieces-jointes', PieceJointeViewSet, basename='piece-jointe')
router.register(r'historique', HistoriqueActionViewSet, basename='historique')
router.register(r'utilisateurs', UtilisateurViewSet, basename='utilisateur')
router.register(r'instructions', InstructionViewSet, basename='instruction')
router.register(r'recherche', RechercheViewSet, basename='recherche')

urlpatterns = [
    # Authentification
    path('auth/login/', TokenObtainPairView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', MeView.as_view(), name='auth-me'),

    # Dashboard
    path('tableau-de-bord/', TableauDeBordView.as_view(), name='tableau-de-bord'),

    # Documentation API (Swagger / Redoc)
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Routes des ViewSets (générées par le router)
    path('', include(router.urls)),
]