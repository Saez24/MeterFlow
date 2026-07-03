"""Set/clear the auth cookies with the flags from settings (contract §2)."""

from __future__ import annotations

from typing import Literal, cast

from django.conf import settings
from rest_framework.response import Response

_SameSite = Literal["Lax", "Strict", "None"]


def _samesite() -> _SameSite:
    value = settings.AUTH_COOKIE_SAMESITE
    if value not in ("Lax", "Strict", "None"):
        raise ValueError(f"Invalid AUTH_COOKIE_SAMESITE: {value!r}")
    return cast(_SameSite, value)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    samesite = _samesite()
    response.set_cookie(
        key=settings.AUTH_COOKIE_ACCESS,
        value=access_token,
        max_age=int(settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        httponly=settings.AUTH_COOKIE_HTTPONLY,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=samesite,
        path="/",
    )
    response.set_cookie(
        key=settings.AUTH_COOKIE_REFRESH,
        value=refresh_token,
        max_age=int(settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        httponly=settings.AUTH_COOKIE_HTTPONLY,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=samesite,
        path=settings.AUTH_COOKIE_REFRESH_PATH,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/")
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH, path=settings.AUTH_COOKIE_REFRESH_PATH
    )
