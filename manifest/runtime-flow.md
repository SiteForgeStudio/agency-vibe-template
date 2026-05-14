# Runtime Flow

## Recon Runtime Flow

Trigger:
CLI / API / GitHub Action

↓
engine.py

↓
collectors.py
(raw intelligence)

↓
analyzers.py
(structured intelligence)

↓
scorers.py
(normalized operational signals)

↓
assembler.py
(recon.json assembly)

↓
contract_validation.py
(schema enforcement)

↓
artifact_writer.py
(output persistence)

↓
report_writer.py
(markdown report generation)

Outputs:
- recon.json
- report.md