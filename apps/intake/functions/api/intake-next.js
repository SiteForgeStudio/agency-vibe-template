// functions/api/intake-next.js

/**
 * SiteForge Factory — Paid Intake Next
 *
 * ROLE PER MANIFEST:
 * - Core verification + refinement engine
 * - One key per turn
 * - Scoped mutations only
 * - Recompute verification queue every turn
 * - Navigation is not an answer
 * - Premium refinement belongs here, not in intake-complete
 *
 * DESIGN GOAL:
 * Turn "technically present but weak" intake state into stronger,
 * premium-intent, build-ready state without hardcoding industries
 * or mutating unrelated state.
 */

const SCHEMA_VIBES = [
  "Midnight Tech",
  "Zenith Earth",
  "Vintage Boutique",
  "Rugged Industrial",
  "Modern Minimal",
  "Luxury Noir",
  "Legacy Professional",
  "Solar Flare"
];

const QUESTION_MAP = {
  why_now:
    "What made now the right time to invest in this website?",
  desired_outcome:
    "What should this website help your business accomplish over the next 6 to 12 months?",
  target_audience:
    "Who is the ideal client you most want this site to attract?",
  offerings:
    "What are the main services, products, or offers you want featured first?",
  buyer_decision_factors:
    "When the right customer chooses you, what usually makes them say yes?",
  common_objections:
    "What concerns or hesitations do customers usually have before hiring or buying?",
  primary_conversion_goal:
    "What is the main action you want visitors to take first: call, request a quote, submit an inquiry, buy, or book online?",
  booking_method:
    "How should people take that next step: phone, contact form, checkout, or an online booking link?",
  phone:
    "What phone number should the site use?",
  booking_url:
    "What booking, checkout, or scheduling link should the site send people to?",
  office_address:
    "What business address or meeting location should appear on the site?",
  service_area:
    "What city, region, or service area should the site emphasize?",
  differentiators:
    "What makes your business feel meaningfully better than cheaper, more generic, or less specialized alternatives?",
  trust_signals:
    "What proof helps people trust you quickly — reviews, years of experience, results, certifications, credentials, client logos, media mentions, referrals, or something else?",
  credibility_factors:
    "What credibility details should support that trust — certifications, specialties, years in business, reputation, case studies, or similar proof?",
  tone_preferences:
    "How should the brand feel in public — refined and premium, approachable and friendly, technical and authoritative, bold and modern, or something else?",
  visual_direction:
    "What should the site feel like visually — minimal, warm, editorial, luxurious, technical, bold, clean, modern, or something more specific?",
  process_notes:
    "What are the main steps from first contact to completed work, delivery, booking, or purchase?",
  pricing_context:
    "How should pricing be framed — premium, tailored, investment-focused, straightforward, value-focused, bespoke, or something else?",
  experience_years:
    "How many years of experience should the site reference?",
  testimonials:
    "Do you already have any real testimonial quotes or review language we can use?",
  tagline_refinement:
    "In one sentence, how should the business be positioned so it feels premium and clear?",
  hero_refinement:
    "What should the hero immediately communicate beyond the offer itself — authority, clarity, trust, premium quality, speed, specialization, ease, or something else?",
  faq_refinement:
    "What are the most important questions or objections the site should answer clearly?"
};

const PREMIUM_REFINEMENT_KEYS = [
  "buyer_decision_factors",
  "differentiators",
  "trust_signals",
  "visual_direction",
  "pricing_context",
  "tagline_refinement",
  "hero_refinement",
  "faq_refinement"
];

const REQUIRED_KEYS = [
  "target_audience",
  "offerings",
  "buyer_decision_factors",
  "primary_conversion_goal",
  "booking_method",
  "service_area",
  "differentiators",
  "trust_signals"
];

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);

    const state = normalizeState(body.state || {});
    const answer = cleanString(
      body.answer ||
      body.message ||
      body.user_message ||
      body.latest_user_message
    );

    const uiAction = cleanString(body.ui_action || body.action || "");
    const isNavigationOnly = isNavigationAction(uiAction) && !answer;

    if (!state.session_id) {
      state.session_id = makeId();
    }

    if (!state.phase) {
      state.phase = "guided_enrichment";
    }

    if (!state.verification) {
      state.verification = {};
    }

    const strategyContract = getStrategyContract(state);
    const currentKey =
      cleanString(body.current_key) ||
      cleanString(state.verification.current_key) ||
      "";

    let answeredKey = "";
    let nextState = structuredClone(state);

    if (!isNavigationOnly && answer && currentKey) {
      const before = structuredClone(nextState);
      nextState = applyScopedAnswer(nextState, currentKey, answer, strategyContract);
      answeredKey = currentKey;

      nextState.conversation.push({
        id: makeId(),
        role: "user",
        type: "answer",
        content: answer,
        meta: { key: currentKey }
      });

      nextState.conversation.push({
        id: makeId(),
        role: "system",
        type: "mutation",
        content: `Applied scoped update for ${currentKey}`,
        meta: {
          key: currentKey,
          changed_paths: diffChangedPaths(before, nextState).slice(0, 20)
        }
      });
    } else if (!isNavigationOnly && answer && !currentKey) {
      nextState.conversation.push({
        id: makeId(),
        role: "user",
        type: "answer",
        content: answer,
        meta: { key: "" }
      });
    }

    nextState = recomputeDerivedState(nextState, strategyContract, {
      lastAnsweredKey: answeredKey,
      uiAction
    });

    const nextQuestion = buildQuestionPayload(nextState);
    nextState.verification.current_key = cleanString(nextQuestion.key);

    nextState.conversation.push({
      id: makeId(),
      role: "assistant",
      type: "question",
      content: nextQuestion.message,
      meta: {
        key: nextQuestion.key,
        stage: nextQuestion.stage,
        queue_remaining: Array.isArray(nextState.verification.queue)
          ? nextState.verification.queue.length
          : 0
      }
    });

    return json({
      ok: true,
      action: nextState.readiness.can_generate_now ? "complete" : "continue",
      phase: nextState.phase,
      message: nextQuestion.message,
      question_key: nextQuestion.key,
      question_stage: nextQuestion.stage,
      verification: nextState.verification,
      readiness: nextState.readiness,
      summary_panel: buildSummaryPanel(nextState, strategyContract),
      state: nextState
    });
  } catch (err) {
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
    endpoint: "intake-next",
    method: "POST"
  });
}

/* =========================
   Core Engine
========================= */

function recomputeDerivedState(state, strategyContract, meta = {}) {
  const next = normalizeState(state);

  next.ghostwritten = buildGhostwritten(next, strategyContract);
  next.inference = buildInference(next, strategyContract);
  next.verification = buildVerification(next, strategyContract, meta);
  next.readiness = evaluateReadiness(next);
  next.phase = next.readiness.can_generate_now ? "ready_to_complete" : "guided_enrichment";

  return next;
}

function buildVerification(state, strategyContract, meta = {}) {
  const queue = buildVerificationQueue(state, strategyContract, meta);
  const queueComplete = queue.length === 0;

  return {
    ...(isObject(state.verification) ? state.verification : {}),
    current_key: queueComplete ? "" : queue[0],
    queue,
    queue_complete: queueComplete,
    last_answered_key: cleanString(
      meta.lastAnsweredKey || state.verification?.last_answered_key
    ),
    weak_fields: detectWeakFields(state, strategyContract),
    refinement_mode: queue.some(function(key) {
      return PREMIUM_REFINEMENT_KEYS.includes(key);
    })
  };
}

function buildVerificationQueue(state, strategyContract, meta = {}) {
  const queue = [];
  const seen = new Set();
  const weak = detectWeakFields(state, strategyContract);

  function push(key) {
    if (!key || seen.has(key)) return;
    seen.add(key);
    queue.push(key);
  }

  REQUIRED_KEYS.forEach(function(key) {
    if (isFieldMissing(state, key)) push(key);
  });

  if (!cleanString(state.answers.why_now) && !cleanString(state.answers.desired_outcome)) {
    push("why_now");
  }

  if (!hasContactPath(state)) {
    if (!cleanString(state.answers.booking_method)) {
      push("booking_method");
    } else if (
      state.answers.booking_method === "phone" &&
      !cleanString(state.answers.phone)
    ) {
      push("phone");
    } else if (
      state.answers.booking_method === "external_booking" &&
      !cleanString(state.answers.booking_url)
    ) {
      push("booking_url");
    } else if (
      state.answers.booking_method === "contact_form" &&
      !cleanString(state.clientEmail)
    ) {
      push("phone");
    }
  }

  if (state.answers.process_notes.length < 3) {
    push("process_notes");
  }

  if (!cleanString(state.answers.pricing_context) || weak.includes("pricing_context")) {
    push("pricing_context");
  }

  if (!cleanString(state.answers.visual_direction) || weak.includes("visual_direction")) {
    push("visual_direction");
  }

  if (weak.includes("target_audience")) push("target_audience");
  if (weak.includes("offerings")) push("offerings");
  if (weak.includes("buyer_decision_factors")) push("buyer_decision_factors");
  if (weak.includes("differentiators")) push("differentiators");
  if (weak.includes("trust_signals")) push("trust_signals");
  if (weak.includes("faq_topics")) push("faq_refinement");
  if (weak.includes("ghost_tagline")) push("tagline_refinement");
  if (weak.includes("ghost_hero")) push("hero_refinement");

  if (needsTestimonialClarification(state)) {
    push("testimonials");
  }

  return queue;
}

function buildQuestionPayload(state) {
  if (state.readiness?.can_generate_now) {
    return {
      key: "",
      stage: "complete",
      message:
        "This is now strong enough to generate. The strategy, proof, and premium positioning are in place."
    };
  }

  const key = cleanString(state.verification?.current_key);
  const weakFields = Array.isArray(state.verification?.weak_fields)
    ? state.verification.weak_fields
    : [];

  const stage =
    PREMIUM_REFINEMENT_KEYS.includes(key) || weakFields.includes(key)
      ? "refinement"
      : "verification";

  return {
    key,
    stage,
    message:
      QUESTION_MAP[key] ||
      "What is the most important thing we should clarify next so the site feels strong, premium, and specific?"
  };
}

function evaluateReadiness(state) {
  const missing = [];

  const hasWhyNow = Boolean(
    cleanString(state.answers.why_now) || cleanString(state.answers.desired_outcome)
  );
  const hasAudience = Boolean(cleanString(state.answers.target_audience));
  const hasOffer = state.answers.offerings.length > 0;
  const hasPrimaryCta = Boolean(cleanString(state.answers.primary_conversion_goal));
  const hasBuyerIntel =
    state.answers.buyer_decision_factors.length > 0 ||
    state.answers.common_objections.length > 0;
  const hasTrust =
    state.answers.differentiators.length > 0 ||
    state.answers.trust_signals.length > 0 ||
    state.answers.credibility_factors.length > 0;
  const queueComplete = state.verification?.queue_complete === true;
  const contactPath = hasContactPath(state);

  if (!hasWhyNow) missing.push("business_purpose");
  if (!hasAudience) missing.push("target_audience");
  if (!hasOffer) missing.push("primary_offer");
  if (!hasPrimaryCta) missing.push("cta_direction");
  if (!contactPath) missing.push("contact_path");
  if (!hasBuyerIntel) missing.push("buyer_intelligence");
  if (!hasTrust) missing.push("trust_signals");
  if (!queueComplete) missing.push("verification_queue");

  const weak = detectWeakFields(state, getStrategyContract(state));
  if (weak.includes("ghost_tagline")) missing.push("premium_tagline");
  if (weak.includes("ghost_hero")) missing.push("premium_hero");
  if (weak.includes("faq_topics")) missing.push("faq_quality");

  const scoreParts = [
    hasWhyNow,
    hasAudience,
    hasOffer,
    hasPrimaryCta,
    contactPath,
    hasBuyerIntel,
    hasTrust,
    queueComplete,
    !weak.includes("ghost_tagline"),
    !weak.includes("ghost_hero")
  ];

  const score = scoreParts.filter(Boolean).length / scoreParts.length;

  return {
    score,
    required_domains_complete: missing.length === 0,
    missing_domains: missing,
    can_generate_now:
      hasWhyNow &&
      hasAudience &&
      hasOffer &&
      hasPrimaryCta &&
      contactPath &&
      hasBuyerIntel &&
      hasTrust &&
      queueComplete &&
      !weak.includes("ghost_tagline") &&
      !weak.includes("ghost_hero")
  };
}

/* =========================
   Answer Interpretation
========================= */

function applyScopedAnswer(state, key, answer, strategyContract) {
  const next = structuredClone(state);
  const text = cleanString(answer);

  switch (key) {
    case "why_now":
      if (!next.answers.why_now) {
        next.answers.why_now = cleanSentenceFragment(text);
      } else {
        next.answers.desired_outcome = cleanSentenceFragment(text);
      }
      break;

    case "desired_outcome":
      next.answers.desired_outcome = cleanSentenceFragment(text);
      break;

    case "target_audience":
      next.answers.target_audience = cleanSentenceFragment(text);
      break;

    case "offerings":
      next.answers.offerings = uniqueList(splitListLike(text)).slice(0, 6);
      break;

    case "buyer_decision_factors":
      next.answers.buyer_decision_factors = uniqueList(splitListLike(text)).slice(0, 6);
      break;

    case "common_objections":
      next.answers.common_objections = uniqueList(splitListLike(text)).slice(0, 6);
      break;

    case "primary_conversion_goal":
      next.answers.primary_conversion_goal = normalizePrimaryConversionGoal(text);
      break;

    case "booking_method":
      next.answers.booking_method = normalizeBookingMethod(text);
      break;

    case "phone":
      next.answers.phone = cleanSentenceFragment(text);
      break;

    case "booking_url":
      next.answers.booking_url = cleanSentenceFragment(text);
      break;

    case "office_address":
      next.answers.office_address = cleanSentenceFragment(text);
      break;

    case "service_area":
      next.answers.service_area = cleanSentenceFragment(text);
      if (!next.answers.location_context) {
        next.answers.location_context = cleanSentenceFragment(text);
      }
      break;

    case "differentiators":
      next.answers.differentiators = uniqueList(splitListLike(text)).slice(0, 6);
      break;

    case "trust_signals":
      next.answers.trust_signals = uniqueList(splitListLike(text)).slice(0, 6);
      break;

    case "credibility_factors":
      next.answers.credibility_factors = uniqueList(splitListLike(text)).slice(0, 6);
      break;

    case "tone_preferences":
      next.answers.tone_preferences = cleanSentenceFragment(text);
      break;

    case "visual_direction":
      next.answers.visual_direction = cleanSentenceFragment(text);
      break;

    case "process_notes":
      next.answers.process_notes = uniqueList(splitProcessSteps(text)).slice(0, 8);
      break;

    case "pricing_context":
      next.answers.pricing_context = cleanSentenceFragment(text);
      break;

    case "experience_years":
      next.answers.experience_years = normalizeExperienceYears(text);
      break;

    case "testimonials": {
      const lower = cleanString(text).toLowerCase();
      if (
        lower.includes("do not invent") ||
        lower.includes("don't invent") ||
        lower.includes("keep testimonials empty") ||
        lower.includes("leave testimonials empty") ||
        lower.includes("no testimonials") ||
        lower.includes("none until real")
      ) {
        next.answers.testimonials = [];
        next.answers.testimonials_policy = "none_until_real";
      } else {
        next.answers.testimonials = normalizeTestimonialsAnswer(text);
        next.answers.testimonials_policy =
          next.answers.testimonials.length > 0 ? "provided" : "";
      }
      break;
    }

    case "tagline_refinement":
      next.answers.tagline = cleanSentenceFragment(text);
      break;

    case "hero_refinement":
      next.answers.hero_headline = cleanSentenceFragment(text);
      break;

    case "faq_refinement":
      next.answers.faq_topics = uniqueList(splitListLike(text)).slice(0, 8);
      break;

    default:
      break;
  }

  return next;
}

/* =========================
   Ghostwriting / Premium Refinement
========================= */

function buildGhostwritten(state, strategyContract) {
  const next = {
    ...(isObject(state.ghostwritten) ? state.ghostwritten : {})
  };

  next.tagline = buildPremiumTagline(state, strategyContract);
  next.hero_headline = buildPremiumHeroHeadline(state, strategyContract);
  next.hero_subheadline = buildPremiumHeroSubheadline(state, strategyContract);
  next.hero_image_alt = buildHeroImageAlt(state, strategyContract);
  next.about_summary = buildAboutSummary(state, strategyContract);
  next.founder_note = buildFounderNote(state, strategyContract);
  next.contact_subheadline = buildContactSubheadline(state, strategyContract);
  next.features_copy = buildPremiumFeatures(state, strategyContract);
  next.faqs = buildPremiumFaqs(state, strategyContract);
  next.testimonials = buildSafeTestimonials(state);

  return next;
}

function buildPremiumTagline(state, strategyContract) {
  const explicit = sanitizePublicCopy(cleanString(state.answers.tagline));
  if (isStrongMarketingLine(explicit)) return explicit;

  const offer = firstListItem(state.answers.offerings);
  const audience = cleanString(state.answers.target_audience);
  const diff = firstListItem(state.answers.differentiators);

  if (offer && diff) {
    return cleanHeadline(
      `${toPremiumOfferPhrase(offer)} with ${toPremiumBenefitPhrase(diff).toLowerCase()}`
    );
  }

  if (offer && audience) {
    return cleanHeadline(
      `${toPremiumOfferPhrase(offer)} for ${toPremiumAudiencePhrase(audience).toLowerCase()}`
    );
  }

  if (offer) {
    return cleanHeadline(`${toPremiumOfferPhrase(offer)} with a polished client experience`);
  }

  return cleanHeadline(
    cleanString(strategyContract?.positioning?.brand_promise) ||
      cleanString(state.businessName)
  );
}

function buildPremiumHeroHeadline(state, strategyContract) {
  const explicit = sanitizePublicCopy(cleanString(state.answers.hero_headline));
  if (isStrongHeroHeadline(explicit)) return cleanHeadline(explicit);

  const offer = firstListItem(state.answers.offerings);
  const audience = cleanString(state.answers.target_audience);
  const diff = firstListItem(state.answers.differentiators);
  const area = compactArea(cleanString(state.answers.service_area));

  if (offer && diff) {
    return cleanHeadline(
      `${toPremiumOfferPhrase(offer)} with ${compactHeroBenefit(diff).toLowerCase()}`
    );
  }

  if (offer && audience) {
    return cleanHeadline(
      `${toPremiumOfferPhrase(offer)} for ${compactAudienceLabel(audience).toLowerCase()}`
    );
  }

  if (offer && area) {
    return cleanHeadline(`${toPremiumOfferPhrase(offer)} in ${area}`);
  }

  if (offer) {
    return cleanHeadline(`${toPremiumOfferPhrase(offer)} with premium professional care`);
  }

  return cleanHeadline(cleanString(state.businessName) || "Premium service, clearly positioned");
}

function buildPremiumHeroSubheadline(state, strategyContract) {
  const explicit = sanitizePublicCopy(cleanString(state.answers.hero_subheadline));
  if (wordCount(explicit) >= 10) return cleanMarketingSentence(explicit);

  const audience = cleanString(state.answers.target_audience);
  const diff = firstListItem(state.answers.differentiators);
  const trust =
    firstListItem(state.answers.trust_signals) ||
    firstListItem(state.answers.credibility_factors);
  const booking = normalizeBookingMethod(state.answers.booking_method);
  const primary = normalizePrimaryConversionGoal(state.answers.primary_conversion_goal);

  const line1 = audience
    ? `Built for ${toPremiumAudiencePhrase(audience).toLowerCase()}`
    : diff
    ? `Built for clients who value ${compactHeroBenefit(diff).toLowerCase()}`
    : "Built for clients who expect a higher level of quality, clarity, and execution";

  let line2 = "";
  if (diff) {
    line2 = `${toPremiumBenefitSentence(diff)}.`;
  } else if (trust) {
    line2 = `${toPremiumTrustSentence(trust)}.`;
  } else if (booking === "phone" || primary === "call_now") {
    line2 = "Call today to talk through the best next step.";
  } else if (booking === "external_booking" || primary === "book_now") {
    line2 = "Use the booking link to choose the right next step.";
  } else {
    line2 = "Reach out and we’ll help you choose the right next step.";
  }

  return `${cleanMarketingSentence(line1)} ${cleanMarketingSentence(line2)}`;
}

function buildHeroImageAlt(state, strategyContract) {
  const offer = firstListItem(state.answers.offerings);
  const audience = cleanString(state.answers.target_audience);

  return cleanSentenceFragment(
    [
      offer || cleanString(strategyContract?.business_context?.category),
      audience ? `for ${compactAudienceLabel(audience).toLowerCase()}` : ""
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function buildAboutSummary(state, strategyContract) {
  const explicit = sanitizePublicCopy(cleanString(state.answers.about_story));
  if (wordCount(explicit) >= 18) return cleanMarketingSentence(explicit);

  const businessName = cleanString(state.businessName);
  const offer = firstListItem(state.answers.offerings);
  const audience = cleanString(state.answers.target_audience);
  const diff = firstListItem(state.answers.differentiators);
  const area = compactArea(cleanString(state.answers.service_area));

  const sentence1 = [
    businessName,
    offer
      ? `serves ${audience ? toPremiumAudiencePhrase(audience).toLowerCase() : "clients"} with ${toPremiumOfferPhrase(offer).toLowerCase()}`
      : "is built for clients who expect more from the experience",
    area ? `in ${area}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const sentence2 = diff
    ? `${toFeatureTitle(diff)} is part of what makes the experience feel more polished from the first interaction to the final outcome`
    : "The focus is not only on the final result, but on making the entire experience feel clear, capable, and easy to trust";

  return `${cleanMarketingSentence(sentence1)} ${cleanMarketingSentence(sentence2)}`;
}

function buildFounderNote(state, strategyContract) {
  const explicit = sanitizePublicCopy(cleanString(state.answers.owner_background));
  if (wordCount(explicit) >= 8) return cleanMarketingSentence(explicit);

  const years = normalizeExperienceYears(cleanString(state.answers.experience_years));
  const diff = firstListItem(state.answers.differentiators);
  const trust = firstListItem(state.answers.trust_signals);

  const parts = [];
  if (years) parts.push(years);
  if (diff) parts.push(compactHeroBenefit(diff).toLowerCase());
  if (trust) parts.push(compactTrustLine(trust).toLowerCase());

  return cleanMarketingSentence(
    parts.length
      ? parts.join(" - ")
      : "Built for clients who value quality, clarity, and dependable follow-through"
  );
}

function buildContactSubheadline(state, strategyContract) {
  const booking = normalizeBookingMethod(state.answers.booking_method);
  const primary = normalizePrimaryConversionGoal(state.answers.primary_conversion_goal);

  if (booking === "phone" || primary === "call_now") {
    return "Call today and we’ll help you figure out the right next step.";
  }
  if (booking === "external_booking" || primary === "book_now") {
    return "Ready to move forward? Use the booking link and choose the right next step.";
  }
  if (primary === "buy_now") {
    return "Ready to move forward? Start the next step directly from the site.";
  }
  return "Tell us what you need and we’ll help guide you to the right next step.";
}

function buildPremiumFeatures(state, strategyContract) {
  const diff = cleanList(state.answers.differentiators);
  const buyer = cleanList(state.answers.buyer_decision_factors);
  const offer = cleanList(state.answers.offerings);
  const trust = uniqueList([
    ...cleanList(state.answers.trust_signals),
    ...cleanList(state.answers.credibility_factors)
  ]);

  const items = [];

  diff.slice(0, 3).forEach(function(item) {
    items.push(
      makeFeature(
        toFeatureTitle(item),
        toPremiumBenefitSentence(item),
        pickFeatureIcon(item, items.length)
      )
    );
  });

  if (buyer.length) {
    items.push(
      makeFeature(
        "Why Clients Choose Us",
        cleanSentenceFragment(buyer[0]),
        "star"
      )
    );
  }

  if (offer.length && items.length < 4) {
    items.push(
      makeFeature(
        normalizeOfferTitle(offer[0]),
        "Professional delivery with the level of care, clarity, and follow-through people expect from a premium provider.",
        pickFeatureIcon(offer[0], items.length)
      )
    );
  }

  if (trust.length && items.length < 5) {
    items.push(
      makeFeature(
        "Confidence From the Start",
        `${compactTrustLine(trust[0])} helps people feel comfortable moving forward.`,
        "shield"
      )
    );
  }

  const deduped = uniqueFeatureObjects(items).slice(0, 6);

  while (deduped.length < 3) {
    deduped.push(
      makeFeature(
        `Service Highlight ${deduped.length + 1}`,
        "Clear, professional work designed to make the next step feel easy.",
        pickFeatureIcon("", deduped.length)
      )
    );
  }

  return deduped;
}

function buildPremiumFaqs(state, strategyContract) {
  const topics = uniqueList([
    ...cleanList(state.answers.faq_topics),
    ...cleanList(state.answers.common_objections),
    ...normalizeStringArray(strategyContract?.site_structure?.faq_angles || [])
  ]).slice(0, 6);

  if (!topics.length) return [];

  return topics.map(function(topic) {
    const question = ensureQuestion(normalizeFaqQuestion(topic));
    return {
      question,
      answer: inferPremiumFaqAnswer(question, state, strategyContract)
    };
  });
}

function inferPremiumFaqAnswer(question, state, strategyContract) {
  const lower = cleanString(question).toLowerCase();
  const serviceArea = cleanString(state.answers.service_area);
  const booking = normalizeBookingMethod(state.answers.booking_method);
  const pricing = cleanString(state.answers.pricing_context);
  const trust =
    firstListItem(state.answers.trust_signals) ||
    firstListItem(state.answers.credibility_factors);
  const process = cleanList(state.answers.process_notes);
  const diff = firstListItem(state.answers.differentiators);

  if (lower.includes("price") || lower.includes("cost") || lower.includes("investment")) {
    if (pricing) return cleanMarketingSentence(pricing);
    return "Pricing depends on scope, complexity, and the level of work required to do it properly.";
  }

  if (lower.includes("trust") || lower.includes("experience") || lower.includes("qualified")) {
    if (trust) {
      return cleanMarketingSentence(
        `${compactTrustLine(trust)} helps clients feel comfortable moving forward`
      );
    }
    return "People usually look for clear communication, dependable follow-through, and confidence that the work will be handled professionally from start to finish.";
  }

  if (lower.includes("schedule") || lower.includes("book") || lower.includes("buy")) {
    if (booking === "external_booking") {
      return "Use the booking link on the site to choose the best next step.";
    }
    if (booking === "phone") {
      return "Call directly and we’ll help you schedule the right next step.";
    }
    if (booking === "contact_form") {
      return "Reach out through the contact form and we’ll guide you from there.";
    }
    return "The site is designed to make the next step clear and easy.";
  }

  if (lower.includes("area") || lower.includes("location") || lower.includes("serve")) {
    return serviceArea
      ? `We primarily serve ${serviceArea}. Reach out if you want to confirm your specific location.`
      : "Reach out to confirm availability in your area.";
  }

  if (lower.includes("process") || lower.includes("work") || lower.includes("what happens")) {
    if (process.length >= 3) {
      return cleanMarketingSentence(
        `The process is straightforward: ${process.slice(0, 4).join(", then ")}.`
      );
    }
    return "We keep the process clear from first contact through final follow-through, so you know what to expect at each step.";
  }

  if (diff) {
    return cleanMarketingSentence(toPremiumBenefitSentence(diff));
  }

  return "We keep the experience clear, professional, and easy to move forward with from the first conversation.";
}

function buildSafeTestimonials(state) {
  if (shouldForceEmptyTestimonials(state)) return [];

  const provided = normalizeTestimonialsArray(state.answers.testimonials);
  if (!hasRealTestimonialsPolicy(state) && provided.length === 0) return [];

  return provided.slice(0, 3);
}

/* =========================
   Inference / Quality Detection
========================= */

function buildInference(state, strategyContract) {
  const weakFields = detectWeakFields(state, strategyContract);
  const heroImageQuery = buildHeroImageQuery(state, strategyContract);

  return {
    ...(isObject(state.inference) ? state.inference : {}),
    suggested_vibe: resolveSchemaVibe(
      cleanString(state.answers.visual_direction) ||
        cleanString(strategyContract?.visual_strategy?.recommended_vibe)
    ),
    suggested_components: normalizeStringArray(
      strategyContract?.site_structure?.recommended_sections || []
    ),
    tone_direction:
      cleanString(state.answers.tone_preferences) ||
      cleanString(strategyContract?.positioning?.tone_direction) ||
      "confident, clear, premium",
    visual_direction:
      cleanString(state.answers.visual_direction) ||
      cleanString(strategyContract?.visual_strategy?.visual_direction) ||
      "",
    hero_image_query: heroImageQuery,
    missing_information: buildMissingInformation(state),
    confidence_score: inferConfidenceScore(state, weakFields),
    weak_fields: weakFields
  };
}

function detectWeakFields(state, strategyContract) {
  const weak = [];

  if (looksGenericAudience(state.answers.target_audience)) weak.push("target_audience");
  if (looksWeakOfferings(state.answers.offerings)) weak.push("offerings");
  if (looksWeakList(state.answers.buyer_decision_factors)) weak.push("buyer_decision_factors");
  if (looksWeakList(state.answers.differentiators)) weak.push("differentiators");
  if (
    looksWeakList(state.answers.trust_signals) &&
    looksWeakList(state.answers.credibility_factors)
  ) {
    weak.push("trust_signals");
  }
  if (looksWeakVisualDirection(state.answers.visual_direction)) weak.push("visual_direction");
  if (looksWeakPricingContext(state.answers.pricing_context)) weak.push("pricing_context");
  if (looksWeakFaqTopics(state.answers.faq_topics, state.answers.common_objections)) {
    weak.push("faq_topics");
  }
  if (!isStrongMarketingLine(buildPremiumTagline(state, strategyContract))) {
    weak.push("ghost_tagline");
  }
  if (!isStrongHeroHeadline(buildPremiumHeroHeadline(state, strategyContract))) {
    weak.push("ghost_hero");
  }

  return weak;
}

function buildMissingInformation(state) {
  const missing = [];
  REQUIRED_KEYS.forEach(function(key) {
    if (isFieldMissing(state, key)) missing.push(key);
  });
  if (!hasContactPath(state)) missing.push("contact_path");
  return missing;
}

function inferConfidenceScore(state, weakFields) {
  const positives = [
    Boolean(cleanString(state.answers.target_audience)),
    state.answers.offerings.length > 0,
    state.answers.buyer_decision_factors.length > 0 ||
      state.answers.common_objections.length > 0,
    state.answers.differentiators.length > 0 ||
      state.answers.trust_signals.length > 0,
    Boolean(cleanString(state.answers.visual_direction)),
    state.answers.process_notes.length >= 3,
    hasContactPath(state)
  ].filter(Boolean).length;

  const total = 7;
  const base = positives / total;
  const penalty = Math.min(0.35, weakFields.length * 0.05);

  return clampNumber(base - penalty, 0, 1);
}

/* =========================
   Summary Panel
========================= */

function buildSummaryPanel(state, strategyContract) {
  return {
    business_name: cleanString(state.businessName),
    target_audience: cleanString(state.answers.target_audience),
    offerings: cleanList(state.answers.offerings),
    differentiators: cleanList(state.answers.differentiators),
    trust_signals: uniqueList([
      ...cleanList(state.answers.trust_signals),
      ...cleanList(state.answers.credibility_factors)
    ]),
    buyer_decision_factors: cleanList(state.answers.buyer_decision_factors),
    common_objections: cleanList(state.answers.common_objections),
    booking_method: cleanString(state.answers.booking_method),
    phone: cleanString(state.answers.phone),
    booking_url: cleanString(state.answers.booking_url),
    service_area: cleanString(state.answers.service_area),
    visual_direction: cleanString(state.answers.visual_direction),
    premium_preview: {
      tagline: cleanString(state.ghostwritten?.tagline),
      hero_headline: cleanString(state.ghostwritten?.hero_headline),
      hero_subheadline: cleanString(state.ghostwritten?.hero_subheadline),
      hero_image_query: cleanString(state.inference?.hero_image_query)
    },
    queue_remaining: Array.isArray(state.verification?.queue)
      ? state.verification.queue
      : [],
    weak_fields: Array.isArray(state.verification?.weak_fields)
      ? state.verification.weak_fields
      : [],
    readiness: state.readiness || {}
  };
}

/* =========================
   Readiness Helpers
========================= */

function isFieldMissing(state, key) {
  switch (key) {
    case "target_audience":
      return !cleanString(state.answers.target_audience);
    case "offerings":
      return state.answers.offerings.length === 0;
    case "buyer_decision_factors":
      return (
        state.answers.buyer_decision_factors.length === 0 &&
        state.answers.common_objections.length === 0
      );
    case "primary_conversion_goal":
      return !cleanString(state.answers.primary_conversion_goal);
    case "booking_method":
      return !cleanString(state.answers.booking_method);
    case "service_area":
      return !cleanString(state.answers.service_area);
    case "differentiators":
      return state.answers.differentiators.length === 0;
    case "trust_signals":
      return (
        state.answers.trust_signals.length === 0 &&
        state.answers.credibility_factors.length === 0
      );
    default:
      return false;
  }
}

function hasContactPath(state) {
  const bookingMethod = normalizeBookingMethod(state.answers.booking_method);
  if (cleanString(state.clientEmail)) return true;
  if (bookingMethod === "phone" && cleanString(state.answers.phone)) return true;
  if (bookingMethod === "external_booking" && cleanString(state.answers.booking_url)) return true;
  if (bookingMethod === "contact_form" && cleanString(state.clientEmail)) return true;
  if (!bookingMethod && (cleanString(state.answers.phone) || cleanString(state.answers.booking_url))) {
    return true;
  }
  return false;
}

function needsTestimonialClarification(state) {
  if (shouldForceEmptyTestimonials(state)) return false;
  const provided = normalizeTestimonialsArray(state.answers.testimonials);
  return provided.length === 0;
}

/* =========================
   Premium / Weakness Heuristics
========================= */

function looksGenericAudience(value) {
  const v = cleanString(value).toLowerCase();
  if (!v) return true;

  const generic = [
    "everyone",
    "anyone",
    "people",
    "customers",
    "clients",
    "businesses",
    "brands",
    "homeowners",
    "companies",
    "organizations"
  ];

  return (
    generic.includes(v) ||
    generic.some(function(token) { return v === token; }) ||
    wordCount(v) < 4
  );
}

function looksWeakOfferings(items) {
  if (!Array.isArray(items) || items.length === 0) return true;
  const joined = items.join(" ").toLowerCase();
  return wordCount(joined) < 4 || /\bservices?\b/.test(joined);
}

function looksWeakList(items) {
  if (!Array.isArray(items) || items.length === 0) return true;
  const joined = items.join(" ").toLowerCase();
  const bad = [
    "quality",
    "good service",
    "professional",
    "trustworthy",
    "availability",
    "communication",
    "experience",
    "results"
  ];
  return (
    wordCount(joined) < 5 ||
    bad.includes(joined) ||
    items.every(function(item) {
      return wordCount(item) <= 3;
    })
  );
}

function looksWeakVisualDirection(value) {
  const v = cleanString(value).toLowerCase();
  if (!v) return true;
  return ["modern", "clean", "professional", "nice", "premium"].includes(v) || wordCount(v) < 3;
}

function looksWeakPricingContext(value) {
  const v = cleanString(value).toLowerCase();
  if (!v) return true;
  return wordCount(v) < 4;
}

function looksWeakFaqTopics(faqTopics, objections) {
  const all = uniqueList([...(faqTopics || []), ...(objections || [])]);
  if (!all.length) return true;
  return all.every(function(item) {
    return wordCount(item) <= 3;
  });
}

function isStrongMarketingLine(value) {
  const v = cleanString(value);
  return wordCount(v) >= 6 && wordCount(v) <= 18 && !/[.?!]{2,}/.test(v);
}

function isStrongHeroHeadline(value) {
  const v = cleanString(value);
  return wordCount(v) >= 4 && wordCount(v) <= 14 && !/\bspecializing in\b/i.test(v);
}

/* =========================
   Universal Premium Transformation
========================= */

function sanitizePublicCopy(text) {
  let value = cleanSentenceFragment(text);

  const bannedPatterns = [
    /\btrust signals?\b/gi,
    /\bbuyer decision factors?\b/gi,
    /\bpeople actively looking\b/gi,
    /\bprovider they can trust\b/gi,
    /\bwe stand out through\b/gi,
    /\bthe process is designed to\b/gi,
    /\bwe aim to\b/gi,
    /\bclear, helpful, and easy to understand\b/gi,
    /\bmeaningfully better\b/gi,
    /\bmore generic alternatives?\b/gi
  ];

  bannedPatterns.forEach(function(pattern) {
    value = value.replace(pattern, "");
  });

  return value.replace(/\s{2,}/g, " ").trim();
}

function cleanMarketingSentence(text) {
  return cleanSentence(sanitizePublicCopy(text));
}

function firstListItem(arr) {
  return Array.isArray(arr) && arr.length ? cleanSentenceFragment(arr[0]) : "";
}

function hasRealTestimonialsPolicy(state) {
  return cleanString(state.answers.testimonials_policy) === "provided";
}

function shouldForceEmptyTestimonials(state) {
  return cleanString(state.answers.testimonials_policy) === "none_until_real";
}

function makeFeature(title, description, icon_slug) {
  return {
    title: cleanHeadline(title),
    description: cleanMarketingSentence(description),
    icon_slug: icon_slug || "sparkles"
  };
}

function compactArea(area) {
  const value = cleanSentenceFragment(area);
  if (!value) return "";
  if (wordCount(value) <= 8) return value;
  return value.split(",")[0];
}

function compactAudienceLabel(audience) {
  const value = cleanSentenceFragment(audience);
  if (!value) return "the right clients";

  if (wordCount(value) <= 5) return value;
  const lowered = value.toLowerCase();

  if (lowered.includes("homeowner")) return "discerning homeowners";
  if (lowered.includes("business")) return "serious businesses";
  if (lowered.includes("team")) return "growing teams";
  if (lowered.includes("brand")) return "growing brands";
  if (lowered.includes("couple")) return "the right clients";
  if (lowered.includes("family")) return "the right families";

  return value.split(" who ")[0];
}

function compactHeroBenefit(text) {
  const lower = cleanString(text).toLowerCase();

  if (lower.includes("careful")) return "careful execution";
  if (lower.includes("communication")) return "clear communication";
  if (lower.includes("polished")) return "polished delivery";
  if (lower.includes("speed")) return "fast turnaround";
  if (lower.includes("clarity")) return "clear expectations";
  if (lower.includes("specialized")) return "specialized expertise";
  if (lower.includes("detail")) return "attention to detail";
  if (lower.includes("strategy")) return "strategic clarity";
  if (lower.includes("trust")) return "trusted execution";

  return cleanSentenceFragment(text);
}

function compactTrustLine(text) {
  const value = cleanSentenceFragment(text);
  if (!value) return "credible proof";
  if (wordCount(value) <= 10) return value;
  return value.split(",")[0];
}

function toPremiumOfferPhrase(input) {
  return cleanSentenceFragment(input)
    .replace(/\bservices?\b/gi, "")
    .replace(/\bsolutions?\b/gi, "")
    .replace(/\bofferings?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toPremiumAudiencePhrase(input) {
  const value = cleanSentenceFragment(input);
  if (!value) return "clients who expect a better experience";

  if (/\bwho\b/i.test(value)) return value;
  return `${value} who want a clear, reliable, and well-handled experience`;
}

function toPremiumBenefitPhrase(input) {
  const lower = cleanString(input).toLowerCase();
  if (!lower) return "clear, dependable execution";

  if (lower.includes("careful")) return "careful, high-standard execution";
  if (lower.includes("communication")) return "clear communication from start to finish";
  if (lower.includes("polished")) return "a more polished overall experience";
  if (lower.includes("detail")) return "attention to detail that people can feel";
  if (lower.includes("strategy")) return "clear strategic thinking";
  if (lower.includes("speed")) return "speed without sacrificing quality";
  if (lower.includes("trust")) return "confidence from the start";
  if (lower.includes("experience")) return "experienced execution";

  return cleanSentenceFragment(input);
}

function toPremiumBenefitSentence(input) {
  const lower = cleanString(input).toLowerCase();
  if (!lower) {
    return "Clear communication, dependable execution, and a better overall experience";
  }

  if (lower.includes("careful") || lower.includes("detail")) {
    return "The work is handled with care, precision, and attention to the details that shape the final result";
  }
  if (lower.includes("communication")) {
    return "You know what is happening, what to expect, and what comes next without unnecessary friction";
  }
  if (lower.includes("polished") || lower.includes("experience")) {
    return "The experience feels more organized, professional, and easy to trust from the first interaction onward";
  }
  if (lower.includes("speed") || lower.includes("fast")) {
    return "Momentum stays high without making the experience feel rushed or careless";
  }
  if (lower.includes("strategy")) {
    return "The work is guided by stronger thinking, not just output for the sake of output";
  }
  if (lower.includes("trust") || lower.includes("reputation")) {
    return "Clients feel more comfortable moving forward because the business feels credible, steady, and well handled";
  }
  if (lower.includes("clarity") || lower.includes("quote") || lower.includes("pricing")) {
    return "Expectations stay clear, which makes the next step easier to understand and easier to say yes to";
  }

  return `${cleanSentenceFragment(input)} helps clients feel more confident in both the process and the result`;
}

function toPremiumTrustSentence(input) {
  const lower = cleanString(input).toLowerCase();
  if (!lower) return "Credibility is visible before the first commitment";

  if (lower.includes("year")) return "Years of experience help signal dependable execution before people commit";
  if (lower.includes("review") || lower.includes("testimonial")) return "Strong client feedback helps reduce hesitation quickly";
  if (lower.includes("result") || lower.includes("case") || lower.includes("before-and-after")) {
    return "Visible proof makes the quality easier to trust before moving forward";
  }
  if (lower.includes("certif") || lower.includes("credential")) {
    return "Credentials help reinforce that the work is being handled professionally";
  }
  if (lower.includes("referral")) {
    return "Referrals reinforce confidence because they come from people who already trust the work";
  }

  return `${cleanSentenceFragment(input)} gives clients confidence before moving forward`;
}

function toFeatureTitle(input) {
  const lower = cleanString(input).toLowerCase();

  if (lower.includes("careful") || lower.includes("detail")) return "Careful, High-Standard Execution";
  if (lower.includes("communication")) return "Clear Communication From Start to Finish";
  if (lower.includes("polished") || lower.includes("experience")) return "A More Polished Overall Experience";
  if (lower.includes("large") || lower.includes("complex") || lower.includes("specialized")) {
    return "Built for More Demanding Work";
  }
  if (lower.includes("strategy")) return "Stronger Strategic Direction";
  if (lower.includes("quote") || lower.includes("pricing") || lower.includes("clarity")) {
    return "Clear Expectations and Next Steps";
  }
  if (lower.includes("speed") || lower.includes("fast")) return "Efficient Without Feeling Rushed";
  if (lower.includes("trust") || lower.includes("reputation")) return "Confidence From the Start";

  return normalizeDifferentiatorTitle(input) || "Professional Delivery";
}

function photographicQuerySeed(text) {
  return cleanSentenceFragment(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(service|services|solution|solutions|provider|company|business)\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildHeroImageQuery(state, strategyContract) {
  const explicit =
    cleanString(state.answers.hero_image_query) ||
    cleanString(state.inference?.hero_image_query);

  if (explicit) return clampWords(photographicQuerySeed(explicit), 4, 8);

  const visual = cleanString(state.answers.visual_direction).toLowerCase();
  const tone = cleanString(state.answers.tone_preferences).toLowerCase();
  const audience = cleanString(state.answers.target_audience).toLowerCase();
  const offer = cleanString(firstListItem(state.answers.offerings)).toLowerCase();

  let styleSeed = "modern editorial brand environment";

  if (visual.includes("luxury") || visual.includes("refined") || tone.includes("premium")) {
    styleSeed = "luxury editorial setting natural light";
  } else if (visual.includes("minimal") || visual.includes("clean")) {
    styleSeed = "clean modern environment daylight";
  } else if (visual.includes("warm")) {
    styleSeed = "warm inviting environment natural light";
  } else if (visual.includes("technical") || tone.includes("authoritative")) {
    styleSeed = "modern professional environment crisp detail";
  } else if (visual.includes("bold")) {
    styleSeed = "bold contemporary setting strong composition";
  }

  let audienceSeed = "";
  if (audience.includes("homeowner")) audienceSeed = "premium residential context";
  if (audience.includes("business") || audience.includes("team")) audienceSeed = "professional business setting";
  if (audience.includes("brand")) audienceSeed = "editorial brand environment";

  let offerSeed = "";
  if (offer) {
    offerSeed = offer
      .replace(/\bservices?\b/g, "")
      .replace(/\bsolutions?\b/g, "")
      .trim();
  }

  return clampWords(`${styleSeed} ${audienceSeed} ${offerSeed}`.trim(), 4, 8);
}

/* =========================
   Parsing / Normalization
========================= */

function normalizePrimaryConversionGoal(value) {
  const lower = cleanString(value).toLowerCase();
  if (!lower) return "";
  if (lower.includes("book")) return "book_now";
  if (lower.includes("call")) return "call_now";
  if (lower.includes("quote")) return "request_quote";
  if (lower.includes("inquir")) return "submit_inquiry";
  if (lower.includes("contact")) return "submit_inquiry";
  if (lower.includes("buy") || lower.includes("checkout") || lower.includes("purchase")) {
    return "buy_now";
  }
  return cleanSentenceFragment(value);
}

function normalizeBookingMethod(value) {
  const lower = cleanString(value).toLowerCase();
  if (!lower) return "";
  if (lower.includes("phone") || lower.includes("call")) return "phone";
  if (
    lower.includes("booking") ||
    lower.includes("calendar") ||
    lower.includes("schedule") ||
    lower.includes("link")
  ) {
    return "external_booking";
  }
  if (lower.includes("checkout") || lower.includes("buy") || lower.includes("purchase")) {
    return "external_booking";
  }
  if (lower.includes("form") || lower.includes("contact")) return "contact_form";
  return cleanSentenceFragment(value);
}

function normalizeExperienceYears(value) {
  const text = cleanString(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return `${text} years of experience`;
  if (/\byear/i.test(text)) return text;
  return text;
}

function splitListLike(text) {
  const raw = cleanString(text);
  if (!raw) return [];

  return raw
    .split(/\n|;|•|\||, and | and |, /gi)
    .map(cleanSentenceFragment)
    .filter(Boolean);
}

function splitProcessSteps(text) {
  const raw = cleanString(text);
  if (!raw) return [];

  return raw
    .split(/\n|->|→|;|\.|, then | then /gi)
    .map(cleanSentenceFragment)
    .filter(function(item) {
      return wordCount(item) >= 2;
    });
}

function normalizeTestimonialsAnswer(text) {
  const raw = cleanString(text);
  const lower = raw.toLowerCase();

  if (!raw) return [];
  if (
    lower.includes("do not invent") ||
    lower.includes("don't invent") ||
    lower.includes("keep testimonials empty") ||
    lower.includes("leave testimonials empty") ||
    lower.includes("no testimonials") ||
    lower.includes("none until real")
  ) {
    return [];
  }

  return raw
    .split(/\n{2,}|;{2,}/g)
    .map(cleanSentenceFragment)
    .filter(function(item) {
      return item && wordCount(item) >= 5;
    })
    .map(function(item, idx) {
      return {
        quote: cleanSentence(item),
        author: `Client ${idx + 1}`
      };
    });
}

function normalizeTestimonialsArray(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map(function(item, idx) {
      if (typeof item === "string") {
        const quote = cleanSentence(item);
        return quote ? { quote, author: `Client ${idx + 1}` } : null;
      }
      if (!isObject(item)) return null;

      const quote = cleanSentence(item.quote || "");
      const author = cleanSentenceFragment(item.author || `Client ${idx + 1}`);
      if (!quote) return null;

      return { quote, author };
    })
    .filter(Boolean);
}

function normalizeOfferTitle(text) {
  return titleCaseSmart(
    cleanSentenceFragment(text)
      .replace(/\bspecializing in\b/gi, "")
      .replace(/\bin\s+[A-Z][^,.]*$/g, "")
  );
}

function normalizeDifferentiatorTitle(text) {
  const lower = cleanString(text).toLowerCase();
  if (!lower) return "";

  if (lower.includes("quality") || lower.includes("detail")) return "Attention to Detail";
  if (lower.includes("schedule") || lower.includes("responsive")) return "Responsive Scheduling";
  if (lower.includes("trust") || lower.includes("reputation")) return "Trusted Reputation";
  if (lower.includes("communication")) return "Clear Communication";
  if (lower.includes("careful")) return "Careful Execution";
  if (lower.includes("quote") || lower.includes("pricing")) return "Clear Expectations";
  if (lower.includes("strategy")) return "Strategic Clarity";

  return normalizeOfferTitle(text);
}

function normalizeTrustbarLabel(text) {
  const lower = cleanString(text).toLowerCase();
  if (!lower) return "";

  if (lower.includes("review")) return "Strong Reviews";
  if (lower.includes("testimonial")) return "Trusted by Clients";
  if (lower.includes("before") || lower.includes("photo") || lower.includes("case")) {
    return "Visible Results";
  }
  if (lower.includes("experience")) return "Experienced Team";
  if (lower.includes("referral")) return "Highly Recommended";
  if (lower.includes("certif") || lower.includes("credential")) return "Credible Expertise";

  return normalizeOfferTitle(text);
}

function normalizeFaqQuestion(text) {
  const value = cleanSentenceFragment(text).toLowerCase();
  if (!value) return "";

  if (value.includes("cost") || value.includes("price")) return "How does pricing work";
  if (value.includes("trust")) return "How do I know I can trust your business";
  if (value.includes("availability")) return "How far in advance should I reach out";
  if (value.includes("process")) return "What does the process look like";
  if (value.includes("area") || value.includes("location")) return "What areas do you serve";
  if (value.includes("time") || value.includes("turnaround")) return "How long does the process usually take";

  return titleCaseSmart(cleanSentenceFragment(text));
}

/* =========================
   Shared Helpers
========================= */

function getStrategyContract(state) {
  return (
    state?.provenance?.strategy_contract ||
    state?.inference?.strategy_contract ||
    null
  );
}

function normalizeState(state) {
  const next = structuredClone(isObject(state) ? state : {});

  next.session_id = cleanString(next.session_id);
  next.phase = cleanString(next.phase) || "guided_enrichment";
  next.businessName = cleanString(next.businessName);
  next.clientEmail = cleanString(next.clientEmail);
  next.slug = cleanString(next.slug);

  next.answers = {
    why_now: "",
    desired_outcome: "",
    primary_conversion_goal: "",
    first_impression_goal: "",
    target_audience: "",
    offerings: [],
    booking_method: "",
    phone: "",
    booking_url: "",
    office_address: "",
    location_context: "",
    service_area: "",
    differentiators: [],
    trust_signals: [],
    credibility_factors: [],
    buyer_decision_factors: [],
    common_objections: [],
    red_flags_to_avoid: [],
    pricing_context: "",
    tone_preferences: "",
    visual_direction: "",
    process_notes: [],
    faq_topics: [],
    experience_years: "",
    owner_background: "",
    hero_headline: "",
    hero_subheadline: "",
    hero_image_alt: "",
    hero_image_query: "",
    tagline: "",
    about_story: "",
    contact_subheadline: "",
    gallery_queries: [],
    gallery_items: [],
    testimonials: [],
    testimonials_policy: "",
    ...(isObject(next.answers) ? next.answers : {})
  };

  next.answers.why_now = cleanString(next.answers.why_now);
  next.answers.desired_outcome = cleanString(next.answers.desired_outcome);
  next.answers.primary_conversion_goal = cleanString(next.answers.primary_conversion_goal);
  next.answers.first_impression_goal = cleanString(next.answers.first_impression_goal);
  next.answers.target_audience = cleanString(next.answers.target_audience);
  next.answers.booking_method = cleanString(next.answers.booking_method);
  next.answers.phone = cleanString(next.answers.phone);
  next.answers.booking_url = cleanString(next.answers.booking_url);
  next.answers.office_address = cleanString(next.answers.office_address);
  next.answers.location_context = cleanString(next.answers.location_context);
  next.answers.service_area = cleanString(next.answers.service_area);
  next.answers.pricing_context = cleanString(next.answers.pricing_context);
  next.answers.tone_preferences = cleanString(next.answers.tone_preferences);
  next.answers.visual_direction = cleanString(next.answers.visual_direction);
  next.answers.experience_years = cleanString(next.answers.experience_years);
  next.answers.owner_background = cleanString(next.answers.owner_background);
  next.answers.hero_headline = cleanString(next.answers.hero_headline);
  next.answers.hero_subheadline = cleanString(next.answers.hero_subheadline);
  next.answers.hero_image_alt = cleanString(next.answers.hero_image_alt);
  next.answers.hero_image_query = cleanString(next.answers.hero_image_query);
  next.answers.tagline = cleanString(next.answers.tagline);
  next.answers.about_story = cleanString(next.answers.about_story);
  next.answers.contact_subheadline = cleanString(next.answers.contact_subheadline);
  next.answers.testimonials_policy = cleanString(next.answers.testimonials_policy);

  next.answers.offerings = cleanList(next.answers.offerings);
  next.answers.differentiators = cleanList(next.answers.differentiators);
  next.answers.trust_signals = cleanList(next.answers.trust_signals);
  next.answers.credibility_factors = cleanList(next.answers.credibility_factors);
  next.answers.buyer_decision_factors = cleanList(next.answers.buyer_decision_factors);
  next.answers.common_objections = cleanList(next.answers.common_objections);
  next.answers.red_flags_to_avoid = cleanList(next.answers.red_flags_to_avoid);
  next.answers.process_notes = cleanList(next.answers.process_notes);
  next.answers.faq_topics = cleanList(next.answers.faq_topics);
  next.answers.gallery_queries = cleanList(next.answers.gallery_queries);

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

  next.ghostwritten.tagline = cleanString(next.ghostwritten.tagline);
  next.ghostwritten.hero_headline = cleanString(next.ghostwritten.hero_headline);
  next.ghostwritten.hero_subheadline = cleanString(next.ghostwritten.hero_subheadline);
  next.ghostwritten.hero_image_alt = cleanString(next.ghostwritten.hero_image_alt);
  next.ghostwritten.about_summary = cleanString(next.ghostwritten.about_summary);
  next.ghostwritten.founder_note = cleanString(next.ghostwritten.founder_note);
  next.ghostwritten.contact_subheadline = cleanString(next.ghostwritten.contact_subheadline);
  next.ghostwritten.features_copy = Array.isArray(next.ghostwritten.features_copy)
    ? next.ghostwritten.features_copy
    : [];
  next.ghostwritten.faqs = Array.isArray(next.ghostwritten.faqs)
    ? next.ghostwritten.faqs
    : [];
  next.ghostwritten.testimonials = Array.isArray(next.ghostwritten.testimonials)
    ? next.ghostwritten.testimonials
    : [];

  next.inference = isObject(next.inference) ? next.inference : {};
  next.provenance = isObject(next.provenance) ? next.provenance : {};
  next.conversation = Array.isArray(next.conversation) ? next.conversation : [];
  next.verification = isObject(next.verification) ? next.verification : {};
  next.readiness = isObject(next.readiness) ? next.readiness : {};

  return next;
}

function isNavigationAction(action) {
  const a = cleanString(action).toLowerCase();
  return ["continue", "next", "back", "skip", "resume", "start", "open"].includes(a);
}

function cleanString(v) {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanSentenceFragment).filter(Boolean);
}

function ensureQuestion(text) {
  const value = cleanSentenceFragment(text).replace(/[?!.]+$/g, "");
  if (!value) return "";
  return `${value}?`;
}

function cleanSentenceFragment(text) {
  return cleanString(text)
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, " - ")
    .replace(/…/g, "...")
    .replace(/\uFFFD/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[|]/g, " ")
    .replace(/[;:]+$/g, "")
    .trim();
}

function cleanSentence(text) {
  const value = cleanSentenceFragment(text).replace(/^[-–—\d.\s]+/, "");
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanSentenceFragment).filter(Boolean);
}

function uniqueList(arr) {
  return Array.from(
    new Set((Array.isArray(arr) ? arr : []).map(cleanSentenceFragment).filter(Boolean))
  );
}

function uniqueFeatureObjects(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(function(item) {
    const key = cleanSentenceFragment(item?.title).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function wordCount(value) {
  return cleanString(value).split(/\s+/).filter(Boolean).length;
}

function titleCaseSmart(text) {
  return cleanSentenceFragment(text)
    .split(/\s+/)
    .filter(Boolean)
    .map(function(word, idx) {
      const lower = word.toLowerCase();
      if (idx > 0 && ["and", "of", "for", "with", "to", "in"].includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function cleanHeadline(value) {
  return cleanSentenceFragment(value)
    .replace(/\.$/, "")
    .replace(/\bin\s+in\b/gi, "in")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clampWords(text, minWords, maxWords) {
  const words = cleanSentenceFragment(text).split(/\s+/).filter(Boolean);
  if (!words.length) return "professional service detail work";

  const sliced = words.slice(0, maxWords);
  while (sliced.length < minWords) {
    sliced.push("detail");
  }
  return sliced.join(" ");
}

function resolveSchemaVibe(input) {
  const value = cleanString(input);
  if (SCHEMA_VIBES.includes(value)) return value;

  const lower = value.toLowerCase();
  if (lower.includes("luxury") || lower.includes("dark")) return "Luxury Noir";
  if (lower.includes("modern") || lower.includes("minimal")) return "Modern Minimal";
  if (lower.includes("solar") || lower.includes("energy")) return "Solar Flare";
  if (lower.includes("tech") || lower.includes("ai")) return "Midnight Tech";
  if (lower.includes("earth") || lower.includes("organic")) return "Zenith Earth";
  if (lower.includes("vintage") || lower.includes("boutique")) return "Vintage Boutique";
  if (lower.includes("industrial") || lower.includes("rugged")) return "Rugged Industrial";
  return "Modern Minimal";
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function diffChangedPaths(before, after, prefix = "") {
  const paths = [];

  if (before === after) return paths;

  if (!isObject(before) || !isObject(after)) {
    if (prefix) paths.push(prefix);
    return paths;
  }

  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  keys.forEach(function(key) {
    const path = prefix ? `${prefix}.${key}` : key;
    const a = before?.[key];
    const b = after?.[key];

    if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) paths.push(path);
      return;
    }

    if (isObject(a) && isObject(b)) {
      paths.push(...diffChangedPaths(a, b, path));
      return;
    }

    if (JSON.stringify(a) !== JSON.stringify(b)) {
      paths.push(path);
    }
  });

  return paths;
}

function pickFeatureIcon(text, idx) {
  const value = cleanString(text).toLowerCase();
  if (value.includes("fast") || value.includes("speed")) return "zap";
  if (value.includes("tech") || value.includes("ai")) return "cpu";
  if (value.includes("launch") || value.includes("growth")) return "rocket";
  if (value.includes("green") || value.includes("eco")) return "leaf";
  if (value.includes("care") || value.includes("support")) return "heart";
  if (value.includes("team") || value.includes("people")) return "users";
  if (value.includes("map") || value.includes("local")) return "map";
  if (value.includes("trust") || value.includes("safe") || value.includes("reputation")) return "shield";
  if (value.includes("quality") || value.includes("award") || value.includes("detail")) return "award";
  if (value.includes("price") || value.includes("value") || value.includes("quote")) return "coins";
  if (value.includes("schedule") || value.includes("availability")) return "clock";
  if (value.includes("phone") || value.includes("call")) return "phone";

  const fallback = ["sparkles", "shield", "star", "check", "briefcase", "award"];
  return fallback[idx % fallback.length];
}

async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
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