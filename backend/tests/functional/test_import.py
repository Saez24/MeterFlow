"""Bulk import: creation, idempotency, ownership enforcement (contract §8)."""

from __future__ import annotations

import uuid

import allure
import pytest

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import (
    ImportMeterModel,
    ImportPayloadRequest,
    ImportReadingModel,
)


def _payload(meter_id: uuid.UUID) -> ImportPayloadRequest:
    return ImportPayloadRequest(
        meters=[
            ImportMeterModel(
                id=meter_id,
                name="Imported",
                type="electricity",
                unit="kWh",
                icon="bolt",
                color="#0071e3",
            )
        ],
        readings=[
            ImportReadingModel(
                id=uuid.uuid4(),
                meter_id=str(meter_id),
                value="1000",
                date="2026-01-01",
            )
        ],
    )


@allure.epic("Backend")
@allure.feature("Import")
class TestImport(BaseTest):
    @allure.story("Create")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_import_creates_meters_and_readings(self, auth_api: ApiFacade) -> None:
        # Arrange
        payload = _payload(uuid.uuid4())
        # Act
        body = self.assert_status(auth_api.imports.run(payload), 200)
        # Assert
        assert body["metersAdded"] == 1
        assert body["readingsAdded"] == 1
        assert len(self.assert_status(auth_api.meters.list(), 200)) == 1

    @allure.story("Idempotency")
    @allure.severity(allure.severity_level.NORMAL)
    def test_reimport_skips_existing_rows(self, auth_api: ApiFacade) -> None:
        # Arrange
        payload = _payload(uuid.uuid4())
        self.assert_status(auth_api.imports.run(payload), 200)
        # Act — same payload again
        body = self.assert_status(auth_api.imports.run(payload), 200)
        # Assert
        assert body["metersAdded"] == 0
        assert body["metersSkipped"] == 1
        assert body["readingsSkipped"] == 1

    @allure.story("Access control")
    @allure.severity(allure.severity_level.BLOCKER)
    @pytest.mark.django_db
    def test_import_of_foreign_row_is_forbidden(self, data: DataGenerator) -> None:
        # Arrange — user A imports a meter
        shared_id = uuid.uuid4()
        user_a = ApiFacade()
        user_a.authenticate(data)
        self.assert_status(user_a.imports.run(_payload(shared_id)), 200)
        # Act — user B imports a meter with the same id
        user_b = ApiFacade()
        user_b.authenticate(data)
        response = user_b.imports.run(_payload(shared_id))
        # Assert
        self.assert_status(response, 403)

    @allure.story("Access control")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_import_requires_authentication(self, api: ApiFacade) -> None:
        self.assert_status(api.imports.run(_payload(uuid.uuid4())), 401)
