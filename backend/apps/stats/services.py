"""Statistics aggregation — ported from the FastAPI ``services/stats.py`` +
``services/budget.py`` (contract §6). Runs in Python over pre-fetched rows to
avoid N+1; output dicts use snake_case (camelCase renderer converts)."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from apps.meters.models import Meter
    from apps.readings.models import Reading

_MONTH_LABELS = (
    "Jan",
    "Feb",
    "Mär",
    "Apr",
    "Mai",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dez",
)


def build_year_stats(
    year: int, readings: list[Reading], meters: dict[str, Meter]
) -> dict[str, Any]:
    monthly: dict[int, dict[str, dict[str, Any]]] = defaultdict(dict)
    by_meter: dict[str, dict[str, Decimal]] = {}

    for reading in readings:
        if reading.total_cost is None:
            continue
        meter_id = str(reading.meter_id)
        meter = meters.get(meter_id)
        unit = meter.unit if meter else ""
        month = reading.date.month
        cost = Decimal(str(reading.total_cost))
        consumption = Decimal(str(reading.consumption or 0))

        existing = monthly[month].get(meter_id)
        if existing:
            existing["consumption"] += consumption
            existing["cost"] += cost
        else:
            monthly[month][meter_id] = {
                "consumption": consumption,
                "cost": cost,
                "unit": unit,
            }

        yr = by_meter.get(meter_id)
        if yr:
            yr["consumption"] += consumption
            yr["cost"] += cost
        else:
            by_meter[meter_id] = {"consumption": consumption, "cost": cost}

    months = [
        {
            "year": year,
            "month": m,
            "label": f"{_MONTH_LABELS[m - 1]} {str(year)[2:]}",
            "by_meter": monthly.get(m, {}),
            "total_cost": sum(
                (s["cost"] for s in monthly.get(m, {}).values()), Decimal("0")
            ),
        }
        for m in range(1, 13)
    ]
    total_cost = sum((s["cost"] for s in by_meter.values()), Decimal("0"))
    return {
        "year": year,
        "total_cost": total_cost,
        "by_meter": by_meter,
        "months": months,
    }


def year_over_year_diff(
    current_stats: dict[str, Any], prev_stats: dict[str, Any]
) -> tuple[Decimal, int] | None:
    max_month = max(
        (m["month"] for m in current_stats["months"] if m["total_cost"] > 0),
        default=None,
    )
    if max_month is None:
        return None

    prev_cost = sum(
        (m["total_cost"] for m in prev_stats["months"] if m["month"] <= max_month),
        Decimal("0"),
    )
    if prev_cost == Decimal("0"):
        return None
    current_cost = sum(
        (m["total_cost"] for m in current_stats["months"] if m["month"] <= max_month),
        Decimal("0"),
    )
    percent = (current_cost - prev_cost) / prev_cost * Decimal("100")
    return percent, prev_stats["year"]


def _decimal_or_none(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    try:
        return Decimal(str(raw))
    except (ArithmeticError, ValueError, TypeError):
        return None


def get_budget_alerts(
    meters: list[Meter], month_stats: dict[str, Any]
) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    for meter in meters:
        if not meter.budget:
            continue
        budget: dict[str, Any] = meter.budget
        alert_at = _decimal_or_none(
            budget.get("alertAt", budget.get("alert_at"))
        ) or Decimal("80")
        monthly_limit = _decimal_or_none(
            budget.get("monthlyLimit", budget.get("monthly_limit"))
        )
        consumption_limit = _decimal_or_none(
            budget.get("consumptionLimit", budget.get("consumption_limit"))
        )

        meter_stats = month_stats["by_meter"].get(str(meter.id))
        if meter_stats is None:
            continue

        if monthly_limit is not None:
            current = meter_stats["cost"]
            percent = (
                current / monthly_limit * Decimal("100")
                if monthly_limit > 0
                else Decimal("0")
            )
            if percent >= alert_at:
                alerts.append(
                    _alert(meter, "monthly_cost", current, monthly_limit, percent, "€")
                )

        if consumption_limit is not None:
            current = meter_stats["consumption"]
            percent = (
                current / consumption_limit * Decimal("100")
                if consumption_limit > 0
                else Decimal("0")
            )
            if percent >= alert_at:
                alerts.append(
                    _alert(
                        meter,
                        "consumption",
                        current,
                        consumption_limit,
                        percent,
                        meter.unit,
                    )
                )
    return alerts


def _alert(
    meter: Meter,
    alert_type: str,
    current: Decimal,
    limit: Decimal,
    percent: Decimal,
    unit: str,
) -> dict[str, Any]:
    return {
        "meter_id": str(meter.id),
        "meter_name": meter.name,
        "type": alert_type,
        "current": current,
        "limit": limit,
        "percent": percent,
        "unit": unit,
        "color": meter.color,
        "critical": percent >= Decimal("100"),
    }
