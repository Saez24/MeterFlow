"""Auth endpoints: register / login / refresh / logout / me (contract §2)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.db import IntegrityError
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.cookies import clear_auth_cookies, set_auth_cookies
from apps.accounts.models import User
from apps.accounts.serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.accounts.tokens import (
    create_access_token,
    create_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
)
from apps.common.audit import record_audit
from apps.common.auth import request_user

logger = logging.getLogger(__name__)

_RATE_LIMITED = Response(
    {"detail": "Too many requests"}, status=status.HTTP_429_TOO_MANY_REQUESTS
)


def _issue_tokens(user: User, response: Response) -> None:
    access = create_access_token(user)
    refresh = create_refresh_token(user)
    set_auth_cookies(response, access, refresh)


@method_decorator(
    ratelimit(key="ip", rate="2/m", method="POST", block=False), name="post"
)
class RegisterView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        if getattr(request, "limited", False):
            return _RATE_LIMITED
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = User.objects.create_user(
                email=data["email"], password=data["password"]
            )
        except IntegrityError:
            return Response(
                {"detail": "Email already registered"},
                status=status.HTTP_409_CONFLICT,
            )
        response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        _issue_tokens(user, response)
        record_audit(
            action="user.register",
            resource_type="user",
            request=request,
            actor=user,
            resource_id=user.id,
        )
        logger.info("auth.register.success user_id=%s", user.id)
        return response


@method_decorator(
    ratelimit(key="ip", rate="3/m", method="POST", block=False), name="post"
)
class LoginView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        if getattr(request, "limited", False):
            return _RATE_LIMITED
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects.filter(email=data["email"]).first()
        if user is None or not user.check_password(data["password"]):
            # No PII (email) in logs — the audit row is the record of truth
            # (security-standards §6). Log only that a failure occurred.
            logger.warning("auth.login.failed")
            record_audit(
                action="user.login_failed", resource_type="user", request=request
            )
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        response = Response(UserSerializer(user).data)
        _issue_tokens(user, response)
        record_audit(
            action="user.login",
            resource_type="user",
            request=request,
            actor=user,
            resource_id=user.id,
        )
        logger.info("auth.login.success user_id=%s", user.id)
        return response


@method_decorator(
    ratelimit(key="ip", rate="10/m", method="POST", block=False), name="post"
)
class RefreshView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        if getattr(request, "limited", False):
            return _RATE_LIMITED
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not raw:
            return Response(
                {"detail": "No refresh token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            new_refresh, user = rotate_refresh_token(raw)
        except ValueError:
            return Response(
                {"detail": "Invalid or expired refresh token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        response = Response(UserSerializer(user).data)
        set_auth_cookies(response, create_access_token(user), new_refresh)
        return response


@method_decorator(
    ratelimit(key="ip", rate="10/m", method="POST", block=False), name="post"
)
class LogoutView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        if getattr(request, "limited", False):
            return _RATE_LIMITED
        # Logout revokes the refresh token server-side (below) and clears cookies.
        # The stateless access JWT stays valid until it expires (≤15 min,
        # ACCESS_TOKEN_LIFETIME) — an accepted residual risk (security-standards
        # §2). A jti denylist would close it but adds a per-request cache lookup
        # for little gain given the short lifetime.
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw:
            revoke_refresh_token(raw)
        record_audit(action="user.logout", resource_type="user", request=request)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(UserSerializer(request_user(request)).data)
