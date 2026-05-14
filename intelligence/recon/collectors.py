"""
Recon Collection Layer

Responsibilities:
- competitor discovery
- website scraping
- geo intelligence
- metadata extraction
- screenshot collection
- raw content gathering

This layer gathers raw intelligence only.

No strategic reasoning should occur here.
"""

from __future__ import annotations

import contextlib
import os
from html.parser import HTMLParser
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from intelligence.recon.config import ReconPipelineConfig
from intelligence.recon.models import CollectionPayload, WebsitePageProbe
from intelligence.recon.places_collector import fetch_places_text_search_evidence
from intelligence.recon.runtime_env import GOOGLE_PLACES_API_KEY_ENV

_READ_LIMIT_BYTES = 512_000
_TIMEOUT_S = 12.0
_UA = "SiteForge-ReconProbe/0.1 (stdlib metadata-only)"


class _LitePageParser(HTMLParser):
    """Best-effort title, meta description, and first H1 (handles broken HTML)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._in_title = False
        self._title_buf: list[str] = []
        self._in_h1 = False
        self._h1_buf: list[str] = []
        self._h1_locked = False
        self.meta_description = ""
        self.first_h1 = ""

    def handle_starttag(self, tag: str, attrs: Iterable[tuple[str, str | None]]) -> None:
        attrs_l = {(k or "").lower(): (v or "") for k, v in attrs}
        t = tag.lower()

        if t == "title":
            self._in_title = True
            self._title_buf = []
        elif t == "meta":
            name = attrs_l.get("name", "").lower()
            prop = attrs_l.get("property", "").lower()
            raw = attrs_l.get("content", "").strip()
            if raw and not self.meta_description:
                if name == "description" or prop == "og:description":
                    self.meta_description = raw[:5000]
        elif t == "h1" and not self._h1_locked:
            self._in_h1 = True
            self._h1_buf = []

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == "title":
            self._in_title = False
        elif t == "h1" and self._in_h1:
            self._in_h1 = False
            joined = "".join(self._h1_buf).strip()
            if joined:
                self.first_h1 = joined[:2000]
            self._h1_locked = True

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_buf.append(data)
        elif self._in_h1 and not self._h1_locked:
            self._h1_buf.append(data)

    def title_text(self) -> str:
        return "".join(self._title_buf).strip()[:1200]


def _normalize_http_url(raw: str) -> str | None:
    trimmed = raw.strip()
    if not trimmed:
        return None
    parsed = urlparse(trimmed)
    if parsed.scheme and parsed.scheme not in ("http", "https"):
        return None
    if not parsed.scheme:
        trimmed = f"https://{trimmed.lstrip('/')}"
        parsed = urlparse(trimmed)
    return trimmed if parsed.netloc else None


def probe_http_homepage(url: str) -> WebsitePageProbe:
    """GET the URL and harvest basic metadata (never raises).

    Intended as a coarse proof-of-collection step; parses whatever HTML was returned for 2xx reads.
    """
    out: WebsitePageProbe = {
        "url": url,
        "fetch_ok": False,
        "http_status": None,
    }

    req = Request(
        url,
        headers={"User-Agent": _UA, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"},
        method="GET",
    )

    try:
        with urlopen(req, timeout=_TIMEOUT_S) as resp:
            code = getattr(resp, "status", None) if hasattr(resp, "status") else resp.getcode()
            out["http_status"] = int(code) if code is not None else None
            blob = resp.read(_READ_LIMIT_BYTES + 1)
            if len(blob) > _READ_LIMIT_BYTES:
                blob = blob[:_READ_LIMIT_BYTES]

            charset: str | None = None
            with contextlib.suppress(Exception):
                charset = resp.headers.get_content_charset()
            html = blob.decode(charset or "utf-8", errors="replace")

            parser = _LitePageParser()
            with contextlib.suppress(Exception):
                parser.feed(html)
                parser.close()

            out["fetch_ok"] = True
            if title := parser.title_text():
                out["title"] = title
            if parser.meta_description:
                out["meta_description"] = parser.meta_description
            if parser.first_h1:
                out["first_h1"] = parser.first_h1

    except HTTPError as exc:
        out["fetch_ok"] = False
        out["http_status"] = getattr(exc, "code", None)
        out["error"] = f"{type(exc).__name__}: HTTP {exc.code}"

    except URLError as exc:
        out["fetch_ok"] = False
        out["error"] = str(exc)[:500]

    except TimeoutError:
        out["fetch_ok"] = False
        out["error"] = "TimeoutError: request exceeded timeout"

    except OSError as exc:
        out["fetch_ok"] = False
        out["error"] = f"{type(exc).__name__}: {exc}"[:500]

    err = out.get("error")
    if isinstance(err, str) and len(err) > 500:
        out["error"] = err[:500]

    return out


def collect(config: ReconPipelineConfig) -> CollectionPayload:
    """Return placeholder collection data plus an optional homepage probe."""

    location = config.target_location
    payload: CollectionPayload = {
        "source": "placeholder_collection",
        "competitor_labels": [
            f"Placeholder Competitor A ({location})",
            "Placeholder Competitor B",
            "Placeholder Competitor C",
        ],
        "snapshot_notes": [
            "Synthetic listing metadata (no network unless website_url configured)",
            "No screenshots gathered in skeleton mode",
            f"Niche context recorded as: {config.niche}",
        ],
    }

    hc = (config.hub_city or "").strip()
    if hc:
        payload["hub_city"] = hc
    if config.shoulder_towns:
        payload["shoulder_towns"] = list(config.shoulder_towns)

    api_key = (os.environ.get(GOOGLE_PLACES_API_KEY_ENV) or "").strip()
    if api_key:
        payload["places_text_search"] = fetch_places_text_search_evidence(
            config.niche,
            config.target_location,
            api_key=api_key,
        )

    if config.website_url:
        norm = _normalize_http_url(config.website_url)
        if norm:
            payload["page_probe"] = probe_http_homepage(norm)
        else:
            payload["page_probe"] = {
                "url": config.website_url.strip(),
                "fetch_ok": False,
                "http_status": None,
                "error": "invalid_or_non_http_url",
            }

    return payload
