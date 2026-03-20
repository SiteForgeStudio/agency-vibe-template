/**
 * SiteForge Factory — Scoped Paid Intake Verification Engine
 *
 * Goals:
 * - Preflight provides direction; this file verifies/refines it
 * - One active verification key per turn
 * - Field writes are scoped to the active key
 * - Missing information + readiness are recomputed every turn
 * - ready_to_build requires queue completion
 * - Navigation actions like "continue" do not count as semantic answers
 */

const EMPTY_INTAKE_STATE = {
  slug: "",
  businessName: "",
  clientEmail: "",
  phase: "guided_enrichment",
  answers: {
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
    experience_years: ""
  },
  inference: {
    suggested_vibe: "",
    suggested_components: [],
    tone_direction: "",
    visual_direction: "",
    missing_information: [],
    confidence_score: 0,
    strategy_contract: null,
    specialist_profile: null
  },
  ghostwritten: {
    tagline: "",
    hero_headline: "",
    hero_subheadline: "",
    about_summary: "",
    features_copy: [],
    faqs: []
  },
  provenance: {
    strategy_contract: null
  },
  verification: {
    queue: [],
    current_key: "",
    completed_keys: [],
    remaining_keys: [],
    queue_complete: false,
    evidence: {}
  },
  readiness: {
    score: 0,
    required_domains_complete: false,
    missing_domains: [],
    can_generate_now: false,
    queue_complete: false,
    remaining_verification_items: []
  },
  conversation: [],
  answer_log: [],
  last_intent: "",
  session_id: ""
};

const NAVIGATION_ACTIONS = ["continue", "accept", "start", "next"];

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);

    const sessionId = cleanString(body.session_id);
    const answer = cleanString(body.answer);
    const uiAction = cleanString(body.ui_action);
    const normalizedUiAction = uiAction.toLowerCase();
    const isNavigationOnlyAction = NAVIGATION_ACTIONS.indexOf(normalizedUiAction) !== -1;
    const latestUserMessage = answer ? answer : (isNavigationOnlyAction ? "" : uiAction);
    const hasSemanticAnswer = Boolean(latestUserMessage);

    if (!sessionId) {
      return json({ ok: false, error: "Missing session_id" }, 400);
    }

    if (!answer && !uiAction) {
      return json({ ok: false, error: "Missing answer or ui_action" }, 400);
    }

    var state = normalizeState(isObject(body.state) ? body.state : clone(EMPTY_INTAKE_STATE));
    state.session_id = sessionId;
    state.phase = cleanString(state.phase) || "guided_enrichment";

    const strategyContract = getStrategyContract(state);
    if (!strategyContract) {
      return json({ ok: false, error: "Missing strategy_contract in state" }, 400);
    }

    const specialistProfile = await ensureSpecialistProfile(context.env, state, latestUserMessage);
    state.provenance = isObject(state.provenance) ? state.provenance : {};
    state.provenance.specialist_profile = specialistProfile;

    const initialQueue = getPriorityVerificationQueue(state);
    const currentKey = getCurrentVerificationKey(state, initialQueue);

    const interpreterResult = currentKey && hasSemanticAnswer
      ? await interpretActiveAnswer(context.env, {
          state: state,
          currentKey: currentKey,
          latestUserMessage: latestUserMessage,
          strategyContract: strategyContract,
          specialistProfile: specialistProfile,
          allowedTargets: getAllowedFieldTargetsForKey(currentKey)
        })
      : emptyInterpreterResult();

    if (hasSemanticAnswer) {
      state = appendRawAnswerLog(state, {
        key: currentKey || "none",
        answer: latestUserMessage,
        ui_action: uiAction,
        interpreted_at: new Date().toISOString(),
        interpreter_confidence: Number(interpreterResult.confidence || 0)
      });
    }

    if (currentKey && hasSemanticAnswer) {
      state = applyScopedFieldUpdates(state, currentKey, interpreterResult.field_updates, latestUserMessage);
      state = markVerificationEvidence(state, currentKey, latestUserMessage, interpreterResult);
    }

    state = seedInferenceFromSpecialistProfile(state, specialistProfile);

    const refreshedQueue = getPriorityVerificationQueue(state);
    const refreshedCurrentKey = getCurrentVerificationKey(state, refreshedQueue);
    const verification = buildVerificationState(state, refreshedQueue, refreshedCurrentKey);
    state.verification = verification;
    state.inference.missing_information = computeMissingInformation(state, verification);

    const readiness = evaluateReadiness(state, verification);
    state.readiness = readiness;
    state.phase = readiness.can_generate_now ? "final_review" : "guided_enrichment";

    const message = readiness.can_generate_now
      ? createTransitionMessage(
          "Excellent — the verified details are in place and the preview is ready to build.",
          "ready_to_build",
          [{ label: "Build preview", action: "build" }]
        )
      : await buildNextMessage(context.env, {
          state: state,
          currentKey: refreshedCurrentKey,
          strategyContract: strategyContract
        });

    state.last_intent = cleanString(message.intent);

    state.conversation = Array.isArray(state.conversation) ? state.conversation : [];
    state.conversation.push({
      role: "user",
      content: hasSemanticAnswer ? latestUserMessage : uiAction,
      meta: {
        verification_key: currentKey || "",
        ui_action: uiAction || "",
        semantic_answer: hasSemanticAnswer
      }
    });

    if (message && message.content) {
      state.conversation.push({
        role: "assistant",
        content: message.content,
        message: {
          intent: cleanString(message.intent),
          type: cleanString(message.type) || "question"
        }
      });
    }

    return json({
      ok: true,
      phase: state.phase,
      message: message,
      state: state,
      readiness: readiness,
      action: readiness.can_generate_now
        ? { type: "complete", label: "Build preview" }
        : { type: "continue", label: "Continue" },
      summary_panel: buildSummaryPanel(state, verification)
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: String(err && err.message ? err.message : err)
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: true, endpoint: "intake-next", method: "POST" });
}

/* =========================
   AI helpers
========================= */

async function interpretActiveAnswer(env, payload) {
  const apiKey = cleanString(env && env.OPENAI_API_KEY);
  if (!apiKey) return emptyInterpreterResult();

  const systemPrompt = [
    "You are a scoped intake interpreter for a website generation pipeline.",
    "Interpret ONLY the user's latest answer for the active verification key.",
    "Never rewrite the broader state.",
    "Never invent facts.",
    "Return valid JSON only.",
    "Only populate allowed target fields.",
    "If unclear, return empty field_updates and low confidence.",
    "For service_process, prefer short customer-facing steps."
  ].join("\n");

  const userPrompt = JSON.stringify(
    {
      active_verification_key: payload.currentKey,
      business_name: cleanString(payload.state.businessName),
      strategy_contract: payload.strategyContract,
      specialist_profile: payload.specialistProfile,
      current_state_excerpt: buildStateExcerpt(payload.state),
      allowed_target_fields: payload.allowedTargets,
      latest_user_message: payload.latestUserMessage,
      required_output_shape: {
        field_updates: {
          answers: {},
          ghostwritten: {},
          clientEmail: ""
        },
        confidence: 0,
        notes: ""
      }
    },
    null,
    2
  );

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: "Bearer " + apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: cleanString(env && env.OPENAI_MODEL) || "gpt-4.1-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!res.ok) return emptyInterpreterResult();

    const out = await res.json();
    const content =
      out &&
      out.choices &&
      out.choices[0] &&
      out.choices[0].message &&
      typeof out.choices[0].message.content === "string"
        ? out.choices[0].message.content
        : "{}";

    const parsed = JSON.parse(content || "{}");

    return {
      field_updates: isObject(parsed.field_updates) ? parsed.field_updates : {},
      confidence: Number(parsed.confidence || 0),
      notes: cleanString(parsed.notes)
    };
  } catch (_err) {
    return emptyInterpreterResult();
  }
}

function emptyInterpreterResult() {
  return {
    field_updates: {},
    confidence: 0,
    notes: ""
  };
}

async function buildNextMessage(env, payload) {
  const fallback = buildFallbackQuestion(payload.currentKey, payload.state, payload.strategyContract);
  if (!payload.currentKey) return fallback;

  const apiKey = cleanString(env && env.OPENAI_API_KEY);
  if (!apiKey) return fallback;

  const systemPrompt = [
    "You write the next question for a paid website verification flow.",
    "This is not a generic interview.",
    "Use the active verification key and strategy context.",
    "Ask for one thing only.",
    "Be concise, strategic, and conversion-aware.",
    "Return valid JSON only with keys: content, intent, quick_replies."
  ].join("\n");

  const userPrompt = JSON.stringify(
    {
      active_verification_key: payload.currentKey,
      business_name: cleanString(payload.state.businessName),
      business_context: payload.strategyContract && payload.strategyContract.business_context ? payload.strategyContract.business_context : {},
      conversion_strategy: payload.strategyContract && payload.strategyContract.conversion_strategy ? payload.strategyContract.conversion_strategy : {},
      asset_policy: payload.strategyContract && payload.strategyContract.asset_policy ? payload.strategyContract.asset_policy : {},
      visual_strategy: payload.strategyContract && payload.strategyContract.visual_strategy ? payload.strategyContract.visual_strategy : {},
      seeded_state_excerpt: buildStateExcerpt(payload.state),
      fallback_question: fallback,
      output_shape: {
        content: "",
        intent: buildIntentForKey(payload.currentKey),
        quick_replies: []
      }
    },
    null,
    2
  );

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: "Bearer " + apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: cleanString(env && env.OPENAI_MODEL) || "gpt-4.1-mini",
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!res.ok) return fallback;

    const out = await res.json();
    const content =
      out &&
      out.choices &&
      out.choices[0] &&
      out.choices[0].message &&
      typeof out.choices[0].message.content === "string"
        ? out.choices[0].message.content
        : "{}";

    const parsed = JSON.parse(content || "{}");
    const questionText = cleanString(parsed.content);

    if (!questionText) return fallback;

    return {
      type: "question",
      content: questionText,
      intent: cleanString(parsed.intent) || buildIntentForKey(payload.currentKey),
      quick_replies: normalizeQuickReplies(parsed.quick_replies, fallback.quick_replies)
    };
  } catch (_err) {
    return fallback;
  }
}

/* =========================
   Queue + verification keys
========================= */

function getPriorityVerificationQueue(state) {
  const strategy = getStrategyContract(state);
  if (!strategy) return [];

  var queue = [];

  cleanList(strategy.content_requirements && strategy.content_requirements.must_verify_now).forEach(function(item) {
    const key = normalizeVerificationKey(item);
    if (key) queue.push(key);
  });

  cleanList(strategy.content_requirements && strategy.content_requirements.must_collect_paid_phase).forEach(function(item) {
    const key = normalizeVerificationKey(item);
    if (key) queue.push(key);
  });

  if (!cleanString(state.answers.target_audience)) queue.push("target_audience");
  if (!cleanString(state.answers.primary_conversion_goal)) queue.push("primary_conversion_goal");

  const toggles = strategy.schema_toggles || {};
  if (toggles.show_features) queue.push("offer_structure");
  if (toggles.show_testimonials || toggles.show_trustbar) queue.push("trust_proof");
  if (toggles.show_about) {
    queue.push("owner_background");
    queue.push("experience_years");
  }
  if (toggles.show_process) queue.push("service_process");
  if (toggles.show_service_area) queue.push("service_area");
  if (toggles.show_faqs) queue.push("faq_objections");
  if (toggles.show_gallery) queue.push("visual_direction");

  if (cleanString(strategy.conversion_strategy && strategy.conversion_strategy.cta_destination) === "booking_url") {
    queue.push("booking_url");
  }

  queue.push("booking_method");
  queue.push("pricing_context");
  queue.push("contact_path");

  return uniqueList(queue);
}

function getCurrentVerificationKey(state, queueOpt) {
  const queue = Array.isArray(queueOpt) ? queueOpt : getPriorityVerificationQueue(state);
  for (var i = 0; i < queue.length; i += 1) {
    if (!isVerificationFieldSatisfied(state, queue[i])) return queue[i];
  }
  return "";
}

function buildVerificationState(state, queueOpt, currentKeyOpt) {
  const queue = Array.isArray(queueOpt) ? queueOpt : getPriorityVerificationQueue(state);
  const currentKey = currentKeyOpt !== undefined ? currentKeyOpt : getCurrentVerificationKey(state, queue);
  const completed = [];
  const remaining = [];

  queue.forEach(function(key) {
    if (isVerificationFieldSatisfied(state, key)) {
      completed.push(key);
    } else {
      remaining.push(key);
    }
  });

  return {
    queue: queue,
    current_key: currentKey,
    completed_keys: completed,
    remaining_keys: remaining,
    queue_complete: remaining.length === 0,
    evidence: isObject(state.verification && state.verification.evidence) ? state.verification.evidence : {}
  };
}

function normalizeVerificationKey(value) {
  const v = cleanString(value).toLowerCase();
  if (!v) return "";

  if (v.indexOf("audience") !== -1 || v.indexOf("persona") !== -1) return "target_audience";
  if (v.indexOf("conversion") !== -1 || v.indexOf("cta") !== -1 || v.indexOf("book now") !== -1 || v.indexOf("inquiry") !== -1) return "primary_conversion_goal";
  if (v.indexOf("pricing") !== -1 || v.indexOf("price") !== -1 || v.indexOf("package tier") !== -1) return "pricing_context";
  if (v.indexOf("package") !== -1 || v.indexOf("service") !== -1 || v.indexOf("offer") !== -1 || v.indexOf("feature") !== -1) return "offer_structure";
  if (v.indexOf("booking url") !== -1 || v === "url") return "booking_url";
  if (v.indexOf("booking") !== -1) return "booking_method";
  if (v.indexOf("phone") !== -1 || v.indexOf("contact path") !== -1 || v.indexOf("email") !== -1) return "contact_path";
  if (v.indexOf("service area") !== -1 || v.indexOf("location") !== -1 || v.indexOf("city") !== -1) return "service_area";
  if (v.indexOf("testimonial") !== -1 || v.indexOf("review") !== -1 || v.indexOf("trust") !== -1 || v.indexOf("credibility") !== -1 || v.indexOf("guarantee") !== -1) return "trust_proof";
  if (v.indexOf("owner") !== -1 || v.indexOf("founder") !== -1 || v.indexOf("about") !== -1 || v.indexOf("background") !== -1 || v.indexOf("bio") !== -1) return "owner_background";
  if (v.indexOf("year") !== -1 || v.indexOf("experience") !== -1) return "experience_years";
  if (v.indexOf("process") !== -1 || v.indexOf("how it works") !== -1 || v.indexOf("workflow") !== -1 || v.indexOf("steps") !== -1) return "service_process";
  if (v.indexOf("faq") !== -1 || v.indexOf("objection") !== -1 || v.indexOf("concern") !== -1 || v.indexOf("question") !== -1) return "faq_objections";
  if (v.indexOf("photo") !== -1 || v.indexOf("image") !== -1 || v.indexOf("gallery") !== -1 || v.indexOf("visual") !== -1) return "visual_direction";

  return "";
}

function getAllowedFieldTargetsForKey(key) {
  switch (key) {
    case "target_audience":
      return ["answers.target_audience"];
    case "primary_conversion_goal":
      return ["answers.primary_conversion_goal"];
    case "offer_structure":
      return ["answers.offerings"];
    case "pricing_context":
      return ["answers.pricing_context"];
    case "booking_method":
      return ["answers.booking_method"];
    case "booking_url":
      return ["answers.booking_url"];
    case "contact_path":
      return ["answers.phone", "answers.booking_url", "clientEmail"];
    case "service_area":
      return ["answers.service_area", "answers.location_context", "answers.office_address"];
    case "trust_proof":
      return ["answers.trust_signals", "answers.credibility_factors", "answers.differentiators"];
    case "owner_background":
      return ["ghostwritten.about_summary"];
    case "experience_years":
      return ["answers.experience_years"];
    case "service_process":
      return ["answers.process_notes"];
    case "faq_objections":
      return ["answers.common_objections", "answers.faq_topics"];
    case "visual_direction":
      return ["answers.visual_direction"];
    default:
      return [];
  }
}

function isVerificationFieldSatisfied(state, key) {
  const answers = state.answers || {};
  const ghostwritten = state.ghostwritten || {};

  switch (key) {
    case "target_audience":
      return Boolean(cleanString(answers.target_audience));
    case "primary_conversion_goal":
      return Boolean(cleanString(answers.primary_conversion_goal));
    case "offer_structure":
      return cleanList(answers.offerings).length > 0;
    case "pricing_context":
      return Boolean(cleanString(answers.pricing_context));
    case "booking_method":
      return Boolean(cleanString(answers.booking_method));
    case "booking_url":
      return Boolean(cleanString(answers.booking_url));
    case "contact_path":
      return Boolean(cleanString(answers.phone) || cleanString(answers.booking_url) || cleanString(state.clientEmail));
    case "service_area":
      return Boolean(cleanString(answers.service_area) || cleanString(answers.location_context) || cleanString(answers.office_address));
    case "trust_proof":
      return cleanList(answers.trust_signals).length > 0 || cleanList(answers.credibility_factors).length > 0 || cleanList(answers.differentiators).length > 0;
    case "owner_background":
      return Boolean(cleanString(ghostwritten.about_summary));
    case "experience_years":
      return Boolean(cleanString(answers.experience_years));
    case "service_process":
      return cleanList(answers.process_notes).length > 0;
    case "faq_objections":
      return cleanList(answers.common_objections).length > 0 || cleanList(answers.faq_topics).length > 0;
    case "visual_direction":
      return Boolean(cleanString(answers.visual_direction));
    default:
      return false;
  }
}

/* =========================
   Scoped mutation
========================= */

function applyScopedFieldUpdates(state, key, proposedUpdates, latestUserMessage) {
  const next = normalizeState(state);
  const allowedTargets = getAllowedFieldTargetsForKey(key);
  const scoped = sanitizeScopedUpdates(proposedUpdates, allowedTargets);

  applyFieldPathUpdates(next, scoped);
  applyDeterministicFallback(next, key, latestUserMessage, scoped);

  return normalizeState(next);
}

function sanitizeScopedUpdates(proposedUpdates, allowedTargets) {
  const out = {};
  const source = isObject(proposedUpdates) ? proposedUpdates : {};

  allowedTargets.forEach(function(path) {
    const value = getByPath(source, path);
    if (value !== undefined) {
      setByPath(out, path, value);
    }
  });

  return out;
}

function applyFieldPathUpdates(target, scopedUpdates) {
  flattenObject(scopedUpdates).forEach(function(entry) {
    setByPath(target, entry.path, entry.value);
  });
}

function applyDeterministicFallback(state, key, latestUserMessage, scopedUpdates) {
  const text = cleanString(latestUserMessage);
  if (!text) return;

  switch (key) {
    case "target_audience":
      if (!cleanString(state.answers.target_audience)) state.answers.target_audience = text;
      break;

    case "primary_conversion_goal":
      if (!cleanString(state.answers.primary_conversion_goal)) {
        state.answers.primary_conversion_goal = normalizePrimaryConversionGoal(text);
      }
      break;

    case "offer_structure":
      if (cleanList(getByPath(scopedUpdates, "answers.offerings")).length === 0) {
        state.answers.offerings = uniqueList(cleanList(state.answers.offerings).concat(splitOfferings(text)));
      }
      break;

    case "pricing_context":
      if (!cleanString(state.answers.pricing_context)) state.answers.pricing_context = text;
      break;

    case "booking_method":
      if (!cleanString(state.answers.booking_method)) {
        state.answers.booking_method = normalizeBookingMethod(text);
      }
      break;

    case "booking_url":
      if (!cleanString(state.answers.booking_url) && looksLikeUrl(text)) {
        state.answers.booking_url = normalizeUrl(text);
      }
      break;

    case "contact_path":
      if (!cleanString(state.answers.booking_url)) {
        const urls = extractUrls(text);
        if (urls.length) state.answers.booking_url = normalizeUrl(urls[0]);
      }
      if (!cleanString(state.answers.phone)) {
        const phone = extractPhone(text);
        if (phone) state.answers.phone = phone;
      }
      if (!cleanString(state.clientEmail)) {
        const email = extractEmail(text);
        if (email) state.clientEmail = email;
      }
      break;

    case "service_area":
      if (!cleanString(state.answers.service_area)) state.answers.service_area = text;
      if (!cleanString(state.answers.location_context) && text.length > 24) {
        state.answers.location_context = text;
      }
      break;

    case "trust_proof":
      if (cleanList(state.answers.trust_signals).length === 0) {
        state.answers.trust_signals = uniqueList(splitSentenceList(text).slice(0, 4));
      } else if (cleanList(state.answers.credibility_factors).length === 0) {
        state.answers.credibility_factors = uniqueList(splitSentenceList(text).slice(0, 4));
      }
      break;

    case "owner_background":
      if (!cleanString(state.ghostwritten.about_summary)) state.ghostwritten.about_summary = text;
      break;

    case "experience_years":
      if (!cleanString(state.answers.experience_years)) {
        state.answers.experience_years = extractYearsExpression(text) || text;
      }
      break;

    case "service_process":
      if (cleanList(state.answers.process_notes).length === 0) {
        const steps = splitProcessSteps(text);
        state.answers.process_notes = steps.length ? steps : splitSentenceList(text);
      }
      break;

    case "faq_objections":
      if (cleanList(state.answers.common_objections).length === 0) {
        state.answers.common_objections = uniqueList(splitSentenceList(text));
      }
      break;

    case "visual_direction":
      if (!cleanString(state.answers.visual_direction)) state.answers.visual_direction = text;
      break;
  }
}

function markVerificationEvidence(state, key, latestUserMessage, interpreterResult) {
  const next = normalizeState(state);
  next.verification = isObject(next.verification) ? next.verification : {};
  next.verification.evidence = isObject(next.verification.evidence) ? next.verification.evidence : {};
  next.verification.evidence[key] = {
    latest_answer: cleanString(latestUserMessage),
    updated_at: new Date().toISOString(),
    confidence: Number(interpreterResult && interpreterResult.confidence ? interpreterResult.confidence : 0),
    notes: cleanString(interpreterResult && interpreterResult.notes ? interpreterResult.notes : "")
  };
  return next;
}

function appendRawAnswerLog(state, entry) {
  const next = normalizeState(state);
  next.answer_log = Array.isArray(next.answer_log) ? next.answer_log : [];
  next.answer_log.push({
    key: cleanString(entry.key),
    answer: cleanString(entry.answer),
    ui_action: cleanString(entry.ui_action),
    interpreted_at: cleanString(entry.interpreted_at),
    interpreter_confidence: Number(entry.interpreter_confidence || 0)
  });
  return next;
}

/* =========================
   Readiness + summary
========================= */

function evaluateReadiness(state, verificationOpt) {
  const verification = verificationOpt || buildVerificationState(state);
  const answers = state.answers || {};
  const missingDomains = [];

  const hasPurpose = Boolean(cleanString(answers.why_now) || cleanString(answers.desired_outcome));
  const hasAudience = Boolean(cleanString(answers.target_audience));
  const hasOffer = cleanList(answers.offerings).length > 0;
  const hasCta = Boolean(cleanString(answers.primary_conversion_goal));
  const hasContact = Boolean(cleanString(state.clientEmail) || cleanString(answers.phone) || cleanString(answers.booking_url));
  const hasBuyerIntel = cleanList(answers.buyer_decision_factors).length > 0 || cleanList(answers.common_objections).length > 0;
  const hasTrust = cleanList(answers.trust_signals).length > 0 || cleanList(answers.credibility_factors).length > 0 || cleanList(answers.differentiators).length > 0;
  const hasLocation = Boolean(cleanString(answers.service_area) || cleanString(answers.office_address) || cleanString(answers.location_context));

  if (!hasPurpose) missingDomains.push("business_purpose");
  if (!hasAudience) missingDomains.push("target_audience");
  if (!hasOffer) missingDomains.push("primary_offer");
  if (!hasCta) missingDomains.push("cta_direction");
  if (!hasContact) missingDomains.push("contact_path");
  if (!hasBuyerIntel) missingDomains.push("buyer_intelligence");
  if (!hasTrust) missingDomains.push("trust_signals");

  const scoreParts = [hasPurpose, hasAudience, hasOffer, hasCta, hasContact, hasBuyerIntel, hasTrust, hasLocation];
  const score = scoreParts.filter(Boolean).length / scoreParts.length;

  return {
    score: score,
    required_domains_complete: missingDomains.length === 0,
    missing_domains: missingDomains,
    queue_complete: Boolean(verification.queue_complete),
    remaining_verification_items: cleanList(verification.remaining_keys),
    can_generate_now: Boolean(verification.queue_complete && missingDomains.length === 0)
  };
}

function computeMissingInformation(state, verificationOpt) {
  const verification = verificationOpt || buildVerificationState(state);
  const missing = [];

  cleanList(verification.remaining_keys).forEach(function(item) {
    missing.push(item);
  });

  const answers = state.answers || {};
  if (!cleanString(answers.why_now) && !cleanString(answers.desired_outcome)) missing.push("business_purpose");
  if (!cleanString(answers.target_audience)) missing.push("target_audience");
  if (cleanList(answers.offerings).length === 0) missing.push("primary_offer");
  if (!cleanString(answers.primary_conversion_goal)) missing.push("cta_direction");
  if (!cleanString(state.clientEmail) && !cleanString(answers.phone) && !cleanString(answers.booking_url)) missing.push("contact_path");
  if (cleanList(answers.buyer_decision_factors).length === 0 && cleanList(answers.common_objections).length === 0) missing.push("buyer_intelligence");
  if (cleanList(answers.trust_signals).length === 0 && cleanList(answers.credibility_factors).length === 0 && cleanList(answers.differentiators).length === 0) missing.push("trust_signals");

  return uniqueList(missing);
}

function buildSummaryPanel(state, verificationOpt) {
  const verification = verificationOpt || buildVerificationState(state);

  return {
    business_name: cleanString(state.businessName),
    audience: cleanString(state.answers.target_audience),
    primary_offer: cleanList(state.answers.offerings),
    conversion_goal: cleanString(state.answers.primary_conversion_goal),
    booking_method: cleanString(state.answers.booking_method),
    service_area: cleanString(state.answers.service_area),
    suggested_vibe: cleanString(state.inference.suggested_vibe),
    suggested_components: cleanList(state.inference.suggested_components),
    trust_signals: cleanList(state.answers.trust_signals),
    visual_direction: cleanString(state.answers.visual_direction),
    process_notes: cleanList(state.answers.process_notes),
    experience_years: cleanString(state.answers.experience_years),
    verification_queue: cleanList(verification.queue),
    current_verification_key: cleanString(verification.current_key),
    remaining_verification_items: cleanList(verification.remaining_keys),
    missing_information: cleanList(state.inference.missing_information)
  };
}

/* =========================
   Specialist profile
========================= */

async function ensureSpecialistProfile(_env, state, latestUserMessage) {
  const existing =
    (state.provenance && state.provenance.specialist_profile) ||
    (state.inference && state.inference.specialist_profile);

  if (isObject(existing) && cleanString(existing.category_guess)) {
    return existing;
  }

  const strategy = getStrategyContract(state);
  const offerText = cleanList(state.answers.offerings).join(", ");

  return {
    category_guess:
      cleanString(strategy && strategy.business_context && strategy.business_context.category) ||
      offerText ||
      cleanString(latestUserMessage) ||
      "local service business",
    archetype:
      cleanString(strategy && strategy.business_context && strategy.business_context.strategic_archetype) ||
      "conversion_focused_local_business",
    business_model: cleanString(strategy && strategy.business_context && strategy.business_context.business_model),
    tone_bias:
      cleanString(state.answers.tone_preferences) ||
      cleanString(state.inference.tone_direction) ||
      "confident, clear, and trustworthy",
    question_bias: inferQuestionBiasFromStrategy(strategy)
  };
}

function inferQuestionBiasFromStrategy(strategy) {
  const toggles = strategy && strategy.schema_toggles ? strategy.schema_toggles : {};
  const out = [];
  if (toggles.show_features) out.push("offer clarity");
  if (toggles.show_testimonials || toggles.show_trustbar) out.push("trust proof");
  if (toggles.show_process) out.push("process clarity");
  if (toggles.show_gallery) out.push("visual direction");
  if (toggles.show_faqs) out.push("objection handling");
  if (toggles.show_service_area) out.push("location clarity");
  if (toggles.show_about) out.push("business identity");
  return out;
}

function seedInferenceFromSpecialistProfile(state, specialistProfile) {
  const next = normalizeState(state);
  next.inference.specialist_profile = specialistProfile;

  if (!cleanString(next.inference.tone_direction) && cleanString(specialistProfile.tone_bias)) {
    next.inference.tone_direction = cleanString(specialistProfile.tone_bias);
  }

  if ((!Array.isArray(next.inference.suggested_components) || next.inference.suggested_components.length === 0) &&
      isObject(next.provenance && next.provenance.strategy_contract && next.provenance.strategy_contract.schema_toggles)) {
    next.inference.suggested_components = schemaToggleKeysToComponents(next.provenance.strategy_contract.schema_toggles);
  }

  return next;
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

  const out = [];
  Object.keys(map).forEach(function(key) {
    if (schemaToggles && schemaToggles[key]) out.push(map[key]);
  });
  return out;
}

/* =========================
   Questions
========================= */

function buildFallbackQuestion(key, state, strategyContract) {
  const businessName = cleanString(state.businessName) || "your business";
  const firstOffer = cleanList(state.answers.offerings)[0] || "your main offer";
  const usesPreviewImages = Boolean(
    strategyContract &&
    strategyContract.asset_policy &&
    strategyContract.asset_policy.client_assets_required_for_preview === false
  );

  switch (key) {
    case "target_audience":
      return createQuestionMessage(
        "We already have a starting direction for " + businessName + ". Who do you most want this site to attract first?",
        buildIntentForKey(key)
      );

    case "primary_conversion_goal":
      return createQuestionMessage(
        "What is the main action you want visitors to take first — book, call, request a quote, or send an inquiry?",
        buildIntentForKey(key),
        quickReplies(["Book now", "Call now", "Request quote", "Send inquiry"])
      );

    case "offer_structure":
      return createQuestionMessage(
        "We already have " + firstOffer + " as the starting point. What are the 2–3 services, packages, or offers you most want featured first?",
        buildIntentForKey(key)
      );

    case "pricing_context":
      return createQuestionMessage(
        "How should pricing work on the site for " + businessName + " — exact prices, starting prices, package tiers, or inquiry-first?",
        buildIntentForKey(key),
        quickReplies(["Exact prices", "Starting prices", "Package tiers", "Inquiry first"])
      );

    case "booking_method":
      return createQuestionMessage(
        "What should visitors do to take the next step — use a booking link, call, send an inquiry, or a mix?",
        buildIntentForKey(key),
        quickReplies(["Booking link", "Phone", "Inquiry form", "A mix"])
      );

    case "booking_url":
      return createQuestionMessage(
        "What booking link should we use for the main call to action? If you do not have one yet, say that.",
        buildIntentForKey(key)
      );

    case "contact_path":
      return createQuestionMessage(
        "What contact path should we feature most prominently — phone, booking link, email, or a mix?",
        buildIntentForKey(key)
      );

    case "service_area":
      return createQuestionMessage(
        "What exact cities, neighborhoods, or nearby areas should the site make clear you serve?",
        buildIntentForKey(key)
      );

    case "trust_proof":
      return createQuestionMessage(
        "What would make a new customer trust you faster — reviews, guarantees, process quality, certifications, experience, or something else we should highlight?",
        buildIntentForKey(key)
      );

    case "owner_background":
      return createQuestionMessage(
        "What should we say about the person or business behind this? Even a rough sentence is enough and we can shape it into strong copy.",
        buildIntentForKey(key)
      );

    case "experience_years":
      return createQuestionMessage(
        "About how many years have you been doing this work? A rough answer like 5+, 10+, or 20+ is fine.",
        buildIntentForKey(key)
      );

    case "service_process":
      return createQuestionMessage(
        "How does working with you usually go from first contact to finished service? A simple step-by-step answer is perfect.",
        buildIntentForKey(key),
        [
          { label: "Inquiry → estimate → service", action: "quick_reply" },
          { label: "Booking → arrival → service", action: "quick_reply" },
          { label: "Consultation → proposal → delivery", action: "quick_reply" },
          { label: "I’ll type it out", action: "quick_reply" }
        ]
      );

    case "faq_objections":
      return createQuestionMessage(
        "What questions or objections do people usually have before they book or buy?",
        buildIntentForKey(key)
      );

    case "visual_direction":
      return createQuestionMessage(
        usesPreviewImages
          ? "For the first preview, what should the site visually emphasize most — the main service moment, before-and-after results, people enjoying the experience, close-up craftsmanship, or something else?"
          : "What should the site visually emphasize most in the hero and gallery?",
        buildIntentForKey(key),
        quickReplies(["Hero moment", "Results / proof", "People / experience", "A focused mix"])
      );

    default:
      return createQuestionMessage(
        "What is the clearest detail we should verify next for the preview?",
        buildIntentForKey(key)
      );
  }
}

function createQuestionMessage(content, intent, quick_replies) {
  return {
    type: "question",
    content: cleanString(content),
    intent: cleanString(intent),
    quick_replies: Array.isArray(quick_replies) ? quick_replies : []
  };
}

function createTransitionMessage(content, intent, quick_replies) {
  return {
    type: "transition",
    content: cleanString(content),
    intent: cleanString(intent),
    quick_replies: Array.isArray(quick_replies) ? quick_replies : []
  };
}

function buildIntentForKey(key) {
  return key ? "verify_" + key : "continue";
}

function quickReplies(labels) {
  return labels.map(function(label) {
    return { label: label, action: "quick_reply" };
  });
}

function normalizeQuickReplies(value, fallback) {
  if (!Array.isArray(value) || value.length === 0) {
    return Array.isArray(fallback) ? fallback : [];
  }

  return value
    .map(function(item) {
      if (!isObject(item)) return null;
      return {
        label: cleanString(item.label),
        action: cleanString(item.action) || "quick_reply"
      };
    })
    .filter(Boolean);
}

/* =========================
   State access + normalize
========================= */

function getStrategyContract(state) {
  return (state.provenance && state.provenance.strategy_contract) ||
         (state.inference && state.inference.strategy_contract) ||
         null;
}

function buildStateExcerpt(state) {
  return {
    answers: {
      target_audience: cleanString(state.answers.target_audience),
      offerings: cleanList(state.answers.offerings),
      primary_conversion_goal: cleanString(state.answers.primary_conversion_goal),
      booking_method: cleanString(state.answers.booking_method),
      phone: cleanString(state.answers.phone),
      booking_url: cleanString(state.answers.booking_url),
      service_area: cleanString(state.answers.service_area),
      trust_signals: cleanList(state.answers.trust_signals),
      credibility_factors: cleanList(state.answers.credibility_factors),
      process_notes: cleanList(state.answers.process_notes),
      visual_direction: cleanString(state.answers.visual_direction),
      pricing_context: cleanString(state.answers.pricing_context),
      experience_years: cleanString(state.answers.experience_years)
    },
    ghostwritten: {
      about_summary: cleanString(state.ghostwritten.about_summary)
    },
    clientEmail: cleanString(state.clientEmail)
  };
}

function normalizeState(state) {
  const next = clone(isObject(state) ? state : EMPTY_INTAKE_STATE);

  next.answers = Object.assign({}, clone(EMPTY_INTAKE_STATE.answers), isObject(next.answers) ? next.answers : {});
  next.inference = Object.assign({}, clone(EMPTY_INTAKE_STATE.inference), isObject(next.inference) ? next.inference : {});
  next.ghostwritten = Object.assign({}, clone(EMPTY_INTAKE_STATE.ghostwritten), isObject(next.ghostwritten) ? next.ghostwritten : {});
  next.provenance = Object.assign({}, clone(EMPTY_INTAKE_STATE.provenance), isObject(next.provenance) ? next.provenance : {});
  next.verification = Object.assign({}, clone(EMPTY_INTAKE_STATE.verification), isObject(next.verification) ? next.verification : {});

  next.answers.offerings = cleanList(next.answers.offerings);
  next.answers.differentiators = cleanList(next.answers.differentiators);
  next.answers.trust_signals = cleanList(next.answers.trust_signals);
  next.answers.credibility_factors = cleanList(next.answers.credibility_factors);
  next.answers.buyer_decision_factors = cleanList(next.answers.buyer_decision_factors);
  next.answers.common_objections = cleanList(next.answers.common_objections);
  next.answers.red_flags_to_avoid = cleanList(next.answers.red_flags_to_avoid);
  next.answers.process_notes = cleanList(next.answers.process_notes);
  next.answers.faq_topics = cleanList(next.answers.faq_topics);

  next.inference.suggested_components = cleanList(next.inference.suggested_components);
  next.inference.missing_information = cleanList(next.inference.missing_information);

  next.clientEmail = cleanString(next.clientEmail);
  next.businessName = cleanString(next.businessName);
  next.slug = cleanString(next.slug);
  next.phase = cleanString(next.phase) || "guided_enrichment";
  next.last_intent = cleanString(next.last_intent);
  next.session_id = cleanString(next.session_id);
  next.conversation = Array.isArray(next.conversation) ? next.conversation : [];
  next.answer_log = Array.isArray(next.answer_log) ? next.answer_log : [];

  return next;
}

/* =========================
   Utilities
========================= */

async function readJson(request) {
  try {
    return await request.json();
  } catch (_err) {
    return {};
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(function(item) { return cleanString(item); }).filter(Boolean);
}

function uniqueList(list) {
  return Array.from(new Set(cleanList(list)));
}

function splitOfferings(text) {
  return cleanString(text)
    .split(/\n|,|;|\//g)
    .map(function(item) { return cleanString(item); })
    .filter(Boolean);
}

function splitSentenceList(text) {
  return cleanString(text)
    .split(/\n|,|;|\./g)
    .map(function(item) { return cleanString(item); })
    .filter(Boolean);
}

function splitProcessSteps(text) {
  return cleanString(text)
    .split(/\n|->|→|,|;|\./g)
    .map(function(item) { return cleanString(item); })
    .filter(Boolean);
}

function normalizePrimaryConversionGoal(text) {
  const lower = cleanString(text).toLowerCase();
  if (/book/.test(lower)) return "book_now";
  if (/call|phone/.test(lower)) return "call_now";
  if (/quote|estimate/.test(lower)) return "request_quote";
  if (/inquiry|enquiry|form|contact/.test(lower)) return "submit_inquiry";
  return rawSlug(lower) || cleanString(text);
}

function normalizeBookingMethod(text) {
  const lower = cleanString(text).toLowerCase();
  if (/external|booking link|book online|scheduler|calendar/.test(lower)) return "external_booking";
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

function looksLikeUrl(text) {
  const value = cleanString(text);
  return /^https?:\/\//i.test(value) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value);
}

function normalizeUrl(value) {
  const url = cleanString(value);
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

function extractUrls(text) {
  const matches = cleanString(text).match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s,]*)?/gi);
  return Array.isArray(matches) ? matches.map(normalizeUrl) : [];
}

function extractPhone(text) {
  const match = cleanString(text).match(/(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/);
  return match ? cleanString(match[0]) : "";
}

function extractEmail(text) {
  const match = cleanString(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? cleanString(match[0]) : "";
}

function extractYearsExpression(text) {
  const raw = cleanString(text);
  const plusMatch = raw.match(/\b\d+\+\b/);
  if (plusMatch) return plusMatch[0];
  const yearMatch = raw.match(/\b\d{1,2}\s*(?:years?|yrs?)\b/i);
  if (yearMatch) return yearMatch[0];
  return "";
}

function getByPath(obj, path) {
  if (!isObject(obj) || !cleanString(path)) return undefined;

  const parts = cleanString(path).split(".");
  let cursor = obj;

  for (let i = 0; i < parts.length; i += 1) {
    if (cursor === undefined || cursor === null) return undefined;
    cursor = cursor[parts[i]];
  }

  return cursor;
}

function setByPath(obj, path, value) {
  const parts = cleanString(path).split(".").filter(Boolean);
  if (!parts.length) return;

  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!isObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = normalizeValueForPath(path, value);
}

function normalizeValueForPath(path, value) {
  if (
    path === "answers.offerings" ||
    path === "answers.trust_signals" ||
    path === "answers.credibility_factors" ||
    path === "answers.differentiators" ||
    path === "answers.common_objections" ||
    path === "answers.faq_topics"
  ) {
    if (Array.isArray(value)) return uniqueList(value);
    return uniqueList(splitSentenceList(cleanString(value)));
  }

  if (path === "answers.process_notes") {
    if (Array.isArray(value)) return uniqueList(value);
    return uniqueList(splitProcessSteps(cleanString(value)));
  }

  if (path === "answers.booking_method") {
    return normalizeBookingMethod(cleanString(value));
  }

  if (path === "answers.primary_conversion_goal") {
    return normalizePrimaryConversionGoal(cleanString(value));
  }

  if (path === "answers.booking_url") {
    const stringValue = cleanString(value);
    return looksLikeUrl(stringValue) ? normalizeUrl(stringValue) : stringValue;
  }

  return typeof value === "string" ? cleanString(value) : value;
}

function flattenObject(obj, prefix) {
  if (!isObject(obj)) return [];

  let out = [];
  Object.keys(obj).forEach(function(key) {
    const value = obj[key];
    const path = prefix ? prefix + "." + key : key;
    if (isObject(value)) {
      out = out.concat(flattenObject(value, path));
    } else {
      out.push({ path: path, value: value });
    }
  });

  return out;
}