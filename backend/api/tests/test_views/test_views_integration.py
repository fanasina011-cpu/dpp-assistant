"""
Tests d'intégration API (endpoints).

On vérifie :
    - Les statuts HTTP (200, 201, 400, 401, 403, 404, 409).
    - Le filtrage RBAC.
    - Les actions personnalisées.
"""

from datetime import date, datetime, timedelta

import pytest
from rest_framework.test import APIClient

from api.models import (
    Activite,
    Blocage,
    CompteRenduQuotidien,
    HistoriqueAction,
    RoleChoice,
    StatutTache,
    Tache,
)
from api.views import TacheViewSet


# ===========================================================================
# Authentification
# ===========================================================================

@pytest.mark.django_db
class TestAuthEndpoints:

    def test_login_valide(self, directeur):
        client = APIClient()
        response = client.post('/api/v1/auth/login/', {
            'username': 'test_directeur',
            'password': 'TestDirecteur2026!',
        }, format='json')
        assert response.status_code == 200
        assert 'access' in response.data
        assert 'refresh' in response.data

    def test_login_invalide(self):
        client = APIClient()
        response = client.post('/api/v1/auth/login/', {
            'username': 'inexistant',
            'password': 'mauvais',
        }, format='json')
        assert response.status_code == 401

    def test_me_sans_token(self):
        client = APIClient()
        response = client.get('/api/v1/auth/me/')
        assert response.status_code == 401

    def test_me_avec_token(self, client_directeur):
        response = client_directeur.get('/api/v1/auth/me/')
        assert response.status_code == 200
        assert response.data['username'] == 'test_directeur'


# ===========================================================================
# Tâches
# ===========================================================================

@pytest.mark.django_db
class TestTachesEndpoints:

    def test_liste_avec_authentification(self, client_directeur):
        response = client_directeur.get('/api/v1/taches/')
        assert response.status_code == 200

    def test_liste_sans_authentification(self):
        client = APIClient()
        response = client.get('/api/v1/taches/')
        assert response.status_code == 401

    def test_creation_force_createur(self, client_directeur, directeur):
        response = client_directeur.post('/api/v1/taches/', {
            'titre': 'Nouvelle tâche test',
            'priorite': 'NORMALE',
        }, format='json')
        assert response.status_code == 201
        assert response.data['createur'] == directeur.id

    def test_creation_titre_vide_refusee(self, client_directeur):
        response = client_directeur.post('/api/v1/taches/', {
            'titre': '',
            'priorite': 'NORMALE',
        }, format='json')
        assert response.status_code == 400

    def test_membre_ne_voit_que_ses_taches(self, client_membre, membre, directeur):
        # Créer une tâche pour le membre
        Tache.objects.create(
            titre='Ma tâche',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        # Créer une tâche pour quelqu'un d'autre
        Tache.objects.create(
            titre='Autre tâche',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=directeur,
            responsable=directeur,
        )

        response = client_membre.get('/api/v1/taches/')
        assert response.status_code == 200
        titres = [t['titre'] for t in response.data['results']]
        assert 'Ma tâche' in titres
        assert 'Autre tâche' not in titres

    def test_changer_statut(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche à changer',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'EN_COURS'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'EN_COURS'

    def test_annulation_sans_motif_refusee(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche à annuler',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'ANNULEE'},
            format='json',
        )
        assert response.status_code == 400
        assert 'motif' in str(response.data).lower()

    def test_annulation_avec_motif_acceptee(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche à annuler',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'ANNULEE', 'motif': 'Motif suffisamment long.'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'ANNULEE'

    def test_trouver_validateur_est_coherent_avec_est_validateur(self, membre, chef_projets):
        tache = Tache.objects.create(
            titre='Tâche cohérence validateur',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=chef_projets,
            responsable=membre,
        )
        validateur = TacheViewSet()._trouver_validateur(tache)
        assert validateur is not None
        assert TacheViewSet()._est_validateur(validateur, tache), \
            "_trouver_validateur et _est_validateur divergent"


# ===========================================================================
# Blocages
# ===========================================================================

@pytest.mark.django_db
class TestBlocagesEndpoints:

    def test_signalement_bascule_tache_en_bloquee(
        self, client_membre, membre, directeur,
    ):
        tache = Tache.objects.create(
            titre='Tâche à bloquer',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.post('/api/v1/blocages/', {
            'description': 'Blocage de test suffisamment long.',
            'niveau_urgence': 'MOYENNE',
            'tache': tache.id,
        }, format='json')
        assert response.status_code == 201
        tache.refresh_from_db()
        assert tache.statut == 'BLOQUEE'

    def test_resolution_rebascule_tache_en_cours(
        self, client_directeur, membre, directeur,
    ):
        tache = Tache.objects.create(
            titre='Tâche bloquée',
            statut=StatutTache.BLOQUEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        blocage = Blocage.objects.create(
            description='Test.',
            niveau_urgence='MOYENNE',
            tache=tache,
            signale_par=membre,
        )
        response = client_directeur.post(
            f'/api/v1/blocages/{blocage.id}/resoudre/',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'EN_COURS'
        blocage.refresh_from_db()
        assert blocage.statut == 'RESOLU'


# ===========================================================================
# CRQ
# ===========================================================================

@pytest.mark.django_db
class TestCRQEndpoints:

    def test_creation_crq(self, client_membre, membre):
        response = client_membre.post('/api/v1/comptes-rendus/', {
            'date_journaliere': str(date.today()),
            'activites_realisees': 'Test.',
        }, format='json')
        assert response.status_code == 201
        assert response.data['redacteur'] == membre.id

    def test_crq_du_jour_deja_cree_refuse(self, client_membre, membre):
        CompteRenduQuotidien.objects.create(
            redacteur=membre,
            date_journaliere=date.today(),
            activites_realisees='Existant.',
        )
        response = client_membre.post('/api/v1/comptes-rendus/', {
            'date_journaliere': str(date.today()),
            'activites_realisees': 'Nouveau.',
        }, format='json')
        assert response.status_code == 400


# ===========================================================================
# Utilisateurs
# ===========================================================================

@pytest.mark.django_db
class TestUtilisateursEndpoints:

    def test_liste_utilisateurs_authentifie(self, client_membre):
        response = client_membre.get('/api/v1/utilisateurs/')
        assert response.status_code == 200

    def test_utilisateur_anonyme_refuse(self):
        client = APIClient()
        response = client.get('/api/v1/utilisateurs/')
        assert response.status_code == 401


# ===========================================================================
# Désactivation utilisateur
# ===========================================================================

@pytest.mark.django_db
class TestDesactivationUtilisateur:

    def test_desactivation_reservee_directeur(self, client_membre, membre):
        response = client_membre.post(
            f'/api/v1/utilisateurs/{membre.id}/desactiver/',
        )
        assert response.status_code == 403

    def test_desactivation_sans_elements_ok(self, client_directeur, membre):
        # Membre sans tâche active
        response = client_directeur.post(
            f'/api/v1/utilisateurs/{membre.id}/desactiver/',
            {},
            format='json',
        )
        assert response.status_code == 200
        membre.refresh_from_db()
        assert membre.is_active is False

    def test_desactivation_avec_elements_retourne_409(
        self, client_directeur, membre, directeur,
    ):
        Tache.objects.create(
            titre='Tâche active',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_directeur.post(
            f'/api/v1/utilisateurs/{membre.id}/desactiver/',
            {},
            format='json',
        )
        assert response.status_code == 409
        assert response.data['statut'] == 'BLOQUEE'


@pytest.mark.django_db
class TestCloturerActivite:

    def test_cloturer_autorisee_si_toutes_taches_terminees(
        self, client_directeur, directeur, membre,
    ):
        activite = Activite.objects.create(
            titre='Activité cloturable',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        Tache.objects.create(
            titre='Tâche terminée',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            activite=activite,
        )
        response = client_directeur.post(
            f'/api/v1/activites/{activite.id}/cloturer/',
            {}, format='json',
        )
        assert response.status_code == 200
        activite.refresh_from_db()
        assert activite.statut == 'CLOTUREE'

    def test_cloturer_refusee_si_tache_a_valider(
        self, client_directeur, directeur, membre,
    ):
        activite = Activite.objects.create(
            titre='Activité avec tâche à valider',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        Tache.objects.create(
            titre='Tâche à valider',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            activite=activite,
        )
        response = client_directeur.post(
            f'/api/v1/activites/{activite.id}/cloturer/',
            {}, format='json',
        )
        assert response.status_code == 400
        assert 'tâches' in str(response.data['detail']).lower()


# ===========================================================================
# Historique — isolation du périmètre RBAC
# ===========================================================================

@pytest.mark.django_db
class TestHistoriquePerimetreRBAC:
    """
    Non-régression sécurité : `HistoriqueActionViewSet.get_queryset` appliquait
    les 4 filtres d'entité (`?tache=`, `?instruction=`, `?blocage=`,
    `?activite=`) par `return` précoce, AVANT tout contrôle de rôle.

    Conséquence : `GET /api/v1/historique/?tache=<id>` renvoyait l'historique
    de n'importe quelle tâche à n'importe quel utilisateur authentifié.

    Le filtre d'entité doit désormais être appliqué DANS le périmètre RBAC.
    """

    def test_membre_ne_peut_pas_lire_historique_tache_autrui(
        self, client_membre, membre, directeur,
    ):
        # Tâche du Directeur : le membre n'a aucun lien avec elle.
        tache_autrui = Tache.objects.create(
            titre='Tâche confidentielle du Directeur',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=directeur,
        )
        # Action signée par le Directeur sur sa propre tâche.
        HistoriqueAction.objects.create(
            auteur=directeur,
            action='TACHE_MODIFIEE',
            details='Information confidentielle.',
            tache=tache_autrui,
        )

        response = client_membre.get(
            f'/api/v1/historique/?tache={tache_autrui.id}',
        )

        assert response.status_code == 200
        assert response.data['count'] == 0
        assert response.data['results'] == []

    def test_membre_peut_lire_historique_de_ses_taches(
        self, client_membre, membre, directeur,
    ):
        """Contre-épreuve : le filtre d'entité reste fonctionnel sur le périmètre autorisé."""
        tache_membre = Tache.objects.create(
            titre='Ma tâche',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        action = HistoriqueAction.objects.create(
            auteur=directeur,
            action='TACHE_REAFFECTEE',
            details='Tâche réaffectée au membre.',
            tache=tache_membre,
        )

        response = client_membre.get(
            f'/api/v1/historique/?tache={tache_membre.id}',
        )

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['id'] == action.id

    def test_directeur_peut_lire_historique_tache_autrui(
        self, client_directeur, directeur, membre,
    ):
        """Contre-épreuve : le Directeur garde l'accès total."""
        tache = Tache.objects.create(
            titre='Tâche du membre',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        action = HistoriqueAction.objects.create(
            auteur=membre,
            action='TACHE_COMMENTEE',
            details='Action du membre.',
            tache=tache,
        )

        response = client_directeur.get(f'/api/v1/historique/?tache={tache.id}')

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['id'] == action.id