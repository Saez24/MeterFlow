"""Reading photo upload: multipart, content-type + ownership checks (§12.4)."""

from __future__ import annotations

from datetime import date

import allure
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from tests.api.facade import ApiFacade
from tests.base import BaseTest
from tests.data.generator import DataGenerator
from tests.models.schemas import MeterResponse, ReadingResponse

# Minimal valid PNG (1x1 transparent pixel).
_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d4944415478da6360000002000154a24f9b0000000049454e44ae426082"
)


def _png() -> SimpleUploadedFile:
    return SimpleUploadedFile("photo.png", _PNG_BYTES, content_type="image/png")


@allure.epic("Backend")
@allure.feature("Reading photo")
class TestReadingPhoto(BaseTest):
    def _reading(self, api: ApiFacade, data: DataGenerator) -> ReadingResponse:
        meter = MeterResponse.model_validate(
            self.assert_status(api.meters.create(data.meter_request()), 201)
        )
        return ReadingResponse.model_validate(
            self.assert_status(
                api.readings.create(
                    data.reading_request(meter.id, value="1000", on=date(2026, 1, 1))
                ),
                201,
            )
        )

    @allure.story("Upload")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_upload_sets_photo_url(
        self,
        auth_api: ApiFacade,
        data: DataGenerator,
        settings: pytest.FixtureRequest,
        tmp_path: object,
    ) -> None:
        # Arrange — write uploads into a throwaway media dir
        settings.MEDIA_ROOT = str(tmp_path)  # type: ignore[attr-defined]
        reading = self._reading(auth_api, data)
        # Act
        response = auth_api.readings.upload_photo(reading.id, _png())
        # Assert — photo is exposed as an authenticated endpoint URL, not /media
        body = self.assert_status(response, 200)
        assert body["photo"] == f"/api/v1/readings/{reading.id}/photo/"
        # …and the owner can fetch the image bytes back
        served = auth_api.readings.get_photo(reading.id)
        assert served.status_code == 200
        assert served["Content-Type"] == "image/png"

    @allure.story("Delete")
    @allure.severity(allure.severity_level.NORMAL)
    def test_delete_photo_removes_it(
        self,
        auth_api: ApiFacade,
        data: DataGenerator,
        settings: pytest.FixtureRequest,
        tmp_path: object,
    ) -> None:
        # Arrange
        settings.MEDIA_ROOT = str(tmp_path)  # type: ignore[attr-defined]
        reading = self._reading(auth_api, data)
        self.assert_status(auth_api.readings.upload_photo(reading.id, _png()), 200)
        # Act
        self.assert_status(auth_api.readings.delete_photo(reading.id), 204)
        # Assert — photo gone
        assert auth_api.readings.get_photo(reading.id).status_code == 404

    @allure.story("Validation")
    @allure.severity(allure.severity_level.NORMAL)
    def test_upload_rejects_non_image(
        self,
        auth_api: ApiFacade,
        data: DataGenerator,
        settings: pytest.FixtureRequest,
        tmp_path: object,
    ) -> None:
        # Arrange
        settings.MEDIA_ROOT = str(tmp_path)  # type: ignore[attr-defined]
        reading = self._reading(auth_api, data)
        bad = SimpleUploadedFile("note.txt", b"hello", content_type="text/plain")
        # Act / Assert
        self.assert_status(auth_api.readings.upload_photo(reading.id, bad), 400)

    @allure.story("Access control")
    @allure.severity(allure.severity_level.BLOCKER)
    @pytest.mark.django_db
    def test_cannot_upload_to_foreign_reading(
        self,
        data: DataGenerator,
        settings: pytest.FixtureRequest,
        tmp_path: object,
    ) -> None:
        # Arrange
        settings.MEDIA_ROOT = str(tmp_path)  # type: ignore[attr-defined]
        user_a = ApiFacade()
        user_a.authenticate(data)
        reading = self._reading(user_a, data)
        user_b = ApiFacade()
        user_b.authenticate(data)
        # Act
        response = user_b.readings.upload_photo(reading.id, _png())
        # Assert — foreign row must not leak
        self.assert_status(response, 404)

    @allure.story("Access control")
    @allure.severity(allure.severity_level.BLOCKER)
    @pytest.mark.django_db
    def test_cannot_fetch_foreign_photo(
        self,
        data: DataGenerator,
        settings: pytest.FixtureRequest,
        tmp_path: object,
    ) -> None:
        # Arrange — user A uploads a photo
        settings.MEDIA_ROOT = str(tmp_path)  # type: ignore[attr-defined]
        user_a = ApiFacade()
        user_a.authenticate(data)
        reading = self._reading(user_a, data)
        self.assert_status(user_a.readings.upload_photo(reading.id, _png()), 200)
        user_b = ApiFacade()
        user_b.authenticate(data)
        # Act — user B tries to fetch the image (the whole point of §4)
        response = user_b.readings.get_photo(reading.id)
        # Assert — foreign photo must not leak
        assert response.status_code == 404

    @allure.story("Access control")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.django_db
    def test_upload_requires_authentication(
        self, data: DataGenerator, settings: pytest.FixtureRequest, tmp_path: object
    ) -> None:
        # Arrange — a real reading owned by someone, uploaded to by an anonymous client
        settings.MEDIA_ROOT = str(tmp_path)  # type: ignore[attr-defined]
        owner = ApiFacade()
        owner.authenticate(data)
        reading = self._reading(owner, data)
        anon = ApiFacade()
        # Act / Assert
        self.assert_status(anon.readings.upload_photo(reading.id, _png()), 401)
