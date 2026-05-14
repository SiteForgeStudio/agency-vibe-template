"""
Deterministic operational trust primitives from Places text-search evidence only.

Reads structured collector output; emits numeric facts (no summaries, strategies, vibes).
"""

from __future__ import annotations

import math

from intelligence.recon.intelligence_math import (
    clamp01,
    confidence_sample_times_completeness,
    log1p_ratio_clamped,
    median_int_sorted_copy,
    normalized_hhi_concentration_counts,
    scale_to_percentage100_from_unit_components,
    trust_average_rating,
)
from intelligence.recon.models import PlacesCompetitor, PlacesTextSearchEvidence, TrustAnalysis


def _review_count(comp: PlacesCompetitor | dict[str, object]) -> int:
    rc = comp.get("review_count")
    if isinstance(rc, int) and rc >= 0:
        return rc
    return 0


def _rating_value(comp: PlacesCompetitor | dict[str, object]) -> float | None:
    r = comp.get("rating")
    if isinstance(r, float):
        rv = r
    elif isinstance(r, int):
        rv = float(r)
    else:
        return None
    if math.isnan(rv) or rv < 0.0:
        return None
    return max(1.0, min(5.0, rv))


def _has_website(comp: PlacesCompetitor | dict[str, object]) -> bool:
    w = comp.get("website")
    return isinstance(w, str) and bool(w.strip())


def _has_explicit_review_field(comp: PlacesCompetitor | dict[str, object]) -> bool:
    """True when Places reported a numeric review_count field."""

    rc = comp.get("review_count")
    return isinstance(rc, int) and rc >= 0


def analyze_trust_signals(*, places: PlacesTextSearchEvidence | None) -> TrustAnalysis:
    """Derive deterministic trust metrics strictly from Places evidence."""

    zeros: TrustAnalysis = {
        "market_review_count_avg": 0.0,
        "market_review_count_median": 0.0,
        "top_3_review_share": 0.0,
        "website_presence_ratio": 0.0,
        "average_rating": 0.0,
        "authority_concentration_score": 0.0,
        "trust_maturity_score": 0.0,
        "confidence": 0.0,
    }

    if places is None:
        return zeros

    fetch_ok = bool(places.get("fetch_ok"))
    comps_raw = places.get("competitors") or []
    comps: list[dict[str, object]] = [dict(c) for c in comps_raw]

    if not fetch_ok:
        return zeros

    n = len(comps)
    if n == 0:
        zeros["confidence"] = float(
            confidence_sample_times_completeness(
                fetch_ok=True,
                n_listings=0,
                fracs=[0.0, 0.0],
                weights=[0.52, 0.48],
            )
        )
        return zeros

    counts = [_review_count(c) for c in comps]
    ratings_present = [_rating_value(c) for c in comps]
    rating_frac = sum(1 for rv in ratings_present if rv is not None) / n
    explicit_count_frac = sum(1 for c in comps if _has_explicit_review_field(c)) / n

    total_reviews = sum(counts)
    market_review_count_avg = round(sum(counts) / n, 6) if n else 0.0
    market_review_count_median = round(median_int_sorted_copy(counts), 6)

    average_rating = round(
        trust_average_rating(
            counts=counts,
            ratings_present=ratings_present,
            total_reviews=total_reviews,
        ),
        6,
    )

    if total_reviews > 0:
        top3_sum = sum(sorted(counts, reverse=True)[:3])
        top_3_review_share = round(clamp01(top3_sum / total_reviews), 6)
    else:
        top_3_review_share = 0.0

    websites = sum(1 for c in comps if _has_website(c))
    website_presence_ratio = round(clamp01(websites / n), 6)
    authority = round(normalized_hhi_concentration_counts(counts), 6)

    norm_rating01 = clamp01((average_rating - 1.0) / 4.0) if average_rating > 0.0 else 0.0
    confidence = confidence_sample_times_completeness(
        fetch_ok=True,
        n_listings=n,
        fracs=[rating_frac, explicit_count_frac],
        weights=[0.52, 0.48],
    )
    maturity = scale_to_percentage100_from_unit_components(
        norm_rating_unit=norm_rating01,
        volume_signal01=log1p_ratio_clamped(market_review_count_avg, 180.0),
        website_ratio01=website_presence_ratio,
        evenness_minus_concentration=clamp01(1.0 - authority),
    )

    return {
        "market_review_count_avg": float(market_review_count_avg),
        "market_review_count_median": float(market_review_count_median),
        "top_3_review_share": float(top_3_review_share),
        "website_presence_ratio": float(website_presence_ratio),
        "average_rating": float(average_rating),
        "authority_concentration_score": float(authority),
        "trust_maturity_score": float(maturity),
        "confidence": float(confidence),
    }
