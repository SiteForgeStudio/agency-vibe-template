"""Rich Places envelope without geo intake scaffolding."""

from __future__ import annotations

from tests.fixtures.markets.builders import SemanticMarketScenario, listing

GEO_WEAKNESS_MARKET = SemanticMarketScenario(
    scenario_id="geo_weakness_stress",
    niche="commercial refrigeration repair",
    target_location="Industrial corridor, NJ",
    competitors=tuple(
        listing(
            name=f"Cold Chain Crew {idx}",
            review_count=55 + idx * 11,
            rating=4.5,
            primary_category="Commercial refrigeration",
            website=f"https://coldcrew-{idx}.example.test",
        )
        for idx in range(10)
    ),
    expectations={
        "trust_confidence_over_geo_confidence_min_delta": 0.06,
        "geo_hub_strength_max": 0.05,
        "readiness_confidence_le_interpretation_margin": 0.03,
    },
)
