"""
Recon scorer surface (DEPRECATED transitional).

Market saturation for assembly is sourced from deterministic ``density_analysis.saturation_score``.
Trust-density UX overlays use ``trust_analysis.trust_maturity_score``.

Payload values here persist only as **non-authoritative** legacy signals bundled with explicit
assembly metadata (`score_insight_legacy_scorer_transitional`) for UX/AEO stubs.

Do **not** treat these floats as authoritative market intelligence — consult analyzers /
interpreters / readiness blocks.
"""

from __future__ import annotations

from intelligence.recon.models import AnalysisPayload, ScorePayload


def score(analysis: AnalysisPayload) -> ScorePayload:
    """Deterministic scaffold math only — outputs are flagged non-authoritative at assembly."""

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
