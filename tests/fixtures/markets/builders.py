"""Helpers and scenario descriptor for deterministic semantic fixtures."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from intelligence.recon.models import CollectionPayload, PlacesTextSearchEvidence


@dataclass(frozen=True)
class SemanticMarketScenario:
    """Declarative stress envelope — consumed by posture tests (not runtime collectors)."""

    scenario_id: str
    niche: str
    target_location: str
    competitors: tuple[dict[str, Any], ...]
    places_fetch_ok: bool = True
    text_query: str = "fixture_semantic_query"
    hub_city: str | None = None
    shoulder_towns: tuple[str, ...] = ()
    page_probe: dict[str, Any] | None = None
    snapshot_notes: tuple[str, ...] = ()
    competitor_labels: tuple[str, ...] | None = None
    """Optional Expected posture hints — inequalities validated by semantic tests."""

    expectations: dict[str, Any] = field(default_factory=dict)


def places_evidence_from_scenario(spec: SemanticMarketScenario) -> PlacesTextSearchEvidence:
    rows = [dict(r) for r in spec.competitors]
    ev: PlacesTextSearchEvidence = {
        "text_query": spec.text_query,
        "fetch_ok": spec.places_fetch_ok,
        "competitors": rows,
    }
    return ev


def collection_payload_from_scenario(spec: SemanticMarketScenario) -> CollectionPayload:
    labels = (
        list(spec.competitor_labels)
        if spec.competitor_labels is not None
        else [r.get("name", f"Peer_{i}") for i, r in enumerate(spec.competitors)]
    )
    payload: CollectionPayload = {
        "source": "semantic_fixture",
        "competitor_labels": labels,
        "snapshot_notes": list(spec.snapshot_notes) or ["semantic_fixture_row"],
        "pipeline_niche": spec.niche,
        "pipeline_target_location": spec.target_location,
        "places_text_search": places_evidence_from_scenario(spec),
    }
    if spec.hub_city:
        payload["hub_city"] = spec.hub_city
    if spec.shoulder_towns:
        payload["shoulder_towns"] = list(spec.shoulder_towns)
    if spec.page_probe is not None:
        payload["page_probe"] = dict(spec.page_probe)
    return payload


def listing(
    *,
    name: str,
    review_count: int,
    rating: float,
    primary_category: str,
    website: str | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "name": name,
        "review_count": review_count,
        "rating": rating,
        "primary_category": primary_category,
    }
    if website:
        row["website"] = website
    return row
