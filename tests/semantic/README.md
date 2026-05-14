# Semantic Testing — Specification Infrastructure

This directory hosts **semantic posture tests** for SiteForge recon intelligence. The suite is **architecture specification infrastructure**: it encodes how the deterministic stack must behave under stress, how interpretive synthesis stays bounded, and how governance preserves authority boundaries.

This is **not** a conventional QA checklist focused on happy-path runtime success.

# Purpose of Semantic Testing

These tests validate:

- **Semantic robustness** — composites and downstream semantics remain coherent under adversarial-shaped fixtures (thin evidence, concentrated incumbents, misleading fragmentation, contradictory signals).
- **Confidence realism** — propagated confidence reflects weak lanes, bottlenecks, and structural disagreement rather than flattening toward uniform averages.
- **Authority preservation** — deterministic primitives and contracts remain the source of operational truth; interpretive layers cannot elevate themselves to authoritative status.
- **Contamination resistance** — irrelevant collector artifacts (e.g., orthogonal homepage probes) do not leak into placeholders or narratives at semantic authority levels appropriate for governance.
- **Governance integrity** — bounded GPT outputs and posture echoes are checked against deterministic constraints without rewriting model prose.
- **Bounded synthesis behavior** — narratives stay explanatory and descriptive; prescriptive drift, unsupported certainty, and scope violations are detectable and gateable downstream.

The suite is **not** focused on:

- Runtime success alone (e.g., “no exceptions”).
- Isolated unit assertions divorced from cross-layer posture.
- Exact numeric snapshots as golden masters.
- Brittle fixed thresholds treated as sacred constants — thresholds express **relational expectations** and posture bands; they are tuned deliberately and documented alongside scenarios.

The goal is **behavioral integrity** across the full deterministic intelligence stack and its governed interpretive annex.

# Current Architecture Context

End-to-end recon semantics flow:

```text
evidence
  → analyzers
  → interpreters
  → readiness
  → strategy_state
  → synthesis_contract
  → bounded GPT synthesis
  → semantic governance
```

Clarifications:

- **Deterministic systems own truth.** Analyzers, interpreters, readiness, strategy posture, and the synthesis contract distill authoritative numeric and structural semantics for downstream consumption.
- **Synthesis explains truth.** GPT-backed narratives consume only the shielded bundle (`synthesis_contract`); they interpret and narrate; they do not invent operational facts or override deterministic outputs.
- **Governance constrains synthesis.** Validation inspects narratives against contract-derived posture and policy; it may suppress or downgrade **interpretive authority** without mutating deterministic payloads or rewriting narrative strings.
- **Placeholders are non-authoritative.** Scaffolding prose in assembled sections is explicitly bounded; probe relevance validation further prevents irrelevant probe text from riding placeholder channels when posture demands suppression or downgrade.
- **Validation infrastructure protects semantic integrity.** Probe relevance and narrative governance are deterministic, inspectable guards — not probabilistic inference layers.

# Semantic Invariants

The suite encodes **invariants as relationships and posture**, not as single magic numbers. Representative examples:

- **Weak aggregate confidence cannot present as strong synthesis certainty.** Bundle min/mean semantics and language posture tiers must align; coercing an authoritative-sounding posture against a weak bundle triggers governance escalation (e.g., posture echo mismatch).
- **Suppressed probes cannot contaminate narratives or positioning scaffolding.** Evidence may remain on the payload for observability; semantic authority over placeholders and excerpts must respect suppression posture.
- **Openness cannot ignore authority concentration realities.** Under incumbent-heavy fixtures, interpreted openness and competitive posture stay tethered to concentration-backed signals rather than floating independently.
- **Readiness cannot exceed structural confidence realism.** Propagation intentionally dampens downstream certainty when geo or analyzer lanes are weak relative to structural gates.
- **Synthesis cannot exceed deterministic authority.** The contract bundle defines what narratives may reflect; governance asserts grounding keys, metadata echoes, and tone gates against that ceiling.
- **Narratives remain interpretive, not prescriptive.** Governance detectors flag prescriptive drift and unsupported certainty patterns deterministically.
- **Governance may suppress synthesis authority without breaking deterministic runtime integrity.** Deterministic stages continue to emit stable shapes; gates attach metadata for downstream consumers.

Tests validate **relationships and posture behavior** — inequalities, ordering, suppression actions, absence of forbidden leakage — rather than enforcing exact numeric outputs as law.

# Scenario Philosophy

Fixtures under `tests/fixtures/markets/` exist to stress **semantic topology** and **governance behavior**:

| Scenario class | Intent |
|----------------|--------|
| **Sparse / weak markets** | Thin listings, weak reviews, inconsistent categories — drives low operational confidence and softened synthesis posture expectations. |
| **Dominant incumbents** | Concentrated review mass and compressed openness — raises authority pressure and entry difficulty rails without pretending uncertainty vanished. |
| **False fragmentation traps** | Many listings with extreme top-heavy review share — entropy may suggest breadth while openness and pressure reflect incumbent gravity. |
| **Contradictory trust signals** | High ratings with low aggregate volume — caps trust and bundle confidence despite superficial “quality.” |
| **Probe contamination attacks** | Mega-brand or orthogonal probes vs niche pipeline — demands suppression/downgrade without deleting collector evidence. |
| **Geo weakness** | Strong Places-derived trust/density signals without geo scaffolding — validates downstream damping via deterministic propagation semantics. |

Together these scenarios probe **how meaning propagates**, not merely whether functions return.

# Confidence Semantics

- **Propagation is deterministic.** Weighted blends, bottleneck coupling toward weak lanes, geo-relative damping, and dispersion-aware strategy confidence are implemented as fixed coefficients — inspectable in `intelligence/recon/confidence/propagation.py`.
- **Bottlenecks constrain downstream certainty.** Weakest credible lanes pull aggregated confidence downward relative to naive averaging — reducing semantic flattening.
- **Layer disagreement reduces strategic confidence.** Dispersion penalties reflect structural inconsistency across stacked confidence inputs without invoking Bayesian machinery.
- **Weak geo certainty damps downstream posture.** Geo weakness scenarios validate that readiness and synthesis-facing aggregates reflect operational geo envelope limits.
- **Confidence is operational, not probabilistic.** Values encode coverage, completeness, and structural coherence of deterministic computations — not posterior probabilities.

# Governance Philosophy

- **Synthesis validation does not rewrite prose.** Governance emits flags, statuses, severity, and optional suppression reasons; it does not patch GPT strings in place.
- **Governance suppresses or downgrades interpretive authority.** Consumers treat `validation_status` and related fields as gates; deterministic contracts remain unchanged.
- **Deterministic authority stays primary.** Echo mismatches against `synthesis_contract` (e.g., confidence posture or authority metadata) are integrity violations relative to bundle truth.
- **GPT outputs are downstream interpretive artifacts.** They carry banners and lineage echoes marking non-authoritative scope.
- **Semantic lineage and grounding references are required policy hooks.** Governance asserts grounding key validity relative to deterministic fingerprint vocabularies where applicable.

# Contamination Protection

- **Probe validation shields downstream semantics.** Deterministic relevance posture (`retain` / `downgrade` / `suppress`) routes placeholder behavior without destroying collector evidence.
- **Semantic authority may be downgraded without deleting evidence.** Payloads remain observable; only narrative and placeholder **authority** conform to posture.
- **Collector truth remains observable.** Suppression is semantic governance over interpretation channels, not evidence deletion.
- **Irrelevant probes must not leak into placeholders or narratives** when posture demands it — validated end-to-end where assembly exposes website intelligence and narrative bundles.

# Future Testing Direction

Reasonable extensions (non-binding backlog):

- **Narrative snapshot testing** — stable hashed or canonicalized excerpts for regression when stubs give way to constrained live synthesis in CI.
- **Regression posture testing** — track bounded posture vectors over time as coefficients evolve.
- **Adversarial synthesis expansion** — additional lexical and structural probes as governance rules mature.
- **Confidence calibration tuning** — scenario-backed tuning loops with explicit changelog discipline for propagation constants.
- **Geo topology stress** — richer hub/shoulder matrices and boundary locales without adding probabilistic geo models.
- **Synthesis governance hardening** — deeper grounding alignment checks against fingerprint semantics where safely deterministic.

# Running the Suite

From repository root (example):

```bash
python3 -m venv .venv
.venv/bin/pip install -r tests/requirements.txt
.venv/bin/pytest tests/semantic -v
```

Live OpenAI calls are intentionally suppressed in semantic tests via fixtures so posture remains reproducible; deterministic stubs still exercise governance paths.

## Live governed synthesis (optional)

See [`live_synthesis/README.md`](live_synthesis/README.md): bounded GPT evaluation runs **only** when `LIVE_SYNTHESIS_EVAL=1`, `OPENAI_API_KEY` is set, and `openai` is installed (`pytest tests/semantic/live_synthesis -m live_synthesis`).
