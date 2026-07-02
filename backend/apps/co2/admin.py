from __future__ import annotations

from django.contrib import admin

from apps.co2.models import Co2Factor


@admin.register(Co2Factor)
class Co2FactorAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("energy_type", "factor_kg_per_unit", "unit", "user", "valid_from")
    list_filter = ("energy_type",)
