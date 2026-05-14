"""
Deterministic operational confidence propagation across recon layers.

Refines plain averaging with weighted means, bottleneck coupling toward weak
signals, and light structural penalties — all bounded, inspectable constants.

No probabilistic inference: fixed coefficients only.
"""

from __future__ import annotations

from collections.abc import Sequence

from intelligence.recon.intelligence_math import clamp01, population_stdev

# Analyzer roles in listing-heavy primitives vs geo envelope (sums to 1.0).
_WEIGHT_ANALYZERS_TRUST = 0.26
_WEIGHT_ANALYZERS_DENSITY = 0.28
_WEIGHT_ANALYZERS_AUTHORITY = 0.26
_WEIGHT_ANALYZERS_GEO = 0.20

_ANALYZER_WEIGHTS: tuple[float, ...] = (
    _WEIGHT_ANALYZERS_TRUST,
    _WEIGHT_ANALYZERS_DENSITY,
    _WEIGHT_ANALYZERS_AUTHORITY,
    _WEIGHT_ANALYZERS_GEO,
)

# Pull confidence toward weakest analyzer (reduces optimistic flattening).
_GAMMA_ANALYZER_BOTTLENECK = 0.22

_GAMMA_INTERPRETATION_BOTTLENECK = 0.32
_GEO_UNDERPERFORMANCE_COUP = 0.18  # scales gap between blended mean and geo confidence

_GAMMA_READINESS_GATE = 0.28
_ANALYZER_SHARE_IN_READINESS_BLEND = 0.44
_INTERP_SHARE_IN_READINESS_BLEND = 0.56
_GEO_WEAKNESS_READINESS_DAMP = 0.11  # when geo_conf << neutral band

_GAMMA_STRATEGY_BOTTLENECK = 0.26
_STRATEGY_WEIGHTS: tuple[float, ...] = (
    0.14,
    0.15,
    0.14,
    0.13,
    0.22,
    0.22,
)  # trust, density, authority, geo, interpretation, readiness
_STRATEGY_DISPERSION_SCALE = 1.35
_STRATEGY_DISPERSION_MAX_PENALTY = 0.14


def _weighted_mean(values: Sequence[float], weights: Sequence[float]) -> float:
    return float(sum(v * w for v, w in zip(values, weights, strict=True)))


def _mean_min_blend(weighted_mean: float, vmin: float, gamma: float) -> float:
    return clamp01((1.0 - gamma) * weighted_mean + gamma * vmin)


def propagate_analyzer_bundle_confidence(
    trust_confidence: float,
    density_confidence: float,
    authority_confidence: float,
    geo_confidence: float,
) -> float:
    """Layer-0 bundle mean for synthesis_contract (replaces uniform /4)."""

    vals = (trust_confidence, density_confidence, authority_confidence, geo_confidence)
    wmean = _weighted_mean(vals, _ANALYZER_WEIGHTS)
    blended = _mean_min_blend(wmean, min(vals), _GAMMA_ANALYZER_BOTTLENECK)
    return round(blended, 6)


def propagate_interpretation_confidence(
    trust_confidence: float,
    density_confidence: float,
    authority_confidence: float,
    geo_confidence: float,
) -> float:
    """Cross-analyzer confidence entering market_state_interpretation."""

    vals = (trust_confidence, density_confidence, authority_confidence, geo_confidence)
    wmean = _weighted_mean(vals, _ANALYZER_WEIGHTS)
    blended = _mean_min_blend(wmean, min(vals), _GAMMA_INTERPRETATION_BOTTLENECK)
    geo_gap = max(0.0, blended - geo_confidence)
    geo_damp = clamp01(1.0 - _GEO_UNDERPERFORMANCE_COUP * clamp01(geo_gap / 0.35))
    return round(clamp01(blended * geo_damp), 6)


def propagate_readiness_confidence(
    trust_confidence: float,
    density_confidence: float,
    authority_confidence: float,
    geo_confidence: float,
    interpretation_confidence: float,
) -> float:
    """Readiness layer: interpretation-forward blend with analyzer floor + geo damping."""

    vals = (trust_confidence, density_confidence, authority_confidence, geo_confidence)
    w_an = _weighted_mean(vals, _ANALYZER_WEIGHTS)
    vmin_an = min(vals)
    interp = interpretation_confidence
    gate = clamp01(_ANALYZER_SHARE_IN_READINESS_BLEND * w_an + _INTERP_SHARE_IN_READINESS_BLEND * interp)
    blended = _mean_min_blend(gate, min(vmin_an, interp), _GAMMA_READINESS_GATE)
    geo_weak = clamp01(max(0.0, 0.50 - geo_confidence) / 0.50)
    damped = clamp01(blended * (1.0 - _GEO_WEAKNESS_READINESS_DAMP * geo_weak))
    return round(damped, 6)


def propagate_strategy_state_confidence(
    trust_confidence: float,
    density_confidence: float,
    authority_confidence: float,
    geo_confidence: float,
    interpretation_confidence: float,
    readiness_confidence: float,
) -> float:
    """Strategy posture confidence: emphasizes interpretation/readiness gates + dispersion."""

    vals = (
        trust_confidence,
        density_confidence,
        authority_confidence,
        geo_confidence,
        interpretation_confidence,
        readiness_confidence,
    )
    wmean = _weighted_mean(vals, _STRATEGY_WEIGHTS)
    structural_floor = min(interpretation_confidence, readiness_confidence)
    blended = _mean_min_blend(wmean, structural_floor, _GAMMA_STRATEGY_BOTTLENECK)
    sd = population_stdev(vals)
    dispersion_penalty = clamp01(sd * _STRATEGY_DISPERSION_SCALE) * _STRATEGY_DISPERSION_MAX_PENALTY
    return round(clamp01(blended * (1.0 - dispersion_penalty)), 6)


__all__ = [
    "propagate_analyzer_bundle_confidence",
    "propagate_interpretation_confidence",
    "propagate_readiness_confidence",
    "propagate_strategy_state_confidence",
]
