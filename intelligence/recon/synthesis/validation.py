"""
Deterministic semantic governance over bounded GPT market narratives.

Inputs are strictly ``synthesis_contract`` + ``market_narrative_synthesis`` —
no collectors, placeholders, or raw evidence envelopes.

Does not mutate or rewrite synthesized prose; returns governance metadata only.
"""

from __future__ import annotations

from typing import Final

from intelligence.recon.models import (
    MarketNarrativeSynthesis,
    NarrativeSynthesisGovernance,
    SynthesisContract,
)
from intelligence.recon.synthesis.market_narrative import (
    DETERMINISTIC_SUMMARY_FINGERPRINT_KEYS,
    _confidence_language_posture,
)

_GOVERNANCE_MODULE_ID: Final = "siteforge.recon.synthesis.validation.v1"
_ALLOWED_KEYS: Final[frozenset[str]] = frozenset(DETERMINISTIC_SUMMARY_FINGERPRINT_KEYS)

_PRESCRIPTIVE_PHRASES: Final[tuple[str, ...]] = (
    "you should",
    "you ought",
    "you must ",
    "we recommend",
    "we urge",
    "it is advisable",
    "ideal positioning",
    "best strategy",
    "go-to-market recommendation",
    "action plan",
    "action item",
    "next steps:",
    "tactical playbook",
    "winning playbook",
    "double down on",
    "invest aggressively",
)

_DECISION_DIRECTIVES: Final[tuple[str, ...]] = (
    "implement this",
    "execute this strategy",
    "prioritize acquiring",
    "hire for",
    "raise prices",
    "lower prices immediately",
)

_CERTAINTY_PHRASES: Final[tuple[str, ...]] = (
    "definitely ",
    "undoubtedly ",
    "guaranteed ",
    "without question ",
    "proven certainty",
    "beyond doubt ",
    "the market always ",
    "customers always ",
    "every competitor will ",
    "guaranteed roi",
)

_OPPORTUNITY_SPECULATION: Final[tuple[str, ...]] = (
    "surefire opportunity",
    "guaranteed upside",
    "market will converge on",
    "dominate the vertical",
)

_SCOPE_AUTHORITY: Final[tuple[str, ...]] = (
    "operational verdict",
    "authoritative stance",
    "deterministic mandate",
    "deterministic decree",
)

_HEDGE_TERMS: Final[frozenset[str]] = frozenset(
    [
        "likely",
        "may",
        "might",
        "could",
        "appears",
        "suggests",
        "approximately",
        "roughly",
        "tentative",
        "provisional",
        "indicator",
        "indicative",
        "possibly",
        "uncertain",
    ]
)


def validate_market_narrative_governance(
    *,
    synthesis_contract: SynthesisContract,
    market_narrative_synthesis: MarketNarrativeSynthesis,
) -> NarrativeSynthesisGovernance:
    """
    Inspect narratives + deterministic contract bundle for governance violations.

    Do not rewrite narrative strings — consumers treat ``validation_status`` and
    ``suppression_reason`` as authority gates downstream.
    """

    synth = market_narrative_synthesis

    gov_codes: list[str] = []

    cc = synthesis_contract["confidence_context"]
    posture_expected = _confidence_language_posture(cc)
    synth_min_conf = float(cc["synthesis_bundle_min_confidence"])
    synth_mean_conf = float(cc["synthesis_bundle_mean_confidence"])

    posture_observed = synth.get("confidence_language_posture", "")
    if posture_expected and posture_observed != posture_expected:
        gov_codes.append("signal:confidence_posture_echo_mismatch_contract_authoritative")

    meta_gpt = synth.get("gpt_generation_meta") or {}
    stub_mode = bool(meta_gpt.get("suppression_reason"))

    corpus = (
        synth.get("market_narrative", "")
        + " "
        + synth.get("authority_narrative", "")
        + " "
        + synth.get("trust_narrative", "")
        + " "
        + synth.get("readiness_narrative", "")
    )
    corpus_l = corpus.lower()

    drift = False
    for needle in _PRESCRIPTIVE_PHRASES:
        if needle in corpus_l:
            drift = True
            gov_codes.append(f"detect:prescriptive_phrase:{needle.replace(' ', '_')}")

    if not stub_mode:
        for needle in _DECISION_DIRECTIVES:
            if needle in corpus_l:
                drift = True
                gov_codes.append(f"detect:directive_phrase:{needle.replace(' ', '_')}")

    unsupported = False
    for needle in _CERTAINTY_PHRASES + _OPPORTUNITY_SPECULATION:
        if needle in corpus_l:
            unsupported = True
            gov_codes.append(f"detect:unsupported_certainty:{needle.replace(' ', '_')}")

    scope_authority_voice = False
    for needle in _SCOPE_AUTHORITY:
        if needle in corpus_l:
            scope_authority_voice = True
            gov_codes.append(f"detect:narrative_scope_authority_lexicon:{needle.replace(' ', '_')}")

    invalid_refs = [
        r for r in synth.get("deterministic_grounding_references", ()) if str(r) not in _ALLOWED_KEYS
    ]
    has_ground_refs = len(synth.get("deterministic_grounding_references", ())) > 0
    grounding_ok = not invalid_refs and (stub_mode or has_ground_refs)
    if invalid_refs:
        gov_codes.append("detect:grounding_reference_invalid_vs_fingerprint_bundle")
    if not stub_mode and not has_ground_refs:
        grounding_ok = False
        gov_codes.append("detect:grounding_references_missing_non_stub")

    contract_meta_mismatch = False
    echoed_meta = synth.get("authority_contract_metadata_echo")
    if dict(echoed_meta) != dict(synthesis_contract["authority_metadata"]):  # type: ignore[arg-type]
        contract_meta_mismatch = True
        gov_codes.append("detect:authority_metadata_echo_contract_mismatch")

    certainty_hits = _count_lexical_hits(corpus_l, _CERTAINTY_PHRASES + _OPPORTUNITY_SPECULATION)
    certainty_hits += sum(1 for w in (" definitely", " unquestionably ", " undeniable ") if w in corpus_l)
    hedge_hits = _hedge_occurrences(corpus_l)

    confidence_alignment = _confidence_alignment_tone(
        posture_expected,
        stub_mode=stub_mode,
        corpus_len=len(corpus_l.strip()),
        certainty_hits=certainty_hits,
        hedge_hits=hedge_hits,
        synth_min_conf=synth_min_conf,
        synth_mean_conf=synth_mean_conf,
        gov_codes=gov_codes,
    )

    score = _severity_numeric(
        stub_mode=stub_mode,
        prescriptive_drift=drift,
        unsupported_claims=unsupported,
        scope_authority=scope_authority_voice,
        grounding_ok=grounding_ok,
        contract_meta_mismatch=contract_meta_mismatch,
        confidence_alignment=confidence_alignment,
        posture_mismatch=_posture_echo_mismatch(gov_codes),
    )

    severity = _severity_label(score)

    narrative_scope_status = _narrative_scope_status(
        prescriptive_drifts=drift,
        unsupported_claims=unsupported,
        scope_authority_voice=scope_authority_voice,
        grounding_ok=grounding_ok,
        stub_mode=stub_mode,
    )

    validation_status = _validation_status(score, confidence_alignment)

    if validation_status == "suppressed_authority":
        narrative_scope_status = "authority_suppressed"

    suppression_reason = None
    if validation_status == "suppressed_authority":
        suppression_reason = _suppression_clause(gov_codes, severity)

    gov_codes_sorted = sorted(set(gov_codes))

    out: NarrativeSynthesisGovernance = {
        "validation_module_id": _GOVERNANCE_MODULE_ID,
        "validation_status": validation_status,
        "confidence_alignment": confidence_alignment,
        "prescriptive_drift_detected": drift,
        "unsupported_claims_detected": unsupported,
        "narrative_scope_status": narrative_scope_status,
        "severity": severity,
        "governance_codes": gov_codes_sorted,
    }
    if suppression_reason is not None:
        out["suppression_reason"] = suppression_reason
    return out


def _posture_echo_mismatch(codes: list[str]) -> bool:
    return any(c == "signal:confidence_posture_echo_mismatch_contract_authoritative" for c in codes)


def _count_lexical_hits(corpus_l: str, needles: tuple[str, ...]) -> int:
    return sum(corpus_l.count(n) for n in needles)


def _hedge_occurrences(corpus_l: str) -> int:
    padded = f" {corpus_l.strip()} "
    return sum(padded.count(f" {h} ") for h in _HEDGE_TERMS)


def _confidence_alignment_tone(
    posture: str,
    *,
    stub_mode: bool,
    corpus_len: int,
    certainty_hits: int,
    hedge_hits: int,
    synth_min_conf: float,
    synth_mean_conf: float,
    gov_codes: list[str],
) -> str:
    if _posture_echo_mismatch(gov_codes):
        return "misaligned"

    if stub_mode:
        return "stub_lane_tone_not_audited"

    tier = _posture_tier(posture)

    if tier >= 3 and corpus_len >= 96 and certainty_hits >= 1 and hedge_hits == 0:
        gov_codes.append("detect:confidence_word_soft_missing_vs_strict_bundle")
        return "misaligned"
    if tier >= 2 and certainty_hits >= 2 and hedge_hits < certainty_hits:
        gov_codes.append("detect:confidence_tone_high_vs_uncertain_bundle_min")
        return "misaligned"
    if synth_min_conf < 0.08 and corpus_len >= 140 and certainty_hits >= hedge_hits + 3:
        return "misaligned"
    if synth_mean_conf < 0.12 and corpus_len >= 120 and certainty_hits >= 2 and hedge_hits < 2:
        gov_codes.append("detect:confidence_tone_vs_low_bundle_mean")
        return "misaligned"
    if tier >= 3 and corpus_len >= 120 and certainty_hits == 0:
        gov_codes.append("detect:confidence_language_neutral_but_bundle_strict_optional")
        return "partial_alignment"
    if certainty_hits and hedge_hits >= certainty_hits:
        return "aligned"
    if certainty_hits == 0:
        return "aligned"
    return "partial_alignment"


def _posture_tier(posture: str) -> int:
    if "bundle_min_below_005" in posture:
        return 4
    if "bundle_min_below_012" in posture:
        return 3
    if "bundle_mean_below_015" in posture:
        return 2
    return 1


def _severity_numeric(
    *,
    stub_mode: bool,
    prescriptive_drift: bool,
    unsupported_claims: bool,
    scope_authority: bool,
    grounding_ok: bool,
    contract_meta_mismatch: bool,
    confidence_alignment: str,
    posture_mismatch: bool,
) -> int:
    s = 0
    if prescriptive_drift:
        s += 5
    if unsupported_claims:
        s += 4
    if scope_authority:
        s += 4
    if not grounding_ok:
        s += 4
    if contract_meta_mismatch:
        s += 5
    if posture_mismatch:
        s += 5
    if confidence_alignment == "misaligned":
        s += 4
    elif confidence_alignment == "partial_alignment" and not stub_mode:
        s += 2
    return s


def _severity_label(score: int) -> str:
    if score <= 0:
        return "none"
    if score <= 3:
        return "low"
    if score <= 7:
        return "medium"
    return "high"


def _narrative_scope_status(
    *,
    prescriptive_drifts: bool,
    unsupported_claims: bool,
    scope_authority_voice: bool,
    grounding_ok: bool,
    stub_mode: bool,
) -> str:
    if not grounding_ok and not stub_mode:
        return "authority_suppressed"
    if prescriptive_drifts or unsupported_claims or scope_authority_voice:
        return "degraded_scope"
    return "in_bounds"


def _validation_status(score: int, confidence_alignment: str) -> str:
    if confidence_alignment == "misaligned" or score >= 10:
        return "suppressed_authority"
    if score >= 4 or confidence_alignment == "partial_alignment":
        return "warning"
    return "accepted"


def _suppression_clause(codes: list[str], severity: str) -> str:
    head = f"semantic_governance_{severity}"
    tail = ";".join(codes[:12])
    return f"{head}|{tail}"[:480]


__all__ = ["validate_market_narrative_governance", "_GOVERNANCE_MODULE_ID"]
