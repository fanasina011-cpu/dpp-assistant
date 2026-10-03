Objectif : documenter la procédure complète pour passer du développement à la production.

Créez le dossier docs/ à la racine du projet s'il n'existe pas (D:\DPP-byDeepseek\dpp-assistant\docs\).

Puis créez D:\DPP-byDeepseek\dpp-assistant\docs\DEPLOIEMENT.md avec ce contenu :

markdown
# DPP Assistant — Guide de déploiement en production

Ce document décrit les étapes à suivre pour déployer l'application DPP Assistant sur un serveur de production.

**Avertissement :** ce guide suppose une maîtrise de Linux, Nginx, Gunicorn et MySQL. Pour un déploiement Windows, adapter les commandes.

---

## 1. Prérequis serveur

### 1.1 Serveur recommandé

| Élément | Minimum | Recommandé |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 Go | 8 Go |
| Stockage | 40 Go SSD | 100 Go SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Bande passante | 100 Mbps | 1 Gbps |

### 1.2 Logiciels à installer

- **Python 3.13+** (avec `python3-venv` et `python3-dev`)
- **Node.js 20+** et npm
- **MySQL Server 8.0**
- **Nginx**
- **Git**
- **Certbot** (Let's Encrypt pour HTTPS)
- **Supervisor** ou **systemd** (pour les processus longs)

---

## 2. Préparation de la base de données

### 2.1 Créer la base et l'utilisateur

```bash
sudo mysql -u root -p
sql
CREATE DATABASE dpp_assistant
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'dpp_user'@'localhost' IDENTIFIED BY 'MOT_DE_PASSE_FORT';

GRANT ALL PRIVILEGES ON dpp_assistant.* TO 'dpp_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
⚠️ Ne jamais utiliser root en production. Toujours un utilisateur dédié avec un mot de passe fort.

2.2 Sauvegarde initiale
bash
mysqldump -u dpp_user -p dpp_assistant > backup_init.sql
Conserver ce fichier en lieu sûr (hors du serveur, idéalement).

3. Déploiement du backend
3.1 Cloner le projet
bash
cd /var/www
sudo git clone <URL_DU_DEPOT> dpp-assistant
sudo chown -R $USER:$USER dpp-assistant
cd dpp-assistant/backend
3.2 Créer l'environnement virtuel
bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
3.3 Créer le fichier .env de production
bash
cp .env.example .env
nano .env
Contenu à adapter :

ini
DJANGO_SECRET_KEY=<GÉNÉRER_UNE_VRAIE_CLÉ>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=dpp.votre-domaine.mg,www.dpp.votre-domaine.mg

DB_NAME=dpp_assistant
DB_USER=dpp_user
DB_PASSWORD=<LE_MOT_DE_PASSE_FORT>
DB_HOST=localhost
DB_PORT=3306

CORS_ALLOWED_ORIGINS=https://dpp.votre-domaine.mg
3.4 Générer une vraie SECRET_KEY
En local (sur votre machine de développement) :

bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
Copier la valeur retournée dans DJANGO_SECRET_KEY. Ne jamais réutiliser la clé de développement.

3.5 Appliquer les migrations
bash
python manage.py migrate
3.6 Créer un superutilisateur
bash
python manage.py createsuperuser
3.7 Collecter les fichiers statiques
bash
python manage.py collectstatic --noinput
3.8 Tester le démarrage
bash
python manage.py runserver 0.0.0.0:8000
Arrêter avec Ctrl+C une fois vérifié que tout démarre.

4. Service systemd pour Gunicorn
Créer /etc/systemd/system/dpp-backend.service :

ini
[Unit]
Description=DPP Assistant — Backend Django (Gunicorn)
After=network.target mysql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/dpp-assistant/backend
Environment="PATH=/var/www/dpp-assistant/backend/venv/bin"
ExecStart=/var/www/dpp-assistant/backend/venv/bin/gunicorn \
    --workers 3 \
    --bind unix:/run/dpp-backend.sock \
    core.wsgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
Activer et démarrer :

bash
sudo systemctl daemon-reload
sudo systemctl enable dpp-backend
sudo systemctl start dpp-backend
sudo systemctl status dpp-backend
5. Déploiement du frontend
5.1 Compiler le frontend
bash
cd /var/www/dpp-assistant/frontend
npm install
npm run build
Le dossier dist/ contient les fichiers statiques à servir.

5.2 Copier les fichiers vers un dossier servi par Nginx
bash
sudo mkdir -p /var/www/dpp-frontend
sudo cp -r dist/* /var/www/dpp-frontend/
sudo chown -R www-data:www-data /var/www/dpp-frontend
⚠️ Avant de compiler, vérifier que l'URL de l'API dans frontend/src/api/client.ts pointe vers le domaine de production :

typescript
const BASE_URL = 'https://dpp.votre-domaine.mg/api/v1'
6. Configuration Nginx
Créer /etc/nginx/sites-available/dpp-assistant :

nginx
server {
    listen 80;
    server_name dpp.votre-domaine.mg www.dpp.votre-domaine.mg;

    # Redirection HTTPS (à activer après Certbot)
    # return 301 https://$server_name$request_uri;

    # Frontend (fichiers statiques React)
    root /var/www/dpp-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Django
    location /api/ {
        proxy_pass http://unix:/run/dpp-backend.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Interface admin Django
    location /admin/ {
        proxy_pass http://unix:/run/dpp-backend.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fichiers statiques Django (admin CSS, etc.)
    location /static/ {
        alias /var/www/dpp-assistant/backend/staticfiles/;
    }

    # Fichiers media (pièces jointes)
    location /media/ {
        alias /var/www/dpp-assistant/backend/media/;
    }

    client_max_body_size 20M;
}
Activer le site :

bash
sudo ln -s /etc/nginx/sites-available/dpp-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
7. HTTPS avec Let's Encrypt
bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d dpp.votre-domaine.mg -d www.dpp.votre-domaine.mg
Certbot configure automatiquement Nginx et met en place le renouvellement automatique.

Vérifier :

bash
sudo certbot renew --dry-run
8. Jobs CRON
Créer /etc/cron.d/dpp-jobs :

cron
# DPP Assistant — Jobs planifiés
# Format : minute heure jour mois jour_semaine utilisateur commande

# Clôture des CRQ à 23h59
59 23 * * * www-data cd /var/www/dpp-assistant/backend && /var/www/dpp-assistant/backend/venv/bin/python manage.py cloturer_crq >> /var/log/dpp/jobs.log 2>&1

# Tâches en retard à 00h05
5 0 * * * www-data cd /var/www/dpp-assistant/backend && /var/www/dpp-assistant/backend/venv/bin/python manage.py marquer_taches_en_retard >> /var/log/dpp/jobs.log 2>&1

# Délégations expirées à 00h10
10 0 * * * www-data cd /var/www/dpp-assistant/backend && /var/www/dpp-assistant/backend/venv/bin/python manage.py expirer_delegations >> /var/log/dpp/jobs.log 2>&1

# Échéances proches à 07h00
0 7 * * * www-data cd /var/www/dpp-assistant/backend && /var/www/dpp-assistant/backend/venv/bin/python manage.py notifier_echeances_proches >> /var/log/dpp/jobs.log 2>&1

# Événements imminents toutes les 15 minutes
*/15 * * * * www-data cd /var/www/dpp-assistant/backend && /var/www/dpp-assistant/backend/venv/bin/python manage.py notifier_evenements_imminents >> /var/log/dpp/jobs.log 2>&1
Créer le dossier de logs :

bash
sudo mkdir -p /var/log/dpp
sudo chown www-data:www-data /var/log/dpp
9. Sauvegardes
9.1 Sauvegarde quotidienne de la base
Créer /etc/cron.daily/dpp-backup :

bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
BACKUP_DIR=/var/backups/dpp
mkdir -p $BACKUP_DIR

mysqldump -u dpp_user -p'MOT_DE_PASSE' dpp_assistant | gzip > $BACKUP_DIR/dpp_$DATE.sql.gz

# Supprimer les sauvegardes de plus de 30 jours
find $BACKUP_DIR -name "dpp_*.sql.gz" -mtime +30 -delete
bash
sudo chmod +x /etc/cron.daily/dpp-backup
9.2 Sauvegarde des fichiers media
bash
sudo rsync -av /var/www/dpp-assistant/backend/media/ /var/backups/dpp/media/
Ajouter cette ligne au script de backup quotidien.

10. Monitoring et logs
10.1 Logs applicatifs
Composant	Fichier
Gunicorn	journalctl -u dpp-backend
Nginx accès	/var/log/nginx/access.log
Nginx erreurs	/var/log/nginx/error.log
Jobs CRON	/var/log/dpp/jobs.log
10.2 Vérification quotidienne
Commandes rapides à exécuter manuellement ou via monitoring :

bash
# État du backend
sudo systemctl status dpp-backend

# État de Nginx
sudo systemctl status nginx

# Dernières lignes des jobs
tail -n 50 /var/log/dpp/jobs.log

# Espace disque
df -h
10.3 Outil recommandé
Installer Uptime Kuma ou Netdata pour surveiller :

Disponibilité du site,

Temps de réponse de l'API,

Charge CPU/RAM,

Espace disque.

11. Procédure de mise à jour
11.1 Sur le serveur
bash
cd /var/www/dpp-assistant

# Sauvegarder la base
mysqldump -u dpp_user -p dpp_assistant | gzip > /var/backups/dpp/pre-update-$(date +%Y-%m-%d).sql.gz

# Récupérer les nouvelles versions
git pull

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart dpp-backend

# Frontend
cd ../frontend
npm install
npm run build
sudo cp -r dist/* /var/www/dpp-frontend/
11.2 Vérifications post-déploiement
Ouvrir le site dans un navigateur.

Se connecter avec un compte de test.

Vérifier les logs : journalctl -u dpp-backend -n 50.

Vérifier que les jobs CRON s'exécutent bien (attendre le lendemain matin).

12. Checklist avant mise en production
□ DEBUG=False dans .env
□ SECRET_KEY différente de celle du développement
□ ALLOWED_HOSTS contient le vrai domaine
□ CORS_ALLOWED_ORIGINS restreint au vrai domaine
□ Utilisateur MySQL dédié (pas root)
□ Mot de passe MySQL fort (> 20 caractères)
□ HTTPS activé et renouvellement automatique vérifié
□ Sauvegardes automatiques configurées
□ Jobs CRON installés et testés
□ Superutilisateur créé avec mot de passe fort
□ Comptes de test supprimés ou désactivés
□ Logs vérifiés (accès, erreurs, jobs)
□ npm run build testé localement avant déploiement
□ URL de l'API dans client.ts pointant vers le domaine de production
13. Actions post-déploiement
□ Tester le login avec un vrai utilisateur
□ Tester la création d'une tâche
□ Tester la génération d'une synthèse
□ Vérifier l'arrivée des notifications
□ Attendre le premier job CRON (le lendemain) et vérifier son exécution
□ Former les utilisateurs finaux
14. Contacts et ressources
Documentation technique complète : docs/DPP_v2.md

Dépôt Git : <URL_DU_DEPOT>

Mainteneur : <NOM_ET_EMAIL>

Fin du guide de déploiement.

text

**Enregistrez.**

---

## Vérification

**1.** Le dossier `docs/` existe à la racine du projet.

**2.** Le fichier `docs/DEPLOIEMENT.md` est créé.

**3.** L'arborescence actuelle du projet ressemble à :
dpp-assistant/
├── README.md
├── docs/
│ ├── DPP_v2.md
│ └── DEPLOIEMENT.md
├── backend/
│ ├── requirements.txt
│ ├── .env.example
│ └── ...
└── frontend/
└── ...