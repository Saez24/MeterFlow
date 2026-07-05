"""Production settings — hardened, fail-secure defaults (security-standards §2, §7)."""

from __future__ import annotations

import os

from .base import *  # noqa: F403
from .base import _env_bool

DEBUG = False

if not os.environ.get("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL must be set in production.")
if not os.environ.get("REDIS_URL"):
    # Without Redis the cache falls back to per-process LocMemCache, which makes
    # the auth rate limits ineffective across gunicorn workers (security-standards §2).
    raise RuntimeError("REDIS_URL must be set in production (shared rate-limit cache).")
# Reject empty, the dev placeholder, and any build-time placeholder that could leak
# in from the image build (Dockerfile collectstatic) — otherwise JWT cookies signed
# with a repo-readable key would be forgeable (security-standards §12).
_secret_key = os.environ.get("DJANGO_SECRET_KEY") or ""
if _secret_key in {"", "insecure-dev-key-change-me"} or _secret_key.startswith(
    "build-time-"
):
    raise RuntimeError("DJANGO_SECRET_KEY must be set to a strong value in production.")

# HTTPS is terminated by the reverse proxy; trust its forwarded scheme.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Hardened by default; may be disabled for a local plain-HTTP fullstack demo.
SECURE_SSL_REDIRECT = _env_bool("SECURE_SSL_REDIRECT", default=True)
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
AUTH_COOKIE_SECURE = _env_bool("AUTH_COOKIE_SECURE", default=True)
AUTH_COOKIE_SAMESITE = "Strict"
