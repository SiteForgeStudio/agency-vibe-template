# ADR-002: Python Intelligence Layer

## Status
Accepted

## Context

The original SiteForge architecture relied heavily on:
- JavaScript
- Cloudflare Functions
- Apps Script orchestration

This worked effectively for:
- lightweight APIs
- frontend interactions
- intake workflows
- simple orchestration

However, as the Factory evolved into a more intelligence-driven system, the architecture began encountering limitations.

The system increasingly required:
- multi-stage AI orchestration
- market intelligence analysis
- competitor clustering
- UX analysis
- scoring systems
- AEO analysis
- screenshot analysis
- strategic reasoning
- long-running intelligence workflows

These workloads became increasingly difficult to manage cleanly inside:
- Cloudflare edge functions
- large JavaScript orchestration files
- prompt-heavy serverless pipelines

The previous architecture also encouraged:
- oversized orchestration files
- tightly coupled logic
- unstable prompt systems
- difficult debugging
- AI drift inside operational pipelines

The Factory required a dedicated intelligence layer.

---

## Decision

SiteForge will adopt Python as the primary intelligence and orchestration layer for the Factory.

The system architecture will separate responsibilities as follows:

| Layer | Primary Responsibility |
|---|---|
| Python | Intelligence + orchestration |
| Cloudflare/JS | Interaction + edge UX |
| Astro | Rendering |
| GitHub Actions | Pipeline execution |

---

## Python Responsibilities

Python becomes responsible for:

- recon intelligence
- competitor analysis
- market analysis
- UX analysis
- emotional analysis
- AEO analysis
- strategic scoring
- clustering systems
- orchestration pipelines
- intelligence assembly
- lifecycle intelligence systems

Python also becomes the primary environment for:
- AI reasoning pipelines
- structured intelligence generation
- operational scoring systems
- future multimodal intelligence systems

---

## Cloudflare Responsibilities

Cloudflare and JavaScript remain responsible for:

- intake UX
- conversational workflows
- streaming responses
- uploads
- edge APIs
- session handling
- lightweight orchestration
- preview interactions

Cloudflare acts as:
# the Factory interaction layer.

NOT the primary intelligence engine.

---

## GitHub Actions Responsibilities

GitHub Actions becomes:
# the Factory orchestration runtime.

Responsibilities include:
- recon execution
- intelligence pipelines
- build orchestration
- quality gates
- deployment orchestration
- lifecycle rebuilds

GitHub Actions evolves beyond traditional CI/CD and becomes:
# operational factory infrastructure.

---

## Astro Responsibilities

Astro remains:
# the deterministic rendering engine.

Responsibilities:
- static rendering
- component rendering
- schema injection
- optimization
- build output generation

Astro consumes ONLY:
- site.json
- assets

Astro remains isolated from:
- intelligence logic
- AI reasoning
- orchestration systems

---

## Consequences

### Benefits

This architecture provides:

- cleaner orchestration boundaries
- improved maintainability
- better AI workflow support
- stronger data processing capabilities
- improved modularity
- easier scoring systems
- easier analysis pipelines
- cleaner intelligence evolution

Python provides a significantly stronger ecosystem for:
- AI workflows
- analysis pipelines
- clustering
- scoring
- automation
- future ML integrations

---

### Tradeoffs

This decision introduces:
- multi-language architecture
- additional orchestration complexity
- more deployment coordination
- additional operational boundaries

However, these tradeoffs are accepted because they significantly improve:
- scalability
- orchestration quality
- long-term intelligence capabilities

---

## Long-Term Impact

This decision establishes the foundation for future capabilities including:

- multimodal analysis
- screenshot intelligence
- semantic clustering
- adaptive scoring systems
- embedding systems
- AI-assisted optimization
- autonomous strategic recommendations
- lifecycle optimization systems

The architecture intentionally evolves SiteForge away from:
- frontend-centric orchestration
- monolithic serverless logic
- oversized edge functions

And toward:
# modular intelligence infrastructure.

---

## Related Decisions

- ADR-001: Layered Contract Architecture
- ADR-003: Recon-First Architecture
- ADR-004: Deterministic Rendering
- ADR-005: Strategic Readiness Model