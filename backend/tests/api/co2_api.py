"""CO₂ factors API service (contract §5)."""

from __future__ import annotations

import uuid

import allure
from rest_framework.response import Response

from tests.api.client import HttpClient
from tests.models.schemas import Co2FactorUpsertRequest


class Co2API:
    def __init__(self, client: HttpClient) -> None:
        self._client = client

    @allure.step("GET /co2-factors/defaults")
    def defaults(self) -> Response:
        return self._client.get("/co2-factors/defaults")

    @allure.step("GET /co2-factors/")
    def list(self) -> Response:
        return self._client.get("/co2-factors/")

    @allure.step("PUT /co2-factors/")
    def upsert(self, body: Co2FactorUpsertRequest) -> Response:
        return self._client.put("/co2-factors/", body)

    @allure.step("DELETE /co2-factors/{factor_id}")
    def delete(self, factor_id: uuid.UUID) -> Response:
        return self._client.delete(f"/co2-factors/{factor_id}")
