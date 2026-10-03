"""
Modèles métier de l'application DPP.

Convention :
    Les noms de champs suivent les standards Django (snake_case) plutôt que
    les noms conceptuels du document de spécification (camelCase).
    Correspondances pour Utilisateur :

        Document      →  Django
        ---------------------------------------------
        nom           →  last_name
        prenom        →  first_name
        motDePasse    →  password
        actif         →  is_active
        dateCreation  →  date_joined

    Correspondances pour les autres modèles :
        dateDebut        →  date_debut
        dateFin          →  date_fin
        niveauPriorite   →  niveau_priorite
        rappelEnvoye     →  rappel_envoye
        dateCreation     →  date_creation
        createurId       →  createur (ForeignKey)

    Les modèles non définis dans ce fichier (Tache, Instruction, Blocage,
    Delegation, etc.) seront ajoutés progressivement.
"""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.functional import cached_property


# ===========================================================================
# ÉNUMÉRATIONS
# ===========================================================================

def _comme_reference(dt):
    """
    Rend un datetime comparable à `timezone.now()`.

    Le projet fonctionne avec USE_TZ = False : `timezone.now()` renvoie
    donc un datetime naïf en heure locale. Selon la valeur de USE_TZ, on
    normalise dans le même référentiel, sinon la comparaison lève une
    TypeError ("can't compare offset-naive and offset-aware").
    """
    if dt is None:
        return None
    if settings.USE_TZ:
        if timezone.is_aware(dt):
            return dt
        return timezone.make_aware(dt, timezone.get_default_timezone())
    if timezone.is_aware(dt):
        return timezone.make_naive(dt, timezone.get_default_timezone())
    return dt

class RoleChoice(models.TextChoices):
    """
    Rôles métier disponibles dans la direction.

    Correspond au enum Role du document de spécification.
    """
    DIRECTEUR = 'DIRECTEUR', 'Directeur'
    SECRETAIRE_DIRECTION = 'SECRETAIRE_DIRECTION', 'Secrétaire de Direction'
    CHEF_SERVICE_PROJETS = 'CHEF_SERVICE_PROJETS', 'Chef Service Projets'
    CHEF_SERVICE_PARTENARIATS = 'CHEF_SERVICE_PARTENARIATS', 'Chef Service Partenariats'
    CHEF_SERVICE_APPUI = 'CHEF_SERVICE_APPUI', 'Chef Service - Appui'
    CONSEILLERE_TECHNIQUE = 'CONSEILLERE_TECHNIQUE', 'Conseillère Technique'
    MEMBRE_EQUIPE_APPUI = 'MEMBRE_EQUIPE_APPUI', "Membre Équipe d'Appui"

    @classmethod
    def roles_chef(cls):
        """Rôles portant une autorité de pilotage de service."""
        return (
            cls.CHEF_SERVICE_PROJETS,
            cls.CHEF_SERVICE_PARTENARIATS,
            cls.CHEF_SERVICE_APPUI,
        )

    @classmethod
    def roles_non_delegables(cls):
        """
        Rôles qui ne peuvent jamais être délégués.

        Ces deux postes sont uniques dans la direction : les déleguer
        créerait une double autorité sur les instructions, les CRQ et les
        notifications de direction.
        """
        return (cls.DIRECTEUR, cls.SECRETAIRE_DIRECTION)

class Priorite(models.TextChoices):
    """
    Niveau de priorité d'une activité, d'une tâche ou d'une instruction.

    Utilisé par : Activite, Tache, Instruction.
    """
    BASSE = 'BASSE', 'Basse'
    NORMALE = 'NORMALE', 'Normale'
    HAUTE = 'HAUTE', 'Haute'
    URGENTE = 'URGENTE', 'Urgente'

class NiveauPriorite(models.TextChoices):
    """
    Niveau de priorité d'un événement.

    Un événement de niveau DIRECTION a priorité sur un événement PERSONNEL.
    Cette règle est appliquée métier, pas en base.
    """
    DIRECTION = 'DIRECTION', 'Direction'
    PERSONNEL = 'PERSONNEL', 'Personnel'


class TypeEvenement(models.TextChoices):
    """Types d'événements possibles dans l'agenda."""
    REUNION = 'REUNION', 'Réunion'
    RENDEZ_VOUS = 'RENDEZ_VOUS', 'Rendez-vous'
    AUDIENCE = 'AUDIENCE', 'Audience'
    DEPLACEMENT = 'DEPLACEMENT', 'Déplacement'
    RAPPEL = 'RAPPEL', 'Rappel'
    ECHEANCE = 'ECHEANCE', 'Échéance'
    AUTRE = 'AUTRE', 'Autre'


class StatutEvenement(models.TextChoices):
    """Statuts possibles d'un événement."""
    PLANIFIE = 'PLANIFIE', 'Planifié'
    REALISE = 'REALISE', 'Réalisé'
    ANNULE = 'ANNULE', 'Annulé'

class StatutActivite(models.TextChoices):
    """Statuts possibles d'une activité."""
    OUVERTE = 'OUVERTE', 'Ouverte'
    EN_COURS = 'EN_COURS', 'En cours'
    CLOTUREE = 'CLOTUREE', 'Clôturée'
    ANNULEE = 'ANNULEE', 'Annulée'

class StatutInstruction(models.TextChoices):
    """Statuts possibles d'une instruction."""
    A_FAIRE = 'A_FAIRE', 'À faire'
    EN_COURS = 'EN_COURS', 'En cours'
    TERMINEE = 'TERMINEE', 'Terminée'
    ANNULEE = 'ANNULEE', 'Annulée'

class StatutTache(models.TextChoices):
    """Statuts possibles d'une tâche."""
    A_FAIRE = 'A_FAIRE', 'À faire'
    EN_COURS = 'EN_COURS', 'En cours'
    EN_ATTENTE = 'EN_ATTENTE', 'En attente'
    BLOQUEE = 'BLOQUEE', 'Bloquée'
    A_VALIDER = 'A_VALIDER', 'À valider'
    TERMINEE = 'TERMINEE', 'Terminée'
    ANNULEE = 'ANNULEE', 'Annulée'

class StatutBlocage(models.TextChoices):
    """Statuts possibles d'un blocage."""
    EN_ATTENTE = 'EN_ATTENTE', 'En attente'
    EN_TRAITEMENT = 'EN_TRAITEMENT', 'En traitement'
    REMONTE_AU_DIRECTEUR = 'REMONTE_AU_DIRECTEUR', 'Remonté au Directeur'
    RESOLU = 'RESOLU', 'Résolu'
    CONTESTE = 'CONTESTE', 'Contesté'


class UrgenceBlocage(models.TextChoices):
    """Niveaux d'urgence d'un blocage."""
    BASSE = 'BASSE', 'Basse'
    MOYENNE = 'MOYENNE', 'Moyenne'
    HAUTE = 'HAUTE', 'Haute'
    CRITIQUE = 'CRITIQUE', 'Critique'

class StatutDemandeReouverture(models.TextChoices):
    """Statuts possibles d'une demande de réouverture de CRQ."""
    EN_ATTENTE = 'EN_ATTENTE', 'En attente'
    VALIDEE = 'VALIDEE', 'Validée'
    REFUSEE = 'REFUSEE', 'Refusée'

class TypeNotification(models.TextChoices):
    """
    Types de notifications.

    Chaque type correspond à un événement métier qui déclenche une
    notification à un utilisateur. La liste est stable et ne doit être
    étendue qu'en cas d'ajout d'un nouveau cas métier.
    """
    TACHE_ASSIGNEE = 'TACHE_ASSIGNEE', 'Tâche assignée'
    TACHE_MODIFIEE = 'TACHE_MODIFIEE', 'Tâche modifiée'
    TACHE_EN_RETARD = 'TACHE_EN_RETARD', 'Tâche en retard'
    TACHE_PRIORITE_ELEVEE = 'TACHE_PRIORITE_ELEVEE', 'Tâche priorité élevée'
    TACHE_A_VALIDER = 'TACHE_A_VALIDER', 'Tâche à valider'
    TACHE_VALIDEE = 'TACHE_VALIDEE', 'Tâche validée'
    TACHE_REJETEE = 'TACHE_REJETEE', 'Tâche rejetée'
    ACTIVITE_CREEE = 'ACTIVITE_CREEE', 'Activité créée'
    BLOCAGE_SIGNE = 'BLOCAGE_SIGNE', 'Blocage signalé'
    BLOCAGE_RESOLU = 'BLOCAGE_RESOLU', 'Blocage résolu'
    BLOCAGE_REMONTE = 'BLOCAGE_REMONTE', 'Blocage remonté'
    BLOCAGE_ESCALADE = 'BLOCAGE_ESCALADE', 'Blocage escaladé'
    BLOCAGE_CONTESTE = 'BLOCAGE_CONTESTE', 'Blocage contesté'
    CONTESTATION_RESOLUE = 'CONTESTATION_RESOLUE', 'Contestation résolue'
    INSTRUCTION_RECUE = 'INSTRUCTION_RECUE', 'Instruction reçue'
    INSTRUCTION_ACTIVITE = 'INSTRUCTION_ACTIVITE', 'Instruction ciblant une activité'
    EVENEMENT_DIRECTION_PRIORITAIRE = 'EVENEMENT_DIRECTION_PRIORITAIRE', 'Événement Direction prioritaire'
    RAPPEL_EVENEMENT = 'RAPPEL_EVENEMENT', 'Rappel événement'
    CRQ_RAPPEL = 'CRQ_RAPPEL', 'Rappel CRQ'
    CRQ_REOUVERTURE_DEMANDEE = 'CRQ_REOUVERTURE_DEMANDEE', 'Réouverture CRQ demandée'
    CRQ_REOUVERTURE_VALIDEE = 'CRQ_REOUVERTURE_VALIDEE', 'Réouverture CRQ validée'
    CRQ_REOUVERTURE_REFUSEE = 'CRQ_REOUVERTURE_REFUSEE', 'Réouverture CRQ refusée'
    DELEGATION_ACTIVEE = 'DELEGATION_ACTIVEE', 'Délégation activée'
    DELEGATION_REVOQUEE = 'DELEGATION_REVOQUEE', 'Délégation révoquée'
    ECHEANCE_PROCHE_TACHE = 'ECHEANCE_PROCHE_TACHE', 'Échéance proche (tâche)'
    SYNTHESE_GENEREE = 'SYNTHESE_GENEREE', 'Synthèse générée'
    UTILISATEUR_A_REASSIGNER = 'UTILISATEUR_A_REASSIGNER', 'Utilisateur à réassigner'
    UTILISATEUR_DESACTIVE = 'UTILISATEUR_DESACTIVE', 'Utilisateur désactivé'
    ANNULATION_MOTIVEE = 'ANNULATION_MOTIVEE', 'Annulation motivée'
    SYSTEME = 'SYSTEME', 'Système'

class TypeSynthese(models.TextChoices):
    """Types de synthèses générables."""
    QUOTIDIENNE = 'QUOTIDIENNE', 'Quotidienne'
    HEBDOMADAIRE = 'HEBDOMADAIRE', 'Hebdomadaire'
    MENSUELLE = 'MENSUELLE', 'Mensuelle'
# ===========================================================================
# UTILISATEUR
# ===========================================================================

class UtilisateurManager(UserManager):
    """
    Manager de l'utilisateur DPP.

    Hérite de UserManager (donc de create_user / create_superuser) et
    ajoute la recherche par rôle effectif.
    """

    def avec_role(self, role, dans_service=None):
        """
        Utilisateurs disposant du rôle `role` de façon effective.

        Couvre le rôle propre ET les délégations en cours. La période de
        délégation est filtrée en base (`date_debut__lte` /
        `date_fin__gte`) et non en Python.
        """
        now = timezone.now()
        return self.get_queryset().filter(
            Q(role=role)
            | Q(
                delegations_recues__role_delegue=role,
                delegations_recues__actif=True,
                delegations_recues__date_debut__lte=now,
                delegations_recues__date_fin__gte=now,
            )
        ).distinct()


class Utilisateur(AbstractUser):
    """
    Utilisateur de l'application DPP.

    Hérite de AbstractUser (username, password, first_name, last_name,
    is_active, is_staff, date_joined, etc.).

    Champs ajoutés :
        - role                 : rôle métier propre (enum RoleChoice)
        - service              : nom du service d'affectation
        - superieur_proche     : N+1 hiérarchique (auto-référence)
        - chef_service_delegue : chef de service suppléant désigné par une
                                 délégation ; son service détermine alors le
                                 périmètre d'exercice des droits de chef
                                 (auto-référence)

    Le rôle métier n'est jamais modifié par une délégation : les droits
    effectifs se calculent via roles_effectifs. Voir Delegation.
    """

    objects = UtilisateurManager()

    role = models.CharField(
        max_length=50,
        choices=RoleChoice.choices,
        default=RoleChoice.MEMBRE_EQUIPE_APPUI,
        help_text="Rôle métier de l'utilisateur dans la direction.",
    )

    service = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Nom du service d'affectation (ex : Projets, Partenariats).",
    )

    superieur_proche = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subordonnes',
        help_text="Supérieur hiérarchique direct (N+1).",
    )

    chef_service_delegue = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='membres_chef_service_delegue',
        verbose_name='Chef de service délégué',
        help_text=(
            "Chef de service adjoint désigné par une délégation en cours. "
            "Tant que ce champ est renseigné, son service constitue le "
            "périmètre d'exercice des droits de chef de service du "
            "délégataire."
        ),
    )

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    def __str__(self):
        nom_complet = f"{self.first_name} {self.last_name}".strip()
        if nom_complet:
           return f"{nom_complet} ({self.get_role_display()})"
        return f"{self.username} ({self.get_role_display()})"

    def get_nom_complet(self):
        """Retourne le nom complet de l'utilisateur."""
        return f"{self.first_name} {self.last_name}".strip() or self.username

    # ------------------------------------------------------------------
    # RÔLES EFFECTIFS
    # ------------------------------------------------------------------

    @cached_property
    def roles_effectifs(self):
        """
        Ensemble des rôles actuellement effectifs pour cet utilisateur.

        Union du rôle propre et des rôles délégués dont la période est en
        cours. Le filtrage des périodes est fait en base : la période est
        comparée à un unique `timezone.now()` (aware), ce qui évite toute
        confrontation entre datetime naïf (MySQL) et datetime aware.

        La valeur est mise en cache sur l'instance pour que les six
        helpers de api.permissions partagent une seule requête par
        requête HTTP. Après une écriture de délégation, appeler
        `refresh_from_db()` (ou `_invalider_roles_effectifs()`) pour
        invalider le cache.
        """
        maintenant = timezone.now()
        roles_delegues = (
            self.delegations_recues.filter(
                actif=True,
                date_debut__lte=maintenant,
            )
            .filter(Q(date_fin__isnull=True) | Q(date_fin__gte=maintenant))
            .values_list('role_delegue', flat=True)
        )
        return {self.role, *roles_delegues}

    @property
    def roles_effectifs_tries(self):
        """
        Rôles effectifs triés dans l'ordre hiérarchique de RoleChoice.

        Le rôle propre est toujours en première position : il représente
        l'identité métier de l'utilisateur.
        """
        ordre = {role: index for index, role in enumerate(RoleChoice.values)}
        autres = sorted(
            (r for r in self.roles_effectifs if r != self.role),
            key=lambda r: ordre.get(r, len(ordre)),
        )
        return [self.role, *autres]

    @property
    def role_effectif(self):
        """Rôle effectif principal : le rôle métier propre."""
        return self.role

    @property
    def a_delegation_active(self):
        """Vrai si au moins une délégation est en cours."""
        return len(self.roles_effectifs) > 1

    # ------------------------------------------------------------------
    # PÉRIMÈTRE DE SERVICE
    # ------------------------------------------------------------------

    @property
    def service_actuel(self):
        """
        Service sur lequel l'utilisateur exerce ses droits.

        Pour un chef de service délégué, c'est le service du chef délégué
        (périmètre limité par la délégation). Sinon, son service d'affectation.
        """
        chef = self.chef_service_delegue
        if chef is not None:
            return chef.service
        return self.service

    @property
    def est_chef_service(self):
        """
        Vrai si au moins un rôle effectif est un rôle de chef de service.

        Distinct de la fonction `api.permissions.est_chef_de_service(user)`,
        qui répond pour un utilisateur quelconque. Cette property sert à
        exposer le drapeau dans l'API.
        """
        return bool(set(self.roles_effectifs) & set(RoleChoice.roles_chef()))

    def _invalider_roles_effectifs(self):
        """Invalide le cache de roles_effectifs après une écriture."""
        self.__dict__.pop('roles_effectifs', None)


# ===========================================================================
# ÉVÉNEMENT
# ===========================================================================

class Evenement(models.Model):
    """
    Événement d'agenda.

    Un événement possède un créateur, une période (début/fin), un type,
    un statut, un niveau de priorité, et une liste de participants.

    Le champ `participants` est une relation ManyToMany. Django crée
    automatiquement la table d'association (api_evenement_participants).
    """

    titre = models.CharField(
        max_length=200,
        help_text="Titre de l'événement.",
    )

    description = models.TextField(
        blank=True,
        default='',
        help_text="Description détaillée de l'événement.",
    )

    type = models.CharField(
        max_length=30,
        choices=TypeEvenement.choices,
        default=TypeEvenement.AUTRE,
        help_text="Type d'événement.",
    )

    date_debut = models.DateTimeField(
        help_text="Date et heure de début.",
    )

    date_fin = models.DateTimeField(
        help_text="Date et heure de fin.",
    )

    statut = models.CharField(
        max_length=20,
        choices=StatutEvenement.choices,
        default=StatutEvenement.PLANIFIE,
        help_text="Statut de l'événement.",
    )

    niveau_priorite = models.CharField(
        max_length=20,
        choices=NiveauPriorite.choices,
        default=NiveauPriorite.PERSONNEL,
        help_text=(
            "Niveau de priorité. Un événement DIRECTION prime sur un "
            "événement PERSONNEL en cas de conflit d'agenda."
        ),
    )

    rappel_envoye = models.BooleanField(
        default=False,
        help_text=(
            "Indique si le rappel automatique (30 min avant) a déjà été "
            "envoyé. Utilisé par le job notifier_evenements_imminents."
        ),
    )

    createur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='evenements_crees',
        help_text="Utilisateur qui a créé l'événement.",
    )

    participants = models.ManyToManyField(
        Utilisateur,
        blank=True,
        related_name='evenements_participes',
        help_text=(
            "Utilisateurs conviés à l'événement. La relation est "
            "automatiquement propagée à leur agenda."
        ),
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création de l'événement.",
    )

    class Meta:
        verbose_name = 'Événement'
        verbose_name_plural = 'Événements'
        ordering = ('-date_debut',)

    def __str__(self):
        return f"{self.titre} ({self.date_debut:%d/%m/%Y %H:%M})"

    def est_passe(self):
        """Retourne True si la date de fin est dans le passé."""
        return self.date_fin < timezone.now()

# ===========================================================================
# ACTIVITÉ
# ===========================================================================

class Activite(models.Model):
    """
    Activité de la direction.

    Une activité regroupe plusieurs tâches autour d'un objectif commun.
    Exemple : « Organisation de la conférence de novembre 2026 » regroupe
    les tâches « Réserver la salle », « Inviter les partenaires », etc.

    Une tâche appartient à au plus une activité.
    """

    titre = models.CharField(
        max_length=200,
        help_text="Titre de l'activité.",
    )

    description = models.TextField(
        blank=True,
        default='',
        help_text="Description détaillée de l'activité.",
    )

    statut = models.CharField(
        max_length=20,
        choices=StatutActivite.choices,
        default=StatutActivite.OUVERTE,
        help_text="Statut de l'activité.",
    )

    priorite = models.CharField(
        max_length=20,
        choices=Priorite.choices,
        default=Priorite.NORMALE,
        help_text="Niveau de priorité de l'activité.",
    )

    date_debut = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date de début de l'activité (optionnelle).",
    )

    date_echeance = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date d'échéance de l'activité (optionnelle).",
    )

    responsable = models.ForeignKey(
        Utilisateur,
        on_delete=models.PROTECT,
        related_name='activites_pilotees',
        help_text="Utilisateur qui pilote l'activité.",
    )

    createur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='activites_creees',
        help_text="Utilisateur qui a créé l'activité.",
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création de l'activité.",
    )

    class Meta:
        verbose_name = 'Activité'
        verbose_name_plural = 'Activités'
        ordering = ('-date_creation',)

    def __str__(self):
        return self.titre

    def peut_etre_cloturee(self):
        """
        Vérifie si l'activité peut être clôturée.

        Une activité peut être clôturée uniquement si toutes ses tâches
        sont dans un statut terminal (TERMINEE ou ANNULEE). Tout statut
        non terminal, y compris A_VALIDER, bloque la clôture.
        """
        return not self.taches.exclude(
            statut__in=[StatutTache.TERMINEE, StatutTache.ANNULEE]
        ).exists()

# ===========================================================================
# INSTRUCTION
# ===========================================================================

class Instruction(models.Model):
    """
    Instruction émise par un utilisateur (typiquement le Directeur ou un
    Chef de service vers son équipe).

    Une instruction peut cibler :
        - une Activité entière (activite_cible),
        - une Tâche précise (tache_cible) — à ajouter après création
          du modèle Tache,
        - ou rien (instruction générale).

    Les deux champs tache_cible et activite_cible sont mutuellement
    exclusifs. Cette contrainte est appliquée au niveau applicatif pour
    l'instant, elle sera renforcée en base quand Tache existera.

    Une instruction peut être adressée à un ou plusieurs destinataires
    via le modèle InstructionDestinataire.
    """

    titre = models.CharField(
        max_length=200,
        help_text="Titre ou objet de l'instruction.",
    )

    description = models.TextField(
        help_text="Description détaillée de l'instruction.",
    )

    priorite = models.CharField(
        max_length=20,
        choices=Priorite.choices,
        default=Priorite.NORMALE,
        help_text="Niveau de priorité de l'instruction.",
    )

    date_echeance = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date d'échéance de l'instruction (optionnelle).",
    )

    statut = models.CharField(
        max_length=20,
        choices=StatutInstruction.choices,
        default=StatutInstruction.A_FAIRE,
        help_text=(
            "Statut global de l'instruction. Passe à TERMINEE uniquement "
            "quand tous les destinataires ont terminé."
        ),
    )

    emetteur = models.ForeignKey(
        Utilisateur,
        on_delete=models.PROTECT,
        related_name='instructions_emises',
        help_text="Utilisateur qui a émis l'instruction.",
    )

    saisie_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='instructions_saisies',
        help_text=(
            "Utilisateur qui a saisi l'instruction au nom de l'émetteur "
            "(cas d'une délégation au secrétariat)."
        ),
    )

    activite_cible = models.ForeignKey(
        Activite,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='instructions_ciblees',
        help_text=(
            "Activité ciblée par l'instruction. Mutuellement exclusif "
            "avec tache_cible (à venir)."
        ),
    )

    tache_cible = models.ForeignKey(
        'Tache',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='instructions_ciblees',
        help_text=(
            "Tâche ciblée par l'instruction. Mutuellement exclusif "
            "avec activite_cible."
        ),
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création de l'instruction.",
    )

    class Meta:
        verbose_name = 'Instruction'
        verbose_name_plural = 'Instructions'
        ordering = ('-date_creation',)

    def __str__(self):
        return self.titre

    def maj_statut_global(self):
        """
        Met à jour le statut global de l'instruction en fonction des
        statuts de ses destinataires.

        Règles :
            - Si tous les destinataires sont TERMINEE → instruction TERMINEE.
            - Si au moins un destinataire est EN_COURS → instruction EN_COURS.
            - Si tous les destinataires sont ANNULEE → instruction ANNULEE.
            - Sinon : statut inchangé ou A_FAIRE.
        """
        dests = list(self.destinataires.all())
        if not dests:
            return

        statuts = [d.statut for d in dests]

        if all(s == 'TERMINEE' for s in statuts):
            self.statut = 'TERMINEE'
        elif all(s == 'ANNULEE' for s in statuts):
            self.statut = 'ANNULEE'
        elif any(s in ('EN_COURS', 'TERMINEE') for s in statuts):
            self.statut = 'EN_COURS'
        else:
            self.statut = 'A_FAIRE'


class InstructionDestinataire(models.Model):
    """
    Association entre une Instruction et un Utilisateur destinataire.

    Chaque destinataire possède son propre statut d'exécution, indépendant
    des autres destinataires. Une instruction est considérée globalement
    TERMINEE uniquement quand tous ses destinataires ont terminé.

    Cette table remplace un simple ManyToManyField, car on a besoin de
    champs supplémentaires sur la relation (statut, commentaire).
    """

    instruction = models.ForeignKey(
        Instruction,
        on_delete=models.CASCADE,
        related_name='destinataires',
        help_text="Instruction concernée.",
    )

    destinataire = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='instructions_recues',
        help_text="Utilisateur destinataire de l'instruction.",
    )

    statut = models.CharField(
        max_length=20,
        choices=StatutInstruction.choices,
        default=StatutInstruction.A_FAIRE,
        help_text="Statut d'exécution pour ce destinataire.",
    )

    commentaire = models.TextField(
        blank=True,
        default='',
        help_text="Commentaire du destinataire sur l'exécution.",
    )

    date_maj = models.DateTimeField(
        auto_now=True,
        help_text="Date de dernière mise à jour du statut.",
    )

    class Meta:
        verbose_name = 'Destinataire d\'instruction'
        verbose_name_plural = 'Destinataires d\'instruction'
        unique_together = ('instruction', 'destinataire')
        ordering = ('instruction', 'destinataire')

    def __str__(self):
        return f"{self.instruction.titre} → {self.destinataire}"

# ===========================================================================
# TÂCHE
# ===========================================================================

class Tache(models.Model):
    """
    Tâche opérationnelle.

    Une tâche peut être :
        - indépendante,
        - rattachée à une Activité (regroupement),
        - issue d'une Instruction (décomposition).

    Une tâche possède un créateur et un responsable (les deux peuvent être
    différents). Le créateur seul peut modifier ou supprimer la tâche.
    Le responsable peut faire évoluer son statut.

    Le statut EN_RETARD n'est PAS stocké. Il est calculé à la volée par
    la méthode est_en_retard(). Voir le document de spécification.
    """

    titre = models.CharField(
        max_length=200,
        help_text="Titre de la tâche.",
    )

    description = models.TextField(
        blank=True,
        default='',
        help_text="Description détaillée de la tâche.",
    )

    date_debut = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date de début de la tâche (optionnelle).",
    )

    date_echeance = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date d'échéance de la tâche (optionnelle).",
    )

    date_terminaison = models.DateTimeField(
        blank=True,
        null=True,
        help_text=(
            "Date et heure de passage au statut TERMINEE. "
            "Renseignée automatiquement par l'action /taches/{id}/statut/ "
            "et remise à None si la tâche est rouverte."
        ),
    )

    priorite = models.CharField(
        max_length=20,
        choices=Priorite.choices,
        default=Priorite.NORMALE,
        help_text="Niveau de priorité de la tâche.",
    )

    statut = models.CharField(
        max_length=20,
        choices=StatutTache.choices,
        default=StatutTache.A_FAIRE,
        help_text="Statut actuel de la tâche.",
    )

    createur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='taches_creees',
        help_text="Utilisateur qui a créé la tâche.",
    )

    responsable = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='taches_assignees',
        help_text="Utilisateur responsable de l'exécution.",
    )

    instruction = models.ForeignKey(
        Instruction,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='taches_generees',
        help_text="Instruction d'origine, si la tâche a été générée à partir d'une instruction.",
    )

    activite = models.ForeignKey(
        Activite,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='taches',
        help_text="Activité à laquelle la tâche est rattachée (optionnelle).",
    )

    date_derniere_notif_retard = models.DateTimeField(
        blank=True,
        null=True,
        help_text=(
            "Date du dernier rappel de retard envoyé. Utilisé par le job "
            "marquer_taches_en_retard pour éviter le spam."
        ),
    )

    date_derniere_notif_echeance = models.DateTimeField(
        blank=True,
        null=True,
        help_text=(
            "Date du dernier rappel d'échéance proche envoyé. Utilisé par "
            "le job notifier_echeances_proches pour éviter le spam."
        ),
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création de la tâche.",
    )

    class Meta:
        verbose_name = 'Tâche'
        verbose_name_plural = 'Tâches'
        ordering = ('-date_creation',)

    def __str__(self):
        return self.titre

    def est_en_retard(self):
        """
        Retourne True si la tâche est en retard.

        Une tâche est en retard si :
            - elle a une date d'échéance,
            - cette date est dans le passé,
            - son statut n'est ni TERMINEE ni ANNULEE.

        Cet indicateur est calculé, pas stocké en base.
        """
        if self.statut in (StatutTache.TERMINEE, StatutTache.ANNULEE):
            return False
        if self.date_echeance is None:
            return False
        return self.date_echeance < timezone.now()

# ===========================================================================
# BLOCAGE
# ===========================================================================

DELAIS_ESCALADE = {
    'CRITIQUE': timedelta(days=1),
    'HAUTE': timedelta(days=2),
    'MOYENNE': timedelta(days=3),
    'BASSE': timedelta(days=5),
}
DELAI_ESCALADE_DEFAUT = DELAIS_ESCALADE['MOYENNE']

class Blocage(models.Model):
    """
    Blocage signalé sur une tâche.

    Un blocage est créé par un utilisateur qui rencontre un obstacle
    l'empêchant d'avancer sur une tâche. Il possède :
        - un niveau d'urgence,
        - un statut,
        - une personne sollicitée pour le résoudre,
        - une date de résolution et un résolveur, une fois résolu.

    Le signalement d'un blocage fait passer la tâche liée au statut
    BLOQUEE. La résolution propose de la repasser en EN_COURS.

    Le statut REMONTE_AU_DIRECTEUR est utilisé quand le blocage n'a pas pu
    être résolu au niveau du service et qu'il doit être traité par le
    Directeur.
    """

    description = models.TextField(
        help_text="Description détaillée du blocage rencontré.",
    )

    niveau_urgence = models.CharField(
        max_length=20,
        choices=UrgenceBlocage.choices,
        default=UrgenceBlocage.MOYENNE,
        help_text="Niveau d'urgence du blocage.",
    )

    statut = models.CharField(
        max_length=30,
        choices=StatutBlocage.choices,
        default=StatutBlocage.EN_ATTENTE,
        help_text="Statut actuel du blocage.",
    )

    tache = models.ForeignKey(
        Tache,
        on_delete=models.CASCADE,
        related_name='blocages',
        help_text="Tâche sur laquelle le blocage a été signalé.",
    )

    signale_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.PROTECT,
        related_name='blocages_signales',
        help_text="Utilisateur qui a signalé le blocage.",
    )

    personne_sollicitee = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='blocages_sollicites',
        help_text=(
            "Utilisateur sollicité pour résoudre le blocage "
            "(souvent le Chef de service ou le Directeur)."
        ),
    )

    date_signalement = models.DateTimeField(
        auto_now_add=True,
        help_text="Date à laquelle le blocage a été signalé.",
    )

    date_resolution = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date à laquelle le blocage a été résolu.",
    )

    resolu_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='blocages_resolus',
        help_text="Utilisateur qui a résolu le blocage.",
    )

    date_limite_action = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date à partir de laquelle l'escalade automatique s'applique.",
    )

    motif_contestation = models.TextField(
        blank=True,
        null=True,
        help_text="Motif de la contestation par le signaleur.",
    )

    date_contestation = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date à laquelle la contestation a été déposée.",
    )

    date_derniere_notif_rappel_contestation = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date du dernier rappel de contestation envoyé au Directeur.",
    )

    def calculer_date_limite_action(self):
        """Retourne date_signalement + délai selon l'urgence."""
        from datetime import timedelta
        delta = DELAIS_ESCALADE.get(self.niveau_urgence, DELAI_ESCALADE_DEFAUT)
        if self.date_signalement:
            return self.date_signalement + delta
        return None

    def save(self, *args, **kwargs):
        if self.date_signalement:
            self.date_limite_action = self.calculer_date_limite_action()
        elif self._state.adding:
            delta = DELAIS_ESCALADE.get(
                self.niveau_urgence, DELAI_ESCALADE_DEFAUT,
            )
            self.date_limite_action = timezone.now() + delta
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = 'Blocage'
        verbose_name_plural = 'Blocages'
        ordering = ('-date_signalement',)

    def __str__(self):
        return f"Blocage sur « {self.tache.titre} » ({self.get_statut_display()})"


# ===========================================================================
# DÉLÉGATION
# ===========================================================================

class Delegation(models.Model):
    """
    Délégation temporaire de rôle.

    Permet à un utilisateur (le délégant) de transférer temporairement
    son rôle à un autre utilisateur (le délégataire), pour une période
    donnée.

    Cas d'usage typique : un Chef de service part en congé. Il délègue son
    rôle à un membre de son équipe pour la durée de son absence.

    Règles métier :
        - Le délégataire bénéficie du rôle délégué pendant la période.
        - Le délégataire ne peut pas sous-déléguer.
        - Le délégataire ne peut pas avoir plus de droits que le délégant.
        - La délégation est révocable à tout moment (actif = False).
    """

    delegant = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='delegations_donnees',
        help_text="Utilisateur qui délègue son rôle.",
    )

    delegataire = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='delegations_recues',
        help_text="Utilisateur qui reçoit temporairement le rôle.",
    )

    role_delegue = models.CharField(
        max_length=50,
        choices=RoleChoice.choices,
        help_text="Rôle attribué temporairement au délégataire.",
    )

    service = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Service concerné par la délégation (optionnel).",
    )

    date_debut = models.DateTimeField(
        help_text="Début de la période de délégation.",
    )

    date_fin = models.DateTimeField(
        help_text="Fin de la période de délégation.",
    )

    actif = models.BooleanField(
        default=True,
        help_text=(
            "Indique si la délégation est active. Passe à False lors "
            "d'une révocation manuelle ou d'une expiration automatique."
        ),
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création de la délégation.",
    )

    class Meta:
        verbose_name = 'Délégation'
        verbose_name_plural = 'Délégations'
        ordering = ('-date_creation',)

    def __str__(self):
        return (
            f"{self.delegant} → {self.delegataire} "
            f"({self.get_role_delegue_display()}, "
            f"{self.date_debut:%d/%m/%Y} → {self.date_fin:%d/%m/%Y})"
        )

    def est_active(self):
        """
        Retourne True si la délégation est active à l'instant présent.

        Une délégation est active si :
            - le drapeau actif est True,
            - la date actuelle est comprise entre date_debut et date_fin.

        Les dates peuvent être relues sans fuseau (MySQL) : elles sont
        normalisées avant toute comparaison avec `timezone.now()`.
        """
        if not self.actif:
            return False
        maintenant = timezone.now()
        return _comme_reference(self.date_debut) <= maintenant <= _comme_reference(self.date_fin)

    def clean(self):
        """Règles métier de la délégation (cf. D1 et D4)."""
        from django.core.exceptions import ValidationError

        erreurs = {}

        if self.role_delegue in RoleChoice.roles_non_delegables():
            erreurs['role_delegue'] = (
                f"Le rôle « {self.get_role_delegue_display()} » ne peut "
                "pas être délégué : ces postes sont uniques dans la direction."
            )

        if self.role_delegue in RoleChoice.roles_chef():
            if not self.service:
                erreurs['service'] = (
                    "Un chef de service délégué doit être rattaché à un "
                    "service : celui-ci détermine son périmètre de droits."
                )

        if self.date_debut and self.date_fin and self.date_fin <= self.date_debut:
            erreurs['date_fin'] = "La date de fin doit être postérieure au début."

        if self.delegant_id and self.delegataire_id and self.delegant_id == self.delegataire_id:
            erreurs['delegataire'] = "Un utilisateur ne peut pas se déléguer à lui-même."

        if erreurs:
            raise ValidationError(erreurs)

    def save(self, *args, **kwargs):
        """Enregistre puis synchronise le périmètre de chef délégué."""
        super().save(*args, **kwargs)
        self._appliquer_perimetre_chef_delegue()

    def delete(self, *args, **kwargs):
        delegataire = self.delegataire
        super().delete(*args, **kwargs)
        if delegataire is not None:
            delegataire._invalider_roles_effectifs()

    def _appliquer_perimetre_chef_delegue(self):
        """
        Aligne `Utilisateur.chef_service_delegue` sur l'état de la délégation.

        Le lien matérialise le périmètre du chef délégué (D4) et doit donc
        être cohérent avec la période. Cette synchronisation est
        idempotente : la rappeler converge toujours vers l'état réel.
        """
        if self.role_delegue not in RoleChoice.roles_chef():
            return

        delegataire = self.delegataire
        if delegataire is None:
            return

        attendue = self if self.est_active() else None
        if attendue is None:
            if delegataire.chef_service_delegue_id is None:
                return
            if (
                delegataire.chef_service_delegue_id == self.delegant_id
                and self.role_delegue in RoleChoice.roles_chef()
            ):
                delegataire.chef_service_delegue = None
                delegataire._invalider_roles_effectifs()
                delegataire.save(update_fields=['chef_service_delegue'])
            return

        delegataire.chef_service_delegue = self.delegant
        delegataire._invalider_roles_effectifs()
        delegataire.save(update_fields=['chef_service_delegue'])
    
# ===========================================================================
# COMPTE-RENDU QUOTIDIEN
# ===========================================================================

class CompteRenduQuotidien(models.Model):
    """
    Compte-rendu quotidien rédigé par un utilisateur en fin de journée.

    Chaque utilisateur rédige un seul CRQ par jour. La contrainte
    d'unicité (redacteur, date_journaliere) est appliquée en base.

    Le CRQ est clôturé automatiquement à 23h59 par le job cloturer_crq.
    Une fois clôturé, il n'est plus modifiable par son rédacteur. Il peut
    faire l'objet d'une demande de réouverture exceptionnelle.
    """

    redacteur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='comptes_rendus',
        help_text="Utilisateur qui a rédigé le compte-rendu.",
    )

    date_journaliere = models.DateField(
        help_text="Date à laquelle correspond ce compte-rendu.",
    )

    activites_realisees = models.TextField(
        blank=True,
        default='',
        help_text="Activités réalisées dans la journée.",
    )

    activites_en_cours = models.TextField(
        blank=True,
        default='',
        help_text="Activités toujours en cours à la fin de la journée.",
    )

    activites_non_realisees = models.TextField(
        blank=True,
        default='',
        help_text="Activités prévues mais non réalisées.",
    )

    difficultes = models.TextField(
        blank=True,
        default='',
        help_text="Difficultés rencontrées dans la journée.",
    )

    prevues_lendemain = models.TextField(
        blank=True,
        default='',
        help_text="Activités prévues pour le lendemain.",
    )

    est_cloture = models.BooleanField(
        default=False,
        help_text=(
            "Indique si le CRQ est clôturé. Passe à True automatiquement "
            "à 23h59 via le job cloturer_crq. Une fois clôturé, le CRQ "
            "ne peut plus être modifié sans demande de réouverture."
        ),
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création du compte-rendu.",
    )

    class Meta:
        verbose_name = 'Compte-rendu quotidien'
        verbose_name_plural = 'Comptes-rendus quotidiens'
        unique_together = ('redacteur', 'date_journaliere')
        ordering = ('-date_journaliere',)

    def __str__(self):
        return f"CRQ de {self.redacteur} du {self.date_journaliere:%d/%m/%Y}"


# ===========================================================================
# DEMANDE DE RÉOUVERTURE DE CRQ
# ===========================================================================

class DemandeReouvertureCRQ(models.Model):
    """
    Demande de réouverture exceptionnelle d'un CRQ clôturé.

    Cas d'usage : un collaborateur a oublié de saisir son CRQ avant 23h59
    (coupure d'électricité, urgence de terrain, etc.). Il peut faire une
    demande motivée qui sera validée ou refusée par son Chef de service
    ou le Directeur.

    Si validée, le CRQ repasse à est_cloture = False et le rédacteur peut
    à nouveau le modifier.
    """

    crq = models.ForeignKey(
        CompteRenduQuotidien,
        on_delete=models.CASCADE,
        related_name='demandes_reouverture',
        help_text="Compte-rendu concerné par la demande.",
    )

    demandeur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='demandes_reouverture_demandees',
        help_text="Utilisateur qui fait la demande de réouverture.",
    )

    motif = models.TextField(
        help_text="Motif de la demande de réouverture.",
    )

    statut = models.CharField(
        max_length=20,
        choices=StatutDemandeReouverture.choices,
        default=StatutDemandeReouverture.EN_ATTENTE,
        help_text="Statut de la demande.",
    )

    validee_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='demandes_reouverture_validees',
        help_text="Utilisateur qui a validé ou refusé la demande.",
    )

    date_demande = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de la demande.",
    )

    date_validation = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date de validation ou de refus.",
    )

    class Meta:
        verbose_name = 'Demande de réouverture de CRQ'
        verbose_name_plural = 'Demandes de réouverture de CRQ'
        ordering = ('-date_demande',)

    def __str__(self):
        return (
            f"Demande de réouverture — {self.crq} "
            f"({self.get_statut_display()})"
        )

# ===========================================================================
# COMMENTAIRE
# ===========================================================================

class Commentaire(models.Model):
    """
    Commentaire attaché à une tâche, une instruction ou une activité.

    Un commentaire peut cibler une seule entité à la fois (tache,
    instruction ou activite). Les trois champs sont nullables et au
    moins l'un d'entre eux doit être renseigné — cette contrainte est
    appliquée au niveau applicatif.
    """

    contenu = models.TextField(
        help_text="Contenu du commentaire.",
    )
    # Trace de la cible même après suppression (dénormalisation légère)
    cible_type = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Type de la cible : TACHE, INSTRUCTION, BLOCAGE, ACTIVITE.",
    )
    cible_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="ID de la cible au moment de l'action (conservé après suppression).",
    )

    auteur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='commentaires_rediges',
        help_text="Utilisateur qui a rédigé le commentaire.",
    )

    tache = models.ForeignKey(
        Tache,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='commentaires',
        help_text="Tâche à laquelle le commentaire est attaché.",
    )

    instruction = models.ForeignKey(
        Instruction,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='commentaires',
        help_text="Instruction à laquelle le commentaire est attaché.",
    )

    activite = models.ForeignKey(
        Activite,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='commentaires',
        help_text="Activité à laquelle le commentaire est attaché.",
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création du commentaire.",
    )

    class Meta:
        verbose_name = 'Commentaire'
        verbose_name_plural = 'Commentaires'
        ordering = ('-date_creation',)

    def __str__(self):
        return f"Commentaire de {self.auteur} ({self.date_creation:%d/%m/%Y %H:%M})"


# ===========================================================================
# NOTIFICATION
# ===========================================================================

class Notification(models.Model):
    """
    Notification envoyée à un utilisateur.

    Les notifications sont créées par les services métier (à chaque
    événement significatif) et lues par l'utilisateur destinataire.
    """

    destinataire = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text="Utilisateur destinataire de la notification.",
    )

    type = models.CharField(
        max_length=50,
        choices=TypeNotification.choices,
        help_text="Type de la notification (détermine l'icône et le comportement).",
    )

    message = models.TextField(
        help_text="Message de la notification.",
    )

    lue = models.BooleanField(
        default=False,
        help_text="Indique si la notification a été lue par le destinataire.",
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création de la notification.",
    )

    class Meta:
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ('-date_creation',)

    def __str__(self):
        return f"{self.get_type_display()} → {self.destinataire}"

    def marquer_comme_lue(self):
        """Marque la notification comme lue."""
        if not self.lue:
            self.lue = True
            self.save(update_fields=['lue'])

# ===========================================================================
# SYNTHÈSE
# ===========================================================================

class Synthese(models.Model):
    """
    Synthèse d'activité générée sur une période.

    Une synthèse agrège les données des CRQ, tâches, instructions et
    blocages sur une période donnée (quotidienne, hebdomadaire, mensuelle).

    Le contenu est stocké en texte long (LONGTEXT en base). La génération
    est effectuée par le service metier dedie.
    """

    type = models.CharField(
        max_length=20,
        choices=TypeSynthese.choices,
        help_text="Type de synthèse.",
    )

    periode_debut = models.DateField(
        help_text="Début de la période couverte par la synthèse.",
    )

    periode_fin = models.DateField(
        help_text="Fin de la période couverte par la synthèse.",
    )

    contenu = models.TextField(
        help_text="Contenu textuel de la synthèse.",
    )

    date_generation = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de génération de la synthèse.",
    )

    genere_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='syntheses_generees',
        help_text="Utilisateur qui a généré la synthèse.",
    )

    class Meta:
        verbose_name = 'Synthèse'
        verbose_name_plural = 'Synthèses'
        ordering = ('-date_generation',)

    def __str__(self):
        return (
            f"Synthèse {self.get_type_display()} "
            f"({self.periode_debut:%d/%m/%Y} → {self.periode_fin:%d/%m/%Y})"
        )


# ===========================================================================
# PIÈCE JOINTE
# ===========================================================================

class PieceJointe(models.Model):
    """
    Fichier attaché à une tâche, une instruction, une activité, un
    événement ou un blocage.

    Une pièce jointe peut cibler une seule entité à la fois. Tous les
    champs de cible sont nullables. Le stockage physique est géré
    côté applicatif (chemin vers le fichier sur disque).
    """

    nom_fichier = models.CharField(
        max_length=255,
        help_text="Nom du fichier tel qu'affiché à l'utilisateur.",
    )

    chemin = models.CharField(
        max_length=500,
        help_text="Chemin physique du fichier sur le serveur.",
    )

    uploade_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.PROTECT,
        related_name='pieces_jointes_importees',
        help_text="Utilisateur qui a importé le fichier.",
    )

    tache = models.ForeignKey(
        Tache,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='pieces_jointes',
        help_text="Tâche à laquelle la pièce jointe est attachée.",
    )

    instruction = models.ForeignKey(
        Instruction,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='pieces_jointes',
        help_text="Instruction à laquelle la pièce jointe est attachée.",
    )

    activite = models.ForeignKey(
        Activite,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='pieces_jointes',
        help_text="Activité à laquelle la pièce jointe est attachée.",
    )

    evenement = models.ForeignKey(
        Evenement,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='pieces_jointes',
        help_text="Événement auquel la pièce jointe est attachée.",
    )

    blocage = models.ForeignKey(
        Blocage,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='pieces_jointes',
        help_text="Blocage auquel la pièce jointe est attachée.",
    )

    date_upload = models.DateTimeField(
        auto_now_add=True,
        help_text="Date d'import du fichier.",
    )

    class Meta:
        verbose_name = 'Pièce jointe'
        verbose_name_plural = 'Pièces jointes'
        ordering = ('-date_upload',)

    def __str__(self):
        return self.nom_fichier


# ===========================================================================
# HISTORIQUE DES ACTIONS
# ===========================================================================

class HistoriqueAction(models.Model):
    """
    Trace les actions critiques effectuées dans l'application.

    Chaque modification importante (création, changement de statut,
    réattribution, résolution de blocage, etc.) génère une entrée dans
    cette table. Elle couvre Tâches, Instructions, Blocages et Activités.

    Les champs de cible (tache, instruction, blocage, activite) sont
    tous nullables. Au moins l'un d'entre eux doit être renseigné pour
    identifier l'entité concernée. Cette contrainte est appliquée
    applicativement.
    """

    action = models.CharField(
        max_length=100,
        help_text=(
            "Code de l'action effectuée (ex : TACHE_REASSIGNEE, "
            "BLOCAGE_RESOLU_PAR_REATTRIBUTION, ECHEANCE_REPORTEE)."
        ),
    )
        # Trace de la cible même après suppression (dénormalisation légère)
    cible_type = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Type de la cible : TACHE, INSTRUCTION, BLOCAGE, ACTIVITE.",
    )
    cible_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="ID de la cible au moment de l'action (conservé après suppression).",
    )

    auteur = models.ForeignKey(
        Utilisateur,
        on_delete=models.PROTECT,
        related_name='actions_effectuees',
        blank=True,
        null=True,
        help_text=(
            "Utilisateur qui a effectué l'action. Nul pour les actions "
            "automatiques du système (escalade de blocage)."
        ),
    )

    tache = models.ForeignKey(
        Tache,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historique',
        help_text="Tâche concernée par l'action.",
    )

    instruction = models.ForeignKey(
        Instruction,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historique',
        help_text="Instruction concernée par l'action.",
    )

    blocage = models.ForeignKey(
        Blocage,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historique',
        help_text="Blocage concerné par l'action.",
    )

    activite = models.ForeignKey(
        Activite,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historique',
        help_text="Activité concernée par l'action.",
    )

    details = models.TextField(
        blank=True,
        default='',
        help_text="Détails supplémentaires sur l'action (contexte, motif, etc.).",
    )

    date_action = models.DateTimeField(
        auto_now_add=True,
        help_text="Date à laquelle l'action a été effectuée.",
    )

    class Meta:
        verbose_name = 'Action historique'
        verbose_name_plural = 'Historique des actions'
        ordering = ('-date_action',)

    def __str__(self):
        auteur = self.auteur if self.auteur_id else 'Système'
        return f"{self.action} par {auteur} ({self.date_action:%d/%m/%Y %H:%M})"