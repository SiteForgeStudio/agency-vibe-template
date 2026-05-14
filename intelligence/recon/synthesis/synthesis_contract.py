"""
Synthesis-safe deterministic packaging for future constrained narration.

Bundles ONLY authoritative analyzer/interpreter/readiness/strategy_state outputs.
No GPT, prose, collectors, placeholders, scorer stubs, or raw evidence rows.
"""

from __future__ import annotations

from intelligence.recon.confidence.propagation import propagate_analyzer_bundle_confidence
from intelligence.recon.intelligence_math import clamp01
from intelligence.recon.models import (
    AuthorityAnalysis,
    DensityAnalysis,
    GeoAnalysis,
    DeterministicSummariesFingerprint,
    MarketReadiness,
    MarketStateInterpretation,
    SemanticLineageMetadata,
    StrategyState,
    SynthesisAuthorityContext,
    SynthesisConfidenceContext,
    SynthesisContract,
    SynthesisContractAuthorityMetadata,
    TrustAnalysis,
)

SYNTHESIS_BUNDLE_SCHEMA_ID = "siteforge.recon.synthesis_bundle.v1"

_LINEAGE_MODULES = [
    "analyzers.trust",
    "analyzers.density",
    "analyzers.authority",
    "analyzers.geo",
    "interpreters.market",
    "readiness.market",
    "strategy.strategy_state",
]


def build_synthesis_contract(
    *,
    trust: TrustAnalysis,
    density: DensityAnalysis,
    authority: AuthorityAnalysis,
    geo: GeoAnalysis,
    interpretation: MarketStateInterpretation,
    readiness: MarketReadiness,
    strategy_state: StrategyState,
) -> SynthesisContract:
    """Assemble authoritative-only payload; deterministic summaries are numeric fingerprints only."""

    authority_context: SynthesisAuthorityContext = {
        "trust_analysis": trust,
        "density_analysis": density,
        "authority_analysis": authority,
        "geo_analysis": geo,
        "market_state_interpretation": interpretation,
        "market_readiness": readiness,
        "strategy_state": strategy_state,
    }

    analyzer_conf_mean = clamp01(
        propagate_analyzer_bundle_confidence(
            trust["confidence"],
            density["confidence"],
            authority["confidence"],
            geo["confidence"],
        )
    )

    interp_c = interpretation["confidence"]
    ready_c = readiness["confidence"]
    strat_c = strategy_state["confidence"]

    synth_mean = clamp01((analyzer_conf_mean + interp_c + ready_c + strat_c) / 4.0)
    synth_min = clamp01(min(analyzer_conf_mean, interp_c, ready_c, strat_c))

    confidence_context: SynthesisConfidenceContext = {
        "analyzer_confidence_mean": float(round(analyzer_conf_mean, 6)),
        "interpretation_confidence": float(round(interp_c, 6)),
        "readiness_confidence": float(round(ready_c, 6)),
        "strategy_state_confidence": float(round(strat_c, 6)),
        "synthesis_bundle_mean_confidence": float(round(synth_mean, 6)),
        "synthesis_bundle_min_confidence": float(round(synth_min, 6)),
    }

    authority_metadata: SynthesisContractAuthorityMetadata = {
        "bundle_schema_id": SYNTHESIS_BUNDLE_SCHEMA_ID,
        "synthesis_safe": True,
        "deterministic_primary": True,
        "excludes_raw_evidence": True,
        "excludes_placeholder_contract_sections": True,
        "excludes_legacy_scorers": True,
    }

    semantic_lineage: SemanticLineageMetadata = {
        "pipeline_stages_included": [
            "analyzers",
            "market_interpreter",
            "market_readiness",
            "strategy_state",
            "deterministic_summaries",
        ],
        "upstream_modules_in_bundle": list(_LINEAGE_MODULES),
        "deliberately_excluded": [
            "collection_payload",
            "places_text_search_competitors",
            "page_probe_documents",
            "ux_maturity_notes",
            "trust_structure_notes",
            "positioning_notes",
            "gap_hypotheses",
            "score_payload_legacy",
            "legacy_scorer_score_insights",
            "assembler_placeholder_intel_sections",
        ],
    }

    deterministic_summaries: DeterministicSummariesFingerprint = _deterministic_summaries(
        trust=trust,
        density=density,
        authority=authority,
        geo=geo,
        interpretation=interpretation,
        readiness=readiness,
        strategy_state=strategy_state,
        bundle_min_confidence=synth_min,
    )

    return {
        "authority_context": authority_context,
        "confidence_context": confidence_context,
        "authority_metadata": authority_metadata,
        "semantic_lineage": semantic_lineage,
        "deterministic_summaries": deterministic_summaries,
    }


def _deterministic_summaries(
    *,
    trust: TrustAnalysis,
    density: DensityAnalysis,
    authority: AuthorityAnalysis,
    geo: GeoAnalysis,
    interpretation: MarketStateInterpretation,
    readiness: MarketReadiness,
    strategy_state: StrategyState,
    bundle_min_confidence: float,
) -> DeterministicSummariesFingerprint:
    """Flatten key scalars — numeric audit trail for synthesis routing; no natural language."""

    readiness_vec = (
        readiness["trust_readiness"],
        readiness["positioning_readiness"],
        readiness["authority_readiness"],
        readiness["geo_readiness"],
        readiness["differentiation_readiness"],
    )
    strat_pressures = (
        strategy_state["positioning_pressure"],
        strategy_state["conversion_pressure"],
        strategy_state["differentiation_pressure"],
        strategy_state["geo_expansion_pressure"],
        strategy_state["authority_response_pressure"],
    )

    return {
        "trust_avg_rating": float(round(trust["average_rating"], 6)),
        "trust_maturity_score": float(round(trust["trust_maturity_score"], 6)),
        "trust_top_three_review_share": float(round(trust["top_3_review_share"], 6)),
        "trust_website_presence_ratio": float(round(trust["website_presence_ratio"], 6)),
        "density_competitor_count": int(density["competitor_count"]),
        "density_saturation_unit": float(round(density["saturation_score"], 6)),
        "density_market_fragmentation": float(round(density["market_fragmentation_score"], 6)),
        "authority_leader_strength": float(round(authority["market_leader_strength"], 6)),
        "authority_market_concentration": float(round(authority["authority_concentration"], 6)),
        "authority_competitive_openness": float(round(authority["competitive_openness"], 6)),
        "geo_hub_strength": float(round(geo["hub_strength"], 6)),
        "geo_market_centralization": float(round(geo["market_centralization"], 6)),
        "interpretation_market_competitiveness": float(
            round(interpretation["market_competitiveness"], 6)
        ),
        "interpretation_entry_difficulty": float(round(interpretation["entry_difficulty"], 6)),
        "readiness_minimum_domain": float(round(min(readiness_vec), 6)),
        "readiness_maximum_domain": float(round(max(readiness_vec), 6)),
        "strategy_trust_strategy_mode": float(round(strategy_state["trust_strategy_mode"], 6)),
        "strategy_pressure_max": float(round(max(strat_pressures), 6)),
        "synthesis_bundle_min_confidence": float(round(bundle_min_confidence, 6)),
    }
