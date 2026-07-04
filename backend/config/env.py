"""Load the repo-root `.env` into the process environment.

Called early from ``manage.py``, ``wsgi``/``asgi`` (so ``DJANGO_ENV`` picks the
settings module) and ``settings.base`` (so ``pytest``, which bypasses manage.py,
is covered too). ``override=False``: real environment variables win over `.env`,
and inside Docker (`.env` excluded via `.dockerignore`) the injected vars apply.
"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

# backend/config/env.py -> repo root is three levels up.
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


def load_env() -> None:
    if _ENV_FILE.is_file():
        load_dotenv(_ENV_FILE, override=False)
