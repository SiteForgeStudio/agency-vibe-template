/**
 * SITEFORGE FACTORY: intake-start.js
 * Role: Bootstraps the Paid Intake session for the V2 narrative-guided intake flow.
 *
 * Purpose:
 * - Fetch preflight as the source of truth
 * - Seed a deterministic intake state from recon + strategy_contract
 * - Derive the first narrative block/question from business category
 * - Persist initialized state to the orchestrator
 *
 * Notes:
 * - No AI-generated opening message
 * - No verification-engine framing
 * - Keeps compatibility with existing strategy_contract provenance
 */

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
    const category = normalizeCategory(
      strategy?.business_context?.category ||
      strategy?.business_context?.business_type ||
      strategy?.internal_strategy?.business_category ||
      "service"
    );

    // 2) SEED ANSWERS FROM REAL CURRENT PRE-FLIGHT SHAPE
    const seededAnswers = buildSeededAnswers(strategy, reconData);

    // 3) INITIALIZE STATE
    const initialState = {
      slug,
      businessName:
        cleanString(reconData.input_business_name) ||
        cleanString(strategy?.business_context?.business_name) ||
        "New Partner",
      clientEmail: cleanString(reconData.client_email),
      phase: "narrative_unlock",

      answers: seededAnswers,
      ghostwritten: {},

      // kept for compatibility with existing readers; not the controller brain
      verified: {},
      verification: {
        queue_complete: false,
        verified_count: 0,
        remaining_keys: [],
        last_updated: new Date().toISOString()
      },

      conversation: [],

      meta: {
        category,
        intake_version: "v2-narrative",
        seeded: buildSeedMeta(seededAnswers),
        inferred: {},
        verified: {}
      },

      provenance: {
        strategy_contract: strategy,
        recon_snapshot: reconData
      },

      readiness: {
        score: 0,
        can_generate_now: false,
        remaining_blocks: [],
        satisfied_blocks: []
      }
    };

    // 4) EVALUATE READINESS + PICK FIRST QUESTION DETERMINISTICALLY
    initialState.readiness = evaluateNarrativeReadiness(initialState);

    const firstKey = selectNextKey(initialState);
    const openingMessage =
      buildQuestionForKey(initialState, firstKey) ||
      fallbackOpeningMessage(initialState);

    initialState.current_key = firstKey;
    initialState.verification.remaining_keys = firstKey ? [firstKey] : [];
    initialState.verification.queue_complete = !firstKey;

    initialState.conversation.push({
      role: "assistant",
      content: openingMessage
    });

    // 5) SYNC TO ORCHESTRATOR
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

    return json({
      ok: true,
      message: openingMessage,
      state: initialState
    });
  } catch (err) {
    console.error("[intake-start]", err);
    return json({ ok: false, error: err.message || "Unknown error" }, 500);
  }
}

/* --------------------------------
   RESPONSE HELPERS
-------------------------------- */

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

function normalizeCategory(value) {
  const raw = cleanString(value).toLowerCase();

  if (!raw) return "service";

  if (["event", "events", "tour", "tours", "experience"].includes(raw)) {
    return "event";
  }

  if (["coach", "coaching", "consultant", "consulting"].includes(raw)) {
    return "coach";
  }

  if (["portfolio", "creative", "artist", "designer", "photographer"].includes(raw)) {
    return "portfolio";
  }

  return "service";
}

/* --------------------------------
   STRATEGY EXTRACTION
-------------------------------- */

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
      "service"
    ),

    primary_offer:
      cleanString(sourceSnapshot?.primary_offer_hint) ||
      cleanString(reconSnapshot?.primary_offer) ||
      cleanString(reconSnapshot?.business_understanding),

    audience:
      cleanString(audienceModel?.primary_persona) ||
      cleanString(audienceModel?.secondary_persona),

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

    opportunity: opportunity,
    recommended_focus: recommendedFocus,
    recommended_sections: recommendedSections,

    faq_angles: cleanList(siteStructure?.faq_angles),
    aeo_angles: cleanList(siteStructure?.aeo_angles),
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
  ]).slice(0, 5);
}

function deriveRecommendedSections(strategy, reconData) {
  const siteStructure = isObject(strategy?.site_structure) ? strategy.site_structure : {};
  const reconSnapshot = isObject(reconData) ? reconData : {};

  return uniqueList([
    ...cleanList(siteStructure?.recommended_sections),
    ...cleanList(reconSnapshot?.recommended_sections)
  ]);
}

function uniqueList(values) {
  return Array.from(new Set(cleanList(values)));
}

function buildSeedMeta(seededAnswers) {
  const seeded = {};
  for (const [key, value] of Object.entries(seededAnswers || {})) {
    seeded[key] = hasMeaningfulValue(value);
  }
  return seeded;
}

/* --------------------------------
   NARRATIVE MODEL
-------------------------------- */

function getNarrativeModel(category) {
  const sharedMust = ["what_it_is", "who_its_for", "why_trust_it", "what_to_do_next"];
  const sharedShould = ["differentiation", "supporting_detail"];

  const models = {
    service: {
      must_express: sharedMust,
      should_express: [...sharedShould, "service_area"]
    },
    event: {
      must_express: ["what_it_is", "who_its_for", "when_where", "what_to_do_next"],
      should_express: ["why_attend", "trust_signal", "supporting_detail"]
    },
    coach: {
      must_express: ["what_it_is", "who_its_for", "transformation", "what_to_do_next"],
      should_express: ["why_trust_it", "differentiation", "supporting_detail"]
    },
    portfolio: {
      must_express: ["what_it_is", "who_its_for", "proof_of_quality", "what_to_do_next"],
      should_express: ["differentiation", "supporting_detail"]
    }
  };

  return models[category] || models.service;
}

const BLOCK_MAP = {
  what_it_is: ["primary_offer", "business_understanding", "website_direction"],
  who_its_for: ["audience"],
  why_trust_it: ["trust_signal"],
  what_to_do_next: ["contact_path", "booking_method", "cta_text", "cta_link"],
  differentiation: ["differentiation", "opportunity"],
  supporting_detail: ["recommended_focus", "recommended_sections", "faq_angles", "aeo_angles"],
  service_area: ["service_area", "service_areas"],
  when_where: ["service_area", "service_areas"],
  why_attend: ["opportunity", "recommended_focus"],
  transformation: ["opportunity", "website_direction"],
  proof_of_quality: ["trust_signal", "recommended_sections"]
};

function isBlockSatisfied(state, block) {
  const candidates = BLOCK_MAP[block] || [];
  return candidates.some((key) => hasMeaningfulValue(state?.answers?.[key]));
}

function buildNarrativeQueue(state) {
  const category = cleanString(state?.meta?.category) || "service";
  const model = getNarrativeModel(category);

  const mustQueue = model.must_express.filter((block) => !isBlockSatisfied(state, block));
  if (mustQueue.length > 0) return mustQueue;

  return model.should_express.filter((block) => !isBlockSatisfied(state, block));
}

function evaluateNarrativeReadiness(state) {
  const category = cleanString(state?.meta?.category) || "service";
  const model = getNarrativeModel(category);

  const satisfiedBlocks = [];
  const remainingBlocks = [];

  for (const block of model.must_express) {
    if (isBlockSatisfied(state, block)) {
      satisfiedBlocks.push(block);
    } else {
      remainingBlocks.push(block);
    }
  }

  const totalMust = model.must_express.length || 1;
  const score = Number((satisfiedBlocks.length / totalMust).toFixed(2));

  return {
    score,
    can_generate_now: remainingBlocks.length === 0,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks
  };
}

function selectNextKey(state) {
  const queue = buildNarrativeQueue(state);
  const nextBlock = queue[0];
  if (!nextBlock) return null;
  return resolveKeyFromBlock(nextBlock, state);
}

function resolveKeyFromBlock(block, state) {
  const candidates = BLOCK_MAP[block] || [];
  for (const key of candidates) {
    if (!hasMeaningfulValue(state?.answers?.[key])) {
      return key;
    }
  }
  return candidates[0] || null;
}

/* --------------------------------
   QUESTIONING
-------------------------------- */

function buildQuestionForKey(state, key) {
  const businessName = cleanString(state?.businessName) || "your business";
  const category = cleanString(state?.meta?.category) || "service";

  const questions = {
    primary_offer:
      category === "event"
        ? `What exactly is the event, and how would you describe it in a way that would make someone want to attend ${businessName}?`
        : `What is the main thing you want this site to help people understand or buy from ${businessName}?`,

    audience:
      `Who is most likely to choose ${businessName}, and what kind of customer are you hoping this page speaks to best?`,

    trust_signal:
      `What should make someone feel confident choosing ${businessName} right away—experience, results, credentials, reputation, or something else?`,

    contact_path:
      `What is the best next step for a customer—call, text, form, request a quote, or book online?`,

    booking_method:
      `How do customers usually take the next step with you today—phone call, website booking, form, text, or something else?`,

    cta_text:
      `What action do you most want visitors to take when they land on the site?`,

    cta_link:
      `Where should that main call-to-action send them?`,

    differentiation:
      `What makes ${businessName} meaningfully better or more appealing than the alternatives nearby?`,

    opportunity:
      `Where do you see the biggest opportunity for this site to help the business right now?`,

    service_area:
      category === "event"
        ? `Where does this happen, and what location details matter most for attendees?`
        : `What area do you serve, and is there a primary city or region we should lead with?`,

    business_understanding:
      `In one or two sentences, how would you explain the business to someone seeing it for the first time?`,

    website_direction:
      `What should this page feel like and accomplish for the right visitor?`,

    recommended_focus:
      `What are the most important themes or selling points this page should emphasize?`,

    recommended_sections:
      `Are there any sections you already know this page should include?`
  };

  return (
    questions[key] ||
    `Tell me a bit more about ${businessName} so I can sharpen the page direction.`
  );
}

function fallbackOpeningMessage(state) {
  const businessName = cleanString(state?.businessName) || "your business";
  return `I reviewed the preflight direction for ${businessName}. Let’s tighten the story so the preview feels premium and conversion-ready. What is the main thing you want this page to help customers do?`;
}