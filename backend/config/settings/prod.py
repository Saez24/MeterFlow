"""Production settings — hardened, fail-secure defaults (security-standards §2, §7)."""

from __future__ import annotations

import os

from .base import *  # noqa: F403

DEBUG = False

if not os.environ.get("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL must be set in production.")
if os.environ.get("DJANGO_SECRET_KEY") in {None, "", "insecure-dev-key-change-me"}:
    raise RuntimeError("DJANGO_SECRET_KEY must be set to a strong value in production.")

# HTTPS is terminated by the reverse proxy; trust its forwarded scheme.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_SECURE = True

X_FRAME_OPTIONS = "DENY"

# Auth cookies must be Secure behind the HTTPS proxy.
AUTH_COOKIE_SECURE = True
AUTH_COOKIE_SAMESITE = "Strict"
