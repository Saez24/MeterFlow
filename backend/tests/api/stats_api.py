"""Stats API service (contract §6)."""

from __future__ import annotations

import allure
from rest_framework.response import Response

from tests.api.client import HttpClient


class StatsAPI:
    def __init__(self, client: HttpClient) -> None:
        self._client = client

    @allure.step("GET /stats/year/{year}")
    def year(self, year: int) -> Response:
        return self._client.get(f"/stats/year/{year}")

    @allure.step("GET /stats/dashboard")
    def dashboard(self) -> Response:
        return self._client.get("/stats/dashboard")

    @allure.step("GET /stats/budget-alerts")
    def budget_alerts(self) -> Response:
        return self._client.get("/stats/budget-alerts")
