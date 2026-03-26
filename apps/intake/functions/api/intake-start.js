/**
 * SITEFORGE FACTORY: intake-start.js
 * Role: Bootstraps the Paid Intake session for the V2 narrative-guided intake flow.
 * Logic:
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
      return json(
        { ok: false, error: "Invalid JSON payload" },
        400
      );
    }

    const slug = String(body.slug || "").trim();
    if (!slug) {
      return json(
        { ok: false, error: "Missing slug", received: body },
        400
      );
    }

    // 1. FETCH PREVIEW/PREFLIGHT SOURCE OF TRUTH
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

    // 2. SEED ANSWERS FROM RECON / STRATEGY
    const seededAnswers = buildSeededAnswers(strategy, reconData);

    // 3. BUILD INITIAL READINESS + FIRST QUESTION DETERMINISTICALLY
    const initialState = {
      slug,
      businessName:
        reconData.input_business_name ||
        strategy?.business_context?.business_name ||
        "New Partner",
      clientEmail: reconData.client_email || "",
      phase: "narrative_unlock",

      answers: seededAnswers,
      ghostwritten: {},

      // kept for compatibility with downstream state readers, but no longer
      // the driver of controller logic
      verified: {},
      verification: {
        queue_complete: false,
        verified_count: 0,
        remaining_keys: []
      },

      conversation: [],

      meta: {
        category,
        intake_version: "v2-narrative"
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

    const readiness = evaluateNarrativeReadiness(initialState);
    initialState.readiness = readiness;

    const firstKey = selectNextKey(initialState);
    const openingMessage =
      buildQuestionForKey(initialState, firstKey) ||
      fallbackOpeningMessage(initialState);

    initialState.verification.remaining_keys = firstKey ? [firstKey] : [];
    initialState.verification.queue_complete = !firstKey;
    initialState.verification.verified_count = 0;
    initialState.conversation.push({ role: "assistant", content: openingMessage });

    // 4. SYNC TO ORCHESTRATOR
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function safeStrategy(reconData) {
  if (reconData?.strategy_contract && typeof reconData.strategy_contract === "object") {
    return reconData.strategy_contract;
  }

  if (reconData?.paid_intake_json) {
    try {
      const parsed = JSON.parse(reconData.paid_intake_json);
      if (parsed?.strategy_contract && typeof parsed.strategy_contract === "object") {
        return parsed.strategy_contract;
      }
    } catch {
      // ignore parse failure and fall through
    }
  }

  return {};
}

function normalizeCategory(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (["event", "events"].includes(raw)) return "event";
  if (["coach", "coaching", "consultant", "consulting"].includes(raw)) return "coach";
  if (["portfolio", "creative", "artist", "designer"].includes(raw)) return "portfolio";
  return "service";
}

function buildSeededAnswers(strategy, reconData) {
  const businessContext = strategy?.business_context || {};
  const sourceSnapshot = strategy?.source_snapshot || {};
  const internalStrategy = strategy?.internal_strategy || {};
  const recommendedSections = internalStrategy?.recommended_sections || [];

  const serviceAreaArray = Array.isArray(businessContext?.service_area)
    ? businessContext.service_area
    : [];

  const cta = extractPrimaryCta(strategy);
  const bookingMethod = extractBookingMethod(strategy, reconData);
  const contactPath = bookingMethod || cta.link || "";

  return compactObject({
    business_name: businessContext.business_name || reconData.input_business_name || "",
    category: normalizeCategory(
      businessContext.category ||
      businessContext.business_type ||
      internalStrategy.business_category ||
      "service"
    ),
    primary_offer: sourceSnapshot.primary_offer_hint || "",
    audience: sourceSnapshot.target_audience_hint || "",
    service_area: serviceAreaArray[0] || "",
    service_areas: serviceAreaArray,
    trust_signal: firstNonEmpty([
      sourceSnapshot.trust_hint,
      extractTrustHint(strategy),
      extractGbpInsight(reconData)
    ]),
    contact_path: contactPath,
    booking_method: bookingMethod,
    cta_text: cta.text,
    cta_link: cta.link,
    primary_conversion: internalStrategy.primary_conversion || "",
    differentiation: sourceSnapshot.differentiator_hint || "",
    website_direction: reconData.website_direction || "",
    business_understanding: reconData.business_understanding || "",
    opportunity: reconData.opportunity || "",
    recommended_focus: Array.isArray(reconData.recommended_focus)
      ? reconData.recommended_focus
      : [],
    recommended_sections: Array.isArray(recommendedSections)
      ? recommendedSections
      : []
  });
}

function extractPrimaryCta(strategy) {
  const settings = strategy?.settings || {};
  return {
    text: settings.cta_text || strategy?.internal_strategy?.cta_text || "",
    link: settings.cta_link || strategy?.internal_strategy?.cta_link || ""
  };
}

function extractBookingMethod(strategy, reconData) {
  const sourceSnapshot = strategy?.source_snapshot || {};
  const recon = reconData || {};

  return firstNonEmpty([
    sourceSnapshot.booking_method_hint,
    sourceSnapshot.booking_url,
    recon.booking_url,
    recon.booking_method,
    strategy?.contact?.booking_url,
    strategy?.contact?.method
  ]);
}

function extractTrustHint(strategy) {
  const sourceSnapshot = strategy?.source_snapshot || {};
  const internalStrategy = strategy?.internal_strategy || {};
  const trustAngles = Array.isArray(internalStrategy?.trust_angles)
    ? internalStrategy.trust_angles
    : [];
  return sourceSnapshot.trust_hint || trustAngles[0] || "";
}

function extractGbpInsight(reconData) {
  return firstNonEmpty([
    reconData?.google_presence_insight,
    reconData?.recon?.google_presence_insight
  ]);
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value[0];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function compactObject(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value) && value.length > 0) {
      out[key] = value;
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
      continue;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Narrative model                                                            */
/* -------------------------------------------------------------------------- */

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
  supporting_detail: ["recommended_focus", "recommended_sections"],
  service_area: ["service_area", "service_areas"],
  when_where: ["service_area", "service_areas"],
  why_attend: ["opportunity", "recommended_focus"],
  transformation: ["opportunity", "website_direction"],
  proof_of_quality: ["trust_signal", "recommended_sections"]
};

function evaluateNarrativeReadiness(state) {
  const category = state?.meta?.category || "service";
  const model = getNarrativeModel(category);

  const satisfiedBlocks = [];
  const remainingBlocks = [];

  for (const block of model.must_express) {
    if (isBlockSatisfied(state, block)) satisfiedBlocks.push(block);
    else remainingBlocks.push(block);
  }

  const totalMust = model.must_express.length || 1;
  const score = satisfiedBlocks.length / totalMust;

  return {
    score,
    can_generate_now: remainingBlocks.length === 0,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks
  };
}

function isBlockSatisfied(state, block) {
  const candidateKeys = BLOCK_MAP[block] || [];
  return candidateKeys.some((key) => hasMeaningfulValue(state?.answers?.[key]));
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some((v) => hasMeaningfulValue(v));
  if (value && typeof value === "object") {
    return Object.values(value).some((v) => hasMeaningfulValue(v));
  }
  return typeof value === "string" && value.trim().length > 0;
}

function buildNarrativeQueue(state) {
  const category = state?.meta?.category || "service";
  const model = getNarrativeModel(category);

  const mustQueue = model.must_express.filter((block) => !isBlockSatisfied(state, block));
  if (mustQueue.length > 0) return mustQueue;

  return model.should_express.filter((block) => !isBlockSatisfied(state, block));
}

function selectNextKey(state) {
  const queue = buildNarrativeQueue(state);
  const nextBlock = queue[0];
  if (!nextBlock) return null;
  return resolveKeyFromBlock(nextBlock, state);
}

function resolveKeyFromBlock(block, state) {
  const candidates = BLOCK_MAP[block] || [];
  return candidates.find((key) => !hasMeaningfulValue(state?.answers?.[key])) || candidates[0] || null;
}

/* -------------------------------------------------------------------------- */
/* Questioning                                                                */
/* -------------------------------------------------------------------------- */

function buildQuestionForKey(state, key) {
  const businessName = state?.businessName || "your business";
  const category = state?.meta?.category || "service";

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
  const businessName = state?.businessName || "your business";
  return `I reviewed the preflight direction for ${businessName}. Let’s tighten the story so the preview feels premium and conversion-ready. What is the main thing you want this page to help customers do?`;
}