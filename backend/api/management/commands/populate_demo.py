"""
Commande Django : populate_demo

Génère un jeu de données de démonstration réaliste pour DPP Assistant.

Usage :
    python manage.py populate_demo          # ajoute les données
    python manage.py populate_demo --reset  # efface d'abord les données métier
"""

from datetime import date, datetime, time, timedelta
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import (
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
)

User = get_user_model()


# ============================================================
# HELPERS
# ============================================================

def d(offset: int) -> date:
    """Aujourd'hui + offset jours (négatif = passé)."""
    return date.today() + timedelta(days=offset)


def dt(offset_days: int, h: int = 9, m: int = 0) -> datetime:
    """Datetime : aujourd'hui + offset, à h:m."""
    return datetime.combine(d(offset_days), time(h, m))


class Command(BaseCommand):
    help = "Génère un jeu de données de démonstration réaliste."

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help="Efface les données métier avant de générer.",
        )

    def handle(self, *args, **options):
        if options['reset']:
            self.stdout.write(self.style.WARNING('Nettoyage des données...'))
            self._reset()

        self.stdout.write(self.style.WARNING('Génération des données...'))
        with transaction.atomic():
            self._populate()

        self.stdout.write(self.style.SUCCESS('✓ Terminé.'))

    # ========================================================
    # RESET
    # ========================================================

    def _reset(self):
        """Supprime toutes les données métier (utilisateurs conservés)."""
        # Ordre : d'abord les dépendances
        HistoriqueAction.objects.all().delete()
        Notification.objects.all().delete()
        Commentaire.objects.all().delete()
        PieceJointe.objects.all().delete()
        DemandeReouvertureCRQ.objects.all().delete()
        CompteRenduQuotidien.objects.all().delete()
        Blocage.objects.all().delete()
        InstructionDestinataire.objects.all().delete()
        Instruction.objects.all().delete()
        Delegation.objects.all().delete()
        Tache.objects.all().delete()
        Activite.objects.all().delete()
        Evenement.objects.all().delete()
        Synthese.objects.all().delete()
        self.stdout.write('  → Données effacées.')

    # ========================================================
    # POPULATE
    # ========================================================

    def _populate(self):
        users = self._ensure_users()
        activites = self._create_activites(users)
        taches = self._create_taches(users, activites)
        self._create_instructions(users, activites, taches)
        self._create_blocages(users, taches)
        self._create_delegations(users)
        self._create_evenements(users)
        self._create_crqs(users)
        self._create_syntheses(users)
        self._create_commentaires(users, taches)
        self._create_notifications(users)
        self._create_historique(users, taches)

    # --------------------------------------------------------
    # UTILISATEURS
    # --------------------------------------------------------

    def _ensure_users(self):
        """Crée les utilisateurs manquants. Retourne un dict."""
        specs = [
            ('directeur', 'Rakoto', 'Jean', 'DIRECTEUR', 'Direction', 'Directeur2026!'),
            ('chef_projets', 'Rabe', 'Marie', 'CHEF_SERVICE_PROJETS', 'Service Projets', 'Chef2026!'),
            ('chef_partenariats', 'Rasoa', 'Anne', 'CHEF_SERVICE_PARTENARIATS', 'Service Partenariats', 'Chef2026!'),
            ('secretaire', 'Randria', 'Sophie', 'SECRETAIRE_DIRECTION', 'Direction', 'Secret2026!'),
            ('conseillere', 'Ravel', 'Claire', 'CONSEILLERE_TECHNIQUE', 'Direction', 'Conseil2026!'),
            ('membre', 'Rakoto', 'Paul', 'MEMBRE_EQUIPE_APPUI', 'Service Projets', 'Membre2026!'),
            ('membre2', 'Rasolo', 'Nadia', 'MEMBRE_EQUIPE_APPUI', 'Service Projets', 'Membre2026!'),
            ('membre3', 'Rafidy', 'Tiana', 'MEMBRE_EQUIPE_APPUI', 'Service Partenariats', 'Membre2026!'),
        ]
        result = {}
        for username, last, first, role, service, password in specs:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'last_name': last,
                    'first_name': first,
                    'role': role,
                    'service': service,
                    'email': f'{username}@dpp.local',
                    'is_active': True,
                },
            )
            if created:
                user.set_password(password)
                user.save()
            result[username] = user
        return result

    # --------------------------------------------------------
    # ACTIVITÉS
    # --------------------------------------------------------

    def _create_activites(self, users):
        specs = [
            {
                'titre': 'Refonte du site institutionnel',
                'description': "Modernisation complète du site web de la Direction : design, contenu, accessibilité.",
                'statut': 'EN_COURS',
                'priorite': 'HAUTE',
                'date_debut': d(-30),
                'date_echeance': d(45),
                'responsable': users['chef_projets'],
                'createur': users['directeur'],
            },
            {
                'titre': 'Programme de formation 2026',
                'description': "Plan de formation annuel pour l'ensemble des agents de la Direction.",
                'statut': 'OUVERTE',
                'priorite': 'NORMALE',
                'date_debut': d(-15),
                'date_echeance': d(90),
                'responsable': users['chef_projets'],
                'createur': users['directeur'],
            },
            {
                'titre': 'Audit des processus internes',
                'description': "Revue complète des procédures administratives et financières.",
                'statut': 'EN_COURS',
                'priorite': 'HAUTE',
                'date_debut': d(-60),
                'date_echeance': d(15),
                'responsable': users['chef_partenariats'],
                'createur': users['directeur'],
            },
            {
                'titre': 'Partenariat avec l\'Université',
                'description': "Négociation et formalisation d'une convention de partenariat académique.",
                'statut': 'OUVERTE',
                'priorite': 'NORMALE',
                'date_debut': d(-10),
                'date_echeance': d(60),
                'responsable': users['chef_partenariats'],
                'createur': users['directeur'],
            },
            {
                'titre': 'Rapport annuel 2025',
                'description': "Rédaction et publication du rapport annuel d'activités.",
                'statut': 'CLOTUREE',
                'priorite': 'HAUTE',
                'date_debut': d(-120),
                'date_echeance': d(-30),
                'responsable': users['chef_projets'],
                'createur': users['directeur'],
            },
        ]
        result = []
        for spec in specs:
            result.append(Activite.objects.create(**spec))
        self.stdout.write(f'  → {len(result)} activités créées.')
        return result

    # --------------------------------------------------------
    # TÂCHES
    # --------------------------------------------------------

    def _create_taches(self, users, activites):
        specs = [
            # Refonte du site (activité 0)
            {
                'titre': 'Audit de l\'existant',
                'description': "Recenser les pages, fonctionnalités et problèmes actuels du site.",
                'statut': 'TERMINEE',
                'priorite': 'HAUTE',
                'date_debut': d(-30),
                'date_echeance': d(-15),
                'createur': users['chef_projets'],
                'responsable': users['membre'],
                'activite': activites[0],
            },
            {
                'titre': 'Maquettes UX des 5 pages principales',
                'description': "Concevoir les maquettes desktop et mobile des pages d'accueil, contact, actualités, projets, à propos.",
                'statut': 'EN_COURS',
                'priorite': 'HAUTE',
                'date_debut': d(-10),
                'date_echeance': d(10),
                'createur': users['chef_projets'],
                'responsable': users['membre2'],
                'activite': activites[0],
            },
            {
                'titre': 'Choix de la solution technique',
                'description': "Comparer les CMS et frameworks possibles, rédiger une note de recommandation.",
                'statut': 'EN_ATTENTE',
                'priorite': 'NORMALE',
                'date_debut': d(-5),
                'date_echeance': d(20),
                'createur': users['chef_projets'],
                'responsable': users['membre'],
                'activite': activites[0],
            },

            # Formation (activité 1)
            {
                'titre': 'Recensement des besoins de formation',
                'description': "Envoyer un questionnaire à tous les services pour identifier les besoins.",
                'statut': 'EN_COURS',
                'priorite': 'NORMALE',
                'date_debut': d(-10),
                'date_echeance': d(5),
                'createur': users['chef_projets'],
                'responsable': users['membre2'],
                'activite': activites[1],
            },
            {
                'titre': 'Sélection des prestataires',
                'description': "Identifier et contacter les organismes de formation potentiels.",
                'statut': 'A_FAIRE',
                'priorite': 'NORMALE',
                'date_debut': d(5),
                'date_echeance': d(35),
                'createur': users['chef_projets'],
                'responsable': users['chef_projets'],
                'activite': activites[1],
            },

            # Audit (activité 2)
            {
                'titre': 'Cartographie des processus',
                'description': "Documenter tous les processus administratifs actuels.",
                'statut': 'TERMINEE',
                'priorite': 'HAUTE',
                'date_debut': d(-55),
                'date_echeance': d(-40),
                'createur': users['chef_partenariats'],
                'responsable': users['membre3'],
                'activite': activites[2],
            },
            {
                'titre': 'Identification des points de blocage',
                'description': "Analyser les processus et remonter les inefficacités.",
                'statut': 'EN_COURS',
                'priorite': 'URGENTE',
                'date_debut': d(-20),
                'date_echeance': d(-3),  # EN RETARD
                'createur': users['chef_partenariats'],
                'responsable': users['membre3'],
                'activite': activites[2],
            },
            {
                'titre': 'Rédaction du rapport d\'audit',
                'description': "Synthèse écrite du diagnostic et des recommandations.",
                'statut': 'A_FAIRE',
                'priorite': 'HAUTE',
                'date_debut': d(-2),
                'date_echeance': d(12),
                'createur': users['chef_partenariats'],
                'responsable': users['chef_partenariats'],
                'activite': activites[2],
            },

            # Partenariat (activité 3)
            {
                'titre': 'Rédaction de la convention',
                'description': "Rédiger le projet de convention avec le service juridique.",
                'statut': 'BLOQUEE',
                'priorite': 'HAUTE',
                'date_debut': d(-8),
                'date_echeance': d(7),
                'createur': users['chef_partenariats'],
                'responsable': users['membre3'],
                'activite': activites[3],
            },

            # Rapport (activité 4 — clôturée)
            {
                'titre': 'Collecte des contributions',
                'description': "Rassembler les contributions de tous les services.",
                'statut': 'TERMINEE',
                'priorite': 'NORMALE',
                'date_debut': d(-100),
                'date_echeance': d(-60),
                'createur': users['chef_projets'],
                'responsable': users['membre'],
                'activite': activites[4],
            },

            # Tâches orphelines (pas d'activité)
            {
                'titre': 'Mise à jour de la charte graphique',
                'description': "Actualiser les logos et couleurs selon la nouvelle identité.",
                'statut': 'A_FAIRE',
                'priorite': 'BASSE',
                'date_debut': None,
                'date_echeance': None,
                'createur': users['directeur'],
                'responsable': None,
            },
            {
                'titre': 'Préparation réunion de direction',
                'description': "Ordre du jour + documents pour la réunion mensuelle.",
                'statut': 'EN_COURS',
                'priorite': 'URGENTE',
                'date_debut': d(-1),
                'date_echeance': d(2),
                'createur': users['secretaire'],
                'responsable': users['secretaire'],
            },
            {
                'titre': 'Inventaire du matériel informatique',
                'description': "Recensement complet du parc informatique.",
                'statut': 'ANNULEE',
                'priorite': 'BASSE',
                'date_debut': d(-40),
                'date_echeance': d(-20),
                'createur': users['chef_projets'],
                'responsable': users['membre2'],
            },
        ]
        result = []
        for spec in specs:
            result.append(Tache.objects.create(**spec))
        self.stdout.write(f'  → {len(result)} tâches créées.')
        return result

    # --------------------------------------------------------
    # INSTRUCTIONS
    # --------------------------------------------------------

    def _create_instructions(self, users, activites, taches):
        specs = [
            {
                'titre': 'Prioriser la refonte du site',
                'description': "Cette refonte doit être finalisée avant la fin du trimestre. Un point hebdomadaire avec le chef de service est attendu.",
                'priorite': 'HAUTE',
                'statut': 'EN_COURS',
                'date_echeance': d(30),
                'emetteur': users['directeur'],
                'tache_cible': taches[1],
            },
            {
                'titre': 'Accélérer le rapport d\'audit',
                'description': "Le rapport est attendu pour la prochaine réunion de direction. Merci de faire le nécessaire.",
                'priorite': 'URGENTE',
                'statut': 'A_FAIRE',
                'date_echeance': d(7),
                'emetteur': users['directeur'],
                'tache_cible': taches[7],
            },
            {
                'titre': 'Suivi mensuel du programme de formation',
                'description': "Présenter un point d'avancement chaque fin de mois.",
                'priorite': 'NORMALE',
                'statut': 'EN_COURS',
                'date_echeance': d(60),
                'emetteur': users['directeur'],
                'activite_cible': activites[1],
            },
            {
                'titre': 'Préparer la réunion de partenariat',
                'description': "Organiser la réunion avec les représentants de l'Université.",
                'priorite': 'HAUTE',
                'statut': 'EN_COURS',
                'date_echeance': d(14),
                'emetteur': users['directeur'],
                'activite_cible': activites[3],
            },
            {
                'titre': 'Briefing hebdomadaire',
                'description': "Envoyer un compte-rendu synthétique chaque vendredi.",
                'priorite': 'BASSE',
                'statut': 'A_FAIRE',
                'date_echeance': None,
                'emetteur': users['directeur'],
            },
        ]

        destinataires_map = [
            [users['chef_projets'], users['secretaire']],
            [users['chef_partenariats'], users['membre3']],
            [users['chef_projets'], users['membre2']],
            [users['chef_partenariats'], users['secretaire']],
            [users['secretaire']],
        ]

        for spec, dests in zip(specs, destinataires_map):
            instruction = Instruction.objects.create(**spec)
            for user in dests:
                statut = 'EN_COURS' if instruction.statut == 'EN_COURS' else 'A_FAIRE'
                InstructionDestinataire.objects.create(
                    instruction=instruction,
                    destinataire=user,
                    statut=statut,
                )
        self.stdout.write(f'  → {len(specs)} instructions créées.')

    # --------------------------------------------------------
    # BLOCAGES
    # --------------------------------------------------------

    def _create_blocages(self, users, taches):
        specs = [
            {
                'tache': taches[8],  # Rédaction convention (BLOQUEE)
                'description': "Le service juridique n'a pas encore retourné sa validation sur les clauses de propriété intellectuelle.",
                'niveau_urgence': 'HAUTE',
                'statut': 'REMONTE_AU_DIRECTEUR',
                'signale_par': users['membre3'],
                'personne_sollicitee': users['chef_partenariats'],
                'date_signalement': dt(-5, 10, 30),
            },
            {
                'tache': taches[6],  # Identification points blocage
                'description': "Manque d'accès aux données historiques pour finaliser l'analyse.",
                'niveau_urgence': 'MOYENNE',
                'statut': 'EN_TRAITEMENT',
                'signale_par': users['membre3'],
                'personne_sollicitee': users['chef_partenariats'],
                'date_signalement': dt(-2, 14, 0),
            },
            {
                'tache': taches[2],  # Choix solution technique
                'description': "Le budget alloué ne permet pas de retenir la solution initialement pressentie.",
                'niveau_urgence': 'CRITIQUE',
                'statut': 'EN_ATTENTE',
                'signale_par': users['membre'],
                'personne_sollicitee': users['directeur'],
                'date_signalement': dt(-1, 9, 15),
            },
            {
                'tache': taches[0],  # Audit existant (résolu)
                'description': "Accès administrateur au site actuel non disponible.",
                'niveau_urgence': 'BASSE',
                'statut': 'RESOLU',
                'signale_par': users['membre'],
                'personne_sollicitee': users['chef_projets'],
                'date_signalement': dt(-25, 11, 0),
                'date_resolution': dt(-24, 16, 30),
                'resolu_par': users['chef_projets'],
            },
        ]
        for spec in specs:
            Blocage.objects.create(**spec)
        self.stdout.write(f'  → {len(specs)} blocages créés.')

    # --------------------------------------------------------
    # DÉLÉGATIONS
    # --------------------------------------------------------

    def _create_delegations(self, users):
        specs = [
            {
                'delegant': users['directeur'],
                'delegataire': users['chef_projets'],
                'role_delegue': 'DIRECTEUR',
                'service': None,
                'date_debut': d(-5),
                'date_fin': d(10),
                'actif': True,
            },
            {
                'delegant': users['chef_projets'],
                'delegataire': users['membre'],
                'role_delegue': 'CHEF_SERVICE_PROJETS',
                'service': 'Service Projets',
                'date_debut': d(-2),
                'date_fin': d(20),
                'actif': True,
            },
            {
                'delegant': users['directeur'],
                'delegataire': users['chef_partenariats'],
                'role_delegue': 'DIRECTEUR',
                'service': None,
                'date_debut': d(-60),
                'date_fin': d(-30),
                'actif': False,
            },
        ]
        for spec in specs:
            Delegation.objects.create(**spec)
        self.stdout.write(f'  → {len(specs)} délégations créées.')

    # --------------------------------------------------------
    # ÉVÉNEMENTS
    # --------------------------------------------------------

    def _create_evenements(self, users):
        specs = [
            {
                'titre': 'Réunion de direction mensuelle',
                'description': "Point d'avancement sur les activités du mois.",
                'type': 'REUNION',
                'date_debut': dt(2, 9, 0),
                'date_fin': dt(2, 11, 0),
                'statut': 'PLANIFIE',
                'niveau_priorite': 'DIRECTION',
                'createur': users['directeur'],
            },
            {
                'titre': 'Audience avec le Ministère',
                'description': "Présentation du programme de partenariat.",
                'type': 'AUDIENCE',
                'date_debut': dt(7, 14, 0),
                'date_fin': dt(7, 16, 0),
                'statut': 'PLANIFIE',
                'niveau_priorite': 'DIRECTION',
                'createur': users['directeur'],
            },
            {
                'titre': 'Réunion équipe projet site web',
                'description': "Revue des maquettes UX.",
                'type': 'REUNION',
                'date_debut': dt(1, 10, 0),
                'date_fin': dt(1, 12, 0),
                'statut': 'PLANIFIE',
                'niveau_priorite': 'PERSONNEL',
                'createur': users['chef_projets'],
            },
            {
                'titre': 'Rendez-vous Université',
                'description': "Signature de la convention de partenariat.",
                'type': 'RENDEZ_VOUS',
                'date_debut': dt(20, 15, 0),
                'date_fin': dt(20, 17, 0),
                'statut': 'PLANIFIE',
                'niveau_priorite': 'DIRECTION',
                'createur': users['chef_partenariats'],
            },
        ]
        for spec in specs:
            evt = Evenement.objects.create(**spec)
            evt.participants.add(users['directeur'])
            if 'chef_projets' in str(spec.get('createur')):
                pass
        self.stdout.write(f'  → {len(specs)} événements créés.')

    # --------------------------------------------------------
    # CRQ
    # --------------------------------------------------------

    def _create_crqs(self, users):
        # CRQ d'aujourd'hui pour le chef_projets (non clôturé)
        CompteRenduQuotidien.objects.create(
            redacteur=users['chef_projets'],
            date_journaliere=date.today(),
            activites_realisees=(
                "- Revue des maquettes UX (page d'accueil et contact)\n"
                "- Validation avec l'équipe communication\n"
                "- Point avec le prestataire technique"
            ),
            activites_en_cours=(
                "- Finalisation des 3 dernières maquettes\n"
                "- Rédaction du cahier des charges"
            ),
            activites_non_realisees=(
                "- Réunion avec le service juridique (reportée)"
            ),
            difficultes=(
                "Le service juridique est en sous-effectif cette semaine."
            ),
            prevues_lendemain=(
                "- Valider les maquettes restantes\n"
                "- Réunion avec le juriste à 14h"
            ),
            est_cloture=False,
        )

        # CRQ d'hier clôturé
        CompteRenduQuotidien.objects.create(
            redacteur=users['chef_projets'],
            date_journaliere=d(-1),
            activites_realisees=(
                "- Atelier de cadrage UX\n"
                "- Entretien avec le prestataire\n"
                "- Mise à jour du planning projet"
            ),
            activites_en_cours=(
                "- Rédaction du cahier des charges"
            ),
            activites_non_realisees="",
            difficultes="Aucune.",
            prevues_lendemain=(
                "- Finaliser les maquettes\n"
                "- Point avec le directeur"
            ),
            est_cloture=True,
        )

        # CRQ du chef partenariats
        CompteRenduQuotidien.objects.create(
            redacteur=users['chef_partenariats'],
            date_journaliere=d(-1),
            activites_realisees=(
                "- Analyse des processus financiers\n"
                "- Rédaction du rapport intermédiaire"
            ),
            activites_en_cours=(
                "- Cartographie des points de blocage"
            ),
            activites_non_realisees=(
                "- Réunion avec le service comptable"
            ),
            difficultes="Manque d'accès aux données historiques.",
            prevues_lendemain=(
                "- Reprise des analyses\n"
                "- Solliciter le DSI"
            ),
            est_cloture=True,
        )

        self.stdout.write('  → 3 CRQ créés.')

    # --------------------------------------------------------
    # SYNTHÈSES
    # --------------------------------------------------------

    def _create_syntheses(self, users):
        Synthese.objects.create(
            type='HEBDOMADAIRE',
            periode_debut=d(-7),
            periode_fin=d(-1),
            contenu=(
                "SYNTHÈSE HEBDOMADAIRE\n"
                "=====================\n\n"
                "1. ACTIVITÉS EN COURS\n"
                "- Refonte du site : maquettes UX en cours (60% avancé)\n"
                "- Programme de formation : recensement des besoins effectué\n"
                "- Audit : identification des points de blocage\n\n"
                "2. POINTS D'ATTENTION\n"
                "- Blocage critique sur le budget de la solution technique\n"
                "- Service juridique en sous-effectif\n\n"
                "3. ACTIONS PRÉVUES\n"
                "- Réunion de direction mardi prochain\n"
                "- Finalisation des maquettes UX"
            ),
            genere_par=users['secretaire'],
        )

        Synthese.objects.create(
            type='MENSUELLE',
            periode_debut=d(-30),
            periode_fin=date.today(),
            contenu=(
                "SYNTHÈSE MENSUELLE\n"
                "==================\n\n"
                "1. AVANCEMENT GLOBAL\n"
                "5 activités actives, dont 2 en phase critique.\n\n"
                "2. RÉALISATIONS MAJEURES\n"
                "- Audit préliminaire terminé\n"
                "- Partenariat Université en négociation avancée\n"
                "- Rapport annuel 2025 publié\n\n"
                "3. DIFFICULTÉS\n"
                "- Retard sur l'audit des processus\n"
                "- Manque de ressources juridiques\n\n"
                "4. PERSPECTIVES\n"
                "- Finaliser la refonte du site avant fin du trimestre\n"
                "- Signer la convention de partenariat"
            ),
            genere_par=users['directeur'],
        )

        self.stdout.write('  → 2 synthèses créées.')

    # --------------------------------------------------------
    # COMMENTAIRES
    # --------------------------------------------------------

    def _create_commentaires(self, users, taches):
        Commentaire.objects.create(
            contenu="Les maquettes sont vraiment bien. On valide pour la suite.",
            auteur=users['directeur'],
            tache=taches[1],
        )
        Commentaire.objects.create(
            contenu="Merci ! Je finalise les 3 dernières cette semaine.",
            auteur=users['membre2'],
            tache=taches[1],
        )
        Commentaire.objects.create(
            contenu="Le budget doit être revu. À discuter en réunion.",
            auteur=users['chef_projets'],
            tache=taches[2],
        )
        self.stdout.write('  → 3 commentaires créés.')

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    def _create_notifications(self, users):
        specs = [
            {
                'destinataire': users['chef_projets'],
                'type': 'TACHE_ASSIGNEE',
                'message': "Nouvelle tâche assignée : « Sélection des prestataires »",
                'lue': False,
                'date_creation': dt(-1, 8, 30),
            },
            {
                'destinataire': users['chef_partenariats'],
                'type': 'BLOCAGE_SIGNALE',
                'message': "Un blocage a été remonté au Directeur sur « Rédaction de la convention ».",
                'lue': False,
                'date_creation': dt(-5, 10, 35),
            },
            {
                'destinataire': users['membre2'],
                'type': 'TACHE_ECHEANCE_PROCHE',
                'message': "Votre tâche « Recensement des besoins de formation » arrive à échéance dans 5 jours.",
                'lue': False,
                'date_creation': dt(0, 7, 0),
            },
            {
                'destinataire': users['membre3'],
                'type': 'TACHE_EN_RETARD',
                'message': "La tâche « Identification des points de blocage » est en retard.",
                'lue': False,
                'date_creation': dt(0, 7, 5),
            },
            {
                'destinataire': users['directeur'],
                'type': 'INSTRUCTION_RECUE',
                'message': "Une demande de réouverture de CRQ est en attente de validation.",
                'lue': True,
                'date_creation': dt(-2, 15, 0),
            },
        ]
        for spec in specs:
            try:
                Notification.objects.create(**spec)
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'  ⚠ Notification ignorée : {e}')
                )
        self.stdout.write(f'  → {len(specs)} notifications créées.')

    # --------------------------------------------------------
    # HISTORIQUE
    # --------------------------------------------------------

    def _create_historique(self, users, taches):
        specs = [
            {
                'action': 'CREATION',
                'auteur': users['chef_projets'],
                'tache': taches[1],
                'details': "Création de la tâche « Maquettes UX des 5 pages principales »",
                'date_action': dt(-10, 9, 0),
            },
            {
                'action': 'CHANGEMENT_STATUT',
                'auteur': users['membre2'],
                'tache': taches[1],
                'details': "Statut : À faire → En cours",
                'date_action': dt(-8, 11, 30),
            },
            {
                'action': 'CLOTURE',
                'auteur': users['membre'],
                'tache': taches[0],
                'details': "Tâche clôturée",
                'date_action': dt(-15, 16, 0),
            },
            {
                'action': 'SIGNALEMENT_BLOCAGE',
                'auteur': users['membre3'],
                'tache': taches[8],
                'details': "Blocage signalé : « Le service juridique n'a pas encore retourné sa validation »",
                'date_action': dt(-5, 10, 30),
            },
        ]
        for spec in specs:
            HistoriqueAction.objects.create(**spec)
        self.stdout.write(f'  → {len(specs)} actions d\'historique créées.')