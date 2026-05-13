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

from intelligence.recon.config import ReconPipelineConfig
from intelligence.recon.models import CollectionPayload


def collect(config: ReconPipelineConfig) -> CollectionPayload:
    """Return deterministic placeholder raw collection data."""
    location = config.target_location
    return {
        "source": "placeholder_collection",
        "competitor_labels": [
            f"Placeholder Competitor A ({location})",
            "Placeholder Competitor B",
            "Placeholder Competitor C",
        ],
        "snapshot_notes": [
            "Synthetic listing metadata (no network I/O)",
            "No screenshots gathered in skeleton mode",
            f"Niche context recorded as: {config.niche}",
        ],
    }
