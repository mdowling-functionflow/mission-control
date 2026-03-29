"""Vercel serverless entry point for the FastAPI backend."""

import sys
from pathlib import Path

# Ensure the backend root is on the Python path so `app.*` imports work
backend_root = str(Path(__file__).resolve().parent.parent)
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.main import app  # noqa: E402

# Vercel's Python runtime looks for an `app` ASGI variable at module level.
# Re-export it explicitly.
handler = app
