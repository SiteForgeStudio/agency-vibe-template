# SiteForge Factory — Intake & Preflight Manifest **v2.2** (April 2026)

Use this file as the **handoff anchor** for architecture, constraints, and phase order. Implementation details live in code and in `docs/PREFLIGHT_OUTPUT_SPEC_V1.md` (preflight → intake handoff shape).

---

## Core principle (locked)

SiteForge is **not** a form builder, a chatbot, or a template generator.

It is a **controlled AI system** that extracts structured business intelligence through a consultative experience and produces a **schema-valid** `business.json` (via the live blueprint / draft pipeline).

---

## System architecture (locked)

```
Preflight (intelligence; not conversational state machine)
    ↓
intake-start-v2.js  (blueprint + fact seed from preflight)
    ↓
intake-next-v2.js   (controlled refinement engine; endpoint bills as v2.1)
    ↓
intake-complete / readiness gates
    ↓
submit → GitHub → Astro → Netlify preview
```

**Code references:** `apps/intake/functions/api/intake-start-v2.js`, `apps/intake/functions/api/intake-next-v2.js`.

---

## Design principle (critical)

| Layer | Owner | Role |
|--------|--------|------|
| **What to ask** | Blueprint / planner | `question_plan`, bundles, `primary_field` |
| **What to update** | Blueprint + router | `fact_registry`, draft sync |
| **How to ask (wording)** | AI (renderer) | Single-field question copy |
| **Tone / UX polish** | AI + optional layers | Consultative voice; non-owning add-ons |

**Rule of thumb:** *Structure is deterministic; experience is adaptive.*

---

## Preflight system

**Role:** Intelligence generation (not end-user interaction). Not a conversational product and not driven as an intake-style state machine.

**Typical pipeline (conceptual):** `preflight-start` → recon → GBP → preview → optional status polling.  
**Runner:** `scripts/preflight-runner/` — mirrors steps, logs under `scripts/preflight-runner/preflight-logs/`, supports local/prod and timing.

**Required strategic output** (see spec for exact shape): business understanding, opportunity, website direction, recommended focus/sections, FAQ/AEO angles, Google presence insight, etc.

**Competitive intelligence** (evolving): e.g. differentiation signals, local alternatives, buyer factors — consumed by intake via `state.preflight_intelligence` (see `docs/PREFLIGHT_OUTPUT_SPEC_V1.md`).

**Known weakness:** GBP entity resolution can false-negative (`not_found`); treat as active risk, not a reason to loosen intake contracts.

---

## Intake v2.1 — controlled engine

**Role:** AI behaves as **consultant phrasing**, not as the **owner of structure**.

- **Code** enforces bundles, `primary_field`, validation, and progression.
- **AI** improves question wording within strict scope and interprets answers into safe fact updates.

---

## Blueprint system (locked)

**Source of truth for “what we’re asking this turn”:**  
`blueprint.question_plan` (including `bundle_id`, `primary_field`, `target_fields`).

Facts live in `blueprint.fact_registry`; the partial site shape lives in `business_draft` and is synced from evidence in code.

---

## Primary field contract (non-negotiable)

1. **`primary_field` defines intent** for the turn.
2. **The rendered question MUST target only that field** (no multi-topic prompts).
3. **Interpretation MUST prioritize updating that field**; the router enforces capture when the model omits it.
4. **`fact_registry[primary_field]` must reach satisfaction** before the planner advances (see `isFieldSatisfied` / bundle rules). Secondary updates may occur but **do not drive progression**.

**Planner stickiness:** Do not advance to the next `primary_field` until the current one is satisfied.

---

## Renderer system (critical)

**Architecture:** `LLM → validation → fallback → deterministic copy`

- **One question = one field** (`primary_field` only).
- **No bundle leakage** (e.g. don’t mix pricing and booking channel in one prompt).
- **Guards:** `violatesPrimaryFieldQuestionScope()`, `isOverloadedQuestion()`, repetition checks.
- **On violation:** discard LLM output, use deterministic question — **intelligence is controlled, not free-form.**

---

## Interpretation

- **Primary field update is mandatory** for progression; enforcement fills the slot when needed.
- **Broad capture is allowed:** one user message may update multiple facts; only **primary field satisfaction** gates progression.

---

## Preflight → intake bridge (non-owning)

- **`state.preflight_intelligence`** is seeded at start (`intake-start-v2.js`) from strategy/recon/spec-aligned fields.
- **Question rendering** may inject a short **preflight bridge** hint into the renderer payload so wording feels informed — **without** breaking the single-field contract.

---

## Reinforcement (non-owning)

- **Post-interpretation only:** optional short alignment line when user answer matches preflight signals (deterministic match; **no** planner/renderer ownership).
- **Observability:** `turn_debug.reinforcement_*` — must stay non-blocking for progression.

---

## Observability — `state.turn_debug` (every turn)

Minimum fields emitted today:

| Field | Purpose |
|--------|---------|
| `answered_primary_field` | Previous turn’s `primary_field` |
| `primary_satisfied_after_answer` | Satisfaction of that field after routing |
| `next_primary_field` | Planned next primary |
| `next_bundle_id` | Planned bundle |
| `updated_fact_keys` | Facts written this turn (primary path) |
| `secondary_updated_keys` | Secondary captures |
| `primary_field_updated` | Whether primary slot received an update |
| `llm_available` | API configured |
| `question_source` | `llm` \| `deterministic` \| `complete` \| `intake_complete` |
| `fallback_triggered` | Used deterministic path after LLM |
| `fallback_reason` | `scope_violation` \| `repetition` \| `parse_error` \| `empty_response` \| `api_error` \| `timeout` \| null |
| `preflight_bridge_framing` | Bridge text passed to renderer (if any) |
| `reinforcement_triggered` | Alignment line added |
| `reinforcement_type` | e.g. `alignment` when fired |
| `reinforcement_source` | Which preflight signal matched |

**KPI — fallback rate (per session or rolling):**

`fallback_rate = (# turns with fallback_triggered && llm_available) / (# turns where llm_available)`

| Rate | Meaning |
|------|--------|
| &lt; 10% | Healthy |
| 10–30% | Tune prompts / scope guards |
| &gt; 30% | Treat as system issue |

**Integrity triangle (when something drifts):** primary field contract → renderer scope → fallback rate.

---

## Readiness model (locked concept)

- **Minimum preview:** hero, features, contact path, CTA — as defined by strategy toggles and conversion gates in code.
- **Premium ready:** only **enabled** components count toward “premium” signals (proof, visuals, process, story, geo, etc.).
- **Rule:** Disabled components do not inflate readiness.

---

## Gallery & contact

- **Gallery:** must be able to produce image search/query and computed layout/count from evidence (see draft sync in engine).
- **Contact:** `booking_method`, CTA, `contact_path`, and `booking_url` must stay **consistent** (including explicit “no public booking URL” / manual flows — engine uses sentinel values and satisfaction rules).

---

## Testing

- **Intake:** `scripts/intake-runner/` — scripted or interactive session, logs state and `turn_debug`.
- **Preflight:** `scripts/preflight-runner/` — pipeline steps and structured logs.

**Future:** assertion-based regression, session replay.

---

## Client experience

- **Feels** conversational (ChatGPT-like), **behaves** as a guided, schema-backed engine.
- **Never** expose raw schema keys or internal field names to end users in copy.

---

## Current status (honest)

**Stable:** Blueprint/planner control, primary field contract, renderer validation + fallback, interpretation enforcement with active-field capture, `recomputeBlueprint` planning on fresh candidates, intake/preflight runners.

**Monitor:** `fallback_rate`, scope violations, repetition stalls, GBP/preflight depth.

**Weak areas:** GBP reliability, preflight depth, competitive gap surfacing (productized), copy variance under fallback.

---

## Phases (order matters)

1. **Engine hardening (current):** stabilize fallback rate, reduce scope violations, **no loop regressions** on conversion fields (`booking_url`, etc.).
2. **Intelligence tuning:** LLM phrasing quality, fewer fallbacks, tone.
3. **Preflight expansion:** richer competitive intelligence, gaps, patterns.
4. **Consultative AI:** surface opportunities, reinforce positioning (on top of non-owning reinforcement).
5. **Premium output:** hero/copy/narrative quality.
6. **Client UX:** UI polish, answer refinement loops, preview iteration.

---

## Hard rules (reinforced)

- No multi-field questions.
- No AI-owned field selection (planner + contract own progression).
- No industry hardcoding for logic.
- No “patch the symptom” without fixing contract/renderer/observability.
- Blueprint + `primary_field` remain source of truth for turn intent.
- **Determinism before intelligence; observability before tuning.**

---

## End state

A system that **thinks like a strategist** (within guardrails) and **executes like an engine**: valid structure, measurable behavior, consultative surface.

---

## New chat handoff line

> We’re building SiteForge Factory per **`manifest.md` v2.2** (blueprint + planner + controlled renderer). Next task: [describe]. Check primary field contract, renderer scope, and `turn_debug` / fallback rate if behavior looks wrong.
