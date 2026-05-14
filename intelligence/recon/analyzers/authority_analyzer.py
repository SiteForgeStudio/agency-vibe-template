"""
Deterministic competitive-authority primitives from Places text-search evidence only.

Measures review/rating/category/website-derived market-power structure numerically only.
"""

from __future__ import annotations

import math
from typing import Any

from intelligence.recon.intelligence_math import (
    clamp01,
    confidence_sample_times_completeness,
    dominant_share_threshold_phi,
    normalized_hhi_concentration_counts,
    weighted_mean_rating_by_indices,
)
from intelligence.recon.models import AuthorityAnalysis, PlacesTextSearchEvidence


def _review_count(comp: dict[str, Any]) -> int:
    rc = comp.get("review_count")
    if isinstance(rc, int) and rc >= 0:
        return rc
    return 0


def _rating_value(comp: dict[str, Any]) -> float | None:
    r = comp.get("rating")
    if isinstance(r, float):
        rv = r
    elif isinstance(r, int):
        rv = float(r)
    else:
        return None
    if math.isnan(rv):
        return None
    return max(1.0, min(5.0, rv))


def _primary_category_key(comp: dict[str, Any]) -> str | None:
    c = comp.get("primary_category")
    if isinstance(c, str) and c.strip():
        return c.strip().lower()
    return None


def _has_website(comp: dict[str, Any]) -> bool:
    w = comp.get("website")
    return isinstance(w, str) and bool(w.strip())


def _has_explicit_review_field(comp: dict[str, Any]) -> bool:
    rc = comp.get("review_count")
    return isinstance(rc, int) and rc >= 0


def _sort_indices_deterministic(comps: list[dict[str, Any]], counts: list[int]) -> list[int]:
    n = len(comps)

    def key(i: int) -> tuple[int, float, str]:
        rv = _rating_value(comps[i])
        r_ord = -(rv if rv is not None else -1.0)
        nm = comps[i].get("name")
        nm_s = nm if isinstance(nm, str) else ""
        return (-counts[i], r_ord, nm_s.lower())

    return sorted(range(n), key=key)


def analyze_authority_signals(*, places: PlacesTextSearchEvidence | None) -> AuthorityAnalysis:
    """Derive deterministic authority structure metrics from Places evidence."""

    zeros: AuthorityAnalysis = {
        "market_leader_strength": 0.0,
        "authority_concentration": 0.0,
        "trust_gap_score": 0.0,
        "competitive_openness": 0.0,
        "dominant_player_count": 0,
        "confidence": 0.0,
    }

    if places is None or not places.get("fetch_ok"):
        return zeros

    comps = [dict(c) for c in (places.get("competitors") or [])]
    n = len(comps)
    if n == 0:
        zeros["confidence"] = confidence_sample_times_completeness(
            fetch_ok=True,
            n_listings=0,
            fracs=[0.0, 0.0, 0.0],
            weights=[0.44, 0.38, 0.18],
        )
        return zeros

    counts = [_review_count(c) for c in comps]
    total_rev = sum(counts)
    order = _sort_indices_deterministic(comps, counts)

    concentration = round(normalized_hhi_concentration_counts(counts), 6)

    ratings_weights: list[tuple[float | None, int]] = [
        (_rating_value(comps[i]), counts[i]) for i in range(n)
    ]

    if total_rev > 0:
        shares = [c / total_rev for c in counts]
        phi_share = dominant_share_threshold_phi(n)
        dominant_ct = sum(1 for sh in shares if sh >= phi_share)
    else:
        shares = [0.0] * n
        dominant_ct = 0

    leader_i = order[0]
    leader_share = shares[leader_i] if total_rev > 0 else 0.0

    wm_all = weighted_mean_rating_by_indices(range(n), ratings_weights)

    leader_r = _rating_value(comps[leader_i])
    if leader_r is not None and wm_all is not None:
        rating_edge = clamp01(max(0.0, leader_r - wm_all) / 2.0)
        leader_strength = clamp01(0.54 * leader_share + 0.46 * rating_edge)
    else:
        leader_strength = leader_share if total_rev > 0 else 0.0
    leader_strength = round(leader_strength, 6)

    elite_sz = max(1, math.ceil(n / 3.0))
    elite_ix = order[:elite_sz]
    rest_ix = order[elite_sz:]
    wm_elite = weighted_mean_rating_by_indices(elite_ix, ratings_weights)
    wm_rest = weighted_mean_rating_by_indices(rest_ix, ratings_weights)
    gap = 0.0
    if wm_elite is not None and wm_rest is not None and rest_ix:
        gap = clamp01(max(0.0, wm_elite - wm_rest) / 2.0)

    contenders_open = (
        round((n - dominant_ct + 2) / (n + 2), 6) if n > 0 else 0.0
    )
    openness = round(clamp01((1.0 - concentration) * contenders_open), 6)

    category_frac = sum(1 for c in comps if _primary_category_key(c) is not None) / n
    explicit_frac = sum(1 for c in comps if _has_explicit_review_field(c)) / n
    web_frac = sum(1 for c in comps if _has_website(c)) / n
    conf = confidence_sample_times_completeness(
        fetch_ok=True,
        n_listings=n,
        fracs=[category_frac, explicit_frac, web_frac],
        weights=[0.44, 0.38, 0.18],
    )

    return {
        "market_leader_strength": float(leader_strength),
        "authority_concentration": float(concentration),
        "trust_gap_score": round(gap, 6),
        "competitive_openness": openness,
        "dominant_player_count": dominant_ct,
        "confidence": float(conf),
    }
