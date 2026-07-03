"""Readings API service (contract §4)."""

from __future__ import annotations

import uuid
from typing import Any

import allure
from rest_framework.response import Response

from tests.api.client import HttpClient
from tests.models.schemas import ReadingCreateRequest


class ReadingsAPI:
    def __init__(self, client: HttpClient) -> None:
        self._client = client

    @allure.step("GET /readings/")
    def list(self, *, meter_id: uuid.UUID | None = None) -> Response:
        suffix = f"?meter_id={meter_id}" if meter_id is not None else ""
        return self._client.get(f"/readings/{suffix}")

    @allure.step("POST /readings/")
    def create(self, body: ReadingCreateRequest) -> Response:
        return self._client.post("/readings/", body)

    @allure.step("POST /readings/recalculate/{meter_id}")
    def recalculate(self, meter_id: uuid.UUID) -> Response:
        return self._client.post(f"/readings/recalculate/{meter_id}/")

    @allure.step("POST /readings/{reading_id}/photo")
    def upload_photo(self, reading_id: uuid.UUID, file_obj: Any) -> Response:
        return self._client.upload(f"/readings/{reading_id}/photo/", file_obj)

    @allure.step("GET /readings/{reading_id}/photo")
    def get_photo(self, reading_id: uuid.UUID) -> Response:
        return self._client.get(f"/readings/{reading_id}/photo/")

    @allure.step("DELETE /readings/{reading_id}/photo")
    def delete_photo(self, reading_id: uuid.UUID) -> Response:
        return self._client.delete(f"/readings/{reading_id}/photo/")
