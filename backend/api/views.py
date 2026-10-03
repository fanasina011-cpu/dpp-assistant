"""
ViewSets de l'application DPP.

Chaque ViewSet expose les endpoints REST pour un modèle :
    - list (GET /)
    - retrieve (GET /{id}/)
    - create (POST /)
    - update (PUT /{id}/)
    - partial_update (PATCH /{id}/)
    - destroy (DELETE /{id}/)

Plus des actions personnalisées (@action) pour les opérations métier
spécifiques.

Ce fichier est construit progressivement. Pour l'instant, seul le
TacheViewSet est disponible.

Socle de tri et de recherche serveur
------------------------------------
Chaque ViewSet list déclare explicitement `filter_backends`,
`ordering_fields` et `search_fields`. Rien n'est déclaré dans
`REST_FRAMEWORK['DEFAULT_FILTER_BACKENDS']` afin que les ViewSets hors
périmètre (Commentaire, PieceJointe, DemandeReouvertureCRQ) restent
inchangés.

`OrderingFilter` remplace le `.order_by()` codé en dur dans `get_queryset`
uniquement lorsque `?ordering=` est fourni et valide ; en son absence le
tri historique est conservé.

Deux restrictions assumées :

    - `ordering_fields` n'expose QUE des champs locaux du modèle, jamais de
      champ lié (`responsable__nom`, `service__nom`...). Huit ViewSets
      appliquent `.distinct()` dans leur filtre RBAC ; ordonner sur une
      colonne jointe force cette colonne dans le SELECT et casse le
      DISTINCT (doublons). Les colonnes concernées (`responsable`,
      `signale_par`, `service`, `delegant`, `destinataire`) restent triées
      côté client.

    - `search_fields` peut porter des clés étrangères DIRECTES
      (`tache__titre`, `redacteur__last_name`...). Un JOIN many-to-one ne
      multiplie pas les lignes, donc `.distinct()` reste valide et rien n'est
      forcé dans le SELECT — contrairement à un ORDER BY, qui est la seule
      opération qui casse le DISTINCT. Seules les relations inverses
      (one-to-many) sont exclues de `search_fields`, pour la même raison.
"""

import uuid
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
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
    RoleChoice,
    StatutBlocage,
    StatutInstruction,
    StatutTache,
    Synthese,
    Tache,
    TypeSynthese,
    Utilisateur,
)

from .permissions import (
    ActivitePermission,
    BlocagePermission,
    CRQPermission,
    CommentairePermission,
    DelegationPermission,
    EvenementPermission,
    InstructionPermission,
    PieceJointePermission,
    CHAMPS_CIBLE,
    a_acces_cible,
    SynthesePermission,
    TachePermission,
    est_chef_de_service,
    est_chef_du_service,
    est_conseillere,
    est_directeur,
    est_secretaire,
    service_actuel,
)
from .serializers import (
    ActiviteSerializer,
    ProfilUpdateSerializer,
    MotDePasseUpdateSerializer,
    BlocageSerializer,
    CommentaireSerializer,
    CompteRenduQuotidienSerializer,
    DelegationSerializer,
    DemandeReouvertureCRQSerializer,
    EvenementSerializer,
    HistoriqueActionSerializer,
    InstructionSerializer,
    NotificationSerializer,
    PieceJointeSerializer,
    ResultatRechercheSerializer,
    SyntheseSerializer,
    TacheSerializer,
    UtilisateurSerializer,
)

from .services import enregistrer_action, envoyer_notification

# ===========================================================================
# HELPERS D'AGRÉGATION (KPI serveur)
# ===========================================================================


def _base_agregeable(qs):
    """
    Retourne `qs` sans clause ORDER BY, pour permettre un COUNT/aggregate.

    Nécessaire sur les ViewSets dont le RBAC produit un `.distinct()` :
    MySQL rejette un `COUNT(DISTINCT ...) ORDER BY <colonne jointe>`, et
    Django ne retire pas l'ordre pour un simple `.count()`.
    """
    return qs.order_by()


def _compter_par(qs, champ):
    """Retourne {valeur: nombre} pour `champ`. Les valeurs nulles sont incluses."""
    return {
        (ligne[champ] or 'NON_RENSEIGNE'): ligne['n']
        for ligne in qs.values(champ).annotate(n=Count(champ)).order_by(champ)
    }


class TriAvecNulsEnFin(OrderingFilter):
    """
    `OrderingFilter` qui place les valeurs nulles en fin de tri.

    MySQL classe les NULL **avant** les valeurs en ordre croissant ;
    PostgreSQL les classe après. Le comparateur JavaScript historique des
    pages listes utilisait `Infinity`, donc les valeurs nulles en fin.

    Sans cette correction, passer au tri serveur changerait l'ordre
    affiché : les tâches sans échéance passeraient en tête au lieu d'être
    en dernier.

    Implémentation : chaque champ trié potentiellement nul reçoit une
    annotation entière (0 = renseigné, 1 = nul) qui est triée en ordre
    croissant, AVANT le champ demandé. L'annotation est donc toujours
    ascendante, et seule la colonne métier suit le sens demandé : les
    nuls restent en fin dans les deux sens.
    """

    #: Champs exposés par `ordering_fields` qui peuvent valoir NULL.
    CHAMPS_NULS = ('date_echeance', 'date_resolution', 'date_fin')

    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)
        if not ordering:
            return queryset

        annotations = {}
        termes = []

        for terme in ordering:
            descendant = terme.startswith('-')
            champ = terme[1:] if descendant else terme

            if champ in self.CHAMPS_NULS:
                alias = f'_tri_{champ}'
                annotations[alias] = Case(
                    When(**{f'{champ}__isnull': True}, then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
                # Toujours ascendant : place les nuls en fin, quel que soit
                # le sens demandé pour la colonne métier.
                termes.append(alias)

            termes.append(terme)

        if annotations:
            queryset = queryset.annotate(**annotations)

        return queryset.order_by(*termes)


# ===========================================================================
# FILTRES DE PÉRIODE
# ===========================================================================
#
# Query params `date_debut` / `date_fin`, format `YYYY-MM-DD`.
#
# `date_fin` est inclusif sur la journée entière. Sur un DateTimeField, un
# `__lte` naïf exclurait tout ce qui suit minuit le jour même ; on utilise
# donc une borne exclusive `< date_fin + 1 jour`.
#
# Un paramètre mal formé est ignoré silencieusement plutôt que de renvoyer
# une erreur 500 sur une saisie utilisateur.


def _parse_date_param(valeur):
    """Parse une date `YYYY-MM-DD`. Retourne None si absente ou invalide."""
    if not valeur:
        return None
    try:
        return datetime.strptime(valeur.strip()[:10], '%Y-%m-%d').date()
    except (AttributeError, TypeError, ValueError):
        return None


def filtrer_periode(qs, champ, date_debut, date_fin, datetime_field=False):
    """
    Borne `qs` sur `champ` avec `date_debut` / `date_fin`.

    `date_debut` : borne inclusive basse (>=).
    `date_fin`   : borne inclusive haute sur la journée entière.

    `datetime_field=True` pour un DateTimeField (borne haute exclusive).
    """
    debut = _parse_date_param(date_debut)
    debut = _parse_date_param(date_debut)
    if debut is not None:
        qs = qs.filter(**{f'{champ}__gte': debut})

    fin = _parse_date_param(date_fin)
    if fin is not None:
        if datetime_field:
            qs = qs.filter(**{f'{champ}__lt': fin + timedelta(days=1)})
        else:
            qs = qs.filter(**{f'{champ}__lte': fin})

    return qs


# ===========================================================================
# CATÉGORISATION DES ACTIONS D'HISTORIQUE
# ===========================================================================
#
# La catégorie d'une action n'est PAS une colonne : c'est une cascade de
# tests `includes()` sur la chaîne `action`, performed côté frontend. Pour
# pouvoir la FILTRER sans trainer une liste tronquée par la pagination, la
# même cascade est reproduite ici.
#
# Le premier motif qui matche gagne : chaque catégorie doit donc exclure
# toutes celles qui la précèdent, sans quoi une action matchant deux motifs
# appartiendrait à deux catégories.


#: Catégories d'action, de la plus prioritaire à la moins prioritaire.
#:
#: DOIT rester strictement identique à `categoriserAction()` dans
#: `frontend/src/pages/Historique.tsx`, qui s'en sert pour l'AFFICHAGE
#: (couleur du badge). Le frontend classe, le backend filtre : toute
#: divergence entre les deux fait mentir le filtre par rapport aux badges.
#:
#: Si `categoriserAction()` change dans `Historique.tsx`, ce bloc DOIT être
#: mis à jour et le test de pin (`test_categories_action_synchronisees`)
#: régénéré.
CATEGORIES_ACTION = (
    ('CREATION', ('CREEE', 'CREE')),
    ('MODIFICATION', ('MODIFIEE', 'MODIFIE')),
    ('STATUT', ('STATUT',)),
    ('REASSIGNATION', ('REASSIGNEE', 'REASSIGNATION')),
    ('ECHEANCE', ('ECHEANCE',)),
    ('ANNULATION', ('ANNULATION',)),
    ('CLOTURE', ('CLOTURE', 'RESOLU', 'TERMINEE')),
    ('SUPPRESSION', ('SUPPRIMEE', 'SUPPRIME')),
    ('DELEGATION', ('DELEGATION',)),
)


def _q_categorie_action(categorie):
    """
    Traduit une catégorie d'action en `Q` reproduisant fidèlement la cascade
    de `categoriserAction()` : la catégorie demandée exclut toutes celles qui
    la précèdent dans `CATEGORIES_ACTION`.

    La branche `action == 'CREATION'` du frontend est redondante ici :
    `icontains('CREE')` matche déjà la chaîne exacte `CREATION`.

    Une catégorie inconnue ne matche rien plutôt que de tout laisser passer.
    """
    motifs = dict(CATEGORIES_ACTION)
    if categorie not in motifs:
        return Q(pk__in=[])

    q = Q(pk__in=[])
    for motif in motifs[categorie]:
        q |= Q(action__icontains=motif)

    for precedent, ses_motifs in CATEGORIES_ACTION:
        if precedent == categorie:
            break
        for motif in ses_motifs:
            q &= ~Q(action__icontains=motif)

    return q
from .files import FichierInvalide, extension_de, nom_sur, valider_fichier


# ===========================================================================
# TÂCHE
# ===========================================================================

class TacheViewSet(viewsets.ModelViewSet):
    """
    ViewSet des tâches.

    Filtrage queryset selon le rôle :
        - Directeur : toutes les tâches.
        - Chef de service : tâches de son service + celles qu'il a créées.
        - Autres rôles : tâches où l'utilisateur est responsable ou créateur.

    Permissions fines :
        - has_object_permission gère les droits objet (TachePermission).
        - Les actions `changer_statut` et `assigner` ont leurs propres
          permission_classes (contrôle manuel à l'intérieur).
    """

    serializer_class = TacheSerializer
    permission_classes = [IsAuthenticated, TachePermission]
    queryset = Tache.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement : le RBAC de ce ViewSet peut produire des
    # jointures, or ordonner sur une colonne liée force cette colonne dans
    # le SELECT et casse le DISTINCT. Voir l'en-tête du module.
    # `statut` et `priorite` sont volontairement absents : leur ordre métier
    # (BLOQUEE, EN_ATTENTE, EN_COURS, ...) n'est pas un ordre alphabétique et
    # reste appliqué côté client.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`statut`, `priorite`) : ordre
    # métier arbitraire (BLOQUEE < EN_ATTENTE < EN_COURS < ...), pas
    # d'ordre alphabétique. Le serveur les trierait par valeur brute.
    ordering_fields = ['titre', 'date_creation', 'date_echeance']
    search_fields = ['titre', 'description']

    TRANSITIONS_AUTORISEES = {
        'A_FAIRE':    {'EN_COURS', 'EN_ATTENTE', 'BLOQUEE', 'A_VALIDER'},
        'EN_COURS':   {'A_FAIRE', 'EN_ATTENTE', 'BLOQUEE', 'A_VALIDER', 'ANNULEE'},
        'EN_ATTENTE': {'A_FAIRE', 'EN_COURS', 'BLOQUEE', 'A_VALIDER', 'ANNULEE'},
        'BLOQUEE':    {'EN_COURS', 'EN_ATTENTE', 'A_VALIDER'},
        'A_VALIDER':  {'A_FAIRE', 'EN_COURS', 'TERMINEE', 'ANNULEE'},
        'TERMINEE':   {'A_FAIRE', 'EN_COURS', 'A_VALIDER', 'ANNULEE'},
        'ANNULEE':    {'A_FAIRE', 'EN_COURS', 'A_VALIDER', 'TERMINEE'},
    }

    def get_queryset(self):
        """
        Filtre les tâches selon :
            - le rôle de l'utilisateur connecté (RBAC),
            - les query params optionnels (`statut`, `priorite`, `en_retard`,
              `responsable`, `activite`).
        """
        user = self.request.user

        qs = Tache.objects.all().select_related(
            'createur', 'responsable', 'instruction', 'activite',
        ).order_by('-date_creation')

        # --- Filtrage RBAC ---
        if est_directeur(user):
            pass  # toutes les tâches
        elif est_chef_de_service(user):
            # Le chef voit :
            #   - les tâches de son service
            #   - les tâches qu'il a créées
            #   - TOUTES les tâches de ses activités (même non assignées)
            qs = qs.filter(
                Q(responsable__service=service_actuel(user))
                | Q(createur=user)
                | Q(activite__responsable=user)
            ).distinct()
        else:
            # Membre : ses tâches assignées ou créées
            qs = qs.filter(Q(responsable=user) | Q(createur=user))

        # --- Filtres utilisateur ---
        statut = self.request.query_params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)

        priorite = self.request.query_params.get('priorite')
        if priorite:
            qs = qs.filter(priorite=priorite)

        responsable = self.request.query_params.get('responsable')
        if responsable:
            qs = qs.filter(responsable_id=responsable)

        activite = self.request.query_params.get('activite')
        if activite:
            qs = qs.filter(activite_id=activite)

        en_retard = self.request.query_params.get('en_retard')
        if en_retard == 'true':
            from django.utils import timezone
            qs = qs.filter(
                date_echeance__lt=timezone.now(),
                date_echeance__isnull=False,
            ).exclude(statut__in=['TERMINEE', 'ANNULEE'])

        # --- Période sur la date d'échéance (date_debut / date_fin) ---
        qs = filtrer_periode(
            qs,
            'date_echeance',
            self.request.query_params.get('date_debut'),
            self.request.query_params.get('date_fin'),
            datetime_field=True,
        )

        # `sans_date=true` sélectionne les tâches sans échéance. Ce filtre
        # n'est PAS exprimable via une borne de période (une borne exclut les
        # NULL) ; sans lui, le `count` et la pagination de la page inclueraient
        # des tâches datées que la liste n'afficherait pas.
        if self.request.query_params.get('sans_date') == 'true':
            qs = qs.filter(date_echeance__isnull=True)

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/taches/stats/

        KPI calculés sur l'INTÉGRALITÉ du périmètre de l'utilisateur, pas
        sur la page courante. Reprend le RBAC de `get_queryset` et les
        filtres de liste actifs (statut, priorité, responsable, période,
        recherche) : filtrer la liste filtre les KPI de la même façon.

        Lecture seule : ne modifie aucun statut et n'applique aucune
        transition de la matrice de validation.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'par_statut': _compter_par(qs, 'statut'),
            'en_cours': qs.filter(statut=StatutTache.EN_COURS).count(),
            'a_valider': qs.filter(statut=StatutTache.A_VALIDER).count(),
            'terminees': qs.filter(statut=StatutTache.TERMINEE).count(),
            'en_retard': qs.filter(
                date_echeance__isnull=False,
                date_echeance__lt=timezone.now(),
            ).exclude(
                statut__in=[StatutTache.TERMINEE, StatutTache.ANNULEE],
            ).count(),
        })

    def perform_create(self, serializer):
        """
        Force le créateur à l'utilisateur connecté.
        Valide que le Chef crée uniquement dans ses activités.
        """
        user = self.request.user
        activite = serializer.validated_data.get('activite')

        # Validation : Chef doit créer uniquement dans ses activités
        if est_chef_de_service(user):
            if activite and activite.responsable_id != user.id:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'activite': (
                        "En tant que Chef, vous ne pouvez créer des tâches "
                        "que dans les activités dont vous êtes responsable."
                    )
                })

        tache = serializer.save(createur=user)

        enregistrer_action(
            auteur=self.request.user,
            action='TACHE_CREEE',
            details=f"Tâche « {tache.titre} » créée.",
            tache=tache,
        )

        if tache.responsable and tache.responsable != self.request.user:
            envoyer_notification(
                destinataire=tache.responsable,
                type_notification='TACHE_ASSIGNEE',
                message=f"Une nouvelle tâche vous a été assignée : « {tache.titre} ».",
            )

        # Alerte priorité élevée
        if tache.priorite in ('HAUTE', 'URGENTE') and tache.responsable:
            envoyer_notification(
                destinataire=tache.responsable,
                type_notification='TACHE_PRIORITE_ELEVEE',
                message=(
                    f"Tâche prioritaire ({tache.get_priorite_display()}) : "
                    f"« {tache.titre} »."
                ),
            )

    def update(self, request, *args, **kwargs):
        """
        Modification complète (PUT) réservée au créateur ou au Directeur.

        Un responsable ne peut pas modifier complètement une tâche via cet
        endpoint. Il doit utiliser PATCH /taches/{id}/statut/.
        """
        tache = self.get_object()
        user = request.user

        if not est_directeur(user) and tache.createur_id != user.id:
            return Response(
                {'detail': "Seul le créateur de la tâche ou le Directeur "
                           "peut la modifier complètement."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """
        Modification partielle (PATCH) réservée au créateur ou au Directeur.

        Le changement de statut par le responsable passe par l'action
        dédiée `changer_statut`.
        """
        tache = self.get_object()
        user = request.user

        if not est_directeur(user) and tache.createur_id != user.id:
            return Response(
                {'detail': "Seul le créateur de la tâche ou le Directeur "
                           "peut modifier cette tâche. Pour changer le "
                           "statut, utilisez PATCH /taches/{id}/statut/."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().partial_update(request, *args, **kwargs)

    def perform_update(self, serializer):
        """
        Enregistre la modification dans l'historique.
        Envoie une alerte si la priorité passe à HAUTE ou URGENTE.
        """
        # Récupérer la priorité AVANT la mise à jour
        ancienne_priorite = serializer.instance.priorite if serializer.instance else None

        tache = serializer.save()

        enregistrer_action(
            auteur=self.request.user,
            action='TACHE_MODIFIEE',
            details=f"Tâche « {tache.titre} » modifiée.",
            tache=tache,
        )

        # Alerte si la priorité a augmenté vers HAUTE ou URGENTE
        if (
            tache.priorite in ('HAUTE', 'URGENTE')
            and ancienne_priorite != tache.priorite
            and tache.responsable
        ):
            envoyer_notification(
                destinataire=tache.responsable,
                type_notification='TACHE_PRIORITE_ELEVEE',
                message=(
                    f"Priorité augmentée ({tache.get_priorite_display()}) sur "
                    f"« {tache.titre} »."
                ),
            )
            enregistrer_action(
                auteur=self.request.user,
                action='PRIORITE_ELEVEE',
                details=(
                    f"Priorité de « {tache.titre} » passée de "
                    f"{ancienne_priorite} à {tache.priorite}."
                ),
                tache=tache,
            )

    def destroy(self, request, *args, **kwargs):
        """
        Suppression réservée au créateur ou au Directeur.
        """
        tache = self.get_object()
        user = request.user

        if not est_directeur(user) and tache.createur_id != user.id:
            return Response(
                {'detail': "Seul le créateur de la tâche ou le Directeur "
                           "peut la supprimer."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        """
        Enregistre l'action AVANT de supprimer.
        """
        enregistrer_action(
            auteur=self.request.user,
            action='TACHE_SUPPRIMEE',
            details=f"Tâche « {instance.titre} » supprimée.",
            tache=instance,
        )
        instance.delete()
    @action(
        detail=True,
        methods=['post'],
        url_path='reporter-echeance',
        permission_classes=[IsAuthenticated],
    )
    def reporter_echeance(self, request, pk=None):
        """
        Modifie la date d'échéance d'une tâche avec un motif obligatoire.

        Endpoint : POST /api/v1/taches/{id}/reporter-echeance/
        Body : { "date_echeance": "2026-10-15T10:00:00", "motif": "..." }
        """
        from django.utils.dateparse import parse_datetime

        tache = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or tache.createur_id == user.id
            or tache.responsable_id == user.id
            or (
                est_chef_de_service(user)
                and tache.responsable
                and tache.responsable.service == service_actuel(user)
            )
        )
        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à reporter l'échéance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        nouvelle_date_str = request.data.get('date_echeance')
        if not nouvelle_date_str:
            return Response(
                {'detail': "Le champ 'date_echeance' est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nouvelle_date = parse_datetime(nouvelle_date_str)
        if not nouvelle_date:
            return Response(
                {'detail': "Format de date invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = (request.data.get('motif') or '').strip()
        if len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ancienne_date = tache.date_echeance
        tache.date_echeance = nouvelle_date
        tache.save(update_fields=['date_echeance'])

        ancienne_str = (
            ancienne_date.strftime('%d/%m/%Y %H:%M')
            if ancienne_date
            else '(aucune)'
        )
        nouvelle_str = nouvelle_date.strftime('%d/%m/%Y %H:%M')

        enregistrer_action(
            auteur=user,
            action='ECHEANCE_REPORTEE',
            details=(
                f"Échéance de « {tache.titre} » reportée "
                f"de {ancienne_str} à {nouvelle_str}. Motif : {motif}"
            ),
            tache=tache,
        )

        return Response(TacheSerializer(tache).data, status=status.HTTP_200_OK)
    # -----------------------------------------------------------------------
    # ACTIONS PERSONNALISÉES
    # -----------------------------------------------------------------------

    def _est_validateur(self, user, tache):
        """Directeur ou chef du service du responsable."""
        if est_directeur(user):
            return True
        responsable = tache.responsable
        if responsable and responsable.service:
            return est_chef_du_service(user, responsable.service)
        return False

    def _trouver_validateur(self, tache):
        """Retourne le validateur attendu : chef du service ou Directeur."""
        responsable = tache.responsable
        if responsable and responsable.service:
            chef = (
                Utilisateur.objects.filter(
                    Q(role__in=RoleChoice.roles_chef(), service=responsable.service)
                    | Q(chef_service_delegue__service=responsable.service)
                )
                .distinct()
                .first()
            )
            if chef:
                return chef
        return Utilisateur.objects.avec_role(RoleChoice.DIRECTEUR).first()

    @action(
        detail=True,
        methods=['patch'],
        url_path='statut',
        permission_classes=[IsAuthenticated],
    )
    def changer_statut(self, request, pk=None):
        """
        Change le statut d'une tâche.

        Endpoint : PATCH /api/v1/taches/{id}/statut/

        Body : { "statut": "EN_COURS" }

        Permission manuelle :
            - Directeur
            - Créateur de la tâche
            - Responsable de la tâche
            - Chef de service du responsable

        Matrice de transitions + validation :
            - Transitions soumises à validateur : sortie de A_VALIDER
              et réouverture depuis TERMINEE.
            - Validateur = Directeur OU chef du service du responsable.
              Si le responsable n'a pas de service → Directeur uniquement.
        """
        tache = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or tache.createur_id == user.id
            or tache.responsable_id == user.id
            or (
                est_chef_de_service(user)
                and tache.responsable
                and tache.responsable.service == service_actuel(user)
            )
        )

        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à modifier le statut "
                           "de cette tâche."},
                status=status.HTTP_403_FORBIDDEN,
            )

        nouveau_statut = request.data.get('statut')
        motif = (request.data.get('motif') or '').strip()

        if nouveau_statut not in dict(StatutTache.choices):
            return Response(
                {'detail': f"Statut invalide. Valeurs possibles : "
                           f"{list(dict(StatutTache.choices).keys())}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Motif obligatoire en cas d'annulation
        est_annulation = nouveau_statut == StatutTache.ANNULEE
        if est_annulation and len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire "
                           "pour annuler une tâche."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ancien_statut = tache.statut

        # Motif obligatoire en cas de rejet depuis A_VALIDER
        est_rejet = (
            ancien_statut == StatutTache.A_VALIDER
            and nouveau_statut in (StatutTache.EN_COURS, StatutTache.A_FAIRE)
        )
        if est_rejet and len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire "
                           "pour rejeter une tâche."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Matrice de transitions ---
        autorises = self.TRANSITIONS_AUTORISEES.get(ancien_statut, set())
        if nouveau_statut not in autorises:
            from_label = dict(StatutTache.choices).get(
                ancien_statut, ancien_statut
            )
            vers_label = dict(StatutTache.choices).get(
                nouveau_statut, nouveau_statut
            )
            autorisees = sorted(
                dict(StatutTache.choices).get(s, s)
                for s in self.TRANSITIONS_AUTORISEES.get(ancien_statut, set())
            )
            return Response(
                {'detail': (
                    f"Transition non autorisée : {from_label} → {vers_label}. "
                    f"Transitions autorisées depuis « {from_label} » : "
                    f"{', '.join(autorisees) or 'aucune'}."
                )},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Vérification validateur + anti auto-validation ---
        if ancien_statut == StatutTache.TERMINEE:
            if not self._est_validateur(user, tache):
                return Response(
                    {'detail': "Seul le Directeur ou le chef du service du "
                               "responsable peut réouvrir une tâche terminée."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if tache.responsable_id == user.id and not est_directeur(user):
                return Response(
                    {'detail': "Vous ne pouvez pas réouvrir votre propre tâche."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if ancien_statut == StatutTache.A_VALIDER:
            if not self._est_validateur(user, tache):
                return Response(
                    {'detail': "Seul le Directeur ou le chef du service du "
                               "responsable peut valider ou rejeter une tâche "
                               "en attente de validation."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if tache.responsable_id == user.id and not est_directeur(user):
                return Response(
                    {'detail': "Vous ne pouvez pas valider votre propre tâche."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # --- Mise à jour + date_terminaison ---
        tache.statut = nouveau_statut

        champs = ['statut']
        if nouveau_statut == StatutTache.TERMINEE:
            tache.date_terminaison = timezone.now()
            champs.append('date_terminaison')
        elif nouveau_statut == StatutTache.A_VALIDER:
            tache.date_terminaison = None
            champs.append('date_terminaison')
        elif ancien_statut == StatutTache.TERMINEE:
            tache.date_terminaison = None
            champs.append('date_terminaison')

        tache.save(update_fields=champs)

        if est_annulation:
            enregistrer_action(
                auteur=user,
                action='ANNULATION_MOTIVEE',
                details=f"Tâche « {tache.titre} » annulée. Motif : {motif}",
                tache=tache,
            )
        else:
            enregistrer_action(
                auteur=user,
                action='TACHE_STATUT_CHANGE',
                details=f"Statut de « {tache.titre} » changé de "
                        f"{ancien_statut} à {nouveau_statut}.",
                tache=tache,
            )

        # --- Notifications du workflow de validation ---
        if ancien_statut != StatutTache.A_VALIDER and nouveau_statut == StatutTache.A_VALIDER:
            validateur = self._trouver_validateur(tache)
            if validateur:
                envoyer_notification(
                    destinataire=validateur,
                    type_notification='TACHE_A_VALIDER',
                    message=f"La tâche « {tache.titre} » est en attente de votre validation.",
                )

        if ancien_statut == StatutTache.A_VALIDER and nouveau_statut == StatutTache.TERMINEE:
            if tache.responsable:
                envoyer_notification(
                    destinataire=tache.responsable,
                    type_notification='TACHE_VALIDEE',
                    message=f"Votre tâche « {tache.titre} » a été validée.",
                )

        if ancien_statut == StatutTache.A_VALIDER and nouveau_statut in (
            StatutTache.EN_COURS, StatutTache.A_FAIRE
        ):
            if tache.responsable:
                envoyer_notification(
                    destinataire=tache.responsable,
                    type_notification='TACHE_REJETEE',
                    message=f"Votre tâche « {tache.titre} » a été renvoyée pour modification. Motif : {motif}",
                )

        # Notifier le créateur si le changement est fait par quelqu'un d'autre
        if tache.createur != user:
            envoyer_notification(
                destinataire=tache.createur,
                type_notification='TACHE_MODIFIEE',
                message=f"Le statut de « {tache.titre} » a changé : "
                        f"{ancien_statut} → {nouveau_statut}.",
            )

        return Response(TacheSerializer(tache).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['patch'],
        url_path='assigner',
        permission_classes=[IsAuthenticated],
    )
    def assigner(self, request, pk=None):
        """
        Réassigne une tâche à un autre responsable.

        Endpoint : PATCH /api/v1/taches/{id}/assigner/

        Body : { "responsable": 5 }

        Permission manuelle :
            - Directeur
            - Créateur de la tâche
            - Chef de service du responsable actuel
        """
        from .models import Utilisateur

        tache = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or tache.createur_id == user.id
            or (
                est_chef_de_service(user)
                and tache.responsable
                and tache.responsable.service == service_actuel(user)
            )
        )

        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à réassigner cette tâche."},
                status=status.HTTP_403_FORBIDDEN,
            )

        nouveau_responsable_id = request.data.get('responsable')
        if not nouveau_responsable_id:
            return Response(
                {'detail': "Le champ 'responsable' est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            nouveau_responsable = Utilisateur.objects.get(id=nouveau_responsable_id)
        except Utilisateur.DoesNotExist:
            return Response(
                {'detail': "Utilisateur introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        ancien_responsable = tache.responsable
        tache.responsable = nouveau_responsable
        tache.save(update_fields=['responsable'])

        # Détails pour l'historique
        nom_ancien = str(ancien_responsable) if ancien_responsable else '(aucun)'
        nom_nouveau = str(nouveau_responsable)
        enregistrer_action(
            auteur=user,
            action='TACHE_REASSIGNEE',
            details=f"Réattribution de {nom_ancien} vers {nom_nouveau}.",
            tache=tache,
        )

        # Notification au nouveau responsable
        envoyer_notification(
            destinataire=nouveau_responsable,
            type_notification='TACHE_ASSIGNEE',
            message=f"La tâche « {tache.titre} » vous a été réassignée.",
        )

        # Notification à l'ancien responsable si différent
        if ancien_responsable and ancien_responsable != nouveau_responsable:
            envoyer_notification(
                destinataire=ancien_responsable,
                type_notification='TACHE_MODIFIEE',
                message=f"La tâche « {tache.titre} » ne vous est plus assignée.",
            )

        return Response(TacheSerializer(tache).data, status=status.HTTP_200_OK)

# ===========================================================================
# ACTIVITÉ
# ===========================================================================

class ActiviteViewSet(viewsets.ModelViewSet):
    """
    ViewSet des activités.

    Filtrage queryset selon le rôle :
        - Directeur : toutes les activités.
        - Chef de service : activités de son service + celles qu'il a créées.
        - Autres rôles : activités où l'utilisateur a une tâche rattachée,
          ou dont il est le responsable.

    Actions personnalisées :
        - POST /activites/{id}/cloturer/ : clôture l'activité si toutes
          ses tâches sont TERMINEE ou ANNULEE.
    """

    serializer_class = ActiviteSerializer
    permission_classes = [IsAuthenticated, ActivitePermission]
    queryset = Activite.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement (le RBAC joint sur tasks__responsable avec
    # .distinct()). Voir l'en-tête du module.
    # `statut` et `priorite` restent triés côté client : ordre métier.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`statut`, `priorite`) : ordre
    # métier arbitraire, pas d'ordre alphabétique. Voir l'en-tête du module.
    ordering_fields = ['titre', 'date_creation', 'date_echeance']
    search_fields = ['titre', 'description']

    def get_queryset(self):
        """
        Filtre les activités selon :
            - le rôle de l'utilisateur connecté (RBAC),
            - les query params optionnels (`statut`, `priorite`, `responsable`).
        """
        user = self.request.user

        qs = Activite.objects.all().select_related(
            'responsable', 'createur',
        ).prefetch_related('taches').order_by('-date_creation')

        # --- Filtrage RBAC ---
        if est_directeur(user):
            pass  # toutes les activités
        elif est_chef_de_service(user):
            qs = qs.filter(
                Q(responsable__service=service_actuel(user))
                | Q(createur=user)
                | Q(taches__responsable=user)
            ).distinct()
        else:
            qs = qs.filter(
                Q(responsable=user) | Q(taches__responsable=user)
            ).distinct()

        # --- Filtres utilisateur ---
        statut = self.request.query_params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)

        priorite = self.request.query_params.get('priorite')
        if priorite:
            qs = qs.filter(priorite=priorite)

        responsable = self.request.query_params.get('responsable')
        if responsable:
            qs = qs.filter(responsable_id=responsable)

        # --- Période sur la date d'échéance (date_debut / date_fin) ---
        qs = filtrer_periode(
            qs,
            'date_echeance',
            self.request.query_params.get('date_debut'),
            self.request.query_params.get('date_fin'),
            datetime_field=True,
        )

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/activites/stats/

        KPI sur l'intégralité du périmètre. Lecture seule.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'par_statut': _compter_par(qs, 'statut'),
            'en_cours': qs.filter(statut='EN_COURS').count(),
            # `cloturables` reproduit `Activite.peut_etre_cloturee()` :
            # aucune tâche à un statut non terminal. `.exclude()` sur une
            # relation produit un sous-requête NOT IN, sans jointure, donc
            # sans risque de casser le DISTINCT du RBAC.
            'cloturables': qs.exclude(
                taches__statut__in=[StatutTache.TERMINEE, StatutTache.ANNULEE],
            ).count(),
        })

    def perform_create(self, serializer):
        """Force le créateur à l'utilisateur connecté."""
        activite = serializer.save(createur=self.request.user)

        enregistrer_action(
            auteur=self.request.user,
            action='ACTIVITE_CREEE',
            details=f"Activité « {activite.titre} » créée.",
            activite=activite,
        )

        # Notification au responsable si différent du créateur
        if activite.responsable and activite.responsable != self.request.user:
            envoyer_notification(
                destinataire=activite.responsable,
                type_notification='ACTIVITE_CREEE',
                message=(
                    f"Une nouvelle activité vous a été confiée : "
                    f"« {activite.titre} »."
                ),
            )

    def update(self, request, *args, **kwargs):
        """Modification complète réservée au créateur, Directeur ou Chef du service."""
        activite = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or activite.createur_id == user.id
            or (
                est_chef_de_service(user)
                and activite.responsable
                and activite.responsable.service == service_actuel(user)
            )
        )

        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à modifier cette activité."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Idem update : contrôle manuel avant délégation."""
        return self.update(request, *args, **kwargs)

    def perform_update(self, serializer):
        """Enregistre la modification dans l'historique."""
        activite = serializer.save()
        enregistrer_action(
            auteur=self.request.user,
            action='ACTIVITE_MODIFIEE',
            details=f"Activité « {activite.titre} » modifiée.",
            activite=activite,
        )

    def destroy(self, request, *args, **kwargs):
        """Suppression réservée au créateur ou au Directeur."""
        activite = self.get_object()
        user = request.user

        if not est_directeur(user) and activite.createur_id != user.id:
            return Response(
                {'detail': "Seul le créateur de l'activité ou le Directeur "
                           "peut la supprimer."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        """Enregistre l'action AVANT de supprimer."""
        # Détacher d'abord les tâches (garde leur historique)
        instance.taches.update(activite=None)

        enregistrer_action(
            auteur=self.request.user,
            action='ACTIVITE_SUPPRIMEE',
            details=f"Activité « {instance.titre} » supprimée.",
            activite=instance,
        )
        instance.delete()

    # -----------------------------------------------------------------------
    # ACTIONS PERSONNALISÉES
    # -----------------------------------------------------------------------

    @action(
        detail=True,
        methods=['post'],
        url_path='cloturer',
        permission_classes=[IsAuthenticated],
    )
    def cloturer(self, request, pk=None):
        """
        Clôture une activité.

        Endpoint : POST /api/v1/activites/{id}/cloturer/

        Règles :
            - Autorisé : Directeur, créateur, ou Chef du service responsable.
            - L'activité doit avoir TOUTES ses tâches TERMINEE ou ANNULEE.
            - L'activité passe en statut CLOTUREE.

        Une fois clôturée, l'activité ne peut plus être modifiée
        (contrôle dans update/partial_update).
        """
        activite = self.get_object()
        user = request.user

        # Contrôle d'autorisation manuel
        autorise = (
            est_directeur(user)
            or activite.createur_id == user.id
            or (
                est_chef_de_service(user)
                and activite.responsable
                and activite.responsable.service == service_actuel(user)
            )
        )
        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à clôturer cette activité."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Vérification métier
        if activite.statut == 'CLOTUREE':
            return Response(
                {'detail': "Cette activité est déjà clôturée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not activite.peut_etre_cloturee():
            return Response(
                {'detail': "Impossible de clôturer : toutes les tâches de "
                           "cette activité doivent être terminées ou annulées."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Clôture
        activite.statut = 'CLOTUREE'
        activite.save(update_fields=['statut'])

        enregistrer_action(
            auteur=user,
            action='ACTIVITE_CLOTUREE',
            details=f"Activité « {activite.titre} » clôturée.",
            activite=activite,
        )

        return Response(ActiviteSerializer(activite).data, status=status.HTTP_200_OK)
    @action(
        detail=True,
        methods=['post'],
        url_path='annuler',
        permission_classes=[IsAuthenticated],
    )
    def annuler(self, request, pk=None):
        """
        Annule une activité avec un motif obligatoire.

        Endpoint : POST /api/v1/activites/{id}/annuler/
        Body : { "motif": "..." }
        """
        activite = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or activite.createur_id == user.id
            or (
                est_chef_de_service(user)
                and activite.responsable
                and activite.responsable.service == service_actuel(user)
            )
        )
        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à annuler cette activité."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if activite.statut == 'ANNULEE':
            return Response(
                {'detail': "Cette activité est déjà annulée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = (request.data.get('motif') or '').strip()
        if len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        activite.statut = 'ANNULEE'
        activite.save(update_fields=['statut'])

        enregistrer_action(
            auteur=user,
            action='ANNULATION_MOTIVEE',
            details=f"Activité « {activite.titre} » annulée. Motif : {motif}",
            activite=activite,
        )

        return Response(ActiviteSerializer(activite).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        url_path='reporter-echeance',
        permission_classes=[IsAuthenticated],
    )
    def reporter_echeance(self, request, pk=None):
        """
        Modifie la date d'échéance d'une activité avec un motif.

        Endpoint : POST /api/v1/activites/{id}/reporter-echeance/
        Body : { "date_echeance": "...", "motif": "..." }
        """
        from django.utils.dateparse import parse_datetime

        activite = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or activite.createur_id == user.id
            or (
                est_chef_de_service(user)
                and activite.responsable
                and activite.responsable.service == service_actuel(user)
            )
        )
        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à reporter l'échéance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        nouvelle_date_str = request.data.get('date_echeance')
        if not nouvelle_date_str:
            return Response(
                {'detail': "Le champ 'date_echeance' est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nouvelle_date = parse_datetime(nouvelle_date_str)
        if not nouvelle_date:
            return Response(
                {'detail': "Format de date invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = (request.data.get('motif') or '').strip()
        if len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ancienne_date = activite.date_echeance
        activite.date_echeance = nouvelle_date
        activite.save(update_fields=['date_echeance'])

        ancienne_str = (
            ancienne_date.strftime('%d/%m/%Y %H:%M')
            if ancienne_date
            else '(aucune)'
        )
        nouvelle_str = nouvelle_date.strftime('%d/%m/%Y %H:%M')

        enregistrer_action(
            auteur=user,
            action='ECHEANCE_REPORTEE',
            details=(
                f"Échéance de « {activite.titre} » reportée "
                f"de {ancienne_str} à {nouvelle_str}. Motif : {motif}"
            ),
            activite=activite,
        )

        return Response(ActiviteSerializer(activite).data, status=status.HTTP_200_OK)
# ===========================================================================
# BLOCAGE
# ===========================================================================

class BlocageViewSet(viewsets.ModelViewSet):
    """
    ViewSet des blocages.

    Filtrage queryset :
        - Directeur : tous les blocages.
        - Chef de service : blocages des tâches de son service + ceux qu'il a signalés.
        - Autres rôles : blocages qu'ils ont signalés, ou dont ils sont la
          personne sollicitée, ou qui concernent leurs tâches.

    Actions personnalisées :
        - POST /blocages/{id}/resoudre/ : passe en RESOLU et repasse la tâche en EN_COURS.
        - POST /blocages/{id}/remonter/ : passe en REMONTE_AU_DIRECTEUR.
    """

    serializer_class = BlocageSerializer
    permission_classes = [IsAuthenticated, BlocagePermission]
    queryset = Blocage.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement (le RBAC joint sur tache__* avec .distinct()).
    # Voir l'en-tête du module.
    # `statut` et `niveau_urgence` restent triés côté client : ordre métier.
    # `date_limite_action` est exposée : elle porte le délai d'escalade.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`statut`, `niveau_urgence`) :
    # ordre métier arbitraire (BLOQUEE < EN_ATTENTE < EN_COURS < ...).
    ordering_fields = [
        'date_signalement', 'date_limite_action', 'date_resolution',
    ]
    search_fields = ['description', 'tache__titre']

    def get_queryset(self):
        """
        Filtre les blocages selon :
            - le rôle de l'utilisateur connecté (RBAC),
            - les query params optionnels (`statut`, `niveau_urgence`, `tache`).
        """
        user = self.request.user

        qs = Blocage.objects.all().select_related(
            'tache', 'signale_par', 'personne_sollicitee', 'resolu_par',
        ).order_by('-date_signalement')

        # --- Filtrage RBAC ---
        if est_directeur(user):
            pass  # tous les blocages
        elif est_chef_de_service(user):
            qs = qs.filter(
                Q(tache__responsable__service=service_actuel(user))
                | Q(signale_par=user)
                | Q(personne_sollicitee=user)
            ).distinct()
        else:
            qs = qs.filter(
                Q(signale_par=user)
                | Q(personne_sollicitee=user)
                | Q(tache__responsable=user)
                | Q(tache__createur=user)
            ).distinct()

        # --- Filtres utilisateur ---
        statut = self.request.query_params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)

        niveau_urgence = self.request.query_params.get('niveau_urgence')
        if niveau_urgence:
            qs = qs.filter(niveau_urgence=niveau_urgence)

        tache_id = self.request.query_params.get('tache')
        if tache_id:
            qs = qs.filter(tache_id=tache_id)

        # Même prédicat que le compteur `en_attente_escalade` de `/stats/` et
        # que le job `escalader_blocages`.
        #
        # CHOIX ASSUMÉ : `timezone.now()` est évalué à chaque requête, donc
        # le filtre de liste et le KPI ne forment pas un snapshot atomique.
        # Un délai d'escalade franchi entre les deux appels peut produire un
        # compteur supérieur d'une unité à la liste affichée.
        if self.request.query_params.get('en_attente_escalade') == 'true':
            qs = qs.filter(
                statut__in=[
                    StatutBlocage.EN_ATTENTE,
                    StatutBlocage.EN_TRAITEMENT,
                ],
                date_limite_action__lt=timezone.now(),
            )

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/blocages/stats/

        KPI sur l'intégralité du périmètre. Lecture seule : ne modifie aucun
        statut de blocage et ne déclenche ni escalade ni contestation.
        `en_attente_escalade` = délai d'escalade dépassé sans être encore
        escaladé, en cohérence avec le job `escalader_blocages`.

        CHOIX ASSUMÉ : `timezone.now()` est réévalué ici, indépendamment de
        l'appel de liste. Voir le commentaire du filtre correspondant dans
        `filter_queryset`.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'par_statut': _compter_par(qs, 'statut'),
            'non_resolus': qs.exclude(statut=StatutBlocage.RESOLU).count(),
            'critiques': qs.filter(
                niveau_urgence='CRITIQUE',
            ).exclude(statut=StatutBlocage.RESOLU).count(),
            'en_attente_escalade': qs.filter(
                statut__in=[
                    StatutBlocage.EN_ATTENTE,
                    StatutBlocage.EN_TRAITEMENT,
                ],
                date_limite_action__lt=timezone.now(),
            ).count(),
            'contestes': qs.filter(statut=StatutBlocage.CONTESTE).count(),
        })

    def perform_create(self, serializer):
        """
        Crée un blocage et fait passer la tâche associée en BLOQUEE.

        Le champ `signale_par` est forcé à l'utilisateur connecté.
        """
        blocage = serializer.save(signale_par=self.request.user)

        # Passer la tâche en BLOQUEE
        tache = blocage.tache
        if tache.statut != StatutTache.BLOQUEE:
            tache.statut = StatutTache.BLOQUEE
            tache.save(update_fields=['statut'])

        enregistrer_action(
            auteur=self.request.user,
            action='BLOCAGE_SIGNE',
            details=f"Blocage signalé sur la tâche « {tache.titre} ».",
            blocage=blocage,
        )

        # Notifications : personne sollicitée, chef du signaleur, Directeur
        destinataires = set()

        # La personne explicitement sollicitée
        if blocage.personne_sollicitee:
            destinataires.add(blocage.personne_sollicitee)

        # Le supérieur proche du signaleur (le Chef de service en général)
        if self.request.user.superieur_proche:
            destinataires.add(self.request.user.superieur_proche)

        # Le Directeur si urgence critique ou haute
        if blocage.niveau_urgence in ('CRITIQUE', 'HAUTE'):
            for admin in Utilisateur.objects.avec_role(RoleChoice.DIRECTEUR):
                destinataires.add(admin)

        for dest in destinataires:
            if dest != self.request.user:
                envoyer_notification(
                    destinataire=dest,
                    type_notification='BLOCAGE_SIGNE',
                    message=(
                        f"Nouveau blocage sur « {tache.titre} » "
                        f"(urgence : {blocage.get_niveau_urgence_display()})."
                    ),
                )

    # -----------------------------------------------------------------------
    # ACTIONS PERSONNALISÉES
    # -----------------------------------------------------------------------

    @action(
        detail=True,
        methods=['post'],
        url_path='resoudre',
        permission_classes=[IsAuthenticated],
    )
    def resoudre(self, request, pk=None):
        """
        Résout un blocage.

        Endpoint : POST /api/v1/blocages/{id}/resoudre/

        Règles :
            - Autorisé : personne sollicitée, chef du service, Directeur.
            - Enregistre `resolu_par` et `date_resolution`.
            - Repasse la tâche en EN_COURS si elle était BLOQUEE.
        """
        from django.utils import timezone

        blocage = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or blocage.signale_par_id == user.id
            or blocage.personne_sollicitee_id == user.id
            or (
                est_chef_de_service(user)
                and blocage.tache.responsable
                and blocage.tache.responsable.service == service_actuel(user)
            )
        )
        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à résoudre ce blocage."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if blocage.statut == 'RESOLU':
            return Response(
                {'detail': "Ce blocage est déjà résolu."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Résolution
        blocage.statut = 'RESOLU'
        blocage.resolu_par = user
        blocage.date_resolution = timezone.now()
        blocage.save(update_fields=['statut', 'resolu_par', 'date_resolution'])

        # Repasser la tâche en EN_COURS
        tache = blocage.tache
        if tache.statut == StatutTache.BLOQUEE:
            tache.statut = StatutTache.EN_COURS
            tache.save(update_fields=['statut'])

        enregistrer_action(
            auteur=user,
            action='BLOCAGE_RESOLU',
            details=f"Blocage sur « {tache.titre} » résolu.",
            blocage=blocage,
        )

        # Notifier le signaleur
        if blocage.signale_par != user:
            envoyer_notification(
                destinataire=blocage.signale_par,
                type_notification='BLOCAGE_RESOLU',
                message=f"Le blocage sur « {tache.titre} » a été résolu.",
            )

        return Response(BlocageSerializer(blocage).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        url_path='remonter',
        permission_classes=[IsAuthenticated],
    )
    def remonter(self, request, pk=None):
        """
        Remonte un blocage au Directeur.

        Endpoint : POST /api/v1/blocages/{id}/remonter/

        Règles :
            - Autorisé : personne sollicitée, chef du service, Directeur.
            - Passe le statut à REMONTE_AU_DIRECTEUR.
        """
        blocage = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or blocage.signale_par_id == user.id
            or blocage.personne_sollicitee_id == user.id
            or (
                est_chef_de_service(user)
                and blocage.tache.responsable
                and blocage.tache.responsable.service == service_actuel(user)
            )
        )
        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à remonter ce blocage."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if blocage.statut == 'REMONTE_AU_DIRECTEUR':
            return Response(
                {'detail': "Ce blocage est déjà remonté au Directeur."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if blocage.statut == 'RESOLU':
            return Response(
                {'detail': "Impossible de remonter un blocage déjà résolu."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        blocage.statut = 'REMONTE_AU_DIRECTEUR'
        blocage.save(update_fields=['statut'])

        enregistrer_action(
            auteur=user,
            action='BLOCAGE_REMONTE',
            details=f"Blocage sur « {blocage.tache.titre} » remonté au Directeur.",
            blocage=blocage,
        )

        # Notifier le Directeur
        from .models import Utilisateur
        for admin in Utilisateur.objects.avec_role(RoleChoice.DIRECTEUR):
            envoyer_notification(
                destinataire=admin,
                type_notification='BLOCAGE_REMONTE',
                message=(
                    f"Blocage remonté sur « {blocage.tache.titre} ». "
                    f"Action requise."
                ),
            )

        return Response(BlocageSerializer(blocage).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        url_path='contester',
        permission_classes=[IsAuthenticated],
    )
    def contester(self, request, pk=None):
        """
        Conteste un blocage.

        Endpoint : POST /api/v1/blocages/{id}/contester/

        Body : { "motif": "..." }

        Règles :
            - Autorisé : signaleur uniquement.
            - Statuts acceptés : EN_ATTENTE, EN_TRAITEMENT, REMONTE_AU_DIRECTEUR.
            - Fenêtre : 48h après le signalement.
            - Motif obligatoire (≥ 10 caractères).
            - Ne touche pas au statut de la tâche.
        """
        from datetime import timedelta

        blocage = self.get_object()
        user = request.user

        if blocage.signale_par_id != user.id:
            return Response(
                {'detail': "Seul le signaleur peut contester ce blocage."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if blocage.statut not in (
            StatutBlocage.EN_ATTENTE,
            StatutBlocage.EN_TRAITEMENT,
            StatutBlocage.REMONTE_AU_DIRECTEUR,
        ):
            return Response(
                {'detail': "Ce blocage ne peut plus être contesté dans son état actuel."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not blocage.date_signalement:
            return Response(
                {'detail': "Date de signalement manquante."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fenetre = blocage.date_signalement + timedelta(hours=48)
        if fenetre < timezone.now():
            return Response(
                {'detail': "La fenêtre de contestation (48h) est fermée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = (request.data.get('motif') or '').strip()
        if len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire "
                           "pour contester un blocage."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        blocage.statut = StatutBlocage.CONTESTE
        blocage.motif_contestation = motif
        blocage.date_contestation = timezone.now()
        blocage.save(update_fields=['statut', 'motif_contestation', 'date_contestation'])

        enregistrer_action(
            auteur=user,
            action='BLOCAGE_CONTESTE',
            details=f"Blocage sur « {blocage.tache.titre} » contesté. Motif : {motif}",
            blocage=blocage,
        )

        for directeur in Utilisateur.objects.avec_role(RoleChoice.DIRECTEUR):
            if directeur != user:
                envoyer_notification(
                    destinataire=directeur,
                    type_notification='BLOCAGE_CONTESTE',
                    message=(
                        f"Le blocage sur « {blocage.tache.titre} » a été contesté. "
                        f"Motif : {motif}"
                    ),
                )

        return Response(BlocageSerializer(blocage).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        url_path='resoudre_contestation',
        permission_classes=[IsAuthenticated],
    )
    def resoudre_contestation(self, request, pk=None):
        """
        Résout la contestation d'un blocage.

        Endpoint : POST /api/v1/blocages/{id}/resoudre_contestation/

        Règles :
            - Autorisé : Directeur uniquement.
            - Condition : blocage en CONTESTE.
            - Ne touche pas au statut de la tâche.
        """
        blocage = self.get_object()
        user = request.user

        if not est_directeur(user):
            return Response(
                {'detail': "Seul le Directeur peut résoudre une contestation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if blocage.statut != StatutBlocage.CONTESTE:
            return Response(
                {'detail': "Ce blocage n'est pas en contestation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        blocage.statut = StatutBlocage.RESOLU
        blocage.date_resolution = timezone.now()
        blocage.resolu_par = user
        blocage.save(update_fields=['statut', 'date_resolution', 'resolu_par'])

        enregistrer_action(
            auteur=user,
            action='CONTESTATION_RESOLUE',
            details=f"Contestation du blocage sur « {blocage.tache.titre} » résolue.",
            blocage=blocage,
        )

        if blocage.signale_par != user:
            envoyer_notification(
                destinataire=blocage.signale_par,
                type_notification='CONTESTATION_RESOLUE',
                message=(
                    f"Votre contestation sur « {blocage.tache.titre} » a été résolue."
                ),
            )

        return Response(BlocageSerializer(blocage).data, status=status.HTTP_200_OK)

    def perform_destroy(self, instance):
        """Enregistre l'action AVANT de supprimer."""
        enregistrer_action(
            auteur=self.request.user,
            action='BLOCAGE_SUPPRIME',
            details=f"Blocage sur « {instance.tache.titre} » supprimé.",
            blocage=instance,
        )
        instance.delete()

# ===========================================================================
# ÉVÉNEMENT
# ===========================================================================

class EvenementViewSet(viewsets.ModelViewSet):
    """
    ViewSet des événements d'agenda.

    Filtrage queryset :
        - Directeur : tous les événements.
        - Secrétaire : tous les événements (pour gérer l'agenda).
        - Autres rôles : les événements qu'ils ont créés ou auxquels ils
          participent.
    """

    serializer_class = EvenementSerializer
    permission_classes = [IsAuthenticated, EvenementPermission]
    queryset = Evenement.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement (le RBAC joint sur participants + .distinct()).
    # Voir l'en-tête du module.
    # `niveau_priorite` reste trié côté client : ordre métier.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`niveau_priorite`) : ordre métier
    # arbitraire, pas d'ordre alphabétique.
    ordering_fields = ['titre', 'date_debut', 'date_fin']
    search_fields = ['titre', 'description']

    def get_queryset(self):
        """
        Filtre les événements selon :
            - le rôle de l'utilisateur connecté (RBAC),
            - les query params optionnels (`debut`, `fin`, `niveau_priorite`,
              `type`).
        """
        user = self.request.user

        qs = Evenement.objects.all().select_related(
            'createur',
        ).prefetch_related('participants').order_by('date_debut')

        # --- Filtrage RBAC ---
        if est_directeur(user) or est_secretaire(user):
            pass
        else:
            qs = qs.filter(
                Q(createur=user) | Q(participants=user)
            ).distinct()

        # --- Filtres utilisateur ---
        debut = self.request.query_params.get('debut')
        if debut:
            qs = qs.filter(date_debut__gte=debut)

        fin = self.request.query_params.get('fin')
        if fin:
            qs = qs.filter(date_debut__lte=fin)

        niveau_priorite = self.request.query_params.get('niveau_priorite')
        if niveau_priorite:
            qs = qs.filter(niveau_priorite=niveau_priorite)

        type_evenement = self.request.query_params.get('type')
        if type_evenement:
            qs = qs.filter(type=type_evenement)

        return qs

    def perform_create(self, serializer):
        """
        Force le créateur à l'utilisateur connecté.
        Valide les participants selon le rôle.
        """
        user = self.request.user
        participants_ids = self.request.data.get('participants', [])

        # --- Validation selon le rôle ---
        if est_directeur(user) or est_secretaire(user):
            # Directeur / Secrétaire : aucun filtre, tout est permis
            pass
        elif est_chef_de_service(user):
            # Chef : participants doivent être de son service ou lui-même
            from .models import Utilisateur
            for pid in participants_ids:
                try:
                    p = Utilisateur.objects.get(id=pid)
                    if p.id != user.id and p.service != service_actuel(user):
                        from rest_framework.exceptions import ValidationError
                        raise ValidationError({
                            'participants': (
                                f"En tant que Chef, vous ne pouvez inviter "
                                f"que les membres de votre service."
                            )
                        })
                except Utilisateur.DoesNotExist:
                    pass
        else:
            # Membre : peut créer un événement uniquement pour lui-même
            if len(participants_ids) > 0:
                # On force participants = [soi] et on retire les autres
                # (mode "événement personnel")
                from rest_framework.exceptions import ValidationError
                # Si l'utilisateur a mis d'autres participants que lui-même
                autres = [pid for pid in participants_ids if pid != user.id]
                if autres:
                    raise ValidationError({
                        'participants': (
                            "En tant que membre, vous ne pouvez créer que "
                            "des événements personnels (sans autre participant)."
                        )
                    })

        evenement = serializer.save(createur=self.request.user)
        # Ajoute le créateur comme participant s'il n'y est pas déjà
        if not evenement.participants.filter(id=user.id).exists():
            evenement.participants.add(user)

        enregistrer_action(
            auteur=self.request.user,
            action='EVENEMENT_CREE',
            details=f"Événement « {evenement.titre} » créé.",
        )

        # Notifier les participants
        for participant in evenement.participants.all():
            if participant != self.request.user:
                envoyer_notification(
                    destinataire=participant,
                    type_notification='RAPPEL_EVENEMENT',
                    message=(
                        f"Vous êtes convié à « {evenement.titre} » "
                        f"le {evenement.date_debut:%d/%m/%Y à %H:%M}."
                    ),
                )

        # Si l'événement est de niveau DIRECTION, notifier les participants
        # qui auraient un conflit (règle métier du document)
        if evenement.niveau_priorite == 'DIRECTION':
            for participant in evenement.participants.all():
                if participant == self.request.user:
                    continue
                conflits = Evenement.objects.filter(
                    participants=participant,
                    date_debut__lt=evenement.date_fin,
                    date_fin__gt=evenement.date_debut,
                ).exclude(id=evenement.id)
                if conflits.exists():
                    envoyer_notification(
                        destinataire=participant,
                        type_notification='EVENEMENT_DIRECTION_PRIORITAIRE',
                        message=(
                            f"Conflit d'agenda : l'événement Direction "
                            f"« {evenement.titre} » prime sur vos autres "
                            f"engagements au même créneau."
                        ),
                    )

    def perform_update(self, serializer):
        evenement = serializer.save()
        enregistrer_action(
            auteur=self.request.user,
            action='EVENEMENT_MODIFIE',
            details=f"Événement « {evenement.titre} » modifié.",
        )

    @action(
        detail=True,
        methods=['post'],
        url_path='annuler',
        permission_classes=[IsAuthenticated],
    )
    def annuler(self, request, pk=None):
        """
        Annule un événement avec un motif obligatoire.

        Endpoint : POST /api/v1/evenements/{id}/annuler/
        Body : { "motif": "..." }
        """
        evenement = self.get_object()
        user = request.user

        if not (
            est_directeur(user)
            or est_secretaire(user)
            or evenement.createur_id == user.id
        ):
            return Response(
                {'detail': "Vous n'êtes pas autorisé à annuler cet événement."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if evenement.statut == 'ANNULE':
            return Response(
                {'detail': "Cet événement est déjà annulé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = (request.data.get('motif') or '').strip()
        if len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        evenement.statut = 'ANNULE'
        evenement.save(update_fields=['statut'])

        enregistrer_action(
            auteur=user,
            action='ANNULATION_MOTIVEE',
            details=f"Événement « {evenement.titre} » annulé. Motif : {motif}",
        )

        return Response(EvenementSerializer(evenement).data, status=status.HTTP_200_OK)
# ===========================================================================
# DÉLÉGATION
# ===========================================================================

class DelegationViewSet(viewsets.ModelViewSet):
    """
    ViewSet des délégations temporaires de rôle.

    Filtrage queryset :
        - Directeur : toutes les délégations.
        - Autres : celles qu'ils ont données ou reçues.
    """

    serializer_class = DelegationSerializer
    permission_classes = [IsAuthenticated, DelegationPermission]
    queryset = Delegation.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement (le RBAC joint sur delegant/delegataire).
    # Voir l'en-tête du module.
    # `delegant`, `delegataire` et le statut dérivé (`statutDe()` côté
    # client) restent triés côté client. `role_delegue` est un ordre métier.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`role_delegue`) : ordre métier
    # arbitraire. `delegant`/`delegataire` : colonnes jointes incompatibles
    # avec le .distinct() du RBAC (voir l'en-tête du module).
    ordering_fields = ['date_creation', 'date_debut', 'date_fin']

    def get_queryset(self):
        """
        Filtre les délégations selon :
            - le rôle de l'utilisateur connecté (RBAC),
            - les query params optionnels (`actif`, `role_delegue`).
        """
        user = self.request.user

        qs = Delegation.objects.all().select_related(
            'delegant', 'delegataire',
        ).order_by('-date_creation')

        # --- Filtrage RBAC ---
        if est_directeur(user):
            pass  # toutes les délégations
        else:
            qs = qs.filter(
                Q(delegant=user) | Q(delegataire=user)
            ).distinct()

        # --- Filtres utilisateur ---
        actif = self.request.query_params.get('actif')
        if actif == 'true':
            qs = qs.filter(actif=True)
        elif actif == 'false':
            qs = qs.filter(actif=False)

        role_delegue = self.request.query_params.get('role_delegue')
        if role_delegue:
            qs = qs.filter(role_delegue=role_delegue)

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/delegations/stats/

        KPI sur l'intégralité du périmètre. Lecture seule.
        `actives` reflète `Delegation.est_active` (drapeau actif + période
        courante) ; `planifiees` = actives mais pas encore commencées.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))
        maintenant = timezone.now()

        return Response({
            'total': qs.count(),
            'actives': qs.filter(
                actif=True,
                date_debut__lte=maintenant,
                date_fin__gte=maintenant,
            ).count(),
            'planifiees': qs.filter(
                actif=True, date_debut__gt=maintenant,
            ).count(),
            'par_role_delegue': _compter_par(qs, 'role_delegue'),
        })

    def perform_create(self, serializer):
        """
        Crée une délégation.

        Vérifie que le délégataire n'est pas le délégant lui-même
        (règle métier qui ne peut pas être validée dans le serializer,
        car `delegant` est en read_only et n'est connu qu'ici).
        """
        delegataire = serializer.validated_data.get('delegataire')

        if delegataire and delegataire.id == self.request.user.id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'delegataire': "Un utilisateur ne peut pas se déléguer à lui-même."
            })

        delegation = serializer.save(delegant=self.request.user)

        enregistrer_action(
            auteur=self.request.user,
            action='DELEGATION_CREEE',
            details=(
                f"Délégation du rôle {delegation.get_role_delegue_display()} "
                f"à {delegation.delegataire} du "
                f"{delegation.date_debut:%d/%m/%Y} au {delegation.date_fin:%d/%m/%Y}."
            ),
        )

        envoyer_notification(
            destinataire=delegation.delegataire,
            type_notification='DELEGATION_ACTIVEE',
            message=(
                f"Vous avez reçu une délégation du rôle "
                f"{delegation.get_role_delegue_display()} "
                f"du {delegation.date_debut:%d/%m/%Y} au {delegation.date_fin:%d/%m/%Y}."
            ),
        )

    @action(
        detail=True,
        methods=['post'],
        url_path='revoquer',
        permission_classes=[IsAuthenticated],
    )
    def revoquer(self, request, pk=None):
        """
        Révoque une délégation active.

        Endpoint : POST /api/v1/delegations/{id}/revoquer/

        Autorisé : délégant ou Directeur.
        """
        delegation = self.get_object()
        user = request.user

        if not (est_directeur(user) or delegation.delegant_id == user.id):
            return Response(
                {'detail': "Seul le délégant ou le Directeur peut révoquer cette délégation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not delegation.actif:
            return Response(
                {'detail': "Cette délégation est déjà inactive."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        delegation.actif = False
        delegation.save(update_fields=['actif'])

        enregistrer_action(
            auteur=user,
            action='DELEGATION_REVOQUEE',
            details=f"Délégation à {delegation.delegataire} révoquée.",
        )

        envoyer_notification(
            destinataire=delegation.delegataire,
            type_notification='DELEGATION_REVOQUEE',
            message=f"Votre délégation du rôle {delegation.get_role_delegue_display()} a été révoquée.",
        )

        return Response(DelegationSerializer(delegation).data, status=status.HTTP_200_OK)


# ===========================================================================
# COMMENTAIRE
# ===========================================================================

class CommentaireViewSet(viewsets.ModelViewSet):
    """
    ViewSet des commentaires.

    Filtrage queryset :
        - Directeur : tous les commentaires.
        - Autres : ceux qu'ils ont rédigés + ceux attachés aux entités
          auxquelles ils ont accès (simplifié : par cible explicite).
    """

    serializer_class = CommentaireSerializer
    permission_classes = [IsAuthenticated, CommentairePermission]
    queryset = Commentaire.objects.all()

    def get_queryset(self):
        """
        Filtre les commentaires selon :
            - le rôle de l'utilisateur connecté (RBAC),
            - les query params optionnels (`tache`, `instruction`, `activite`).
        """
        user = self.request.user

        qs = Commentaire.objects.all().select_related(
            'auteur', 'tache', 'instruction', 'activite',
        ).order_by('-date_creation')

        # --- Filtrage RBAC ---
        if est_directeur(user):
            pass
        elif est_chef_de_service(user):
            qs = qs.filter(
                Q(auteur=user)
                | Q(tache__responsable__service=service_actuel(user))
                | Q(activite__responsable__service=service_actuel(user))
            ).distinct()
        else:
            qs = qs.filter(
                Q(auteur=user)
                | Q(tache__responsable=user)
                | Q(tache__createur=user)
                | Q(activite__responsable=user)
                | Q(instruction__emetteur=user)
                | Q(instruction__destinataires__destinataire=user)
            ).distinct()

        # --- Filtres utilisateur ---
        tache_id = self.request.query_params.get('tache')
        if tache_id:
            qs = qs.filter(tache_id=tache_id)

        instruction_id = self.request.query_params.get('instruction')
        if instruction_id:
            qs = qs.filter(instruction_id=instruction_id)

        activite_id = self.request.query_params.get('activite')
        if activite_id:
            qs = qs.filter(activite_id=activite_id)

        return qs
    def perform_create(self, serializer):
        commentaire = serializer.save(auteur=self.request.user)

        # Déterminer la cible pour l'historique
        if commentaire.tache:
            details = f"Commentaire ajouté sur la tâche « {commentaire.tache.titre} »."
        elif commentaire.instruction:
            details = f"Commentaire ajouté sur l'instruction « {commentaire.instruction.titre} »."
        elif commentaire.activite:
            details = f"Commentaire ajouté sur l'activité « {commentaire.activite.titre} »."
        else:
            details = "Commentaire ajouté."

        enregistrer_action(
            auteur=self.request.user,
            action='COMMENTAIRE_AJOUTE',
            details=details,
            tache=commentaire.tache,
            instruction=commentaire.instruction,
            activite=commentaire.activite,
        )

    def perform_update(self, serializer):
        commentaire = serializer.save()
        enregistrer_action(
            auteur=self.request.user,
            action='COMMENTAIRE_MODIFIE',
            details="Commentaire modifié.",
            tache=commentaire.tache,
            instruction=commentaire.instruction,
            activite=commentaire.activite,
        )

# ===========================================================================
# COMPTE-RENDU QUOTIDIEN
# ===========================================================================

class CompteRenduQuotidienViewSet(viewsets.ModelViewSet):
    """
    ViewSet des comptes-rendus quotidiens.

    Filtrage queryset :
        - Directeur : tous les CRQ.
        - Chef de service : CRQ de son service.
        - Autres : leurs propres CRQ.

    Actions :
        - POST /comptes-rendus/{id}/demande-reouverture/
    """

    serializer_class = CompteRenduQuotidienSerializer
    permission_classes = [IsAuthenticated, CRQPermission]
    queryset = CompteRenduQuotidien.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement. Voir l'en-tête du module.
    # La recherche porte sur 3 des 5 champs texte du CRQ : ce sont ceux
    # utilisés par la page liste. Les 2 autres (activites_non_realisees,
    # prevues_lendemain) sont volontairement exclus pour ne pas alourdir
    # les requêtes `icontains` sur des TextField longs.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`type`) : ordre métier du
    # workflow de validation, pas un ordre alphabétique.
    ordering_fields = ['date_journaliere', 'est_cloture']
    search_fields = [
        'activites_realisees', 'activites_en_cours', 'difficultes',
        'redacteur__last_name', 'redacteur__first_name',
    ]

    def get_queryset(self):
        """
        Filtre les CRQ selon :
            - le rôle de l'utilisateur connecté (RBAC),
            - les query params optionnels (`est_cloture`, `date`, `redacteur`).
        """
        user = self.request.user

        qs = CompteRenduQuotidien.objects.all().select_related(
            'redacteur',
        ).prefetch_related('demandes_reouverture').order_by('-date_journaliere')

        # --- Filtrage RBAC ---
        if est_directeur(user):
            pass
        elif est_chef_de_service(user):
            qs = qs.filter(redacteur__service=service_actuel(user))
        elif est_secretaire(user) or est_conseillere(user):
            pass
        else:
            qs = qs.filter(redacteur=user)

        # --- Filtres utilisateur ---
        est_cloture = self.request.query_params.get('est_cloture')
        if est_cloture == 'true':
            qs = qs.filter(est_cloture=True)
        elif est_cloture == 'false':
            qs = qs.filter(est_cloture=False)

        date = self.request.query_params.get('date')
        if date:
            qs = qs.filter(date_journaliere=date)

        redacteur = self.request.query_params.get('redacteur')
        if redacteur:
            qs = qs.filter(redacteur_id=redacteur)

        # --- Période sur la date journalière (date_debut / date_fin) ---
        # `date_journaliere` est un DateField : `date_fin` est une borne
        # inclusive simple, sans traitement minuit.
        qs = filtrer_periode(
            qs,
            'date_journaliere',
            self.request.query_params.get('date_debut'),
            self.request.query_params.get('date_fin'),
        )

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/comptes-rendus/stats/

        KPI sur l'intégralité du périmètre. Lecture seule.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'en_cours': qs.filter(est_cloture=False).count(),
            'clotures': qs.filter(est_cloture=True).count(),
            'demandes_reouverture': qs.filter(
                demandes_reouverture__statut='EN_ATTENTE',
            ).distinct().count(),
        })

    def perform_create(self, serializer):
        # Vérifier qu'un CRQ n'existe pas déjà pour cette date
        date_journaliere = serializer.validated_data.get('date_journaliere')
        deja_existant = CompteRenduQuotidien.objects.filter(
            redacteur=self.request.user,
            date_journaliere=date_journaliere,
        ).exists()

        if deja_existant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'date_journaliere': (
                    "Vous avez déjà un compte-rendu pour cette date. "
                    "Modifiez-le au lieu d'en créer un nouveau."
                ),
            })

        crq = serializer.save(redacteur=self.request.user)

        enregistrer_action(
            auteur=self.request.user,
            action='CRQ_CREE',
            details=f"CRQ du {crq.date_journaliere:%d/%m/%Y} créé.",
        )
    def perform_update(self, serializer):
        crq = serializer.save()

        enregistrer_action(
            auteur=self.request.user,
            action='CRQ_MODIFIE',
            details=f"CRQ du {crq.date_journaliere:%d/%m/%Y} modifié.",
        )

    @action(
        detail=True,
        methods=['post'],
        url_path='demande-reouverture',
        permission_classes=[IsAuthenticated],
    )
    def demande_reouverture(self, request, pk=None):
        """
        Demande la réouverture d'un CRQ clôturé.

        Endpoint : POST /api/v1/comptes-rendus/{id}/demande-reouverture/

        Body : { "motif": "..." }

        Le demandeur est forcé au rédacteur du CRQ.
        """
        crq = self.get_object()
        user = request.user

        if crq.redacteur_id != user.id:
            return Response(
                {'detail': "Seul le rédacteur du CRQ peut demander sa réouverture."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not crq.est_cloture:
            return Response(
                {'detail': "Ce CRQ n'est pas encore clôturé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = request.data.get('motif')
        if not motif or len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        demande = DemandeReouvertureCRQ.objects.create(
            crq=crq,
            demandeur=user,
            motif=motif,
            statut='EN_ATTENTE',
        )

        enregistrer_action(
            auteur=user,
            action='CRQ_REOUVERTURE_DEMANDEE',
            details=f"Demande de réouverture du CRQ du {crq.date_journaliere:%d/%m/%Y}.",
        )

        # Notifier le supérieur proche
        if user.superieur_proche:
            envoyer_notification(
                destinataire=user.superieur_proche,
                type_notification='CRQ_REOUVERTURE_DEMANDEE',
                message=f"Demande de réouverture de CRQ de {user.get_nom_complet()}.",
            )

        return Response(
            DemandeReouvertureCRQSerializer(demande).data,
            status=status.HTTP_201_CREATED,
        )


# ===========================================================================
# DEMANDE DE RÉOUVERTURE DE CRQ
# ===========================================================================

class DemandeReouvertureCRQViewSet(viewsets.ModelViewSet):
    """
    ViewSet des demandes de réouverture de CRQ.

    Filtrage : Directeur voit tout, Chef voit celles de son service,
    utilisateur voit les siennes.

    Actions :
        - POST /demandes-reouverture/{id}/valider/
        - POST /demandes-reouverture/{id}/refuser/
    """

    serializer_class = DemandeReouvertureCRQSerializer
    permission_classes = [IsAuthenticated]
    queryset = DemandeReouvertureCRQ.objects.all()

    def get_queryset(self):
        """Filtre les demandes selon le rôle et les query params."""
        user = self.request.user

        qs = DemandeReouvertureCRQ.objects.all().select_related(
            'crq', 'demandeur', 'validee_par',
        ).order_by('-date_demande')

        # --- Filtrage RBAC ---
        if est_directeur(user):
            pass
        elif est_chef_de_service(user):
            qs = qs.filter(demandeur__service=service_actuel(user))
        else:
            qs = qs.filter(demandeur=user)

        # --- Filtres utilisateur ---
        statut = self.request.query_params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)

        crq = self.request.query_params.get('crq')
        if crq:
            qs = qs.filter(crq_id=crq)

        return qs

    @action(
        detail=True,
        methods=['post'],
        url_path='valider',
        permission_classes=[IsAuthenticated],
    )
    def valider(self, request, pk=None):
        """Valide la demande et débloque le CRQ associé."""
        from django.utils import timezone

        demande = self.get_object()
        user = request.user

        # Autorisation : supérieur proche du demandeur, ou Directeur
        autorise = (
            est_directeur(user)
            or demande.demandeur.superieur_proche_id == user.id
        )
        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à valider cette demande."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if demande.statut != 'EN_ATTENTE':
            return Response(
                {'detail': "Cette demande a déjà été traitée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        demande.statut = 'VALIDEE'
        demande.validee_par = user
        demande.date_validation = timezone.now()
        demande.save(update_fields=['statut', 'validee_par', 'date_validation'])

        # Débloquer le CRQ
        crq = demande.crq
        crq.est_cloture = False
        crq.save(update_fields=['est_cloture'])

        enregistrer_action(
            auteur=user,
            action='CRQ_REOUVERTURE_VALIDEE',
            details=f"Réouverture du CRQ du {crq.date_journaliere:%d/%m/%Y} validée.",
        )

        envoyer_notification(
            destinataire=demande.demandeur,
            type_notification='CRQ_REOUVERTURE_VALIDEE',
            message=f"Votre demande de réouverture du CRQ du {crq.date_journaliere:%d/%m/%Y} a été validée.",
        )

        return Response(
            DemandeReouvertureCRQSerializer(demande).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=['post'],
        url_path='refuser',
        permission_classes=[IsAuthenticated],
    )
    def refuser(self, request, pk=None):
        """Refuse la demande."""
        from django.utils import timezone

        demande = self.get_object()
        user = request.user

        autorise = (
            est_directeur(user)
            or demande.demandeur.superieur_proche_id == user.id
        )
        if not autorise:
            return Response(
                {'detail': "Vous n'êtes pas autorisé à refuser cette demande."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if demande.statut != 'EN_ATTENTE':
            return Response(
                {'detail': "Cette demande a déjà été traitée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        demande.statut = 'REFUSEE'
        demande.validee_par = user
        demande.date_validation = timezone.now()
        demande.save(update_fields=['statut', 'validee_par', 'date_validation'])

        enregistrer_action(
            auteur=user,
            action='CRQ_REOUVERTURE_REFUSEE',
            details=f"Réouverture du CRQ du {demande.crq.date_journaliere:%d/%m/%Y} refusée.",
        )

        envoyer_notification(
            destinataire=demande.demandeur,
            type_notification='CRQ_REOUVERTURE_REFUSEE',
            message=f"Votre demande de réouverture du CRQ du {demande.crq.date_journaliere:%d/%m/%Y} a été refusée.",
        )

        return Response(
            DemandeReouvertureCRQSerializer(demande).data,
            status=status.HTTP_200_OK,
        )


# ===========================================================================
# NOTIFICATION (lecture seule + action marquer lue)
# ===========================================================================

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet en lecture seule pour les notifications.

    Les notifications sont créées par les services métier, jamais via l'API.
    L'utilisateur ne peut que lister ses propres notifications et les marquer
    comme lues.
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    queryset = Notification.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement. Voir l'en-tête du module.
    # Aucune jointure : le queryset est déjà restreint au destinataire.
    # `type` reste trié côté client : ordre métier (workflow de validation).
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`type`) : ordre métier du
    # workflow de validation, pas un ordre alphabétique.
    ordering_fields = ['date_creation']
    search_fields = ['message']

    def get_queryset(self):
        """
        Retourne les notifications du destinataire connecté.
        Filtre optionnel : `?lue=true|false`.
        """
        qs = Notification.objects.filter(
            destinataire=self.request.user,
        ).order_by('-date_creation')

        lue = self.request.query_params.get('lue')
        if lue == 'true':
            qs = qs.filter(lue=True)
        elif lue == 'false':
            qs = qs.filter(lue=False)

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/notifications/stats/

        KPI sur l'intégralité des notifications de l'utilisateur.
        Le queryset étant déjà restreint au destinataire, aucun contrôle
        de rôle supplémentaire n'est nécessaire. Lecture seule.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'non_lues': qs.filter(lue=False).count(),
            'par_type': _compter_par(qs, 'type'),
        })

    @action(
        detail=True,
        methods=['patch'],
        url_path='lire',
        permission_classes=[IsAuthenticated],
    )
    def lire(self, request, pk=None):
        """Marque la notification comme lue."""
        notification = self.get_object()

        if notification.destinataire_id != request.user.id:
            return Response(
                {'detail': "Vous n'êtes pas le destinataire de cette notification."},
                status=status.HTTP_403_FORBIDDEN,
            )

        notification.marquer_comme_lue()

        return Response(
            NotificationSerializer(notification).data,
            status=status.HTTP_200_OK,
        )


# ===========================================================================
# SYNTHÈSE
# ===========================================================================

class SyntheseViewSet(viewsets.ModelViewSet):
    """
    ViewSet des synthèses.

    La création manuelle est possible pour les cas exceptionnels.
    L'action `generer` sera implémentée plus tard (dépend d'un service
    d'agrégation qui n'est pas encore écrit).
    """

    serializer_class = SyntheseSerializer
    permission_classes = [IsAuthenticated, SynthesePermission]
    queryset = Synthese.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement. Voir l'en-tête du module.
    # `type` reste trié côté client : ordre métier.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`type`) : ordre métier, pas un
    # ordre alphabétique.
    ordering_fields = ['date_generation', 'periode_debut', 'periode_fin']
    search_fields = [
        'contenu', 'genere_par__last_name', 'genere_par__first_name',
    ]

    def get_queryset(self):
        """Filtre les synthèses selon le rôle et les query params."""
        user = self.request.user

        qs = Synthese.objects.all().select_related(
            'genere_par',
        ).order_by('-date_generation')

        # --- Filtrage RBAC ---
        if est_directeur(user) or est_secretaire(user) or est_conseillere(user):
            pass
        elif est_chef_de_service(user):
            pass  # voit toutes les synthèses (filtrées plus tard si besoin)
        else:
            return Synthese.objects.none()

        # --- Filtres utilisateur ---
        type_synthese = self.request.query_params.get('type')
        if type_synthese:
            qs = qs.filter(type=type_synthese)

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/syntheses/stats/

        KPI sur l'intégralité du périmètre. Lecture seule.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'par_type': _compter_par(qs, 'type'),
        })

    def perform_create(self, serializer):
        synthese = serializer.save(genere_par=self.request.user)

        enregistrer_action(
            auteur=self.request.user,
            action='SYNTHESE_GENEREE',
            details=f"Synthèse {synthese.get_type_display()} du {synthese.periode_debut:%d/%m/%Y} au {synthese.periode_fin:%d/%m/%Y}.",
        )

    @action(
        detail=False,
        methods=['post'],
        url_path='generer',
        permission_classes=[IsAuthenticated],
    )
    def generer(self, request):
        """
        Génère une synthèse à partir des données existantes.

        Endpoint : POST /api/v1/syntheses/generer/

        Body :
            {
                "type": "HEBDOMADAIRE",
                "periode_debut": "2026-09-14",
                "periode_fin": "2026-09-20"
            }

        La synthèse agrège :
            - les CRQ de la période,
            - les tâches créées/terminées,
            - les blocages signalés/résolus,
            - les instructions émises,
            - les événements de la période.

        Seul le Directeur ou la Secrétaire peuvent générer.
        """
        user = request.user

        if not (est_directeur(user) or est_secretaire(user)):
            return Response(
                {'detail': "Seul le Directeur ou la Secrétaire peut générer une synthèse."},
                status=status.HTTP_403_FORBIDDEN,
            )

        type_synthese = request.data.get('type')
        periode_debut = request.data.get('periode_debut')
        periode_fin = request.data.get('periode_fin')

        if not (type_synthese and periode_debut and periode_fin):
            return Response(
                {'detail': "type, periode_debut et periode_fin sont obligatoires."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if type_synthese not in dict(TypeSynthese.choices):
            return Response(
                {'detail': f"Type invalide. Valeurs : {list(dict(TypeSynthese.choices).keys())}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Agrégation des données ---
        from datetime import datetime

        debut = datetime.fromisoformat(periode_debut).date()
        fin = datetime.fromisoformat(periode_fin).date()

        # CRQ de la période
        crqs = CompteRenduQuotidien.objects.filter(
            date_journaliere__gte=debut,
            date_journaliere__lte=fin,
        ).select_related('redacteur')

        # Tâches créées dans la période
        taches = Tache.objects.filter(
            date_creation__date__gte=debut,
            date_creation__date__lte=fin,
        ).select_related('responsable')

        taches_terminees = taches.filter(statut='TERMINEE').count()
        taches_en_cours = taches.filter(statut='EN_COURS').count()

        # Tâches en retard actuelles
        from django.utils import timezone
        taches_en_retard = Tache.objects.filter(
            date_echeance__lt=timezone.now(),
            date_echeance__isnull=False,
        ).exclude(statut__in=['TERMINEE', 'ANNULEE']).count()

        # Blocages de la période
        blocages = Blocage.objects.filter(
            date_signalement__date__gte=debut,
            date_signalement__date__lte=fin,
        )
        blocages_total = blocages.count()
        blocages_resolus = blocages.filter(statut='RESOLU').count()
        blocages_en_cours = blocages.exclude(statut='RESOLU').count()

        # Instructions émises
        instructions = Instruction.objects.filter(
            date_creation__date__gte=debut,
            date_creation__date__lte=fin,
        ).select_related('emetteur')

        instructions_total = instructions.count()
        instructions_terminees = instructions.filter(statut='TERMINEE').count()

        # Événements de la période
        evenements = Evenement.objects.filter(
            date_debut__date__gte=debut,
            date_debut__date__lte=fin,
        ).count()

        # --- Construction du contenu ---
        contenu = f"""SYNTHÈSE {type_synthese} — DU {debut:%d/%m/%Y} AU {fin:%d/%m/%Y}

============================================================
COMPTES-RENDUS QUOTIDIENS
============================================================
Nombre de CRQ : {crqs.count()}
Rédacteurs concernés : {', '.join(sorted(set(crq.redacteur.get_nom_complet() for crq in crqs))) or '—'}

============================================================
TÂCHES
============================================================
Tâches créées sur la période : {taches.count()}
  - Terminées : {taches_terminees}
  - En cours : {taches_en_cours}
Tâches actuellement en retard : {taches_en_retard}

============================================================
BLOCAGES
============================================================
Blocages signalés : {blocages_total}
  - Résolus : {blocages_resolus}
  - En cours : {blocages_en_cours}

============================================================
INSTRUCTIONS
============================================================
Instructions émises : {instructions_total}
  - Terminées : {instructions_terminees}

============================================================
AGENDA
============================================================
Événements sur la période : {evenements}

============================================================
Synthèse générée le {timezone.now():%d/%m/%Y à %H:%M} par {user.get_nom_complet()}.
"""

        synthese = Synthese.objects.create(
            type=type_synthese,
            periode_debut=debut,
            periode_fin=fin,
            contenu=contenu,
            genere_par=user,
        )

        enregistrer_action(
            auteur=user,
            action='SYNTHESE_GENEREE',
            details=f"Synthèse {synthese.get_type_display()} du {debut:%d/%m/%Y} au {fin:%d/%m/%Y} générée.",
        )

        return Response(
            SyntheseSerializer(synthese).data,
            status=status.HTTP_201_CREATED,
        )


# ===========================================================================
# PIÈCE JOINTE
# ===========================================================================

class PieceJointeViewSet(viewsets.ModelViewSet):
    """
    ViewSet des pièces jointes.

    L'accès à une pièce jointe est régi par `PieceJointePermission` :
    l'utilisateur doit avoir accès à l'entité ciblée (tâche, instruction,
    activité, blocage ou événement), être l'auteur du dépôt, ou être
    Directeur.
    """

    serializer_class = PieceJointeSerializer
    permission_classes = [IsAuthenticated, PieceJointePermission]
    queryset = PieceJointe.objects.all()

    def get_queryset(self):
        user = self.request.user

        qs = PieceJointe.objects.all().select_related(
            'uploade_par', 'tache', 'instruction', 'activite',
            'evenement', 'blocage',
        ).order_by('-date_upload')

        if est_directeur(user):
            return qs

        # Le périmètre reprend les règles RBAC des entités ciblées (voir
        # PieceJointePermission). Sans ce correctif, seules les pièces
        # jointes rattachées à une tâche étaient visibles : celles des
        # instructions, activités, blocages et événements étaient
        # invisibles pour tout le monde, et le détail n'était filtré que
        # sur `tache__responsable` / `tache__createur`.
        conditions = Q(uploade_par=user)

        if est_chef_de_service(user):
            conditions |= (
                Q(tache__responsable__service=service_actuel(user))
                | Q(tache__createur=user)
                | Q(tache__activite__responsable=user)
                | Q(activite__responsable__service=service_actuel(user))
                | Q(activite__createur=user)
                | Q(instruction__emetteur=user)
                | Q(instruction__destinataires__destinataire__service=service_actuel(user))
                | Q(blocage__signale_par=user)
                | Q(blocage__tache__responsable__service=service_actuel(user))
                | Q(evenement__createur__service=service_actuel(user))
                | Q(evenement__participants=user)
            )
        else:
            conditions |= (
                Q(tache__responsable=user)
                | Q(tache__createur=user)
                | Q(activite__responsable=user)
                | Q(activite__createur=user)
                | Q(instruction__emetteur=user)
                | Q(instruction__saisie_par=user)
                | Q(instruction__destinataires__destinataire=user)
                | Q(blocage__signale_par=user)
                | Q(blocage__personne_sollicitee=user)
                | Q(blocage__tache__responsable=user)
                | Q(blocage__tache__createur=user)
                | Q(evenement__createur=user)
                | Q(evenement__participants=user)
            )

        return qs.filter(conditions).distinct()

    def perform_create(self, serializer):
        # Même contrôle que sur l'upload : sans lui, n'importe quel
        # utilisateur authentifié pouvait rattacher une pièce jointe à
        # une entité qui n'est pas la sienne.
        piece = PieceJointe(**{
            champ: serializer.validated_data.get(champ)
            for _, champ in CHAMPS_CIBLE
            if serializer.validated_data.get(champ)
        })

        if not PieceJointePermission().has_object_permission(
            self.request, self, piece,
        ):
            raise PermissionDenied(
                "Vous n'avez pas les droits sur cette entité."
            )

        pj = serializer.save(uploade_par=self.request.user)

        enregistrer_action(
            auteur=self.request.user,
            action='PIECE_JOINTE_AJOUTEE',
            details=f"Pièce jointe « {pj.nom_fichier} » ajoutée.",
            tache=pj.tache,
            instruction=pj.instruction,
            activite=pj.activite,
            blocage=pj.blocage,
        )

    @action(
        detail=False,
        methods=['post'],
        url_path='upload',
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsAuthenticated],
    )
    def upload(self, request):
        """
        Upload d'un fichier réel.

        Endpoint : POST /api/v1/pieces-jointes/upload/

        Body (multipart/form-data) :
            - fichier : le fichier binaire (obligatoire)
            - tache : ID de tâche (optionnel)
            - instruction : ID d'instruction (optionnel)
            - activite : ID d'activité (optionnel)
            - evenement : ID d'événement (optionnel)
            - blocage : ID de blocage (optionnel)

        Exactement une cible doit être fournie.
        """
        fichier = request.FILES.get('fichier')
        if not fichier:
            return Response(
                {'detail': "Aucun fichier fourni."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validation du fichier AVANT toute écriture sur le disque.
        try:
            valider_fichier(fichier)
        except FichierInvalide as e:
            return Response(
                {'fichier': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Récupérer la cible
        cibles = {
            'tache': request.data.get('tache'),
            'instruction': request.data.get('instruction'),
            'activite': request.data.get('activite'),
            'evenement': request.data.get('evenement'),
            'blocage': request.data.get('blocage'),
        }
        cibles_remplies = {k: v for k, v in cibles.items() if v}

        if len(cibles_remplies) == 0:
            return Response(
                {'detail': "Une cible est requise (tâche, instruction, "
                           "activité, événement ou blocage)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(cibles_remplies) > 1:
            return Response(
                {'detail': "Une seule cible est autorisée à la fois."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Résolution de la cible + contrôle d'accès. Sans ce contrôle, un
        # utilisateur authentifié pouvait déposer un fichier sur n'importe
        # quelle tâche, instruction ou activité (IDOR).
        type_cible, id_cible = next(iter(cibles_remplies.items()))
        modele_cible = {
            'tache': Tache,
            'instruction': Instruction,
            'activite': Activite,
            'evenement': Evenement,
            'blocage': Blocage,
        }[type_cible]

        try:
            cible = modele_cible.objects.get(id=id_cible)
        except modele_cible.DoesNotExist:
            return Response(
                {'detail': "Entité cible introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not a_acces_cible(request.user, type_cible, cible):
            return Response(
                {'detail': "Vous n'avez pas les droits sur cette entité."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Créer le dossier media si nécessaire
        media_root = Path(settings.MEDIA_ROOT)
        media_root.mkdir(parents=True, exist_ok=True)

        # Générer un nom de fichier unique pour éviter les collisions
        extension = extension_de(fichier)
        nom_unique = f"{uuid.uuid4().hex}{extension}"
        chemin_relatif = f"pieces_jointes/{nom_unique}"
        chemin_absolu = media_root / chemin_relatif

        # Créer le sous-dossier
        chemin_absolu.parent.mkdir(parents=True, exist_ok=True)

        # Écrire le fichier sur disque
        with open(chemin_absolu, 'wb+') as destination:
            for chunk in fichier.chunks():
                destination.write(chunk)

        # Créer l'entrée en base
        pj = PieceJointe.objects.create(
            nom_fichier=nom_sur(fichier.name),
            chemin=chemin_relatif,
            uploade_par=request.user,
            tache_id=cibles_remplies.get('tache'),
            instruction_id=cibles_remplies.get('instruction'),
            activite_id=cibles_remplies.get('activite'),
            evenement_id=cibles_remplies.get('evenement'),
            blocage_id=cibles_remplies.get('blocage'),
        )

        enregistrer_action(
            auteur=request.user,
            action='PIECE_JOINTE_AJOUTEE',
            details=f"Pièce jointe « {pj.nom_fichier} » ajoutée.",
            tache=pj.tache,
            instruction=pj.instruction,
            activite=pj.activite,
            blocage=pj.blocage,
        )

        return Response(
            PieceJointeSerializer(pj).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['get'],
        url_path='download',
        permission_classes=[IsAuthenticated, PieceJointePermission],
    )
    def download(self, request, pk=None):
        """
        Télécharge le fichier binaire.

        Endpoint : GET /api/v1/pieces-jointes/{id}/download/

        L'accès passe par get_queryset() puis PieceJointePermission : le
        fichier n'est téléchargeable que par someone ayant accès à
        l'entité ciblée.
        """
        pj = self.get_object()

        chemin_absolu = Path(settings.MEDIA_ROOT) / pj.chemin

        if not chemin_absolu.exists():
            raise Http404("Fichier introuvable sur le disque.")

        return FileResponse(
            open(chemin_absolu, 'rb'),
            as_attachment=True,
            filename=pj.nom_fichier,
        )


# ===========================================================================
# HISTORIQUE DES ACTIONS (lecture seule)
# ===========================================================================

class HistoriqueActionViewSet(viewsets.ModelViewSet):
    """
    ViewSet de l'historique.

    - Lecture seule + suppression (Directeur uniquement).
    - La création et la modification sont bloquées.
    """

    serializer_class = HistoriqueActionSerializer
    permission_classes = [IsAuthenticated]
    queryset = HistoriqueAction.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement (le RBAC joint sur tache__* / activite__*
    # avec .distinct()). Voir l'en-tête du module.
    # `auteur` est volontairement absent : c'est une clé étrangère, et le
    # nom affiché est déjà résolu côté client via `nomAuteur()`.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`cible_type`) : ordre métier de
    # regroupement de l'historique. `auteur` : clé étrangère non exposée.
    ordering_fields = ['date_action', 'action', 'cible_type']
    search_fields = [
        'details', 'action',
        'auteur__last_name', 'auteur__first_name',
    ]
    # `auteur` est nullable : l'historique système (escalade) a auteur=None,
    # il est donc invisible à toute recherche par nom d'auteur.

    def get_queryset(self):
        user = self.request.user

        qs = HistoriqueAction.objects.all().select_related(
            'auteur', 'tache', 'instruction', 'blocage', 'activite',
        ).order_by('-date_action')

        # --- Filtres par entité ---
        tache_id = self.request.query_params.get('tache')
        instruction_id = self.request.query_params.get('instruction')
        blocage_id = self.request.query_params.get('blocage')
        activite_id = self.request.query_params.get('activite')

        # --- Périmètre RBAC : appliqué AVANT tout filtre d'entité ---
        # L'ordre est impératif : restreindre d'abord par rôle, puis par
        # entité. Filtrer par entité d'abord autoriserait n'importe quel
        # utilisateur authentifié à lire l'historique d'une entité tierce.
        if est_directeur(user) or est_secretaire(user):
            pass  # accès total : aucune restriction de périmètre
        elif est_chef_de_service(user):
            qs = qs.filter(
                Q(auteur=user)
                | Q(tache__responsable__service=service_actuel(user))
                | Q(activite__responsable__service=service_actuel(user))
                | Q(tache__createur=user)
            ).distinct()
        else:
            qs = qs.filter(
                Q(auteur=user)
                | Q(tache__responsable=user)
                | Q(tache__createur=user)
                | Q(activite__responsable=user)
            ).distinct()

        # --- Restriction à une entité, DANS le périmètre autorisé ---
        if tache_id:
            qs = qs.filter(tache_id=tache_id)
        if instruction_id:
            qs = qs.filter(instruction_id=instruction_id)
        if blocage_id:
            qs = qs.filter(blocage_id=blocage_id)
        if activite_id:
            qs = qs.filter(activite_id=activite_id)

        # --- Cible dénormalisée ---
        # `cible_type` / `cible_id` sont recopiés au moment de l'action et
        # conservés après suppression de la cible : `cible_type` est un
        # CharField simple, pas un TextChoices, donc filtrable directement.
        cible_type = self.request.query_params.get('cible_type')
        if cible_type:
            qs = qs.filter(cible_type=cible_type)

        cible_id = self.request.query_params.get('cible_id')
        if cible_id and cible_id.isdigit():
            qs = qs.filter(cible_id=int(cible_id))

        # --- Catégorie d'action ---
        # Valeur dérivée (voir `CATEGORIES_ACTION` plus haut), pas une colonne.
        categorie = self.request.query_params.get('categorie')
        if categorie:
            qs = qs.filter(_q_categorie_action(categorie))

        # --- Période sur la date d'action ---
        qs = filtrer_periode(
            qs,
            'date_action',
            self.request.query_params.get('date_debut'),
            self.request.query_params.get('date_fin'),
            datetime_field=True,
        )

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/historique/stats/

        KPI sur l'intégralité du périmètre, après application du RBAC puis
        du filtre d'entité éventuel. Lecture seule.

        `systeme` compte les actions automatiques (auteur nul), dont les
        escalades de blocage.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'systeme': qs.filter(auteur__isnull=True).count(),
            'par_action': _compter_par(qs, 'action'),
            'par_cible': _compter_par(qs, 'cible_type'),
        })

    def create(self, request, *args, **kwargs):
        """Blocage de la création."""
        return Response(
            {'detail': "La création manuelle d'historique n'est pas autorisée."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        """Blocage de la modification (PUT)."""
        return Response(
            {'detail': "La modification de l'historique n'est pas autorisée."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        """Blocage de la modification partielle (PATCH)."""
        return Response(
            {'detail': "La modification de l'historique n'est pas autorisée."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        """Suppression d'une entrée — Directeur uniquement."""
        if not est_directeur(request.user):
            return Response(
                {'detail': "Seul le Directeur peut supprimer une entrée d'historique."},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        # Redondance au cas où, mais `destroy` ci-dessus gère déjà tout.
        instance.delete()


# ===========================================================================
# UTILISATEUR (lecture seule — annuaire)
# ===========================================================================

class UtilisateurViewSet(viewsets.ModelViewSet):
    """
    ViewSet en lecture seule pour l'annuaire des utilisateurs.

    Permet :
        - au frontend de peupler les sélecteurs (choix du responsable
          d'une tâche ou d'une activité, choix du destinataire d'une
          instruction, etc.),
        - à chaque utilisateur de voir ses collègues selon son périmètre.

    Aucune modification possible via l'API. La création/modification
    d'utilisateurs se fait exclusivement via l'admin Django.
    """

    serializer_class = UtilisateurSerializer
    permission_classes = [IsAuthenticated]
    queryset = Utilisateur.objects.filter(is_active=True)

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement. Voir l'en-tête du module.
    # `service` n'est pas exposé : le nom du service est résolu côté client.
    # `role` est un ordre métier : reste trié côté client.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`role`) : ordre métier, pas un
    # ordre alphabétique. `service` : nom résolu côté client.
    ordering_fields = ['last_name', 'first_name', 'username']
    search_fields = ['username', 'first_name', 'last_name', 'email', 'service']
    # `service` est un CharField local (nom du service d'affectation), pas
    # une clé étrangère.

    def get_queryset(self):
        user = self.request.user

        # Les comptes inactifs sont volontairement exclus de l'annuaire.
        # Conséquence assumée : le filtre « Inactifs » de la page Utilisateurs
        # et l'indicateur `stats.inactifs` ne peuvent renvoyer que 0, puisque
        # l'API ne produit jamais de compte inactif. Exposer les comptes
        # désactivés est une évolution à part (protection des données
        # personnelles, rythme de désactivation, anonymisation) : à traiter
        # dans une étape dédiée, pas ici.
        qs = Utilisateur.objects.filter(is_active=True).order_by(
            'last_name', 'first_name', 'username',
        )

        # --- Filtres utilisateur ---
        # Appliqués AVANT le branchement RBAC ci-dessous, et non après : chaque
        # branche repart de `qs` par `.filter()`, donc les filtres utilisateur
        # sont conservés dans les trois cas. Les ANDer avant le RBAC ne peut
        # pas élargir le périmètre, seulement le restreindre.
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)

        # `get_queryset` exclut déjà les comptes inactifs : `statut=inactif`
        # ne peut donc rien renvoyer. Le param est accepté pour que le contrat
        # reste cohérent avec les autres pages, et traité explicitement plutôt
        # que silencieusement ignoré.
        statut = self.request.query_params.get('statut')
        if statut == 'inactif':
            qs = qs.none()
        elif statut == 'actif':
            qs = qs.filter(is_active=True)

        if est_directeur(user) or est_secretaire(user):
            return qs

        if est_chef_de_service(user):
            # Son service + lui-même
            return qs.filter(
                Q(service=service_actuel(user)) | Q(id=user.id)
            ).distinct()

        # Conseillère, membre d'équipe : tout le monde pour l'annuaire
        # (on pourra restreindre davantage plus tard si nécessaire).
        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/utilisateurs/stats/

        KPI sur l'intégralité du périmètre. Lecture seule.

        Aucun indicateur sur les comptes inactifs : `get_queryset` les
        exclut, un tel compteur serait structurellement nul. Voir le
        commentaire de `get_queryset`.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'par_role': _compter_par(qs, 'role'),
            'par_service': _compter_par(qs, 'service'),
        })

   
    def create(self, request, *args, **kwargs):
        """La création se fait via l'admin Django."""
        return Response(
            {'detail': "La création d'utilisateurs se fait via l'admin."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        """La modification est réservée à l'action modifier_profil."""
        return Response(
            {'detail': "Utilisez /utilisateurs/me/modifier-profil/ pour modifier votre profil."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """La suppression est désactivée (désactivation soft via /desactiver/)."""
        return Response(
            {'detail': "Utilisez /desactiver/ pour désactiver un utilisateur."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(
        detail=False,
        methods=['patch'],
        url_path='me/modifier-profil',
        permission_classes=[IsAuthenticated],
    )
    def modifier_profil(self, request):
        """
        Modifie le profil de l'utilisateur connecté.

        Endpoint : PATCH /api/v1/utilisateurs/me/modifier-profil/
        Body : { "first_name": "...", "last_name": "...", "email": "..." }

        Notifie tous les Directeurs de la modification.
        """
        from .serializers import ProfilUpdateSerializer

        serializer = ProfilUpdateSerializer(
            request.user, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)

        # Capture AVANT modif pour l'historique
        ancien = {
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
            'email': request.user.email,
        }

        serializer.save()

        # Diff des changements
        changements = []
        if ancien['first_name'] != request.user.first_name:
            changements.append(
                f"prénom : « {ancien['first_name'] or '—'} » → « {request.user.first_name or '—'} »"
            )
        if ancien['last_name'] != request.user.last_name:
            changements.append(
                f"nom : « {ancien['last_name'] or '—'} » → « {request.user.last_name or '—'} »"
            )
        if ancien['email'] != request.user.email:
            changements.append(
                f"email : « {ancien['email'] or '—'} » → « {request.user.email or '—'} »"
            )

        details = (
            f"Profil modifié par {request.user.get_nom_complet()}. "
            + (', '.join(changements) if changements else "Aucun changement détecté.")
        )

        # Historique
        enregistrer_action(
            auteur=request.user,
            action='PROFIL_MODIFIE',
            details=details,
        )

        # Notifier tous les Directeurs (sauf soi-même)
        directeurs = Utilisateur.objects.avec_role(RoleChoice.DIRECTEUR).filter(
            is_active=True
        )
        for directeur in directeurs:
            if directeur.id == request.user.id:
                continue
            envoyer_notification(
                destinataire=directeur,
                type_notification='PROFIL_MODIFIE',
                message=(
                    f"{request.user.get_nom_complet()} a modifié son profil. "
                    + (', '.join(changements) if changements else "")
                ),
            )

        return Response(
            UtilisateurSerializer(request.user).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=['patch'],
        url_path='me/changer-mot-de-passe',
        permission_classes=[IsAuthenticated],
    )
    def changer_mot_de_passe(self, request):
        """
        Change le mot de passe de l'utilisateur connecté.

        Endpoint : PATCH /api/v1/utilisateurs/me/changer-mot-de-passe/
        Body :
            {
                "ancien_mot_de_passe": "...",
                "nouveau_mot_de_passe": "...",
                "confirmation": "..."
            }

        Notifie tous les Directeurs du changement.
        """
        from .serializers import MotDePasseUpdateSerializer

        serializer = MotDePasseUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        # Vérification de l'ancien mot de passe
        if not user.check_password(serializer.validated_data['ancien_mot_de_passe']):
            return Response(
                {'detail': "L'ancien mot de passe est incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data['nouveau_mot_de_passe'])
        user.save(update_fields=['password'])

        # Historique
        enregistrer_action(
            auteur=user,
            action='MOT_DE_PASSE_CHANGE',
            details=f"{user.get_nom_complet()} a changé son mot de passe.",
        )

        # Notifier les Directeurs
        directeurs = Utilisateur.objects.avec_role(RoleChoice.DIRECTEUR).filter(
            is_active=True
        )
        for directeur in directeurs:
            if directeur.id == user.id:
                continue
            envoyer_notification(
                destinataire=directeur,
                type_notification='MOT_DE_PASSE_CHANGE',
                message=f"{user.get_nom_complet()} a changé son mot de passe.",
            )

        return Response(
              {'detail': "Mot de passe modifié avec succès."},
              status=status.HTTP_200_OK,
          )

    @action(
        detail=True,
        methods=['post'],
        url_path='desactiver',
    )
    def desactiver(self, request, pk=None):
        """
        Désactive un utilisateur après réassignation obligatoire.

        Endpoint : POST /api/v1/utilisateurs/{id}/desactiver/

        Body :
            {
                "reassigner_a_id": 5,        # optionnel si aucun élément actif
                "date_effective": "2026-10-01T00:00:00"  # optionnel
            }

        Retourne 409 Conflict si l'utilisateur a des éléments actifs et
        que `reassigner_a_id` n'est pas fourni.
        """
        from django.utils.dateparse import parse_datetime

        utilisateur = self.get_object()
        user_courant = request.user

        # Seul le Directeur peut désactiver
        if not est_directeur(user_courant):
            return Response(
                {'detail': "Seul le Directeur peut désactiver un utilisateur."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if utilisateur.id == user_courant.id:
            return Response(
                {'detail': "Vous ne pouvez pas vous désactiver vous-même."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not utilisateur.is_active:
            return Response(
                {'detail': "Cet utilisateur est déjà inactif."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Détecter les éléments actifs ---
        taches_actives = Tache.objects.filter(
            responsable=utilisateur,
        ).exclude(statut__in=['TERMINEE', 'ANNULEE'])

        activites_actives = Activite.objects.filter(
            responsable=utilisateur,
        ).exclude(statut__in=['CLOTUREE', 'ANNULEE'])

        blocages_actifs = Blocage.objects.filter(
            signale_par=utilisateur,
        ).exclude(statut='RESOLU')

        evenements_futurs = Evenement.objects.filter(
            createur=utilisateur,
            date_debut__gt=timezone.now(),
        )

        elements = {
            'taches': list(taches_actives.values('id', 'titre', 'statut')),
            'activites': list(activites_actives.values('id', 'titre', 'statut')),
            'blocages': list(blocages_actifs.values('id', 'description', 'statut')),
            'evenements': list(evenements_futurs.values('id', 'titre', 'date_debut')),
        }

        a_des_elements = any(len(v) > 0 for v in elements.values())

        reassigner_a_id = request.data.get('reassigner_a_id')

        if a_des_elements and not reassigner_a_id:
            return Response(
                {
                    'statut': 'BLOQUEE',
                    'message': (
                        "Réassignation obligatoire avant désactivation. "
                        "Fournissez 'reassigner_a_id'."
                    ),
                    'elements': elements,
                },
                status=status.HTTP_409_CONFLICT,
            )

        # --- Réassigner si nécessaire ---
        nouveau_responsable = None
        if reassigner_a_id:
            try:
                nouveau_responsable = Utilisateur.objects.get(
                    id=reassigner_a_id, is_active=True,
                )
            except Utilisateur.DoesNotExist:
                return Response(
                    {'detail': "Utilisateur de réassignation introuvable ou inactif."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Réassigner tâches
            for tache in taches_actives:
                ancien_id = tache.responsable_id
                tache.responsable = nouveau_responsable
                tache.save(update_fields=['responsable'])
                enregistrer_action(
                    auteur=user_courant,
                    action='TACHE_REASSIGNEE',
                    details=(
                        f"Réattribution de {utilisateur.get_nom_complet()} vers "
                        f"{nouveau_responsable.get_nom_complet()} (désactivation)."
                    ),
                    tache=tache,
                )

            # Réassigner activités
            for activite in activites_actives:
                activite.responsable = nouveau_responsable
                activite.save(update_fields=['responsable'])
                enregistrer_action(
                    auteur=user_courant,
                    action='ACTIVITE_REASSIGNEE',
                    details=(
                        f"Réattribution de {utilisateur.get_nom_complet()} vers "
                        f"{nouveau_responsable.get_nom_complet()} (désactivation)."
                    ),
                    activite=activite,
                )

        # --- Désactivation effective ---
        date_effective_str = request.data.get('date_effective')
        if date_effective_str:
            date_effective = parse_datetime(date_effective_str)
            # Pour simplifier, on désactive immédiatement
            # (la date effective sera utilisée si on implémente un job plus tard)
            utilisateur.is_active = False
        else:
            utilisateur.is_active = False

        utilisateur.save(update_fields=['is_active'])

        enregistrer_action(
            auteur=user_courant,
            action='UTILISATEUR_DESACTIVE',
            details=(
                f"Utilisateur {utilisateur.get_nom_complet()} désactivé. "
                f"Réassigné à : "
                f"{nouveau_responsable.get_nom_complet() if nouveau_responsable else 'aucun'}"
            ),
        )

        return Response(
            UtilisateurSerializer(utilisateur).data,
            status=status.HTTP_200_OK,
        )
# ===========================================================================
# INSTRUCTION
# ===========================================================================

class InstructionViewSet(viewsets.ModelViewSet):
    """
    ViewSet des instructions.

    Filtrage queryset :
        - Directeur : toutes les instructions.
        - Secrétaire : toutes les instructions (saisie/suivi).
        - Chef de service : instructions émises par lui + celles ciblant
          son équipe.
        - Autres : instructions où ils sont émetteur ou destinataire.

    Action `create` personnalisée : accepte un tableau `destinataire_ids`
    en plus des champs habituels, et crée les InstructionDestinataire
    dans la foulée (transaction atomique).

    Action `changer_statut_destinataire` : permet à un destinataire de
    faire évoluer son propre statut.
    """

    serializer_class = InstructionSerializer
    permission_classes = [IsAuthenticated, InstructionPermission]
    queryset = Instruction.objects.all()

    # --- Socle tri / recherche serveur ---
    # Champs LOCAUX uniquement (le RBAC utilise des jointures sur
    # destinataires__destinataire + .distinct()). Voir l'en-tête du module.
    # `statut` et `priorite` restent triés côté client : ordre métier.
    filter_backends = [TriAvecNulsEnFin, SearchFilter]
    # Colonnes triées côté client UNIQUEMENT (`statut`, `priorite`) : ordre
    # métier arbitraire, pas d'ordre alphabétique.
    ordering_fields = ['titre', 'date_creation', 'date_echeance']
    search_fields = ['titre', 'description']

    def get_queryset(self):
        """Filtre les instructions selon le rôle et les query params."""
        user = self.request.user

        qs = Instruction.objects.all().select_related(
            'emetteur', 'saisie_par', 'activite_cible', 'tache_cible',
        ).prefetch_related('destinataires__destinataire').order_by('-date_creation')

        # --- Filtrage RBAC ---
        if est_directeur(user):
            pass
        elif est_secretaire(user):
            pass  # voit toutes les instructions
        elif est_chef_de_service(user):
            qs = qs.filter(
                Q(emetteur=user)
                | Q(destinataires__destinataire__service=service_actuel(user))
            ).distinct()
        else:
            qs = qs.filter(
                Q(emetteur=user) | Q(destinataires__destinataire=user)
            ).distinct()

        # --- Filtres utilisateur ---
        statut = self.request.query_params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)

        priorite = self.request.query_params.get('priorite')
        if priorite:
            qs = qs.filter(priorite=priorite)

        cible_type = self.request.query_params.get('cible_type')
        if cible_type == 'TACHE':
            qs = qs.filter(tache_cible__isnull=False)
        elif cible_type == 'ACTIVITE':
            qs = qs.filter(activite_cible__isnull=False)
        elif cible_type == 'AUCUNE':
            qs = qs.filter(tache_cible__isnull=True, activite_cible__isnull=True)

        # --- Période sur la date d'échéance (date_debut / date_fin) ---
        qs = filtrer_periode(
            qs,
            'date_echeance',
            self.request.query_params.get('date_debut'),
            self.request.query_params.get('date_fin'),
            datetime_field=True,
        )

        return qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/v1/instructions/stats/

        KPI sur l'intégralité du périmètre. Lecture seule.
        """
        qs = _base_agregeable(self.filter_queryset(self.get_queryset()))

        return Response({
            'total': qs.count(),
            'par_statut': _compter_par(qs, 'statut'),
            'en_cours': qs.filter(statut=StatutInstruction.EN_COURS).count(),
            'a_faire': qs.filter(statut=StatutInstruction.A_FAIRE).count(),
        })

    def create(self, request, *args, **kwargs):
        """
        Création d'une instruction avec ses destinataires.

        Payload attendu :
            {
                "titre": "...",
                "description": "...",
                "priorite": "HAUTE",
                "date_echeance": "2026-10-01T10:00:00Z",  # optionnel
                "tache_cible": 5,                          # optionnel
                "activite_cible": null,                    # optionnel
                "destinataire_ids": [4, 5]                 # OBLIGATOIRE
            }
        """
        from django.db import transaction

        destinataire_ids = request.data.get('destinataire_ids', [])

        if not isinstance(destinataire_ids, list) or not destinataire_ids:
            return Response(
                {'detail': "Au moins un destinataire est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Déduplication en conservant l'ordre d'envoi.
        try:
            destinataire_ids = list(
                dict.fromkeys(int(i) for i in destinataire_ids)
            )
        except (TypeError, ValueError):
            return Response(
                {
                    'destinataire_ids': (
                        "Les destinataires doivent être des identifiants "
                        "numériques."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Tous les destinataires doivent exister et être actifs. On ne
        # ignore plus personne en silence : la requête est refusée et
        # aucune ligne n'est créée.
        existants = set(
            Utilisateur.objects.filter(
                id__in=destinataire_ids, is_active=True,
            ).values_list('id', flat=True)
        )
        introuvables = [i for i in destinataire_ids if i not in existants]

        if introuvables:
            return Response(
                {
                    'destinataire_ids': (
                        "Destinataire(s) introuvable(s) ou inactif(s) : "
                        f"{', '.join(str(i) for i in introuvables)}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            instruction = serializer.save(emetteur=request.user)

            for utilisateur in Utilisateur.objects.filter(
                id__in=destinataire_ids, is_active=True,
            ):
                InstructionDestinataire.objects.create(
                    instruction=instruction,
                    destinataire=utilisateur,
                    statut='A_FAIRE',
                )

                # Notification au destinataire
                envoyer_notification(
                    destinataire=utilisateur,
                    type_notification='INSTRUCTION_RECUE',
                    message=f"Vous avez reçu une instruction : « {instruction.titre} ».",
                )

            enregistrer_action(
                auteur=request.user,
                action='INSTRUCTION_EMISE',
                details=f"Instruction « {instruction.titre} » émise à {len(destinataire_ids)} destinataire(s).",
                instruction=instruction,
            )

            # Alerte priorité élevée : notifier tous les destinataires
            if instruction.priorite in ('HAUTE', 'URGENTE'):
                for dest in instruction.destinataires.all():
                    envoyer_notification(
                        destinataire=dest.destinataire,
                        type_notification='TACHE_PRIORITE_ELEVEE',
                        message=(
                            f"Instruction prioritaire ({instruction.get_priorite_display()}) : "
                            f"« {instruction.titre} »."
                        ),
                    )

        # Re-sérialiser pour inclure les destinataires créés
        instruction.refresh_from_db()
        output = self.get_serializer(instruction)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['patch'],
        url_path=r'destinataires/(?P<user_id>[^/.]+)/statut',
        permission_classes=[IsAuthenticated],
    )
    def changer_statut_destinataire(self, request, pk=None, user_id=None):
        """
        Permet à un destinataire de mettre à jour son propre statut.

        Endpoint : PATCH /api/v1/instructions/{id}/destinataires/{user_id}/statut/

        Body : { "statut": "EN_COURS" }
        """
        instruction = self.get_object()
        nouveau_statut = request.data.get('statut')

        if nouveau_statut not in dict(StatutInstruction.choices):
            return Response(
                {'detail': f"Statut invalide. Valeurs : {list(dict(StatutInstruction.choices).keys())}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            dest = InstructionDestinataire.objects.get(
                instruction=instruction,
                destinataire_id=user_id,
            )
        except InstructionDestinataire.DoesNotExist:
            return Response(
                {'detail': "Destinataire introuvable pour cette instruction."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Autorisation : le destinataire lui-même, ou l'émetteur, ou le Directeur
        user = request.user
        if not (
            dest.destinataire_id == user.id
            or instruction.emetteur_id == user.id
            or est_directeur(user)
        ):
            return Response(
                {'detail': "Vous n'êtes pas autorisé à modifier ce statut."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ancien = dest.statut
        dest.statut = nouveau_statut
        dest.save(update_fields=['statut'])

        enregistrer_action(
            auteur=user,
            action='INSTRUCTION_DEST_STATUT',
            details=f"Statut du destinataire {dest.destinataire} : {ancien} → {nouveau_statut}.",
            instruction=instruction,
        )

        # Mettre à jour le statut global de l'instruction
        instruction.maj_statut_global()
        instruction.save(update_fields=['statut'])

        # Le prefetch issu de get_object() est périmé (le statut du
        # destinataire vient d'être modifié) : on recharge l'instruction
        # pour que la réponse contienne la nouvelle valeur.
        instruction = Instruction.objects.select_related(
            'emetteur', 'saisie_par', 'activite_cible', 'tache_cible',
        ).prefetch_related('destinataires__destinataire').get(
            pk=instruction.pk,
        )

        return Response(self.get_serializer(instruction).data, status=status.HTTP_200_OK)
    
    @action(
        detail=True,
        methods=['post'],
        url_path='annuler',
        permission_classes=[IsAuthenticated],
    )
    def annuler(self, request, pk=None):
        """
        Annule une instruction avec un motif obligatoire.

        Endpoint : POST /api/v1/instructions/{id}/annuler/
        Body : { "motif": "..." }
        """
        instruction = self.get_object()
        user = request.user

        if not (est_directeur(user) or instruction.emetteur_id == user.id):
            return Response(
                {'detail': "Seul l'émetteur ou le Directeur peut annuler cette instruction."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if instruction.statut == 'ANNULEE':
            return Response(
                {'detail': "Cette instruction est déjà annulée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = (request.data.get('motif') or '').strip()
        if len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        instruction.statut = 'ANNULEE'
        instruction.save(update_fields=['statut'])

        enregistrer_action(
            auteur=user,
            action='ANNULATION_MOTIVEE',
            details=f"Instruction « {instruction.titre} » annulée. Motif : {motif}",
            instruction=instruction,
        )

        return Response(InstructionSerializer(instruction).data, status=status.HTTP_200_OK)
    @action(
        detail=True,
        methods=['post'],
        url_path='reporter-echeance',
        permission_classes=[IsAuthenticated],
    )
    def reporter_echeance(self, request, pk=None):
        """
        Modifie la date d'échéance d'une instruction avec un motif.

        Endpoint : POST /api/v1/instructions/{id}/reporter-echeance/
        Body : { "date_echeance": "...", "motif": "..." }
        """
        from django.utils.dateparse import parse_datetime

        instruction = self.get_object()
        user = request.user

        if not (est_directeur(user) or instruction.emetteur_id == user.id):
            return Response(
                {'detail': "Seul l'émetteur ou le Directeur peut reporter l'échéance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        nouvelle_date_str = request.data.get('date_echeance')
        if not nouvelle_date_str:
            return Response(
                {'detail': "Le champ 'date_echeance' est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nouvelle_date = parse_datetime(nouvelle_date_str)
        if not nouvelle_date:
            return Response(
                {'detail': "Format de date invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = (request.data.get('motif') or '').strip()
        if len(motif) < 10:
            return Response(
                {'detail': "Un motif d'au moins 10 caractères est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ancienne_date = instruction.date_echeance
        instruction.date_echeance = nouvelle_date
        instruction.save(update_fields=['date_echeance'])

        ancienne_str = (
            ancienne_date.strftime('%d/%m/%Y %H:%M')
            if ancienne_date
            else '(aucune)'
        )
        nouvelle_str = nouvelle_date.strftime('%d/%m/%Y %H:%M')

        enregistrer_action(
            auteur=user,
            action='ECHEANCE_REPORTEE',
            details=(
                f"Échéance de « {instruction.titre} » reportée "
                f"de {ancienne_str} à {nouvelle_str}. Motif : {motif}"
            ),
            instruction=instruction,
        )

        return Response(InstructionSerializer(instruction).data, status=status.HTTP_200_OK)

    def perform_destroy(self, instance):
        """Enregistre l'action AVANT de supprimer."""
        enregistrer_action(
            auteur=self.request.user,
            action='INSTRUCTION_SUPPRIMEE',
            details=f"Instruction « {instance.titre} » supprimée.",
            instruction=instance,
        )
        instance.delete()

# ===========================================================================
# TABLEAU DE BORD
# ===========================================================================

class TableauDeBordView(APIView):
    """
    Endpoint unique qui agrège tous les indicateurs du dashboard.

    Retourne un JSON contenant :
        - Les KPIs (compteurs)
        - Les listes courtes (5 éléments max) pour affichage
        - Les événements du jour
        - Les tâches assignées à l'utilisateur

    Le périmètre des données est ajusté selon le rôle :
        - Directeur : tout
        - Chef de service : son service
        - Autres : ses propres données
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import date

        user = request.user
        maintenant = timezone.now()
        aujourd_hui = date.today()

        # ------------------------------------------------------------------
        # Périmètre de base
        # ------------------------------------------------------------------
        if est_directeur(user):
            taches_qs = Tache.objects.all()
            blocages_qs = Blocage.objects.all()
            instructions_qs = Instruction.objects.all()
            events_qs = Evenement.objects.all()
            crq_demandes_qs = DemandeReouvertureCRQ.objects.all()
            delegations_qs = Delegation.objects.all()
        elif est_chef_de_service(user):
            taches_qs = Tache.objects.filter(
                Q(responsable__service=service_actuel(user)) | Q(createur=user)
            ).distinct()
            blocages_qs = Blocage.objects.filter(
                Q(tache__responsable__service=service_actuel(user))
                | Q(signale_par=user)
            ).distinct()
            instructions_qs = Instruction.objects.filter(
                Q(emetteur=user)
                | Q(destinataires__destinataire__service=service_actuel(user))
            ).distinct()
            events_qs = Evenement.objects.filter(
                Q(createur=user) | Q(participants=user)
            ).distinct()
            crq_demandes_qs = DemandeReouvertureCRQ.objects.filter(
                demandeur__service=service_actuel(user)
            )
            delegations_qs = Delegation.objects.filter(
                Q(delegant=user) | Q(delegataire=user)
            ).distinct()
        else:
            taches_qs = Tache.objects.filter(
                Q(responsable=user) | Q(createur=user)
            ).distinct()
            blocages_qs = Blocage.objects.filter(
                Q(signale_par=user)
                | Q(tache__responsable=user)
                | Q(tache__createur=user)
            ).distinct()
            instructions_qs = Instruction.objects.filter(
                Q(emetteur=user) | Q(destinataires__destinataire=user)
            ).distinct()
            events_qs = Evenement.objects.filter(
                Q(createur=user) | Q(participants=user)
            ).distinct()
            crq_demandes_qs = DemandeReouvertureCRQ.objects.filter(
                demandeur=user
            )
            delegations_qs = Delegation.objects.filter(
                Q(delegant=user) | Q(delegataire=user)
            ).distinct()

        # ------------------------------------------------------------------
        # KPIs — tâches
        # ------------------------------------------------------------------
        taches_en_retard = taches_qs.filter(
            date_echeance__lt=maintenant,
            date_echeance__isnull=False,
        ).exclude(statut__in=['TERMINEE', 'ANNULEE']).count()

        taches_en_cours = taches_qs.filter(statut='EN_COURS').count()
        taches_terminees_aujourd_hui = taches_qs.filter(
            statut='TERMINEE',
            date_terminaison__date=aujourd_hui,
        ).count()

        # ------------------------------------------------------------------
        # KPIs — blocages urgents (HAUTE ou CRITIQUE, non résolus)
        # ------------------------------------------------------------------
        blocages_urgents = blocages_qs.filter(
            niveau_urgence__in=['HAUTE', 'CRITIQUE'],
        ).exclude(statut='RESOLU').count()

        # ------------------------------------------------------------------
        # KPIs — notifications non lues
        # ------------------------------------------------------------------
        notifications_non_lues = Notification.objects.filter(
            destinataire=user, lue=False,
        ).count()

        # ------------------------------------------------------------------
        # KPIs — demandes CRQ en attente
        # ------------------------------------------------------------------
        demandes_crq_attente = crq_demandes_qs.filter(
            statut='EN_ATTENTE',
        ).count()

        # ------------------------------------------------------------------
        # KPIs — instructions en attente
        # ------------------------------------------------------------------
        instructions_en_attente = instructions_qs.filter(
            statut__in=['A_FAIRE', 'EN_COURS'],
        ).count()

        # ------------------------------------------------------------------
        # Listes courtes (5 max)
        # ------------------------------------------------------------------
        from .serializers import (
            BlocageSerializer,
            EvenementSerializer,
            NotificationSerializer,
            TacheSerializer,
        )

        taches_retard_liste = taches_qs.filter(
            date_echeance__lt=maintenant,
            date_echeance__isnull=False,
        ).exclude(statut__in=['TERMINEE', 'ANNULEE']).order_by('date_echeance')[:5]

        blocages_urgents_liste = blocages_qs.filter(
            niveau_urgence__in=['HAUTE', 'CRITIQUE'],
        ).exclude(statut='RESOLU').order_by('-date_signalement')[:5]

        mes_taches = taches_qs.filter(
            responsable=user,
        ).exclude(statut__in=['TERMINEE', 'ANNULEE']).order_by('date_echeance')[:5]

        evenements_jour = events_qs.filter(
            date_debut__date=aujourd_hui,
        ).order_by('date_debut')

        dernieres_notifications = Notification.objects.filter(
            destinataire=user,
        ).order_by('-date_creation')[:5]

        delegations_actives = delegations_qs.filter(
            actif=True,
            date_debut__lte=maintenant,
            date_fin__gte=maintenant,
        ).order_by('date_fin')

        return Response({
            'kpis': {
                'taches_en_retard': taches_en_retard,
                'taches_en_cours': taches_en_cours,
                'taches_terminees_aujourd_hui': taches_terminees_aujourd_hui,
                'blocages_urgents': blocages_urgents,
                'notifications_non_lues': notifications_non_lues,
                'demandes_crq_attente': demandes_crq_attente,
                'instructions_en_attente': instructions_en_attente,
            },
            'taches_retard': TacheSerializer(taches_retard_liste, many=True).data,
            'blocages_urgents': BlocageSerializer(blocages_urgents_liste, many=True).data,
            'mes_taches': TacheSerializer(mes_taches, many=True).data,
            'evenements_jour': EvenementSerializer(evenements_jour, many=True).data,
            'dernieres_notifications': NotificationSerializer(
                dernieres_notifications, many=True,
            ).data,
            'delegations_actives': [
                {
                    'id': d.id,
                    'delegataire': d.delegataire.get_nom_complet(),
                    'role_delegue_display': d.get_role_delegue_display(),
                    'date_fin': d.date_fin,
                }
                for d in delegations_actives[:5]
            ],
        })


# ===========================================================================
# RECHERCHE TRANSVERSALE
# ===========================================================================

class RechercheViewSet(viewsets.ViewSet):
    """
    GET /api/v1/recherche/?q=<terme>&types=taches,activites

    Recherche transversale destinée à la barre de recherche du Header.
    Les résultats sont regroupés par type.

    Sécurité — point le plus important de cette classe :
        Le périmètre RBAC n'est JAMAIS réécrit ici. Pour chaque type, on
        instancie le ViewSet métier concerné et on appelle son propre
        `get_queryset()`. Toute correction du RBAC sur un ViewSet list se
        répercute donc automatiquement ici.

        Réécrire ces conditions dans ce ViewSet recréerait le défaut
        corrigé dans `HistoriqueActionViewSet` (filtre d'entité appliqué
        avant le contrôle de rôle).

        `filter_queryset()` n'est volontairement PAS appelé sur le ViewSet
        délégué : il lirait les query params de la requête courante
        (`statut`, `date_debut`...) et les appliquerait à tort à la
        recherche transversale. Seule la recherche textuelle est ajoutée.
    """

    permission_classes = [IsAuthenticated]

    #: Nombre de résultats renvoyés par type.
    LIMIT_PAR_TYPE = 5

    #: Longueur minimale du terme : en dessous, la requête n'est pas lancée.
    LONGUEUR_MIN = 2

    #: Types cherchés, dans l'ordre d'affichage.
    #: (clé de réponse, ViewSet métier, champs de recherche, ordre, projection)
    TYPES = (
        ('taches', TacheViewSet, ('titre', 'description'), '-date_creation'),
        ('instructions', InstructionViewSet, ('titre', 'description'), '-date_creation'),
        ('activites', ActiviteViewSet, ('titre', 'description'), '-date_creation'),
        ('blocages', BlocageViewSet, ('description',), '-date_signalement'),
        ('evenements', EvenementViewSet, ('titre', 'description'), 'date_debut'),
    )

    #: Projection (libellé, sous-titre) par type.
    def _projeter(self, type_jeu, obj):
        if type_jeu == 'taches':
            sous_titre = obj.get_statut_display()
            if obj.responsable_id:
                sous_titre = f"{sous_titre} · {obj.responsable.get_nom_complet()}"
            return obj.titre, sous_titre

        if type_jeu == 'instructions':
            return obj.titre, obj.get_statut_display()

        if type_jeu == 'activites':
            return obj.titre, obj.get_statut_display()

        if type_jeu == 'blocages':
            return obj.get_niveau_urgence_display(), obj.tache.titre

        if type_jeu == 'evenements':
            return obj.titre, obj.get_statut_display()

        return str(obj), ''

    def _queryset_delegue(self, viewset_class):
        """Récupère le queryset d'un ViewSet métier en réutilisant SON RBAC."""
        vs = viewset_class()
        vs.request = self.request
        vs.format_kwarg = None
        vs.action = 'list'
        return vs.get_queryset()

    def list(self, request):
        """
        Retourne les résultats groupés par type.

        Paramètres :
            - `q`     : terme recherché (≥ LONGUEUR_MIN caractères).
            - `types` : liste de types restreints, séparés par des virgules
                        (défaut : tous).

        Réponse :
            {
                "q": "rapport",
                "total": 7,
                "resultats": {
                    "taches": {"total": 3, "items": [...]},
                    ...
                }
            }
        """
        q = (request.query_params.get('q') or '').strip()

        if len(q) < self.LONGUEUR_MIN:
            return Response({
                'q': q,
                'total': 0,
                'resultats': {},
            })

        filtres_type = request.query_params.get('types')
        types_demandes = (
            [t.strip() for t in filtres_type.split(',') if t.strip()]
            if filtres_type else None
        )

        resultats = {}
        total_global = 0

        for type_jeu, viewset_class, champs, ordre in self.TYPES:
            if types_demandes and type_jeu not in types_demandes:
                continue

            # Périmètre RBAC repris via le ViewSet métier, puis recherche.
            qs = self._queryset_delegue(viewset_class)

            condition = Q()
            for champ in champs:
                condition |= Q(**{f'{champ}__icontains': q})
            qs = qs.filter(condition)

            # `total` = nombre total de correspondances (non plafonné),
            # `items` = aperçu limité. C'est ce qui permet à l'UI d'afficher
            # « 12 résultats » alors qu'elle n'en montre que 5.
            total_type = _base_agregeable(qs).count()
            if total_type == 0:
                continue

            items = []
            for obj in qs.order_by(ordre)[:self.LIMIT_PAR_TYPE]:
                libelle, sous_titre = self._projeter(type_jeu, obj)
                items.append({
                    'id': obj.id,
                    'type': type_jeu,
                    'libelle': libelle,
                    'sous_titre': sous_titre,
                })

            resultats[type_jeu] = {
                'total': total_type,
                'items': ResultatRechercheSerializer(items, many=True).data,
            }
            total_global += total_type

        return Response({
            'q': q,
            'total': total_global,
            'resultats': resultats,
        })