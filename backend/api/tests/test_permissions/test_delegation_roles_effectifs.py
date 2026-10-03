"""Vérification jetable du socle rôles effectifs."""

from datetime import timedelta

import pytest
from django.utils import timezone

from api.models import Delegation, RoleChoice, Utilisateur
from api.permissions import (
    est_chef_de_service,
    est_chef_du_service,
    est_conseillere,
    est_directeur,
)


@pytest.mark.django_db
def test_delegation_accorde_les_droits_de_chef_limites_au_service():
    directeur = Utilisateur.objects.create_user(
        username='dir', password='x', role=RoleChoice.DIRECTEUR,
    )
    chef = Utilisateur.objects.create_user(
        username='chef', password='x', role=RoleChoice.CHEF_SERVICE_PROJETS,
        service='Projets',
    )
    appui = Utilisateur.objects.create_user(
        username='appui', password='x', role=RoleChoice.MEMBRE_EQUIPE_APPUI,
        service='Partenariats',
    )

    maintenant = timezone.now()
    delegation = Delegation.objects.create(
        delegant=chef,
        delegataire=appui,
        role_delegue=RoleChoice.CHEF_SERVICE_PROJETS,
        service='Projets',
        date_debut=maintenant - timedelta(days=1),
        date_fin=maintenant + timedelta(days=1),
    )

    appui.refresh_from_db()
    assert appui.roles_effectifs == {
        RoleChoice.MEMBRE_EQUIPE_APPUI,
        RoleChoice.CHEF_SERVICE_PROJETS,
    }
    assert est_chef_de_service(appui) is True
    assert est_directeur(appui) is False
    assert est_conseillere(appui) is False
    # D4 : périmètre limité au service délégué
    assert appui.service_actuel == 'Projets'
    assert est_chef_du_service(appui, 'Projets') is True
    assert est_chef_du_service(appui, 'Partenariats') is False
    assert appui.roles_effectifs_tries[0] == RoleChoice.MEMBRE_EQUIPE_APPUI

    # Révocation → retour au rôle propre
    delegation.actif = False
    delegation.save()
    appui.refresh_from_db()
    assert est_chef_de_service(appui) is False
    assert appui.chef_service_delegue is None


@pytest.mark.django_db
def test_delegation_expiree_n_accorde_aucun_droit():
    directeur = Utilisateur.objects.create_user(
        username='dir2', password='x', role=RoleChoice.DIRECTEUR,
    )
    chef = Utilisateur.objects.create_user(
        username='chef2', password='x', role=RoleChoice.CHEF_SERVICE_PROJETS,
        service='Projets',
    )
    appui = Utilisateur.objects.create_user(
        username='appui2', password='x', role=RoleChoice.MEMBRE_EQUIPE_APPUI,
    )
    maintenant = timezone.now()
    Delegation.objects.create(
        delegant=chef,
        delegataire=appui,
        role_delegue=RoleChoice.CONSEILLERE_TECHNIQUE,
        date_debut=maintenant - timedelta(days=10),
        date_fin=maintenant - timedelta(days=5),
    )
    appui.refresh_from_db()
    assert est_conseillere(appui) is False
    assert len(appui.roles_effectifs) == 1


@pytest.mark.django_db
def test_avec_role_couvre_la_delegation():
    Utilisateur.objects.create_user(
        username='dir3', password='x', role=RoleChoice.DIRECTEUR,
    )
    chef = Utilisateur.objects.create_user(
        username='chef3', password='x', role=RoleChoice.CHEF_SERVICE_PROJETS,
        service='Projets',
    )
    appui = Utilisateur.objects.create_user(
        username='appui3', password='x', role=RoleChoice.MEMBRE_EQUIPE_APPUI,
    )
    maintenant = timezone.now()
    Delegation.objects.create(
        delegant=chef,
        delegataire=appui,
        role_delegue=RoleChoice.CHEF_SERVICE_PARTENARIATS,
        service='Partenariats',
        date_debut=maintenant - timedelta(hours=1),
        date_fin=maintenant + timedelta(hours=1),
    )
    assert Utilisateur.objects.avec_role(
        RoleChoice.CHEF_SERVICE_PARTENARIATS
    ).count() == 1
    assert Utilisateur.objects.avec_role(
        RoleChoice.CHEF_SERVICE_APPUI
    ).count() == 0


@pytest.mark.django_db
def test_roles_non_delegables_refuses():
    from django.core.exceptions import ValidationError

    directeur = Utilisateur.objects.create_user(
        username='dir4', password='x', role=RoleChoice.DIRECTEUR,
    )
    autre = Utilisateur.objects.create_user(
        username='autre4', password='x', role=RoleChoice.MEMBRE_EQUIPE_APPUI,
    )
    maintenant = timezone.now()
    with pytest.raises(ValidationError):
        Delegation(
            delegant=directeur,
            delegataire=autre,
            role_delegue=RoleChoice.DIRECTEUR,
            date_debut=maintenant,
            date_fin=maintenant + timedelta(days=1),
        ).full_clean()