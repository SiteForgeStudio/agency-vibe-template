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