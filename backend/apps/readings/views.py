"""Reading endpoints (contract §4). Derived values computed server-side."""

from __future__ import annotations

from datetime import date as date_cls

from django.db.models import QuerySet
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.common.permissions import IsOwner
from apps.meters.models import Meter
from apps.readings.models import Reading
from apps.readings.serializers import ReadingSerializer
from apps.readings.services import compute_reading, recalculate_readings

_DEFAULT_LIMIT = 1000
_MAX_LIMIT = 10000


def _clamp_limit(raw: str | None) -> int:
    try:
        value = int(raw) if raw is not None else _DEFAULT_LIMIT
    except (TypeError, ValueError):
        return _DEFAULT_LIMIT
    return max(1, min(value, _MAX_LIMIT))


class ReadingViewSet(viewsets.ModelViewSet[Reading]):
    serializer_class = ReadingSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self) -> QuerySet[Reading]:
        qs = Reading.objects.filter(user=self.request.user).select_related("meter")
        if self.action != "list":
            return qs

        params = self.request.query_params
        meter_id = params.get("meter_id")
        limit = _clamp_limit(params.get("limit"))
        if meter_id:
            qs = qs.filter(meter_id=meter_id)
            year = params.get("year")
            if year and year.isdigit():
                qs = qs.filter(date__year=int(year))
            cursor = params.get("cursor")
            if cursor:
                try:
                    qs = qs.filter(date__lt=date_cls.fromisoformat(cursor))
                except ValueError:
                    pass
        return qs.order_by("-date")[:limit]

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        meter_id = request.data.get("meter_id")
        if not meter_id:
            return Response(
                {"detail": "meter_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        meter = Meter.objects.filter(id=meter_id, user=request.user).first()
        if meter is None:
            return Response(
                {"detail": "Meter not found"}, status=status.HTTP_404_NOT_FOUND
            )

        data = serializer.validated_data
        prev = (
            Reading.objects.filter(
                meter=meter, user=request.user, date__lt=data["date"]
            )
            .order_by("-date")
            .first()
        )
        computed = compute_reading(
            meter=meter,
            previous_value=prev.value if prev else None,
            new_value=data["value"],
            new_date=data["date"],
            previous_date=prev.date if prev else None,
        )
        serializer.save(
            user=request.user,
            meter=meter,
            consumption=computed.consumption,
            kwh=computed.kwh,
            cost=computed.cost,
            wastewater_cost=computed.wastewater_cost,
            total_cost=computed.total_cost,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["post"],
        url_path="recalculate/(?P<meter_id>[0-9a-fA-F-]+)",
    )
    def recalculate(self, request: Request, meter_id: str) -> Response:
        meter = Meter.objects.filter(id=meter_id, user=request.user).first()
        if meter is None:
            return Response(
                {"detail": "Meter not found"}, status=status.HTTP_404_NOT_FOUND
            )
        readings = list(
            Reading.objects.filter(meter=meter, user=request.user)[:_MAX_LIMIT]
        )
        updated = recalculate_readings(meter, readings)
        Reading.objects.bulk_update(
            updated,
            ["consumption", "kwh", "cost", "wastewater_cost", "total_cost"],
        )
        return Response(ReadingSerializer(updated, many=True).data)
