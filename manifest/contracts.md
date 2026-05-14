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
Machine-readable **market and operating-structure intelligence** from recon. Holds both **authoritative deterministic** blocks and **transitional** placeholder scaffolding (explicitly tagged in assembly).

## Responsibilities (current)
- **Deterministic (authoritative for modeled dimensions):**  
  `trust_analysis`, `density_analysis`, `authority_analysis`, `geo_analysis`, `market_state_interpretation`, `market_readiness`, `strategy_state`
- Evidence passthrough where present: e.g. Places envelope, page probe facts
- **Assembly overlays:** e.g. market saturation score **derived** from `density_analysis.saturation_score` (deterministic-derived `ScoreInsight`)
- **Transitional:** legacy `scorers.py`-backed score cards where not yet replaced (tagged non-authoritative); placeholder UX/emotional/AEO/opportunity/strategy **prose** blocks (tagged via `authority_metadata`)

## Sources
- **Evidence** via collectors (e.g. Places, HTTP probe)
- **Deterministic pipeline:** analyzers → interpreters → readiness → strategy-state
- Legacy scorer: **transitional only** for specific stub fields

## Rules
recon.json:
- is NOT render-safe end-to-end (mixed intelligence + placeholders)
- deterministic blocks are the **operational truth** for their domains
- placeholder and legacy-scorer sections must be treated as **non-authoritative** until replaced
- may evolve as analyzers expand; schema in `contracts/recon.schema.json`

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

**Recon stage (deterministic spine):**  
evidence → analyzers → interpreters → readiness → strategy-state → (transitional scorers for stubs) → assembler → **recon.json**

**Factory flow (unchanged intent):**  
recon.json → client.json → strategy.json → site.json → Astro rendering

Deterministic recon outputs **inform** strategy assembly; they do not bypass `client.json` as human truth.

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