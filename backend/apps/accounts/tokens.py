"""Token helpers: JWT access tokens + hashed, rotating refresh tokens.

Mirrors the FastAPI reference (``auth/service.py``): short-lived HS256 access
token in a cookie, opaque refresh token whose SHA-256 hash is persisted and
rotated on every use (contract §2).
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime

import jwt
from django.conf import settings

from apps.accounts.models import RefreshToken, User
from apps.common.audit import record_audit


def create_access_token(user: User) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": now + settings.ACCESS_TOKEN_LIFETIME,
        "iat": now,
    }
    return jwt.encode(
        payload, settings.JWT_SIGNING_KEY, algorithm=settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict[str, str]:
    """Return the validated claims, or raise ``jwt.PyJWTError``."""
    return jwt.decode(
        token,
        settings.JWT_SIGNING_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["sub", "email", "exp"]},
    )


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_refresh_token(user: User) -> str:
    raw = secrets.token_urlsafe(64)
    RefreshToken.objects.create(
        user=user,
        token_hash=_hash_token(raw),
        expires_at=datetime.now(UTC) + settings.REFRESH_TOKEN_LIFETIME,
    )
    return raw


def rotate_refresh_token(raw_token: str) -> tuple[str, User]:
    """Revoke the presented token and issue a fresh one.

    Raises ``ValueError`` if the token is unknown, revoked or expired.

    Reuse (replay) detection (security-standards §2): if a *known but already
    revoked* token is presented — the classic stolen-then-rotated case — every
    refresh token for that user is revoked and an audit event is written, so
    both attacker and victim are forced to re-authenticate.
    """
    token_hash = _hash_token(raw_token)
    stored = (
        RefreshToken.objects.select_related("user")
        .filter(token_hash=token_hash)
        .first()
    )
    if stored is None:
        raise ValueError("Invalid or expired refresh token")

    now = datetime.now(UTC)
    if stored.revoked:
        # Replay of an already-rotated token → treat as breach: nuke the family.
        RefreshToken.objects.filter(user=stored.user, revoked=False).update(
            revoked=True
        )
        record_audit(
            action="user.refresh_reuse_detected",
            resource_type="user",
            actor=stored.user,
            resource_id=stored.user_id,
        )
        raise ValueError("Refresh token reuse detected")
    if stored.expires_at <= now:
        raise ValueError("Invalid or expired refresh token")

    stored.revoked = True
    stored.save(update_fields=["revoked"])

    new_raw = secrets.token_urlsafe(64)
    RefreshToken.objects.create(
        user=stored.user,
        token_hash=_hash_token(new_raw),
        expires_at=now + settings.REFRESH_TOKEN_LIFETIME,
    )
    return new_raw, stored.user


def revoke_refresh_token(raw_token: str) -> None:
    RefreshToken.objects.filter(token_hash=_hash_token(raw_token)).update(revoked=True)


def user_id_from_sub(sub: str) -> uuid.UUID:
    return uuid.UUID(sub)
