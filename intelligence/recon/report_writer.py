"""
Recon Report Generation Layer

Responsibilities:
- markdown report generation
- executive summaries
- opportunity summaries
- client-facing intelligence presentation

The report is downstream from recon intelligence.
"""

from __future__ import annotations

from intelligence.recon.models import ReconContract, ScoreInsight


def _score_line(prefix: str, insight: ScoreInsight | None) -> str:
    if insight is None:
        return f"- {prefix}: n/a"
    return f"- {prefix}: **{insight['label']}** (score `{insight['score']}`)"


def write_report(contract: ReconContract) -> str:
    """Return a concise markdown synopsis of the assembled recon contract."""
    meta = contract["meta"]
    mi = contract["market_intelligence"]
    ux = contract["ux_intelligence"]
    aeo = contract["aeo_intelligence"]
    oi = contract["opportunity_intelligence"]
    lines = [
        "# Recon report (placeholder pipeline)",
        "",
        "## Meta",
        f"- Generated: `{meta['generated_at']}`",
        f"- Niche: **{meta['niche']}**",
        f"- Target location: **{meta['target_location']}**",
        "",
        "## Market snapshot",
        _score_line("Market saturation", mi.get("market_saturation")),
        _score_line("Visual maturity", ux.get("visual_maturity")),
        _score_line("Trust density", ux.get("trust_density")),
        _score_line("Answerability", aeo.get("answerability")),
        f"- Competitive density: {mi.get('competitive_density', 'n/a')}",
        "",
        "## Opportunities (sample)",
        "",
    ]

    for item in oi.get("strategic_opportunities", []) or ["(none listed)"]:
        lines.append(f"- {item}")

    lines.extend(
        [
            "",
            "_Contract sections present: market, website, UX, emotional, AEO, intake._",
        ]
    )
    return "\n".join(lines)
