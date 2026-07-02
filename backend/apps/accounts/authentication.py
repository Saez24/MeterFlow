"""DRF authentication that reads the JWT access token from an HttpOnly cookie."""

from __future__ import annotations

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from apps.accounts.models import User
from apps.accounts.tokens import decode_access_token, user_id_from_sub


class CookieJWTAuthentication(BaseAuthentication):
    """Authenticate via the ``access_token`` cookie (contract §2).

    Defining ``authenticate_header`` makes DRF answer unauthenticated requests
    with 401 (not 403).
    """

    def authenticate(self, request: Request) -> tuple[User, None] | None:
        token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if not token:
            return None
        try:
            claims = decode_access_token(token)
            user_id = user_id_from_sub(claims["sub"])
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise AuthenticationFailed("Invalid or expired token") from exc

        user = User.objects.filter(id=user_id, is_active=True).first()
        if user is None:
            raise AuthenticationFailed("User not found")
        return user, None

    def authenticate_header(self, request: Request) -> str:
        return "Cookie"
