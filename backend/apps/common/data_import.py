"""Bulk import of meters + readings (contract §8).

Ported from the FastAPI ``routers/import_export.py``: idempotent by row id,
ownership-enforced (foreign rows → 403), with client-id → db-id mapping so
readings still resolve their meter when ids are regenerated.

The global camelCase parser converts the incoming ``meterId``/``wastewaterCost``/…
keys to snake_case before these serializers see them.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from django.db import transaction
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.common.auth import request_user
from apps.meters.models import Meter
from apps.readings.models import Reading

_MAX_METERS = 10000
_MAX_READINGS = 50000


class ImportMeterSerializer(serializers.Serializer[dict[str, Any]]):
    id = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField()
    type = serializers.CharField()
    unit = serializers.CharField()
    icon = serializers.CharField()
    color = serializers.CharField()
    active = serializers.BooleanField(default=True)
    meter_number = serializers.CharField(
        required=False, allow_null=True, allow_blank=True
    )
    provider = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    # FloatField (not DecimalField): imported data carries float rounding noise
    # (>6 decimals). The model's numeric(20,6) column quantizes on save.
    calorific_value = serializers.FloatField(required=False, allow_null=True)
    z_number = serializers.FloatField(required=False, allow_null=True)
    connected_load_kw = serializers.FloatField(required=False, allow_null=True)
    linked_water_meter_id = serializers.UUIDField(required=False, allow_null=True)
    tariff_history = serializers.ListField(default=list)
    budget = serializers.DictField(required=False, allow_null=True)


class ImportReadingSerializer(serializers.Serializer[dict[str, Any]]):
    id = serializers.UUIDField(required=False, allow_null=True)
    meter_id = serializers.CharField()
    # FloatField tolerates client-computed float noise; the DB rounds to 6 places.
    value = serializers.FloatField()
    date = serializers.CharField()
    consumption = serializers.FloatField(required=False, allow_null=True)
    kwh = serializers.FloatField(required=False, allow_null=True)
    cost = serializers.FloatField(required=False, allow_null=True)
    wastewater_cost = serializers.FloatField(required=False, allow_null=True)
    total_cost = serializers.FloatField(required=False, allow_null=True)
    # Exports carry empty-string notes → allow blank, not just null.
    note = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    photo = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class ImportPayloadSerializer(serializers.Serializer[dict[str, Any]]):
    meters = ImportMeterSerializer(many=True, default=list)
    readings = ImportReadingSerializer(many=True, default=list)

    def validate_meters(self, value: list[Any]) -> list[Any]:
        if len(value) > _MAX_METERS:
            raise ValidationError(f"Too many meters (max {_MAX_METERS}).")
        return value

    def validate_readings(self, value: list[Any]) -> list[Any]:
        if len(value) > _MAX_READINGS:
            raise ValidationError(f"Too many readings (max {_MAX_READINGS}).")
        return value


def _fix_encoding(text: str) -> str:
    """Repair legacy latin-1/utf-8 mojibake in imported units."""
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def _parse_date(date_str: str) -> date:
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00")).date()
    except (ValueError, TypeError) as exc:
        raise ValidationError("Ungültiges Datumsformat im Import") from exc


def _import_meters(
    user: User, meters: list[dict[str, Any]]
) -> tuple[dict[str, uuid.UUID], int, int]:
    id_map: dict[str, uuid.UUID] = {}
    added = 0
    skipped = 0
    # (meter db_id, linked original id) — resolved in a second pass so the link
    # target may appear anywhere in the batch (order-independent).
    pending_links: list[tuple[uuid.UUID, str]] = []

    for m in meters:
        original_id = str(m["id"]) if m.get("id") else None
        db_id = m.get("id") or uuid.uuid4()

        existing = Meter.objects.filter(id=db_id).first()
        if existing is not None:
            if existing.user_id != user.id:
                raise PermissionDenied("Meter nicht gefunden oder kein Zugriff")
            if original_id:
                id_map[original_id] = db_id
            skipped += 1
            continue

        # Link is applied in the second pass; create without it for now.
        Meter.objects.create(
            id=db_id,
            user=user,
            name=m["name"],
            type=m["type"],
            unit=_fix_encoding(m["unit"]),
            icon=m["icon"],
            color=m["color"],
            active=m.get("active", True),
            archived=False,
            meter_number=m.get("meter_number"),
            provider=m.get("provider"),
            notes=m.get("notes"),
            calorific_value=m.get("calorific_value"),
            z_number=m.get("z_number"),
            connected_load_kw=m.get("connected_load_kw"),
            linked_water_meter_id=None,
            tariff_history=m.get("tariff_history", []),
            budget=m.get("budget"),
        )
        if original_id:
            id_map[original_id] = db_id
        linked_id = m.get("linked_water_meter_id")
        if linked_id is not None:
            pending_links.append((db_id, str(linked_id)))
        added += 1

    # Second pass: resolve linked water meters (mapped id or an existing own one).
    for meter_db_id, linked_original in pending_links:
        target = id_map.get(linked_original, linked_original)
        if not Meter.objects.filter(id=target, user=user).exists():
            raise PermissionDenied(
                "Verlinkter Wasserzähler nicht gefunden oder kein Zugriff"
            )
        Meter.objects.filter(id=meter_db_id).update(linked_water_meter_id=target)

    return id_map, added, skipped


def _resolve_meter_id(user: User, raw: str, id_map: dict[str, uuid.UUID]) -> uuid.UUID:
    if raw in id_map:
        return id_map[raw]
    try:
        meter_id = uuid.UUID(raw)
    except ValueError as exc:
        raise ValidationError("Ungültige meter_id im Import-Payload") from exc
    if not Meter.objects.filter(id=meter_id, user=user).exists():
        raise PermissionDenied("Meter nicht gefunden oder kein Zugriff")
    return meter_id


def _import_readings(
    user: User, readings: list[dict[str, Any]], id_map: dict[str, uuid.UUID]
) -> tuple[int, int]:
    added = 0
    skipped = 0

    for r in readings:
        db_id = r.get("id") or uuid.uuid4()
        existing = Reading.objects.filter(id=db_id).first()
        if existing is not None:
            if existing.user_id != user.id:
                raise PermissionDenied("Ablesung nicht gefunden oder kein Zugriff")
            skipped += 1
            continue

        meter_id = _resolve_meter_id(user, r["meter_id"], id_map)
        Reading.objects.create(
            id=db_id,
            user=user,
            meter_id=meter_id,
            date=_parse_date(r["date"]),
            value=r["value"],
            consumption=r.get("consumption"),
            kwh=r.get("kwh"),
            cost=r.get("cost"),
            wastewater_cost=r.get("wastewater_cost"),
            total_cost=r.get("total_cost"),
            note=r.get("note") or None,
            photo=r.get("photo"),
        )
        added += 1

    return added, skipped


@method_decorator(
    ratelimit(key="ip", rate="5/m", method="POST", block=False), name="post"
)
class ImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Too many requests"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        user = request_user(request)
        serializer = ImportPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            id_map, meters_added, meters_skipped = _import_meters(user, data["meters"])
            readings_added, readings_skipped = _import_readings(
                user, data["readings"], id_map
            )

        return Response(
            {
                "meters_added": meters_added,
                "meters_skipped": meters_skipped,
                "readings_added": readings_added,
                "readings_skipped": readings_skipped,
            }
        )
