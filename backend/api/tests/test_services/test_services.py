"""
Tests des services transversaux :
    - enregistrer_action
    - envoyer_notification
"""

import pytest

from api.models import HistoriqueAction, Notification
from api.services import enregistrer_action, envoyer_notification


@pytest.fixture
def tache_test(directeur, membre):
    from api.models import StatutTache, Tache
    return Tache.objects.create(
        titre='Tâche pour services',
        statut=StatutTache.A_FAIRE,
        priorite='NORMALE',
        createur=directeur,
        responsable=membre,
    )


# ===========================================================================
# enregistrer_action
# ===========================================================================

@pytest.mark.django_db
class TestEnregistrerAction:

    def test_cree_une_entree_historique(self, directeur):
        action = enregistrer_action(
            auteur=directeur,
            action='TEST_ACTION',
            details='Ceci est un test.',
        )
        assert action.id is not None
        assert action.action == 'TEST_ACTION'
        assert action.auteur == directeur
        assert action.details == 'Ceci est un test.'

    def test_avec_tache_comme_cible(self, directeur, tache_test):
        action = enregistrer_action(
            auteur=directeur,
            action='TACHE_TEST',
            details='Test.',
            tache=tache_test,
        )
        assert action.tache == tache_test

    def test_sans_details_par_defaut_vide(self, directeur):
        action = enregistrer_action(
            auteur=directeur,
            action='SANS_DETAILS',
        )
        assert action.details == ''

    def test_retourne_instance_historique(self, directeur):
        resultat = enregistrer_action(
            auteur=directeur,
            action='RETOUR_TEST',
        )
        assert isinstance(resultat, HistoriqueAction)
        assert HistoriqueAction.objects.filter(id=resultat.id).exists()


# ===========================================================================
# envoyer_notification
# ===========================================================================

@pytest.mark.django_db
class TestEnvoyerNotification:

    def test_cree_une_notification(self, membre):
        notif = envoyer_notification(
            destinataire=membre,
            type_notification='SYSTEME',
            message='Ceci est un test.',
        )
        assert notif.id is not None
        assert notif.destinataire == membre
        assert notif.type == 'SYSTEME'
        assert notif.message == 'Ceci est un test.'
        assert notif.lue is False

    def test_retourne_instance_notification(self, membre):
        resultat = envoyer_notification(
            destinataire=membre,
            type_notification='SYSTEME',
            message='Test.',
        )
        assert isinstance(resultat, Notification)
        assert Notification.objects.filter(id=resultat.id).exists()

    def test_notification_non_lue_par_defaut(self, directeur):
        notif = envoyer_notification(
            destinataire=directeur,
            type_notification='TACHE_ASSIGNEE',
            message='Test.',
        )
        assert notif.lue is False

    def test_notification_avec_type_valide(self, membre):
        for type_notif in ['TACHE_ASSIGNEE', 'BLOCAGE_SIGNE', 'SYSTEME']:
            notif = envoyer_notification(
                destinataire=membre,
                type_notification=type_notif,
                message='Test.',
            )
            assert notif.type == type_notif