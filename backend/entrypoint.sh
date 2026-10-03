#!/bin/bash
set -e

echo "Attente de MySQL sur $DB_HOST:$DB_PORT..."

until python -c "
import MySQLdb
MySQLdb.connect(
    host='$DB_HOST',
    port=int('$DB_PORT'),
    user='$DB_USER',
    passwd='$DB_PASSWORD',
    db='$DB_NAME',
)
" 2>/dev/null; do
  echo "MySQL n'est pas encore prêt, attente..."
  sleep 2
done

echo "MySQL est prêt."

echo "Application des migrations..."
python manage.py migrate --noinput

echo "Collecte des fichiers statiques..."
python manage.py collectstatic --noinput

echo "Démarrage de Gunicorn..."
exec gunicorn core.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --access-logfile - \
    --error-logfile -