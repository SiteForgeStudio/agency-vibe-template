"""
Strategic operating primitives from analyzers + interpretation + readiness.

Numeric posture/pressure composites only — no narratives, prescriptions, vibes, or raw evidence.
Weights are fixed for auditability downstream.
"""

from __future__ import annotations

from intelligence.recon.confidence.propagation import propagate_strategy_state_confidence
from intelligence.recon.intelligence_math import clamp01
from intelligence.recon.models import (
    AuthorityAnalysis,
    DensityAnalysis,
    GeoAnalysis,
    MarketReadiness,
    MarketStateInterpretation,
    StrategyState,
    TrustAnalysis,
)


def evaluate_strategy_state(
    *,
    trust: TrustAnalysis,
    density: DensityAnalysis,
    authority: AuthorityAnalysis,
    geo: GeoAnalysis,
    interpretation: MarketStateInterpretation,
    readiness: MarketReadiness,
) -> StrategyState:
    """Bounded posture indices (typically [0, 1]): higher pressures imply tighter operating conditions."""

    rating_norm01 = clamp01(max(0.0, trust["average_rating"] - 1.0) / 4.0)
    dom_floor = clamp01(authority["dominant_player_count"] / 8.0)

    trust_strategy_mode = round(
        clamp01(
            0.26 * trust["website_presence_ratio"]
            + 0.24 * rating_norm01
            + 0.26 * authority["trust_gap_score"]
            + 0.24 * interpretation["market_openness"]
        ),
        6,
    )

    positioning_pressure = round(
        clamp01(
            0.36 * density["category_consistency_score"]
            + 0.32 * clamp01(1.0 - density["market_fragmentation_score"])
            + 0.32 * clamp01(1.0 - interpretation["market_openness"])
        ),
        6,
    )

    conversion_pressure = round(
        clamp01(
            0.32 * density["saturation_score"]
            + 0.28 * interpretation["market_competitiveness"]
            + 0.24 * interpretation["entry_difficulty"]
            + 0.16 * authority["market_leader_strength"]
        ),
        6,
    )

    differentiation_pressure = round(
        clamp01(
            0.34 * authority["authority_concentration"]
            + 0.30 * trust["top_3_review_share"]
            + 0.18 * authority["market_leader_strength"]
            + 0.18 * clamp01(1.0 - readiness["differentiation_readiness"])
        ),
        6,
    )

    geo_expansion_pressure = round(
        clamp01(
            0.40 * geo["market_centralization"]
            + 0.32 * clamp01(1.0 - interpretation["geo_expansion_viability"])
            + 0.28 * clamp01(1.0 - readiness["geo_readiness"])
        ),
        6,
    )

    authority_response_pressure = round(
        clamp01(
            0.44 * interpretation["authority_pressure"]
            + 0.36 * authority["authority_concentration"]
            + 0.20 * dom_floor
        ),
        6,
    )

    confidence = propagate_strategy_state_confidence(
        trust["confidence"],
        density["confidence"],
        authority["confidence"],
        geo["confidence"],
        interpretation["confidence"],
        readiness["confidence"],
    )

    return {
        "trust_strategy_mode": float(trust_strategy_mode),
        "positioning_pressure": float(positioning_pressure),
        "conversion_pressure": float(conversion_pressure),
        "differentiation_pressure": float(differentiation_pressure),
        "geo_expansion_pressure": float(geo_expansion_pressure),
        "authority_response_pressure": float(authority_response_pressure),
        "confidence": float(confidence),
    }
