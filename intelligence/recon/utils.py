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