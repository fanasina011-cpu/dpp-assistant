"""
Serializers DRF pour l'application DPP.

Convention :
    Pour chaque modèle exposé via l'API, on fournit :
        - Les IDs des FK pour l'écriture (ex : createur).
        - Un champ <fk>_detail en lecture seule pour l'affichage imbriqué.
        - Des champs <champ>_display pour les libellés des enums.

            Serializers disponibles : Utilisateur, Evenement, Activite,
    Instruction, InstructionDestinataire, Tache, Blocage, Delegation,
    CompteRenduQuotidien, DemandeReouvertureCRQ, Commentaire, Notification,
    Synthese, PieceJointe, HistoriqueAction.

"""

from rest_framework import serializers

from .models import (
    Activite,
    Blocage,
    Commentaire,
    CompteRenduQuotidien,
    Delegation,
    DemandeReouvertureCRQ,
    Evenement,
    HistoriqueAction,
    Instruction,
    InstructionDestinataire,
    Notification,
    PieceJointe,
    Synthese,
    Tache,
    Utilisateur,
)


# ===========================================================================
# UTILISATEUR
# ===========================================================================

class UtilisateurShallowSerializer(serializers.ModelSerializer):
    """
    Version shallow de l'utilisateur, sans les rôles effectifs.

    Utilisée pour les imbrications courtes (chef de service délégué) afin
    d'éviter toute récursion : un utilisateur ne peut pas contenir
    plusieurs niveaux de `UtilisateurSerializer`.
    """

    nom_complet = serializers.SerializerMethodField()

    class Meta:
        model = Utilisateur
        fields = ('id', 'username', 'nom_complet', 'role', 'service')
        read_only_fields = fields

    def get_nom_complet(self, obj):
        return obj.get_nom_complet()


class UtilisateurSerializer(serializers.ModelSerializer):
    """
    Serializer de l'utilisateur.

    Utilisé notamment pour l'endpoint /auth/me et pour l'affichage
    imbriqué dans les autres serializers (<fk>_detail).

    Les champs de délégation décrivent les droits RÉELS de l'utilisateur :
        - roles_effectifs : rôle propre + rôles délégués en cours.
        - role_effectif : rôle métier principal.
        - est_chef_service : pilote au moins un service.
        - service_actuel : périmètre d'exercice (service délégué si D4).
        - a_delegation_active : une délégation est en cours.
    """

    nom_complet = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    roles_effectifs = serializers.SerializerMethodField()
    role_effectif = serializers.CharField(read_only=True)
    est_chef_service = serializers.BooleanField(read_only=True)
    service_actuel = serializers.CharField(read_only=True)
    a_delegation_active = serializers.BooleanField(read_only=True)
    chef_service_delegue_detail = UtilisateurShallowSerializer(
        source='chef_service_delegue', read_only=True,
    )

    class Meta:
        model = Utilisateur
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'nom_complet',
            'role',
            'role_display',
            'role_effectif',
            'roles_effectifs',
            'est_chef_service',
            'a_delegation_active',
            'service',
            'service_actuel',
            'chef_service_delegue_detail',
            'is_active',
            'date_joined',
        )
        read_only_fields = fields

    def get_nom_complet(self, obj):
        return obj.get_nom_complet()

    def get_roles_effectifs(self, obj):
        """Rôles effectifs triés (rôle propre en tête)."""
        return obj.roles_effectifs_tries



# ===========================================================================
# VERSIONS SHALLOW (sans relations inverses)
# ===========================================================================
#
# Ces serializers sont utilisés pour l'affichage imbriqué quand l'entité
# cible elle-même pointe en retour vers l'entité parente. Ils n'incluent
# PAS les relations inverses, ce qui casse les cycles de sérialisation.
#

class TacheShallowSerializer(serializers.ModelSerializer):
    """
    Version shallow du serializer Tache.

    Utilisée dans Instruction.tache_cible_detail et Blocage.tache_detail.
    N'inclut PAS
    instruction_detail ni activite_detail pour éviter la récursion
    Tache → Instruction → Tache → ...
    """

    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    priorite_display = serializers.CharField(source='get_priorite_display', read_only=True)
    est_en_retard = serializers.SerializerMethodField()
    responsable_detail = UtilisateurShallowSerializer(
        source='responsable', read_only=True,
    )

    class Meta:
        model = Tache
        fields = (
            'id',
            'titre',
            'description',
            'responsable',
            'responsable_detail',
            'date_debut',
            'date_echeance',
            'priorite',
            'priorite_display',
            'statut',
            'statut_display',
            'est_en_retard',
            'date_terminaison',
            'date_creation',
        )

    def get_est_en_retard(self, obj):
        return obj.est_en_retard()


class InstructionShallowSerializer(serializers.ModelSerializer):
    """
    Version shallow du serializer Instruction.

    Utilisée dans Tache.instruction_detail. N'inclut PAS
    tache_cible_detail ni activite_cible_detail pour éviter la récursion
    Instruction → Tache → Instruction → ...
    """

    emetteur_detail = UtilisateurSerializer(source='emetteur', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    priorite_display = serializers.CharField(source='get_priorite_display', read_only=True)

    class Meta:
        model = Instruction
        fields = (
            'id',
            'titre',
            'description',
            'priorite',
            'priorite_display',
            'date_echeance',
            'statut',
            'statut_display',
            'emetteur',
            'emetteur_detail',
            'tache_cible',
            'activite_cible',
            'date_creation',
        )

class EvenementSerializer(serializers.ModelSerializer):
    """
    Serializer des événements d'agenda.

    En lecture :
        - `createur_detail` et `participants_detail` retournent les objets
          Utilisateur imbriqués.
        - Les champs `<enum>_display` retournent les libellés lisibles.

    En écriture :
        - `createur` (ID) est accepté pour l'assignation.
        - `participants` (liste d'IDs) est accepté.
        - `type`, `statut`, `niveau_priorite` reçoivent les valeurs d'enum.

    Le champ `rappel_envoye` est en lecture seule : il est piloté par le
    job notifier_evenements_imminents.
    """

    createur_detail = UtilisateurSerializer(source='createur', read_only=True)
    participants_detail = UtilisateurSerializer(
        source='participants', many=True, read_only=True,
    )
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    niveau_priorite_display = serializers.CharField(
        source='get_niveau_priorite_display', read_only=True,
    )

    class Meta:
        model = Evenement
        fields = (
            'id',
            'titre',
            'description',
            'type',
            'type_display',
            'date_debut',
            'date_fin',
            'statut',
            'statut_display',
            'niveau_priorite',
            'niveau_priorite_display',
            'rappel_envoye',
            'createur',
            'createur_detail',
            'participants',
            'participants_detail',
            'date_creation',
        )
        read_only_fields = ('createur', 'date_creation', 'rappel_envoye')
    def validate(self, attrs):
        """Vérifie que la date de fin est postérieure à la date de début."""
        date_debut = attrs.get('date_debut') or getattr(self.instance, 'date_debut', None)
        date_fin = attrs.get('date_fin') or getattr(self.instance, 'date_fin', None)

        if date_debut and date_fin and date_fin <= date_debut:
            raise serializers.ValidationError({
                'date_fin': 'La date de fin doit être postérieure à la date de début.',
            })

        return attrs

# ===========================================================================
# ACTIVITÉ
# ===========================================================================

class ActiviteSerializer(serializers.ModelSerializer):
    """
    Serializer des activités.

    Une activité regroupe plusieurs tâches autour d'un objectif commun.

    En lecture :
        - `responsable_detail` et `createur_detail` retournent les
          objets Utilisateur imbriqués.
        - `<enum>_display` retourne les libellés lisibles.
        - `peut_etre_cloturee` indique si toutes les tâches sont terminées.

    En écriture :
        - `responsable` et `createur` reçoivent des IDs d'utilisateur.
        - `statut` et `priorite` reçoivent les valeurs d'enum.
    """

    responsable_detail = UtilisateurSerializer(source='responsable', read_only=True)
    createur_detail = UtilisateurSerializer(source='createur', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    priorite_display = serializers.CharField(source='get_priorite_display', read_only=True)
    peut_etre_cloturee = serializers.SerializerMethodField()

    class Meta:
        model = Activite
        fields = (
            'id',
            'titre',
            'description',
            'statut',
            'statut_display',
            'priorite',
            'priorite_display',
            'date_debut',
            'date_echeance',
            'responsable',
            'responsable_detail',
            'createur',
            'createur_detail',
            'peut_etre_cloturee',
            'date_creation',
        )
        read_only_fields = ('createur', 'date_creation')

    def get_peut_etre_cloturee(self, obj):
        return obj.peut_etre_cloturee()

    def validate(self, attrs):
        """Vérifie que la date d'échéance est postérieure à la date de début."""
        date_debut = attrs.get('date_debut') or getattr(self.instance, 'date_debut', None)
        date_echeance = attrs.get('date_echeance') or getattr(self.instance, 'date_echeance', None)

        if date_debut and date_echeance and date_echeance <= date_debut:
            raise serializers.ValidationError({
                'date_echeance': "La date d'échéance doit être postérieure à la date de début.",
            })

        return attrs

# ===========================================================================
# INSTRUCTION + DESTINATAIRE
# ===========================================================================

class InstructionDestinataireSerializer(serializers.ModelSerializer):
    """
    Serializer d'un destinataire d'instruction.

    Cette entité porte le statut d'exécution d'un destinataire donné pour
    une instruction donnée. Elle est créée séparément (voir l'endpoint
    dédié), pas imbriquée dans l'instruction.
    """

    destinataire_detail = UtilisateurSerializer(source='destinataire', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = InstructionDestinataire
        fields = (
            'id',
            'instruction',
            'destinataire',
            'destinataire_detail',
            'statut',
            'statut_display',
            'commentaire',
            'date_maj',
        )
        read_only_fields = ('date_maj',)


class InstructionSerializer(serializers.ModelSerializer):
    """
    Serializer des instructions.

    En lecture :
        - `emetteur_detail`, `saisie_par_detail` : objets Utilisateur imbriqués.
        - `activite_cible_detail` et `tache_cible_detail` : objets cibles imbriqués.
        - `destinataires` : liste complète des destinataires avec leur statut.
        - `cible_type` : indique si l'instruction cible une tâche, une
          activité, ou rien (instruction générale).

    En écriture :
        - `emetteur` et `saisie_par` reçoivent des IDs d'utilisateur.
        - `activite_cible` et `tache_cible` reçoivent des IDs d'entité.
        - **Les destinataires ne sont PAS créés via ce serializer.** Ils
          doivent être ajoutés via l'endpoint dédié (POST /instructions/{id}/destinataires/).
          C'est la raison pour laquelle `destinataires` est en lecture seule.

    Validation :
        - `activite_cible` et `tache_cible` sont mutuellement exclusifs.
    """

    emetteur_detail = UtilisateurSerializer(source='emetteur', read_only=True)
    saisie_par_detail = UtilisateurSerializer(source='saisie_par', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    priorite_display = serializers.CharField(source='get_priorite_display', read_only=True)
    destinataires = InstructionDestinataireSerializer(many=True, read_only=True)

    activite_cible_detail = serializers.SerializerMethodField()
    tache_cible_detail = serializers.SerializerMethodField()
    cible_type = serializers.SerializerMethodField()

    class Meta:
        model = Instruction
        fields = (
            'id',
            'titre',
            'description',
            'priorite',
            'priorite_display',
            'date_echeance',
            'statut',
            'statut_display',
            'emetteur',
            'emetteur_detail',
            'saisie_par',
            'saisie_par_detail',
            'activite_cible',
            'activite_cible_detail',
            'tache_cible',
            'tache_cible_detail',
            'cible_type',
            'destinataires',
            'date_creation',
        )
        read_only_fields = ('emetteur', 'date_creation')

    def get_activite_cible_detail(self, obj):
        """Retourne le détail de l'activité ciblée, ou None."""
        if obj.activite_cible is None:
            return None
        # Import local pour éviter une dépendance circulaire au chargement.
        from .serializers import ActiviteSerializer
        return ActiviteSerializer(obj.activite_cible).data

    def get_tache_cible_detail(self, obj):
        """Retourne le détail shallow de la tâche ciblée, ou None."""
        if obj.tache_cible is None:
            return None
        return TacheShallowSerializer(obj.tache_cible).data

    def get_cible_type(self, obj):
        """
        Indique le type de cible de l'instruction.

        Valeurs possibles : 'TACHE', 'ACTIVITE', 'AUCUNE'.
        """
        if obj.tache_cible_id is not None:
            return 'TACHE'
        if obj.activite_cible_id is not None:
            return 'ACTIVITE'
        return 'AUCUNE'

    def validate(self, attrs):
        """Vérifie que les cibles sont mutuellement exclusives."""
        activite_cible = attrs.get(
            'activite_cible',
            getattr(self.instance, 'activite_cible', None),
        )
        tache_cible = attrs.get(
            'tache_cible',
            getattr(self.instance, 'tache_cible', None),
        )

        if activite_cible and tache_cible:
            raise serializers.ValidationError({
                'activite_cible': (
                    "Une instruction ne peut pas cibler simultanément "
                    "une activité et une tâche."
                ),
            })

        return attrs

# ===========================================================================
# TÂCHE
# ===========================================================================

class TacheSerializer(serializers.ModelSerializer):
    """
    Serializer des tâches.

    En lecture :
        - `createur_detail` et `responsable_detail` : Utilisateur imbriqué.
        - `instruction_detail` : Instruction d'origine (si générée depuis
          une instruction).
        - `activite_detail` : Activité de rattachement (si rattachée).
        - `est_en_retard` : booléen calculé (indicateur, non stocké).
        - `<enum>_display` : libellés lisibles.

    En écriture :
        - `createur`, `responsable` : IDs d'utilisateur.
        - `instruction`, `activite` : IDs d'entité.
        - `statut`, `priorite` : valeurs d'enum.

    Les champs de notification (`date_derniere_notif_retard`,
    `date_derniere_notif_echeance`) sont en lecture seule : ils sont
    pilotés par les jobs CRON.
    """

    createur_detail = UtilisateurSerializer(source='createur', read_only=True)
    responsable_detail = UtilisateurSerializer(source='responsable', read_only=True)

    instruction_detail = serializers.SerializerMethodField()
    activite_detail = serializers.SerializerMethodField()

    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    priorite_display = serializers.CharField(source='get_priorite_display', read_only=True)
    est_en_retard = serializers.SerializerMethodField()

    class Meta:
        model = Tache
        fields = (
            'id',
            'titre',
            'description',
            'date_debut',
            'date_echeance',
            'priorite',
            'priorite_display',
            'statut',
            'statut_display',
            'createur',
            'createur_detail',
            'responsable',
            'responsable_detail',
            'instruction',
            'instruction_detail',
            'activite',
            'activite_detail',
            'est_en_retard',
            'date_derniere_notif_retard',
            'date_derniere_notif_echeance',
            'date_terminaison',
            'date_creation',
        )
        read_only_fields = (
            'createur',
            'date_creation',
            'date_derniere_notif_retard',
            'date_derniere_notif_echeance',
            'date_terminaison',
        )

    def get_instruction_detail(self, obj):
        """Retourne le détail shallow de l'instruction d'origine, ou None."""
        if obj.instruction is None:
            return None
        return InstructionShallowSerializer(obj.instruction).data

    def get_activite_detail(self, obj):
        """Retourne le détail de l'activité de rattachement, ou None."""
        if obj.activite is None:
            return None
        from .serializers import ActiviteSerializer
        return ActiviteSerializer(obj.activite).data

    def get_est_en_retard(self, obj):
        return obj.est_en_retard()

    def validate(self, attrs):
        """Vérifie la cohérence des dates."""
        date_debut = attrs.get('date_debut') or getattr(self.instance, 'date_debut', None)
        date_echeance = attrs.get('date_echeance') or getattr(self.instance, 'date_echeance', None)

        if date_debut and date_echeance and date_echeance <= date_debut:
            raise serializers.ValidationError({
                'date_echeance': "La date d'échéance doit être postérieure à la date de début.",
            })

        return attrs

# ===========================================================================
# BLOCAGE
# ===========================================================================

class BlocageSerializer(serializers.ModelSerializer):
    """
    Serializer des blocages.

    En lecture :
        - `tache_detail` : tâche sur laquelle le blocage a été signalé
          (version shallow — voir TacheShallowSerializer — pour éviter
          la récursion Tache → Blocage → Tache).
        - `signale_par_detail`, `personne_sollicitee_detail`,
          `resolu_par_detail` : Utilisateur imbriqué.
        - `<enum>_display` : libellés lisibles.

    En écriture :
        - `tache`, `signale_par`, `personne_sollicitee`, `resolu_par` :
          IDs d'utilisateur ou de tâche.
        - `niveau_urgence`, `statut` : valeurs d'enum.

    Note : le champ `date_signalement` est en lecture seule (auto_now_add).
    Les champs `date_resolution` et `resolu_par` doivent être remplis
    explicitement lors de la résolution (pas automatiquement par ce serializer).

    Les champs d'escalade (`date_limite_action`) et de contestation
    (`motif_contestation`, `date_contestation`,
    `date_derniere_notif_rappel_contestation`) sont tous en lecture seule :
    ils sont alimentés par le job `escalader_blocages` et par les actions
    `contester` / `resoudre_contestation`, jamais par un écriture directe.
    """

    tache_detail = serializers.SerializerMethodField()
    signale_par_detail = UtilisateurSerializer(source='signale_par', read_only=True)
    personne_sollicitee_detail = UtilisateurSerializer(
        source='personne_sollicitee', read_only=True,
    )
    resolu_par_detail = UtilisateurSerializer(source='resolu_par', read_only=True)

    niveau_urgence_display = serializers.CharField(
        source='get_niveau_urgence_display', read_only=True,
    )
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = Blocage
        fields = (
            'id',
            'description',
            'niveau_urgence',
            'niveau_urgence_display',
            'statut',
            'statut_display',
            'tache',
            'tache_detail',
            'signale_par',
            'signale_par_detail',
            'personne_sollicitee',
            'personne_sollicitee_detail',
            'date_signalement',
            'date_limite_action',
            'date_resolution',
            'resolu_par',
            'resolu_par_detail',
            'motif_contestation',
            'date_contestation',
            'date_derniere_notif_rappel_contestation',
        )
        read_only_fields = (
            'signale_par',
            'date_signalement',
            'date_limite_action',
            'date_resolution',
            'resolu_par',
            'motif_contestation',
            'date_contestation',
            'date_derniere_notif_rappel_contestation',
        )

    def get_tache_detail(self, obj):
        """Retourne le détail shallow de la tâche concernée."""
        if obj.tache is None:
            return None
        return TacheShallowSerializer(obj.tache).data

    
# ===========================================================================
# DÉLÉGATION
# ===========================================================================

class DelegationSerializer(serializers.ModelSerializer):
    """
    Serializer des délégations temporaires de rôle.

    En lecture :
        - `delegant_detail`, `delegataire_detail` : Utilisateur imbriqué.
        - `role_delegue_display` : libellé lisible du rôle.
        - `est_active` : booléen calculé (drapeau actif + date dans la plage).

    En écriture :
        - `delegant`, `delegataire` : IDs d'utilisateur.
        - `role_delegue` : valeur d'enum.
        - `date_debut`, `date_fin` : dates au format ISO.

    Le champ `actif` reste modifiable (pour révocation manuelle), mais
    l'API devra également fournir un endpoint dédié de révocation.
    """

    delegant_detail = UtilisateurSerializer(source='delegant', read_only=True)
    delegataire_detail = UtilisateurSerializer(source='delegataire', read_only=True)
    role_delegue_display = serializers.CharField(
        source='get_role_delegue_display', read_only=True,
    )
    est_active = serializers.SerializerMethodField()
    en_cours = serializers.SerializerMethodField()

    class Meta:
        model = Delegation
        fields = (
            'id',
            'delegant',
            'delegant_detail',
            'delegataire',
            'delegataire_detail',
            'role_delegue',
            'role_delegue_display',
            'service',
            'date_debut',
            'date_fin',
            'actif',
            'est_active',
            'en_cours',
            'date_creation',
        )
        read_only_fields = ('delegant', 'date_creation')

    def get_est_active(self, obj):
        return obj.est_active()

    def get_en_cours(self, obj):
        """
        Alias frontend de `est_active`.

        Même source de vérité (délégation active à l'instant présent),
        nom orienté UI pour éviter toute divergence de calcul.
        """
        return self.get_est_active(obj)

    def validate(self, attrs):
        """Vérifie la cohérence des dates et l'absence d'auto-délégation."""
        date_debut = attrs.get('date_debut') or getattr(self.instance, 'date_debut', None)
        date_fin = attrs.get('date_fin') or getattr(self.instance, 'date_fin', None)
        delegant = attrs.get('delegant') or getattr(self.instance, 'delegant', None)
        delegataire = attrs.get('delegataire') or getattr(self.instance, 'delegataire', None)

        if date_debut and date_fin and date_fin <= date_debut:
            raise serializers.ValidationError({
                'date_fin': 'La date de fin doit être postérieure à la date de début.',
            })

        if delegant and delegataire and delegant == delegataire:
            raise serializers.ValidationError({
                'delegataire': 'Un utilisateur ne peut pas se déléguer à lui-même.',
            })

        return attrs

# ===========================================================================
# COMPTE-RENDU QUOTIDIEN
# ===========================================================================

class DemandeReouvertureCRQShallowSerializer(serializers.ModelSerializer):
    """
    Version shallow du serializer DemandeReouvertureCRQ.

    Utilisée dans CompteRenduQuotidien.demandes_reouverture pour éviter
    de re-sérialiser le CRQ lui-même (cycle CRQ → Demande → CRQ).
    """

    demandeur_detail = UtilisateurSerializer(source='demandeur', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = DemandeReouvertureCRQ
        fields = (
            'id',
            'demandeur',
            'demandeur_detail',
            'motif',
            'statut',
            'statut_display',
            'date_demande',
        )


class CompteRenduQuotidienSerializer(serializers.ModelSerializer):
    """
    Serializer des comptes-rendus quotidiens.

    En lecture :
        - `redacteur_detail` : Utilisateur imbriqué.
        - `demandes_reouverture` : liste des demandes attachées à ce CRQ
          (version shallow).

    En écriture :
        - `redacteur` : ID d'utilisateur.
        - `date_journaliere` : date au format YYYY-MM-DD.
        - Les cinq rubriques sont des champs texte optionnels.

    Le champ `est_cloture` est en lecture seule : il est piloté par le
    job cloturer_crq et par les validations de demande de réouverture.
    """

    redacteur_detail = UtilisateurSerializer(source='redacteur', read_only=True)
    demandes_reouverture = DemandeReouvertureCRQShallowSerializer(
        many=True, read_only=True,
    )

    class Meta:
        model = CompteRenduQuotidien
        fields = (
            'id',
            'redacteur',
            'redacteur_detail',
            'date_journaliere',
            'activites_realisees',
            'activites_en_cours',
            'activites_non_realisees',
            'difficultes',
            'prevues_lendemain',
            'est_cloture',
            'demandes_reouverture',
            'date_creation',
        )
        read_only_fields = ('redacteur', 'est_cloture', 'date_creation')

class DemandeReouvertureCRQSerializer(serializers.ModelSerializer):
    """
    Serializer des demandes de réouverture de CRQ.

    En lecture :
        - `crq` : ID du CRQ concerné.
        - `crq_detail` : version shallow du CRQ (sans ses demandes).
        - `demandeur_detail` et `validee_par_detail` : Utilisateur imbriqué.

    En écriture :
        - `crq` et `demandeur` : IDs.
        - `motif` : texte obligatoire.
        - `statut` : valeur d'enum.
        - `validee_par` : ID optionnel (rempli lors de la validation).

    Note : l'unicité d'une demande de réouverture par CRQ n'est PAS
    imposée en base. Plusieurs demandes peuvent être créées pour un même
    CRQ. La logique métier (empêcher la création si une demande est déjà
    en attente) sera gérée côté service.
    """

    demandeur_detail = UtilisateurSerializer(source='demandeur', read_only=True)
    validee_par_detail = UtilisateurSerializer(source='validee_par', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)

    crq_detail = serializers.SerializerMethodField()

    class Meta:
        model = DemandeReouvertureCRQ
        fields = (
            'id',
            'crq',
            'crq_detail',
            'demandeur',
            'demandeur_detail',
            'motif',
            'statut',
            'statut_display',
            'validee_par',
            'validee_par_detail',
            'date_demande',
            'date_validation',
        )
        read_only_fields = ('date_demande',)

    def get_crq_detail(self, obj):
        """
        Retourne une version shallow du CRQ pour éviter la récursion
        CRQ → Demande → CRQ → ...
        """
        if obj.crq is None:
            return None
        return {
            'id': obj.crq.id,
            'date_journaliere': obj.crq.date_journaliere,
            'est_cloture': obj.crq.est_cloture,
            'redacteur': obj.crq.redacteur_id,
        }

# ===========================================================================
# COMMENTAIRE
# ===========================================================================

class CommentaireSerializer(serializers.ModelSerializer):
    """
    Serializer des commentaires.

    Un commentaire peut être attaché à une Tache, une Instruction ou une
    Activite — un seul à la fois (les trois FK sont nullables et au moins
    l'une doit être renseignée).

    En lecture :
        - `auteur_detail` : Utilisateur imbriqué.
        - `cible_type` : indique sur quelle entité porte le commentaire
          ('TACHE', 'INSTRUCTION', 'ACTIVITE').

    En écriture :
        - `auteur`, `tache`, `instruction`, `activite` : IDs.
        - `contenu` : texte obligatoire.

    Les champs `tache_detail`, `instruction_detail` et `activite_detail`
    ne sont PAS exposés dans ce serializer pour éviter toute récursion
    (un commentaire sur une tâche qui aurait un commentaire sur son
    instruction, etc.). Si besoin, le client fera un appel séparé.
    """

    auteur_detail = UtilisateurSerializer(source='auteur', read_only=True)
    cible_type = serializers.SerializerMethodField()

    class Meta:
        model = Commentaire
        fields = (
            'id',
            'contenu',
            'auteur',
            'auteur_detail',
            'tache',
            'instruction',
            'activite',
            'cible_type',
            'date_creation',
        )
        read_only_fields = ('auteur', 'date_creation')

    def get_cible_type(self, obj):
        """
        Indique le type de cible du commentaire.

        Valeurs possibles : 'TACHE', 'INSTRUCTION', 'ACTIVITE', 'AUCUNE'.
        """
        if obj.tache_id is not None:
            return 'TACHE'
        if obj.instruction_id is not None:
            return 'INSTRUCTION'
        if obj.activite_id is not None:
            return 'ACTIVITE'
        return 'AUCUNE'

    def validate(self, attrs):
        """
        Vérifie qu'au moins une cible est renseignée, et qu'une seule
        (un commentaire ne peut pas être attaché à plusieurs entités).
        """
        tache = attrs.get('tache', getattr(self.instance, 'tache', None))
        instruction = attrs.get('instruction', getattr(self.instance, 'instruction', None))
        activite = attrs.get('activite', getattr(self.instance, 'activite', None))

        cibles = [c for c in (tache, instruction, activite) if c is not None]

        if len(cibles) == 0:
            raise serializers.ValidationError(
                "Un commentaire doit être attaché à une tâche, "
                "une instruction ou une activité."
            )

        if len(cibles) > 1:
            raise serializers.ValidationError(
                "Un commentaire ne peut être attaché qu'à une seule entité."
            )

        return attrs


# ===========================================================================
# NOTIFICATION
# ===========================================================================

class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer des notifications.

    En lecture :
        - `destinataire_detail` : Utilisateur imbriqué.
        - `type_display` : libellé lisible du type.

    En écriture :
        - `destinataire` : ID d'utilisateur.
        - `type` : valeur d'enum (24 valeurs possibles).
        - `message` : texte obligatoire.

    Le champ `lue` peut être modifié via un endpoint dédié
    (PATCH /notifications/{id}/lire) ou directement via PATCH classique.
    """

    destinataire_detail = UtilisateurSerializer(source='destinataire', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Notification
        fields = (
            'id',
            'destinataire',
            'destinataire_detail',
            'type',
            'type_display',
            'message',
            'lue',
            'date_creation',
        )
        read_only_fields = ('date_creation',)

# ===========================================================================
# SYNTHÈSE
# ===========================================================================

class SyntheseSerializer(serializers.ModelSerializer):
    """
    Serializer des synthèses d'activité.

    En lecture :
        - `genere_par_detail` : Utilisateur imbriqué (nullable).
        - `type_display` : libellé lisible.

    En écriture :
        - `genere_par` : ID d'utilisateur (optionnel).
        - `type` : valeur d'enum.
        - `periode_debut`, `periode_fin`, `contenu` : champs obligatoires.

    Le contenu de la synthèse est généralement généré automatiquement par
    un service, mais l'API accepte une création manuelle pour les cas
    exceptionnels.
    """

    genere_par_detail = UtilisateurSerializer(source='genere_par', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Synthese
        fields = (
            'id',
            'type',
            'type_display',
            'periode_debut',
            'periode_fin',
            'contenu',
            'genere_par',
            'genere_par_detail',
            'date_generation',
        )
        read_only_fields = ('date_generation',)

    def validate(self, attrs):
        """Vérifie la cohérence des dates."""
        periode_debut = attrs.get('periode_debut') or getattr(self.instance, 'periode_debut', None)
        periode_fin = attrs.get('periode_fin') or getattr(self.instance, 'periode_fin', None)

        if periode_debut and periode_fin and periode_fin < periode_debut:
            raise serializers.ValidationError({
                'periode_fin': 'La période de fin doit être postérieure ou égale à la période de début.',
            })

        return attrs


# ===========================================================================
# PIÈCE JOINTE
# ===========================================================================

class PieceJointeSerializer(serializers.ModelSerializer):
    """
    Serializer des pièces jointes.

    En lecture :
        - `uploade_par_detail` : Utilisateur imbriqué.
        - `cible_type` : indique sur quelle entité la pièce est attachée.
        - `cible_id` : ID de l'entité cible.

    En écriture :
        - `uploade_par` : ID d'utilisateur.
        - `nom_fichier`, `chemin` : champs obligatoires.
        - Exactement un des champs parmi `tache`, `instruction`,
          `activite`, `evenement`, `blocage` doit être renseigné.

    Note : les champs `<fk>_detail` ne sont PAS exposés pour éviter la
    récursion et parce que le nom du fichier + le chemin suffisent pour
    l'affichage. Un endpoint dédié de téléchargement sera mis en place.
    """

    uploade_par_detail = UtilisateurSerializer(source='uploade_par', read_only=True)
    cible_type = serializers.SerializerMethodField()
    cible_id = serializers.SerializerMethodField()

    class Meta:
        model = PieceJointe
        fields = (
            'id',
            'nom_fichier',
            'chemin',
            'uploade_par',
            'uploade_par_detail',
            'tache',
            'instruction',
            'activite',
            'evenement',
            'blocage',
            'cible_type',
            'cible_id',
            'date_upload',
        )
        read_only_fields = ('uploade_par', 'date_upload')

    def get_cible_type(self, obj):
        """Retourne le type de cible de la pièce jointe."""
        if obj.tache_id is not None:
            return 'TACHE'
        if obj.instruction_id is not None:
            return 'INSTRUCTION'
        if obj.activite_id is not None:
            return 'ACTIVITE'
        if obj.evenement_id is not None:
            return 'EVENEMENT'
        if obj.blocage_id is not None:
            return 'BLOCAGE'
        return 'AUCUNE'

    def get_cible_id(self, obj):
        """Retourne l'ID de l'entité cible, ou None."""
        return (
            obj.tache_id
            or obj.instruction_id
            or obj.activite_id
            or obj.evenement_id
            or obj.blocage_id
        )

    def validate(self, attrs):
        """Vérifie qu'une seule cible est renseignée."""
        cibles = [
            attrs.get('tache', getattr(self.instance, 'tache', None)),
            attrs.get('instruction', getattr(self.instance, 'instruction', None)),
            attrs.get('activite', getattr(self.instance, 'activite', None)),
            attrs.get('evenement', getattr(self.instance, 'evenement', None)),
            attrs.get('blocage', getattr(self.instance, 'blocage', None)),
        ]
        cibles = [c for c in cibles if c is not None]

        if len(cibles) == 0:
            raise serializers.ValidationError(
                "Une pièce jointe doit être attachée à une tâche, une instruction, "
                "une activité, un événement ou un blocage."
            )

        if len(cibles) > 1:
            raise serializers.ValidationError(
                "Une pièce jointe ne peut être attachée qu'à une seule entité."
            )

        return attrs


# ===========================================================================
# HISTORIQUE DES ACTIONS
# ===========================================================================

class HistoriqueActionSerializer(serializers.ModelSerializer):
    """
    Serializer de l'historique des actions.

    En lecture :
        - `auteur_detail` : Utilisateur imbriqué.
        - `cible_type` : type d'entité concernée.

    En écriture :
        - `action`, `details` : champs texte.
        - `auteur` : ID d'utilisateur.
        - Une seule cible autorisée parmi `tache`, `instruction`,
          `blocage`, `activite`.

    L'historique est généralement alimenté automatiquement par les services
    métier, mais l'API reste ouverte pour permettre des entrées manuelles
    (cas administratifs).
    """

    auteur_detail = UtilisateurSerializer(source='auteur', read_only=True)
    cible_type = serializers.SerializerMethodField()
    cible_id = serializers.SerializerMethodField()

    class Meta:
        model = HistoriqueAction
        fields = (
            'id',
            'action',
            'auteur',
            'auteur_detail',
            'tache',
            'instruction',
            'blocage',
            'activite',
            'cible_type',
            'cible_id',
            'details',
            'date_action',
        )
        read_only_fields = ('date_action',)

    def get_cible_type(self, obj):
        """Retourne le type de cible de l'action."""
        if obj.tache_id is not None:
            return 'TACHE'
        if obj.instruction_id is not None:
            return 'INSTRUCTION'
        if obj.blocage_id is not None:
            return 'BLOCAGE'
        if obj.activite_id is not None:
            return 'ACTIVITE'
        return 'AUCUNE'

    def get_cible_id(self, obj):
        """Retourne l'ID de l'entité cible, ou None."""
        return obj.tache_id or obj.instruction_id or obj.blocage_id or obj.activite_id


class ProfilUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer pour la modification de son propre profil.
    Champs autorisés : first_name, last_name, email.
    """

    class Meta:
        model = Utilisateur
        fields = ('first_name', 'last_name', 'email')

    def validate_email(self, value):
        if not value:
            return value
        qs = Utilisateur.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value


class MotDePasseUpdateSerializer(serializers.Serializer):
    """
    Serializer pour le changement de mot de passe.
    """

    ancien_mot_de_passe = serializers.CharField(write_only=True)


# ===========================================================================
# RECHERCHE TRANSVERSALE
# ===========================================================================

class ResultatRechercheSerializer(serializers.Serializer):
    """
    Un résultat de la recherche transversale (`GET /api/v1/recherche/`).

    Volontairement minimal : la recherche est déclenchée à la frappe dans
    le Header, chaque réponse transporte donc au plus quelques dizaines
    d'objets. On n'embarque pas les serializers métier complets (avec
    leurs objets imbriqués) : le frontend construit le lien à partir de
    `type` et `id`, et affiche `libelle` / `sous_titre`.
    """

    id = serializers.IntegerField(read_only=True)
    type = serializers.CharField(read_only=True)
    libelle = serializers.CharField(read_only=True)
    sous_titre = serializers.CharField(read_only=True, allow_blank=True, default='')
    nouveau_mot_de_passe = serializers.CharField(write_only=True, min_length=8)
    confirmation = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['nouveau_mot_de_passe'] != data['confirmation']:
            raise serializers.ValidationError(
                {'confirmation': "Les deux mots de passe ne correspondent pas."}
            )
        return data