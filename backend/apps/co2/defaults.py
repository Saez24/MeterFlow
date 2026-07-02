"""Default CO₂ emission factors (Umweltbundesamt 2024) — contract §5."""

from __future__ import annotations

from typing import NamedTuple


class Co2Default(NamedTuple):
    energy_type: str
    factor_kg_per_unit: float
    unit: str


CO2_SOURCE = "Umweltbundesamt 2024"

CO2_DEFAULTS: tuple[Co2Default, ...] = (
    Co2Default("electricity", 0.380, "kWh"),
    Co2Default("gas", 2.020, "m³"),
    Co2Default("water", 0.000, "m³"),
    Co2Default("garden_water", 0.000, "m³"),
    Co2Default("heating_oil", 2.680, "Liter"),
    Co2Default("solar", -0.050, "kWh"),
    Co2Default("fernwarme", 75.000, "MWh"),
)
