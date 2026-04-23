/**
 * SITEFORGE FACTORY: intake-start-v2.js
 * Role: Bootstraps the Paid Intake session for the V2 blueprint + planner intake flow.
 *
 * Purpose:
 * - Fetch preflight as the source of truth
 * - Build a blueprint from recon + strategy_contract
 * - Seed a partial business draft + fact registry
 * - Compute section status from strategy + requirements
 * - Build initial blueprint facts/draft/section_status
 * - Run the same planner as intake-next-v2 (recomputeBlueprint) for verification_queue + first question_plan
 * - Persist initialized state to the orchestrator
 *
 * Notes:
 * - No industry hardcoding
 * - No regex-driven meaning extraction
 * - No narrative-block controller
 * - Keeps compatibility with existing strategy_contract provenance
 */

import { compileSchemaGuide, recomputeBlueprint } from "./intake-next-v2.js";

function pickBestPositioningField(factRegistry) {
  const fields = ["differentiation", "target_persona", "primary_offer"];

  let best = null;
  let bestScore = -Infinity;

  for (const key of fields) {
    const fact = factRegistry?.[key];
    if (!fact) continue;

    const status = (fact.status || "").toLowerCase();
    const confidence = typeof fact.confidence === "number" ? fact.confidence : 0;

    let score = 0;

    // Highest priority: missing
    if (!fact.value || status === "missing") score += 100;

    // Next: inferred (needs validation)
    if (status === "inferred") score += 60;

    // Next: seeded (still weak)
    if (status === "seeded") score += 40;

    // Lower confidence = higher priority
    score += (1 - confidence) * 50;

    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }

  return best;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const rawBody = await request.text();
    let body;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, error: "Invalid JSON payload" }, 400);
    }

    const slug = cleanString(body.slug);
    if (!slug) {
      return json({ ok: false, error: "Missing slug", received: body }, 400);
    }

    // 1) FETCH SOURCE OF TRUTH
    const url = new URL(request.url);
    const reconReq = new Request(`${url.origin}/api/preflight-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug })
    });

    const reconRes = await fetch(reconReq);
    const reconData = await reconRes.json();

    if (!reconRes.ok || !reconData?.ok) {
      throw new Error(`Preflight data not found for slug: ${slug}.`);
    }

    const strategy = safeStrategy(reconData);
    const seededAnswers = buildSeededAnswers(strategy, reconData);
    const preflight_intelligence = buildPreflightIntelligenceBridge(strategy, reconData, seededAnswers);

    // 2) BUILD BLUEPRINT (merges strategy-inferred facts + preflight_intelligence hydration before section/plan)
    const blueprintBase = buildBlueprintFromPreflight(strategy, reconData, seededAnswers, preflight_intelligence);

    // 3) INITIALIZE STATE
    const initialState = {
      slug,
      businessName:
        cleanString(reconData?.input_business_name) ||
        cleanString(strategy?.business_context?.business_name) ||
        cleanString(seededAnswers?.business_name) ||
        "New Partner",
      clientEmail: cleanString(reconData?.client_email),
      phase: "blueprint_verify",

      // compatibility fields
      answers: seededAnswers,
      ghostwritten: {},
      verified: {},

      verification: {
        queue_complete: true,
        verified_count: 0,
        remaining_keys: [],
        last_updated: new Date().toISOString()
      },

      conversation: [],

      meta: {
        category: cleanString(seededAnswers?.category) || "general",
        intake_version: "v2-blueprint",
        seeded: buildSeedMeta(seededAnswers),
        inferred: {},
        verified: {}
      },

      provenance: {
        strategy_contract: strategy,
        recon_snapshot: reconData
      },

      /** Handoff slice for PREFLIGHT_OUTPUT_SPEC_V1 → intake bridge (question framing, validation tone). */
      preflight_intelligence: preflight_intelligence,

      // new controller state (planner fields filled in Phase 2.6 below)
      blueprint: blueprintBase,

      readiness: {
        score: 0,
        can_generate_now: false,
        remaining_blocks: [],
        satisfied_blocks: [],
        must_verify_open: []
      }
    };

    // ==========================
    // PHASE 2.6 — UNIFIED PLANNER (START)
    // ==========================
    const schemaGuide = compileSchemaGuide(initialState.blueprint, initialState);
    const recomputed = recomputeBlueprint({
      blueprint: initialState.blueprint,
      state: initialState,
      schemaGuide,
      previousPlan: {},
      lastAudit: null
    });

    console.log("AFTER RECOMPUTE:", {
      bundle: recomputed.blueprint.question_plan?.bundle_id,
      field: recomputed.blueprint.question_plan?.primary_field
    });

    initialState.blueprint = {
      ...recomputed.blueprint,
      schema_guide: schemaGuide
    };

    console.log("AFTER ASSIGN:", {
      bundle: initialState.blueprint.question_plan?.bundle_id,
      field: initialState.blueprint.question_plan?.primary_field
    });

    const plan = initialState.blueprint?.question_plan;
    const factRegistry = initialState.blueprint?.fact_registry;

    if (plan && factRegistry) {
      const pf = cleanString(plan.primary_field);
      const isConversion =
        plan.bundle_id === "conversion" ||
        ["booking_method", "booking_url", "contact_path"].includes(pf);

      if (isConversion) {
        const bestField = pickBestPositioningField(factRegistry);

        if (bestField) {
          initialState.blueprint.question_plan = {
            ...plan,
            bundle_id: "positioning",
            primary_field: bestField,
            reason: "positioning_override"
          };
        }
      }
    }

    if (!initialState.blueprint.question_plan) {
      throw new Error("Planner failed to generate initial question_plan");
    }

    const vq = Array.isArray(initialState.blueprint.verification_queue)
      ? initialState.blueprint.verification_queue
      : [];
    initialState.verification = {
      queue_complete: vq.length === 0,
      verified_count: 0,
      remaining_keys: vq.map((item) => item.field_key),
      last_updated: new Date().toISOString()
    };
    initialState.readiness = evaluateBlueprintReadiness(initialState.blueprint);

    // compatibility mirrors
    initialState.current_key = initialState.blueprint.question_plan?.primary_field || null;

    const openingMessage =
      renderQuestion(initialState.blueprint.question_plan, initialState.blueprint) ||
      fallbackOpeningMessage(initialState);

    initialState.conversation.push({
      role: "assistant",
      content: openingMessage
    });

    // 4) SYNC TO ORCHESTRATOR
    if (env.ORCHESTRATOR_SCRIPT_URL) {
      await fetch(`${env.ORCHESTRATOR_SCRIPT_URL}?route=intake_start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          state: initialState,
          timestamp: new Date().toISOString()
        })
      });
    }

    console.log("FINAL PLAN:", {
      bundle: initialState.blueprint.question_plan?.bundle_id,
      field: initialState.blueprint.question_plan?.primary_field
    });

    return json({
      ok: true,
      message: openingMessage,
      state: initialState
    });
  } catch (err) {
    console.error("[intake-start-v2]", err);
    return json({ ok: false, error: err.message || "Unknown error" }, 500);
  }
}

/* --------------------------------
   RESPONSE HELPERS
-------------------------------- */

function extractValue(v) {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map((x) => extractValue(x));
  if (!isObject(v)) return v;
  if ("value" in v) return extractValue(v.value);
  if ("status" in v && "source" in v) return null;
  if ("status" in v) {
    const metaKeys = new Set([
      "status",
      "confidence",
      "verified",
      "rationale",
      "source",
      "updated_at",
      "requires_client_verification"
    ]);
    if (Object.keys(v).every((k) => metaKeys.has(k))) return null;
  }
  return v;
}

function buildInferredFact(value) {
  const leaf = extractValue(value);
  if (!hasMeaningfulValue(leaf)) return undefined;

  return {
    value: leaf,
    status: "inferred",
    confidence: 0.8,
    verified: false,
    source: "preflight"
  };
}

function hydrateFactsFromStrategyContract(strategy) {
  if (!strategy) return {};

  const business = strategy.business_context || {};
  const audience = strategy.audience_model || {};
  const conversion = strategy.conversion_strategy || {};

  return {
    target_persona: buildInferredFact(audience?.primary_audience),

    primary_offer: buildInferredFact(business?.primary_offer),

    differentiation: buildInferredFact(business?.differentiation),

    service_area_main: buildInferredFact(business?.location),

    booking_method: buildInferredFact(conversion?.primary_conversion)
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

/* --------------------------------
   CORE PARSING / NORMALIZATION
-------------------------------- */

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function compactObject(obj) {
  const out = {};

  for (const [key, value] of Object.entries(obj || {})) {
    if (Array.isArray(value) && value.length > 0) {
      out[key] = value;
      continue;
    }

    if (isObject(value) && Object.keys(value).length > 0) {
      out[key] = value;
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
      continue;
    }

    if (typeof value === "boolean") {
      out[key] = value;
    }
  }

  return out;
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item));
  }

  if (isObject(value)) {
    return Object.values(value).some((item) => hasMeaningfulValue(item));
  }

  if (typeof value === "boolean") return true;

  return cleanString(value) !== "";
}

function firstNonEmpty(values) {
  for (const value of values || []) {
    if (Array.isArray(value) && value.length > 0) {
      const nested = firstNonEmpty(value);
      if (nested) return nested;
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function uniqueList(values) {
  return Array.from(new Set(cleanList(values)));
}

function slugify(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseWords(value) {
  return cleanString(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/* --------------------------------
   PRE-FLIGHT / STRATEGY ACCESS
-------------------------------- */

function safeStrategy(reconData) {
  if (isObject(reconData?.strategy_contract)) {
    return reconData.strategy_contract;
  }

  if (reconData?.paid_intake_json) {
    try {
      const parsed = JSON.parse(reconData.paid_intake_json);
      if (isObject(parsed?.strategy_contract)) {
        return parsed.strategy_contract;
      }
    } catch {
      // ignore and fall through
    }
  }

  return {};
}

/** Preflight API may nest row fields under recon_snapshot or place them on the root. */
function reconPayloadRoot(reconData) {
  const r = isObject(reconData) ? reconData : {};
  if (isObject(r.recon_snapshot) && Object.keys(r.recon_snapshot).length) {
    return r.recon_snapshot;
  }
  return r;
}

/** Parse Apps Script JSON columns that arrive as stringified JSON. */
function safeParseJsonString(raw) {
  if (raw == null) return null;
  if (isObject(raw) && !Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clipText(value, maxLen) {
  const s = cleanString(value);
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function entityProfilePositioningHint(ep) {
  if (!isObject(ep)) return "";
  const cat = cleanString(ep.primary_category);
  const arch = cleanString(ep.strategic_archetype);
  const bm = cleanString(ep.business_model);
  const parts = [cat, arch || bm].filter(Boolean);
  return parts.join(" · ");
}

function normalizeCategory(value) {
  const raw = cleanString(value).toLowerCase();

  if (!raw) return "general";

  if (["event", "events", "tour", "tours", "experience", "class", "workshop"].includes(raw)) {
    return "event";
  }

  if (["coach", "coaching", "consultant", "consulting", "advisor", "therapy", "therapist", "trainer"].includes(raw)) {
    return "coach";
  }

  if (["portfolio", "creative", "artist", "designer", "photographer", "videographer"].includes(raw)) {
    return "portfolio";
  }

  return "service";
}

/* --------------------------------
   STRATEGY EXTRACTION (COMPATIBILITY)
-------------------------------- */

/**
 * Normalized strategic payload for intake (validation, not re-discovery).
 * Maps spec fields + competitive_intelligence from strategy_contract, recon blobs
 * (`preflight_strategy_json`, `buyer_intelligence_json`, `entity_profile_json`), and seeded answers.
 * @see docs/PREFLIGHT_OUTPUT_SPEC_V1.md
 */
function buildPreflightIntelligenceBridge(strategy, reconData, seededAnswers) {
  const strategyObj = isObject(strategy) ? strategy : {};
  const recon = isObject(reconData) ? reconData : {};
  const blob = reconPayloadRoot(reconData);
  const seeded = isObject(seededAnswers) ? seededAnswers : {};

  const ps = safeParseJsonString(blob.preflight_strategy_json);
  const bi = safeParseJsonString(blob.buyer_intelligence_json);
  const ep = safeParseJsonString(blob.entity_profile_json);

  const clientPreview = isObject(ps?.client_preview) ? ps.client_preview : {};
  const internal = isObject(ps?.internal_strategy) ? ps.internal_strategy : {};
  const aeoAngles = uniqueList(cleanList(internal.aeo_angles));

  const ci = isObject(strategyObj.competitive_intelligence)
    ? strategyObj.competitive_intelligence
    : isObject(recon.competitive_intelligence)
      ? recon.competitive_intelligence
      : isObject(ps?.competitive_intelligence)
        ? ps.competitive_intelligence
        : {};

  const summary = cleanString(clientPreview.summary);
  const opportunityFromPreview = cleanString(clientPreview.opportunity);
  const salesPreview = cleanString(clientPreview.sales_preview);
  const nextStepTeaser = cleanString(clientPreview.next_step_teaser);
  const recommendedFromPreview = cleanList(clientPreview.recommended_focus);

  const buyerFromIntel = cleanList(bi?.decision_factors);
  const objectionsFromIntel = cleanList(bi?.common_objections);
  const trustMarkers = cleanList(bi?.trust_markers);
  const redFlags = cleanList(bi?.red_flags_customers_avoid);

  const winning_angle = firstNonEmpty([
    cleanString(ci.winning_local_angle),
    cleanString(ci.winning_local_positioning_angle),
    aeoAngles[0] || "",
    summary ? clipText(summary, 260) : ""
  ]);

  const differentiation_hypothesis = firstNonEmpty([
    cleanString(ci.differentiation_hypothesis),
    summary ? clipText(summary, 420) : ""
  ]);

  const positioning = firstNonEmpty([
    cleanString(ci.differentiation_hypothesis),
    summary ? clipText(summary, 360) : "",
    entityProfilePositioningHint(ep),
    cleanString(seeded.business_understanding),
    cleanString(strategyObj.business_context?.differentiation)
  ]);

  const opportunity = firstNonEmpty([
    opportunityFromPreview,
    cleanString(seeded.opportunity),
    cleanString(strategyObj.business_context?.opportunity)
  ]);

  const website_direction = firstNonEmpty([
    salesPreview,
    nextStepTeaser,
    cleanString(seeded.website_direction),
    cleanString(strategyObj.site_structure?.future_dynamic_vibe_hint)
  ]);

  const buyer_factors = uniqueList([
    ...cleanList(ci.buyer_comparison_factors),
    ...cleanList(ci.what_buyers_compare),
    ...buyerFromIntel
  ]);

  const weaknesses = uniqueList([
    ...cleanList(ci.competitor_weaknesses),
    ...cleanList(ci.likely_competitor_weaknesses),
    ...objectionsFromIntel,
    ...redFlags
  ]);

  const local_alternatives = uniqueList([
    ...cleanList(ci.local_alternatives),
    ...cleanList(ci.typical_local_alternatives)
  ]);

  const recommended_focus = recommendedFromPreview.length
    ? recommendedFromPreview
    : uniqueList(cleanList(seeded.recommended_focus));

  const experience_model = isObject(ps?.experience_model) ? ps.experience_model : {};
  const component_importance = isObject(ps?.component_importance) ? ps.component_importance : {};
  const visual_strategy = isObject(ps?.visual_strategy) ? ps.visual_strategy : {};
  const process_model = isObject(ps?.process_model) ? ps.process_model : {};
  const pricing_model = isObject(ps?.pricing_model) ? ps.pricing_model : {};

  return compactObject({
    positioning,
    opportunity,
    website_direction,
    winning_angle,
    buyer_factors,
    weaknesses,
    differentiation_hypothesis,
    local_alternatives,
    recommended_focus,
    trust_markers: trustMarkers,
    common_objections: objectionsFromIntel,
    target_persona_hint: firstNonEmpty([
      cleanString(strategyObj.audience_model?.primary_persona),
      cleanString(strategyObj.audience_model?.primary_audience),
      entityProfilePositioningHint(ep)
    ]),
    google_presence_insight: cleanString(seeded.google_presence_insight),
    experience_model,
    component_importance,
    visual_strategy,
    process_model,
    pricing_model,
    spec_version:
      Object.keys(experience_model).length ||
      Object.keys(component_importance).length ||
      Object.keys(visual_strategy).length ||
      Object.keys(process_model).length ||
      Object.keys(pricing_model).length
        ? "PREFLIGHT_OUTPUT_SPEC_V1_1"
        : "PREFLIGHT_OUTPUT_SPEC_V1"
  });
}

/**
 * Merge FAQ/AEO (and similar) from strategy contract and from `preflight_strategy_json.internal_strategy`
 * on recon — strategy_contract alone often omits internal_strategy.
 */
function mergeAnglesFromPreflightStrategy(strategy, reconData) {
  const fromContract = isObject(strategy?.internal_strategy) ? strategy.internal_strategy : {};
  const root = reconPayloadRoot(reconData);
  const ps = safeParseJsonString(root?.preflight_strategy_json);
  const internal = isObject(ps?.internal_strategy) ? ps.internal_strategy : {};
  return {
    faq_angles: uniqueList([
      ...cleanList(internal.faq_angles),
      ...cleanList(fromContract.faq_angles)
    ]),
    aeo_angles: uniqueList([
      ...cleanList(internal.aeo_angles),
      ...cleanList(fromContract.aeo_angles)
    ])
  };
}

function buildSeededAnswers(strategy, reconData) {
  const businessContext = isObject(strategy?.business_context) ? strategy.business_context : {};
  const conversionStrategy = isObject(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const audienceModel = isObject(strategy?.audience_model) ? strategy.audience_model : {};
  const proofModel = isObject(strategy?.proof_model) ? strategy.proof_model : {};
  const siteStructure = isObject(strategy?.site_structure) ? strategy.site_structure : {};
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const napRecommendation = isObject(sourceSnapshot?.nap_recommendation) ? sourceSnapshot.nap_recommendation : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};
  const root = reconPayloadRoot(reconData);
  const entityProfile = safeParseJsonString(root?.entity_profile_json);
  const anglesFromPs = mergeAnglesFromPreflightStrategy(strategy, reconData);

  const serviceAreas = uniqueList([
    ...cleanList(businessContext?.service_area),
    ...cleanList(napRecommendation?.service_area)
  ]);

  const bookingMethod = deriveBookingMethod(strategy, reconData);
  const contactPath = deriveContactPath(strategy, reconData);
  const cta = deriveCta(strategy, reconData);
  const trustSignal = deriveTrustSignal(strategy, reconData);
  const websiteDirection = deriveWebsiteDirection(strategy, reconData);
  const opportunity = deriveOpportunity(strategy, reconData);
  const recommendedFocus = deriveRecommendedFocus(strategy, reconData);
  const recommendedSections = deriveRecommendedSections(strategy, reconData);

  return compactObject({
    business_name:
      cleanString(businessContext?.business_name) ||
      cleanString(reconSnapshot?.input_business_name) ||
      cleanString(napRecommendation?.name),

    category: normalizeCategory(
      businessContext?.category ||
      businessContext?.business_type ||
      strategy?.internal_strategy?.business_category ||
      "general"
    ),

    primary_offer:
      cleanString(sourceSnapshot?.primary_offer_hint) ||
      cleanString(reconSnapshot?.description_input) ||
      cleanString(reconSnapshot?.primary_offer) ||
      cleanString(reconSnapshot?.business_understanding),

    audience:
      cleanString(audienceModel?.primary_persona) ||
      cleanString(audienceModel?.secondary_persona) ||
      entityProfilePositioningHint(entityProfile),

    service_area: serviceAreas[0] || "",
    service_areas: serviceAreas,

    trust_signal: trustSignal,
    contact_path: contactPath,
    booking_method: bookingMethod,

    cta_text: cta.text,
    cta_link: cta.link,

    primary_conversion: cleanString(conversionStrategy?.primary_conversion),
    secondary_conversion: cleanString(conversionStrategy?.secondary_conversion),
    conversion_mode: cleanString(conversionStrategy?.conversion_mode),

    differentiation:
      firstNonEmpty([
        cleanList(audienceModel?.decision_factors),
        cleanList(recommendedFocus)
      ]) || "",

    website_direction: websiteDirection,
    business_understanding:
      cleanString(clientPreview?.summary) ||
      cleanString(reconSnapshot?.business_understanding),

    opportunity,
    recommended_focus: recommendedFocus,
    recommended_sections: recommendedSections,

    faq_angles: uniqueList([...cleanList(siteStructure?.faq_angles), ...anglesFromPs.faq_angles]),
    aeo_angles: uniqueList([...cleanList(siteStructure?.aeo_angles), ...anglesFromPs.aeo_angles]),
    future_dynamic_vibe_hint: cleanString(siteStructure?.future_dynamic_vibe_hint),

    google_presence_insight:
      cleanString(reconSnapshot?.google_presence_insight) ||
      cleanString(sourceSnapshot?.gbp_status),

    next_step_teaser:
      cleanString(clientPreview?.next_step_teaser) ||
      cleanString(reconSnapshot?.next_step)
  });
}

function deriveBookingMethod(strategy, reconData) {
  const conversion = isObject(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  const explicit = firstNonEmpty([
    cleanString(sourceSnapshot?.booking_method_hint),
    cleanString(sourceSnapshot?.booking_url),
    cleanString(reconSnapshot?.booking_url),
    cleanString(reconSnapshot?.booking_method),
    cleanString(strategy?.contact?.booking_url),
    cleanString(strategy?.contact?.method)
  ]);

  if (explicit) return explicit;

  const mode = cleanString(conversion?.conversion_mode || conversion?.primary_conversion).toLowerCase();

  if (mode.includes("quote")) return "request quote";
  if (mode.includes("book")) return "book online";
  if (mode.includes("call")) return "call";
  if (mode.includes("text")) return "text";
  if (mode.includes("form")) return "contact form";

  return "";
}

function deriveContactPath(strategy, reconData) {
  const conversion = isObject(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const napRecommendation = isObject(sourceSnapshot?.nap_recommendation) ? sourceSnapshot.nap_recommendation : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  const explicit = firstNonEmpty([
    cleanString(sourceSnapshot?.booking_url),
    cleanString(reconSnapshot?.booking_url),
    cleanString(strategy?.contact?.booking_url),
    cleanString(strategy?.contact?.method),
    cleanString(napRecommendation?.phone),
    cleanString(reconSnapshot?.client_phone)
  ]);

  if (explicit) return explicit;

  const destination = cleanString(conversion?.cta_destination).toLowerCase();
  const mode = cleanString(conversion?.conversion_mode || conversion?.primary_conversion).toLowerCase();

  if (destination === "contact") return "contact";
  if (destination) return destination;
  if (mode.includes("quote")) return "request quote";
  if (mode.includes("call")) return "call";
  if (mode.includes("book")) return "book online";
  if (mode.includes("form")) return "contact form";

  return "";
}

function deriveCta(strategy, reconData) {
  const conversion = isObject(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const settings = isObject(strategy?.settings) ? strategy.settings : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  const text =
    cleanString(conversion?.cta_text) ||
    cleanString(settings?.cta_text) ||
    cleanString(reconSnapshot?.cta_text);

  const destination =
    cleanString(conversion?.cta_destination) ||
    cleanString(settings?.cta_link) ||
    cleanString(reconSnapshot?.cta_link);

  const type =
    cleanString(conversion?.cta_type) ||
    cleanString(settings?.cta_type);

  let link = destination;

  if (!link && text) {
    link = type === "anchor" ? "#contact" : "";
  } else if (link && !link.startsWith("#") && type === "anchor") {
    link = `#${link.replace(/^#/, "")}`;
  }

  return {
    text,
    link
  };
}

function deriveTrustSignal(strategy, reconData) {
  const proofModel = isObject(strategy?.proof_model) ? strategy.proof_model : {};
  const audienceModel = isObject(strategy?.audience_model) ? strategy.audience_model : {};
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  return firstNonEmpty([
    cleanList(proofModel?.trust_signals),
    cleanList(proofModel?.credibility_sources),
    cleanList(audienceModel?.decision_factors),
    cleanString(reconSnapshot?.google_presence_insight),
    cleanString(sourceSnapshot?.trust_hint)
  ]);
}

function deriveWebsiteDirection(strategy, reconData) {
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  return firstNonEmpty([
    cleanString(clientPreview?.sales_preview),
    cleanString(reconSnapshot?.website_direction),
    cleanString(clientPreview?.summary)
  ]);
}

function deriveOpportunity(strategy, reconData) {
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  return firstNonEmpty([
    cleanString(clientPreview?.opportunity),
    cleanString(reconSnapshot?.opportunity)
  ]);
}

function deriveRecommendedFocus(strategy, reconData) {
  const siteStructure = isObject(strategy?.site_structure) ? strategy.site_structure : {};
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  return uniqueList([
    ...cleanList(clientPreview?.recommended_focus),
    ...cleanList(reconSnapshot?.recommended_focus),
    ...cleanList(siteStructure?.faq_angles)
  ]).slice(0, 6);
}

function deriveRecommendedSections(strategy, reconData) {
  const siteStructure = isObject(strategy?.site_structure) ? strategy.site_structure : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  return uniqueList([
    ...cleanList(siteStructure?.recommended_sections),
    ...cleanList(reconSnapshot?.recommended_sections)
  ]);
}

function buildSeedMeta(seededAnswers) {
  const seeded = {};
  for (const [key, value] of Object.entries(seededAnswers || {})) {
    seeded[key] = hasMeaningfulValue(value);
  }
  return seeded;
}

/* --------------------------------
   BLUEPRINT
-------------------------------- */

function buildBlueprintFromPreflight(strategy, reconData, seededAnswers, preflightIntelligence) {
  const normalizedStrategy = buildNormalizedStrategy(strategy, reconData, preflightIntelligence);
  let factRegistry = buildFactRegistry(strategy, reconData, seededAnswers, normalizedStrategy);

  const inferredFacts = hydrateFactsFromStrategyContract(strategy);
  factRegistry = {
    ...factRegistry,
    ...Object.fromEntries(Object.entries(inferredFacts).filter(([_, v]) => v !== undefined))
  };

  hydrateFactRegistryWithPreflightIntelligence(factRegistry, preflightIntelligence);
  promotePreflightFactsToRegistry(factRegistry, reconData, preflightIntelligence);

  // ==========================
  // PHASE FIX — FORCE VALIDATION ON STRATEGIC FIELDS
  // ==========================

  const forceValidationFields = ["differentiation", "target_persona", "primary_offer"];

  forceValidationFields.forEach((key) => {
    const fact = factRegistry[key];
    if (!fact) return;

    if (fact.status === "seeded" || fact.status === "inferred") {
      fact.needs_validation = true;
    }
  });

  const businessDraft = buildBusinessDraft(strategy, reconData, seededAnswers, normalizedStrategy, factRegistry);
  const sectionStatus = computeSectionStatus(normalizedStrategy, factRegistry, businessDraft);

  return {
    strategy: normalizedStrategy,
    fact_registry: factRegistry,
    business_draft: businessDraft,
    section_status: sectionStatus,
    verification_queue: [],
    question_candidates: [],
    question_plan: null
  };
}

function toSnakeCase(value) {
  return cleanString(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function buildPreflightPromotionSources(reconData) {
  const root = reconPayloadRoot(reconData);
  const preflight = isObject(root?.preflight) ? root.preflight : {};
  const parsedSummary =
    safeParseJsonString(preflight?.summary) ||
    safeParseJsonString(root?.summary) ||
    safeParseJsonString(root?.preflight_summary_json);
  const input = isObject(preflight?.input)
    ? preflight.input
    : isObject(root?.input)
      ? root.input
      : root;
  const summary = isObject(parsedSummary)
    ? parsedSummary
    : isObject(preflight?.summary)
    ? preflight.summary
    : isObject(root?.summary)
      ? root.summary
      : {};
  return { input, summary };
}

function mapPreflightSourceKeyToFactKey(sourceKey) {
  let k = toSnakeCase(sourceKey);
  if (!k) return "";
  if (k.startsWith("summary_")) k = k.slice("summary_".length);
  if (k.startsWith("input_") && k !== "input_business_name") k = k.slice("input_".length);
  const aliases = {
    input_business_name: "business_name",
    business_name: "business_name",
    city: "service_area_main",
    city_or_service_area_input: "service_area_main",
    service_area: "service_area_main",
    service_area_main: "service_area_main",
    client_email: "email",
    email: "email",
    client_phone: "phone",
    phone: "phone",
    address: "address",
    hours: "hours",
    primary_offer: "primary_offer",
    differentiation: "differentiation",
    differentiation_hypothesis: "differentiation",
    positioning: "business_understanding",
    target_persona: "target_persona",
    audience: "target_persona",
    tagline: "tagline",
    service_descriptions: "service_list",
    process_summary: "process_summary",
    opportunity: "opportunity",
    trust_signal: "trust_signal",
    trust_markers: "trust_signal",
    recommended_focus: "recommended_focus",
    winning_angle: "aeo_angles",
    website_direction: "website_direction"
  };
  return aliases[k] || k;
}

function canPromoteIntoFact(entry) {
  if (!isObject(entry)) return false;
  if (entry.verified === true) return false;
  const status = cleanString(entry.status);
  if (status === "answered") return false;
  const confidence = typeof entry.confidence === "number" ? entry.confidence : 0;
  if (confidence >= 0.8) return false;
  return true;
}

function promoteFactFromPreflightSource(facts, sourceObj, sourceKind) {
  if (!isObject(facts) || !isObject(sourceObj)) return;
  const fromInput = sourceKind === "input";

  for (const [rawKey, rawValue] of Object.entries(sourceObj)) {
    const factKey = mapPreflightSourceKeyToFactKey(rawKey);
    if (!factKey || !Object.prototype.hasOwnProperty.call(facts, factKey)) continue;
    const value = extractValue(rawValue);
    if (!hasMeaningfulValue(value)) continue;

    const current = facts[factKey];
    if (!canPromoteIntoFact(current)) continue;

    if (fromInput) {
      facts[factKey] = {
        ...current,
        value,
        source: "preflight",
        status: "verified",
        confidence: 0.95,
        verified: true
      };
    } else {
      facts[factKey] = {
        ...current,
        value,
        source: "preflight",
        status: "inferred",
        confidence: 0.75,
        verified: false
      };
    }
  }
}

function buildSummaryPromotionPayloadFromPreflightIntelligence(pi) {
  if (!isObject(pi)) return {};
  const trustFirst = cleanList(pi.trust_markers)[0];
  const win = cleanString(pi.winning_angle);
  return compactObject({
    business_understanding: cleanString(pi.positioning),
    opportunity: cleanString(pi.opportunity),
    differentiation: cleanString(pi.differentiation_hypothesis),
    trust_signal: trustFirst,
    recommended_focus: cleanList(pi.recommended_focus),
    aeo_angles: win ? [win] : [],
    website_direction: cleanString(pi.website_direction)
  });
}

function promotePreflightFactsToRegistry(facts, reconData, preflightIntelligence) {
  const { input, summary } = buildPreflightPromotionSources(reconData);
  const fromBridge = buildSummaryPromotionPayloadFromPreflightIntelligence(preflightIntelligence);
  const mergedSummary = { ...summary, ...fromBridge };

  promoteFactFromPreflightSource(facts, input, "input");
  promoteFactFromPreflightSource(facts, mergedSummary, "summary");
}

function buildNormalizedStrategy(strategy, reconData, preflightIntelligence) {
  const businessContext = isObject(strategy?.business_context) ? strategy.business_context : {};
  const conversionStrategy = isObject(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const audienceModel = isObject(strategy?.audience_model) ? strategy.audience_model : {};
  const proofModel = isObject(strategy?.proof_model) ? strategy.proof_model : {};
  const siteStructure = isObject(strategy?.site_structure) ? strategy.site_structure : {};
  const visualStrategy = isObject(strategy?.visual_strategy) ? strategy.visual_strategy : {};
  const assetPolicy = isObject(strategy?.asset_policy) ? strategy.asset_policy : {};
  const copyPolicy = isObject(strategy?.copy_policy) ? strategy.copy_policy : {};
  const contentRequirements = isObject(strategy?.content_requirements) ? strategy.content_requirements : {};
  const schemaToggles = isObject(strategy?.schema_toggles) ? strategy.schema_toggles : {};
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const napRecommendation = isObject(sourceSnapshot?.nap_recommendation) ? sourceSnapshot.nap_recommendation : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};
  const reconRoot = reconPayloadRoot(reconData);
  const entityProfile = safeParseJsonString(reconRoot?.entity_profile_json);

  const serviceArea = uniqueList([
    ...cleanList(businessContext?.service_area),
    ...cleanList(napRecommendation?.service_area),
    ...cleanList(entityProfile?.service_area),
    cleanString(reconSnapshot?.city_or_service_area_input)
  ]);

  return {
    business_context: {
      slug:
        cleanString(businessContext?.slug) ||
        cleanString(reconSnapshot?.slug),
      business_name:
        cleanString(businessContext?.business_name) ||
        cleanString(reconSnapshot?.input_business_name) ||
        cleanString(napRecommendation?.name),
      category:
        cleanString(businessContext?.category) ||
        cleanString(businessContext?.business_type) ||
        cleanString(entityProfile?.primary_category),
      normalized_category: normalizeCategory(
        businessContext?.category ||
          businessContext?.business_type ||
          strategy?.internal_strategy?.business_category ||
          cleanString(entityProfile?.primary_category) ||
          "general"
      ),
      business_model: cleanString(
        firstNonEmpty([businessContext?.business_model, entityProfile?.business_model])
      ),
      strategic_archetype: cleanString(
        firstNonEmpty([businessContext?.strategic_archetype, entityProfile?.strategic_archetype])
      ),
      service_area: serviceArea
    },

    conversion_strategy: {
      primary_conversion: cleanString(conversionStrategy?.primary_conversion),
      secondary_conversion: cleanString(conversionStrategy?.secondary_conversion),
      conversion_mode: cleanString(conversionStrategy?.conversion_mode),
      cta_text: cleanString(conversionStrategy?.cta_text),
      cta_type: cleanString(conversionStrategy?.cta_type) || "anchor",
      cta_destination: cleanString(conversionStrategy?.cta_destination) || "contact"
    },

    audience_model: {
      primary_persona: cleanString(audienceModel?.primary_persona),
      secondary_persona: cleanString(audienceModel?.secondary_persona),
      decision_factors: cleanList(audienceModel?.decision_factors),
      common_objections: cleanList(audienceModel?.common_objections)
    },

    proof_model: {
      trust_signals: cleanList(proofModel?.trust_signals),
      credibility_sources: cleanList(proofModel?.credibility_sources)
    },

    site_structure: {
      recommended_sections: cleanList(siteStructure?.recommended_sections),
      faq_angles: cleanList(siteStructure?.faq_angles),
      aeo_angles: cleanList(siteStructure?.aeo_angles),
      future_dynamic_vibe_hint: cleanString(siteStructure?.future_dynamic_vibe_hint)
    },

    visual_strategy: {
      recommended_vibe: cleanString(visualStrategy?.recommended_vibe) || "",
      preferred_image_themes: cleanList(assetPolicy?.preferred_image_themes)
    },

    copy_policy: {
      allow_ai_inferred_copy: !!copyPolicy?.allow_ai_inferred_copy,
      allow_ai_assisted_copy: !!copyPolicy?.allow_ai_assisted_copy,
      require_client_verification_for_facts: !!copyPolicy?.require_client_verification_for_facts,
      fields_ai_can_draft: cleanList(copyPolicy?.fields_ai_can_draft),
      fields_requiring_verification: cleanList(copyPolicy?.fields_requiring_verification)
    },

    content_requirements: {
      must_verify_now: cleanList(contentRequirements?.must_verify_now),
      must_collect_paid_phase: cleanList(contentRequirements?.must_collect_paid_phase),
      preview_required_fields: cleanList(contentRequirements?.preview_required_fields),
      publish_required_fields: cleanList(contentRequirements?.publish_required_fields)
    },

    schema_toggles: normalizeSchemaToggles(schemaToggles, strategy, reconData, preflightIntelligence)
  };
}

function componentImportanceRank(value) {
  const v = cleanString(value).toLowerCase();
  const rank = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return rank[v] ?? 0;
}

function importanceAtLeast(importance, key, minLevel) {
  if (!isObject(importance)) return false;
  return componentImportanceRank(importance[key]) >= componentImportanceRank(minLevel);
}

/**
 * Preflight `component_importance` boosts section toggles (OR with section-derived inference).
 * Keys match preflight-recon output (not industry-specific).
 */
function mergeComponentImportanceIntoInferred(componentImportance, inferred) {
  const ci = isObject(componentImportance) ? componentImportance : {};
  if (!Object.keys(ci).length) return inferred;

  const out = { ...inferred };
  if (importanceAtLeast(ci, "gallery", "high")) out.show_gallery = true;
  if (importanceAtLeast(ci, "process", "high")) out.show_process = true;
  if (importanceAtLeast(ci, "testimonials", "high")) out.show_testimonials = true;
  if (importanceAtLeast(ci, "faqs", "medium")) out.show_faqs = true;
  if (importanceAtLeast(ci, "investment", "medium") || importanceAtLeast(ci, "pricing_section", "medium")) {
    out.show_investment = true;
  }
  if (importanceAtLeast(ci, "comparison", "medium")) out.show_comparison = true;
  if (importanceAtLeast(ci, "service_area", "medium")) out.show_service_area = true;
  if (importanceAtLeast(ci, "events_or_booking", "medium")) out.show_events = true;
  if (importanceAtLeast(ci, "testimonials", "medium") || importanceAtLeast(ci, "gallery", "medium")) {
    out.show_trustbar = true;
  }
  if (importanceAtLeast(ci, "gallery", "medium") && importanceAtLeast(ci, "process", "medium")) {
    out.show_features = true;
  }
  return out;
}

function normalizeSchemaToggles(schemaToggles, strategy, reconData, preflightIntelligence) {
  const recommendedSections = deriveRecommendedSections(strategy, reconData).map((item) => item.toLowerCase());

  const inferred = {
    show_trustbar: recommendedSections.some((s) => s.includes("trust")),
    show_about: recommendedSections.some((s) => s.includes("about")),
    show_features:
      recommendedSections.some((s) => s.includes("service")) ||
      recommendedSections.some((s) => s.includes("feature")) ||
      recommendedSections.some((s) => s.includes("offer")),
    show_events: recommendedSections.some((s) => s.includes("event")),
    show_process: recommendedSections.some((s) => s.includes("process")),
    show_testimonials:
      recommendedSections.some((s) => s.includes("testimonial")) ||
      recommendedSections.some((s) => s.includes("review")),
    show_comparison: recommendedSections.some((s) => s.includes("comparison")),
    show_gallery:
      recommendedSections.some((s) => s.includes("gallery")) ||
      recommendedSections.some((s) => s.includes("portfolio")),
    show_investment:
      recommendedSections.some((s) => s.includes("investment")) ||
      recommendedSections.some((s) => s.includes("pricing")),
    show_faqs: recommendedSections.some((s) => s.includes("faq")),
    show_service_area:
      recommendedSections.some((s) => s.includes("area")) ||
      recommendedSections.some((s) => s.includes("location"))
  };

  const merged = mergeComponentImportanceIntoInferred(
    preflightIntelligence?.component_importance,
    inferred
  );

  return {
    show_trustbar: getBoolean(schemaToggles?.show_trustbar, merged.show_trustbar),
    show_about: getBoolean(schemaToggles?.show_about, merged.show_about),
    show_features: getBoolean(schemaToggles?.show_features, merged.show_features || true),
    show_events: getBoolean(schemaToggles?.show_events, merged.show_events),
    show_process: getBoolean(schemaToggles?.show_process, merged.show_process),
    show_testimonials: getBoolean(schemaToggles?.show_testimonials, merged.show_testimonials),
    show_comparison: getBoolean(schemaToggles?.show_comparison, merged.show_comparison),
    show_gallery: getBoolean(schemaToggles?.show_gallery, merged.show_gallery),
    show_investment: getBoolean(schemaToggles?.show_investment, merged.show_investment),
    show_faqs: getBoolean(schemaToggles?.show_faqs, merged.show_faqs),
    show_service_area: getBoolean(schemaToggles?.show_service_area, merged.show_service_area)
  };
}

function getBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : !!fallback;
}

/* --------------------------------
   FACT REGISTRY
-------------------------------- */

function buildFactRegistry(strategy, reconData, seededAnswers, normalizedStrategy) {
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const napRecommendation = isObject(sourceSnapshot?.nap_recommendation) ? sourceSnapshot.nap_recommendation : {};
  const visualStrategy = isObject(strategy?.visual_strategy) ? strategy.visual_strategy : {};
  const copyPolicy = normalizedStrategy.copy_policy;

  const facts = {};

  addFact(facts, "business_name", seededAnswers.business_name, {
    source: "preflight",
    verified: true,
    related_sections: ["brand"]
  });

  addFact(facts, "industry", normalizedStrategy.business_context.category, {
    source: "preflight",
    verified: true,
    related_sections: ["intelligence"]
  });

  addFact(facts, "target_persona", seededAnswers.audience, {
    source: "preflight",
    related_sections: ["intelligence", "hero", "features"]
  });

  addFact(facts, "tone_of_voice", inferToneOfVoice(strategy, seededAnswers), {
    source: "inferred",
    related_sections: ["intelligence", "brand", "hero"]
  });

  addFact(facts, "primary_offer", seededAnswers.primary_offer, {
    source: "preflight",
    related_sections: ["hero", "features"]
  });

  addFact(facts, "service_area_main", seededAnswers.service_area, {
    source: "preflight",
    related_sections: ["service_area", "hero"]
  });

  addFact(facts, "service_area_list", seededAnswers.service_areas, {
    source: "preflight",
    related_sections: ["service_area"]
  });

  addFact(facts, "primary_conversion", seededAnswers.primary_conversion, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });

  addFact(facts, "secondary_conversion", seededAnswers.secondary_conversion, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });

  addFact(facts, "conversion_mode", seededAnswers.conversion_mode, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });

  addFact(facts, "cta_text", seededAnswers.cta_text, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });

  addFact(facts, "cta_link", seededAnswers.cta_link, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });

  addFact(facts, "contact_path", seededAnswers.contact_path, {
    source: "preflight",
    related_sections: ["contact"]
  });

  addFact(facts, "booking_method", seededAnswers.booking_method, {
    source: "preflight",
    related_sections: ["contact", "hero"]
  });

  addFact(facts, "trust_signal", seededAnswers.trust_signal, {
    source: "preflight",
    related_sections: ["trustbar", "testimonials", "about"]
  });

  addFact(facts, "differentiation", seededAnswers.differentiation, {
    source: "preflight",
    related_sections: ["hero", "about", "features"]
  });

  addFact(facts, "website_direction", seededAnswers.website_direction, {
    source: "preflight",
    related_sections: ["hero", "about"]
  });

  addFact(facts, "business_understanding", seededAnswers.business_understanding, {
    source: "preflight",
    related_sections: ["hero", "about"]
  });

  addFact(facts, "opportunity", seededAnswers.opportunity, {
    source: "preflight",
    related_sections: ["hero", "about", "faqs"]
  });

  addFact(facts, "recommended_focus", seededAnswers.recommended_focus, {
    source: "preflight",
    related_sections: ["features", "hero", "faqs"]
  });

  addFact(facts, "recommended_sections", seededAnswers.recommended_sections, {
    source: "preflight",
    verified: true,
    related_sections: ["strategy"]
  });

  addFact(facts, "faq_angles", seededAnswers.faq_angles, {
    source: "preflight",
    related_sections: ["faqs"]
  });

  addFact(facts, "aeo_angles", seededAnswers.aeo_angles, {
    source: "preflight",
    related_sections: ["faqs", "hero"]
  });

  addFact(facts, "vibe", cleanString(visualStrategy?.recommended_vibe), {
    source: "preflight",
    related_sections: ["settings"]
  });

  addFact(facts, "image_themes", cleanList(normalizedStrategy.visual_strategy.preferred_image_themes), {
    source: "preflight",
    related_sections: ["hero", "gallery"]
  });

  addFact(facts, "google_presence_insight", seededAnswers.google_presence_insight, {
    source: "preflight",
    related_sections: ["about", "trustbar"]
  });

  addFact(facts, "next_step_teaser", seededAnswers.next_step_teaser, {
    source: "preflight",
    related_sections: ["hero"]
  });

  addFact(facts, "review_quotes", [], {
    source: "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "review_quotes"),
    related_sections: ["testimonials"]
  });

  addFact(facts, "phone", cleanString(napRecommendation?.phone), {
    source: cleanString(napRecommendation?.phone) ? "preflight" : "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "phone"),
    related_sections: ["brand", "contact"]
  });

  addFact(facts, "address", cleanString(napRecommendation?.address), {
    source: cleanString(napRecommendation?.address) ? "preflight" : "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "address"),
    related_sections: ["brand", "contact"]
  });

  addFact(facts, "hours", "", {
    source: "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "hours"),
    related_sections: ["contact"]
  });

  addFact(facts, "pricing", "", {
    source: "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "pricing"),
    related_sections: ["investment", "faqs", "contact"]
  });

  addFact(facts, "booking_url", derivePossibleBookingUrl(strategy, reconData), {
    source: derivePossibleBookingUrl(strategy, reconData) ? "preflight" : "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "booking_url"),
    related_sections: ["contact", "settings"]
  });

  addFact(facts, "email", cleanString(reconData?.client_email), {
    source: cleanString(reconData?.client_email) ? "preflight" : "missing",
    related_sections: ["brand", "contact"]
  });

  addFact(facts, "founder_story", "", {
    source: "missing",
    related_sections: ["about"]
  });

  addFact(facts, "years_experience", "", {
    source: "missing",
    related_sections: ["about", "trustbar"]
  });

  addFact(facts, "service_list", inferServiceList(seededAnswers, clientPreview), {
    source: hasMeaningfulValue(inferServiceList(seededAnswers, clientPreview)) ? "inferred" : "missing",
    related_sections: ["features"]
  });

  addFact(facts, "process_summary", "", {
    source: "missing",
    related_sections: ["processSteps"]
  });

  addFact(facts, "surrounding_cities", [], {
    source: "missing",
    related_sections: ["service_area"]
  });

  addFact(facts, "gallery_visual_direction", firstNonEmpty([
    cleanList(normalizedStrategy.visual_strategy.preferred_image_themes),
    cleanList(seededAnswers.recommended_focus)
  ]), {
    source: "preflight",
    related_sections: ["gallery", "hero"]
  });

  hydrateServiceAreaFromPreflight(facts, reconData);
  return facts;
}

/**
 * Seed primary service area from recon / entity profile when answers did not carry it.
 */
function hydrateServiceAreaFromPreflight(facts, reconData) {
  const recon = reconPayloadRoot(reconData);
  const ep = safeParseJsonString(recon?.entity_profile_json);
  let areas = cleanList(recon?.service_area);
  if (isObject(ep)) {
    areas = [...areas, ...cleanList(ep.service_area)];
  }
  if (!areas.length) return facts;

  const main = cleanString(areas[0]);
  if (!main) return facts;

  const cur = facts.service_area_main;
  if (cur && hasMeaningfulValue(cur.value)) return facts;

  facts.service_area_main = {
    value: main,
    source: "preflight",
    confidence: 0.8,
    verified: false,
    status: "prefilled_unverified",
    related_sections: Array.isArray(cur?.related_sections) ? cur.related_sections : ["service_area", "hero"]
  };
  return facts;
}

function addFact(registry, key, value, options = {}) {
  registry[key] = {
    value,
    source: options.source || "missing",
    confidence:
      typeof options.confidence === "number"
        ? options.confidence
        : inferConfidence(options.source, value),
    verified: !!options.verified,
    requires_client_verification: !!options.requires_client_verification,
    related_sections: asArray(options.related_sections),
    status: hasMeaningfulValue(value) ? (options.verified ? "verified" : "seeded") : "missing"
  };
}

/**
 * Overlay `preflight_intelligence` onto existing fact rows (PI is authoritative copy; still unverified until intake confirms).
 * Sets status `prefilled_unverified` so intake-next treats fields as not yet resolved (see isFactResolved).
 */
function hydrateFromPreflight(existingEntry, value) {
  const leaf = extractValue(value);
  if (!hasMeaningfulValue(leaf)) return existingEntry;
  if (!isObject(existingEntry)) return existingEntry;
  return {
    ...existingEntry,
    value: leaf,
    source: "preflight",
    confidence: 0.7,
    verified: false,
    status: "prefilled_unverified"
  };
}

function hydrateFactRegistryWithPreflightIntelligence(facts, pi) {
  if (!isObject(facts) || !isObject(pi)) return;

  const positioning = cleanString(pi.positioning);
  if (facts.business_understanding && positioning) {
    facts.business_understanding = hydrateFromPreflight(facts.business_understanding, positioning);
  }

  const opportunity = cleanString(pi.opportunity);
  if (facts.opportunity && opportunity) {
    facts.opportunity = hydrateFromPreflight(facts.opportunity, opportunity);
  }

  const diffHyp = cleanString(pi.differentiation_hypothesis);
  if (facts.differentiation && diffHyp) {
    facts.differentiation = hydrateFromPreflight(facts.differentiation, diffHyp);
  }

  const trustFirst = cleanList(pi.trust_markers)[0];
  if (facts.trust_signal && trustFirst) {
    facts.trust_signal = hydrateFromPreflight(facts.trust_signal, trustFirst);
  }

  const mergedAeo = uniqueList([
    ...cleanList(facts.aeo_angles?.value),
    ...cleanList(pi.winning_angle ? [pi.winning_angle] : [])
  ]);
  if (facts.aeo_angles && mergedAeo.length) {
    facts.aeo_angles = hydrateFromPreflight(facts.aeo_angles, mergedAeo);
  }

  const mergedFocus = uniqueList([
    ...cleanList(facts.recommended_focus?.value),
    ...cleanList(pi.recommended_focus)
  ]);
  if (facts.recommended_focus && mergedFocus.length) {
    facts.recommended_focus = hydrateFromPreflight(facts.recommended_focus, mergedFocus);
  }

  const webDir = cleanString(pi.website_direction);
  if (facts.website_direction && webDir) {
    facts.website_direction = hydrateFromPreflight(facts.website_direction, webDir);
  }

  const personaHint = cleanString(pi.target_persona_hint);
  if (facts.target_persona && !hasMeaningfulValue(facts.target_persona.value) && personaHint) {
    facts.target_persona = hydrateFromPreflight(facts.target_persona, personaHint);
  }

  const rfForThemes = cleanList(pi.recommended_focus);
  const existingThemes = cleanList(facts.image_themes?.value);
  if (facts.image_themes && !existingThemes.length && rfForThemes.length) {
    facts.image_themes = hydrateFromPreflight(facts.image_themes, rfForThemes);
  }
}

function inferConfidence(source, value) {
  if (!hasMeaningfulValue(value)) return 0;
  if (source === "preflight") return 0.85;
  if (source === "inferred") return 0.65;
  if (source === "user") return 1;
  return 0.5;
}

function includesVerificationField(copyPolicy, name) {
  return cleanList(copyPolicy?.fields_requiring_verification).includes(name);
}

function derivePossibleBookingUrl(strategy, reconData) {
  const sourceSnapshot = isObject(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  return firstNonEmpty([
    cleanString(sourceSnapshot?.booking_url),
    cleanString(reconData?.booking_url),
    cleanString(strategy?.contact?.booking_url)
  ]);
}

function inferToneOfVoice(strategy, seededAnswers) {
  const vibe = cleanString(
    strategy?.visual_strategy?.recommended_vibe || seededAnswers?.future_dynamic_vibe_hint
  ).toLowerCase();
  const category = cleanString(strategy?.business_context?.category).toLowerCase();
  const archetype = cleanString(strategy?.business_context?.strategic_archetype).toLowerCase();

  if (vibe.includes("luxury")) return "Confident, polished, and premium";
  if (vibe.includes("legacy")) return "Reassuring, credible, and professional";
  if (vibe.includes("solar flare")) return "Bold, energetic, and modern";
  if (archetype.includes("high_consideration")) return "Trust-building, clear, and expert";
  if (category) return `${titleCaseWords(category)}-appropriate, clear, and confident`;
  return "Clear, modern, and trustworthy";
}

function inferServiceList(seededAnswers, clientPreview) {
  const focus = cleanList(seededAnswers?.recommended_focus);
  const faq = cleanList(seededAnswers?.faq_angles);
  const offer = cleanString(seededAnswers?.primary_offer);
  const previewFocus = cleanList(clientPreview?.recommended_focus);

  const candidates = uniqueList([...focus, ...previewFocus, ...faq]).filter((item) => {
    const lower = item.toLowerCase();
    return !lower.includes("?") && lower.length <= 60;
  });

  if (candidates.length > 0) return candidates.slice(0, 4);
  if (offer) return [offer];
  return [];
}

/* --------------------------------
   BUSINESS DRAFT
-------------------------------- */

function buildBusinessDraft(strategy, reconData, seededAnswers, normalizedStrategy, factRegistry) {
  const businessName = factValue(factRegistry, "business_name");
  const recommendedSections = cleanList(seededAnswers.recommended_sections);
  const serviceAreas = cleanList(seededAnswers.service_areas);
  const menu = buildMenu(normalizedStrategy.schema_toggles);

  const headline = buildHeroHeadline(seededAnswers, normalizedStrategy);
  const subtext = buildHeroSubtext(seededAnswers, normalizedStrategy);
  const heroImageQuery = buildHeroImageQuery(normalizedStrategy, seededAnswers);
  const galleryImageQuery = buildGalleryImageQuery(normalizedStrategy, seededAnswers);

  const draft = {
    intelligence: compactObject({
      industry: factValue(factRegistry, "industry"),
      target_persona: factValue(factRegistry, "target_persona"),
      tone_of_voice: factValue(factRegistry, "tone_of_voice")
    }),

    strategy: compactObject({
      ...normalizedStrategy.schema_toggles
    }),

    settings: compactObject({
      vibe: factValue(factRegistry, "vibe") || "",
      menu,
      cta_text: factValue(factRegistry, "cta_text") || "Get Started",
      cta_link: normalizeAnchorLink(factValue(factRegistry, "cta_link") || "#contact"),
      cta_type: inferCtaType(factValue(factRegistry, "cta_link") || "#contact"),
      secondary_cta_text: buildSecondaryCtaText(normalizedStrategy, seededAnswers),
      secondary_cta_link: buildSecondaryCtaLink(normalizedStrategy)
    }),

    brand: compactObject({
      name: businessName,
      slug:
        slugify(cleanString(normalizedStrategy.business_context.slug)) ||
        slugify(businessName),
      tagline: buildTagline(seededAnswers),
      email: factValue(factRegistry, "email"),
      phone: factValue(factRegistry, "phone"),
      office_address: factValue(factRegistry, "address"),
      objection_handle: buildObjectionHandle(normalizedStrategy)
    }),

    hero: compactObject({
      headline,
      subtext,
      image: compactObject({
        alt: buildHeroImageAlt(normalizedStrategy, seededAnswers),
        image_search_query: heroImageQuery
      })
    }),

    about: compactObject({
      story_text: buildAboutStory(seededAnswers),
      founder_note: buildFounderNote(seededAnswers),
      years_experience: factValue(factRegistry, "years_experience")
    }),

    features: buildFeatures(seededAnswers, normalizedStrategy),

    contact: compactObject({
      title: buildContactTitle(normalizedStrategy),
      text: buildContactText(normalizedStrategy, seededAnswers),
      cta_text: factValue(factRegistry, "cta_text") || "Get Started",
      cta_link: normalizeAnchorLink(factValue(factRegistry, "cta_link") || "#contact"),
      email: factValue(factRegistry, "email"),
      phone: factValue(factRegistry, "phone"),
      booking_url: factValue(factRegistry, "booking_url"),
      office_address: factValue(factRegistry, "address")
    })
  };

  if (normalizedStrategy.schema_toggles.show_trustbar) {
    draft.trustbar = {
      enabled: true,
      headline: buildTrustbarHeadline(seededAnswers),
      items: buildTrustbarItems(normalizedStrategy, seededAnswers)
    };
  }

  if (normalizedStrategy.schema_toggles.show_process) {
    draft.processSteps = buildProcessStepsPlaceholder();
  }

  if (normalizedStrategy.schema_toggles.show_testimonials) {
    draft.testimonials = buildTestimonialsPlaceholder(recommendedSections);
  }

  if (normalizedStrategy.schema_toggles.show_faqs) {
    draft.faqs = buildFaqsDraft(normalizedStrategy, seededAnswers);
  }

  if (normalizedStrategy.schema_toggles.show_gallery) {
    draft.gallery = {
      enabled: true,
      title: buildGalleryTitle(normalizedStrategy),
      layout: null,
      show_titles: false,
      strategy: {
        primary_goal: "visual_trust",
        show_gallery: true
      },
      image_source: {
        provider: "search",
        image_search_query: galleryImageQuery,
        filename_pattern: `${slugify(businessName || "client")}-gallery-{index}`,
        target_folder: slugify(businessName || "client")
      }
    };
  }

  if (normalizedStrategy.schema_toggles.show_service_area) {
    draft.service_area = compactObject({
      main_city: serviceAreas[0] || factValue(factRegistry, "service_area_main"),
      surrounding_cities: cleanList(factValue(factRegistry, "surrounding_cities")),
      travel_note: buildTravelNote(normalizedStrategy),
      cta_text: factValue(factRegistry, "cta_text") || "Check Availability",
      cta_link: normalizeAnchorLink(factValue(factRegistry, "cta_link") || "#contact"),
      map_search_query: buildMapSearchQuery(normalizedStrategy, seededAnswers)
    });
  }

  if (normalizedStrategy.schema_toggles.show_investment) {
    draft.investment = [];
  }

  if (normalizedStrategy.schema_toggles.show_events) {
    draft.events = [];
  }

  if (normalizedStrategy.schema_toggles.show_comparison) {
    draft.comparison = {
      title: "",
      items: []
    };
  }

  return draft;
}

function buildMenu(toggles) {
  const base = [{ label: "Home", path: "#home" }];

  const conditional = [
    { key: "show_about", label: "About", path: "#about" },
    { key: "show_features", label: "Features", path: "#features" },
    { key: "show_events", label: "Events", path: "#events" },
    { key: "show_process", label: "Process", path: "#process" },
    { key: "show_testimonials", label: "Testimonials", path: "#testimonials" },
    { key: "show_comparison", label: "Comparison", path: "#comparison" },
    { key: "show_gallery", label: "Gallery", path: "#gallery" },
    { key: "show_investment", label: "Investment", path: "#investment" },
    { key: "show_faqs", label: "FAQs", path: "#faqs" },
    { key: "show_service_area", label: "Service Area", path: "#service-area" }
  ];

  for (const item of conditional) {
    if (toggles?.[item.key]) {
      base.push({ label: item.label, path: item.path });
    }
  }

  base.push({ label: "Contact", path: "#contact" });
  return base;
}

function normalizeAnchorLink(value) {
  const link = cleanString(value);
  if (!link) return "#contact";
  if (link.startsWith("http://") || link.startsWith("https://")) return link;
  return link.startsWith("#") ? link : `#${link.replace(/^#/, "")}`;
}

function inferCtaType(link) {
  const value = cleanString(link);
  if (value.startsWith("http://") || value.startsWith("https://")) return "external";
  return "anchor";
}

function buildSecondaryCtaText(normalizedStrategy, seededAnswers) {
  if (normalizedStrategy.schema_toggles.show_gallery) return "View Gallery";
  if (normalizedStrategy.schema_toggles.show_faqs) return "Read FAQs";
  return cleanString(seededAnswers?.secondary_conversion)
    ? titleCaseWords(seededAnswers.secondary_conversion.replace(/_/g, " "))
    : "";
}

function buildSecondaryCtaLink(normalizedStrategy) {
  if (normalizedStrategy.schema_toggles.show_gallery) return "#gallery";
  if (normalizedStrategy.schema_toggles.show_faqs) return "#faqs";
  return "";
}

function buildTagline(seededAnswers) {
  return (
    cleanString(seededAnswers?.primary_offer) ||
    cleanString(seededAnswers?.business_understanding) ||
    ""
  );
}

function buildObjectionHandle(normalizedStrategy) {
  const objection = firstNonEmpty([
    cleanList(normalizedStrategy?.audience_model?.common_objections)
  ]);

  if (!objection) return "";
  return `Built to address common buyer concerns like ${objection}.`;
}

function buildHeroHeadline(seededAnswers, normalizedStrategy) {
  const offer = cleanString(seededAnswers?.primary_offer);
  const audience = cleanString(seededAnswers?.audience);
  const businessName = cleanString(seededAnswers?.business_name);

  if (offer) return offer;
  if (audience && businessName) return `${businessName} for ${audience}`;
  if (businessName) return `A Better Website Direction for ${businessName}`;
  return `A Clearer, Higher-Converting Presence`;
}

function buildHeroSubtext(seededAnswers, normalizedStrategy) {
  const direction = cleanString(seededAnswers?.website_direction);
  const opportunity = cleanString(seededAnswers?.opportunity);
  const audience = cleanString(seededAnswers?.audience);

  if (direction) return direction;
  if (opportunity) return opportunity;
  if (audience) return `Designed to connect with ${audience} and make the next step feel clear.`;
  return `We’ll refine the story, proof, and conversion path so the site feels premium and easy to act on.`;
}

function buildHeroImageAlt(normalizedStrategy, seededAnswers) {
  const category = cleanString(normalizedStrategy?.business_context?.category);
  const mainCity = cleanString(seededAnswers?.service_area);
  const businessName = cleanString(seededAnswers?.business_name);

  return firstNonEmpty([
    businessName && category ? `${businessName} ${category} hero image` : "",
    category && mainCity ? `${category} in ${mainCity}` : "",
    category ? `${category} website hero image` : "",
    "Business website hero image"
  ]);
}

function buildHeroImageQuery(normalizedStrategy, seededAnswers) {
  const candidates = uniqueList([
    ...cleanList(normalizedStrategy?.visual_strategy?.preferred_image_themes),
    cleanString(seededAnswers?.primary_offer),
    cleanString(normalizedStrategy?.business_context?.category),
    cleanString(seededAnswers?.future_dynamic_vibe_hint)
  ]);

  return candidates.find((item) => item.length >= 4) || "professional business lifestyle";
}

function buildGalleryImageQuery(normalizedStrategy, seededAnswers) {
  const candidates = uniqueList([
    cleanString(seededAnswers?.primary_offer),
    ...cleanList(normalizedStrategy?.visual_strategy?.preferred_image_themes),
    ...cleanList(seededAnswers?.recommended_focus),
    cleanString(normalizedStrategy?.business_context?.category)
  ]);

  return candidates.find((item) => item.length >= 4) || "business portfolio lifestyle";
}

function buildAboutStory(seededAnswers) {
  return firstNonEmpty([
    cleanString(seededAnswers?.business_understanding),
    cleanString(seededAnswers?.website_direction),
    cleanString(seededAnswers?.opportunity)
  ]);
}

function buildFounderNote(seededAnswers) {
  const trust = cleanString(seededAnswers?.trust_signal);
  if (!trust) return "";
  return `The site should reinforce trust through ${trust}.`;
}

function buildFeatures(seededAnswers, normalizedStrategy) {
  const focus = uniqueList([
    ...cleanList(seededAnswers?.recommended_focus),
    ...cleanList(normalizedStrategy?.audience_model?.decision_factors),
    ...cleanList(seededAnswers?.faq_angles)
  ]).filter((item) => !item.includes("?"));

  if (focus.length === 0 && cleanString(seededAnswers?.primary_offer)) {
    return [
      {
        title: "Core Offer",
        description: cleanString(seededAnswers.primary_offer),
        icon_slug: "sparkles"
      }
    ];
  }

  return focus.slice(0, 4).map((item, index) => ({
    title: featureTitleFromText(item, index),
    description: featureDescriptionFromText(item, seededAnswers),
    icon_slug: pickIcon(index)
  }));
}

function featureTitleFromText(text, index) {
  const cleaned = cleanString(text);
  if (!cleaned) return `Feature ${index + 1}`;
  if (cleaned.length <= 36) return cleaned;
  const words = cleaned.split(/\s+/).slice(0, 4);
  return titleCaseWords(words.join(" "));
}

function featureDescriptionFromText(text, seededAnswers) {
  const cleaned = cleanString(text);
  if (!cleaned) return cleanString(seededAnswers?.website_direction) || "";
  if (cleaned.length >= 50) return cleaned;
  return `${cleaned} presented in a way that makes the value clearer to the right buyer.`;
}

function pickIcon(index) {
  const icons = ["sparkles", "shield", "star", "check", "briefcase", "clock"];
  return icons[index % icons.length];
}

function buildContactTitle(normalizedStrategy) {
  const mode = cleanString(
    normalizedStrategy?.conversion_strategy?.primary_conversion ||
      normalizedStrategy?.conversion_strategy?.conversion_mode
  ).toLowerCase();
  if (mode.includes("quote")) return "Request a Quote";
  if (mode.includes("book")) return "Book the Next Step";
  if (mode.includes("call")) return "Start the Conversation";
  return "Take the Next Step";
}

function buildContactText(normalizedStrategy, seededAnswers) {
  return firstNonEmpty([
    cleanString(seededAnswers?.next_step_teaser),
    cleanString(seededAnswers?.website_direction),
    "Tell us a little about what you need and we’ll point you in the right direction."
  ]);
}

function buildTrustbarHeadline(seededAnswers) {
  return cleanString(seededAnswers?.trust_signal)
    ? `Built Around ${titleCaseWords(seededAnswers.trust_signal)}`
    : "Why Visitors Can Feel Confident";
}

function buildTrustbarItems(normalizedStrategy, seededAnswers) {
  const items = uniqueList([
    ...cleanList(normalizedStrategy?.proof_model?.trust_signals),
    ...cleanList(normalizedStrategy?.proof_model?.credibility_sources)
  ]).slice(0, 4);

  if (items.length === 0 && cleanString(seededAnswers?.trust_signal)) {
    items.push(cleanString(seededAnswers.trust_signal));
  }

  return items.slice(0, 4).map((label, index) => ({
    icon: pickIcon(index),
    label: titleCaseWords(label.replace(/_/g, " ")),
    sublabel: ""
  }));
}

function buildFaqsDraft(normalizedStrategy, seededAnswers) {
  return uniqueList([
    ...cleanList(normalizedStrategy?.site_structure?.faq_angles),
    ...cleanList(seededAnswers?.faq_angles)
  ])
    .slice(0, 5)
    .map((question) => ({
      question,
      answer: ""
    }));
}

function buildGalleryTitle(normalizedStrategy) {
  const category = cleanString(normalizedStrategy?.business_context?.category);
  if (category) return `${titleCaseWords(category)} Highlights`;
  return "Featured Work";
}

function buildTravelNote(normalizedStrategy) {
  const model = cleanString(normalizedStrategy?.business_context?.business_model).toLowerCase();
  if (model.includes("service_area")) {
    return "Outside these areas? Reach out and we can confirm fit based on your location.";
  }
  return "";
}

function buildMapSearchQuery(normalizedStrategy, seededAnswers) {
  const offer = cleanString(seededAnswers?.primary_offer);
  const area = cleanString(seededAnswers?.service_area);
  if (offer && area) return `${offer} near ${area}`;
  return area || "";
}

function buildProcessStepsPlaceholder() {
  return [];
}

function buildTestimonialsPlaceholder(recommendedSections) {
  if (
    !cleanList(recommendedSections).some(
      (item) =>
        item.toLowerCase().includes("testimonial") ||
        item.toLowerCase().includes("review")
    )
  ) {
    return [];
  }
  return [];
}

/* --------------------------------
   SECTION STATUS
-------------------------------- */

function computeSectionStatus(strategy, factRegistry, businessDraft) {
  const requirements = getSectionRequirements(strategy);
  const status = {};

  for (const [section, config] of Object.entries(requirements)) {
    const enabled = config.required || !!strategy?.schema_toggles?.[config.toggle_key];
    const missing_fields = [];
    const weak_fields = [];
    const ready_fields = [];

    if (!enabled) {
      status[section] = {
        enabled: false,
        status: "disabled",
        required_for_preview: false,
        fields_needed: [],
        weak_fields: [],
        ready_fields: []
      };
      continue;
    }

    for (const field of config.fields) {
      const value = readPath(businessDraft, field.path);
      if (!hasMeaningfulValue(value)) {
        missing_fields.push(field.path);
        continue;
      }

      if (field.requires_verification && !isFactVerifiedByPath(factRegistry, field.fact_key)) {
        weak_fields.push(field.path);
        continue;
      }

      ready_fields.push(field.path);
    }

    let state = "ready";
    if (missing_fields.length > 0) state = "missing";
    else if (weak_fields.length > 0) state = "partial";

    status[section] = {
      enabled: true,
      status: state,
      required_for_preview: !!config.required_for_preview,
      fields_needed: missing_fields,
      weak_fields,
      ready_fields
    };
  }

  return status;
}

function getSectionRequirements(strategy) {
  const copyPolicy = strategy?.copy_policy || {};

  return {
    intelligence: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "intelligence.industry", fact_key: "industry" },
        { path: "intelligence.target_persona", fact_key: "target_persona" },
        { path: "intelligence.tone_of_voice", fact_key: "tone_of_voice" }
      ]
    },
    strategy: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [{ path: "strategy.show_features" }]
    },
    settings: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "settings.vibe", fact_key: "vibe" },
        { path: "settings.cta_text", fact_key: "cta_text" },
        { path: "settings.cta_link", fact_key: "cta_link" }
      ]
    },
    brand: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "brand.name", fact_key: "business_name" },
        { path: "brand.tagline", fact_key: "primary_offer" }
      ]
    },
    hero: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "hero.headline", fact_key: "primary_offer" },
        { path: "hero.subtext", fact_key: "website_direction" },
        { path: "hero.image.alt", fact_key: "primary_offer" },
        { path: "hero.image.image_search_query", fact_key: "image_themes" }
      ]
    },
    about: {
      required: true,
      required_for_preview: false,
      toggle_key: "show_about",
      fields: [
        { path: "about.story_text", fact_key: "business_understanding" },
        { path: "about.founder_note", fact_key: "trust_signal" },
        {
          path: "about.years_experience",
          fact_key: "years_experience",
          requires_verification: includesVerificationField(copyPolicy, "years_experience")
        }
      ]
    },
    features: {
      required: true,
      required_for_preview: true,
      toggle_key: "show_features",
      fields: [{ path: "features", fact_key: "service_list" }]
    },
    contact: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "contact.cta_text", fact_key: "cta_text" },
        { path: "contact.cta_link", fact_key: "cta_link" }
      ]
    },
    trustbar: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_trustbar",
      fields: [{ path: "trustbar.items", fact_key: "trust_signal" }]
    },
    processSteps: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_process",
      fields: [{ path: "processSteps", fact_key: "process_summary" }]
    },
    testimonials: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_testimonials",
      fields: [
        { path: "testimonials", fact_key: "review_quotes", requires_verification: true }
      ]
    },
    faqs: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_faqs",
      fields: [{ path: "faqs", fact_key: "faq_angles" }]
    },
    gallery: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_gallery",
      fields: [
        {
          path: "gallery.image_source.image_search_query",
          fact_key: "gallery_visual_direction"
        }
      ]
    },
    service_area: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_service_area",
      fields: [
        { path: "service_area.main_city", fact_key: "service_area_main" },
        { path: "service_area.surrounding_cities", fact_key: "surrounding_cities" }
      ]
    },
    investment: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_investment",
      fields: [
        { path: "investment", fact_key: "pricing", requires_verification: true }
      ]
    },
    events: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_events",
      fields: [{ path: "events", fact_key: "events" }]
    },
    comparison: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_comparison",
      fields: [{ path: "comparison.items", fact_key: "comparison" }]
    }
  };
}

function readPath(obj, path) {
  const parts = cleanString(path).split(".").filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (!isObject(current) && !Array.isArray(current)) return undefined;
    current = current?.[part];
  }

  return current;
}

function factValue(factRegistry, key) {
  return factRegistry?.[key]?.value;
}

function isFactVerifiedByPath(factRegistry, factKey) {
  if (!factKey) return false;
  const fact = factRegistry?.[factKey];
  return !!fact?.verified || !fact?.requires_client_verification;
}


/* --------------------------------
   QUESTION RENDERING
-------------------------------- */

// ==========================
// PHASE 2.7 — FIELD-AWARE QUESTION RENDERING
// ==========================

function renderFieldScopedQuestion(plan) {
  const field = cleanString(plan?.primary_field);

  switch (field) {
    case "differentiation":
      return "What makes your business stand out from others offering similar services?";

    case "target_persona":
      return "Who is the ideal client you do your best work for?";

    case "primary_offer":
      return "What is the main service or outcome you provide to customers?";

    case "pricing":
      return "How do customers typically think about pricing or value when working with you?";

    case "process_summary":
      return "What does working with you typically look like from start to finish?";

    case "service_area_main":
      return "Where do you primarily provide your services?";

    case "booking_method":
      return "What is the typical next step a customer takes to get started?";

    case "phone":
      return "What phone number should customers use to reach you?";

    case "address":
      return "What is your business address (if customers visit in person)?";

    case "hours":
      return "What are your typical business hours?";

    default:
      return null;
  }
}

function renderQuestion(questionPlan, blueprint) {
  if (!questionPlan) return "";

  const scoped = renderFieldScopedQuestion(questionPlan);
  if (scoped) {
    return scoped;
  }

  const businessName =
    cleanString(blueprint?.strategy?.business_context?.business_name) || "your business";
  const category = cleanString(blueprint?.strategy?.business_context?.category);
  const conversionMode = cleanString(
    blueprint?.strategy?.conversion_strategy?.conversion_mode ||
      blueprint?.strategy?.conversion_strategy?.primary_conversion
  );

  const renderers = {
    positioning() {
      return `I reviewed the preflight direction for ${businessName}. To sharpen the page around the right message, who is the ideal fit, what are they usually coming to you for, and what makes your approach the better choice?`;
    },

    conversion() {
      return `When someone is ready to move forward with ${businessName}, how do they typically take the next step — do they call, request a quote, use a form, book online, or something else?`;
    },

    service_area() {
      return `What is the main city or region you want the site to lead with, and what nearby areas should visitors know you also serve?`;
    },

    proof() {
      return `What should make someone feel confident choosing ${businessName} right away—reviews, years of experience, credentials, notable results, guarantees, or something else?`;
    },

    brand_story() {
      return `How did ${businessName} start, and what should the site help people understand about your standards, philosophy, or the way you work?`;
    },

    process() {
      return `When someone decides to work with ${businessName}, what does the journey typically look like—from the first conversation to the outcome you're helping them reach?`;
    },

    visual_direction() {
      return `What kinds of images or examples should the site show most, and what overall vibe should those visuals create for the right visitor?`;
    },

    contact_details() {
      return `To make the site publish-ready, what contact details should we treat as accurate right now—email, phone, address, hours, or anything that should stay private for now?`;
    },

    pricing() {
      return `Do you offer standardized pricing or packages, or is the best way to frame pricing as custom, quote-based, or starting at a certain level?`;
    }
  };

  if (renderers[questionPlan.bundle_id]) {
    return renderers[questionPlan.bundle_id]();
  }

  const categoryLine = category ? ` for ${category}` : "";
  const conversionLine = conversionMode
    ? ` and the main next step should support ${conversionMode.replace(/_/g, " ")}`
    : "";

  return `I reviewed the preflight direction for ${businessName}${categoryLine}. What feels most important to clarify first so the site reflects the business well${conversionLine}?`;
}

function fallbackOpeningMessage(state) {
  const businessName = cleanString(state?.businessName) || "your business";
  return `I reviewed the preflight direction for ${businessName}. Let’s verify the most important details so the preview feels premium, accurate, and conversion-ready.`;
}

/* --------------------------------
   READINESS
-------------------------------- */

function evaluateBlueprintReadiness(blueprint) {
  const sectionStatus = isObject(blueprint?.section_status) ? blueprint.section_status : {};
  const enabledSections = Object.entries(sectionStatus).filter(([, value]) => value?.enabled);
  const requiredPreviewSections = enabledSections.filter(([, value]) => value?.required_for_preview);

  const readyRequiredCount = requiredPreviewSections.filter(([, value]) => value?.status === "ready").length;
  const totalRequiredCount = requiredPreviewSections.length || 1;
  const score = Number((readyRequiredCount / totalRequiredCount).toFixed(2));

  const blockingSections = requiredPreviewSections
    .filter(([, value]) => value?.status !== "ready")
    .map(([key]) => key);

  const queue = Array.isArray(blueprint?.verification_queue) ? blueprint.verification_queue : [];
  const mustVerifyOpen = queue.filter((item) => item.priority >= 85).map((item) => item.field_key);

  return {
    score,
    can_generate_now: blockingSections.length === 0 && mustVerifyOpen.length === 0,
    remaining_blocks: blockingSections,
    satisfied_blocks: requiredPreviewSections
      .filter(([, value]) => value?.status === "ready")
      .map(([key]) => key),
    must_verify_open: mustVerifyOpen
  };
}