"""Per-year advance payments (Abschläge) stored on a meter."""

from __future__ import annotations

import allure
import pytest

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import (
    AdvancePaymentModel,
    AdvancePaymentYearModel,
    MeterResponse,
    MeterUpdateRequest,
)


@allure.epic("Backend")
@allure.feature("Advance payments")
class TestMeterAdvancePayments(BaseTest):
    def _create_meter(self, api: ApiFacade, data: DataGenerator) -> MeterResponse:
        return MeterResponse.model_validate(
            self.assert_status(api.meters.create(data.meter_request()), 201)
        )

    @allure.story("Save")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_patch_stores_and_returns_payments(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._create_meter(auth_api, data)
        entry = data.advance_payments(count=11)
        # Act
        self.assert_status(
            auth_api.meters.update(
                meter.id, MeterUpdateRequest(advance_payments=[entry])
            ),
            200,
        )
        body = self.assert_status(auth_api.meters.get(meter.id), 200)
        # Assert
        assert "estimatedConsumption" in body["advancePayments"][0]
        stored = MeterResponse.model_validate(body).advance_payments
        assert stored == [entry]

    @allure.story("Save")
    @allure.severity(allure.severity_level.NORMAL)
    def test_missing_amount_is_stored_as_null(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._create_meter(auth_api, data)
        entry = data.advance_payments(count=2)
        entry.payments[1] = AdvancePaymentModel(month=2, amount=None)
        # Act
        body = self.assert_status(
            auth_api.meters.update(
                meter.id, MeterUpdateRequest(advance_payments=[entry])
            ),
            200,
        )
        # Assert
        assert body["advancePayments"][0]["payments"][1] == {
            "month": 2,
            "amount": None,
        }

    @allure.story("Edit")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_single_payment_can_be_changed(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._create_meter(auth_api, data)
        entry = data.advance_payments(count=12, amount=120.0)
        auth_api.meters.update(meter.id, MeterUpdateRequest(advance_payments=[entry]))
        entry.payments[2] = AdvancePaymentModel(month=3, amount=135.5)
        # Act
        body = self.assert_status(
            auth_api.meters.update(
                meter.id, MeterUpdateRequest(advance_payments=[entry])
            ),
            200,
        )
        # Assert
        amounts = [
            p.amount
            for p in MeterResponse.model_validate(body).advance_payments[0].payments
        ]
        assert amounts == [120.0, 120.0, 135.5, *[120.0] * 9]

    @allure.story("Save")
    @allure.severity(allure.severity_level.NORMAL)
    def test_multiple_years_are_kept_separately(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._create_meter(auth_api, data)
        entries = [data.advance_payments(year=2027), data.advance_payments(year=2026)]
        # Act
        body = self.assert_status(
            auth_api.meters.update(
                meter.id, MeterUpdateRequest(advance_payments=entries)
            ),
            200,
        )
        # Assert — stored sorted by year
        assert [e["year"] for e in body["advancePayments"]] == [2026, 2027]

    @allure.story("Save")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_quarterly_payments_are_stored(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange — quarterly from February: Feb, May, Aug, Nov
        meter = self._create_meter(auth_api, data)
        entry = data.advance_payments(count=4, start=2, interval=3)
        # Act
        body = self.assert_status(
            auth_api.meters.update(
                meter.id, MeterUpdateRequest(advance_payments=[entry])
            ),
            200,
        )
        # Assert
        stored = MeterResponse.model_validate(body).advance_payments[0]
        assert stored.interval == 3
        assert [p.month for p in stored.payments] == [2, 5, 8, 11]

    @allure.story("Validation")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.parametrize(
        "case",
        [
            "month_out_of_range",
            "negative_amount",
            "duplicate_month",
            "too_many_payments",
            "no_payments",
            "zero_consumption",
            "duplicate_year",
            "unknown_interval",
            "months_off_rhythm",
        ],
    )
    def test_invalid_payload_is_rejected(
        self, auth_api: ApiFacade, data: DataGenerator, case: str
    ) -> None:
        # Arrange
        meter = self._create_meter(auth_api, data)
        entry = data.advance_payments(count=3)
        entries: list[AdvancePaymentYearModel] = [entry]
        if case == "month_out_of_range":
            entry.payments[0] = AdvancePaymentModel(month=13, amount=10.0)
        elif case == "negative_amount":
            entry.payments[0] = AdvancePaymentModel(month=1, amount=-1.0)
        elif case == "duplicate_month":
            entry.payments[1] = AdvancePaymentModel(month=1, amount=10.0)
        elif case == "too_many_payments":
            entry.payments = [
                AdvancePaymentModel(month=(i % 12) + 1, amount=1.0) for i in range(13)
            ]
        elif case == "no_payments":
            entry.payments = []
        elif case == "zero_consumption":
            entry.estimated_consumption = 0
        elif case == "duplicate_year":
            entries.append(data.advance_payments(year=entry.year))
        elif case == "unknown_interval":
            entry.interval = 2
        elif case == "months_off_rhythm":
            entry.interval = 3
        # Act
        response = auth_api.meters.update(
            meter.id, MeterUpdateRequest(advance_payments=entries)
        )
        # Assert
        self.assert_status(response, 400)

    @allure.story("Garden water")
    @allure.severity(allure.severity_level.NORMAL)
    def test_linked_garden_water_meter_rejects_payments(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        water = self._create_meter(auth_api, data)
        garden_request = data.meter_request(energy_type="garden_water", unit="m³")
        garden_request.linked_water_meter_id = water.id
        garden = MeterResponse.model_validate(
            self.assert_status(auth_api.meters.create(garden_request), 201)
        )
        # Act
        response = auth_api.meters.update(
            garden.id, MeterUpdateRequest(advance_payments=[data.advance_payments()])
        )
        # Assert
        body = self.assert_status(response, 400)
        assert "advancePayments" in body

    @allure.story("Access control")
    @allure.severity(allure.severity_level.BLOCKER)
    def test_foreign_meter_cannot_be_updated(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        meter = self._create_meter(auth_api, data)
        intruder = ApiFacade()
        intruder.authenticate(data)
        # Act
        response = intruder.meters.update(
            meter.id, MeterUpdateRequest(advance_payments=[data.advance_payments()])
        )
        # Assert
        self.assert_status(response, 404)
        owner_view = MeterResponse.model_validate(
            self.assert_status(auth_api.meters.get(meter.id), 200)
        )
        assert owner_view.advance_payments == []
