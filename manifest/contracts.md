# SiteForge Contracts

# Philosophy

The old `business.json` architecture is deprecated.

The previous architecture incorrectly combined:
- business truth
- AI inference
- rendering
- strategy
- intake state
- readiness logic
- component configuration

This caused:
- schema instability
- readiness ambiguity
- AI drift
- orchestration complexity
- rendering conflicts

The new architecture separates concerns into layered contracts.

---

# Contract Overview

| Contract | Purpose |
|---|---|
| recon.json | Market intelligence |
| client.json | Human-confirmed truth |
| strategy.json | Strategic decisions |
| site.json | Render-safe output |

---

# recon.json

## Purpose
Machine-readable market intelligence.

## Responsibilities
- competitor analysis
- UX analysis
- opportunity analysis
- emotional intelligence
- AEO intelligence
- saturation analysis
- market patterns
- strategic gaps

## Sources
Generated primarily from:
- scraping
- AI analysis
- scoring systems
- clustering systems

## Rules
recon.json:
- is NOT render-safe
- may contain AI assumptions
- may contain inferred opportunities
- may evolve during analysis

---

# client.json

## Purpose
Human-confirmed business truth.

## Responsibilities
- business information
- contact information
- services
- uploaded assets
- operational details
- approvals
- revisions

## Rules
client.json:
- is the factual source of truth
- overrides AI assumptions
- must remain human-auditable
- should support provenance tracking

---

# strategy.json

## Purpose
Factory strategic decisions.

## Responsibilities
- positioning
- archetype
- vibe selection
- trust strategy
- conversion structure
- gallery strategy
- CTA strategy
- emotional direction
- layout priorities

## Rules
strategy.json:
- is assembled from recon + client truth
- determines rendering priorities
- determines section hierarchy
- drives build normalization

---

# site.json

## Purpose
Render-safe deterministic build contract.

## Responsibilities
- normalized content
- validated rendering structures
- deterministic component data
- schema-ready data
- asset references

## Rules
site.json:
- contains NO AI reasoning
- contains NO unresolved inference
- contains NO intake scratch state
- contains NO strategy commentary
- contains ONLY render-safe structures

Astro consumes ONLY site.json.

---

# Provenance System

Important fields should eventually support provenance tracking.

Example:

```json id="3l84ht"
{
  "primary_offer": {
    "value": "Museum-grade custom framing",
    "source": "client_confirmed",
    "confidence": 0.98
  }
}
```

Supported sources:
- recon_inferred
- ai_suggested
- client_confirmed
- imported
- generated
- manual_override

---

# Intelligence Flow

recon.json
↓
client.json
↓
strategy.json
↓
site.json
↓
Astro Rendering

This flow is intentional and should not be bypassed.

---

# Critical Architectural Rules

## Rule 1
Components NEVER determine strategy.

---

## Rule 2
Readiness is determined BEFORE site.json assembly.

---

## Rule 3
AI reasoning must never leak into rendering contracts.

---

## Rule 4
All rendering contracts must remain deterministic.

---

## Rule 5
No contract should attempt to own the entire system state.

Each contract has a focused responsibility.