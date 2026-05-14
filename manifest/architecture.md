# SiteForge Architecture

# System Overview

SiteForge is a layered intelligence and rendering system.

The architecture separates:
- intelligence
- business truth
- strategy
- rendering
- deployment

This separation is mandatory for scalability and reliability.

---

# High-Level Pipeline

Lead →
Recon →
Market Intelligence →
Paid Intake →
Strategy Assembly →
Build Contract →
Astro Rendering →
Quality Gates →
Deployment →
Lifecycle Updates

---

# Core System Layers

| Layer | Responsibility |
|---|---|
| Intelligence Layer | Market analysis + strategy |
| Client State Layer | Human-confirmed truth |
| Strategy Layer | Factory decisions |
| Build Layer | Render-safe normalization |
| Rendering Layer | Static generation |
| Deployment Layer | Preview + production |
| Lifecycle Layer | Ongoing updates |

---

# Intelligence Layer

Primary stack (recon pipeline — current):
- Python under `intelligence/recon/` — collectors, analyzers, interpreters, readiness, strategy-state, assembly, validation, artifacts, report

**Deterministic authority hierarchy (recon):**
1. **Analyzers** — evidence → typed primitives (trust, density, authority, geo).
2. **Shared math** — `intelligence_math.py` — bounded reusable operations (no strategy prose).
3. **Interpreters** — relationships *between* analyzer outputs (`market_state_interpretation`).
4. **Readiness** — strategic *preparedness* composites (`market_readiness`).
5. **Strategy-state** — deterministic posture / pressure primitives (`strategy_state`) — *not* recommendations.

**Transitional / non-authoritative in recon today:**
- Legacy `scorers.py` signals used only for stub UX/AEO score cards where not yet replaced by deterministic overlays.
- Placeholder prose blocks (strategy recommendation, emotional, opportunity scaffolding) — **explicitly** marked `authority_metadata` and non-authoritative in assembly.

**Synthesis (future):** Constrained use of models to **explain or structure** outputs that are already fixed by deterministic layers — **not** to invent market facts. Evidence and analyzers remain the root of truth.

Primary outputs (recon stage):
- `recon.json` (layered contract; deterministic blocks authoritative)
- intake guidance echoes (transitional where noted)

This intelligence layer segment is **not** render-safe by itself; downstream `site.json` remains the render-safe contract.

---

# Client State Layer

Purpose:
Store factual business truth.

Primary responsibilities:
- client submissions
- intake responses
- uploaded assets
- approvals
- revisions
- operational details

Primary outputs:
- client.json

AI-generated assumptions must NEVER overwrite confirmed client truth.

---

# Strategy Layer

Purpose:
Translate intelligence into build decisions.

Responsibilities:
- positioning
- archetype selection
- vibe selection
- conversion structure
- trust strategy
- gallery strategy
- CTA strategy
- section prioritization

Primary outputs:
- strategy.json

---

# Build Layer

Purpose:
Normalize finalized strategy into deterministic render contracts.

Responsibilities:
- validation
- normalization
- render preparation
- schema preparation
- image preparation
- section assembly

Primary outputs:
- site.json

site.json is the ONLY contract Astro consumes.

---

# Rendering Layer

Primary technologies:
- Astro
- Tailwind

Responsibilities:
- static generation
- layout rendering
- schema injection
- asset optimization
- deterministic rendering

Astro components should:
- remain presentation-focused
- avoid intelligence logic
- avoid orchestration logic

---

# Deployment Layer

Primary technologies:
- GitHub Actions
- Netlify
- Cloudflare

Responsibilities:
- preview deployments
- production deployments
- build pipelines
- deployment orchestration
- artifact generation

---

# Lifecycle Layer

Purpose:
Support ongoing optimization and updates.

Responsibilities:
- update requests
- rebuild triggers
- content revisions
- strategy refreshes
- deployment history

The client interacts with:
# the CWS (Client Workflow System)

NOT a traditional CMS.

---

# Operational Philosophy

## The Factory Is Host-Agnostic
The system can deploy to:
- Netlify
- Vercel
- GitHub Pages
- ZIP delivery
- future providers

The Factory retains orchestration control.

---

## GitHub Is The Operational Memory
GitHub stores:
- contracts
- intelligence
- assets
- deployments
- client history

GitHub Actions acts as:
# the orchestration engine.

---

## Python Is The Deterministic Intelligence Spine (recon)

Python owns (for recon):
- evidence collection orchestration
- deterministic analyzers and shared math
- interpreters, readiness, strategy-state
- contract assembly and schema validation

Orchestration (`engine.py`) sequences stages only — **no** embedded market strategy rules.

Cloudflare (and related) may own:
- UX surfaces
- interaction
- intake APIs
- streaming
- uploads

Intelligence **truth** for market structure in recon flows through the Python deterministic stack, not through placeholder contract prose.

---

# Future Architecture Goals

Near-term (recon):
- extend deterministic coverage where legacy scorers still back stub score cards
- optional constrained synthesis that **reads** frozen deterministic payloads only

Longer-term expansion areas:
- screenshot analysis (new analyzers, not hardcoded industries)
- visual scoring as deterministic signals where possible
- embeddings / clustering as **supporting** structure, not a replacement for evidence
- AEO scoring backed by analyzers when introduced

---

## Authoritative vs transitional (recon contract)

| Class | Examples | Authority |
|------|----------|-----------|
| Deterministic | `trust_analysis`, `density_analysis`, `authority_analysis`, `geo_analysis`, `market_state_interpretation`, `market_readiness`, `strategy_state` | **Operational truth** for recon’s modeled dimensions |
| Deterministic-derived assembly | e.g. market saturation score from `density_analysis.saturation_score` | **Authoritative** for that derived display |
| Legacy scorer rows | visual maturity, answerability where still tied to `scorers.py` | **Transitional** — tagged non-authoritative |
| Placeholder sections | strategy_recommendation, emotional, opportunity scaffolding | **Transitional** — explicit metadata |

---