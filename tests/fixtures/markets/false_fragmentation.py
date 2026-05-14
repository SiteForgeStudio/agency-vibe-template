"""Many shallow listings masking concentration of reviews among top leaders."""

from __future__ import annotations

from tests.fixtures.markets.builders import SemanticMarketScenario, listing

FALSE_FRAGMENTATION_MARKET = SemanticMarketScenario(
    scenario_id="false_fragmentation_trap",
    niche="metro orthodontists",
    target_location="Phoenix, AZ",
    competitors=tuple(
        [
            listing(
                name="Smile Empire Central",
                review_count=5200,
                rating=4.9,
                primary_category="Orthodontist",
                website="https://smile-empire.example.test",
            ),
            listing(
                name="Brace Collective Midtown",
                review_count=4100,
                rating=4.8,
                primary_category="Orthodontist",
                website="https://brace-collective.example.test",
            ),
            listing(
                name="Align Elite Scottsdale",
                review_count=3800,
                rating=4.7,
                primary_category="Dental clinic",
                website="https://align-elite.example.test",
            ),
        ]
        + [
            listing(
                name=f"Strip Mall Ortho Slot {k}",
                review_count=6 + (k % 4),
                rating=4.6,
                primary_category="Orthodontist" if k % 2 == 0 else "Cosmetic dentist",
                website=f"https://strip-slot-{k}.example.test",
            )
            for k in range(14)
        ]
    ),
    expectations={
        "competitor_count_min": 12,
        "top_3_review_share_min": 0.82,
        "authority_pressure_min": 0.22,
        "market_openness_max": 0.62,
        "fragmentation_entropy_min": 0.35,
    },
)
