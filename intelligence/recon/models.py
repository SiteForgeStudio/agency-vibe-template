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


class WebsitePageProbe(TypedDict, total=False):
    """Raw homepage probe facts (collector output; echoed through analysis)."""

    url: str
    fetch_ok: bool
    http_status: int | None
    error: str
    title: str
    meta_description: str
    first_h1: str


class TrustAnalysis(TypedDict):
    """Deterministic operational trust primitives (Places-derived; no prose)."""

    market_review_count_avg: float
    market_review_count_median: float
    top_3_review_share: float
    website_presence_ratio: float
    average_rating: float
    authority_concentration_score: float
    trust_maturity_score: float
    confidence: float


class DensityAnalysis(TypedDict):
    """Deterministic market-density primitives (Places-derived; no prose)."""

    competitor_count: int
    market_fragmentation_score: float
    category_consistency_score: float
    review_distribution_score: float
    saturation_score: float
    confidence: float


class AuthorityAnalysis(TypedDict):
    """Deterministic competitive-authority primitives (Places-derived; no prose)."""

    market_leader_strength: float
    authority_concentration: float
    trust_gap_score: float
    competitive_openness: float
    dominant_player_count: int
    confidence: float


class GeoAnalysis(TypedDict):
    """Deterministic geographic market-structure primitives (contract geo + Places-derived math)."""

    hub_strength: float
    shoulder_fragmentation: float
    adjacent_market_opportunity: float
    geo_authority_spread: float
    market_centralization: float
    confidence: float


class MarketStateInterpretation(TypedDict):
    """Cross-analyzer market relationships (deterministic composites; no prose or raw evidence)."""

    market_competitiveness: float
    market_openness: float
    authority_pressure: float
    entry_difficulty: float
    geo_expansion_viability: float
    confidence: float


class MarketReadiness(TypedDict):
    """Strategic readiness conditions from analyzers + interpretation (numeric only)."""

    trust_readiness: float
    positioning_readiness: float
    authority_readiness: float
    geo_readiness: float
    differentiation_readiness: float
    confidence: float


class StrategyState(TypedDict):
    """Deterministic strategic operating posture composites (pressure/mode primitives only)."""

    trust_strategy_mode: float
    positioning_pressure: float
    conversion_pressure: float
    differentiation_pressure: float
    geo_expansion_pressure: float
    authority_response_pressure: float
    confidence: float


class PlacesCompetitor(TypedDict):
    """Normalized row from Places Text Search (New)."""

    name: str
    rating: NotRequired[float]
    review_count: NotRequired[int]
    primary_category: NotRequired[str]
    website: NotRequired[str]


class PlacesTextSearchEvidence(TypedDict):
    """Evidence bundle from Places text search plus probe metadata."""

    text_query: str
    fetch_ok: bool
    competitors: list[PlacesCompetitor]
    http_status: NotRequired[int | None]
    error: NotRequired[str]


class CollectionPayload(TypedDict):
    """Raw-ish placeholder envelope from the collection stage."""

    source: str
    competitor_labels: list[str]
    snapshot_notes: list[str]
    hub_city: NotRequired[str]
    shoulder_towns: NotRequired[list[str]]
    page_probe: NotRequired[WebsitePageProbe]
    places_text_search: NotRequired[PlacesTextSearchEvidence]


class AnalysisPayload(TypedDict):
    """Structured placeholder output from analysis."""

    ux_maturity_notes: str
    trust_structure_notes: str
    positioning_notes: str
    gap_hypotheses: list[str]
    page_probe: NotRequired[WebsitePageProbe]
    places_text_search: NotRequired[PlacesTextSearchEvidence]
    trust_analysis: TrustAnalysis
    density_analysis: DensityAnalysis
    authority_analysis: AuthorityAnalysis
    geo_analysis: GeoAnalysis
    market_state_interpretation: MarketStateInterpretation
    market_readiness: MarketReadiness
    strategy_state: StrategyState


class ScorePayload(TypedDict):
    """Deterministic placeholder scores for downstream assembly."""

    opportunity: float
    trust: float
    saturation: float
    visual_maturity: float


class ScoreInsight(TypedDict):
    """Operational score card (contracts/recon.schema.json scoreInsight)."""

    score: float
    label: str
    status: NotRequired[
        str
    ]  # deterministic_derived | legacy_scorer_transitional | deprecated_placeholder ...
    authority_level: NotRequired[str]  # authoritative | non_authoritative | deterministic_secondary


class AuthorityMetadataBanner(TypedDict):
    """Declares transitional vs deterministic authority on an assembled subsection."""

    status: str  # placeholder | mixed | deterministic_operational …
    authority_level: str  # authoritative | non_authoritative | deterministic_primary …


class MetaBlock(TypedDict):
    generated_at: str
    niche: str
    target_location: str
    hub_city: NotRequired[str]
    shoulder_towns: NotRequired[list[str]]


class MarketIntelligence(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
    market_saturation: ScoreInsight
    competitive_density: str
    underserved_areas: list[str]
    market_patterns: list[str]
    places_text_search: NotRequired[PlacesTextSearchEvidence]
    density_analysis: DensityAnalysis
    authority_analysis: AuthorityAnalysis
    geo_analysis: GeoAnalysis
    market_state_interpretation: MarketStateInterpretation
    market_readiness: MarketReadiness
    strategy_state: StrategyState


class WebsiteIntelligence(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
    design_maturity: str
    conversion_maturity: str
    trust_architecture: str
    positioning_strength: str
    mobile_experience: str
    page_probe: WebsitePageProbe
    trust_analysis: TrustAnalysis


class UxIntelligence(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
    visual_maturity: ScoreInsight
    trust_density: ScoreInsight
    cta_clarity: str
    content_structure_quality: str


class EmotionalIntelligence(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
    dominant_tone: str
    emotional_positioning: str
    luxury_alignment: str
    relationship_depth: str


class AeoIntelligence(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
    schema_readiness: str
    faq_coverage: str
    entity_depth: str
    answerability: ScoreInsight


class OpportunityIntelligence(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
    convenience_gaps: list[str]
    excellence_gaps: list[str]
    underserved_segments: list[str]
    strategic_opportunities: list[str]


class StrategyRecommendation(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
    recommended_positioning: str
    recommended_archetype: str
    recommended_vibe: str
    recommended_conversion_style: str
    recommended_trust_strategy: str


class IntakeGuidance(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
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
