"""
Recon Assembly Layer

Responsibilities:
- normalize intelligence
- stabilize structures
- assemble recon.json
- validate schema compatibility

This layer produces machine-readable operational intelligence.
Deterministic primitives (analyzer / interpreter / readiness / strategy-state) passthrough verbatim.
Legacy scorer + prose scaffolding is explicitly marked non_authoritative metadata.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import cast

from intelligence.recon.config import ReconPipelineConfig
from intelligence.recon.models import (
    AnalysisPayload,
    AuthorityMetadataBanner,
    CollectionPayload,
    MarketIntelligence,
    MetaBlock,
    ReconContract,
    ScorePayload,
    WebsiteIntelligence,
)
from intelligence.recon.utils import (
    score_insight_deterministic_0_100,
    score_insight_deterministic_from_unit01,
    score_insight_legacy_scorer_transitional,
)

_BANNER_DETERMINISTIC_PRIMARY: AuthorityMetadataBanner = {
    "status": "deterministic_authoritative_bundle",
    "authority_level": "deterministic_primary",
}

_BANNER_PLACEHOLDER_SECTION: AuthorityMetadataBanner = {
    "status": "placeholder",
    "authority_level": "non_authoritative",
}

_BANNER_MIXED_ANALYST_ECHO: AuthorityMetadataBanner = {
    "status": "mixed_collector_echo",
    "authority_level": "non_authoritative",
}


def _market_intel(
    collected: CollectionPayload,
    analyzed: AnalysisPayload,
) -> MarketIntelligence:
    pts = analyzed.get("places_text_search")
    labels_n = len(collected["competitor_labels"])
    dd = analyzed["density_analysis"]

    if pts is not None:
        if pts.get("fetch_ok") and pts.get("competitors"):
            cd = f"[EVIDENCE] {len(pts['competitors'])} Places text-search listing rows collected"
        elif pts.get("fetch_ok"):
            cd = "[EVIDENCE] 0 Places listing rows collected for query"
        else:
            err = ((pts.get("error") or "unknown")).replace("\n", " ")[:120]
            cd = (
                "[EVIDENCE] Places probe failed ({err}); {labels_n} configured peer placeholders"
            ).format(err=err, labels_n=labels_n)
    else:
        cd = f"[EVIDENCE] No Places envelope; {labels_n} configured peer placeholders"

    patterns = list(collected["snapshot_notes"][:2])
    saturated = score_insight_deterministic_from_unit01(dd["saturation_score"])

    mi: MarketIntelligence = {
        "authority_metadata": _BANNER_DETERMINISTIC_PRIMARY,
        "density_analysis": dd,
        "authority_analysis": analyzed["authority_analysis"],
        "geo_analysis": analyzed["geo_analysis"],
        "market_state_interpretation": analyzed["market_state_interpretation"],
        "market_readiness": analyzed["market_readiness"],
        "strategy_state": analyzed["strategy_state"],
        "market_saturation": saturated,
        "competitive_density": cd,
        "underserved_areas": [
            "[PLACEHOLDER] Geography scaffold only — deterministic geo signals live under geo_analysis / market_readiness.",
        ],
        "market_patterns": patterns,
    }
    if pts is not None:
        mi["places_text_search"] = pts
    return mi


def _website_intel(analyzed: AnalysisPayload) -> WebsiteIntelligence:
    ta = analyzed.get("trust_analysis")
    probe = analyzed.get("page_probe")

    wi: WebsiteIntelligence = {"authority_metadata": _BANNER_PLACEHOLDER_SECTION}
    if ta is not None:
        wi["trust_analysis"] = ta
    wi["design_maturity"] = "[PLACEHOLDER] UX surface estimate — authoritative proof is page_probe collector facts only."
    wi["conversion_maturity"] = "[PLACEHOLDER] UX surface estimate — not scored against deterministic infra."
    wi["trust_architecture"] = analyzed["trust_structure_notes"]
    wi["positioning_strength"] = analyzed["positioning_notes"]
    wi["mobile_experience"] = "[PLACEHOLDER] UX surface estimate — not operational intelligence."
    if probe is not None:
        wi["page_probe"] = probe
    return wi


def assemble(
    *,
    collected: CollectionPayload,
    analyzed: AnalysisPayload,
    scored: ScorePayload,
    config: ReconPipelineConfig,
) -> ReconContract:
    """Fold deterministic + transitional stages into recon.json-shaped contract."""
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    meta_payload: dict[str, object] = {
        "generated_at": now,
        "niche": config.niche,
        "target_location": config.target_location,
    }
    if config.hub_city:
        meta_payload["hub_city"] = config.hub_city
    if config.shoulder_towns:
        meta_payload["shoulder_towns"] = list(config.shoulder_towns)
    meta = cast(MetaBlock, meta_payload)

    ta = analyzed.get("trust_analysis")
    ux_trust_dense = score_insight_deterministic_0_100(
        ta["trust_maturity_score"] if ta is not None else 0.0
    )

    opp_gaps = list(analyzed["gap_hypotheses"])
    gap_stub = "[PLACEHOLDER] Not strategic intelligence — use market_readiness + interpretation blocks."

    return {
        "meta": meta,
        "market_intelligence": _market_intel(collected, analyzed),
        "website_intelligence": _website_intel(analyzed),
        "ux_intelligence": {
            "authority_metadata": _BANNER_PLACEHOLDER_SECTION,
            "visual_maturity": score_insight_legacy_scorer_transitional(scored["visual_maturity"]),
            "trust_density": ux_trust_dense,
            "cta_clarity": f"[PLACEHOLDER] Collector/scaffold prose only — not UX authority. {analyzed['ux_maturity_notes']}",
            "content_structure_quality": "[PLACEHOLDER] Non-authoritative until UX analyzers ship.",
        },
        "emotional_intelligence": {
            "authority_metadata": _BANNER_PLACEHOLDER_SECTION,
            "dominant_tone": "[PLACEHOLDER] Emotional scaffolding — no tonal model.",
            "emotional_positioning": "[PLACEHOLDER] Emotional scaffolding — no tonal model.",
            "luxury_alignment": "[PLACEHOLDER] Emotional scaffolding — no tonal model.",
            "relationship_depth": "[PLACEHOLDER] Emotional scaffolding — no tonal model.",
        },
        "aeo_intelligence": {
            "authority_metadata": _BANNER_PLACEHOLDER_SECTION,
            "schema_readiness": "[PLACEHOLDER] AEO not operational — no crawler/analyzer linkage.",
            "faq_coverage": "[PLACEHOLDER] AEO not operational — no crawler/analyzer linkage.",
            "entity_depth": "[PLACEHOLDER] AEO not operational — no crawler/analyzer linkage.",
            "answerability": score_insight_legacy_scorer_transitional(scored["opportunity"]),
        },
        "opportunity_intelligence": {
            "authority_metadata": _BANNER_PLACEHOLDER_SECTION,
            "convenience_gaps": [gap_stub],
            "excellence_gaps": [gap_stub],
            "underserved_segments": [gap_stub],
            "strategic_opportunities": [gap_stub],
        },
        "strategy_recommendation": {
            "authority_metadata": _BANNER_PLACEHOLDER_SECTION,
            "recommended_positioning": "[PLACEHOLDER] Strategy channel disabled — use market_readiness + strategy_state for deterministic prep/posture primitives only.",
            "recommended_archetype": "[PLACEHOLDER] Strategy channel disabled.",
            "recommended_vibe": "[PLACEHOLDER] Strategy channel disabled.",
            "recommended_conversion_style": "[PLACEHOLDER] Strategy channel disabled.",
            "recommended_trust_strategy": "[PLACEHOLDER] Strategy channel disabled.",
        },
        "intake_guidance": {
            "authority_metadata": _BANNER_MIXED_ANALYST_ECHO,
            "priority_questions": [
                "Operational questions for humans (non-authoritative templates).",
                "Where do deterministic blocks disagree with legacy scorer outputs?",
            ],
            "priority_gaps": opp_gaps,
            "recommended_sections": [
                "[PLACEHOLDER] Section hints only — authoritative metrics: trust_analysis, density_analysis, authority_analysis, geo_analysis, market_state_interpretation, market_readiness, strategy_state.",
            ],
        },
    }
