"""
Job fréquent : notifie les participants 30 minutes avant un événement.

Exécution : toutes les 15 minutes.
Programmation : CRON Windows ou Celery Beat.

Règle métier :
    Un événement dont `date_debut` est dans les 30 prochaines minutes
    et dont `rappel_envoye = False` génère une notification aux
    participants. Après envoi, `rappel_envoye` passe à True.

Usage manuel :
    python manage.py notifier_evenements_imminents
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Evenement, Notification


class Command(BaseCommand):
    help = "Notifie les participants 30 minutes avant un événement."

    def handle(self, *args, **options):
        maintenant = timezone.now()
        limite = maintenant + timedelta(minutes=30)

        evenements = Evenement.objects.filter(
            date_debut__gte=maintenant,
            date_debut__lte=limite,
            rappel_envoye=False,
        ).prefetch_related('participants')

        compteur = 0

        for evenement in evenements:
            for participant in evenement.participants.all():
                Notification.objects.create(
                    destinataire=participant,
                    type='RAPPEL_EVENEMENT',
                    message=(
                        f"Rappel : « {evenement.titre} » commence à "
                        f"{evenement.date_debut:%H:%M}."
                    ),
                    lue=False,
                )

            evenement.rappel_envoye = True
            evenement.save(update_fields=['rappel_envoye'])

            compteur += 1

        if compteur == 0:
            self.stdout.write(self.style.WARNING(
                "Aucun événement imminent à notifier."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"{compteur} événement(s) imminent(s) notifié(s)."
            ))