#!/bin/bash

pyfiglet F1DATASTOP

echo "Running makemigrations and migrate..."
python3 manage.py makemigrations
python3 manage.py migrate

echo "Loading Fixtures..."
#python3 manage.py loaddata {}

echo "Creating Superuser..."
echo "from django.contrib.auth import get_user_model; User = get_user_model(); print('Admin User Exists....') if User.objects.filter(username='admin').exists() else User.objects.create_superuser('admin', 'test@test.com', 'admin') " | python3 manage.py shell

echo "Collecting static.."
echo "yes" | python3 manage.py collectstatic

# gunicorn runserver
gunicorn --config gunicorn-cfg.py core.wsgi
