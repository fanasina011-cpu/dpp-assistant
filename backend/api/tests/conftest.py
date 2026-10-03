"""
Fixtures partagées pour tous les tests.

Une fixture est un objet (utilisateur, tâche, etc.) que pytest crée
automatiquement pour un test et détruit après. Cela évite de dupliquer
la préparation des données dans chaque test.
"""

import pytest
from django.contrib.auth.hashers import make_password

from api.models import RoleChoice, Utilisateur


# ===========================================================================
# UTILISATEURS DE TEST
# ===========================================================================

@pytest.fixture
def directeur(db):
    """Un utilisateur avec le rôle DIRECTEUR."""
    return Utilisateur.objects.create_user(
        username='test_directeur',
        password='TestDirecteur2026!',
        first_name='Jean',
        last_name='Directeur',
        role=RoleChoice.DIRECTEUR,
        is_active=True,
    )


@pytest.fixture
def chef_projets(db):
    """Un Chef de service Projets."""
    return Utilisateur.objects.create_user(
        username='test_chef_projets',
        password='TestChef2026!',
        first_name='Marie',
        last_name='ChefProjets',
        role=RoleChoice.CHEF_SERVICE_PROJETS,
        service='Projets',
        is_active=True,
    )


@pytest.fixture
def chef_partenariats(db):
    """Un Chef de service Partenariats."""
    return Utilisateur.objects.create_user(
        username='test_chef_partenariats',
        password='TestChef2026!',
        first_name='Luc',
        last_name='ChefPartenariats',
        role=RoleChoice.CHEF_SERVICE_PARTENARIATS,
        service='Partenariats',
        is_active=True,
    )


@pytest.fixture
def secretaire(db):
    """Une Secrétaire de Direction."""
    return Utilisateur.objects.create_user(
        username='test_secretaire',
        password='TestSecretaire2026!',
        first_name='Sophie',
        last_name='Secretaire',
        role=RoleChoice.SECRETAIRE_DIRECTION,
        is_active=True,
    )


@pytest.fixture
def conseillere(db):
    """Une Conseillère Technique."""
    return Utilisateur.objects.create_user(
        username='test_conseillere',
        password='TestConseillere2026!',
        first_name='Claire',
        last_name='Conseillere',
        role=RoleChoice.CONSEILLERE_TECHNIQUE,
        is_active=True,
    )


@pytest.fixture
def membre(db, chef_projets):
    """Un membre d'équipe rattaché au chef_projets."""
    return Utilisateur.objects.create_user(
        username='test_membre',
        password='TestMembre2026!',
        first_name='Paul',
        last_name='Membre',
        role=RoleChoice.MEMBRE_EQUIPE_APPUI,
        service='Projets',
        superieur_proche=chef_projets,
        is_active=True,
    )


@pytest.fixture
def utilisateur_inactif(db):
    """Un utilisateur désactivé."""
    return Utilisateur.objects.create_user(
        username='test_inactif',
        password='TestInactif2026!',
        first_name='Inactif',
        last_name='User',
        role=RoleChoice.MEMBRE_EQUIPE_APPUI,
        is_active=False,
    )


# ===========================================================================
# CLIENT API
# ===========================================================================

@pytest.fixture
def api_client():
    """Client DRF standard (sans authentification)."""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def client_directeur(api_client, directeur):
    """Client DRF authentifié en tant que Directeur."""
    api_client.force_authenticate(user=directeur)
    return api_client


@pytest.fixture
def client_chef_projets(api_client, chef_projets):
    """Client DRF authentifié en tant que Chef Projets."""
    api_client.force_authenticate(user=chef_projets)
    return api_client


@pytest.fixture
def client_chef_partenariats(api_client, chef_partenariats):
    """Client DRF authentifié en tant que Chef Partenariats."""
    api_client.force_authenticate(user=chef_partenariats)
    return api_client


@pytest.fixture
def client_membre(api_client, membre):
    """Client DRF authentifié en tant que Membre."""
    api_client.force_authenticate(user=membre)
    return api_client


@pytest.fixture
def client_secretaire(api_client, secretaire):
    """Client DRF authentifié en tant que Secrétaire."""
    api_client.force_authenticate(user=secretaire)
    return api_client


@pytest.fixture
def client_conseillere(api_client, conseillere):
    """Client DRF authentifié en tant que Conseillère."""
    api_client.force_authenticate(user=conseillere)
    return api_client


@pytest.fixture
def client_chef_projets_delegue(api_client, chef_projets_delegue):
    """Client DRF authentifié en tant que Chef Projets délégué."""
    api_client.force_authenticate(user=chef_projets_delegue)
    return api_client


@pytest.fixture
def client_chef_projets_delegue_expire(api_client, chef_projets_delegue_expire):
    """Client DRF authentifié en tant que Chef Projets délégué (expiré)."""
    api_client.force_authenticate(user=chef_projets_delegue_expire)
    return api_client


@pytest.fixture
def chef_projets_delegue(db, chef_projets, membre):
    """Chef de service Projets par délégation active."""
    from api.models import Delegation
    from django.utils import timezone
    delegation = Delegation.objects.create(
        delegant=chef_projets,
        delegataire=membre,
        role_delegue=RoleChoice.CHEF_SERVICE_PROJETS,
        service='Projets',
        date_debut=timezone.now() - timezone.timedelta(days=1),
        date_fin=timezone.now() + timezone.timedelta(days=1),
        actif=True,
    )
    return membre


@pytest.fixture
def chef_projets_delegue_expire(db, chef_projets, membre):
    """Chef de service Projets par délégation expirée."""
    from api.models import Delegation
    from django.utils import timezone
    delegation = Delegation.objects.create(
        delegant=chef_projets,
        delegataire=membre,
        role_delegue=RoleChoice.CHEF_SERVICE_PROJETS,
        service='Projets',
        date_debut=timezone.now() - timezone.timedelta(days=2),
        date_fin=timezone.now() - timezone.timedelta(days=1),
        actif=True,
    )
    return membre