# SiteForge Operational Workflows

# Philosophy

SiteForge operates as:
# an intelligence-driven production pipeline.

The Factory lifecycle is:

Lead →
Recon →
Market Intelligence →
Paid Intake →
Strategy Assembly →
Build →
Quality Gates →
Preview →
Approval →
Deployment →
Lifecycle Updates

Each stage has:
- inputs
- outputs
- readiness conditions
- operational ownership

---

# Stage 1 — Lead Generation

## Purpose
Acquire and qualify potential clients through free market intelligence.

## Trigger
A user submits:
- niche
- city
- optional website URL

## Inputs
- niche
- location
- website URL (optional)

## Outputs
- lead record
- recon request
- pipeline status

## Operational Notes
The free recon report acts as:
- lead magnet
- authority builder
- strategic diagnostic

The recon itself is NOT the paid product.

---

# Stage 2 — Recon Intelligence (AMI)

## Purpose
Generate:
1. Human-readable strategic report
2. Machine-readable intelligence contracts

## Trigger
New recon request.

## Inputs
- niche
- target location
- optional website URL

## Processes
- competitor discovery
- hub/shoulder analysis
- website analysis
- UX analysis
- AEO analysis
- emotional positioning analysis
- opportunity analysis
- strategic scoring

## Outputs
- recon.json
- markdown report
- opportunity summary
- intake guidance

## Operational Notes
Recon is intelligence-first.

The markdown report is a presentation layer.
The structured intelligence is the true operational output.

---

# Stage 3 — Recon Delivery

## Purpose
Deliver strategic insights and encourage paid conversion.

## Trigger
Recon completion.

## Outputs
- client-facing report
- opportunity messaging
- intake unlock CTA

## Operational Notes
The report should:
- demonstrate expertise
- expose weaknesses
- create urgency
- establish authority

The report should NEVER expose:
- orchestration logic
- scoring systems
- proprietary intelligence systems

---

# Stage 4 — Paid Intake

## Purpose
Resolve strategic uncertainty and confirm business truth.

## Trigger
Client unlocks paid intake.

## Inputs
- recon.json
- client responses
- uploads
- approvals

## Processes
- strategic verification
- trust clarification
- offer clarification
- visual clarification
- conversion clarification

## Outputs
- client.json
- readiness state updates

## Operational Notes
Intake is NOT generic form filling.

Intake exists to:
- verify
- enrich
- confirm
- strengthen strategy

The system should ask ONLY for:
- unresolved strategic clarity
- missing readiness domains

---

# Stage 5 — Strategy Assembly

## Purpose
Transform intelligence into build decisions.

## Trigger
Strategic readiness thresholds reached.

## Inputs
- recon.json
- client.json
- readiness states

## Processes
- positioning assembly
- vibe selection
- trust strategy
- conversion strategy
- section prioritization
- emotional direction

## Outputs
- strategy.json

## Operational Notes
Strategy drives rendering.

Components never determine strategy.

---

# Stage 6 — Build Contract Assembly

## Purpose
Generate deterministic render-safe contracts.

## Trigger
strategy.json complete.

## Inputs
- recon.json
- client.json
- strategy.json

## Processes
- normalization
- schema assembly
- image preparation
- render-safe transformation

## Outputs
- site.json

## Operational Notes
site.json must contain:
- validated structures
- deterministic rendering data
- no AI reasoning
- no unresolved inference

---

# Stage 7 — Astro Rendering

## Purpose
Compile premium static websites.

## Trigger
site.json ready.

## Inputs
- site.json
- assets
- Astro components

## Processes
- static generation
- schema injection
- optimization
- image processing

## Outputs
- dist/
- preview artifact

## Operational Notes
Astro consumes ONLY site.json.

Components remain:
- presentation-focused
- deterministic
- intelligence-agnostic

---

# Stage 8 — Quality Gates

## Purpose
Prevent low-quality deployments.

## Trigger
Successful build.

## Processes
- Lighthouse testing
- schema validation
- accessibility validation
- link validation
- performance testing
- AEO validation

## Outputs
- pass/fail status
- quality reports

## Operational Notes
The Factory protects quality automatically.

Low-quality builds should fail.

---

# Stage 9 — Preview Deployment

## Purpose
Generate temporary client preview.

## Trigger
Quality gates pass.

## Outputs
- Netlify preview
- preview URL
- approval request

## Operational Notes
Preview deployments are temporary operational artifacts.

---

# Stage 10 — Client Approval

## Purpose
Finalize strategic direction before deployment.

## Trigger
Preview available.

## Inputs
- client revisions
- approvals

## Outputs
- approved build state

## Operational Notes
Client revisions should update:
- client.json
- strategy.json
- site.json

NOT raw frontend code.

---

# Stage 11 — Production Deployment

## Purpose
Deploy finalized static output.

## Trigger
Client approval.

## Outputs
- production deployment
- deployment history
- operational status updates

## Supported Targets
- Netlify
- Vercel
- GitHub Pages
- ZIP delivery

---

# Stage 12 — Lifecycle Updates (CWS)

## Purpose
Support long-term optimization and updates.

## Trigger
Client requests change.

## Processes
- structured updates
- rebuild triggers
- deployment refreshes

## Operational Notes
The client interacts with:
# the CWS (Client Workflow System)

NOT a traditional CMS.

The Factory maintains orchestration control.

---

# Operational State Philosophy

Every stage should eventually support:
- queue visibility
- progress visibility
- retry handling
- failure reporting
- audit history

GitHub Actions acts as:
# the orchestration engine.

GitHub becomes:
# the Factory memory layer.

---

# Long-Term Workflow Vision

Future workflows may include:
- AI-assisted optimization
- seasonal refreshes
- campaign generation
- local SEO refreshes
- AEO enhancement
- automated opportunity detection
- strategic growth recommendations

The Factory evolves toward:
# autonomous business presence infrastructure.