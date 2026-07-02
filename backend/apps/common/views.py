"""Health check + runtime config endpoint (contract §1, §7)."""

from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest, JsonResponse
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


def health(_request: HttpRequest) -> JsonResponse:
    """Public, unauthenticated liveness probe."""
    return JsonResponse({"status": "ok"})


class ConfigView(APIView):
    """GET /api/v1/config/ — reports the active runtime configuration."""

    def get(self, _request: Request) -> Response:
        backend = settings.STORAGE_BACKEND
        return Response(
            {
                "storage_backend": backend,
                "storage_enabled": backend != "none",
                "auth_provider": "jwt_cookie",
                "database": "postgresql",
                "version": "0.1.0",
            }
        )
