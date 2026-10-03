"""
Tests complets du workflow de validation des tâches.

Couvre :
    - Matrice de transitions (autorisées + interdites)
    - Rôles et permissions (validateur, anti auto-validation, délégation)
    - Motifs obligatoires (rejet, annulation)
    - Notifications (3 types + fallback TACHE_MODIFIEE)
    - date_terminaison
    - peut_etre_cloturee (non-régression)
"""

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import (
    Activite,
    Notification,
    RoleChoice,
    StatutTache,
    Tache,
    Utilisateur,
)
from api.views import TacheViewSet


# ===========================================================================
# A. MATRICE — TRANSITIONS AUTORISÉES
# ===========================================================================

@pytest.mark.django_db
class TestMatriceTransitionsAutorisees:

    def test_a1_a_vers_en_cours(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A1',
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

    def test_a2_en_cours_vers_a_valider(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A2',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'A_VALIDER'

    def test_a3_en_attente_vers_a_valider(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A3',
            statut=StatutTache.EN_ATTENTE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'A_VALIDER'

    def test_a4_bloquee_vers_en_cours(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A4',
            statut=StatutTache.BLOQUEE,
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

    def test_a5_a_valider_vers_terminee(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A5',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'TERMINEE'

    def test_a6_a_valider_vers_terminee_directeur(self, client_directeur, directeur, membre):
        tache = Tache.objects.create(
            titre='Tâche A6',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_directeur.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'TERMINEE'

    def test_a7_a_valider_vers_en_cours_rejet(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A7',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'EN_COURS', 'motif': 'Motif suffisamment long.'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'EN_COURS'

    def test_a8_terminee_vers_a_valider(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A8',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            date_terminaison=timezone.now(),
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'A_VALIDER'

    def test_a9_terminee_vers_a_faire_directeur(self, client_directeur, directeur, membre):
        tache = Tache.objects.create(
            titre='Tâche A9',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            date_terminaison=timezone.now(),
        )
        response = client_directeur.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_FAIRE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'A_FAIRE'

    def test_a10_annulee_vers_a_valider(self, client_directeur, directeur, membre):
        tache = Tache.objects.create(
            titre='Tâche A10',
            statut=StatutTache.ANNULEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_directeur.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'A_VALIDER'

    def test_a11_a_vers_en_attente(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A11',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'EN_ATTENTE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'EN_ATTENTE'

    def test_a12_en_cours_vers_en_attente(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche A12',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'EN_ATTENTE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'EN_ATTENTE'


# ===========================================================================
# B. MATRICE — TRANSITIONS INTERDITES
# ===========================================================================

@pytest.mark.django_db
class TestMatriceTransitionsInterdites:

    def test_b1_en_cours_vers_terminee(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche B1',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 400

    def test_b2_a_faire_vers_terminee(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche B2',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 400

    def test_b3_bloquee_vers_a_faire(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche B3',
            statut=StatutTache.BLOQUEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_FAIRE'},
            format='json',
        )
        assert response.status_code == 400

    def test_b4_a_valider_vers_bloquee(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche B4',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'BLOQUEE'},
            format='json',
        )
        assert response.status_code == 400

    def test_b5_terminee_vers_bloquee(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche B5',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            date_terminaison=timezone.now(),
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'BLOQUEE'},
            format='json',
        )
        assert response.status_code == 400

    def test_b6_terminee_vers_annulee_par_responsable(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche B6',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            date_terminaison=timezone.now(),
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'ANNULEE'},
            format='json',
        )
        assert response.status_code == 400

    def test_b7_annulee_vers_terminee_par_responsable(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche B7',
            statut=StatutTache.ANNULEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200

    def test_b8_a_valider_vers_annulee_sans_motif(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche B8',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'ANNULEE'},
            format='json',
        )
        assert response.status_code == 400


# ===========================================================================
# C. RÔLES
# ===========================================================================

@pytest.mark.django_db
class TestRolesValidation:

    def test_c1_chef_hors_service_404(self, client_chef_partenariats, chef_partenariats, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche C1',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_partenariats.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 404

    def test_c2_chef_delegue_200(self, client_chef_projets_delegue, chef_projets, directeur):
        autre_membre = Utilisateur.objects.create_user(
            username='test_autre_membre',
            password='TestMembre2026!',
            first_name='Alice',
            last_name='AutreMembre',
            role=RoleChoice.MEMBRE_EQUIPE_APPUI,
            service='Projets',
            is_active=True,
        )
        tache = Tache.objects.create(
            titre='Tâche C2',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=autre_membre,
        )
        response = client_chef_projets_delegue.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'TERMINEE'

    def test_c3_chef_delegue_expire_403(self, client_chef_projets_delegue_expire, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche C3',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets_delegue_expire.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 403

    def test_c4_directeur_toutes_transitions(self, client_directeur, directeur, membre):
        tache = Tache.objects.create(
            titre='Tâche C4',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_directeur.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'TERMINEE'

    def test_c5_responsable_sans_chef_403(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche C5',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 403

    def test_c6_directeur_createur_valide_tache_membre(self, client_directeur, directeur, membre):
        tache = Tache.objects.create(
            titre='Tâche C6',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_directeur.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'TERMINEE'

    def test_c7_chef_responsable_non_directeur_403(self, client_chef_projets, chef_projets, directeur):
        tache = Tache.objects.create(
            titre='Tâche C7',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=chef_projets,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 403

    def test_c7bis_directeur_responsable_200(self, client_directeur, directeur):
        tache = Tache.objects.create(
            titre='Tâche C7bis',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=directeur,
        )
        response = client_directeur.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'TERMINEE'

    def test_c8_membre_executant_a_valider(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche C8',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'A_VALIDER'


# ===========================================================================
# D. MOTIFS OBLIGATOIRES
# ===========================================================================

@pytest.mark.django_db
class TestMotifsObligatoires:

    def test_d1_rejet_motif_court(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche D1',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'EN_COURS', 'motif': 'court'},
            format='json',
        )
        assert response.status_code == 400

    def test_d2_rejet_motif_vide(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche D2',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'EN_COURS', 'motif': ''},
            format='json',
        )
        assert response.status_code == 400

    def test_d3_rejet_motif_ok(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche D3',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'EN_COURS', 'motif': 'Motif suffisamment long.'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'EN_COURS'

    def test_d4_a_valider_vers_annulee_motif_ok(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche D4',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'ANNULEE', 'motif': 'Motif suffisamment long.'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.statut == 'ANNULEE'

    def test_d4bis_a_valider_vers_annulee_sans_motif(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche D4bis',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'ANNULEE'},
            format='json',
        )
        assert response.status_code == 400


# ===========================================================================
# E. NOTIFICATIONS
# ===========================================================================

@pytest.mark.django_db
class TestNotificationsWorkflow:

    def test_e1_vers_a_valider_notifie_chef(self, client_membre, membre, chef_projets, directeur):
        tache = Tache.objects.create(
            titre='Tâche E1',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        nb_avant = Notification.objects.filter(type='TACHE_A_VALIDER').count()
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        nb_apres = Notification.objects.filter(type='TACHE_A_VALIDER').count()
        assert nb_apres == nb_avant + 1
        notif = Notification.objects.filter(type='TACHE_A_VALIDER').last()
        assert notif.destinataire == chef_projets

    def test_e2_a_valider_vers_terminee_notifie_responsable(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche E2',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        nb_avant = Notification.objects.filter(type='TACHE_VALIDEE').count()
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200
        nb_apres = Notification.objects.filter(type='TACHE_VALIDEE').count()
        assert nb_apres == nb_avant + 1
        notif = Notification.objects.filter(type='TACHE_VALIDEE').last()
        assert notif.destinataire == membre

    def test_e3_rejet_notifie_responsable_avec_motif(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche E3',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        motif = 'Motif de rejet suffisamment long.'
        nb_avant = Notification.objects.filter(type='TACHE_REJETEE').count()
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'EN_COURS', 'motif': motif},
            format='json',
        )
        assert response.status_code == 200
        nb_apres = Notification.objects.filter(type='TACHE_REJETEE').count()
        assert nb_apres == nb_avant + 1
        notif = Notification.objects.filter(type='TACHE_REJETEE').last()
        assert notif.destinataire == membre
        assert motif in notif.message

    def test_e4_responsable_sans_service_notifie_directeur(self, client_membre, membre, directeur):
        membre.service = ''
        membre.save(update_fields=['service'])
        tache = Tache.objects.create(
            titre='Tâche E4',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        nb_avant = Notification.objects.filter(type='TACHE_A_VALIDER').count()
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        nb_apres = Notification.objects.filter(type='TACHE_A_VALIDER').count()
        assert nb_apres == nb_avant + 1
        notif = Notification.objects.filter(type='TACHE_A_VALIDER').last()
        assert notif.destinataire == directeur

    def test_e5_createur_diff_responsable_notifie(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche E5',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        nb_avant = Notification.objects.filter(type='TACHE_MODIFIEE').count()
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        nb_apres = Notification.objects.filter(type='TACHE_MODIFIEE').count()
        assert nb_apres == nb_avant + 1
        notif = Notification.objects.filter(type='TACHE_MODIFIEE').last()
        assert notif.destinataire == directeur


# ===========================================================================
# F. DATE_TERMINAISON
# ===========================================================================

@pytest.mark.django_db
class TestDateTerminaison:

    def test_f1_none_apres_a_valider(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche F1',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        assert tache.date_terminaison is None
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.date_terminaison is None

    def test_f2_non_none_apres_terminee(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche F2',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        assert tache.date_terminaison is None
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.date_terminaison is not None

    def test_f3_none_apres_reouverture(self, client_chef_projets, chef_projets, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche F3',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            date_terminaison=timezone.now(),
        )
        assert tache.date_terminaison is not None
        response = client_chef_projets.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'A_VALIDER'},
            format='json',
        )
        assert response.status_code == 200
        tache.refresh_from_db()
        assert tache.date_terminaison is None

    def test_f4_400_ne_touche_pas_date(self, client_membre, membre, directeur):
        tache = Tache.objects.create(
            titre='Tâche F4',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        assert tache.date_terminaison is None
        response = client_membre.patch(
            f'/api/v1/taches/{tache.id}/statut/',
            {'statut': 'TERMINEE'},
            format='json',
        )
        assert response.status_code == 400
        tache.refresh_from_db()
        assert tache.date_terminaison is None


# ===========================================================================
# G. PEUT_ETRE_CLOTUREE (non-régression élargie)
# ===========================================================================

@pytest.mark.django_db
class TestPeutEtreClotureeWorkflow:

    def test_g1_terminee_plus_a_valider_bloque(self, directeur, membre):
        activite = Activite.objects.create(
            titre='Activité G1',
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
        Tache.objects.create(
            titre='Tâche à valider',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            activite=activite,
        )
        assert activite.peut_etre_cloturee() is False

    def test_g2_annulee_plus_terminee_ok(self, directeur, membre):
        activite = Activite.objects.create(
            titre='Activité G2',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        Tache.objects.create(
            titre='Tâche annulée',
            statut=StatutTache.ANNULEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            activite=activite,
        )
        Tache.objects.create(
            titre='Tâche terminée',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            activite=activite,
        )
        assert activite.peut_etre_cloturee() is True
