from __future__ import annotations

from django.urls import path

from apps.co2.views import (
    Co2DefaultsView,
    Co2FactorDeleteView,
    Co2FactorListUpsertView,
)

urlpatterns = [
    path("co2-factors/defaults", Co2DefaultsView.as_view(), name="co2-defaults"),
    path("co2-factors/", Co2FactorListUpsertView.as_view(), name="co2-list-upsert"),
    path(
        "co2-factors/<uuid:factor_id>",
        Co2FactorDeleteView.as_view(),
        name="co2-delete",
    ),
]
