"""camelCase JSON renderer that serializes Decimal as a string.

DRF's default encoder renders ``Decimal`` as a float, so raw-dict responses
(the stats endpoints) would lose precision and disagree with serializer-based
responses (which emit decimal strings). This encoder makes both consistent.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from djangorestframework_camel_case.render import CamelCaseJSONRenderer
from rest_framework.utils.encoders import JSONEncoder


class DecimalAsStringEncoder(JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


class CamelCaseDecimalRenderer(CamelCaseJSONRenderer):  # type: ignore[misc]
    encoder_class = DecimalAsStringEncoder
