"""
Deterministic geographic market-structure primitives.

Combines contract/geo intake fields (hub, shoulder towns) with Places-derived
operational signals (density, authority, trust). Numeric facts only; no strategy
or narrative.
"""

from __future__ import annotations

from collections.abc import Sequence

from intelligence.recon.intelligence_math import (
    clamp01,
    confidence_sample_times_completeness,
    log1p_ratio_clamped,
)
from intelligence.recon.models import (
    AuthorityAnalysis,
    DensityAnalysis,
    GeoAnalysis,
    TrustAnalysis,
)


def analyze_geo_structure(
    *,
    hub_city: str | None,
    shoulder_towns: Sequence[str] | None,
    trust: TrustAnalysis,
    density: DensityAnalysis,
    authority: AuthorityAnalysis,
    places_fetch_ok: bool,
) -> GeoAnalysis:
    """Derive bounded geographic structure metrics from geo fields plus analyzer outputs."""

    shoulders = [s.strip() for s in (shoulder_towns or ()) if isinstance(s, str) and s.strip()]
    hub_label = hub_city.strip() if isinstance(hub_city, str) and hub_city.strip() else ""

    shoulder_fragmentation = round(
        clamp01(float(len(shoulders)) / 10.0),
        6,
    )

    if hub_label:
        hub_strength = round(
            clamp01(0.55 + 0.45 * log1p_ratio_clamped(float(len(shoulders)), 8.0)),
            6,
        )
    else:
        hub_strength = 0.0

    category_dispersion = clamp01(1.0 - density["category_consistency_score"])
    adjacent_market_opportunity = round(
        clamp01(
            0.28 * shoulder_fragmentation
            + 0.27 * clamp01(1.0 - density["saturation_score"])
            + 0.27 * authority["competitive_openness"]
            + 0.18 * category_dispersion
        ),
        6,
    )

    geo_authority_spread = round(
        clamp01(
            0.34 * authority["competitive_openness"]
            + 0.33 * clamp01(1.0 - authority["market_leader_strength"])
            + 0.33 * density["review_distribution_score"]
        ),
        6,
    )

    market_centralization = round(
        clamp01(
            0.5 * trust["top_3_review_share"] + 0.5 * authority["authority_concentration"]
        ),
        6,
    )

    n_listings = density["competitor_count"]
    breadth = max(n_listings, len(shoulders), 1 if hub_label else 0)
    geo_signal_ok = places_fetch_ok or bool(hub_label) or bool(shoulders)

    confidence = confidence_sample_times_completeness(
        fetch_ok=geo_signal_ok,
        n_listings=breadth,
        fracs=[
            1.0 if hub_label else 0.0,
            clamp01(float(len(shoulders)) / 6.0),
            density["confidence"] if places_fetch_ok else 0.0,
        ],
        weights=[0.35, 0.33, 0.32],
    )

    return {
        "hub_strength": float(hub_strength),
        "shoulder_fragmentation": float(shoulder_fragmentation),
        "adjacent_market_opportunity": float(adjacent_market_opportunity),
        "geo_authority_spread": float(geo_authority_spread),
        "market_centralization": float(market_centralization),
        "confidence": float(confidence),
    }
