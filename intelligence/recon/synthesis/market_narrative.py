"""
Constrained explanatory narratives sourced exclusively from synthesis_contract.

Interpretive-only: does not redefine deterministic semantics; no recommendations.

Requires optional ``openai`` and ``OPENAI_API_KEY``. When unavailable, emits
explicit suppression stubs (still shape-stable for contracts).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Callable, cast

from intelligence.recon.models import (
    DeterministicSummariesFingerprint,
    MarketNarrativeSynthesis,
    NarrativeInterpretiveBanner,
    NarrativeSynthesisGPTMeta,
    SemanticLineageMetadata,
    SynthesisConfidenceContext,
    SynthesisContract,
    SynthesisContractAuthorityMetadata,
)

NARRATIVE_MODULE_ID = "siteforge.recon.synthesis.market_narrative.v1"

_OPENAI_MODEL_ENV = "SITELOGIC_OPENAI_SYNTHESIS_MODEL"
_SUMMARY_KEYS: tuple[str, ...] = (
    "trust_avg_rating",
    "trust_maturity_score",
    "trust_top_three_review_share",
    "trust_website_presence_ratio",
    "density_competitor_count",
    "density_saturation_unit",
    "density_market_fragmentation",
    "authority_leader_strength",
    "authority_market_concentration",
    "authority_competitive_openness",
    "geo_hub_strength",
    "geo_market_centralization",
    "interpretation_market_competitiveness",
    "interpretation_entry_difficulty",
    "readiness_minimum_domain",
    "readiness_maximum_domain",
    "strategy_trust_strategy_mode",
    "strategy_pressure_max",
    "synthesis_bundle_min_confidence",
)

# Canonical fingerprint keys (shared with deterministic governance validators).
DETERMINISTIC_SUMMARY_FINGERPRINT_KEYS: tuple[str, ...] = _SUMMARY_KEYS


def synthesize_market_narratives(
    *,
    synthesis_contract: SynthesisContract,
    model: str | None = None,
    client_factory: Callable[[], Any] | None = None,
) -> MarketNarrativeSynthesis:
    """
    Produce four bounded explanatory strings from deterministic bundle facts only.

    ``client_factory`` is optional injection for testing (must return OpenAI client).
    """

    posture = _confidence_language_posture(synthesis_contract["confidence_context"])
    meta_echo: SynthesisContractAuthorityMetadata = dict(synthesis_contract["authority_metadata"])
    lineage_echo: SemanticLineageMetadata = dict(synthesis_contract["semantic_lineage"])
    banner: NarrativeInterpretiveBanner = {
        "narrative_module_id": NARRATIVE_MODULE_ID,
        "interpretive_authority_level": "non_authoritative_bounded_explanation",
        "consumption_scope": "synthesis_contract_only",
    }

    quartet: tuple[str, str, str, str]
    grounding: list[str]
    gpt_meta: NarrativeSynthesisGPTMeta

    resolved_model = (
        model
        if model is not None
        else (os.getenv(_OPENAI_MODEL_ENV, "").strip() or "gpt-4o-mini")
    )
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()

    utc_stamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    try:
        if not api_key and client_factory is None:
            quartet = _suppressed_narratives(reason="inactive_no_api_key", posture=posture)
            grounding = list(_SUMMARY_KEYS)
            gpt_meta = {"suppression_reason": "missing_OPENAI_API_KEY"}
        else:
            quartet, grounding, call_meta = _openai_narrative_quartet(
                synthesis_contract=synthesis_contract,
                confidence_posture=posture,
                model=resolved_model,
                api_key=api_key if client_factory is None else None,
                client_factory=client_factory,
            )
            gpt_meta = dict(call_meta)
            if "suppression_reason" not in gpt_meta:
                gpt_meta["synthesis_model"] = resolved_model
                gpt_meta["synthesized_at_utc"] = utc_stamp
    except Exception as exc:
        quartet = _suppressed_narratives(
            reason="synthesis_failure",
            posture=posture,
            detail=str(exc)[:280],
        )
        grounding = list(_SUMMARY_KEYS)
        gpt_meta = {"suppression_reason": f"exception:{type(exc).__name__}"}

    market_n, auth_n, trust_n, ready_n = quartet

    return {
        "market_narrative": market_n,
        "authority_narrative": auth_n,
        "trust_narrative": trust_n,
        "readiness_narrative": ready_n,
        "authority_contract_metadata_echo": meta_echo,
        "deterministic_semantic_lineage_echo": lineage_echo,
        "narrative_interpretive_banner": banner,
        "deterministic_grounding_references": grounding,
        "confidence_language_posture": posture,
        "gpt_generation_meta": gpt_meta,
    }


def _confidence_language_posture(cc: SynthesisConfidenceContext) -> str:
    lo = cc["synthesis_bundle_min_confidence"]
    mu = cc["synthesis_bundle_mean_confidence"]
    if lo < 0.05:
        return "bundle_min_below_005:explicit_tentative_wording_required"
    if lo < 0.12:
        return "bundle_min_below_012:heavy_uncertainty_qualifiers_required"
    if mu < 0.15:
        return "bundle_mean_below_015:moderate_uncertainty_qualifiers_required"
    return "standard_qualification:defer_to_summaries_when_uncertain"


def _suppressed_narratives(*, reason: str, posture: str, detail: str = "") -> tuple[str, str, str, str]:
    cave = (
        "Deterministic summaries in synthesis_contract retain operational authority; "
        "this explanatory channel is dormant."
    )
    core = (
        f"Narrative synthesis suppressed ({reason}). Confidence posture `{posture}` applies. {cave}"
    )
    if detail:
        core = core + " Technical note (non-authoritative): " + detail.strip()
    return core, core, core, core


def _openai_narrative_quartet(
    *,
    synthesis_contract: SynthesisContract,
    confidence_posture: str,
    model: str,
    api_key: str | None,
    client_factory: Callable[[], Any] | None,
) -> tuple[tuple[str, str, str, str], list[str], NarrativeSynthesisGPTMeta]:
    try:
        from openai import OpenAI  # noqa: PLC0415
    except ImportError:
        msgs = _suppressed_narratives(reason="missing_openai_package", posture=confidence_posture)
        return msgs, list(_SUMMARY_KEYS), {"suppression_reason": "import_error_openai"}

    client = OpenAI(api_key=api_key) if client_factory is None else client_factory()

    response_format_payload = _openai_json_response_format()

    user_payload = _model_payload_exclusive(synthesis_contract)
    user_message = json.dumps(
        {
            "confidence_language_posture": confidence_posture,
            "deterministic_summaries_bundle": user_payload,
        },
        separators=(",", ":"),
        ensure_ascii=False,
    )

    system_instructions = (
        "You elaborate ONLY on packaged JSON synthesized from deterministic synthesis_contract data.\n"
        "Rules:\n"
        "- Explain, summarize, contextualize deterministic posture numerics.\n"
        "- Never recommend actions/strategy/tactics; omit imperatives advising the reader.\n"
        "- Invent no facts absent from deterministic_summaries, confidence_context, "
        "authority_metadata, or semantic_lineage in the bundle.\n"
        "- Honour the confidence_language_posture string with wording that reflects uncertainty tiers.\n"
        "- Mention no collectors, placeholders, scorer stubs, vibes, archetypes.\n"
        "- Each narrative string <= 520 characters; factual neutral tone.\n"
        "- market_narrative: density/saturation/listing-structure posture using summaries.\n"
        "- authority_narrative: leader strength, concentration, openness slices.\n"
        "- trust_narrative: trust maturity/rating/top-three share/site ratio slices.\n"
        "- readiness_narrative: domain min/max + confidence bundle signals.\n"
        "- deterministic_grounding_references must list VALID keys from enumerated summary fields only.\n"
    )

    completion = cast(
        Any,
        client.chat.completions.create(
            model=model,
            temperature=0.15,
            max_completion_tokens=900,
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_message},
            ],
            response_format=response_format_payload,
        ),
    )
    raw = completion.choices[0].message.content or "{}"
    parsed_any: Any = json.loads(raw)

    quartet = (
        str(parsed_any.get("market_narrative", ""))[:800],
        str(parsed_any.get("authority_narrative", ""))[:800],
        str(parsed_any.get("trust_narrative", ""))[:800],
        str(parsed_any.get("readiness_narrative", ""))[:800],
    )

    refs_raw = parsed_any.get("deterministic_grounding_references")
    cleaned: list[str] = []
    if isinstance(refs_raw, list):
        allowed = set(_SUMMARY_KEYS)
        for ref in refs_raw:
            if isinstance(ref, str) and ref in allowed:
                cleaned.append(ref)
            if len(cleaned) >= 12:
                break
    min_keep = min(3, len(_SUMMARY_KEYS))
    if len(cleaned) < min_keep:
        cleaned = list(_SUMMARY_KEYS[:min_keep])

    if not any(quartet):
        quartet = tuple(
            s or "Unable to synthesize narrative text despite API success."
            for s in quartet
        )

    return quartet, cleaned, {}


def _model_payload_exclusive(contract: SynthesisContract) -> dict[str, Any]:
    """Every field is derived verbatim from synthesis_contract."""

    summaries: DeterministicSummariesFingerprint = dict(contract["deterministic_summaries"])
    return {
        "deterministic_summaries": summaries,
        "confidence_context": dict(contract["confidence_context"]),
        "authority_metadata": dict(contract["authority_metadata"]),
        "semantic_lineage": dict(contract["semantic_lineage"]),
    }


def _openai_json_response_format() -> dict[str, Any]:
    inner_schema = {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "market_narrative",
            "authority_narrative",
            "trust_narrative",
            "readiness_narrative",
            "deterministic_grounding_references",
        ],
        "properties": {
            "market_narrative": {"type": "string", "maxLength": 820},
            "authority_narrative": {"type": "string", "maxLength": 820},
            "trust_narrative": {"type": "string", "maxLength": 820},
            "readiness_narrative": {"type": "string", "maxLength": 820},
            "deterministic_grounding_references": {
                "type": "array",
                "minItems": 3,
                "maxItems": 12,
                "items": {"type": "string", "enum": list(_SUMMARY_KEYS)},
            },
        },
    }
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "constrained_market_narratives",
            "strict": True,
            "schema": inner_schema,
        },
    }


__all__ = [
    "DETERMINISTIC_SUMMARY_FINGERPRINT_KEYS",
    "NARRATIVE_MODULE_ID",
    "synthesize_market_narratives",
]
