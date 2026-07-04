"""WSGI entry point."""

from __future__ import annotations

import os

from django.core.wsgi import get_wsgi_application

from config.env import load_env

load_env()
env = os.environ.get("DJANGO_ENV", "development").lower()
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings.prod" if env == "production" else "config.settings.dev",
)

application = get_wsgi_application()
