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
| Intelligence Layer | Deterministic market intelligence + bounded governed synthesis (interpretive) |
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

**Bounded synthesis (optional runtime narrative infrastructure):** Models consume **`synthesis_contract` only** — a deterministic bundle that shields raw collectors and upstream payloads. Narratives are **explanatory** and **interpretive**, governed by **`narrative_synthesis_governance`**. They **do not** invent market facts, operational posture, or strategy authority. When credentials or providers are unavailable, synthesis emits **explicit suppression stubs**; deterministic analyzers and `synthesis_contract` semantics remain authoritative and intact.

Primary outputs (recon stage):
- `recon.json` (layered contract; deterministic blocks authoritative)
- `synthesis_contract`, `market_narrative_synthesis`, `narrative_synthesis_governance` — bounded interpretive lane + validators (non-authoritative narrative layer)
- intake guidance echoes (transitional where noted)

This intelligence layer segment is **not** render-safe by itself; downstream `site.json` remains the render-safe contract.

---

# Semantic Governance Layer

Semantic governance sits **downstream** of deterministic intelligence and **wraps** bounded synthesis — it does not replace analyzers, interpreters, readiness, or strategy-state.

**What it covers:**
- **Bounded synthesis** — narrative generation constrained to `synthesis_contract` consumption scope; no raw-collector ingestion by GPT paths.
- **Synthesis governance validation** — `validate_market_narrative_governance` evaluates drift, certainty abuse, posture echoes, and interpretive scope against deterministic fingerprints (`synthesis_contract` + `market_narrative_synthesis`).
- **Authority suppression / downgrades** — governance outcomes may flag or suppress interpretive authority **without** mutating deterministic payloads or breaking assembly contracts (stub narratives remain schema-stable).
- **Semantic lineage** — deterministic lineage metadata echoed into narratives preserves provenance boundaries between frozen bundles and interpretive text.
- **Grounding references** — narratives carry explicit deterministic summary keys (`deterministic_grounding_references`) tying prose posture back to bundled fingerprints.
- **Contamination containment** — probe suppression/downgrade semantics upstream reduce verbatim ingestion risk; synthesis governance catches narrative contamination classes downstream.
- **Deterministic authority preservation** — operational truth continues to flow from analyzers → interpretation → readiness → strategy-state → **`synthesis_contract`**. GPT synthesis is never the truth owner.

**GPT synthesis is:**
- explanatory
- interpretive
- governed
- optional runtime infrastructure (may suppress when providers or keys are absent)

**GPT synthesis is not:**
- operational truth
- strategy authority
- orchestration authority

**Deterministic intelligence remains operational** when synthesis is inactive, failing, or suppressed — contracts stay valid; narratives degrade to bounded stubs rather than inventing intelligence.

**Contracts (recon intelligence lane):**
- `synthesis_contract` — deterministic authoritative bundle for downstream narrative consumption only.
- `market_narrative_synthesis` — interpretive quartet + lineage echo + grounding references + GPT meta (may record suppression).
- `narrative_synthesis_governance` — validation record over synthesis behavior (confidence proportionality signals, bounded claims checks, drift detectors).

Semantic governance protects **confidence proportionality**, **bounded claims**, **contamination resistance**, **narrative scope**, and **grounding fidelity** — without reframing SiteForge as “agentic” strategy automation.

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
- deterministic `synthesis_contract`, bounded narrative synthesis, and narrative governance validation (interpretive lane — not operational truth)
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
- tighten semantic regression coverage for synthesis governance and confidence propagation (bounded narratives remain downstream-only)

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
| Deterministic synthesis bundle | `synthesis_contract` | **Authoritative frozen bundle** for **what narratives may reference** — not narrative prose itself |
| Bounded synthesis outputs | `market_narrative_synthesis` | **Interpretive / non-authoritative** — explanatory layer only |
| Synthesis governance record | `narrative_synthesis_governance` | **Behavioral audit / enforcement metadata** over narratives — does not elevate GPT to operational truth |
| Deterministic-derived assembly | e.g. market saturation score from `density_analysis.saturation_score` | **Authoritative** for that derived display |
| Legacy scorer rows | visual maturity, answerability where still tied to `scorers.py` | **Transitional** — tagged non-authoritative |
| Placeholder sections | strategy_recommendation, emotional, opportunity scaffolding | **Transitional** — explicit metadata |

---