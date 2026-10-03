"""
Tests de TachePermission.

Vérifie que chaque rôle a bien les droits définis dans le document :
    - Directeur : tous les droits.
    - Créateur : tous les droits sur sa tâche.
    - Responsable : lecture + PATCH + PUT.
    - Chef de service du responsable : lecture seule (SAFE).
    - Autres : refus.
"""

from types import SimpleNamespace

import pytest

from api.models import StatutTache, Tache
from api.permissions import TachePermission


# ===========================================================================
# Fixtures locales
# ===========================================================================

@pytest.fixture
def tache_du_directeur(directeur, membre):
    """Tâche créée par le Directeur, assignée au membre."""
    return Tache.objects.create(
        titre='Tâche du Directeur',
        statut=StatutTache.A_FAIRE,
        priorite='NORMALE',
        createur=directeur,
        responsable=membre,
    )


@pytest.fixture
def tache_du_membre(membre, chef_projets):
    """Tâche créée par le membre, assignée au membre."""
    return Tache.objects.create(
        titre='Tâche du membre',
        statut=StatutTache.A_FAIRE,
        priorite='NORMALE',
        createur=membre,
        responsable=membre,
    )


@pytest.fixture
def tache_autre_service(directeur, chef_partenariats):
    """Tâche assignée à un chef d'un autre service."""
    return Tache.objects.create(
        titre='Tâche autre service',
        statut=StatutTache.A_FAIRE,
        priorite='NORMALE',
        createur=directeur,
        responsable=chef_partenariats,
    )


# ===========================================================================
# Helper
# ===========================================================================

def requete(user, method='GET'):
    """Construit un faux objet request avec user et method."""
    return SimpleNamespace(user=user, method=method)


def vue():
    """Un objet view vide (non utilisé par la permission)."""
    return SimpleNamespace()


# ===========================================================================
# Tests
# ===========================================================================

@pytest.mark.django_db
class TestTachePermission:

    # ------------------------------------------------------------------
    # has_permission : authentification obligatoire
    # ------------------------------------------------------------------

    def test_has_permission_refuse_utilisateur_anonyme(self):
        from django.contrib.auth.models import AnonymousUser
        perm = TachePermission()
        assert perm.has_permission(requete(AnonymousUser()), vue()) is False

    def test_has_permission_accepte_utilisateur_authentifie(self, membre):
        perm = TachePermission()
        assert perm.has_permission(requete(membre), vue()) is True

    # ------------------------------------------------------------------
    # Directeur : tous les droits
    # ------------------------------------------------------------------

    def test_directeur_peut_lire_toute_tache(self, directeur, tache_du_membre):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(directeur, 'GET'), vue(), tache_du_membre,
        ) is True

    def test_directeur_peut_modifier_toute_tache(self, directeur, tache_du_membre):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(directeur, 'PATCH'), vue(), tache_du_membre,
        ) is True

    def test_directeur_peut_supprimer_toute_tache(self, directeur, tache_du_membre):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(directeur, 'DELETE'), vue(), tache_du_membre,
        ) is True

    # ------------------------------------------------------------------
    # Créateur : tous les droits sur sa tâche
    # ------------------------------------------------------------------

    def test_createur_peut_lire_sa_tache(self, membre, tache_du_membre):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(membre, 'GET'), vue(), tache_du_membre,
        ) is True

    def test_createur_peut_supprimer_sa_tache(self, membre, tache_du_membre):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(membre, 'DELETE'), vue(), tache_du_membre,
        ) is True

    # ------------------------------------------------------------------
    # Responsable : lecture + PATCH/PUT, mais pas DELETE
    # ------------------------------------------------------------------

    def test_responsable_peut_lire_sa_tache(self, membre, tache_du_directeur):
        """Le membre est responsable mais pas créateur."""
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(membre, 'GET'), vue(), tache_du_directeur,
        ) is True

    def test_responsable_peut_patch_sa_tache(self, membre, tache_du_directeur):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(membre, 'PATCH'), vue(), tache_du_directeur,
        ) is True

    def test_responsable_peut_put_sa_tache(self, membre, tache_du_directeur):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(membre, 'PUT'), vue(), tache_du_directeur,
        ) is True

    def test_responsable_ne_peut_pas_delete_sa_tache(self, membre, tache_du_directeur):
        """Le responsable n'est PAS le créateur → pas de suppression."""
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(membre, 'DELETE'), vue(), tache_du_directeur,
        ) is False

    # ------------------------------------------------------------------
    # Chef de service : lecture des tâches de son service
    # ------------------------------------------------------------------

    def test_chef_peut_lire_tache_de_son_service(self, chef_projets, tache_du_membre):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(chef_projets, 'GET'), vue(), tache_du_membre,
        ) is True

    def test_chef_ne_peut_pas_modifier_tache_de_son_service(self, chef_projets, tache_du_membre):
        """Le Chef voit mais ne modifie pas les tâches de son équipe."""
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(chef_projets, 'PATCH'), vue(), tache_du_membre,
        ) is False

    def test_chef_ne_peut_pas_lire_tache_autre_service(self, chef_projets, tache_autre_service):
        """Un Chef Projets ne voit pas les tâches d'un Chef Partenariats."""
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(chef_projets, 'GET'), vue(), tache_autre_service,
        ) is False

    # ------------------------------------------------------------------
    # Autres utilisateurs : refus total
    # ------------------------------------------------------------------

    def test_conseillere_ne_peut_pas_lire_tache_quelconque(
        self, conseillere, tache_du_membre,
    ):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(conseillere, 'GET'), vue(), tache_du_membre,
        ) is False

    def test_secretaire_ne_peut_pas_lire_tache_quelconque(
        self, secretaire, tache_du_membre,
    ):
        perm = TachePermission()
        assert perm.has_object_permission(
            requete(secretaire, 'GET'), vue(), tache_du_membre,
        ) is False