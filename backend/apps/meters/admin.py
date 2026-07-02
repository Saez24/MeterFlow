from __future__ import annotations

from django.contrib import admin

from apps.meters.models import Meter


@admin.register(Meter)
class MeterAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name", "type", "user", "active", "archived", "created_at")
    list_filter = ("type", "active", "archived")
    search_fields = ("name", "meter_number")
