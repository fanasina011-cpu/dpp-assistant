"""
Tests groupés des permissions restantes :
    - ActivitePermission
    - BlocagePermission
    - EvenementPermission
    - InstructionPermission

Chaque classe suit le même schéma :
    - Directeur : tous les droits
    - Créateur : tous les droits sur sa ressource
    - Autres rôles : selon la règle métier
"""

from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.utils import timezone

from api.models import (
    Activite,
    Blocage,
    Delegation,
    Evenement,
    Instruction,
    RoleChoice,
    StatutTache,
    Tache,
)
from api.permissions import (
    ActivitePermission,
    BlocagePermission,
    EvenementPermission,
    InstructionPermission,
)


# ===========================================================================
# Helpers
# ===========================================================================

def requete(user, method='GET'):
    return SimpleNamespace(user=user, method=method)


def vue():
    return SimpleNamespace()


# ===========================================================================
# Fixtures locales
# ===========================================================================

@pytest.fixture
def activite_du_directeur(directeur):
    return Activite.objects.create(
        titre='Activité du Directeur',
        statut='OUVERTE',
        priorite='NORMALE',
        responsable=directeur,
        createur=directeur,
    )


@pytest.fixture
def activite_chef_projets(chef_projets):
    return Activite.objects.create(
        titre='Activité du Chef Projets',
        statut='OUVERTE',
        priorite='NORMALE',
        responsable=chef_projets,
        createur=chef_projets,
    )


@pytest.fixture
def tache_membre(membre, directeur):
    return Tache.objects.create(
        titre='Tâche du membre',
        statut=StatutTache.EN_COURS,
        priorite='NORMALE',
        createur=directeur,
        responsable=membre,
    )


@pytest.fixture
def blocage_membre(tache_membre, membre):
    return Blocage.objects.create(
        description='Blocage de test sur la tâche du membre.',
        niveau_urgence='MOYENNE',
        statut='EN_ATTENTE',
        tache=tache_membre,
        signale_par=membre,
    )


@pytest.fixture
def evenement_directeur(directeur):
    from datetime import datetime

    return Evenement.objects.create(
        titre='Événement du Directeur',
        type='REUNION',
        date_debut=datetime(2026, 10, 1, 10, 0, 0),
        date_fin=datetime(2026, 10, 1, 11, 0, 0),
        statut='PLANIFIE',
        niveau_priorite='DIRECTION',
        createur=directeur,
    )

@pytest.fixture
def instruction_directeur(directeur, membre):
    instr = Instruction.objects.create(
        titre='Instruction test',
        description='Description test.',
        priorite='NORMALE',
        statut='A_FAIRE',
        emetteur=directeur,
    )
    instr.destinataires.create(destinataire=membre, statut='A_FAIRE')
    return instr


# ===========================================================================
# ActivitePermission
# ===========================================================================

@pytest.mark.django_db
class TestActivitePermission:

    def test_creation_reservee_chef_ou_directeur(self, membre):
        """Un membre ne peut pas créer d'activité."""
        perm = ActivitePermission()
        assert perm.has_permission(requete(membre, 'POST'), vue()) is False

    def test_creation_autorisee_chef(self, chef_projets):
        perm = ActivitePermission()
        assert perm.has_permission(requete(chef_projets, 'POST'), vue()) is True

    def test_creation_autorisee_directeur(self, directeur):
        perm = ActivitePermission()
        assert perm.has_permission(requete(directeur, 'POST'), vue()) is True

    def test_creation_autorisee_chef_delegue(self, chef_projets, membre):
        """Un chef délégué hérite du droit de création (rôles effectifs)."""
        maintenant = timezone.now()
        Delegation.objects.create(
            delegant=chef_projets,
            delegataire=membre,
            role_delegue=RoleChoice.CHEF_SERVICE_PROJETS,
            service='Projets',
            date_debut=maintenant - timedelta(days=1),
            date_fin=maintenant + timedelta(days=1),
        )
        membre.refresh_from_db()
        perm = ActivitePermission()
        assert perm.has_permission(requete(membre, 'POST'), vue()) is True

    def test_directeur_peut_tout(self, directeur, activite_chef_projets):
        perm = ActivitePermission()
        assert perm.has_object_permission(
            requete(directeur, 'DELETE'), vue(), activite_chef_projets,
        ) is True

    def test_createur_peut_tout(self, chef_projets, activite_chef_projets):
        perm = ActivitePermission()
        assert perm.has_object_permission(
            requete(chef_projets, 'DELETE'), vue(), activite_chef_projets,
        ) is True

    def test_secretaire_lecture_seule(self, secretaire, activite_du_directeur):
        perm = ActivitePermission()
        assert perm.has_object_permission(
            requete(secretaire, 'GET'), vue(), activite_du_directeur,
        ) is True
        assert perm.has_object_permission(
            requete(secretaire, 'DELETE'), vue(), activite_du_directeur,
        ) is True  # Le Directeur/Secrétaire est dans le 1er bloc, il a tous droits


# ===========================================================================
# BlocagePermission
# ===========================================================================

@pytest.mark.django_db
class TestBlocagePermission:

    def test_directeur_peut_tout(self, directeur, blocage_membre):
        perm = BlocagePermission()
        assert perm.has_object_permission(
            requete(directeur, 'DELETE'), vue(), blocage_membre,
        ) is True

    def test_signaleur_peut_lire(self, membre, blocage_membre):
        perm = BlocagePermission()
        assert perm.has_object_permission(
            requete(membre, 'GET'), vue(), blocage_membre,
        ) is True

    def test_signaleur_peut_modifier(self, membre, blocage_membre):
        perm = BlocagePermission()
        assert perm.has_object_permission(
            requete(membre, 'PATCH'), vue(), blocage_membre,
        ) is True

    def test_autre_ne_peut_pas(self, conseillere, blocage_membre):
        perm = BlocagePermission()
        assert perm.has_object_permission(
            requete(conseillere, 'GET'), vue(), blocage_membre,
        ) is True  # Conseillère = lecture seule autorisée


# ===========================================================================
# EvenementPermission
# ===========================================================================

@pytest.mark.django_db
class TestEvenementPermission:

    def test_directeur_peut_tout(self, directeur, evenement_directeur):
        perm = EvenementPermission()
        assert perm.has_object_permission(
            requete(directeur, 'DELETE'), vue(), evenement_directeur,
        ) is True

    def test_createur_peut_tout(self, directeur, evenement_directeur):
        perm = EvenementPermission()
        assert perm.has_object_permission(
            requete(directeur, 'DELETE'), vue(), evenement_directeur,
        ) is True

    def test_participant_lecture_seule(self, chef_projets, evenement_directeur):
        evenement_directeur.participants.add(chef_projets)
        perm = EvenementPermission()
        assert perm.has_object_permission(
            requete(chef_projets, 'GET'), vue(), evenement_directeur,
        ) is True
        assert perm.has_object_permission(
            requete(chef_projets, 'DELETE'), vue(), evenement_directeur,
        ) is False


# ===========================================================================
# InstructionPermission
# ===========================================================================

@pytest.mark.django_db
class TestInstructionPermission:

    def test_creation_reservee(self, membre):
        """Un membre ne peut pas émettre d'instruction."""
        perm = InstructionPermission()
        assert perm.has_permission(requete(membre, 'POST'), vue()) is False

    def test_creation_autorisee_chef(self, chef_projets):
        perm = InstructionPermission()
        assert perm.has_permission(requete(chef_projets, 'POST'), vue()) is True

    def test_creation_autorisee_secretaire(self, secretaire):
        perm = InstructionPermission()
        assert perm.has_permission(requete(secretaire, 'POST'), vue()) is True

    def test_directeur_peut_tout(self, directeur, instruction_directeur):
        perm = InstructionPermission()
        assert perm.has_object_permission(
            requete(directeur, 'DELETE'), vue(), instruction_directeur,
        ) is True

    def test_destinataire_peut_lire(self, membre, instruction_directeur):
        perm = InstructionPermission()
        assert perm.has_object_permission(
            requete(membre, 'GET'), vue(), instruction_directeur,
        ) is True

    def test_destinataire_peut_patch(self, membre, instruction_directeur):
        perm = InstructionPermission()
        assert perm.has_object_permission(
            requete(membre, 'PATCH'), vue(), instruction_directeur,
        ) is True

    def test_destinataire_ne_peut_pas_delete(self, membre, instruction_directeur):
        perm = InstructionPermission()
        assert perm.has_object_permission(
            requete(membre, 'DELETE'), vue(), instruction_directeur,
        ) is False