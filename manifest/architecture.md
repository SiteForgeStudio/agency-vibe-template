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

Primary technologies:
- Python
- OpenAI API
- GitHub Actions

Responsibilities:
- competitor analysis
- website analysis
- UX analysis
- emotional analysis
- AEO analysis
- scoring systems
- opportunity analysis
- strategic recommendations

Primary outputs:
- recon.json
- intake guidance
- strategy recommendations

This layer is NOT render-safe.

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

## Python Is The Intelligence Brain
Python owns:
- analysis
- scoring
- clustering
- intelligence pipelines
- orchestration logic

Cloudflare owns:
- UX
- interaction
- intake APIs
- streaming
- uploads

---

# Future Architecture Goals

Future expansion areas:
- screenshot analysis
- visual scoring
- embeddings
- semantic clustering
- AI-assisted lifecycle optimization
- AEO scoring systems
- autonomous optimization recommendations