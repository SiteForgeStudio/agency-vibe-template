"""
SiteForge Recon Engine

Primary orchestration entry point for the recon intelligence pipeline.

Pipeline:
collect -> analyze -> score -> assemble -> report

Responsibilities:
- orchestration
- pipeline sequencing
- error handling
- execution flow
- output coordination

This module should remain orchestration-focused.
Heavy business logic belongs in specialized modules.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass

from intelligence.recon.artifact_writer import write_recon_run_artifacts
from intelligence.recon.contract_validation import ContractValidationError, validate_recon_contract
from intelligence.recon.assembler import assemble
from intelligence.recon.collectors import collect
from intelligence.recon.analyzers import analyze
from intelligence.recon.config import ReconPipelineConfig
from intelligence.recon.models import ReconContract
from intelligence.recon.report_writer import write_report
from intelligence.recon.scorers import score


@dataclass(frozen=True, slots=True)
class ReconPipelineResult:
    """End-to-end output bundle for a recon run."""

    contract: ReconContract
    report_markdown: str


def run_recon_pipeline(config: ReconPipelineConfig | None = None) -> ReconPipelineResult:
    """Execute collect → analyze → score → assemble → report with placeholders."""
    cfg = config or ReconPipelineConfig()
    collected = collect(cfg)
    analyzed = analyze(collected)
    scored = score(analyzed)
    contract = assemble(collected=collected, analyzed=analyzed, scored=scored, config=cfg)
    report_md = write_report(contract)
    return ReconPipelineResult(contract=contract, report_markdown=report_md)


def main() -> None:
    cfg = ReconPipelineConfig()
    outcome = run_recon_pipeline(cfg)
    try:
        validate_recon_contract(dict(outcome.contract))
    except ImportError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(3) from exc
    except ContractValidationError as exc:
        print(exc.format_report(), file=sys.stderr)
        raise SystemExit(2) from exc
    write_recon_run_artifacts(outcome.contract, outcome.report_markdown, cfg)
    print(json.dumps(outcome.contract, indent=2))
    print(outcome.report_markdown)


if __name__ == "__main__":
    main()
