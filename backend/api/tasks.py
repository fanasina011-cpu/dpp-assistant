"""
Tâches Celery pour DPP Assistant.

Chaque tâche encapsule un management command existant pour pouvoir
être planifiée par Celery Beat.
"""

import logging

from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task(name='api.tasks.marquer_taches_en_retard')
def marquer_taches_en_retard():
    """Marque en retard les tâches dont l'échéance est dépassée."""
    logger.info('Exécution : marquer_taches_en_retard')
    call_command('marquer_taches_en_retard')


@shared_task(name='api.tasks.notifier_echeances_proches')
def notifier_echeances_proches():
    """Notifie les responsables des tâches à échéance proche."""
    logger.info('Exécution : notifier_echeances_proches')
    call_command('notifier_echeances_proches')


@shared_task(name='api.tasks.notifier_evenements_imminents')
def notifier_evenements_imminents():
    """Notifie les participants des événements imminents."""
    logger.info('Exécution : notifier_evenements_imminents')
    call_command('notifier_evenements_imminents')


@shared_task(name='api.tasks.expirer_delegations')
def expirer_delegations():
    """Désactive les délégations dont la date de fin est passée."""
    logger.info('Exécution : expirer_delegations')
    call_command('expirer_delegations')


@shared_task(name='api.tasks.cloturer_crq')
def cloturer_crq():
    """Clôture automatiquement les CRQ du jour."""
    logger.info('Exécution : cloturer_crq')
    call_command('cloturer_crq')


@shared_task(name='api.tasks.escalader_blocages')
def escalader_blocages():
    """Escalade les blocages non traités + rappels de contestation."""
    logger.info('Exécution : escalader_blocages')
    call_command('escalader_blocages')