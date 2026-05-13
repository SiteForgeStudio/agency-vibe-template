"""
Persist recon outputs to timestamped filesystem folders.

Responsible only for durable artifact layout under ``intelligence/recon/output/``.
No intelligence derivation or pipeline sequencing.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from intelligence.recon.config import ReconPipelineConfig
from intelligence.recon.models import ReconContract

_OUTPUT_PARENT = Path(__file__).resolve().parent / "output"


def _filesystem_slug(*parts: str, max_chars: int = 48) -> str:
    raw = "_".join(str(p).strip() for p in parts if str(p).strip()) or "recon"
    sanitized = re.sub(r"[^\w\s-]", "", raw, flags=re.UNICODE).strip().lower()
    sanitized = re.sub(r"[\s_]+", "-", sanitized)
    sanitized = re.sub(r"-+", "-", sanitized).strip("-")[:max_chars].strip("-")
    if sanitized in ("", ".", ".."):
        return "recon"
    return sanitized


def _stamp_utc_compact() -> str:
    """``YYYY-MM-DD_HHMM`` in UTC."""

    return datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")


def allocate_run_folder(config: ReconPipelineConfig, *, root: Path | None = None) -> Path:
    """Reserve a fresh directory ``{stamp}_{slug}/`` without creating it."""

    base = root if root is not None else _OUTPUT_PARENT
    stamp = _stamp_utc_compact()
    slug = _filesystem_slug(config.niche, config.target_location)
    candidate = base / f"{stamp}_{slug}"
    if not candidate.exists():
        return candidate
    for n in range(2, 10_000):
        alt = base / f"{stamp}_{slug}_{n}"
        if not alt.exists():
            return alt
    raise OSError("Could not allocate a unique output folder under output/")


def write_recon_run_artifacts(
    contract: ReconContract,
    report_markdown: str,
    config: ReconPipelineConfig,
    *,
    root: Path | None = None,
) -> Path:
    """Write ``recon.json`` and ``report.md``; return the run directory created."""

    base = root if root is not None else _OUTPUT_PARENT
    base.mkdir(parents=True, exist_ok=True)
    run_dir = allocate_run_folder(config, root=base)
    run_dir.mkdir(parents=False)

    recon_path = run_dir / "recon.json"
    report_path = run_dir / "report.md"

    recon_path.write_text(
        json.dumps(contract, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    report_path.write_text(report_markdown, encoding="utf-8")

    return run_dir.resolve()
