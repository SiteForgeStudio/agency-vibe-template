"""Sparse listings, thin reviews, inconsistent categories, weak web presence."""

from __future__ import annotations

from tests.fixtures.markets.builders import SemanticMarketScenario, listing

SPARSE_WEAK_MARKET = SemanticMarketScenario(
    scenario_id="sparse_weak_market",
    niche="mobile diesel repair",
    target_location="Remote County, WY",
    competitors=(
        listing(name="Diesel Shack", review_count=2, rating=3.8, primary_category="Car repair shop"),
        listing(name="County Fleet Service", review_count=1, rating=4.1, primary_category="Truck dealer"),
        listing(name="Roadside Guys", review_count=0, rating=4.5, primary_category="Auto repair shop"),
    ),
    expectations={
        "synthesis_bundle_min_confidence_max": 0.52,
        "interpretation_confidence_max": 0.55,
        "assert_softened_posture_substrings": ("below_", "qualification"),
        "trust_confidence_below_density_margin": -0.02,
    },
)
