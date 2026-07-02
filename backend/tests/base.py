"""Base class every test class inherits from (CLAUDE.md OOP requirement)."""

from __future__ import annotations

from typing import Any

import allure
from rest_framework.response import Response


class BaseTest:
    """Common assertion helpers shared by all API test classes."""

    @staticmethod
    def assert_status(response: Response, expected: int) -> dict[str, Any] | list[Any]:
        with allure.step(f"Expect HTTP {expected}"):
            assert (
                response.status_code == expected
            ), f"expected {expected}, got {response.status_code}: {response.content!r}"
        if response.status_code == 204:
            return {}
        return response.json()
