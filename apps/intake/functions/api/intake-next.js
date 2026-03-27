/**
 * SITEFORGE FACTORY — intake-next.js
 * V2.5 Narrative + Premium Enrichment Controller
 *
 * Goals:
 * - keep the current stable V2 state machine shape
 * - improve premium readiness without introducing deploy-risk features
 * - avoid structuredClone
 * - avoid regex lookbehind
 * - keep intake-next.js as source of truth for readiness + enrichment
 * - produce better ghostwritten seeds before intake-complete.js
 */

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const body = await request.json();
    let state = normalizeState(deepClone(body.state || {}));
    const userMessage = cleanString(body.answer || "");

    if (!state.provenance || !state.provenance.strategy_contract) {
      throw new Error("Missing strategy_contract - run intake-start first");
    }

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
      } else if (state.readiness.can_generate_now) {
        applyFreeformEnrichment(state, userMessage);
      }

      applyCrossFieldInference(state, userMessage, currentKeyBefore);
      sanitizeAnswers(state);
    }

    deriveGhostwrittenCandidates(state);

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
    return json(
      {
        ok: false,
        error: String(err && err.message ? err.message : err || "Unknown error")
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "intake-next",
    method: "POST",
    version: "v2.5-premium-safe"
  });
}

/* =========================
   Core Flow
========================= */

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

  const sentences = splitSentences(text);
  if (sentences.length < 2) return;

  if (!passesQualityThreshold(state, "service_specificity", "service_descriptions", state.answers.service_descriptions)) {
    state.answers.service_descriptions = text;
    state.meta.inferred.service_descriptions = true;
    return;
  }

  if (!passesQualityThreshold(state, "process_clarity", "process_notes", state.answers.process_notes)) {
    state.answers.process_notes = text;
    state.meta.inferred.process_notes = true;
    return;
  }

  if (!passesQualityThreshold(state, "about_depth", "founder_bio", state.answers.founder_bio)) {
    state.answers.founder_bio = text;
    state.meta.inferred.founder_bio = true;
  }
}

function applyCrossFieldInference(state, rawInput, currentKey) {
  const text = collapseWhitespace(rawInput);
  if (!text) return;

  const lower = text.toLowerCase();
  const sentences = splitSentences(text);

  if (
    currentKey === "audience" ||
    /homeowners|families|clients|customers|property|large homes|big glass|upscale|luxury|commercial|residential/i.test(text)
  ) {
    if (
      !passesQualityThreshold(state, "service_specificity", "service_descriptions", state.answers.service_descriptions) &&
      /large homes|big glass|high-end|upscale|restoration|detail|property|spotless|streak-free|delicate|frames|tracks|hard water/i.test(text)
    ) {
      state.answers.service_descriptions = text;
      state.meta.inferred.service_descriptions = true;
    }
  }

  if (
    currentKey === "process_notes" ||
    /process|quote|scope|schedule|walkthrough|finish|completed|results|photos|reviews|praise/i.test(lower)
  ) {
    if (
      !passesQualityThreshold(state, "process_clarity", "process_notes", state.answers.process_notes) &&
      sentences.length >= 2 &&
      /quote|scope|schedule|clean|walkthrough|finish|confirm|first contact/i.test(lower)
    ) {
      state.answers.process_notes = text;
      state.meta.inferred.process_notes = true;
    }

    if (
      !passesQualityThreshold(state, "proof_depth", "testimonials_status", state.answers.testimonials_status) &&
      /review|praise|customers say|customers mention|reliability|professionalism|spotless|attention to detail|responsive/i.test(lower)
    ) {
      state.answers.testimonials_status = text;
      state.meta.inferred.testimonials_status = true;
    }

    if (
      !passesQualityThreshold(state, "proof_depth", "photos_status", state.answers.photos_status) &&
      /before-and-after|before and after|photos|gallery|project images|completed work/i.test(lower)
    ) {
      state.answers.photos_status = text;
      state.meta.inferred.photos_status = true;
    }

    if (
      (!Array.isArray(state.answers.buyer_decision_factors) || state.answers.buyer_decision_factors.length < 2) &&
      /care most about|deciding based on|usually care most about|looking for|choose based on/i.test(lower)
    ) {
      const factors = extractListLikeItems(text);
      if (factors.length >= 2) {
        state.answers.buyer_decision_factors = uniqueList(
          state.answers.buyer_decision_factors.concat(factors)
        );
        state.meta.inferred.buyer_decision_factors = true;
      }
    }
  }

  if (
    !passesQualityThreshold(state, "differentiation", "differentiation", state.answers.differentiation) &&
    /large homes|big glass|restoration|detail|specialize|specializing|trusted on the property|careful|streak-free|premium|upscale/i.test(lower)
  ) {
    const candidate = buildDifferentiationFromSignals(text, state);
    if (candidate) {
      state.answers.differentiation = candidate;
      state.meta.inferred.differentiation = true;
    }
  }

  if (
    (!Array.isArray(state.answers.common_objections) || state.answers.common_objections.length === 0) &&
    /trust|cost|price|responsiveness|damage|show up|reliable|availability/i.test(lower)
  ) {
    const objections = inferObjectionsFromText(text);
    if (objections.length) {
      state.answers.common_objections = uniqueList(
        state.answers.common_objections.concat(objections)
      );
      state.meta.inferred.common_objections = true;
    }
  }

  if (
    !passesQualityThreshold(state, "what_to_do_next", "contact_path", state.answers.contact_path) &&
    hasMeaningfulValue(state.answers.booking_method)
  ) {
    state.answers.contact_path = state.answers.booking_method;
    state.meta.inferred.contact_path = true;
  }
}

function deriveGhostwrittenCandidates(state) {
  const businessName =
    cleanString(state.businessName) ||
    cleanString(state.provenance.strategy_contract.business_context && state.provenance.strategy_contract.business_context.business_name) ||
    "This business";

  const area =
    cleanString(state.answers.service_area) ||
    cleanString(firstArrayItem(state.provenance.strategy_contract.business_context && state.provenance.strategy_contract.business_context.service_area));

  const offer = bestPublicOffer(state);
  const audience = bestPublicAudience(state);
  const differentiation = bestPublicDifferentiation(state);
  const proof = bestPublicProof(state);
  const process = bestPublicProcess(state);

  if (!hasMeaningfulValue(state.ghostwritten.tagline)) {
    const tagline = compactSentence(
      [
        offer,
        differentiation,
        area ? "Serving " + area : ""
      ],
      6,
      22
    );
    if (tagline) state.ghostwritten.tagline = tagline;
  }

  if (!hasMeaningfulValue(state.ghostwritten.hero_headline)) {
    state.ghostwritten.hero_headline =
      buildHeroHeadline(offer, differentiation, businessName) ||
      "Premium " + businessName + " service built around trust and results";
  }

  if (!hasMeaningfulValue(state.ghostwritten.hero_subheadline)) {
    state.ghostwritten.hero_subheadline =
      compactSentence(
        [
          audience,
          differentiation,
          proof
        ],
        14,
        34
      ) ||
      compactSentence(
        [
          offer,
          "with a clear, professional experience from first contact to finished result"
        ],
        14,
        34
      );
  }

  if (!hasMeaningfulValue(state.ghostwritten.hero_image_alt)) {
    state.ghostwritten.hero_image_alt = cleanSentenceFragment(
      compactSentence(
        [
          businessName,
          offer,
          area ? "in " + area : ""
        ],
        6,
        18
      )
    );
  }

  if (!hasMeaningfulValue(state.ghostwritten.about_summary)) {
    state.ghostwritten.about_summary =
      compactSentence(
        [
          businessName + " focuses on " + lowerFirst(offer || "professional work"),
          differentiation,
          process
        ],
        20,
        46
      ) || "";
  }

  if (!hasMeaningfulValue(state.ghostwritten.founder_note)) {
    const founderSeed = cleanString(state.answers.founder_bio);
    if (founderSeed && !isGenericPublicLanguage(founderSeed)) {
      state.ghostwritten.founder_note = founderSeed;
    } else {
      state.ghostwritten.founder_note = compactSentence(
        [
          "Built around careful work, clear communication, and results clients feel good about showing off"
        ],
        10,
        24
      );
    }
  }

  if (!hasMeaningfulValue(state.ghostwritten.contact_subheadline)) {
    const method = cleanString(state.answers.booking_method) || "reach out";
    state.ghostwritten.contact_subheadline = compactSentence(
      [
        "Tell us about the property or project and we will help you " + (method === "request quote" ? "get a clear next step" : "get started")
      ],
      10,
      22
    );
  }

  if (!Array.isArray(state.ghostwritten.features_copy) || state.ghostwritten.features_copy.length === 0) {
    state.ghostwritten.features_copy = buildFeatureSeeds(state);
  }

  if (!Array.isArray(state.ghostwritten.faqs) || state.ghostwritten.faqs.length === 0) {
    state.ghostwritten.faqs = buildFaqSeeds(state);
  }

  if (!Array.isArray(state.ghostwritten.testimonials) || state.ghostwritten.testimonials.length === 0) {
    state.ghostwritten.testimonials = buildTestimonialSeeds(state);
  }
}

function buildAssistantMessage(state, nextKey) {
  if (nextKey) return buildQuestionForKey(state, nextKey);

  if (state.readiness.can_generate_now && !state.enrichment.ready_for_preview) {
    return "We understand the business clearly now. I want to sharpen a few premium details so the preview sounds credible, specific, and genuinely custom before we generate it.";
  }

  return "Excellent - we now have enough clarity and premium detail to generate a strong preview direction.";
}

/* =========================
   Queue / Readiness
========================= */

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

  for (let i = 0; i < model.must_express.length; i++) {
    const block = model.must_express[i];
    if (!isBlockSatisfied(state, block)) queue.push(block);
  }

  return queue;
}

function buildEnrichmentQueue(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  for (let i = 0; i < model.must_express.length; i++) {
    if (!isBlockSatisfied(state, model.must_express[i])) return [];
  }

  const queue = [];
  for (let i = 0; i < model.premium_enrichment.length; i++) {
    const block = model.premium_enrichment[i];
    if (!isBlockSatisfied(state, block)) queue.push(block);
  }

  return queue;
}

function evaluateNarrativeReadiness(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  const satisfiedBlocks = [];
  const remainingBlocks = [];

  for (let i = 0; i < model.must_express.length; i++) {
    const block = model.must_express[i];
    if (isBlockSatisfied(state, block)) satisfiedBlocks.push(block);
    else remainingBlocks.push(block);
  }

  const total = model.must_express.length || 1;
  const score = Number((satisfiedBlocks.length / total).toFixed(2));

  return {
    score: score,
    can_generate_now: remainingBlocks.length === 0,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks
  };
}

function evaluateEnrichment(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  const narrative = evaluateNarrativeReadiness(state);
  if (!narrative.can_generate_now) {
    return {
      score: 0,
      ready_for_preview: false,
      remaining_blocks: model.premium_enrichment.slice(),
      satisfied_blocks: []
    };
  }

  const satisfied = [];
  const remaining = [];

  for (let i = 0; i < model.premium_enrichment.length; i++) {
    const block = model.premium_enrichment[i];
    if (isBlockSatisfied(state, block)) satisfied.push(block);
    else remaining.push(block);
  }

  const total = model.premium_enrichment.length || 1;
  const score = Number((satisfied.length / total).toFixed(2));

  return {
    score: score,
    ready_for_preview: remaining.length <= model.preview_tolerance,
    remaining_blocks: remaining,
    satisfied_blocks: satisfied
  };
}

function buildCompatibilityVerification(state) {
  const nextKey = state.current_key || selectNextKey(state);
  const narrativeRemaining = state.readiness && state.readiness.remaining_blocks ? state.readiness.remaining_blocks : [];
  const enrichmentRemaining = state.enrichment && state.enrichment.remaining_blocks ? state.enrichment.remaining_blocks : [];

  return {
    queue_complete: !nextKey,
    verified_count:
      ((state.readiness && state.readiness.satisfied_blocks ? state.readiness.satisfied_blocks.length : 0) +
      (state.enrichment && state.enrichment.satisfied_blocks ? state.enrichment.satisfied_blocks.length : 0)),
    remaining_keys: nextKey ? [nextKey] : [],
    remaining_narrative_blocks: narrativeRemaining,
    remaining_enrichment_blocks: enrichmentRemaining,
    last_updated: new Date().toISOString()
  };
}

/* =========================
   Category Model
========================= */

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
      preview_tolerance: 0
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
      preview_tolerance: 0
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
      preview_tolerance: 0
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
      preview_tolerance: 0
    }
  };

  return models[category] || models.service;
}

const BLOCK_MAP = {
  what_it_is: ["primary_offer", "business_understanding", "website_direction"],
  who_its_for: ["audience"],
  why_trust_it: ["trust_signal", "trust_signals", "credibility_factors", "testimonials_status", "photos_status"],
  what_to_do_next: ["contact_path", "booking_method", "cta_text", "cta_link"],
  when_where: ["service_area", "service_areas", "hours"],
  transformation: ["primary_offer", "business_understanding", "differentiation"],
  proof_of_quality: ["trust_signal", "testimonials_status", "photos_status", "gallery_queries"],

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
  why_trust_it: ["trust_signal", "testimonials_status", "photos_status"],
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
  for (let i = 0; i < candidates.length; i++) {
    const key = candidates[i];
    if (!passesFieldThresholdForKey(state, block, key)) return key;
  }
  return candidates.length ? candidates[0] : null;
}

function isBlockSatisfied(state, block) {
  const fields = BLOCK_MAP[block] || [];
  for (let i = 0; i < fields.length; i++) {
    if (passesFieldThresholdForKey(state, block, fields[i])) return true;
  }
  return false;
}

function passesFieldThresholdForKey(state, block, field) {
  return passesQualityThreshold(state, block, field, state.answers[field]);
}

function passesQualityThreshold(state, block, field, value) {
  if (!hasMeaningfulValue(value)) return false;

  const text = valueToText(value);
  const list = Array.isArray(value) ? cleanList(value) : [];

  switch (block) {
    case "what_it_is":
      return text.length >= 18 && !isGenericPublicLanguage(text);

    case "who_its_for":
      return (
        text.length >= 24 &&
        !isGenericAudienceLanguage(text) &&
        containsAny(text, [
          "homeowner", "family", "customer", "client", "business", "property",
          "office", "residential", "commercial", "upscale", "luxury", "tourist", "local"
        ])
      );

    case "why_trust_it":
      return (
        text.length >= 18 &&
        !isGenericPublicLanguage(text) &&
        containsAny(text, [
          "before-and-after", "before and after", "review", "insured", "licensed",
          "experience", "results", "photos", "praise", "spotless", "careful",
          "professionalism", "reliability", "detail", "referrals"
        ])
      );

    case "what_to_do_next":
      return text.length >= 4;

    case "when_where":
      return text.length >= 8 || list.length >= 1;

    case "differentiation":
      return (
        text.length >= 40 &&
        !isGenericPublicLanguage(text) &&
        containsAny(text, [
          "large homes", "big glass", "restoration", "detail", "careful",
          "specialize", "specializing", "upscale", "premium", "delicate",
          "trusted on the property", "streak-free", "high-end"
        ])
      );

    case "service_specificity":
      return (
        text.length >= 40 &&
        !isGenericPublicLanguage(text) &&
        containsAny(text, [
          "large homes", "big glass", "glass restoration", "residential", "commercial",
          "interior", "exterior", "frames", "tracks", "hard water", "streak-free",
          "storefront", "property", "delicate"
        ])
      );

    case "process_clarity":
      return (
        text.length >= 45 &&
        splitSentences(text).length >= 2 &&
        containsAny(text, [
          "quote", "scope", "schedule", "arrive", "clean", "walkthrough",
          "finish", "follow up", "confirm", "first contact"
        ])
      );

    case "proof_depth":
      return (
        text.length >= 18 &&
        !isGenericPublicLanguage(text) &&
        containsAny(text, [
          "review", "praise", "before-and-after", "before and after",
          "photos", "results", "customers mention", "customers say",
          "reliability", "professionalism", "spotless", "attention to detail",
          "local referrals"
        ])
      );

    case "faq_substance":
      if (Array.isArray(value)) {
        return list.length >= 2 && listHasUsefulFaqSignals(list);
      }
      return text.length >= 30 && !isGenericPublicLanguage(text);

    case "agenda_or_format":
    case "urgency_or_reason_now":
    case "method_clarity":
    case "offer_specificity":
    case "style_or_positioning":
    case "projects_or_examples":
    case "about_depth":
      return text.length >= 24 && !isGenericPublicLanguage(text);

    default:
      if (Array.isArray(value)) return list.length > 0;
      return text.length >= 1;
  }
}

function listHasUsefulFaqSignals(list) {
  const joined = list.join(" ").toLowerCase();
  return containsAny(joined, [
    "price", "pricing", "trust", "damage", "timing", "property",
    "quality", "responsiveness", "availability", "process", "quote"
  ]);
}

function getCategory(state) {
  const fromMeta = cleanString(state.meta.category).toLowerCase();
  if (fromMeta) return normalizeCategory(fromMeta);

  const contractCategory = cleanString(
    state.provenance &&
    state.provenance.strategy_contract &&
    state.provenance.strategy_contract.business_context &&
    state.provenance.strategy_contract.business_context.category
  ).toLowerCase();

  return normalizeCategory(contractCategory || "service");
}

function normalizeCategory(value) {
  if (!value) return "service";

  if (["event", "events", "tour", "tours", "experience"].indexOf(value) !== -1) return "event";
  if (["coach", "coaching", "consultant", "consulting"].indexOf(value) !== -1) return "coach";
  if (["portfolio", "creative", "artist", "designer", "photographer"].indexOf(value) !== -1) return "portfolio";

  return "service";
}

/* =========================
   Question Engine
========================= */

function buildQuestionForKey(state, key) {
  const canonicalKey = canonicalizeKey(key);
  const businessName =
    cleanString(state.businessName) ||
    cleanString(state.provenance.strategy_contract.business_context && state.provenance.strategy_contract.business_context.business_name) ||
    "your business";

  const category = getCategory(state);
  const serviceArea = cleanString(state.answers.service_area);
  const primaryOffer = cleanString(state.answers.primary_offer);

  switch (canonicalKey) {
    case "primary_offer":
      return category === "event"
        ? "What exactly is the event or experience, and how would you describe it so the right person immediately understands why it is worth attending?"
        : "I want to sharpen the offer so this does not sound like a generic service page. What is the main service or result you most want " + businessName + " to be known for first?";

    case "audience":
      return "Who is most likely to choose " + businessName + "? I do not mean \"anyone who needs this.\" I mean the kind of client, property, or situation this page should feel especially built for.";

    case "trust_signal":
      return "What would make someone trust " + businessName + " quickly in the real world - specific results, before-and-after work, reviews, professionalism on-site, years of experience, referrals, credentials, or something else concrete?";

    case "booking_method":
      return "When someone is ready to move forward, what should happen first - request a quote, call, text, fill out a form, or book online?";

    case "contact_path":
      return "What is the cleanest next step for the customer - call, text, form, request a quote, or a booking page?";

    case "service_area":
      return category === "event"
        ? "Where does this happen, and what location detail matters most for someone deciding whether to attend?"
        : "We have " + (serviceArea || "your main area") + " as a starting point. What is the best way to describe the area, neighborhoods, or radius you really want this site to speak to?";

    case "service_descriptions":
      return "What kinds of jobs, property types, or service details should the preview describe so it sounds like a real premium business? Think specifics like large homes, delicate glass, restoration work, detail-focused service, or anything else that matters.";

    case "process_notes":
      return "Walk me through how working with " + businessName + " usually goes, from first contact to finished result. I want the site to make the experience feel clear, smooth, and professional.";

    case "pricing_structure":
      return "You do not need to share exact prices, but how should customers understand pricing - fixed packages, custom quotes, by scope, by property size, minimums, or something else?";

    case "testimonials_status":
      return "Do you already have customer testimonials, review quotes, or repeat praise themes? Even simple patterns like \"clients mention reliability, spotless results, and professionalism\" are useful.";

    case "photos_status":
      return "Do you already have strong work photos, before-and-after examples, or project images that could help the preview feel premium later?";

    case "common_objections":
      return "Before hiring you, what are customers usually worried about? Think real hesitations like trust, showing up on time, care on the property, price, damage concerns, or whether the result will actually look better.";

    case "buyer_decision_factors":
      return "When the right client chooses " + businessName + ", what are they really deciding based on? Not generic marketing words - the real factors like responsiveness, trust on the property, quality of finish, specialization, appearance, convenience, or something else.";

    case "differentiation":
      return primaryOffer
        ? "A lot of businesses in this category can sound similar. Beyond just \"" + primaryOffer + "\", what makes " + businessName + " genuinely different in the real world? What do customers notice or appreciate after working with you that they might not get elsewhere?"
        : "What makes " + businessName + " genuinely different or more appealing than the alternatives nearby? I am looking for real-world differences, not generic \"quality service\" language.";

    case "founder_bio":
      return "Would you want the preview to hint at an owner or founder story, and if so, what should it emphasize about the person behind the work?";

    case "hours":
      return "Are there any timing expectations, availability windows, seasonal limitations, or response-time promises we should make clear?";

    case "peak_season_availability":
      return "Are there busy seasons, lead-time expectations, or scheduling realities we should set clearly so the page feels honest and well-managed?";

    case "phone":
      return "What public phone number should appear on the site for inquiries or quote requests?";

    case "booking_url":
      return "Do you already have a booking page, request form, or external link we should send people to?";

    case "office_address":
      return "Do you want to show a public address, or should we present this as a service-area business without a storefront?";

    default:
      return "Let’s tighten one more detail so the preview feels specific and premium. Can you clarify that for me?";
  }
}

/* =========================
   Answer Paths + Extraction
========================= */

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
  const sentences = splitSentences(input);
  const joined = joinSentences(sentences);

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
      const matches = filterSentencesByPattern(
        sentences,
        /\btrust\b|\btestimonial\b|\breview\b|\bexperience\b|\bcredential\b|\binsured\b|\blicensed\b|\breferral\b|\bproof\b|\bbefore\b|\bafter\b|\bresults\b|\bprofessionalism\b/i
      );
      return matches.length ? joinSentences(matches) : input;
    }

    case "booking_method":
    case "contact_path":
      if (/\brequest quote\b|\bquote\b/i.test(input)) return "request quote";
      if (/\bbook\b/i.test(input)) return "book online";
      if (/\bcall\b/i.test(input)) return "call";
      if (/\btext\b/i.test(input)) return "text";
      if (/\bform\b|\bcontact form\b|\bsubmit\b/i.test(input)) return "contact form";
      return input;

    case "service_area": {
      const matches = filterSentencesByPattern(
        sentences,
        /\bserve\b|\bservice area\b|\bcity\b|\btown\b|\bcounty\b|\bmetro\b|\bregion\b|\bneighborhood\b|\barea\b|\bradius\b/i
      );
      return matches.length ? joinSentences(matches) : input;
    }

    case "testimonials_status":
      if (/\bno\b|\bnot yet\b|\bnone\b/i.test(input)) return "not yet";
      return input;

    case "photos_status":
      if (/\bno\b|\bnot yet\b|\bnone\b/i.test(input)) return "not yet";
      return input;

    case "buyer_decision_factors":
    case "common_objections":
      return extractListLikeItems(input);

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

/* =========================
   Normalization / Sanitization
========================= */

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

    service_descriptions: "",
    process_notes: "",
    pricing_structure: "",
    testimonials_status: "",
    photos_status: "",
    founder_bio: "",
    common_objections: [],
    buyer_decision_factors: [],
    peak_season_availability: "",
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
  next.meta.category = cleanString(next.meta.category);
  next.meta.intake_version = "v2.5-premium-safe";
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
  state.answers.primary_offer = normalizePublicText(state.answers.primary_offer);
  state.answers.audience = normalizePublicText(state.answers.audience);
  state.answers.service_area = normalizePublicText(state.answers.service_area);
  state.answers.trust_signal = normalizePublicText(state.answers.trust_signal);
  state.answers.contact_path = normalizePublicText(state.answers.contact_path);
  state.answers.booking_method = normalizePublicText(state.answers.booking_method);
  state.answers.cta_text = normalizePublicText(state.answers.cta_text);
  state.answers.cta_link = cleanString(state.answers.cta_link);
  state.answers.differentiation = normalizePublicText(state.answers.differentiation);
  state.answers.website_direction = normalizePublicText(state.answers.website_direction);
  state.answers.business_understanding = normalizePublicText(state.answers.business_understanding);
  state.answers.service_descriptions = normalizePublicText(state.answers.service_descriptions);
  state.answers.process_notes = normalizePublicText(state.answers.process_notes);
  state.answers.pricing_structure = normalizePublicText(state.answers.pricing_structure);
  state.answers.testimonials_status = normalizePublicText(state.answers.testimonials_status);
  state.answers.photos_status = normalizePublicText(state.answers.photos_status);
  state.answers.founder_bio = normalizePublicText(state.answers.founder_bio);
  state.answers.peak_season_availability = normalizePublicText(state.answers.peak_season_availability);
  state.answers.phone = normalizePhone(state.answers.phone);
  state.answers.booking_url = cleanString(state.answers.booking_url);
  state.answers.hours = normalizePublicText(state.answers.hours);
  state.answers.office_address = normalizePublicText(state.answers.office_address);

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

/* =========================
   Premium Helpers
========================= */

function bestPublicOffer(state) {
  const candidates = [
    state.ghostwritten.tagline,
    state.answers.primary_offer,
    state.answers.business_understanding,
    state.provenance &&
    state.provenance.strategy_contract &&
    state.provenance.strategy_contract.source_snapshot &&
    state.provenance.strategy_contract.source_snapshot.primary_offer_hint
  ];

  for (let i = 0; i < candidates.length; i++) {
    const text = normalizePublicText(candidates[i]);
    if (text && !isGenericPublicLanguage(text)) return text;
  }

  return "";
}

function bestPublicAudience(state) {
  const text = normalizePublicText(state.answers.audience);
  if (text && !isGenericAudienceLanguage(text)) return text;
  return "";
}

function bestPublicDifferentiation(state) {
  const text = normalizePublicText(state.answers.differentiation);
  if (text && !isGenericPublicLanguage(text)) return text;
  return "";
}

function bestPublicProof(state) {
  const candidates = [
    state.answers.testimonials_status,
    state.answers.trust_signal,
    valueToText(state.answers.trust_signals),
    valueToText(state.answers.credibility_factors)
  ];

  for (let i = 0; i < candidates.length; i++) {
    const text = normalizePublicText(candidates[i]);
    if (text && !isGenericPublicLanguage(text)) return text;
  }

  return "";
}

function bestPublicProcess(state) {
  const text = normalizePublicText(state.answers.process_notes);
  if (text && splitSentences(text).length >= 2) return text;
  return "";
}

function buildHeroHeadline(offer, differentiation, businessName) {
  if (offer && differentiation) {
    const phrase = cleanSentenceFragment(differentiation);
    if (phrase.length <= 80) {
      return cleanSentenceFragment(offer) + " for clients who value " + lowerFirst(phrase);
    }
  }

  if (offer) return cleanSentenceFragment(offer);
  return "Why clients choose " + businessName;
}

function buildFeatureSeeds(state) {
  const features = [];
  const serviceText = normalizePublicText(state.answers.service_descriptions);
  const processText = normalizePublicText(state.answers.process_notes);
  const proofText = normalizePublicText(state.answers.testimonials_status);

  if (containsAny(serviceText, ["large homes", "big glass", "delicate", "restoration", "detail", "streak-free"])) {
    features.push({
      title: "Detail-Focused Work",
      description: compactSentence(
        [
          "Built for jobs where finish quality, care, and visual results matter",
          extractSpecificClause(serviceText)
        ],
        10,
        24
      )
    });
  }

  if (containsAny(processText, ["quote", "scope", "schedule", "walkthrough", "confirm"])) {
    features.push({
      title: "Clear Process",
      description: compactSentence(
        [
          "From first contact to final result, the experience feels organized and easy to trust",
          extractSpecificClause(processText)
        ],
        10,
        24
      )
    });
  }

  if (containsAny(proofText, ["reliability", "professionalism", "spotless", "detail", "responsive"])) {
    features.push({
      title: "Believable Proof",
      description: compactSentence(
        [
          "The strongest praise themes are specific and repeatable",
          extractSpecificClause(proofText)
        ],
        10,
        24
      )
    });
  }

  while (features.length < 3) {
    const fallbacks = [
      {
        title: "Premium Results",
        description: "Sharper finish quality, careful execution, and a result that feels worth paying for."
      },
      {
        title: "Professional Experience",
        description: "Clear communication, clean expectations, and a process clients feel comfortable with."
      },
      {
        title: "Trust on the Property",
        description: "Built for clients who care who they hire, how the work is handled, and how the result looks."
      }
    ];
    const next = fallbacks[features.length];
    if (next) features.push(next);
    else break;
  }

  return features.slice(0, 4);
}

function buildFaqSeeds(state) {
  const faqs = [];
  const objections = cleanList(state.answers.common_objections);
  const factors = cleanList(state.answers.buyer_decision_factors);
  const pricing = normalizePublicText(state.answers.pricing_structure);
  const process = normalizePublicText(state.answers.process_notes);
  const booking = normalizePublicText(state.answers.booking_method);

  if (pricing) {
    faqs.push({
      question: "How does pricing work?",
      answer: cleanSentence(
        compactSentence(
          [
            pricing,
            "The goal is to set clear expectations without forcing generic package language where it does not fit."
          ],
          12,
          28
        )
      )
    });
  }

  if (process) {
    faqs.push({
      question: "What is the process like?",
      answer: cleanSentence(
        compactSentence(
          [
            extractSpecificClause(process),
            "The experience should feel clear from first contact through completion."
          ],
          12,
          28
        )
      )
    });
  }

  if (booking) {
    faqs.push({
      question: "What should I do first if I want to get started?",
      answer: cleanSentence(
        compactSentence(
          [
            "The best next step is to " + booking,
            "so the customer has a simple, low-friction way to move forward."
          ],
          10,
          24
        )
      )
    });
  }

  if (objections.length) {
    faqs.push({
      question: "What concerns do customers usually have before hiring?",
      answer: cleanSentence(
        compactSentence(
          [
            "Common concerns include " + listToPhrase(objections.slice(0, 3)),
            "so the site should answer those clearly instead of sounding vague."
          ],
          12,
          28
        )
      )
    });
  }

  if (factors.length) {
    faqs.push({
      question: "What matters most to the right clients?",
      answer: cleanSentence(
        compactSentence(
          [
            "The strongest decision factors are " + listToPhrase(factors.slice(0, 4)),
            "which helps the preview sound grounded in how buyers actually choose."
          ],
          12,
          28
        )
      )
    });
  }

  return faqs.slice(0, 5);
}

function buildTestimonialSeeds(state) {
  const seeds = [];
  const proofText = normalizePublicText(state.answers.testimonials_status).toLowerCase();

  const praiseThemes = [
    ["reliability", "Clients repeatedly mention reliability and follow-through."],
    ["professionalism", "Customers notice a professional, respectful experience from start to finish."],
    ["spotless", "The finished result feels visibly cleaner, sharper, and worth paying for."],
    ["attention to detail", "Clients appreciate the level of care and attention to detail."],
    ["responsive", "Communication feels responsive and easy, which reduces friction before the job even starts."]
  ];

  for (let i = 0; i < praiseThemes.length; i++) {
    const needle = praiseThemes[i][0];
    const line = praiseThemes[i][1];
    if (proofText.indexOf(needle) !== -1) seeds.push(line);
  }

  if (!seeds.length) {
    const raw = normalizePublicText(state.answers.testimonials_status);
    if (raw && !isGenericPublicLanguage(raw)) {
      seeds.push(cleanSentence(raw));
    }
  }

  return seeds.slice(0, 3);
}

function buildDifferentiationFromSignals(text, state) {
  const parts = [];

  if (/large homes|high-end homes|upscale/i.test(text)) {
    parts.push("especially strong for larger, higher-expectation homes");
  }
  if (/big glass|expansive glass/i.test(text)) {
    parts.push("comfortable handling larger glass surfaces where quality is more visible");
  }
  if (/restoration|hard water/i.test(text)) {
    parts.push("more capable than a basic clean-only provider");
  }
  if (/trust on the property|trustworthy|professionalism|reliability/i.test(text)) {
    parts.push("clients feel comfortable having the work done on their property");
  }
  if (/detail|careful|attention to detail|spotless|streak-free/i.test(text)) {
    parts.push("the finish quality and care feel noticeably more polished");
  }

  if (!parts.length) return "";

  const offer = cleanSentenceFragment(bestPublicOffer(state));
  const tail = listToPhrase(parts.slice(0, 3));

  return compactSentence(
    [
      offer ? offer + " with a focus that feels more premium in practice" : "",
      tail
    ],
    12,
    30
  );
}

function inferObjectionsFromText(text) {
  const found = [];
  const lower = text.toLowerCase();

  if (lower.indexOf("trust") !== -1) found.push("whether they can trust the provider on the property");
  if (lower.indexOf("price") !== -1 || lower.indexOf("cost") !== -1) found.push("whether the price will feel justified");
  if (lower.indexOf("responsive") !== -1) found.push("whether communication will be responsive");
  if (lower.indexOf("availability") !== -1) found.push("whether they can get scheduled in a reasonable window");
  if (lower.indexOf("damage") !== -1 || lower.indexOf("careful") !== -1) found.push("whether the work will be handled carefully");

  return uniqueList(found);
}

function isGenericAudienceLanguage(text) {
  const lower = normalizePublicText(text).toLowerCase();
  if (!lower) return true;

  const banned = [
    "people actively looking for a trustworthy provider",
    "anyone who needs",
    "people who need",
    "customers seeking a premium provider",
    "homeowners and businesses",
    "anyone looking for quality service",
    "anyone looking for a provider"
  ];

  for (let i = 0; i < banned.length; i++) {
    if (lower.indexOf(banned[i]) !== -1) return true;
  }

  if (lower.length < 20) return true;

  if (!containsAny(lower, [
    "home", "property", "family", "client", "customer", "local", "office",
    "residential", "commercial", "upscale", "luxury"
  ])) {
    return true;
  }

  return false;
}

function isGenericPublicLanguage(text) {
  const lower = normalizePublicText(text).toLowerCase();
  if (!lower) return true;

  const bannedPhrases = [
    "quality of service",
    "high quality service",
    "professional service",
    "trusted provider",
    "trustworthy provider",
    "people actively looking for a trustworthy provider",
    "customer satisfaction",
    "great service",
    "best service",
    "premium provider",
    "quality work",
    "we care about our customers"
  ];

  for (let i = 0; i < bannedPhrases.length; i++) {
    if (lower.indexOf(bannedPhrases[i]) !== -1) return true;
  }

  const tooGenericSingleConcept =
    lower.length < 28 &&
    containsAny(lower, ["quality", "professional", "trusted", "reliable", "best", "great"]);

  return tooGenericSingleConcept;
}

/* =========================
   Generic Helpers
========================= */

function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
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
  return /[.!?]$/.test(value) ? value : value + ".";
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

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const v = normalizePublicText(arr[i]);
    if (v) out.push(v);
  }
  return out;
}

function uniqueList(arr) {
  const input = cleanList(arr);
  const seen = {};
  const out = [];

  for (let i = 0; i < input.length; i++) {
    const key = input[i].toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      out.push(input[i]);
    }
  }

  return out;
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(key) {
  return cleanString(key).toLowerCase().replace(/\s+/g, "_");
}

function canonicalizeKey(key) {
  const normalized = normalizeKey(key);

  const canonicalMap = {
    booking_process: "booking_method",
    service_area_specifics: "service_area",
    business_address: "office_address",
    address: "office_address",
    public_business_phone_number: "phone",
    hours_of_operation: "hours",
    photos: "photos_status",
    customer_testimonials: "testimonials_status",
    detailed_service_descriptions: "service_descriptions",
    proof_depth: "testimonials_status",
    faq_substance: "common_objections",
    process: "process_notes"
  };

  return canonicalMap[normalized] || normalized;
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (hasMeaningfulValue(value[i])) return true;
    }
    return false;
  }

  if (isObject(value)) {
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      if (hasMeaningfulValue(value[keys[i]])) return true;
    }
    return false;
  }

  return cleanString(String(value || "")) !== "";
}

function getByPath(obj, path) {
  const parts = cleanString(path).split(".").filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[parts[i]];
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
    return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
  }
  if (digits.length === 11 && digits.charAt(0) === "1") {
    return "(" + digits.slice(1, 4) + ") " + digits.slice(4, 7) + "-" + digits.slice(7);
  }
  return cleanString(input);
}

function valueToText(value) {
  if (Array.isArray(value)) return cleanList(value).join(" ");
  if (isObject(value)) {
    const keys = Object.keys(value);
    const parts = [];
    for (let i = 0; i < keys.length; i++) {
      parts.push(valueToText(value[keys[i]]));
    }
    return parts.join(" ");
  }
  return normalizePublicText(String(value || ""));
}

function splitSentences(text) {
  const input = normalizePublicText(text);
  if (!input) return [];

  const parts = input.match(/[^.!?]+[.!?]?/g) || [];
  const out = [];

  for (let i = 0; i < parts.length; i++) {
    const s = cleanString(parts[i]);
    if (s) out.push(s);
  }

  return out;
}

function joinSentences(sentences) {
  return cleanString((sentences || []).join(" "));
}

function filterSentencesByPattern(sentences, pattern) {
  const out = [];
  for (let i = 0; i < sentences.length; i++) {
    if (pattern.test(sentences[i])) out.push(sentences[i]);
  }
  return out;
}

function containsAny(text, needles) {
  const lower = normalizePublicText(text).toLowerCase();
  for (let i = 0; i < needles.length; i++) {
    if (lower.indexOf(String(needles[i]).toLowerCase()) !== -1) return true;
  }
  return false;
}

function extractListLikeItems(text) {
  const raw = normalizePublicText(text).split(/,|;|\band\b/gi);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const item = cleanSentenceFragment(raw[i]);
    if (item) out.push(item);
  }
  return uniqueList(out);
}

function listToPhrase(items) {
  const clean = cleanList(items);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return clean[0] + " and " + clean[1];
  return clean.slice(0, -1).join(", ") + ", and " + clean[clean.length - 1];
}

function compactSentence(parts, minWords, maxWords) {
  const text = normalizePublicText(parts.filter(Boolean).join(". "));
  if (!text) return "";

  const words = text.split(/\s+/).filter(Boolean);
  const min = typeof minWords === "number" ? minWords : 8;
  const max = typeof maxWords === "number" ? maxWords : 32;

  if (words.length < min) return text;
  if (words.length <= max) return cleanSentence(text);
  return cleanSentence(words.slice(0, max).join(" "));
}

function extractSpecificClause(text) {
  const sentences = splitSentences(text);
  for (let i = 0; i < sentences.length; i++) {
    if (
      containsAny(sentences[i], [
        "large homes", "big glass", "restoration", "detail", "careful",
        "quote", "schedule", "walkthrough", "spotless", "reliability",
        "professionalism", "responsive"
      ])
    ) {
      return cleanSentenceFragment(sentences[i]);
    }
  }
  return cleanSentenceFragment(sentences.length ? sentences[0] : text);
}

function lowerFirst(text) {
  const clean = cleanSentenceFragment(text);
  if (!clean) return "";
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

function firstArrayItem(value) {
  return Array.isArray(value) && value.length ? value[0] : "";
}