"""Shared fixtures for the API test suite."""

from __future__ import annotations

from collections.abc import Iterator

import django
import pytest

django.setup()

from django.conf import settings  # noqa: E402
from django.core.cache import cache  # noqa: E402

from tests.api.facade import ApiFacade  # noqa: E402
from tests.data.generator import DataGenerator  # noqa: E402


@pytest.fixture(autouse=True)
def _test_environment() -> Iterator[None]:
    """Allow the test host and start every test from a clean rate-limit cache.

    Rate limiting is disabled by default (the shared 127.0.0.1 test IP would
    otherwise trip the per-minute limits across tests); the dedicated
    rate-limit test re-enables it explicitly.
    """
    if "testserver" not in settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS.append("testserver")
    # A >=32-byte signing key so JWT does not emit InsecureKeyLengthWarning.
    settings.JWT_SIGNING_KEY = "test-signing-key-0123456789abcdef-secure"
    settings.RATELIMIT_ENABLE = False
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def data() -> DataGenerator:
    return DataGenerator()


@pytest.fixture
def api(db: object) -> ApiFacade:
    """Fresh, unauthenticated API facade (depends on ``db`` to enable DB access)."""
    return ApiFacade()


@pytest.fixture
def auth_api(api: ApiFacade, data: DataGenerator) -> ApiFacade:
    """API facade with a freshly registered, authenticated user."""
    api.authenticate(data)
    return api
