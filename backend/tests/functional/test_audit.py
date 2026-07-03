"""Audit trail is written for security-sensitive events (security-standards §5)."""

from __future__ import annotations

import allure

from apps.common.models import AuditLog
from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import LoginRequest


@allure.epic("Backend")
@allure.feature("Audit trail")
class TestAudit(BaseTest):
    @allure.story("Sensitive mutations are recorded")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_register_and_meter_create_are_audited(
        self, api: ApiFacade, data: DataGenerator
    ) -> None:
        # Arrange / Act — register (audited) then create a meter (audited)
        api.authenticate(data)
        self.assert_status(api.meters.create(data.meter_request()), 201)
        # Assert
        actions = set(AuditLog.objects.values_list("action", flat=True))
        assert "user.register" in actions
        assert "meter.create" in actions
        meter_audit = AuditLog.objects.get(action="meter.create")
        assert meter_audit.actor is not None
        assert meter_audit.resource_type == "meter"
        assert meter_audit.resource_id is not None

    @allure.story("Failed logins are recorded")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_failed_login_is_audited(self, api: ApiFacade, data: DataGenerator) -> None:
        # Arrange
        request = data.register_request()
        self.assert_status(api.auth.register(request), 201)
        # Act — wrong password
        self.assert_status(
            api.auth.login(LoginRequest(email=request.email, password=data.password())),
            401,
        )
        # Assert
        assert AuditLog.objects.filter(action="user.login_failed").exists()
