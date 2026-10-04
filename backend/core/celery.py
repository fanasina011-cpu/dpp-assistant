"""
Configuration Celery pour DPP Assistant.

Ce fichier est chargé automatiquement par Django via core/__init__.py.
Il expose une instance `app` qui sert à la fois de worker et de client.
"""

import os

from celery import Celery
from celery.schedules import crontab
from django.conf import settings

# Indique à Celery où trouver la config Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('dpp')

# Charge la config depuis settings.py, préfixée par CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Utilise le fuseau horaire de Django
app.conf.timezone = settings.TIME_ZONE

# Découvre automatiquement les tâches dans les apps Django installées
app.autodiscover_tasks()


# ---------------------------------------------------------------------------
# Planning des tâches récurrentes (Celery Beat)
# ---------------------------------------------------------------------------
app.conf.beat_schedule = {
    # Nuit — juste après minuit
    'marquer-taches-en-retard': {
        'task': 'api.tasks.marquer_taches_en_retard',
        'schedule': crontab(hour=0, minute=5),
    },
    'expirer-delegations': {
        'task': 'api.tasks.expirer_delegations',
        'schedule': crontab(hour=0, minute=30),
    },
    # Matin
    'notifier-evenements-imminents': {
        'task': 'api.tasks.notifier_evenements_imminents',
        'schedule': crontab(hour=6, minute=0),
    },
    'notifier-echeances-proches': {
        'task': 'api.tasks.notifier_echeances_proches',
        'schedule': crontab(hour=7, minute=0),
    },
    'escalader-blocages': {
        'task': 'api.tasks.escalader_blocages',
        'schedule': crontab(hour=8, minute=0),
    },
    # Fin de journée
    'cloturer-crq': {
        'task': 'api.tasks.cloturer_crq',
        'schedule': crontab(hour=23, minute=55),
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')