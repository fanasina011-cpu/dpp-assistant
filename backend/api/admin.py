"""
Configuration de l'interface d'administration Django pour l'application DPP.

L'admin Django est un outil interne de gestion. Il ne fait pas partie de
l'application finale destinée aux utilisateurs. Il sert à :
    - Créer, modifier, désactiver des utilisateurs pendant le développement.
    - Inspecter les données pendant les tests.
    - Vérifier manuellement l'intégrité après migration.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    Utilisateur,
    Evenement,
    Activite,
    Instruction,
    InstructionDestinataire,
    Tache,
    Blocage,
    Delegation,
    CompteRenduQuotidien,
    DemandeReouvertureCRQ,
    Commentaire,
    Notification,
    Synthese,
    PieceJointe,
    HistoriqueAction,
)

@admin.register(Utilisateur)
class UtilisateurAdmin(DjangoUserAdmin):
    """
    Configuration de l'admin pour notre modèle Utilisateur.

    On hérite de DjangoUserAdmin pour conserver les fonctionnalités standard
    (gestion du mot de passe, permissions, groupes) et on ajoute les champs
    métier dans les formulaires d'affichage et d'édition.
    """

    # Colonnes affichées dans la liste des utilisateurs
    list_display = (
        'username',
        'first_name',
        'last_name',
        'email',
        'role',
        'service',
        'is_active',
        'is_staff',
    )

    # Filtres disponibles dans la barre latérale droite
    list_filter = (
        'role',
        'service',
        'is_active',
        'is_staff',
    )

    # Champs de recherche
    search_fields = (
        'username',
        'first_name',
        'last_name',
        'email',
    )

    # Ordre par défaut
    ordering = ('last_name', 'first_name')

    # Champs en lecture seule
    readonly_fields = ('last_login', 'date_joined')

    # Réorganisation des fieldsets : on insère nos champs métier
    # dans le formulaire d'édition.
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            'Informations métier DPP',
            {
                'fields': ('role', 'service', 'superieur_proche'),
            },
        ),
    )

    # Formulaire d'ajout d'un utilisateur : on ajoute aussi les champs métier
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (
            'Informations métier DPP',
            {
                'fields': ('role', 'service', 'superieur_proche'),
            },
        ),
    )





@admin.register(Evenement)
class EvenementAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les événements."""

    list_display = (
        'titre',
        'type',
        'date_debut',
        'date_fin',
        'statut',
        'niveau_priorite',
        'createur',
    )

    list_filter = (
        'type',
        'statut',
        'niveau_priorite',
    )

    search_fields = (
        'titre',
        'description',
    )

    date_hierarchy = 'date_debut'

    filter_horizontal = ('participants',)

    readonly_fields = ('date_creation',)

    ordering = ('-date_debut',)

@admin.register(Activite)
class ActiviteAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les activités."""

    list_display = (
        'titre',
        'statut',
        'priorite',
        'responsable',
        'createur',
        'date_echeance',
    )

    list_filter = (
        'statut',
        'priorite',
    )

    search_fields = (
        'titre',
        'description',
    )

    date_hierarchy = 'date_creation'

    readonly_fields = ('date_creation',)

    ordering = ('-date_creation',)


class InstructionDestinataireInline(admin.TabularInline):
    """Affiche les destinataires directement dans le formulaire d'instruction."""
    model = InstructionDestinataire
    extra = 1
    autocomplete_fields = ('destinataire',)


@admin.register(Instruction)
class InstructionAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les instructions."""

    list_display = (
        'titre',
        'priorite',
        'statut',
        'emetteur',
        'date_echeance',
        'date_creation',
    )

    list_filter = (
        'priorite',
        'statut',
    )

    search_fields = (
        'titre',
        'description',
    )

    date_hierarchy = 'date_creation'

    readonly_fields = ('date_creation',)

    inlines = (InstructionDestinataireInline,)

    ordering = ('-date_creation',)


@admin.register(InstructionDestinataire)
class InstructionDestinataireAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les destinataires d'instruction."""

    list_display = (
        'instruction',
        'destinataire',
        'statut',
        'date_maj',
    )

    list_filter = (
        'statut',
    )

    search_fields = (
        'instruction__titre',
        'destinataire__username',
        'destinataire__first_name',
        'destinataire__last_name',
    )

    autocomplete_fields = ('instruction', 'destinataire')

    ordering = ('-date_maj',)

@admin.register(Tache)
class TacheAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les tâches."""

    list_display = (
        'titre',
        'statut',
        'priorite',
        'responsable',
        'activite',
        'date_echeance',
        'date_creation',
    )

    list_filter = (
        'statut',
        'priorite',
    )

    search_fields = (
        'titre',
        'description',
    )

    date_hierarchy = 'date_creation'

    readonly_fields = ('date_creation',)

    autocomplete_fields = (
        'createur',
        'responsable',
        'instruction',
        'activite',
    )

    ordering = ('-date_creation',)

@admin.register(Blocage)
class BlocageAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les blocages."""

    list_display = (
        'tache',
        'niveau_urgence',
        'statut',
        'signale_par',
        'personne_sollicitee',
        'date_signalement',
        'date_resolution',
    )

    list_filter = (
        'statut',
        'niveau_urgence',
    )

    search_fields = (
        'description',
        'tache__titre',
    )

    date_hierarchy = 'date_signalement'

    readonly_fields = ('date_signalement',)

    autocomplete_fields = (
        'tache',
        'signale_par',
        'personne_sollicitee',
        'resolu_par',
    )

    ordering = ('-date_signalement',)


@admin.register(Delegation)
class DelegationAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les délégations."""

    list_display = (
        'delegant',
        'delegataire',
        'role_delegue',
        'date_debut',
        'date_fin',
        'actif',
    )

    list_filter = (
        'role_delegue',
        'actif',
    )

    search_fields = (
        'delegant__username',
        'delegant__first_name',
        'delegant__last_name',
        'delegataire__username',
        'delegataire__first_name',
        'delegataire__last_name',
    )

    date_hierarchy = 'date_debut'

    readonly_fields = ('date_creation',)

    autocomplete_fields = ('delegant', 'delegataire')

    ordering = ('-date_creation',)

@admin.register(CompteRenduQuotidien)
class CompteRenduQuotidienAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les comptes-rendus quotidiens."""

    list_display = (
        'redacteur',
        'date_journaliere',
        'est_cloture',
        'date_creation',
    )

    list_filter = (
        'est_cloture',
        'date_journaliere',
    )

    search_fields = (
        'redacteur__username',
        'redacteur__first_name',
        'redacteur__last_name',
    )

    date_hierarchy = 'date_journaliere'

    readonly_fields = ('date_creation',)

    autocomplete_fields = ('redacteur',)

    ordering = ('-date_journaliere',)


@admin.register(DemandeReouvertureCRQ)
class DemandeReouvertureCRQAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les demandes de réouverture de CRQ."""

    list_display = (
        'crq',
        'demandeur',
        'statut',
        'validee_par',
        'date_demande',
        'date_validation',
    )

    list_filter = (
        'statut',
    )

    search_fields = (
        'crq__redacteur__username',
        'crq__redacteur__first_name',
        'crq__redacteur__last_name',
        'demandeur__username',
        'demandeur__first_name',
        'demandeur__last_name',
    )

    date_hierarchy = 'date_demande'

    readonly_fields = ('date_demande',)

    autocomplete_fields = ('crq', 'demandeur', 'validee_par')

    ordering = ('-date_demande',)

@admin.register(Commentaire)
class CommentaireAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les commentaires."""

    list_display = (
        'auteur',
        'date_creation',
        'tache',
        'instruction',
        'activite',
    )

    list_filter = (
        'date_creation',
    )

    search_fields = (
        'contenu',
        'auteur__username',
        'auteur__first_name',
        'auteur__last_name',
    )

    date_hierarchy = 'date_creation'

    readonly_fields = ('date_creation',)

    autocomplete_fields = ('auteur', 'tache', 'instruction', 'activite')

    ordering = ('-date_creation',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les notifications."""

    list_display = (
        'destinataire',
        'type',
        'lue',
        'date_creation',
    )

    list_filter = (
        'type',
        'lue',
    )

    search_fields = (
        'message',
        'destinataire__username',
        'destinataire__first_name',
        'destinataire__last_name',
    )

    date_hierarchy = 'date_creation'

    readonly_fields = ('date_creation',)

    autocomplete_fields = ('destinataire',)

    ordering = ('-date_creation',)

@admin.register(Synthese)
class SyntheseAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les synthèses."""

    list_display = (
        'type',
        'periode_debut',
        'periode_fin',
        'genere_par',
        'date_generation',
    )

    list_filter = (
        'type',
    )

    search_fields = (
        'contenu',
        'genere_par__username',
        'genere_par__first_name',
        'genere_par__last_name',
    )

    date_hierarchy = 'date_generation'

    readonly_fields = ('date_generation',)

    autocomplete_fields = ('genere_par',)

    ordering = ('-date_generation',)


@admin.register(PieceJointe)
class PieceJointeAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour les pièces jointes."""

    list_display = (
        'nom_fichier',
        'uploade_par',
        'date_upload',
        'tache',
        'instruction',
        'activite',
        'evenement',
        'blocage',
    )

    list_filter = (
        'date_upload',
    )

    search_fields = (
        'nom_fichier',
        'chemin',
        'uploade_par__username',
        'uploade_par__first_name',
        'uploade_par__last_name',
    )

    date_hierarchy = 'date_upload'

    readonly_fields = ('date_upload',)

    autocomplete_fields = (
        'uploade_par',
        'tache',
        'instruction',
        'activite',
        'evenement',
        'blocage',
    )

    ordering = ('-date_upload',)


@admin.register(HistoriqueAction)
class HistoriqueActionAdmin(admin.ModelAdmin):
    """Configuration de l'admin pour l'historique des actions."""

    list_display = (
        'action',
        'auteur',
        'date_action',
        'tache',
        'instruction',
        'blocage',
        'activite',
    )

    list_filter = (
        'action',
        'date_action',
    )

    search_fields = (
        'action',
        'details',
        'auteur__username',
        'auteur__first_name',
        'auteur__last_name',
    )

    date_hierarchy = 'date_action'

    readonly_fields = ('date_action',)

    autocomplete_fields = (
        'auteur',
        'tache',
        'instruction',
        'blocage',
        'activite',
    )

    ordering = ('-date_action',)