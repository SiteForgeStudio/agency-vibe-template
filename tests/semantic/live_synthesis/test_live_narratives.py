"""Live bounded narrative synthesis — semantic trustworthiness, not persuasion QA."""

from __future__ import annotations

from intelligence.recon.models import MarketNarrativeSynthesis, SynthesisContract
from intelligence.recon.synthesis.market_narrative import synthesize_market_narratives
from intelligence.recon.synthesis.validation import validate_market_narrative_governance

from tests.semantic.live_synthesis.fixtures.context import (
    synthesis_contract_dominant_incumbent,
    synthesis_contract_sparse_weak,
)
from tests.semantic.live_synthesis.fixtures.lexicon import (
    CONSULTANTLY_OR_PRESCRIPTIVE,
    VISIONARY_OR_HYPE,
    count_any_substrings,
    grounding_lexicon_hits,
    narrative_blob,
)


def _live_synthesize(contract: SynthesisContract) -> MarketNarrativeSynthesis:
    return synthesize_market_narratives(synthesis_contract=contract)


def _assert_live_completion(meta: dict[str, object]) -> None:
    assert "suppression_reason" not in meta, (
        "live synthesis unexpectedly suppressed — check API key, quota, or network; "
        f"meta={meta!r}"
    )


def test_live_sparse_weak_market_bounded_and_governed() -> None:
    contract = synthesis_contract_sparse_weak()
    synth = _live_synthesize(contract)
    meta = dict(synth["gpt_generation_meta"])
    _assert_live_completion(meta)

    gov = validate_market_narrative_governance(
        synthesis_contract=contract,
        market_narrative_synthesis=synth,
    )
    assert gov["validation_status"] in {"accepted", "warning"}

    blob = narrative_blob(dict(synth))
    assert len(blob) >= 280
    assert count_any_substrings(blob, CONSULTANTLY_OR_PRESCRIPTIVE) <= 1
    assert count_any_substrings(blob, VISIONARY_OR_HYPE) == 0

    refs = synth["deterministic_grounding_references"]
    assert len(refs) >= 3


def test_live_dominant_incumbent_grounded_language_not_generic_fluff() -> None:
    contract = synthesis_contract_dominant_incumbent()
    synth = _live_synthesize(contract)
    meta = dict(synth["gpt_generation_meta"])
    _assert_live_completion(meta)

    gov = validate_market_narrative_governance(
        synthesis_contract=contract,
        market_narrative_synthesis=synth,
    )
    assert gov["validation_status"] in {"accepted", "warning"}

    blob = narrative_blob(dict(synth))
    assert count_any_substrings(blob, CONSULTANTLY_OR_PRESCRIPTIVE) <= 1
    assert count_any_substrings(blob, VISIONARY_OR_HYPE) == 0

    lex_keys = (
        "authority_leader_strength",
        "authority_market_concentration",
        "interpretation_market_competitiveness",
        "interpretation_entry_difficulty",
        "density_saturation_unit",
        "readiness_minimum_domain",
        "strategy_pressure_max",
    )
    assert grounding_lexicon_hits(blob, lex_keys) >= 4
