"""CO₂ emission factor overrides per user (contract §5, §10)."""

from __future__ import annotations

from django.db import models

from apps.common.models import OwnedModel


class Co2Factor(OwnedModel):
    energy_type = models.TextField()
    factor_kg_per_unit = models.DecimalField(max_digits=12, decimal_places=6)
    unit = models.TextField()
    source = models.TextField(default="")
    source_url = models.TextField(null=True, blank=True)
    valid_from = models.DateField()

    class Meta:
        db_table = "co2_factors"
        ordering = ["energy_type", "-valid_from"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "energy_type", "valid_from"],
                name="uq_co2_user_type_date",
            )
        ]

    def __str__(self) -> str:
        return f"{self.energy_type} @ {self.valid_from}"
