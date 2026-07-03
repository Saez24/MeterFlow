"""Shared abstract base models (UUID PK + timestamps + ownership)."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class UUIDTimestampedModel(models.Model):
    """UUID primary key + created/updated timestamps (contract §10)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OwnedModel(UUIDTimestampedModel):
    """Adds an indexed owner FK — every domain row is scoped to a user."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class AuditLog(models.Model):
    """Immutable audit trail for security-sensitive events (SOX, security-
    standards §5). Never updated or deleted; the actor FK is nulled (not
    cascaded) if the user is removed so the record survives."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.TextField()  # e.g. "user.login", "meter.create"
    resource_type = models.TextField()  # e.g. "user", "meter", "reading"
    resource_id = models.TextField(null=True, blank=True)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} @ {self.created_at:%Y-%m-%d %H:%M:%S}"
