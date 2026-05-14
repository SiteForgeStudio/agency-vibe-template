"""Gate flags for optional live GPT evaluation (explicit opt-in + credentials)."""

from __future__ import annotations

import importlib.util
import os

_ALLOWED_LIVE_FLAGS = frozenset({"1", "true", "yes", "on"})
_OPENAI_SPEC = importlib.util.find_spec("openai")

LIVE_SYNTHESIS_SKIP_REASON = (
    "live synthesis skipped — set LIVE_SYNTHESIS_EVAL=1 and OPENAI_API_KEY "
    "(see tests/semantic/live_synthesis/README.md)"
)


def live_synthesis_ready() -> bool:
    flag = (os.environ.get("LIVE_SYNTHESIS_EVAL") or "").strip().lower()
    if flag not in _ALLOWED_LIVE_FLAGS:
        return False
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    return bool(key) and _OPENAI_SPEC is not None


__all__ = ["LIVE_SYNTHESIS_SKIP_REASON", "live_synthesis_ready"]
