"""CO₂ factor serializers (contract §5)."""

from __future__ import annotations

from rest_framework import serializers

from apps.co2.models import Co2Factor


class Co2FactorSerializer(serializers.ModelSerializer[Co2Factor]):
    class Meta:
        model = Co2Factor
        fields = [
            "id",
            "energy_type",
            "factor_kg_per_unit",
            "unit",
            "source",
            "source_url",
            "valid_from",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class Co2FactorUpsertSerializer(serializers.Serializer[dict[str, object]]):
    energy_type = serializers.CharField()
    factor_kg_per_unit = serializers.DecimalField(max_digits=12, decimal_places=6)
    unit = serializers.CharField()
    source = serializers.CharField(default="", allow_blank=True)
    source_url = serializers.CharField(required=False, allow_null=True)
    valid_from = serializers.DateField()


class Co2DefaultSerializer(serializers.Serializer[dict[str, object]]):
    energy_type = serializers.CharField()
    factor_kg_per_unit = serializers.FloatField()
    unit = serializers.CharField()
    source = serializers.CharField()
