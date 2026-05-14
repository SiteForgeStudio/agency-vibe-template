"""Deterministic synthesis_contract ordering checks (no GPT)."""

from __future__ import annotations

from tests.semantic.live_synthesis.fixtures.context import (
    summarize_contract,
    synthesis_contract_dominant_incumbent,
    synthesis_contract_sparse_weak,
)


def test_synthesis_summaries_echo_contract_semantics_ordering() -> None:
    sparse_c = synthesis_contract_sparse_weak()
    dom_c = synthesis_contract_dominant_incumbent()
    sparse_sum = summarize_contract(sparse_c)
    dom_sum = summarize_contract(dom_c)
    assert sparse_sum["authority_market_concentration"] <= dom_sum["authority_market_concentration"] + 0.08
    assert sparse_sum["synthesis_bundle_min_confidence"] <= dom_sum["synthesis_bundle_min_confidence"] + 0.05
