"""Auth flow: register / login / refresh / logout / me (contract §2)."""

from __future__ import annotations

import allure
import pytest
from django.conf import settings
from django.core.cache import cache

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import LoginRequest, UserResponse


@allure.epic("Backend")
@allure.feature("Authentication")
class TestAuth(BaseTest):
    @allure.story("Registration")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_register_returns_user_and_sets_cookies(
        self, api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        request = data.register_request()
        # Act
        response = api.auth.register(request)
        # Assert
        body = self.assert_status(response, 201)
        user = UserResponse.model_validate(body)
        assert user.email == request.email
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

    @allure.story("Registration")
    @allure.severity(allure.severity_level.NORMAL)
    def test_register_duplicate_email_conflicts(
        self, api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        request = data.register_request()
        self.assert_status(api.auth.register(request), 201)
        # Act
        duplicate = api.auth.register(request)
        # Assert
        self.assert_status(duplicate, 409)

    @allure.story("Login")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_login_with_valid_credentials(
        self, api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        request = data.register_request()
        self.assert_status(api.auth.register(request), 201)
        # Act
        response = api.auth.login(
            LoginRequest(email=request.email, password=request.password)
        )
        # Assert
        self.assert_status(response, 200)

    @allure.story("Login")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_login_with_wrong_password_is_unauthorized(
        self, api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        request = data.register_request()
        self.assert_status(api.auth.register(request), 201)
        # Act
        response = api.auth.login(
            LoginRequest(email=request.email, password=data.password())
        )
        # Assert
        self.assert_status(response, 401)

    @allure.story("Session")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_me_requires_authentication(self, api: ApiFacade) -> None:
        # Act
        response = api.auth.me()
        # Assert
        self.assert_status(response, 401)

    @allure.story("Session")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_me_returns_current_user(self, api: ApiFacade, data: DataGenerator) -> None:
        # Arrange
        user = api.authenticate(data)
        # Act
        response = api.auth.me()
        # Assert
        body = self.assert_status(response, 200)
        assert UserResponse.model_validate(body).id == user.id

    @allure.story("Session")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_refresh_rotates_token(self, api: ApiFacade, data: DataGenerator) -> None:
        # Arrange
        user = api.authenticate(data)
        # Act
        response = api.auth.refresh()
        # Assert
        body = self.assert_status(response, 200)
        assert UserResponse.model_validate(body).id == user.id
        assert "access_token" in response.cookies

    @allure.story("Session")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_refresh_reuse_revokes_token_family(
        self, api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange — authenticate, capture the original refresh token, rotate once.
        api.authenticate(data)
        original = api.client.cookies["refresh_token"].value
        self.assert_status(api.auth.refresh(), 200)
        rotated = api.client.cookies["refresh_token"].value
        # Act — replay the now-revoked original token (stolen-token scenario).
        api.client.cookies["refresh_token"] = original
        replay = api.auth.refresh()
        # Assert — replay rejected AND the whole family is revoked, so even the
        # freshly-issued token no longer works (reuse detection, §2).
        self.assert_status(replay, 401)
        api.client.cookies["refresh_token"] = rotated
        self.assert_status(api.auth.refresh(), 401)

    @allure.story("Session")
    @allure.severity(allure.severity_level.NORMAL)
    def test_logout_returns_no_content(
        self, api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        api.authenticate(data)
        # Act / Assert
        self.assert_status(api.auth.logout(), 204)

    @allure.story("Brute-force protection")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.django_db
    def test_register_is_rate_limited(self, data: DataGenerator) -> None:
        # Arrange — rate limiting is disabled by default in tests; enable it here.
        settings.RATELIMIT_ENABLE = True
        cache.clear()
        api = ApiFacade()
        # Act — the limit is 2/min, so the third registration is blocked.
        first = api.auth.register(data.register_request())
        second = api.auth.register(data.register_request())
        third = api.auth.register(data.register_request())
        # Assert
        self.assert_status(first, 201)
        self.assert_status(second, 201)
        self.assert_status(third, 429)
