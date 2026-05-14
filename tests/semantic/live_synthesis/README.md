# Live governed synthesis evaluation

Controlled infrastructure for exercising **bounded GPT narrative synthesis** against real models while preserving deterministic authority.

This subtree answers one question:

> Given a mature synthesis contract, does live synthesis remain **semantically trustworthy** — calibrated to confidence posture, grounded in fingerprint semantics, and enforceable by governance — without drifting into persuasion, prescriptions, or hype?

This is **not** prompt-engineering for compelling copy. Evaluations prioritize **semantic integrity**, **grounding fidelity**, and **governance gates**, not audience persuasion.

## Preconditions

Live tests **skip automatically** unless:

1. **`LIVE_SYNTHESIS_EVAL` is explicitly enabled** (`1`, `true`, `yes`, or `on`) — avoids accidental runs when a global shell profile exports `OPENAI_API_KEY`.
2. `OPENAI_API_KEY` is present in the environment.
3. The `openai` Python package is installed (see `intelligence/recon/requirements.txt`).

Deterministic posture suites under `tests/semantic/` deliberately strip API keys via autouse fixtures; **`live_synthesis/` is exempt** so credentials can reach synthesis calls when evaluation is intentionally enabled.

Run selectively:

```bash
export LIVE_SYNTHESIS_EVAL=1
export OPENAI_API_KEY=...
pytest tests/semantic/live_synthesis -v -m live_synthesis
```

Without both opt-in **and** a key, the suite skips cleanly — CI defaults remain deterministic-only.

## Architectural boundaries

- **Deterministic stages own operational truth** — analyzers through `synthesis_contract` remain authoritative inputs.
- **GPT narratives explain bundled truth** — consumption stays confined to `synthesis_contract`; collectors and placeholders stay excluded by construction.
- **Governance constrains interpretive authority** — validators flag drift and certainty abuse **without rewriting model prose**.
- **Failures downgrade interpretive credibility** — deterministic payloads and collector evidence remain intact for forensic review.

## Suite layout

| Path | Role |
|------|------|
| `fixtures/context.py` | Deterministic synthesis bundles (`sparse_weak`, `dominant_incumbent`) reused from semantic market fixtures. |
| `fixtures/lexicon.py` | Deterministic substring probes for cautious tone, consultancy drift, hype language, and grounding stems. |
| `test_live_narratives.py` | End-to-end synthesis smoke + lexical boundedness + grounding stem coverage on dominant fixtures. |
| `test_contract_semantics_ordering.py` *(under `tests/semantic/`)* | Purely deterministic ordering checks on synthesis summaries — runs without GPT or live gates. |
| `test_confidence_alignment.py` | Relates bundle confidence posture to cautious wording / posture divergence across sparse vs concentrated markets. |
| `test_governance_enforcement.py` | Baselines live output, then **injects deterministic poison strings** to prove suppression / escalation semantics. |
| `snapshots/` | Human-reviewed exemplars (approved narratives, suppression traces, posture audits) — advisory artifacts for regression conversations. |

## Evaluation dimensions

### Confidence tone calibration

Weak bundles must **not masquerade as high-certainty prose**. Tests compare sparse versus dominant fixtures: posture strings and cautious lexical density should reflect structural bundle differences within tolerant bands (GPT variance acknowledged).

### Governance enforcement

Poisoned narratives deliberately append:

- prescriptive / strategic directives  
- unsupported certainty / ROI exaggeration  
- forged confidence posture echoes versus contract recomputation  

Assertions prove detectors fire and **`validation_status` escalates** appropriately — validating behavioral integrity of governance code paths alongside live completions.

### Grounding fidelity

Dominant-incumbent narratives should repeatedly invoke stems aligned with fingerprint axes (authority concentration, competitiveness, saturation, readiness floors, pressure composites). Checks are **relational stem coverage**, not quotation of numeric literals.

### Semantic boundedness

Consultancy idioms, hype phrases, and visionary guarantees are scanned deterministically; violations should be rare on compliant prompts and are complemented by governance outputs.

### Snapshot review workflow

Populate `snapshots/examples/` with curated JSON excerpts after manual review cycles — attach scenario ids, posture tiers, governance codes, and truncated narrative excerpts for audit trails. Promotion to hashed regression belongs to future tooling (see semantic README backlog).

## Out of scope

- Autonomous agency framing or unconstrained tool use.
- Recommendation engines or persuasive optimization loops.
- Relaxing governance thresholds to chase fluent marketing tone.

Maintainers treat regressions here as **spec breaches**: tune prompts or coefficients upstream only when deterministic contracts change — never by weakening governance to silence alarms.
