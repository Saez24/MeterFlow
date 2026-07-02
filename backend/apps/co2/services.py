"""CO₂ calculation — ported from the FastAPI ``services/co2.py`` (contract §5)."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from apps.co2.defaults import CO2_DEFAULTS

if TYPE_CHECKING:
    from apps.co2.models import Co2Factor


def calculate_co2(
    energy_type: str,
    consumption: Decimal,
    user_factors: list[Co2Factor],
) -> Decimal:
    """User override wins over the built-in default; unknown type → 0."""
    for factor in user_factors:
        if factor.energy_type == energy_type:
            return consumption * Decimal(str(factor.factor_kg_per_unit))
    for default in CO2_DEFAULTS:
        if default.energy_type == energy_type:
            return consumption * Decimal(str(default.factor_kg_per_unit))
    return Decimal("0")
