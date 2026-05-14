# Snapshot artifacts — governed synthesis evaluation

Human-reviewed exemplars live here for **semantic posture regression**, not automated golden-byte equality.

Suggested contents:

| Pattern | Purpose |
|---------|---------|
| `approved/baseline_*.json` | Narrative excerpts + contract fingerprints + governance `accepted` — illustrates bounded observational tone. |
| `suppression/*.json` | Governance `suppressed_authority` rows linked to poisoning fixtures — proves downgrade semantics without rewriting GPT prose. |
| `confidence/*.json` | `confidence_language_posture` tiers beside lexical counters — calibration audits across releases. |

Filenames should encode scenario id + ISO date stamp when refreshed manually.

Automated tests consume **deterministic fixtures** under `tests/fixtures/markets/`; snapshots remain advisory unless promoted into hashed regression tooling described in `tests/semantic/live_synthesis/README.md`.
