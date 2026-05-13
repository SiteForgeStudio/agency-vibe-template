# ADR-006: Multimodal Recon Intelligence

## Status
Accepted

## Context

The original recon architecture focused primarily on:
- text scraping
- competitor summaries
- website metadata
- strategic language analysis

As the Factory evolved, it became clear that high-quality strategic intelligence requires additional intelligence sources beyond text content alone.

Many important business signals exist inside:
- Google Business Profiles
- customer reviews
- visual website structure
- screenshots
- layout quality
- trust sequencing
- mobile UX
- imagery quality

Traditional scraping alone cannot reliably evaluate:
- design maturity
- emotional positioning
- trust density
- UX sophistication
- visual modernity
- CTA hierarchy
- local reputation quality

The recon system required a more advanced intelligence collection model.

---

## Decision

SiteForge will evolve the recon system toward:
# multimodal intelligence collection.

The recon pipeline will support:
- Google Places / GBP intelligence
- screenshot intelligence
- visual analysis
- review analysis
- layout analysis
- emotional positioning analysis

This intelligence will become part of:
- recon.json
- strategic scoring
- readiness evaluation
- strategy assembly

---

## Google Places / GBP Responsibilities

Google Places intelligence may eventually provide:
- competitor discovery
- review analysis
- trust analysis
- category intelligence
- operational signals
- geographic density analysis
- emotional language analysis
- service-area intelligence

GBP becomes a primary operational intelligence source for local businesses.

---

## Playwright Responsibilities

Playwright-based collection may eventually provide:
- desktop screenshots
- mobile screenshots
- rendered HTML
- layout structure
- CTA visibility
- visual hierarchy
- trust sequencing
- semantic structure analysis

Playwright belongs to the:
# collection layer.

NOT:
- rendering
- strategy
- frontend systems

---

## Architectural Placement

Multimodal intelligence belongs inside:
- collectors.py
- future intelligence collector modules

Example future structure:

collectors/
- google_places.py
- website_scraper.py
- screenshot_collector.py
- geo_collector.py

analyzers/
- ux_analyzer.py
- trust_analyzer.py
- emotional_analyzer.py
- aeo_analyzer.py

This architecture preserves:
- modularity
- orchestration separation
- rendering isolation

---

## Consequences

### Benefits

This architecture enables:
- higher-quality recon intelligence
- stronger strategic recommendations
- more accurate vibe selection
- stronger UX analysis
- stronger emotional analysis
- stronger trust analysis
- future multimodal AI workflows

The Factory becomes capable of:
# true digital strategy intelligence.

---

### Tradeoffs

This introduces:
- additional orchestration complexity
- screenshot infrastructure
- API management complexity
- increased analysis costs
- more operational stages

These tradeoffs are accepted because they dramatically improve:
- intelligence quality
- strategic reliability
- market differentiation

---

## Long-Term Impact

This decision establishes the foundation for:
- multimodal analysis
- visual intelligence
- AI-assisted UX scoring
- review intelligence
- adaptive strategic recommendations
- future autonomous optimization systems

The Factory evolves beyond:
- simple scraping
- SEO-only intelligence
- generic AI reports

And toward:
# autonomous digital market intelligence infrastructure.

---

## Related Decisions

- ADR-001: Layered Contract Architecture
- ADR-002: Python Intelligence Layer
- ADR-003: Recon-First Architecture