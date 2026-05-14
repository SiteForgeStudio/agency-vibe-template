"""Scenario catalog for semantic posture suites."""

from __future__ import annotations

from tests.fixtures.markets.builders import SemanticMarketScenario
from tests.fixtures.markets.contradictory_trust import CONTRADICTORY_TRUST_MARKET
from tests.fixtures.markets.dominant_incumbent import DOMINANT_INCUMBENT_MARKET
from tests.fixtures.markets.false_fragmentation import FALSE_FRAGMENTATION_MARKET
from tests.fixtures.markets.geo_weakness import GEO_WEAKNESS_MARKET
from tests.fixtures.markets.probe_contamination import PROBE_CONTAMINATION_MARKET
from tests.fixtures.markets.sparse_weak import SPARSE_WEAK_MARKET

SEMANTIC_MARKET_SCENARIOS: tuple[SemanticMarketScenario, ...] = (
    SPARSE_WEAK_MARKET,
    DOMINANT_INCUMBENT_MARKET,
    FALSE_FRAGMENTATION_MARKET,
    CONTRADICTORY_TRUST_MARKET,
    PROBE_CONTAMINATION_MARKET,
    GEO_WEAKNESS_MARKET,
)

SEMANTIC_SCENARIO_BY_ID: dict[str, SemanticMarketScenario] = {
    s.scenario_id: s for s in SEMANTIC_MARKET_SCENARIOS
}

__all__ = [
    "SEMANTIC_MARKET_SCENARIOS",
    "SEMANTIC_SCENARIO_BY_ID",
    "SemanticMarketScenario",
]
