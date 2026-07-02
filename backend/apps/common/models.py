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
