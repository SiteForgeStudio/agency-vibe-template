"""Incumbent-heavy concentration and compressed openness."""

from __future__ import annotations

from tests.fixtures.markets.builders import SemanticMarketScenario, listing

DOMINANT_INCUMBENT_MARKET = SemanticMarketScenario(
    scenario_id="dominant_incumbent_market",
    niche="metro ambulance billing",
    target_location="Chicago, IL",
    competitors=tuple(
        [
            listing(
                name="Metro Claims Leviathan",
                review_count=28500,
                rating=5.0,
                primary_category="Medical billing service",
                website="https://leviathan-billing.example.test",
            ),
            listing(
                name="Regional Clearinghouse Beta",
                review_count=820,
                rating=4.4,
                primary_category="Medical billing service",
                website="https://clearing-beta.example.test",
            ),
        ]
        + [
            listing(
                name=f"Micro Billing Boutique {j}",
                review_count=15 + j % 6,
                rating=4.2,
                primary_category="Medical billing service",
                website=f"https://micro-{j}.example.test",
            )
            for j in range(9)
        ]
    ),
    hub_city="Chicago",
    shoulder_towns=("Evanston", "Oak Park"),
    expectations={
        "authority_pressure_min": 0.42,
        "entry_difficulty_min": 0.42,
        "differentiation_pressure_min": 0.38,
        "market_openness_max": 0.82,
        "authority_concentration_min": 0.52,
        "leader_strength_min": 0.52,
    },
)
