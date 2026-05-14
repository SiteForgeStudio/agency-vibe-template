"""Live synthesis fixtures — deterministic bundles feeding governed GPT evaluation."""

from __future__ import annotations

from typing import Any

from intelligence.recon.models import AnalysisPayload, SynthesisContract

from tests.fixtures.markets.dominant_incumbent import DOMINANT_INCUMBENT_MARKET
from tests.fixtures.markets.sparse_weak import SPARSE_WEAK_MARKET
from tests.semantic.support import analyze_scenario


def analysis_sparse_weak() -> AnalysisPayload:
    return analyze_scenario(SPARSE_WEAK_MARKET)


def analysis_dominant_incumbent() -> AnalysisPayload:
    return analyze_scenario(DOMINANT_INCUMBENT_MARKET)


def synthesis_contract_sparse_weak() -> SynthesisContract:
    return analysis_sparse_weak()["synthesis_contract"]


def synthesis_contract_dominant_incumbent() -> SynthesisContract:
    return analysis_dominant_incumbent()["synthesis_contract"]


def summarize_contract(contract: SynthesisContract) -> dict[str, Any]:
    cc = contract["confidence_context"]
    ds = contract["deterministic_summaries"]
    return {
        "synthesis_bundle_min_confidence": cc["synthesis_bundle_min_confidence"],
        "synthesis_bundle_mean_confidence": cc["synthesis_bundle_mean_confidence"],
        "authority_leader_strength": ds["authority_leader_strength"],
        "authority_market_concentration": ds["authority_market_concentration"],
        "interpretation_market_competitiveness": ds["interpretation_market_competitiveness"],
        "interpretation_entry_difficulty": ds["interpretation_entry_difficulty"],
        "density_saturation_unit": ds["density_saturation_unit"],
        "readiness_minimum_domain": ds["readiness_minimum_domain"],
        "strategy_pressure_max": ds["strategy_pressure_max"],
    }


__all__ = [
    "analysis_dominant_incumbent",
    "analysis_sparse_weak",
    "summarize_contract",
    "synthesis_contract_dominant_incumbent",
    "synthesis_contract_sparse_weak",
]
