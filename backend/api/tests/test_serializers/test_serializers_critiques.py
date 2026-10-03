"""
Tests des serializers critiques :
    - TacheSerializer
    - ActiviteSerializer
    - InstructionSerializer

On vérifie :
    - Les champs read_only (createur, emetteur, etc.).
    - Les validations custom (dates, cible mutuellement exclusive).
    - Les SerializerMethodField (est_en_retard, peut_etre_cloturee, cible_type).
    - L'absence de récursion infinie sur les shallow serializers.
"""

from datetime import datetime, timedelta

import pytest

from api.models import Activite, Instruction, StatutTache, Tache
from api.serializers import (
    ActiviteSerializer,
    InstructionSerializer,
    TacheSerializer,
)


# ===========================================================================
# TacheSerializer
# ===========================================================================

@pytest.mark.django_db
class TestTacheSerializer:

    # -------------------------------------------------------------------
    # Champs read_only
    # -------------------------------------------------------------------

    def test_createur_est_read_only(self, directeur, membre):
        """
        Même si on envoie un `createur` dans les données, le serializer
        ne le prend pas en compte (il est read_only).
        """
        data = {
            'titre': 'Tâche test',
            'priorite': 'NORMALE',
            'createur': membre.id,  # tentative d'usurpation
        }
        serializer = TacheSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        # Le champ createur ne doit PAS être dans validated_data
        assert 'createur' not in serializer.validated_data

    def test_date_creation_est_read_only(self, directeur):
        data = {
            'titre': 'Tâche test',
            'priorite': 'NORMALE',
            'date_creation': '2020-01-01T00:00:00',
        }
        serializer = TacheSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'date_creation' not in serializer.validated_data

    def test_champs_notif_retard_est_read_only(self, directeur):
        data = {
            'titre': 'Tâche test',
            'priorite': 'NORMALE',
            'date_derniere_notif_retard': '2020-01-01T00:00:00',
            'date_derniere_notif_echeance': '2020-01-01T00:00:00',
        }
        serializer = TacheSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'date_derniere_notif_retard' not in serializer.validated_data
        assert 'date_derniere_notif_echeance' not in serializer.validated_data

    # -------------------------------------------------------------------
    # Validation des dates
    # -------------------------------------------------------------------

    def test_date_echeance_avant_date_debut_refusee(self):
        data = {
            'titre': 'Tâche test',
            'priorite': 'NORMALE',
            'date_debut': '2026-10-10T10:00:00',
            'date_echeance': '2026-10-09T10:00:00',  # avant
        }
        serializer = TacheSerializer(data=data)
        assert not serializer.is_valid()
        assert 'date_echeance' in serializer.errors

    def test_date_echeance_apres_date_debut_acceptee(self):
        data = {
            'titre': 'Tâche test',
            'priorite': 'NORMALE',
            'date_debut': '2026-10-09T10:00:00',
            'date_echeance': '2026-10-10T10:00:00',
        }
        serializer = TacheSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_date_echeance_seule_acceptee(self):
        """Si seule l'échéance est fournie, pas de validation croisée."""
        data = {
            'titre': 'Tâche test',
            'priorite': 'NORMALE',
            'date_echeance': '2026-10-10T10:00:00',
        }
        serializer = TacheSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    # -------------------------------------------------------------------
    # SerializerMethodField : est_en_retard
    # -------------------------------------------------------------------

    def test_est_en_retard_vrai_pour_tache_depassee(self, directeur, membre):
        tache = Tache.objects.create(
            titre='Tâche en retard',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            date_echeance=datetime.now() - timedelta(days=1),
            createur=directeur,
            responsable=membre,
        )
        data = TacheSerializer(tache).data
        assert data['est_en_retard'] is True

    def test_est_en_retard_faux_pour_tache_terminee(self, directeur, membre):
        """Une tâche terminée n'est jamais en retard, même si dépassée."""
        tache = Tache.objects.create(
            titre='Tâche terminée en retard',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            date_echeance=datetime.now() - timedelta(days=1),
            createur=directeur,
            responsable=membre,
        )
        data = TacheSerializer(tache).data
        assert data['est_en_retard'] is False

    def test_est_en_retard_faux_sans_echeance(self, directeur, membre):
        tache = Tache.objects.create(
            titre='Tâche sans échéance',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
        )
        data = TacheSerializer(tache).data
        assert data['est_en_retard'] is False

    # -------------------------------------------------------------------
    # Récursion shallow : Tache → Instruction
    # -------------------------------------------------------------------

    def test_instruction_detail_est_shallow(self, directeur, membre):
        """
        TacheSerializer utilise InstructionShallowSerializer pour éviter
        la récursion Tache → Instruction → Tache.
        """
        instruction = Instruction.objects.create(
            titre='Instruction parente',
            description='Description.',
            priorite='NORMALE',
            statut='A_FAIRE',
            emetteur=directeur,
        )
        tache = Tache.objects.create(
            titre='Tâche rattachée',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            instruction=instruction,
        )
        data = TacheSerializer(tache).data

        # instruction_detail existe
        assert data['instruction_detail'] is not None
        assert data['instruction_detail']['titre'] == 'Instruction parente'

        # Mais il NE contient PAS de tache_cible_detail (shallow)
        assert 'tache_cible_detail' not in data['instruction_detail']
        # Ni d'activite_cible_detail
        assert 'activite_cible_detail' not in data['instruction_detail']


# ===========================================================================
# ActiviteSerializer
# ===========================================================================

@pytest.mark.django_db
class TestActiviteSerializer:

    def test_createur_est_read_only(self, directeur):
        data = {
            'titre': 'Activité test',
            'priorite': 'NORMALE',
            'responsable': directeur.id,
            'createur': directeur.id,
        }
        serializer = ActiviteSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'createur' not in serializer.validated_data

    def test_responsable_est_modifiable(self, directeur, chef_projets):
        """Le responsable DOIT être assignable (contrairement à createur)."""
        data = {
            'titre': 'Activité test',
            'priorite': 'NORMALE',
            'responsable': chef_projets.id,
        }
        serializer = ActiviteSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['responsable'] == chef_projets

    def test_date_echeance_avant_date_debut_refusee(self, directeur):
        data = {
            'titre': 'Activité test',
            'priorite': 'NORMALE',
            'responsable': directeur.id,
            'date_debut': '2026-10-10T10:00:00',
            'date_echeance': '2026-10-09T10:00:00',
        }
        serializer = ActiviteSerializer(data=data)
        assert not serializer.is_valid()
        assert 'date_echeance' in serializer.errors

    def test_peut_etre_cloturee_vrai_sans_tache(self, directeur):
        activite = Activite.objects.create(
            titre='Activité sans tâche',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        data = ActiviteSerializer(activite).data
        assert data['peut_etre_cloturee'] is True

    def test_peut_etre_cloturee_faux_avec_tache_active(self, directeur, membre):
        activite = Activite.objects.create(
            titre='Activité avec tâche active',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        Tache.objects.create(
            titre='Tâche en cours',
            statut=StatutTache.EN_COURS,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            activite=activite,
        )
        data = ActiviteSerializer(activite).data
        assert data['peut_etre_cloturee'] is False

    def test_peut_etre_cloturee_vrai_avec_taches_terminees(self, directeur, membre):
        activite = Activite.objects.create(
            titre='Activité terminée',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        Tache.objects.create(
            titre='Tâche terminée',
            statut=StatutTache.TERMINEE,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            activite=activite,
        )
        data = ActiviteSerializer(activite).data
        assert data['peut_etre_cloturee'] is True

    def test_peut_etre_cloturee_faux_avec_tache_a_valider(self, directeur, membre):
        activite = Activite.objects.create(
            titre='Activité avec tâche à valider',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        Tache.objects.create(
            titre='Tâche à valider',
            statut=StatutTache.A_VALIDER,
            priorite='NORMALE',
            createur=directeur,
            responsable=membre,
            activite=activite,
        )
        data = ActiviteSerializer(activite).data
        assert data['peut_etre_cloturee'] is False


# ===========================================================================
# InstructionSerializer
# ===========================================================================

@pytest.mark.django_db
class TestInstructionSerializer:

    def test_emetteur_est_read_only(self, directeur, chef_projets):
        """On ne peut pas usurper l'émetteur d'une instruction."""
        data = {
            'titre': 'Instruction test',
            'description': 'Description.',
            'priorite': 'NORMALE',
            'emetteur': chef_projets.id,  # tentative d'usurpation
        }
        serializer = InstructionSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'emetteur' not in serializer.validated_data

    def test_cible_tache_et_activite_mutuellement_exclusives(
        self, directeur,
    ):
        """Une instruction ne peut pas cibler à la fois une tâche et une activité."""
        activite = Activite.objects.create(
            titre='Activité test',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        tache = Tache.objects.create(
            titre='Tâche test',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=directeur,
        )

        data = {
            'titre': 'Instruction invalide',
            'description': 'Description.',
            'priorite': 'NORMALE',
            'tache_cible': tache.id,
            'activite_cible': activite.id,
        }
        serializer = InstructionSerializer(data=data)
        assert not serializer.is_valid()
        assert 'activite_cible' in serializer.errors or 'non_field_errors' in serializer.errors

    def test_cible_type_tache(self, directeur):
        tache = Tache.objects.create(
            titre='Tâche cible',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=directeur,
        )
        instruction = Instruction.objects.create(
            titre='Instruction cible tâche',
            description='Description.',
            priorite='NORMALE',
            statut='A_FAIRE',
            emetteur=directeur,
            tache_cible=tache,
        )
        data = InstructionSerializer(instruction).data
        assert data['cible_type'] == 'TACHE'
        assert data['tache_cible_detail'] is not None

    def test_cible_type_activite(self, directeur):
        activite = Activite.objects.create(
            titre='Activité cible',
            statut='OUVERTE',
            priorite='NORMALE',
            responsable=directeur,
            createur=directeur,
        )
        instruction = Instruction.objects.create(
            titre='Instruction cible activité',
            description='Description.',
            priorite='NORMALE',
            statut='A_FAIRE',
            emetteur=directeur,
            activite_cible=activite,
        )
        data = InstructionSerializer(instruction).data
        assert data['cible_type'] == 'ACTIVITE'
        assert data['activite_cible_detail'] is not None

    def test_cible_type_aucune(self, directeur):
        instruction = Instruction.objects.create(
            titre='Instruction générale',
            description='Description.',
            priorite='NORMALE',
            statut='A_FAIRE',
            emetteur=directeur,
        )
        data = InstructionSerializer(instruction).data
        assert data['cible_type'] == 'AUCUNE'
        assert data['tache_cible_detail'] is None
        assert data['activite_cible_detail'] is None

    def test_destinataires_en_lecture_seule(self, directeur, membre):
        """Le champ destinataires ne peut pas être modifié via ce serializer."""
        instruction = Instruction.objects.create(
            titre='Instruction test',
            description='Description.',
            priorite='NORMALE',
            statut='A_FAIRE',
            emetteur=directeur,
        )
        instruction.destinataires.create(destinataire=membre, statut='A_FAIRE')

        data = InstructionSerializer(instruction).data
        # On voit bien les destinataires en lecture
        assert len(data['destinataires']) == 1
        assert data['destinataires'][0]['destinataire'] == membre.id

    def test_pas_de_recursion_dans_tache_cible_detail(self, directeur):
        """
        Le champ tache_cible_detail doit être shallow pour éviter
        Instruction → Tâche → Instruction → ...
        """
        tache = Tache.objects.create(
            titre='Tâche cible',
            statut=StatutTache.A_FAIRE,
            priorite='NORMALE',
            createur=directeur,
        )
        instruction = Instruction.objects.create(
            titre='Instruction cible tâche',
            description='Description.',
            priorite='NORMALE',
            statut='A_FAIRE',
            emetteur=directeur,
            tache_cible=tache,
        )
        # Le serializer ne doit PAS lever de RecursionError
        data = InstructionSerializer(instruction).data
        assert data['tache_cible_detail'] is not None
        # Le shallow n'a pas de instruction_detail
        assert 'instruction_detail' not in data['tache_cible_detail']
        # Ni d'activite_detail
        assert 'activite_detail' not in data['tache_cible_detail']