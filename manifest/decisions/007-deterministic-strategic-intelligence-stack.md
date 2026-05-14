# ADR-007: Deterministic Strategic Intelligence Stack (Recon)

## Status
Accepted

## Context

Recon evolved from stub orchestration into a **layered deterministic pipeline**: evidence-grounded analyzers, shared math, cross-analyzer interpreters, readiness composites, and strategy-state posture primitives. Legacy scorers and placeholder contract prose remained for transitional compatibility but must not hold **strategic authority** over market truth.

The architecture needed an explicit, documented **authority hierarchy** so future synthesis (e.g. constrained narration) **explains** frozen intelligence instead of **inventing** it.

---

## Decision

### Authoritative ordering (deterministic spine)

For recon market/operating-structure intelligence, truth flows in this order:

1. **Evidence** — collectors acquire structured inputs (e.g. Places, HTTP probe). No strategic prose.
2. **Analyzers** — deterministic primitives per domain (`trust_analysis`, `density_analysis`, `authority_analysis`, `geo_analysis`).
3. **Shared math** — `intelligence_math.py` for reusable bounded operations (concentration, entropy, confidence harmonization, etc.).
4. **Interpreters** — relationships *between* analyzer outputs (`market_state_interpretation`).
5. **Readiness** — strategic **preparedness** indices (`market_readiness`).
6. **Strategy-state** — deterministic **posture / pressure** primitives (`strategy_state`); **not** recommendations.
7. **Transitional scorers** — `scorers.py` remains for legacy stub signals where not yet replaced; assembly marks such `ScoreInsight` rows **non-authoritative** where applicable.
8. **Assembler** — passthrough composition of `recon.json`; injects **authority metadata** for placeholder sections; elevates deterministic blocks structurally.
9. **Validation** — JSON Schema for contract shape.
10. **Persistence & report** — artifacts on disk; markdown report is synopsis-only.

### Non-goals (explicit)

- **GPT** does not replace analyzers or invent market facts in this stack.
- **Placeholders** are not elevated to authoritative strategy.
- **Rendering** does not consume raw recon as the final render contract (`site.json` remains downstream).

### Constrained synthesis (future slot)

A later layer may consume **only** finalized deterministic payloads to produce human-readable or client-facing narratives — under constraints that preserve **separation of truth and explanation**.

---

## Consequences

### Benefits
- Operational clarity: engineers and orchestrators know which JSON blocks are “truth” vs transitional.
- Safer evolution: new analyzers extend the spine without rewriting assembly philosophy.

### Tradeoffs
- Duplicate-looking numbers (e.g. saturation in density vs market_saturation score) require consumers to read **metadata** and field definitions.
- Legacy scorers persist until each stub is swapped for a deterministic overlay.

---

## Related Decisions

- ADR-001: Layered Contract Architecture
- ADR-002: Python Intelligence Layer
- ADR-003: Recon-First Architecture
- ADR-004: Deterministic Rendering
- ADR-005: Strategic Readiness Model
- ADR-006: Multimodal Recon Intelligence
