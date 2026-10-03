"""
Tests du modèle Utilisateur.

On vérifie :
    - La création avec un rôle par défaut.
    - La méthode get_nom_complet().
    - La méthode roles_effectifs() (retourne juste le rôle réel pour l'instant).
    - Le __str__.
"""

import pytest

from api.models import RoleChoice, Utilisateur


@pytest.mark.django_db
class TestUtilisateurModel:

    def test_creation_avec_role_par_defaut(self):
        """Sans précision, un utilisateur reçoit le rôle MEMBRE_EQUIPE_APPUI."""
        user = Utilisateur.objects.create_user(
            username='simple',
            password='Pass1234!',
        )
        assert user.role == RoleChoice.MEMBRE_EQUIPE_APPUI

    def test_get_nom_complet_avec_prenom_nom(self, directeur):
        """get_nom_complet() concatène prénom + nom."""
        assert directeur.get_nom_complet() == 'Jean Directeur'

    def test_get_nom_complet_sans_prenom_nom(self):
        """Sans prénom ni nom, get_nom_complet() retourne le username."""
        user = Utilisateur.objects.create_user(
            username='sans_nom',
            password='Pass1234!',
        )
        assert user.get_nom_complet() == 'sans_nom'

    def test_roles_effectifs_retourne_role_reel(self, directeur):
        """Sans délégation en cours, roles_effectifs ne contient que le rôle réel."""
        assert directeur.roles_effectifs == {RoleChoice.DIRECTEUR}

    def test_str_affiche_nom_et_role(self, directeur):
        """Le __str__ affiche le nom complet et le rôle."""
        s = str(directeur)
        assert 'Jean Directeur' in s
        assert 'Directeur' in s