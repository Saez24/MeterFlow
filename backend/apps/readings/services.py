"""Reading cost/consumption computation — ported 1:1 from the FastAPI backend
(``services/reading.py`` + ``services/tariff.py``). Single source of truth for
the derived values (contract §4).

Tariff-history entries are JSONB written by the frontend in camelCase; snake_case
keys are accepted as a fallback for imported data.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from apps.meters.models import Meter
    from apps.readings.models import Reading

_GAS_CALORIFIC_DEFAULT = Decimal("10.55")
_GAS_Z_NUMBER_DEFAULT = Decimal("0.9672")


@dataclass(frozen=True)
class ComputedReading:
    consumption: Decimal | None
    kwh: Decimal | None
    cost: Decimal | None
    wastewater_cost: Decimal | None
    total_cost: Decimal | None


def find_active_tariff(
    tariff_history: list[dict[str, Any]], for_date: date
) -> dict[str, Any] | None:
    candidates: list[tuple[date, dict[str, Any]]] = []
    for period in tariff_history:
        valid_from_raw = period.get("validFrom") or period.get("valid_from")
        if valid_from_raw is None:
            continue
        valid_from = date.fromisoformat(str(valid_from_raw)[:10])
        if valid_from > for_date:
            continue
        valid_to_raw = period.get("validTo") or period.get("valid_to")
        if valid_to_raw is not None:
            valid_to = date.fromisoformat(str(valid_to_raw)[:10])
            if valid_to < for_date:
                continue
        candidates.append((valid_from, period))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def get_decimal(period: dict[str, Any], *keys: str) -> Decimal:
    for key in keys:
        val = period.get(key)
        if val is not None:
            return Decimal(str(val))
    return Decimal("0")


def compute_reading(
    meter: Meter,
    previous_value: Decimal | None,
    new_value: Decimal,
    new_date: date,
    previous_date: date | None,
    garden_meter: Meter | None = None,
    garden_previous_value: Decimal | None = None,
) -> ComputedReading:
    if previous_value is None:
        return ComputedReading(None, None, None, None, None)

    consumption = new_value - previous_value
    tariff = find_active_tariff(meter.tariff_history or [], new_date)
    if tariff is None:
        return ComputedReading(consumption, None, None, None, None)

    price_per_unit = get_decimal(tariff, "pricePerUnit", "price_per_unit")
    base_charge = get_decimal(tariff, "baseCharge", "base_charge")
    days = (new_date - previous_date).days if previous_date else 30

    energy_type = meter.type
    kwh: Decimal | None = None
    cost: Decimal | None = None
    wastewater_cost: Decimal | None = None

    if energy_type == "gas":
        cal_val = (
            Decimal(str(meter.calorific_value))
            if meter.calorific_value
            else _GAS_CALORIFIC_DEFAULT
        )
        z_num = (
            Decimal(str(meter.z_number)) if meter.z_number else _GAS_Z_NUMBER_DEFAULT
        )
        kwh = consumption * cal_val * z_num
        cost = kwh * price_per_unit + base_charge * Decimal(days) / Decimal(30)

    elif energy_type == "fernwarme":
        annual_base = get_decimal(tariff, "annualBasePrice", "annual_base_price")
        base_per_kw = get_decimal(tariff, "basePricePerKw", "base_price_per_kw")
        threshold_kw = get_decimal(
            tariff, "capacityThresholdKw", "capacity_threshold_kw"
        )
        connected_kw = (
            Decimal(str(meter.connected_load_kw))
            if meter.connected_load_kw
            else Decimal("0")
        )
        excess = max(Decimal("0"), connected_kw - threshold_kw)
        daily_fixed = (annual_base + excess * base_per_kw) / Decimal(365)
        cost = daily_fixed * Decimal(days) + consumption * price_per_unit

    elif energy_type == "water":
        wastewater_price = get_decimal(tariff, "wastewaterPrice", "wastewater_price")
        fresh_cost = consumption * price_per_unit + base_charge * Decimal(
            days
        ) / Decimal(30)
        if garden_meter is not None and garden_previous_value is not None:
            garden_consumption = new_value - garden_previous_value
            billable = max(Decimal("0"), consumption - garden_consumption)
        else:
            billable = consumption
        wastewater_cost = billable * wastewater_price
        return ComputedReading(
            consumption, kwh, fresh_cost, wastewater_cost, fresh_cost + wastewater_cost
        )

    else:
        cost = consumption * price_per_unit + base_charge * Decimal(days) / Decimal(30)

    return ComputedReading(consumption, kwh, cost, wastewater_cost, cost)


def recalculate_readings(meter: Meter, readings: list[Reading]) -> list[Reading]:
    """Recompute consumption + cost for all readings, chronologically."""
    sorted_readings = sorted(readings, key=lambda r: r.date)
    for i, reading in enumerate(sorted_readings):
        prev = sorted_readings[i - 1] if i > 0 else None
        computed = compute_reading(
            meter=meter,
            previous_value=Decimal(str(prev.value)) if prev else None,
            new_value=Decimal(str(reading.value)),
            new_date=reading.date,
            previous_date=prev.date if prev else None,
        )
        reading.consumption = computed.consumption
        reading.kwh = computed.kwh
        reading.cost = computed.cost
        reading.wastewater_cost = computed.wastewater_cost
        reading.total_cost = computed.total_cost
    return sorted_readings
