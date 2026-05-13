"""
Shared recon data models.

Future responsibilities may include:
- dataclasses
- pydantic models
- typed intelligence structures
- validation helpers
"""

from __future__ import annotations

from typing import NotRequired, TypedDict


class CollectionPayload(TypedDict):
    """Raw-ish placeholder envelope from the collection stage."""

    source: str
    competitor_labels: list[str]
    snapshot_notes: list[str]


class AnalysisPayload(TypedDict):
    """Structured placeholder output from analysis."""

    ux_maturity_notes: str
    trust_structure_notes: str
    positioning_notes: str
    gap_hypotheses: list[str]


class ScorePayload(TypedDict):
    """Deterministic placeholder scores for downstream assembly."""

    opportunity: float
    trust: float
    saturation: float
    visual_maturity: float


class MetaBlock(TypedDict):
    generated_at: str
    niche: str
    target_location: str
    hub_city: NotRequired[str]
    shoulder_towns: NotRequired[list[str]]


class MarketIntelligence(TypedDict, total=False):
    market_saturation: str
    competitive_density: str
    underserved_areas: list[str]
    market_patterns: list[str]


class WebsiteIntelligence(TypedDict, total=False):
    design_maturity: str
    conversion_maturity: str
    trust_architecture: str
    positioning_strength: str
    mobile_experience: str


class UxIntelligence(TypedDict, total=False):
    visual_maturity: str
    trust_density: str
    cta_clarity: str
    content_structure_quality: str


class EmotionalIntelligence(TypedDict, total=False):
    dominant_tone: str
    emotional_positioning: str
    luxury_alignment: str
    relationship_depth: str


class AeoIntelligence(TypedDict, total=False):
    schema_readiness: str
    faq_coverage: str
    entity_depth: str
    answerability_score: float


class OpportunityIntelligence(TypedDict, total=False):
    convenience_gaps: list[str]
    excellence_gaps: list[str]
    underserved_segments: list[str]
    strategic_opportunities: list[str]


class StrategyRecommendation(TypedDict, total=False):
    recommended_positioning: str
    recommended_archetype: str
    recommended_vibe: str
    recommended_conversion_style: str
    recommended_trust_strategy: str


class IntakeGuidance(TypedDict, total=False):
    priority_questions: list[str]
    priority_gaps: list[str]
    recommended_sections: list[str]


class ReconContract(TypedDict):
    """
    Machine-readable recon contract (matches contracts/recon.schema.json top-level).

    Assembler is responsible for shaping this structure before persistence.
    """

    meta: MetaBlock
    market_intelligence: MarketIntelligence
    website_intelligence: WebsiteIntelligence
    ux_intelligence: UxIntelligence
    emotional_intelligence: EmotionalIntelligence
    aeo_intelligence: AeoIntelligence
    opportunity_intelligence: OpportunityIntelligence
    strategy_recommendation: StrategyRecommendation
    intake_guidance: IntakeGuidance
