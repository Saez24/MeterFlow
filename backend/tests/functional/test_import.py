"""Bulk import: creation, idempotency, ownership enforcement (contract §8)."""

from __future__ import annotations

import uuid
from decimal import Decimal

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
                value=Decimal("1000"),
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

    @allure.story("Linked meters")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_import_resolves_linked_water_meter_any_order(
        self, auth_api: ApiFacade
    ) -> None:
        # Arrange — garden meter references a water meter listed AFTER it
        water_id = uuid.uuid4()
        garden_id = uuid.uuid4()
        payload = ImportPayloadRequest(
            meters=[
                ImportMeterModel(
                    id=garden_id,
                    name="Garten",
                    type="garden_water",
                    unit="m³",
                    icon="yard",
                    color="#30d158",
                    linked_water_meter_id=water_id,
                ),
                ImportMeterModel(
                    id=water_id,
                    name="Wasser",
                    type="water",
                    unit="m³",
                    icon="water_drop",
                    color="#0a84ff",
                ),
            ],
        )
        # Act
        body = self.assert_status(auth_api.imports.run(payload), 200)
        # Assert — both created, link resolved despite the order
        assert body["metersAdded"] == 2
        garden = self.assert_status(auth_api.meters.get(garden_id), 200)
        assert garden["linkedWaterMeterId"] == str(water_id)

    @allure.story("Robustness")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_import_tolerates_float_rounding_noise(self, auth_api: ApiFacade) -> None:
        # Arrange — client-computed values with >6 decimal places (float noise)
        meter_id = uuid.uuid4()
        payload = ImportPayloadRequest(
            meters=[
                ImportMeterModel(
                    id=meter_id,
                    name="Strom",
                    type="electricity",
                    unit="kWh",
                    icon="bolt",
                    color="#000",
                )
            ],
            readings=[
                ImportReadingModel(
                    id=uuid.uuid4(),
                    meter_id=str(meter_id),
                    value=Decimal("1200"),
                    date="2026-02-01",
                    consumption=200.00000000000003,
                    cost=89.30000000000001,
                    total_cost=89.30000000000001,
                )
            ],
        )
        # Act / Assert — no 400, value quantized to the numeric(20,6) column
        body = self.assert_status(auth_api.imports.run(payload), 200)
        assert body["readingsAdded"] == 1

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
