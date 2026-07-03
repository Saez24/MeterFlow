"""Read-only admin for the immutable audit log (security-standards §5)."""

from __future__ import annotations

from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from apps.common.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "created_at",
        "action",
        "resource_type",
        "resource_id",
        "actor",
        "ip_address",
    )
    list_filter = ("action", "resource_type")
    search_fields = ("resource_id", "action")
    date_hierarchy = "created_at"

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False
