"""
Recon Intelligence Analysis Layer

Orchestrates specialist analyzers; each module stays domain-scoped.

Responsibilities:
- UX / authority / density / trust / positioning / market reads (composed here)
- Post-analyzer cross-primitive interpretation attaches market_state_interpretation (deterministic)
- Interpretation-informed readiness attaches market_readiness (deterministic; prep only)
- Readiness-informed strategy posture attaches strategy_state (deterministic composites only)
"""

from __future__ import annotations

from intelligence.recon.analyzers.authority_analyzer import analyze_authority_signals
from intelligence.recon.analyzers.density_analyzer import analyze_density_signals
from intelligence.recon.analyzers.geo_analyzer import analyze_geo_structure
from intelligence.recon.analyzers.trust_analyzer import analyze_trust_signals
from intelligence.recon.interpreters.market_interpreter import interpret_market_state
from intelligence.recon.readiness.market_readiness import evaluate_market_readiness
from intelligence.recon.strategy.strategy_state import evaluate_strategy_state
from intelligence.recon.models import (
    AnalysisPayload,
    CollectionPayload,
    PlacesTextSearchEvidence,
)


def _brief(text: str, max_len: int) -> str:
    t = text.strip().replace("\n", " ")
    if len(t) <= max_len:
        return t
    return f"{t[: max_len - 1].rstrip()}…"


def analyze(raw: CollectionPayload) -> AnalysisPayload:
    """Build analysis payload plus deterministic primitives from collectors."""

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

    pts = raw.get("places_text_search")
    if pts is not None:
        out_pts: PlacesTextSearchEvidence = {
            "text_query": pts["text_query"],
            "fetch_ok": pts["fetch_ok"],
            "competitors": [dict(c) for c in pts.get("competitors", [])],
        }
        if "http_status" in pts:
            out_pts["http_status"] = pts["http_status"]
        if "error" in pts:
            out_pts["error"] = pts["error"]

        n_listings = len(out_pts["competitors"])
        if pts.get("fetch_ok"):
            trust_structure_notes = (
                trust_structure_notes
                + f" | Google Places text search indexed {n_listings} competitor rows (collector)."
            )
            if n_listings > 0:
                positioning_notes = (
                    positioning_notes + f" | Places returned {n_listings} named listings for text query."
                )
            else:
                gap_hypotheses = [
                    *gap_hypotheses,
                    "Places text search returned zero named listings for the niche/market pairing.",
                ]
        else:
            err_plain = pts.get("error") or "places_probe_failed"
            ux_maturity_notes = (
                ux_maturity_notes + f" | Places text search unavailable: {_brief(err_plain, 180)}"
            )

    places_fetch_ok = bool(pts["fetch_ok"]) if pts is not None else False
    trust_analysis = analyze_trust_signals(places=pts)
    density_analysis = analyze_density_signals(places=pts)
    authority_analysis = analyze_authority_signals(places=pts)
    geo_analysis = analyze_geo_structure(
        hub_city=raw.get("hub_city"),
        shoulder_towns=raw.get("shoulder_towns"),
        trust=trust_analysis,
        density=density_analysis,
        authority=authority_analysis,
        places_fetch_ok=places_fetch_ok,
    )
    market_state_interpretation = interpret_market_state(
        trust=trust_analysis,
        density=density_analysis,
        authority=authority_analysis,
        geo=geo_analysis,
    )
    market_readiness = evaluate_market_readiness(
        trust=trust_analysis,
        density=density_analysis,
        authority=authority_analysis,
        geo=geo_analysis,
        interpretation=market_state_interpretation,
    )
    strategy_state = evaluate_strategy_state(
        trust=trust_analysis,
        density=density_analysis,
        authority=authority_analysis,
        geo=geo_analysis,
        interpretation=market_state_interpretation,
        readiness=market_readiness,
    )

    result: AnalysisPayload = {
        "ux_maturity_notes": ux_maturity_notes,
        "trust_structure_notes": trust_structure_notes,
        "positioning_notes": positioning_notes,
        "gap_hypotheses": gap_hypotheses,
        "trust_analysis": trust_analysis,
        "density_analysis": density_analysis,
        "authority_analysis": authority_analysis,
        "geo_analysis": geo_analysis,
        "market_state_interpretation": market_state_interpretation,
        "market_readiness": market_readiness,
        "strategy_state": strategy_state,
    }

    if probe is not None:
        result["page_probe"] = {**probe}

    if pts is not None:
        result["places_text_search"] = out_pts

    return result
