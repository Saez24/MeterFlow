"""Reading creation with server-side cost computation (contract §4)."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import allure

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import (
    MeterCreateRequest,
    MeterResponse,
    ReadingResponse,
)


@allure.epic("Backend")
@allure.feature("Readings")
class TestReadings(BaseTest):
    def _meter_with_tariff(self, api: ApiFacade, data: DataGenerator) -> MeterResponse:
        request = data.meter_request(
            energy_type="electricity",
            unit="kWh",
            with_tariff=True,
            price_per_unit="0.40",
            base_charge="9.00",
        )
        return MeterResponse.model_validate(
            self.assert_status(api.meters.create(request), 201)
        )

    @allure.story("Cost computation")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_second_reading_computes_consumption_and_cost(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._meter_with_tariff(auth_api, data)
        self.assert_status(
            auth_api.readings.create(
                data.reading_request(meter.id, value="1000", on=date(2026, 1, 1))
            ),
            201,
        )
        # Act
        response = auth_api.readings.create(
            data.reading_request(meter.id, value="1200", on=date(2026, 2, 1))
        )
        # Assert — 200 kWh * 0.40 + 9.00 * 31/30 = 89.30
        reading = ReadingResponse.model_validate(self.assert_status(response, 201))
        assert reading.consumption == Decimal("200")
        assert reading.cost == Decimal("89.30")
        assert reading.total_cost == Decimal("89.30")

    @allure.story("Cost computation")
    @allure.severity(allure.severity_level.NORMAL)
    def test_first_reading_has_no_consumption(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._meter_with_tariff(auth_api, data)
        # Act
        response = auth_api.readings.create(
            data.reading_request(meter.id, value="1000", on=date(2026, 1, 1))
        )
        # Assert
        reading = ReadingResponse.model_validate(self.assert_status(response, 201))
        assert reading.consumption is None
        assert reading.cost is None

    @allure.story("Validation")
    @allure.severity(allure.severity_level.NORMAL)
    def test_create_for_unknown_meter_is_not_found(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange — a meter id that was never persisted
        missing_meter_id = uuid.uuid4()
        # Act
        response = auth_api.readings.create(
            data.reading_request(missing_meter_id, value="10", on=date(2026, 1, 1))
        )
        # Assert
        self.assert_status(response, 404)

    @allure.story("Cost computation")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_gas_reading_applies_calorific_and_z_number(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange — gas: kwh = consumption * calorific * z; cost = kwh * price + base
        gas_meter = MeterCreateRequest(
            name="Gas",
            type="gas",
            unit="m³",
            icon="flame",
            color="#ff9500",
            calorific_value=Decimal("10"),
            z_number=Decimal("1"),
            tariff_history=[
                {
                    "id": "t1",
                    "validFrom": "2026-01-01",
                    "pricePerUnit": "0.10",
                    "baseCharge": "0",
                }
            ],
        )
        meter = MeterResponse.model_validate(
            self.assert_status(auth_api.meters.create(gas_meter), 201)
        )
        self.assert_status(
            auth_api.readings.create(
                data.reading_request(meter.id, value="1000", on=date(2026, 1, 1))
            ),
            201,
        )
        # Act — consumption 100 m³ -> kwh 1000 -> cost 100.00
        response = auth_api.readings.create(
            data.reading_request(meter.id, value="1100", on=date(2026, 2, 1))
        )
        # Assert
        reading = ReadingResponse.model_validate(self.assert_status(response, 201))
        assert reading.kwh == Decimal("1000")
        assert reading.cost == Decimal("100.00")

    @allure.story("List")
    @allure.severity(allure.severity_level.NORMAL)
    def test_list_returns_readings_for_meter(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._meter_with_tariff(auth_api, data)
        for value, on in [("1000", date(2026, 1, 1)), ("1200", date(2026, 2, 1))]:
            self.assert_status(
                auth_api.readings.create(
                    data.reading_request(meter.id, value=value, on=on)
                ),
                201,
            )
        # Act
        body = self.assert_status(auth_api.readings.list(meter_id=meter.id), 200)
        # Assert
        assert len(body) == 2

    @allure.story("Recalculate")
    @allure.severity(allure.severity_level.NORMAL)
    def test_recalculate_returns_all_readings(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._meter_with_tariff(auth_api, data)
        for value, on in [("1000", date(2026, 1, 1)), ("1200", date(2026, 2, 1))]:
            self.assert_status(
                auth_api.readings.create(
                    data.reading_request(meter.id, value=value, on=on)
                ),
                201,
            )
        # Act
        response = auth_api.readings.recalculate(meter.id)
        # Assert
        body = self.assert_status(response, 200)
        assert len(body) == 2
