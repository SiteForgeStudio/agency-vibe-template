"""Deterministic harness for semantic posture suites — behavior-focused, not smoke-only."""

from __future__ import annotations

from typing import Any

from intelligence.recon.analyzers import analyze
from intelligence.recon.assembler import assemble
from intelligence.recon.config import ReconPipelineConfig
from intelligence.recon.contract_validation import validate_recon_contract
from intelligence.recon.models import AnalysisPayload, ReconContract
from intelligence.recon.scorers import score

from tests.fixtures.markets.builders import SemanticMarketScenario, collection_payload_from_scenario


def analyze_scenario(spec: SemanticMarketScenario) -> AnalysisPayload:
    raw = collection_payload_from_scenario(spec)
    return analyze(raw)


def assemble_scenario_contract(spec: SemanticMarketScenario) -> ReconContract:
    raw = collection_payload_from_scenario(spec)
    analyzed = analyze(raw)
    cfg = ReconPipelineConfig(
        niche=spec.niche,
        target_location=spec.target_location,
        hub_city=spec.hub_city,
        shoulder_towns=tuple(spec.shoulder_towns),
    )
    scored = score(analyzed)
    contract = assemble(collected=raw, analyzed=analyzed, scored=scored, config=cfg)
    validate_recon_contract(dict(contract))
    return contract


def synthesis_confidence_snapshot(analysis: AnalysisPayload) -> dict[str, Any]:
    cc = analysis["synthesis_contract"]["confidence_context"]
    posture = analysis["market_narrative_synthesis"]["confidence_language_posture"]
    gov = analysis["narrative_synthesis_governance"]
    nar = analysis["market_narrative_synthesis"]
    blob = "".join(
        [
            nar["market_narrative"],
            nar["authority_narrative"],
            nar["trust_narrative"],
            nar["readiness_narrative"],
        ]
    ).lower()
    return {
        "analyzer_confidence_mean": cc["analyzer_confidence_mean"],
        "interpretation_confidence": cc["interpretation_confidence"],
        "readiness_confidence": cc["readiness_confidence"],
        "strategy_state_confidence": cc["strategy_state_confidence"],
        "synthesis_bundle_mean_confidence": cc["synthesis_bundle_mean_confidence"],
        "synthesis_bundle_min_confidence": cc["synthesis_bundle_min_confidence"],
        "confidence_language_posture": posture,
        "governance_validation_status": gov["validation_status"],
        "narrative_concat_lower": blob,
    }


def total_explicit_reviews(analysis: AnalysisPayload) -> int:
    pts = analysis.get("places_text_search")
    if pts is None:
        return 0
    total = 0
    for c in pts.get("competitors") or []:
        rc = c.get("review_count")
        if isinstance(rc, int) and rc >= 0:
            total += rc
    return total
