"""
Strategic readiness indices from analyzer primitives and market-state interpretation.

No raw evidence, prose, or recommendations — fixed-weight deterministic conditions only.
"""

from __future__ import annotations

from intelligence.recon.intelligence_math import clamp01
from intelligence.recon.models import (
    AuthorityAnalysis,
    DensityAnalysis,
    GeoAnalysis,
    MarketReadiness,
    MarketStateInterpretation,
    TrustAnalysis,
)


def evaluate_market_readiness(
    *,
    trust: TrustAnalysis,
    density: DensityAnalysis,
    authority: AuthorityAnalysis,
    geo: GeoAnalysis,
    interpretation: MarketStateInterpretation,
) -> MarketReadiness:
    """Cross-layer readiness primitives (bounded [0, 1]; confidence-aware tail mean)."""

    trust_mat01 = clamp01(trust["trust_maturity_score"] / 100.0)
    review_diffusion = clamp01(1.0 - trust["top_3_review_share"])
    geo_decentral = clamp01(1.0 - geo["market_centralization"])
    category_headroom = clamp01(1.0 - density["category_consistency_score"])
    saturation_headroom = clamp01(1.0 - density["saturation_score"])
    leader_headroom = clamp01(1.0 - authority["market_leader_strength"])
    pressure_relief = clamp01(1.0 - interpretation["authority_pressure"])
    competitiveness_headroom = clamp01(1.0 - interpretation["market_competitiveness"])
    concentration_relief_trust = clamp01(1.0 - trust["authority_concentration_score"])

    trust_readiness = round(
        clamp01(
            0.30 * trust_mat01
            + 0.22 * trust["website_presence_ratio"]
            + 0.20 * review_diffusion
            + 0.18 * interpretation["market_openness"]
            + 0.10 * geo_decentral
        ),
        6,
    )

    positioning_readiness = round(
        clamp01(
            0.32 * density["market_fragmentation_score"]
            + 0.30 * category_headroom
            + 0.22 * interpretation["market_openness"]
            + 0.16 * saturation_headroom
        ),
        6,
    )

    authority_readiness = round(
        clamp01(
            0.34 * authority["competitive_openness"]
            + 0.26 * interpretation["market_openness"]
            + 0.22 * pressure_relief
            + 0.18 * leader_headroom
        ),
        6,
    )

    geo_readiness = round(
        clamp01(
            0.32 * geo["adjacent_market_opportunity"]
            + 0.28 * interpretation["geo_expansion_viability"]
            + 0.22 * geo["geo_authority_spread"]
            + 0.18 * geo["hub_strength"]
        ),
        6,
    )

    differentiation_readiness = round(
        clamp01(
            0.28 * authority["trust_gap_score"]
            + 0.26 * density["review_distribution_score"]
            + 0.22 * concentration_relief_trust
            + 0.24 * competitiveness_headroom
        ),
        6,
    )

    confidence = round(
        clamp01(
            (
                trust["confidence"]
                + density["confidence"]
                + authority["confidence"]
                + geo["confidence"]
                + interpretation["confidence"]
            )
            / 5.0
        ),
        6,
    )

    return {
        "trust_readiness": float(trust_readiness),
        "positioning_readiness": float(positioning_readiness),
        "authority_readiness": float(authority_readiness),
        "geo_readiness": float(geo_readiness),
        "differentiation_readiness": float(differentiation_readiness),
        "confidence": float(confidence),
    }
