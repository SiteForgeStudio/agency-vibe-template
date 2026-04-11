# SiteForge — Perfect Preflight Output Spec (v1)

**Purpose:** Quality filter for preflight output and for handoff to intake (validation, not re-discovery).

**System anchor:** Intake architecture, contracts, and observability are defined in **`manifest.md` v2.3**; bump this spec’s version note when the preflight → `preflight_intelligence` handoff shape changes.

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

## Future Extensions (Not Required Yet)

- `best_in_class_patterns`  
- Pricing strategy hints  
- Service expansion suggestions  
- AEO-specific outputs  

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

*Version: v1 — intake handoff reference.*
