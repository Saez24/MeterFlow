"""Meter serializer (contract §3). Field names stay snake_case; the camelCase
renderer/parser converts at the API boundary."""

from __future__ import annotations

from itertools import pairwise
from typing import Any

from django.db.models import QuerySet
from rest_framework import serializers

from apps.meters.models import Meter
from apps.meters.services import is_linked_garden_water

MAX_ADVANCE_PAYMENT_YEARS = 50
# Payment rhythm in months: monthly or quarterly.
ADVANCE_PAYMENT_INTERVALS = [(1, "monthly"), (3, "quarterly")]


class AdvancePaymentSerializer(serializers.Serializer[dict[str, Any]]):
    """One monthly advance payment (Abschlag); ``amount`` null counts as 0 €."""

    month = serializers.IntegerField(min_value=1, max_value=12)
    amount = serializers.FloatField(
        min_value=0, max_value=1_000_000, allow_null=True, required=False
    )

    def validate_amount(self, value: float | None) -> float | None:
        return None if value is None else round(value, 2)


class AdvancePaymentYearSerializer(serializers.Serializer[dict[str, Any]]):
    """All advance payments of one calendar year plus the estimated consumption."""

    year = serializers.IntegerField(min_value=2000, max_value=2100)
    estimated_consumption = serializers.FloatField(min_value=0, max_value=1e9)
    # Water only: garden water does not go into the sewer, so it is deducted
    # from the wastewater (same rule as the dashboard water bill).
    estimated_garden_consumption = serializers.FloatField(
        min_value=0, max_value=1e9, required=False, allow_null=True
    )
    interval = serializers.ChoiceField(choices=ADVANCE_PAYMENT_INTERVALS, default=1)
    payments = serializers.ListField(
        child=AdvancePaymentSerializer(), min_length=1, max_length=12
    )

    def validate_estimated_consumption(self, value: float) -> float:
        if value <= 0:
            raise serializers.ValidationError("Muss größer als 0 sein.")
        return value

    def validate_payments(self, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        months = [p["month"] for p in value]
        if len(months) != len(set(months)):
            raise serializers.ValidationError("Jeder Monat darf nur einmal vorkommen.")
        return [
            {"month": p["month"], "amount": p.get("amount")}
            for p in sorted(value, key=lambda p: p["month"])
        ]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        garden = attrs.get("estimated_garden_consumption")
        if garden is not None and garden > attrs["estimated_consumption"]:
            raise serializers.ValidationError(
                {
                    "estimated_garden_consumption": (
                        "Darf nicht größer als der Jahresverbrauch sein."
                    )
                }
            )
        # Payments follow the rhythm: e.g. quarterly from February = 2, 5, 8, 11.
        months = [p["month"] for p in attrs["payments"]]
        interval = attrs["interval"]
        if any(b - a != interval for a, b in pairwise(months)):
            raise serializers.ValidationError(
                {"payments": "Die Monate passen nicht zum Zahlungsrhythmus."}
            )
        return attrs


class AdvancePaymentsField(serializers.ListField):
    """List of per-year entries: unique years, stored sorted by year."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("max_length", MAX_ADVANCE_PAYMENT_YEARS)
        super().__init__(child=AdvancePaymentYearSerializer(), **kwargs)

    def to_internal_value(self, data: Any) -> list[dict[str, Any]]:
        value: list[dict[str, Any]] = super().to_internal_value(data)
        years = [entry["year"] for entry in value]
        if len(years) != len(set(years)):
            raise serializers.ValidationError("Jedes Jahr darf nur einmal vorkommen.")
        return sorted(value, key=lambda entry: entry["year"])


class OwnMeterField(serializers.PrimaryKeyRelatedField[Meter]):
    """Primary key of one of the requesting user's meters.

    Scoping in ``get_queryset`` keeps a foreign id from resolving, so linking to
    another user's meter fails like an unknown id (ownership, contract §1).
    """

    def get_queryset(self) -> QuerySet[Meter]:
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return Meter.objects.none()
        return Meter.objects.filter(user=request.user)


class MeterSerializer(serializers.ModelSerializer[Meter]):
    # Exposed as ``linkedWaterMeterId``; only the user's own meters resolve.
    linked_water_meter_id = OwnMeterField(
        source="linked_water_meter",
        required=False,
        allow_null=True,
    )
    advance_payments = AdvancePaymentsField(required=False)

    class Meta:
        model = Meter
        fields = [
            "id",
            "name",
            "type",
            "unit",
            "icon",
            "color",
            "active",
            "archived",
            "meter_number",
            "provider",
            "notes",
            "calorific_value",
            "z_number",
            "connected_load_kw",
            "linked_water_meter_id",
            "tariff_history",
            "budget",
            "advance_payments",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs.get("advance_payments"):
            instance = self.instance
            meter_type = attrs.get("type", instance.type if instance else None)
            linked = attrs.get(
                "linked_water_meter",
                instance.linked_water_meter if instance else None,
            )
            if is_linked_garden_water(meter_type, linked):
                raise serializers.ValidationError(
                    {
                        "advance_payments": (
                            "Ein verknüpfter Gartenwasserzähler hat keine "
                            "eigenen Abschläge."
                        )
                    }
                )
        return attrs
