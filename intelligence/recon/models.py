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


class PageProbeRelevanceSignals(TypedDict):
    """Deterministic visibility into probe relevance factors (no prose recommendations)."""

    fetch_ok_recorded: bool
    registrable_host: str | None
    blacklist_hit: bool
    niche_semantic_terms: list[str]
    category_signal_count: int
    local_service_niche_hints: bool
    locality_penalty_applied: bool
    mega_enterprise_lexical_signal: str | None
    deterministic_reason_status: str


class PageProbeRelevancePosture(TypedDict):
    """Bounded probe semantic authority routing (evidence remains on payload)."""

    validation_module_id: str
    relevance_score: float
    relevance_status: str
    authority_action: str
    confidence: float
    explain_codes: list[str]
    signals: PageProbeRelevanceSignals


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


class SynthesisAuthorityContext(TypedDict):
    """Authoritative deterministic blocks-only context for constrained synthesis ingestion."""

    trust_analysis: TrustAnalysis
    density_analysis: DensityAnalysis
    authority_analysis: AuthorityAnalysis
    geo_analysis: GeoAnalysis
    market_state_interpretation: MarketStateInterpretation
    market_readiness: MarketReadiness
    strategy_state: StrategyState


class SynthesisConfidenceContext(TypedDict):
    """Aggregated confidence for synthesis routing."""

    analyzer_confidence_mean: float
    interpretation_confidence: float
    readiness_confidence: float
    strategy_state_confidence: float
    synthesis_bundle_mean_confidence: float
    synthesis_bundle_min_confidence: float


class SynthesisContractAuthorityMetadata(TypedDict):
    """Declares deterministic-only synthesis bundle policy."""

    bundle_schema_id: str
    synthesis_safe: bool
    deterministic_primary: bool
    excludes_raw_evidence: bool
    excludes_placeholder_contract_sections: bool
    excludes_legacy_scorers: bool


class SemanticLineageMetadata(TypedDict):
    """Explicit upstream lineage vs excluded runtime noise."""

    pipeline_stages_included: list[str]
    upstream_modules_in_bundle: list[str]
    deliberately_excluded: list[str]


class DeterministicSummariesFingerprint(TypedDict):
    """Numeric synthesis fingerprints — no prose."""

    trust_avg_rating: float
    trust_maturity_score: float
    trust_top_three_review_share: float
    trust_website_presence_ratio: float
    density_competitor_count: int
    density_saturation_unit: float
    density_market_fragmentation: float
    authority_leader_strength: float
    authority_market_concentration: float
    authority_competitive_openness: float
    geo_hub_strength: float
    geo_market_centralization: float
    interpretation_market_competitiveness: float
    interpretation_entry_difficulty: float
    readiness_minimum_domain: float
    readiness_maximum_domain: float
    strategy_trust_strategy_mode: float
    strategy_pressure_max: float
    synthesis_bundle_min_confidence: float


class SynthesisContract(TypedDict):
    """Synthesis-facing shielded bundle — operational truth distilled without collectors/legacy rows."""

    authority_context: SynthesisAuthorityContext
    confidence_context: SynthesisConfidenceContext
    authority_metadata: SynthesisContractAuthorityMetadata
    semantic_lineage: SemanticLineageMetadata
    deterministic_summaries: DeterministicSummariesFingerprint


class NarrativeInterpretiveBanner(TypedDict):
    """Marks bounded GPT explanatory layer vs deterministic authority."""

    narrative_module_id: str
    interpretive_authority_level: str
    consumption_scope: str


class NarrativeSynthesisGPTMeta(TypedDict, total=False):
    """Optional GPT call provenance."""

    synthesis_model: str
    synthesized_at_utc: str
    suppression_reason: str


class MarketNarrativeSynthesis(TypedDict):
    """Interpretive explanatory narratives mirrored on synthesis_contract semantics only."""

    market_narrative: str
    authority_narrative: str
    trust_narrative: str
    readiness_narrative: str
    authority_contract_metadata_echo: SynthesisContractAuthorityMetadata
    deterministic_semantic_lineage_echo: SemanticLineageMetadata
    narrative_interpretive_banner: NarrativeInterpretiveBanner
    deterministic_grounding_references: list[str]
    confidence_language_posture: str
    gpt_generation_meta: NarrativeSynthesisGPTMeta


class NarrativeSynthesisGovernance(TypedDict):
    """Deterministic audit of bounded GPT narratives vs authoritative bundle policy."""

    validation_module_id: str
    validation_status: str
    confidence_alignment: str
    prescriptive_drift_detected: bool
    unsupported_claims_detected: bool
    narrative_scope_status: str
    severity: str
    governance_codes: list[str]
    suppression_reason: NotRequired[str]


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
    pipeline_niche: NotRequired[str]
    pipeline_target_location: NotRequired[str]
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
    synthesis_contract: SynthesisContract
    market_narrative_synthesis: MarketNarrativeSynthesis
    narrative_synthesis_governance: NarrativeSynthesisGovernance
    probe_relevance_posture: NotRequired[PageProbeRelevancePosture]


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
    synthesis_contract: SynthesisContract
    market_narrative_synthesis: MarketNarrativeSynthesis
    narrative_synthesis_governance: NarrativeSynthesisGovernance


class WebsiteIntelligence(TypedDict, total=False):
    authority_metadata: AuthorityMetadataBanner
    probe_relevance_posture: PageProbeRelevancePosture
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
