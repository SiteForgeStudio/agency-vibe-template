# Runtime Flow

## Recon runtime flow (current)

**Trigger:** CLI (`engine.py`), or future API / GitHub Action (same pipeline contract).

Semantic ordering — **deterministic intelligence first**, then transitional scoring, then assembly and outputs.

---

## Pipeline (authoritative spine + transitional + outputs)

| Stage | Module / concern | Role |
|-------|------------------|------|
| 1 | `collectors` | Acquire **evidence** (Places, probes, configured payload). No strategic inference. |
| 2 | **Analyzers** | Deterministic primitives per domain: trust, density, authority, geo (`analyzers/*`, `intelligence_math.py`). |
| 3 | **Interpreters** | Relationship semantics across analyzer outputs (`market_state_interpretation`). |
| 4 | **Readiness** | Strategic **preparedness** indices from analyzers + interpretation (`market_readiness`). |
| 5 | **Strategy-state** | Deterministic **posture / pressure** primitives (not recommendations) (`strategy_state`). |
| 6 | **Transitional scorers** | `scorers.py` — legacy/placeholder **numeric signals** for UX/AEO stubs until replaced; **not** authoritative market truth. Assembly marks legacy `ScoreInsight` rows accordingly. |
| 7 | **Assembler** | Passthrough: fold deterministic payloads + transitional sections; inject `authority_metadata` where required. |
| 8 | **Validation** | `contract_validation.py` — `contracts/recon.schema.json`. |
| 9 | **Persistence** | `artifact_writer.py` — recon artifacts to disk. |
| 10 | **Report synthesis** | `report_writer.md` — human-readable synopsis; **downstream**, non-authoritative vs. deterministic blocks. |

---

## Code-level sequencing (`engine.py`)

`collect` → `analyze` → **`score`** (transitional) → `assemble` → `validate` → **persist** → `report`

Inside **`analyze`** (`intelligence/recon/analyzers/__init__.py`), the deterministic chain runs in order:

analyzers → interpreter (`interpret_market_state`) → readiness (`evaluate_market_readiness`) → strategy-state (`evaluate_strategy_state`).

So: **evidence → analyzers → interpreters → readiness → strategy_state** is the authoritative intelligence order; **`score`** is an explicit **transitional** step before assembly.

---

## Outputs

- **recon.json** (assembled contract) — deterministic blocks are authoritative; placeholder strategy/UX/emotional/opportunity sections are transitional and tagged.
- **report.md** — summary only.

---

## Future (explicit, not implemented in runtime yet)

- **Constrained synthesis** — optional layer that uses frozen deterministic payloads as **inputs only**; must not substitute for evidence or analyzers.
- **Rendering** — Astro and site contracts remain strictly **downstream** and deterministic; no GPT in the render path by default.
