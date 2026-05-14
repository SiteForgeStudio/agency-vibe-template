# Runtime Flow

## Recon runtime flow (current)

**Trigger:** CLI (`engine.py`), or future API / GitHub Action (same pipeline contract).

Semantic ordering — **deterministic intelligence first**, including deterministic **`synthesis_contract`** construction; **bounded governed synthesis** follows as an interpretive lane; **transitional scoring** remains explicitly non-authoritative; then assembly and outputs.

---

## Pipeline (authoritative spine + bounded synthesis + transitional + outputs)

| Stage | Module / concern | Role |
|-------|------------------|------|
| 1 | `collectors` | Acquire **evidence** (Places, probes, configured payload). No strategic inference. |
| 2 | **Analyzers** | Deterministic primitives per domain: trust, density, authority, geo (`analyzers/*`, `intelligence_math.py`). |
| 3 | **Interpreters** | Relationship semantics across analyzer outputs (`market_state_interpretation`). |
| 4 | **Readiness** | Strategic **preparedness** indices from analyzers + interpretation (`market_readiness`). |
| 5 | **Strategy-state** | Deterministic **posture / pressure** primitives (not recommendations) (`strategy_state`). |
| 6 | **`synthesis_contract`** | Deterministic bundle + confidence context — **authoritative shield** for what narratives may reference (no GPT on raw payloads). |
| 7 | **Governed synthesis (`market_narrative_synthesis`)** | Bounded explanatory narratives from **`synthesis_contract` only**. May emit suppression stubs without API credentials or on failure — **does not block** deterministic completion. |
| 8 | **Synthesis governance validation (`narrative_synthesis_governance`)** | Validates narrative behavior vs. fingerprints — drift, certainty posture, bounded claims; records suppress / downgrade semantics for interpretive authority **without** rewriting deterministic blocks. |
| 9 | **Transitional scorers** | `scorers.py` — legacy/placeholder **numeric signals** for UX/AEO stubs until replaced; **not** authoritative market truth. Assembly marks legacy `ScoreInsight` rows accordingly. |
| 10 | **Assembler** | Passthrough: fold deterministic payloads + bounded synthesis outputs + transitional sections; inject `authority_metadata` where required. |
| 11 | **Validation** | `contract_validation.py` — `contracts/recon.schema.json`. |
| 12 | **Persistence** | `artifact_writer.py` — recon artifacts to disk. |
| 13 | **Report synthesis** | `report_writer.md` — human-readable synopsis; **downstream**, non-authoritative vs. deterministic blocks. |

---

## Deterministic ordering inside analysis (`analyze`)

Inside **`analyze`** (`intelligence/recon/analyzers/__init__.py`), after evidence-backed primitives:

**strategy-state → `synthesis_contract` → governed synthesis (`market_narrative_synthesis`) → synthesis governance validation (`narrative_synthesis_governance`).**

Then the pipeline returns to **`engine.py`**: transitional **`score`** → **`assemble`** → **`validate`** → **persist** → **`report`**.

So the authoritative intelligence spine is:

**evidence → analyzers → interpreters → readiness → strategy-state → synthesis_contract → bounded synthesis → narrative governance validation**

…with **`score`** as an explicit **transitional** step **before** assembly.

---

## Code-level sequencing (`engine.py`)

`collect` → `analyze` → **`score`** (transitional) → `assemble` → `validate` → **persist** → `report`

---

## Outputs

- **recon.json** (assembled contract) — deterministic blocks are authoritative; bounded synthesis blocks are interpretive and governance-validated; placeholder strategy/UX/emotional/opportunity sections remain transitional and tagged.
- **report.md** — summary only.

---

## Operational guarantees

- **Synthesis is downstream from deterministic authority** — models never ingest raw collectors in place of `synthesis_contract`.
- **Governance validates synthesis behavior**, not deterministic truth — validators consume `synthesis_contract` + `market_narrative_synthesis` only.
- **Suppression does not break deterministic runtime integrity** — missing keys, provider errors, or governance escalation degrade narratives or interpretive authority flags while preserving analyzers, `synthesis_contract`, `recon.json` validity, and assembly.
- **Deterministic runtime remains operational without GPT availability** — operational intelligence completes; narratives fall back to bounded stubs where configured.

---

## Downstream rendering (unchanged contract)

Astro and site contracts remain strictly **downstream** and deterministic; GPT stays out of the default render path.
