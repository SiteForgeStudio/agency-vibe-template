"""Semantic posture regressions — invariant-focused behavioral suite."""

from __future__ import annotations

from intelligence.recon.models import AnalysisPayload

from tests.fixtures.markets import SEMANTIC_MARKET_SCENARIOS
from tests.fixtures.markets.contradictory_trust import CONTRADICTORY_TRUST_MARKET
from tests.fixtures.markets.dominant_incumbent import DOMINANT_INCUMBENT_MARKET
from tests.fixtures.markets.false_fragmentation import FALSE_FRAGMENTATION_MARKET
from tests.fixtures.markets.geo_weakness import GEO_WEAKNESS_MARKET
from tests.fixtures.markets.probe_contamination import PROBE_CONTAMINATION_MARKET
from tests.fixtures.markets.sparse_weak import SPARSE_WEAK_MARKET
from tests.semantic.support import (
    analyze_scenario,
    assemble_scenario_contract,
    synthesis_confidence_snapshot,
    total_explicit_reviews,
)


def _interp(analysis: AnalysisPayload) -> dict:
    return dict(analysis["market_state_interpretation"])


def _dens(analysis: AnalysisPayload) -> dict:
    return dict(analysis["density_analysis"])


def _trust(analysis: AnalysisPayload) -> dict:
    return dict(analysis["trust_analysis"])


def _geo(analysis: AnalysisPayload) -> dict:
    return dict(analysis["geo_analysis"])


def test_catalog_contains_all_documented_semantic_categories() -> None:
    ids = {s.scenario_id for s in SEMANTIC_MARKET_SCENARIOS}
    required = {
        SPARSE_WEAK_MARKET.scenario_id,
        DOMINANT_INCUMBENT_MARKET.scenario_id,
        FALSE_FRAGMENTATION_MARKET.scenario_id,
        CONTRADICTORY_TRUST_MARKET.scenario_id,
        PROBE_CONTAMINATION_MARKET.scenario_id,
        GEO_WEAKNESS_MARKET.scenario_id,
    }
    assert required <= ids


def test_sparse_weak_market_soft_low_energy_bundle() -> None:
    spec = SPARSE_WEAK_MARKET
    a = analyze_scenario(spec)
    cc = a["synthesis_contract"]["confidence_context"]
    exp = spec.expectations
    assert cc["synthesis_bundle_min_confidence"] <= exp["synthesis_bundle_min_confidence_max"]
    assert cc["interpretation_confidence"] <= exp["interpretation_confidence_max"]
    posture = a["market_narrative_synthesis"]["confidence_language_posture"]
    assert any(tok in posture for tok in exp["assert_softened_posture_substrings"])
    gov = a["narrative_synthesis_governance"]["validation_status"]
    assert gov in {"accepted", "warning", "suppressed_authority"}
    snap = synthesis_confidence_snapshot(a)
    assert snap["synthesis_bundle_min_confidence"] <= snap["synthesis_bundle_mean_confidence"] + 1e-6


def test_dominant_incumbent_raises_pressure_rails() -> None:
    spec = DOMINANT_INCUMBENT_MARKET
    a = analyze_scenario(spec)
    mi = _interp(a)
    au = a["authority_analysis"]
    exp = spec.expectations
    assert au["authority_concentration"] >= exp["authority_concentration_min"]
    assert au["market_leader_strength"] >= exp["leader_strength_min"]
    assert mi["authority_pressure"] >= exp["authority_pressure_min"]
    assert mi["entry_difficulty"] >= exp["entry_difficulty_min"]
    assert a["strategy_state"]["differentiation_pressure"] >= exp["differentiation_pressure_min"]
    assert mi["market_openness"] <= exp["market_openness_max"]


def test_false_fragmentation_trap_compresses_openness_despite_entropy() -> None:
    spec = FALSE_FRAGMENTATION_MARKET
    a = analyze_scenario(spec)
    dd = _dens(a)
    tt = _trust(a)
    mi = _interp(a)
    exp = spec.expectations
    assert dd["competitor_count"] >= exp["competitor_count_min"]
    assert tt["top_3_review_share"] >= exp["top_3_review_share_min"]
    assert dd["market_fragmentation_score"] >= exp["fragmentation_entropy_min"]
    assert mi["authority_pressure"] >= exp["authority_pressure_min"]
    assert mi["market_openness"] <= exp["market_openness_max"]


def test_contradictory_trust_caps_confidence_despite_ratings() -> None:
    spec = CONTRADICTORY_TRUST_MARKET
    a = analyze_scenario(spec)
    tt = _trust(a)
    cc = a["synthesis_contract"]["confidence_context"]
    exp = spec.expectations
    assert tt["average_rating"] >= exp["average_rating_min"]
    assert total_explicit_reviews(a) <= exp["total_reviews_max"]
    assert tt["confidence"] <= exp["trust_confidence_max"]
    assert cc["synthesis_bundle_mean_confidence"] <= exp["synthesis_bundle_mean_confidence_max"]


def test_probe_contamination_suppresses_placeholder_semantics_and_preserves_contract() -> None:
    spec = PROBE_CONTAMINATION_MARKET
    contract = assemble_scenario_contract(spec)
    wi = dict(contract["website_intelligence"])
    posture = wi["probe_relevance_posture"]
    assert posture["authority_action"] == spec.expectations["probe_authority_action"]
    blob = wi["positioning_strength"].lower()
    for needle in spec.expectations["positioning_must_not_contain"]:
        assert needle.lower() not in blob
    narratives = "".join(
        [
            contract["market_intelligence"]["market_narrative_synthesis"]["market_narrative"],
            contract["market_intelligence"]["market_narrative_synthesis"]["authority_narrative"],
        ]
    ).lower()
    for needle in spec.expectations["market_narrative_must_not_contain"]:
        assert needle.lower() not in narratives


def test_geo_weakness_trust_geo_gap_and_downstream_readiness_coupling() -> None:
    spec = GEO_WEAKNESS_MARKET
    a = analyze_scenario(spec)
    tt = _trust(a)
    gg = _geo(a)
    cc = a["synthesis_contract"]["confidence_context"]
    exp = spec.expectations
    assert gg["hub_strength"] <= exp["geo_hub_strength_max"]
    assert tt["confidence"] - gg["confidence"] >= exp["trust_confidence_over_geo_confidence_min_delta"]
    assert cc["readiness_confidence"] <= cc["interpretation_confidence"] + exp[
        "readiness_confidence_le_interpretation_margin"
    ]


def test_weak_bundle_min_blocks_authoritative_governance_lane_when_coerced_high_tone() -> None:
    """Structural invariant: posture echo mismatch triggers governance suppression."""

    spec = SPARSE_WEAK_MARKET
    a = analyze_scenario(spec)
    synth = dict(a["market_narrative_synthesis"])
    synth["confidence_language_posture"] = "standard_qualification:defer_to_summaries_when_uncertain"
    from intelligence.recon.synthesis.validation import validate_market_narrative_governance

    gov = validate_market_narrative_governance(
        synthesis_contract=a["synthesis_contract"],
        market_narrative_synthesis=synth,
    )
    assert gov["validation_status"] == "suppressed_authority"
    assert gov["confidence_alignment"] == "misaligned"


def test_openness_cross_pressure_consistency_stub() -> None:
    """Openness composites stay tethered versus simultaneous authority posture."""

    spec = DOMINANT_INCUMBENT_MARKET
    a = analyze_scenario(spec)
    mi = _interp(a)
    au = a["authority_analysis"]
    bundle_min = a["synthesis_contract"]["confidence_context"]["synthesis_bundle_min_confidence"]
    assert mi["market_openness"] <= mi["authority_pressure"] + au["competitive_openness"] + 0.55
    assert mi["authority_pressure"] >= au["authority_concentration"] * 0.55
    assert bundle_min <= mi["confidence"] + 1e-6


def test_readiness_domains_respect_strategy_floor_stub() -> None:
    """Readiness averages stay bounded versus structural synthesis minimum."""

    spec = GEO_WEAKNESS_MARKET
    a = analyze_scenario(spec)
    mr = a["market_readiness"]
    bundle_min = a["synthesis_contract"]["confidence_context"]["synthesis_bundle_min_confidence"]
    readiness_avg = (
        mr["trust_readiness"]
        + mr["positioning_readiness"]
        + mr["authority_readiness"]
        + mr["geo_readiness"]
        + mr["differentiation_readiness"]
    ) / 5.0
    assert readiness_avg <= 0.92
    assert mr["confidence"] >= bundle_min - 0.25
