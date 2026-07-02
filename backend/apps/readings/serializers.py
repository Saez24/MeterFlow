"""Reading serializer (contract §4). Derived fields + meter link are read-only;
they are set server-side in the view."""

from __future__ import annotations

from rest_framework import serializers

from apps.readings.models import Reading


class ReadingSerializer(serializers.ModelSerializer[Reading]):
    meter_id = serializers.PrimaryKeyRelatedField(source="meter", read_only=True)

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
            "photo",
            "created_at",
        ]
