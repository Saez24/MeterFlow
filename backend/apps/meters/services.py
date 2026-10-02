"""Meter business rules (service layer, django-standards §4)."""

from __future__ import annotations

from apps.meters.models import Meter


def is_linked_garden_water(meter_type: str | None, linked: Meter | None) -> bool:
    """A garden-water meter linked to a main water meter is billed through that
    main meter — it has no cost preview and no advance payments of its own."""
    return meter_type == "garden_water" and linked is not None
