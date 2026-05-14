# ADR-004: Deterministic Rendering Contracts

## Status
Accepted

## Context

Rendering must remain predictable, auditable, and free of unresolved inference at build time. Mixing intelligence outputs, narrative generation, or mutable AI state into static-site data caused instability in earlier page-builder-style systems.

The Factory’s long-term position: **Astro consumes only a normalized, deterministic render contract** (`site.json` in the layered-contract model). Upstream contracts may hold intelligence, placeholders, or transitional fields — but the **render path** must not invent business or market truth.

---

## Decision

1. **Rendering is downstream.** Intelligence pipelines (including recon’s deterministic stack) feed **earlier** contracts; they do not emit render-ready component trees by default.

2. **`site.json` is the only Astro-facing build contract** for static generation. It contains normalized, validated structures suitable for presentation — not raw recon blobs, not open-ended AI commentary.

3. **Deterministic rendering** means: given the same `site.json` (and assets), the build output is repeatable. Components stay presentation-focused; they avoid orchestration and **market inference**.

4. **Recon outputs (`recon.json`) are not globally render-safe.** They intentionally mix authoritative deterministic blocks with transitional scaffolding. That does **not** relax the rule that **final** render data is normalized elsewhere.

5. **GPT / synthesis (future)** may assist in explaining or formatting human-facing reports from **frozen** deterministic payloads — not in replacing `site.json` determinism or injecting strategy into render props.

---

## Consequences

### Benefits
- Clear boundary between “what we know operationally” and “what we ship to the template.”
- Safer refactors in intelligence layers without invalidating templates overnight.

### Tradeoffs
- Extra normalization stages between recon and Astro.
- Recon must be explicitly distilled before render — by design.

---

## Related Decisions

- ADR-001: Layered Contract Architecture
- ADR-003: Recon-First Architecture
- ADR-007: Deterministic Strategic Intelligence Stack
