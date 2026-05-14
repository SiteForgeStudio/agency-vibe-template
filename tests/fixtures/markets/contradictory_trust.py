"""Polished ratings with thin aggregate volume."""

from __future__ import annotations

from tests.fixtures.markets.builders import SemanticMarketScenario, listing

CONTRADICTORY_TRUST_MARKET = SemanticMarketScenario(
    scenario_id="contradictory_trust_signals",
    niche="boutique vinyl wrapping",
    target_location="Miami Beach, FL",
    competitors=tuple(
        listing(
            name=f"Vinyl Haus {idx}",
            review_count=4 + idx % 3,
            rating=4.95,
            primary_category="Car detailing service",
            website=f"https://vinyl-{idx}.example.test",
        )
        for idx in range(9)
    ),
    expectations={
        "average_rating_min": 4.85,
        "trust_confidence_max": 0.82,
        "total_reviews_max": 120,
        "synthesis_bundle_mean_confidence_max": 0.72,
    },
)
