# ADR-001: Layered Contract Architecture

## Status
Accepted

## Context

The previous SiteForge architecture relied heavily on a single `business.json` structure that attempted to combine:

- business truth
- AI inference
- rendering data
- strategy decisions
- intake state
- readiness logic
- component configuration
- orchestration hints

Over time, this created major architectural problems:

- schema instability
- AI drift
- readiness ambiguity
- premature build triggering
- rendering conflicts
- intake complexity
- difficult debugging
- excessive coupling between frontend and intelligence systems

The frontend components were being designed before the intelligence architecture was stable, forcing intake and orchestration systems to satisfy rendering assumptions that were not strategically grounded.

This caused the system to become:
- patch-heavy
- difficult to evolve
- difficult to reason about
- difficult to scale horizontally across different business types

The system needed a clearer separation of responsibilities.

---

## Decision

SiteForge will adopt a layered contract architecture.

The Factory will separate operational responsibilities into distinct contracts:

| Contract | Responsibility |
|---|---|
| recon.json | Market intelligence |
| client.json | Human-confirmed business truth |
| readiness.json | Strategic readiness evaluation |
| strategy.json | Strategic decisions |
| site.json | Deterministic render-safe output |

Each contract owns a focused operational responsibility.

---

### recon.json
Contains:
- market intelligence
- competitor analysis
- UX analysis
- emotional intelligence
- AEO intelligence
- opportunity analysis
- intake guidance

This contract is intelligence-oriented and NOT render-safe.

---

### client.json
Contains:
- human-confirmed truth
- operational details
- uploads
- approvals
- business information

This contract acts as the factual source of truth.

AI assumptions must never override confirmed client truth.

---

### readiness.json
Contains:
- strategic readiness states
- confidence levels
- unresolved strategic gaps
- readiness prioritization

Readiness becomes strategy-oriented rather than field-oriented.

---

### strategy.json
Contains:
- positioning
- archetype
- vibe direction
- trust strategy
- conversion strategy
- section prioritization
- visual strategy

This contract acts as the strategic decision layer of the Factory.

---

### site.json
Contains:
- normalized rendering data
- deterministic structures
- presentation-ready content

Astro consumes ONLY `site.json`.

This contract contains:
- no AI reasoning
- no unresolved inference
- no intake scratch state
- no orchestration hints

---

## Consequences

### Benefits

The layered contract system provides:

- deterministic rendering
- improved AI reliability
- clearer orchestration boundaries
- modular system evolution
- cleaner readiness evaluation
- improved debugging
- easier frontend rewrites
- scalable intelligence architecture
- reduced coupling
- improved maintainability

The frontend can now evolve independently from:
- recon systems
- readiness systems
- intake systems
- orchestration systems

---

### Tradeoffs

The architecture introduces:
- additional contracts
- more normalization layers
- more orchestration complexity
- more explicit pipeline stages

However, these tradeoffs are accepted because they dramatically improve:
- long-term scalability
- system clarity
- operational reliability
- future AI orchestration quality

---

## Long-Term Impact

This decision establishes the foundation for:

- adaptive orchestration
- scalable component systems
- strategy-first rendering
- modular intelligence pipelines
- AI-assisted lifecycle optimization
- future autonomous optimization systems

This architecture intentionally shifts SiteForge away from:
- page-builder architecture
- component-first architecture
- schema-heavy monoliths

And toward:
# an intelligence-driven digital production system.

---

## Related Decisions

- ADR-002: Python Intelligence Layer
- ADR-003: Recon-First Architecture
- ADR-004: Deterministic Rendering
- ADR-005: Strategic Readiness Model