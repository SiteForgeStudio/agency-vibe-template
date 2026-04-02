# **🏗️ SiteForge Factory — Intake V2 Manifest (Blueprint \+ Planner Architecture)**

## **🔥 Core Philosophy**

SiteForge is NOT a chatbot.

It is a **schema-driven, strategy-backed site generation engine** where:

* Preflight \= intelligence \+ direction  
* Intake \= verification \+ refinement  
* Output \= **valid, premium `business.json`**

The system must:

* Work across ANY business type (no hardcoding industries)  
* Feel like an expert strategist (not a form)  
* Produce **high-conversion, modern websites**

---

# **🧠 SYSTEM SHIFT (CRITICAL)**

## **❌ OLD MODEL (REMOVE)**

* Turn-based intake  
* `current_key` driving flow  
* Narrative blocks (`what_it_is`, etc.)  
* Regex-based extraction  
* Random or loosely guided questions

## **✅ NEW MODEL (REQUIRED)**

**Planner \+ Blueprint System**

Flow:

Preflight → Blueprint → Section Status → Planner → Question → AI Extraction → Validation → business.json

---

# **🧩 CORE COMPONENTS**

## **1\. Preflight (SOURCE OF TRUTH)**

Preflight provides:

* `strategy_contract`  
* audience insights  
* conversion strategy  
* proof signals  
* site structure  
* content requirements  
* schema toggles  
* AEO \+ FAQ angles  
* GBP / NAP insights

⚠️ Intake MUST NOT rediscover this.  
It must **build on it**.

---

## **2\. Blueprint (NEW — REQUIRED)**

Created in `intake-start.js`

### **Structure:**

{

  "strategy": {},

  "fact\_registry": {},

  "business\_draft": {},

  "section\_status": {},

  "verification\_queue": \[\],

  "question\_candidates": \[\]

}

---

## **3\. Fact Registry**

Tracks ALL known information with provenance:

{

  "primary\_offer": {

    "value": "...",

    "source": "preflight | user | inferred",

    "confidence": 0.9,

    "verified": false

  }

}

---

## **4\. Business Draft (TARGET OUTPUT)**

Partial `business.json` being built live:

{

  "hero": {},

  "features": \[\],

  "about": {},

  "contact": {},

  "gallery": {},

  "faqs": \[\],

  "processSteps": \[\]

}

---

## **5\. Section Status Engine (REPLACES NARRATIVE MODEL)**

Each section is:

{

  "hero": {

    "enabled": true,

    "required\_for\_preview": true,

    "fields\_needed": \["headline", "subtext"\],

    "status": "missing | partial | ready"

  }

}

### **Determined by:**

* `strategy_contract.schema_toggles`  
* `content_requirements.preview_required_fields`  
* schema rules

---

## **6\. Planner (THE BRAIN)**

### **Function:**

planNextQuestion(blueprint)

### **It selects:**

* highest-impact missing section  
* required or blocking data  
* appropriate **question bundle**

### **Output:**

{

  "bundle\_id": "positioning",

  "target\_fields": \["primary\_offer", "audience", "differentiation"\],

  "reason": "hero \+ features incomplete"

}

---

# **🎯 QUESTION BUNDLES (REUSABLE, NOT HARD CODED)**

## **Examples:**

### **Positioning**

Who you serve \+ what you do \+ why different

### **Process**

Client journey from start → outcome

### **Conversion**

How customers take action

### **Proof**

Why someone should trust you

### **Visual Direction**

What should be shown in gallery

### **Service Area**

Where you operate

### **Offer Detail**

Breakdown of services/products

---

# **✨ QUESTION GENERATION**

## **RULE:**

* Code selects **bundle**  
* AI generates **natural wording**

Example:

Input:

{

  "bundle": "process",

  "tone": "consultative",

  "business\_type": "coach"

}

Output:

“When someone decides to work with you, what does the journey typically look like—from the first conversation to the outcome you’re helping them achieve?”

---

# **🧠 ANSWER INTERPRETATION (NO REGEX)**

## **AI Extraction Contract:**

{

  "field\_updates": {},

  "copy\_candidates": {},

  "verified\_fields": \[\],

  "inferred\_fields": \[\],

  "followup\_needed": \[\]

}

---

# **🔒 VALIDATION LAYER (CODE)**

Code decides:

* what gets written to `business_draft`  
* what needs verification  
* what is preview-safe  
* what triggers follow-up

---

# **⚙️ INTAKE-START.JS ROLE (UPDATED)**

## **MUST:**

1. Fetch preflight  
2. Extract `strategy_contract`  
3. Seed:  
   * fact\_registry  
   * business\_draft (partial)  
4. Build blueprint  
5. Compute section\_status  
6. Run planner → first bundle  
7. Generate first question  
8. Save full state

## **MUST NOT:**

* rely on narrative blocks  
* rely on category for logic  
* ask generic opening questions  
* ignore preflight data

---

# **🧪 READINESS MODEL (V2)**

## **Preview Ready When:**

* All required sections (enabled by strategy) are:  
  * complete OR acceptable via AI inference  
* All **must\_verify\_now** fields handled  
* Conversion path is valid  
* No blocking missing fields

---

# **🚫 HARD RULES**

* ❌ No industry hardcoding ("window cleaner", etc.)  
* ❌ No regex-based meaning extraction  
* ❌ No random questions  
* ❌ No form-style interrogation  
* ✅ Always schema-driven  
* ✅ Always strategy-aware  
* ✅ Always conversion-aware

---

# **🔮 FUTURE EXPANSION (ALREADY ACCOUNTED FOR)**

* Competitor intelligence  
* Best-in-class references  
* Dynamic vibe generation  
* fal.ai image pipeline  
* CMS-driven rebuilds  
* AEO (llms.txt \+ AI.instructions)

---

# **💡 KEY INSIGHT**

We are not asking:

“What question comes next?”

We are asking:

“What is the highest-value missing information required to produce a premium site?”

---

# **🚀 END STATE**

A system that:

* feels like a strategist  
* builds sites better than most agencies  
* adapts to ANY business type  
* produces clean, valid, high-quality `business.json`

---

## **If continuing in a new chat:**

Start with:

“We are working on SiteForge Factory using the Intake V2 Manifest (Blueprint \+ Planner system). Help me implement \[component\].”

---

