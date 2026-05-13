"""
Recon Assembly Layer

Responsibilities:
- normalize intelligence
- stabilize structures
- assemble recon.json
- validate schema compatibility

This layer produces machine-readable operational intelligence.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import cast

from intelligence.recon.config import ReconPipelineConfig
from intelligence.recon.models import (
    AnalysisPayload,
    CollectionPayload,
    MetaBlock,
    ReconContract,
    ScorePayload,
    WebsiteIntelligence,
)
from intelligence.recon.utils import score_insight_0_100


def _website_intel(analyzed: AnalysisPayload) -> WebsiteIntelligence:
    wi: WebsiteIntelligence = {
        "design_maturity": "placeholder_estimate: medium",
        "conversion_maturity": "placeholder_estimate: medium",
        "trust_architecture": analyzed["trust_structure_notes"],
        "positioning_strength": analyzed["positioning_notes"],
        "mobile_experience": "placeholder_estimate: baseline",
    }
    probe = analyzed.get("page_probe")
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
    """Fold placeholder stages into a minimal valid recon.json-shaped contract."""
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

    opp_gaps = list(analyzed["gap_hypotheses"])
    patterns = collected["snapshot_notes"][:2]

    return {
        "meta": meta,
        "market_intelligence": {
            "market_saturation": score_insight_0_100(scored["saturation"]),
            "competitive_density": f"{len(collected['competitor_labels'])} placeholder peers",
            "underserved_areas": ["Placeholder locality cluster A", "Placeholder locality cluster B"],
            "market_patterns": patterns,
        },
        "website_intelligence": _website_intel(analyzed),
        "ux_intelligence": {
            "visual_maturity": score_insight_0_100(scored["visual_maturity"]),
            "trust_density": score_insight_0_100(scored["trust"]),
            "cta_clarity": analyzed["ux_maturity_notes"],
            "content_structure_quality": "placeholder_estimate: workable",
        },
        "emotional_intelligence": {
            "dominant_tone": "placeholder: calm-competence",
            "emotional_positioning": "placeholder: reliability-first",
            "luxury_alignment": "neutral (skeleton)",
            "relationship_depth": "placeholder_shallow_signals",
        },
        "aeo_intelligence": {
            "schema_readiness": "placeholder: partial",
            "faq_coverage": "placeholder: sparse",
            "entity_depth": "placeholder: shallow",
            "answerability": score_insight_0_100(scored["opportunity"]),
        },
        "opportunity_intelligence": {
            "convenience_gaps": opp_gaps[:1],
            "excellence_gaps": opp_gaps[1:2],
            "underserved_segments": ["Placeholder persona: rush buyer"],
            "strategic_opportunities": opp_gaps[2:3],
        },
        "strategy_recommendation": {
            "recommended_positioning": "Trusted local specialist",
            "recommended_archetype": "authority_builder",
            "recommended_vibe": "clean_confidence",
            "recommended_conversion_style": "appointment-led",
            "recommended_trust_strategy": "credential_and_process_led",
        },
        "intake_guidance": {
            "priority_questions": [
                "What geography do you realistically serve?",
                "What proof do you already have (reviews, certs, portfolios)?",
            ],
            "priority_gaps": analyzed["gap_hypotheses"],
            "recommended_sections": ["hero_proof", "service_map", "process", "faq_entity"],
        },
    }
