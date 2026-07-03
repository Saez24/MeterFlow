"""Meter serializer (contract §3). Field names stay snake_case; the camelCase
renderer/parser converts at the API boundary."""

from __future__ import annotations

from typing import Any, cast

from rest_framework import serializers

from apps.meters.models import Meter


class MeterSerializer(serializers.ModelSerializer[Meter]):
    # Exposed as ``linkedWaterMeterId``; scoped to the user's own meters below.
    linked_water_meter_id = serializers.PrimaryKeyRelatedField(
        source="linked_water_meter",
        queryset=Meter.objects.none(),
        required=False,
        allow_null=True,
    )

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
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            # Prevent linking to another user's meter (ownership, contract §1).
            field = cast(
                "serializers.PrimaryKeyRelatedField[Meter]",
                self.fields["linked_water_meter_id"],
            )
            field.queryset = Meter.objects.filter(user=request.user)
