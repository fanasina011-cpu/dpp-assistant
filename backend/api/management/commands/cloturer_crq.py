"""
Job quotidien : clôture les CRQ du jour.

Exécution : chaque jour à 23h59.
Programmation : CRON Windows ou Celery Beat.

Règle métier :
    À 23h59, tous les CRQ dont la date_journaliere est aujourd'hui
    passent à est_cloture = True. Après cette heure, le rédacteur ne
    peut plus modifier son CRQ (contrôle dans le serializer).

Usage manuel :
    python manage.py cloturer_crq
"""

from datetime import date

from django.core.management.base import BaseCommand

from api.models import CompteRenduQuotidien


class Command(BaseCommand):
    help = "Clôture les CRQ du jour (est_cloture = True)."

    def handle(self, *args, **options):
        aujourd_hui = date.today()

        qs = CompteRenduQuotidien.objects.filter(
            date_journaliere=aujourd_hui,
            est_cloture=False,
        )

        nombre = qs.count()

        if nombre == 0:
            self.stdout.write(self.style.WARNING(
                f"Aucun CRQ à clôturer pour le {aujourd_hui:%d/%m/%Y}."
            ))
            return

        qs.update(est_cloture=True)

        self.stdout.write(self.style.SUCCESS(
            f"{nombre} CRQ clôturé(s) pour le {aujourd_hui:%d/%m/%Y}."
        ))