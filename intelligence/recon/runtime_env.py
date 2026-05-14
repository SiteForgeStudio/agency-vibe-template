"""
Load repo-root environment for recon runtime entry points only.

Keeps orchestration/analyzer/scorer/assembler modules free of env reads.
Third-party tooling can read vars such as ``GOOGLE_PLACES_API_KEY`` from ``os.environ`` after load.
"""

from __future__ import annotations

from pathlib import Path

# Canonical name used in `.env`; collectors / integrations may resolve via ``os.getenv(...)``.
GOOGLE_PLACES_API_KEY_ENV = "GOOGLE_PLACES_API_KEY"

_REPO_ROOT = Path(__file__).resolve().parents[2]


def load_recon_repo_dotenv() -> None:
    """Populate ``os.environ`` from ``<repo>/.env`` if the file exists (does not replace existing vars)."""

    try:
        from dotenv import load_dotenv
    except ImportError as exc:  # pragma: no cover
        raise ImportError(
            "Recon repo dotenv loading requires python-dotenv. "
            "Install with: pip install -r intelligence/recon/requirements.txt"
        ) from exc

    load_dotenv(_REPO_ROOT / ".env", override=False)
