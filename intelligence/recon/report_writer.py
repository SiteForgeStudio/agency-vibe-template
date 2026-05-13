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

from intelligence.recon.models import ReconContract


def write_report(contract: ReconContract) -> str:
    """Return a concise markdown synopsis of the assembled recon contract."""
    meta = contract["meta"]
    mi = contract["market_intelligence"]
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
        f"- Saturation cue: {mi.get('market_saturation', 'n/a')}",
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
