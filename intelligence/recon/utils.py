"""
Shared recon utility helpers.

Responsibilities:
- formatting
- normalization
- cleanup
- parsing helpers
- retry helpers
- shared utility logic
"""

from __future__ import annotations

from intelligence.recon.intelligence_math import clamp01
from intelligence.recon.models import ScoreInsight


def score_band_label_0_100(value: float) -> str:
    """Map a 0–100 score to a coarse operational band."""

    v = float(value)
    if v < 40.0:
        return "low"
    if v < 70.0:
        return "moderate"
    return "high"


def score_insight_0_100(value: float) -> ScoreInsight:
    """Structured score + label for recon contract fields (0–100 scale)."""

    score = round(float(value), 2)
    return {"score": score, "label": score_band_label_0_100(score)}


def score_insight_deterministic_from_unit01(unit01: float) -> ScoreInsight:
    """0–1 deterministic primitive (e.g. density saturation_score) lifted to ScoreInsight semantics."""

    out = score_insight_0_100(clamp01(float(unit01)) * 100.0)
    out["status"] = "deterministic_derived"
    out["authority_level"] = "authoritative"
    return out


def score_insight_deterministic_0_100(value_0_100: float) -> ScoreInsight:
    """Interpret a value already scaled 0–100 as authoritative deterministic-derived."""

    out = score_insight_0_100(value_0_100)
    out["status"] = "deterministic_derived"
    out["authority_level"] = "authoritative"
    return out


def score_insight_legacy_scorer_transitional(signal_0_100: float) -> ScoreInsight:
    """Legacy scorer-derived magnitudes awaiting replacement by pipeline-specific determinism."""

    out = score_insight_0_100(signal_0_100)
    out["status"] = "legacy_scorer_transitional"
    out["authority_level"] = "non_authoritative"
    return out