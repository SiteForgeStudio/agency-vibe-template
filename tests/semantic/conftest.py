"""Autouse guards — GPT stays dormant for deterministic posture suites only."""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _suppress_live_openai(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """Strip API keys for reproducible stubs unless evaluating ``live_synthesis``."""

    if "/live_synthesis/" in request.node.nodeid:
        yield
        return
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    yield
