"""Vérification jetable de la sortie serializer."""

import json
from datetime import timedelta

import pytest
from django.utils import timezone

from api.models import Delegation, RoleChoice, Utilisateur
from api.serializers import DelegationSerializer, UtilisateurSerializer


@pytest.mark.django_db
def test_champ_roles_effectifs_expose():
    chef = Utilisateur.objects.create_user(
        username='chef', password='x',
        role=RoleChoice.CHEF_SERVICE_PROJETS, service='Projets',
    )
    appui = Utilisateur.objects.create_user(
        username='appui', password='x',
        role=RoleChoice.MEMBRE_EQUIPE_APPUI, service='Partenariats',
    )
    maintenant = timezone.now()
    delegation = Delegation.objects.create(
        delegant=chef,
        delegataire=appui,
        role_delegue=RoleChoice.CHEF_SERVICE_APPUI,
        service='Projets',
        date_debut=maintenant - timedelta(hours=1),
        date_fin=maintenant + timedelta(hours=1),
    )

    data = UtilisateurSerializer(appui).data
    assert data['role'] == RoleChoice.MEMBRE_EQUIPE_APPUI
    assert data['role_effectif'] == RoleChoice.MEMBRE_EQUIPE_APPUI
    assert data['roles_effectifs'] == [
        RoleChoice.MEMBRE_EQUIPE_APPUI,
        RoleChoice.CHEF_SERVICE_APPUI,
    ]
    assert data['est_chef_service'] is True
    assert data['a_delegation_active'] is True
    assert data['service_actuel'] == 'Projets'
    assert data['service'] == 'Partenariats'
    assert data['chef_service_delegue_detail']['username'] == 'chef'

    deleg_data = DelegationSerializer(delegation).data
    assert deleg_data['en_cours'] is True
    assert deleg_data['est_active'] is deleg_data['en_cours']

    # JSON-sérialisable (datetime déjà rendu en string par DRF)
    json.dumps(data, default=str)

    # Pas de récursion : le chef imbriqué est bien shallow
    assert 'roles_effectifs' not in data['chef_service_delegue_detail']
    assert 'chef_service_delegue_detail' not in data['chef_service_delegue_detail']


@pytest.mark.django_db
def test_utilisateur_sans_delegation():
    membre = Utilisateur.objects.create_user(
        username='membre', password='x',
        role=RoleChoice.MEMBRE_EQUIPE_APPUI, service='Projets',
    )
    data = UtilisateurSerializer(membre).data
    assert data['roles_effectifs'] == [RoleChoice.MEMBRE_EQUIPE_APPUI]
    assert data['est_chef_service'] is False
    assert data['a_delegation_active'] is False
    assert data['chef_service_delegue_detail'] is None
    assert data['service_actuel'] == 'Projets'