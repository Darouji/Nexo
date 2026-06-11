from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import TokenAuthentication


class ExpiringTokenAuthentication(TokenAuthentication):
    """
    Autenticación por token con expiración.

    DRF TokenAuthentication por defecto no expira tokens.
    Esta clase mantiene el mismo formato:

        Authorization: Token <token>

    pero rechaza tokens antiguos.
    """

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)

        expire_hours = getattr(settings, "DRF_TOKEN_EXPIRE_HOURS", 12)

        if expire_hours and expire_hours > 0:
            expires_at = token.created + timedelta(hours=expire_hours)

            if timezone.now() >= expires_at:
                token.delete()

                raise exceptions.AuthenticationFailed(
                    "Token expirado. Inicie sesión nuevamente."
                )

        return user, token