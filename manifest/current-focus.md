# Current Focus

## Current Phase
Recon Intelligence Foundation

---

## Current Objective
Build the modular recon orchestration pipeline.

Current focus:
- engine.py orchestration scaffolding
- collectors.py stubs
- analyzers.py stubs
- scorers.py stubs
- assembler.py scaffolding
- report generation scaffolding

---

## Current Architectural Priorities
- preserve layered contracts
- preserve recon-first architecture
- preserve deterministic rendering separation
- preserve modular orchestration
- preserve intelligence-first design

---

## Important Constraints

Do NOT:
- rewrite Astro
- redesign frontend systems
- expand component libraries
- introduce rendering logic into intelligence systems
- couple readiness to rendering
- place business logic into orchestration layers

---

## Current Goal
Produce the first runnable recon pipeline capable of generating:
- recon.json
- markdown report

Using:
collect → analyze → score → assemble → report