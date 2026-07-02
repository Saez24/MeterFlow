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
            logger.warning("auth.login.failed email=%s", data["email"])
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        response = Response(UserSerializer(user).data)
        _issue_tokens(user, response)
        logger.info("auth.login.success user_id=%s", user.id)
        return response


class RefreshView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
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


class LogoutView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw:
            revoke_refresh_token(raw)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(UserSerializer(request.user).data)
