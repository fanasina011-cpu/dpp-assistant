"""Vérification jetable : responsable_detail dans TacheShallowSerializer."""

import pytest

from api.models import (
    Activite,
    Blocage,
    RoleChoice,
    StatutBlocage,
    Tache,
    Utilisateur,
)
from api.serializers import TacheShallowSerializer


@pytest.mark.django_db
def test_tache_shallow_expose_responsable_detail():
    responsable = Utilisateur.objects.create_user(
        username='resp', password='x',
        first_name='Rita', last_name='Responsable',
        role=RoleChoice.MEMBRE_EQUIPE_APPUI, service='Projets',
    )
    tache = Tache.objects.create(
        titre='Tâche test',
        description='x',
        createur=responsable,
        responsable=responsable,
    )

    data = TacheShallowSerializer(tache).data
    assert data['responsable'] == responsable.id
    assert data['responsable_detail']['id'] == responsable.id
    assert data['responsable_detail']['service'] == 'Projets'
    assert data['responsable_detail']['nom_complet'] == 'Rita Responsable'
    # Version shallow : pas de rôles effectifs ni de délégation imbriqués
    assert 'roles_effectifs' not in data['responsable_detail']
    assert 'chef_service_delegue_detail' not in data['responsable_detail']


@pytest.mark.django_db
def test_tache_shallow_responsable_null():
    createur = Utilisateur.objects.create_user(
        username='createur', password='x',
        role=RoleChoice.MEMBRE_EQUIPE_APPUI,
    )
    tache = Tache.objects.create(
        titre='Sans responsable',
        description='x',
        createur=createur,
        responsable=None,
    )
    data = TacheShallowSerializer(tache).data
    assert data['responsable'] is None
    assert data['responsable_detail'] is None


@pytest.mark.django_db
def test_blocage_serialise_le_service_du_responsable():
    """Chaîne complète : Blocage → tache_detail → responsable_detail.service."""
    createur = Utilisateur.objects.create_user(
        username='signaleur', password='x',
        role=RoleChoice.MEMBRE_EQUIPE_APPUI, service='Partenariats',
    )
    responsable = Utilisateur.objects.create_user(
        username='resp2', password='x',
        role=RoleChoice.MEMBRE_EQUIPE_APPUI, service='Projets',
    )
    activite = Activite.objects.create(
        titre='Activité',
        description='x',
        createur=createur,
        responsable=responsable,
    )
    tache = Tache.objects.create(
        titre='Tâche bloquée',
        description='x',
        createur=createur,
        responsable=responsable,
        activite=activite,
    )
    blocage = Blocage.objects.create(
        description='Je suis bloqué',
        tache=tache,
        signale_par=createur,
        niveau_urgence='MOYENNE',
        statut=StatutBlocage.EN_TRAITEMENT,
    )

    from api.serializers import BlocageSerializer

    data = BlocageSerializer(blocage).data
    assert data['tache_detail']['responsable_detail']['service'] == 'Projets'