"""Reading serializer (contract §4). Derived fields + meter link are read-only;
they are set server-side in the view."""

from __future__ import annotations

from rest_framework import serializers

from apps.meters.models import Meter
from apps.readings.models import Reading


class ReadingSerializer(serializers.ModelSerializer[Reading]):
    meter_id: serializers.PrimaryKeyRelatedField[Meter] = (
        serializers.PrimaryKeyRelatedField(source="meter", read_only=True)
    )
    # `photo` stores an internal storage key; expose the authenticated,
    # ownership-checked endpoint URL instead of a public /media path (§4).
    photo = serializers.SerializerMethodField()

    class Meta:
        model = Reading
        fields = [
            "id",
            "meter_id",
            "date",
            "value",
            "consumption",
            "kwh",
            "cost",
            "wastewater_cost",
            "total_cost",
            "note",
            "photo",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "meter_id",
            "consumption",
            "kwh",
            "cost",
            "wastewater_cost",
            "total_cost",
            "created_at",
        ]

    def get_photo(self, obj: Reading) -> str | None:
        return f"/api/v1/readings/{obj.id}/photo/" if obj.photo else None
