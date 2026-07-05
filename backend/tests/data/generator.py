"""Test-data factory — no hard-coded emails/passwords/IDs (CLAUDE.md)."""

from __future__ import annotations

import secrets
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from tests.models.schemas import (
    Co2FactorUpsertRequest,
    MeterCreateRequest,
    ReadingCreateRequest,
    RegisterRequest,
)


class DataGenerator:
    """Generates unique, valid payloads for each test."""

    @staticmethod
    def unique_email() -> str:
        return f"user-{uuid.uuid4().hex[:12]}@example.com"

    @staticmethod
    def password() -> str:
        # Meets the 8..128 policy; unique per call.
        return f"Pw-{secrets.token_urlsafe(16)}"

    def register_request(self) -> RegisterRequest:
        return RegisterRequest(email=self.unique_email(), password=self.password())

    def meter_request(
        self,
        *,
        energy_type: str = "electricity",
        unit: str = "kWh",
        with_tariff: bool = False,
        price_per_unit: str = "0.40",
        base_charge: str = "9.00",
        budget: dict[str, Any] | None = None,
    ) -> MeterCreateRequest:
        tariff: list[dict[str, Any]] | None = None
        if with_tariff:
            tariff = [
                {
                    "id": uuid.uuid4().hex,
                    "validFrom": "2026-01-01",
                    "pricePerUnit": price_per_unit,
                    "baseCharge": base_charge,
                }
            ]
        return MeterCreateRequest(
            name=f"Meter {uuid.uuid4().hex[:6]}",
            type=energy_type,
            unit=unit,
            icon="bolt",
            color="#0071e3",
            meter_number=f"MN-{uuid.uuid4().hex[:6]}",
            tariff_history=tariff,
            budget=budget,
        )

    @staticmethod
    def reading_request(
        meter_id: uuid.UUID,
        *,
        value: str,
        on: date,
        note: str | None = None,
    ) -> ReadingCreateRequest:
        return ReadingCreateRequest(
            meter_id=meter_id, date=on, value=Decimal(value), note=note
        )

    @staticmethod
    def co2_request(
        *,
        energy_type: str = "electricity",
        factor: str = "0.42",
        unit: str = "kWh",
        valid_from: date | None = None,
    ) -> Co2FactorUpsertRequest:
        return Co2FactorUpsertRequest(
            energy_type=energy_type,
            factor_kg_per_unit=Decimal(factor),
            unit=unit,
            source="test",
            valid_from=valid_from or date(2026, 1, 1),
        )
