"""Access control: rows are strictly scoped to their owner (contract §1, §4).

A foreign row must never leak — the API answers 404, not 403, so existence is
not disclosed.
"""

from __future__ import annotations

import allure
import pytest

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import MeterResponse


@allure.epic("Backend")
@allure.feature("Access control")
@pytest.mark.django_db
class TestOwnership(BaseTest):
    def _authenticated(self, data: DataGenerator) -> ApiFacade:
        api = ApiFacade()
        api.authenticate(data)
        return api

    @allure.story("Isolation")
    @allure.severity(allure.severity_level.BLOCKER)
    def test_user_cannot_read_foreign_meter(self, data: DataGenerator) -> None:
        # Arrange — user A owns a meter
        user_a = self._authenticated(data)
        meter = MeterResponse.model_validate(
            self.assert_status(user_a.meters.create(data.meter_request()), 201)
        )
        user_b = self._authenticated(data)
        # Act — user B tries to read it
        response = user_b.meters.get(meter.id)
        # Assert
        self.assert_status(response, 404)

    @allure.story("Isolation")
    @allure.severity(allure.severity_level.BLOCKER)
    def test_user_cannot_delete_foreign_meter(self, data: DataGenerator) -> None:
        # Arrange
        user_a = self._authenticated(data)
        meter = MeterResponse.model_validate(
            self.assert_status(user_a.meters.create(data.meter_request()), 201)
        )
        user_b = self._authenticated(data)
        # Act
        response = user_b.meters.delete(meter.id)
        # Assert
        self.assert_status(response, 404)
        # And the meter still exists for its real owner.
        self.assert_status(user_a.meters.get(meter.id), 200)

    @allure.story("Isolation")
    @allure.severity(allure.severity_level.BLOCKER)
    def test_list_is_scoped_to_owner(self, data: DataGenerator) -> None:
        # Arrange
        user_a = self._authenticated(data)
        self.assert_status(user_a.meters.create(data.meter_request()), 201)
        user_b = self._authenticated(data)
        # Act
        body = self.assert_status(user_b.meters.list(), 200)
        # Assert — user B sees none of user A's meters
        assert body == []

    @allure.story("Isolation")
    @allure.severity(allure.severity_level.BLOCKER)
    def test_cannot_link_foreign_water_meter(self, data: DataGenerator) -> None:
        # Arrange — user A owns a water meter
        user_a = self._authenticated(data)
        foreign = MeterResponse.model_validate(
            self.assert_status(user_a.meters.create(data.meter_request()), 201)
        )
        user_b = self._authenticated(data)
        request = data.meter_request(energy_type="garden_water", unit="m³")
        request.linked_water_meter_id = foreign.id
        # Act — user B tries to link their garden meter to it
        response = user_b.meters.create(request)
        # Assert — the foreign id does not resolve (existence not disclosed)
        body = self.assert_status(response, 400)
        assert "linkedWaterMeterId" in body

    @allure.story("Isolation")
    @allure.severity(allure.severity_level.NORMAL)
    def test_can_link_own_water_meter(self, data: DataGenerator) -> None:
        # Arrange
        api = self._authenticated(data)
        water = MeterResponse.model_validate(
            self.assert_status(api.meters.create(data.meter_request()), 201)
        )
        request = data.meter_request(energy_type="garden_water", unit="m³")
        request.linked_water_meter_id = water.id
        # Act
        body = self.assert_status(api.meters.create(request), 201)
        # Assert
        assert MeterResponse.model_validate(body).linked_water_meter_id == water.id
