"""Typed accessor for the authenticated user.

DRF types ``request.user`` as ``User | AnonymousUser``. On endpoints guarded by
``IsAuthenticated`` it is always a real ``User``; this narrows the type for the
ORM (whose lookups do not accept ``AnonymousUser``) in one place.
"""

from __future__ import annotations

from typing import cast

from rest_framework.request import Request

from apps.accounts.models import User


def request_user(request: Request) -> User:
    return cast(User, request.user)
