"""Governance gates on live narratives — intentional poisoning proves enforcement."""

from __future__ import annotations

from intelligence.recon.models import MarketNarrativeSynthesis
from intelligence.recon.synthesis.market_narrative import synthesize_market_narratives
from intelligence.recon.synthesis.validation import validate_market_narrative_governance

from tests.semantic.live_synthesis.fixtures.context import synthesis_contract_dominant_incumbent


def _clone_synth(base: MarketNarrativeSynthesis) -> MarketNarrativeSynthesis:
    return dict(base)  # type: ignore[return-value]


def test_live_baseline_then_prescriptive_poison_suppresses_authority() -> None:
    contract = synthesis_contract_dominant_incumbent()
    clean = synthesize_market_narratives(synthesis_contract=contract)
    assert "suppression_reason" not in clean["gpt_generation_meta"]

    gov_clean = validate_market_narrative_governance(
        synthesis_contract=contract,
        market_narrative_synthesis=clean,
    )
    assert gov_clean["validation_status"] in {"accepted", "warning"}

    poisoned = _clone_synth(clean)
    poisoned["market_narrative"] = (
        poisoned["market_narrative"]
        + " You should immediately execute an aggressive acquisition strategy and dominate competitors."
    )

    gov_poison = validate_market_narrative_governance(
        synthesis_contract=contract,
        market_narrative_synthesis=poisoned,
    )
    assert gov_poison["prescriptive_drift_detected"] is True
    assert gov_poison["validation_status"] in {"warning", "suppressed_authority"}


def test_unsupported_certainty_poison_escalates_governance() -> None:
    contract = synthesis_contract_dominant_incumbent()
    clean = synthesize_market_narratives(synthesis_contract=contract)

    poisoned = _clone_synth(clean)
    poisoned["trust_narrative"] = (
        poisoned["trust_narrative"]
        + " Customers always convert overnight — guaranteed ROI without question."
    )

    gov_poison = validate_market_narrative_governance(
        synthesis_contract=contract,
        market_narrative_synthesis=poisoned,
    )
    assert gov_poison["unsupported_claims_detected"] is True
    assert gov_poison["severity"] in {"medium", "high"}
    assert gov_poison["validation_status"] in {"warning", "suppressed_authority"}


def test_posture_echo_poison_triggers_integrity_suppression() -> None:
    contract = synthesis_contract_dominant_incumbent()
    clean = synthesize_market_narratives(synthesis_contract=contract)
    corrupted = _clone_synth(clean)
    corrupted["confidence_language_posture"] = (
        "standard_qualification:defer_to_summaries_when_uncertain"
    )

    gov = validate_market_narrative_governance(
        synthesis_contract=contract,
        market_narrative_synthesis=corrupted,
    )
    assert gov["confidence_alignment"] == "misaligned"
    assert gov["validation_status"] == "suppressed_authority"
    assert gov.get("suppression_reason")
