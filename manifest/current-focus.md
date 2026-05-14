# Current Focus

## Current Phase
Deterministic recon intelligence (authoritative spine operational)

---

## Current Objective
Harden and document the **deterministic strategic intelligence stack** as the source of operational truth in recon, with placeholders and legacy scorers explicitly **transitional** and **non-authoritative**.

Current focus:
- **Analyzers** — trust, density, authority, geo (evidence-derived primitives; `intelligence/recon/analyzers/`)
- **Shared math** — `intelligence_math.py` (bounded, reusable determinism)
- **Interpreters** — cross-analyzer relationships (`market_state_interpretation`)
- **Readiness** — strategic preparedness composites (`market_readiness`)
- **Strategy-state** — deterministic posture/pressure primitives (`strategy_state`)
- **Assembler** — passthrough assembly, `authority_metadata` semantics, legacy sections flagged
- **Contract validation** — `contracts/recon.schema.json` remains the shape contract
- **Report** — downstream synopsis only; does not invent intelligence

---

## Current Architectural Priorities
- **Deterministic systems own truth** — analyzers → interpreters → readiness → strategy-state
- Layered contracts and recon-first ordering preserved
- **GPT (future)** explains or narrates **frozen** deterministic outputs; it does **not** invent market truth
- Placeholders and legacy scorer outputs remain **explicitly non-authoritative**
- Rendering stays downstream; no intelligence logic in Astro
- Modular orchestration; **no** business rules in `engine.py` beyond sequencing

---

## Important Constraints

Do NOT:
- rewrite Astro or frontend systems in this track
- expand component libraries as part of recon manifest work
- move deterministic logic into assemblers (passthrough only)
- treat legacy `scorers.py` outputs as authoritative market truth
- re-authorize placeholder strategy/UX/emotional scaffolding as strategic intelligence

---

## Current Goal
The runnable recon pipeline produces:
- **recon.json** — includes deterministic blocks (`trust_analysis`, `density_analysis`, `authority_analysis`, `geo_analysis`, `market_state_interpretation`, `market_readiness`, `strategy_state`) plus transitional/legacy fields **marked** via metadata where applicable
- **Markdown report** — synopsis; not a second source of truth

Runtime spine (orchestration):
`collect` → `analyze` (analyzers + interpreters + readiness + strategy-state) → **transitional** `score` → `assemble` → `validate` → artifact persistence → `report`

Under `intelligence/recon/`: collectors → analyzers → interpreters → readiness → strategy (strategy-state) → constrained synthesis **(future)** → rendering **(downstream, deterministic)**.
