# ADR-005: Strategic Readiness Model

## Status
Accepted (manifest philosophy; recon implementation synchronized)

## Context

Readiness was historically confused with checklist completion, schema fill, or component satisfaction. That pattern triggered premature builds, unstable rendering, and “fake” completeness.

The Factory’s **philosophy** remains: readiness is **strategic preparedness** — only proceed when the right *categories* of clarity exist (identity, positioning, trust, conversion, visual, etc.), not when arbitrary JSON fields are non-null.

Concurrently, the **recon pipeline** now implements a **narrower, rigorous slice** of that idea as **deterministic numeric readiness** over evidence-backed primitives.

---

## Decision

### 1. Product-level readiness (long-term)

The readiness **domains** in `manifest/readiness.md` (identity, positioning, offer, trust, conversion, visual, service, contact) remain the **conceptual** bar for “ready to build” in the full Factory — adaptive by archetype, not hardcoded by industry in the manifest.

### 2. Recon pipeline readiness (current)

`market_readiness` in `recon.json`:
- Consumes **only** analyzer outputs and `market_state_interpretation`.
- Emits bounded indices (e.g. trust_readiness, positioning_readiness, geo_readiness, differentiation_readiness) and a **confidence** aggregate.
- Is **not** field completion; it is **composable preparedness** for the dimensions modeled in recon.
- Does **not** emit strategy recommendations or prose.

### 3. Strategy-state is not readiness

`strategy_state` (posture / pressure primitives) is **separate**: it describes **operating conditions**, not “how complete” the dossier is. Readiness answers preparedness; strategy-state answers **pressure / mode** under current deterministic intelligence.

### 4. Placeholders stay non-authoritative

Until replaced by analyzers, legacy scorer-backed stubs and placeholder contract sections remain **explicitly transitional** (see assembly `authority_metadata`). They must not override deterministic blocks for operational truth.

---

## Consequences

### Benefits
- Single vocabulary: “readiness” = preparedness; implementation in recon is testable and bounded.
- Clear handoff: readiness + strategy-state + interpretation feed **future** constrained synthesis without collapsing layers.

### Tradeoffs
- Full product readiness is not yet unified with recon’s numeric bundle — explicit integration work remains.

---

## Related Decisions

- ADR-001: Layered Contract Architecture
- ADR-003: Recon-First Architecture
- ADR-007: Deterministic Strategic Intelligence Stack
