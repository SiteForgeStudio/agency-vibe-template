"""
Recon Strategic Scoring Layer

Responsibilities:
- opportunity scoring
- trust scoring
- saturation scoring
- maturity scoring
- strategic weighting

Scoring should remain:
- deterministic
- explainable
- operationally useful
"""

from __future__ import annotations

from intelligence.recon.models import AnalysisPayload, ScorePayload


def score(analysis: AnalysisPayload) -> ScorePayload:
    """Return deterministic placeholder scores derived from placeholder analysis."""

    gap_count = max(1, len(analysis.get("gap_hypotheses", [])))
    base = 55.0 + float(gap_count) * 2.5

    def _clamp(x: float) -> float:
        return round(max(0.0, min(100.0, x)), 2)

    return {
        "opportunity": _clamp(base),
        "trust": _clamp(base - 5.0),
        "saturation": _clamp(100.0 - base * 0.6),
        "visual_maturity": _clamp(base - 12.0),
    }
