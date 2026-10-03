"""
Job quotidien : notifie les tâches en retard.

Exécution : chaque jour à 00h05.
Programmation : CRON Windows ou Celery Beat.

Règle métier :
    Une tâche est en retard si :
        - elle a une date_echeance,
        - cette date est dans le passé,
        - son statut n'est ni TERMINEE ni ANNULEE.
    Le statut EN_RETARD n'est PAS stocké : c'est un indicateur calculé.
    Ce job notifie le responsable et le Directeur, avec anti-spam via
    `date_derniere_notif_retard`.

Usage manuel :
    python manage.py marquer_taches_en_retard
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from api.models import Notification, RoleChoice, StatutTache, Tache, Utilisateur


class Command(BaseCommand):
    help = "Notifie les responsables des tâches en retard (anti-spam 24h)."

    def handle(self, *args, **options):
        maintenant = timezone.now()
        seuil_anti_spam = maintenant - timedelta(hours=24)

        taches = Tache.objects.filter(
            date_echeance__lt=maintenant,
            date_echeance__isnull=False,
        ).exclude(
            statut__in=[StatutTache.TERMINEE, StatutTache.ANNULEE],
        ).filter(
            Q(date_derniere_notif_retard__isnull=True)
            | Q(date_derniere_notif_retard__lt=seuil_anti_spam)
        ).select_related('responsable')

        directeurs = list(Utilisateur.objects.filter(role=RoleChoice.DIRECTEUR))

        compteur = 0

        for tache in taches:
            # Notifier le responsable
            if tache.responsable:
                Notification.objects.create(
                    destinataire=tache.responsable,
                    type='TACHE_EN_RETARD',
                    message=(
                        f"La tâche « {tache.titre} » est en retard "
                        f"(échéance : {tache.date_echeance:%d/%m/%Y})."
                    ),
                    lue=False,
                )

            # Notifier les Directeurs (sans doublon avec le responsable)
            for directeur in directeurs:
                if directeur == tache.responsable:
                    continue
                Notification.objects.create(
                    destinataire=directeur,
                    type='TACHE_EN_RETARD',
                    message=(
                        f"La tâche « {tache.titre} » est en retard "
                        f"(responsable : {tache.responsable})."
                    ),
                    lue=False,
                )

            tache.date_derniere_notif_retard = maintenant
            tache.save(update_fields=['date_derniere_notif_retard'])

            compteur += 1

        if compteur == 0:
            self.stdout.write(self.style.WARNING(
                "Aucune nouvelle tâche en retard à notifier."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"{compteur} tâche(s) en retard notifiée(s)."
            ))