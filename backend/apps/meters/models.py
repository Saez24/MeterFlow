"""Meter model — field parity with the FastAPI/SQLAlchemy schema (contract §10)."""

from __future__ import annotations

from django.db import models

from apps.common.models import OwnedModel


class Meter(OwnedModel):
    name = models.TextField()
    type = models.TextField()
    unit = models.TextField()
    icon = models.TextField()
    color = models.TextField()
    active = models.BooleanField(default=True)
    archived = models.BooleanField(default=False)
    meter_number = models.TextField(null=True, blank=True)
    provider = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    calorific_value = models.DecimalField(
        max_digits=20, decimal_places=6, null=True, blank=True
    )
    z_number = models.DecimalField(
        max_digits=20, decimal_places=6, null=True, blank=True
    )
    connected_load_kw = models.DecimalField(
        max_digits=20, decimal_places=6, null=True, blank=True
    )
    linked_water_meter = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="linked_from",
    )
    tariff_history = models.JSONField(default=list)
    budget = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "meters"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name
