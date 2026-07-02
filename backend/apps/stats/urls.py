from __future__ import annotations

from django.urls import path

from apps.stats.views import BudgetAlertsView, DashboardView, YearStatsView

urlpatterns = [
    path("stats/year/<int:year>", YearStatsView.as_view(), name="stats-year"),
    path("stats/dashboard", DashboardView.as_view(), name="stats-dashboard"),
    path("stats/budget-alerts", BudgetAlertsView.as_view(), name="stats-budget-alerts"),
]
