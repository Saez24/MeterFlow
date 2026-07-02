"""Root URL configuration.

All API routes live under ``/api/v1``; ``/health`` is unprefixed and public
(contract §1).
"""

from __future__ import annotations

from django.contrib import admin
from django.urls import include, path

from apps.common.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health, name="health"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.meters.urls")),
    path("api/v1/", include("apps.readings.urls")),
    path("api/v1/", include("apps.co2.urls")),
    path("api/v1/", include("apps.stats.urls")),
    path("api/v1/", include("apps.common.urls")),
]
