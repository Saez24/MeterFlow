from __future__ import annotations

from django.apps import AppConfig


class Co2Config(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.co2"
    label = "co2"
