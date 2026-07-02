"""Thin HTTP wrapper over DRF's APIClient.

Centralises the ``/api/v1`` base path, JSON encoding of Pydantic bodies and
Allure attachments. Cookies persist across calls on one client instance, so the
auth-cookie flow works exactly like a real browser session.
"""

from __future__ import annotations

import json
from typing import Any

import allure
from rest_framework.response import Response
from rest_framework.test import APIClient

from tests.models.schemas import CamelModel

_BASE = "/api/v1"


class HttpClient:
    def __init__(self) -> None:
        self._client = APIClient()

    @property
    def cookies(self) -> Any:
        return self._client.cookies

    def _attach(self, method: str, path: str, response: Response) -> None:
        try:
            body = json.dumps(response.json(), indent=2, ensure_ascii=False)
        except (ValueError, TypeError):
            body = response.content.decode(errors="replace")
        allure.attach(
            f"{method} {path} -> {response.status_code}\n{body}",
            name=f"{method} {path}",
            attachment_type=allure.attachment_type.TEXT,
        )

    def request(
        self,
        method: str,
        path: str,
        body: CamelModel | None = None,
    ) -> Response:
        url = f"{_BASE}{path}"
        payload = body.to_body() if body is not None else None
        response: Response = self._client.generic(
            method,
            url,
            data=json.dumps(payload) if payload is not None else "",
            content_type="application/json",
        )
        self._attach(method, url, response)
        return response

    def get(self, path: str) -> Response:
        return self.request("GET", path)

    def post(self, path: str, body: CamelModel | None = None) -> Response:
        return self.request("POST", path, body)

    def patch(self, path: str, body: CamelModel | None = None) -> Response:
        return self.request("PATCH", path, body)

    def put(self, path: str, body: CamelModel | None = None) -> Response:
        return self.request("PUT", path, body)

    def delete(self, path: str) -> Response:
        return self.request("DELETE", path)
