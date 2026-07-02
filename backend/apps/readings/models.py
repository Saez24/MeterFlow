"""Reading model — derived cost/consumption fields (contract §4, §10)."""

from __future__ import annotations

from django.db import models

from apps.common.models import OwnedModel


class Reading(OwnedModel):
    meter = models.ForeignKey(
        "meters.Meter",
        on_delete=models.CASCADE,
        related_name="readings",
        db_index=True,
    )
    date = models.DateField()
    value = models.DecimalField(max_digits=20, decimal_places=6)
    # Derived server-side on create/recalculate (contract §4).
    consumption = models.DecimalField(
        max_digits=20, decimal_places=6, null=True, blank=True
    )
    kwh = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)
    cost = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)
    wastewater_cost = models.DecimalField(
        max_digits=20, decimal_places=6, null=True, blank=True
    )
    total_cost = models.DecimalField(
        max_digits=20, decimal_places=6, null=True, blank=True
    )
    note = models.TextField(null=True, blank=True)
    photo = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "readings"
        ordering = ["-date"]
        indexes = [models.Index(fields=["meter", "date"])]

    def __str__(self) -> str:
        return f"{self.meter_id} @ {self.date}"
