from __future__ import annotations

from rest_framework.routers import DefaultRouter

from apps.meters.views import MeterViewSet

router = DefaultRouter()
router.register("meters", MeterViewSet, basename="meter")

urlpatterns = router.urls
