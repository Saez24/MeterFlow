"""CO₂ factors: public defaults + per-user upsert (contract §5)."""

from __future__ import annotations

import uuid
from decimal import Decimal

import allure

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import Co2DefaultResponse, Co2FactorResponse


@allure.epic("Backend")
@allure.feature("CO2 factors")
class TestCo2(BaseTest):
    @allure.story("Defaults")
    @allure.severity(allure.severity_level.NORMAL)
    def test_defaults_are_public(self, api: ApiFacade) -> None:
        # Act — no authentication
        response = api.co2.defaults()
        # Assert
        body = self.assert_status(response, 200)
        defaults = [Co2DefaultResponse.model_validate(d) for d in body]
        assert any(d.energy_type == "electricity" for d in defaults)

    @allure.story("Upsert")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_upsert_creates_then_lists(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        request = data.co2_request(energy_type="gas", factor="2.10", unit="m³")
        # Act
        created = Co2FactorResponse.model_validate(
            self.assert_status(auth_api.co2.upsert(request), 200)
        )
        # Assert
        assert created.factor_kg_per_unit == Decimal("2.10")
        listed = self.assert_status(auth_api.co2.list(), 200)
        assert len(listed) == 1

    @allure.story("Upsert")
    @allure.severity(allure.severity_level.NORMAL)
    def test_upsert_same_key_updates_in_place(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange — same energy_type + valid_from is the uniqueness key
        first = data.co2_request(energy_type="gas", factor="2.00")
        second = data.co2_request(energy_type="gas", factor="2.50")
        # Act
        self.assert_status(auth_api.co2.upsert(first), 200)
        self.assert_status(auth_api.co2.upsert(second), 200)
        # Assert
        listed = self.assert_status(auth_api.co2.list(), 200)
        assert len(listed) == 1
        assert Decimal(listed[0]["factorKgPerUnit"]) == Decimal("2.50")

    @allure.story("Delete")
    @allure.severity(allure.severity_level.MINOR)
    def test_delete_unknown_is_not_found(self, auth_api: ApiFacade) -> None:
        self.assert_status(auth_api.co2.delete(uuid.uuid4()), 404)
