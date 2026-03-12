// functions/api/intake-next.js
/**
 * intake-next.js
 *
 * SiteForge Factory — Conversational Intake Step
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
    const baseState = isObject(body.state) ? body.state : structuredClone(EMPTY_INTAKE_STATE);

    if (!sessionId) {
      return json({ ok: false, error: "Missing session_id" }, 400);
    }

    if (!answer && !uiAction) {
      return json({ ok: false, error: "Missing answer or ui_action" }, 400);
    }

    const latestUserMessage = answer || uiAction;

    const userPrompt = buildIntakeControllerUserPrompt({
      phase: baseState.phase || "unknown",
      businessName: baseState.businessName,
      clientEmail: baseState.clientEmail,
      latestUserMessage,
      state: baseState,
      conversation: baseState.conversation || []
    });

    const controllerResponse = await callController(context.env, userPrompt);

    let mergedState = mergeState(baseState, controllerResponse.state_updates);
    mergedState = normalizeState(mergedState);

    mergedState = applyHeuristicAnswerUpdates(
      mergedState,
      latestUserMessage,
      baseState
    );

    const readiness = evaluateReadiness(mergedState);
    mergedState.readiness = readiness;

    const guidedStep = getGuidedNextStep(mergedState, readiness);

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
   OpenAI Controller Call
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

/* =========================
   State Handling
========================= */

function mergeState(existing, updates) {
  if (!isObject(updates)) return normalizeState(existing);

  const next = structuredClone(existing);

  Object.keys(updates).forEach(function(key) {
    const val = updates[key];

    if (isObject(val) && isObject(next[key])) {
      next[key] = { ...next[key], ...val };
    } else {
      next[key] = val;
    }
  });

  return normalizeState(next);
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
    } else if (!next.answers.phone) {
      next.provenance.awaiting_phone_number = true;
    }
    return next;
  }

  if (expectedField === "booking_url") {
    if (urlMatch) {
      next.answers.booking_url = normalizeUrl(urlMatch[0]);
    } else if (!next.answers.booking_url) {
      next.provenance.awaiting_booking_url = true;
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

  return next;
}

/* =========================
   Guided Question Flow
========================= */

function getGuidedNextStep(state, readiness) {
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
        "What made you decide you want a website right now, or what should it help your business accomplish first?",
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
        "Who are you mainly hoping this site attracts — homeowners, property managers, local clients, or someone else?",
        "capture_target_audience"
      )
    };
  }

  if (!answers.offerings.length) {
    return {
      action: "probe",
      phase: "business_understanding",
      message: createQuestionMessage(
        "What are the main services you want featured first on the site?",
        "capture_primary_offer"
      )
    };
  }

  if (!cleanString(answers.primary_conversion_goal)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "What should visitors do first when they land on the site — call you, request a quote, or book online?",
        "capture_primary_conversion_goal",
        [
          { label: "Call us", action: "quick_reply" },
          { label: "Request a quote", action: "quick_reply" },
          { label: "Book online", action: "quick_reply" }
        ]
      )
    };
  }

  if (!bookingMethod) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "How do people usually contact or book with you right now — by phone, through a form, or through an external booking link?",
        "capture_booking_method"
      )
    };
  }

  if (!hasContactPath(state) && !contactPreference) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "What contact path should we use on the site — your phone number, a booking link, or both?",
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
        "What phone number should we use on the site?",
        "capture_phone_number"
      )
    };
  }

  if (needsBookingUrl(state)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "What booking link should we use on the site?",
        "capture_booking_url"
      )
    };
  }

  if (!hasLocationSignal(state)) {
    return {
      action: "probe",
      phase: "guided_enrichment",
      message: createQuestionMessage(
        "What area do you serve, or where are you based? A city, region, office, or neighborhood is perfect.",
        "capture_service_area"
      )
    };
  }

  if (!hasTrustSignal(state)) {
    return {
      action: "probe",
      phase: "final_review",
      message: createQuestionMessage(
        "What helps people trust you quickly or choose you over competitors — experience, fast service, reviews, pricing, or something else?",
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
      "What else would you like this site to make easier for your customers?",
      "continue_enrichment"
    )
  };
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
  const hasOffer = Array.isArray(state.answers?.offerings) && state.answers.offerings.length > 0;
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

  if (last.includes("what made you decide you want a website right now") || last.includes("what should it help your business accomplish")) {
    return "business_purpose_or_desired_outcome";
  }

  if (last.includes("who are you mainly hoping this site attracts")) {
    return "target_audience";
  }

  if (last.includes("what are the main services you want featured")) {
    return "primary_offer";
  }

  if (last.includes("what should visitors do first")) {
    return "cta_direction";
  }

  if (last.includes("how do people usually contact or book")) {
    return "booking_method";
  }

  if (last.includes("what contact path should we use")) {
    return "contact_path";
  }

  if (last.includes("what phone number should we use")) {
    return "phone_number";
  }

  if (last.includes("what booking link should we use")) {
    return "booking_url";
  }

  if (last.includes("what area do you serve") || last.includes("where are you based")) {
    return "service_area";
  }

  if (last.includes("what helps people trust you quickly") || last.includes("choose you over competitors")) {
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

  if (lower.includes("both")) return "phone_and_online_booking";
  if (lower.includes("book online") || lower.includes("booking link") || lower.includes("reserve online") || lower.includes("online booking")) {
    return "online_booking";
  }
  if (lower.includes("call") || lower.includes("phone") || lower.includes("text")) {
    return "phone";
  }
  if (lower.includes("form") || lower.includes("contact form")) {
    return "contact_form";
  }

  return cleanString(text);
}

function normalizeCta(text) {
  const lower = cleanString(text).toLowerCase();

  if (lower.includes("book")) return "book online";
  if (lower.includes("quote")) return "request a quote";
  if (lower.includes("call")) return "call";
  if (lower.includes("schedule")) return "schedule service";
  if (lower.includes("contact")) return "contact us";

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
    lower.includes("junk") ||
    lower.includes("removal") ||
    lower.includes("cleanout") ||
    lower.includes("hauling") ||
    lower.includes("lawn") ||
    lower.includes("trim") ||
    lower.includes("mowing")
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
    lower.includes("request")
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