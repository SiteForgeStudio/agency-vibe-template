// functions/api/intake-next.js
/**
 * SiteForge Factory — Conversational Paid Intake Step
 *
 * Goals:
 * - preserve the current controller + state architecture
 * - prioritize paid-intake verification over blank-slate discovery
 * - remove vertical-specific logic
 * - drive next questions from strategy_contract + schema-oriented needs
 * - allow AI-assisted and AI-inferred copy when the client is unsure
 * - keep readiness strict and deterministic
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

    mergedState.provenance = isObject(mergedState.provenance)
      ? mergedState.provenance
      : {};
    mergedState.provenance.specialist_profile = specialistProfile;

    mergedState = applyHeuristicAnswerUpdates(
      mergedState,
      latestUserMessage,
      baseState
    );

    mergedState = seedInferenceFromSpecialistProfile(mergedState, specialistProfile);

    const readiness = evaluateReadiness(mergedState);
    mergedState.readiness = readiness;

    const guidedStep =
      getPaidIntakeGuidedStep(mergedState, readiness, specialistProfile) ||
      getGuidedNextStep(mergedState, readiness, specialistProfile);

    const phase =
      guidedStep?.phase ||
      controllerResponse?.phase ||
      mergedState.phase ||
      "guided_enrichment";

    mergedState.phase = phase;

    const message =
      guidedStep?.message ||
      normalizeControllerMessage(controllerResponse?.message);

    const action =
      guidedStep?.action ||
      normalizeAction(controllerResponse?.action, readiness);

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

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "intake-next",
    method: "POST"
  });
}

/* =========================
   OpenAI Controller
========================= */

async function callController(env, userPrompt) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: true,
      phase: "guided_enrichment",
      state_updates: {},
      inference_updates: {},
      message: null,
      action: null
    };
  }

  const model = env.OPENAI_MODEL || "gpt-4.1-mini";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: INTAKE_CONTROLLER_SYSTEM_PROMPT },
        { role: "system", content: INTAKE_CONTROLLER_DEVELOPER_PROMPT },
        { role: "user", content: userPrompt }
      ],
      text: { format: { type: "json_object" } }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Controller error (${res.status}): ${text}`);
  }

  const payload = await res.json();
  const outputText =
    payload?.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
    payload?.output_text ||
    "{}";

  try {
    return JSON.parse(outputText);
  } catch {
    return {
      ok: true,
      phase: "guided_enrichment",
      state_updates: {},
      inference_updates: {},
      message: null,
      action: null
    };
  }
}

function buildControllerPromptWithSpecialistProfile({
  baseState,
  latestUserMessage,
  specialistProfile
}) {
  const strategyContract = getStrategyContract(baseState);
  const verificationQueue = getPriorityVerificationQueue(baseState);
  const previewMode = strategyContract?.asset_policy?.preview_asset_mode || "";
  const copyPolicy = strategyContract?.copy_policy || {};

  const extraContext = [
    "PAID INTAKE MODE:",
    "- This is a paid verification/refinement phase, not a blank-slate interview.",
    "- Ask only for missing or weak facts needed for strategy and build readiness.",
    "- Prefer verifying offer structure, pricing posture, booking flow, contact path, trust proof, service area, owner background, and asset readiness.",
    "- If the client is unsure, AI may draft copy, but must not invent hard factual claims.",
    "",
    "SEEDED STRATEGY CONTRACT:",
    JSON.stringify(strategyContract || {}, null, 2),
    "",
    "PRIORITY VERIFICATION QUEUE:",
    JSON.stringify(verificationQueue, null, 2),
    "",
    "COPY POLICY:",
    JSON.stringify(copyPolicy, null, 2),
    "",
    "PREVIEW ASSET MODE:",
    previewMode || "none",
    "",
    "LATEST USER MESSAGE:",
    latestUserMessage,
    "",
    "SPECIALIST PROFILE:",
    JSON.stringify(specialistProfile || {}, null, 2)
  ].join("\n");

  return buildIntakeControllerUserPrompt({
    state: baseState,
    latestUserMessage,
    additionalContext: extraContext
  });
}

/* =========================
   Specialist Profile
========================= */

async function ensureSpecialistProfile(env, baseState, latestUserMessage) {
  const existing =
    baseState?.provenance?.specialist_profile ||
    baseState?.inference?.specialist_profile;

  if (isObject(existing) && cleanString(existing.category_guess)) {
    return existing;
  }

  const strategy = getStrategyContract(baseState);
  const categoryGuess =
    cleanString(strategy?.business_context?.category) ||
    inferCategoryFromState(baseState, latestUserMessage);

  const profile = {
    category_guess: categoryGuess || "general service business",
    archetype:
      cleanString(strategy?.business_context?.strategic_archetype) ||
      "conversion_focused_local_business",
    business_model:
      cleanString(strategy?.business_context?.business_model) || "",
    tone_bias:
      cleanString(baseState?.answers?.tone_preferences) ||
      cleanString(baseState?.inference?.tone_direction) ||
      "confident, clear, and trustworthy",
    question_bias: inferQuestionBiasFromStrategy(strategy)
  };

  return profile;
}

function inferCategoryFromState(state, latestUserMessage) {
  const offer = cleanList(state?.answers?.offerings).join(" ").toLowerCase();
  const about = cleanString(state?.ghostwritten?.about_summary).toLowerCase();
  const text = [offer, about, cleanString(latestUserMessage).toLowerCase()].join(" ");

  if (/roof|contractor|plumb|hvac|electric|construction/.test(text)) {
    return "trades business";
  }
  if (/law|legal|attorney/.test(text)) {
    return "legal services";
  }
  if (/medical|dental|clinic|health/.test(text)) {
    return "healthcare practice";
  }
  if (/tour|travel|boat|charter|experience/.test(text)) {
    return "experience business";
  }
  if (/consult|advisor|agency|studio/.test(text)) {
    return "professional services";
  }

  return "general service business";
}

function inferQuestionBiasFromStrategy(strategy) {
  const toggles = strategy?.schema_toggles || {};
  const out = [];

  if (toggles.show_features) out.push("offer clarity");
  if (toggles.show_testimonials) out.push("trust proof");
  if (toggles.show_gallery) out.push("visual proof");
  if (toggles.show_faqs) out.push("objection handling");
  if (toggles.show_service_area) out.push("location clarity");

  return out;
}

/* =========================
   Merge + Heuristics
========================= */

function mergeControllerResponse(baseState, controllerResponse) {
  const merged = structuredClone(isObject(baseState) ? baseState : {});

  const stateUpdates = isObject(controllerResponse?.state_updates)
    ? controllerResponse.state_updates
    : {};

  const inferenceUpdates = isObject(controllerResponse?.inference_updates)
    ? controllerResponse.inference_updates
    : {};

  deepMergeInto(merged, stateUpdates);

  merged.inference = isObject(merged.inference) ? merged.inference : {};
  deepMergeInto(merged.inference, inferenceUpdates);

  return merged;
}

function applyHeuristicAnswerUpdates(state, latestUserMessage, baseState) {
  const next = normalizeState(state);
  const text = cleanString(latestUserMessage);
  const lower = text.toLowerCase();

  const pendingIntent =
    cleanString(getLastAssistantIntent(baseState)) ||
    cleanString(next.last_intent);

  if (/use preview imagery for now|inspirational imagery|stock images are fine|ai images are fine/.test(lower)) {
    next.answers.trust_signals = uniqueList([
      ...(next.answers.trust_signals || []),
      "preview imagery approved for first build"
    ]);
    next.inference.missing_information = removeFromList(
      next.inference.missing_information,
      "photo_assets"
    );
  }

  if (/i don't know|not sure|you decide|can you write it|can you draft it|help me write it/.test(lower)) {
    next.inference.missing_information = uniqueList([
      ...(next.inference.missing_information || []),
      "client_requested_ai_copy_help"
    ]);
  }

  if (/external booking|booking link|book online/.test(lower)) {
    next.answers.booking_method = "external_booking";
  } else if (/phone/.test(lower) && /book|booking|call/.test(lower)) {
    next.answers.booking_method = "phone";
  } else if (/inquiry form|contact form|form/.test(lower)) {
    next.answers.booking_method = "contact_form";
  }

  if (/show exact prices/.test(lower)) {
    next.answers.pricing_context = "Show exact prices";
  } else if (/show starting prices/.test(lower)) {
    next.answers.pricing_context = "Show starting prices";
  } else if (/show package tiers/.test(lower)) {
    next.answers.pricing_context = "Show package tiers";
  } else if (/keep pricing private/.test(lower)) {
    next.answers.pricing_context = "Keep pricing private and invite inquiries";
  }

  if (pendingIntent === "verify_booking_url" && looksLikeUrl(text)) {
    next.answers.booking_url = text;
  }

  if (pendingIntent === "verify_phone" && looksLikePhone(text)) {
    next.answers.phone = text;
  }

  if (pendingIntent === "verify_service_area") {
    next.answers.service_area = text;
    next.answers.location_context = text;
  }

  if (pendingIntent === "verify_owner_background") {
    next.ghostwritten.about_summary = text;
  }

  if (pendingIntent === "verify_safety_reassurance") {
    next.answers.trust_signals = uniqueList([
      ...(next.answers.trust_signals || []),
      text
    ]);
  }

  if (pendingIntent === "verify_testimonials") {
    next.answers.credibility_factors = uniqueList([
      ...(next.answers.credibility_factors || []),
      text
    ]);
  }

  if (pendingIntent === "verify_offerings" || pendingIntent === "verify_offer_details") {
    next.answers.offerings = uniqueList([
      ...(next.answers.offerings || []),
      ...splitOfferings(text)
    ]);
  }

  if (pendingIntent === "verify_pricing_context" && !next.answers.pricing_context) {
    next.answers.pricing_context = text;
  }

  if (pendingIntent === "verify_booking_method" && !next.answers.booking_method) {
    next.answers.booking_method = normalizeBookingMethod(text);
  }

  return normalizeState(next);
}

function seedInferenceFromSpecialistProfile(state, specialistProfile) {
  const next = normalizeState(state);

  next.inference.specialist_profile = specialistProfile;

  if (!cleanString(next.inference.tone_direction) && cleanString(specialistProfile?.tone_bias)) {
    next.inference.tone_direction = cleanString(specialistProfile.tone_bias);
  }

  if (
    (!Array.isArray(next.inference.suggested_components) ||
      next.inference.suggested_components.length === 0) &&
    isObject(next?.provenance?.strategy_contract?.schema_toggles)
  ) {
    next.inference.suggested_components = schemaToggleKeysToComponents(
      next.provenance.strategy_contract.schema_toggles
    );
  }

  return next;
}

/* =========================
   Guided Steps
========================= */

function getPaidIntakeGuidedStep(state, readiness, specialistProfile) {
  const strategy = getStrategyContract(state);
  if (!strategy) return null;

  const queue = getPriorityVerificationQueue(state);
  const nextKey = queue.find(function(key) {
    return !isVerificationFieldSatisfied(state, key);
  });

  if (!nextKey) return null;

  return buildVerificationPrompt(nextKey, state, strategy, specialistProfile);
}

function getGuidedNextStep(state, readiness, specialistProfile) {
  const answers = state.answers || {};
  const bookingMethod = cleanString(answers.booking_method);

  if (!cleanString(answers.target_audience)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "Who are the main people you want this site to attract first?",
        "capture_target_audience"
      )
    };
  }

  if (!Array.isArray(answers.offerings) || answers.offerings.length === 0) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "What are the main services, packages, or offers you want the site to focus on?",
        "capture_offerings"
      )
    };
  }

  if (!cleanString(answers.primary_conversion_goal)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "What is the main action you want visitors to take — book, call, request a quote, or send an inquiry?",
        "capture_primary_conversion_goal",
        [
          { label: "Book now", action: "quick_reply" },
          { label: "Call now", action: "quick_reply" },
          { label: "Request quote", action: "quick_reply" },
          { label: "Send inquiry", action: "quick_reply" }
        ]
      )
    };
  }

  if (!bookingMethod) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "How should visitors contact or book with you?",
        "capture_booking_method",
        [
          { label: "External booking link", action: "quick_reply" },
          { label: "Phone", action: "quick_reply" },
          { label: "Inquiry form", action: "quick_reply" },
          { label: "A mix", action: "quick_reply" }
        ]
      )
    };
  }

  if (!hasContactPath(state) && bookingMethod !== "contact_form") {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "What contact path should we use on the site — phone, booking link, or both?",
        "capture_contact_path",
        [
          { label: "Phone number", action: "quick_reply" },
          { label: "Booking link", action: "quick_reply" },
          { label: "Both", action: "quick_reply" }
        ]
      )
    };
  }

  if (!hasLocationSignal(state)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "What service area, city, or location details should we make clear on the site?",
        "capture_service_area"
      )
    };
  }

  if (!hasTrustSignal(state)) {
    return {
      action: "probe",
      phase: "final_review",
      message: createQuestionMessage(
        "What is one thing that would make a new customer trust you faster — reviews, experience, process, guarantees, certifications, or something else?",
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
        [{ label: "Build preview", action: "build" }]
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

function getPriorityVerificationQueue(state) {
  const strategy = getStrategyContract(state);
  if (!strategy) return [];

  const mustVerify = cleanList(strategy?.content_requirements?.must_verify_now);
  const mustCollect = cleanList(strategy?.content_requirements?.must_collect_paid_phase);

  const queue = [];

  mustVerify.forEach(function(item) {
    const key = normalizeVerificationKey(item);
    if (key) queue.push(key);
  });

  mustCollect.forEach(function(item) {
    const key = normalizeVerificationKey(item);
    if (key) queue.push(key);
  });

  if (strategy?.schema_toggles?.show_features) queue.push("offer_structure");
  if (strategy?.schema_toggles?.show_testimonials) queue.push("trust_proof");
  if (strategy?.schema_toggles?.show_gallery) queue.push("photo_assets");
  if (strategy?.schema_toggles?.show_about) queue.push("owner_background");
  if (strategy?.schema_toggles?.show_service_area) queue.push("service_area");
  if (strategy?.schema_toggles?.show_faqs) queue.push("faq_objections");

  if (strategy?.conversion_strategy?.cta_destination === "booking_url") {
    queue.push("booking_url");
  }

  queue.push("booking_method");
  queue.push("pricing_context");
  queue.push("contact_path");

  return Array.from(new Set(queue));
}

function normalizeVerificationKey(value) {
  const v = cleanString(value).toLowerCase();

  if (v.includes("pricing")) return "pricing_context";
  if (v.includes("package")) return "offer_structure";
  if (v.includes("tour")) return "offer_structure";
  if (v.includes("service")) return "offer_structure";
  if (v.includes("offer")) return "offer_structure";
  if (v.includes("availability")) return "faq_objections";
  if (v.includes("booking")) return "booking_method";
  if (v.includes("phone")) return "contact_path";
  if (v.includes("url")) return "booking_url";
  if (v.includes("service area")) return "service_area";
  if (v.includes("testimonial")) return "trust_proof";
  if (v.includes("review")) return "trust_proof";
  if (v.includes("photo")) return "photo_assets";
  if (v.includes("image")) return "photo_assets";
  if (v.includes("bio")) return "owner_background";
  if (v.includes("owner")) return "owner_background";
  if (v.includes("about")) return "owner_background";
  if (v.includes("safety")) return "safety_reassurance";
  if (v.includes("faq")) return "faq_objections";
  if (v.includes("objection")) return "faq_objections";

  return "";
}

function isVerificationFieldSatisfied(state, key) {
  const answers = state.answers || {};
  const ghostwritten = state.ghostwritten || {};

  switch (key) {
    case "offer_structure":
      return Array.isArray(answers.offerings) && answers.offerings.length > 0;

    case "pricing_context":
      return cleanString(answers.pricing_context).length > 0;

    case "booking_method":
      return cleanString(answers.booking_method).length > 0;

    case "booking_url":
      return cleanString(answers.booking_url).length > 0;

    case "contact_path":
      return Boolean(cleanString(answers.phone) || cleanString(answers.booking_url) || cleanString(state.clientEmail));

    case "service_area":
      return cleanString(answers.service_area).length > 0;

    case "safety_reassurance":
      return (
        Array.isArray(answers.trust_signals) &&
        answers.trust_signals.some(v => /safety/i.test(v))
      );

    case "trust_proof":
      return (
        Array.isArray(answers.trust_signals) && answers.trust_signals.length > 0
      ) || (
        Array.isArray(answers.credibility_factors) &&
        answers.credibility_factors.length > 0
      );

    case "photo_assets":
      return (
        Array.isArray(answers.trust_signals) &&
        answers.trust_signals.some(v => /photo|gallery|image|preview imagery/i.test(v))
      );

    case "owner_background":
      return cleanString(ghostwritten.about_summary).length > 0;

    case "faq_objections":
      return (
        Array.isArray(answers.faq_topics) && answers.faq_topics.length > 0
      ) || (
        Array.isArray(answers.common_objections) && answers.common_objections.length > 0
      );

    default:
      return false;
  }
}

function buildVerificationPrompt(key, state, strategy, specialistProfile) {
  const businessName = cleanString(state.businessName) || "your business";
  const inferredOffer = cleanList(state.answers.offerings)[0] || "your main offer";
  const usesPreviewImages = strategy?.asset_policy?.client_assets_required_for_preview === false;

  switch (key) {
    case "offer_structure":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          `We already have ${inferredOffer} as the starting point. What exact services, packages, or offers should we feature first?`,
          "verify_offerings"
        )
      };

    case "pricing_context":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          `How should we handle pricing for ${businessName} — show exact prices, starting prices, package tiers, or keep pricing private and invite inquiries?`,
          "verify_pricing_context",
          [
            { label: "Show exact prices", action: "quick_reply" },
            { label: "Show starting prices", action: "quick_reply" },
            { label: "Show package tiers", action: "quick_reply" },
            { label: "Keep pricing private", action: "quick_reply" }
          ]
        )
      };

    case "booking_method":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          "What should visitors do to take the next step — use an external booking link, call, send an inquiry, or a mix of those?",
          "verify_booking_method",
          [
            { label: "External booking link", action: "quick_reply" },
            { label: "Phone calls", action: "quick_reply" },
            { label: "Inquiry form", action: "quick_reply" },
            { label: "A mix", action: "quick_reply" }
          ]
        )
      };

    case "booking_url":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          "What booking link should we use for the main call to action? If you do not have one yet, say that and we’ll build the preview around inquiry-first flow.",
          "verify_booking_url"
        )
      };

    case "contact_path":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          "What contact path should we include prominently — phone, booking link, email, or a mix?",
          "verify_contact_path"
        )
      };

    case "service_area":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          "What exact service area, city coverage, or location details should we make clear on the site?",
          "verify_service_area"
        )
      };

    case "safety_reassurance":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          "What reassurance should we mention that helps new customers feel safe or confident choosing you?",
          "verify_safety_reassurance"
        )
      };

    case "trust_proof":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          "Do you already have any reviews, testimonials, experience highlights, guarantees, or trust signals we can use? If not, I can draft trust-focused copy for the preview.",
          "verify_testimonials"
        )
      };

    case "photo_assets":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          usesPreviewImages
            ? "Do you have any photos ready now, or should we use inspirational preview imagery first and replace it later?"
            : "Do you have any photos or visuals ready now?",
          "verify_photos",
          usesPreviewImages
            ? [
                { label: "Use preview imagery for now", action: "quick_reply" },
                { label: "I have some photos", action: "quick_reply" }
              ]
            : undefined
        )
      };

    case "owner_background":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          "What should we say about you or the business behind this? Even a rough sentence is enough — I can turn it into strong copy.",
          "verify_owner_background"
        )
      };

    case "faq_objections":
      return {
        action: "probe",
        phase: "guided_enrichment",
        message: createQuestionMessage(
          "What questions, concerns, or objections do customers commonly have before they buy or book?",
          "verify_faq_objections"
        )
      };

    default:
      return null;
  }
}

/* =========================
   Message Builders
========================= */

function createQuestionMessage(content, intent, quickReplies) {
  return {
    type: "question",
    content,
    intent,
    quick_replies: Array.isArray(quickReplies) ? quickReplies : []
  };
}

function createTransitionMessage(content, intent, quickReplies) {
  return {
    type: "transition",
    content,
    intent,
    quick_replies: Array.isArray(quickReplies) ? quickReplies : []
  };
}

function normalizeControllerMessage(message) {
  if (!message) return null;
  if (typeof message === "string") {
    return { type: "question", content: message, intent: "" };
  }
  if (isObject(message)) {
    return {
      type: cleanString(message.type) || "question",
      content: cleanString(message.content),
      intent: cleanString(message.intent),
      quick_replies: Array.isArray(message.quick_replies) ? message.quick_replies : []
    };
  }
  return null;
}

function normalizeAction(action, readiness) {
  if (isObject(action)) {
    return action;
  }

  if (readiness?.can_generate_now) {
    return { type: "complete", label: "Build preview" };
  }

  return { type: "continue", label: "Continue" };
}

/* =========================
   Strategy Contract Access
========================= */

function getStrategyContract(state) {
  return state?.provenance?.strategy_contract ||
    state?.inference?.strategy_contract ||
    null;
}

/* =========================
   Readiness + Summary
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
  const hasContactPath = Boolean(
    cleanString(state.clientEmail) ||
    cleanString(state.answers?.phone) ||
    cleanString(state.answers?.booking_url)
  );

  const hasLocationSignal = Boolean(
    cleanString(state.answers?.service_area) ||
    cleanString(state.answers?.office_address) ||
    cleanString(state.answers?.location_context)
  );

  const hasBuyerIntel =
    (state.answers?.buyer_decision_factors?.length > 0) ||
    (state.answers?.common_objections?.length > 0);

  const diff = Array.isArray(state.answers?.differentiators)
    ? state.answers.differentiators.length
    : 0;
  const trust = Array.isArray(state.answers?.trust_signals)
    ? state.answers.trust_signals.length
    : 0;
  const cred = Array.isArray(state.answers?.credibility_factors)
    ? state.answers.credibility_factors.length
    : 0;

  const hasTrustOrDiff = diff + trust + cred > 0;

  if (!whyNow && !desiredOutcome) missing.push("business_purpose");
  if (!audience) missing.push("target_audience");
  if (!hasOffer) missing.push("primary_offer");
  if (!hasCta) missing.push("cta_direction");
  if (!hasContactPath) missing.push("contact_path");
  if (!hasBuyerIntel) missing.push("buyer_intelligence");
  if (!hasTrustOrDiff) missing.push("trust_signals");

  const scoreParts = [
    Boolean(whyNow || desiredOutcome),
    Boolean(audience),
    Boolean(hasOffer),
    Boolean(hasCta),
    Boolean(hasContactPath),
    Boolean(hasLocationSignal),
    Boolean(hasTrustOrDiff),
    Boolean(hasBuyerIntel)
  ];

  const score = scoreParts.filter(Boolean).length / scoreParts.length;

  return {
    score,
    required_domains_complete: missing.length === 0,
    missing_domains: missing,
    recommended_domains_missing: [
      !hasLocationSignal ? "service_area_or_location" : ""
    ].filter(Boolean),
    can_generate_now:
      Boolean(whyNow || desiredOutcome) &&
      Boolean(audience) &&
      Boolean(hasOffer) &&
      Boolean(hasCta) &&
      Boolean(hasContactPath) &&
      hasBuyerIntel &&
      hasTrustOrDiff
  };
}

function buildSummaryPanel(state) {
  return {
    business_name: cleanString(state.businessName),
    audience: cleanString(state.answers?.target_audience),
    primary_offer: cleanList(state.answers?.offerings),
    conversion_goal: cleanString(state.answers?.primary_conversion_goal),
    booking_method: cleanString(state.answers?.booking_method),
    service_area: cleanString(state.answers?.service_area),
    suggested_vibe: cleanString(state.inference?.suggested_vibe),
    suggested_components: cleanList(state.inference?.suggested_components),
    trust_signals: cleanList(state.answers?.trust_signals),
    missing_information: cleanList(state.inference?.missing_information)
  };
}

/* =========================
   State Normalization
========================= */

function normalizeState(state) {
  const next = structuredClone(isObject(state) ? state : {});

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
    buyer_decision_factors: [],
    common_objections: [],
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

  next.answers.offerings = cleanList(next.answers.offerings);
  next.answers.differentiators = cleanList(next.answers.differentiators);
  next.answers.trust_signals = cleanList(next.answers.trust_signals);
  next.answers.credibility_factors = cleanList(next.answers.credibility_factors);
  next.answers.process_notes = cleanList(next.answers.process_notes);
  next.answers.faq_topics = cleanList(next.answers.faq_topics);
  next.answers.buyer_decision_factors = cleanList(next.answers.buyer_decision_factors);
  next.answers.common_objections = cleanList(next.answers.common_objections);

  next.inference.suggested_components = cleanList(next.inference.suggested_components);
  next.inference.missing_information = cleanList(next.inference.missing_information);

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

  next.clientEmail = cleanString(next.clientEmail);
  next.businessName = cleanString(next.businessName);
  next.phase = cleanString(next.phase) || "guided_enrichment";
  next.last_intent = cleanString(next.last_intent);

  return next;
}

/* =========================
   Utility Helpers
========================= */

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

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function(v) {
    return cleanString(v);
  }).filter(Boolean);
}

function uniqueList(arr) {
  return Array.from(new Set(cleanList(arr)));
}

function removeFromList(arr, value) {
  const needle = cleanString(value);
  return cleanList(arr).filter(function(item) {
    return item !== needle;
  });
}

function deepMergeInto(target, source) {
  if (!isObject(target) || !isObject(source)) return target;

  Object.keys(source).forEach(function(key) {
    const src = source[key];
    const dst = target[key];

    if (Array.isArray(src)) {
      target[key] = src.slice();
      return;
    }

    if (isObject(src)) {
      target[key] = isObject(dst) ? dst : {};
      deepMergeInto(target[key], src);
      return;
    }

    target[key] = src;
  });

  return target;
}

function getLastAssistantIntent(state) {
  const conversation = Array.isArray(state?.conversation) ? state.conversation : [];
  const lastAssistant = [...conversation].reverse().find(function(item) {
    return item && item.role === "assistant" && cleanString(item.content);
  });

  if (lastAssistant && isObject(lastAssistant.message) && cleanString(lastAssistant.message.intent)) {
    return cleanString(lastAssistant.message.intent);
  }

  return cleanString(state?.last_intent);
}

function looksLikeUrl(text) {
  return /^https?:\/\//i.test(cleanString(text)) || /\.[a-z]{2,}($|\/)/i.test(cleanString(text));
}

function looksLikePhone(text) {
  const digits = cleanString(text).replace(/\D/g, "");
  return digits.length >= 10;
}

function splitOfferings(text) {
  const raw = cleanString(text);
  if (!raw) return [];
  return raw
    .split(/\n|,|;/g)
    .map(function(v) { return cleanString(v); })
    .filter(Boolean);
}

function normalizeBookingMethod(text) {
  const lower = cleanString(text).toLowerCase();

  if (/external|booking link|book online/.test(lower)) return "external_booking";
  if (/phone|call/.test(lower)) return "phone";
  if (/form|inquiry|contact/.test(lower)) return "contact_form";
  if (/mix|both/.test(lower)) return "mixed";

  return rawSlug(lower) || "";
}

function rawSlug(text) {
  return cleanString(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hasContactPath(state) {
  return Boolean(
    cleanString(state.clientEmail) ||
    cleanString(state.answers?.phone) ||
    cleanString(state.answers?.booking_url)
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
  const diff = Array.isArray(state.answers?.differentiators)
    ? state.answers.differentiators.length
    : 0;
  const trust = Array.isArray(state.answers?.trust_signals)
    ? state.answers.trust_signals.length
    : 0;
  const cred = Array.isArray(state.answers?.credibility_factors)
    ? state.answers.credibility_factors.length
    : 0;

  return diff + trust + cred > 0;
}

function schemaToggleKeysToComponents(schemaToggles) {
  const map = {
    show_trustbar: "Trustbar",
    show_about: "About",
    show_features: "Features",
    show_events: "Events",
    show_process: "Process",
    show_testimonials: "Testimonials",
    show_comparison: "Comparison",
    show_gallery: "Gallery",
    show_investment: "Investment",
    show_faqs: "FAQs",
    show_service_area: "Service Area"
  };

  return Object.keys(map)
    .filter(function(key) {
      return Boolean(schemaToggles?.[key]);
    })
    .map(function(key) {
      return map[key];
    });
}