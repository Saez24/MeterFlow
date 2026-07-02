"""Auth API service (contract §2)."""

from __future__ import annotations

import allure
from rest_framework.response import Response

from tests.api.client import HttpClient
from tests.models.schemas import LoginRequest, RegisterRequest


class AuthAPI:
    def __init__(self, client: HttpClient) -> None:
        self._client = client

    @allure.step("POST /auth/register")
    def register(self, body: RegisterRequest) -> Response:
        return self._client.post("/auth/register", body)

    @allure.step("POST /auth/login")
    def login(self, body: LoginRequest) -> Response:
        return self._client.post("/auth/login", body)

    @allure.step("POST /auth/refresh")
    def refresh(self) -> Response:
        return self._client.post("/auth/refresh")

    @allure.step("POST /auth/logout")
    def logout(self) -> Response:
        return self._client.post("/auth/logout")

    @allure.step("GET /auth/me")
    def me(self) -> Response:
        return self._client.get("/auth/me")
