"""
Google Places API (New) text search — evidence only.

POST https://places.googleapis.com/v1/places:searchText
Uses stdlib HTTP; no retries, no async.
"""

from __future__ import annotations

import contextlib
import json
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from intelligence.recon.models import PlacesCompetitor, PlacesTextSearchEvidence

_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
_TIMEOUT_S = 14.0
_DEFAULT_PAGE_SIZE = 15
_FIELD_MASK = (
    "places.displayName,places.rating,places.userRatingCount,"
    "places.primaryTypeDisplayName,places.primaryType,places.websiteUri"
)


def _localized_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return str(value.get("text") or value.get("name") or "").strip()
    return ""


def _candidate_from_place(place: Mapping[str, Any]) -> PlacesCompetitor | None:
    name = _localized_text(place.get("displayName"))
    if not name:
        return None

    out: PlacesCompetitor = {"name": name}

    rating = place.get("rating")
    if isinstance(rating, (int, float)):
        out["rating"] = float(rating)

    urc = place.get("userRatingCount")
    if isinstance(urc, int):
        out["review_count"] = urc
    elif isinstance(urc, float) and urc == int(urc):
        out["review_count"] = int(urc)

    cat = _localized_text(place.get("primaryTypeDisplayName"))
    if not cat and isinstance(place.get("primaryType"), str):
        cat = place["primaryType"].strip()
    if cat:
        out["primary_category"] = cat[:500]

    web = place.get("websiteUri")
    if isinstance(web, str) and web.strip():
        out["website"] = web.strip()[:2048]

    return out


def _places_error_body_message(raw: str) -> str:
    with contextlib.suppress(json.JSONDecodeError):
        data = json.loads(raw)
        err = data.get("error") if isinstance(data, dict) else None
        if isinstance(err, dict) and isinstance(err.get("message"), str):
            return err["message"][:800]
    return raw[:800]


def fetch_places_text_search_evidence(
    niche: str,
    target_location: str,
    *,
    api_key: str,
    page_size: int = _DEFAULT_PAGE_SIZE,
) -> PlacesTextSearchEvidence:
    """Run Text Search (New); return normalized competitor rows plus probe metadata."""

    text_query = f"{niche.strip()} in {target_location.strip()}"
    fail_base: PlacesTextSearchEvidence = {
        "text_query": text_query,
        "fetch_ok": False,
        "competitors": [],
    }

    if not niche.strip() or not target_location.strip():
        fail_base["error"] = "missing_niche_or_target_location"
        return fail_base

    capped = max(1, min(int(page_size), 20))
    body = {"textQuery": text_query, "pageSize": capped}
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")

    req = Request(
        _SEARCH_URL,
        data=payload,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": _FIELD_MASK,
        },
        method="POST",
    )

    http_status: int | None = None

    try:
        with urlopen(req, timeout=_TIMEOUT_S) as resp:
            code = getattr(resp, "status", None) if hasattr(resp, "status") else resp.getcode()
            http_status = int(code) if code is not None else None
            raw = resp.read()
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except HTTPError as exc:
        http_status = getattr(exc, "code", None)
        err_raw = ""
        with contextlib.suppress(OSError):
            err_raw = exc.read().decode("utf-8", errors="replace")[:4000]
        fail_base["http_status"] = http_status
        fail_base["error"] = _places_error_body_message(err_raw) if err_raw else str(exc)[:500]
        return fail_base
    except TimeoutError:
        fail_base["error"] = "TimeoutError: Places request exceeded timeout"
        return fail_base
    except (URLError, OSError, json.JSONDecodeError) as exc:
        fail_base["http_status"] = None
        fail_base["error"] = f"{type(exc).__name__}: {exc}"[:500]
        return fail_base

    places_raw = data.get("places") if isinstance(data, dict) else None
    if not isinstance(places_raw, list):
        places_raw = []

    candidates: list[PlacesCompetitor] = []
    for item in places_raw:
        if not isinstance(item, dict):
            continue
        c = _candidate_from_place(item)
        if c is not None:
            candidates.append(c)

    return {
        "text_query": text_query,
        "fetch_ok": True,
        "http_status": http_status,
        "competitors": candidates,
    }
