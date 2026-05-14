"""
Shared deterministic math for recon operational intelligence.

Pure numeric helpers only: bounded scaling, concentration, entropy, moments, weights.
No evidence interpretation, analyzer wiring, narrative, strategy, or I/O.
"""

from __future__ import annotations

import math
from collections.abc import Sequence


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def median_int_sorted_copy(values: list[int]) -> float:
    """Population median over non-empty ints; deterministic mid-average for even length."""

    if not values:
        return 0.0
    s = sorted(values)
    mid = len(s) // 2
    if len(s) % 2:
        return float(s[mid])
    return float(s[mid - 1] + s[mid]) / 2.0


def normalized_hhi_concentration_counts(counts: Sequence[int]) -> float:
    """
    Normalize HHI of review-share distribution vs equal split.

    Returns ~0 diffuse, ~1 concentrated; 0 when n<=1 or zero total mass.
    """

    counts_l = list(counts)
    n = len(counts_l)
    total = sum(counts_l)
    if n <= 1 or total <= 0:
        return 0.0
    shares = [c / total for c in counts_l]
    hhi = sum(s * s for s in shares)
    hhi_min = 1.0 / n
    if hhi_min >= 1.0:
        return 1.0
    return clamp01((hhi - hhi_min) / (1.0 - hhi_min))


def normalized_entropy_mass_over_counts(
    counts: Sequence[int],
    *,
    eps: float = 1e-15,
) -> float:
    """
    Shannon entropy of nonnegative mass vector over listings, normalized by max log(n).

    When total mass is zero, uses uniform hypothetical shares across n bins.
    """

    counts_l = list(counts)
    n = len(counts_l)
    if n <= 1:
        return 0.0
    total = sum(counts_l)
    if total <= 0:
        p = 1.0 / n
        h = -n * p * math.log(p + eps)
    else:
        h = 0.0
        for c in counts_l:
            p = max(0.0, c / total)
            if p > 0:
                h -= p * math.log(p + eps)
    h_max = math.log(n)
    return clamp01(h / h_max)


def population_stdev(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    xs = list(values)
    mean = sum(xs) / len(xs)
    var = sum((x - mean) ** 2 for x in xs) / len(xs)
    return math.sqrt(max(0.0, var))


def coefficient_of_variation(values: Sequence[float]) -> float | None:
    """sigma/mu for nonempty vector; None when mu <= 0."""

    xs = list(values)
    if not xs:
        return None
    mean = sum(xs) / len(xs)
    if mean <= 0:
        return None
    sd = population_stdev(xs)
    return sd / mean


def score_inverse_cv(cv: float) -> float:
    """Maps CV>=0 to [0,1] via 1/(1+cv); stable for deterministic distribution scores."""

    return clamp01(1.0 / (1.0 + cv))


def review_distribution_evenness_from_counts(counts: Sequence[int]) -> float:
    """Higher when per-listing nonnegative counts have low coefficient of variation."""

    counts_l = list(counts)
    if not counts_l:
        return 0.0
    xs = [float(x) for x in counts_l]
    mean = sum(xs) / len(xs)
    if mean <= 0:
        nonzero = sum(1 for x in xs if x > 0)
        return clamp01(nonzero / len(xs))
    cv = population_stdev(xs) / mean
    return score_inverse_cv(cv)


def log1p_ratio_clamped(value: float, pivot: float) -> float:
    """clamp(log1p(value)/log1p(pivot)) — volume exposure helper."""

    if pivot <= 0:
        return 0.0
    return clamp01(math.log1p(max(0.0, value)) / math.log1p(pivot))


def scale_to_percentage100_from_unit_components(
    *,
    norm_rating_unit: float,
    volume_signal01: float,
    website_ratio01: float,
    evenness_minus_concentration: float,
    weights_rating: float = 35.5,
    weights_volume: float = 22.0,
    weights_website: float = 24.0,
    weights_even: float = 13.5,
) -> float:
    """Weighted sum capped to [0,100] with deterministic rounding semantics (trust maturity)."""

    raw = (
        weights_rating * norm_rating_unit
        + weights_volume * volume_signal01
        + weights_website * website_ratio01
        + weights_even * evenness_minus_concentration
    )
    return round(clamp01(raw / 100.0) * 100.0, 4)


def confidence_sample_times_completeness(
    fetch_ok: bool,
    n_listings: int,
    fracs: Sequence[float],
    weights: Sequence[float],
    *,
    empty_listing_fallback: float = 0.12,
    listing_cap_for_sample: float = 12.0,
) -> float:
    """Generic confidence: sample completeness from listing breadth × weighted field fractions."""

    if not fetch_ok:
        return 0.0
    if n_listings <= 0:
        return round(empty_listing_fallback, 6)
    sample = clamp01(n_listings / listing_cap_for_sample)
    completeness = clamp01(sum(w * f for w, f in zip(weights, fracs, strict=True)))
    return round(sample * completeness, 6)


def weighted_mean_rating_by_indices(
    indices: Sequence[int],
    comps_ratings_weights: Sequence[tuple[float | None, int]],
) -> float | None:
    """
    Review-weighted mean rating for numeric indices into (rating_optional, weight) rows.

    Skips weights <=0 or ratings None — matches authority analyzer semantics.
    """

    wsum = 0.0
    wtot = 0.0
    for idx in indices:
        r_optional, wi = comps_ratings_weights[idx]
        if r_optional is None or wi <= 0:
            continue
        wsum += float(r_optional) * wi
        wtot += wi
    if wtot <= 0:
        return None
    return wsum / wtot


def trust_average_rating(
    *,
    counts: Sequence[int],
    ratings_present: Sequence[float | None],
    total_reviews: int,
) -> float:
    """Weighted-by-count rating when reviews exist else simple mean of ratings; unrounded."""

    counts_l = list(counts)
    n = len(counts_l)
    rlist = list(ratings_present)

    if total_reviews > 0:
        w_num = 0.0
        for i in range(n):
            rvi = rlist[i]
            if rvi is not None:
                w_num += float(rvi) * counts_l[i]
        w_den = sum(counts_l[i] for i in range(n) if rlist[i] is not None)
        return w_num / w_den if w_den > 0 else 0.0
    flat = [float(r) for r in rlist if r is not None]
    return sum(flat) / len(flat) if flat else 0.0


def dominant_share_threshold_phi(
    n_listings: int,
    *,
    coef: float = 1.66,
    offset_inner: float = 3.42,
    floor: float = 0.068,
) -> float:
    """Authority analyzer share threshold bounded to [0.085, 0.36]."""

    if n_listings <= 0:
        return 0.085
    return float(max(0.085, min(0.36, (coef / math.sqrt(n_listings + offset_inner)) + floor)))
