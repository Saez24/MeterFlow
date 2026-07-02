"""Ownership permission — belt-and-suspenders with per-user querysets."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class IsOwner(BasePermission):
    """Object belongs to the authenticated user.

    ViewSets already scope ``get_queryset`` to ``request.user`` (so a foreign
    row yields 404). This is the second layer for object-level checks.
    """

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        owner_id = getattr(obj, "user_id", None)
        return owner_id is not None and owner_id == request.user.id
