from __future__ import annotations

from rest_framework.routers import DefaultRouter

from apps.readings.views import ReadingViewSet

router = DefaultRouter()
router.register("readings", ReadingViewSet, basename="reading")

urlpatterns = router.urls
