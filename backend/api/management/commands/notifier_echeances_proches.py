"""
Job quotidien : notifie les échéances proches (48h).

Exécution : chaque jour à 07h00.
Programmation : CRON Windows ou Celery Beat.

Règle métier :
    Une tâche qui arrive à échéance dans moins de 48 heures et qui n'est
    pas terminée génère une notification au responsable. Anti-spam via
    `date_derniere_notif_echeance` (une notification par jour maximum).

Usage manuel :
    python manage.py notifier_echeances_proches
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from api.models import Notification, StatutTache, Tache


class Command(BaseCommand):
    help = "Notifie les responsables des tâches dont l'échéance est < 48h."

    def handle(self, *args, **options):
        maintenant = timezone.now()
        limite = maintenant + timedelta(hours=48)
        seuil_anti_spam = maintenant - timedelta(hours=24)

        taches = Tache.objects.filter(
            date_echeance__gte=maintenant,
            date_echeance__lte=limite,
        ).exclude(
            statut__in=[StatutTache.TERMINEE, StatutTache.ANNULEE],
        ).filter(
            Q(date_derniere_notif_echeance__isnull=True)
            | Q(date_derniere_notif_echeance__lt=seuil_anti_spam)
        ).select_related('responsable')

        compteur = 0

        for tache in taches:
            if not tache.responsable:
                continue

            heures_restantes = (tache.date_echeance - maintenant).total_seconds() / 3600

            Notification.objects.create(
                destinataire=tache.responsable,
                type='ECHEANCE_PROCHE_TACHE',
                message=(
                    f"Échéance proche pour « {tache.titre} » "
                    f"({heures_restantes:.0f}h restantes)."
                ),
                lue=False,
            )

            tache.date_derniere_notif_echeance = maintenant
            tache.save(update_fields=['date_derniere_notif_echeance'])

            compteur += 1

        if compteur == 0:
            self.stdout.write(self.style.WARNING(
                "Aucune échéance proche à notifier."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"{compteur} échéance(s) proche(s) notifiée(s)."
            ))