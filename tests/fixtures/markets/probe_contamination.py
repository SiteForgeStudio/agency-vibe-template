"""Mega-brand homepage probe orthogonal to niche."""

from __future__ import annotations

from tests.fixtures.markets.builders import SemanticMarketScenario, listing

PROBE_CONTAMINATION_MARKET = SemanticMarketScenario(
    scenario_id="probe_contamination_attack",
    niche="auto detailing",
    target_location="Doylestown, PA",
    competitors=tuple(
        listing(
            name=f"Detail Studio {idx}",
            review_count=40 + idx * 7,
            rating=4.6,
            primary_category="Car detailing service",
            website=f"https://detail-{idx}.example.test",
        )
        for idx in range(5)
    ),
    page_probe={
        "url": "https://www.apple.com/",
        "fetch_ok": True,
        "http_status": 200,
        "title": "Apple",
        "meta_description": "Discover iPhone and more.",
        "first_h1": "iPhone 16 Pro",
    },
    expectations={
        "probe_authority_action": "suppress",
        "positioning_must_not_contain": ["Title tag excerpt:", "iPhone"],
        "market_narrative_must_not_contain": ["iPhone", "Apple Store"],
    },
)
