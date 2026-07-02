"""Bundles all API services over a single cookie-persisting client."""

from __future__ import annotations

import allure

from tests.api.auth_api import AuthAPI
from tests.api.client import HttpClient
from tests.api.co2_api import Co2API
from tests.api.meters_api import MetersAPI
from tests.api.readings_api import ReadingsAPI
from tests.api.stats_api import StatsAPI
from tests.data.generator import DataGenerator
from tests.models.schemas import RegisterRequest, UserResponse


class ApiFacade:
    def __init__(self) -> None:
        self._client = HttpClient()
        self.auth = AuthAPI(self._client)
        self.meters = MetersAPI(self._client)
        self.readings = ReadingsAPI(self._client)
        self.co2 = Co2API(self._client)
        self.stats = StatsAPI(self._client)

    @property
    def client(self) -> HttpClient:
        return self._client

    @allure.step("Register a fresh authenticated user")
    def authenticate(self, data: DataGenerator) -> UserResponse:
        """Register a new user; the auth cookies persist on this client."""
        request: RegisterRequest = data.register_request()
        response = self.auth.register(request)
        assert response.status_code == 201, response.content
        return UserResponse.model_validate(response.json())
