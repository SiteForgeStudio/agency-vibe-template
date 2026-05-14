"""
Deterministic contamination control for homepage probe semantics.

Produces an authority posture — never deletes collector evidence downstream.
Explainability via enumerated ``explain_codes`` (no GPT / no embeddings).
"""

from __future__ import annotations

import re
from typing import Iterable
from urllib.parse import urlparse

from intelligence.recon.models import PageProbeRelevancePosture, WebsitePageProbe


_MODULE_ID = "siteforge.recon.validation.probe_relevance.v1"


_STOPWORDS: frozenset[str] = frozenset({
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "your",
    "our",
    "are",
    "was",
    "has",
    "have",
    "not",
    "but",
    "any",
    "all",
    "can",
    "will",
    "you",
    "www",
})

_US_STATE_ABBREV: frozenset[str] = frozenset({
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
    "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
    "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY",
})

_LOCAL_SERVICE_HINTS: frozenset[str] = frozenset({
    "auto",
    "detailing",
    "plumbing",
    "electric",
    "hvac",
    "roofing",
    "landscape",
    "landscaping",
    "dentist",
    "dental",
    "salon",
    "restaurant",
    "towing",
    "tow",
    "chiropractor",
    "contractor",
    "remodel",
})

_BLOCKLIST_REGISTRABLE_HOSTS: frozenset[str] = frozenset({
    "apple.com",
    "google.com",
    "microsoft.com",
    "amazon.com",
    "meta.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "netflix.com",
    "tiktok.com",
    "linkedin.com",
    "youtube.com",
    "yahoo.com",
    "cloudflare.com",
    "stripe.com",
    "github.com",
    "openai.com",
    "wikipedia.org",
    "imdb.com",
    "reddit.com",
    "cnn.com",
    "bbc.co.uk",
    "nytimes.com",
    "paypal.com",
    "adobe.com",
    "oracle.com",
    "ibm.com",
    "salesforce.com",
})

# Title/meta/H1 substrings implying global enterprise / device catalog unrelated to SMB niches.
_MEGA_CORP_HINTS = (
    ("iphone", "iphone"),
    ("ipad", "ipad"),
    ("macbook", "macbook"),
    ("icloud", "icloud"),
    ("app store", "app_store_generic"),
    ("google cloud", "google_cloud"),
    ("chromebook", "chromebook"),
    ("microsoft azure", "azure_catalog"),
    ("aws.amazon", "aws_console"),
)


def evaluate_probe_page_relevance(
    *,
    niche: str,
    target_location: str,
    probe: WebsitePageProbe,
    category_signals: Iterable[str] = (),
    explain_module_id: str = _MODULE_ID,
) -> PageProbeRelevancePosture:
    """
    Deterministic bounded relevance judgement for semantic authority routing.

    ``probe`` stays intact on payloads; callers gate placeholder synthesis only.
    """

    cats = [c.strip().lower() for c in category_signals if c and str(c).strip()]
    explain: list[str] = [f"module:{explain_module_id}"]

    fetch_ok = bool(probe.get("fetch_ok"))

    corpus = _corpus_text(probe)
    niche_tokens = _semantic_tokens(niche)
    loc_tokens = _location_tokens(target_location)

    locality_sensitive = (
        len(niche_tokens & _LOCAL_SERVICE_HINTS) > 0
        or bool(re.search(r"(shop|repair|spa|studio|salon|clinic)", niche.lower()))
    )

    score = _base_overlap_score(corpus, niche_tokens, cats, explain)

    registrable_host = ""
    pn = urlparse((probe.get("url") or "").strip())
    if pn.netloc:
        registrable_host = _registrable_host_from_netloc(pn.netloc)

    blacklist_hit = registrable_host in _BLOCKLIST_REGISTRABLE_HOSTS
    if blacklist_hit:
        explain.append("signal:hostname_blocklist_hit")
        score = min(score, 0.08)

    corp_signal_label = _mega_corp_hints(corpus, explain)

    locality_penalty_applied = False
    if fetch_ok and locality_sensitive and len(corpus.split()) >= 6 and len(loc_tokens) >= 2:
        if not any(t for t in loc_tokens if len(t) >= 4 and t in corpus.lower()):
            score -= 0.18
            locality_penalty_applied = True
            explain.append("signal:geo_locality_uncaptured")
    elif loc_tokens:
        overlap_geo = sum(1 for t in loc_tokens if len(t) >= 4 and t in corpus.lower())
        if overlap_geo:
            explain.append("signal:geo_token_overlap")

    confidence = _confidence(fetch_ok=fetch_ok, probe=probe, corpus=corpus)

    score = round(max(0.0, min(1.0, score)), 6)
    relevance_status = _relevance_status(fetch_ok, blacklist_hit, corp_signal_label, score)
    authority_action = _authority_action(
        fetch_ok=fetch_ok,
        blacklist_hit=blacklist_hit,
        score=score,
        corp_signal_present=corp_signal_label is not None,
        niche_token_count=len(niche_tokens),
    )

    explain.sort()

    status_token = relevance_status.upper().replace(" ", "_").replace("/", "_")

    return {
        "validation_module_id": explain_module_id,
        "relevance_score": score,
        "relevance_status": relevance_status,
        "authority_action": authority_action,
        "confidence": round(confidence, 6),
        "explain_codes": explain,
        "signals": {
            "fetch_ok_recorded": fetch_ok,
            "registrable_host": registrable_host or None,
            "blacklist_hit": blacklist_hit,
            "niche_semantic_terms": sorted(niche_tokens)[:24],
            "category_signal_count": len(cats),
            "local_service_niche_hints": locality_sensitive,
            "locality_penalty_applied": locality_penalty_applied,
            "mega_enterprise_lexical_signal": corp_signal_label,
            "deterministic_reason_status": status_token,
        },
    }


def evaluate_probe_semantics_placeholder_only(
    *,
    niche: str,
    target_location: str,
    fetch_ok_recorded: bool,
    registrable_host: str,
    corpus_sample: str = "",
    category_signals: Iterable[str] = (),
) -> PageProbeRelevancePosture:
    """When analyzer only has coarse facts (missing full probe); bounded inference."""

    explain: list[str] = [f"module:{_MODULE_ID}", "signal:minimal_probe_facts_only"]

    corp = corpus_sample.strip().lower()
    niche_tokens = _semantic_tokens(niche)
    cats = [c.strip().lower() for c in category_signals if c and str(c).strip()]
    score = _base_overlap_score(corp, niche_tokens, cats, explain)

    rn = registrable_host.strip().lower()
    blacklist_hit = rn in _BLOCKLIST_REGISTRABLE_HOSTS
    if blacklist_hit:
        explain.append("signal:hostname_blocklist_hit")
        score = min(score, 0.12)

    if not fetch_ok_recorded:
        score = min(score, 0.35)
        explain.append("signal:probe_fetch_failed")

    score = round(max(0.0, min(1.0, score)), 6)
    confidence = round(0.42 if fetch_ok_recorded else 0.55, 6)
    status = _relevance_status(fetch_ok_recorded, blacklist_hit, None, score)
    action = _authority_action(
        fetch_ok=fetch_ok_recorded,
        blacklist_hit=blacklist_hit,
        score=score,
        corp_signal_present=False,
        niche_token_count=len(niche_tokens),
    )

    explain.sort()

    return {
        "validation_module_id": _MODULE_ID,
        "relevance_score": score,
        "relevance_status": status,
        "authority_action": action,
        "confidence": confidence,
        "explain_codes": explain,
        "signals": {
            "fetch_ok_recorded": fetch_ok_recorded,
            "registrable_host": rn or None,
            "blacklist_hit": blacklist_hit,
            "niche_semantic_terms": sorted(niche_tokens)[:24],
            "category_signal_count": len(cats),
            "local_service_niche_hints": len(niche_tokens & _LOCAL_SERVICE_HINTS) > 0,
            "locality_penalty_applied": False,
            "mega_enterprise_lexical_signal": None,
            "deterministic_reason_status": status.upper().replace(" ", "_").replace("/", "_"),
        },
    }


def _authority_action(
    *,
    fetch_ok: bool,
    blacklist_hit: bool,
    score: float,
    corp_signal_present: bool,
    niche_token_count: int,
) -> str:
    if blacklist_hit:
        return "suppress"
    if niche_token_count >= 2 and corp_signal_present and score < 0.22:
        return "suppress"
    if niche_token_count >= 1 and corp_signal_present and score < 0.15:
        return "suppress"
    if not fetch_ok:
        return "downgrade"
    if score <= 0.30:
        return "suppress"
    if score <= 0.54:
        return "downgrade"
    return "retain"


def _relevance_status(
    fetch_ok: bool,
    blacklist_hit: bool,
    corp_hint: str | None,
    score: float,
) -> str:
    if not fetch_ok and not blacklist_hit:
        return "probe_unverified"
    if blacklist_hit:
        return "canonical_enterprise_host_mismatch"
    if corp_hint and score < 0.42:
        return "enterprise_lexicon_mismatch"
    if score >= 0.68:
        return "aligned_semantics"
    if score <= 0.30:
        return "latent_semantic_mismatch"
    return "uncertain_overlap"


def _confidence(*, fetch_ok: bool, probe: WebsitePageProbe, corpus: str) -> float:
    c = 0.58 + (0.22 if fetch_ok else 0.0)
    filled = 0
    for k in ("title", "meta_description", "first_h1"):
        t = probe.get(k)  # type: ignore[arg-type]
        if isinstance(t, str) and t.strip():
            filled += 1
    c += 0.07 * filled
    if corpus and fetch_ok:
        wc = len(corpus.split())
        if wc >= 80:
            c += 0.08
        elif wc <= 12:
            c -= 0.09
    return max(0.15, min(0.985, c))


def _mega_corp_hints(corpus: str, explain: list[str]) -> str | None:
    cl = corpus.lower()
    if not cl.strip():
        return None
    for needle, lab in _MEGA_CORP_HINTS:
        if needle in cl:
            explain.append(f"signal:mega_lexicon_hint:{lab}")
            return lab
    return None


def _semantic_tokens(raw: str) -> set[str]:
    out: set[str] = set()
    for chunk in re.split(r"[^a-zA-Z0-9]+", raw.lower()):
        if chunk in _STOPWORDS:
            continue
        if len(chunk) < 3:
            continue
        if len(chunk) > 42:
            continue
        out.add(chunk)
    return out


def _location_tokens(location: str) -> set[str]:
    out: set[str] = set()
    blob = location.replace(",", " ").replace("|", " ")
    for chunk in re.split(r"\s+", blob):
        ck = "".join(c for c in chunk if c.isalnum()).lower()
        if not ck or len(ck) < 2:
            continue
        upper = ck.upper()
        if len(ck) == 2 and upper in _US_STATE_ABBREV:
            out.add(ck)
            continue
        if len(ck) >= 3:
            out.add(ck)
    return out


def _corpus_text(probe: WebsitePageProbe) -> str:
    parts: list[str] = []
    u = probe.get("url") or ""
    if u:
        try:
            p = urlparse(u)
            parts.append(p.hostname or "")
            parts.append(u)
        except Exception:
            parts.append(u)
    for field in ("title", "meta_description", "first_h1"):
        t = probe.get(field)  # type: ignore[misc]
        if isinstance(t, str) and t.strip():
            parts.append(t.strip())
    return "\n".join(parts).strip().lower()


def _corpus_contains_token(corpus: str, tok: str) -> bool:
    if not corpus or len(tok) < 3:
        return False
    if tok in corpus:
        return True
    for m in re.finditer(r"[a-z0-9]+", corpus.lower()):
        if tok == m.group(0):
            return True
    return False


def _category_support_score(corpus: str, niche_tokens: set[str], cats: list[str]) -> float:
    if not niche_tokens:
        return 0.15
    if not cats:
        return 0.0
    support = 0
    normalized = [_semantic_tokens(x) for x in cats]
    for bag in normalized:
        if not bag:
            continue
        inter = niche_tokens.intersection(bag)
        density = len(inter) / max(1.0, float(len(bag)))
        if inter:
            support = max(support, min(1.0, len(inter) * 0.32 + density * 0.4))
        if corpus:
            overlaps = sum(1 for t in bag if len(t) >= 4 and t in corpus)
            if overlaps:
                support = max(support, min(1.0, 0.18 + overlaps * 0.12))
    return min(1.0, support)


def _base_overlap_score(
    corpus: str,
    niche_tokens: set[str],
    cats: list[str],
    explain: list[str],
) -> float:
    if not niche_tokens:
        explain.append("signal:niche_neutral_vocab")
        return 0.48

    matches = sum(1 for t in niche_tokens if _corpus_contains_token(corpus, t))
    ratio = matches / len(niche_tokens)
    overlap_score = ratio * (0.22 + min(18, len(corpus.split())) * 0.004)
    overlap_score += matches * 0.11

    cat_adj = _category_support_score(corpus, niche_tokens, cats)
    if cat_adj >= 0.25:
        explain.append(f"signal:category_alignment:{round(cat_adj, 3)}")
    overlap_score += cat_adj * 0.42

    if ratio >= 0.66:
        explain.append(f"signal:niche_token_overlap_high:{matches}/{len(niche_tokens)}")
    elif ratio >= 0.33:
        explain.append(f"signal:niche_token_overlap_mid:{matches}/{len(niche_tokens)}")
    else:
        explain.append(f"signal:niche_token_overlap_low:{matches}/{len(niche_tokens)}")

    if not corpus.strip():
        overlap_score *= 0.34
        explain.append("signal:page_text_fields_empty_or_missing")

    return max(0.1, overlap_score)


def _registrable_host_from_netloc(netloc: str) -> str:
    host = (netloc or "").strip().lower()
    if ":" in host:
        host = host.split(":", 1)[0]
    parts = host.split(".")
    if len(parts) < 2:
        return host.strip(". ")
    registrable = ".".join(parts[-2:])
    if parts[-2] in ("co", "com", "org", "net", "edu", "gov") and len(parts) >= 3:
        registrable = ".".join(parts[-3:])
    return registrable


__all__ = [
    "_MODULE_ID",
    "evaluate_probe_page_relevance",
    "evaluate_probe_semantics_placeholder_only",
]
