/**
 * SITEFORGE FACTORY — intake-next.js
 * V3 Narrative + Premium Enrichment Controller
 *
 * Principles:
 * - intake-start.js remains the bridge from preflight -> paid intake
 * - intake-next.js is the source of truth for narrative readiness + premium readiness
 * - intake-complete.js should assemble and polish, not invent missing premium substance
 * - quality thresholds are category-aware
 * - generic strategy language should not count as publishable premium input
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

  const category = getCategory(state);
  const sentenceCount = splitSentences(text).length;
  if (sentenceCount < 2) return;

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

  if (
    (category === "coach" || category === "portfolio") &&
    !passesQualityThreshold(state, "about_depth", "founder_bio", state.answers.founder_bio)
  ) {
    state.answers.founder_bio = text;
    state.meta.inferred.founder_bio = true;
    return;
  }

  if (
    category === "event" &&
    !passesQualityThreshold(state, "agenda_or_format", "service_descriptions", state.answers.service_descriptions)
  ) {
    state.answers.service_descriptions = text;
    state.meta.inferred.service_descriptions = true;
  }
}

function applyCrossFieldInference(state, rawInput, currentKey) {
  const text = collapseWhitespace(rawInput);
  if (!text) return;

  const category = getCategory(state);
  const lower = text.toLowerCase();
  const sentences = splitSentences(text);

  if (
    currentKey === "audience" ||
    /homeowners|families|clients|customers|property|large homes|big glass|upscale|luxury|tourists|attendees|founders|teams|brands|collectors|creative directors/i.test(text)
  ) {
    if (
      !passesQualityThreshold(state, "who_its_for", "audience", state.answers.audience) &&
      text.length >= 24
    ) {
      state.answers.audience = text;
      state.meta.inferred.audience = true;
    }
  }

  if (
    category === "service" &&
    (
      currentKey === "service_descriptions" ||
      /large homes|big glass|restoration|detail|property|spotless|streak-free|white-glove|delicate|interior|exterior|frames|tracks|hard water/i.test(lower)
    )
  ) {
    if (!passesQualityThreshold(state, "service_specificity", "service_descriptions", state.answers.service_descriptions)) {
      state.answers.service_descriptions = text;
      state.meta.inferred.service_descriptions = true;
    }
  }

  if (
    category === "event" &&
    (
      currentKey === "service_descriptions" ||
      /schedule|agenda|lineup|format|session|tour route|duration|time slot|departure|experience includes|what to expect/i.test(lower)
    )
  ) {
    if (!passesQualityThreshold(state, "agenda_or_format", "service_descriptions", state.answers.service_descriptions)) {
      state.answers.service_descriptions = text;
      state.meta.inferred.service_descriptions = true;
    }
  }

  if (
    category === "coach" &&
    (
      currentKey === "service_descriptions" ||
      /framework|method|process|sessions|engagement|offer|program|transformation|clarity|decision-making|leadership/i.test(lower)
    )
  ) {
    if (!passesQualityThreshold(state, "offer_specificity", "service_descriptions", state.answers.service_descriptions)) {
      state.answers.service_descriptions = text;
      state.meta.inferred.service_descriptions = true;
    }
  }

  if (
    category === "portfolio" &&
    (
      currentKey === "service_descriptions" ||
      /brand identity|art direction|projects|commissions|editorial|residential|commercial|installation|campaign|creative|work samples/i.test(lower)
    )
  ) {
    if (!passesQualityThreshold(state, "projects_or_examples", "service_descriptions", state.answers.service_descriptions)) {
      state.answers.service_descriptions = text;
      state.meta.inferred.service_descriptions = true;
    }
  }

  if (
    currentKey === "process_notes" ||
    /process|quote|schedule|walkthrough|finish|completed|results|photos|reviews|praise|inquiry|discovery|proposal|session|timeline|delivery/i.test(lower)
  ) {
    if (
      !passesQualityThreshold(state, "process_clarity", "process_notes", state.answers.process_notes) &&
      sentences.length >= 2
    ) {
      state.answers.process_notes = text;
      state.meta.inferred.process_notes = true;
    }

    if (
      !passesQualityThreshold(state, "proof_depth", "testimonials_status", state.answers.testimonials_status) &&
      /review|praise|customers say|customers mention|reliability|professionalism|spotless|attention to detail|responsive|results|outcomes|referrals|repeat clients|bookings|sold out|case study|featured/i.test(lower)
    ) {
      state.answers.testimonials_status = text;
      state.meta.inferred.testimonials_status = true;
    }

    if (
      !passesQualityThreshold(state, "proof_depth", "photos_status", state.answers.photos_status) &&
      /before-and-after|before and after|photos|gallery|project images|completed work|portfolio|lookbook|event photos|visual proof/i.test(lower)
    ) {
      state.answers.photos_status = text;
      state.meta.inferred.photos_status = true;
    }

    if (
      (!Array.isArray(state.answers.buyer_decision_factors) || state.answers.buyer_decision_factors.length < 2) &&
      /care most about|deciding based on|usually care most about|looking for|choose based on|hire based on/i.test(lower)
    ) {
      const factors = extractListLikeItems(text);
      if (factors.length >= 2) {
        state.answers.buyer_decision_factors = uniqueList([
          ...state.answers.buyer_decision_factors,
          ...factors
        ]);
        state.meta.inferred.buyer_decision_factors = true;
      }
    }
  }

  if (
    !passesQualityThreshold(state, "differentiation", "differentiation", state.answers.differentiation)
  ) {
    const candidate = buildDifferentiationFromSignals(text, state);
    if (candidate) {
      state.answers.differentiation = candidate;
      state.meta.inferred.differentiation = true;
    }
  }

  if (
    (!Array.isArray(state.answers.common_objections) || state.answers.common_objections.length === 0) &&
    /trust|cost|price|responsiveness|damage|show up|reliable|availability|fit|roi|time commitment|credibility|style fit|experience level|deliverables/i.test(lower)
  ) {
    const objections = inferObjectionsFromText(text, category);
    if (objections.length) {
      state.answers.common_objections = uniqueList([
        ...state.answers.common_objections,
        ...objections
      ]);
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
  const category = getCategory(state);
  const businessName = cleanString(state.businessName) ||
    cleanString(state.provenance?.strategy_contract?.business_context?.business_name) ||
    "This business";

  const area = cleanString(state.answers.service_area) ||
    cleanString(state.provenance?.strategy_contract?.business_context?.service_area?.[0]);

  const offer = bestPublicOffer(state);
  const audience = bestPublicAudience(state, category);
  const differentiation = bestPublicDifferentiation(state);
  const proof = bestPublicProof(state);
  const process = bestPublicProcess(state);

  if (!hasMeaningfulValue(state.ghostwritten.tagline)) {
    const tagline = compactSentence([
      offer,
      differentiation,
      area ? `Serving ${area}` : ""
    ], 6, 22);
    if (tagline) state.ghostwritten.tagline = tagline;
  }

  if (!hasMeaningfulValue(state.ghostwritten.hero_headline)) {
    state.ghostwritten.hero_headline =
      buildHeroHeadline(offer, differentiation, businessName, category) ||
      buildCategoryFallbackHeadline(category, businessName);
  }

  if (!hasMeaningfulValue(state.ghostwritten.hero_subheadline)) {
    state.ghostwritten.hero_subheadline =
      compactSentence([
        audience,
        differentiation,
        proof
      ], 14, 34) ||
      compactSentence([
        offer,
        buildCategoryFallbackSubheadline(category)
      ], 14, 34);
  }

  if (!hasMeaningfulValue(state.ghostwritten.hero_image_alt)) {
    state.ghostwritten.hero_image_alt =
      cleanSentenceFragment(
        compactSentence([
          businessName,
          offer,
          area ? `in ${area}` : ""
        ], 6, 18)
      );
  }

  if (!hasMeaningfulValue(state.ghostwritten.about_summary)) {
    state.ghostwritten.about_summary =
      compactSentence([
        `${businessName} focuses on ${lowerFirst(offer || buildCategoryFallbackOffer(category))}`,
        differentiation,
        process
      ], 20, 46) ||
      "";
  }

  if (!hasMeaningfulValue(state.ghostwritten.founder_note)) {
    const founderSeed = cleanString(state.answers.founder_bio);
    if (founderSeed && !isGenericPublicLanguage(founderSeed)) {
      state.ghostwritten.founder_note = founderSeed;
    } else {
      state.ghostwritten.founder_note = buildCategoryFallbackFounderNote(category);
    }
  }

  if (!hasMeaningfulValue(state.ghostwritten.contact_subheadline)) {
    const method = cleanString(state.answers.booking_method) || "reach out";
    state.ghostwritten.contact_subheadline =
      buildCategoryContactSubheadline(category, method);
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

  return "Excellent — we now have enough clarity and premium detail to generate a strong preview direction.";
}

/* --------------------------------
   V3 QUEUE / READINESS
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
    if (isBlockSatisfied(state, block)) satisfiedBlocks.push(block);
    else remainingBlocks.push(block);
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

  if (!evaluateNarrativeReadiness(state).can_generate_now) {
    return {
      score: 0,
      ready_for_preview: false,
      remaining_blocks: [...model.premium_enrichment],
      satisfied_blocks: []
    };
  }

  const satisfied = [];
  const remaining = [];

  for (const block of model.premium_enrichment) {
    if (isBlockSatisfied(state, block)) satisfied.push(block);
    else remaining.push(block);
  }

  const total = model.premium_enrichment.length || 1;
  const score = Number((satisfied.length / total).toFixed(2));

  return {
    score,
    ready_for_preview: remaining.length <= model.preview_tolerance,
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
  projects_or_examples: ["gallery_queries", "photos_status", "service_descriptions"],
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
  urgency_or_reason_now: ["peak_season_availability", "hours"],
  method_clarity: ["process_notes"],
  offer_specificity: ["pricing_structure", "service_descriptions"],
  style_or_positioning: ["differentiation"],
  projects_or_examples: ["photos_status", "service_descriptions"],
  about_depth: ["founder_bio"]
};

function resolveKeyFromBlock(block, state) {
  const candidates = BLOCK_KEY_PRIORITY[block] || BLOCK_MAP[block] || [];
  for (const key of candidates) {
    if (!passesFieldThresholdForKey(state, block, key)) {
      return key;
    }
  }
  return candidates[0] || null;
}

function isBlockSatisfied(state, block) {
  const fields = BLOCK_MAP[block] || [];
  return fields.some((field) => passesFieldThresholdForKey(state, block, field));
}

function passesFieldThresholdForKey(state, block, field) {
  return passesQualityThreshold(state, block, field, state.answers[field]);
}

function passesQualityThreshold(state, block, field, value) {
  if (!hasMeaningfulValue(value)) return false;

  const category = getCategory(state);
  const text = valueToText(value);
  const list = Array.isArray(value) ? cleanList(value) : [];
  const lower = text.toLowerCase();

  switch (block) {
    case "what_it_is":
      return text.length >= 18 && !isGenericPublicLanguage(text);

    case "who_its_for":
      return passesAudienceThreshold(category, text);

    case "why_trust_it":
      return passesTrustThreshold(category, text);

    case "what_to_do_next":
      return text.length >= 4;

    case "when_where":
      return passesWhenWhereThreshold(category, text, list);

    case "transformation":
      return passesTransformationThreshold(category, text);

    case "proof_of_quality":
      return passesProofThreshold(category, text);

    case "differentiation":
      return passesDifferentiationThreshold(category, text);

    case "service_specificity":
      return passesServiceSpecificityThreshold(category, text);

    case "process_clarity":
      return passesProcessClarityThreshold(category, text);

    case "proof_depth":
      return passesProofThreshold(category, text);

    case "faq_substance":
      return passesFaqSubstanceThreshold(category, value, text, list);

    case "agenda_or_format":
      return passesAgendaOrFormatThreshold(category, text);

    case "urgency_or_reason_now":
      return passesUrgencyThreshold(category, text, list);

    case "method_clarity":
      return passesMethodClarityThreshold(category, text);

    case "offer_specificity":
      return passesOfferSpecificityThreshold(category, text);

    case "style_or_positioning":
      return passesStyleOrPositioningThreshold(category, text);

    case "projects_or_examples":
      return passesProjectsOrExamplesThreshold(category, text, list);

    case "about_depth":
      return text.length >= 36 && !isGenericPublicLanguage(text);

    default:
      if (Array.isArray(value)) return list.length > 0;
      return text.length >= 1;
  }
}

function passesAudienceThreshold(category, text) {
  if (text.length < 24 || isGenericAudienceLanguage(text)) return false;

  const audienceSignals = {
    service: ["homeowner", "property", "residential", "commercial", "office", "upscale", "luxury", "facility", "storefront", "family"],
    event: ["attendee", "guest", "family", "tourist", "local", "couple", "group", "traveler", "visitor", "community"],
    coach: ["founder", "leader", "executive", "team", "owner", "professional", "creative", "consultant", "operator"],
    portfolio: ["brand", "client", "collector", "agency", "editor", "creative director", "homeowner", "developer", "publisher"]
  };

  return containsAny(text, audienceSignals[category] || audienceSignals.service);
}

function passesTrustThreshold(category, text) {
  if (text.length < 18 || isGenericPublicLanguage(text)) return false;

  const proofSignals = {
    service: ["before-and-after", "before and after", "review", "insured", "licensed", "results", "photos", "praise", "spotless", "careful", "professionalism", "reliability", "detail"],
    event: ["sold out", "returning guests", "reviews", "ratings", "featured", "press", "popular", "repeat bookings", "word of mouth", "well-reviewed"],
    coach: ["client results", "case study", "outcomes", "testimonials", "referrals", "years of experience", "track record", "repeat clients", "transformation"],
    portfolio: ["published", "featured", "commissioned", "collected", "client list", "selected works", "past projects", "recognized", "portfolio", "lookbook"]
  };

  return containsAny(text, proofSignals[category] || proofSignals.service);
}

function passesWhenWhereThreshold(category, text, list) {
  if (Array.isArray(list) && list.length > 0) return true;

  if (category === "event") {
    return text.length >= 10 && containsAny(text, [
      "located", "held", "hosted", "departure", "venue", "downtown", "on the water", "marina",
      "starts at", "meets at", "weekend", "season", "dates"
    ]);
  }

  return text.length >= 8;
}

function passesTransformationThreshold(category, text) {
  if (text.length < 28 || isGenericPublicLanguage(text)) return false;

  if (category === "coach") {
    return containsAny(text, [
      "clarity", "confidence", "decision-making", "leadership", "growth", "alignment",
      "better hires", "stronger team", "focus", "momentum", "transformation"
    ]);
  }

  return text.length >= 28;
}

function passesDifferentiationThreshold(category, text) {
  if (text.length < 40 || isGenericPublicLanguage(text)) return false;

  const signals = {
    service: [
      "large homes", "big glass", "restoration", "detail", "white-glove", "careful",
      "specialize", "specialized", "upscale", "premium", "delicate", "property",
      "trusted on the property", "streak-free", "high-end"
    ],
    event: [
      "small-group", "private", "guided", "exclusive", "sunset", "curated", "premium",
      "captain-led", "behind-the-scenes", "immersive", "limited capacity", "custom route"
    ],
    coach: [
      "hands-on", "strategic", "high-touch", "direct", "practical", "operator-led",
      "decision support", "custom framework", "tailored", "deep work", "implementation"
    ],
    portfolio: [
      "distinct point of view", "editorial", "custom", "collected", "commissioned",
      "high-concept", "refined", "architectural", "art direction", "signature"
    ]
  };

  return containsAny(text, signals[category] || signals.service);
}

function passesServiceSpecificityThreshold(category, text) {
  if (text.length < 40 || isGenericPublicLanguage(text)) return false;

  const signals = {
    service: [
      "large homes", "big glass", "glass restoration", "residential", "commercial",
      "interior", "exterior", "detail", "frames", "tracks", "hard water", "streak-free",
      "storefront", "property", "upscale", "delicate"
    ],
    event: [
      "tour", "session", "departure", "duration", "route", "experience includes",
      "group size", "on-board", "agenda", "schedule", "what to expect"
    ],
    coach: [
      "one-on-one", "advisory", "sessions", "engagement", "workshop", "program",
      "retainer", "strategy calls", "implementation", "leadership", "team"
    ],
    portfolio: [
      "branding", "interiors", "residential", "commercial", "campaigns", "editorial",
      "installation", "commissions", "identity", "website", "photography", "selected works"
    ]
  };

  return containsAny(text, signals[category] || signals.service);
}

function passesProcessClarityThreshold(category, text) {
  if (text.length < 45 || splitSentences(text).length < 2) return false;

  const signals = {
    service: ["quote", "scope", "schedule", "arrive", "clean", "walkthrough", "finish", "follow up", "confirm"],
    event: ["reserve", "arrival", "check-in", "departure", "experience", "timeline", "wrap-up", "meeting point"],
    coach: ["intro call", "assessment", "sessions", "cadence", "plan", "implementation", "feedback", "follow-through"],
    portfolio: ["discovery", "brief", "concept", "revision", "delivery", "installation", "production", "presentation"]
  };

  return containsAny(text, signals[category] || signals.service);
}

function passesProofThreshold(category, text) {
  if (text.length < 18 || isGenericPublicLanguage(text)) return false;

  const signals = {
    service: [
      "review", "praise", "before-and-after", "before and after", "photos",
      "results", "customers mention", "customers say", "reliability",
      "professionalism", "spotless", "attention to detail", "local referrals"
    ],
    event: [
      "repeat guests", "well-reviewed", "popular", "sold out", "word of mouth",
      "ratings", "photos", "guest feedback", "return bookings", "shared experiences"
    ],
    coach: [
      "testimonials", "client wins", "results", "case study", "referrals",
      "repeat engagements", "outcomes", "promotion", "team impact", "clarity"
    ],
    portfolio: [
      "selected works", "published", "featured", "client projects", "commissions",
      "press", "editorial", "portfolio", "visual proof", "past work"
    ]
  };

  return containsAny(text, signals[category] || signals.service);
}

function passesFaqSubstanceThreshold(category, value, text, list) {
  if (Array.isArray(value)) {
    if (list.length < 2) return false;

    const joined = list.join(" ").toLowerCase();
    const categorySignals = {
      service: ["price", "trust", "damage", "timing", "property", "quality", "responsiveness"],
      event: ["parking", "weather", "duration", "what to bring", "kids", "refund", "schedule", "booking"],
      coach: ["fit", "results", "time", "investment", "process", "who this is for", "expectations"],
      portfolio: ["process", "timeline", "budget", "availability", "custom", "deliverables", "style"]
    };

    return containsAny(joined, categorySignals[category] || categorySignals.service);
  }

  return text.length >= 30 && !isGenericPublicLanguage(text);
}

function passesAgendaOrFormatThreshold(category, text) {
  if (text.length < 36 || isGenericPublicLanguage(text)) return false;

  if (category === "event") {
    return containsAny(text, [
      "schedule", "agenda", "duration", "departure", "arrival", "tour route",
      "experience includes", "what to expect", "session", "lineup", "format"
    ]);
  }

  return text.length >= 36;
}

function passesUrgencyThreshold(category, text, list) {
  if (Array.isArray(list) && list.length > 0) return true;

  if (category === "event") {
    return text.length >= 16 && containsAny(text, [
      "limited", "seasonal", "popular", "sell out", "booking window", "dates",
      "summer", "holiday", "weekend", "availability"
    ]);
  }

  return text.length >= 12;
}

function passesMethodClarityThreshold(category, text) {
  if (text.length < 36 || isGenericPublicLanguage(text)) return false;

  if (category === "coach") {
    return containsAny(text, [
      "assessment", "framework", "sessions", "cadence", "support", "feedback",
      "implementation", "strategy", "check-ins", "decision-making"
    ]);
  }

  return text.length >= 36;
}

function passesOfferSpecificityThreshold(category, text) {
  if (text.length < 36 || isGenericPublicLanguage(text)) return false;

  if (category === "coach") {
    return containsAny(text, [
      "program", "engagement", "advisory", "one-on-one", "team coaching",
      "intensive", "retainer", "leadership", "clarity", "growth"
    ]);
  }

  return text.length >= 36;
}

function passesStyleOrPositioningThreshold(category, text) {
  if (text.length < 32 || isGenericPublicLanguage(text)) return false;

  if (category === "portfolio") {
    return containsAny(text, [
      "point of view", "editorial", "refined", "architectural", "signature",
      "minimal", "luxury", "custom", "collected", "high-concept", "visual language"
    ]);
  }

  return text.length >= 32;
}

function passesProjectsOrExamplesThreshold(category, text, list) {
  if (Array.isArray(list) && list.length >= 2) return true;
  if (text.length < 24 || isGenericPublicLanguage(text)) return false;

  if (category === "portfolio") {
    return containsAny(text, [
      "projects", "selected works", "campaign", "residential", "commercial",
      "commission", "installation", "editorial", "lookbook", "past work"
    ]);
  }

  if (category === "event") {
    return containsAny(text, [
      "photos", "past events", "guest moments", "tour images", "gallery", "visual proof"
    ]);
  }

  return text.length >= 24;
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
      if (category === "event") {
        return "What exactly is the event or experience, and how would you describe it so the right person immediately understands why it is worth attending?";
      }
      if (category === "coach") {
        return `What is the main coaching or advisory offer you want ${businessName} known for first, and what kind of change or result does it help create?`;
      }
      if (category === "portfolio") {
        return `What kind of work do you most want ${businessName} to be hired or recognized for first?`;
      }
      return `I want to sharpen the offer so this does not sound like a generic service page. What is the main service or result you most want ${businessName} to be known for first?`;

    case "audience":
      if (category === "coach") {
        return `Who is the right fit for ${businessName}? I mean the kind of person, leader, founder, or team this should feel especially built for.`;
      }
      if (category === "event") {
        return `Who is most likely to love this event or experience? I mean the real attendee, not “anyone.”`;
      }
      if (category === "portfolio") {
        return `Who do you most want this work to attract — the kind of client, collaborator, buyer, or audience this should feel tailored to?`;
      }
      return `Who is most likely to choose ${businessName}? I do not mean “anyone who needs this.” I mean the kind of client, property, or situation this page should feel especially built for.`;

    case "trust_signal":
      if (category === "event") {
        return `What makes this event or experience feel trustworthy and worth booking — guest reviews, returning attendees, strong photos, local reputation, a known host, or something else concrete?`;
      }
      if (category === "coach") {
        return `What would make someone trust ${businessName} enough to hire you — client outcomes, testimonials, years of experience, case studies, referrals, or something else specific?`;
      }
      if (category === "portfolio") {
        return `What helps people trust the quality of the work — selected projects, recognizable clients, features, commissions, published work, or something else concrete?`;
      }
      return `What would make someone trust ${businessName} quickly in the real world — specific results, before-and-after work, reviews, professionalism on-site, years of experience, referrals, credentials, or something else concrete?`;

    case "booking_method":
      if (category === "event") {
        return "When someone is ready, what should happen first — reserve a spot, buy tickets, submit an inquiry, call, or something else?";
      }
      if (category === "coach") {
        return "When someone is ready to move forward, what should happen first — book a call, apply, request details, or something else?";
      }
      return "When someone is ready to move forward, what should happen first — request a quote, call, text, fill out a form, or book online?";

    case "contact_path":
      return "What is the cleanest next step for the customer — call, text, form, request a quote, booking page, apply, or reserve?";

    case "service_area":
      if (category === "event") {
        return "Where does this happen, and what location detail matters most for someone deciding whether to attend?";
      }
      return `We have ${serviceArea || "your main area"} as a starting point. What is the best way to describe the area, neighborhoods, or radius you really want this site to speak to?`;

    case "service_descriptions":
      if (category === "event") {
        return "What should the preview say about the format, flow, or experience itself so it feels vivid and worth attending — timing, duration, group size, route, what is included, or what people can expect?";
      }
      if (category === "coach") {
        return `What does the actual offer look like in practice — sessions, cadence, strategic support, team work, workshops, implementation, or something else?`;
      }
      if (category === "portfolio") {
        return "What kinds of work, project types, or example categories should the preview describe so it feels distinct and credible?";
      }
      return `What kinds of jobs, property types, or service details should the preview describe so it sounds like a real premium business? Think specifics like large homes, delicate glass, restoration work, detail-focused service, or anything else that matters.`;

    case "process_notes":
      if (category === "coach") {
        return `Walk me through how working with ${businessName} usually goes, from first conversation to meaningful progress. I want the process to feel clear and high-value.`;
      }
      if (category === "portfolio") {
        return `How does a project usually move from inquiry to finished work? I want the process to feel thoughtful, professional, and easy to trust.`;
      }
      if (category === "event") {
        return `Walk me through the attendee experience from booking to the end of the event so the page can make it feel clear, smooth, and worth it.`;
      }
      return `Walk me through how working with ${businessName} usually goes, from first contact to finished result. I want the site to make the experience feel clear, smooth, and professional.`;

    case "pricing_structure":
      if (category === "coach") {
        return "You do not need to share exact pricing, but should people understand this as a custom engagement, intensive, retainer, package, or something else?";
      }
      if (category === "portfolio") {
        return "You do not need exact numbers, but should potential clients think in terms of custom commissions, project minimums, retainers, collections, or something else?";
      }
      return "You do not need to share exact prices, but how should customers understand pricing — fixed packages, custom quotes, by scope, by property size, minimums, or something else?";

    case "testimonials_status":
      if (category === "event") {
        return "Do you already have guest feedback, repeat attendance, review themes, or word-of-mouth patterns that help show people enjoy the experience?";
      }
      if (category === "coach") {
        return "Do you already have testimonials, client outcomes, case-study themes, or repeat praise patterns that help make the value feel real?";
      }
      if (category === "portfolio") {
        return "Do you already have client praise, recognition, features, or reactions that help prove the quality of the work?";
      }
      return `Do you already have customer testimonials, review quotes, or repeat praise themes? Even simple patterns like “clients mention reliability, spotless results, and professionalism” are useful.`;

    case "photos_status":
      if (category === "portfolio") {
        return "Do you already have strong project images, selected works, editorial photos, or other visual proof we can build around later?";
      }
      if (category === "event") {
        return "Do you already have event photos, guest moments, or visual examples that help the experience feel real and desirable?";
      }
      return "Do you already have strong work photos, before-and-after examples, or project images that could help the preview feel premium later?";

    case "common_objections":
      if (category === "event") {
        return "Before booking, what are attendees usually unsure about — whether it is worth it, weather, group fit, timing, what to bring, cancellation policy, or something else?";
      }
      if (category === "coach") {
        return "Before hiring you, what are people usually unsure about — fit, investment, time commitment, whether it will actually help, or something else real?";
      }
      if (category === "portfolio") {
        return "Before reaching out, what are the usual hesitations — budget, timeline, style fit, availability, process, or something else?";
      }
      return `Before hiring you, what are customers usually worried about? Think real hesitations like trust, showing up on time, care on the property, price, damage concerns, or whether the result will actually look better.`;

    case "buyer_decision_factors":
      if (category === "coach") {
        return `When the right client chooses ${businessName}, what are they really deciding based on — clarity of thinking, trust, practical results, depth of support, seniority, or something else real?`;
      }
      if (category === "event") {
        return `When the right person books this, what are they really deciding based on — the host, experience quality, timing, location, group size, uniqueness, convenience, or something else?`;
      }
      if (category === "portfolio") {
        return `When the right client or buyer chooses this work, what are they really deciding based on — style fit, quality, originality, confidence, project relevance, or something else?`;
      }
      return `When the right client chooses ${businessName}, what are they really deciding based on? Not generic marketing words — the real factors like responsiveness, trust on the property, quality of finish, specialization, appearance, convenience, or something else.`;

    case "differentiation":
      if (category === "event") {
        return `A lot of events can sound similar. What makes this one genuinely more appealing or memorable in practice — the setting, host, format, experience, exclusivity, atmosphere, or something else?`;
      }
      if (category === "coach") {
        return `A lot of coaches sound alike. What makes ${businessName} genuinely different in practice — your style, depth, point of view, strategic sharpness, level of support, or something else clients feel after working with you?`;
      }
      if (category === "portfolio") {
        return `A lot of creative work can blur together online. What makes ${businessName} feel distinct — the point of view, style, discipline, level of refinement, project type, or something else concrete?`;
      }
      return primaryOffer
        ? `A lot of businesses in this category can sound similar. Beyond just "${primaryOffer}", what makes ${businessName} genuinely different in the real world? What do customers notice or appreciate after working with you that they might not get elsewhere?`
        : `What makes ${businessName} genuinely different or more appealing than the alternatives nearby? I am looking for real-world differences, not generic “quality service” language.`;

    case "founder_bio":
      return "Would you want the preview to hint at an owner, founder, or personal point of view, and if so, what should it emphasize about the person behind the work?";

    case "hours":
      if (category === "event") {
        return "Are there dates, departure times, booking windows, or schedule realities we should make clear?";
      }
      return "Are there any timing expectations, availability windows, seasonal limitations, or response-time promises we should make clear?";

    case "peak_season_availability":
      if (category === "event") {
        return "Are there peak dates, seasonal demand patterns, limited-capacity realities, or booking windows we should make clear so the page feels honest and well-managed?";
      }
      return "Are there busy seasons, lead-time expectations, or scheduling realities we should set clearly so the page feels honest and well-managed?";

    case "phone":
      return "What public phone number should appear on the site for inquiries or next steps?";

    case "booking_url":
      return "Do you already have a booking page, request form, ticket link, scheduling link, or external URL we should send people to?";

    case "office_address":
      return "Do you want to show a public address, venue, studio, or office location, or should we present this without a public storefront?";

    default:
      return "Let’s tighten one more detail so the preview feels specific and premium. Can you clarify that for me?";
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
  const sentences = splitSentences(input);
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
        /\btrust\b|\btestimonial\b|\breview\b|\bexperience\b|\bcredential\b|\binsured\b|\blicensed\b|\breferral\b|\bproof\b|\bbefore\b|\bafter\b|\bresults\b|\bprofessionalism\b|\bfeatured\b|\bpublished\b|\bcase study\b|\brepeat guests\b/i.test(s)
      );
      return joined(matches) || input;
    }

    case "booking_method":
    case "contact_path": {
      if (/\brequest quote\b|\bquote\b/i.test(input)) return "request quote";
      if (/\bbook a call\b|\bschedule a call\b|\bdiscovery call\b/i.test(input)) return "book a call";
      if (/\bapply\b/i.test(input)) return "apply";
      if (/\breserve\b|\bbuy tickets\b|\btickets\b/i.test(input)) return "reserve";
      if (/\bbook\b/i.test(input)) return "book online";
      if (/\bcall\b/i.test(input)) return "call";
      if (/\btext\b/i.test(input)) return "text";
      if (/\bform\b|\bcontact form\b|\bsubmit\b/i.test(input)) return "contact form";
      return input;
    }

    case "service_area": {
      const matches = sentences.filter((s) =>
        /\bserve\b|\bservice area\b|\bcity\b|\btown\b|\bcounty\b|\bmetro\b|\bregion\b|\bneighborhood\b|\barea\b|\bradius\b|\bvenue\b|\bmarina\b|\blocation\b/i.test(s)
      );
      return joined(matches) || input;
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
    } else if (/\bbook a call\b|\bschedule a call\b|\bdiscovery call\b/i.test(text)) {
      state.answers.booking_method = "book a call";
      state.meta.inferred.booking_method = true;
    } else if (/\bapply\b/i.test(text)) {
      state.answers.booking_method = "apply";
      state.meta.inferred.booking_method = true;
    } else if (/\breserve\b|\bbuy tickets\b|\btickets\b/i.test(text)) {
      state.answers.booking_method = "reserve";
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
  state.answers.primary_offer = cleanPublicString(state.answers.primary_offer);
  state.answers.audience = cleanPublicString(state.answers.audience);
  state.answers.service_area = cleanPublicString(state.answers.service_area);
  state.answers.trust_signal = cleanPublicString(state.answers.trust_signal);
  state.answers.contact_path = cleanPublicString(state.answers.contact_path);
  state.answers.booking_method = cleanPublicString(state.answers.booking_method);
  state.answers.cta_text = cleanPublicString(state.answers.cta_text);
  state.answers.cta_link = cleanString(state.answers.cta_link);
  state.answers.differentiation = cleanPublicString(state.answers.differentiation);
  state.answers.website_direction = cleanPublicString(state.answers.website_direction);
  state.answers.business_understanding = cleanPublicString(state.answers.business_understanding);
  state.answers.service_descriptions = cleanPublicString(state.answers.service_descriptions);
  state.answers.process_notes = cleanPublicString(state.answers.process_notes);
  state.answers.pricing_structure = cleanPublicString(state.answers.pricing_structure);
  state.answers.testimonials_status = cleanPublicString(state.answers.testimonials_status);
  state.answers.photos_status = cleanPublicString(state.answers.photos_status);
  state.answers.founder_bio = cleanPublicString(state.answers.founder_bio);
  state.answers.peak_season_availability = cleanPublicString(state.answers.peak_season_availability);
  state.answers.phone = normalizePhone(state.answers.phone);
  state.answers.booking_url = cleanString(state.answers.booking_url);
  state.answers.hours = cleanPublicString(state.answers.hours);
  state.answers.office_address = cleanPublicString(state.answers.office_address);

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
   PREMIUM HELPERS
-------------------------------- */

function bestPublicOffer(state) {
  const candidates = [
    state.ghostwritten.tagline,
    state.answers.primary_offer,
    state.answers.business_understanding,
    state.provenance?.strategy_contract?.source_snapshot?.primary_offer_hint
  ];

  for (const candidate of candidates) {
    const text = cleanPublicString(candidate);
    if (text && !isGenericPublicLanguage(text)) return text;
  }

  return "";
}

function bestPublicAudience(state, category) {
  const text = cleanPublicString(state.answers.audience);
  if (text && passesAudienceThreshold(category, text)) return text;
  return "";
}

function bestPublicDifferentiation(state) {
  const text = cleanPublicString(state.answers.differentiation);
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

  for (const candidate of candidates) {
    const text = cleanPublicString(candidate);
    if (text && !isGenericPublicLanguage(text)) return text;
  }

  return "";
}

function bestPublicProcess(state) {
  const text = cleanPublicString(state.answers.process_notes);
  if (text && splitSentences(text).length >= 2) return text;
  return "";
}

function buildHeroHeadline(offer, differentiation, businessName, category) {
  if (offer && differentiation) {
    const phrase = cleanSentenceFragment(differentiation);
    if (phrase.length <= 80) {
      return `${cleanSentenceFragment(offer)} for people who value ${lowerFirst(phrase)}`;
    }
  }

  if (offer) return cleanSentenceFragment(offer);
  return buildCategoryFallbackHeadline(category, businessName);
}

function buildCategoryFallbackHeadline(category, businessName) {
  switch (category) {
    case "event":
      return `${businessName} experiences worth planning around`;
    case "coach":
      return `Strategic support with depth, clarity, and follow-through`;
    case "portfolio":
      return `${businessName} work with a clear point of view`;
    default:
      return `Premium ${businessName} service built around trust and results`;
  }
}

function buildCategoryFallbackSubheadline(category) {
  switch (category) {
    case "event":
      return "with a booking experience that feels clear, exciting, and worth it";
    case "coach":
      return "with a process that feels practical, high-trust, and genuinely useful";
    case "portfolio":
      return "with enough substance, examples, and positioning to feel credible";
    default:
      return "with a clear, professional experience from first contact to finished result";
  }
}

function buildCategoryFallbackOffer(category) {
  switch (category) {
    case "event":
      return "a well-positioned experience";
    case "coach":
      return "high-trust coaching and advisory work";
    case "portfolio":
      return "distinctive creative work";
    default:
      return "professional work";
  }
}

function buildCategoryFallbackFounderNote(category) {
  switch (category) {
    case "coach":
      return "Built around thoughtful guidance, real-world usefulness, and support that feels genuinely engaged.";
    case "portfolio":
      return "Built around a clear point of view, careful execution, and work that holds up visually and professionally.";
    case "event":
      return "Built around creating an experience people feel good recommending and coming back to.";
    default:
      return "Built around careful work, clear communication, and results clients feel good about showing off.";
  }
}

function buildCategoryContactSubheadline(category, method) {
  switch (category) {
    case "event":
      return compactSentence([
        `Use the next step below to ${method}`,
        "so the booking path feels simple and low-friction."
      ], 10, 24);
    case "coach":
      return compactSentence([
        `Use the next step below to ${method}`,
        "so the right-fit client can move forward without confusion."
      ], 10, 24);
    case "portfolio":
      return compactSentence([
        `Use the next step below to ${method}`,
        "so a serious inquiry can turn into a real conversation."
      ], 10, 24);
    default:
      return compactSentence([
        `Tell us about the property or project and we will help you ${method === "request quote" ? "get a clear next step" : "get started"}`
      ], 10, 22);
  }
}

function buildFeatureSeeds(state) {
  const category = getCategory(state);
  const features = [];
  const serviceText = cleanPublicString(state.answers.service_descriptions);
  const processText = cleanPublicString(state.answers.process_notes);
  const proofText = cleanPublicString(state.answers.testimonials_status);
  const diffText = cleanPublicString(state.answers.differentiation);

  if (category === "service") {
    if (containsAny(serviceText, ["large homes", "big glass", "delicate", "restoration", "detail", "streak-free"])) {
      features.push({
        title: "Detail-Focused Work",
        description: compactSentence([
          "Built for jobs where finish quality, care, and visual results matter",
          extractSpecificClause(serviceText)
        ], 10, 24)
      });
    }

    if (containsAny(processText, ["quote", "scope", "schedule", "walkthrough", "confirm"])) {
      features.push({
        title: "Clear Process",
        description: compactSentence([
          "From first contact to final result, the experience feels organized and easy to trust",
          extractSpecificClause(processText)
        ], 10, 24)
      });
    }

    if (containsAny(proofText, ["reliability", "professionalism", "spotless", "detail", "responsive"])) {
      features.push({
        title: "Believable Proof",
        description: compactSentence([
          "The strongest praise themes are specific and repeatable",
          extractSpecificClause(proofText)
        ], 10, 24)
      });
    }
  }

  if (category === "event") {
    if (containsAny(serviceText, ["duration", "route", "experience includes", "schedule", "departure", "what to expect"])) {
      features.push({
        title: "Clear Experience Format",
        description: compactSentence([
          "The page can explain what the experience feels like before someone books",
          extractSpecificClause(serviceText)
        ], 10, 24)
      });
    }

    if (containsAny(diffText, ["private", "exclusive", "guided", "curated", "immersive", "small-group"])) {
      features.push({
        title: "Distinctive Experience",
        description: compactSentence([
          "The experience feels more intentional and memorable than a generic outing",
          extractSpecificClause(diffText)
        ], 10, 24)
      });
    }

    if (containsAny(proofText, ["repeat guests", "well-reviewed", "popular", "sold out", "guest feedback"])) {
      features.push({
        title: "Guest Confidence",
        description: compactSentence([
          "Strong review or repeat-booking patterns help the event feel worth planning around",
          extractSpecificClause(proofText)
        ], 10, 24)
      });
    }
  }

  if (category === "coach") {
    if (containsAny(serviceText, ["sessions", "advisory", "program", "framework", "support", "implementation"])) {
      features.push({
        title: "Concrete Offer Structure",
        description: compactSentence([
          "The offer feels like a real engagement, not vague inspiration",
          extractSpecificClause(serviceText)
        ], 10, 24)
      });
    }

    if (containsAny(processText, ["assessment", "sessions", "plan", "cadence", "implementation", "feedback"])) {
      features.push({
        title: "Clear Working Method",
        description: compactSentence([
          "The process explains how support actually happens and why it is valuable",
          extractSpecificClause(processText)
        ], 10, 24)
      });
    }

    if (containsAny(proofText, ["client wins", "results", "case study", "outcomes", "referrals"])) {
      features.push({
        title: "Outcome-Oriented Credibility",
        description: compactSentence([
          "Proof comes from real client progress, not generic authority claims",
          extractSpecificClause(proofText)
        ], 10, 24)
      });
    }
  }

  if (category === "portfolio") {
    if (containsAny(serviceText, ["projects", "campaign", "residential", "commercial", "editorial", "commissions"])) {
      features.push({
        title: "Relevant Project Types",
        description: compactSentence([
          "The work feels grounded in real categories and recognizable examples",
          extractSpecificClause(serviceText)
        ], 10, 24)
      });
    }

    if (containsAny(diffText, ["point of view", "editorial", "signature", "refined", "architectural", "visual language"])) {
      features.push({
        title: "Clear Creative Positioning",
        description: compactSentence([
          "The portfolio communicates a distinct point of view instead of blending in",
          extractSpecificClause(diffText)
        ], 10, 24)
      });
    }

    if (containsAny(proofText, ["published", "featured", "commissioned", "selected works", "client projects"])) {
      features.push({
        title: "Visible Credibility",
        description: compactSentence([
          "The quality feels easier to trust because the proof is visual and concrete",
          extractSpecificClause(proofText)
        ], 10, 24)
      });
    }
  }

  const fallbackSets = {
    service: [
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
    ],
    event: [
      {
        title: "Worth Booking",
        description: "The experience feels specific, memorable, and easy to picture before someone commits."
      },
      {
        title: "Low-Friction Planning",
        description: "Timing, logistics, and next steps feel clear enough to reduce hesitation."
      },
      {
        title: "Believable Appeal",
        description: "The experience is supported by guest reactions, visuals, or repeat demand instead of hype."
      }
    ],
    coach: [
      {
        title: "Substantive Support",
        description: "The offer feels practical, strategic, and grounded in real help rather than vague motivation."
      },
      {
        title: "Clear Fit",
        description: "The page helps the right client quickly understand whether this is for them."
      },
      {
        title: "Credible Value",
        description: "The case for hiring feels rooted in outcomes, depth, and trust rather than generic authority."
      }
    ],
    portfolio: [
      {
        title: "Distinct Point of View",
        description: "The work feels intentional, refined, and different enough to be remembered."
      },
      {
        title: "Project Relevance",
        description: "The examples make it easier for the right client to picture a fit."
      },
      {
        title: "Professional Presentation",
        description: "The process and proof help the portfolio feel serious, polished, and real."
      }
    ]
  };

  const fallbacks = fallbackSets[category] || fallbackSets.service;

  while (features.length < 3) {
    const next = fallbacks[features.length];
    if (next) features.push(next);
    else break;
  }

  return features.slice(0, 4);
}

function buildFaqSeeds(state) {
  const category = getCategory(state);
  const faqs = [];
  const objections = cleanList(state.answers.common_objections);
  const factors = cleanList(state.answers.buyer_decision_factors);
  const pricing = cleanPublicString(state.answers.pricing_structure);
  const process = cleanPublicString(state.answers.process_notes);
  const booking = cleanPublicString(state.answers.booking_method);

  if (pricing) {
    const pricingQuestion = {
      service: "How does pricing work?",
      event: "How does booking or ticketing work?",
      coach: "How should I think about pricing or engagement structure?",
      portfolio: "How should I think about pricing or project scope?"
    }[category] || "How does pricing work?";

    faqs.push({
      question: pricingQuestion,
      answer: cleanSentence(
        compactSentence([
          pricing,
          "The goal is to set clear expectations without forcing generic language where it does not fit."
        ], 12, 28)
      )
    });
  }

  if (process) {
    const processQuestion = {
      service: "What is the process like?",
      event: "What should I expect from the experience?",
      coach: "What does working together actually look like?",
      portfolio: "What is the creative or project process like?"
    }[category] || "What is the process like?";

    faqs.push({
      question: processQuestion,
      answer: cleanSentence(
        compactSentence([
          extractSpecificClause(process),
          "The experience should feel clear from first step through completion."
        ], 12, 28)
      )
    });
  }

  if (booking) {
    const bookingQuestion = {
      service: "What should I do first if I want to get started?",
      event: "What is the best next step if I want to book?",
      coach: "What is the best next step if I am interested?",
      portfolio: "What is the best next step if I want to inquire?"
    }[category] || "What should I do first if I want to get started?";

    faqs.push({
      question: bookingQuestion,
      answer: cleanSentence(
        compactSentence([
          `The best next step is to ${booking}`,
          "so the customer has a simple, low-friction way to move forward."
        ], 10, 24)
      )
    });
  }

  if (objections.length) {
    faqs.push({
      question: "What concerns do people usually have before moving forward?",
      answer: cleanSentence(
        compactSentence([
          `Common concerns include ${listToPhrase(objections.slice(0, 3))}`,
          "so the site should answer those clearly instead of sounding vague."
        ], 12, 28)
      )
    });
  }

  if (factors.length) {
    faqs.push({
      question: "What matters most to the right clients?",
      answer: cleanSentence(
        compactSentence([
          `The strongest decision factors are ${listToPhrase(factors.slice(0, 4))}`,
          "which helps the preview sound grounded in how people actually choose."
        ], 12, 28)
      )
    });
  }

  return faqs.slice(0, 5);
}

function buildTestimonialSeeds(state) {
  const category = getCategory(state);
  const seeds = [];
  const proofText = cleanPublicString(state.answers.testimonials_status);

  const praiseThemesByCategory = {
    service: [
      ["reliability", "Clients repeatedly mention reliability and follow-through."],
      ["professionalism", "Customers notice a professional, respectful experience from start to finish."],
      ["spotless", "The finished result feels visibly cleaner, sharper, and worth paying for."],
      ["attention to detail", "Clients appreciate the level of care and attention to detail."],
      ["responsive", "Communication feels responsive and easy, which reduces friction before the job even starts."]
    ],
    event: [
      ["repeat guests", "Guests come back or recommend the experience to others."],
      ["well-reviewed", "Reviews suggest the experience delivers on what people hoped for."],
      ["popular", "The experience feels locally valued rather than unknown or untested."],
      ["sold out", "Demand patterns help the event feel worth booking in advance."],
      ["guest feedback", "Guest reactions make the experience feel real and enjoyable, not just marketed."]
    ],
    coach: [
      ["results", "Clients point to meaningful progress rather than just enjoying the sessions."],
      ["outcomes", "The work is valued because it creates useful shifts in thinking or execution."],
      ["referrals", "Referrals suggest people trust the experience enough to recommend it."],
      ["case study", "The proof feels grounded in specific client change, not vague authority."],
      ["repeat engagements", "Clients come back when they need deeper support."]
    ],
    portfolio: [
      ["published", "Recognition or publication helps validate the quality of the work."],
      ["featured", "The work has enough strength to be noticed beyond the artist alone."],
      ["commissioned", "Clients trust the work enough to hire for custom projects."],
      ["selected works", "The portfolio shows intentional curation rather than random accumulation."],
      ["client projects", "The work feels proven in real-world use, not just conceptually strong."]
    ]
  };

  const themes = praiseThemesByCategory[category] || praiseThemesByCategory.service;

  for (const [needle, line] of themes) {
    if (proofText.toLowerCase().includes(needle)) {
      seeds.push(line);
    }
  }

  if (!seeds.length && proofText && !isGenericPublicLanguage(proofText)) {
    seeds.push(cleanSentence(proofText));
  }

  return seeds.slice(0, 3);
}

function buildDifferentiationFromSignals(text, state) {
  const category = getCategory(state);
  const parts = [];
  const lower = text.toLowerCase();

  if (category === "service") {
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
  }

  if (category === "event") {
    if (/private|exclusive|small-group|limited/i.test(lower)) {
      parts.push("it feels more personal and considered than a generic public outing");
    }
    if (/guided|captain|host-led|curated/i.test(lower)) {
      parts.push("the experience has a stronger sense of direction and expertise");
    }
    if (/sunset|immersive|memorable|scenic|special/i.test(lower)) {
      parts.push("people can picture why this feels worth planning around");
    }
    if (/repeat guests|well-reviewed|popular|recommended/i.test(lower)) {
      parts.push("social proof makes the experience feel safer to book");
    }
  }

  if (category === "coach") {
    if (/hands-on|direct|practical|implementation/i.test(lower)) {
      parts.push("the support feels usable in the real world, not just inspirational");
    }
    if (/strategic|sharp|decision-making|clarity/i.test(lower)) {
      parts.push("clients get stronger thinking and better judgment, not just encouragement");
    }
    if (/high-touch|tailored|custom|deep work/i.test(lower)) {
      parts.push("the engagement feels more personal and serious than a generic coaching package");
    }
    if (/operator|founder|executive|leadership/i.test(lower)) {
      parts.push("the perspective feels grounded in meaningful responsibility and real stakes");
    }
  }

  if (category === "portfolio") {
    if (/point of view|signature|distinct|editorial|visual language/i.test(lower)) {
      parts.push("the work carries a recognizable point of view instead of blending in");
    }
    if (/commissioned|client work|selected works|projects/i.test(lower)) {
      parts.push("the portfolio feels proven through real projects, not just isolated concepts");
    }
    if (/refined|luxury|architectural|high-concept/i.test(lower)) {
      parts.push("the work feels elevated enough for higher-expectation clients");
    }
    if (/custom|careful|crafted/i.test(lower)) {
      parts.push("the execution feels intentional rather than formulaic");
    }
  }

  if (!parts.length) return "";

  const offer = cleanSentenceFragment(bestPublicOffer(state));
  const tail = listToPhrase(parts.slice(0, 3));
  return compactSentence([
    offer ? `${offer} with a positioning that feels stronger in practice` : "",
    tail
  ], 12, 30);
}

function inferObjectionsFromText(text, category) {
  const found = [];
  const lower = text.toLowerCase();

  if (category === "service") {
    if (lower.includes("trust")) found.push("whether they can trust the provider on the property");
    if (lower.includes("price") || lower.includes("cost")) found.push("whether the price will feel justified");
    if (lower.includes("responsive")) found.push("whether communication will be responsive");
    if (lower.includes("availability")) found.push("whether they can get scheduled in a reasonable window");
    if (lower.includes("damage") || lower.includes("careful")) found.push("whether the work will be handled carefully");
  }

  if (category === "event") {
    if (lower.includes("weather")) found.push("whether weather or conditions could affect the experience");
    if (lower.includes("timing") || lower.includes("schedule")) found.push("whether the timing will fit their plans");
    if (lower.includes("worth it") || lower.includes("price")) found.push("whether the experience will feel worth the cost");
    if (lower.includes("kids") || lower.includes("family")) found.push("whether it is the right fit for their group");
    if (lower.includes("parking") || lower.includes("location")) found.push("whether logistics will be easy enough");
  }

  if (category === "coach") {
    if (lower.includes("fit")) found.push("whether this is the right fit for their situation");
    if (lower.includes("time")) found.push("whether they can realistically commit the time");
    if (lower.includes("investment") || lower.includes("price")) found.push("whether the investment will feel justified");
    if (lower.includes("results")) found.push("whether the support will actually create meaningful progress");
    if (lower.includes("trust")) found.push("whether they can trust the depth and quality of the guidance");
  }

  if (category === "portfolio") {
    if (lower.includes("budget") || lower.includes("price")) found.push("whether the work fits their budget or project scope");
    if (lower.includes("style")) found.push("whether the style is the right fit");
    if (lower.includes("timeline")) found.push("whether the work can happen in their timeframe");
    if (lower.includes("availability")) found.push("whether the creator is available for the project");
    if (lower.includes("process")) found.push("whether the process will feel clear and professional");
  }

  return uniqueList(found);
}

function isGenericAudienceLanguage(text) {
  const lower = cleanPublicString(text).toLowerCase();
  if (!lower) return true;

  const banned = [
    "people actively looking for a trustworthy provider",
    "anyone who needs",
    "people who need",
    "customers seeking a premium provider",
    "homeowners and businesses",
    "anyone looking for quality service",
    "anyone looking for a provider",
    "the right people",
    "everyone",
    "all kinds of clients"
  ];

  if (banned.some((phrase) => lower.includes(phrase))) return true;
  if (lower.length < 20) return true;

  return false;
}

function isGenericPublicLanguage(text) {
  const lower = cleanPublicString(text).toLowerCase();
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
    "we care about our customers",
    "results-driven",
    "tailored solutions",
    "unique experience",
    "personalized approach",
    "high-quality results"
  ];

  if (bannedPhrases.some((phrase) => lower.includes(phrase))) return true;

  const tooGenericSingleConcept =
    lower.length < 28 &&
    containsAny(lower, ["quality", "professional", "trusted", "reliable", "best", "great", "premium"]);

  return tooGenericSingleConcept;
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

function cleanPublicString(v) {
  return collapseWhitespace(
    cleanString(v)
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[—–]/g, " - ")
      .replace(/…/g, "...")
      .replace(/\uFFFD/g, "")
  );
}

function cleanSentence(text) {
  const value = cleanPublicString(cleanString(text).replace(/^[-–—\d.\s]+/, ""));
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function cleanSentenceFragment(text) {
  return cleanPublicString(
    cleanString(text)
      .replace(/[|]/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/[.,;:]+$/g, "")
      .trim()
  );
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => cleanPublicString(v)).filter(Boolean);
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

function valueToText(value) {
  if (Array.isArray(value)) return cleanList(value).join(" ");
  if (isObject(value)) return Object.values(value).map((v) => valueToText(v)).join(" ");
  return cleanPublicString(String(value || ""));
}

function splitSentences(text) {
  return cleanPublicString(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function containsAny(text, needles) {
  const lower = cleanPublicString(text).toLowerCase();
  return needles.some((needle) => lower.includes(String(needle).toLowerCase()));
}

function extractListLikeItems(text) {
  return uniqueList(
    cleanPublicString(text)
      .split(/,|;|\band\b/gi)
      .map((s) => cleanSentenceFragment(s))
      .filter(Boolean)
  );
}

function listToPhrase(items) {
  const clean = cleanList(items);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function compactSentence(parts, minWords = 8, maxWords = 32) {
  const text = cleanPublicString(parts.filter(Boolean).join(". "));
  if (!text) return "";

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < minWords) return text;
  if (words.length <= maxWords) return cleanSentence(text);
  return cleanSentence(words.slice(0, maxWords).join(" "));
}

function extractSpecificClause(text) {
  const sentences = splitSentences(text);
  const preferred = sentences.find((s) =>
    containsAny(s, [
      "large homes", "big glass", "restoration", "detail", "careful",
      "quote", "schedule", "walkthrough", "spotless", "reliability",
      "professionalism", "responsive", "duration", "experience includes",
      "sessions", "framework", "selected works", "projects", "editorial"
    ])
  );
  return cleanSentenceFragment(preferred || sentences[0] || text);
}

function lowerFirst(text) {
  const clean = cleanSentenceFragment(text);
  if (!clean) return "";
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}