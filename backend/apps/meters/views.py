"""Meter endpoints (contract §3). Ownership-scoped ViewSet."""

from __future__ import annotations

from django.db.models import QuerySet
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.serializers import BaseSerializer

from apps.common.audit import record_audit
from apps.common.auth import request_user
from apps.common.permissions import IsOwner
from apps.meters.models import Meter
from apps.meters.serializers import MeterSerializer


class MeterViewSet(viewsets.ModelViewSet[Meter]):
    serializer_class = MeterSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self) -> QuerySet[Meter]:
        qs = Meter.objects.filter(user=request_user(self.request))
        if self.action == "list":
            params = self.request.query_params
            if params.get("active", "false").lower() in {"true", "1"}:
                qs = qs.filter(active=True)
            energy_type = params.get("type")
            if energy_type:
                qs = qs.filter(type=energy_type)
        return qs

    def perform_create(self, serializer: BaseSerializer[Meter]) -> None:
        meter = serializer.save(user=request_user(self.request))
        record_audit(
            action="meter.create",
            resource_type="meter",
            request=self.request,
            resource_id=meter.id,
        )

    def perform_update(self, serializer: BaseSerializer[Meter]) -> None:
        meter = serializer.save()
        record_audit(
            action="meter.update",
            resource_type="meter",
            request=self.request,
            resource_id=meter.id,
        )

    def perform_destroy(self, instance: Meter) -> None:
        meter_id = instance.id
        instance.delete()
        record_audit(
            action="meter.delete",
            resource_type="meter",
            request=self.request,
            resource_id=meter_id,
        )
