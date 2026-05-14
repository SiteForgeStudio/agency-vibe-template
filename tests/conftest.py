"""Pytest hooks — optional suites skip cleanly unless explicitly enabled."""

from __future__ import annotations

import pytest


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Function]) -> None:
    try:
        from tests.semantic.live_synthesis.gates import LIVE_SYNTHESIS_SKIP_REASON, live_synthesis_ready
    except ImportError:
        return

    ready = live_synthesis_ready()
    skip_live = pytest.mark.skip(reason=LIVE_SYNTHESIS_SKIP_REASON)
    live_marker = pytest.mark.live_synthesis

    for item in items:
        nodeid = item.nodeid.replace("\\", "/")
        if "/live_synthesis/" not in nodeid:
            continue
        item.add_marker(live_marker)
        if not ready:
            item.add_marker(skip_live)
