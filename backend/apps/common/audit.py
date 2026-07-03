"""Audit-trail helper (security-standards §5).

Records security-sensitive events (auth + financial mutations) into the
immutable ``audit_logs`` table. Failures never break the request — an audit
write must not take down a user action, so exceptions are logged and swallowed.
"""

from __future__ import annotations

import logging
from typing import Any

from rest_framework.request import Request

from apps.accounts.models import User
from apps.common.models import AuditLog

logger = logging.getLogger(__name__)


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if isinstance(forwarded, str) and forwarded:
        return forwarded.split(",")[0].strip()
    remote = request.META.get("REMOTE_ADDR")
    return remote if isinstance(remote, str) else None


def record_audit(
    *,
    action: str,
    resource_type: str,
    request: Request | None = None,
    actor: User | None = None,
    resource_id: Any = None,
    old: dict[str, Any] | None = None,
    new: dict[str, Any] | None = None,
) -> None:
    if actor is None and request is not None:
        candidate = getattr(request, "user", None)
        if candidate is not None and getattr(candidate, "is_authenticated", False):
            actor = candidate

    try:
        AuditLog.objects.create(
            actor=actor if actor and actor.pk else None,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            old_value=old,
            new_value=new,
            ip_address=_client_ip(request),
        )
    except Exception:
        logger.exception("audit.write_failed action=%s", action)
