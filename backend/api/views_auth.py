"""
Vues d'authentification JWT.

- /auth/login   → fourni par simplejwt (TokenObtainPairView)
- /auth/refresh → fourni par simplejwt (TokenRefreshView)
- /auth/logout  → custom (avec blacklist du refresh token)
- /auth/me      → custom (retourne le profil de l'utilisateur connecté)
"""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import UtilisateurSerializer


class MeView(APIView):
    """
    Retourne le profil de l'utilisateur actuellement authentifié.

    Endpoint : GET /api/v1/auth/me
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UtilisateurSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Déconnecte l'utilisateur en blacklistant son refresh token.

    Endpoint : POST /api/v1/auth/logout

    Body attendu :
        {
            "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
        }

    Une fois le refresh token blacklisté :
        - il ne peut plus être utilisé pour obtenir un nouveau access token,
        - l'access token existant reste valide jusqu'à expiration (1 heure).

    Pour un logout immédiat, le client doit également supprimer son
    access token côté navigateur.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Le champ "refresh" est obligatoire.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response(
                {'detail': 'Le refresh token est invalide ou déjà blacklisté.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {'detail': 'Déconnexion réussie.'},
            status=status.HTTP_200_OK,
        )