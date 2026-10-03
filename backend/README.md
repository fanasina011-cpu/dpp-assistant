Étape 3 — Créer le README.md racine
Objectif : un fichier README.md à la racine du projet (D:\DPP-byDeepseek\dpp-assistant\README.md) qui permet à n'importe qui de comprendre et démarrer le projet en 10 minutes.

Créez D:\DPP-byDeepseek\dpp-assistant\README.md avec ce contenu :

markdown
# DPP Assistant

Application web de coordination interne pour la **Direction des Projets et Partenariats (DPP)**.

Elle permet de gérer les agendas, les activités, les tâches, les instructions, les blocages, les comptes-rendus quotidiens, les synthèses et les délégations temporaires de rôle.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Django 5.2.17 LTS + Django REST Framework |
| Base de données | MySQL 8.0.46 (port **3307**) |
| Authentification | JWT (via `djangorestframework-simplejwt`) |
| Frontend | React 18 + TypeScript + Vite 8.3 |
| Style | Tailwind CSS 4 |
| État & API | TanStack Query + Axios |
| Routage | React Router v6 |

**Environnement de développement :** Windows 10, Python 3.14.5, Node.js 24.19.

---

## Prérequis

Avant de démarrer, assurez-vous d'avoir :

- **Python 3.14** (ou 3.13 minimum) installé
- **Node.js 20+** et npm installés
- **MySQL Server 8.0** installé et configuré sur le port **3307**
- **XAMPP** (facultatif, mais présent sur la machine de développement initiale)

---

## Démarrage rapide

### 1. MySQL

Vérifiez que le service MySQL est en marche :

```powershell
sc query MySQL80
Doit afficher STATE : 4 RUNNING. Sinon :

powershell
net start MySQL80
2. Backend (Django)
powershell
cd D:\DPP-byDeepseek\dpp-assistant\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Créez un fichier .env à partir de .env.example (voir §Configuration).

Puis :

powershell
python manage.py migrate
python manage.py createsuperuser   # si première installation
python manage.py runserver
Le backend tourne sur http://127.0.0.1:8000/.

3. Frontend (React)
Dans un second terminal :

powershell
cd D:\DPP-byDeepseek\dpp-assistant\frontend
npm install
npm run dev
Le frontend tourne sur http://localhost:5173/.

Configuration
Le backend utilise un fichier .env à la racine de backend/. Créez-le à partir de .env.example :

bash
cp backend/.env.example backend/.env
Contenu type :

ini
DJANGO_SECRET_KEY=changeme_generer_une_vraie_cle_plus_tard
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=dpp_assistant
DB_USER=dpp_user
DB_PASSWORD=dpp_password_dev
DB_HOST=localhost
DB_PORT=3307

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
⚠️ En production, générez une vraie SECRET_KEY et changez le mot de passe de la base.

Comptes de test
Utilisateur	Mot de passe	Rôle
directeur	Directeur2026!	Directeur
chef_projets	Chef2026!	Chef Service Projets
membre	Membre2026!	Membre Équipe d'Appui
admin	(superuser technique)	Superuser Django
Structure du projet
text
dpp-assistant/
├── backend/                      # Django REST API
│   ├── core/                     # Configuration
│   ├── api/                      # Application métier
│   │   ├── models.py             # 15 modèles
│   │   ├── serializers.py        # 18 serializers
│   │   ├── permissions.py        # RBAC
│   │   ├── views.py              # 14 ViewSets
│   │   ├── management/commands/  # 5 jobs CRON
│   │   └── migrations/
│   └── requirements.txt
│
├── frontend/                      # React + Vite
│   ├── src/
│   │   ├── api/                  # Services API
│   │   ├── components/           # Composants
│   │   ├── pages/                # 10 pages métier
│   │   ├── context/              # AuthContext
│   │   └── routes/               # ProtectedRoute
│   └── package.json
│
└── docs/
    └── DPP_v2.md                 # Spécification technique complète
Documentation
La spécification technique complète est dans docs/DPP_v2.md. Elle décrit :

L'architecture backend et frontend

Les 15 modèles de données

Les règles métier implémentées

La matrice RBAC

Les endpoints API REST

Les jobs CRON

Les écarts par rapport aux spécifications initiales

Le TODO V2

C'est le document de référence. Consultez-le avant toute modification.

Jobs d'arrière-plan
Cinq jobs CRON doivent être exécutés régulièrement en production :

Commande	Fréquence	Rôle
python manage.py cloturer_crq	Quotidien 23h59	Clôture les CRQ du jour
python manage.py marquer_taches_en_retard	Quotidien 00h05	Notifie les tâches en retard
python manage.py expirer_delegations	Quotidien 00h10	Désactive les délégations expirées
python manage.py notifier_echeances_proches	Quotidien 07h00	Rappel des échéances < 48 h
python manage.py notifier_evenements_imminents	Toutes les 15 min	Rappel 30 min avant un événement
En développement, ils peuvent être lancés manuellement.

En production, ils doivent être planifiés via CRON système ou Celery Beat.

Actions avant mise en production
Voir docs/DEPLOIEMENT.md pour la procédure complète.

Résumé :

Générer une vraie DJANGO_SECRET_KEY

Passer DEBUG=False

Configurer ALLOWED_HOSTS avec le vrai domaine

Créer un utilisateur MySQL dédié (pas root)

Sauvegarder la base avant déploiement

Servir le backend via Gunicorn (ou uWSGI)

Servir le frontend via un reverse proxy (Nginx)

Activer HTTPS

Mettre en place un monitoring des jobs CRON

Passeport technique
Langue de l'application : français (LANGUAGE_CODE = 'fr-fr')

Fuseau horaire : Indian/Antananarivo

USE_TZ = False (fuseau unique — utiliser date.today() et non timezone.localdate())

Encodage : UTF-8 partout (frontend, backend, base)

Licence
Projet interne à la Direction des Projets et Partenariats.

Pour toute question technique, consultez docs/DPP_v2.md ou contactez le mainteneur du projet.






















### Démarrage via Docker (optionnel mais recommandé)

**Prérequis :** Docker Desktop installé.

**Lancement :**

```powershell
cd D:\DPP-byDeepseek\dpp-assistant
docker compose up --build