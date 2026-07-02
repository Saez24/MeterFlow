"""Import API service (contract §8)."""

from __future__ import annotations

import allure
from rest_framework.response import Response

from tests.api.client import HttpClient
from tests.models.schemas import ImportPayloadRequest


class ImportAPI:
    def __init__(self, client: HttpClient) -> None:
        self._client = client

    @allure.step("POST /import/")
    def run(self, body: ImportPayloadRequest) -> Response:
        return self._client.post("/import/", body)
