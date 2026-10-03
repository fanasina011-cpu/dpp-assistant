"""
Routage principal du projet DPP.

- /admin/       → interface d'administration Django (outil interne)
- /api/v1/      → API REST (utilisée par le frontend React)
"""

from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api.urls')),
]