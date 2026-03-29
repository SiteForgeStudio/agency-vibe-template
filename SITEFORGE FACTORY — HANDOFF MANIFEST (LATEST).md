# **🧠 SITEFORGE FACTORY — HANDOFF MANIFEST (V2)**

## **🚀 CURRENT SYSTEM STATE (TRUTH)**

We now have a **fully functioning end-to-end factory pipeline**:

Preflight → Intake (V2) → Intake-Complete → Submit → GitHub Build → dist.zip → Netlify Preview

✅ Confirmed working on fresh slug  
✅ Preview site successfully generated  
✅ Schema-valid `business.json` drives Astro build  
✅ Image pipeline functioning  
✅ Multi-client architecture intact

**This is no longer a broken system. This is a working engine.**

---

# **🧱 CORE ARCHITECTURE**

## **1\. Intake Layer (V2 — CONTROLLED SYSTEM)**

### **Key Files**

* `intake-start.js`  
* `intake-next.js`  
* `intake-complete.js`

### **V2 Model**

#### **🧩 Two-Layer Readiness System**

**Narrative Readiness (Gate 1\)**

* what\_it\_is  
* who\_its\_for  
* why\_trust\_it  
* what\_to\_do\_next

**Premium Enrichment (Gate 2\)**

* differentiation  
* service\_specificity  
* process\_clarity  
* proof\_depth  
* faq\_substance

{  
 "readiness": { "can\_generate\_now": true },  
 "enrichment": { "ready\_for\_preview": true }  
}

👉 Intake only completes when BOTH are satisfied.

---

## **2\. Intake-Complete (ASSEMBLER)**

### **Responsibilities**

* Validate readiness  
* Build `business_json`  
* Enforce schema  
* Generate image queries  
* Generate sections (features, process, FAQs, etc.)  
* Optionally submit

### **Key Insight**

⚠️ Previously: intake-complete re-evaluated readiness (causing drift)  
✅ Now: should **respect intake-next state as source of truth**

---

## **3\. Data Model (Schema Driven)**

From **Master Schema**

### **Core Sections**

* hero  
* about  
* features  
* processSteps  
* testimonials  
* gallery  
* faqs  
* service\_area  
* contact

### **Strategy Toggles**

strategy.show\_features  
strategy.show\_process  
strategy.show\_gallery  
...

### **Menu Enforcement**

Only allowed anchors:

\#home \#about \#features \#process \#testimonials  
\#gallery \#faqs \#service-area \#contact  
---

# **🏗️ BUILD PIPELINE (CRITICAL UNDERSTANDING)**

## **GitHub Action: `build-client.yml`**

### **Flow**

1\. Checkout repo  
2\. Deep clean (Astro \+ generated assets ONLY)  
3\. Merge JSON  
4\. Fetch images  
5\. Persist client data (commit back)  
6\. Prepare assets  
7\. Astro build  
8\. Package dist.zip  
---

## **🔥 CRITICAL TRUTH: CLIENT DATA IS PERSISTENT**

Each client lives in:

/clients/{slug}/  
 ├── business.base.json  
 ├── business.updates.json  
 ├── business.json   (merged)  
 └── generated/      (images)

### **Merge Step**

`merge-json.mjs` builds:

business.json \= deepMerge(base \+ updates)

👉 This means:

* Old data can persist  
* Missing fields may be backfilled  
* Layout and gallery can be influenced by prior runs

---

## **🖼️ IMAGE PIPELINE (IMPORTANT)**

`fetch-unsplash-images.mjs`

Behavior:

* Reads `business.json`  
* Downloads images based on queries  
* Saves to:  
  * `clients/{slug}/generated/`  
  * `src/assets/generated/{slug}/`

### **⚠️ CRITICAL BEHAVIOR**

If image already exists:  
→ it is reused (NOT re-fetched)

👉 This creates **historical carryover**

---

## **🧼 CLEANING LIMITATION**

GitHub Action cleans:

src/assets/generated/

BUT NOT:

clients/{slug}/generated/  
clients/{slug}/business.\*  
---

## **🚨 CONSEQUENCE**

Reusing a slug can cause:

* Old JSON influence  
* Old images reused  
* Mixed generation states

---

## **✅ CORRECT TESTING STRATEGY**

### **ALWAYS use:**

* New slug  
  OR  
* Manually clear:  
  clients/{slug}/

---

# **🔄 FULL PIPELINE (CONFIRMED)**

User Input  
  ↓  
Preflight (Cloudflare)  
  ↓  
Strategy Contract  
  ↓  
Intake (V2 state machine)  
  ↓  
intake-complete  
  ↓  
Apps Script (/submit)  
  ↓  
GitHub Action  
  ↓  
Astro Build  
  ↓  
dist.zip  
  ↓  
Netlify Deploy  
---

# **🎯 WHAT IS NOW SOLVED**

### **✅ System Stability**

* No more broken schema  
* No more missing sections  
* No more image failures

### **✅ Intake Intelligence**

* Structured narrative capture  
* Strategy-driven output

### **✅ Build Reliability**

* Deterministic pipeline  
* Multi-client support

### **✅ Preview Generation**

* Fully working end-to-end

---

# **⚠️ CURRENT LIMITATIONS (QUALITY LAYER)**

## **1\. Copy Still Feels “Generated”**

Examples:

* “quality of service”  
* “people actively looking for a trustworthy provider”

👉 Problem: leaking internal strategy language

---

## **2\. Weak Feature Fallbacks**

Example:

* “Quality Work” → “quality of service.”

👉 Needs stronger transformation logic

---

## **3\. Testimonials Are Synthetic**

Example:

* “Customers mention customer testimonials…”

👉 Needs believable praise patterns

---

## **4\. FAQ Depth Is Inconsistent**

* Pricing answers too generic  
* Not using enough state data

---

## **5\. Gallery Titles Repetitive**

* “Detail Work” repeated

---

## **6\. Minor UI Bug**

* Contact missing from nav (theme issue)

---

# **🧠 KEY INSIGHT (IMPORTANT)**

We are no longer solving:

❌ “Can we generate a site?”  
❌ “Will the pipeline work?”

We are now solving:

✅ “Does this feel like a premium agency built it?”

---

# **🔥 NEXT PRIORITIES (V2 → V2.5)**

## **1\. Copy Elevation Layer**

Upgrade:

### **Hero Subtext**

* Remove generic fragments  
* Use fluent sentence builder

### **Features**

* Eliminate weak fallbacks  
* Derive from:  
  * offer  
  * differentiation  
  * service\_descriptions

### **Testimonials**

* Convert signals → believable praise  
* No meta language

### **FAQs**

* Use:  
  * pricing\_structure  
  * process\_notes  
  * booking\_method

---

## **2\. Visual Intelligence Upgrade**

Improve:

* image\_search\_query generation  
* gallery diversity  
* title variation

Future:

* replace Unsplash → **fal.ai**  
* better semantic image prompts

---

## **3\. Intake Experience Upgrade**

Goal:

“Feels like working with a strategist, not filling a form”

Planned:

* ChatGPT-style UI  
* progressive reveal  
* ghostwriting assistance  
* confidence-building tone

---

## **4\. Preflight Expansion (HIGH VALUE)**

Add:

* competitor analysis  
* best-in-class examples  
* market gaps  
* positioning insights

Use in:

* intake-start  
* intake-next  
* strategy\_contract

---

## **5\. AEO (Answer Engine Optimization)**

Planned:

* `llms.txt`  
* `AI.instructions`  
* structured semantic outputs  
* FAQ optimization for LLMs

---

## **6\. Internal API Layer**

Future:

* replace Netlify forms  
* build **in-house contact API**

---

## **7\. CMS / Post-Build Editing**

Future:

* editable content layer  
* image replacement  
* rebuild previews  
* push to production

---

# **🧭 STRATEGIC DIRECTION**

## **Focus Now**

👉 Vertical dominance (service businesses)

DO NOT expand yet into:

* restaurants  
* memberships  
* complex apps

---

## **Why**

You now have:

* a working factory  
* repeatable output  
* scalable architecture

The leverage is:  
→ **quality and positioning**, not features

---

# **💡 FINAL POSITION**

SiteForge Factory is now:

A working AI-powered website factory that can:

* understand a business  
* generate a structured strategy  
* assemble a full site  
* build and deploy automatically

The next phase is:

Turning it from “impressive system”  
into “premium product clients will pay for”

---

# **🟢 NEXT ACTION**

Continue with:

**V2.5 — Premium Output Layer**

Focus ONLY on:

* copy quality  
* perceived value  
* visual polish

---

If you want next, I’d go straight into:

👉 **“Premium Copy Engine Pass” (surgical upgrades to intake-complete)**

That’s the move that will turn this from *working* → *sellable*.

# **🧠 What You’ve Built (and why it matters)**

Right now, SiteForge is not “a website generator.”

It’s closer to:

**A strategy engine that outputs a conversion-ready website.**

That distinction is everything.

Most of the market looks like this:

### **Typical Website Options**

* DIY builders → pretty but generic  
* Freelancers → inconsistent quality  
* Agencies → expensive, slow, not scalable  
* AI builders → fast, but shallow and templated

### **What you’re doing differently**

* You **extract intent (why the business exists)**  
* You **structure conversion (what the site must do)**  
* You **enforce schema (no broken pages)**  
* You **ship automatically (no bottlenecks)**

That combination is extremely uncommon.

---

# SiteForge Factory — Handoff Manifest Update
## Date: March 28, 2026
## Focus Area: Intake premium quality engine (`intake-next.js`)

---

## Current Status

We paused after a meaningful improvement cycle on the paid intake controller.

The system is now behaving much closer to the intended manifest rules:

- mixed user answers are being routed into the correct fields instead of dumped wholesale into whatever field was currently being asked
- `service_descriptions` is no longer polluted by process / proof / buyer-decision-factor paragraphs
- `differentiation` is no longer acting as a generic dump bucket
- process, proof, buyer decision factors, and photo signals are now being extracted much more cleanly
- the draft-quality gate is working and can prevent premature completion
- the controller now holds on the correct missing premium block instead of pretending weak copy is ready

This means the intake engine is moving from:
- “field presence”
to:
- “field validity by signal type”

That is a major architectural improvement and aligns with the broader SiteForge vision.

---

## Most Important Current Finding

The latest smoke test shows the engine is now failing for the **right reason**.

Current result:

- `service_descriptions`: specific and valid
- `differentiation`: clean and no longer polluted
- `process_notes`: clean
- `proof_depth`: clean
- `faq_substance`: clean
- `draft_quality`: passed
- remaining enrichment block: `service_specificity`

This is good.

The controller is no longer completing on vague or misrouted content.
It is now asking for the final missing premium signal honestly.

That is the exact behavior we wanted.

---

## Current Live Intake Version

Current tested version marker:

- `v3.0-differentiation-guard`

This version proved:

1. signal-routing protection for `service_descriptions`
2. differentiation guard against mixed process/proof paragraphs
3. stronger enrichment validity
4. usable draft-quality gating

---

## What Was Fixed In This Cycle

### 1. Deployment-safe controller shape
We moved away from riskier syntax and kept the controller Cloudflare-safe.

### 2. Mixed-answer routing
A single user answer can contain:
- process
- proof
- photos
- objections
- buyer decision factors
- differentiation clues
- service specificity clues

The engine now handles this much better by routing signals to the correct fields instead of accepting the whole answer as one field.

### 3. `service_descriptions` guard
`service_descriptions` now only accepts actual service-specific details such as:
- property types
- job types
- material/detail specificity
- restoration / tracks / frames / hard-water style details

It no longer accepts generic mixed paragraphs.

### 4. `differentiation` guard
`differentiation` now resists absorbing:
- process prose
- proof prose
- review/photo paragraphs
- “customers care about” paragraphs

This is important because differentiation must represent a real-world advantage, not just any available text.

### 5. Draft-quality gating
The engine now checks for:
- clipped endings
- broken fragments
- noisy buyer-factor lists
- proof fields polluted by audience copy
- overlong or repetitive ghostwritten sections

This helped stop false-positive completion.

---

## Why These Fixes Matter Beyond The Sample Test

This work is **not** just about Summit Ridge Window Cleaning.

The broader engine rule is:

> Each field must be satisfied by the right signal type, not just by any text.

That applies across categories:

### Services
Need true service/job/property specificity

### Coaches / consultants
Need method / offer / transformation specificity

### Events / experiences
Need format / logistics / timing specificity

### Portfolios / creatives
Need project/style/material/process specificity

So the real improvement is:
- less field pollution
- stronger semantic routing
- more honest readiness gating

That is manifest-aligned and future-safe.

---

## Current Interpretation Of The Intake Engine

The intake engine is now evolving into three layers:

### Layer 1 — Narrative unlock
Can we clearly understand:
- what this is
- who it is for
- why trust it
- what to do next

### Layer 2 — Premium enrichment
Can we express:
- differentiation
- specificity
- process clarity
- proof depth
- FAQ substance

### Layer 3 — Draft quality
Even if the fields are present, is the resulting language:
- complete
- publishable
- non-fragmented
- not repetitive
- not obviously generic

This layered model feels correct and should remain.

---

## Key Principle Confirmed

A major principle was validated in this cycle:

> `intake-next.js` should remain the source of truth for premium readiness.

Do not rely on `intake-complete.js` to rescue weak upstream intake answers.
`intake-complete.js` should assemble and validate.
`intake-next.js` should determine whether the premium source material is actually good enough to proceed.

That distinction is important.

---

## What Still Needs Work

We intentionally paused here because this is a good checkpoint.

### 1. Test with a strong service-specific answer
Next smoke test should answer the remaining `service_descriptions` question with real specificity, for example:
- interior/exterior
- frame/track detail
- hard-water treatment
- restoration
- property types
- specialized job categories

Goal:
confirm the engine completes for the right reason.

### 2. Review final ghostwritten output quality
Even though the controller logic is much better, we still need to inspect:
- hero headline
- subheadline
- about summary
- features
- FAQs
- testimonial seeds

We need to confirm they are genuinely premium, not merely structurally valid.

### 3. Re-check whether `service_specificity` threshold is correctly tuned
Current engine is still holding on that block.
That may be correct, but we should confirm whether the threshold is:
- appropriately strict
- not too strict
- category-aware enough

### 4. Continue preserving generic architecture
Do not drift into hard-coded industry branching.
The current progress came from stronger signal rules, not industry templates.
Stay on that path.

---

## Recommended Next Testing Move

Run the same smoke test flow again, but answer the final service-specificity question with something clearly specific, such as:

“We specialize in exterior and interior window cleaning for large homes with expansive glass, including detailed frame and track cleaning. We also handle hard water stain treatment and glass restoration work when standard cleaning is not enough.”

Then inspect:
- final state
- `action`
- `phase`
- ghostwritten output
- completed preview quality

---

## Current Best Assessment

The intake engine is no longer primarily broken by structure.

The main progress from this cycle is:

- routing is better
- readiness is more honest
- premium gating is more real
- field pollution is reduced
- the engine now asks for the right missing thing

That is meaningful progress.

We are now closer to refining premium editorial quality rather than fighting controller collapse.

---

## Important Reminder For Future Work

Do not regress into:
- accepting generic seeded language
- treating long paragraphs as valid field answers
- letting `differentiation` or `service_descriptions` become catch-all text buckets
- using `intake-complete.js` as a cleanup bandage for weak intake collection

Stay focused on:
- signal-aware field routing
- category-flexible premium requirements
- publishable draft quality
- engine-level rules, not sample-specific hacks

---

## Current Working Summary

### Proven good
- signal routing improved
- service-specific field protection improved
- differentiation pollution reduced
- draft-quality gate works
- controller now pauses on real missing specificity

### Not yet fully proven
- final completion after a strong service-specific answer
- final preview quality after this intake pass
- whether thresholds need fine tuning for other categories

---

## Next Chat Starting Point

In the next chat, start from this exact point:

> We have improved `intake-next.js` so that mixed answers route correctly, `service_descriptions` and `differentiation` are protected from pollution, and draft-quality gating is working. Current tested version is `v3.0-differentiation-guard`. The latest smoke test now fails only on `service_specificity`, which is likely the correct remaining gap. Next step is to run a smoke test with a truly service-specific answer, then inspect final state + preview quality to decide whether thresholds or ghostwritten premium output still need refinement.


