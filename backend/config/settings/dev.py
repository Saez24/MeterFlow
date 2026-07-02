"""Development settings — permissive, never used in production."""

from __future__ import annotations

from .base import *  # noqa: F403
from .base import _env_bool

DEBUG = _env_bool("DJANGO_DEBUG", default=True)

# Cookies work over plain HTTP locally.
AUTH_COOKIE_SECURE = False
AUTH_COOKIE_SAMESITE = "Lax"

INTERNAL_IPS = ["127.0.0.1"]
