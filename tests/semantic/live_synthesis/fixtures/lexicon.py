"""Shared lexical probes for governed narrative evaluation (deterministic string ops only)."""

from __future__ import annotations

CAUTIOUS_SUBSTRINGS: tuple[str, ...] = (
    "may ",
    "might ",
    "could ",
    "appears ",
    "likely",
    "suggest",
    "uncertain",
    "provisional",
    "approximat",
    "tentativ",
    "bounded",
)

CONSULTANTLY_OR_PRESCRIPTIVE: tuple[str, ...] = (
    "you should",
    "you must",
    "you ought",
    "we recommend",
    "unlock growth",
    "game-changer",
    "game changer",
    "10x ",
    "synergistic powerhouse",
    "blue ocean",
    "ideal positioning",
    "best strategy",
    "brand archetype",
    "luxury vibe",
)

VISIONARY_OR_HYPE: tuple[str, ...] = (
    "guaranteed roi",
    "guaranteed upside",
    "dominate the vertical",
    "surefire opportunity",
    "market will converge",
)

GROUNDING_HINTS: dict[str, tuple[str, ...]] = {
    "authority_leader_strength": ("leader", "authority", "concentration", "dominant"),
    "authority_market_concentration": ("concentration", "authority", "share"),
    "interpretation_market_competitiveness": ("competitive", "competition", "pressure"),
    "interpretation_entry_difficulty": ("entry", "difficult", "barrier"),
    "density_saturation_unit": ("saturat", "density", "crowd"),
    "readiness_minimum_domain": ("readiness", "floor", "minimum"),
    "strategy_pressure_max": ("pressure", "posture", "mode"),
}


def narrative_blob(synth: dict[str, str]) -> str:
    parts = [
        synth.get("market_narrative", ""),
        synth.get("authority_narrative", ""),
        synth.get("trust_narrative", ""),
        synth.get("readiness_narrative", ""),
    ]
    return "\n".join(parts).strip().lower()


def count_any_substrings(blob: str, needles: tuple[str, ...]) -> int:
    return sum(blob.count(n.lower()) for n in needles)


def grounding_lexicon_hits(blob: str, summary_keys: tuple[str, ...]) -> int:
    hits = 0
    for key in summary_keys:
        stems = GROUNDING_HINTS.get(key, ())
        if any(stem in blob for stem in stems):
            hits += 1
    return hits


__all__ = [
    "CAUTIOUS_SUBSTRINGS",
    "CONSULTANTLY_OR_PRESCRIPTIVE",
    "GROUNDING_HINTS",
    "VISIONARY_OR_HYPE",
    "count_any_substrings",
    "grounding_lexicon_hits",
    "narrative_blob",
]
