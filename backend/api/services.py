"""
Services métier transversaux.
"""

from .models import HistoriqueAction, Notification, Utilisateur


def enregistrer_action(
    auteur: Utilisateur | None,
    action: str,
    details: str = '',
    tache=None,
    instruction=None,
    blocage=None,
    activite=None,
) -> HistoriqueAction:
    """
    Enregistre une action dans l'historique.

    Renseigne aussi cible_type et cible_id pour conserver la trace
    même si la cible est supprimée.

    `auteur` peut valoir None pour les actions automatiques du système
    (escalade de blocage), qui n'ont pas d'auteur humain.
    """
    cible_type = ''
    cible_id = None

    if tache:
        cible_type = 'TACHE'
        cible_id = tache.id
    elif instruction:
        cible_type = 'INSTRUCTION'
        cible_id = instruction.id
    elif blocage:
        cible_type = 'BLOCAGE'
        cible_id = blocage.id
    elif activite:
        cible_type = 'ACTIVITE'
        cible_id = activite.id

    return HistoriqueAction.objects.create(
        auteur=auteur,
        action=action,
        details=details,
        cible_type=cible_type,
        cible_id=cible_id,
        tache=tache,
        instruction=instruction,
        blocage=blocage,
        activite=activite,
    )


def envoyer_notification(
    destinataire: Utilisateur,
    type_notification: str,
    message: str,
) -> Notification:
    """Crée une notification pour un destinataire."""
    return Notification.objects.create(
        destinataire=destinataire,
        type=type_notification,
        message=message,
        lue=False,
    )