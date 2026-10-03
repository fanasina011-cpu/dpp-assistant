"""
Tests du socle de productivité serveur (étape 7).

Couvre :
    - Tri serveur (`?ordering=`) et son interaction avec le RBAC.
    - Plafonnement de `page_size`.
    - Filtres de période `date_debut` / `date_fin`.
    - Recherche transversale `/recherche/` et absence de fuite.
    - KPI `/…/stats/` calculés sur l'ensemble du périmètre.
"""

from datetime import date, timedelta
import pathlib

import pytest
from django.utils import timezone

from api.models import (
    Activite,
    Blocage,
    CompteRenduQuotidien,
    HistoriqueAction,
    Instruction,
    Notification,
    StatutBlocage,
    StatutTache,
    Tache,
)


# ===========================================================================
# HELPERS
# ===========================================================================

def creer_tache(createur, responsable, titre, date_echeance=None,
                statut=StatutTache.A_FAIRE, activite=None):
    return Tache.objects.create(
        titre=titre,
        statut=statut,
        priorite='NORMALE',
        createur=createur,
        responsable=responsable,
        date_echeance=date_echeance,
        activite=activite,
    )


# ===========================================================================
# TRI SERVEUR
# ===========================================================================

@pytest.mark.django_db
class TestTriServeur:

    def test_tri_par_titre_ascendant(self, client_directeur, directeur):
        creer_tache(directeur, directeur, 'Zeta')
        creer_tache(directeur, directeur, 'Alpha')
        creer_tache(directeur, directeur, 'Mu')

        response = client_directeur.get('/api/v1/taches/?ordering=titre')

        assert response.status_code == 200
        titres = [t['titre'] for t in response.data['results']]
        assert titres == ['Alpha', 'Mu', 'Zeta']

    def test_tri_par_titre_descendant(self, client_directeur, directeur):
        creer_tache(directeur, directeur, 'Zeta')
        creer_tache(directeur, directeur, 'Alpha')

        response = client_directeur.get('/api/v1/taches/?ordering=-titre')

        titres = [t['titre'] for t in response.data['results']]
        assert titres == ['Zeta', 'Alpha']

    def test_tri_par_date_echeance_avec_nuls_en_fin(self, client_directeur, directeur):
        """Sans échéance = dernier, comme le comparateur JS (Infinity)."""
        creer_tache(directeur, directeur, 'Sans date', date_echeance=None)
        creer_tache(
            directeur, directeur, 'Tardive',
            date_echeance=timezone.now() + timedelta(days=10),
        )
        creer_tache(
            directeur, directeur, 'Proche',
            date_echeance=timezone.now() + timedelta(days=1),
        )

        response = client_directeur.get('/api/v1/taches/?ordering=date_echeance')

        titres = [t['titre'] for t in response.data['results']]
        assert titres == ['Proche', 'Tardive', 'Sans date']

    def test_tri_inconnu_repli_sans_erreur(self, client_directeur, directeur):
        """Un champ non exposé ne doit ni lever d'erreur ni fuiter."""
        creer_tache(directeur, directeur, 'Alpha')

        response = client_directeur.get('/api/v1/taches/?ordering=champ_bidon')

        assert response.status_code == 200
        assert len(response.data['results']) == 1

    def test_tri_champ_lie_non_expose(self, client_directeur, directeur, membre):
        """
        Les champs liés ne sont volontairement pas exposés (conflit DISTINCT).
        La requête doit être ignorée, pas honorée.
        """
        creer_tache(directeur, membre, 'Alpha')

        response = client_directeur.get(
            '/api/v1/taches/?ordering=responsable__last_name',
        )

        assert response.status_code == 200
        # Le tri par champ lié n'est pas appliqué : c'est le tri par défaut.
        assert len(response.data['results']) == 1

    def test_tri_ne_contourne_pas_le_rbac_membre(
        self, client_membre, membre, directeur, chef_projets,
    ):
        """
        Le tri serveur ne doit jamais élargir le périmètre : un membre ne
        voit que ses tâches, quel que soit l'ordering demandé.
        """
        creer_tache(directeur, membre, 'AAA ma tâche')
        creer_tache(chef_projets, chef_projets, 'ZZZ tâche du chef')

        for ordering in ('titre', '-titre', 'date_echeance', 'date_creation'):
            response = client_membre.get(f'/api/v1/taches/?ordering={ordering}')
            assert response.status_code == 200
            titres = [t['titre'] for t in response.data['results']]
            assert 'ZZZ tâche du chef' not in titres, f'fuite avec ordering={ordering}'
            assert 'AAA ma tâche' in titres

    def test_tri_ne_contourne_pas_le_rbac_chef_autre_service(
        self, client_chef_partenariats, chef_partenariats, chef_projets,
    ):
        """Un chef ne voit pas les tâches d'un autre service."""
        creer_tache(chef_projets, chef_projets, 'ZZZ tâche Projets')

        response = client_chef_partenariats.get(
            '/api/v1/taches/?ordering=-titre',
        )

        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_recherche_serveur(self, client_directeur, directeur):
        creer_tache(directeur, directeur, 'Rapport annuel 2026')
        creer_tache(directeur, directeur, 'Tâche annexe')

        response = client_directeur.get('/api/v1/taches/?search=rapport')

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['titre'] == 'Rapport annuel 2026'

    def test_recherche_serveur_ne_contourne_pas_le_rbac(
        self, client_membre, membre, chef_projets,
    ):
        creer_tache(chef_projets, chef_projets, 'Rapport confidentiel')

        response = client_membre.get('/api/v1/taches/?search=confidentiel')

        assert response.status_code == 200
        assert response.data['count'] == 0


# ===========================================================================
# PAGE_SIZE
# ===========================================================================

@pytest.mark.django_db
class TestPageSize:

    def test_page_size_au_dessus_du_plafond_est_plafonne(
        self, client_directeur, directeur,
    ):
        for i in range(3):
            creer_tache(directeur, directeur, f'Tâche {i}')

        response = client_directeur.get('/api/v1/taches/?page_size=500')

        assert response.status_code == 200
        # Le plafond est 200 : on ne peut pas recevoir plus de 200 éléments.
        assert len(response.data['results']) <= 200

    def test_page_size_valide_est_honore(self, client_directeur, directeur):
        for i in range(25):
            creer_tache(directeur, directeur, f'Tâche {i}')

        response = client_directeur.get('/api/v1/taches/?page_size=5')

        assert response.status_code == 200
        assert len(response.data['results']) == 5
        assert response.data['count'] == 25


# ===========================================================================
# FILTRES DE PÉRIODE
# ===========================================================================

@pytest.mark.django_db
class TestFiltresDate:

    def test_date_debut_borne_la_borne_basse(self, client_directeur, directeur):
        base = timezone.now()
        creer_tache(directeur, directeur, 'Avant', base + timedelta(days=-10))
        creer_tache(directeur, directeur, 'Milieu', base + timedelta(days=5))
        creer_tache(directeur, directeur, 'Après', base + timedelta(days=40))

        response = client_directeur.get(
            f'/api/v1/taches/?date_debut={(base + timedelta(days=1)).date()}',
        )

        titres = sorted(t['titre'] for t in response.data['results'])
        assert titres == ['Après', 'Milieu']

    def test_date_fin_inclusif_sur_la_journee_entiere(
        self, client_directeur, directeur,
    ):
        """
        Régression du piège minuit : `date_fin` est un DateTimeField, donc
        un `__lte` naïf exclurait une tâche planifiée en fin de journée.
        """
        base = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        creer_tache(
            directeur, directeur, 'Fin de journée',
            base + timedelta(hours=18),
        )
        creer_tache(
            directeur, directeur, 'Lendemain',
            base + timedelta(days=1, hours=9),
        )

        response = client_directeur.get(
            f'/api/v1/taches/?date_fin={base.date()}',
        )

        titres = [t['titre'] for t in response.data['results']]
        assert titres == ['Fin de journée']

    def test_bornes_inversees_retournent_vide(self, client_directeur, directeur):
        base = timezone.now()
        creer_tache(directeur, directeur, 'Milieu', base)

        response = client_directeur.get(
            f'/api/v1/taches/'
            f'?date_debut={(base + timedelta(days=10)).date()}'
            f'&date_fin={(base - timedelta(days=10)).date()}',
        )

        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_date_invalide_ignoree_sans_erreur(self, client_directeur, directeur):
        creer_tache(directeur, directeur, 'Alpha')

        response = client_directeur.get('/api/v1/taches/?date_debut=pas-une-date')

        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_filtre_sans_date(self, client_directeur, directeur):
        """
        `?sans_date=true` ne renvoie que les tâches sans échéance.

        Vérifie aussi `count` : sans filtre serveur, `count` et la pagination
        couvriraient tout le périmètre alors que la page n'afficherait que les
        tâches sans date — l'incohérence que ce paramètre supprime.
        """
        creer_tache(
            directeur, directeur, 'Avec échéance',
            timezone.now() + timedelta(days=5),
        )
        creer_tache(directeur, directeur, 'Sans échéance')

        response = client_directeur.get('/api/v1/taches/?sans_date=true')

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert [t['titre'] for t in response.data['results']] == ['Sans échéance']

    def test_sans_date_et_borne_de_periode_sont_mutuellement_exclusives(
        self, client_directeur, directeur,
    ):
        """
        `date_fin` exclut les NULL, `sans_date` les sélectionne : les deux
        combinés ne doivent rien renvoyer plutôt que de retomber sur l'un.
        """
        creer_tache(directeur, directeur, 'Avec échéance', timezone.now())
        creer_tache(directeur, directeur, 'Sans échéance')

        response = client_directeur.get(
            f'/api/v1/taches/?sans_date=true&date_fin={timezone.now().date()}',
        )

        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_sans_date_absent_ignore_le_parametre(
        self, client_directeur, directeur,
    ):
        """Un `sans_date` mal formé est ignoré, pas interprété comme un filtre."""
        creer_tache(directeur, directeur, 'Avec échéance', timezone.now())
        creer_tache(directeur, directeur, 'Sans échéance')

        response = client_directeur.get('/api/v1/taches/?sans_date=oui')

        assert response.status_code == 200
        assert response.data['count'] == 2

    def test_periode_ne_contourne_pas_le_rbac(
        self, client_membre, membre, chef_projets,
    ):
        creer_tache(chef_projets, chef_projets, 'ZZZ', timezone.now())

        response = client_membre.get(
            '/api/v1/taches/?date_debut=2000-01-01&date_fin=2099-12-31',
        )

        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_periode_sur_datefield_crq(self, client_directeur, directeur):
        """CRQ : `date_journaliere` est un DateField, pas un DateTimeField."""
        CompteRenduQuotidien.objects.create(
            redacteur=directeur,
            date_journaliere=date(2026, 1, 15),
            activites_realisees='Janvier',
        )
        CompteRenduQuotidien.objects.create(
            redacteur=directeur,
            date_journaliere=date(2026, 3, 20),
            activites_realisees='Mars',
        )

        response = client_directeur.get(
            '/api/v1/comptes-rendus/?date_debut=2026-01-01&date_fin=2026-01-31',
        )

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['activites_realisees'] == 'Janvier'


# ===========================================================================
# RECHERCHE TRANSVERSALE
# ===========================================================================

@pytest.mark.django_db
class TestRechercheTransversale:

    def test_terme_trop_court_ignore(self, client_directeur, directeur):
        creer_tache(directeur, directeur, 'Rapport')

        response = client_directeur.get('/api/v1/recherche/?q=a')

        assert response.status_code == 200
        assert response.data['total'] == 0
        assert response.data['resultats'] == {}

    def test_terme_absent_ignore(self, client_directeur):
        response = client_directeur.get('/api/v1/recherche/')

        assert response.status_code == 200
        assert response.data['total'] == 0

    def test_recherche_trouve_et_regroupe(self, client_directeur, directeur):
        creer_tache(directeur, directeur, 'Rapport annuel')
        Instruction.objects.create(
            titre='Note sur le rapport',
            description='Contenu',
            emetteur=directeur,
        )

        response = client_directeur.get('/api/v1/recherche/?q=rapport')

        assert response.status_code == 200
        assert response.data['q'] == 'rapport'
        assert 'taches' in response.data['resultats']
        assert 'instructions' in response.data['resultats']
        assert response.data['resultats']['taches']['total'] == 1
        item = response.data['resultats']['taches']['items'][0]
        assert item['libelle'] == 'Rapport annuel'
        assert item['type'] == 'taches'

    def test_items_plafonnes_mais_total_complet(
        self, client_directeur, directeur,
    ):
        for i in range(8):
            creer_tache(directeur, directeur, f'Rapport {i}')

        response = client_directeur.get('/api/v1/recherche/?q=rapport')

        assert response.data['resultats']['taches']['total'] == 8
        assert len(response.data['resultats']['taches']['items']) == 5

    def test_recherche_ne_fuit_pas_les_taches_dautrui(
        self, client_membre, membre, chef_projets,
    ):
        creer_tache(chef_projets, chef_projets, 'Rapport confidentiel')

        response = client_membre.get('/api/v1/recherche/?q=confidentiel')

        assert response.status_code == 200
        assert response.data['total'] == 0
        assert 'taches' not in response.data['resultats']

    def test_recherche_trouve_la_propre_tache(self, client_membre, membre):
        creer_tache(membre, membre, 'Mon rapport')

        response = client_membre.get('/api/v1/recherche/?q=rapport')

        assert response.data['total'] == 1
        assert 'taches' in response.data['resultats']

    def test_recherche_ne_fuit_pas_les_blocages_dautrui(
        self, client_membre, membre, chef_projets,
    ):
        tache = creer_tache(chef_projets, chef_projets, 'Tâche du chef')
        Blocage.objects.create(
            description='Blocage secret du chef',
            niveau_urgence='HAUTE',
            tache=tache,
            signale_par=chef_projets,
        )

        response = client_membre.get('/api/v1/recherche/?q=secret')

        assert response.status_code == 200
        assert 'blocages' not in response.data['resultats']

    def test_recherche_types_restreints(self, client_directeur, directeur):
        creer_tache(directeur, directeur, 'Rapport annuel')
        Instruction.objects.create(
            titre='Note rapport', description='x', emetteur=directeur,
        )

        response = client_directeur.get(
            '/api/v1/recherche/?q=rapport&types=instructions',
        )

        assert 'instructions' in response.data['resultats']
        assert 'taches' not in response.data['resultats']

    def test_recherche_exige_authentification(self, api_client):
        response = api_client.get('/api/v1/recherche/?q=rapport')

        assert response.status_code == 401


# ===========================================================================
# KPI SERVEUR
# ===========================================================================

@pytest.mark.django_db
class TestKpiStats:

    def test_kpi_taches_portent_sur_l_ensemble_pas_sur_la_page(
        self, client_directeur, directeur,
    ):
        for i in range(25):
            creer_tache(
                directeur, directeur, f'Tâche {i}',
                statut=StatutTache.EN_COURS if i < 7 else StatutTache.A_FAIRE,
            )

        # Page volontairement réduite à 1 élément.
        listing = client_directeur.get('/api/v1/taches/?page_size=1')
        assert len(listing.data['results']) == 1

        response = client_directeur.get('/api/v1/taches/stats/')

        assert response.status_code == 200
        assert response.data['total'] == 25
        assert response.data['en_cours'] == 7
        assert response.data['par_statut']['EN_COURS'] == 7
        assert response.data['par_statut']['A_FAIRE'] == 18

    def test_kpi_taches_respecte_le_rbac(self, client_membre, membre, chef_projets):
        creer_tache(membre, membre, 'Ma tâche')
        creer_tache(chef_projets, chef_projets, 'Tâche du chef')

        response = client_membre.get('/api/v1/taches/stats/')

        assert response.status_code == 200
        assert response.data['total'] == 1

    def test_kpi_taches_reflete_le_filtre_actif(self, client_directeur, directeur):
        creer_tache(directeur, directeur, 'En cours', statut=StatutTache.EN_COURS)
        creer_tache(directeur, directeur, 'À faire', statut=StatutTache.A_FAIRE)

        response = client_directeur.get('/api/v1/taches/stats/?statut=EN_COURS')

        assert response.data['total'] == 1
        assert response.data['en_cours'] == 1

    def test_kpi_taches_en_retard(self, client_directeur, directeur):
        creer_tache(
            directeur, directeur, 'En retard',
            date_echeance=timezone.now() - timedelta(days=1),
        )
        creer_tache(
            directeur, directeur, 'À venir',
            date_echeance=timezone.now() + timedelta(days=5),
        )

        response = client_directeur.get('/api/v1/taches/stats/')

        assert response.data['en_retard'] == 1

    def test_kpi_activites_cloturables(self, client_directeur, directeur):
        activite_finie = Activite.objects.create(
            titre='Activité terminée', statut='EN_COURS',
            priorite='NORMALE', createur=directeur, responsable=directeur,
        )
        activite_bloquee = Activite.objects.create(
            titre='Activité bloquée', statut='EN_COURS',
            priorite='NORMALE', createur=directeur, responsable=directeur,
        )
        creer_tache(
            directeur, directeur, 'Terminée',
            statut=StatutTache.TERMINEE, activite=activite_finie,
        )
        creer_tache(
            directeur, directeur, 'Pas terminée',
            statut=StatutTache.EN_COURS,  # bloque la clôture
            activite=activite_bloquee,
        )

        response = client_directeur.get('/api/v1/activites/stats/')

        assert response.data['total'] == 2
        # `cloturables` exclut l'activité dont une tâche n'est pas terminale.
        assert response.data['cloturables'] == 1

    def test_kpi_blocages_escalade_et_contestation(self, client_directeur, directeur):
        tache = creer_tache(directeur, directeur, 'Tâche bloquée')

        ancien = Blocage.objects.create(
            description='Ancien', niveau_urgence='CRITIQUE',
            statut=StatutBlocage.EN_ATTENTE, tache=tache, signale_par=directeur,
        )
        # Déripe le délai d'escalade pour simuler un blocage qui dépasse.
        Blocage.objects.filter(pk=ancien.pk).update(
            date_limite_action=timezone.now() - timedelta(hours=1),
        )

        Blocage.objects.create(
            description='Contesté', niveau_urgence='MOYENNE',
            statut=StatutBlocage.CONTESTE, tache=tache, signale_par=directeur,
        )
        Blocage.objects.create(
            description='Résolu', niveau_urgence='BASSE',
            statut=StatutBlocage.RESOLU, tache=tache, signale_par=directeur,
        )

        response = client_directeur.get('/api/v1/blocages/stats/')

        assert response.data['total'] == 3
        assert response.data['non_resolus'] == 2
        assert response.data['critiques'] == 1
        assert response.data['en_attente_escalade'] == 1
        assert response.data['contestes'] == 1

    def test_kpi_notifications_non_lues(self, client_directeur, directeur):
        Notification.objects.create(
            destinataire=directeur, type='SYSTEME', message='Lue',
        )
        Notification.objects.create(
            destinataire=directeur, type='SYSTEME', message='Non lue 1',
        )
        Notification.objects.create(
            destinataire=directeur, type='SYSTEME', message='Non lue 2',
        )

        response = client_directeur.get('/api/v1/notifications/stats/')

        assert response.data['total'] == 3
        assert response.data['non_lues'] == 3

    def test_kpi_utilisateurs_exclut_les_inactifs(
        self, client_directeur, directeur, utilisateur_inactif,
    ):
        response = client_directeur.get('/api/v1/utilisateurs/stats/')

        assert response.status_code == 200
        assert response.data['total'] == 1
        assert 'inactifs' not in response.data

    def test_kpi_historique_compte_les_actions_systeme(
        self, client_directeur, directeur,
    ):
        HistoriqueAction.objects.create(
            auteur=directeur, action='TACHE_CREEE', details='x',
        )
        HistoriqueAction.objects.create(
            auteur=None, action='ESCALADE_BLOCAGE', details='auto',
        )

        response = client_directeur.get('/api/v1/historique/stats/')

        assert response.status_code == 200
        assert response.data['total'] == 2
        assert response.data['systeme'] == 1


# ===========================================================================
# FILTRES PROMOUVÉS DEPUIS LE CLIENT (points 3 et 5)
# ===========================================================================
#
# Ces filtres étaient appliqués côté page sur un jeu de lignes DÉJÀ paginé :
# au-delà d'une page, `count` incluait des lignes que la liste n'affichait
# pas. Ils sont désormais calculés par le serveur.


@pytest.mark.django_db
class TestFiltreBlocageEnAttenteEscalade:

    @staticmethod
    def _trois_blocages(directeur):
        """
        3 blocages couvrant les 3 issues du prédicat :
            - EN_ATTENTE au-delà du délai  -> à escalader (sélectionné)
            - EN_TRAITEMENT dans les temps -> pas encore escaladé
            - RESOLU au-delà du délai      -> hors du prédicat (statut)
        """
        tache = creer_tache(directeur, directeur, 'Tâche bloquée')

        depasse = Blocage.objects.create(
            description='Délai dépassé', niveau_urgence='MOYENNE',
            statut=StatutBlocage.EN_ATTENTE, tache=tache, signale_par=directeur,
        )
        Blocage.objects.filter(pk=depasse.pk).update(
            date_limite_action=timezone.now() - timedelta(hours=1),
        )

        dans_les_temps = Blocage.objects.create(
            description='Dans les temps', niveau_urgence='MOYENNE',
            statut=StatutBlocage.EN_TRAITEMENT, tache=tache,
            signale_par=directeur,
        )
        Blocage.objects.filter(pk=dans_les_temps.pk).update(
            date_limite_action=timezone.now() + timedelta(days=2),
        )

        resolu = Blocage.objects.create(
            description='Résolu', niveau_urgence='MOYENNE',
            statut=StatutBlocage.RESOLU, tache=tache, signale_par=directeur,
        )
        Blocage.objects.filter(pk=resolu.pk).update(
            date_limite_action=timezone.now() - timedelta(days=3),
        )

    def test_filtre_en_attente_escalade(self, client_directeur, directeur):
        self._trois_blocages(directeur)

        response = client_directeur.get(
            '/api/v1/blocages/?en_attente_escalade=true',
        )

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['description'] == 'Délai dépassé'

    def test_filtre_escalade_et_kpi_partagent_le_meme_predicat(
        self, client_directeur, directeur,
    ):
        """
        Le compteur affiché doit reposer sur le même prédicat que la liste,
        sinon il ne correspond pas aux lignes affichées.
        """
        self._trois_blocages(directeur)

        liste = client_directeur.get('/api/v1/blocages/?en_attente_escalade=true')
        kpi = client_directeur.get(
            '/api/v1/blocages/stats/?en_attente_escalade=true',
        )

        assert liste.data['count'] == kpi.data['total'] == 1
        assert kpi.data['en_attente_escalade'] == 1

    def test_param_absent_ne_filtre_pas(self, client_directeur, directeur):
        self._trois_blocages(directeur)

        response = client_directeur.get('/api/v1/blocages/')

        assert response.data['count'] == 3

    def test_param_non_reconnu_ignore(self, client_directeur, directeur):
        self._trois_blocages(directeur)

        response = client_directeur.get(
            '/api/v1/blocages/?en_attente_escalade=oui',
        )

        assert response.data['count'] == 3


@pytest.mark.django_db
class TestFiltreUtilisateurRoleEtStatut:

    def test_filtre_role(self, client_directeur, directeur, chef_projets, membre):
        response = client_directeur.get(
            '/api/v1/utilisateurs/?role=CHEF_SERVICE_PROJETS',
        )

        assert response.status_code == 200
        assert [u['username'] for u in response.data['results']] == [
            chef_projets.username,
        ]

    def test_filtre_role_exclut_les_autres(
        self, client_directeur, directeur, chef_projets, membre,
    ):
        """Un membre d'équipe ne doit pas apparaître sous le filtre du chef."""
        response = client_directeur.get(
            '/api/v1/utilisateurs/?role=MEMBRE_EQUIPE_APPUI',
        )

        usernames = [u['username'] for u in response.data['results']]
        assert membre.username in usernames
        assert chef_projets.username not in usernames

    def test_role_survient_au_branchement_rbac(
        self, client_chef_projets, chef_projets, membre, directeur,
    ):
        """
        Les filtres utilisateur sont appliqués AVANT le branchement RBAC :
        un chef doit donc voir les siens filtres, pas retomber sur tout son
        service.
        """
        response = client_chef_projets.get(
            '/api/v1/utilisateurs/?role=MEMBRE_EQUIPE_APPUI',
        )

        assert response.status_code == 200
        assert [u['username'] for u in response.data['results']] == [
            membre.username,
        ]

    def test_statut_inactif_ne_renvoie_rien(self, client_directeur):
        """`get_queryset` exclut les inactifs : le filtre est explicite."""
        response = client_directeur.get('/api/v1/utilisateurs/?statut=inactif')

        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_statut_inconnu_ignore(self, client_directeur, directeur):
        response = client_directeur.get('/api/v1/utilisateurs/?statut=bizarre')

        assert response.status_code == 200
        assert response.data['count'] >= 1


@pytest.mark.django_db
class TestFiltreHistoriquePromu:

    @staticmethod
    def _historique(directeur):
        tache = creer_tache(directeur, directeur, 'Tâche suivie')
        autre = creer_tache(directeur, directeur, 'Autre tâche')

        return [
            HistoriqueAction.objects.create(
                auteur=directeur, action='TACHE_CREEE',
                cible_type='TACHE', cible_id=tache.id,
            ),
            HistoriqueAction.objects.create(
                auteur=directeur, action='TACHE_MODIFIEE',
                cible_type='TACHE', cible_id=autre.id,
            ),
            HistoriqueAction.objects.create(
                auteur=directeur, action='INSTRUCTION_EMISE',
                cible_type='INSTRUCTION', cible_id=7,
            ),
        ]

    def test_cible_type(self, client_directeur, directeur):
        self._historique(directeur)

        response = client_directeur.get('/api/v1/historique/?cible_type=TACHE')

        assert response.status_code == 200
        assert response.data['count'] == 2

    def test_cible_id(self, client_directeur, directeur):
        suivi, _, _ = self._historique(directeur)

        response = client_directeur.get(
            f'/api/v1/historique/?cible_id={suivi.cible_id}',
        )

        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_cible_id_non_numerique_ignore(self, client_directeur, directeur):
        self._historique(directeur)

        response = client_directeur.get(
            '/api/v1/historique/?cible_id=abc',
        )

        assert response.status_code == 200
        assert response.data['count'] == 3

    def test_periode_sur_date_action(self, client_directeur, directeur):
        for action in self._historique(directeur):
            HistoriqueAction.objects.filter(pk=action.pk).update(
                date_action=timezone.now() - timedelta(days=400),
            )
        HistoriqueAction.objects.create(
            auteur=directeur, action='TACHE_SUPPRIMEE', details='récente',
        )

        response = client_directeur.get(
            f'/api/v1/historique/'
            f'?date_debut={(timezone.now() - timedelta(days=30)).date()}',
        )

        assert response.status_code == 200
        titres = sorted(a['action'] for a in response.data['results'])
        assert titres == ['TACHE_SUPPRIMEE']


# ===========================================================================
# CATÉGORIE D'ACTION (cascade identique à `categoriserAction`)
# ===========================================================================

@pytest.mark.django_db
class TestFiltreCategorieAction:

    @staticmethod
    def _actions(directeur):
        """
        Actions réelles du codebase, une par catégorie, plus deux cas à part.

        `DELEGATION_CREEE` est délibérément dans le lot : la cascade le classe
        en CREATION (il contient `CREEE`), pas en DELEGATION. C'est le
        comportement du frontend depuis toujours, reproduit ici tel quel.
        """
        valeurs = [
            'TACHE_CREEE',
            'TACHE_MODIFIEE',
            'TACHE_STATUT_CHANGE',
            'TACHE_REASSIGNEE',
            'ECHEANCE_REPORTEE',
            'ANNULATION_MOTIVEE',
            'ACTIVITE_CLOTUREE',
            'TACHE_SUPPRIMEE',
            'DELEGATION_CREEE',
            'DELEGATION_REVOQUEE',
            'INSTRUCTION_EMISE',
        ]
        for valeur in valeurs:
            HistoriqueAction.objects.create(
                auteur=directeur, action=valeur, details=valeur,
            )

    @pytest.mark.parametrize('categorie,attendu', [
        ('CREATION', ['DELEGATION_CREEE', 'TACHE_CREEE']),
        ('STATUT', ['TACHE_STATUT_CHANGE']),
        ('SUPPRESSION', ['TACHE_SUPPRIMEE']),
    ])
    def test_categories_representatives(
        self, client_directeur, directeur, categorie, attendu,
    ):
        """3 valeurs représentatives, pas les 9 : le pin de sync est exhaustif."""
        self._actions(directeur)

        response = client_directeur.get(
            f'/api/v1/historique/?categorie={categorie}',
        )

        assert response.status_code == 200
        assert sorted(a['action'] for a in response.data['results']) == attendu

    def test_premier_motif_gagnant_est_exclusif(
        self, client_directeur, directeur,
    ):
        """
        Régression du piège de la cascade : `DELEGATION_CREEE` contient
        `CREEE`, donc CREATION gagne et DELEGATION ne doit pas la
        récupérer. Un simple OR de motifs la ferait apparaître dans les deux.
        """
        self._actions(directeur)

        creation = client_directeur.get('/api/v1/historique/?categorie=CREATION')
        delegation = client_directeur.get(
            '/api/v1/historique/?categorie=DELEGATION',
        )

        assert 'DELEGATION_CREEE' in [a['action'] for a in creation.data['results']]
        assert [a['action'] for a in delegation.data['results']] == [
            'DELEGATION_REVOQUEE',
        ]

    def test_categorie_inconnue_ne_renvoie_tout(self, client_directeur, directeur):
        """Une catégorie hors nomenclature ne doit pas se comporter comme un vide."""
        self._actions(directeur)

        response = client_directeur.get('/api/v1/historique/?categorie=XXX')

        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_categorie_ne_contourne_pas_le_rbac(
        self, client_membre, membre, chef_projets,
    ):
        HistoriqueAction.objects.create(
            auteur=chef_projets, action='TACHE_CREEE', details='autre service',
        )

        response = client_membre.get('/api/v1/historique/?categorie=CREATION')

        assert response.status_code == 200
        assert response.data['count'] == 0


def test_categories_action_synchronisees():
    """
    PIN DE SYNCHRONISATION FRONTEND / BACKEND.

    `CATEGORIES_ACTION` (backend, utilisé pour FILTRER) doit reproduire
    exactement la cascade de `categoriserAction()` (frontend, utilisé pour
    AFFICHER la couleur du badge).

    Si ce test échoue après une modification de `Historique.tsx`, ce n'est pas
    le test qu'il faut corriger : c'est `CATEGORIES_ACTION` dans
    `backend/api/views.py` qu'il faut mettre à jour.
    """
    from api.views import CATEGORIES_ACTION

    frontend = pathlib.Path(__file__).resolve().parents[4] / (
        'frontend/src/pages/Historique.tsx'
    )
    source = frontend.read_text(encoding='utf-8')

    # Bloc `categoriserAction` extrait de la source frontend.
    corps = source.split('function categoriserAction')[1].split('\n}')[0]

    for categorie, motifs in CATEGORIES_ACTION:
        # Chaque motif doit apparaître comme test `includes(...)` côté UI.
        for motif in motifs:
            assert f"includes('{motif}')" in corps, (
                f'{categorie} : le motif {motif!r} n\'est plus testé côté '
                f'frontend, CATEGORIES_ACTION est probablement obsolète.'
            )
        # Et la catégorie doit être bien celle que le frontend renvoie.
        assert f"return '{categorie}'" in corps, (
            f'{categorie} : la catégorie n\'est plus renvoyée côté frontend.'
        )