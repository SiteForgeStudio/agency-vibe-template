"""
Recon Intelligence Analysis Layer

Responsibilities:
- UX analysis
- emotional analysis
- AEO analysis
- trust analysis
- market analysis
- positioning analysis

This layer transforms raw intelligence into structured intelligence.
"""

from __future__ import annotations

from intelligence.recon.models import AnalysisPayload, CollectionPayload


def _brief(text: str, max_len: int) -> str:
    t = text.strip().replace("\n", " ")
    if len(t) <= max_len:
        return t
    return f"{t[: max_len - 1].rstrip()}…"


def analyze(raw: CollectionPayload) -> AnalysisPayload:
    """Placeholder analysis enriched with verbatim collector probes when present."""

    labels = raw.get("competitor_labels", [])
    headline = labels[0] if labels else "Unknown competitive set"
    ux_maturity_notes = f"Skeleton UX read for {headline}"
    trust_structure_notes = "Placeholder trust scaffolding (reviews, certs, bios)"
    positioning_notes = "Placeholder positioning clustering (premium vs value)"
    gap_hypotheses = [
        "Placeholder gap: service bundling unclear",
        "Placeholder gap: local proof density low",
        "Placeholder gap: AEO entity coverage uneven",
    ]

    probe = raw.get("page_probe")
    if probe is not None:
        if probe.get("fetch_ok"):
            hints: list[str] = []
            if probe.get("title"):
                hints.append("title")
            if probe.get("meta_description"):
                hints.append("meta_description")
            if probe.get("first_h1"):
                hints.append("first_h1")
            if hints:
                ux_maturity_notes = (
                    f"{ux_maturity_notes} | Collected homepage metadata: {', '.join(hints)}"
                )

            meta_desc = probe.get("meta_description", "")
            first_h = probe.get("first_h1", "")
            if meta_desc or first_h:
                trust_structure_notes = (
                    trust_structure_notes
                    + " | Homepage HTML exposes description/headline signals (collector read only)."
                )

            pg_title = probe.get("title", "")
            if pg_title:
                positioning_notes = (
                    f"{positioning_notes} | Title tag excerpt: {_brief(pg_title, 120)}"
                )
        else:
            err_text = probe.get("error") or "probe_failed"
            status_part = ""
            hs = probe.get("http_status")
            if hs is not None:
                status_part = f" HTTP {hs}"
            ux_maturity_notes = (
                f"{ux_maturity_notes} | Homepage probe failed{status_part}: {_brief(err_text, 200)}"
            )

        if probe.get("fetch_ok") and not probe.get("meta_description"):
            gap_hypotheses = [
                *gap_hypotheses,
                "Observed collector gap: meta description absent or unstripped.",
            ]

    result: AnalysisPayload = {
        "ux_maturity_notes": ux_maturity_notes,
        "trust_structure_notes": trust_structure_notes,
        "positioning_notes": positioning_notes,
        "gap_hypotheses": gap_hypotheses,
    }

    if probe is not None:
        result["page_probe"] = {**probe}

    return result
