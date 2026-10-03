"""
Tests du workflow d'escalade et de contestation des blocages.

Couvre :
    - Contestation (fenêtre ouverte, hors fenêtre, motif, permissions)
    - Résolution de contestation
    - Job d'escalade automatique
    - Rappels de contestation
    - Calcul automatique de date_limite_action
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import (
    Blocage,
    HistoriqueAction,
    Notification,
    RoleChoice,
    StatutBlocage,
    StatutTache,
    Tache,
    Utilisateur,
)


# ===========================================================================
# HELPERS
# ===========================================================================

def _anteder(blocage, **deltas):
    """
    Anté-date les champs indiqués et renvoie le blocage rechargé.

    `date_signalement` est en `auto_now_add=True` : toute valeur passée à
    `objects.create()` est écrasée par `DateTimeField.pre_save()`. Pour
    simuler un blocage ancien, il faut écrire en base via un `.update()`,
    seule voie qui contourne `pre_save()`.

    Le modèle n'est volontairement pas modifié : en production la date de
    signalement doit rester immuable.

    Usage :
        _anteder(blocage, date_signalement=timedelta(hours=49))
    """
    Blocage.objects.filter(pk=blocage.pk).update(
        **{champ: timezone.now() - delta for champ, delta in deltas.items()},
    )
    return Blocage.objects.get(pk=blocage.pk)


# ===========================================================================
# FIXTURES
# ===========================================================================

@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def client_directeur(api_client, directeur):
    api_client.force_authenticate(user=directeur)
    return api_client


@pytest.fixture
def client_chef_projets(api_client, chef_projets):
    api_client.force_authenticate(user=chef_projets)
    return api_client


@pytest.fixture
def client_membre(api_client, membre):
    api_client.force_authenticate(user=membre)
    return api_client


@pytest.fixture
def blocage_ouvert(db, directeur, membre):
    tache = Tache.objects.create(
        titre='Tâche blocage',
        statut=StatutTache.BLOQUEE,
        priorite='NORMALE',
        createur=directeur,
        responsable=membre,
    )
    return Blocage.objects.create(
        description='Blocage de test',
        niveau_urgence='MOYENNE',
        statut=StatutBlocage.EN_ATTENTE,
        tache=tache,
        signale_par=membre,
    )


@pytest.fixture
def blocage_remonte(db, directeur, membre):
    tache = Tache.objects.create(
        titre='Tâche blocage remonté',
        statut=StatutTache.BLOQUEE,
        priorite='NORMALE',
        createur=directeur,
        responsable=membre,
    )
    return Blocage.objects.create(
        description='Blocage remonté',
        niveau_urgence='HAUTE',
        statut=StatutBlocage.REMONTE_AU_DIRECTEUR,
        tache=tache,
        signale_par=membre,
    )


# ===========================================================================
# DATE_LIMITE_ACTION
# ===========================================================================

@pytest.mark.django_db
class TestDateLimiteAction:

    def test_date_limite_action_calculee_a_la_creation(self, membre):
        tache = Tache.objects.create(
            titre='Tâche calcul',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=membre,
            responsable=membre,
        )
        blocage = Blocage.objects.create(
            description='Test calcul',
            niveau_urgence='CRITIQUE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=tache,
            signale_par=membre,
        )
        assert blocage.date_limite_action is not None
        delta = blocage.date_limite_action - blocage.date_signalement
        assert delta >= timedelta(hours=23, minutes=59)
        assert delta <= timedelta(days=1, seconds=1)

    def test_date_limite_action_recalculee_si_urgence_change(self, blocage_ouvert):
        blocage = blocage_ouvert
        date_limite_initial = blocage.date_limite_action
        blocage.niveau_urgence = 'CRITIQUE'
        blocage.save()
        blocage.refresh_from_db()
        assert blocage.date_limite_action != date_limite_initial
        delta = blocage.date_limite_action - blocage.date_signalement
        assert delta == timedelta(days=1)


# ===========================================================================
# CONTESTATION
# ===========================================================================

@pytest.mark.django_db
class TestContestation:

    def test_contester_fenetre_ouverte_200(self, client_membre, membre):
        blocage = Blocage.objects.create(
            description='Contestable',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=Tache.objects.create(
                titre='Tâche contestation',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=membre,
                responsable=membre,
            ),
            signale_par=membre,
        )
        response = client_membre.post(
            f'/api/v1/blocages/{blocage.id}/contester/',
            {'motif': 'Motif suffisamment long pour contester.'},
            format='json',
        )
        assert response.status_code == 200
        blocage.refresh_from_db()
        assert blocage.statut == 'CONTESTE'
        assert blocage.motif_contestation is not None
        assert blocage.date_contestation is not None

    def test_contester_hors_fenetre_400(self, client_membre, membre, directeur):
        blocage = Blocage.objects.create(
            description='Hors fenêtre',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=Tache.objects.create(
                titre='Tâche hors fenêtre',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=directeur,
                responsable=membre,
            ),
            signale_par=membre,
        )
        _anteder(blocage, date_signalement=timedelta(hours=49))
        response = client_membre.post(
            f'/api/v1/blocages/{blocage.id}/contester/',
            {'motif': 'Motif suffisamment long pour contester.'},
            format='json',
        )
        assert response.status_code == 400
        assert '48h' in str(response.data['detail'])

    def test_contester_sans_motif_400(self, client_membre, membre):
        blocage = Blocage.objects.create(
            description='Sans motif',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=Tache.objects.create(
                titre='Tâche sans motif',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=membre,
                responsable=membre,
            ),
            signale_par=membre,
        )
        response = client_membre.post(
            f'/api/v1/blocages/{blocage.id}/contester/',
            {'motif': 'court'},
            format='json',
        )
        assert response.status_code == 400

    def test_non_signaleur_ne_peut_pas_contester(self, client_chef_projets, chef_projets, membre):
        blocage = Blocage.objects.create(
            description='Non signaleur',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=Tache.objects.create(
                titre='Tâche non signaleur',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=chef_projets,
                responsable=membre,
            ),
            signale_par=membre,
        )
        response = client_chef_projets.post(
            f'/api/v1/blocages/{blocage.id}/contester/',
            {'motif': 'Motif suffisamment long pour contester.'},
            format='json',
        )
        assert response.status_code == 403

    def test_contester_sur_remonte_au_directeur_200(self, client_membre, membre, directeur):
        blocage = Blocage.objects.create(
            description='Remonté contestable',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.REMONTE_AU_DIRECTEUR,
            tache=Tache.objects.create(
                titre='Tâche remontée',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=directeur,
                responsable=membre,
            ),
            signale_par=membre,
        )
        response = client_membre.post(
            f'/api/v1/blocages/{blocage.id}/contester/',
            {'motif': 'Motif suffisamment long pour contester.'},
            format='json',
        )
        assert response.status_code == 200
        blocage.refresh_from_db()
        assert blocage.statut == 'CONTESTE'


# ===========================================================================
# RÉSOLUTION DE CONTESTATION
# ===========================================================================

@pytest.mark.django_db
class TestResolutionContestation:

    def test_directeur_resout_contestation_200(self, client_directeur, directeur, membre):
        blocage = Blocage.objects.create(
            description='À contester',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.CONTESTE,
            tache=Tache.objects.create(
                titre='Tâche contestée',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=directeur,
                responsable=membre,
            ),
            signale_par=membre,
            motif_contestation='Motif de contestation.',
            date_contestation=timezone.now(),
        )
        response = client_directeur.post(
            f'/api/v1/blocages/{blocage.id}/resoudre_contestation/',
            format='json',
        )
        assert response.status_code == 200
        blocage.refresh_from_db()
        assert blocage.statut == 'RESOLU'
        assert blocage.resolu_par == directeur
        assert blocage.date_resolution is not None

    def test_resoudre_contestation_ne_touche_pas_tache(self, client_directeur, directeur, membre):
        blocage = Blocage.objects.create(
            description='Ne pas toucher tâche',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.CONTESTE,
            tache=Tache.objects.create(
                titre='Tâche inchangée',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=directeur,
                responsable=membre,
            ),
            signale_par=membre,
            motif_contestation='Motif.',
            date_contestation=timezone.now(),
        )
        statut_avant = blocage.tache.statut
        response = client_directeur.post(
            f'/api/v1/blocages/{blocage.id}/resoudre_contestation/',
            format='json',
        )
        assert response.status_code == 200
        blocage.tache.refresh_from_db()
        assert blocage.tache.statut == statut_avant

    def test_resoudre_hors_contestation_400(self, client_directeur, directeur, membre):
        blocage = Blocage.objects.create(
            description='Pas contesté',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=Tache.objects.create(
                titre='Tâche pas contestée',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=directeur,
                responsable=membre,
            ),
            signale_par=membre,
        )
        response = client_directeur.post(
            f'/api/v1/blocages/{blocage.id}/resoudre_contestation/',
            format='json',
        )
        assert response.status_code == 400

    def test_non_directeur_ne_peut_pas_resoudre_contestation(
        self, client_chef_projets, chef_projets, membre
    ):
        blocage = Blocage.objects.create(
            description='Non directeur',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.CONTESTE,
            tache=Tache.objects.create(
                titre='Tâche non directeur',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=chef_projets,
                responsable=membre,
            ),
            signale_par=membre,
            motif_contestation='Motif.',
            date_contestation=timezone.now(),
        )
        response = client_chef_projets.post(
            f'/api/v1/blocages/{blocage.id}/resoudre_contestation/',
            format='json',
        )
        assert response.status_code == 403


# ===========================================================================
# JOB D'ESCALADE
# ===========================================================================

@pytest.mark.django_db
class TestJobEscaladerBlocages:

    def test_escalade_critique_1j(self, membre):
        tache = Tache.objects.create(
            titre='Tâche critique',
            statut=StatutTache.BLOQUEE,
            priorite='NORMALE',
            createur=membre,
            responsable=membre,
        )
        blocage = Blocage.objects.create(
            description='CRITIQUE',
            niveau_urgence='CRITIQUE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=tache,
            signale_par=membre,
        )
        _anteder(blocage, date_signalement=timedelta(days=1, hours=1))
        from api.management.commands.escalader_blocages import Command
        cmd = Command()
        cmd.handle()
        blocage.refresh_from_db()
        assert blocage.statut == 'REMONTE_AU_DIRECTEUR'

    def test_escalade_moyenne_3j(self, membre):
        tache = Tache.objects.create(
            titre='Tâche moyenne',
            statut=StatutTache.BLOQUEE,
            priorite='NORMALE',
            createur=membre,
            responsable=membre,
        )
        blocage = Blocage.objects.create(
            description='MOYENNE',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.EN_TRAITEMENT,
            tache=tache,
            signale_par=membre,
        )
        _anteder(blocage, date_signalement=timedelta(days=3, hours=1))
        from api.management.commands.escalader_blocages import Command
        cmd = Command()
        cmd.handle()
        blocage.refresh_from_db()
        assert blocage.statut == 'REMONTE_AU_DIRECTEUR'

    def test_pas_escalade_si_conteste(self, membre):
        tache = Tache.objects.create(
            titre='Tâche contestée',
            statut=StatutTache.BLOQUEE,
            priorite='NORMALE',
            createur=membre,
            responsable=membre,
        )
        blocage = Blocage.objects.create(
            description='Contesté ancien',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.CONTESTE,
            tache=tache,
            signale_par=membre,
        )
        _anteder(
            blocage,
            date_signalement=timedelta(days=10),
            date_contestation=timedelta(days=10),
        )
        from api.management.commands.escalader_blocages import Command
        cmd = Command()
        cmd.handle()
        blocage.refresh_from_db()
        assert blocage.statut == 'CONTESTE'

    def test_idempotence_escalade(self, membre):
        tache = Tache.objects.create(
            titre='Tâche idempotente',
            statut=StatutTache.BLOQUEE,
            priorite='NORMALE',
            createur=membre,
            responsable=membre,
        )
        blocage = Blocage.objects.create(
            description='Idempotent',
            niveau_urgence='CRITIQUE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=tache,
            signale_par=membre,
        )
        _anteder(blocage, date_signalement=timedelta(days=2))
        from api.management.commands.escalader_blocages import Command
        cmd = Command()
        cmd.handle()
        cmd.handle()
        blocage.refresh_from_db()
        assert blocage.statut == 'REMONTE_AU_DIRECTEUR'

    def test_pas_escalade_si_deja_resolu(self, membre):
        tache = Tache.objects.create(
            titre='Tâche résolue',
            statut=StatutTache.BLOQUEE,
            priorite='NORMALE',
            createur=membre,
            responsable=membre,
        )
        blocage = Blocage.objects.create(
            description='Résolu ancien',
            niveau_urgence='CRITIQUE',
            statut=StatutBlocage.RESOLU,
            tache=tache,
            signale_par=membre,
        )
        _anteder(
            blocage,
            date_signalement=timedelta(days=10),
            date_resolution=timedelta(days=9),
        )
        from api.management.commands.escalader_blocages import Command
        cmd = Command()
        cmd.handle()
        blocage.refresh_from_db()
        assert blocage.statut == 'RESOLU'

    def test_escalade_ecrit_historique_avec_auteur_null(self, membre):
        """
        L'escalade automatique n'a pas d'auteur humain : l'entrée
        d'historique doit être créée avec auteur_id=None.
        """
        tache = Tache.objects.create(
            titre='Tâche historique',
            statut=StatutTache.BLOQUEE,
            priorite='NORMALE',
            createur=membre,
            responsable=membre,
        )
        blocage = Blocage.objects.create(
            description='Historique escalade',
            niveau_urgence='CRITIQUE',
            statut=StatutBlocage.EN_ATTENTE,
            tache=tache,
            signale_par=membre,
        )
        _anteder(blocage, date_signalement=timedelta(days=1, hours=1))

        from api.management.commands.escalader_blocages import Command
        Command().handle()

        entree = HistoriqueAction.objects.get(
            action='ESCALADE_BLOCAGE',
            cible_type='BLOCAGE',
            cible_id=blocage.id,
        )
        assert entree.auteur_id is None
        assert 'Système' in str(entree)

    def test_historique_str_systeme_si_auteur_null(self, membre):
        """`__str__` affiche « Système » quand l'action est automatique."""
        action = HistoriqueAction.objects.create(
            auteur=None,
            action='ESCALADE_BLOCAGE',
            details='Escalade automatique.',
        )
        assert 'Système' in str(action)

    def test_historique_str_conserve_auteur_humain(self, membre):
        """Le comportement existant est préservé quand l'auteur existe."""
        action = HistoriqueAction.objects.create(
            auteur=membre,
            action='TACHE_MODIFIEE',
            details='Modification manuelle.',
        )
        assert 'Système' not in str(action)
        assert membre.get_nom_complet().split(' ')[0] in str(action)


# ===========================================================================
# RAPPELS DE CONTESTATION
# ===========================================================================

@pytest.mark.django_db
class TestRappelsContestation:

    def test_rappel_contestation_envoye(self, directeur, membre):
        blocage = Blocage.objects.create(
            description='Rappel',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.CONTESTE,
            tache=Tache.objects.create(
                titre='Tâche rappel',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=directeur,
                responsable=membre,
            ),
            signale_par=membre,
            date_contestation=timezone.now() - timedelta(hours=50),
        )
        nb_avant = Notification.objects.filter(type='BLOCAGE_CONTESTE').count()
        from api.management.commands.escalader_blocages import Command
        cmd = Command()
        cmd.handle()
        nb_apres = Notification.objects.filter(type='BLOCAGE_CONTESTE').count()
        assert nb_apres == nb_avant + 1
        blocage.refresh_from_db()
        assert blocage.date_derniere_notif_rappel_contestation is not None

    def test_anti_spam_rappel(self, directeur, membre):
        blocage = Blocage.objects.create(
            description='Anti-spam',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.CONTESTE,
            tache=Tache.objects.create(
                titre='Tâche anti-spam',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=directeur,
                responsable=membre,
            ),
            signale_par=membre,
            date_contestation=timezone.now() - timedelta(hours=50),
            date_derniere_notif_rappel_contestation=timezone.now() - timedelta(hours=12),
        )
        nb_avant = Notification.objects.filter(type='BLOCAGE_CONTESTE').count()
        from api.management.commands.escalader_blocages import Command
        cmd = Command()
        cmd.handle()
        nb_apres = Notification.objects.filter(type='BLOCAGE_CONTESTE').count()
        assert nb_apres == nb_avant

    def test_pas_rappel_si_fenetre_ouverte(self, directeur, membre):
        blocage = Blocage.objects.create(
            description='Fenêtre ouverte',
            niveau_urgence='MOYENNE',
            statut=StatutBlocage.CONTESTE,
            tache=Tache.objects.create(
                titre='Tâche fenêtre ouverte',
                statut=StatutTache.BLOQUEE,
                priorite='NORMALE',
                createur=directeur,
                responsable=membre,
            ),
            signale_par=membre,
            date_contestation=timezone.now() - timedelta(hours=24),
        )
        nb_avant = Notification.objects.filter(type='BLOCAGE_CONTESTE').count()
        from api.management.commands.escalader_blocages import Command
        cmd = Command()
        cmd.handle()
        nb_apres = Notification.objects.filter(type='BLOCAGE_CONTESTE').count()
        assert nb_apres == nb_avant
