"""
Permissions RBAC pour l'application DPP — matrice consolidée.

Principe directeur : le membre EXÉCUTE, il ne crée pas de structure.

Rôles :
    - Directeur : voit et gère tout
    - Secrétaire : assiste le Directeur (instructions, CRQ, synthèses)
    - Chef de service : pilote ses activités et son équipe
    - Conseillère : rôle transverse, lecture large
    - Membre : exécute, signale, commente

DÉLÉGATION
    Toutes les vérifications passent par les RÔLES EFFECTIFS
    (`Utilisateur.roles_effectifs`) : le rôle propre et les rôles
    délégués en cours. Aucun contrôle ne doit lire `user.role`
    directement, sinon une délégation n'accorderait aucun droit.

    La délégation de DIRECTEUR et de SECRETAIRE_DIRECTION est refusée par
    `Delegation.clean()` : ces postes restent donc des rôle uniques et
    `est_directeur` / `est_secretaire` restent exacts.
"""

from rest_framework import permissions

from .models import RoleChoice


# ===========================================================================
# FONCTIONS UTILITAIRES
# ===========================================================================
#
# Toutes ces fonctions lisent `user.roles_effectifs`, dont la valeur est
# mise en cache sur l'instance : six appels coûtent une seule requête.

ROLES_CHEF = RoleChoice.roles_chef()


def _normaliser_service(service):
    """
    Normalise un nom de service pour comparaison.

    `service` est un champ texte libre : « Projets », « projets » et
    « PROJETS » désignent le même service.
    """
    if not service:
        return None
    return ' '.join(str(service).split()).casefold()


def a_role(user, *roles):
    """
    Vrai si l'utilisateur détient au moins un des rôles `roles`
    de façon effective (rôle propre ou délégation en cours).
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    return bool(set(user.roles_effectifs) & set(roles))


def est_directeur(user):
    return a_role(user, RoleChoice.DIRECTEUR)


def est_chef_de_service(user):
    return a_role(user, *ROLES_CHEF)


def est_secretaire(user):
    return a_role(user, RoleChoice.SECRETAIRE_DIRECTION)


def est_conseillere(user):
    return a_role(user, RoleChoice.CONSEILLERE_TECHNIQUE)


def est_chef_ou_directeur(user):
    return est_directeur(user) or est_chef_de_service(user)


def est_membre_equipe(user):
    return a_role(user, RoleChoice.MEMBRE_EQUIPE_APPUI)


def est_chef_service_appui(user):
    return a_role(user, RoleChoice.CHEF_SERVICE_APPUI)


def est_chef_du_service(user, service):
    """
    Vrai si l'utilisateur pilote le service `service`.

    Le périmètre vient de `service_actuel` : pour un chef délégué, il
    s'agit du service du chef qu'il supplée, et non de son service
    d'affectation (cf. décision D4).
    """
    if not est_chef_de_service(user):
        return False
    return _normaliser_service(user.service_actuel) == _normaliser_service(service)


def service_actuel(user):
    """
    Service sur lequel l'utilisateur exerce ses droits (ou None).

    Point d'entrée unique pour les filtrages par service des ViewSets :
    pour un chef délégué, c'est le service du chef qu'il supplée.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    return user.service_actuel


# ===========================================================================
# PERMISSIONS COMPOSABLES
# ===========================================================================

class EstDirecteur(permissions.BasePermission):
    message = "Seul le Directeur est autorisé à effectuer cette action."

    def has_permission(self, request, view):
        return est_directeur(request.user)


class EstChefDeService(permissions.BasePermission):
    message = "Seul un Chef de service est autorisé à effectuer cette action."

    def has_permission(self, request, view):
        return est_chef_de_service(request.user)


class EstDirecteurOuChefDeService(permissions.BasePermission):
    message = "Seul un Directeur ou un Chef de service est autorisé."

    def has_permission(self, request, view):
        return est_chef_ou_directeur(request.user)


# ===========================================================================
# TÂCHE
# ===========================================================================

class TachePermission(permissions.BasePermission):
    """
    Règles d'accès pour les tâches.

    Création :
        - Directeur : oui (n'importe quelle tâche)
        - Chef : oui, UNIQUEMENT dans ses activités (dont il est responsable)
        - Secrétaire : non
        - Membre : NON (change vs avant)
    """

    message = "Vous n'avez pas les droits nécessaires sur cette tâche."

    def has_permission(self, request, view):
        user = request.user

        if not (user and user.is_authenticated):
            return False

        # Création : Directeur ou Chef uniquement
        if request.method == 'POST':
            return est_chef_ou_directeur(user)

        # Tout le reste : authentifié suffit, la vue filtre
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Directeur : tous les droits
        if est_directeur(user):
            return True

        # Créateur : tous les droits sur sa propre tâche
        if obj.createur_id == user.id:
            return True

        # Responsable : lecture + PATCH (statut)
        if obj.responsable_id == user.id:
            if request.method in permissions.SAFE_METHODS:
                return True
            return request.method in ('PATCH', 'PUT')

        # Chef de service : lecture sur son service ou ses activités
        if est_chef_de_service(user):
            if obj.responsable and obj.responsable.service == user.service:
                if request.method in permissions.SAFE_METHODS:
                    return True
            if obj.activite and obj.activite.responsable_id == user.id:
                if request.method in permissions.SAFE_METHODS:
                    return True

        return False


# ===========================================================================
# ACTIVITÉ
# ===========================================================================

class ActivitePermission(permissions.BasePermission):
    """
    Règles d'accès pour les activités.

    Création : Directeur et chefs de service.
    """

    message = "Vous n'avez pas les droits nécessaires sur cette activité."

    def has_permission(self, request, view):
        user = request.user

        if not (user and user.is_authenticated):
            return False

        # Création : Directeur ou chef de service (délégué compris)
        if request.method == 'POST':
            return est_chef_ou_directeur(user)

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Directeur, Secrétaire, Conseillère : tous les droits
        if est_directeur(user) or est_secretaire(user) or est_conseillere(user):
            return True

        # Créateur : tous les droits
        if obj.createur_id == user.id:
            return True

        # Chef responsable de l'activité : tous les droits
        if est_chef_de_service(user):
            if obj.responsable_id == user.id:
                return True
            if obj.responsable and obj.responsable.service == user.service:
                return True
            # Lecture si une tâche lui est assignée
            if request.method in permissions.SAFE_METHODS:
                if obj.taches.filter(responsable=user).exists():
                    return True

        # Membre : lecture seule si tâche assignée
        if request.method in permissions.SAFE_METHODS:
            if obj.taches.filter(responsable=user).exists():
                return True

        return False


# ===========================================================================
# BLOCAGE
# ===========================================================================

class BlocagePermission(permissions.BasePermission):
    """
    Blocages : tout le monde peut signaler (sur ses tâches).
    """

    message = "Vous n'avez pas les droits nécessaires sur ce blocage."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user

        if est_directeur(user):
            return True

        if obj.signale_par_id == user.id:
            return True

        if obj.personne_sollicitee_id == user.id:
            return True

        if obj.tache.createur_id == user.id:
            return True

        if est_chef_de_service(user):
            if obj.tache.responsable and obj.tache.responsable.service == user.service:
                return True

        if est_conseillere(user) and request.method in permissions.SAFE_METHODS:
            return True

        return False


# ===========================================================================
# ÉVÉNEMENT
# ===========================================================================

class EvenementPermission(permissions.BasePermission):
    """
    Événements : tout le monde peut créer, mais les membres sont limités
    à des événements personnels (validation dans la vue).
    """

    message = "Vous n'avez pas les droits nécessaires sur cet événement."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user

        if est_directeur(user) or est_secretaire(user):
            return True

        if obj.createur_id == user.id:
            return True

        if est_chef_de_service(user):
            if obj.createur.service == user.service:
                return True

        if request.method in permissions.SAFE_METHODS:
            if obj.participants.filter(id=user.id).exists():
                return True

        return False


# ===========================================================================
# DÉLÉGATION
# ===========================================================================

class DelegationPermission(permissions.BasePermission):
    """
    Délégations : Directeur + Chef uniquement.
    """

    message = "Vous n'avez pas les droits nécessaires sur cette délégation."

    def has_permission(self, request, view):
        user = request.user

        if not (user and user.is_authenticated):
            return False

        if request.method == 'POST':
            return est_chef_ou_directeur(user)

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user

        if est_directeur(user):
            return True

        if obj.delegant_id == user.id:
            return True

        if obj.delegataire_id == user.id:
            if request.method in permissions.SAFE_METHODS:
                return True

        return False


# ===========================================================================
# COMMENTAIRE
# ===========================================================================

class CommentairePermission(permissions.BasePermission):
    message = "Vous n'avez pas les droits nécessaires sur ce commentaire."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user

        if est_directeur(user):
            return True

        if obj.auteur_id == user.id:
            return True

        return request.method in permissions.SAFE_METHODS


# ===========================================================================
# CRQ
# ===========================================================================

class CRQPermission(permissions.BasePermission):
    message = "Vous n'avez pas les droits nécessaires sur ce CRQ."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user

        if est_directeur(user):
            return True

        if obj.redacteur_id == user.id:
            if request.method in permissions.SAFE_METHODS:
                return True
            return not obj.est_cloture

        if est_chef_de_service(user):
            if obj.redacteur.service == user.service:
                return request.method in permissions.SAFE_METHODS

        if est_conseillere(user) and request.method in permissions.SAFE_METHODS:
            return True

        return False


# ===========================================================================
# SYNTHÈSE
# ===========================================================================

class SynthesePermission(permissions.BasePermission):
    message = "Vous n'avez pas les droits nécessaires sur cette synthèse."

    def has_permission(self, request, view):
        user = request.user

        if not (user and user.is_authenticated):
            return False

        if request.method == 'POST':
            return est_directeur(user) or est_secretaire(user)

        return (
            est_directeur(user)
            or est_secretaire(user)
            or est_chef_de_service(user)
            or est_conseillere(user)
        )

    def has_object_permission(self, request, view, obj):
        user = request.user

        if est_directeur(user) or est_secretaire(user) or est_conseillere(user):
            return True

        if est_chef_de_service(user):
            return request.method in permissions.SAFE_METHODS

        return False


# ===========================================================================
# INSTRUCTION
# ===========================================================================

class InstructionPermission(permissions.BasePermission):
    message = "Vous n'avez pas les droits nécessaires sur cette instruction."

    def has_permission(self, request, view):
        user = request.user

        if not (user and user.is_authenticated):
            return False

        # Création : Directeur, Secrétaire, Chef
        if request.method == 'POST':
            return (
                est_directeur(user)
                or est_secretaire(user)
                or est_chef_de_service(user)
            )

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user

        if est_directeur(user):
            return True

        if obj.emetteur_id == user.id or obj.saisie_par_id == user.id:
            return True

        if obj.destinataires.filter(destinataire=user).exists():
            return request.method in permissions.SAFE_METHODS or request.method == 'PATCH'

        if est_chef_de_service(user):
            if obj.destinataires.filter(destinataire__service=user.service).exists():
                return request.method in permissions.SAFE_METHODS

        if est_secretaire(user):
            return request.method in permissions.SAFE_METHODS

        return False


# ===========================================================================
# PIÈCE JOINTE
# ===========================================================================

# Mapping du type de cible d'une pièce jointe vers la permission objet
# de l'entité concernée. Évite de dupliquer les règles du RBAC.
PERMISSIONS_CIBLE = {
    'tache': TachePermission,
    'instruction': InstructionPermission,
    'activite': ActivitePermission,
    'blocage': BlocagePermission,
    'evenement': EvenementPermission,
}

# (type de cible, champ du modèle PieceJointe) pour les 5 entités possibles.
CHAMPS_CIBLE = (
    ('tache', 'tache'),
    ('instruction', 'instruction'),
    ('activite', 'activite'),
    ('blocage', 'blocage'),
    ('evenement', 'evenement'),
)


class _RequeteSimulee:
    """
    Objet minimal exposant `user` et `method`.

    Permet de réutiliser les permissions objet existantes (qui ne lisent
    que ces deux attributs) depuis une action ou un filtre de queryset.
    """

    def __init__(self, user, method='GET'):
        self.user = user
        self.method = method


def a_acces_cible(user, type_cible, cible, lecture_seulement=False):
    """
    Retourne True si l'utilisateur a accès à l'entité ciblée.

    Ne duplique aucune règle RBAC : on délègue à la permission objet
    de l'entité concernée.
    """
    permission = PERMISSIONS_CIBLE.get(type_cible)

    if permission is None or cible is None:
        return False

    methode = 'GET' if lecture_seulement else 'PUT'

    return permission().has_object_permission(
        _RequeteSimulee(user, methode), None, cible,
    )


class PieceJointePermission(permissions.BasePermission):
    """
    Règles d'accès aux pièces jointes.

    L'accès est accordé si :
        - l'utilisateur est Directeur ;
        - l'utilisateur est l'auteur du dépôt (uploade_par) ;
        - l'utilisateur a accès à l'entité ciblée (tâche, instruction,
          activité, blocage ou événement) — en lecture pour les méthodes
          sûres, en écriture sinon.

    Une pièce jointe sans cible n'est accessible qu'à son auteur et au
    Directeur.
    """

    message = "Vous n'avez pas les droits sur cette pièce jointe."

    def has_object_permission(self, request, view, obj):
        user = request.user

        if est_directeur(user):
            return True

        if obj.uploade_par_id == user.id:
            return True

        lecture_seulement = request.method in permissions.SAFE_METHODS

        for type_cible, champ in CHAMPS_CIBLE:
            cible = getattr(obj, champ)
            if cible is not None:
                return a_acces_cible(user, type_cible, cible, lecture_seulement)

        return False