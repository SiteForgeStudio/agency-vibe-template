# ADR-003: Recon-First Architecture

## Status
Accepted

## Context

The previous SiteForge architecture evolved in a frontend-first direction.

The development sequence originally followed this pattern:

components →
JSON schema →
intake →
recon →
patching

This created significant architectural instability because:
- frontend requirements were defined before intelligence systems existed
- intake systems attempted to satisfy component assumptions
- readiness logic became tied to rendering structures
- AI systems were forced to fill arbitrary schema gaps
- strategy became fragmented across prompts and rendering logic

The result was:
- premature build triggering
- unstable readiness evaluation
- schema drift
- excessive patching
- forced intake questions
- brittle orchestration
- rendering-driven architecture

The system struggled to determine:
- what information actually mattered
- when a project was strategically complete
- which sections were truly necessary
- which layouts were appropriate
- what the business positioning should be

The architecture needed to reverse the direction of authority.

---

## Decision

SiteForge will adopt:
# a recon-first architecture.

The operational flow becomes:

Recon →
Intelligence →
Strategy →
Build Contract →
Rendering

The system no longer starts with components.

The system starts with:
- market intelligence
- competitor analysis
- opportunity analysis
- emotional positioning
- trust analysis
- AEO analysis

Recon becomes the foundational intelligence layer of the Factory.

---

## Recon Responsibilities

Recon is responsible for:
- competitor discovery
- market analysis
- website analysis
- UX analysis
- emotional analysis
- AEO analysis
- strategic opportunity analysis
- market saturation analysis
- intake guidance

Recon generates:
- recon.json
- strategic recommendations
- readiness hints
- intake guidance
- human-readable intelligence reports

Recon is:
# intelligence-first.

NOT rendering-first.

---

## Intake Responsibilities

Intake no longer behaves like:
- generic form filling
- schema completion
- arbitrary field collection

Instead, intake becomes:
# strategic gap resolution.

Intake exists to:
- verify recon assumptions
- clarify strategic uncertainty
- confirm business truth
- strengthen readiness domains

The intake asks ONLY for:
- unresolved strategic clarity
- missing readiness signals
- client-confirmed truth

---

## Strategy Responsibilities

Strategy becomes an explicit operational layer.

Strategy determines:
- positioning
- vibe
- archetype
- conversion structure
- trust structure
- section hierarchy
- visual direction
- emotional pacing

Components do NOT determine strategy.

Strategy determines rendering priorities.

---

## Rendering Responsibilities

Rendering becomes:
# downstream infrastructure.

Astro consumes:
- deterministic contracts
- finalized strategic decisions
- normalized rendering structures

Rendering no longer:
- infers business strategy
- determines readiness
- drives intake behavior
- interprets intelligence

The frontend becomes presentation-focused.

---

## Consequences

### Benefits

This architecture provides:

- strategy-first orchestration
- improved readiness reliability
- cleaner intake flows
- reduced schema drift
- adaptive rendering systems
- scalable intelligence pipelines
- cleaner AI orchestration
- easier frontend evolution

The system can now support:
- many business archetypes
- adaptive layouts
- dynamic section systems
- flexible rendering systems

WITHOUT hardcoded industry logic.

---

### Tradeoffs

This decision introduces:
- additional orchestration stages
- more strategic assembly logic
- increased intelligence dependency
- more explicit readiness evaluation

These tradeoffs are accepted because they dramatically improve:
- scalability
- maintainability
- orchestration clarity
- strategic quality

---

## Long-Term Impact

This architecture establishes the foundation for:

- adaptive strategic orchestration
- dynamic intake systems
- scalable component systems
- market-aware rendering
- future autonomous optimization systems

The Factory evolves away from:
- component-first thinking
- page-builder architecture
- rigid schema systems

And toward:
# intelligence-driven digital production infrastructure.

---

## Related Decisions

- ADR-001: Layered Contract Architecture
- ADR-002: Python Intelligence Layer
- ADR-004: Deterministic Rendering
- ADR-005: Strategic Readiness Model