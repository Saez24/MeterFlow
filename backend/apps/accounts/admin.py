from __future__ import annotations

from django.contrib import admin

from apps.accounts.models import RefreshToken, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("email", "is_active", "is_staff", "created_at")
    search_fields = ("email",)
    ordering = ("email",)


@admin.register(RefreshToken)
class RefreshTokenAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("user", "revoked", "expires_at", "created_at")
    list_filter = ("revoked",)
