/**
 * SITEFORGE FACTORY — intake-next.js
 * V2 Narrative + Premium Enrichment Controller
 *
 * Rules:
 * - intake-start.js remains the free -> paid bridge
 * - code owns mutation, readiness, queue, and current_key
 * - no updates object
 * - no ghostwritten_updates
 * - no model-controlled mutation
 * - stage 1 = narrative unlock
 * - stage 2 = premium enrichment
 */

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const body = await request.json();
    let state = normalizeState(structuredClone(body.state || {}));
    const userMessage = cleanString(body.answer || "");

    if (!state.provenance?.strategy_contract) {
      throw new Error("Missing strategy_contract - run intake-start first");
    }

    // Recompute current status up front in case caller sends stale state
    state.readiness = evaluateNarrativeReadiness(state);
    state.enrichment = evaluateEnrichment(state);

    const currentKeyBefore = state.current_key || selectNextKey(state);

    if (userMessage) {
      state.conversation.push({
        role: "user",
        content: userMessage
      });

      extractObviousSignals(state, userMessage);

      if (currentKeyBefore) {
        applyDeterministicAnswer(state, currentKeyBefore, userMessage);
      } else {
        if (state.readiness.can_generate_now) {
          applyFreeformEnrichment(state, userMessage);
        } 
      }

      sanitizeAnswers(state);
    }

    // Recompute after applying input
    state.readiness = evaluateNarrativeReadiness(state);
    state.enrichment = evaluateEnrichment(state);

    const nextKey = selectNextKey(state);
    state.current_key = nextKey;
    state.verification = buildCompatibilityVerification(state);

    const isComplete =
      state.readiness.can_generate_now &&
      state.enrichment.ready_for_preview &&
      !nextKey;

    if (isComplete) {
      state.phase = "intake_complete";
      state.action = "complete";
    } else if (state.readiness.can_generate_now) {
      state.phase = "premium_enrichment";
      state.action = "continue";
    } else {
      state.phase = "narrative_unlock";
      state.action = "continue";
    }

    const assistantMessage = buildAssistantMessage(state, nextKey);

    state.conversation.push({
      role: "assistant",
      content: assistantMessage
    });

    return json({
      ok: true,
      state,
      current_key: nextKey,
      action: state.action,
      message: assistantMessage
    });
  } catch (err) {
    console.error("[intake-next]", err);
    return json({ ok: false, error: err.message || "Unknown error" }, 500);
  }
}

/* --------------------------------
   CORE FLOW
-------------------------------- */

function applyDeterministicAnswer(state, key, rawInput) {
  const canonicalKey = canonicalizeKey(key);
  const targetPath = getAnswerPathForKey(canonicalKey);
  if (!targetPath) return;

  const extracted = extractAnswerForKey(canonicalKey, rawInput, state);
  if (!hasMeaningfulValue(extracted)) return;

  setByPath(state, targetPath, extracted);

  const answerField = targetPath.replace(/^answers\./, "");
  state.verified[answerField] = true;
  state.meta.verified[answerField] = true;
}

function applyFreeformEnrichment(state, rawInput) {
  const text = collapseWhitespace(rawInput);
  if (!text) return;

  // If the user gives a rich answer when we don't have a current key,
  // opportunistically enrich useful premium fields.
  const sentenceCount = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  if (sentenceCount >= 2) {
    if (!hasMeaningfulValue(state.answers.service_descriptions)) {
      state.answers.service_descriptions = text;
      state.meta.inferred.service_descriptions = true;
    } else if (!hasMeaningfulValue(state.answers.process_notes)) {
      state.answers.process_notes = text;
      state.meta.inferred.process_notes = true;
    } else if (!hasMeaningfulValue(state.answers.founder_bio)) {
      state.answers.founder_bio = text;
      state.meta.inferred.founder_bio = true;
    }
  }
}

function buildAssistantMessage(state, nextKey) {
  if (nextKey) {
    return buildQuestionForKey(state, nextKey);
  }

  if (state.readiness.can_generate_now && !state.enrichment.ready_for_preview) {
    return `We now understand the business clearly. I want to sharpen a few premium details so the preview feels custom, credible, and high-converting before we generate it.`;
  }

  return "Excellent — we now have enough clarity and premium detail to generate a strong preview direction.";
}

/* --------------------------------
   V2 QUEUE / READINESS
-------------------------------- */

function selectNextKey(state) {
  const narrativeQueue = buildNarrativeQueue(state);
  if (narrativeQueue.length > 0) {
    return resolveKeyFromBlock(narrativeQueue[0], state);
  }

  const enrichmentQueue = buildEnrichmentQueue(state);
  if (enrichmentQueue.length > 0) {
    return resolveKeyFromBlock(enrichmentQueue[0], state);
  }

  return null;
}

function buildNarrativeQueue(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  const queue = [];

  for (const block of model.must_express) {
    if (!isBlockSatisfied(state, block)) {
      queue.push(block);
    }
  }

  return queue;
}

function buildEnrichmentQueue(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  // only enter enrichment once narrative unlock is satisfied
  const missingNarrative = model.must_express.filter((block) => !isBlockSatisfied(state, block));
  if (missingNarrative.length > 0) return [];

  const queue = [];

  for (const block of model.premium_enrichment) {
    if (!isBlockSatisfied(state, block)) {
      queue.push(block);
    }
  }

  return queue;
}

function evaluateNarrativeReadiness(state) {
  const category = getCategory(state);
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

  const total = model.must_express.length || 1;
  const score = Number((satisfiedBlocks.length / total).toFixed(2));

  return {
    score,
    can_generate_now: remainingBlocks.length === 0,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks
  };
}

function evaluateEnrichment(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  const satisfied = [];
  const remaining = [];

  for (const block of model.premium_enrichment) {
    if (isBlockSatisfied(state, block)) {
      satisfied.push(block);
    } else {
      remaining.push(block);
    }
  }

  const total = model.premium_enrichment.length || 1;
  const score = Number((satisfied.length / total).toFixed(2));

  // This threshold is intentionally stricter than narrative unlock,
  // but still allows a preview to move once most premium blocks are satisfied.
  const readyForPreview = remaining.length <= model.preview_tolerance;

  return {
    score,
    ready_for_preview: readyForPreview,
    remaining_blocks: remaining,
    satisfied_blocks: satisfied
  };
}

function buildCompatibilityVerification(state) {
  const nextKey = state.current_key || selectNextKey(state);
  const narrativeRemaining = state.readiness?.remaining_blocks || [];
  const enrichmentRemaining = state.enrichment?.remaining_blocks || [];

  return {
    queue_complete: !nextKey,
    verified_count:
      (state.readiness?.satisfied_blocks?.length || 0) +
      (state.enrichment?.satisfied_blocks?.length || 0),
    remaining_keys: nextKey ? [nextKey] : [],
    remaining_narrative_blocks: narrativeRemaining,
    remaining_enrichment_blocks: enrichmentRemaining,
    last_updated: new Date().toISOString()
  };
}

/* --------------------------------
   CATEGORY MODEL
-------------------------------- */

function getNarrativeModel(category) {
  const models = {
    service: {
      must_express: [
        "what_it_is",
        "who_its_for",
        "why_trust_it",
        "what_to_do_next"
      ],
      premium_enrichment: [
        "differentiation",
        "service_specificity",
        "process_clarity",
        "proof_depth",
        "faq_substance"
      ],
      preview_tolerance: 1
    },

    event: {
      must_express: [
        "what_it_is",
        "who_its_for",
        "when_where",
        "what_to_do_next"
      ],
      premium_enrichment: [
        "agenda_or_format",
        "urgency_or_reason_now",
        "proof_depth",
        "faq_substance"
      ],
      preview_tolerance: 1
    },

    coach: {
      must_express: [
        "what_it_is",
        "who_its_for",
        "transformation",
        "what_to_do_next"
      ],
      premium_enrichment: [
        "method_clarity",
        "proof_depth",
        "offer_specificity",
        "faq_substance"
      ],
      preview_tolerance: 1
    },

    portfolio: {
      must_express: [
        "what_it_is",
        "who_its_for",
        "proof_of_quality",
        "what_to_do_next"
      ],
      premium_enrichment: [
        "style_or_positioning",
        "projects_or_examples",
        "process_clarity",
        "about_depth"
      ],
      preview_tolerance: 1
    }
  };

  return models[category] || models.service;
}

const BLOCK_MAP = {
  // stage 1
  what_it_is: ["primary_offer", "business_understanding", "website_direction"],
  who_its_for: ["audience"],
  why_trust_it: ["trust_signal", "trust_signals", "credibility_factors"],
  what_to_do_next: ["contact_path", "booking_method", "cta_text", "cta_link"],
  when_where: ["service_area", "service_areas", "hours"],
  transformation: ["primary_offer", "business_understanding", "differentiation"],
  proof_of_quality: ["trust_signal", "testimonials_status", "photos_status", "gallery_queries"],

  // stage 2
  differentiation: ["differentiation"],
  service_specificity: ["service_descriptions", "offerings"],
  process_clarity: ["process_notes"],
  proof_depth: ["testimonials_status", "photos_status", "credibility_factors", "trust_signals"],
  faq_substance: ["faq_topics", "common_objections", "buyer_decision_factors"],
  agenda_or_format: ["service_descriptions", "process_notes"],
  urgency_or_reason_now: ["peak_season_availability", "hours"],
  method_clarity: ["process_notes", "service_descriptions"],
  offer_specificity: ["service_descriptions", "pricing_structure"],
  style_or_positioning: ["differentiation", "website_direction"],
  projects_or_examples: ["gallery_queries", "photos_status"],
  about_depth: ["founder_bio"]
};

const BLOCK_KEY_PRIORITY = {
  what_it_is: ["primary_offer", "business_understanding", "website_direction"],
  who_its_for: ["audience"],
  why_trust_it: ["trust_signal", "testimonials_status"],
  what_to_do_next: ["booking_method", "contact_path", "cta_text", "cta_link"],
  when_where: ["service_area", "hours"],
  transformation: ["primary_offer", "differentiation"],
  proof_of_quality: ["photos_status", "testimonials_status"],

  differentiation: ["differentiation"],
  service_specificity: ["service_descriptions"],
  process_clarity: ["process_notes"],
  proof_depth: ["testimonials_status", "photos_status"],
  faq_substance: ["common_objections", "buyer_decision_factors"],
  agenda_or_format: ["service_descriptions"],
  urgency_or_reason_now: ["peak_season_availability"],
  method_clarity: ["process_notes"],
  offer_specificity: ["pricing_structure", "service_descriptions"],
  style_or_positioning: ["differentiation"],
  projects_or_examples: ["photos_status"],
  about_depth: ["founder_bio"]
};

function resolveKeyFromBlock(block, state) {
  const candidates = BLOCK_KEY_PRIORITY[block] || BLOCK_MAP[block] || [];
  for (const key of candidates) {
    if (!hasMeaningfulValue(state.answers[key])) {
      return key;
    }
  }
  return candidates[0] || null;
}

function isBlockSatisfied(state, block) {
  const fields = BLOCK_MAP[block] || [];
  return fields.some((field) => hasMeaningfulValue(state.answers[field]));
}

function getCategory(state) {
  const fromMeta = cleanString(state?.meta?.category).toLowerCase();
  if (fromMeta) return normalizeCategory(fromMeta);

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

/* --------------------------------
   QUESTION ENGINE
-------------------------------- */

function buildQuestionForKey(state, key) {
  const canonicalKey = canonicalizeKey(key);
  const businessName =
    cleanString(state.businessName) ||
    cleanString(state.provenance?.strategy_contract?.business_context?.business_name) ||
    "your business";

  const category = getCategory(state);
  const serviceArea = cleanString(state.answers.service_area);
  const primaryOffer = cleanString(state.answers.primary_offer);

  switch (canonicalKey) {
    case "primary_offer":
      return category === "event"
        ? `What exactly is the event or experience, and how would you describe it so the right person immediately understands why it is worth attending?`
        : `I want to sharpen the offer so this does not feel generic. What is the main service or result you most want ${businessName} to be known for first?`;

    case "audience":
      return `Who is most likely to choose ${businessName}, and what kind of client should this page feel especially built for?`;

    case "trust_signal":
      return `What should make someone trust ${businessName} quickly — specific results, years of experience, before-and-after work, credentials, referrals, or something else real?`;

    case "booking_method":
      return `When someone is ready to move forward, what should happen first — request a quote, call, text, fill out a form, or book online?`;

    case "contact_path":
      return `What is the cleanest next step for the customer — call, text, form, request a quote, or a booking page?`;

    case "service_area":
      return category === "event"
        ? `Where does this happen, and what location detail matters most for someone deciding whether to attend?`
        : `We have ${serviceArea || "your main area"} as a starting point. What is the best way to describe the area you really want this site to speak to?`;

    case "service_descriptions":
      return category === "service"
        ? `What are the main service types or outcomes you want described clearly so the preview feels like a real premium business and not a generic cleaner?`
        : `What are the main offer details or parts of the experience you want described clearly on the page?`;

    case "process_notes":
      return `Walk me through how working with ${businessName} usually goes, from first contact to finished result, so the site can make the experience feel clear and professional.`;

    case "pricing_structure":
      return `You do not need exact prices, but how should customers understand pricing — fixed packages, custom quotes, by scope, by home size, or something else?`;

    case "testimonials_status":
      return `Do you already have any customer testimonials, review quotes, or repeat praise themes we can use to make the preview feel believable and specific?`;

    case "photos_status":
      return `Do you already have strong work photos, before-and-after examples, or project images that could help the preview feel premium later?`;

    case "common_objections":
      return `What concerns or hesitations do customers usually have before they hire you, and what helps them feel comfortable saying yes?`;

    case "buyer_decision_factors":
      return `When the right client chooses ${businessName}, what are they really deciding based on — quality, responsiveness, specialization, trust, convenience, appearance, something else?`;

    case "differentiation":
      return primaryOffer
        ? `A lot of businesses in this category can sound similar. What makes ${businessName} genuinely different in the real world beyond just "${primaryOffer}"?`
        : `What makes ${businessName} genuinely different or more appealing than the alternatives nearby?`;

    case "founder_bio":
      return `Would you want the preview to hint at an owner or founder story, and if so, what should it emphasize about the person behind the work?`;

    case "hours":
      return `Are there any timing expectations, availability windows, seasonal limitations, or response-time promises we should make clear?`;

    case "peak_season_availability":
      return `Are there busy seasons, lead-time expectations, or scheduling realities we should set clearly so the page feels honest and well-managed?`;

    case "phone":
      return `What public phone number should appear on the site for inquiries or quote requests?`;

    case "booking_url":
      return `Do you already have a booking page, request form, or external link we should send people to?`;

    case "office_address":
      return `Do you want to show a public address, or should we present this as a service-area business without a storefront?`;

    default:
      return `Let’s tighten one more detail so the preview feels specific and premium. Can you clarify that for me?`;
  }
}

/* --------------------------------
   ANSWER PATHS + EXTRACTION
-------------------------------- */

function getAnswerPathForKey(key) {
  const normalized = normalizeKey(key);

  const map = {
    primary_offer: "answers.primary_offer",
    business_understanding: "answers.business_understanding",
    website_direction: "answers.website_direction",
    audience: "answers.audience",
    trust_signal: "answers.trust_signal",
    booking_method: "answers.booking_method",
    contact_path: "answers.contact_path",
    cta_text: "answers.cta_text",
    cta_link: "answers.cta_link",
    service_area: "answers.service_area",
    pricing_structure: "answers.pricing_structure",
    service_descriptions: "answers.service_descriptions",
    process_notes: "answers.process_notes",
    testimonials_status: "answers.testimonials_status",
    photos_status: "answers.photos_status",
    common_objections: "answers.common_objections",
    buyer_decision_factors: "answers.buyer_decision_factors",
    differentiation: "answers.differentiation",
    founder_bio: "answers.founder_bio",
    hours: "answers.hours",
    peak_season_availability: "answers.peak_season_availability",
    phone: "answers.phone",
    booking_url: "answers.booking_url",
    office_address: "answers.office_address"
  };

  return map[normalized] || null;
}

function extractAnswerForKey(key, rawInput, state) {
  const canonicalKey = canonicalizeKey(key);
  const input = collapseWhitespace(rawInput);

  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const joined = (matches) => matches.join(" ").trim();

  switch (canonicalKey) {
    case "audience":
    case "primary_offer":
    case "business_understanding":
    case "website_direction":
    case "differentiation":
    case "service_descriptions":
    case "process_notes":
    case "founder_bio":
    case "pricing_structure":
    case "hours":
    case "peak_season_availability":
      return input;

    case "trust_signal": {
      const matches = sentences.filter((s) =>
        /\btrust\b|\btestimonial\b|\breview\b|\bexperience\b|\bcredential\b|\binsured\b|\blicensed\b|\breferral\b|\bproof\b|\bbefore\b|\bafter\b/i.test(s)
      );
      return joined(matches) || input;
    }

    case "booking_method": {
      if (/\brequest quote\b|\bquote\b/i.test(input)) return "request quote";
      if (/\bbook\b/i.test(input)) return "book online";
      if (/\bcall\b/i.test(input)) return "call";
      if (/\btext\b/i.test(input)) return "text";
      if (/\bform\b|\bcontact form\b|\bsubmit\b/i.test(input)) return "contact form";
      return input;
    }

    case "contact_path": {
      if (/\brequest quote\b|\bquote\b/i.test(input)) return "request quote";
      if (/\bbook\b/i.test(input)) return "book online";
      if (/\bcall\b/i.test(input)) return "call";
      if (/\btext\b/i.test(input)) return "text";
      if (/\bform\b|\bcontact form\b|\bsubmit\b/i.test(input)) return "contact form";
      return input;
    }

    case "service_area": {
      const matches = sentences.filter((s) =>
        /\bserve\b|\bservice area\b|\bcity\b|\btown\b|\bcounty\b|\bmetro\b|\bregion\b|\bneighborhood\b|\barea\b/i.test(s)
      );
      return joined(matches) || input;
    }

    case "testimonials_status":
      if (/\byes\b|\bwe do\b|\bplenty\b|\bmany\b/i.test(input)) return input;
      if (/\bno\b|\bnot yet\b|\bdon't\b|\bdo not\b/i.test(input)) return "not yet";
      return input;

    case "photos_status":
      if (/\byes\b|\bbefore\b|\bafter\b|\bphotos\b|\bgallery\b/i.test(input)) return input;
      if (/\bno\b|\bnot yet\b|\bdon't\b|\bdo not\b/i.test(input)) return "not yet";
      return input;

    case "buyer_decision_factors":
    case "common_objections":
      return uniqueList(
        input
          .split(/,|;|\band\b/gi)
          .map((s) => cleanString(s))
          .filter(Boolean)
      );

    case "phone": {
      const phoneMatch = input.match(/(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}/);
      return phoneMatch ? normalizePhone(phoneMatch[0]) : "";
    }

    case "booking_url": {
      const urlMatch = input.match(/https?:\/\/[^\s]+/i);
      return urlMatch ? urlMatch[0] : input;
    }

    case "office_address":
      return input;

    default:
      return input;
  }
}

function extractObviousSignals(state, input) {
  const text = cleanString(input);
  if (!text) return;

  const phoneMatch = text.match(/(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}/);
  if (phoneMatch && !hasMeaningfulValue(state.answers.phone)) {
    state.answers.phone = normalizePhone(phoneMatch[0]);
    state.meta.inferred.phone = true;
  }

  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch && !hasMeaningfulValue(state.answers.booking_url)) {
    state.answers.booking_url = urlMatch[0];
    state.meta.inferred.booking_url = true;
  }

  if (!hasMeaningfulValue(state.answers.booking_method)) {
    if (/\brequest quote\b|\bquote\b/i.test(text)) {
      state.answers.booking_method = "request quote";
      state.meta.inferred.booking_method = true;
    } else if (/\bcall\b/i.test(text)) {
      state.answers.booking_method = "call";
      state.meta.inferred.booking_method = true;
    } else if (/\btext\b/i.test(text)) {
      state.answers.booking_method = "text";
      state.meta.inferred.booking_method = true;
    } else if (/\bform\b|\bcontact form\b|\bsubmit\b/i.test(text)) {
      state.answers.booking_method = "contact form";
      state.meta.inferred.booking_method = true;
    } else if (/\bbook\b/i.test(text)) {
      state.answers.booking_method = "book online";
      state.meta.inferred.booking_method = true;
    }
  }
}

/* --------------------------------
   NORMALIZATION / SANITIZATION
-------------------------------- */

function normalizeState(next) {
  next = isObject(next) ? next : {};

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

    // V2 enrichment answers
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

    // legacy-compatible extras
    offerings: [],
    differentiators: [],
    trust_signals: [],
    credibility_factors: [],
    faq_topics: [],
    gallery_queries: [],

    ...(isObject(next.answers) ? next.answers : {})
  };

  next.ghostwritten = {
    tagline: "",
    hero_headline: "",
    hero_subheadline: "",
    hero_image_alt: "",
    about_summary: "",
    founder_note: "",
    contact_subheadline: "",
    features_copy: [],
    faqs: [],
    testimonials: [],
    ...(isObject(next.ghostwritten) ? next.ghostwritten : {})
  };

  next.meta = isObject(next.meta) ? next.meta : {};
  next.meta.verified = isObject(next.meta.verified) ? next.meta.verified : {};
  next.meta.seeded = isObject(next.meta.seeded) ? next.meta.seeded : {};
  next.meta.inferred = isObject(next.meta.inferred) ? next.meta.inferred : {};

  next.verified = isObject(next.verified) ? next.verified : {};
  next.verification = isObject(next.verification) ? next.verification : {};
  next.readiness = isObject(next.readiness) ? next.readiness : {};
  next.enrichment = isObject(next.enrichment) ? next.enrichment : {};

  next.conversation = Array.isArray(next.conversation) ? next.conversation : [];

  next.slug = cleanString(next.slug);
  next.businessName = cleanString(next.businessName);
  next.clientEmail = cleanString(next.clientEmail);
  next.phase = cleanString(next.phase) || "narrative_unlock";
  next.current_key = cleanString(next.current_key) || null;

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

  return next;
}

function sanitizeAnswers(state) {
  state.answers.primary_offer = cleanString(state.answers.primary_offer);
  state.answers.audience = cleanString(state.answers.audience);
  state.answers.service_area = cleanString(state.answers.service_area);
  state.answers.trust_signal = cleanString(state.answers.trust_signal);
  state.answers.contact_path = cleanString(state.answers.contact_path);
  state.answers.booking_method = cleanString(state.answers.booking_method);
  state.answers.cta_text = cleanString(state.answers.cta_text);
  state.answers.cta_link = cleanString(state.answers.cta_link);
  state.answers.differentiation = cleanString(state.answers.differentiation);
  state.answers.website_direction = cleanString(state.answers.website_direction);
  state.answers.business_understanding = cleanString(state.answers.business_understanding);
  state.answers.service_descriptions = cleanString(state.answers.service_descriptions);
  state.answers.process_notes = cleanString(state.answers.process_notes);
  state.answers.pricing_structure = cleanString(state.answers.pricing_structure);
  state.answers.testimonials_status = cleanString(state.answers.testimonials_status);
  state.answers.photos_status = cleanString(state.answers.photos_status);
  state.answers.founder_bio = cleanString(state.answers.founder_bio);
  state.answers.phone = normalizePhone(state.answers.phone);
  state.answers.booking_url = cleanString(state.answers.booking_url);
  state.answers.hours = cleanString(state.answers.hours);
  state.answers.office_address = cleanString(state.answers.office_address);
  state.answers.peak_season_availability = cleanString(state.answers.peak_season_availability || "");

  state.answers.common_objections = uniqueList(state.answers.common_objections);
  state.answers.buyer_decision_factors = uniqueList(state.answers.buyer_decision_factors);
  state.answers.offerings = uniqueList(state.answers.offerings);
  state.answers.differentiators = uniqueList(state.answers.differentiators);
  state.answers.trust_signals = uniqueList(state.answers.trust_signals);
  state.answers.credibility_factors = uniqueList(state.answers.credibility_factors);
  state.answers.faq_topics = uniqueList(state.answers.faq_topics);
  state.answers.gallery_queries = uniqueList(state.answers.gallery_queries);

  if (!state.answers.contact_path && state.answers.booking_method) {
    state.answers.contact_path = state.answers.booking_method;
    state.meta.inferred.contact_path = true;
  }
}

/* --------------------------------
   GENERIC HELPERS
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

function cleanString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => cleanString(v)).filter(Boolean);
}

function uniqueList(arr) {
  return Array.from(new Set(cleanList(arr)));
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeKey(key) {
  return cleanString(key).toLowerCase().replace(/\s+/g, "_");
}

function canonicalizeKey(key) {
  const normalized = normalizeKey(key);

  const canonicalMap = {
    "booking_process": "booking_method",
    "service_area_specifics": "service_area",
    "business_address": "office_address",
    "address": "office_address",
    "public_business_phone_number": "phone",
    "hours_of_operation": "hours",
    "photos": "photos_status",
    "customer_testimonials": "testimonials_status",
    "detailed_service_descriptions": "service_descriptions",
    "proof_depth": "testimonials_status",
    "faq_substance": "common_objections",
    "process": "process_notes"
  };

  return canonicalMap[normalized] || normalized;
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some((v) => hasMeaningfulValue(v));
  if (isObject(value)) return Object.values(value).some((v) => hasMeaningfulValue(v));
  return cleanString(String(value || "")) !== "";
}

function getByPath(obj, path) {
  const parts = cleanString(path).split(".").filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function setByPath(obj, path, value) {
  const parts = cleanString(path).split(".").filter(Boolean);
  if (!parts.length) return;

  let cur = obj;
  while (parts.length > 1) {
    const part = parts.shift();
    if (!isObject(cur[part])) cur[part] = {};
    cur = cur[part];
  }

  cur[parts[0]] = value;
}

function collapseWhitespace(text) {
  return cleanString(text).replace(/\s+/g, " ").trim();
}

function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return cleanString(input);
}