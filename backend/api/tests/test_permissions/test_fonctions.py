"""
Tests des fonctions utilitaires de permissions.py.

Ces fonctions sont utilisées partout dans les ViewSets pour vérifier
le rôle de l'utilisateur. Une erreur ici casserait tout le RBAC.
"""

import pytest

from api.models import RoleChoice
from api.permissions import (
    est_chef_de_service,
    est_chef_ou_directeur,
    est_conseillere,
    est_directeur,
    est_membre_equipe,
    est_secretaire,
)


@pytest.mark.django_db
class TestFonctionsRoles:

    # -------------------------------------------------------------------
    # est_directeur
    # -------------------------------------------------------------------

    def test_est_directeur_avec_directeur(self, directeur):
        assert est_directeur(directeur) is True

    def test_est_directeur_avec_chef(self, chef_projets):
        assert est_directeur(chef_projets) is False

    def test_est_directeur_avec_membre(self, membre):
        assert est_directeur(membre) is False

    def test_est_directeur_avec_utilisateur_non_authentifie(self):
        """Un objet anonyme n'a pas is_authenticated = True."""
        from django.contrib.auth.models import AnonymousUser
        anonyme = AnonymousUser()
        assert est_directeur(anonyme) is False

    # -------------------------------------------------------------------
    # est_chef_de_service
    # -------------------------------------------------------------------

    def test_est_chef_de_service_avec_chef_projets(self, chef_projets):
        assert est_chef_de_service(chef_projets) is True

    def test_est_chef_de_service_avec_chef_partenariats(self, chef_partenariats):
        assert est_chef_de_service(chef_partenariats) is True

    def test_est_chef_de_service_avec_directeur(self, directeur):
        assert est_chef_de_service(directeur) is False

    def test_est_chef_de_service_avec_membre(self, membre):
        assert est_chef_de_service(membre) is False

    # -------------------------------------------------------------------
    # est_secretaire
    # -------------------------------------------------------------------

    def test_est_secretaire_avec_secretaire(self, secretaire):
        assert est_secretaire(secretaire) is True

    def test_est_secretaire_avec_directeur(self, directeur):
        assert est_secretaire(directeur) is False

    # -------------------------------------------------------------------
    # est_conseillere
    # -------------------------------------------------------------------

    def test_est_conseillere_avec_conseillere(self, conseillere):
        assert est_conseillere(conseillere) is True

    def test_est_conseillere_avec_membre(self, membre):
        assert est_conseillere(membre) is False

    # -------------------------------------------------------------------
    # est_membre_equipe
    # -------------------------------------------------------------------

    def test_est_membre_equipe_avec_membre(self, membre):
        assert est_membre_equipe(membre) is True

    def test_est_membre_equipe_avec_chef(self, chef_projets):
        assert est_membre_equipe(chef_projets) is False

    # -------------------------------------------------------------------
    # est_chef_ou_directeur
    # -------------------------------------------------------------------

    def test_est_chef_ou_directeur_avec_directeur(self, directeur):
        assert est_chef_ou_directeur(directeur) is True

    def test_est_chef_ou_directeur_avec_chef(self, chef_projets):
        assert est_chef_ou_directeur(chef_projets) is True

    def test_est_chef_ou_directeur_avec_membre(self, membre):
        assert est_chef_ou_directeur(membre) is False

    def test_est_chef_ou_directeur_avec_secretaire(self, secretaire):
        assert est_chef_ou_directeur(secretaire) is False