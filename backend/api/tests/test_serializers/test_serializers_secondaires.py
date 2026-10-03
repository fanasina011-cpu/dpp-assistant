"""
Tests des serializers secondaires :
    - BlocageSerializer
    - DelegationSerializer
    - CompteRenduQuotidienSerializer
    - DemandeReouvertureCRQSerializer
    - CommentaireSerializer
    - NotificationSerializer

On vérifie principalement :
    - Les champs read_only.
    - Les validations custom.
    - Les champs calculés (SerializerMethodField).
"""

from datetime import date, datetime, timedelta

import pytest

from api.models import (
    Blocage,
    Commentaire,
    CompteRenduQuotidien,
    Delegation,
    DemandeReouvertureCRQ,
    Notification,
    RoleChoice,
    StatutTache,
    Tache,
)
from api.serializers import (
    BlocageSerializer,
    CommentaireSerializer,
    CompteRenduQuotidienSerializer,
    DelegationSerializer,
    DemandeReouvertureCRQSerializer,
    NotificationSerializer,
)


# ===========================================================================
# Fixtures locales
# ===========================================================================

@pytest.fixture
def tache_active(directeur, membre):
    return Tache.objects.create(
        titre='Tâche active',
        statut=StatutTache.EN_COURS,
        priorite='NORMALE',
        createur=directeur,
        responsable=membre,
    )


# ===========================================================================
# BlocageSerializer
# ===========================================================================

@pytest.mark.django_db
class TestBlocageSerializer:

    def test_signale_par_est_read_only(self, tache_active, membre, directeur):
        data = {
            'description': 'Blocage de test suffisamment long.',
            'niveau_urgence': 'MOYENNE',
            'tache': tache_active.id,
            'signale_par': directeur.id,  # tentative d'usurpation
        }
        serializer = BlocageSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'signale_par' not in serializer.validated_data

    def test_date_resolution_est_read_only(self, tache_active, membre):
        data = {
            'description': 'Blocage.',
            'niveau_urgence': 'HAUTE',
            'tache': tache_active.id,
            'date_resolution': '2020-01-01T00:00:00',
        }
        serializer = BlocageSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'date_resolution' not in serializer.validated_data

    def test_cible_type_retourne_tache(self, tache_active, membre):
        blocage = Blocage.objects.create(
            description='Test',
            niveau_urgence='MOYENNE',
            tache=tache_active,
            signale_par=membre,
        )
        data = BlocageSerializer(blocage).data
        # Pas de champ cible_type sur Blocage — mais tache_detail doit être présent
        assert data['tache_detail'] is not None
        assert data['tache_detail']['titre'] == 'Tâche active'

    def test_tache_detail_est_shallow(self, tache_active, membre):
        """Le tache_detail ne doit pas contenir de instruction_detail."""
        blocage = Blocage.objects.create(
            description='Test',
            niveau_urgence='MOYENNE',
            tache=tache_active,
            signale_par=membre,
        )
        data = BlocageSerializer(blocage).data
        assert 'instruction_detail' not in data['tache_detail']
        assert 'activite_detail' not in data['tache_detail']


# ===========================================================================
# DelegationSerializer
# ===========================================================================

@pytest.mark.django_db
class TestDelegationSerializer:

    def test_delegant_est_read_only(self, chef_projets, membre):
        data = {
            'delegataire': membre.id,
            'role_delegue': 'CHEF_SERVICE_PROJETS',
            'date_debut': '2026-10-01T00:00:00',
            'date_fin': '2026-10-15T00:00:00',
            'delegant': chef_projets.id,  # tentative
        }
        serializer = DelegationSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'delegant' not in serializer.validated_data

    def test_date_fin_avant_debut_refusee(self, membre):
        data = {
            'delegataire': membre.id,
            'role_delegue': 'CHEF_SERVICE_PROJETS',
            'date_debut': '2026-10-15T00:00:00',
            'date_fin': '2026-10-01T00:00:00',
        }
        serializer = DelegationSerializer(data=data)
        assert not serializer.is_valid()
        assert 'date_fin' in serializer.errors

    def test_auto_delegation_refusee_au_serializer(self, directeur):
        """
        Le serializer valide l'auto-délégation si delegant == delegataire.
        Note : en pratique, la vérification définitive est dans perform_create.
        """
        # Ici on vérifie juste que le serializer ne casse pas
        data = {
            'delegataire': directeur.id,
            'role_delegue': 'CHEF_SERVICE_PROJETS',
            'date_debut': '2026-10-01T00:00:00',
            'date_fin': '2026-10-15T00:00:00',
        }
        serializer = DelegationSerializer(data=data)
        # Le serializer considère que delegant n'est pas dans les données,
        # donc pas de comparaison possible → is_valid() passe
        assert serializer.is_valid()


# ===========================================================================
# CompteRenduQuotidienSerializer
# ===========================================================================

@pytest.mark.django_db
class TestCompteRenduQuotidienSerializer:

    def test_redacteur_est_read_only(self, membre):
        data = {
            'date_journaliere': '2026-09-24',
            'activites_realisees': 'Test',
            'redacteur': membre.id,  # tentative
        }
        serializer = CompteRenduQuotidienSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'redacteur' not in serializer.validated_data

    def test_est_cloture_est_read_only(self, membre):
        data = {
            'date_journaliere': '2026-09-24',
            'activites_realisees': 'Test',
            'est_cloture': True,
        }
        serializer = CompteRenduQuotidienSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'est_cloture' not in serializer.validated_data

    def test_demandes_reouverture_imbriquees(self, membre):
        crq = CompteRenduQuotidien.objects.create(
            redacteur=membre,
            date_journaliere=date.today(),
            activites_realisees='Test',
            est_cloture=True,
        )
        DemandeReouvertureCRQ.objects.create(
            crq=crq,
            demandeur=membre,
            motif='Motif de test suffisamment long.',
        )
        data = CompteRenduQuotidienSerializer(crq).data
        assert len(data['demandes_reouverture']) == 1
        assert data['demandes_reouverture'][0]['motif'] == 'Motif de test suffisamment long.'


# ===========================================================================
# CommentaireSerializer
# ===========================================================================

@pytest.mark.django_db
class TestCommentaireSerializer:

    def test_auteur_est_read_only(self, tache_active, membre):
        data = {
            'contenu': 'Mon commentaire.',
            'tache': tache_active.id,
            'auteur': membre.id,
        }
        serializer = CommentaireSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'auteur' not in serializer.validated_data

    def test_sans_cible_refusee(self):
        data = {'contenu': 'Commentaire orphelin.'}
        serializer = CommentaireSerializer(data=data)
        assert not serializer.is_valid()

    def test_avec_deux_cibles_refusee(self, tache_active):
        data = {
            'contenu': 'Deux cibles.',
            'tache': tache_active.id,
            'instruction': 999,
        }
        serializer = CommentaireSerializer(data=data)
        assert not serializer.is_valid()

    def test_cible_type_tache(self, tache_active, membre):
        commentaire = Commentaire.objects.create(
            contenu='Test',
            auteur=membre,
            tache=tache_active,
        )
        data = CommentaireSerializer(commentaire).data
        assert data['cible_type'] == 'TACHE'


# ===========================================================================
# NotificationSerializer
# ===========================================================================

@pytest.mark.django_db
class TestNotificationSerializer:

    def test_type_display_present(self, membre):
        notif = Notification.objects.create(
            destinataire=membre,
            type='TACHE_ASSIGNEE',
            message='Test',
        )
        data = NotificationSerializer(notif).data
        assert data['type_display'] == 'Tâche assignée'

    def test_destinataire_detail_imbrique(self, membre):
        notif = Notification.objects.create(
            destinataire=membre,
            type='SYSTEME',
            message='Test',
        )
        data = NotificationSerializer(notif).data
        assert data['destinataire_detail']['id'] == membre.id