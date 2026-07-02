"""CO₂ factor endpoints (contract §5)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.co2.defaults import CO2_DEFAULTS, CO2_SOURCE
from apps.co2.models import Co2Factor
from apps.co2.serializers import (
    Co2DefaultSerializer,
    Co2FactorSerializer,
    Co2FactorUpsertSerializer,
)
from apps.common.auth import request_user


class Co2DefaultsView(APIView):
    """GET /co2-factors/defaults — public reference factors."""

    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    def get(self, _request: Request) -> Response:
        payload = [
            {
                "energy_type": d.energy_type,
                "factor_kg_per_unit": d.factor_kg_per_unit,
                "unit": d.unit,
                "source": CO2_SOURCE,
            }
            for d in CO2_DEFAULTS
        ]
        return Response(Co2DefaultSerializer(payload, many=True).data)  # type: ignore[arg-type]


class Co2FactorListUpsertView(APIView):
    """GET (list user factors) / PUT (upsert by energy_type + valid_from)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        factors = Co2Factor.objects.filter(user=request_user(request))
        return Response(Co2FactorSerializer(factors, many=True).data)

    def put(self, request: Request) -> Response:
        serializer = Co2FactorUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        factor, _created = Co2Factor.objects.update_or_create(
            user=request_user(request),
            energy_type=data["energy_type"],
            valid_from=data["valid_from"],
            defaults={
                "factor_kg_per_unit": data["factor_kg_per_unit"],
                "unit": data["unit"],
                "source": data.get("source", ""),
                "source_url": data.get("source_url"),
            },
        )
        return Response(Co2FactorSerializer(factor).data, status=status.HTTP_200_OK)


class Co2FactorDeleteView(APIView):
    """DELETE /co2-factors/{id}."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, factor_id: str) -> Response:
        deleted, _ = Co2Factor.objects.filter(
            id=factor_id, user=request_user(request)
        ).delete()
        if not deleted:
            return Response(
                {"detail": "CO2 factor not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
