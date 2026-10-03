"""
Job quotidien : désactive les délégations expirées.

Exécution : chaque jour à 00h10.
Programmation : CRON Windows ou Celery Beat.

Règle métier :
    Une délégation dont `date_fin` est dans le passé passe à
    `actif = False`. Le délégataire perd ses droits délégués.

Usage manuel :
    python manage.py expirer_delegations
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Delegation


class Command(BaseCommand):
    help = "Désactive les délégations dont la date de fin est dépassée."

    def handle(self, *args, **options):
        maintenant = timezone.now()

        qs = Delegation.objects.filter(
            actif=True,
            date_fin__lt=maintenant,
        )

        nombre = qs.count()

        if nombre == 0:
            self.stdout.write(self.style.WARNING(
                "Aucune délégation à expirer."
            ))
            return

        qs.update(actif=False)

        self.stdout.write(self.style.SUCCESS(
            f"{nombre} délégation(s) expirée(s)."
        ))