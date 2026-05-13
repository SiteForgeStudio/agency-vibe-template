# Recon Intelligence System

# Purpose

The recon system is the intelligence entry point of the SiteForge Factory.

The system generates:
1. Human-readable market intelligence reports
2. Machine-readable intelligence contracts

The machine-readable intelligence is the PRIMARY operational output.

The markdown report is a downstream presentation layer.

---

# Operational Pipeline

collect →
analyze →
score →
assemble →
report

---

# Core Philosophy

The recon system is:
- intelligence-first
- strategy-oriented
- orchestration-friendly
- render-agnostic

The recon system is NOT:
- a website generator
- a rendering engine
- a frontend system

---

# Core Modules

| Module | Responsibility |
|---|---|
| engine.py | Pipeline orchestration |
| collectors.py | Raw data collection |
| analyzers.py | Intelligence analysis |
| scorers.py | Strategic scoring |
| assembler.py | recon.json assembly |
| report_writer.py | Human report generation |
| models.py | Shared data models |
| utils.py | Shared utility helpers |
| config.py | Operational configuration |

---

# Pipeline Stages

## 1. Collect
Gather:
- competitors
- websites
- metadata
- screenshots
- geo intelligence

Output:
raw intelligence objects

---

## 2. Analyze
Interpret:
- UX maturity
- emotional positioning
- AEO readiness
- trust structure
- opportunity gaps

Output:
structured intelligence

---

## 3. Score
Assign:
- opportunity scores
- trust scores
- saturation scores
- visual maturity scores

Output:
strategic scoring objects

---

## 4. Assemble
Normalize all intelligence into:
# recon.json

This must satisfy:
contracts/recon.schema.json

---

## 5. Report
Generate:
- human-readable markdown report
- executive summaries
- opportunity messaging

The report is downstream from intelligence.

---

# Important Rules

## Rule 1
The recon system must remain modular.

Avoid giant orchestration files.

---

## Rule 2
Prompts must remain externalized.

Store prompts in:
intelligence/recon/prompts/

---

## Rule 3
Scoring systems should remain deterministic where possible.

Avoid excessive AI randomness.

---

## Rule 4
The recon system should optimize for:
- strategic clarity
- opportunity detection
- orchestration quality

NOT:
- verbose reports
- filler content
- generic SEO output

---

## Rule 5
Recon intelligence should remain reusable across:
- intake
- strategy
- rendering
- lifecycle optimization

The recon system is foundational infrastructure.