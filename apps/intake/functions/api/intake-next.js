// functions/api/intake-next.js
/**
 * intake-next.js
 *
 * SiteForge Factory — Conversational Intake Step
 *
 * Goals:
 * - keep the factory schema stable
 * - make the interviewer feel like a domain expert
 * - merge both state_updates and inference_updates
 * - use a dynamic specialist profile to ask better next questions
 */

import {
  INTAKE_CONTROLLER_SYSTEM_PROMPT,
  INTAKE_CONTROLLER_DEVELOPER_PROMPT,
  buildIntakeControllerUserPrompt,
  EMPTY_INTAKE_STATE
} from "./intake-prompts.js";

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);

    const sessionId = cleanString(body.session_id);
    const answer = cleanString(body.answer);
    const uiAction = cleanString(body.ui_action);
    const baseState = isObject(body.state)
      ? normalizeState(body.state)
      : structuredClone(EMPTY_INTAKE_STATE);

    if (!sessionId) {
      return json({ ok: false, error: "Missing session_id" }, 400);
    }

    if (!answer && !uiAction) {
      return json({ ok: false, error: "Missing answer or ui_action" }, 400);
    }

    const latestUserMessage = answer || uiAction;

    const specialistProfile = await ensureSpecialistProfile(
      context.env,
      baseState,
      latestUserMessage
    );

    const userPrompt = buildControllerPromptWithSpecialistProfile({
      baseState,
      latestUserMessage,
      specialistProfile
    });

    const controllerResponse = await callController(context.env, userPrompt);

    let mergedState = mergeControllerResponse(baseState, controllerResponse);
    mergedState = normalizeState(mergedState);

    mergedState.provenance.specialist_profile = specialistProfile;

    mergedState = applyHeuristicAnswerUpdates(
      mergedState,
      latestUserMessage,
      baseState
    );

    mergedState = seedInferenceFromSpecialistProfile(mergedState, specialistProfile);

    const readiness = evaluateReadiness(mergedState);
    mergedState.readiness = readiness;

    const guidedStep = getGuidedNextStep(mergedState, readiness, specialistProfile);

    const phase =
      guidedStep.phase ||
      controllerResponse.phase ||
      mergedState.phase ||
      "guided_enrichment";

    mergedState.phase = phase;

    const message =
      guidedStep.message ||
      normalizeControllerMessage(controllerResponse.message, phase);

    const action =
      guidedStep.action ||
      normalizeAction(controllerResponse.action, readiness);

    mergedState.conversation = Array.isArray(mergedState.conversation)
      ? mergedState.conversation
      : [];

    mergedState.conversation.push({
      role: "user",
      content: latestUserMessage
    });

    if (message?.content) {
      mergedState.conversation.push({
        role: "assistant",
        content: message.content
      });
    }

    return json({
      ok: true,
      phase,
      message,
      state: mergedState,
      readiness,
      action,
      summary_panel: buildSummaryPanel(mergedState)
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

/* =========================
   OpenAI Calls
========================= */

async function callController(env, userPrompt) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || "gpt-4.1";

  if (!apiKey) {
    throw new Error("Missing env.OPENAI_API_KEY");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + apiKey
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: INTAKE_CONTROLLER_SYSTEM_PROMPT },
        { role: "system", content: INTAKE_CONTROLLER_DEVELOPER_PROMPT },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const jsonRes = await res.json();
  const content = jsonRes.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Controller returned empty response");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Controller returned invalid JSON");
  }
}

async function ensureSpecialistProfile(env, state, latestUserMessage) {
  const existing = normalizeSpecialistProfile(state?.provenance?.specialist_profile);

  if (isUsableSpecialistProfile(existing, state, latestUserMessage)) {
    return existing;
  }

  const generated = await generateSpecialistProfile(env, state, latestUserMessage);

  return normalizeSpecialistProfile(generated);
}

function isUsableSpecialistProfile(profile, state, latestUserMessage) {
  const hasProfile =
    cleanString(profile.business_archetype) ||
    cleanString(profile.category_guess) ||
    cleanString(profile.site_motion);

  if (!hasProfile) return false;

  const currentBusiness = [
    cleanString(state?.businessName),
    cleanString(state?.answers?.target_audience),
    cleanString(state?.answers?.desired_outcome),
    cleanList(state?.answers?.offerings).join(", "),
    cleanString(latestUserMessage)
  ].join(" | ");

  const priorBasis = cleanString(profile.profile_basis);

  if (!priorBasis) return true;

  const overlap = fuzzyOverlap(priorBasis, currentBusiness);
  return overlap >= 0.35;
}

async function generateSpecialistProfile(env, state, latestUserMessage) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return heuristicSpecialistProfile(state, latestUserMessage);
  }

  const prompt = `
You are a website strategist building a live specialist profile for an intake interviewer.

Infer the business lens dynamically from the available information.

Return valid JSON only with this exact top-level shape:

{
  "business_archetype": "",
  "category_guess": "",
  "site_motion": "",
  "conversion_model": "",
  "proof_model": "",
  "questioning_style": "",
  "high_value_unknowns": [],
  "component_candidates": [],
  "expertise_lens": "",
  "profile_basis": ""
}

Rules:
- Do not invent specific facts.
- Be generic but strategically useful.
- category_guess can be broad or specific.
- component_candidates should reflect what a high-performing site in this category needs.
- high_value_unknowns should reflect what the interviewer should uncover next.
- profile_basis should be a compact basis string from the current evidence.

Current state:
${JSON.stringify(state, null, 2)}

Latest user message:
${latestUserMessage}
`.trim();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "Return valid JSON only. Build a specialist website-strategy profile for the current business."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return heuristicSpecialistProfile(state, latestUserMessage);
    }

    return JSON.parse(content);
  } catch {
    return heuristicSpecialistProfile(state, latestUserMessage);
  }
}

function buildControllerPromptWithSpecialistProfile({
  baseState,
  latestUserMessage,
  specialistProfile
}) {
  const basePrompt = buildIntakeControllerUserPrompt({
    phase: baseState.phase || "unknown",
    businessName: baseState.businessName,
    clientEmail: baseState.clientEmail,
    latestUserMessage,
    state: baseState,
    conversation: baseState.conversation || []
  });

  return `
${basePrompt}

Specialist strategist profile:
${JSON.stringify(specialistProfile, null, 2)}

Additional instructions:
- Ask the next question through the lens of this business category.
- Keep mapping answers into the universal schema.
- Prefer domain-relevant wording instead of generic wording.
- Do not turn the interview into a rigid template.
- If the business appears visually driven, portfolio-driven, location-driven, or consultation-driven, reflect that in how you ask.
`.trim();
}

/* =========================
   Specialist Profile
========================= */

function heuristicSpecialistProfile(state, latestUserMessage) {
  const corpus = [
    cleanString(state?.businessName),
    cleanString(state?.answers?.desired_outcome),
    cleanString(state?.answers?.why_now),
    cleanString(state?.answers?.target_audience),
    cleanList(state?.answers?.offerings).join(" "),
    cleanString(latestUserMessage)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let category = "general business";
  let archetype = "service business";
  let siteMotion = "lead generation";
  let conversionModel = "inquiry";
  let proofModel = "trust and clarity";
  let questioningStyle = "practical and tailored";
  let expertiseLens = "website strategist";
  let componentCandidates = [
    "Hero with clear positioning",
    "Offer overview",
    "Trust or proof section",
    "Process or what-to-expect section",
    "FAQ section",
    "Contact or inquiry section"
  ];
  let unknowns = [
    "primary offer emphasis",
    "ideal client fit",
    "proof or credibility angle",
    "preferred conversion path"
  ];

  if (containsAny(corpus, ["photo", "photography", "photographer", "wedding photographer", "portrait"])) {
    category = "photography";
    archetype = "creative service";
    siteMotion = "portfolio plus lead generation";
    conversionModel = "inquiry or session booking";
    proofModel = "style fit and portfolio trust";
    expertiseLens = "photography website strategist";
    componentCandidates = [
      "Hero with style positioning",
      "Featured portfolio",
      "Category galleries",
      "About the photographer",
      "Testimonials or social proof",
      "Session types or services",
      "Process or what to expect",
      "Pricing guide or starting rates",
      "FAQ section",
      "Inquiry section"
    ];
    unknowns = [
      "photography niche",
      "ideal client type",
      "visual style and brand feel",
      "portfolio category to feature first",
      "inquiry versus booking flow",
      "shooting locations or travel area"
    ];
  } else if (containsAny(corpus, ["tour", "charter", "boat", "guide", "excursion", "activity"])) {
    category = "tour or activity";
    archetype = "booking business";
    siteMotion = "trust plus booking";
    conversionModel = "booking";
    proofModel = "experience, safety, and clarity";
    expertiseLens = "tour business website strategist";
    componentCandidates = [
      "Hero with booking CTA",
      "Tour options",
      "What is included",
      "Meeting point or logistics",
      "Safety and trust section",
      "Reviews",
      "FAQ section",
      "Booking section"
    ];
    unknowns = [
      "tour types",
      "ideal guest",
      "booking method",
      "meeting point",
      "seasonality or schedule",
      "proof and safety signals"
    ];
  } else if (containsAny(corpus, ["lawn", "wash", "cleaning", "removal", "plumbing", "roofing", "hvac", "painting", "electric", "landscap"])) {
    category = "local service";
    archetype = "location-based service";
    siteMotion = "lead generation plus trust";
    conversionModel = "call or quote request";
    proofModel = "proof, locality, and responsiveness";
    expertiseLens = "local service website strategist";
    componentCandidates = [
      "Hero with quote CTA",
      "Services overview",
      "Before and after or proof",
      "Trust badges or insurance",
      "Reviews",
      "Service area section",
      "FAQ section",
      "Contact section"
    ];
    unknowns = [
      "service categories",
      "service area",
      "call versus quote flow",
      "proof or trust angle",
      "speed or reliability differentiator"
    ];
  } else if (containsAny(corpus, ["coach", "consultant", "advisor", "fractional", "agency", "strategist"])) {
    category = "consulting or advisory";
    archetype = "expert-led service";
    siteMotion = "authority plus inquiry";
    conversionModel = "consultation booking";
    proofModel = "expertise and outcomes";
    expertiseLens = "consulting website strategist";
    componentCandidates = [
      "Hero with positioning",
      "Who it is for",
      "Services or engagements",
      "Case studies or outcomes",
      "About or expertise",
      "Process",
      "FAQ section",
      "Consultation CTA"
    ];
    unknowns = [
      "ideal client profile",
      "engagement types",
      "authority signals",
      "outcome language",
      "consultation CTA"
    ];
  } else if (containsAny(corpus, ["software", "saas", "app", "platform", "tool"])) {
    category = "software or SaaS";
    archetype = "product-led business";
    siteMotion = "education plus conversion";
    conversionModel = "demo or signup";
    proofModel = "use cases and proof";
    expertiseLens = "SaaS website strategist";
    componentCandidates = [
      "Hero with core value prop",
      "Use cases",
      "Feature overview",
      "Comparison or why switch",
      "Proof or customer logos",
      "FAQ section",
      "Pricing or plans",
      "Signup or demo CTA"
    ];
    unknowns = [
      "core use case",
      "ideal buyer",
      "primary CTA",
      "proof or traction signals",
      "comparison angle"
    ];
  } else if (containsAny(corpus, ["shop", "store", "boutique", "product", "jewelry", "apparel", "fashion"])) {
    category = "product brand or ecommerce";
    archetype = "brand and product business";
    siteMotion = "discovery plus purchase";
    conversionModel = "shop or browse";
    proofModel = "product trust and brand fit";
    expertiseLens = "ecommerce website strategist";
    componentCandidates = [
      "Hero with featured collection",
      "Product categories",
      "Brand story",
      "Best sellers",
      "Reviews",
      "Shipping or returns clarity",
      "FAQ section",
      "Shop CTA"
    ];
    unknowns = [
      "flagship products",
      "ideal buyer",
      "brand feel",
      "purchase friction points",
      "proof and review signals"
    ];
  }

  return normalizeSpecialistProfile({
    business_archetype: archetype,
    category_guess: category,
    site_motion: siteMotion,
    conversion_model: conversionModel,
    proof_model: proofModel,
    questioning_style: questioningStyle,
    high_value_unknowns: unknowns,
    component_candidates: componentCandidates,
    expertise_lens: expertiseLens,
    profile_basis: [
      cleanString(state?.businessName),
      cleanList(state?.answers?.offerings).join(", "),
      cleanString(latestUserMessage)
    ]
      .filter(Boolean)
      .join(" | ")
  });
}

function normalizeSpecialistProfile(profile) {
  const next = isObject(profile) ? structuredClone(profile) : {};

  next.business_archetype = cleanString(next.business_archetype);
  next.category_guess = cleanString(next.category_guess);
  next.site_motion = cleanString(next.site_motion);
  next.conversion_model = cleanString(next.conversion_model);
  next.proof_model = cleanString(next.proof_model);
  next.questioning_style = cleanString(next.questioning_style);
  next.expertise_lens = cleanString(next.expertise_lens);
  next.profile_basis = cleanString(next.profile_basis);
  next.high_value_unknowns = cleanList(next.high_value_unknowns);
  next.component_candidates = cleanList(next.component_candidates);

  return next;
}

function seedInferenceFromSpecialistProfile(state, specialistProfile) {
  const next = structuredClone(state);

  if (!cleanString(next.inference?.suggested_vibe)) {
    const lens = cleanString(specialistProfile?.category_guess).toLowerCase();

    if (lens.includes("photography")) {
      next.inference.suggested_vibe = "Visual, polished, and trust-building";
    } else if (lens.includes("tour")) {
      next.inference.suggested_vibe = "Energetic, experience-led, and confidence-building";
    } else if (lens.includes("local service")) {
      next.inference.suggested_vibe = "Trustworthy, local, and conversion-focused";
    } else if (lens.includes("consult")) {
      next.inference.suggested_vibe = "Credible, expert-led, and clear";
    } else if (lens.includes("software")) {
      next.inference.suggested_vibe = "Modern, clear, and product-led";
    }
  }

  if (
    Array.isArray(next.inference?.suggested_components) &&
    next.inference.suggested_components.length === 0 &&
    Array.isArray(specialistProfile?.component_candidates) &&
    specialistProfile.component_candidates.length
  ) {
    next.inference.suggested_components = specialistProfile.component_candidates.slice(0, 10);
  }

  return next;
}

/* =========================
   State Handling
========================= */

function mergeControllerResponse(existing, controllerResponse) {
  const next = structuredClone(existing);

  if (isObject(controllerResponse?.state_updates)) {
    nextStateMerge(next, controllerResponse.state_updates);
  }

  if (isObject(controllerResponse?.inference_updates)) {
    next.inference = {
      ...(isObject(next.inference) ? next.inference : {}),
      ...controllerResponse.inference_updates
    };
  }

  return next;
}

function nextStateMerge(target, updates) {
  Object.keys(updates).forEach(function(key) {
    const val = updates[key];

    if (isObject(val) && isObject(target[key])) {
      target[key] = { ...target[key], ...val };
    } else {
      target[key] = val;
    }
  });
}

function normalizeState(state) {
  const next = structuredClone(isObject(state) ? state : EMPTY_INTAKE_STATE);

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
    differentiators: [],
    trust_signals: [],
    credibility_factors: [],
    location_context: "",
    service_area: "",
    tone_preferences: "",
    visual_direction: "",
    process_notes: [],
    faq_topics: [],
    pricing_context: "",
    ...(isObject(next.answers) ? next.answers : {})
  };

  next.inference = {
    suggested_vibe: "",
    suggested_components: [],
    tone_direction: "",
    visual_direction: "",
    missing_information: [],
    confidence_score: 0,
    ...(isObject(next.inference) ? next.inference : {})
  };

  next.ghostwritten = {
    tagline: "",
    hero_headline: "",
    hero_subheadline: "",
    about_summary: "",
    features_copy: [],
    faqs: [],
    ...(isObject(next.ghostwritten) ? next.ghostwritten : {})
  };

  next.provenance = isObject(next.provenance) ? next.provenance : {};

  next.answers.offerings = cleanList(next.answers.offerings);
  next.answers.differentiators = cleanList(next.answers.differentiators);
  next.answers.trust_signals = cleanList(next.answers.trust_signals);
  next.answers.credibility_factors = cleanList(next.answers.credibility_factors);
  next.answers.process_notes = cleanList(next.answers.process_notes);
  next.answers.faq_topics = cleanList(next.answers.faq_topics);

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
  next.answers.tone_preferences = cleanString(next.answers.tone_preferences);
  next.answers.visual_direction = cleanString(next.answers.visual_direction);
  next.answers.pricing_context = cleanString(next.answers.pricing_context);

  next.businessName = cleanString(next.businessName);
  next.clientEmail = cleanString(next.clientEmail);
  next.phase = cleanString(next.phase) || "guided_enrichment";
  next.conversation = Array.isArray(next.conversation) ? next.conversation : [];

  next.inference.suggested_vibe = cleanString(next.inference.suggested_vibe);
  next.inference.tone_direction = cleanString(next.inference.tone_direction);
  next.inference.visual_direction = cleanString(next.inference.visual_direction);
  next.inference.suggested_components = cleanList(next.inference.suggested_components);
  next.inference.missing_information = cleanList(next.inference.missing_information);

  return next;
}

function applyHeuristicAnswerUpdates(state, latestUserMessage, priorState) {
  const next = structuredClone(state);
  const text = cleanString(latestUserMessage);
  const lower = text.toLowerCase();
  const priorPhase = cleanString(priorState?.phase || next.phase);
  const expectedField = inferExpectedFieldFromConversation(priorState);

  if (!text) return next;

  const phoneMatch = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  const urlMatch = text.match(/https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9.-]+\.(?:com|net|org|co|io|ai|app|travel|tours|guide|info|biz)(?:\/[^\s]*)?/i);

  if (phoneMatch && !next.answers.phone) {
    next.answers.phone = phoneMatch[0].trim();
  }

  if (urlMatch && !next.answers.booking_url) {
    next.answers.booking_url = normalizeUrl(urlMatch[0]);
  }

  if (expectedField === "business_purpose_or_desired_outcome") {
    if (!next.answers.why_now && !next.answers.desired_outcome) {
      next.answers.desired_outcome = text;
    }
    return next;
  }

  if (expectedField === "target_audience") {
    if (!next.answers.target_audience) {
      next.answers.target_audience = text;
    }
    return next;
  }

  if (expectedField === "primary_offer") {
    if (!next.answers.offerings.length) {
      next.answers.offerings = splitListAnswer(text);
    }
    return next;
  }

  if (expectedField === "cta_direction") {
    if (!next.answers.primary_conversion_goal) {
      next.answers.primary_conversion_goal = normalizeCta(text);
    }
    return next;
  }

  if (expectedField === "booking_method") {
    if (!next.answers.booking_method) {
      next.answers.booking_method = normalizeBookingMethod(text);
    }
    return next;
  }

  if (expectedField === "contact_path") {
    const preference = normalizeContactPreference(text);

    if (preference) {
      next.provenance.contact_path_preference = preference;

      if (preference === "phone") {
        next.answers.booking_method = "phone";
      } else if (preference === "booking_url") {
        next.answers.booking_method = "online_booking";
      } else if (preference === "both") {
        next.answers.booking_method = "phone_and_online_booking";
      }
    }

    if (phoneMatch) {
      next.answers.phone = phoneMatch[0].trim();
    }

    if (urlMatch) {
      next.answers.booking_url = normalizeUrl(urlMatch[0]);
    }

    return next;
  }

  if (expectedField === "phone_number") {
    if (phoneMatch) {
      next.answers.phone = phoneMatch[0].trim();
    }
    return next;
  }

  if (expectedField === "booking_url") {
    if (urlMatch) {
      next.answers.booking_url = normalizeUrl(urlMatch[0]);
    }
    return next;
  }

  if (expectedField === "service_area") {
    if (!next.answers.service_area && !next.answers.office_address) {
      next.answers.service_area = text;
    }
    return next;
  }

  if (expectedField === "trust_or_differentiation") {
    if (!hasTrustSignal(next)) {
      next.answers.differentiators = splitListAnswer(text);
    }
    return next;
  }

  if ((priorPhase === "intent" || priorPhase === "identity") && !next.answers.why_now && !next.answers.desired_outcome) {
    next.answers.desired_outcome = text;
  }

  if (priorPhase === "business_understanding" && !next.answers.target_audience) {
    next.answers.target_audience = text;
  }

  if ((priorPhase === "business_understanding" || priorPhase === "guided_enrichment") && !next.answers.offerings.length && looksLikeOfferAnswer(text)) {
    next.answers.offerings = splitListAnswer(text);
  }

  if (priorPhase === "guided_enrichment" && !next.answers.primary_conversion_goal && looksLikeCtaAnswer(text)) {
    next.answers.primary_conversion_goal = normalizeCta(text);
  }

  if ((priorPhase === "guided_enrichment" || priorPhase === "final_review") && !next.answers.service_area && looksLikeLocationAnswer(text)) {
    next.answers.service_area = text;
  }

  if (priorPhase === "final_review" && !hasTrustSignal(next) && looksLikeTrustAnswer(text)) {
    next.answers.differentiators = splitListAnswer(text);
  }

  return next;
}

/* =========================
   Guided Question Flow
========================= */

function getGuidedNextStep(state, readiness, specialistProfile) {
  const answers = state.answers || {};
  const contactPreference = cleanString(state.provenance?.contact_path_preference);
  const bookingMethod = cleanString(answers.booking_method);

  if (!cleanString(state.businessName)) {
    return {
      action: "probe",
      phase: "identity",
      message: createQuestionMessage(
        "What’s the name of your business?",
        "capture_business_name"
      )
    };
  }

  if (!cleanString(answers.why_now) && !cleanString(answers.desired_outcome)) {
    return {
      action: "probe",
      phase: "intent",
      message: createQuestionMessage(
        buildDomainAwareQuestion("business_purpose_or_desired_outcome", specialistProfile, state),
        "capture_business_purpose",
        [
          { label: "Get more leads", action: "quick_reply" },
          { label: "Make booking easier", action: "quick_reply" },
          { label: "Look more professional", action: "quick_reply" }
        ]
      )
    };
  }

  if (!cleanString(answers.target_audience)) {
    return {
      action: "probe",
      phase: "business_understanding",
      message: createQuestionMessage(
        buildDomainAwareQuestion("target_audience", specialistProfile, state),
        "capture_target_audience"
      )
    };
  }

  if (!answers.offerings.length) {
    return {
      action: "probe",
      phase: "business_understanding",
      message: createQuestionMessage(
        buildDomainAwareQuestion("primary_offer", specialistProfile, state),
        "capture_primary_offer"
      )
    };
  }

  if (!cleanString(answers.primary_conversion_goal)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        buildDomainAwareQuestion("cta_direction", specialistProfile, state),
        "capture_primary_conversion_goal",
        buildCtaQuickReplies(specialistProfile)
      )
    };
  }

  if (!bookingMethod) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        buildDomainAwareQuestion("booking_method", specialistProfile, state),
        "capture_booking_method"
      )
    };
  }

  if (!hasContactPath(state) && !contactPreference) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        buildDomainAwareQuestion("contact_path", specialistProfile, state),
        "capture_contact_path",
        [
          { label: "Phone number", action: "quick_reply" },
          { label: "Booking link", action: "quick_reply" },
          { label: "Both", action: "quick_reply" }
        ]
      )
    };
  }

  if (needsPhoneNumber(state)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        buildDomainAwareQuestion("phone_number", specialistProfile, state),
        "capture_phone_number"
      )
    };
  }

  if (needsBookingUrl(state)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        buildDomainAwareQuestion("booking_url", specialistProfile, state),
        "capture_booking_url"
      )
    };
  }

  if (!hasLocationSignal(state)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        buildDomainAwareQuestion("service_area", specialistProfile, state),
        "capture_service_area"
      )
    };
  }

  if (!hasTrustSignal(state)) {
    return {
      action: "probe",
      phase: "final_review",
      message: createQuestionMessage(
        buildDomainAwareQuestion("trust_or_differentiation", specialistProfile, state),
        "capture_trust_or_differentiation"
      )
    };
  }

  if (readiness.can_generate_now) {
    return {
      action: "complete",
      phase: "final_review",
      message: createTransitionMessage(
        "Excellent — we have enough direction to build a strong preview.",
        "ready_to_build",
        [
          { label: "Build preview", action: "build" }
        ]
      )
    };
  }

  return {
    action: "probe",
    phase: "guided_enrichment",
    message: createQuestionMessage(
      "We’re in strong shape. What’s one more detail that would make this site feel unmistakably right for your business?",
      "continue_enrichment"
    )
  };
}

function buildDomainAwareQuestion(field, specialistProfile, state) {
  const category = cleanString(specialistProfile?.category_guess).toLowerCase();
  const businessName = cleanString(state?.businessName);

  if (field === "business_purpose_or_desired_outcome") {
    if (category.includes("photography")) {
      return `For ${businessName || "your photography business"}, what do you want the site to do first — attract better-fit inquiries, look more premium, showcase your style, or something else?`;
    }
    if (category.includes("tour")) {
      return `For ${businessName || "your tour business"}, what should the site help most with first — more bookings, clearer trip options, stronger trust, or something else?`;
    }
    if (category.includes("local service")) {
      return `For ${businessName || "your service business"}, what should the site improve first — more quote requests, more calls, stronger trust, or something else?`;
    }
    return "What made you decide you want a website right now, or what should it help your business accomplish first?";
  }

  if (field === "target_audience") {
    if (category.includes("photography")) {
      return "What kind of photography client do you most want more of — weddings, families, seniors, personal brands, events, or something else?";
    }
    if (category.includes("tour")) {
      return "Who is this most for — families, tourists, couples, groups, locals, or another kind of guest?";
    }
    if (category.includes("consult")) {
      return "Who is the ideal client you want this site to attract — founders, executives, small businesses, enterprise teams, or someone else?";
    }
    if (category.includes("software")) {
      return "Who is the main buyer or user this site needs to speak to first?";
    }
    return "Who are you mainly hoping this site attracts — homeowners, property managers, local clients, or someone else?";
  }

  if (field === "primary_offer") {
    if (category.includes("photography")) {
      return "What should the site feature first — weddings, portraits, family sessions, brand photography, events, or another signature offering?";
    }
    if (category.includes("tour")) {
      return "What are the main tours, trip types, or experiences you want featured first?";
    }
    if (category.includes("software")) {
      return "What are the main product use cases, workflows, or capabilities the site should explain first?";
    }
    return "What are the main services, offers, or packages you want featured first on the site?";
  }

  if (field === "cta_direction") {
    if (category.includes("photography")) {
      return "What should the main next step be — inquire about availability, request pricing, schedule a consultation, or book directly?";
    }
    if (category.includes("consult")) {
      return "What should visitors do first — book a consultation, request a proposal, or get in touch?";
    }
    if (category.includes("software")) {
      return "What should the primary CTA be — start free, book a demo, contact sales, or something else?";
    }
    return "What should visitors do first when they land on the site — call you, request a quote, or book online?";
  }

  if (field === "booking_method") {
    if (category.includes("photography")) {
      return "How do people usually move forward with you now — inquiry form, email, call, calendar booking, or something else?";
    }
    if (category.includes("tour")) {
      return "How do guests usually book right now — by phone, through a booking platform, or through your site?";
    }
    return "How do people usually contact or book with you right now — by phone, through a form, or through an external booking link?";
  }

  if (field === "contact_path") {
    if (category.includes("photography")) {
      return "What contact path should the site push most — inquiry form, email, phone, booking link, or a mix?";
    }
    return "What contact path should we use on the site — your phone number, a booking link, or both?";
  }

  if (field === "phone_number") {
    return "What phone number should we use on the site?";
  }

  if (field === "booking_url") {
    if (category.includes("photography")) {
      return "What booking or inquiry link should we use on the site?";
    }
    return "What booking link should we use on the site?";
  }

  if (field === "service_area") {
    if (category.includes("photography")) {
      return "What locations do you shoot in, or what area do you want the site to mention most clearly?";
    }
    if (category.includes("tour")) {
      return "Where do tours start, or what location / service area should the site make obvious?";
    }
    return "What area do you serve, or where are you based? A city, region, office, or neighborhood is perfect.";
  }

  if (field === "trust_or_differentiation") {
    if (category.includes("photography")) {
      return "What usually makes clients choose you — your style, experience, personality, turnaround, publications, reviews, or something else?";
    }
    if (category.includes("tour")) {
      return "What helps guests trust you quickly — experience, safety, reviews, local expertise, or something else?";
    }
    if (category.includes("consult")) {
      return "What makes people trust you quickly — experience, outcomes, credentials, client results, or something else?";
    }
    return "What helps people trust you quickly or choose you over competitors — experience, reviews, speed, credentials, pricing, or something else?";
  }

  return "Tell me a little more so I can shape the next step well.";
}

function buildCtaQuickReplies(specialistProfile) {
  const category = cleanString(specialistProfile?.category_guess).toLowerCase();

  if (category.includes("photography")) {
    return [
      { label: "Inquire about availability", action: "quick_reply" },
      { label: "Request pricing", action: "quick_reply" },
      { label: "Book a consultation", action: "quick_reply" }
    ];
  }

  if (category.includes("software")) {
    return [
      { label: "Start free", action: "quick_reply" },
      { label: "Book a demo", action: "quick_reply" },
      { label: "Contact sales", action: "quick_reply" }
    ];
  }

  return [
    { label: "Call us", action: "quick_reply" },
    { label: "Request a quote", action: "quick_reply" },
    { label: "Book online", action: "quick_reply" }
  ];
}

function normalizeControllerMessage(message) {
  if (isObject(message) && cleanString(message.content)) {
    return {
      id: cleanString(message.id) || makeId(),
      role: "assistant",
      type: cleanString(message.type) || "question",
      content: cleanString(message.content),
      options: Array.isArray(message.options) ? message.options : [],
      meta: isObject(message.meta) ? message.meta : {}
    };
  }

  return createQuestionMessage(
    "Tell me a little more so I can shape the next step well.",
    "fallback_probe"
  );
}

function normalizeAction(action, readiness) {
  const normalized = cleanString(action);

  if (normalized === "complete" && !readiness.can_generate_now) {
    return "probe";
  }

  return normalized || "probe";
}

function createQuestionMessage(content, intent, options = []) {
  return {
    id: makeId(),
    role: "assistant",
    type: "question",
    content,
    options,
    meta: {
      intent,
      can_skip: false,
      can_ghostwrite: true
    }
  };
}

function createTransitionMessage(content, intent, options = []) {
  return {
    id: makeId(),
    role: "assistant",
    type: "transition",
    content,
    options,
    meta: {
      intent,
      can_skip: false,
      can_ghostwrite: false
    }
  };
}

/* =========================
   Readiness
========================= */

function evaluateReadiness(state) {
  const missing = [];

  const whyNow = cleanString(state.answers?.why_now);
  const desiredOutcome = cleanString(state.answers?.desired_outcome);
  const audience = cleanString(state.answers?.target_audience);
  const hasOffer =
    Array.isArray(state.answers?.offerings) &&
    state.answers.offerings.length > 0;
  const hasCta = cleanString(state.answers?.primary_conversion_goal);
  const contactPath = getContactPath(state);
  const locationSignal = hasLocationSignal(state);
  const trustSignal = hasTrustSignal(state);

  if (!whyNow && !desiredOutcome) missing.push("business_purpose_or_desired_outcome");
  if (!audience) missing.push("target_audience");
  if (!hasOffer) missing.push("primary_offer");
  if (!hasCta) missing.push("cta_direction");
  if (!contactPath) missing.push("contact_path");

  const scoreParts = [
    Boolean(whyNow || desiredOutcome),
    Boolean(audience),
    Boolean(hasOffer),
    Boolean(hasCta),
    Boolean(contactPath),
    Boolean(locationSignal),
    Boolean(trustSignal)
  ];

  const score = scoreParts.filter(Boolean).length / scoreParts.length;

  return {
    score,
    required_domains_complete: missing.length === 0,
    missing_domains: missing,
    recommended_domains_missing: [
      !locationSignal ? "service_area_or_location" : "",
      !trustSignal ? "trust_or_differentiation" : ""
    ].filter(Boolean),
    can_generate_now:
      Boolean(whyNow || desiredOutcome) &&
      Boolean(audience) &&
      Boolean(hasOffer) &&
      Boolean(hasCta) &&
      Boolean(contactPath)
  };
}

/* =========================
   Summary Panel
========================= */

function buildSummaryPanel(state) {
  return {
    website_goal:
      cleanString(state.answers?.desired_outcome) ||
      cleanString(state.answers?.why_now),

    audience:
      cleanString(state.answers?.target_audience),

    offer:
      Array.isArray(state.answers?.offerings)
        ? state.answers.offerings.join(", ")
        : "",

    vibe:
      cleanString(state.inference?.suggested_vibe),

    cta:
      cleanString(state.answers?.primary_conversion_goal),

    components:
      Array.isArray(state.inference?.suggested_components)
        ? state.inference.suggested_components
        : [],

    service_area:
      cleanString(state.answers?.service_area) ||
      cleanString(state.answers?.office_address),

    contact_path:
      getContactPath(state)
  };
}

/* =========================
   Utilities
========================= */

function inferExpectedFieldFromConversation(state) {
  const conversation = Array.isArray(state?.conversation) ? state.conversation : [];
  const lastAssistant = [...conversation].reverse().find(function(item) {
    return item && item.role === "assistant" && cleanString(item.content);
  });

  const last = cleanString(lastAssistant?.content).toLowerCase();

  if (!last) return "";

  if (last.includes("what made you decide you want a website right now") || last.includes("what should it help your business accomplish") || last.includes("what do you want the site to do first")) {
    return "business_purpose_or_desired_outcome";
  }

  if (last.includes("who are you mainly hoping this site attracts") || last.includes("what kind of photography client") || last.includes("who is this most for")) {
    return "target_audience";
  }

  if (last.includes("what are the main services") || last.includes("what are the main tours") || last.includes("what should the site feature first") || last.includes("what are the main product use cases")) {
    return "primary_offer";
  }

  if (last.includes("what should visitors do first") || last.includes("what should the main next step be") || last.includes("what should the primary cta be")) {
    return "cta_direction";
  }

  if (last.includes("how do people usually contact or book") || last.includes("how do people usually move forward with you") || last.includes("how do guests usually book")) {
    return "booking_method";
  }

  if (last.includes("what contact path should")) {
    return "contact_path";
  }

  if (last.includes("what phone number should we use")) {
    return "phone_number";
  }

  if (last.includes("what booking link should we use") || last.includes("what booking or inquiry link")) {
    return "booking_url";
  }

  if (last.includes("what area do you serve") || last.includes("where are you based") || last.includes("what locations do you shoot in") || last.includes("where do tours start")) {
    return "service_area";
  }

  if (last.includes("what helps people trust you quickly") || last.includes("what usually makes clients choose you") || last.includes("what makes guests trust you quickly")) {
    return "trust_or_differentiation";
  }

  return "";
}

function normalizeContactPreference(text) {
  const lower = cleanString(text).toLowerCase();

  if (lower === "both" || lower.includes("both")) return "both";
  if (lower.includes("phone")) return "phone";
  if (lower.includes("booking")) return "booking_url";
  if (lower.includes("link")) return "booking_url";
  if (lower.includes("url")) return "booking_url";

  return "";
}

function normalizeBookingMethod(text) {
  const lower = cleanString(text).toLowerCase();

  if (!lower) return "";
  if (lower.includes("both")) return "phone_and_online_booking";
  if (lower.includes("form") && lower.includes("phone")) return "phone";
  if (lower.includes("phone") || lower.includes("call") || lower.includes("text")) return "phone";
  if (lower.includes("booking") || lower.includes("book") || lower.includes("link") || lower.includes("calendar")) return "online_booking";
  if (lower.includes("form")) return "contact_form";

  return cleanString(text);
}

function normalizeCta(text) {
  const lower = cleanString(text).toLowerCase();

  if (lower.includes("book")) return "book online";
  if (lower.includes("quote")) return "request a quote";
  if (lower.includes("call")) return "call";
  if (lower.includes("schedule")) return "schedule service";
  if (lower.includes("contact")) return "contact us";
  if (lower.includes("inquir")) return "inquire";
  if (lower.includes("demo")) return "book a demo";
  if (lower.includes("pricing")) return "request pricing";

  return cleanString(text);
}

function splitListAnswer(text) {
  const cleaned = cleanString(text);
  if (!cleaned) return [];

  const parts = cleaned
    .split(/,|\band\b/gi)
    .map(function(part) {
      return cleanString(part);
    })
    .filter(Boolean);

  return parts.length ? parts : [cleaned];
}

function looksLikeOfferAnswer(text) {
  const lower = cleanString(text).toLowerCase();

  return Boolean(
    lower.includes(",") ||
    lower.includes(" and ") ||
    lower.includes("service") ||
    lower.includes("services") ||
    lower.includes("session") ||
    lower.includes("sessions") ||
    lower.includes("tour") ||
    lower.includes("package") ||
    lower.includes("packages") ||
    lower.includes("offer") ||
    lower.includes("offers") ||
    lower.includes("gallery") ||
    lower.includes("shoot") ||
    lower.includes("cleaning") ||
    lower.includes("washing") ||
    lower.includes("consult") ||
    lower.includes("audit")
  );
}

function looksLikeCtaAnswer(text) {
  const lower = cleanString(text).toLowerCase();
  return Boolean(
    lower.includes("call") ||
    lower.includes("quote") ||
    lower.includes("book") ||
    lower.includes("schedule") ||
    lower.includes("contact") ||
    lower.includes("request") ||
    lower.includes("inquire") ||
    lower.includes("demo")
  );
}

function looksLikeLocationAnswer(text) {
  const lower = cleanString(text).toLowerCase();
  return Boolean(
    lower.includes("serve") ||
    lower.includes("based in") ||
    lower.includes("located in") ||
    lower.includes("county") ||
    lower.includes("city") ||
    lower.includes("area") ||
    lower.includes("region") ||
    lower.includes("town") ||
    lower.includes("neighborhood") ||
    /\b[A-Z][a-z]+,\s?[A-Z]{2}\b/.test(text)
  );
}

function looksLikeTrustAnswer(text) {
  const lower = cleanString(text).toLowerCase();
  return Boolean(
    lower.includes("years") ||
    lower.includes("experience") ||
    lower.includes("fast") ||
    lower.includes("same day") ||
    lower.includes("licensed") ||
    lower.includes("insured") ||
    lower.includes("review") ||
    lower.includes("reviews") ||
    lower.includes("trusted") ||
    lower.includes("award") ||
    lower.includes("published") ||
    lower.includes("family owned") ||
    lower.includes("locally owned")
  );
}

function getContactPath(state) {
  return (
    cleanString(state.clientEmail) ||
    cleanString(state.answers?.phone) ||
    cleanString(state.answers?.booking_url)
  );
}

function hasContactPath(state) {
  return Boolean(getContactPath(state));
}

function needsPhoneNumber(state) {
  const bookingMethod = cleanString(state.answers?.booking_method);
  const pref = cleanString(state.provenance?.contact_path_preference);
  const phone = cleanString(state.answers?.phone);

  if (phone) return false;

  return (
    bookingMethod === "phone" ||
    bookingMethod === "phone_and_online_booking" ||
    pref === "phone" ||
    pref === "both"
  );
}

function needsBookingUrl(state) {
  const bookingMethod = cleanString(state.answers?.booking_method);
  const pref = cleanString(state.provenance?.contact_path_preference);
  const bookingUrl = cleanString(state.answers?.booking_url);

  if (bookingUrl) return false;

  return (
    bookingMethod === "online_booking" ||
    bookingMethod === "phone_and_online_booking" ||
    pref === "booking_url" ||
    pref === "both"
  );
}

function hasLocationSignal(state) {
  return Boolean(
    cleanString(state.answers?.service_area) ||
    cleanString(state.answers?.office_address) ||
    cleanString(state.answers?.location_context)
  );
}

function hasTrustSignal(state) {
  const diff = Array.isArray(state.answers?.differentiators) ? state.answers.differentiators.length : 0;
  const trust = Array.isArray(state.answers?.trust_signals) ? state.answers.trust_signals.length : 0;
  const cred = Array.isArray(state.answers?.credibility_factors) ? state.answers.credibility_factors.length : 0;

  return diff + trust + cred > 0;
}

function containsAny(text, terms) {
  const hay = cleanString(text).toLowerCase();
  return terms.some(function(term) {
    return hay.includes(term);
  });
}

function fuzzyOverlap(a, b) {
  const aa = new Set(
    cleanString(a).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  );
  const bb = new Set(
    cleanString(b).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  );

  if (!aa.size || !bb.size) return 0;

  let overlap = 0;
  aa.forEach(function(token) {
    if (bb.has(token)) overlap += 1;
  });

  return overlap / Math.max(aa.size, bb.size);
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
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

function cleanString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function(v) {
    return cleanString(v);
  }).filter(Boolean);
}

function normalizeUrl(value) {
  const url = cleanString(value);
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return "https://" + url;
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}