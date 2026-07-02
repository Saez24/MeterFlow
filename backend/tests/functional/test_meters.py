"""Meter CRUD + list filters (contract §3)."""

from __future__ import annotations

import allure

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import MeterResponse


@allure.epic("Backend")
@allure.feature("Meters")
class TestMeters(BaseTest):
    @allure.story("Create")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_create_returns_camel_case_payload(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        request = data.meter_request(energy_type="electricity", unit="kWh")
        # Act
        response = auth_api.meters.create(request)
        # Assert
        body = self.assert_status(response, 201)
        assert "meterNumber" in body
        assert "linkedWaterMeterId" in body
        assert "createdAt" in body
        meter = MeterResponse.model_validate(body)
        assert meter.active is True and meter.archived is False

    @allure.story("Create")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_create_requires_authentication(
        self, api: ApiFacade, data: DataGenerator
    ) -> None:
        # Act
        response = api.meters.create(data.meter_request())
        # Assert
        self.assert_status(response, 401)

    @allure.story("List")
    @allure.severity(allure.severity_level.NORMAL)
    def test_list_is_empty_for_new_user(self, auth_api: ApiFacade) -> None:
        body = self.assert_status(auth_api.meters.list(), 200)
        assert body == []

    @allure.story("List")
    @allure.severity(allure.severity_level.NORMAL)
    def test_list_filters_by_type(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        auth_api.meters.create(data.meter_request(energy_type="electricity"))
        auth_api.meters.create(data.meter_request(energy_type="gas", unit="m³"))
        # Act
        gas = self.assert_status(auth_api.meters.list(type="gas"), 200)
        electricity = self.assert_status(auth_api.meters.list(type="electricity"), 200)
        # Assert
        assert len(gas) == 1 and gas[0]["type"] == "gas"
        assert len(electricity) == 1

    @allure.story("Retrieve / Delete")
    @allure.severity(allure.severity_level.NORMAL)
    def test_delete_then_get_returns_not_found(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        created = MeterResponse.model_validate(
            self.assert_status(auth_api.meters.create(data.meter_request()), 201)
        )
        # Act
        self.assert_status(auth_api.meters.delete(created.id), 204)
        # Assert
        self.assert_status(auth_api.meters.get(created.id), 404)
