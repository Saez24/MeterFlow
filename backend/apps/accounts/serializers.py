"""Auth request/response serializers (contract §2)."""

from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import User


class RegisterSerializer(serializers.Serializer[dict[str, str]]):
    email = serializers.EmailField()
    password = serializers.CharField(
        min_length=8, max_length=128, write_only=True, trim_whitespace=False
    )


class LoginSerializer(serializers.Serializer[dict[str, str]]):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class UserSerializer(serializers.ModelSerializer[User]):
    class Meta:
        model = User
        fields = ["id", "email"]
        read_only_fields = fields
