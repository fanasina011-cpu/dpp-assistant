"""
Tests des 5 jobs CRON.

Chaque job est une commande Django testée via `call_command`.
On vérifie :
    - L'exécution sans erreur.
    - Les effets en base de données (créations, mises à jour).
    - Le comportement quand il n'y a rien à faire (idempotence).
    - L'anti-spam.
"""

from datetime import date, datetime, timedelta

import pytest
from django.core.management import call_command

from api.models import (
    Blocage,
    CompteRenduQuotidien,
    Delegation,
    Evenement,
    Notification,
    RoleChoice,
    StatutTache,
    Tache,
)


# ===========================================================================
# 1. cloturer_crq
# ===========================================================================

@pytest.mark.django_db
class TestCloturerCRQ:

    def test_cloture_les_crq_du_jour(self, membre):
        """Un CRQ du jour avec est_cloture=False doit être clôturé."""
        crq = CompteRenduQuotidien.objects.create(
            redacteur=membre,
            date_journaliere=date.today(),
            activites_realisees='Test',
            est_cloture=False,
        )
        call_command('cloturer_crq', verbosity=0)
        crq.refresh_from_db()
        assert crq.est_cloture is True

    def test_ne_touche_pas_les_crq_anterieurs(self, membre):
        """Un CRQ d'hier n'est PAS clôturé par ce job."""
        hier = date.today() - timedelta(days=1)
        crq = CompteRenduQuotidien.objects.create(
            redacteur=membre,
            date_journaliere=hier,
            activites_realisees='Test',
            est_cloture=False,
        )
        call_command('cloturer_crq', verbosity=0)
        crq.refresh_from_db()
        assert crq.est_cloture is False

    def test_ne_touche_pas_les_crq_deja_clotures(self, membre):
        """Un CRQ déjà clôturé reste clôturé (idempotence)."""
        crq = CompteRenduQuotidien.objects.create(
            redacteur=membre,
            date_journaliere=date.today(),
            activites_realisees='Test',
            est_cloture=True,
        )
        call_command('cloturer_crq', verbosity=0)
        crq.refresh_from_db()
        assert crq.est_cloture is True

    def test_aucun_crq_ne_plante_pas(self):
        """Appel du job sans CRQ → pas d'erreur."""
        call_command('cloturer_crq', verbosity=0)


# ===========================================================================
# 2. marquer_taches_en_retard
# ===========================================================================

@pytest.mark.django_db
class TestMarquerTachesEnRetard:

    def test_notifie_responsable_et_directeur(self, directeur, membre):
        """Une tâche en retard → notification au responsable + Directeur."""
        tache = Tache.objects.create(
            titre='Tâche en retard',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            date_echeance=datetime.now() - timedelta(days=1),
            createur=directeur,
            responsable=membre,
        )
        call_command('marquer_taches_en_retard', verbosity=0)

        # Notification au responsable
        notif_membre = Notification.objects.filter(
            destinataire=membre, type='TACHE_EN_RETARD',
        )
        assert notif_membre.count() == 1

        # Notification au directeur
        notif_dir = Notification.objects.filter(
            destinataire=directeur, type='TACHE_EN_RETARD',
        )
        assert notif_dir.count() == 1

        # Anti-spam : la date a été mise à jour
        tache.refresh_from_db()
        assert tache.date_derniere_notif_retard is not None

    def test_anti_spam_24h(self, directeur, membre):
        """Si une notification a déjà été envoyée < 24 h, on n'en envoie pas d'autre."""
        tache = Tache.objects.create(
            titre='Tâche en retard',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            date_echeance=datetime.now() - timedelta(days=1),
            createur=directeur,
            responsable=membre,
            date_derniere_notif_retard=datetime.now() - timedelta(hours=2),
        )
        call_command('marquer_taches_en_retard', verbosity=0)

        # Aucune nouvelle notification
        assert Notification.objects.filter(type='TACHE_EN_RETARD').count() == 0

    def test_ne_notifie_pas_tache_terminee(self, directeur, membre):
        """Une tâche terminée n'est pas en retard."""
        Tache.objects.create(
            titre='Tâche terminée',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            date_echeance=datetime.now() - timedelta(days=1),
            createur=directeur,
            responsable=membre,
        )
        call_command('marquer_taches_en_retard', verbosity=0)
        assert Notification.objects.filter(type='TACHE_EN_RETARD').count() == 0

    def test_ne_notifie_pas_tache_sans_echeance(self, directeur, membre):
        Tache.objects.create(
            titre='Tâche sans échéance',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        call_command('marquer_taches_en_retard', verbosity=0)
        assert Notification.objects.filter(type='TACHE_EN_RETARD').count() == 0


# ===========================================================================
# 3. expirer_delegations
# ===========================================================================

@pytest.mark.django_db
class TestExpirerDelegations:

    def test_expire_delegation_depassee(self, directeur, chef_projets):
        deleg = Delegation.objects.create(
            delegant=directeur,
            delegataire=chef_projets,
            role_delegue=RoleChoice.CHEF_SERVICE_PROJETS,
            date_debut=datetime.now() - timedelta(days=10),
            date_fin=datetime.now() - timedelta(days=1),
            actif=True,
        )
        call_command('expirer_delegations', verbosity=0)
        deleg.refresh_from_db()
        assert deleg.actif is False

    def test_ne_touche_pas_delegation_future(self, directeur, chef_projets):
        deleg = Delegation.objects.create(
            delegant=directeur,
            delegataire=chef_projets,
            role_delegue=RoleChoice.CHEF_SERVICE_PROJETS,
            date_debut=datetime.now() + timedelta(days=1),
            date_fin=datetime.now() + timedelta(days=10),
            actif=True,
        )
        call_command('expirer_delegations', verbosity=0)
        deleg.refresh_from_db()
        assert deleg.actif is True

    def test_ne_touche_pas_delegation_deja_inactive(self, directeur, chef_projets):
        deleg = Delegation.objects.create(
            delegant=directeur,
            delegataire=chef_projets,
            role_delegue=RoleChoice.CHEF_SERVICE_PROJETS,
            date_debut=datetime.now() - timedelta(days=10),
            date_fin=datetime.now() - timedelta(days=1),
            actif=False,
        )
        call_command('expirer_delegations', verbosity=0)
        deleg.refresh_from_db()
        assert deleg.actif is False


# ===========================================================================
# 4. notifier_echeances_proches
# ===========================================================================

@pytest.mark.django_db
class TestNotifierEcheancesProches:

    def test_notifie_echeance_dans_24h(self, directeur, membre):
        Tache.objects.create(
            titre='Tâche échéance proche',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            date_echeance=datetime.now() + timedelta(hours=24),
            createur=directeur,
            responsable=membre,
        )
        call_command('notifier_echeances_proches', verbosity=0)
        notifs = Notification.objects.filter(type='ECHEANCE_PROCHE_TACHE')
        assert notifs.count() == 1
        assert notifs.first().destinataire == membre

    def test_ne_notifie_pas_echeance_dans_72h(self, directeur, membre):
        Tache.objects.create(
            titre='Tâche échéance lointaine',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            date_echeance=datetime.now() + timedelta(hours=72),
            createur=directeur,
            responsable=membre,
        )
        call_command('notifier_echeances_proches', verbosity=0)
        assert Notification.objects.filter(type='ECHEANCE_PROCHE_TACHE').count() == 0

    def test_ne_notifie_pas_echeance_passee(self, directeur, membre):
        Tache.objects.create(
            titre='Tâche déjà en retard',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            date_echeance=datetime.now() - timedelta(hours=1),
            createur=directeur,
            responsable=membre,
        )
        call_command('notifier_echeances_proches', verbosity=0)
        assert Notification.objects.filter(type='ECHEANCE_PROCHE_TACHE').count() == 0

    def test_anti_spam_24h(self, directeur, membre):
        Tache.objects.create(
            titre='Tâche échéance proche',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            date_echeance=datetime.now() + timedelta(hours=24),
            createur=directeur,
            responsable=membre,
            date_derniere_notif_echeance=datetime.now() - timedelta(hours=2),
        )
        call_command('notifier_echeances_proches', verbosity=0)
        assert Notification.objects.filter(type='ECHEANCE_PROCHE_TACHE').count() == 0


# ===========================================================================
# 5. notifier_evenements_imminents
# ===========================================================================

@pytest.mark.django_db
class TestNotifierEvenementsImminents:

    def test_notifie_evenement_dans_15min(self, directeur, membre):
        evt = Evenement.objects.create(
            titre='Réunion imminente',
            type='REUNION',
            date_debut=datetime.now() + timedelta(minutes=15),
            date_fin=datetime.now() + timedelta(minutes=45),
            statut='PLANIFIE',
            niveau_priorite='PERSONNEL',
            createur=directeur,
        )
        evt.participants.add(membre)

        call_command('notifier_evenements_imminents', verbosity=0)

        # Notification envoyée au participant
        notifs = Notification.objects.filter(type='RAPPEL_EVENEMENT')
        assert notifs.count() == 1
        assert notifs.first().destinataire == membre

        # Anti-spam : rappel_envoye a été mis à True
        evt.refresh_from_db()
        assert evt.rappel_envoye is True

    def test_ne_notifie_pas_evenement_dans_2h(self, directeur, membre):
        evt = Evenement.objects.create(
            titre='Réunion dans 2h',
            type='REUNION',
            date_debut=datetime.now() + timedelta(hours=2),
            date_fin=datetime.now() + timedelta(hours=3),
            statut='PLANIFIE',
            niveau_priorite='PERSONNEL',
            createur=directeur,
        )
        evt.participants.add(membre)

        call_command('notifier_evenements_imminents', verbosity=0)
        assert Notification.objects.filter(type='RAPPEL_EVENEMENT').count() == 0

    def test_ne_notifie_pas_evenement_deja_rappele(self, directeur, membre):
        evt = Evenement.objects.create(
            titre='Réunion imminente',
            type='REUNION',
            date_debut=datetime.now() + timedelta(minutes=15),
            date_fin=datetime.now() + timedelta(minutes=45),
            statut='PLANIFIE',
            niveau_priorite='PERSONNEL',
            createur=directeur,
            rappel_envoye=True,  # déjà rappelé
        )
        evt.participants.add(membre)

        call_command('notifier_evenements_imminents', verbosity=0)
        assert Notification.objects.filter(type='RAPPEL_EVENEMENT').count() == 0

    def test_notifie_tous_les_participants(self, directeur, membre, chef_projets):
        evt = Evenement.objects.create(
            titre='Réunion imminente',
            type='REUNION',
            date_debut=datetime.now() + timedelta(minutes=15),
            date_fin=datetime.now() + timedelta(minutes=45),
            statut='PLANIFIE',
            niveau_priorite='PERSONNEL',
            createur=directeur,
        )
        evt.participants.add(membre, chef_projets)

        call_command('notifier_evenements_imminents', verbosity=0)
        assert Notification.objects.filter(type='RAPPEL_EVENEMENT').count() == 2