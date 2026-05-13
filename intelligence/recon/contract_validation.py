"""
Validate assembled recon payloads against contracts/recon.schema.json.

Schema validation only; no pipeline or filesystem side effects here.
Requires: ``jsonschema`` (Draft 2020-12 compliant validator for this schema).

Install: ``pip install -r intelligence/recon/requirements.txt``
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path


DEFAULT_RECON_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "contracts" / "recon.schema.json"
)


class ContractValidationError(ValueError):
    """Raised when an assembled contract does not satisfy recon.schema.json."""

    def __init__(self, violations: Sequence[str], *, schema_path: Path):
        lines = tuple(v.strip() for v in violations if str(v).strip())
        combined = "; ".join(lines) if lines else "unknown validation violations"
        super().__init__(combined)
        self.violations = lines
        self.schema_path = schema_path

    def format_report(self) -> str:
        header = (
            f"Recon contract failed JSON Schema validation\n"
            f"  schema: {self.schema_path}\n"
            f"  issues ({len(self.violations)}):\n"
        )
        if not self.violations:
            return header + "  • (validator returned no message detail)\n"
        body = "".join(f"  • {v}\n" for v in self.violations[:50])
        if len(self.violations) > 50:
            body += f"  • … ({len(self.violations) - 50} more)\n"
        return header + body


def validate_recon_contract(
    contract: Mapping[str, object],
    *,
    schema_path: Path | None = None,
) -> None:
    """Raise ContractValidationError if ``contract`` is invalid."""

    try:
        from jsonschema import Draft202012Validator
    except ImportError as exc:  # pragma: no cover - environment without jsonschema
        raise ImportError(
            "Recon JSON Schema validation requires the 'jsonschema' package. "
            "Install with: pip install -r intelligence/recon/requirements.txt"
        ) from exc

    resolved = (schema_path or DEFAULT_RECON_SCHEMA_PATH).resolve()
    if not resolved.is_file():
        raise ContractValidationError(
            (f"missing_schema_file:{resolved}",),
            schema_path=resolved,
        )

    schema = json.loads(resolved.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errs = sorted(validator.iter_errors(contract), key=lambda e: (list(e.absolute_path), e.schema_path))

    if not errs:
        return

    violations: list[str] = []
    for err in errs:
        loc = ".".join(str(x) for x in err.absolute_path) or "(document root)"
        violations.append(f"{loc}: {err.message}")

    raise ContractValidationError(violations, schema_path=resolved)
