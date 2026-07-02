"""Statistics endpoints (contract §6)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.co2.models import Co2Factor
from apps.co2.services import calculate_co2
from apps.meters.models import Meter
from apps.readings.models import Reading
from apps.stats.services import (
    build_year_stats,
    get_budget_alerts,
    year_over_year_diff,
)


def _meter_map(meters: list[Meter]) -> dict[str, Meter]:
    return {str(m.id): m for m in meters}


def _readings_for_year(user_id: Any, year: int) -> list[Reading]:
    return list(
        Reading.objects.filter(user_id=user_id, date__year=year).order_by("date")
    )


class YearStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, year: int) -> Response:
        meters = list(Meter.objects.filter(user=request.user))
        readings = _readings_for_year(request.user.id, year)
        return Response(build_year_stats(year, readings, _meter_map(meters)))


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        today = date.today()
        year, month = today.year, today.month

        meters = list(Meter.objects.filter(user=request.user, active=True))
        user_factors = list(Co2Factor.objects.filter(user=request.user))
        meter_map = _meter_map(meters)

        stats_this = build_year_stats(
            year, _readings_for_year(request.user.id, year), meter_map
        )
        stats_prev = build_year_stats(
            year - 1, _readings_for_year(request.user.id, year - 1), meter_map
        )

        current_month = next(
            (m for m in stats_this["months"] if m["month"] == month), None
        )
        current_month_cost = (
            current_month["total_cost"] if current_month else Decimal("0")
        )

        current_month_co2 = Decimal("0")
        if current_month:
            for meter_id_str, ms in current_month["by_meter"].items():
                meter = meter_map.get(meter_id_str)
                if meter:
                    current_month_co2 += calculate_co2(
                        meter.type, ms["consumption"], user_factors
                    )

        alerts = get_budget_alerts(meters, current_month) if current_month else []
        yoy = year_over_year_diff(stats_this, stats_prev)

        return Response(
            {
                "current_month_cost": current_month_cost,
                "current_year_cost": stats_this["total_cost"],
                "current_month_co2_kg": current_month_co2,
                "budget_alerts": alerts,
                "year_over_year_percent": yoy[0] if yoy else None,
                "year_over_year_prev_year": yoy[1] if yoy else None,
            }
        )


class BudgetAlertsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        today = date.today()
        meters = list(Meter.objects.filter(user=request.user, active=True))
        readings = _readings_for_year(request.user.id, today.year)
        stats = build_year_stats(today.year, readings, _meter_map(meters))
        current_month = next(
            (m for m in stats["months"] if m["month"] == today.month), None
        )
        if current_month is None:
            return Response([])
        return Response(get_budget_alerts(meters, current_month))
