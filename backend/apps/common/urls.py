from __future__ import annotations

from django.urls import path

from apps.common.views import ConfigView

urlpatterns = [
    path("config/", ConfigView.as_view(), name="config"),
]
