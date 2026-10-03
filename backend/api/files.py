"""
Contrôles appliqués aux fichiers téléversés (pièces jointes).

Aucune de ces règles ne doit être contournable depuis le frontend :
la validation est faite côté serveur, avant toute écriture sur le disque.
"""

import os
import re

TAILLE_MAX_OCTETS = 10 * 1024 * 1024  # 10 Mo

EXTENSIONS_AUTORISEES = {
    # Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.odt', '.ods', '.odp', '.rtf', '.txt', '.csv',
    # Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
    # Archives
    '.zip',
}

CARACTERES_INTERDITS = re.compile(r'[^A-Za-z0-9._-]')


class FichierInvalide(Exception):
    """Le fichier téléversé ne respecte pas les règles de sécurité."""


def extension_de(fichier):
    """Retourne l'extension en minuscules (avec le point), ex: '.pdf'."""
    return os.path.splitext(fichier.name)[1].lower()


def valider_fichier(fichier):
    """
    Vérifie extension, taille et contenu.

    Lève FichierInvalide avec un message directement affichable.
    """
    extension = extension_de(fichier)

    if extension not in EXTENSIONS_AUTORISEES:
        raise FichierInvalide(
            f"Format « {extension or 'inconnu'} » non autorisé."
        )

    if fichier.size == 0:
        raise FichierInvalide("Le fichier est vide.")

    if fichier.size > TAILLE_MAX_OCTETS:
        raise FichierInvalide(
            "Fichier trop volumineux : 10 Mo maximum."
        )


def nom_sur(nom_original):
    """Nettoie un nom de fichier (affichage + en-tête de téléchargement)."""
    nom = os.path.basename(nom_original)
    nom = CARACTERES_INTERDITS.sub('_', nom)
    nom = nom.lstrip('.')[:200]
    return nom or 'fichier'