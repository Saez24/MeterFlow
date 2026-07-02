"""Meters API service (contract §3)."""

from __future__ import annotations

import uuid

import allure
from rest_framework.response import Response

from tests.api.client import HttpClient
from tests.models.schemas import MeterCreateRequest


class MetersAPI:
    def __init__(self, client: HttpClient) -> None:
        self._client = client

    @allure.step("GET /meters/")
    def list(self, *, active: bool | None = None, type: str | None = None) -> Response:
        query = []
        if active is not None:
            query.append(f"active={'true' if active else 'false'}")
        if type is not None:
            query.append(f"type={type}")
        suffix = f"?{'&'.join(query)}" if query else ""
        return self._client.get(f"/meters/{suffix}")

    @allure.step("POST /meters/")
    def create(self, body: MeterCreateRequest) -> Response:
        return self._client.post("/meters/", body)

    @allure.step("GET /meters/{meter_id}")
    def get(self, meter_id: uuid.UUID) -> Response:
        return self._client.get(f"/meters/{meter_id}/")

    @allure.step("DELETE /meters/{meter_id}")
    def delete(self, meter_id: uuid.UUID) -> Response:
        return self._client.delete(f"/meters/{meter_id}/")
