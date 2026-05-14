"""
Cross-analyzer market-state interpretation.

Consumes deterministic analyzer primitives only; no raw evidence or narrative.
Uses shared intelligence_math for bounded deterministic composition.
"""

from __future__ import annotations

from intelligence.recon.confidence.propagation import propagate_interpretation_confidence
from intelligence.recon.intelligence_math import clamp01
from intelligence.recon.models import (
    AuthorityAnalysis,
    DensityAnalysis,
    GeoAnalysis,
    MarketStateInterpretation,
    TrustAnalysis,
)


def interpret_market_state(
    *,
    trust: TrustAnalysis,
    density: DensityAnalysis,
    authority: AuthorityAnalysis,
    geo: GeoAnalysis,
) -> MarketStateInterpretation:
    """
    Relate trust, density, authority, and geo primitives into bounded market-state indices.

    Weights are fixed operational coefficients (interpretable composites, not learned).
    """

    trust_mat01 = clamp01(trust["trust_maturity_score"] / 100.0)
    crowding = clamp01(density["competitor_count"] / 16.0)
    dom_floor = clamp01(authority["dominant_player_count"] / 8.0)
    rating_pressure = clamp01(max(0.0, trust["average_rating"] - 3.2) / 1.8)

    market_competitiveness = round(
        clamp01(
            0.32 * density["saturation_score"]
            + 0.24 * crowding
            + 0.22 * authority["market_leader_strength"]
            + 0.22 * trust_mat01
        ),
        6,
    )

    market_openness = round(
        clamp01(
            0.42 * authority["competitive_openness"]
            + 0.34 * density["market_fragmentation_score"]
            + 0.24 * geo["geo_authority_spread"]
        ),
        6,
    )

    authority_pressure = round(
        clamp01(
            0.36 * authority["market_leader_strength"]
            + 0.34 * authority["authority_concentration"]
            + 0.18 * trust["authority_concentration_score"]
            + 0.12 * dom_floor
        ),
        6,
    )

    entry_difficulty = round(
        clamp01(
            0.34 * density["saturation_score"]
            + 0.24 * authority["market_leader_strength"]
            + 0.18 * geo["market_centralization"]
            + 0.14 * clamp01(trust["top_3_review_share"])
            + 0.12 * density["category_consistency_score"]
            + 0.10 * rating_pressure
            - 0.12 * authority["competitive_openness"]
            - 0.10 * geo["adjacent_market_opportunity"]
        ),
        6,
    )

    geo_expansion_viability = round(
        clamp01(
            0.38 * geo["adjacent_market_opportunity"]
            + 0.28 * geo["geo_authority_spread"]
            + 0.18 * density["review_distribution_score"]
            + 0.16 * (1.0 - geo["market_centralization"])
        ),
        6,
    )

    confidence = propagate_interpretation_confidence(
        trust["confidence"],
        density["confidence"],
        authority["confidence"],
        geo["confidence"],
    )

    return {
        "market_competitiveness": float(market_competitiveness),
        "market_openness": float(market_openness),
        "authority_pressure": float(authority_pressure),
        "entry_difficulty": float(entry_difficulty),
        "geo_expansion_viability": float(geo_expansion_viability),
        "confidence": float(confidence),
    }
