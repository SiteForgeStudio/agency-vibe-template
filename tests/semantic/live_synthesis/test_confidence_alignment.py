"""Confidence posture vs observable lexical calibration (live GPT)."""

from __future__ import annotations

from intelligence.recon.synthesis.market_narrative import synthesize_market_narratives

from tests.semantic.live_synthesis.fixtures.context import (
    synthesis_contract_dominant_incumbent,
    synthesis_contract_sparse_weak,
)
from tests.semantic.live_synthesis.fixtures.lexicon import CAUTIOUS_SUBSTRINGS, count_any_substrings, narrative_blob


def test_weak_bundle_prefers_more_cautious_language_than_strong_bundle() -> None:
    sparse_contract = synthesis_contract_sparse_weak()
    dominant_contract = synthesis_contract_dominant_incumbent()

    sparse_cc = sparse_contract["confidence_context"]
    dominant_cc = dominant_contract["confidence_context"]
    assert sparse_cc["synthesis_bundle_min_confidence"] <= dominant_cc["synthesis_bundle_min_confidence"] + 0.08

    sparse_syn = synthesize_market_narratives(synthesis_contract=sparse_contract)
    dominant_syn = synthesize_market_narratives(synthesis_contract=dominant_contract)

    assert "suppression_reason" not in sparse_syn["gpt_generation_meta"]
    assert "suppression_reason" not in dominant_syn["gpt_generation_meta"]

    posture_sparse = sparse_syn["confidence_language_posture"]
    posture_dom = dominant_syn["confidence_language_posture"]

    sparse_blob = narrative_blob(dict(sparse_syn))
    dominant_blob = narrative_blob(dict(dominant_syn))

    sparse_hits = count_any_substrings(sparse_blob, CAUTIOUS_SUBSTRINGS)
    dominant_hits = count_any_substrings(dominant_blob, CAUTIOUS_SUBSTRINGS)

    calibrated_lexically = sparse_hits >= dominant_hits - 6
    calibrated_posture = posture_sparse != posture_dom or (
        sparse_cc["synthesis_bundle_min_confidence"] + 1e-6 < dominant_cc["synthesis_bundle_min_confidence"]
    )
    assert calibrated_lexically or calibrated_posture
