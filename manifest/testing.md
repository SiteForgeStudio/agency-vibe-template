# Testing & Semantic QA

Architecture-facing reference for how SiteForge validates intelligence behavior — recon-first, deterministic-authoritative, render-safe downstream.

---

# Testing Philosophy

**Behavioral integrity matters more than “runtime succeeded.”**

A passing pipeline run proves sequencing and artifacts exist; **semantic tests** prove posture, governance, and bounded synthesis behave correctly under realistic and adversarial conditions.

The testing stack validates:

- **Semantic robustness** — relationships between primitives stay coherent under varied bundles.
- **Confidence realism** — weak bundles cannot masquerade as high-certainty posture without detectors firing.
- **Governance integrity** — constrained narratives respect interpretive boundaries.
- **Contamination resistance** — suppressed or downgraded probes do not leak verbatim operational semantics into authoritative lanes.
- **Bounded synthesis behavior** — explanatory prose stays scoped to deterministic fingerprints.

---

## Three-layer testing model

| Layer | Location | Purpose |
| ----- | ---------- | ------- |
| Deterministic tests | `tests/` (non-semantic suites) | Validate **authoritative** analyzers, math, interpreters, readiness, strategy-state, assembly invariants. |
| Semantic posture tests | `tests/semantic/` | Validate **behavioral invariants** — posture ordering, suppression semantics, confidence propagation, governance records relative to deterministic contracts. |
| Live synthesis tests | `tests/semantic/live_synthesis/` | Validate **governed GPT behavior** under explicit opt-in — tone calibration vs. bundle posture, grounding fidelity probes, governance escalation when narratives are poisoned in tests. |

Deterministic suites strip API keys by default so CI stays reproducible; **`live_synthesis/` is exempt** only when evaluation is intentionally enabled (see below).

---

## `tests/semantic/`

Semantic posture tests are **not** shallow unit checks on single functions.

They validate:

- **Semantic invariants** — derived interpretations stay inside structural realities established by analyzers.
- **Posture relationships** — inequalities and ordering across bundles (e.g. openness vs. concentration narratives).
- **Confidence proportionality** — synthesis_contract confidence context aligns with allowed narrative posture bands.
- **Authority preservation** — interpretive lanes cannot elevate themselves over deterministic payloads in contract semantics.

---

# Semantic Invariants

Examples (non-exhaustive; assertions evolve with contracts):

- Weak structural confidence cannot justify **strong synthesis certainty** without governance friction.
- **Suppressed probes** cannot contaminate authoritative narrative posture — scaffolding and synthesis consumption scopes remain gated.
- **Openness signals** cannot exceed **authority concentration realities** encoded in deterministic summaries without contradiction detectors noticing drift classes tests cover.
- **Readiness narratives** cannot exceed **structural confidence realism** carried on `synthesis_contract`.
- **Synthesis prose** cannot exceed **deterministic authority** — operational truth remains on analyzers through `synthesis_contract`; GPT explains only packaged fingerprints.

---

# Live Synthesis Evaluation

Harness location: **`tests/semantic/live_synthesis/`**.

**Gating:**

- **`OPENAI_API_KEY`** — required when exercising live completions (never assumed in default CI).
- **`LIVE_SYNTHESIS_EVAL`** — explicit opt-in (`1`, `true`, `yes`, or `on`) so incidental key exports do not flip CI into live calls.
- **`openai`** Python package — installed per `intelligence/recon/requirements.txt`; absent package prevents live completions.

Without opt-in **and** credentials, live tests **skip** — deterministic CI stays authoritative.

**Behavior:**

- Bounded synthesis remains **optional runtime infrastructure** — suppression stubs keep contracts shape-stable without GPT.
- **Snapshot philosophy** — curated exemplars for audit trails and regression dialogue; not automated persuasion QA.
- **Governance validation** and **confidence tone calibration** are exercised against deterministic bundles — proving detectors fire under adversarial injections as well as compliant paths.

**Intent:** evaluate **semantic trustworthiness**, **not** persuasive copy quality.

---

## Relationship to manifests

- **`architecture.md`** — semantic governance layer and contract authority boundaries.
- **`runtime-flow.md`** — ordering of `synthesis_contract`, bounded synthesis, and governance validation inside analysis.
