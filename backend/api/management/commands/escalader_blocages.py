"""
Job quotidien : escalade les blocages anciens et rappelle les contestations.

Exécution : chaque jour à 00h15.
Programmation : CRON Windows ou Celery Beat.

Règles métier :
    Escalade :
        Un blocage EN_ATTENTE ou EN_TRAITEMENT dont le délai d'escalade
        (selon l'urgence) est dépassé passe automatiquement en
        REMONTE_AU_DIRECTEUR. Un blocage déjà remonté, résolu ou contesté
        n'est pas touché.

    Rappel de contestation :
        Un blocage CONTESTE dont la contestation date de plus de 48h
        génère un rappel au Directeur (anti-spam 24h via
        `date_derniere_notif_rappel_contestation`).

Usage manuel :
    python manage.py escalader_blocages
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import (
    Blocage,
    Notification,
    RoleChoice,
    StatutBlocage,
    Utilisateur,
)
from api.services import enregistrer_action


DELAIS_ESCALADE = {
    'CRITIQUE': timedelta(days=1),
    'HAUTE': timedelta(days=2),
    'MOYENNE': timedelta(days=3),
    'BASSE': timedelta(days=5),
}
DELAI_ESCALADE_DEFAUT = DELAIS_ESCALADE['MOYENNE']

FENETRE_RAPPEL_CONTESTATION = timedelta(hours=48)
SEUIL_ANTI_SPAM_RAPPEL = timedelta(hours=24)


class Command(BaseCommand):
    help = "Escalade les blocages anciens et rappelle les contestations."

    def handle(self, *args, **options):
        maintenant = timezone.now()
        directeurs = list(Utilisateur.objects.avec_role(RoleChoice.DIRECTEUR))

        # ===================================================================
        # Bloc 1 — Escalade automatique
        # ===================================================================
        blocages_a_escalader = Blocage.objects.filter(
            statut__in=[
                StatutBlocage.EN_ATTENTE,
                StatutBlocage.EN_TRAITEMENT,
            ],
        ).select_related('tache', 'signale_par')

        compteur_escalade = 0

        for blocage in blocages_a_escalader:
            if not blocage.date_signalement:
                continue

            delta = DELAIS_ESCALADE.get(
                blocage.niveau_urgence, DELAI_ESCALADE_DEFAUT,
            )
            date_limite = blocage.date_signalement + delta

            if date_limite >= maintenant:
                continue

            blocage.statut = StatutBlocage.REMONTE_AU_DIRECTEUR
            blocage.save(update_fields=['statut'])

            enregistrer_action(
                auteur=None,
                action='ESCALADE_BLOCAGE',
                details=(
                    f"Blocage sur « {blocage.tache.titre} » escaladé "
                    f"automatiquement (urgence : {blocage.get_niveau_urgence_display()})."
                ),
                blocage=blocage,
            )

            for directeur in directeurs:
                Notification.objects.create(
                    destinataire=directeur,
                    type='BLOCAGE_ESCALADE',
                    message=(
                        f"Blocage escaladé sur « {blocage.tache.titre} » "
                        f"(urgence : {blocage.get_niveau_urgence_display()})."
                    ),
                    lue=False,
                )

            compteur_escalade += 1

        # ===================================================================
        # Bloc 2 — Rappel de contestation
        # ===================================================================
        blocages_contestes = Blocage.objects.filter(
            statut=StatutBlocage.CONTESTE,
        ).select_related('tache', 'signale_par')

        compteur_rappels = 0

        for blocage in blocages_contestes:
            if not blocage.date_contestation:
                continue

            date_rappel_possible = blocage.date_contestation + FENETRE_RAPPEL_CONTESTATION
            if date_rappel_possible >= maintenant:
                continue

            date_derniere = blocage.date_derniere_notif_rappel_contestation
            if date_derniere and (maintenant - date_derniere) < SEUIL_ANTI_SPAM_RAPPEL:
                continue

            for directeur in directeurs:
                Notification.objects.create(
                    destinataire=directeur,
                    type='BLOCAGE_CONTESTE',
                    message=(
                        f"Rappel : contestation en attente depuis "
                        f"{(maintenant - blocage.date_contestation).total_seconds() / 3600:.0f}h "
                        f"sur « {blocage.tache.titre} »."
                    ),
                    lue=False,
                )

            blocage.date_derniere_notif_rappel_contestation = maintenant
            blocage.save(update_fields=['date_derniere_notif_rappel_contestation'])

            compteur_rappels += 1

        # ===================================================================
        # Résumé
        # ===================================================================
        parties = []
        if compteur_escalade > 0:
            parties.append(
                f"{compteur_escalade} blocage(s) escaladé(s)."
            )
        if compteur_rappels > 0:
            parties.append(
                f"{compteur_rappels} rappel(s) de contestation envoyé(s)."
            )
        if parties:
            self.stdout.write(self.style.SUCCESS(' '.join(parties)))
        else:
            self.stdout.write(self.style.WARNING(
                "Aucune escalade ni rappel de contestation à traiter."
            ))
