from __future__ import annotations

from django.contrib import admin

from apps.readings.models import Reading


@admin.register(Reading)
class ReadingAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("meter", "date", "value", "consumption", "total_cost", "user")
    list_filter = ("date",)
    search_fields = ("meter__name",)
