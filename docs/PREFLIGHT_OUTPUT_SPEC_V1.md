# SiteForge — Perfect Preflight Output Spec (v1)

**Purpose:** Quality filter for preflight output and for handoff to intake (validation, not re-discovery).

**System anchor:** Intake architecture, contracts, and observability are defined in **`manifest.md` v2.4**; bump this spec’s version note when the preflight → `preflight_intelligence` handoff shape changes.

**Handoff version:** `PREFLIGHT_OUTPUT_SPEC_V1_1` when `experience_model` / `component_importance` / `visual_strategy` / `process_model` / `pricing_model` are present in stored preflight strategy JSON (`spec_version` in `state.preflight_intelligence`).

---

## Purpose

Preflight must produce:

- Clear, differentiated, strategic direction that makes the client feel understood and reveals opportunities they didn’t see themselves.

**Not:**

- Summaries  
- Generic advice  
- Template website suggestions  

---

## Output Standard (Non-Negotiable)

Every output must:

1. Differentiate the business  
2. Identify a real customer problem or tension  
3. Position the business as a solution  
4. Contrast against alternatives  
5. Be actionable for website strategy  

---

## Required Output Fields (Locked)

### 1. `business_understanding`

**Goal:** Explain what makes the business meaningfully different.

**Must include**

- What they do (brief)  
- What makes them different  
- Contrast vs alternatives  

**Must not**

- Use generic phrases  
- Restate input  

**Good example**

> Simons Fine Art Framing & Gallery positions itself as an artist-owned studio, offering a level of craftsmanship and personal attention that contrasts with big-box framers and online-only services that prioritize speed over quality.

**Bad example**

> A local business offering quality framing services.

---

### 2. `opportunity`

**Goal:** Expose a real market or buyer gap.

**Must include**

- Customer hesitation / friction  
- Unmet need or mistrust  
- How this business can win  

**Good example**

> Customers often feel uncertain about the quality of framing—especially when ordering online—creating a trust gap that Simons can own by emphasizing craftsmanship and in-person expertise.

**Bad example**

> Increase visibility and attract more customers.

---

### 3. `website_direction`

**Goal:** Define how the site should strategically convert.

**Must include**

- Positioning emphasis  
- User flow intent  
- Conversion approach  

**Good example**

> Lead with artist-owned credibility and contrast against mass framing, then guide visitors through the value of custom framing before presenting a clear inquiry or consultation path.

**Bad example**

> Create a clean, modern website.

---

### 4. `recommended_focus`

**Goal:** List strategic content priorities.

**Must include**

- Differentiation-based topics  
- **Not** generic website sections  

**Good example**

```json
[
  "artist-owned craftsmanship",
  "custom vs mass framing comparison",
  "affordability without sacrificing quality",
  "local expertise in art handling",
  "trust-building through transparent process"
]
```

**Bad example**

```json
["about page", "services", "contact"]
```

---

### 5. `google_presence_insight`

**Goal:** Honest, trust-safe guidance.

**Rules**

- Never claim scraping or verification  
- Reflect confidence level  
- Suggest next action  

**Good example**

> Automated verification was not performed; the next step is to check or claim your Google Business Profile to strengthen local visibility.

**Bad example**

> You do not have a Google Business Profile.

---

### 6. `competitive_intelligence` (Critical)

**Goal:** Drive real strategic thinking.

**Required structure**

```json
{
  "differentiation_hypothesis": "",
  "local_alternatives": [],
  "buyer_comparison_factors": [],
  "competitor_weaknesses": [],
  "winning_local_angle": ""
}
```

**Quality requirements**

| Field | Requirement |
|--------|-------------|
| `differentiation_hypothesis` | What makes this business distinct; why it matters to customers |
| `local_alternatives` | Real categories (e.g. big-box framing, online framing, hobby/DIY)—not vague |
| `buyer_comparison_factors` | How customers decide (price vs quality, convenience vs craftsmanship, speed vs care) |
| `competitor_weaknesses` | e.g. lack of personalization, inconsistent quality, weak trust signals |
| `winning_local_angle` | Clear, specific, defensible |

**Good example (`winning_local_angle`)**

> Position as the trusted local expert for custom framing—combining artist-level craftsmanship with accessible pricing, something neither big-box stores nor online framers can deliver.

---

## Banned Language (Global)

These phrases must **not** appear:

- “uniquely positioned”  
- “enhance visibility”  
- “drive more traffic”  
- “streamlined website”  
- “engaging experience”  
- “highlight your offerings”  

If used → output fails QA.

---

## Quality Scoring Model (Reference)

### `positioning_specificity_score`

**90+ requires**

- Clear contrast vs competitors  
- Defined positioning angle  
- Not reusable across unrelated industries  

### `opportunity_strength_score`

**90+ requires**

- Identifies real buyer tension  
- Ties to decision-making  
- Shows how the business wins  

### Score caps (heuristic)

| Condition | Max score |
|-----------|-----------|
| No competitor contrast | 70 |
| No buyer tension | 75 |
| Generic phrasing | 60 |

---

## Output Feel (Critical)

Should feel like: **“This system understands my business better than I explained it.”**

Not: **“This system rewrote what I said.”**

---

## QA Pass Conditions

Preflight is **valid** only if:

- Differentiation is explicit  
- Competitors are referenced (implicitly or explicitly)  
- Buyer decision factors are present  
- Output is **not** reusable across unrelated industries  

---

## Experience strategy layer (v1.1 — required for recon / optional for legacy rows)

**Goal:** Prescribe **how the website should behave** (purchase journey, proof, visuals, pricing posture, section priorities), not only **what the business is**.

These objects are produced by `/api/preflight-recon`, persisted with the preflight record, and bridged into `state.preflight_intelligence` for intake + synthesis. **Do not hardcode industries:** every enum must be justified from inputs (description, name, geography, optional URL hint), not from category name alone.

### `experience_model`

| Field | Role |
|--------|------|
| `purchase_type` | How the buyer commits (impulse → ongoing relationship). |
| `decision_mode` | Self-serve vs guided vs appointment-heavy. |
| `visual_importance` | How much the site depends on imagery to win trust. |
| `trust_requirement` | How strong proof must be (social → technical/compliance). |
| `pricing_behavior` | Whether numbers belong on the site or behind consult/quote. |
| `experience_rationale` | 1–2 sentences linking the enums to buyer reality (non-generic). |

Enums are **closed lists** in the recon prompt (see `preflight-recon.js`); the model must pick exactly one allowed string per enum field.

### `component_importance`

Per-component **importance** (`none` → `critical`) for: gallery, process, testimonials, pricing_section, comparison, faqs, service_area, contact_conversion, events_or_booking, investment.

Used to bias schema toggles, section order, and intake emphasis—not as a second copy of `recommended_focus`.

### `visual_strategy`

| Field | Role |
|--------|------|
| `primary_visual_job` | What the visuals must *do* (trust, transformation, craft, context…). |
| `gallery_story` | One sentence: what the gallery must *prove*. |
| `imagery_tone` | Aesthetic direction (closed enum in prompt). |
| `must_show` | Concrete proof concepts (materials, outcomes, context)—not “nice photos”. |
| `avoid` | Category-specific visual clichés to skip. |

### `process_model`

| Field | Role |
|--------|------|
| `buyer_anxiety` | Specific worries (not “bad service”). |
| `process_narrative` | How the journey should read on the site (reduce anxiety, guided). |
| `steps_emphasis` | Closed enum: how steps are sequenced (walk-in vs consult-first, etc.). |
| `reassurance_devices` | Concrete credibility mechanisms (warranties, process, materials). |

### `pricing_model`

| Field | Role |
|--------|------|
| `site_treatment` | How pricing behaves on the site (aligned with `experience_model.pricing_behavior`). |
| `cta_alignment` | Closed enum: call, quote, consult, schedule, etc. |
| `risk_language` | Whether public numbers are appropriate. |
| `pricing_notes` | Optional scope/rush/custom-work caveats when inferable. |

### QA (v1.1)

- At least **three** `component_importance` keys below `high` unless inputs force an “everything critical” business.  
- `visual_strategy.must_show` must be **concrete** (nouns/behaviors), not generic.  
- `process_model.process_narrative` must address **anxiety** implied by `experience_model`.  
- `pricing_model` must **not** contradict `experience_model.pricing_behavior`.

---

## Future Extensions (Not Required Yet)

- `best_in_class_patterns`  
- Service expansion suggestions  
- Additional AEO-only bundles  

---

## Final Standard

If a real business owner reads this, they should think:

> “I didn’t even say that—but that’s exactly right.”

---

## What This Unlocks

When this spec is met:

- Intake becomes **validation**, not discovery  
- AI feels like a **consultant**  
- Previews feel **premium**  
- Differentiation becomes **automatic**  

---

## How to Use This Doc

This document is the **quality filter**, not the prompt and not the code alone.

If something drifts:

1. Compare output to this spec  
2. Not only to intentions  

---

*Version: v1.1 — intake handoff reference (experience strategy layer + v1 fields).*
