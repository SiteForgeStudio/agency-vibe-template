// functions/api/intake-complete.js
/**
 * SiteForge Factory — Paid Intake Complete (V2)
 *
 * ROLE:
 * - gate on V2 readiness + enrichment
 * - assemble schema-valid business_json from V2 intake state
 * - preserve deterministic image query / gallery logic
 * - optionally submit to /api/submit
 */

import {
  SCHEMA_VIBES,
  selectVibe,
  buildHeroImageQuery,
  buildFallbackGalleryQueries,
  inferPremiumGalleryCount,
  galleryLayoutFromSignals,
  assertFactorySynthesisGuards
} from "../utils/factory-synthesis.js";

import { enhanceProcessSteps, enhanceFeatures, enhanceHero } from "../utils/content-enhancement.js";

const ALLOWED_MENU_PATHS = [
  "#home",
  "#about",
  "#features",
  "#events",
  "#process",
  "#testimonials",
  "#comparison",
  "#gallery",
  "#investment",
  "#faqs",
  "#service-area",
  "#contact"
];

const ALLOWED_ICON_TOKENS = [
  "zap",
  "cpu",
  "layers",
  "rocket",
  "leaf",
  "sprout",
  "sun",
  "scissors",
  "truck",
  "hammer",
  "wrench",
  "trash",
  "sparkles",
  "heart",
  "award",
  "users",
  "map",
  "shield",
  "star",
  "check",
  "coins",
  "briefcase",
  "clock",
  "phone"
];

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const state = normalizeState(body.state || {});
    const action = cleanString(body.action || state.action || "");

    if (!cleanString(state.slug)) {
      return json({ ok: false, error: "Missing state.slug" }, 400);
    }

    const strategyContract = getStrategyContract(state);
    if (!strategyContract) {
      return json({ ok: false, error: "Missing strategy_contract in state" }, 400);
    }

    state.readiness = evaluateNarrativeReadiness(state);
    state.enrichment = evaluateEnrichment(state);

    if (!state.readiness.can_generate_now) {
      return json(
        {
          ok: false,
          error: "intake_not_ready",
          message: "Narrative unlock is not complete yet.",
          readiness: state.readiness,
          enrichment: state.enrichment
        },
        400
      );
    }

    if (!state.enrichment.ready_for_preview) {
      return json(
        {
          ok: false,
          error: "premium_enrichment_incomplete",
          message: "Narrative is clear, but premium enrichment is not strong enough for final preview assembly yet.",
          readiness: state.readiness,
          enrichment: state.enrichment
        },
        400
      );
    }

    const strategyBrief = buildStrategyBrief(state, strategyContract);
    let businessJson = buildBusinessJson(state, strategyContract, strategyBrief);
    businessJson = ensureInspirationQueries(businessJson, state, strategyContract);
    assertFactorySynthesisGuards(businessJson);

    const validation = validateBusinessJson(businessJson);

    if (!validation.ok) {
      return json(
        {
          ok: false,
          error: "business_json_validation_failed",
          issues: validation.issues,
          strategy_brief: strategyBrief,
          business_json: businessJson
        },
        400
      );
    }

    const payload = {
      ok: true,
      slug: cleanString(state.slug),
      readiness: state.readiness,
      enrichment: state.enrichment,
      strategy_brief: strategyBrief,
      business_json: businessJson,
      business_base_json: businessJson
    };

    if (action === "complete") {
      payload.submit = await trySubmitBusinessJson(context.request, {
        business_json: businessJson,
        client_email: cleanString(state.clientEmail) || cleanString(businessJson?.brand?.email)
      });
    }

    return json(payload);
  } catch (err) {
    console.error("[intake-complete]", err);
    return json(
      {
        ok: false,
        error: String(err?.message || err)
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "intake-complete",
    method: "POST"
  });
}

/* =========================
   Strategy Brief
========================= */

function buildStrategyBrief(state, strategyContract) {
  const signalBlob = buildSignalBlob(state, strategyContract);
  const derived_behavior = deriveBehavior(signalBlob);
  return {
    business_name: cleanString(state.businessName),
    slug: cleanString(state.slug),
    category: cleanString(strategyContract.business_context?.category),
    strategic_archetype: cleanString(strategyContract.business_context?.strategic_archetype),
    one_page_fit: cleanString(strategyContract.business_context?.one_page_fit),
    primary_conversion: cleanString(strategyContract.conversion_strategy?.primary_conversion),
    secondary_conversion: cleanString(strategyContract.conversion_strategy?.secondary_conversion),
    conversion_mode: cleanString(strategyContract.conversion_strategy?.conversion_mode),
    audience: cleanString(state.answers?.audience),
    primary_offer: cleanString(state.answers?.primary_offer),
    service_area: cleanString(state.answers?.service_area),
    trust_signal: cleanString(state.answers?.trust_signal),
    differentiation: cleanString(state.answers?.differentiation),
    recommended_vibe: cleanString(strategyContract.visual_strategy?.recommended_vibe),
    schema_toggles: isObject(strategyContract.schema_toggles) ? strategyContract.schema_toggles : {},
    asset_policy: isObject(strategyContract.asset_policy) ? strategyContract.asset_policy : {},
    copy_policy: isObject(strategyContract.copy_policy) ? strategyContract.copy_policy : {},
    signal_blob: summarizeSignalBlobForBrief(signalBlob),
    derived_behavior,
    proof_angle_suggestions: generateProofAngles(signalBlob)
  };
}

/* =========================
   Signal → Behavior (factory reasoning)
========================= */

function firstNonEmpty(values) {
  const list = Array.isArray(values) ? values : [values];
  for (const v of list) {
    const s = cleanString(typeof v === "string" ? v : String(v ?? ""));
    if (s) return s;
  }
  return "";
}

/**
 * Unified signal view: answers + strategy contract + **preflight_intelligence** (merged aggressively).
 * Heuristic scoring uses `text_blob`; keep preflight in sync so deriveBehavior is not generic when PI exists.
 */
function buildSignalBlob(state, strategyContract) {
  const sc = isObject(strategyContract) ? strategyContract : {};
  const answers = isObject(state?.answers) ? state.answers : {};
  const pi = isObject(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const bc = isObject(sc.business_context) ? sc.business_context : {};
  const am = isObject(sc.audience_model) ? sc.audience_model : {};
  const pm = isObject(sc.proof_model) ? sc.proof_model : {};
  const cs = isObject(sc.conversion_strategy) ? sc.conversion_strategy : {};

  const positioning = firstNonEmpty([answers.business_understanding, pi.positioning]);
  const opportunity = firstNonEmpty([answers.opportunity, pi.opportunity]);
  const websiteDirection = firstNonEmpty([answers.website_direction, pi.website_direction]);

  const aeoFirst = cleanList(answers.aeo_angles)[0] || "";
  const angle = firstNonEmpty([
    aeoFirst,
    pi.winning_angle,
    pi.differentiation_hypothesis,
    am.primary_persona
  ]);

  const objections = uniqueList([
    ...cleanList(answers.common_objections),
    ...cleanList(pm.common_objections),
    ...cleanList(pi.common_objections),
    ...cleanList(pi.weaknesses)
  ]);

  const trust = uniqueList([
    cleanString(answers.trust_signal),
    ...cleanList(answers.trust_signals),
    ...cleanList(pm.trust_signals),
    ...cleanList(pi.trust_markers)
  ]).filter(Boolean);

  const factors = uniqueList([
    ...cleanList(answers.buyer_decision_factors),
    ...cleanList(am.decision_factors),
    ...cleanList(pi.buyer_factors)
  ]);

  const persona = firstNonEmpty([answers.audience, am.primary_persona, pi.target_persona_hint]);

  const em = isObject(pi.experience_model) ? pi.experience_model : {};
  const proc = isObject(pi.process_model) ? pi.process_model : {};
  const prc = isObject(pi.pricing_model) ? pi.pricing_model : {};
  const vis = isObject(pi.visual_strategy) ? pi.visual_strategy : {};

  const textBlob = [
    cleanString(answers.primary_offer),
    cleanString(answers.differentiation),
    cleanString(opportunity),
    cleanString(positioning),
    cleanString(websiteDirection),
    cleanString(answers.process_notes),
    cleanString(answers.trust_signal),
    cleanString(answers.tone_of_voice),
    cleanString(angle),
    cleanString(pi.differentiation_hypothesis),
    cleanString(em.purchase_type),
    cleanString(em.decision_mode),
    cleanString(em.visual_importance),
    cleanString(em.trust_requirement),
    cleanString(em.pricing_behavior),
    cleanString(em.experience_rationale),
    cleanString(proc.process_narrative),
    ...cleanList(proc.buyer_anxiety),
    ...cleanList(proc.reassurance_devices),
    cleanString(prc.site_treatment),
    cleanString(prc.pricing_notes),
    cleanString(vis.gallery_story),
    ...cleanList(vis.must_show),
    ...objections,
    ...factors,
    ...cleanList(answers.aeo_angles),
    ...cleanList(pi.recommended_focus),
    ...cleanList(pi.local_alternatives)
  ]
    .join(" ")
    .toLowerCase();

  return {
    offer: cleanString(answers.primary_offer),
    model: cleanString(bc.business_model),
    positioning,
    opportunity,
    angle,
    objections,
    trust,
    tone: cleanString(answers.tone_of_voice) || inferTone(sc),
    category: cleanString(bc.category),
    persona,
    primary_conversion: cleanString(cs.primary_conversion),
    decision_factors: factors,
    text_blob: textBlob,
    experience_model: em,
    process_model: proc,
    pricing_model: prc,
    visual_strategy: vis,
    component_importance: isObject(pi.component_importance) ? pi.component_importance : {}
  };
}

/**
 * Compact strategy view for assembly (signal-driven; no industry templates).
 */
function buildStrategyModels(signalBlob) {
  const exp = isObject(signalBlob?.experience_model) ? signalBlob.experience_model : {};
  const visual = isObject(signalBlob?.visual_strategy) ? signalBlob.visual_strategy : {};
  const process = isObject(signalBlob?.process_model) ? signalBlob.process_model : {};
  const pricing = isObject(signalBlob?.pricing_model) ? signalBlob.pricing_model : {};
  const trustSignals = Array.isArray(signalBlob?.trust) ? signalBlob.trust.filter(Boolean) : [];

  const stepsEmphasis = process.steps_emphasis;
  const steps =
    Array.isArray(stepsEmphasis) && stepsEmphasis.length
      ? stepsEmphasis.map((s) => cleanString(s)).filter(Boolean)
      : cleanString(stepsEmphasis)
        ? [cleanString(stepsEmphasis)]
        : ["discover", "decide", "deliver"];

  return {
    visual_strategy: {
      type: cleanString(exp.visual_importance).toLowerCase() === "critical" ? "transformation" : "supporting",
      focus: cleanList(visual.must_show),
      intent: cleanString(visual.primary_visual_job) || "showcase work in real-world context"
    },

    process_strategy: {
      type: cleanString(exp.decision_mode).toLowerCase() === "guided" ? "consultative" : "simple",
      goal: cleanList(process.buyer_anxiety)[0] || "help customer understand what to expect",
      steps
    },

    trust_strategy: {
      type: cleanString(exp.trust_requirement).toLowerCase() === "high_technical" ? "technical_authority" : "general",
      proof: trustSignals.length ? trustSignals : ["quality", "experience", "reliability"]
    },

    pricing_strategy: {
      type: /\bvariable\b/i.test(cleanString(exp.pricing_behavior)) ? "variable" : "fixed",
      display: cleanString(pricing.site_treatment) || "standard",
      cta: cleanString(pricing.cta_alignment) || "contact"
    }
  };
}

function capitalizeStrategyStep(s) {
  const t = cleanString(s);
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function summarizeSignalBlobForBrief(blob) {
  if (!isObject(blob)) return {};
  return {
    offer: blob.offer,
    model: blob.model,
    tone: blob.tone,
    category: blob.category,
    persona: blob.persona,
    primary_conversion: blob.primary_conversion,
    positioning: blob.positioning,
    opportunity: blob.opportunity,
    angle: blob.angle,
    objection_count: Array.isArray(blob.objections) ? blob.objections.length : 0,
    trust_signal_count: Array.isArray(blob.trust) ? blob.trust.length : 0,
    decision_factor_count: Array.isArray(blob.decision_factors) ? blob.decision_factors.length : 0,
    text_blob_preview: cleanString(blob.text_blob).slice(0, 360)
  };
}

/**
 * Behavioral read on the business — human decision patterns, not NAICS codes.
 */
function deriveBehavior(signalBlob) {
  const blob = cleanString(signalBlob?.text_blob);
  const em = isObject(signalBlob?.experience_model) ? signalBlob.experience_model : {};

  let decision_style = inferDecisionStyle(signalBlob, blob);
  let trust_sensitivity = inferTrustSensitivity(signalBlob, blob);
  let complexity = inferComplexity(signalBlob, blob);
  let purchase_trigger = inferPurchaseTrigger(signalBlob, blob);

  const dm = cleanString(em.decision_mode).toLowerCase();
  if (
    dm &&
    (dm.includes("guided") ||
      dm === "guided_education" ||
      dm === "appointment_required" ||
      dm === "multi_visit_decision" ||
      dm === "committee_or_family")
  ) {
    if (complexity === "simple") complexity = "guided";
  }
  if (dm === "multi_visit_decision" || dm === "committee_or_family") {
    complexity = "expert_required";
    decision_style = "considered";
  }

  const pt = cleanString(em.purchase_type).toLowerCase();
  if (
    pt &&
    (pt.includes("consultative") ||
      pt.includes("high_stakes") ||
      pt.includes("scheduled_experience") ||
      pt.includes("relationship_ongoing"))
  ) {
    if (complexity === "simple") complexity = "guided";
    if (decision_style === "fast") decision_style = "considered";
  }

  const trq = cleanString(em.trust_requirement).toLowerCase();
  if (trq.includes("high_technical") || trq.includes("safety") || trq.includes("compliance")) {
    trust_sensitivity = "high";
  }

  const vi = cleanString(em.visual_importance).toLowerCase();
  if (vi === "critical" || vi === "high") {
    purchase_trigger = "visual";
  }

  return {
    decision_style,
    trust_sensitivity,
    complexity,
    differentiation_type: inferDifferentiationType(signalBlob, blob),
    purchase_trigger
  };
}

function inferDecisionStyle(signalBlob, blob) {
  const pc = cleanString(signalBlob?.primary_conversion).toLowerCase();
  if (pc.includes("call") || /\burgent|today|asap|right away|same day\b/.test(blob)) return "fast";
  const objN = signalBlob?.objections?.length || 0;
  const dfN = signalBlob?.decision_factors?.length || 0;
  if (/\bfeel|meaningful|care|peace of mind|family|special\b/.test(blob) || objN + dfN >= 4) {
    return "emotional";
  }
  if (objN >= 1 || dfN >= 2 || /\bcompare|research|evaluate|plan\b/.test(blob)) return "considered";
  return "considered";
}

function inferTrustSensitivity(signalBlob, blob) {
  const objN = signalBlob?.objections?.length || 0;
  if (objN >= 2 || /\bworry|concern|risk|hesitat|scam|not sure\b/.test(blob)) return "high";
  const tN = signalBlob?.trust?.length || 0;
  if (tN >= 2 || /\btrust|review|proof|credential|insured\b/.test(blob)) return "medium";
  if (objN === 0 && tN === 0 && blob.length < 80) return "low";
  return "medium";
}

function inferComplexity(signalBlob, blob) {
  const objN = signalBlob?.objections?.length || 0;
  const dfN = signalBlob?.decision_factors?.length || 0;
  if (
    objN >= 2 ||
    dfN >= 4 ||
    /\b(assess|diagnos|consult|custom|tailor|inspection|evaluation|scope|quote)\b/.test(blob)
  ) {
    return "expert_required";
  }
  if (/\b(book online|flat rate|instant|quick checkout|one tap)\b/.test(blob) && objN === 0 && dfN < 2) {
    return "simple";
  }
  return "guided";
}

function inferDifferentiationType(signalBlob, blob) {
  const scores = {
    quality: scoreKeywordGroups(blob, [/quality|craft|detail|premium|professional|careful/]),
    speed: scoreKeywordGroups(blob, [/fast|quick|rush|same day|responsive|turnaround/]),
    price: scoreKeywordGroups(blob, [/afford|budget|price|value|rate|fair/]),
    experience: scoreKeywordGroups(blob, [/experience|journey|service|relationship|white[\s-]?glove/])
  };
  let best = "experience";
  let max = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function scoreKeywordGroups(blob, patterns) {
  let n = 0;
  for (const re of patterns) {
    const m = blob.match(re);
    if (m) n += m.length;
  }
  return n;
}

function inferPurchaseTrigger(signalBlob, blob) {
  if (/\burgent|emergency|today|asap\b/.test(blob)) return "urgent";
  if (/\bphoto|gallery|before|after|see the|visual\b/.test(blob)) return "visual";
  if (/\brefer|reputation|word of mouth|local|neighbor\b/.test(blob)) return "relationship";
  const style = inferDecisionStyle(signalBlob, blob);
  if (style === "fast") return "urgent";
  return "relationship";
}

function generateProofAngles(signalBlob) {
  const out = [];
  const objections = Array.isArray(signalBlob?.objections) ? signalBlob.objections : [];
  for (const o of objections.slice(0, 3)) {
    const t = cleanString(o);
    if (!t) continue;
    out.push(`Address the worry: “${cleanSentenceFragment(t)}” with a concrete proof point on the page.`);
  }
  const firstTrust = cleanString(signalBlob?.trust?.[0]);
  if (firstTrust && out.length < 3) {
    out.push(`Echo this trust anchor in headline or proof: ${firstTrust}.`);
  }
  return out.slice(0, 4);
}

/**
 * Abstract process backbone from behavior (not vertical templates).
 */
const PI_IMPORTANCE_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

function piImportanceRank(value) {
  const v = cleanString(value).toLowerCase();
  return PI_IMPORTANCE_RANK[v] ?? 0;
}

function piImportanceAtLeast(importance, key, minLevel) {
  if (!isObject(importance)) return false;
  return piImportanceRank(importance[key]) >= piImportanceRank(minLevel);
}

/**
 * Maps preflight `process_model.steps_emphasis` to abstract process keys (not industry labels).
 */
function processShapeFromPreflightModel(processModel) {
  if (!isObject(processModel)) return null;
  const e = cleanString(processModel.steps_emphasis).toLowerCase();
  const map = {
    walk_in_simple: ["request", "confirm", "complete"],
    call_first: ["request", "confirm", "deliver"],
    schedule_consult: ["diagnose", "guide", "deliver"],
    quote_then_schedule: ["request", "confirm", "deliver"],
    deposit_milestone: ["diagnose", "guide", "deliver"],
    remote_then_in_person: ["request", "guide", "deliver"]
  };
  return map[e] || null;
}

function generateProcessShape(behavior) {
  if (behavior.complexity === "expert_required") {
    return ["diagnose", "guide", "deliver"];
  }
  if (behavior.decision_style === "fast") {
    return ["request", "confirm", "complete"];
  }
  return ["discover", "decide", "experience"];
}

function buildSyntheticProcessSteps(shape, behavior) {
  const dt = behavior.differentiation_type;
  const variant = ["quality", "speed", "price", "experience"].includes(dt) ? dt : "experience";
  const library = PROCESS_STEP_LIBRARY;
  return shape.map((key) => {
    const pack = library[key] || library.discover;
    const desc =
      pack.body[variant] ||
      pack.body.experience ||
      "We keep the workflow clear from first contact through completion.";
    return {
      title: normalizePublicText(pack.title),
      description: normalizePublicText(cleanSentence(desc))
    };
  });
}

const PROCESS_STEP_LIBRARY = {
  diagnose: {
    title: "Understand goals and constraints",
    body: {
      quality:
        "We start by clarifying priorities, fit, and the quality standard you want so the plan matches reality.",
      speed:
        "We align quickly on timing, urgent needs, and the fastest safe path from first contact to completion.",
      price:
        "We define scope and options early so pricing stays understandable before work begins.",
      experience:
        "We begin by mapping what you need, what success looks like, and any constraints that should shape the plan."
    }
  },
  guide: {
    title: "Choose the right approach",
    body: {
      quality:
        "We recommend an approach that protects craftsmanship and sets expectations before work starts.",
      speed:
        "We lock the leanest sequence that still protects the outcome, with clear checkpoints along the way.",
      price:
        "We match the plan to your budget band and tradeoffs so there are no surprises midstream.",
      experience:
        "We recommend a path that fits your situation, then confirm details so expectations stay aligned."
    }
  },
  deliver: {
    title: "Deliver with care",
    body: {
      quality:
        "Execution focuses on detail, finish, and a result that holds up to scrutiny.",
      speed:
        "Work moves efficiently with proactive updates so you always know what happens next.",
      price:
        "Delivery stays within the agreed scope and communicates value clearly at handoff.",
      experience:
        "We carry the work through completion with communication, care, and a clean finish."
    }
  },
  request: {
    title: "Start with a simple request",
    body: {
      quality:
        "You reach out with the basics; we respond with a clear sense of fit and next steps.",
      speed:
        "You make a fast first move; we confirm timing and priorities immediately.",
      price:
        "You share enough for a realistic range or quote path before anything is locked in.",
      experience:
        "You reach out with what you need; we respond quickly with a human, helpful next step."
    }
  },
  confirm: {
    title: "Confirm the plan",
    body: {
      quality:
        "We confirm scope and standards so quality expectations are explicit before work begins.",
      speed:
        "We lock the essentials in one pass so momentum doesn’t stall on back-and-forth.",
      price:
        "We confirm what’s included, timing, and price bands so the agreement feels transparent.",
      experience:
        "We align on scope, timing, and responsibilities so everyone shares the same picture."
    }
  },
  complete: {
    title: "Complete and follow through",
    body: {
      quality:
        "Work finishes with a careful handoff and attention to the details that matter most.",
      speed:
        "We close the loop quickly with clear completion and any quick fixes if needed.",
      price:
        "We finish within the agreed scope and make sure value landed as expected.",
      experience:
        "We complete the work with clear communication and a polished handoff you can trust."
    }
  },
  discover: {
    title: "Explore fit",
    body: {
      quality:
        "You learn how the work is done, what quality means here, and whether it matches your bar.",
      speed:
        "You see how fast we can move and what we need from you to keep things on track.",
      price:
        "You understand options and ranges early so you can decide comfortably.",
      experience:
        "You get a clear feel for how it feels to work together before you commit."
    }
  },
  decide: {
    title: "Decide with confidence",
    body: {
      quality:
        "You choose a path that reflects the level of care and finish you want.",
      speed:
        "You pick timing and priorities so the next steps stay simple and predictable.",
      price:
        "You select an option that fits your budget without hiding tradeoffs.",
      experience:
        "You choose next steps with enough clarity that the decision feels grounded, not rushed."
    }
  },
  experience: {
    title: "Experience the outcome",
    body: {
      quality:
        "Delivery focuses on a result you’re proud to show off and that matches what was promised.",
      speed:
        "You get a fast, clean finish with minimal friction at handoff.",
      price:
        "The outcome matches the agreed scope and feels worth what you invested.",
      experience:
        "The experience ends with a result that matches the story the site told up front."
    }
  }
};

/* =========================
   Strategy toggles (behavior-first, schema_toggles = opt-out hints)
========================= */

/**
 * Preflight can set schema_toggles.show_x = false to suppress a section.
 * true/undefined does not override behavior-driven visibility.
 */
function toggleOptOut(schemaToggles, key, computedShow) {
  if (schemaToggles?.[key] === false) return false;
  return Boolean(computedShow);
}

function shouldShowProcess({ behavior, processSteps, componentImportance }) {
  if (piImportanceAtLeast(componentImportance, "process", "high")) return true;
  const steps = Array.isArray(processSteps) ? processSteps : [];
  if (steps.length >= 3) return true;
  if (behavior?.complexity && behavior.complexity !== "simple") return true;
  return false;
}

function shouldShowTestimonials({ behavior, testimonials, componentImportance }) {
  if (piImportanceAtLeast(componentImportance, "testimonials", "high")) return true;
  const list = Array.isArray(testimonials) ? testimonials : [];
  if (list.length >= 2) return true;
  if (behavior?.trust_sensitivity === "high" && list.length >= 1) return true;
  return false;
}

function shouldShowTrustbar({ behavior, trustbar }) {
  const n = trustbar?.items?.length ?? 0;
  if (n >= 2) return true;
  if (behavior?.trust_sensitivity === "high" && n >= 1) return true;
  return false;
}

function shouldShowGallery({ behavior, gallery, experienceModel }) {
  const vi = cleanString(experienceModel?.visual_importance).toLowerCase();
  if (vi === "critical" || vi === "high") return true;
  const items = gallery?.items;
  const n = Array.isArray(items) ? items.length : 0;
  if (n >= 3) return true;
  if (behavior?.purchase_trigger === "visual" && n >= 1) return true;
  return false;
}

function shouldShowInvestmentSection(state, strategyContract) {
  const pi = isObject(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const ci = isObject(pi.component_importance) ? pi.component_importance : {};
  const pm = isObject(pi.pricing_model) ? pi.pricing_model : {};
  const em = isObject(pi.experience_model) ? pi.experience_model : {};
  if (piImportanceAtLeast(ci, "investment", "medium")) return true;
  if (piImportanceAtLeast(ci, "pricing_section", "high")) return true;
  const pb = cleanString(em.pricing_behavior).toLowerCase();
  if (pb.includes("transparent_list") || pb.includes("starting_at")) return true;
  const rk = cleanString(pm.risk_language).toLowerCase();
  if (rk.includes("full_transparency")) return true;
  return false;
}

function shouldShowFaqs({ behavior, faqs }) {
  const list = Array.isArray(faqs) ? faqs : [];
  if (list.length >= 3) return true;
  if (behavior?.decision_style === "considered" && list.length >= 1) return true;
  return false;
}

/* =========================
   Main Assembly
========================= */

function buildBusinessJson(state, strategyContract, strategyBrief) {
  const businessName =
    cleanString(state.businessName) ||
    cleanString(strategyContract.business_context?.business_name) ||
    "Business Name";

  const slug = cleanString(state.slug) || normalizeSlug(businessName);
  const email =
    cleanString(state.clientEmail) ||
    cleanString(state.answers?.email) ||
    "contact@example.com";

  const phone = cleanString(state.answers?.phone);
  const bookingUrl = cleanString(state.answers?.booking_url);
  const officeAddress = cleanString(state.answers?.office_address);

  const category = cleanString(strategyContract.business_context?.category) || "Service business";
  const targetAudience =
    cleanString(state.answers?.audience) ||
    cleanString(strategyContract.audience_model?.primary_persona) ||
    "Customers seeking a trusted provider";

  const tone =
    cleanString(state.answers?.tone_of_voice) ||
    inferTone(strategyContract) ||
    "Professional, clear, trustworthy";

  const vibe = selectVibe(SCHEMA_VIBES, strategyContract, state);

  const signalBlob = buildSignalBlob(state, strategyContract);
  const strategyModels = buildStrategyModels(signalBlob);
  const behavior =
    isObject(strategyBrief?.derived_behavior) && strategyBrief.derived_behavior
      ? strategyBrief.derived_behavior
      : deriveBehavior(signalBlob);

  const trustbar = buildTrustbar(state, strategyContract);
  let features = buildFeatures(state, strategyContract);
  let processSteps = buildProcessSteps(state, strategyContract, behavior);

  if (!processSteps.length && strategyModels.process_strategy.type === "consultative") {
    processSteps = strategyModels.process_strategy.steps.map((s) => ({
      title: capitalizeStrategyStep(s),
      description: "We guide you through each step so you feel confident in every decision."
    }));
  }

  processSteps = enhanceProcessSteps(processSteps, signalBlob, behavior).map((s) => ({
    ...s,
    description: normalizePublicText(s.description)
  }));
  features = enhanceFeatures(features, signalBlob, behavior).map((f) => ({
    ...f,
    description: normalizePublicText(f.description)
  }));

  if (strategyModels.trust_strategy.type === "technical_authority") {
    features.push({
      title: "Expert Craftsmanship",
      description: "Using professional-grade materials and proven techniques.",
      icon_slug: pickFeatureIcon("Expert Craftsmanship professional-grade materials", features.length)
    });
  }

  let gallery = buildGallery(state, strategyContract, vibe);

  const galleryQueries = buildFallbackGalleryQueries(state, strategyContract, vibe);
  const hasExplicitGallery =
    (Array.isArray(state.answers?.gallery_items) && state.answers.gallery_items.some((x) => isObject(x))) ||
    cleanList(state.answers?.gallery_queries).length > 0;

  if (!hasExplicitGallery && Array.isArray(galleryQueries) && galleryQueries.length) {
    gallery = normalizeGalleryShape(
      {
        enabled: true,
        items: galleryQueries.map((q, idx) => ({
          title: galleryTitleFromQuery(q, idx),
          image_search_query: q
        })),
        image_source: { image_search_query: galleryQueries[0] || "" }
      },
      true,
      strategyContract,
      vibe,
      state
    );
  }

  const testimonials = buildTestimonials(state, strategyContract);
  const faqs = buildFaqs(state, strategyContract);
  const serviceArea = buildServiceArea(state, strategyContract);

  const schemaToggles = isObject(strategyContract.schema_toggles) ? strategyContract.schema_toggles : {};
  const pi = isObject(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const ci = isObject(pi.component_importance) ? pi.component_importance : {};
  const emPi = isObject(pi.experience_model) ? pi.experience_model : {};
  const pmPi = isObject(pi.pricing_model) ? pi.pricing_model : {};

  const toggles = {
    show_trustbar: toggleOptOut(schemaToggles, "show_trustbar", shouldShowTrustbar({ behavior, trustbar })),
    show_about: toggleOptOut(schemaToggles, "show_about", true),
    show_features: toggleOptOut(schemaToggles, "show_features", true),
    show_events: toggleOptOut(
      schemaToggles,
      "show_events",
      piImportanceAtLeast(ci, "events_or_booking", "medium")
    ),
    show_process: toggleOptOut(
      schemaToggles,
      "show_process",
      shouldShowProcess({ behavior, processSteps, componentImportance: ci })
    ),
    show_testimonials: toggleOptOut(
      schemaToggles,
      "show_testimonials",
      shouldShowTestimonials({ behavior, testimonials, componentImportance: ci }) && testimonials.length > 0
    ),
    show_comparison: toggleOptOut(
      schemaToggles,
      "show_comparison",
      piImportanceAtLeast(ci, "comparison", "medium")
    ),
    show_gallery: toggleOptOut(
      schemaToggles,
      "show_gallery",
      shouldShowGallery({ behavior, gallery, experienceModel: emPi }) && Boolean(gallery)
    ),
    show_investment: toggleOptOut(
      schemaToggles,
      "show_investment",
      shouldShowInvestmentSection(state, strategyContract)
    ),
    show_faqs: toggleOptOut(schemaToggles, "show_faqs", shouldShowFaqs({ behavior, faqs }) && faqs.length > 0),
    show_service_area: toggleOptOut(schemaToggles, "show_service_area", Boolean(serviceArea))
  };

  let hero = {
    headline: normalizePublicText(resolveHeroHeadline(state, businessName)),
    subtext: normalizePublicText(resolveHeroSubtext(state, strategyContract)),
    image: {
      alt: normalizePublicText(resolveHeroImageAlt(state, businessName)),
      image_search_query: ""
    }
  };
  hero = enhanceHero(hero, signalBlob, behavior);
  hero.headline = normalizePublicText(hero.headline);
  hero.subtext = normalizePublicText(hero.subtext);

  if (!cleanString(hero.headline) && strategyModels.visual_strategy.type === "transformation") {
    hero.headline = normalizePublicText("Designed to showcase and preserve what matters most");
  }

  // --- IMAGE QUERY PIPELINE (AUTHORITATIVE) — signalBlob + strategyModels already built above ---
  const heroQuery = buildHeroImageQuery(state, strategyContract, vibe);
  if (hero?.image) {
    hero.image.image_search_query = heroQuery;
  }

  const sections = {
    about: true,
    features,
    processSteps,
    testimonials,
    gallery,
    faqs,
    service_area: serviceArea
  };

  return {
    intelligence: {
      industry: normalizePublicText(category),
      target_persona: normalizePublicText(targetAudience),
      tone_of_voice: normalizePublicText(tone),
      derived_behavior: behavior
    },

    strategy: toggles,

    settings: {
      vibe,
      menu: buildMenu(toggles, sections),
      cta_text: normalizePublicText(
        cleanString(state.answers?.cta_text) ||
        (strategyModels.pricing_strategy.type === "variable" ? "Request a Consultation" : "") ||
        inferPrimaryCtaText(strategyContract, bookingUrl, pmPi, emPi)
      ),
      cta_link: bookingUrl || cleanString(state.answers?.cta_link) || "#contact",
      cta_type: bookingUrl ? "external" : inferCtaType(cleanString(state.answers?.cta_link) || "#contact"),
      secondary_cta_text: normalizePublicText(inferSecondaryCtaText(strategyContract, phone)),
      secondary_cta_link: inferSecondaryCtaLink(phone, bookingUrl)
    },

    brand: {
      name: normalizePublicText(businessName),
      slug,
      tagline: normalizePublicText(resolveTagline(state, strategyContract, businessName)),
      email,
      phone,
      office_address: normalizePublicText(officeAddress),
      objection_handle: normalizePublicText(resolveObjectionHandle(state, strategyContract))
    },

    hero,

    about: {
      story_text: normalizePublicText(resolveAboutStory(state, businessName)),
      founder_note: normalizePublicText(resolveFounderNote(state)),
      years_experience: normalizePublicText(resolveYearsExperience(state, strategyContract))
    },

    ...(trustbar ? { trustbar } : {}),
    features,
    ...(processSteps.length ? { processSteps } : {}),
    ...(gallery ? { gallery } : {}),

    contact: {
      headline: "Get in Touch",
      subheadline: normalizePublicText(resolveContactSubheadline(state, strategyContract)),
      email,
      phone,
      email_recipient: email,
      button_text: normalizePublicText(inferContactButtonText(strategyContract, bookingUrl, pmPi, emPi)),
      office_address: normalizePublicText(officeAddress)
    },

    ...(serviceArea ? { service_area: serviceArea } : {}),
    ...(testimonials.length ? { testimonials } : {}),
    ...(faqs.length ? { faqs } : {})
  };
}

/* =========================
   Section Builders
========================= */

function buildMenu(toggles, sections) {
  const items = [{ label: "Home", path: "#home" }];

  if (toggles.show_about && sections.about) items.push({ label: "About", path: "#about" });
  if (toggles.show_features && Array.isArray(sections.features) && sections.features.length) {
    items.push({ label: "Services", path: "#features" });
  }
  if (toggles.show_process && Array.isArray(sections.processSteps) && sections.processSteps.length >= 3) {
    items.push({ label: "Process", path: "#process" });
  }
  if (toggles.show_testimonials && Array.isArray(sections.testimonials) && sections.testimonials.length) {
    items.push({ label: "Reviews", path: "#testimonials" });
  }
  if (toggles.show_gallery && sections.gallery && Array.isArray(sections.gallery.items) && sections.gallery.items.length) {
    items.push({ label: "Gallery", path: "#gallery" });
  }
  if (toggles.show_faqs && Array.isArray(sections.faqs) && sections.faqs.length) {
    items.push({ label: "FAQ", path: "#faqs" });
  }
  if (toggles.show_service_area && sections.service_area && cleanString(sections.service_area.main_city)) {
    items.push({ label: "Area", path: "#service-area" });
  }

  items.push({ label: "Contact", path: "#contact" });

  return items
    .filter((item) => ALLOWED_MENU_PATHS.includes(item.path))
    .slice(0, 8);
}

function buildTrustbar(state, strategyContract) {
  const trustSeeds = uniqueList([
    cleanString(state.answers?.trust_signal),
    ...cleanList(strategyContract.proof_model?.trust_signals),
    ...cleanList(strategyContract.proof_model?.credibility_sources)
  ]).slice(0, 4);

  const items = trustSeeds
    .map((label, idx) => {
      const normalized = normalizeTrustbarLabel(label);
      if (!normalized) return null;
      return {
        label: normalizePublicText(normalized),
        icon: pickTrustbarIcon(label, idx)
      };
    })
    .filter(Boolean);

  if (items.length < 2) {
    items.push(
      { label: "Trusted Service", icon: "shield" },
      { label: "Customer Focused", icon: "heart" }
    );
  }

  return items.length ? { enabled: true, items: items.slice(0, 4) } : null;
}

function buildFeatures(state, strategyContract) {
  const features = [];
  const primaryOffer = cleanString(state.answers?.primary_offer);
  const differentiation = cleanString(state.answers?.differentiation);
  const serviceDescriptions = cleanString(state.answers?.service_descriptions);
  const decisionFactors = cleanList(state.answers?.buyer_decision_factors);
  const contractDecisionFactors = cleanList(strategyContract.audience_model?.decision_factors);

  const serviceBullets = inferServiceBullets(primaryOffer, serviceDescriptions, strategyContract);
  for (const bullet of serviceBullets) {
    features.push({
      title: normalizePublicText(bullet.title),
      description: normalizePublicText(bullet.description),
      icon_slug: pickFeatureIcon(`${bullet.title} ${bullet.description}`, features.length)
    });
  }

  if (differentiation) {
    features.push({
      title: normalizePublicText(normalizeDifferentiatorTitle(differentiation)),
      description: normalizePublicText(cleanSentence(differentiation)),
      icon_slug: pickFeatureIcon(differentiation, features.length)
    });
  }

  const factors = uniqueList([...decisionFactors, ...contractDecisionFactors]).slice(0, 2);
  for (const factor of factors) {
    const mapped = mapDecisionFactorToFeature(factor);
    if (!mapped) continue;
    features.push({
      title: normalizePublicText(mapped.title),
      description: normalizePublicText(mapped.description),
      icon_slug: pickFeatureIcon(`${mapped.title} ${mapped.description}`, features.length)
    });
  }

  const deduped = uniqueObjectsByTitle(features).slice(0, 6);

  while (deduped.length < 3) {
    deduped.push({
      title: `Service Highlight ${deduped.length + 1}`,
      description: "Clear, professional work designed to make the next step easy.",
      icon_slug: pickFeatureIcon("", deduped.length)
    });
  }

  return deduped;
}

function buildProcessSteps(state, strategyContract, behavior) {
  const signalBlob = buildSignalBlob(state, strategyContract);
  const b =
    isObject(behavior) && behavior
      ? behavior
      : deriveBehavior(signalBlob);

  const pi = isObject(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const pm = isObject(pi.process_model) ? pi.process_model : {};
  const ci = isObject(pi.component_importance) ? pi.component_importance : {};
  const processBoost =
    piImportanceAtLeast(ci, "process", "medium") || cleanString(pm.process_narrative).length > 20;

  if (b.complexity === "simple" && !processBoost) {
    return [];
  }

  const source = cleanString(state.answers?.process_notes);
  const extracted = extractProcessSteps(source);

  if (extracted.length >= 3) {
    return extracted.slice(0, 5).map((step, idx) => ({
      title: normalizePublicText(step.title || inferProcessStepTitle(step.description, idx)),
      description: normalizePublicText(cleanSentence(step.description))
    }));
  }

  const narrative = cleanString(pm.process_narrative);
  if (narrative && narrative.length > 40) {
    const sentences = narrative
      .split(/\.\s+/)
      .map((s) => cleanSentence(s && !/[.!?]$/.test(s.trim()) ? `${s}.` : s))
      .filter(Boolean)
      .slice(0, 4);
    if (sentences.length >= 3) {
      return sentences.map((desc, idx) => ({
        title: normalizePublicText(inferProcessStepTitle(desc, idx)),
        description: normalizePublicText(desc)
      }));
    }
  }

  const fromPreflight = processShapeFromPreflightModel(pm);
  const shape = fromPreflight || generateProcessShape(b);
  const synthetic = buildSyntheticProcessSteps(shape, b);
  return synthetic.length >= 3 ? synthetic : [];
}

function buildGallery(state, strategyContract, vibe) {
  const explicitQueries = cleanList(state.answers?.gallery_queries);
  const explicitItems = Array.isArray(state.answers?.gallery_items) ? state.answers.gallery_items : [];

  let items = explicitItems
    .map((item, idx) => {
      if (!isObject(item)) return null;
      const query = clampWords(cleanString(item.image_search_query), 4, 8);
      if (!query) return null;
      return {
        title: normalizePublicText(cleanString(item.title) || `Project ${idx + 1}`),
        image_search_query: query
      };
    })
    .filter(Boolean);

  if (!items.length && explicitQueries.length) {
    items = explicitQueries.map((query, idx) => ({
      title: `Project ${idx + 1}`,
      image_search_query: clampWords(query, 4, 8)
    }));
  }

  if (!items.length) return null;

  const normalized = normalizeGalleryShape(
    {
      enabled: true,
      items,
      image_source: { image_search_query: items[0]?.image_search_query || "" }
    },
    true,
    strategyContract,
    vibe,
    state
  );

  return normalized;
}

function buildFaqs(state, strategyContract) {
  const topics = uniqueList([
    ...cleanList(state.answers?.common_objections),
    ...cleanList(state.answers?.buyer_decision_factors),
    ...cleanList(state.answers?.faq_topics),
    ...cleanList(state.answers?.faq_angles),
    ...cleanList(strategyContract.site_structure?.faq_angles),
    ...cleanList(strategyContract.audience_model?.common_objections),
    ...cleanList(strategyContract.audience_model?.decision_factors)
  ])
    .map((item) => normalizeFaqQuestion(item))
    .filter(Boolean)
    .slice(0, 6);

  return topics.map((question) => ({
    question: ensureQuestion(normalizePublicText(question)),
    answer: normalizePublicText(inferFaqAnswer(question, state, strategyContract))
  }));
}

function buildTestimonials(state, strategyContract) {
  const provided =
    Array.isArray(state.answers?.testimonials) ? state.answers.testimonials :
    Array.isArray(state.ghostwritten?.testimonials) ? state.ghostwritten.testimonials :
    [];

  const normalized = provided
    .map((item, idx) => {
      if (typeof item === "string") {
        return {
          quote: normalizePublicText(item),
          author: `Happy Client ${idx + 1}`
        };
      }
      if (!isObject(item)) return null;
      const quote = cleanString(item.quote);
      const author = cleanString(item.author) || `Happy Client ${idx + 1}`;
      if (!quote) return null;
      return {
        quote: normalizePublicText(quote),
        author: normalizePublicText(author)
      };
    })
    .filter(Boolean);

  if (normalized.length) return normalized.slice(0, 3);

  const status = cleanString(state.answers?.testimonials_status).toLowerCase();
  if (status.includes("not yet")) return [];

  const praise = inferPraiseThemes(state, strategyContract);

  return praise.slice(0, 2).map((theme, idx) => ({
    quote: normalizePublicText(theme),
    author: `Happy Client ${idx + 1}`
  }));
}

function buildServiceArea(state, strategyContract) {
  const mainCity =
    cleanString(state.answers?.service_area) ||
    cleanList(strategyContract.business_context?.service_area)[0] ||
    cleanList(strategyContract.source_snapshot?.nap_recommendation?.service_area)[0];

  if (!mainCity) return null;

  return {
    main_city: normalizePublicText(mainCity),
    surrounding_areas: uniqueList([
      ...cleanList(state.answers?.service_areas),
      ...cleanList(strategyContract.business_context?.service_area),
      ...cleanList(strategyContract.source_snapshot?.nap_recommendation?.service_area)
    ])
      .filter((value) => value && value !== mainCity)
      .map((value) => normalizePublicText(value))
      .slice(0, 6)
  };
}

/* =========================
   Hero / Copy Resolution
========================= */

function resolveTagline(state, strategyContract, businessName) {
  return (
    cleanString(state.answers?.tagline) ||
    cleanString(strategyContract.source_snapshot?.primary_offer_hint) ||
    cleanString(state.answers?.primary_offer) ||
    businessName
  );
}

function resolveHeroHeadline(state, businessName) {
  return (
    cleanString(state.ghostwritten?.hero_headline) ||
    cleanString(state.answers?.hero_headline) ||
    cleanString(state.answers?.primary_offer) ||
    businessName
  );
}

function resolveHeroSubtext(state, strategyContract) {
  return (
    cleanString(state.ghostwritten?.hero_subheadline) ||
    cleanString(state.answers?.hero_subheadline) ||
    buildPremiumHeroSubtext(state, strategyContract)
  );
}

function buildPremiumHeroSubtext(state, strategyContract) {
  const audience = cleanString(state.answers?.audience);
  const area = cleanString(state.answers?.service_area);
  const differentiation = cleanString(state.answers?.differentiation);
  const bookingMethod = cleanString(state.answers?.booking_method);

  const sentenceA = differentiation
    ? cleanSentenceFragment(differentiation)
    : cleanSentenceFragment(cleanString(state.answers?.website_direction));

  const sentenceB = audience && area
    ? `Serving ${area} for ${audience}.`
    : area
      ? `Serving ${area}.`
      : audience
        ? `Designed for ${audience}.`
        : "";

  const sentenceC =
    bookingMethod.includes("quote")
      ? "Request a quote and we’ll guide you from there."
      : bookingMethod.includes("call")
        ? "Reach out directly and we’ll help you get started."
        : "Reach out and we’ll help you take the next step.";

  return [sentenceA, sentenceB, sentenceC]
    .filter(Boolean)
    .map(cleanSentence)
    .join(" ");
}

function resolveHeroImageAlt(state, businessName) {
  return (
    cleanString(state.answers?.hero_image_alt) ||
    cleanString(state.answers?.primary_offer) ||
    businessName
  );
}

function resolveAboutStory(state, businessName) {
  return (
    cleanString(state.answers?.business_understanding) ||
    cleanString(state.answers?.about_story) ||
    `${businessName} is built around clear communication, reliable service, and a better customer experience.`
  );
}

function resolveFounderNote(state) {
  return (
    cleanString(state.answers?.founder_bio) ||
    "Built for people who value quality, clarity, and a smooth process."
  );
}

function resolveYearsExperience(state, strategyContract) {
  return (
    normalizeYearsExperience(cleanString(state.answers?.experience_years)) ||
    normalizeYearsExperience(cleanString(strategyContract.business_context?.years_experience)) ||
    "Experienced professional service"
  );
}

function resolveContactSubheadline(state, strategyContract) {
  return (
    cleanString(state.answers?.contact_subheadline) ||
    inferContactSubheadline(state, strategyContract)
  );
}

function resolveObjectionHandle(state, strategyContract) {
  const first =
    cleanString(cleanList(state.answers?.common_objections)[0]).toLowerCase() ||
    cleanString(cleanList(strategyContract.audience_model?.common_objections)[0]).toLowerCase();

  if (first.includes("cost") || first.includes("price")) {
    return "Clear quotes and honest expectations from the start.";
  }
  if (first.includes("trust") || first.includes("reputation")) {
    return "Clear communication and dependable service you can feel good about.";
  }
  if (first.includes("availability") || first.includes("schedule")) {
    return "Responsive scheduling and dependable follow-through.";
  }

  return "Clear communication, dependable service, and quality work.";
}

/* =========================
   Image Logic
========================= */

function ensureInspirationQueries(data, state, strategyContract) {
  const resolvedVibe = cleanString(data?.settings?.vibe);

  if (data?.strategy?.show_gallery) {
    data.gallery = data.gallery || { enabled: true, items: [] };
    data.gallery.enabled = true;

    if (!Array.isArray(data.gallery.items)) data.gallery.items = [];

    const count = Number(
      data.gallery.computed_count ||
      data.gallery.items.length ||
      inferPremiumGalleryCount(strategyContract, state, resolvedVibe)
    );

    const pool = data.gallery.items
      .map((it) => cleanString(it?.image_search_query))
      .filter(Boolean);

    while (data.gallery.items.length < count && pool.length) {
      const idx = data.gallery.items.length;
      data.gallery.items.push({
        title: `Project ${idx + 1}`,
        image_search_query: pool[idx % pool.length]
      });
    }

    data.gallery.items = data.gallery.items.map((it, i) => {
      const title = String(it?.title || galleryTitleFromQuery(it?.image_search_query, i));
      const q = String(it?.image_search_query || "").trim();
      return {
        ...it,
        title,
        image_search_query: q || pool[i % pool.length] || ""
      };
    });

    if (!isObject(data.gallery.image_source)) {
      data.gallery.image_source = {};
    }

    if (!cleanString(data.gallery.image_source.image_search_query)) {
      data.gallery.image_source.image_search_query =
        data.gallery.items[0]?.image_search_query || "";
    }
  } else if (data.gallery) {
    data.gallery.enabled = Boolean(data.gallery.enabled);
  }

  return data;
}

/* =========================
   Validation
========================= */

function validateBusinessJson(data) {
  const issues = [];

  const reqTop = ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"];
  for (const key of reqTop) {
    if (!data?.[key]) issues.push(`Missing top-level "${key}"`);
  }

  for (const key of ["industry", "target_persona", "tone_of_voice"]) {
    if (!cleanString(data?.intelligence?.[key])) issues.push(`Missing intelligence.${key}`);
  }

  if (!SCHEMA_VIBES.includes(cleanString(data?.settings?.vibe))) {
    issues.push("settings.vibe must be one of allowed enum values");
  }

  for (const key of ["cta_text", "cta_link", "cta_type"]) {
    if (!cleanString(data?.settings?.[key])) issues.push(`Missing settings.${key}`);
  }

  if (!Array.isArray(data?.settings?.menu) || !data.settings.menu.length) {
    issues.push("settings.menu must be a non-empty array");
  } else {
    data.settings.menu.forEach((item, idx) => {
      if (!cleanString(item?.label)) issues.push(`settings.menu[${idx}].label missing`);
      if (!ALLOWED_MENU_PATHS.includes(cleanString(item?.path))) {
        issues.push(`settings.menu[${idx}].path invalid: ${item?.path}`);
      }
    });
  }

  for (const key of ["name", "tagline", "email"]) {
    if (!cleanString(data?.brand?.[key])) issues.push(`Missing brand.${key}`);
  }

  for (const key of ["headline", "subtext"]) {
    if (!cleanString(data?.hero?.[key])) issues.push(`Missing hero.${key}`);
  }

  if (!cleanString(data?.hero?.image?.alt)) issues.push("Missing hero.image.alt");
  if (!cleanString(data?.hero?.image?.image_search_query)) issues.push("Missing hero.image.image_search_query");

  for (const key of ["story_text", "founder_note", "years_experience"]) {
    if (!cleanString(data?.about?.[key])) issues.push(`Missing about.${key}`);
  }

  if (!Array.isArray(data?.features) || data.features.length < 3) {
    issues.push("features must be an array with at least 3 items");
  } else {
    data.features.forEach((item, idx) => {
      for (const key of ["title", "description", "icon_slug"]) {
        if (!cleanString(item?.[key])) issues.push(`features[${idx}].${key} missing`);
      }
      if (!ALLOWED_ICON_TOKENS.includes(cleanString(item?.icon_slug))) {
        issues.push(`features[${idx}].icon_slug invalid: ${item?.icon_slug}`);
      }
    });
  }

  for (const key of ["headline", "subheadline", "email_recipient", "button_text"]) {
    if (!cleanString(data?.contact?.[key])) issues.push(`Missing contact.${key}`);
  }

  if (data?.strategy?.show_gallery) {
    if (!data?.gallery?.enabled) issues.push("strategy.show_gallery=true but gallery.enabled is not true");
    if (!Array.isArray(data?.gallery?.items) || !data.gallery.items.length) {
      issues.push("gallery.items must be a non-empty array when gallery enabled");
    } else {
      data.gallery.items.forEach((item, idx) => {
        if (!cleanString(item?.title)) issues.push(`gallery.items[${idx}].title missing`);
        if (!cleanString(item?.image_search_query)) issues.push(`gallery.items[${idx}].image_search_query missing`);
      });
    }
  }

  if (data?.trustbar) {
    if (typeof data.trustbar.enabled !== "boolean") issues.push("trustbar.enabled must be boolean");
    if (!Array.isArray(data.trustbar.items) || data.trustbar.items.length < 2) {
      issues.push("trustbar.items must have 2+ items when trustbar exists");
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

/* =========================
   Readiness / V2 Gating
========================= */

function evaluateNarrativeReadiness(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  const satisfiedBlocks = [];
  const remainingBlocks = [];

  for (const block of model.must_express) {
    if (isBlockSatisfied(state, block)) satisfiedBlocks.push(block);
    else remainingBlocks.push(block);
  }

  const total = model.must_express.length || 1;
  return {
    score: Number((satisfiedBlocks.length / total).toFixed(2)),
    can_generate_now: remainingBlocks.length === 0,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks
  };
}

function evaluateEnrichment(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  const satisfiedBlocks = [];
  const remainingBlocks = [];

  for (const block of model.premium_enrichment) {
    if (isBlockSatisfied(state, block)) satisfiedBlocks.push(block);
    else remainingBlocks.push(block);
  }

  const total = model.premium_enrichment.length || 1;
  return {
    score: Number((satisfiedBlocks.length / total).toFixed(2)),
    ready_for_preview: remainingBlocks.length <= model.preview_tolerance,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks
  };
}

function getNarrativeModel(category) {
  const models = {
    service: {
      must_express: ["what_it_is", "who_its_for", "why_trust_it", "what_to_do_next"],
      premium_enrichment: ["differentiation", "service_specificity", "process_clarity", "proof_depth", "faq_substance"],
      preview_tolerance: 1
    },
    event: {
      must_express: ["what_it_is", "who_its_for", "when_where", "what_to_do_next"],
      premium_enrichment: ["agenda_or_format", "urgency_or_reason_now", "proof_depth", "faq_substance"],
      preview_tolerance: 1
    },
    coach: {
      must_express: ["what_it_is", "who_its_for", "transformation", "what_to_do_next"],
      premium_enrichment: ["method_clarity", "proof_depth", "offer_specificity", "faq_substance"],
      preview_tolerance: 1
    },
    portfolio: {
      must_express: ["what_it_is", "who_its_for", "proof_of_quality", "what_to_do_next"],
      premium_enrichment: ["style_or_positioning", "projects_or_examples", "process_clarity", "about_depth"],
      preview_tolerance: 1
    }
  };

  return models[category] || models.service;
}

const BLOCK_MAP = {
  what_it_is: ["primary_offer", "business_understanding", "website_direction"],
  who_its_for: ["audience"],
  why_trust_it: ["trust_signal", "testimonials_status", "photos_status"],
  what_to_do_next: ["contact_path", "booking_method", "cta_text", "cta_link"],
  when_where: ["service_area", "service_areas", "hours"],
  transformation: ["primary_offer", "differentiation"],
  proof_of_quality: ["trust_signal", "testimonials_status", "photos_status", "gallery_queries"],

  differentiation: ["differentiation"],
  service_specificity: ["service_descriptions"],
  process_clarity: ["process_notes"],
  proof_depth: ["testimonials_status", "photos_status", "trust_signal"],
  faq_substance: ["common_objections", "buyer_decision_factors", "faq_angles"],
  agenda_or_format: ["service_descriptions", "process_notes"],
  urgency_or_reason_now: ["peak_season_availability", "hours"],
  method_clarity: ["process_notes", "service_descriptions"],
  offer_specificity: ["pricing_structure", "service_descriptions"],
  style_or_positioning: ["differentiation", "website_direction"],
  projects_or_examples: ["gallery_queries", "photos_status"],
  about_depth: ["founder_bio"]
};

function isBlockSatisfied(state, block) {
  const fields = BLOCK_MAP[block] || [];
  return fields.some((field) => hasMeaningfulValue(state.answers[field]));
}

/* =========================
   Submit
========================= */

async function trySubmitBusinessJson(request, payload) {
  const url = new URL(request.url);
  const submitUrl = `${url.origin}/api/submit`;

  const res = await fetch(submitUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    response: parsed
  };
}

/* =========================
   Premium Builders
========================= */

function inferServiceBullets(primaryOffer, serviceDescriptions, strategyContract) {
  const bullets = [];
  const offer = cleanString(primaryOffer).toLowerCase();
  const descriptions = cleanString(serviceDescriptions).toLowerCase();
  const category = cleanString(strategyContract.business_context?.category).toLowerCase();

  if (offer.includes("window cleaning") || category.includes("window")) {
    bullets.push(
      {
        title: "Exterior Window Cleaning",
        description: "Detailed cleaning designed to leave large glass surfaces clear, bright, and streak-free."
      },
      {
        title: "Glass Restoration",
        description: "Restore clarity and improve the look of weathered or hard-water-marked glass."
      },
      {
        title: "Premium Home Service",
        description: "Professional service for larger homes where detail, care, and presentation matter."
      }
    );
  }

  if (descriptions.includes("large homes") || descriptions.includes("big glass")) {
    bullets.push({
      title: "Large-Home Expertise",
      description: "Comfortable with larger residential properties, expansive glass, and high-visibility details."
    });
  }

  if (descriptions.includes("white-glove") || descriptions.includes("professionalism")) {
    bullets.push({
      title: "White-Glove Experience",
      description: "Clear communication, careful work practices, and a polished customer experience from start to finish."
    });
  }

  return uniqueObjectsByTitle(bullets);
}

function mapDecisionFactorToFeature(factor) {
  const value = cleanString(factor).toLowerCase();
  if (!value) return null;

  if (value.includes("quality")) {
    return {
      title: "Quality-First Results",
      description: "Every detail is handled carefully so the finished result looks clean, sharp, and consistent."
    };
  }
  if (value.includes("reputation") || value.includes("trust")) {
    return {
      title: "Trusted Service",
      description: "Built around professionalism, reliability, and a customer experience that feels easy to trust."
    };
  }
  if (value.includes("availability") || value.includes("respons")) {
    return {
      title: "Responsive Scheduling",
      description: "Clear communication and dependable follow-through make the process easier from the first inquiry."
    };
  }
  if (value.includes("pricing")) {
    return {
      title: "Clear Quotes",
      description: "Quotes are tailored to the scope of work so expectations feel straightforward and honest."
    };
  }
  return null;
}

function extractProcessSteps(text) {
  const raw = cleanString(text);
  if (!raw) return [];

  const normalized = raw
    .replace(/from first contact to finished result/gi, "")
    .replace(/\bthen\b/gi, " | ")
    .replace(/\band do a final walkthrough if needed\b/gi, " | final walkthrough")
    .replace(/\band\b/gi, " | ")
    .replace(/,/g, " | ")
    .replace(/\./g, " | ");

  const pieces = normalized
    .split(/\|/)
    .map((part) => cleanSentenceFragment(part))
    .filter(Boolean);

  const canonical = [];
  const seen = new Set();

  for (const piece of pieces) {
    const lower = piece.toLowerCase();

    const step =
      lower.includes("quote") ? { title: "Request a Quote", description: "Reach out with the details and get a quote based on the scope of work." } :
      lower.includes("scope") || lower.includes("confirm") ? { title: "Confirm the Scope", description: "Review the property, expectations, and any details that matter before the work begins." } :
      lower.includes("schedule") ? { title: "Schedule the Service", description: "Choose the right time and confirm the details so everything feels organized." } :
      lower.includes("clean") || lower.includes("work") ? { title: "Complete the Work", description: "Carry out the cleaning carefully with attention to detail and presentation." } :
      lower.includes("walkthrough") || lower.includes("final") ? { title: "Final Review", description: "Make sure the finished result looks right and the experience ends cleanly." } :
      null;

    if (step && !seen.has(step.title.toLowerCase())) {
      seen.add(step.title.toLowerCase());
      canonical.push(step);
    }
  }

  return canonical;
}

function inferPraiseThemes(state, strategyContract) {
  const status = cleanString(state.answers?.testimonials_status);
  const trust = cleanString(state.answers?.trust_signal);
  const differentiation = cleanString(state.answers?.differentiation);
  const businessName = cleanString(state.businessName) || "this team";

  const themes = [];

  if (status) {
    themes.push(`Clients consistently praise the professionalism, responsiveness, and finished results from working with ${businessName}.`);
  }

  if (trust) {
    themes.push(`Customers often mention ${trust.toLowerCase()} as a reason they felt confident choosing ${businessName}.`);
  }

  if (differentiation) {
    themes.push(`People appreciate the way ${businessName} combines careful work with a more polished, higher-trust customer experience.`);
  }

  if (!themes.length) {
    themes.push(
      `Professional, careful, and easy to work with from start to finish.`,
      `We chose ${businessName} because they felt trustworthy and professional from the first interaction.`
    );
  }

  return uniqueList(themes);
}

function galleryTitleFromQuery(query, idx) {
  const q = cleanString(query).toLowerCase();
  if (q.includes("before after")) return "Before & After";
  if (q.includes("detail")) return "Detail Work";
  if (q.includes("exterior")) return "Exterior Results";
  if (q.includes("lifestyle")) return "On-Site Service";
  if (q.includes("modern home")) return "Residential Project";
  return `Project ${idx + 1}`;
}

/* =========================
   Existing Helper Logic
========================= */

function getStrategyContract(state) {
  return isObject(state?.provenance?.strategy_contract)
    ? state.provenance.strategy_contract
    : null;
}

function getCategory(state) {
  const metaCategory = cleanString(state?.meta?.category).toLowerCase();
  if (metaCategory) return normalizeCategory(metaCategory);

  const contractCategory = cleanString(
    state?.provenance?.strategy_contract?.business_context?.category
  ).toLowerCase();

  return normalizeCategory(contractCategory || "service");
}

function normalizeCategory(value) {
  if (!value) return "service";
  if (["event", "events", "tour", "tours", "experience"].includes(value)) return "event";
  if (["coach", "coaching", "consultant", "consulting"].includes(value)) return "coach";
  if (["portfolio", "creative", "artist", "designer", "photographer"].includes(value)) return "portfolio";
  return "service";
}

function inferTone(strategyContract) {
  return cleanString(strategyContract?.source_snapshot?.client_preview?.sales_preview)
    ? "Premium, confident, trustworthy"
    : "";
}

function inferPrimaryCtaText(strategyContract, bookingUrl, pricingModel, experienceModel) {
  const pm = isObject(pricingModel) ? pricingModel : {};
  const em = isObject(experienceModel) ? experienceModel : {};
  const risk = cleanString(pm.risk_language).toLowerCase();
  const cta = cleanString(pm.cta_alignment).toLowerCase();
  const pb = cleanString(em.pricing_behavior).toLowerCase();

  if (
    risk.includes("prefer_no_public") ||
    risk.includes("no_public") ||
    pb.includes("consultation_first") ||
    pb.includes("quote_after_scope") ||
    pb.includes("variable_no_public")
  ) {
    if (cta.includes("consult") || cta.includes("schedule_visit")) return "Request a Consultation";
    if (cta.includes("quote")) return "Request a Quote";
    return "Request a Consultation";
  }

  const primary = cleanString(strategyContract?.conversion_strategy?.primary_conversion);
  if (bookingUrl || primary === "book_now") return "Book Now";
  if (primary === "call_now") return "Call Now";
  if (primary === "request_quote" || primary === "submit_inquiry") return "Request Quote";
  return "Get Started";
}

function inferSecondaryCtaText(strategyContract, phone) {
  const secondary = cleanString(strategyContract?.conversion_strategy?.secondary_conversion);
  if (phone || secondary === "call_now") return "Call Now";
  if (secondary === "submit_inquiry") return "Send Inquiry";
  if (secondary === "request_quote") return "Request Quote";
  return "Learn More";
}

function inferSecondaryCtaLink(phone, bookingUrl) {
  if (phone) return "#contact";
  if (bookingUrl) return bookingUrl;
  return "#about";
}

function inferContactSubheadline(state, strategyContract) {
  const primary = cleanString(strategyContract?.conversion_strategy?.primary_conversion);
  if (primary === "call_now") return "Call today and we’ll help you figure out the best next step.";
  if (primary === "book_now") return "Ready to get started? Reach out and we’ll help you book the right next step.";
  return "Tell us what you need and we’ll help you with the right next step.";
}

function inferContactButtonText(strategyContract, bookingUrl, pricingModel, experienceModel) {
  const pm = isObject(pricingModel) ? pricingModel : {};
  const em = isObject(experienceModel) ? experienceModel : {};
  const risk = cleanString(pm.risk_language).toLowerCase();
  const pb = cleanString(em.pricing_behavior).toLowerCase();
  if (risk.includes("prefer_no_public") || pb.includes("consultation_first") || pb.includes("quote_after_scope")) {
    return "Request a Consultation";
  }

  const primary = cleanString(strategyContract?.conversion_strategy?.primary_conversion);
  if (bookingUrl || primary === "book_now") return "Book Now";
  if (primary === "call_now") return "Call Now";
  if (primary === "request_quote") return "Request Quote";
  return "Send Message";
}

function inferFaqAnswer(question, state, strategyContract) {
  const bookingMethod = cleanString(state.answers?.booking_method).toLowerCase();
  const serviceArea = cleanString(state.answers?.service_area);
  const pricing = cleanString(state.answers?.pricing_structure);
  const processNotes = cleanString(state.answers?.process_notes);
  const trust = cleanString(state.answers?.trust_signal);
  const lower = cleanString(question).toLowerCase();

  if (lower.includes("book") || lower.includes("schedule")) {
    if (bookingMethod.includes("book")) return "Use the booking link to choose the best next step and timing.";
    if (bookingMethod.includes("call")) return "Call directly and we’ll help you schedule the right next step.";
    if (bookingMethod.includes("quote")) return "Start with a quote request and we’ll help you confirm the scope before scheduling.";
    return "Reach out through the contact form and we’ll help guide you from there.";
  }

  if (lower.includes("area") || lower.includes("location")) {
    return serviceArea
      ? `We primarily serve ${serviceArea}. Reach out if you want to confirm your location.`
      : "Reach out to confirm service availability in your area.";
  }

  if (lower.includes("price") || lower.includes("cost")) {
    return pricing
      ? cleanSentence(pricing)
      : "Pricing depends on the scope of work, and we’ll help guide you to the right fit with a clear quote.";
  }

  if (lower.includes("trust")) {
    return trust
      ? `We focus on ${trust.toLowerCase()} and a professional customer experience so the service feels easy to trust.`
      : "We aim to make the experience feel clear, professional, and dependable from the first interaction.";
  }

  if (lower.includes("process")) {
    return processNotes
      ? "The process is designed to feel clear and well-managed, from the first quote request through the final result."
      : "We aim to keep the process clear, responsive, and easy from first contact to final follow-through.";
  }

  if (lower.includes("streak-free") || lower.includes("results")) {
    return "Attention to detail, careful technique, and a quality-first approach help deliver a cleaner final result.";
  }

  if (lower.includes("advance") || lower.includes("availability")) {
    return "Availability depends on the schedule and season, so reaching out early is the best way to lock in the timing you want.";
  }

  return "We keep the experience clear, helpful, and easy to understand.";
}

function normalizeGalleryShape(gallery, showGallery, strategyContract, vibe, state) {
  const gg = gallery || {};
  const enabled = Boolean(gg.enabled ?? showGallery);

  let items = Array.isArray(gg.items) ? gg.items : [];
  if (!Array.isArray(items) && Array.isArray(gg.images)) {
    items = gg.images.map((im, i) => ({
      title: im.title || im.alt || `Project ${i + 1}`,
      image_search_query: im.image_search_query || ""
    }));
  }

  const computed_layout =
    gg.computed_layout ||
    galleryLayoutFromSignals(strategyContract);

  const computed_count =
    gg.computed_count ||
    items.length ||
    inferPremiumGalleryCount(strategyContract, state, vibe);

  return {
    enabled,
    title: gg.title || "Gallery",
    layout: gg.layout ?? null,
    show_titles: gg.show_titles ?? true,
    image_source: isObject(gg.image_source) ? gg.image_source : { image_search_query: "" },
    computed_count: enabled ? computed_count : (gg.computed_count ?? null),
    computed_layout: enabled ? computed_layout : (gg.computed_layout ?? null),
    items
  };
}

function normalizeTrustbarLabel(label) {
  const value = cleanString(label).toLowerCase();
  if (!value) return "";

  if (value.includes("testimonial")) return "Trusted by Clients";
  if (value.includes("review")) return "Strong Reviews";
  if (value.includes("photo")) return "Proven Results";
  if (value.includes("experience")) return "Experienced Service";
  if (value.includes("referral")) return "Highly Recommended";
  if (value === "future_google_business_profile") return "Local Business Presence";
  if (value === "local_service_area_relevance") return "Local Service Focus";

  return normalizeShortTitle(label, 0);
}

function audienceToCustomerPhrase(audience) {
  const value = cleanString(audience).toLowerCase();
  if (!value) return "";
  if (value.includes("homeowner")) return "homeowners";
  if (value.includes("family")) return "families";
  if (value.includes("property manager")) return "property managers";
  if (value.includes("business")) return "businesses";
  if (value.includes("customer")) return "customers";
  if (value.includes("client")) return "clients";
  if (value.includes("people actively looking")) return "customers";
  if (value.includes("trustworthy provider")) return "customers";
  return cleanSentenceFragment(value);
}

function normalizeDifferentiatorTitle(item) {
  const value = cleanString(item).toLowerCase();
  if (!value) return "";
  if (value.includes("quality")) return "Quality Work";
  if (value.includes("availability") || value.includes("schedule")) return "Responsive Scheduling";
  if (value.includes("communication")) return "Clear Communication";
  if (value.includes("detail")) return "Attention to Detail";
  if (value.includes("professional")) return "Professional Experience";
  if (value.includes("trust") || value.includes("reputation")) return "Trusted Reputation";
  if (value.includes("white-glove")) return "White-Glove Service";
  return normalizeShortTitle(item, 0);
}

function normalizeFaqQuestion(text) {
  const value = cleanString(text).toLowerCase();
  if (!value) return "";
  if (value.includes("cost concern") || value === "cost concerns") return "How does pricing work?";
  if (value.includes("trustworth")) return "How do I know I can trust your service?";
  if (value.includes("availability")) return "How far in advance should I schedule?";
  return cleanString(text);
}

function normalizeYearsExperience(value) {
  const text = cleanString(value);
  if (!text) return "";
  if (/\byear/i.test(text)) return text;
  if (/^\d+$/.test(text)) return `${text} years of experience`;
  return text;
}

function normalizeShortTitle(text, idx) {
  const cleaned = cleanString(text)
    .replace(/[|,:;]+/g, " ")
    .replace(/\bspecializing in\b/gi, " ")
    .replace(/\bin\s+[A-Z][^,.]*$/g, "")
    .replace(/\b(and|the|a|an|of|for|with|who)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 5);
  return titleCaseSmart(words.join(" ")) || `Item ${idx + 1}`;
}

function pickTrustbarIcon(text, idx) {
  const value = cleanString(text).toLowerCase();
  if (value.includes("testimonial") || value.includes("review")) return "star";
  if (value.includes("trust") || value.includes("safe")) return "shield";
  if (value.includes("experience") || value.includes("award")) return "award";
  if (value.includes("referral") || value.includes("people")) return "users";
  if (value.includes("local") || value.includes("area")) return "map";
  return ["shield", "star", "award", "heart"][idx % 4];
}

function pickFeatureIcon(text, idx) {
  const value = cleanString(text).toLowerCase();
  if (value.includes("fast") || value.includes("speed")) return "zap";
  if (value.includes("team") || value.includes("people")) return "users";
  if (value.includes("local") || value.includes("area")) return "map";
  if (value.includes("trust") || value.includes("safe") || value.includes("reputation")) return "shield";
  if (value.includes("quality") || value.includes("award") || value.includes("detail")) return "award";
  if (value.includes("schedule") || value.includes("time")) return "clock";
  if (value.includes("glass") || value.includes("window")) return "sparkles";
  return ["sparkles", "award", "shield", "clock", "heart", "map"][idx % 6];
}

function inferCtaType(link) {
  return String(link || "").startsWith("#") ? "anchor" : "external";
}

function normalizeState(state) {
  const next = isObject(state) ? state : {};

  next.answers = {
    business_name: "",
    category: "",
    primary_offer: "",
    audience: "",
    service_area: "",
    service_areas: [],
    trust_signal: "",
    contact_path: "",
    booking_method: "",
    cta_text: "",
    cta_link: "",
    primary_conversion: "",
    secondary_conversion: "",
    conversion_mode: "",
    differentiation: "",
    website_direction: "",
    business_understanding: "",
    opportunity: "",
    recommended_focus: [],
    recommended_sections: [],
    faq_angles: [],
    aeo_angles: [],
    future_dynamic_vibe_hint: "",
    google_presence_insight: "",
    next_step_teaser: "",
    service_descriptions: "",
    process_notes: "",
    pricing_structure: "",
    testimonials_status: "",
    photos_status: "",
    founder_bio: "",
    common_objections: [],
    buyer_decision_factors: [],
    phone: "",
    booking_url: "",
    hours: "",
    office_address: "",
    offerings: [],
    differentiators: [],
    trust_signals: [],
    credibility_factors: [],
    faq_topics: [],
    gallery_queries: [],
    gallery_items: [],
    testimonials: [],
    peak_season_availability: "",
    ...((isObject(next.answers) ? next.answers : {}))
  };

  next.ghostwritten = isObject(next.ghostwritten) ? next.ghostwritten : {};
  next.provenance = isObject(next.provenance) ? next.provenance : {};
  next.meta = isObject(next.meta) ? next.meta : {};
  next.readiness = isObject(next.readiness) ? next.readiness : {};
  next.enrichment = isObject(next.enrichment) ? next.enrichment : {};

  next.answers.service_areas = cleanList(next.answers.service_areas);
  next.answers.recommended_focus = cleanList(next.answers.recommended_focus);
  next.answers.recommended_sections = cleanList(next.answers.recommended_sections);
  next.answers.faq_angles = cleanList(next.answers.faq_angles);
  next.answers.aeo_angles = cleanList(next.answers.aeo_angles);
  next.answers.common_objections = cleanList(next.answers.common_objections);
  next.answers.buyer_decision_factors = cleanList(next.answers.buyer_decision_factors);
  next.answers.offerings = cleanList(next.answers.offerings);
  next.answers.differentiators = cleanList(next.answers.differentiators);
  next.answers.trust_signals = cleanList(next.answers.trust_signals);
  next.answers.credibility_factors = cleanList(next.answers.credibility_factors);
  next.answers.faq_topics = cleanList(next.answers.faq_topics);
  next.answers.gallery_queries = cleanList(next.answers.gallery_queries);
  next.answers.testimonials = Array.isArray(next.answers.testimonials) ? next.answers.testimonials : [];
  next.answers.gallery_items = Array.isArray(next.answers.gallery_items) ? next.answers.gallery_items : [];

  next.slug = cleanString(next.slug);
  next.businessName = cleanString(next.businessName);
  next.clientEmail = cleanString(next.clientEmail);

  return next;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function uniqueList(values) {
  return Array.from(new Set(cleanList(values)));
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (isObject(value)) return Object.values(value).some((item) => hasMeaningfulValue(item));
  return cleanString(String(value || "")) !== "";
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePublicText(value) {
  return cleanString(value)
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, " - ")
    .replace(/…/g, "...")
    .replace(/\uFFFD/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanSentence(text) {
  const value = normalizePublicText(cleanString(text).replace(/^[-–—\d.\s]+/, ""));
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function cleanSentenceFragment(text) {
  return normalizePublicText(
    cleanString(text)
      .replace(/[|]/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/[.,;:]+$/g, "")
      .trim()
  );
}

function titleCaseSmart(text) {
  return cleanString(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && ["and", "of", "for", "with", "to"].includes(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function uniqueObjectsByTitle(items) {
  const seen = new Set();
  return items.filter((item) => {
    const raw = cleanString(item?.title).toLowerCase();
    if (!raw) return false;
    if (seen.has(raw)) return false;
    seen.add(raw);
    return true;
  });
}

function ensureQuestion(text) {
  const q = cleanString(text);
  if (!q) return "What should I know?";
  return /[?]$/.test(q) ? q : `${q}?`;
}

function clampWords(text, min, max) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= max && words.length >= min) return words.join(" ");
  if (words.length > max) return words.slice(0, max).join(" ");
  const pad = ["photography", "professional", "high", "quality", "detail"];
  while (words.length < min && pad.length) words.push(pad.shift());
  return words.slice(0, max).join(" ");
}

function normalizeSlug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readJson(request) {
  const text = await request.text();
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}