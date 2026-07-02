"""Pydantic request/response models for the API tests.

All bodies go through these models (no raw dicts, CLAUDE.md). The API speaks
camelCase on the wire, so every model serializes/parses by camelCase alias while
staying snake_case in Python.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    def to_body(self) -> dict[str, Any]:
        """camelCase JSON body, omitting unset optionals."""
        return self.model_dump(by_alias=True, exclude_none=True, mode="json")


# ── Requests ─────────────────────────────────────────────────────────────────
class RegisterRequest(CamelModel):
    email: EmailStr
    password: str


class LoginRequest(CamelModel):
    email: EmailStr
    password: str


class MeterCreateRequest(CamelModel):
    name: str
    type: str
    unit: str
    icon: str
    color: str
    meter_number: str | None = None
    provider: str | None = None
    notes: str | None = None
    calorific_value: Decimal | None = None
    z_number: Decimal | None = None
    connected_load_kw: Decimal | None = None
    linked_water_meter_id: uuid.UUID | None = None
    tariff_history: list[dict[str, Any]] | None = None
    budget: dict[str, Any] | None = None


class ReadingCreateRequest(CamelModel):
    meter_id: uuid.UUID
    date: date
    value: Decimal
    note: str | None = None


class Co2FactorUpsertRequest(CamelModel):
    energy_type: str
    factor_kg_per_unit: Decimal
    unit: str
    source: str = ""
    source_url: str | None = None
    valid_from: date


class ImportMeterModel(CamelModel):
    id: uuid.UUID | None = None
    name: str
    type: str
    unit: str
    icon: str
    color: str
    active: bool = True
    meter_number: str | None = None
    linked_water_meter_id: uuid.UUID | None = None
    tariff_history: list[dict[str, Any]] | None = None
    budget: dict[str, Any] | None = None


class ImportReadingModel(CamelModel):
    id: uuid.UUID | None = None
    meter_id: str
    value: Decimal
    date: str
    note: str | None = None


class ImportPayloadRequest(CamelModel):
    meters: list[ImportMeterModel] = []
    readings: list[ImportReadingModel] = []


# ── Responses ────────────────────────────────────────────────────────────────
class UserResponse(CamelModel):
    id: uuid.UUID
    email: str


class MeterResponse(CamelModel):
    id: uuid.UUID
    name: str
    type: str
    unit: str
    icon: str
    color: str
    active: bool
    archived: bool
    meter_number: str | None = None
    linked_water_meter_id: uuid.UUID | None = None
    tariff_history: list[dict[str, Any]]
    budget: dict[str, Any] | None = None
    created_at: datetime


class ReadingResponse(CamelModel):
    id: uuid.UUID
    meter_id: uuid.UUID
    date: date
    value: Decimal
    consumption: Decimal | None = None
    kwh: Decimal | None = None
    cost: Decimal | None = None
    wastewater_cost: Decimal | None = None
    total_cost: Decimal | None = None
    note: str | None = None
    created_at: datetime


class Co2FactorResponse(CamelModel):
    id: uuid.UUID
    energy_type: str
    factor_kg_per_unit: Decimal
    unit: str
    source: str
    source_url: str | None = None
    valid_from: date
    created_at: datetime


class Co2DefaultResponse(CamelModel):
    energy_type: str
    factor_kg_per_unit: float
    unit: str
    source: str
