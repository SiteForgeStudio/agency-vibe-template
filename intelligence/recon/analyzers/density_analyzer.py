"""
Deterministic market-density primitives from Places text-search evidence only.

Numeric outputs; no strategic synthesis or narrative.
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Any

from intelligence.recon.intelligence_math import (
    clamp01,
    confidence_sample_times_completeness,
    normalized_entropy_mass_over_counts,
    normalized_hhi_concentration_counts,
    population_stdev,
    review_distribution_evenness_from_counts,
)
from intelligence.recon.models import PlacesTextSearchEvidence, DensityAnalysis


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


def _has_explicit_review_field(comp: dict[str, Any]) -> bool:
    rc = comp.get("review_count")
    return isinstance(rc, int) and rc >= 0


def _category_consistency_score(comps: list[dict[str, Any]]) -> float:
    labels = [_primary_category_key(c) for c in comps]
    seen = [la for la in labels if la is not None]
    if not seen:
        return 0.0
    top = Counter(seen).most_common(1)[0][1]
    return clamp01(top / len(seen))


def _rating_spread01(ratings: list[float]) -> float:
    if len(ratings) <= 1:
        return 0.0
    return clamp01(population_stdev(ratings) / 2.0)


def analyze_density_signals(*, places: PlacesTextSearchEvidence | None) -> DensityAnalysis:
    zeros: DensityAnalysis = {
        "competitor_count": 0,
        "market_fragmentation_score": 0.0,
        "category_consistency_score": 0.0,
        "review_distribution_score": 0.0,
        "saturation_score": 0.0,
        "confidence": 0.0,
    }

    if places is None:
        return zeros

    fetch_ok = bool(places.get("fetch_ok"))
    comps = [dict(c) for c in (places.get("competitors") or [])]

    if not fetch_ok:
        return zeros

    n = len(comps)
    if n == 0:
        zeros["confidence"] = confidence_sample_times_completeness(
            fetch_ok=True,
            n_listings=0,
            fracs=[0.0, 0.0],
            weights=[0.53, 0.47],
        )
        return zeros

    counts = [_review_count(c) for c in comps]
    ratings = [rv for c in comps if (rv := _rating_value(c)) is not None]

    category_frac = sum(1 for c in comps if _primary_category_key(c) is not None) / n
    explicit_review_frac = sum(1 for c in comps if _has_explicit_review_field(c)) / n

    fragmentation = round(normalized_entropy_mass_over_counts(counts), 6)
    cat_score = round(_category_consistency_score(comps), 6)
    distribution = round(review_distribution_evenness_from_counts(counts), 6)
    concentration = normalized_hhi_concentration_counts(counts)
    total_rev = sum(counts)

    spread_boost = _rating_spread01([float(x) for x in ratings])
    count_pressure = clamp01(n / 16.0)
    volume_curve = clamp01(total_rev / (total_rev + 220.0))
    saturation = round(
        clamp01(
            0.36 * count_pressure
            + 0.30 * concentration
            + 0.24 * volume_curve
            + 0.10 * spread_boost
        ),
        6,
    )

    confidence = confidence_sample_times_completeness(
        fetch_ok=True,
        n_listings=n,
        fracs=[category_frac, explicit_review_frac],
        weights=[0.53, 0.47],
    )

    return {
        "competitor_count": n,
        "market_fragmentation_score": fragmentation,
        "category_consistency_score": cat_score,
        "review_distribution_score": distribution,
        "saturation_score": saturation,
        "confidence": float(confidence),
    }
