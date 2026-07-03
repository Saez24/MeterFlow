"""Base settings shared by all environments.

Environment-specific overrides live in ``dev.py`` and ``prod.py``. Secrets and
deployment-specific values come from the environment (see ``.env.example``);
never hard-code them here.
"""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url

# backend/ (contains manage.py)
BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _env_bool(key: str, default: bool = False) -> bool:
    return _env(key, "1" if default else "0").lower() in {"1", "true", "yes", "on"}


def _env_list(key: str, default: str = "") -> list[str]:
    raw = _env(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ── Core ─────────────────────────────────────────────────────────────────────
SECRET_KEY = _env("DJANGO_SECRET_KEY", "insecure-dev-key-change-me")
DEBUG = _env_bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local apps
    "apps.accounts",
    "apps.meters",
    "apps.readings",
    "apps.co2",
    "apps.stats",
    "apps.common",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # WhiteNoise serves Django's own static files (admin) without nginx.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── Database ─────────────────────────────────────────────────────────────────
# Default to sqlite so `manage.py check`/`makemigrations` run without Postgres;
# prod requires DATABASE_URL (enforced in prod.py).
DATABASES = {
    "default": dj_database_url.parse(
        _env("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
    )
}

# ── Cache (rate limiting) ────────────────────────────────────────────────────
# Redis in prod (shared across gunicorn workers), local-memory otherwise.
_redis_url = _env("REDIS_URL")
if _redis_url:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _redis_url,
        }
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# ── Auth ─────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Argon2 first (stronger than the PBKDF2 default); keep others for legacy hashes.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── JWT / cookie auth (contract §2) ──────────────────────────────────────────
JWT_ALGORITHM = "HS256"
JWT_SIGNING_KEY = _env("JWT_SIGNING_KEY", SECRET_KEY)
ACCESS_TOKEN_LIFETIME = timedelta(
    minutes=int(_env("ACCESS_TOKEN_LIFETIME_MINUTES", "15"))
)
REFRESH_TOKEN_LIFETIME = timedelta(days=int(_env("REFRESH_TOKEN_LIFETIME_DAYS", "7")))

AUTH_COOKIE_ACCESS = "access_token"
AUTH_COOKIE_REFRESH = "refresh_token"
# Refresh cookie is scoped to the refresh endpoint only (contract §2).
AUTH_COOKIE_REFRESH_PATH = "/api/v1/auth/refresh"
AUTH_COOKIE_SECURE = _env_bool("AUTH_COOKIE_SECURE", default=True)
AUTH_COOKIE_SAMESITE = _env("AUTH_COOKIE_SAMESITE", "Strict")
AUTH_COOKIE_HTTPONLY = True

# ── DRF ──────────────────────────────────────────────────────────────────────
# camelCase at the API boundary (contract §12.1). Model/serializer fields stay
# snake_case; conversion happens in the renderer/parser.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.CookieJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "apps.common.renderers.CamelCaseDecimalRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
        "djangorestframework_camel_case.parser.CamelCaseMultiPartParser",
        "djangorestframework_camel_case.parser.CamelCaseFormParser",
    ],
    "DEFAULT_PAGINATION_CLASS": None,
    "UNAUTHENTICATED_USER": None,
}

# ── CORS (contract §1) ───────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = _env_list("CORS_ALLOWED_ORIGINS", "http://localhost:4200")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = ["content-type"]
CSRF_TRUSTED_ORIGINS = _env_list("CSRF_TRUSTED_ORIGINS", "http://localhost:4200")

# ── Storage (contract §7) ────────────────────────────────────────────────────
STORAGE_BACKEND = _env("STORAGE_BACKEND", "local")
LOCAL_STORAGE_PATH = _env("LOCAL_STORAGE_PATH", str(BASE_DIR / "media"))

# ── i18n / static ────────────────────────────────────────────────────────────
LANGUAGE_CODE = "de-de"
TIME_ZONE = "Europe/Berlin"
USE_I18N = True
USE_TZ = True

# Distinct prefix so Django admin static never collides with the Angular SPA
# that nginx serves at the root in the fullstack image.
STATIC_URL = "django-static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = Path(LOCAL_STORAGE_PATH)

# Reading photos: local FS in dev, S3/MinIO in prod. S3 objects are private and
# served via signed URLs (security-standards §4 — no public PII buckets).
# WhiteNoise (compressed + hashed) serves the admin's own static assets.
_STATICFILES_STORAGE = {
    "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
}
if STORAGE_BACKEND in {"s3", "minio"}:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": _env("S3_BUCKET_NAME"),
                "endpoint_url": _env("S3_ENDPOINT_URL") or None,
                "access_key": _env("S3_ACCESS_KEY_ID"),
                "secret_key": _env("S3_SECRET_ACCESS_KEY"),
                "region_name": _env("S3_REGION_NAME", "us-east-1"),
                "default_acl": "private",
                "querystring_auth": True,
                "file_overwrite": False,
            },
        },
        "staticfiles": _STATICFILES_STORAGE,
    }
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": _STATICFILES_STORAGE,
    }

# ── Logging ──────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
