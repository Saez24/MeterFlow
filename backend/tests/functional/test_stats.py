"""Statistics aggregation: year / dashboard / budget alerts (contract §6)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import allure

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import MeterResponse


@allure.epic("Backend")
@allure.feature("Statistics")
class TestStats(BaseTest):
    def _seed_meter_with_readings(
        self,
        api: ApiFacade,
        data: DataGenerator,
        *,
        readings: list[tuple[str, date]],
        budget: dict[str, str] | None = None,
    ) -> MeterResponse:
        request = data.meter_request(
            energy_type="electricity", with_tariff=True, budget=budget
        )
        meter = MeterResponse.model_validate(
            self.assert_status(api.meters.create(request), 201)
        )
        for value, on in readings:
            self.assert_status(
                api.readings.create(data.reading_request(meter.id, value=value, on=on)),
                201,
            )
        return meter

    @allure.story("Year stats")
    @allure.severity(allure.severity_level.NORMAL)
    def test_year_stats_sum_costs(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange
        self._seed_meter_with_readings(
            auth_api,
            data,
            readings=[("1000", date(2026, 1, 1)), ("1200", date(2026, 2, 1))],
        )
        # Act
        body = self.assert_status(auth_api.stats.year(2026), 200)
        # Assert
        assert Decimal(str(body["totalCost"])) == Decimal("89.30")
        assert len(body["months"]) == 12

    @allure.story("Dashboard")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_dashboard_aggregates_current_year(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange — a reading in the current month (2026-07) plus its predecessor
        self._seed_meter_with_readings(
            auth_api,
            data,
            readings=[("1000", date(2026, 6, 1)), ("1200", date(2026, 7, 1))],
        )
        # Act
        body = self.assert_status(auth_api.stats.dashboard(), 200)
        # Assert — 200 kWh * 0.40 + 9.00 * 30/30 = 89.00 (Jun 1 -> Jul 1 is 30 days)
        assert "budgetAlerts" in body
        assert Decimal(str(body["currentYearCost"])) == Decimal("89.00")

    @allure.story("Budget alerts")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_budget_alert_triggers_when_over_limit(
        self, auth_api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange — monthly limit 50 €, current-month cost ~89.30 € -> critical
        self._seed_meter_with_readings(
            auth_api,
            data,
            readings=[("1000", date(2026, 6, 1)), ("1200", date(2026, 7, 1))],
            budget={"monthlyLimit": "50", "alertAt": "80"},
        )
        # Act
        alerts = self.assert_status(auth_api.stats.budget_alerts(), 200)
        # Assert
        assert len(alerts) == 1
        assert alerts[0]["type"] == "monthly_cost"
        assert alerts[0]["critical"] is True
