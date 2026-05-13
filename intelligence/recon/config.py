"""
Recon operational configuration.

Responsibilities:
- environment configuration
- thresholds
- scoring weights
- model configuration
- runtime flags
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ReconPipelineConfig:
    """Inputs that parameterize a recon run (placeholders use these for contract meta).

    ``website_url`` triggers a lightweight stdlib-only HTTP probe during collection.
    Probe failures are recorded on the payload and never raise out of ``collect``.
    """

    niche: str = "Placeholder niche"
    target_location: str = "Placeholder market"
    hub_city: str | None = None
    shoulder_towns: tuple[str, ...] = ()
    website_url: str | None = None
