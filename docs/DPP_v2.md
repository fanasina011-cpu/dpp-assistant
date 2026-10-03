Objectif : produire la version 2.0 du document qui reflète exactement ce qui a été construit, pas ce qui était prévu.

Principe : on ne réécrit pas tout. On documente les écarts par rapport à la V1, les ajouts, et les reportés en V2. C'est ce qui a le plus de valeur pour un futur développeur.

Livrable : un fichier markdown complet, structuré, que vous pourrez mettre dans docs/DPP_v2.md.

DPP Assistant — Spécification technique V2.0
Version : 2.0 (état de l'art construit)
Date : 22 septembre 2026
Basée sur : DPP_v1.docx + DPP_deepSeek_V5.docx (spécifications initiales)
Écart principal : ce document décrit l'application telle qu'elle a été implémentée, pas telle qu'elle avait été imaginée.

1. Préambule — Pourquoi une V2
Le document de spécification initial (DPP_v1.docx et sa version consolidée DPP_deepSeek_V5.docx) décrivait une application cible. Il a servi de référence pour le développement.

Pendant la construction, plusieurs ajustements ont été faits :

Contraintes techniques ont imposé des choix (voir §3).

Certaines règles métier ont été reportées en V2 (voir §11).

Certaines règles métier ont été implémentées et méritent d'être documentées précisément (voir §6).

De nouveaux endpoints ont été ajoutés pour répondre à des besoins concrets (voir §8).

Le frontend a été construit avec des choix d'UX qui n'étaient pas dans le document initial (voir §5).

Ce document remplace les deux précédents pour toute question d'implémentation.

2. Contexte et objectifs
Contexte : la Direction des Projets et Partenariats (DPP) coordonne de nombreuses activités impliquant plusieurs responsables et collaborateurs. Le suivi manuel des tâches, de l'agenda, des instructions et des blocages est difficile.

Objectif de l'application : fournir une application web de coordination interne permettant de gérer :

Les agendas (Directeur et personnels),

Les activités (regroupement de tâches),

Les tâches (avec priorités, échéances, statuts),

Les instructions (mono- ou multi-destinataires),

Les blocages (signalement, traitement, résolution),

Les comptes-rendus quotidiens (CRQ),

Les synthèses,

Les délégations temporaires de rôle.

3. Stack technique
3.1 Stack effective
Élément	Version	Note
OS	Windows 10	Développement
Python	3.14.5	Compatible Django 5.2 LTS
Django	5.2.17 LTS	Pas 6.x — voir §3.3
Django REST Framework	3.18.1	
Simple JWT	5.5.1	Auth JWT
Base de données	MySQL 8.0.46	Pas MariaDB de XAMPP
Port MySQL	3307	Pas 3306 (conflit avec XAMPP)
Node.js	24.19.0	
Vite	8.3.0	Build tool frontend
React	18 + TypeScript	
Tailwind CSS	4	Via @tailwindcss/vite
TanStack Query	5.x	Cache et requêtes API
Axios	1.x	Client HTTP
React Router	v6	Routage
3.2 Arborescence du projet
text
dpp-assistant/
├── backend/                          # Django
│   ├── manage.py
│   ├── .env                          # Variables d'environnement
│   ├── core/                         # Configuration
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── ...
│   └── api/
│       ├── models.py                 # 15 modèles + 12 enums
│       ├── admin.py                  # 15 admins
│       ├── serializers.py            # 18 serializers
│       ├── permissions.py            # RBAC
│       ├── services.py               # Fonctions transversales
│       ├── views.py                  # 14 ViewSets + DashboardView
│       ├── views_auth.py             # Login, Me, Logout
│       ├── urls.py                   # Router DRF
│       ├── migrations/               # 10 migrations
│       └── management/commands/      # 5 jobs CRON
│
└── frontend/                         # React + Vite
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── api/                      # Services API par domaine
        ├── components/               # Composants réutilisables
        ├── context/                  # AuthContext
        ├── pages/                    # Pages (10 fonctionnelles)
        ├── routes/                   # ProtectedRoute
        ├── types/                    # Types TypeScript
        └── utils/                    # Utilitaires (calendrier, dates)
3.3 Contraintes techniques majeures
Django 5.2 LTS au lieu de 6.x :

Les versions Django 6.0 et 6.1 exigent MariaDB 10.6+ (pour 6.0) ou 10.11+ (pour 6.1). L'environnement initial (XAMPP) fournissait MariaDB 10.4.32.

Décision : installer MySQL 8.0.46 sur le port 3307 (pour ne pas entrer en conflit avec XAMPP sur 3306) et rester sur Django 5.2 LTS.

Impact : le port MySQL par défaut est 3307 dans tous les fichiers de configuration (.env, doc de déploiement).

USE_TZ = False :

Le fuseau unique de l'application est Indian/Antananarivo. Pour éviter les problèmes de timezone MySQL sous Windows, on utilise USE_TZ = False.

Conséquence pour les développeurs :

Utiliser date.today() (module datetime) au lieu de timezone.localdate().

timezone.now() reste utilisable et retourne un datetime naïf.

4. Architecture backend
4.1 Modèles (15)
Modèle	Rôle principal
Utilisateur	Utilisateur de l'app (hérite de AbstractUser + role, service, superieur_proche)
Evenement	Événement d'agenda (avec participants)
Activite	Regroupement de tâches autour d'un objectif
Tache	Tâche opérationnelle
Instruction	Instruction émise par le Directeur / un Chef
InstructionDestinataire	Destinataire d'une instruction avec son statut propre
Blocage	Blocage sur une tâche
Delegation	Délégation temporaire de rôle
CompteRenduQuotidien	CRQ
DemandeReouvertureCRQ	Demande de réouverture d'un CRQ
Commentaire	Commentaire sur tâche / instruction / activité
Notification	Notification utilisateur
Synthese	Synthèse d'activité
PieceJointe	Fichier attaché (métadonnées)
HistoriqueAction	Traçabilité des actions critiques
4.2 Enums (12)
Enum	Valeurs
RoleChoice	DIRECTEUR, SECRETAIRE_DIRECTION, CHEF_SERVICE_PROJETS, CHEF_SERVICE_PARTENARIATS, CONSEILLERE_TECHNIQUE, MEMBRE_EQUIPE_APPUI
Priorite	BASSE, NORMALE, HAUTE, URGENTE
NiveauPriorite	DIRECTION, PERSONNEL
StatutTache	A_FAIRE, EN_COURS, EN_ATTENTE, BLOQUEE, TERMINEE, ANNULEE
StatutActivite	OUVERTE, EN_COURS, CLOTUREE, ANNULEE
StatutInstruction	A_FAIRE, EN_COURS, TERMINEE, ANNULEE
StatutBlocage	EN_ATTENTE, EN_TRAITEMENT, REMONTE_AU_DIRECTEUR, RESOLU
UrgenceBlocage	BASSE, MOYENNE, HAUTE, CRITIQUE
StatutEvenement	PLANIFIE, REALISE, ANNULE
TypeEvenement	REUNION, RENDEZ_VOUS, AUDIENCE, DEPLACEMENT, RAPPEL, ECHEANCE, AUTRE
TypeSynthese	QUOTIDIENNE, HEBDOMADAIRE, MENSUELLE
StatutDemandeReouverture	EN_ATTENTE, VALIDEE, REFUSEE
4.3 Conventions
Nommage Django :

Concept document	Nom Django
nom	last_name
prenom	first_name
motDePasse	password
actif	is_active
dateCreation	date_joined (Utilisateur) ou date_creation (autres)
FK createurId	createur (ForeignKey)
FK forcées par le serveur :

Les FK suivantes sont toujours remplies par le serveur à partir de l'utilisateur connecté. Elles sont en read_only dans les serializers et forcées dans perform_create :

Evenement.createur

Activite.createur

Tache.createur

Instruction.emetteur

Blocage.signale_par

Delegation.delegant

Commentaire.auteur

PieceJointe.uploade_par

Synthese.genere_par

Récursion des serializers :

Pour éviter les boucles infinies sur les relations bidirectionnelles (Tache ↔ Instruction, CRQ ↔ DemandeReouverture), on a créé des serializers shallow :

TacheShallowSerializer

InstructionShallowSerializer

DemandeReouvertureCRQShallowSerializer

Règle : quand une entité A référence B, et que B référence A, une seule direction inclut le détail complet de l'autre. L'autre direction utilise le shallow.

4.4 Permissions (RBAC)
Approche hybride :

Fonctions utilitaires dans permissions.py :

est_directeur(user)

est_chef_de_service(user)

est_secretaire(user)

est_conseillere(user)

est_chef_ou_directeur(user)

est_membre_equipe(user)

Permissions composables (petites classes réutilisables) :

EstDirecteur

EstChefDeService

EstDirecteurOuChefDeService

Permissions par modèle (pour les règles complexes) :

TachePermission

ActivitePermission

BlocagePermission

EvenementPermission

DelegationPermission

CommentairePermission

CRQPermission

SynthesePermission

InstructionPermission

Chaque ViewSet combine : permission_classes = [IsAuthenticated, XxxPermission].

5. Architecture frontend
5.1 Pages fonctionnelles
Route	Composant	Fonctionnalités
/login	Login	Formulaire d'authentification
/	Dashboard	KPIs + widgets (tâches, agenda, blocages, notifications)
/taches	Taches	Liste + filtres + création
/taches/:id	TacheDetail	Détail + changement statut + suppression + signaler blocage
/activites	Activites	Liste + filtres + création
/activites/:id	ActiviteDetail	Détail + clôture + suppression
/blocages	Blocages	Liste + filtres + signalement
/blocages/:id	BlocageDetail	Détail + résoudre + remonter
/instructions	Instructions	Liste + filtres + émission
/instructions/:id	InstructionDetail	Détail + destinataires + changement statut
/delegations	Delegations	Liste + filtres + création + révocation en ligne
/notifications	Notifications	Liste + filtres + marquer comme lue
/crq	CRQ	Liste + filtres + création
/crq/:id	CRQDetail	Détail + modification + demande réouverture + validation
/syntheses	Syntheses	Liste + filtres + génération
/syntheses/:id	SyntheseDetail	Affichage du contenu + suppression
/agenda	Agenda	Vue mensuelle + vue jour + création + détail
Total : 10 pages principales + 6 pages détail.

5.2 Composants réutilisables
Layout (sidebar + header)

Sidebar (navigation adaptée au rôle)

Header (nom utilisateur + logout)

StatutBadge (couleurs selon statut)

PrioriteBadge (couleurs selon priorité)

KpiCard (carte de statistique)

Modales par domaine : TacheFormModal, ActiviteFormModal, BlocageFormModal, InstructionFormModal, DelegationFormModal, CRQFormModal, SyntheseFormModal, EvenementFormModal, EvenementDetailModal

5.3 Communication API
Instance Axios unique (api/client.ts) avec :

URL de base http://127.0.0.1:8000/api/v1

Intercepteur de requête : ajoute le JWT

Intercepteur de réponse : refresh automatique en cas de 401

Un fichier de service par domaine (api/taches.ts, api/activites.ts, etc.)

TanStack Query pour le cache et les mutations.

5.4 Authentification
Tokens JWT stockés dans localStorage.

AuthContext expose user, isLoading, isAuthenticated, login, logout.

ProtectedRoute redirige vers /login si non authentifié.

Refresh automatique : si une requête retourne 401, l'intercepteur tente de renouveler le token. Si échec, redirection vers /login.

5.5 Choix UX notables
Filtres côté backend : les filtres sont passés en query params, calculés côté serveur. Le frontend ne filtre jamais localement les listes volumineuses.

Recherche sur 200 utilisateurs dans les sélecteurs (limite provisoire).

Agenda : vue mensuelle + vue jour uniquement. Pas de vue hebdomadaire (reportée en V2).

Événements : modification non implémentée — on supprime et on recrée.

Récurrence d'événements : reportée en V2.

6. Règles métier implémentées
6.1 Gestion de l'agenda
Directeur et Secrétaire ont les droits d'écriture sur l'agenda du Directeur.

Les collaborateurs voient les événements auxquels ils sont conviés.

Conflit d'agenda : autorisé pour le Directeur, avec avertissement visuel.

Priorité Direction : un événement DIRECTION prime sur un événement PERSONNEL.

Propagation automatique : un événement avec participants est injecté dans l'agenda de chaque participant.

6.2 Gestion des tâches
Tout collaborateur authentifié peut créer une tâche.

Modification / suppression : seul le créateur (sauf Directeur).

Changement de statut : responsable, créateur, Chef du responsable, Directeur.

Retard : indicateur calculé (est_en_retard), non stocké.

Réattribution : tracée dans HistoriqueAction.

6.3 Gestion des instructions
Émission :

Directeur : à n'importe qui.

Secrétaire : saisie pour le compte du Directeur.

Chef de service : uniquement vers son équipe.

Multi-destinataires : chaque destinataire a son propre statut (via InstructionDestinataire).

Ciblage : tâche OU activité OU rien (mutuellement exclusifs).

Statut global : passe à TERMINEE quand tous les destinataires ont terminé (via maj_statut_global()).

6.4 Gestion des blocages
Signalement → tâche passe en BLOQUEE.

Résolution → tâche repasse en EN_COURS, date_resolution et resolu_par renseignés.

Remontée au Directeur : statut REMONTE_AU_DIRECTEUR.

Contestation sous 48 h : reportée en V2.

6.5 Comptes-rendus quotidiens (CRQ)
Clôture automatique à 23h59 via job CRON.

Contrôle serveur : modification refusée si la date du CRQ est strictement antérieure à aujourd'hui.

Réouverture exceptionnelle : demande motivée validée par Chef ou Directeur.

6.6 Délégations
Créées par Directeur ou Chef de service.

Le délégataire bénéficie du rôle délégué pendant la période.

Le délégataire ne peut pas sous-déléguer.

Révocable à tout moment.

Validation : delegant ≠ delegataire (contrôle fait dans perform_create).

6.7 Retards automatiques
Job CRON marquer_taches_en_retard à 00h05.

Notifie responsable + Directeur (anti-spam via date_derniere_notif_retard).

6.8 Rappels avant échéance
Job CRON notifier_echeances_proches à 07h00 (tâches dont l'échéance est < 48 h).

Job CRON notifier_evenements_imminents toutes les 15 min (événements dans 30 min).

6.9 Expiration des délégations
Job CRON expirer_delegations à 00h10.

Passe actif = False aux délégations dont date_fin est dépassée.

6.10 Clôture des CRQ
Job CRON cloturer_crq à 23h59.

Passe est_cloture = True pour les CRQ du jour.

6.11 Traçabilité
Toute action critique génère une entrée dans HistoriqueAction.

Couvre : Tâches, Instructions, Blocages, Activités, Délégations, CRQ, Synthèses.

7. RBAC — Matrice complète
Légende : C = Create, R = Read, U = Update, D = Delete, - = aucun accès.

Entité	Directeur	Secrétaire	Chef de service	Conseillère	Membre équipe
Utilisateur	R (tous), U	R	R (Service)	R	R
Activité	CRUD	R	CRU (Service)	R	R (si rattaché)
Tâche	CRUD (créées/attribuées)	CRU (Secrétariat)	CRU (Service)	CRU (Propres)	CRU (Propres)
Instruction	CRUD	CRU (saisie)	CRU (vers équipe)	RU	RU (si destinataire)
Blocage	RU (tout)	R	CRUD (Service)	RU	CRU (ses tâches)
Délégation	CRUD	-	CRU (Service)	-	-
CRQ	R (tous)	R	R (Service)	R	CRU (propres)
DemandeReouvertureCRQ	RU	-	RU	-	CRU
Événement	CRUD	CRUD	CRU (Service)	CRU	R
Synthèse	CRU	R	R	R	-
Commentaire	CRUD	CRU	CRU	CRU	CRU
Pièce jointe	CRUD	CRUD	CRUD	CRU	CRU
8. Endpoints API REST
Préfixe global : /api/v1/

Authentification
Méthode	URL	Description
POST	/auth/login/	Login (retourne access + refresh)
POST	/auth/refresh/	Renouvelle l'access token
POST	/auth/logout/	Blackliste le refresh token
GET	/auth/me/	Profil utilisateur connecté
Utilisateurs (lecture seule)
Méthode	URL	Description
GET	/utilisateurs/	Annuaire (filtrage par rôle)
GET	/utilisateurs/{id}/	Détail
Tâches
Méthode	URL	Description
GET	/taches/	Liste (filtres : statut, priorite, responsable, activite, en_retard)
POST	/taches/	Création
GET	/taches/{id}/	Détail
PUT/PATCH	/taches/{id}/	Modification (créateur ou Directeur)
DELETE	/taches/{id}/	Suppression (créateur ou Directeur)
PATCH	/taches/{id}/statut/	Changement de statut
PATCH	/taches/{id}/assigner/	Réattribution
Activités
Méthode	URL	Description
GET	/activites/	Liste (filtres : statut, priorite, responsable)
POST	/activites/	Création (Directeur ou Chef)
GET	/activites/{id}/	Détail
PUT/PATCH	/activites/{id}/	Modification
DELETE	/activites/{id}/	Suppression
POST	/activites/{id}/cloturer/	Clôture (si tâches terminées)
Instructions
Méthode	URL	Description
GET	/instructions/	Liste (filtres : statut, priorite, cible_type)
POST	/instructions/	Émission (avec destinataire_ids)
GET	/instructions/{id}/	Détail
PUT/PATCH	/instructions/{id}/	Modification
PATCH	/instructions/{id}/destinataires/{user_id}/statut/	Statut d'un destinataire
Blocages
Méthode	URL	Description
GET	/blocages/	Liste (filtres : statut, niveau_urgence, tache)
POST	/blocages/	Signalement
GET	/blocages/{id}/	Détail
POST	/blocages/{id}/resoudre/	Résolution
POST	/blocages/{id}/remonter/	Remontée au Directeur
Événements
Méthode	URL	Description
GET	/evenements/	Liste (filtres : debut, fin, niveau_priorite, type)
POST	/evenements/	Création
GET	/evenements/{id}/	Détail
PUT/PATCH	/evenements/{id}/	Modification
DELETE	/evenements/{id}/	Suppression
Délégations
Méthode	URL	Description
GET	/delegations/	Liste (filtres : actif, role_delegue)
POST	/delegations/	Création
POST	/delegations/{id}/revoquer/	Révocation
Comptes-rendus quotidiens
Méthode	URL	Description
GET	/comptes-rendus/	Liste (filtres : est_cloture, date, redacteur)
POST	/comptes-rendus/	Création
GET	/comptes-rendus/{id}/	Détail
PUT/PATCH	/comptes-rendus/{id}/	Modification (si non clôturé)
POST	/comptes-rendus/{id}/demande-reouverture/	Demande de réouverture
Demandes de réouverture
Méthode	URL	Description
GET	/demandes-reouverture/	Liste (filtres : statut, crq)
POST	/demandes-reouverture/{id}/valider/	Validation (débloque le CRQ)
POST	/demandes-reouverture/{id}/refuser/	Refus
Notifications
Méthode	URL	Description
GET	/notifications/	Liste personnelle (filtre : lue)
PATCH	/notifications/{id}/lire/	Marquer comme lue
Synthèses
Méthode	URL	Description
GET	/syntheses/	Liste (filtre : type)
POST	/syntheses/	Création manuelle
POST	/syntheses/generer/	Génération automatique (Directeur/Secrétaire)
GET	/syntheses/{id}/	Détail
Pièces jointes
Méthode	URL	Description
GET	/pieces-jointes/	Liste
POST	/pieces-jointes/	Création (métadonnées)
Commentaires
Méthode	URL	Description
GET	/commentaires/	Liste
POST	/commentaires/	Création
Historique (lecture seule)
Méthode	URL	Description
GET	/historique/	Liste personnelle ou complète selon rôle
Tableau de bord
Méthode	URL	Description
GET	/tableau-de-bord/	Agrégation : KPIs + listes courtes + agenda du jour
9. Jobs d'arrière-plan
Job	Fréquence	Rôle
cloturer_crq	Quotidien 23h59	Passe est_cloture = True pour les CRQ du jour
marquer_taches_en_retard	Quotidien 00h05	Notifie responsable + Directeur des tâches en retard
expirer_delegations	Quotidien 00h10	Désactive les délégations expirées
notifier_echeances_proches	Quotidien 07h00	Notifie les tâches dont l'échéance est < 48 h
notifier_evenements_imminents	Toutes les 15 min	Notifie les participants 30 min avant un événement
Exécution manuelle (développement) :

text
python manage.py cloturer_crq
python manage.py marquer_taches_en_retard
python manage.py expirer_delegations
python manage.py notifier_echeances_proches
python manage.py notifier_evenements_imminents
Planification en production : via CRON système ou Celery Beat (à configurer).

10. Comptes de test
Utilisateur	Mot de passe	Rôle	ID
admin	(superuser technique)	superuser Django	1
directeur	Directeur2026!	DIRECTEUR	3
chef_projets	Chef2026!	CHEF_SERVICE_PROJETS	4
membre	Membre2026!	MEMBRE_EQUIPE_APPUI	5
Accès MySQL :

Port : 3307

Utilisateur : root / DppRoot2026!

Utilisateur applicatif : dpp_user / dpp_password_dev

Base : dpp_assistant

11. Écarts par rapport à la V1
11.1 Écarts techniques
Document V1	Réalité V2	Raison
Django 5.x	Django 5.2.17 LTS	Compatibilité MySQL
MySQL 8.0 (port implicite 3306)	MySQL 8.0.46 (port 3307)	Conflit XAMPP
role : Role (Enum)	RoleChoice (TextChoices)	Convention Django
nom, prenom, motDePasse	last_name, first_name, password	Convention Django
destinataireId unique	InstructionDestinataire (N-N)	Multi-destinataires requis
EN_RETARD comme statut	Indicateur calculé	Pas de stockage
pieces_jointes en N-N générique	Table PieceJointe avec FK nullable vers 5 entités	Simplicité
11.2 Écarts fonctionnels
Fonctionnalité V1	Réalité V2	Statut
Contestation blocage 48 h	Non implémenté	Reporté V2
Workflow validation tâches	Non implémenté (confiance créateur/responsable)	Reporté V2
Récurrence événements	Non implémenté	Reporté V2
Escalade automatique blocages	Non implémenté	Reporté V2
Agenda vue hebdomadaire	Non implémenté (mois + jour uniquement)	Reporté V2
Modification événement	Non implémenté (supprimer + recréer)	Reporté V2
Upload fichiers binaires	Métadonnées seulement	Reporté V2
Export PDF synthèses	Non implémenté	Reporté V2
Recherche globale	Non implémenté	Reporté V2
Pagination UI	Pagination DRF silencieuse (20 par défaut)	À améliorer V2
11.3 Ajouts non prévus en V1
Endpoint /tableau-de-bord/ (agrégation KPIs).

Action /syntheses/generer/ (génération automatique).

Action /comptes-rendus/{id}/demande-reouverture/.

Action /demandes-reouverture/{id}/valider et /refuser.

Action /taches/{id}/assigner/.

Action /activites/{id}/cloturer/.

Action /blocages/{id}/resoudre/ et /remonter/.

Action /delegations/{id}/revoquer/.

Action /notifications/{id}/lire/.

Action /instructions/{id}/destinataires/{user_id}/statut/.

Endpoint /utilisateurs/ en lecture seule.

Classes shallow (TacheShallowSerializer, InstructionShallowSerializer, DemandeReouvertureCRQShallowSerializer).

Endpoints de filtrage par query params sur tous les ViewSets.

Tableau de bord avec 7 KPIs + 6 widgets.

12. TODO V2
Fonctionnalités reportées :

Contestation de blocage sous 48 h (Règle 1 du document initial).

Workflow de validation des tâches terminées.

Récurrence d'événements.

Escalade automatique des blocages non traités (Règle 4 du document initial).

Vue hebdomadaire de l'agenda.

Modification d'événements (actuellement : supprimer + recréer).

Upload réel de fichiers (stockage, téléchargement).

Export PDF des synthèses.

Recherche globale dans toutes les entités.

Pagination UI (boutons page précédente/suivante).

Améliorations techniques :

Tests unitaires backend (permissions, jobs, serializers).

Tests E2E frontend (Playwright ou Cypress).

Documentation API (Swagger / OpenAPI).

Pipeline CI/CD (GitHub Actions ou GitLab CI).

Dockerisation (backend + frontend + MySQL).

Configuration production (DEBUG=False, vraie SECRET_KEY, HTTPS, domaine).

Backup automatique de la base.

Monitoring et logs centralisés.

Améliorations UX :

Messages d'erreur plus fins dans les modales (afficher le détail API complet).

Toasts au lieu des window.confirm.

Mode sombre.

Chargement progressif (skeleton screens).

Tri des listes (par date, priorité, etc.).

13. Points d'attention pour les développeurs
1. USE_TZ = False :

Utiliser date.today() et non timezone.localdate().

timezone.now() reste utilisable.

2. FK forcées :

Les FK createur, emetteur, signale_par, redacteur, uploade_par, genere_par, auteur, delegant sont en read_only dans les serializers.

Elles sont forcées dans perform_create via serializer.save(champ=request.user).

3. nom_complet :

Côté Python : méthode user.get_nom_complet().

Côté JSON : attribut user.nom_complet.

4. Récursion de serializers :

Ne jamais référencer un serializer parent dans un serializer enfant sans passer par la version shallow.

Trois serializers shallow existent : TacheShallowSerializer, InstructionShallowSerializer, DemandeReouvertureCRQShallowSerializer.

5. Filtres côté backend :

Toujours implémenter les filtres dans get_queryset du ViewSet.

Ne jamais filtrer côté frontend une liste volumineuse.

6. Tests manuels :

Comptes de test disponibles (voir §10).

Pour les rôles différents, se déconnecter et se reconnecter.

markdown
## 14. Tests

### 14.1 Stack de test

| Élément | Choix |
|---|---|
| Framework | `pytest` + `pytest-django` |
| Configuration | `backend/pytest.ini` |
| Base de test | `test_dpp_assistant` (créée automatiquement par pytest) |
| Fixtures | `backend/api/tests/conftest.py` |
| Réutilisation de la BDD | `--reuse-db` (gain de temps entre les runs) |

**Installation :**

```bash
pip install pytest pytest-django pytest-cov
Lancement :

bash
cd backend
pytest                           # tous les tests
pytest api/tests/test_permissions/ -v   # un dossier
pytest -k "tache"                # tests contenant "tache"
pytest --cov=api                 # avec couverture
14.2 Structure
text
backend/api/tests/
├── conftest.py                     # Fixtures partagées (utilisateurs, clients)
├── test_models/
│   └── test_utilisateur.py         # 5 tests
├── test_permissions/
│   ├── test_fonctions.py           # 18 tests (RBAC utilitaires)
│   ├── test_tache_permission.py    # 16 tests
│   └── test_autres_permissions.py  # 20 tests
├── test_serializers/
│   └── test_serializers_critiques.py  # 23 tests
├── test_jobs/
│   └── test_jobs.py                # 19 tests
└── test_views/                     # (non écrit en V1)
14.3 Couverture V1
101 tests, tous passants. Total exécution : ~4 minutes.

Couche testée	Nombre	Priorité
Modèle Utilisateur	5	Haute
Fonctions RBAC	18	Critique
Permissions par modèle	36	Critique
Serializers critiques	23	Haute
Jobs CRON	19	Critique
Zones non couvertes (volontairement reportées) :

Serializers secondaires (Blocage, Delegation, CRQ, Commentaire) — testés manuellement.

ViewSets et intégration API — testés manuellement.

Tests E2E frontend — non prévus en V1.

14.4 Bonnes pratiques à respecter
1. Datetimes naïfs. Avec USE_TZ = False, ne jamais utiliser de chaînes ISO avec Z :

python
# ✅ Correct
from datetime import datetime, timedelta
date_debut = datetime(2026, 10, 1, 10, 0, 0)

# ❌ À éviter (lève une ValueError)
date_debut = '2026-10-01T10:00:00Z'
2. Tester les zones critiques en priorité. Une erreur dans une permission = faille de sécurité. Une erreur dans un serializer secondaire = bug cosmétique.

3. Utiliser les fixtures. Ne jamais dupliquer la création des utilisateurs de test. Utiliser directeur, chef_projets, membre, etc. (voir conftest.py).

4. Un test = un comportement. Un test qui teste 3 choses en même temps sera difficile à déboguer quand il échouera.

5. Nommer les tests en français lisible. test_directeur_peut_supprimer_toute_tache est plus clair que test_perm_1.

14.5 TODO V1.5 / V2
Tests des serializers secondaires.

Tests d'intégration ViewSets (via APIClient).

Tests des services (enregistrer_action, envoyer_notification).

Tests E2E frontend (Playwright ou Cypress).

Mesure de couverture avec pytest --cov=api --cov-report=html.

Intégration dans un pipeline CI/CD.

text

**Enregistrez.**

---

## 2. Ajout dans `README.md`

**Ouvrez `README.md`.**

**Cherchez la section :**

```markdown
## Actions avant mise en production
Insérez juste avant cette section le bloc suivant :

markdown
## Tests

### Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest
Couverture actuelle : 101 tests, tous passants.

Couche	Tests
Modèle Utilisateur	5
Fonctions RBAC	18
Permissions par modèle	36
Serializers critiques	23
Jobs CRON	19
Lancement ciblé :

powershell
pytest api/tests/test_permissions/ -v      # Uniquement les permissions
pytest -k "tache"                           # Tests contenant "tache"
pytest --cov=api                            # Avec couverture
Frontend
Aucun test automatisé en V1 (prévu en V2).

text

**Enregistrez.**

---

## Vérification

**1.** Ouvrez `docs/DPP_v2.md` — la section §14 Tests doit apparaître avant §15 Conclusion (ancien §14).

**2.** Ouvrez `README.md` — la section Tests doit apparaître avant la section « Actions avant mise en production ».

**3.** Lancez une dernière fois les tests pour confirmer que rien n'est cassé :
cd backend
pytest -q



15. Conclusion
L'application DPP Assistant V1 est complète et fonctionnelle.

15 modèles, 18 serializers, 14 ViewSets.

5 jobs CRON opérationnels.

10 pages métier + 6 pages détail côté frontend.

Authentification JWT complète.

RBAC respecté partout.

Aucun bug bloquant connu.

Reste à faire pour la production : voir §12.

Fin du document — Version 2.0

Ce que vous devez faire maintenant
1. Créez le fichier docs/DPP_v2.md dans votre projet et collez-y tout le contenu ci-dessus.

2. Gardez DPP_v1.docx et DPP_deepSeek_V5.docx comme référence historique. Ils ne sont plus à jour mais ils expliquent l'origine des décisions.

3. À l'avenir, c'est DPP_v2.md qui fait foi.