"""Reading endpoints (contract §4). Derived values computed server-side."""

from __future__ import annotations

import logging
import mimetypes
import uuid
from datetime import date as date_cls
from pathlib import Path

from django.core.exceptions import SuspiciousFileOperation
from django.core.files.storage import default_storage
from django.db.models import QuerySet
from django.http import FileResponse, HttpResponseBase
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from apps.common.audit import record_audit
from apps.common.auth import request_user
from apps.common.permissions import IsOwner
from apps.meters.models import Meter
from apps.readings.models import Reading
from apps.readings.serializers import ReadingSerializer
from apps.readings.services import compute_reading, recalculate_readings

logger = logging.getLogger(__name__)

_DEFAULT_LIMIT = 1000
_MAX_LIMIT = 10000

# Photo upload constraints (security-standards §3: content-type + size limits).
_ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
_ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
_MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MiB


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
        qs = Reading.objects.filter(user=request_user(self.request)).select_related(
            "meter"
        )
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
        user = request_user(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        meter_id = request.data.get("meter_id")
        if not meter_id:
            return Response(
                {"detail": "meter_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        meter = Meter.objects.filter(id=meter_id, user=user).first()
        if meter is None:
            return Response(
                {"detail": "Meter not found"}, status=status.HTTP_404_NOT_FOUND
            )

        data = serializer.validated_data
        prev = (
            Reading.objects.filter(meter=meter, user=user, date__lt=data["date"])
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
        reading = serializer.save(
            user=user,
            meter=meter,
            consumption=computed.consumption,
            kwh=computed.kwh,
            cost=computed.cost,
            wastewater_cost=computed.wastewater_cost,
            total_cost=computed.total_cost,
        )
        record_audit(
            action="reading.create",
            resource_type="reading",
            request=request,
            resource_id=reading.id,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer: BaseSerializer[Reading]) -> None:
        reading = serializer.save()
        record_audit(
            action="reading.update",
            resource_type="reading",
            request=self.request,
            resource_id=reading.id,
        )

    def perform_destroy(self, instance: Reading) -> None:
        reading_id = instance.id
        instance.delete()
        record_audit(
            action="reading.delete",
            resource_type="reading",
            request=self.request,
            resource_id=reading_id,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="recalculate/(?P<meter_id>[0-9a-fA-F-]+)",
    )
    def recalculate(self, request: Request, meter_id: str) -> Response:
        user = request_user(request)
        meter = Meter.objects.filter(id=meter_id, user=user).first()
        if meter is None:
            return Response(
                {"detail": "Meter not found"}, status=status.HTTP_404_NOT_FOUND
            )
        readings = list(Reading.objects.filter(meter=meter, user=user)[:_MAX_LIMIT])
        updated = recalculate_readings(meter, readings)
        Reading.objects.bulk_update(
            updated,
            ["consumption", "kwh", "cost", "wastewater_cost", "total_cost"],
        )
        return Response(ReadingSerializer(updated, many=True).data)

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="photo",
        parser_classes=[MultiPartParser, FormParser],
    )
    def photo(self, request: Request, pk: str | None = None) -> HttpResponseBase:
        # get_object() is scoped to the user -> a foreign reading yields 404,
        # so the photo is never served/replaced/removed across users (§4).
        reading = self.get_object()
        if request.method == "GET":
            return self._serve_photo(reading)
        if request.method == "DELETE":
            return self._delete_photo(request, reading)
        return self._upload_photo(request, reading)

    def _delete_photo(self, request: Request, reading: Reading) -> HttpResponseBase:
        if reading.photo:
            try:
                default_storage.delete(reading.photo)
            except (OSError, SuspiciousFileOperation) as exc:
                logger.warning("photo.delete_failed key=%s err=%s", reading.photo, exc)
            reading.photo = None
            reading.save(update_fields=["photo"])
            record_audit(
                action="reading.photo_delete",
                resource_type="reading",
                request=request,
                resource_id=reading.id,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _serve_photo(self, reading: Reading) -> HttpResponseBase:
        if not reading.photo:
            return Response({"detail": "No photo"}, status=status.HTTP_404_NOT_FOUND)
        try:
            handle = default_storage.open(reading.photo, "rb")
        except (FileNotFoundError, SuspiciousFileOperation):
            # SuspiciousFileOperation guards against a malformed/traversal key on
            # any legacy row — treat as "no photo" rather than a 500.
            return Response({"detail": "No photo"}, status=status.HTTP_404_NOT_FOUND)
        content_type = (
            mimetypes.guess_type(reading.photo)[0] or "application/octet-stream"
        )
        return FileResponse(handle, content_type=content_type)

    def _upload_photo(self, request: Request, reading: Reading) -> HttpResponseBase:
        upload = request.FILES.get("file")
        if upload is None:
            return Response(
                {"detail": "No file provided"}, status=status.HTTP_400_BAD_REQUEST
            )
        extension = Path(upload.name or "").suffix.lower()
        if (
            upload.content_type not in _ALLOWED_PHOTO_TYPES
            or extension not in _ALLOWED_PHOTO_EXTENSIONS
        ):
            return Response(
                {"detail": "Unsupported image type"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload.size > _MAX_PHOTO_BYTES:
            return Response(
                {"detail": "Image too large"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        if reading.photo:
            try:
                default_storage.delete(reading.photo)
            except (OSError, SuspiciousFileOperation) as exc:
                logger.warning("photo.delete_failed key=%s err=%s", reading.photo, exc)

        name = f"readings/{reading.id}/{uuid.uuid4().hex}{extension}"
        # `photo` holds the internal storage key; the serializer exposes it as an
        # authenticated endpoint URL, never a public /media path.
        reading.photo = default_storage.save(name, upload)
        reading.save(update_fields=["photo"])
        record_audit(
            action="reading.photo_upload",
            resource_type="reading",
            request=request,
            resource_id=reading.id,
        )
        return Response(self.get_serializer(reading).data)
