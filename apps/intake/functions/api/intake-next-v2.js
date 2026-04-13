/**
 * SITEFORGE FACTORY — intake-next-v2-1.js
 *
 * Schema-guided, component-first intake engine.
 * ------------------------------------------------------------
 * Responsibilities:
 * - Accept user answer + current intake state
 * - Use AI for interpretation and optional copy refinement
 * - Use code for validation, routing, planning, and draft synchronization
 * - Treat ALL schema components as first-class runtime objects
 * - Produce build-useful hero/gallery image strategy
 * - Avoid repeated-question loops
 *
 * Output:
 * { ok, message, state }
 */

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

const ALLOWED_ICON_TOKENS = [
  "zap",
  "cpu",
  "layers",
  "rocket",
  "leaf",
  "sprout",
  "sun",
  "scissors",
  "truck",
  "hammer",
  "wrench",
  "trash",
  "sparkles",
  "heart",
  "award",
  "users",
  "map",
  "shield",
  "star",
  "check",
  "coins",
  "briefcase",
  "clock",
  "phone"
];

/* ========================================================================
 * Cloudflare Handlers
 * ====================================================================== */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await readJson(request);
    const userAnswer = cleanString(body.answer);
    const incomingState = normalizeState(deepClone(body.state || {}));

    if (!incomingState.provenance?.strategy_contract) {
      throw new Error("Missing strategy_contract - run intake-start-v2 first");
    }

    if (!isObject(incomingState.blueprint)) {
      throw new Error("Missing blueprint - run intake-start-v2 first");
    }

    if (!userAnswer) {
      return json({ ok: false, error: "Missing answer" }, 400);
    }

    const state = normalizeState(incomingState);
    state.conversation.push({
      role: "user",
      content: userAnswer
    });

    const blueprint = normalizeBlueprint(state.blueprint);
    const currentPlan = isObject(blueprint.question_plan) ? blueprint.question_plan : {};
    const schemaGuide = compileSchemaGuide(blueprint, state);

    const interpretation = await interpretUserAnswer({
      env,
      answer: userAnswer,
      blueprint,
      state,
      schemaGuide,
      currentPlan
    });

    const routed = routeInterpretationToEvidence({
      blueprint,
      state,
      schemaGuide,
      interpretation,
      answer: userAnswer
    });

    const recomputed = recomputeBlueprint({
      blueprint: routed.blueprint,
      state,
      schemaGuide,
      previousPlan: currentPlan,
      lastAudit: routed.audit
    });

    state.blueprint = {
      ...recomputed.blueprint,
      schema_guide: schemaGuide,
      last_answer: {
        text: userAnswer,
        bundle_id: cleanString(currentPlan.bundle_id),
        primary_field: cleanString(currentPlan.primary_field),
        timestamp: new Date().toISOString()
      },
      last_interpretation: routed.audit
    };

    syncCompatibilityMirrors(state);
    state.readiness = evaluateBlueprintReadiness(state.blueprint);

    const combinedAnswerForReinforcement =
      `${userAnswer} ${cleanString(routed.audit?.answer_summary)}`.trim();
    const reinforcementEval = evaluatePositiveReinforcement({
      combinedAnswer: combinedAnswerForReinforcement,
      preflightIntelligence: state.preflight_intelligence,
      lastTurnReinforcementSource: cleanString(state.meta?.last_turn_reinforcement_source)
    });
    state.reinforcement = reinforcementEval
      ? {
          type: reinforcementEval.type,
          message: reinforcementEval.message,
          source: reinforcementEval.source
        }
      : null;
    state.meta = isObject(state.meta) ? state.meta : {};
    state.meta.last_turn_reinforcement_source = reinforcementEval ? reinforcementEval.source : null;

    state.phase = state.readiness.can_generate_now ? "intake_complete" : "blueprint_verify";
    state.action = state.readiness.can_generate_now ? "complete" : "continue";
    if (state.action === "complete") {
      state.blueprint.question_plan = null;
    }
    state.current_key = cleanString(state.blueprint.question_plan?.primary_field);

    let assistantMessage = "";
    let questionRenderMeta = {
      fallback_triggered: false,
      llm_available: !!env?.OPENAI_API_KEY,
      question_source: "intake_complete",
      fallback_reason: null,
      preflight_bridge_framing: null,
      question_render_mode: null
    };

    if (state.action === "complete") {
      assistantMessage = buildCompletionMessage(state.businessName, state.readiness);
    } else {
      const rendered = await renderNextQuestion({
        env,
        blueprint: state.blueprint,
        previousPlan: currentPlan,
        interpretation: routed.audit,
        businessName: state.businessName,
        preflightIntelligence: state.preflight_intelligence
      });
      assistantMessage = rendered.message;
      questionRenderMeta = {
        fallback_triggered: rendered.fallback_triggered,
        llm_available: rendered.llm_available,
        question_source: rendered.question_source,
        fallback_reason: rendered.fallback_reason ?? null,
        preflight_bridge_framing: rendered.preflight_bridge_framing ?? null,
        question_render_mode: rendered.question_render_mode ?? "rephrase_only"
      };
    }

    assistantMessage = appendReinforcementToAssistantMessage(state.reinforcement, assistantMessage);

    state.conversation.push({
      role: "assistant",
      content: assistantMessage
    });

    const answeredPf = cleanString(currentPlan.primary_field);
    const pr = state.blueprint.premium_readiness;
    const ar = state.blueprint.access_readiness;
    state.turn_debug = {
      answered_primary_field: answeredPf || null,
      primary_satisfied_after_answer: answeredPf
        ? isFieldSatisfied(answeredPf, state.blueprint.fact_registry)
        : null,
      next_primary_field: cleanString(state.blueprint.question_plan?.primary_field) || null,
      next_bundle_id: cleanString(state.blueprint.question_plan?.bundle_id) || null,
      updated_fact_keys: cleanList(routed.audit?.updated_fact_keys),
      secondary_updated_keys: cleanList(routed.audit?.secondary_updated_keys),
      primary_field_updated: !!routed.audit?.primary_field_updated,
      fallback_triggered: questionRenderMeta.fallback_triggered,
      llm_available: questionRenderMeta.llm_available,
      question_source: questionRenderMeta.question_source,
      fallback_reason: questionRenderMeta.fallback_reason,
      preflight_bridge_framing: questionRenderMeta.preflight_bridge_framing ?? null,
      preflight_intelligence_keys: listPreflightIntelligenceKeys(state.preflight_intelligence),
      question_render_mode: questionRenderMeta.question_render_mode ?? null,
      reinforcement_triggered: !!state.reinforcement,
      reinforcement_type: state.reinforcement ? "alignment" : null,
      reinforcement_source: state.reinforcement?.source ?? null,
      premium_next_unlock: pr?.next_unlock || null,
      premium_avg_score: pr?.summary?.avg_score ?? null,
      access_model: ar?.model ?? null,
      access_satisfied: ar?.satisfied ?? null,
      access_score: ar?.score ?? null,
      access_planner_hint: ar?.planner_hint ?? null,
      access_model_source: ar?.access_model_source ?? null,
      business_model_signal: ar?.business_model_signal ?? null
    };

    // Persist asked-question history for future stall detection
    state.blueprint.question_history = Array.isArray(state.blueprint.question_history)
      ? state.blueprint.question_history
      : [];
    state.blueprint.question_history.push({
      timestamp: new Date().toISOString(),
      bundle_id: cleanString(state.blueprint.question_plan?.bundle_id),
      primary_field: cleanString(state.blueprint.question_plan?.primary_field),
      message: assistantMessage
    });

    return json({
      ok: true,
      message: assistantMessage,
      state
    });
  } catch (err) {
    console.error("[intake-next-v2-1]", err);
    return json(
      {
        ok: false,
        error: String(err?.message || err || "Unknown error")
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "intake-next-v2-1",
    method: "POST",
    version: "v2.1-component-first-rebuilt"
  });
}

/* ========================================================================
 * Schema Guide
 * ====================================================================== */

function compileSchemaGuide(blueprint, state) {
  const strategyContract = safeObject(state?.provenance?.strategy_contract);
  const toggles = safeObject(
    blueprint?.strategy?.schema_toggles ||
      strategyContract?.schema_toggles
  );

  return {
    intelligence: {
      kind: "section",
      required: true,
      ai_priority: "critical",
      purpose: "Establish foundational context so AI can behave like a web strategist.",
      evidence_keys: ["industry", "target_persona", "tone_of_voice"],
      toggle_key: null
    },
    strategy: {
      kind: "section",
      required: true,
      ai_priority: "critical",
      purpose: "Determine which site components should render based on business needs.",
      evidence_keys: [
        "show_trustbar",
        "show_about",
        "show_features",
        "show_events",
        "show_process",
        "show_testimonials",
        "show_comparison",
        "show_gallery",
        "show_investment",
        "show_faqs",
        "show_service_area"
      ],
      toggle_key: null
    },
    settings: {
      kind: "section",
      required: true,
      ai_priority: "critical",
      purpose: "Control global UI, vibe, CTA, and navigation behavior.",
      evidence_keys: ["vibe", "cta_text", "cta_link", "booking_url"],
      toggle_key: null
    },
    brand: {
      kind: "section",
      required: true,
      ai_priority: "critical",
      purpose: "Define the public-facing identity of the business.",
      evidence_keys: ["business_name", "tagline", "email", "phone", "address"],
      toggle_key: null
    },
    hero: {
      kind: "component",
      required: true,
      ai_priority: "critical",
      planner_group: "positioning",
      purpose: "Immediately communicate the core value proposition.",
      evidence_keys: [
        "primary_offer",
        "target_persona",
        "differentiation",
        "booking_method",
        "hero_headline",
        "hero_subheadline",
        "hero_image_alt",
        "hero_image_query"
      ],
      image_priority: true,
      toggle_key: null
    },
    about: {
      kind: "component",
      required: false,
      ai_priority: "recommended",
      planner_group: "story",
      purpose: "Build emotional connection and credibility through story.",
      evidence_keys: ["founder_story", "years_experience", "differentiation", "business_understanding"],
      toggle_key: "show_about"
    },
    trustbar: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "proof",
      purpose: "Add quick trust signals near the hero to improve conversion.",
      evidence_keys: ["trust_signal", "review_quotes", "years_experience"],
      toggle_key: "show_trustbar"
    },
    events: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "events_strategy",
      purpose: "Display time-based offerings or upcoming schedule.",
      evidence_keys: ["events", "booking_url", "booking_method"],
      toggle_key: "show_events"
    },
    service_area: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "service_area",
      purpose: "Local SEO and trust section for primary city and nearby areas.",
      evidence_keys: ["service_area_main", "surrounding_cities", "service_area_list"],
      toggle_key: "show_service_area"
    },
    features: {
      kind: "component",
      required: true,
      ai_priority: "critical",
      planner_group: "positioning",
      purpose: "Explain what the business offers and why it matters.",
      evidence_keys: ["primary_offer", "service_list", "differentiation"],
      toggle_key: null
    },
    processSteps: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "process",
      purpose: "Explain the workflow in clear steps to reduce friction.",
      evidence_keys: ["process_summary"],
      toggle_key: "show_process"
    },
    testimonials: {
      kind: "component",
      required: false,
      ai_priority: "recommended",
      planner_group: "proof",
      purpose: "Reduce risk and increase trust with social proof.",
      evidence_keys: ["review_quotes", "trust_signal"],
      toggle_key: "show_testimonials"
    },
    comparison: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "comparison_strategy",
      purpose: "Help buyers decide by comparing the offer to alternatives.",
      evidence_keys: ["comparison", "differentiation", "trust_signal"],
      toggle_key: "show_comparison"
    },
    investment: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "pricing_model",
      purpose: "Clarify pricing expectations and qualify leads.",
      evidence_keys: ["pricing", "investment"],
      toggle_key: "show_investment"
    },
    faqs: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "objection_handling",
      purpose: "Answer objections and increase conversion confidence.",
      evidence_keys: ["faq_angles", "pricing", "process_summary", "trust_signal"],
      toggle_key: "show_faqs"
    },
    gallery: {
      kind: "component",
      required: false,
      ai_priority: "recommended",
      planner_group: "gallery_strategy",
      purpose: "Render a visual gallery using inferred layout, count, and search query.",
      evidence_keys: ["gallery_visual_direction", "image_themes", "primary_offer", "differentiation"],
      image_priority: true,
      toggle_key: "show_gallery"
    },
    contact: {
      kind: "component",
      required: true,
      ai_priority: "critical",
      planner_group: "contact_details",
      purpose: "Configure the contact section and submission behavior.",
      evidence_keys: ["booking_method", "contact_path", "phone", "email", "address", "hours", "booking_url"],
      toggle_key: null
    },
    _toggles: toggles
  };
}

/* ========================================================================
 * AI Interpretation
 * ====================================================================== */

async function interpretUserAnswer({ env, answer, blueprint, state, schemaGuide, currentPlan }) {
  const allowedFactKeys = Object.keys(blueprint.fact_registry || {});
  const allowedTopLevelSections = Object.keys(blueprint.business_draft || {});
  const allowedLeafPaths = collectLeafPaths(blueprint.business_draft);

  const fallback = {
    ok: true,
    answered_decisions: [cleanString(currentPlan.bundle_id)].filter(Boolean),
    answer_summary: answer,
    confidence: 0,
    fact_updates: [],
    component_impacts: [],
    draft_patches: [],
    copy_refinements: [],
    unresolved_points: [],
    notes: "AI interpretation unavailable"
  };

  if (!env?.OPENAI_API_KEY) {
    return fallback;
  }

  const payload = {
    model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildInterpreterSystemPrompt()
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Interpret the user's answer into safe evidence updates for SiteForge intake-next-v2-1.",
            answer,
            current_bundle_id: cleanString(currentPlan.bundle_id),
            current_primary_field: cleanString(currentPlan.primary_field),
            current_target_fields: cleanList(currentPlan.target_fields),
            interpreter_priority_rule:
              "Prioritize extracting the current primary field first. Only add off-bundle updates if they are explicit and clearly supported.",
            strategy: blueprint.strategy,
            fact_registry_snapshot: pruneFactRegistryForModel(blueprint.fact_registry),
            component_states: blueprint.component_states || {},
            decision_states: blueprint.decision_states || {},
            schema_guide: schemaGuide,
            business_draft_snapshot: blueprint.business_draft,
            allowed_fact_keys: allowedFactKeys,
            allowed_top_level_sections: allowedTopLevelSections,
            allowed_leaf_paths: allowedLeafPaths,
            allowed_icon_tokens: ALLOWED_ICON_TOKENS,
            strategy_contract_context: {
              business_context: safeObject(state?.provenance?.strategy_contract?.business_context),
              conversion_strategy: safeObject(state?.provenance?.strategy_contract?.conversion_strategy),
              content_requirements: safeObject(state?.provenance?.strategy_contract?.content_requirements),
              schema_toggles: safeObject(state?.provenance?.strategy_contract?.schema_toggles),
              copy_policy: safeObject(state?.provenance?.strategy_contract?.copy_policy)
            }
          },
          null,
          2
        )
      }
    ]
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return fallback;

    const parsed = safeJsonParse(raw);
    if (!isObject(parsed)) return fallback;

    const sanitized = sanitizeInterpretation(parsed, {
      allowedFactKeys,
      allowedTopLevelSections,
      allowedLeafPaths,
      currentPlan,
      schemaGuide
    });

    return repairInterpretationForActiveTarget(sanitized, currentPlan, answer);
  } catch (err) {
    console.error("[intake-next-v2-1:interpret]", err);
    return fallback;
  }
}

function buildInterpreterSystemPrompt() {
  return [
    "You are the interpretation layer for SiteForge Factory intake-next-v2-1.",
    "You do NOT control schema or system logic.",
    "You may ONLY interpret the user's answer into safe updates for existing fact keys and existing business_draft sections.",
    "Do not invent fields.",
    "Do not invent new schema sections.",
    "Do not hardcode industries.",
    "Be conservative and faithful to the user's wording.",
    "",
    "Highest priority: interpret the answer for the current primary_field first.",
    "If the user directly answers the current primary_field, you must include a fact_update for that field.",
    "Do not ignore the current primary_field in favor of adjacent fields.",
    "Only update fields outside the current bundle if the answer clearly and directly provides them.",
    "If the answer is about pricing, prefer pricing over primary_offer.",
    "If the answer is about booking flow, prefer booking_method, booking_url, or contact_path over positioning fields.",
    "If the answer is about process, prefer process_summary over generic differentiation.",
    "If the answer is about visuals, prefer hero_image_query or gallery_visual_direction.",
    "If the answer is partial, still update the primary field with status='partial' rather than leaving it missing.",
    "If the answer includes feature suggestions that need icon_slug, use only an allowed icon token.",
    "",
    "Return JSON only with this exact shape:",
    "{",
    '  "answered_decisions": ["string"],',
    '  "answer_summary": "string",',
    '  "confidence": 0.0,',
    '  "fact_updates": [',
    "    {",
    '      "fact_key": "string",',
    '      "value": any,',
    '      "confidence": 0.0,',
    '      "verified": true,',
    '      "status": "answered|partial|inferred",',
    '      "rationale": "short reason"',
    "    }",
    "  ],",
    '  "component_impacts": [',
    "    {",
    '      "component": "string",',
    '      "confidence_delta": 0.0,',
    '      "reason": "short reason"',
    "    }",
    "  ],",
    '  "draft_patches": [',
    "    {",
    '      "section": "top-level section name only",',
    '      "path": "full draft path",',
    '      "value": any,',
    '      "confidence": 0.0,',
    '      "rationale": "short reason"',
    "    }",
    "  ],",
    '  "copy_refinements": [',
    "    {",
    '      "section": "top-level section name only",',
    '      "path": "full draft path",',
    '      "value": any,',
    '      "confidence": 0.0,',
    '      "rationale": "short reason"',
    "    }",
    "  ],",
    '  "unresolved_points": ["string"],',
    '  "notes": "string"',
    "}"
  ].join("\n");
}

  function isFactComplete(fact) {
    if (!fact) return false;

    // 🔥 ONLY requirement: usable value (never treat nested fact stubs as content)
    const v = sanitizeFactValue(fact.value);
    return hasMeaningfulValue(v);
  }

  /** Phone / quote-by-phone style flows do not need an external booking URL. */
  function isManualBookingMethodValue(bookingMethodRaw) {
    const m = cleanString(bookingMethodRaw).toLowerCase().replace(/\s+/g, "_");
    if (!m) return false;
    const exact = [
      "call",
      "manual",
      "phone",
      "request_quote",
      "call_for_quote",
      "call_to_get_quote",
      "phone_call",
      "quote_by_phone",
      "call_us"
    ];
    if (exact.includes(m)) return true;
    // "call us", "call the shop", "call for an appointment" → call_* (underscore-normalized)
    if (m.startsWith("call_")) return true;
    if (m === "phone" || m.startsWith("phone_")) return true;
    if (m.includes("phone") && (m.includes("call") || m.includes("quote"))) return true;
    if (m.includes("call") && m.includes("quote")) return true;
    return false;
  }

  function extractHttpUrlFromText(text) {
    const s = cleanString(text);
    const m = s.match(/https?:\/\/[^\s)\]]+/i) || s.match(/\bwww\.[^\s)\]]+/i);
    return m ? m[0] : "";
  }

  function isPlausibleBookingUrlString(value) {
    if (!hasMeaningfulValue(value) || typeof value !== "string") return false;
    const s = value.trim();
    if (extractHttpUrlFromText(s)) return true;
    return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/?#][^\s]*)?$/i.test(s);
  }

  function describesManualBookingNoUrl(lower) {
    const s = cleanString(lower).toLowerCase().trim();
    if (!s) return false;
    if (s === "none" || s === "nope" || s === "nah" || s === "no") return true;
    const signals = [
      "manual",
      "manually",
      "manuall",
      "handled manually",
      "no booking",
      "no booking link",
      "no booking page",
      "we schedule manually",
      "no url",
      "not online",
      "call only",
      "phone only",
      "request a quote",
      "don't have a link",
      "do not have a link"
    ];
    return signals.some((sig) => s.includes(sig));
  }

  function isAcceptableBookingUrlFactUpdate(update, rawAnswer) {
    const v = update?.value;
    if (v == null && cleanString(update?.status) === "answered") return true;
    if (typeof v === "string") {
      const lower = v.toLowerCase();
      if (isPlausibleBookingUrlString(v)) return true;
      if (isBookingUrlNoLinkSentinel(v)) return true;
      if (describesManualBookingNoUrl(lower)) return true;
    }
    const fromUser = cleanString(rawAnswer).toLowerCase();
    if (fromUser && (describesManualBookingNoUrl(fromUser) || isBookingUrlNoLinkSentinel(fromUser))) return true;
    if (typeof v === "string" && extractHttpUrlFromText(v)) return true;
    return false;
  }

  function isFieldSatisfied(fieldKey, factRegistry) {
  const fact = factRegistry?.[fieldKey];

  // booking_url: satisfied = real URL OR explicit no-URL (answered/partial + null/sentinel/manual phrasing)
  if (fieldKey === "booking_url") {
    const bookingMethod = factRegistry?.booking_method?.value;

    if (isManualBookingMethodValue(bookingMethod)) return true;

    const st = fact ? cleanString(fact.status) : "";
    const statusAllowsValue =
      st === "answered" || st === "partial" || (st === "inferred" && clampNumber(fact.confidence, 0, 1, 0) >= 0.7);

    if (fact && statusAllowsValue) {
      const v = fact.value;
      if (v == null) return true;
      if (typeof v === "string") {
        const t = v.trim().toLowerCase();
        if (isBookingUrlNoLinkSentinel(v)) return true;
        if (isPlausibleBookingUrlString(v)) return true;
        if (describesManualBookingNoUrl(t)) return true;
      }
      return false;
    }
    return false;
  }

if (fieldKey === "contact_path") {
  const bookingMethod = factRegistry?.booking_method?.value;

  if (hasMeaningfulValue(bookingMethod)) {
    return true;
  }
}

  return isFactComplete(fact);
}

function sanitizeInterpretation(parsed, { allowedFactKeys, allowedTopLevelSections, allowedLeafPaths, currentPlan, schemaGuide }) {
  const cleanFactUpdates = (Array.isArray(parsed.fact_updates) ? parsed.fact_updates : [])
    .filter((item) => isObject(item) && allowedFactKeys.includes(cleanString(item.fact_key)))
    .map((item) => ({
      fact_key: cleanString(item.fact_key),
      value: sanitizeFactValue(normalizeModelValue(item.value)),
      confidence: clampNumber(item.confidence, 0, 1, 0.5),
      verified: item.verified !== false,
      status: sanitizeFactStatus(item.status),
      rationale: cleanString(item.rationale)
    }));

  const cleanComponentImpacts = (Array.isArray(parsed.component_impacts) ? parsed.component_impacts : [])
    .filter((item) => isObject(item) && Object.prototype.hasOwnProperty.call(schemaGuide, cleanString(item.component)))
    .map((item) => ({
      component: cleanString(item.component),
      confidence_delta: clampNumber(item.confidence_delta, -1, 1, 0),
      reason: cleanString(item.reason)
    }));

  const cleanDraftPatches = (Array.isArray(parsed.draft_patches) ? parsed.draft_patches : [])
    .filter((item) => isAllowedDraftPatch(item, allowedTopLevelSections, allowedLeafPaths))
    .map((item) => ({
      section: cleanString(item.section),
      path: cleanString(item.path),
      value: normalizeModelValue(item.value),
      confidence: clampNumber(item.confidence, 0, 1, 0.5),
      rationale: cleanString(item.rationale)
    }));

  const cleanCopyRefinements = (Array.isArray(parsed.copy_refinements) ? parsed.copy_refinements : [])
    .filter((item) => isAllowedDraftPatch(item, allowedTopLevelSections, allowedLeafPaths))
    .map((item) => ({
      section: cleanString(item.section),
      path: cleanString(item.path),
      value: normalizeModelValue(item.value),
      confidence: clampNumber(item.confidence, 0, 1, 0.5),
      rationale: cleanString(item.rationale)
    }));

  return {
    ok: true,
    answered_decisions: normalizeStringArray(parsed.answered_decisions),
    answer_summary: cleanString(parsed.answer_summary),
    confidence: clampNumber(parsed.confidence, 0, 1, 0.5),
    fact_updates: dedupeBy(cleanFactUpdates, "fact_key"),
    component_impacts: dedupeBy(cleanComponentImpacts, "component"),
    draft_patches: dedupeBy(cleanDraftPatches, "path"),
    copy_refinements: dedupeBy(cleanCopyRefinements, "path"),
    unresolved_points: normalizeStringArray(parsed.unresolved_points),
    notes: cleanString(parsed.notes)
  };
}

function repairInterpretationForActiveTarget(interpretation, currentPlan, answer) {
  const repaired = deepClone(interpretation);
  const primaryField = cleanString(currentPlan?.primary_field);
  const bundleId = cleanString(currentPlan?.bundle_id);
  const text = cleanString(answer);
  const lower = text.toLowerCase();

  if (!primaryField) return repaired;

  const alreadyUpdated = (repaired.fact_updates || []).some(
    (item) => cleanString(item.fact_key) === primaryField
  );
  if (alreadyUpdated) return repaired;

  if (bundleId === "conversion" && primaryField === "pricing") {
    const pricingSignals = [
      "price",
      "pricing",
      "quote",
      "quoted",
      "estimate",
      "flat rate",
      "starts at",
      "depends on",
      "based on",
      "scope",
      "size",
      "complexity"
    ];
    if (pricingSignals.some((signal) => lower.includes(signal))) {
      repaired.fact_updates = repaired.fact_updates || [];
      repaired.fact_updates.push({
        fact_key: "pricing",
        value: text,
        confidence: 0.72,
        verified: true,
        status: "partial",
        rationale: "User answered the pricing question directly; preserving wording as pricing context."
      });
    }
  }

  if (bundleId === "conversion" && primaryField === "booking_url") {
    const url = extractHttpUrlFromText(text);
    if (url) {
      repaired.fact_updates = repaired.fact_updates || [];
      repaired.fact_updates.push({
        fact_key: "booking_url",
        value: url,
        confidence: 0.88,
        verified: true,
        status: "answered",
        rationale: "User provided a scheduling or booking link."
      });
    } else {
      const manualSignals = [
        "manual",
        "manually",
        "none",
        "handled manually",
        "no booking",
        "no booking link",
        "no booking page",
        "we schedule manually",
        "request a quote"
      ];

      if (manualSignals.some((signal) => lower.includes(signal))) {
        repaired.fact_updates = repaired.fact_updates || [];

        repaired.fact_updates.push({
          fact_key: "booking_url",
          value: "manual",
          confidence: 0.9,
          verified: true,
          status: "answered",
          rationale: "Booking is handled manually; no booking URL exists."
        });
      }
    }
  }

  if (bundleId === "process" && primaryField === "process_summary") {
    if (looksLikeProcessAnswer(lower)) {
      repaired.fact_updates = repaired.fact_updates || [];
      repaired.fact_updates.push({
        fact_key: "process_summary",
        value: text,
        confidence: 0.76,
        verified: true,
        status: "partial",
        rationale: "User described a clear service workflow."
      });
      repaired.component_impacts = repaired.component_impacts || [];
      if (!repaired.component_impacts.some((x) => cleanString(x.component) === "processSteps")) {
        repaired.component_impacts.push({
          component: "processSteps",
          confidence_delta: 0.28,
          reason: "Process evidence detected from client-described workflow."
        });
      }
    }
  }

  if (bundleId === "gallery_strategy" && (primaryField === "gallery_visual_direction" || primaryField === "hero_image_query")) {
    if (hasMeaningfulValue(text)) {
      repaired.fact_updates = repaired.fact_updates || [];
      repaired.fact_updates.push({
        fact_key: primaryField,
        value: text,
        confidence: 0.68,
        verified: true,
        status: "partial",
        rationale: "User provided visual direction relevant to image strategy."
      });
    }
  }

  return repaired;
}

/* ========================================================================
 * Evidence Router + Blueprint Mutations
 * ====================================================================== */

function maybePromotePrefilledToVerified(answer, fact) {
  if (!isObject(fact) || cleanString(fact.status) !== "prefilled_unverified") return fact;

  const text = cleanString(answer).toLowerCase();

  const isAffirmation =
    text.includes("yes") ||
    text.includes("correct") ||
    text.includes("looks good") ||
    text.includes("sounds right") ||
    text.includes("that works");

  if (!isAffirmation) return fact;

  return {
    ...fact,
    verified: true,
    status: "answered"
  };
}

function routeInterpretationToEvidence({ blueprint, state, schemaGuide, interpretation, answer }) {
  const nextBlueprint = deepClone(blueprint);
  nextBlueprint.fact_registry = deepClone(blueprint.fact_registry || {});
  nextBlueprint.business_draft = deepClone(blueprint.business_draft || {});
  nextBlueprint.evidence_log = Array.isArray(blueprint.evidence_log) ? deepClone(blueprint.evidence_log) : [];

  const now = new Date().toISOString();
  const updatedFactKeys = [];
  const patchedPaths = [];
  const expectedField = cleanString(state?.blueprint?.question_plan?.primary_field);

  // ==========================
  // 🔥 FACT STABILITY HELPER (NEW)
  // ==========================





  function shouldUpdateFact(existing, incoming) {
    if (!existing) return true;

    // Do not downgrade strong answers
    if (existing.status === "answered" && incoming.status !== "answered") {
      return false;
    }

    // Do not overwrite high confidence with weaker
    if (
      typeof existing.confidence === "number" &&
      typeof incoming.confidence === "number" &&
      existing.confidence >= 0.85 &&
      incoming.confidence < existing.confidence
    ) {
      return false;
    }

    return true;
  }

  const factUpdates = Array.isArray(interpretation?.fact_updates) ? interpretation.fact_updates : [];
  const prioritizedFactUpdates = expectedField
    ? factUpdates.slice().sort((a, b) => {
        const aIsExpected = cleanString(a?.fact_key) === expectedField ? 1 : 0;
        const bIsExpected = cleanString(b?.fact_key) === expectedField ? 1 : 0;
        return bIsExpected - aIsExpected;
      })
    : factUpdates;

  for (const update of prioritizedFactUpdates) {
    if (cleanString(update.fact_key) === "booking_url" && !isAcceptableBookingUrlFactUpdate(update, answer)) {
      continue;
    }

    const existing = isObject(nextBlueprint.fact_registry[update.fact_key])
      ? nextBlueprint.fact_registry[update.fact_key]
      : null;

    const newFact = {
      value: sanitizeFactValue(deepClone(update.value)),
      source: "user",
      confidence: clampNumber(update.confidence, 0, 1, existing?.confidence ?? 0.5),
      verified: update.verified !== false,
      requires_client_verification:
        typeof existing?.requires_client_verification === "boolean"
          ? existing.requires_client_verification && update.verified !== true
          : false,
      related_sections: Array.isArray(existing?.related_sections) ? existing.related_sections : [],
      status: sanitizeFactStatus(update.status),
      rationale: cleanString(update.rationale),
      updated_at: now
    };

    // 🔥 APPLY ONLY IF VALID UPDATE
    if (shouldUpdateFact(existing, newFact)) {
      const history = Array.isArray(existing?.history) ? existing.history.slice() : [];

      history.push({
        timestamp: now,
        source: "user",
        previous_value: existing?.value,
        next_value: deepClone(update.value),
        rationale: cleanString(update.rationale),
        answer_excerpt: truncate(answer, 400)
      });

      nextBlueprint.fact_registry[update.fact_key] = {
        ...existing,
        ...newFact,
        history
      };

      updatedFactKeys.push(update.fact_key);
    }
  }

  if (expectedField) {
    const fk = expectedField;
    const fact = nextBlueprint.fact_registry[fk];
    if (fact) {
      const promoted = maybePromotePrefilledToVerified(answer, fact);
      if (promoted !== fact) {
        nextBlueprint.fact_registry[fk] = promoted;
        if (!updatedFactKeys.includes(fk)) updatedFactKeys.push(fk);
      }
    }
  }

  // ==========================
  // Active-field integrity check: ensure the asked slot always gets captured.
  // booking_url: never store arbitrary text as a URL; URLs / manual-no-URL only.
  // ==========================
  if (expectedField) {
    const wasUpdated = updatedFactKeys.includes(expectedField);

    if (!wasUpdated && hasMeaningfulValue(answer)) {
      if (expectedField === "booking_url") {
        const lower = cleanString(answer).toLowerCase();
        const url = extractHttpUrlFromText(answer);
        if (url) {
          nextBlueprint.fact_registry.booking_url = {
            value: url,
            status: "answered",
            confidence: 0.85,
            verified: true,
            rationale: "Captured URL from answer (expected field enforcement)",
            updated_at: now
          };
          if (!updatedFactKeys.includes("booking_url")) updatedFactKeys.push("booking_url");
        } else if (describesManualBookingNoUrl(lower) || isBookingUrlNoLinkSentinel(cleanString(answer))) {
          nextBlueprint.fact_registry.booking_url = {
            value: "manual",
            status: "answered",
            confidence: 0.88,
            verified: true,
            rationale: "Manual booking — no public scheduling URL (expected field enforcement)",
            updated_at: now
          };
          if (!updatedFactKeys.includes("booking_url")) updatedFactKeys.push("booking_url");
        }
        // else: leave unresolved — do not mark "complexity" etc. as a booking URL
      } else {
        nextBlueprint.fact_registry[expectedField] = {
          value: cleanString(answer),
          status: "answered",
          confidence: 0.75,
          verified: true,
          rationale: "Captured from answer (expected field enforcement)",
          updated_at: now
        };

        if (!updatedFactKeys.includes(expectedField)) {
          updatedFactKeys.push(expectedField);
        }
      }
    }
  }

// ==========================
// Pricing fallback (only when active slot is pricing — manifest: no unrelated inference)
// ==========================
const hasPricing = nextBlueprint.fact_registry?.pricing?.value;
const answerText = cleanString(answer).toLowerCase();

if (
  expectedField === "pricing" &&
  !hasMeaningfulValue(hasPricing) &&
  answerText.length > 3
) {
  nextBlueprint.fact_registry.pricing = {
    value: answerText,
    status: "answered",
    confidence: 0.8,
    verified: true,
    rationale: "Fallback capture from user answer (pricing inference)",
    updated_at: now
  };

  if (!updatedFactKeys.includes("pricing")) {
    updatedFactKeys.push("pricing");
  }
}

  // ==========================
  // FORCE RESOLUTION: booking_url when manual booking (SAFE)
  // ==========================
  const bookingMethod = nextBlueprint.fact_registry?.booking_method?.value;
  const currentBookingUrl = nextBlueprint.fact_registry?.booking_url;

  const bookingUrlAlreadyResolved =
    currentBookingUrl &&
    currentBookingUrl.status === "answered";

  if (
    cleanString(expectedField) !== "booking_url" &&
    typeof bookingMethod === "string" &&
    isManualBookingMethodValue(bookingMethod) &&
    !bookingUrlAlreadyResolved
  ) {
    nextBlueprint.fact_registry.booking_url = {
      value: "manual",
      status: "answered",
      confidence: 1,
      verified: true,
      rationale: "Resolved automatically: manual booking flow does not require URL.",
      updated_at: now
    };

    if (!updatedFactKeys.includes("booking_url")) {
      updatedFactKeys.push("booking_url");
    }
  }



// ==========================
// 🔥 AUTO RESOLVE: contact_path (FIXED)
// ==========================
const bookingMethodValue = nextBlueprint.fact_registry?.booking_method?.value;
const currentContactPath = nextBlueprint.fact_registry?.contact_path;

const contactPathAlreadyResolved =
  currentContactPath &&
  currentContactPath.status === "answered";

if (
  typeof bookingMethodValue === "string" &&
  bookingMethodValue.trim().length > 0 &&
  !contactPathAlreadyResolved
) {
  const normalizedMethod = bookingMethodValue.toLowerCase();

  nextBlueprint.fact_registry.contact_path = {
    value: normalizedMethod,
    status: "answered",
    confidence: 0.9,
    verified: true,
    rationale: "Derived from booking method",
    updated_at: now
  };

  if (!updatedFactKeys.includes("contact_path")) {
    updatedFactKeys.push("contact_path");
  }
}






  for (const patch of interpretation.draft_patches || []) {
    setByPath(nextBlueprint.business_draft, patch.path, deepClone(patch.value));
    patchedPaths.push(patch.path);
  }

  for (const refinement of interpretation.copy_refinements || []) {
    const existing = getByPath(nextBlueprint.business_draft, refinement.path);
    if (shouldApplyCopyRefinement(existing, refinement.value, refinement.confidence)) {
      setByPath(nextBlueprint.business_draft, refinement.path, deepClone(refinement.value));
      patchedPaths.push(refinement.path);
    }
  }

  nextBlueprint.evidence_log.push({
    timestamp: now,
    source: "user",
    answer_excerpt: truncate(answer, 500),
    facts_updated: uniqueList(updatedFactKeys),
    components_impacted: uniqueList((interpretation.component_impacts || []).map((x) => x.component)),
    confidence: clampNumber(interpretation.confidence, 0, 1, 0),
    answer_summary: cleanString(interpretation.answer_summary)
  });

  return {
    blueprint: nextBlueprint,
    audit: {
      timestamp: now,
      answered_decisions: normalizeStringArray(interpretation.answered_decisions),
      answer_summary: cleanString(interpretation.answer_summary),
      interpretation_confidence: clampNumber(interpretation.confidence, 0, 1, 0),
      updated_fact_keys: uniqueList(updatedFactKeys),
      patched_paths: uniqueList(patchedPaths),
      component_impacts: deepClone(interpretation.component_impacts || []),
      unresolved_points: normalizeStringArray(interpretation.unresolved_points),
      notes: cleanString(interpretation.notes),
      expected_primary_field: expectedField,
      primary_field_updated: !!(expectedField && updatedFactKeys.includes(expectedField)),
      secondary_updated_keys: uniqueList(
        updatedFactKeys.filter((k) => cleanString(k) && cleanString(k) !== expectedField)
      )
    }
  };
}

/* ========================================================================
 * Blueprint Recompute
 * ====================================================================== */

function recomputeBlueprint({ blueprint, state, schemaGuide, previousPlan, lastAudit }) {
  const nextBlueprint = deepClone(blueprint);
  nextBlueprint.question_history = Array.isArray(nextBlueprint.question_history)
    ? deepClone(nextBlueprint.question_history)
    : [];

  nextBlueprint.component_states = computeComponentStates({
    blueprint: nextBlueprint,
    schemaGuide,
    state
  });

  nextBlueprint.decision_states = computeDecisionStates({
    blueprint: nextBlueprint,
    schemaGuide
  });

  reevaluateStrategyToggles({
    blueprint: nextBlueprint,
    schemaGuide,
    state
  });

  syncBusinessDraftFromEvidence({
    blueprint: nextBlueprint,
    schemaGuide,
    state
  });

  nextBlueprint.section_status = computeSectionStatus({
    blueprint: nextBlueprint,
    schemaGuide
  });

  nextBlueprint.verification_queue = buildVerificationQueue({
    blueprint: nextBlueprint,
    schemaGuide,
    state
  });

  nextBlueprint.access_readiness = computeAccessReadiness(nextBlueprint, state);
  nextBlueprint.premium_readiness = computePremiumReadinessEngine(nextBlueprint);

  nextBlueprint.question_candidates = buildQuestionCandidates({
    blueprint: nextBlueprint,
    schemaGuide,
    previousPlan,
    lastAudit,
    state
  });

const nextQuestionPlan = planNextQuestion(
  nextBlueprint.question_candidates,
  nextBlueprint.question_plan?.bundle_id,
  nextBlueprint.question_plan?.primary_field,
  nextBlueprint.fact_registry
);

  nextBlueprint.question_plan = nextQuestionPlan ? deepClone(nextQuestionPlan) : null;

  return { blueprint: nextBlueprint };
}

function computeComponentStates({ blueprint, schemaGuide, state }) {
  const out = {};
  const factRegistry = safeObject(blueprint.fact_registry);
  const businessDraft = safeObject(blueprint.business_draft);

  for (const [component, guide] of Object.entries(schemaGuide)) {
    if (component.startsWith("_")) continue;

    const evidenceKeys = cleanList(guide.evidence_keys);
    const presentEvidence = evidenceKeys.filter((key) =>
      isFactComplete(factRegistry?.[key])
    ); 
    const missingEvidence = evidenceKeys.filter((key) =>
      !isFactComplete(factRegistry?.[key])
    );
    const confidenceBase = evidenceKeys.length
      ? presentEvidence.length / evidenceKeys.length
      : 0.5;

    const enabled = evaluateComponentEnabled({
      component,
      guide,
      blueprint,
      state,
      confidenceBase
    });

    const draftReady = evaluateComponentDraftReady(component, businessDraft, presentEvidence, guide);
    const premiumReady = evaluateComponentPremiumReady(component, businessDraft, factRegistry, guide);

    out[component] = {
      enabled,
      confidence: Number(confidenceBase.toFixed(2)),
      evidence_keys: evidenceKeys,
      present_evidence: presentEvidence,
      missing_evidence: missingEvidence,
      draft_ready: draftReady,
      premium_ready: premiumReady,
      why_enabled: enabled ? buildComponentEnableReasons(component, guide, blueprint, factRegistry) : [],
      why_disabled: enabled ? [] : buildComponentDisableReasons(component, guide, blueprint, factRegistry),
      planner_priority: computeComponentPlannerPriority(component, guide),
      ai_priority: cleanString(guide.ai_priority),
      purpose: cleanString(guide.purpose)
    };
  }

  return out;
}

function evaluateComponentEnabled({ component, guide, blueprint, state, confidenceBase }) {
  if (guide.required) return true;

  const toggles = safeObject(
    blueprint?.strategy?.schema_toggles ||
      state?.provenance?.strategy_contract?.schema_toggles
  );
  const toggleKey = cleanString(guide.toggle_key);

  if (toggleKey && typeof toggles[toggleKey] === "boolean") {
    if (toggles[toggleKey] === true) return true;
  }

  const fact = blueprint.fact_registry;

  switch (component) {
    case "processSteps":
      return looksLikeProcessFact(fact?.process_summary?.value);
    
      case "gallery":
      return confidenceBase >= 0.3 || hasMeaningfulValue(fact?.gallery_visual_direction?.value) || hasMeaningfulValue(fact?.image_themes?.value);

    case "faqs":
      return confidenceBase >= 0.3 || (Array.isArray(fact?.faq_angles?.value) && fact?.faq_angles?.value.length > 0);

    case "investment":
      return isStandardizedPricing(fact?.pricing?.value);

    case "events":
      return Array.isArray(fact?.events?.value) && fact?.events?.value.length >= 3;

    case "comparison":
      return hasMeaningfulValue(fact?.comparison?.value);

    case "service_area":
      return confidenceBase >= 0.2 || hasMeaningfulValue(fact?.service_area_main?.value);

    default:
      return !!toggles[toggleKey];
  }
}

function buildComponentEnableReasons(component, guide, blueprint, factRegistry) {
  const reasons = [];
  if (guide.required) reasons.push("Required by schema.");
  if (guide.toggle_key && blueprint?.strategy?.schema_toggles?.[guide.toggle_key] === true) {
    reasons.push(`Enabled by ${guide.toggle_key}.`);
  }
  if (component === "processSteps" && looksLikeProcessFact(factRegistry?.process_summary?.value)) {
    reasons.push("Client described a real service workflow.");
  }
  if (component === "gallery" && isFactComplete(factRegistry?.gallery_visual_direction)) {
    reasons.push("Visual direction evidence exists.");
  }
  if (component === "investment" && isStandardizedPricing(factRegistry?.pricing?.value)) {
    reasons.push("Pricing appears standardized enough for an investment section.");
  }
  return reasons;
}

function buildComponentDisableReasons(component, guide, blueprint, factRegistry) {
  const reasons = [];
  if (guide.toggle_key && blueprint?.strategy?.schema_toggles?.[guide.toggle_key] === false) {
    reasons.push(`Currently disabled by ${guide.toggle_key}.`);
  }
  if (component === "processSteps" && !looksLikeProcessFact(factRegistry?.process_summary?.value)) {
    reasons.push("No confirmed workflow evidence yet.");
  }
  if (component === "gallery" && !isFactComplete(factRegistry?.gallery_visual_direction)) {
    reasons.push("No confirmed gallery visual strategy yet.");
  }
  return reasons;
}

function computeComponentPlannerPriority(component, guide) {
  const base = {
    critical: 220,
    recommended: 150,
    optional: 90
  }[cleanString(guide.ai_priority)] || 100;

  const componentBoost = {
    hero: 60,
    features: 50,
    processSteps: 42,
    gallery: 38,
    faqs: 32,
    investment: 28,
    service_area: 30,
    contact: 20,
    testimonials: 24,
    about: 18,
    events: 16,
    comparison: 16
  }[component] || 0;

  return base + componentBoost;
}

function evaluateComponentDraftReady(component, businessDraft) {
  if (component === "gallery") {
    return hasMeaningfulValue(getByPath(businessDraft, "gallery.image_source.image_search_query"));
  }
  if (component === "hero") {
    return hasMeaningfulValue(getByPath(businessDraft, "hero.headline")) &&
      hasMeaningfulValue(getByPath(businessDraft, "hero.image.image_search_query"));
  }
  if (component === "contact") {
    return hasMeaningfulValue(getByPath(businessDraft, "contact.headline")) &&
      hasMeaningfulValue(getByPath(businessDraft, "contact.button_text"));
  }
  return hasMeaningfulValue(getByPath(businessDraft, component));
}

function evaluateComponentPremiumReady(component, businessDraft, factRegistry) {
  switch (component) {
    case "hero":
      return hasMeaningfulValue(getByPath(businessDraft, "hero.headline")) &&
        hasMeaningfulValue(getByPath(businessDraft, "hero.subtext")) &&
        hasMeaningfulValue(getByPath(businessDraft, "hero.image.alt")) &&
        hasMeaningfulValue(getByPath(businessDraft, "hero.image.image_search_query"));

    case "gallery":
      return hasMeaningfulValue(getByPath(businessDraft, "gallery.image_source.image_search_query")) &&
      hasMeaningfulValue(
        firstNonEmpty([
          getByPath(businessDraft, "gallery.computed_layout"),
          getByPath(businessDraft, "gallery.layout")
        ])
      ) &&
      typeof getByPath(businessDraft, "gallery.computed_count") === "number";

    case "processSteps":
      return Array.isArray(getByPath(businessDraft, "processSteps")) &&
        getByPath(businessDraft, "processSteps").length >= 3;

    case "features":
      return Array.isArray(getByPath(businessDraft, "features")) &&
        getByPath(businessDraft, "features").length >= 2;

    default:
      return false;
  }
}

function computeDecisionStates({ blueprint, schemaGuide }) {
  const out = {};
  const map = buildDecisionMap(schemaGuide);
  const componentStates = safeObject(blueprint.component_states);
  const factRegistry = safeObject(blueprint.fact_registry);

  for (const [decision, config] of Object.entries(map)) {
    const impactedComponents = config.components.filter((component) => componentStates[component]);
    const confidence = impactedComponents.length
      ? impactedComponents.reduce((sum, component) => sum + Number(componentStates[component].confidence || 0), 0) / impactedComponents.length
      : 0;

    const missingEvidence = uniqueList(
      impactedComponents.flatMap((component) => componentStates[component].missing_evidence || [])
    );

    out[decision] = {
      confidence: Number(confidence.toFixed(2)),
      impacted_components: impactedComponents,
      missing_evidence: missingEvidence,
      next_best_question_reason: cleanString(config.reason),
      priority: config.priority
    };
  }

  if (looksLikeProcessFact(factRegistry?.process_summary?.value)) {
    out.process = out.process || {};
    out.process.confidence = Math.max(Number(out.process.confidence || 0), 0.72);
  }

  if (isFactComplete(factRegistry?.gallery_visual_direction)) {
    out.gallery_strategy = out.gallery_strategy || {};
    out.gallery_strategy.confidence = Math.max(Number(out.gallery_strategy.confidence || 0), 0.68);
  }

  if (isStandardizedPricing(factRegistry?.pricing?.value)) {
    out.pricing_model = out.pricing_model || {};
    out.pricing_model.confidence = Math.max(Number(out.pricing_model.confidence || 0), 0.7);
  }

  return out;
}

function buildDecisionMap(schemaGuide) {
  return {
    positioning: {
      components: ["hero", "features"],
      priority: 220,
      reason: "Clarify who the offer is for, what it is, and what makes it stand apart."
    },
    conversion: {
      components: ["hero", "contact"],
      priority: 230,
      reason: "Clarify how visitors move from interest to action."
    },
    proof: {
      components: ["trustbar", "testimonials", "about"],
      priority: 190,
      reason: "Clarify why this business should be trusted quickly."
    },
    process: {
      components: ["processSteps"],
      priority: 175,
      reason: "Capture the workflow to reduce friction and strengthen credibility."
    },
    service_area: {
      components: ["service_area"],
      priority: 170,
      reason: "Clarify the main market and nearby locations served."
    },
    gallery_strategy: {
      components: ["gallery", "hero"],
      priority: 165,
      reason: "Define the visual strategy, search query, layout, and image count."
    },
    pricing_model: {
      components: ["investment", "faqs", "contact"],
      priority: 155,
      reason: "Clarify pricing expectations and whether structured investment belongs on the site."
    },
    objection_handling: {
      components: ["faqs"],
      priority: 145,
      reason: "Capture the objections and questions visitors need answered."
    },
    story: {
      components: ["about"],
      priority: 135,
      reason: "Clarify the founder story, standards, and business philosophy."
    },
    events_strategy: {
      components: ["events"],
      priority: 110,
      reason: "Determine whether time-based offerings belong on the site."
    },
    comparison_strategy: {
      components: ["comparison"],
      priority: 105,
      reason: "Determine whether comparison helps buyers decide."
    },
    contact_details: {
      components: ["contact", "brand"],
      priority: 60,
      reason: "Verify public contact facts needed for publish-readiness."
    }
  };
}

function reevaluateStrategyToggles({ blueprint, state }) {
  const toggles = safeObject(blueprint.strategy?.schema_toggles);
  const fact = safeObject(blueprint.fact_registry);
  const componentStates = safeObject(blueprint.component_states);

  toggles.show_process = componentStates.processSteps?.enabled === true;
  toggles.show_gallery = componentStates.gallery?.enabled === true;
  toggles.show_faqs = componentStates.faqs?.enabled === true || (Array.isArray(fact?.faq_angles?.value) && fact?.faq_angles?.value.length > 0);
  toggles.show_investment = componentStates.investment?.enabled === true;
  toggles.show_events = componentStates.events?.enabled === true;
  toggles.show_comparison = componentStates.comparison?.enabled === true;
  toggles.show_service_area = componentStates.service_area?.enabled === true;
  toggles.show_testimonials = componentStates.testimonials?.enabled === true || componentStates.trustbar?.enabled === true;

  blueprint.strategy.schema_toggles = toggles;

  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_process", toggles.show_process);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_gallery", toggles.show_gallery);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_faqs", toggles.show_faqs);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_investment", toggles.show_investment);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_events", toggles.show_events);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_comparison", toggles.show_comparison);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_service_area", toggles.show_service_area);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_testimonials", toggles.show_testimonials);
}

function syncBusinessDraftFromEvidence({ blueprint, state }) {
  const draft = blueprint.business_draft;

  syncHeroDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncAboutDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncProofDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncServiceAreaDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncProcessDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncGalleryDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncFaqDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncInvestmentDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncContactDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncFeaturesDraftFromEvidence(draft, blueprint.fact_registry, state);

  const fact = (key) => blueprint.fact_registry?.[key]?.value;

  safeAssignPathIfExists(draft, "brand.name", fact("business_name"));
  safeAssignPathIfExists(draft, "brand.email", fact("email"));
  safeAssignPathIfExists(draft, "brand.phone", fact("phone"));
  safeAssignPathIfExists(draft, "brand.office_address", firstNonEmpty([fact("address"), fact("office_address")]));
  safeAssignPathIfExists(draft, "brand.tagline", firstNonEmpty([fact("tagline"), buildTaglineFromEvidence(blueprint.fact_registry)]));

  safeAssignPathIfExists(draft, "intelligence.industry", fact("industry"));
  safeAssignPathIfExists(draft, "intelligence.target_persona", fact("target_persona"));
  safeAssignPathIfExists(draft, "intelligence.tone_of_voice", fact("tone_of_voice"));

  safeAssignPathIfExists(draft, "settings.vibe", firstNonEmpty([fact("vibe"), inferVibe(state)]));
  safeAssignPathIfExists(draft, "settings.cta_text", firstNonEmpty([fact("cta_text"), "Get Started"]));
  safeAssignPathIfExists(draft, "settings.cta_link", firstNonEmpty([bookingUrlValueForDraftLink(fact("booking_url")), fact("cta_link"), "#contact"]));
  safeAssignPathIfExists(
    draft,
    "settings.cta_type",
    hasMeaningfulValue(bookingUrlValueForDraftLink(fact("booking_url"))) ? "external" : "anchor"
  );

  syncMenuFromToggles(draft, blueprint.strategy?.schema_toggles || {});
}

function syncHeroDraftFromEvidence(draft, factRegistry, state) {
  const fact = (key) => factRegistry?.[key]?.value;
  const businessName = firstNonEmpty([fact("business_name"), state.businessName, "This business"]);
  const offer = cleanString(fact("primary_offer"));
  const persona = cleanString(fact("target_persona"));
  const differentiation = cleanString(fact("differentiation"));
  const bookingMethod = cleanString(fact("booking_method"));

  const headline = buildHeroHeadlineFromEvidence({ businessName, offer, differentiation });
  const subtext = buildHeroSubtextFromEvidence({ offer, persona, differentiation, bookingMethod });

  safeAssignPathIfExists(draft, "hero.headline", headline);
  safeAssignPathIfExists(draft, "hero.subtext", subtext);

  const heroAlt = firstNonEmpty([
    fact("hero_image_alt"),
    `${businessName} delivering ${offer || "premium service"}`
  ]);

  safeAssignPathIfExists(draft, "hero.image.alt", heroAlt);

  const heroQuery = firstNonEmpty([
    fact("hero_image_query"),
    buildHeroImageQuery({ industry: fact("industry"), offer, themes: fact("image_themes"), differentiation })
  ]);

  safeAssignPathIfExists(draft, "hero.image.image_search_query", heroQuery);
}

function syncAboutDraftFromEvidence(draft, factRegistry) {
  const fact = (key) => factRegistry?.[key]?.value;

  safeAssignPathIfExists(draft, "about.story_text", firstNonEmpty([fact("founder_story"), fact("business_understanding")]));
  safeAssignPathIfExists(draft, "about.founder_note", firstNonEmpty([fact("founder_story"), fact("differentiation")]));
  safeAssignPathIfExists(draft, "about.years_experience", stringifyFactValue(fact("years_experience")));
}

function syncProofDraftFromEvidence(draft, factRegistry) {
  const fact = (key) => factRegistry?.[key]?.value;

  const trustSignal = firstNonEmpty([fact("trust_signal"), "Trusted by clients who value quality"]);
  const years = stringifyFactValue(fact("years_experience"));

  if (hasPath(draft, "trustbar.enabled")) safeAssignPathIfExists(draft, "trustbar.enabled", true);

  if (hasPath(draft, "trustbar.items")) {
    const items = [
      { label: trustSignal, icon: "shield" },
      years ? { label: `${years} of experience`, icon: "award" } : null
    ].filter(Boolean);

    if (items.length >= 1) {
      safeAssignPathIfExists(draft, "trustbar.items", items);
    }
  }

  if (Array.isArray(getByPath(draft, "testimonials")) && Array.isArray(fact("review_quotes")) && fact("review_quotes").length) {
    safeAssignPathIfExists(draft, "testimonials", fact("review_quotes"));
  }
}

function syncServiceAreaDraftFromEvidence(draft, factRegistry) {
  const fact = (key) => factRegistry?.[key]?.value;
  const mainCity = firstNonEmpty([fact("service_area_main"), firstArrayItem(fact("service_area_list"))]);
  const surrounding = ensureArrayStrings(firstNonEmptyArray([fact("surrounding_cities"), fact("service_area_list")])).filter((item) => item !== mainCity);

  safeAssignPathIfExists(draft, "service_area.main_city", mainCity);
  safeAssignPathIfExists(draft, "service_area.surrounding_cities", surrounding);
  safeAssignPathIfExists(draft, "service_area.travel_note", buildServiceAreaTravelNote(mainCity, surrounding));
  safeAssignPathIfExists(draft, "service_area.map_search_query", mainCity ? `${cleanString(fact("primary_offer") || fact("industry") || "service")} near ${mainCity}` : "");
}

function syncProcessDraftFromEvidence(draft, factRegistry) {
  const fact = (key) => factRegistry?.[key]?.value;
  const processSummary = cleanString(fact("process_summary"));

  if (!looksLikeProcessFact(processSummary)) return;

  const steps = buildProcessStepsFromSummary(processSummary);
  if (steps.length >= 3) {
    safeAssignPathIfExists(draft, "processSteps", steps);
  }
}

function syncGalleryDraftFromEvidence(draft, factRegistry, state) {
  const fact = (key) => factRegistry?.[key]?.value;
  const industry = cleanString(fact("industry"));
  const offer = cleanString(fact("primary_offer"));
  const differentiation = cleanString(fact("differentiation"));
  const vibe = cleanString(fact("vibe"));
  const visualDirection = cleanString(fact("gallery_visual_direction"));
  const themes = ensureArrayStrings(fact("image_themes"));

  const galleryQuery = firstNonEmpty([
    visualDirection,
    buildGalleryImageQuery({ industry, offer, differentiation, themes })
  ]);

  const computedLayout = inferGalleryLayout({ vibe, offer, differentiation });
  const computedCount = inferGalleryCount({ offer, differentiation, visualDirection });

  // Real live draft shape
  safeAssignPathIfExists(draft, "gallery.enabled", true);
  safeAssignPathIfExists(draft, "gallery.title", firstNonEmpty([
    `${cleanString(industry) || "Gallery"} Highlights`,
    "Gallery Highlights"
  ]));
  safeAssignPathIfExists(draft, "gallery.image_source.image_search_query", galleryQuery);

  // If live draft still uses layout:null, fill it directly
  safeAssignPathIfExists(draft, "gallery.layout", computedLayout);

  // Since your current draft shape may not have computed_* fields yet,
  // create them directly under gallery so downstream build can use them.
  draft.gallery = isObject(draft.gallery) ? draft.gallery : {};
  draft.gallery.computed_layout = computedLayout;
  draft.gallery.computed_count = computedCount;
}

function syncFaqDraftFromEvidence(draft, factRegistry) {
  const fact = (key) => factRegistry?.[key]?.value;
  const faqAngles = ensureArrayStrings(fact("faq_angles"));

  if (Array.isArray(getByPath(draft, "faqs")) && faqAngles.length) {
    safeAssignPathIfExists(
      draft,
      "faqs",
      faqAngles.slice(0, 6).map((question) => ({
        question,
        answer: ""
      }))
    );
  }
}

function syncInvestmentDraftFromEvidence(draft, factRegistry) {
  const fact = (key) => factRegistry?.[key]?.value;
  const pricing = cleanString(fact("pricing"));

  if (!Array.isArray(getByPath(draft, "investment"))) return;
  if (!isStandardizedPricing(pricing)) return;

  safeAssignPathIfExists(draft, "investment", [
    {
      tier_name: "Core Service",
      price: pricing,
      popular: true,
      features: ["Pricing guided by the current scope"]
    }
  ]);
}

function syncContactDraftFromEvidence(draft, factRegistry, state) {
  const fact = (key) => factRegistry?.[key]?.value;
  const businessName = firstNonEmpty([fact("business_name"), state.businessName, "our team"]);

  // Real live draft shape
  safeAssignPathIfExists(draft, "contact.title", firstNonEmpty([
    fact("cta_text"),
    "Request a Quote"
  ]));

  safeAssignPathIfExists(
    draft,
    "contact.text",
    buildContactSubheadline({
      bookingMethod: fact("booking_method"),
      pricing: fact("pricing"),
      contactPath: fact("contact_path")
    })
  );

  safeAssignPathIfExists(draft, "contact.cta_text", firstNonEmpty([fact("cta_text"), "Get in Touch"]));
  safeAssignPathIfExists(draft, "contact.cta_link", firstNonEmpty([bookingUrlValueForDraftLink(fact("booking_url")), fact("cta_link"), "#contact"]));
}

function syncFeaturesDraftFromEvidence(draft, factRegistry) {
  const fact = (key) => factRegistry?.[key]?.value;
  const serviceList = ensureArrayStrings(fact("service_list"));
  const offer = cleanString(fact("primary_offer"));
  const diff = cleanString(fact("differentiation"));

  if (!Array.isArray(getByPath(draft, "features"))) return;
  if (getByPath(draft, "features").length > 0) return;

  const baseFeatures = serviceList.length
    ? serviceList.slice(0, 4).map((item, index) => ({
        title: titleCase(item),
        description: offer || diff || item,
        icon_slug: safeFeatureIcon(ALLOWED_ICON_TOKENS[index] || "check")
      }))
    : [
        {
          title: "What We Deliver",
          description: firstNonEmpty([offer, diff, "Premium results tailored to the client."]),
          icon_slug: safeFeatureIcon("check")
        }
      ];

  safeAssignPathIfExists(draft, "features", baseFeatures);
}

function syncMenuFromToggles(draft, toggles) {
  if (!Array.isArray(getByPath(draft, "settings.menu"))) return;

  const menu = [{ label: "Home", path: "#home" }];

  if (toggles.show_about) menu.push({ label: "About", path: "#about" });
  menu.push({ label: "Features", path: "#features" });
  if (toggles.show_events) menu.push({ label: "Events", path: "#events" });
  if (toggles.show_process) menu.push({ label: "Process", path: "#process" });
  if (toggles.show_testimonials) menu.push({ label: "Testimonials", path: "#testimonials" });
  if (toggles.show_comparison) menu.push({ label: "Comparison", path: "#comparison" });
  if (toggles.show_gallery) menu.push({ label: "Gallery", path: "#gallery" });
  if (toggles.show_investment) menu.push({ label: "Investment", path: "#investment" });
  if (toggles.show_faqs) menu.push({ label: "FAQs", path: "#faqs" });
  if (toggles.show_service_area) menu.push({ label: "Service Area", path: "#service-area" });
  menu.push({ label: "Contact", path: "#contact" });

  // enum-safe only
  const allowed = new Set([
    "#home",
    "#about",
    "#features",
    "#events",
    "#process",
    "#testimonials",
    "#comparison",
    "#gallery",
    "#investment",
    "#faqs",
    "#service-area",
    "#contact"
  ]);

  const safeMenu = menu.filter((item) => allowed.has(item.path));
  safeAssignPathIfExists(draft, "settings.menu", safeMenu);
}

function computeSectionStatus({ blueprint, schemaGuide }) {
  const out = {};
  const draft = safeObject(blueprint.business_draft);
  const components = safeObject(blueprint.component_states);

  for (const [component, guide] of Object.entries(schemaGuide)) {
    if (component.startsWith("_")) continue;
    const state = components[component] || {};
    const sectionValue = getByPath(draft, component);
    const hasDraft = hasMeaningfulValue(sectionValue);
    const score = Number(
      (
        (Number(state.confidence || 0) * 0.5) +
        (state.draft_ready ? 0.25 : 0) +
        (state.premium_ready ? 0.25 : 0)
      ).toFixed(2)
    );

    out[component] = {
      enabled: !!state.enabled,
      required: !!guide.required,
      score,
      draft_ready: !!state.draft_ready,
      premium_ready: !!state.premium_ready,
      status:
        !state.enabled ? "disabled" :
        score >= 0.9 ? "strong" :
        score >= 0.55 ? "partial" :
        "weak",
      has_draft: hasDraft
    };
  }

  return out;
}

function buildVerificationQueue({ blueprint, state }) {
  const queue = [];
  const factRegistry = safeObject(blueprint.fact_registry);
  const decisionStates = safeObject(blueprint.decision_states);
  const strategyContract = safeObject(state?.provenance?.strategy_contract);
  const mustVerifyNow = cleanList(strategyContract?.content_requirements?.must_verify_now);
  const publishRequired = cleanList(strategyContract?.content_requirements?.publish_required_fields);

  for (const [key, fact] of Object.entries(factRegistry)) {
    const missing = !hasMeaningfulValue(fact?.value);
    const partial = cleanString(fact?.status) === "partial";
    const requiresClient = !!fact?.requires_client_verification;
    const relatedSections = cleanList(fact?.related_sections);

    const bundleId = inferDecisionForFact(key);
    const priorityBase = Number(decisionStates?.[bundleId]?.priority || 100);

    const verifyTerms = mustVerifyNow.concat(publishRequired).map((x) => x.toLowerCase());
    const keyWords = key.toLowerCase().replace(/_/g, " ");
    const shouldVerifyByContract = verifyTerms.some((term) => keyWords.includes(term) || term.includes(keyWords));

    if (!missing && !partial && !requiresClient && !shouldVerifyByContract) continue;

    queue.push({
      field_key: key,
      bundle_id: bundleId,
      priority:
        priorityBase +
        (missing ? 70 : 0) +
        (partial ? 35 : 0) +
        (requiresClient ? 25 : 0) +
        (shouldVerifyByContract ? 20 : 0),
      missing,
      partial,
      requires_client_verification: requiresClient,
      related_sections: relatedSections,
      reason: inferVerificationReasonForFact(key)
    });
  }

  return queue.sort((a, b) => b.priority - a.priority);
}

/* ========================================================================
 * Access model (how customers reach / engage: physical + service area + contact)
 * Gate: access completeness before premium optimization.
 * ======================================================================== */

/** @typedef {"local_physical"|"local_service_area"|"virtual_remote"|"hybrid"} AccessModelKey */

/**
 * Preflight `entity_profile.business_model` / strategy `business_context.business_model` wins over
 * heuristics (e.g. seeded `service_area` must not downgrade a storefront to service-area-only).
 * @see preflight-recon entity_profile.business_model enum
 */
function mapPreflightBusinessModelToAccessModel(raw) {
  const m = cleanString(raw).toLowerCase().replace(/\s+/g, "_");
  if (!m) return null;
  if (m === "storefront" || m.includes("storefront")) return "local_physical";
  if (m === "service_area" || m === "service-area") return "local_service_area";
  if (m === "online") return "virtual_remote";
  if (m === "hybrid") return "hybrid";
  if (m === "destination") return "hybrid";
  return null;
}

function inferAccessModel(blueprint, state) {
  const fr = safeObject(blueprint?.fact_registry);
  const strategy = safeObject(blueprint?.strategy);
  const bc = safeObject(strategy.business_context);
  const provenanceBc = safeObject(state?.provenance?.strategy_contract?.business_context);
  const preflightBm = firstNonEmpty([
    cleanString(bc.business_model),
    cleanString(provenanceBc.business_model)
  ]);
  const fromPreflight = mapPreflightBusinessModelToAccessModel(preflightBm);
  if (fromPreflight) return fromPreflight;

  const cat = cleanString(bc.category).toLowerCase();
  const arch = cleanString(bc.strategic_archetype).toLowerCase();
  const pi = safeObject(state?.preflight_intelligence);
  const bm = cleanString(fr.booking_method?.value).toLowerCase().replace(/\s+/g, "_");

  const blob = [
    cat,
    arch,
    cleanString(fr.primary_offer?.value),
    cleanString(fr.business_understanding?.value),
    cleanString(pi?.positioning),
    cleanString(pi?.opportunity),
    cleanString(bc.business_description),
    cleanString(bc.summary)
  ]
    .join(" ")
    .toLowerCase();

  const hasAddr = isFactComplete(fr.address);
  const hasMainGeo = isFactComplete(fr.service_area_main);

  if (bm.includes("virtual") || /\bremote\b|\bvirtual\b/.test(arch)) {
    return "virtual_remote";
  }
  if (
    /\b(coach|consulting|agency|freelance|online)\b/.test(cat) ||
    /\b(coach|consultant|advisor)\b/.test(blob)
  ) {
    return "virtual_remote";
  }

  if (
    /\b(mobile|field)\b/.test(arch) ||
    blob.includes("we come to you") ||
    blob.includes("come to your") ||
    /\bserving\b/.test(blob) ||
    (blob.includes("mobile") && blob.includes("service"))
  ) {
    return "local_service_area";
  }

  if (
    /\b(gallery|salon|retail|restaurant|storefront|framing)\b/.test(cat) ||
    blob.includes("visit us") ||
    blob.includes("our location") ||
    blob.includes("walk-in")
  ) {
    return "local_physical";
  }

  if (
    (blob.includes("studio") || blob.includes("gallery")) &&
    (blob.includes("online") || blob.includes("book online") || blob.includes("schedule online"))
  ) {
    return "hybrid";
  }

  if (hasAddr && hasMainGeo) return "hybrid";
  if (hasAddr) return "local_physical";
  if (hasMainGeo) return "local_service_area";

  return "hybrid";
}

/**
 * Phone-forward booking intents (call, quote-by-phone, etc.) require a published phone — not just email.
 * Bare "manual" is excluded so email-only manual flows can still pass until phone is collected.
 */
function requiresPublishedPhoneForExecution(bmRaw) {
  const m = cleanString(bmRaw).toLowerCase().replace(/\s+/g, "_");
  if (!m || m === "manual") return false;
  return isManualBookingMethodValue(bmRaw);
}

/**
 * Intent (booking_method) is not execution: e.g. "call" without a number is not an operable CTA.
 */
function evaluateExecutionPathForAccess(fr) {
  const bm = fr?.booking_method?.value;
  const hasPhone = isFactComplete(fr.phone);
  const hasEmail = isFactComplete(fr.email);
  const contactPathOk = isFieldSatisfied("contact_path", fr);
  const bookingUrlOk = isFieldSatisfied("booking_url", fr);
  const m = cleanString(bm).toLowerCase().replace(/\s+/g, "_");

  if (!hasMeaningfulValue(bm)) {
    return { ok: false, missing_focus_id: "action_path" };
  }

  if (requiresPublishedPhoneForExecution(bm)) {
    return hasPhone
      ? { ok: true, missing_focus_id: null }
      : { ok: false, missing_focus_id: "phone_for_call" };
  }

  if (
    m.includes("book_online") ||
    m.includes("online_booking") ||
    (m.includes("schedule") && (m.includes("online") || m.includes("link")))
  ) {
    const v = fr.booking_url?.value;
    const real =
      typeof v === "string" &&
      hasMeaningfulValue(v) &&
      !isBookingUrlNoLinkSentinel(v) &&
      isPlausibleBookingUrlString(v);
    return real
      ? { ok: true, missing_focus_id: null }
      : { ok: false, missing_focus_id: "booking_url_live" };
  }

  const hasReach = hasPhone || hasEmail;
  const ok = hasReach || contactPathOk || bookingUrlOk;
  return {
    ok,
    missing_focus_id: ok ? null : "action_path"
  };
}

function evaluateAccessSatisfaction(fr, model) {
  const hasAddr = isFactComplete(fr.address);
  const hasHours = isFactComplete(fr.hours);
  const hasMain = isFactComplete(fr.service_area_main);
  const hasSurround =
    (Array.isArray(fr.surrounding_cities?.value) && fr.surrounding_cities.value.length > 0) ||
    ensureArrayStrings(fr.service_area_list?.value).length > 1;
  const exec = evaluateExecutionPathForAccess(fr);

  let checks = [];
  let satisfied = false;

  switch (model) {
    case "local_physical": {
      const hasBm = hasMeaningfulValue(fr.booking_method?.value);
      checks = [
        { id: "address", ok: hasAddr },
        { id: "hours", ok: hasHours },
        ...(hasBm ? [{ id: "execution_path", ok: exec.ok }] : [])
      ];
      satisfied = hasAddr && hasHours && (!hasBm || exec.ok);
      break;
    }
    case "local_service_area":
      checks = [
        { id: "service_area_main", ok: hasMain },
        { id: "reach_or_path", ok: exec.ok }
      ];
      satisfied = hasMain && exec.ok;
      break;
    case "virtual_remote":
      checks = [{ id: "digital_reach", ok: exec.ok }];
      satisfied = exec.ok;
      break;
    case "hybrid":
    default:
      checks = [
        {
          id: "location_or_geo",
          ok: hasAddr || hasMain || hasSurround
        },
        { id: "action_path", ok: exec.ok }
      ];
      satisfied = (hasAddr || hasMain || hasSurround) && exec.ok;
      break;
  }

  const score = checks.length ? checks.filter((c) => c.ok).length / checks.length : 0;
  const failed = checks.find((c) => !c.ok);
  let missing_focus_id = failed?.id || null;
  if (
    missing_focus_id &&
    ["action_path", "reach_or_path", "digital_reach", "execution_path"].includes(missing_focus_id) &&
    exec.missing_focus_id
  ) {
    missing_focus_id = exec.missing_focus_id;
  }
  return {
    satisfied,
    score: Number(score.toFixed(3)),
    checks,
    missing_focus_id
  };
}

function buildAccessPlannerHint(access) {
  if (!access || access.satisfied) return null;
  const id = cleanString(access.missing_focus_id);
  const map = {
    address: "contact_details",
    hours: "contact_details",
    service_area_main: "service_area",
    reach_or_path: "conversion",
    digital_reach: "conversion",
    action_path: "conversion",
    location_or_geo: "service_area",
    execution_path: "contact_details",
    phone_for_call: "contact_details",
    booking_url_live: "conversion"
  };
  return {
    missing_focus_id: id || null,
    decision_boost: map[id] || "contact_details"
  };
}

function computeAccessReadiness(blueprint, state) {
  const fr = safeObject(blueprint.fact_registry);
  const bc = safeObject(blueprint?.strategy?.business_context);
  const provenanceBc = safeObject(state?.provenance?.strategy_contract?.business_context);
  const businessModelSignal = firstNonEmpty([
    cleanString(bc.business_model),
    cleanString(provenanceBc.business_model)
  ]);
  const preflightMapped = mapPreflightBusinessModelToAccessModel(businessModelSignal);

  const model = inferAccessModel(blueprint, state);
  const sat = evaluateAccessSatisfaction(fr, model);
  const planner_hint = buildAccessPlannerHint({ ...sat, model, satisfied: sat.satisfied });

  return {
    spec_version: 1,
    model,
    satisfied: sat.satisfied,
    score: sat.score,
    checks: sat.checks,
    missing_focus_id: sat.missing_focus_id,
    planner_hint,
    business_model_signal: businessModelSignal || null,
    access_model_source: preflightMapped ? "preflight_business_model" : "inferred"
  };
}

function applyAccessGateToConversionFields(decision, fields, accessReadiness) {
  const list = cleanList(fields);
  if (!accessReadiness || accessReadiness.satisfied) return list;
  if (cleanString(decision) !== "conversion") return list;
  if (!list.includes("pricing")) return list;
  return [...list.filter((f) => f !== "pricing"), "pricing"];
}

/** Facts that satisfy “access” (reach / place / geo) — used to gate planner when access_readiness is not satisfied. */
const ACCESS_GATE_PRIMARY_FIELDS = new Set([
  "booking_method",
  "booking_url",
  "contact_path",
  "phone",
  "email",
  "address",
  "hours",
  "service_area_main",
  "surrounding_cities"
]);

function isAccessPrimaryField(fieldKey) {
  return ACCESS_GATE_PRIMARY_FIELDS.has(cleanString(fieldKey));
}

/** Per-component urgency when choosing what to unlock next (higher = prioritize intake toward this). */
const PREMIUM_COMPONENT_WEIGHTS = {
  contact: 1,
  hero: 0.85,
  features: 0.72,
  investment: 0.65,
  testimonials: 0.62,
  gallery: 0.55,
  faqs: 0.48,
  processSteps: 0.42,
  about: 0.38,
  service_area: 0.35,
  events: 0.28,
  comparison: 0.26
};

/**
 * How strongly each intake decision lifts premium readiness for site components.
 * Values are 0–1; a decision can move multiple components (e.g. positioning → hero + features).
 */
const PREMIUM_DECISION_IMPACT = {
  conversion: { contact: 0.95, hero: 0.35, investment: 0.12 },
  contact_details: { contact: 1 },
  positioning: { hero: 0.85, features: 0.8 },
  proof: { testimonials: 0.9, about: 0.28 },
  process: { processSteps: 1 },
  gallery_strategy: { gallery: 1, hero: 0.35 },
  pricing_model: { investment: 1, faqs: 0.18 },
  objection_handling: { faqs: 1 },
  story: { about: 1 },
  service_area: { service_area: 1 },
  events_strategy: { events: 0.75 },
  comparison_strategy: { comparison: 0.85 }
};

function premiumTierFromScore(score) {
  const s = Number(score) || 0;
  if (s >= 0.86) return "premium";
  if (s >= 0.55) return "partial";
  if (s <= 0.02) return "off";
  return "weak";
}

function scoreHeroPremium(fr, draft) {
  const checks = [
    hasMeaningfulValue(getByPath(draft, "hero.headline")),
    hasMeaningfulValue(getByPath(draft, "hero.subtext")),
    hasMeaningfulValue(getByPath(draft, "hero.image.image_search_query")),
    isFactComplete(fr.primary_offer) && isFactComplete(fr.differentiation)
  ];
  return checks.filter(Boolean).length / checks.length;
}

function scoreContactPremium(fr, draft) {
  const frObj = fr;
  const checks = [
    isFieldSatisfied("booking_method", frObj) && isFieldSatisfied("booking_url", frObj),
    isFactComplete(fr.phone) || isFactComplete(fr.email),
    hasMeaningfulValue(firstNonEmpty([fr.cta_text?.value, getByPath(draft, "contact.cta_text"), getByPath(draft, "settings.cta_text")])),
    isFactComplete(fr.contact_path) ||
      isFactComplete(fr.hours) ||
      hasMeaningfulValue(getByPath(draft, "contact.text"))
  ];
  return checks.filter(Boolean).length / checks.length;
}

function scoreFeaturesPremium(fr, draft) {
  const offer = isFactComplete(fr.primary_offer);
  const diff = isFactComplete(fr.differentiation);
  const services = ensureArrayStrings(fr.service_list?.value);
  const feats = getByPath(draft, "features");
  const featN = Array.isArray(feats) ? feats.length : 0;
  const checks = [
    offer,
    diff,
    services.length >= 2 || featN >= 2,
    featN >= 3 || services.length >= 4
  ];
  return checks.filter(Boolean).length / checks.length;
}

function scoreGalleryPremium(fr, draft) {
  const q = hasMeaningfulValue(getByPath(draft, "gallery.image_source.image_search_query"));
  const layout = hasMeaningfulValue(
    firstNonEmpty([getByPath(draft, "gallery.computed_layout"), getByPath(draft, "gallery.layout")])
  );
  const countOk = typeof getByPath(draft, "gallery.computed_count") === "number" && getByPath(draft, "gallery.computed_count") >= 6;
  const direction = isFactComplete(fr.gallery_visual_direction) || ensureArrayStrings(fr.image_themes?.value).length > 0;
  const checks = [q, layout, countOk || direction];
  return checks.filter(Boolean).length / checks.length;
}

function scoreFaqsPremium(fr, draft) {
  const angles = ensureArrayStrings(fr.faq_angles?.value);
  const draftFaqs = getByPath(draft, "faqs");
  const n = Array.isArray(draftFaqs) ? draftFaqs.length : 0;
  const checks = [angles.length >= 3, n >= 3];
  return checks.filter(Boolean).length / checks.length;
}

function scoreTestimonialsPremium(fr) {
  const quotes = ensureArrayStrings(fr.review_quotes?.value);
  const checks = [quotes.length >= 2, isFactComplete(fr.trust_signal) || quotes.length >= 1];
  return checks.filter(Boolean).length / checks.length;
}

function scoreProcessPremium(fr, draft) {
  const steps = getByPath(draft, "processSteps");
  const n = Array.isArray(steps) ? steps.length : 0;
  const summary = looksLikeProcessFact(fr.process_summary?.value);
  const checks = [n >= 3, summary];
  return checks.filter(Boolean).length / checks.length;
}

function scoreAboutPremium(fr, draft) {
  let hits = 0;
  if (isFactComplete(fr.founder_story)) hits++;
  if (hasMeaningfulValue(getByPath(draft, "about.story_text"))) hits++;
  if (isFactComplete(fr.years_experience)) hits++;
  if (hits >= 2) return 1;
  if (hits === 1) return 0.55;
  return 0;
}

function scoreInvestmentPremium(fr, draft) {
  const pricingOk = isPricingComplete(fr);
  const inv = getByPath(draft, "investment");
  const invOk = Array.isArray(inv) && inv.length > 0;
  const checks = [pricingOk, invOk];
  return checks.filter(Boolean).length / checks.length;
}

function scoreServiceAreaPremium(fr) {
  const main = isFactComplete(fr.service_area_main);
  const sur =
    (Array.isArray(fr.surrounding_cities?.value) && fr.surrounding_cities.value.length > 0) ||
    ensureArrayStrings(fr.service_area_list?.value).length > 1;
  if (main && sur) return 1;
  if (main) return 0.62;
  return 0;
}

function scoreEventsPremium(fr) {
  const ev = fr.events?.value;
  const n = Array.isArray(ev) ? ev.length : 0;
  if (n >= 3) return 1;
  if (n >= 1) return 0.45;
  return 0;
}

function scoreComparisonPremium(fr) {
  return isFactComplete(fr.comparison) ? 0.9 : 0;
}

function pickNextPremiumUnlock(components, accessReadiness) {
  let pool = components;
  if (accessReadiness && accessReadiness.satisfied === false) {
    pool = {};
    for (const k of ["contact", "service_area"]) {
      if (components[k]) pool[k] = components[k];
    }
    if (!Object.keys(pool).length) pool = components;
  }

  let best = null;
  let bestUrgency = -1;
  for (const [id, row] of Object.entries(pool)) {
    const w = PREMIUM_COMPONENT_WEIGHTS[id] || 0.32;
    const gap = 1 - Number(row.score || 0);
    const urgency = gap * w;
    if (urgency > bestUrgency) {
      bestUrgency = urgency;
      best = {
        component: id,
        urgency: Number(urgency.toFixed(3)),
        gap: Number(gap.toFixed(3)),
        score: row.score
      };
    }
  }
  return best;
}

/**
 * Per-component premium readiness (0–1) + which decision most reduces the biggest gap.
 * Drives planner boosts in buildQuestionCandidates — does not change field contracts.
 */
function computePremiumReadinessEngine(blueprint) {
  const fr = safeObject(blueprint.fact_registry);
  const draft = safeObject(blueprint.business_draft);
  const access = blueprint.access_readiness;

  const components = {
    hero: { score: scoreHeroPremium(fr, draft), missing: [] },
    contact: { score: scoreContactPremium(fr, draft), missing: [] },
    features: { score: scoreFeaturesPremium(fr, draft), missing: [] },
    gallery: { score: scoreGalleryPremium(fr, draft), missing: [] },
    faqs: { score: scoreFaqsPremium(fr, draft), missing: [] },
    testimonials: { score: scoreTestimonialsPremium(fr), missing: [] },
    processSteps: { score: scoreProcessPremium(fr, draft), missing: [] },
    about: { score: scoreAboutPremium(fr, draft), missing: [] },
    investment: { score: scoreInvestmentPremium(fr, draft), missing: [] },
    service_area: { score: scoreServiceAreaPremium(fr), missing: [] },
    events: { score: scoreEventsPremium(fr), missing: [] },
    comparison: { score: scoreComparisonPremium(fr), missing: [] }
  };

  for (const [id, row] of Object.entries(components)) {
    row.tier = premiumTierFromScore(row.score);
  }

  const next_unlock = pickNextPremiumUnlock(components, access);
  const ordered = Object.entries(components)
    .map(([id, row]) => ({
      component: id,
      score: row.score,
      tier: row.tier,
      weighted_gap: Number(((1 - row.score) * (PREMIUM_COMPONENT_WEIGHTS[id] || 0.3)).toFixed(3))
    }))
    .sort((a, b) => b.weighted_gap - a.weighted_gap);

  const avg =
    Object.values(components).reduce((s, x) => s + x.score, 0) / Math.max(1, Object.keys(components).length);

  return {
    spec_version: 1,
    components,
    next_unlock,
    ordered_by_impact: ordered,
    access_gate: access
      ? {
          satisfied: !!access.satisfied,
          model: access.model,
          score: access.score,
          missing_focus_id: access.missing_focus_id || null,
          planner_hint: access.planner_hint || null,
          business_model_signal: access.business_model_signal || null,
          access_model_source: access.access_model_source || null
        }
      : null,
    summary: {
      avg_score: Number(avg.toFixed(3)),
      weakest: ordered[0] || null,
      access_satisfied: access ? !!access.satisfied : true,
      access_model: access?.model || null
    }
  };
}

function premiumUnlockBoostForDecision(decision, premiumReadiness) {
  const impact = PREMIUM_DECISION_IMPACT[cleanString(decision)];
  if (!impact || !premiumReadiness?.components) return 0;

  const focusComp = cleanString(premiumReadiness.next_unlock?.component);
  let boost = 0;

  for (const [comp, coupling] of Object.entries(impact)) {
    const row = premiumReadiness.components[comp];
    if (!row) continue;
    const gap = 1 - Number(row.score || 0);
    const globalW = PREMIUM_COMPONENT_WEIGHTS[comp] || 0.35;
    const focus = focusComp && focusComp === comp ? 1.42 : 1;
    boost += gap * coupling * globalW * 58 * focus;
  }

  return Math.round(Math.min(96, boost));
}

function buildQuestionCandidates({ blueprint, previousPlan, lastAudit, state }) {
  const candidates = [];
  const decisionStates = safeObject(blueprint.decision_states);
  const factRegistry = safeObject(blueprint.fact_registry);
  const componentStates = safeObject(blueprint.component_states);
  const accessReadiness = blueprint.access_readiness || computeAccessReadiness(blueprint, state);
  const premiumReadiness =
    blueprint.premium_readiness ||
    computePremiumReadinessEngine({ ...blueprint, access_readiness: accessReadiness });
  const questionHistory = Array.isArray(blueprint.question_history) ? blueprint.question_history : [];
  const askedTurns = questionHistory.length;
  const conversionTargetFieldsOrdered = applyAccessGateToConversionFields(
    "conversion",
    cleanList(getDecisionTargets()?.conversion?.target_fields).filter((field) =>
      Object.prototype.hasOwnProperty.call(factRegistry, field)
    ),
    accessReadiness
  );
  const conversionUnresolvedCount = conversionTargetFieldsOrdered.filter(
    (field) => !isFieldSatisfied(field, factRegistry)
  ).length;
  const decisionTargets = getDecisionTargets();

  for (const [decision, config] of Object.entries(decisionTargets)) {
    const decisionState = decisionStates[decision] || {};
    const rawTargetFields = cleanList(config.target_fields).filter((field) =>
      Object.prototype.hasOwnProperty.call(factRegistry, field)
    );
    const targetFields = applyAccessGateToConversionFields(decision, rawTargetFields, accessReadiness);

    let unresolvedFields = targetFields.filter((field) => !isFieldSatisfied(field, factRegistry));
    const relatedComponents = cleanList(config.components).filter(
      (component) => componentStates[component]?.enabled || componentStates[component]?.required
    );

    if (!unresolvedFields.length && Number(decisionState.confidence || 0) >= 0.8) continue;

    // planner-side stall / repetition pivot
    const askedCounts = {};
    for (const entry of questionHistory) {
      if (cleanString(entry.bundle_id) === decision) {
        const field = cleanString(entry.primary_field);
        if (field) askedCounts[field] = (askedCounts[field] || 0) + 1;
      }
    }

    const updatedFactsThisTurn = cleanList(lastAudit?.updated_fact_keys);
    const stalledFields = unresolvedFields.filter((field) => {
      const asked = Number(askedCounts[field] || 0);
      const justUpdated = updatedFactsThisTurn.includes(field);
      return asked >= 2 && !justUpdated;
    });

    if (stalledFields.length) {
      unresolvedFields = unresolvedFields
        .filter((field) => !stalledFields.includes(field))
        .concat(stalledFields);
    }

    const nextPrimaryField = cleanString(unresolvedFields[0] || targetFields[0]);
    if (
      accessReadiness &&
      accessReadiness.satisfied === false &&
      unresolvedFields.length > 0 &&
      nextPrimaryField &&
      !isAccessPrimaryField(nextPrimaryField)
    ) {
      continue;
    }

    let score = Number(config.base_priority || 100);
    score += premiumUnlockBoostForDecision(decision, premiumReadiness);

    const plannerHint = accessReadiness?.planner_hint;
    if (accessReadiness && accessReadiness.satisfied === false && plannerHint?.decision_boost === decision) {
      score += 62;
    }

    score += unresolvedFields.length * 35;
    score += relatedComponents.filter((component) => !componentStates[component]?.draft_ready).length * 18;
    score += relatedComponents.filter((component) => !componentStates[component]?.premium_ready).length * 10;
    score += Math.round((1 - Number(decisionState.confidence || 0)) * 100);

    if (decision === "contact_details" && coreDecisionsStillWeak(decisionStates)) {
      if (accessReadiness && accessReadiness.satisfied === false) {
        score += 28;
      } else {
        score -= 140;
      }
    }

    // Early anchor: prefer conversion until core path is captured (softer than hard bundle bans; access gate uses isAccessPrimaryField).
    if (askedTurns < 4 && conversionUnresolvedCount > 0 && decision !== "conversion") {
      if (accessReadiness && accessReadiness.satisfied === false && (decision === "service_area" || decision === "contact_details")) {
        // still allow access-critical bundles
      } else {
        score -= 52;
      }
    }

    if (decision === "service_area" && coreDecisionsStillWeak(decisionStates)) {
      if (!(accessReadiness && accessReadiness.satisfied === false && accessReadiness.model === "local_service_area")) {
        score -= 90;
      }
    }

    if (decision === cleanString(previousPlan?.bundle_id)) {
      // Favor finishing the current decision before hopping bundles.
      score += 45;
    }

    if (stalledFields.length && unresolvedFields.length === stalledFields.length) {
      // if every unresolved field in this decision is stalled, reduce score to encourage a pivot
      score -= 60;
    }

    candidates.push({
      bundle_id: decision,
      score,
      target_fields: targetFields,
      unresolved_fields: unresolvedFields,
      target_sections: relatedComponents,
      primary_field: unresolvedFields[0] || targetFields[0] || "",
      intent: cleanString(config.intent),
      reason: cleanString(config.reason),
      tone: "consultative"
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function isPricingComplete(factRegistry) {
  const pricing = factRegistry?.pricing;

  if (!pricing || !hasMeaningfulValue(pricing.value)) return false;

  const value = cleanString(pricing.value).toLowerCase();

  // 🔥 Explicit pricing signals
  if (
    value.includes("quote") ||
    value.includes("custom") ||
    value.includes("based on") ||
    value.includes("depends") ||
    value.includes("estimate")
  ) {
    return true;
  }

  // 🔥 NEW: implicit pricing signals (CRITICAL)
  if (
    value.includes("size") ||
    value.includes("complexity") ||
    value.includes("scope") ||
    value.includes("windows") ||
    value.includes("home")
  ) {
    return true;
  }

  return false;
}

function planNextQuestion(candidates, previousBundleId, previousPrimaryField, factRegistry) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const lastPrimary = cleanString(previousPrimaryField);

  // Manifest: progression depends only on satisfying the active primary_field first.
  if (lastPrimary && !isFieldSatisfied(lastPrimary, factRegistry)) {
    const stickyCandidates = candidates
      .map((candidate) => {
        const targetFields = cleanList(candidate.target_fields);
        if (!targetFields.includes(lastPrimary)) return null;
        const unresolvedFields = targetFields.filter((f) => !isFieldSatisfied(f, factRegistry));
        if (!unresolvedFields.includes(lastPrimary)) return null;
        let score = Number(candidate.score || 0);
        const bundleId = cleanString(candidate.bundle_id);
        if (bundleId === cleanString(previousBundleId) && unresolvedFields.length > 0) {
          score += 20;
        }
        return { ...candidate, adjusted_score: score, unresolved_fields_runtime: unresolvedFields };
      })
      .filter(Boolean)
      .sort((a, b) => b.adjusted_score - a.adjusted_score);

    const sticky = stickyCandidates[0];
    if (sticky) {
      return {
        ...sticky,
        primary_field: lastPrimary,
        unresolved_count: sticky.unresolved_fields_runtime.length
      };
    }
  }

  const adjusted = candidates.map((candidate) => {
    let score = Number(candidate.score || 0);
    const bundleId = cleanString(candidate.bundle_id);
    const targetFields = cleanList(candidate.target_fields);
    const unresolvedFields = targetFields.filter((f) => !isFieldSatisfied(f, factRegistry));

    const allComplete = unresolvedFields.length === 0;

    if (allComplete) {
      score -= 1000;
    }

    if (bundleId === cleanString(previousBundleId) && unresolvedFields.length > 0) {
      score += 20;
    }

    return { ...candidate, adjusted_score: score, unresolved_fields_runtime: unresolvedFields };
  });

  adjusted.sort((a, b) => b.adjusted_score - a.adjusted_score);

  const best = adjusted.find((candidate) => (candidate.unresolved_fields_runtime || []).length > 0);
  if (!best) return null;

  const targetFields = cleanList(best.target_fields);
  const unresolvedFields = Array.isArray(best.unresolved_fields_runtime)
    ? best.unresolved_fields_runtime
    : targetFields.filter((f) => !isFieldSatisfied(f, factRegistry));

  const nextPrimaryField = unresolvedFields[0] || null;
  if (!nextPrimaryField) return null;

  return {
    ...best,
    primary_field: nextPrimaryField,
    unresolved_count: unresolvedFields.length
  };
}

function evaluateBlueprintReadiness(blueprint) {
  const componentStates = safeObject(blueprint.component_states);
  const factRegistry = safeObject(blueprint.fact_registry);

  // ==========================
  // 🔥 CONVERSION RESOLUTION
  // ==========================
  const bookingMethodRaw = cleanString(factRegistry?.booking_method?.value);
  const bookingMethod = bookingMethodRaw ? bookingMethodRaw.toLowerCase() : "";
  const bookingUrlResolved = factRegistry?.booking_url?.status === "answered";

  const contactPathResolved =
    isFactComplete(factRegistry?.contact_path) ||
    hasMeaningfulValue(getByPath(blueprint.business_draft, "contact.cta_link")) ||
    hasMeaningfulValue(getByPath(blueprint.business_draft, "settings.cta_link"));

  const manualBooking = isManualBookingMethodValue(bookingMethodRaw);

  const conversionResolved =
    hasMeaningfulValue(bookingMethod) &&
    (bookingUrlResolved || manualBooking) &&
    contactPathResolved;

  // ==========================
  // 🔥 STRONG GATING SIGNALS (NEW)
  // ==========================
  const hasPositioning =
   isFactComplete(factRegistry?.target_persona) &&
    isFactComplete(factRegistry?.differentiation);

  const hasProof =
    (
      Array.isArray(factRegistry?.review_quotes?.value) &&
      factRegistry.review_quotes.value.length > 0
    ) ||
   isFactComplete(factRegistry?.years_experience);

  // 🔥 NEW
  const hasServiceArea =
    isFactComplete(factRegistry?.service_area_main) ||
    (
      Array.isArray(factRegistry?.surrounding_cities?.value) &&
      factRegistry.surrounding_cities.value.length > 0
    );

  const hasContact =
    isFactComplete(factRegistry?.phone) ||
    isFactComplete(factRegistry?.email);

  // 🔥 FIXED
  const canGenerate =
    conversionResolved &&
    hasPositioning &&
    hasProof &&
    hasContact &&
    hasServiceArea;

  // ==========================
  // MINIMUM VIABLE
  // ==========================
  const minimumViable = {
    brand_name: hasMeaningfulValue(getByPath(blueprint.business_draft, "brand.name")),

    hero_headline: hasMeaningfulValue(
      getByPath(blueprint.business_draft, "hero.headline")
    ),

    hero_subtext: hasMeaningfulValue(
      getByPath(blueprint.business_draft, "hero.subtext")
    ),

    features:
      Array.isArray(getByPath(blueprint.business_draft, "features")) &&
      getByPath(blueprint.business_draft, "features").length >= 1,

    contact_button:
      hasMeaningfulValue(getByPath(blueprint.business_draft, "contact.button_text")) ||
      hasMeaningfulValue(getByPath(blueprint.business_draft, "contact.cta_text")),

    // 🔥 conversion must also pass strong gating
    // 🔥 CLEANED
    conversion: conversionResolved
  };

  // ==========================
  // PREMIUM SIGNALS
  // ==========================
  const premiumSignals = {
    proof:
      componentStates.trustbar?.enabled ||
      componentStates.testimonials?.enabled,

    visuals:
      componentStates.gallery?.premium_ready ||
      componentStates.hero?.premium_ready,

    process: componentStates.processSteps?.enabled
      ? componentStates.processSteps?.draft_ready
      : true,

    story: componentStates.about?.enabled
      ? componentStates.about?.draft_ready
      : true,

    geo: componentStates.service_area?.enabled
      ? componentStates.service_area?.draft_ready
      : true
  };

  // ==========================
  // FINAL EVALUATION
  // ==========================
  const minimumViablePassed = Object.values(minimumViable).every(Boolean);

  const premiumReadyPassed =
    minimumViablePassed &&
    Object.values(premiumSignals).every(Boolean);

  // ==========================
  // SCORE
  // ==========================
  const minimumScore =
    Object.values(minimumViable).filter(Boolean).length /
    Object.values(minimumViable).length;

  const premiumScore =
    Object.values(premiumSignals).filter(Boolean).length /
    Object.values(premiumSignals).length;

    const rawScore =
      (minimumScore * 0.6) +
      (premiumScore * 0.4);

    const finalScore = canGenerate
      ? rawScore
      : Math.min(rawScore, 0.92);

  return {
    minimum_viable_preview: minimumViablePassed,
    premium_ready_preview: premiumReadyPassed,

    // 🔥 TRUE readiness (fixed)
    can_generate_now: canGenerate,

   score: Number(finalScore.toFixed(2)),

    minimum_viable_detail: minimumViable,
    premium_ready_detail: premiumSignals,

    conversion_debug: {
      bookingMethod,
      bookingUrlResolved,
      manualBooking,
      contactPathResolved,
      conversionResolved,
      hasPositioning,
      hasProof,
      hasContact,
      canGenerate
    }
  };
}

/** v1: token overlap only — deterministic, no LLM (post-interpretation reinforcement). */
const REINFORCEMENT_STOPWORDS = new Set([
  "that",
  "this",
  "with",
  "from",
  "they",
  "have",
  "been",
  "were",
  "your",
  "their",
  "there",
  "what",
  "when",
  "where",
  "which",
  "would",
  "could",
  "about",
  "into",
  "just",
  "also",
  "very",
  "some",
  "than",
  "then",
  "them",
  "such",
  "each",
  "other",
  "more",
  "most",
  "many",
  "much",
  "well",
  "only",
  "even",
  "like",
  "make",
  "does",
  "done",
  "being",
  "over",
  "after",
  "before"
]);

const REINFORCEMENT_OVERLAP_THRESHOLD = 0.38;

function reinforcementTokensFromAnswer(answerText) {
  return new Set(
    cleanString(answerText)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !REINFORCEMENT_STOPWORDS.has(w))
  );
}

function significantTokensFromInsight(insightText) {
  return cleanString(insightText)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !REINFORCEMENT_STOPWORDS.has(w));
}

function reinforcementOverlapRatio(answerText, insightText) {
  const answerTok = reinforcementTokensFromAnswer(answerText);
  const insightToks = significantTokensFromInsight(insightText);
  if (insightToks.length === 0) return 0;
  let hit = 0;
  for (const w of insightToks) {
    if (answerTok.has(w)) hit += 1;
  }
  return hit / insightToks.length;
}

/**
 * Positive alignment only; does not affect planning or primary_field.
 * @returns {{ type: string, message: string, source: string } | null}
 */
function evaluatePositiveReinforcement({
  combinedAnswer,
  preflightIntelligence,
  lastTurnReinforcementSource
}) {
  const text = cleanString(combinedAnswer);
  const pi = isObject(preflightIntelligence) ? preflightIntelligence : null;
  if (!text || !pi) return null;

  const candidates = [];
  const wa = cleanString(pi.winning_angle);
  if (wa) candidates.push({ source: "winning_local_angle", text: wa });
  const hyp = cleanString(pi.differentiation_hypothesis);
  if (hyp) candidates.push({ source: "differentiation_hypothesis", text: hyp });
  for (const line of cleanList(pi.buyer_factors)) {
    const b = cleanString(line);
    if (b) candidates.push({ source: "buyer_comparison_factors", text: b });
  }

  const messages = {
    winning_local_angle: "That actually lines up well with what makes you stand out locally.",
    differentiation_hypothesis: "That fits the positioning we're seeing for you.",
    buyer_comparison_factors: "That matches how buyers in your space often weigh their options."
  };

  for (const c of candidates) {
    if (cleanString(c.source) === cleanString(lastTurnReinforcementSource)) continue;
    if (reinforcementOverlapRatio(text, c.text) < REINFORCEMENT_OVERLAP_THRESHOLD) continue;
    return {
      type: "positive_alignment",
      message: messages[c.source],
      source: c.source
    };
  }
  return null;
}

function appendReinforcementToAssistantMessage(reinforcement, assistantMessage) {
  const base = cleanString(assistantMessage);
  const note = cleanString(reinforcement?.message);
  if (!note) return base;
  if (!base) return note;
  return `${note}\n\n${base}`;
}

const PRICING_BRIDGE_INSTRUCTION =
  "Ask ONLY how pricing or quoting works for their work (one topic; no booking channel or URL).";

/**
 * One opinionated framing sentence for pricing: competitor weaknesses, local alternatives, buyer tradeoffs,
 * then wedge/hypothesis — generic buyer lists last. Full sentence is built first, then truncated once (caller
 * may truncate again to narrative maxChars). Tone stays client-facing, not internal strategy jargon.
 */
function buildPricingFramingSentence(pi) {
  if (!isObject(pi)) return "";
  /** One truncation per sentence (full text first); narrative may truncate again to its budget. */
  const frame = (sentence, max = 340) => truncate(cleanString(sentence), max);
  const weak = cleanList(pi.weaknesses)
    .map((w) => cleanString(w))
    .filter(Boolean);
  const buyers = cleanList(pi.buyer_factors)
    .map((x) => cleanString(x))
    .filter(Boolean);
  const alts = cleanList(pi.local_alternatives)
    .map((a) => cleanString(a))
    .filter(Boolean);
  const focus = cleanList(pi.recommended_focus)
    .map((f) => cleanString(f))
    .filter(Boolean);
  const hyp = cleanString(pi.differentiation_hypothesis);
  const pos = cleanString(pi.positioning);
  const opp = cleanString(pi.opportunity);
  const angle = cleanString(pi.winning_angle);

  if (weak.length && hyp) {
    return frame(
      `Buyers feel ${weak[0]}; your pricing should reflect this clearly: ${hyp}.`
    );
  }
  if (weak.length >= 2) {
    return frame(
      `The tension is ${weak[0]} versus ${weak[1]} — your quote rules should show which side you own.`
    );
  }
  if (weak.length && buyers.length) {
    return frame(
      `They compare on ${buyers.slice(0, 2).join(" and ")} while peers often show ${weak[0]}.`
    );
  }
  if (weak.length) {
    return frame(
      `Peers often stumble on ${weak[0]}; spell how you price so that gap is obvious.`
    );
  }
  if (alts.length && hyp) {
    const vs = alts.slice(0, 2).join(" and ");
    return frame(
      `Against ${vs}, this is the kind of value your pricing should communicate: ${hyp}.`
    );
  }
  if (alts.length && buyers.length) {
    const vs = alts.slice(0, 2).join(" and ");
    return frame(
      buyers[1]
        ? `Versus ${vs}, the tradeoff is ${buyers[0]} versus ${buyers[1]} — quotes should show which side you own.`
        : `Versus ${vs}, buyers still judge on ${buyers[0]} — make pricing pick a side.`
    );
  }
  if (focus.length >= 2) {
    return frame(
      `The pull is between ${focus[0]} and ${focus[1]} — align quotes with the tradeoff you're choosing.`
    );
  }
  if (focus.length) {
    return frame(`Your quotes should foreground this: ${focus[0]}.`);
  }
  if (hyp) {
    return frame(`Your pricing should reflect this clearly: ${hyp}.`);
  }
  if (alts.length && angle) {
    const vs = alts[0];
    return frame(
      `You win locally when ${angle} — how do your quotes usually reflect that compared to ${vs}?`
    );
  }
  if (angle) {
    return frame(`You win locally when ${angle} — align quotes with that promise.`);
  }
  if (pos) {
    return frame(`Against generic options, the read is ${pos} — make quoting match that stance.`);
  }
  if (buyers.length) {
    return frame(
      `Buyers weigh ${buyers.slice(0, 3).join(", ")} — clarify how your quotes work.`
    );
  }
  if (opp) {
    return frame(opp, 220);
  }
  return "";
}

/**
 * Consultative context for the pricing slot: **one** framing sentence + optional instruction tail.
 * Does not add a second question; the deterministic/rephrase body stays one-field.
 */
function buildPricingPreflightNarrative(pi, { maxChars = 400, withPricingInstruction = false } = {}) {
  const tail = withPricingInstruction ? ` ${PRICING_BRIDGE_INSTRUCTION}` : "";
  const budget = Math.max(80, maxChars - tail.length);
  const body = truncate(buildPricingFramingSentence(pi), budget) + tail;
  return body.trim();
}

/** Lead clause max; question is never truncated (assembled separately). */
const EXPERT_LEAD_MAX = 180;

/**
 * Build lead from segments in **keep order**: first segment is last dropped when over budget.
 * Drops lowest-priority segments (listed last) until under max, then clamps the remainder only if needed.
 */
function squeezeExpertLead(parts, maxLead = EXPERT_LEAD_MAX) {
  const cleaned = parts.map((p) => cleanString(p)).filter(Boolean);
  let list = cleaned.slice();
  while (list.length > 1 && list.join(" ").length > maxLead) {
    list.pop();
  }
  let lead = list.join(" ").trim();
  if (lead.length > maxLead) {
    lead = truncate(lead, maxLead);
  }
  return lead;
}

/**
 * Two-part expert message: clamped lead + intact question (never blind-truncated with the lead).
 */
function buildExpertMessage({ lead, question }) {
  const q = cleanString(question);
  const l = cleanString(lead);
  if (!q) return l;
  if (!l) return q;
  return `${l}\n\n${q}`;
}

/**
 * Confident read on how customers actually think—one sentence, before guidance + question.
 * Not "this is important" but "this is what usually happens in their head."
 * @param {Record<string, unknown>} [extras] e.g. { callHeavy, accessKind, tangible }
 */
function buildInterpretation(primaryField, pi, blueprint, extras = {}) {
  const pf = cleanString(primaryField);
  const p = isObject(pi) ? pi : null;
  const opp = p ? cleanString(p.opportunity) : "";
  const pos = p ? cleanString(p.positioning) : "";
  const bc = safeObject(blueprint?.strategy?.business_context);
  const cat = cleanString(bc.category).toLowerCase();
  const blob = [cat, opp, pos].join(" ");

  if (pf === "phone") {
    if (extras.callHeavy) {
      return "For most customers, this is where they decide whether to move forward—they usually just want to call and get a clear answer.";
    }
    return "People bounce when contact feels vague; this line should match how you actually want to be reached.";
  }
  if (pf === "email") {
    return "Serious buyers often test the waters by email first—they're deciding if you sound real and responsive.";
  }
  if (pf === "address") {
    const kind = extras.accessKind || expertAccessKind(blueprint, pi);
    if (kind === "local_physical") {
      return "Walk-ins and map checks are where people either commit or bounce—clarity here is trust.";
    }
    if (kind === "local_service_area") {
      return "Most people sanity-check where you're based or who you serve before they bother reaching out.";
    }
    if (kind === "virtual_remote") {
      return "Remote buyers still look for a real anchor—location or base helps them picture who they're hiring.";
    }
    return "The right location line filters the wrong fits and reassures the right ones.";
  }
  if (pf === "hours") {
    return "Nobody likes guessing whether you're reachable—hours set expectations before the first hello.";
  }
  if (pf === "process_summary") {
    const tangible =
      extras.tangible ??
      /\b(fram|gallery|print|custom|art|piece|studio|bespoke)\b/i.test(blob);
    if (tangible) {
      return "Most people aren't buying a transaction—they're trusting you with something that matters to them.";
    }
    return "The experience is often what they're really evaluating—the deliverable is only part of the story.";
  }
  if (pf === "review_quotes") {
    return "Trust usually only clicks once someone can picture the outcome—not before.";
  }
  if (pf === "trust_signal") {
    return "People rarely bet on promises alone—they look for proof they can believe.";
  }
  return null;
}

/**
 * Lightweight access flavor for copy (storefront vs service area vs remote) from strategy + preflight.
 */
function expertAccessKind(blueprint, pi) {
  const bc = safeObject(blueprint?.strategy?.business_context);
  const pre = mapPreflightBusinessModelToAccessModel(bc.business_model);
  if (pre === "local_physical") return "local_physical";
  if (pre === "local_service_area") return "local_service_area";
  if (pre === "virtual_remote") return "virtual_remote";
  if (pre === "hybrid") return "hybrid";
  const p = isObject(pi) ? pi : {};
  const blob = [cleanString(bc.category), cleanString(p.positioning), cleanString(p.opportunity)]
    .join(" ")
    .toLowerCase();
  const cat = cleanString(bc.category).toLowerCase();
  if (
    /\b(gallery|retail|restaurant|salon|framing|storefront)\b/.test(cat) ||
    /walk-in|visit us|in person/.test(blob)
  ) {
    return "local_physical";
  }
  if (/\b(virtual|remote|online)\b/.test(cat) || /\b(coach|consultant|consulting)\b/.test(cat)) {
    return "virtual_remote";
  }
  if (/\b(mobile|field)\b/.test(cat) || /we come to you|come to your/.test(blob)) {
    return "local_service_area";
  }
  return "hybrid";
}

function expertCallHeavyBooking(fr) {
  const bm = fr?.booking_method?.value;
  if (requiresPublishedPhoneForExecution(bm)) return true;
  const s = cleanString(bm).toLowerCase();
  return /\bcall\b|\bphone\b|phone call|quote by phone/.test(s);
}

/**
 * Access (phone, email, address, hours): interpretation (stance on buyer behavior) + one clear ask.
 */
function buildAccessExpertQuestion(primaryField, businessName, blueprint, pi) {
  const name = cleanString(businessName) || "your business";
  const pf = cleanString(primaryField);
  const fr = safeObject(blueprint?.fact_registry);
  const kind = expertAccessKind(blueprint, pi);
  const callHeavy = expertCallHeavyBooking(fr);

  if (pf === "phone") {
    const interp = buildInterpretation("phone", pi, blueprint, { callHeavy });
    return buildExpertMessage({
      lead: squeezeExpertLead([interp]),
      question: `What's the best number for customers to reach ${name}?`
    });
  }
  if (pf === "email") {
    const interp = buildInterpretation("email", pi, blueprint);
    return buildExpertMessage({
      lead: squeezeExpertLead([interp]),
      question: `What email should we publish for ${name}?`
    });
  }
  if (pf === "address") {
    const interp = buildInterpretation("address", pi, blueprint, { accessKind: kind });
    return buildExpertMessage({
      lead: squeezeExpertLead([interp]),
      question: `What address or location should we show for ${name}?`
    });
  }
  if (pf === "hours") {
    const interp = buildInterpretation("hours", pi, blueprint);
    return buildExpertMessage({
      lead: squeezeExpertLead([interp]),
      question: `What hours or availability should people expect when they contact ${name}?`
    });
  }
  return "";
}

/**
 * Process: interpretation (what they're really buying) + optional preflight guidance + concrete ask.
 */
function buildProcessExpertQuestion(businessName, blueprint, pi) {
  const name = cleanString(businessName) || "your business";
  const bc = safeObject(blueprint?.strategy?.business_context);
  const cat = cleanString(bc.category);
  const p = isObject(pi) ? pi : null;
  const wd = p ? cleanString(p.website_direction) : "";
  const opp = p ? cleanString(p.opportunity) : "";
  const pos = p ? cleanString(p.positioning) : "";

  const tangible = /\b(fram|gallery|print|custom|art|piece|studio|bespoke)\b/i.test(
    [cat, opp, pos].join(" ")
  );
  const interp = buildInterpretation("process_summary", pi, blueprint, { tangible });
  const guidance = opp || pos || "";
  const prefix = wd ? `For the site journey we're considering: ${wd}` : "";

  const question = tangible
    ? "What does that experience usually look like when someone brings you a project—walk us through it in your own words."
    : `What does that process usually look like from first contact through completion for ${name}?`;

  /** Drop order when over budget: site-journey prefix → preflight guidance → interpretation (last resort clamp). */
  const leadParts = [interp];
  if (guidance) leadParts.push(guidance);
  if (prefix) leadParts.push(prefix);

  return buildExpertMessage({
    lead: squeezeExpertLead(leadParts),
    question
  });
}

/**
 * Proof (reviews / trust): interpretation (how trust forms) + buyer reality from preflight + ask for evidence.
 */
function buildProofExpertQuestion(primaryField, businessName, blueprint, pi) {
  const name = cleanString(businessName) || "your business";
  const pf = cleanString(primaryField);
  const p = isObject(pi) ? pi : null;
  const weak = p ? cleanList(p.weaknesses) : [];
  const buyers = p ? cleanList(p.buyer_factors) : [];
  const opp = p ? cleanString(p.opportunity) : "";

  const interp = buildInterpretation(pf, p, blueprint) || "";
  let bridge = "";
  if (opp) {
    bridge = opp;
  } else if (weak.length) {
    bridge = `Concretely, that often shows up as worrying about ${weak[0]}.`;
  } else if (buyers.length) {
    bridge = `They usually weigh ${buyers.slice(0, 2).join(" and ")} before saying yes.`;
  }

  /** Drop order: bridge (nuance / comparison) before interpretation. */
  const leadParts = [interp];
  if (bridge) leadParts.push(bridge);

  if (pf === "review_quotes") {
    return buildExpertMessage({
      lead: squeezeExpertLead(leadParts),
      question:
        "After working with you, what do customers usually say about the result—or what language should we echo on the site?"
    });
  }
  if (pf === "trust_signal") {
    return buildExpertMessage({
      lead: squeezeExpertLead(leadParts),
      question: `What should we lean on most for ${name}—reviews, outcomes, credentials, photos, or something else—so that confidence lands quickly?`
    });
  }
  return "";
}

/**
 * Replaces generic deterministic copy for access, process, and proof when we want expert tone.
 * @returns {string} Full question text, or "" to use standard deterministic + optional preflight lead.
 */
function buildExpertContextualDeterministicQuestion(plan, blueprint, businessName, preflightIntelligence) {
  const name =
    cleanString(businessName) ||
    cleanString(getByPath(blueprint, "business_draft.brand.name")) ||
    "your business";
  const bundleId = cleanString(plan?.bundle_id);
  const primaryField = cleanString(plan?.primary_field);
  const pi = isObject(preflightIntelligence) ? preflightIntelligence : null;

  if (bundleId === "contact_details") {
    const q = buildAccessExpertQuestion(primaryField, name, blueprint, pi);
    if (q) return q;
  }
  if (bundleId === "process" && primaryField === "process_summary") {
    return buildProcessExpertQuestion(name, blueprint, pi);
  }
  if (bundleId === "proof" && (primaryField === "review_quotes" || primaryField === "trust_signal")) {
    return buildProofExpertQuestion(primaryField, name, blueprint, pi);
  }
  return "";
}

/**
 * Preflight → intake bridge: one short framing note for the LLM (same primary_field only).
 * @see docs/PREFLIGHT_OUTPUT_SPEC_V1.md
 */
/**
 * Short opening clause for **deterministic** questions when LLM output is skipped.
 * Must stay on-topic for primary_field (no "Ask ONLY" / meta — that's LLM-only).
 */
function userFacingDeterministicLead(bundleId, primaryField, pi) {
  if (!isObject(pi)) return "";
  const b = cleanString(bundleId);
  const pf = cleanString(primaryField);
  const buyers = cleanList(pi.buyer_factors);
  const weak = cleanList(pi.weaknesses);
  const pos = cleanString(pi.positioning);
  const opp = cleanString(pi.opportunity);
  const angle = cleanString(pi.winning_angle);
  const hyp = cleanString(pi.differentiation_hypothesis);
  const alts = cleanList(pi.local_alternatives);

  if (pf === "pricing") {
    const narrative = buildPricingPreflightNarrative(pi, { maxChars: 260, withPricingInstruction: false });
    if (narrative) return `${narrative} `;
  }
  if (pf === "target_persona" && angle) {
    return `You may show up strongest when positioned as: ${truncate(angle, 200)} `;
  }
  if (pf === "differentiation" && hyp) {
    return `Here's a working differentiation angle to react to: ${truncate(hyp, 220)} `;
  }
  if (pf === "primary_offer" && pos) {
    return `${truncate(pos, 200)} `;
  }
  if ((pf === "review_quotes" || pf === "trust_signal") && weak.length) {
    return `Buyers in this space sometimes worry about: ${weak.slice(0, 3).join("; ")}. `;
  }
  if (pf === "comparison" && (alts.length || weak.length)) {
    const parts = [];
    if (alts.length) parts.push(`nearby alternatives include ${alts.slice(0, 2).join(", ")}`);
    if (weak.length) parts.push(`common concerns include ${weak.slice(0, 2).join("; ")}`);
    if (parts.length) return `${parts.join("; ")}. `;
  }
  if ((pf === "faq_angles" || b === "objection_handling") && buyers.length) {
    return `Before someone commits, they often weigh: ${buyers.slice(0, 4).join(", ")}. `;
  }
  if (pf === "process_summary" && cleanString(pi.website_direction)) {
    return `For the site journey we're considering: ${truncate(cleanString(pi.website_direction), 180)} `;
  }
  return "";
}

function formatFactValueForConfirmationPrompt(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    const parts = value.map((v) => cleanString(v)).filter(Boolean);
    return parts.length ? parts.join("; ") : "";
  }
  return cleanString(value);
}

function buildPrefilledUnverifiedConfirmationQuestion(plan, blueprint, preflightIntelligence) {
  const primaryField = cleanString(plan?.primary_field);
  if (!primaryField) return "";
  const fact = blueprint?.fact_registry?.[primaryField];
  if (!fact || cleanString(fact.status) !== "prefilled_unverified") return "";

  let insight = formatFactValueForConfirmationPrompt(fact.value);
  if (!hasMeaningfulValue(insight) && isObject(preflightIntelligence)) {
    const pi = preflightIntelligence;
    const fallbacks = {
      business_understanding: cleanString(pi.positioning),
      opportunity: cleanString(pi.opportunity),
      differentiation: cleanString(pi.differentiation_hypothesis),
      trust_signal: cleanList(pi.trust_markers)[0],
      aeo_angles: cleanString(pi.winning_angle),
      recommended_focus: cleanList(pi.recommended_focus).join("; "),
      website_direction: cleanString(pi.website_direction)
    };
    insight = fallbacks[primaryField] || "";
  }

  if (!hasMeaningfulValue(insight)) return "";

  return `Here's what we're seeing:\n\n${truncate(insight, 640)}\n\nDoes this feel right, or would you adjust it?`;
}

function buildDeterministicQuestionWithPreflight(plan, blueprint, businessName, preflightIntelligence) {
  const prefillQ = buildPrefilledUnverifiedConfirmationQuestion(plan, blueprint, preflightIntelligence);
  if (prefillQ) return prefillQ;

  const expert = buildExpertContextualDeterministicQuestion(plan, blueprint, businessName, preflightIntelligence);
  if (expert) return expert;
  const base = buildDeterministicQuestion(plan, blueprint, businessName);
  const lead = userFacingDeterministicLead(
    cleanString(plan?.bundle_id),
    cleanString(plan?.primary_field),
    preflightIntelligence
  );
  return lead ? `${lead}${base}` : base;
}

function buildPreflightBridgeFraming(bundleId, primaryField, pi) {
  if (!isObject(pi)) return "";
  const pf = cleanString(primaryField);
  const b = cleanString(bundleId);
  const angle = cleanString(pi.winning_angle);
  const hyp = cleanString(pi.differentiation_hypothesis);
  const pos = cleanString(pi.positioning);
  const opp = cleanString(pi.opportunity);
  const buyers = cleanList(pi.buyer_factors);
  const weak = cleanList(pi.weaknesses);
  const alts = cleanList(pi.local_alternatives);
  const focus = cleanList(pi.recommended_focus);

  if (pf === "target_persona" && angle) {
    return `Strategic note (validate, do not lecture): research suggests a strong fit when positioned as: ${truncate(angle, 320)} Ask whether that matches who they usually serve best.`;
  }
  if (pf === "differentiation" && hyp) {
    return `Lead with this hypothesis in one clause: ${truncate(hyp, 320)} Ask if they agree or how they'd sharpen it.`;
  }
  if (pf === "primary_offer" && pos) {
    return `Ground the question in this understanding: ${truncate(pos, 280)}`;
  }
  if (pf === "booking_method" && opp) {
    return `Conversion context (stay on booking channel only; no pricing): ${truncate(opp, 260)}`;
  }
  if (pf === "pricing") {
    const narrative = buildPricingPreflightNarrative(pi, { maxChars: 520, withPricingInstruction: true });
    if (narrative) return narrative;
  }
  if (b === "contact_details") {
    if (pf === "phone") {
      return `Why this matters: a clear public number should feel easy and trustworthy for how customers start. Rephrase warmly; stay on phone only—no pricing or booking URLs.`;
    }
    if (pf === "email") {
      return `Why this matters: prospects should know where a serious inquiry goes. Rephrase naturally; stay on email only.`;
    }
    if (pf === "address") {
      return `Why this matters: location sets expectations for visits or service area. Rephrase clearly; stay on address only.`;
    }
    if (pf === "hours") {
      return `Why this matters: clear hours reduce friction and repeat questions. Rephrase helpfully; stay on hours only.`;
    }
  }
  if ((pf === "faq_angles" || b === "objection_handling") && buyers.length) {
    return `Buyers in this space often weigh: ${buyers.slice(0, 4).join("; ")}. Ask what objections or questions come up before someone books (stay on FAQ angle only).`;
  }
  if (pf === "review_quotes" || pf === "trust_signal") {
    if (opp) {
      return `Reflect real buyer hesitation or desire: ${truncate(opp, 300)} Ask for concrete proof, quotes, or credibility lines that address that (trust topic only).`;
    }
    if (weak.length) {
      return `Where buyers tend to worry: ${weak.slice(0, 3).join("; ")}. Ask what they show or say that flips that worry (trust topic only).`;
    }
  }
  if (pf === "process_summary") {
    const wd = cleanString(pi.website_direction);
    const parts = [];
    if (wd) parts.push(`Site direction: ${truncate(wd, 220)}`);
    if (opp) parts.push(`Context: ${truncate(opp, 260)}`);
    if (parts.length) {
      return `${parts.join(" — ")} Ask for the concrete steps a client experiences—first touch through delivery (process topic only).`;
    }
    return `Ask for the real-world process from first contact through completion—specific steps, not a generic promise (process topic only).`;
  }
  if (pf === "comparison" && (weak.length || alts.length || focus.length)) {
    const parts = [];
    if (alts.length) parts.push(`Alternatives buyers consider: ${alts.slice(0, 3).join("; ")}`);
    if (weak.length) parts.push(`Common gaps in those options: ${weak.slice(0, 3).join("; ")}`);
    if (focus.length) parts.push(`Strategic emphasis to test: ${focus.slice(0, 3).join("; ")}`);
    return `${parts.join(" ")} Ask how they want to be positioned versus those alternatives (comparison topic only).`;
  }
  return "";
}

/** Reject LLM text that bundles off-topic fields (e.g. pricing + booking_method). */
function violatesPrimaryFieldQuestionScope(message, primaryField) {
  const m = cleanString(message).toLowerCase();
  const pf = cleanString(primaryField);
  if (!m || !pf) return false;

  const mentionsPricing =
    /\b(pricing|price|priced|cost|fee|fees|rate|rates)\b/.test(m) ||
    /\bhow much\b/.test(m) ||
    /\b(pricing|price)\s+(or|and)\s+/.test(m);
  const mentionsAvailability =
    /\b(availability|available|time slots?|scheduling expectations)\b/.test(m) ||
    /\banything\b[^?.]*\b(know|understand)\b[^?.]*\b(pricing|price|cost|availability)\b/.test(m);

  switch (pf) {
    case "booking_method":
      if (mentionsPricing) return true;
      if (mentionsAvailability) return true;
      return false;
    case "booking_url":
      if (mentionsPricing && !/\b(url|link|http|www\.|schedul|book online)\b/.test(m)) return true;
      return false;
    default:
      return false;
  }
}

/* ========================================================================
 * Question Rendering
 * ====================================================================== */

/**
 * When fallback_triggered is true, explains why deterministic copy won (LLM path only).
 * @typedef {"scope_violation"|"parse_error"|"empty_response"|"repetition"|"api_error"|"timeout"|null} FallbackReason
 */
function listPreflightIntelligenceKeys(pi) {
  if (!isObject(pi)) return [];
  return Object.keys(pi).filter((k) => {
    const v = pi[k];
    if (v == null) return false;
    if (k === "spec_version") return true;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "boolean" || typeof v === "number") return true;
    if (isObject(v)) return Object.keys(v).length > 0;
    return false;
  });
}

function packQuestionRender(message, {
  fallback_triggered,
  llm_available,
  question_source,
  fallback_reason = null,
  preflight_bridge_framing = null,
  question_render_mode = null
}) {
  const out = {
    message: cleanString(message),
    fallback_triggered: !!fallback_triggered,
    llm_available: !!llm_available,
    question_source: cleanString(question_source) || "deterministic",
    fallback_reason: null,
    preflight_bridge_framing: cleanString(preflight_bridge_framing) || null,
    question_render_mode: cleanString(question_render_mode) || null
  };
  if (out.fallback_triggered) {
    out.fallback_reason = cleanString(fallback_reason) || null;
  }
  return out;
}

function classifyQuestionRenderFetchError(err) {
  const name = cleanString(err?.name);
  const msg = cleanString(err?.message).toLowerCase();
  const code = err?.cause?.code || err?.code;
  if (name === "AbortError" || code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) {
    return "timeout";
  }
  return "api_error";
}

/** Hard constraint for rephrase-only LLM: what must NOT appear when this is the active slot. */
function getRephraseForbiddenLine(primaryField) {
  const pf = cleanString(primaryField);
  switch (pf) {
    case "booking_method":
      return "Do NOT mention pricing, cost, fees, rates, how much you charge, quotes as money, or availability / time slots (except scheduling channel words like “book online” if already in base_question).";
    case "booking_url":
      return "Do NOT mention pricing, cost, fees, or how much.";
    case "contact_path":
      return "Do NOT mention pricing, package tiers, or booking URLs unless base_question already does.";
    case "pricing":
      return "Do NOT ask how someone books, scheduling links, or phone vs form as a second thread—only pricing/quoting mechanics.";
    default:
      return "Do not introduce topics outside what base_question already asks.";
  }
}

/**
 * Single-topic questions: LLM may only rephrase base_question (already from deterministic + preflight lead).
 * This makes multi-field invention structurally unlikely vs open generation.
 */
async function polishIntakeQuestionRephraseOnly({
  env,
  baseQuestion,
  primaryField,
  bundleId,
  businessName
}) {
  const base = cleanString(baseQuestion);
  const pf = cleanString(primaryField);
  if (!base || !env?.OPENAI_API_KEY) return null;

  const payload = {
    model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    temperature: 0.12,
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You polish a single intake question for SiteForge Factory.",
          "Input includes base_question. It is already correct and single-topic.",
          "Rewrite in a consultative, premium tone with MINIMAL change to meaning and scope.",
          "Hard rules:",
          "1) Output exactly ONE question: one or two short sentences, max 65 words total.",
          "2) Do NOT add examples, dimensions, or follow-up topics that base_question does not already imply.",
          "3) " + getRephraseForbiddenLine(pf),
          "4) Do not mention schema, JSON, fields, or internal labels.",
          '5) Return JSON only: { "message": "..." }'
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            business_name: cleanString(businessName),
            primary_field: pf,
            bundle_id: cleanString(bundleId),
            base_question: base
          },
          null,
          2
        )
      }
    ]
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`polish question ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  const parsed = safeJsonParse(raw);
  const message = cleanString(parsed?.message);
  return message || null;
}

async function renderNextQuestion({
  env,
  blueprint,
  previousPlan,
  interpretation,
  businessName,
  preflightIntelligence
}) {
  const llmConfigured = !!env?.OPENAI_API_KEY;
  const plan = blueprint.question_plan;
  const hasPlan =
    isObject(plan) &&
    (hasMeaningfulValue(plan.primary_field) || cleanList(plan.target_fields).length > 0 || hasMeaningfulValue(plan.bundle_id));

  if (!hasPlan) {
    return packQuestionRender("Excellent — we now have enough verified clarity to move into final assembly.", {
      fallback_triggered: false,
      llm_available: llmConfigured,
      question_source: "complete",
      fallback_reason: null,
      question_render_mode: null
    });
  }

  const factRegistry = isObject(blueprint?.fact_registry) ? blueprint.fact_registry : {};
  const planTargetFields = Array.isArray(plan.target_fields) ? plan.target_fields : [];
  const isFieldResolvedLocal = (fieldKey) => isFactResolved(factRegistry?.[fieldKey]);

  let adjustedPlan = { ...plan };

  if (cleanString(plan.primary_field) && isFieldResolvedLocal(plan.primary_field)) {
    const nextUnresolvedField = planTargetFields.find((fieldKey) => !isFieldResolvedLocal(fieldKey));
    if (nextUnresolvedField) {
      adjustedPlan.primary_field = nextUnresolvedField;
    }
  }

  const fallback = buildDeterministicQuestionWithPreflight(
    adjustedPlan,
    blueprint,
    businessName,
    preflightIntelligence
  );

  const bridgeFraming = buildPreflightBridgeFraming(
    cleanString(adjustedPlan.bundle_id),
    cleanString(adjustedPlan.primary_field),
    preflightIntelligence
  );
  const bridgeMeta = {
    preflight_bridge_framing: bridgeFraming || null,
    question_render_mode: "rephrase_only"
  };

  if (!llmConfigured) {
    return packQuestionRender(fallback, {
      fallback_triggered: false,
      llm_available: false,
      question_source: "deterministic",
      fallback_reason: null,
      preflight_bridge_framing: bridgeMeta.preflight_bridge_framing,
      question_render_mode: "deterministic_only"
    });
  }

  try {
    const message = await polishIntakeQuestionRephraseOnly({
      env,
      baseQuestion: fallback,
      primaryField: cleanString(adjustedPlan.primary_field),
      bundleId: cleanString(adjustedPlan.bundle_id),
      businessName
    });

    if (!message) {
      return packQuestionRender(fallback, {
        fallback_triggered: true,
        llm_available: true,
        question_source: "deterministic",
        fallback_reason: "empty_response",
        ...bridgeMeta
      });
    }
    if (isOverloadedQuestion(message, adjustedPlan.bundle_id)) {
      return packQuestionRender(fallback, {
        fallback_triggered: true,
        llm_available: true,
        question_source: "deterministic",
        fallback_reason: "scope_violation",
        ...bridgeMeta
      });
    }
    if (looksLikeRepeatedQuestion(message, interpretation?.answer_summary, adjustedPlan.bundle_id)) {
      return packQuestionRender(fallback, {
        fallback_triggered: true,
        llm_available: true,
        question_source: "deterministic",
        fallback_reason: "repetition",
        ...bridgeMeta
      });
    }
    if (violatesPrimaryFieldQuestionScope(message, cleanString(adjustedPlan.primary_field))) {
      return packQuestionRender(fallback, {
        fallback_triggered: true,
        llm_available: true,
        question_source: "deterministic",
        fallback_reason: "scope_violation",
        ...bridgeMeta
      });
    }

    return packQuestionRender(message, {
      fallback_triggered: false,
      llm_available: true,
      question_source: "llm",
      fallback_reason: null,
      ...bridgeMeta
    });
  } catch (err) {
    console.error("[intake-next-v2-1:render-question]", err);
    return packQuestionRender(fallback, {
      fallback_triggered: true,
      llm_available: true,
      question_source: "deterministic",
      fallback_reason: classifyQuestionRenderFetchError(err),
      ...bridgeMeta
    });
  }
}

function buildDeterministicQuestion(plan, blueprint, businessName) {
  const name =
    cleanString(businessName) ||
    cleanString(getByPath(blueprint, "business_draft.brand.name")) ||
    "your business";

  const bundleId = cleanString(plan?.bundle_id);
  const primaryField = cleanString(plan?.primary_field);

  if (bundleId === "conversion") {
    switch (primaryField) {
      case "pricing":
        return `When someone requests a quote from ${name}, how do you typically price the work — is it based on scope, size, complexity, or something else?`;
      case "booking_url":
        return `After someone requests a quote from ${name}, do you send them to a booking page or scheduling link, or is everything handled manually?`;
      case "booking_method":
        return `When someone is ready to move forward with ${name}, how do they typically take the next step — do they call, request a quote, use a form, book online, or something else?`;
      case "contact_path":
        return `What is the preferred path for a serious prospect to contact ${name} — form, phone call, text, email, or something else?`;
      default:
        return `What is the single next detail about how ${name} converts interest into action that we should capture?`;
    }
  }

  if (bundleId === "positioning") {
    switch (primaryField) {
      case "target_persona":
        return `Who is the best-fit customer for ${name}, and what do they care most about when choosing someone like you?`;
      case "primary_offer":
        return `What exactly do you want a new visitor to understand about what ${name} offers right away?`;
      case "differentiation":
        return `What makes ${name} meaningfully different from the other options someone might be comparing you against?`;
      case "gallery_visual_direction":
      case "hero_image_query":
        return `What should the visuals for ${name} make someone feel immediately, and what kinds of scenes or details best represent the work?`;
      default:
        return `If a strong-fit visitor lands on ${name}, what should they immediately understand about who it is for, what you offer, and what makes it different?`;
    }
  }

  if (bundleId === "service_area") {
    switch (primaryField) {
      case "surrounding_cities":
        return `Besides your main area, which nearby cities, neighborhoods, or regions should we represent for ${name}?`;
      case "service_area_main":
        return `What is the primary city or market ${name} should be centered around on the site?`;
      default:
        return `What is the primary market you want this site to speak to, and are there nearby cities or regions you also want represented?`;
    }
  }

  if (bundleId === "proof") {
    switch (primaryField) {
      case "review_quotes":
        return `What kinds of things do clients consistently say after working with ${name}, or do you have any review language we should reflect?`;
      case "years_experience":
        return `How long have you been doing this work, and how should that experience come through on the site?`;
      case "trust_signal":
        return `What are the strongest trust signals we can lean on for ${name} — experience, reviews, outcomes, photos, reputation, or something else?`;
      default:
        return `What are the strongest proof points we can use to help someone trust ${name} quickly?`;
    }
  }

  if (bundleId === "process") {
    return `What does working with ${name} usually look like from the first inquiry through completion?`;
  }

  if (bundleId === "gallery_strategy") {
    switch (primaryField) {
      case "gallery_visual_direction":
        return `What kinds of scenes, details, or outcomes should the gallery for ${name} emphasize so the site feels like the right fit?`;
      case "hero_image_query":
        return `What should the hero image for ${name} communicate at a glance — the type of work, the setting, the customer, or the result?`;
      default:
        return `What visual direction should the site for ${name} take so it feels premium and true to the business?`;
    }
  }

  if (bundleId === "pricing_model") {
    return `Do you offer standardized packages or tiers, or is pricing usually customized from quote to quote?`;
  }

  if (bundleId === "objection_handling") {
    return `What are the main questions or objections people usually have before they feel ready to move forward with ${name}?`;
  }

  if (bundleId === "story") {
    return `What is the story behind ${name}, and what standards, philosophy, or perspective should come through in the about section?`;
  }

  if (bundleId === "events_strategy") {
    return `Do you have recurring sessions, classes, tours, or any other time-based offerings we should show on the site?`;
  }

  if (bundleId === "comparison_strategy") {
    return `What alternatives are buyers usually comparing ${name} against, and what tends to make them choose you?`;
  }

  if (bundleId === "contact_details") {
    switch (primaryField) {
      case "phone":
        return `What is the best public phone number to show for ${name}?`;
      case "email":
        return `What email address should serious prospects use to reach ${name}?`;
      case "address":
        return `What address should we show publicly for ${name}, if any?`;
      case "hours":
        return `What hours or availability should people expect when contacting ${name}?`;
      default:
        return `What contact details should we treat as the accurate public version for the site?`;
    }
  }

  return `What is the next important thing a serious prospect should understand about ${name} before deciding to contact or book?`;
}

/* ========================================================================
 * Compatibility Mirrors
 * ====================================================================== */

function syncCompatibilityMirrors(state) {
  const blueprint = normalizeBlueprint(state.blueprint);
  const factRegistry = blueprint.fact_registry;

  state.answers = isObject(state.answers) ? state.answers : {};
  state.verified = isObject(state.verified) ? state.verified : {};
  state.meta = isObject(state.meta) ? state.meta : {};
  state.meta.verified = isObject(state.meta.verified) ? state.meta.verified : {};
  state.meta.inferred = isObject(state.meta.inferred) ? state.meta.inferred : {};
  state.verification = isObject(state.verification) ? state.verification : {};

  for (const [key, fact] of Object.entries(factRegistry)) {
    state.answers[key] = deepClone(fact.value);
    state.verified[key] = !!fact.verified;
    state.meta.verified[key] = !!fact.verified;
    if (cleanString(fact.source) === "inferred") {
      state.meta.inferred[key] = true;
    }
  }

  state.verification = {
    queue_complete: blueprint.verification_queue.length === 0,
    verified_count: Object.values(factRegistry).filter((fact) => !!fact?.verified).length,
    remaining_keys: blueprint.verification_queue.map((item) => cleanString(item.field_key)).filter(Boolean),
    last_updated: new Date().toISOString()
  };

  state.current_key = cleanString(blueprint.question_plan?.primary_field);
}

/* ========================================================================
 * Normalization
 * ====================================================================== */

function normalizeState(state) {
  const next = isObject(state) ? state : {};

  next.slug = cleanString(next.slug);
  next.businessName = cleanString(next.businessName);
  next.clientEmail = cleanString(next.clientEmail);
  next.phase = cleanString(next.phase) || "blueprint_verify";
  next.action = cleanString(next.action);

  next.answers = isObject(next.answers) ? next.answers : {};
  next.ghostwritten = isObject(next.ghostwritten) ? next.ghostwritten : {};
  next.verified = isObject(next.verified) ? next.verified : {};
  next.conversation = Array.isArray(next.conversation) ? next.conversation : [];
  next.meta = isObject(next.meta) ? next.meta : {};
  next.meta.seeded = isObject(next.meta.seeded) ? next.meta.seeded : {};
  next.meta.inferred = isObject(next.meta.inferred) ? next.meta.inferred : {};
  next.meta.verified = isObject(next.meta.verified) ? next.meta.verified : {};
  next.provenance = isObject(next.provenance) ? next.provenance : {};
  next.verification = isObject(next.verification) ? next.verification : {};
  next.blueprint = normalizeBlueprint(next.blueprint);
  next.readiness = isObject(next.readiness) ? next.readiness : {};
  next.turn_debug = isObject(next.turn_debug) ? next.turn_debug : {};
  next.preflight_intelligence = isObject(next.preflight_intelligence) ? next.preflight_intelligence : {};
  next.reinforcement = isObject(next.reinforcement) ? next.reinforcement : null;
  if (next.meta) {
    next.meta.last_turn_reinforcement_source = cleanString(next.meta.last_turn_reinforcement_source) || null;
  }

  return next;
}

function normalizeBlueprint(blueprint) {
  const next = isObject(blueprint) ? blueprint : {};
  next.strategy = isObject(next.strategy) ? next.strategy : {};
  next.fact_registry = normalizeFactRegistry(next.fact_registry);
  next.business_draft = isObject(next.business_draft) ? next.business_draft : {};
  next.section_status = isObject(next.section_status) ? next.section_status : {};
  next.verification_queue = Array.isArray(next.verification_queue) ? next.verification_queue : [];
  next.question_candidates = Array.isArray(next.question_candidates) ? next.question_candidates : [];
  next.question_plan = isObject(next.question_plan) ? next.question_plan : null;
  next.component_states = isObject(next.component_states) ? next.component_states : {};
  next.decision_states = isObject(next.decision_states) ? next.decision_states : {};
  next.premium_readiness = isObject(next.premium_readiness) ? next.premium_readiness : null;
  next.access_readiness = isObject(next.access_readiness) ? next.access_readiness : null;
  next.evidence_log = Array.isArray(next.evidence_log) ? next.evidence_log : [];
  next.question_history = Array.isArray(next.question_history) ? next.question_history : [];
  return next;
}

function normalizeFactRegistry(input) {
  const registry = isObject(input) ? input : {};
  const out = {};

  for (const [key, entry] of Object.entries(registry)) {
    if (isObject(entry) && Object.prototype.hasOwnProperty.call(entry, "value")) {
      let val = sanitizeFactValue(normalizeModelValue(entry.value));
      let status = sanitizeFactStatus(entry.status || inferFactStatus(val));
      let verified = !!entry.verified;

      if (!hasMeaningfulValue(val)) {
        if (status === "answered" || status === "inferred" || status === "partial") {
          status = inferFactStatus(val);
          verified = false;
        }
        if (status === "prefilled_unverified") {
          status = "missing";
          verified = false;
        }
      }

      out[key] = {
        ...entry,
        value: val,
        source: cleanString(entry.source) || "unknown",
        confidence: clampNumber(entry.confidence, 0, 1, 0),
        verified,
        status,
        rationale: cleanString(entry.rationale),
        history: Array.isArray(entry.history) ? entry.history : []
      };
    } else {
      let val = sanitizeFactValue(normalizeModelValue(entry));
      const status = sanitizeFactStatus(inferFactStatus(val));
      out[key] = {
        value: val,
        source: "unknown",
        confidence: hasMeaningfulValue(val) ? 0.5 : 0,
        verified: false,
        status,
        rationale: "",
        history: []
      };
    }
  }

  return out;
}

function buildCompletionMessage(businessName, readiness) {
  const name = cleanString(businessName) || "your business";
  const score = clampNumber(readiness?.score, 0, 1, 1);
  const percentage = Math.round(score * 100);
  return `Excellent — we now have enough verified clarity for ${name}. Intake is complete (${percentage}% readiness), and we can move into final assembly.`;
}

/* ========================================================================
 * Utility
 * ====================================================================== */

async function readJson(request) {
  const raw = await request.text();
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Error("Invalid JSON payload");
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

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (isObject(value)) return Object.values(value).some((item) => hasMeaningfulValue(item));
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return true;
  return cleanString(value) !== "";
}

/**
 * Strips nested fact rows or status-only stubs accidentally stored as `fact.value`
 * (e.g. `{ status: "missing" }` or a full `{ value, status, source, ... }` blob).
 */
function sanitizeFactValue(value) {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFactValue(item));
  }
  if (!isObject(value)) return value;

  if ("value" in value && ("status" in value || "source" in value)) {
    return sanitizeFactValue(value.value);
  }
  if ("status" in value && "source" in value) {
    return null;
  }
  if ("status" in value) {
    const metaKeys = new Set([
      "status",
      "confidence",
      "verified",
      "rationale",
      "source",
      "updated_at",
      "requires_client_verification"
    ]);
    if (Object.keys(value).every((k) => metaKeys.has(k))) {
      return null;
    }
  }
  return value;
}

/** String value meaning no public scheduling URL (not a navigable CTA href). */
function isBookingUrlNoLinkSentinel(value) {
  const s = cleanString(value).toLowerCase();
  return (
    s === "manual" ||
    s === "manually" ||
    s === "none" ||
    s === "n/a" ||
    s === "na" ||
    s === "manual_followup"
  );
}

/** booking_url fact value safe to use as settings/contact href (skips manual/no-URL sentinels). */
function bookingUrlValueForDraftLink(raw) {
  if (!hasMeaningfulValue(raw) || typeof raw !== "string") return "";
  if (isBookingUrlNoLinkSentinel(raw)) return "";
  return isPlausibleBookingUrlString(raw) ? raw.trim() : "";
}

function sanitizeFactStatus(value) {
  const status = cleanString(value);
  if (status === "partial") return "partial";
  if (status === "inferred") return "inferred";
  if (status === "answered") return "answered";
  if (status === "missing") return "missing";
  if (status === "prefilled_unverified") return "prefilled_unverified";
  if (status === "seeded") return "seeded";
  return "answered";
}

function inferFactStatus(value) {
  return hasMeaningfulValue(value) ? "answered" : "missing";
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function safeObject(value) {
  return isObject(value) ? value : {};
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function uniqueList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => cleanString(item)).filter(Boolean)));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dedupeBy(items, key) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    map.set(item[key], item);
  }
  return Array.from(map.values());
}

function truncate(text, maxLength) {
  const value = cleanString(text);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function firstNonEmpty(values) {
  for (const value of Array.isArray(values) ? values : []) {
    if (hasMeaningfulValue(value)) return value;
  }
  return "";
}

function firstArrayItem(value) {
  if (Array.isArray(value) && value.length) return value[0];
  return "";
}

function firstNonEmptyArray(values) {
  for (const value of Array.isArray(values) ? values : []) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function collectLeafPaths(obj, base = "") {
  if (Array.isArray(obj)) {
    if (!obj.length && base) return [base];
    let out = [];
    obj.forEach((item, index) => {
      const child = base ? `${base}.${index}` : String(index);
      out = out.concat(collectLeafPaths(item, child));
    });
    return out;
  }

  if (!isObject(obj)) {
    return base ? [base] : [];
  }

  const entries = Object.entries(obj);
  if (!entries.length && base) return [base];

  let out = [];
  for (const [key, value] of entries) {
    const child = base ? `${base}.${key}` : key;
    out = out.concat(collectLeafPaths(value, child));
  }
  return out;
}

function getByPath(obj, path) {
  const parts = cleanString(path).split(".").filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (!isObject(current) && !Array.isArray(current)) return undefined;
    current = current?.[part];
  }
  return current;
}

function setByPath(obj, path, value) {
  const parts = cleanString(path).split(".").filter(Boolean);
  if (!parts.length) return;

  let current = obj;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    const nextPart = parts[i + 1];
    const nextIsIndex = String(Number(nextPart)) === nextPart;

    if (isLast) {
      current[part] = value;
      return;
    }

    if (!isObject(current[part]) && !Array.isArray(current[part])) {
      current[part] = nextIsIndex ? [] : {};
    }

    current = current[part];
  }
}

function hasPath(obj, path) {
  return typeof getByPath(obj, path) !== "undefined";
}

function safeAssignPathIfExists(obj, path, value) {
  if (!hasMeaningfulValue(value)) return;
  if (!hasPath(obj, path)) return;
  setByPath(obj, path, deepClone(value));
}

function isAllowedDraftPatch(item, allowedTopLevelSections, allowedLeafPaths) {
  if (!isObject(item)) return false;
  const section = cleanString(item.section);
  const path = cleanString(item.path);
  if (!section || !path) return false;
  if (!allowedTopLevelSections.includes(section)) return false;
  if (path.includes("__proto__") || path.includes("constructor") || path.includes("prototype")) return false;
  if (allowedLeafPaths.includes(path)) return true;
  return path === section || path.startsWith(`${section}.`);
}

function pruneFactRegistryForModel(factRegistry) {
  const out = {};
  for (const [key, value] of Object.entries(factRegistry || {})) {
    out[key] = {
      value: value?.value,
      verified: !!value?.verified,
      status: cleanString(value?.status),
      confidence: Number(value?.confidence || 0)
    };
  }
  return out;
}

function normalizeModelValue(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeModelValue(item));
  if (isObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = normalizeModelValue(item);
    return out;
  }
  if (typeof value === "string") return value.trim();
  return value;
}

function ensureArrayStrings(value) {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean);
  if (cleanString(value)) return [cleanString(value)];
  return [];
}

function stringifyFactValue(value) {
  if (typeof value === "number") return String(value);
  return cleanString(value);
}

function isFactResolved(fact) {
  if (!fact) return false;

  const status = cleanString(fact.status);
  const confidence = typeof fact.confidence === "number" ? fact.confidence : 0;

  if (status === "prefilled_unverified") return false;

  const v = sanitizeFactValue(fact.value);
  if (!hasMeaningfulValue(v)) return false;

  return (
    status === "answered" ||
    (status === "inferred" && confidence >= 0.7)
  );
}

function shouldApplyCopyRefinement(existing, nextValue, confidence) {
  if (!hasMeaningfulValue(nextValue)) return false;
  if (typeof nextValue !== "string") return true;
  if (!hasMeaningfulValue(existing)) return true;
  return confidence >= 0.6;
}

function inferDecisionForFact(key) {
  const map = {
    primary_offer: "positioning",
    target_persona: "positioning",
    differentiation: "positioning",
    hero_image_query: "gallery_strategy",
    gallery_visual_direction: "gallery_strategy",
    booking_method: "conversion",
    pricing: "conversion",
    booking_url: "conversion",
    contact_path: "conversion",
    review_quotes: "proof",
    trust_signal: "proof",
    years_experience: "proof",
    process_summary: "process",
    service_area_main: "service_area",
    surrounding_cities: "service_area",
    faq_angles: "objection_handling",
    founder_story: "story",
    phone: "contact_details",
    email: "contact_details",
    address: "contact_details",
    hours: "contact_details",
    comparison: "comparison_strategy",
    events: "events_strategy",
    investment: "pricing_model"
  };
  return map[key] || "positioning";
}

function inferVerificationReasonForFact(key) {
  const reasons = {
    pricing: "Pricing context helps the site set expectations.",
    booking_url: "Booking URL determines whether CTA can send visitors externally.",
    review_quotes: "Reviews make the site feel credible quickly.",
    process_summary: "Process clarity can reduce friction and improve trust.",
    gallery_visual_direction: "Visual strategy improves hero and gallery quality.",
    phone: "Phone should be accurate for publish-readiness.",
    email: "Email should be accurate for contact routing.",
    address: "Address may be needed for publish-readiness.",
    hours: "Hours clarify availability and publish-readiness."
  };
  return reasons[key] || "This fact still needs verification or refinement.";
}

function getDecisionTargets() {
  return {
    conversion: {
      components: ["hero", "contact"],
      target_fields: ["booking_method", "pricing", "booking_url", "contact_path"],
      base_priority: 240,
      intent: "Clarify how visitors move from interest to action, including booking flow and pricing expectations.",
      reason: "This defines how the site converts visitors."
    },
    positioning: {
      components: ["hero", "features"],
      target_fields: ["target_persona", "primary_offer", "differentiation"],
      base_priority: 225,
      intent: "Clarify who the site is for, what the offer is, and what makes it stand apart.",
      reason: "This sharpens the page message and fit."
    },
    service_area: {
      components: ["service_area"],
      target_fields: ["service_area_main", "surrounding_cities"],
      base_priority: 180,
      intent: "Clarify the primary market and nearby areas served.",
      reason: "This improves local relevance and targeting."
    },
    proof: {
      components: ["trustbar", "testimonials", "about"],
      target_fields: ["review_quotes", "trust_signal", "years_experience"],
      base_priority: 175,
      intent: "Clarify why someone should trust the business quickly.",
      reason: "Proof makes the site feel credible."
    },
    process: {
      components: ["processSteps"],
      target_fields: ["process_summary"],
      base_priority: 165,
      intent: "Capture the workflow from inquiry to completion.",
      reason: "Process reduces friction and increases trust."
    },
    gallery_strategy: {
      components: ["gallery", "hero"],
      target_fields: ["gallery_visual_direction", "hero_image_query"],
      base_priority: 155,
      intent: "Clarify the visual story the hero and gallery need to tell.",
      reason: "This improves image search query, layout, and count decisions."
    },
    pricing_model: {
      components: ["investment", "faqs", "contact"],
      target_fields: ["pricing", "investment"],
      base_priority: 145,
      intent: "Determine whether pricing is standardized enough for a dedicated investment section.",
      reason: "This clarifies pricing expectations and package fit."
    },
    objection_handling: {
      components: ["faqs"],
      target_fields: ["faq_angles"],
      base_priority: 135,
      intent: "Capture objections and the questions people need answered.",
      reason: "This helps FAQ quality and conversion confidence."
    },
    story: {
      components: ["about"],
      target_fields: ["founder_story"],
      base_priority: 120,
      intent: "Clarify the founder story, philosophy, and standards behind the business.",
      reason: "This strengthens the about section."
    },
    events_strategy: {
      components: ["events"],
      target_fields: ["events"],
      base_priority: 90,
      intent: "Determine whether time-based offerings belong on the site.",
      reason: "This supports schedule-oriented businesses."
    },
    comparison_strategy: {
      components: ["comparison"],
      target_fields: ["comparison"],
      base_priority: 85,
      intent: "Determine whether comparing against alternatives helps buyers decide.",
      reason: "This helps buyers distinguish the offer."
    },
    contact_details: {
      components: ["contact", "brand"],
      target_fields: ["phone", "email", "address", "hours"],
      base_priority: 60,
      intent: "Verify the factual contact details needed for publish-readiness.",
      reason: "These details should be accurate before publish."
    }
  };
}

function coreDecisionsStillWeak(decisionStates) {
  const core = ["conversion", "positioning", "service_area", "proof"];
  const avg = core.reduce((sum, key) => sum + Number(decisionStates?.[key]?.confidence || 0), 0) / core.length;
  return avg < 0.7;
}

function looksLikeProcessFact(value) {
  const text = cleanString(value).toLowerCase();
  if (!text) return false;
  return looksLikeProcessAnswer(text);
}

function looksLikeProcessAnswer(textLower) {
  const signals = [
    "first",
    "then",
    "after",
    "finally",
    "quote",
    "scope",
    "schedule",
    "walkthrough",
    "complete",
    "finish",
    "follow up"
  ];
  let count = 0;
  for (const signal of signals) {
    if (textLower.includes(signal)) count += 1;
  }
  return count >= 3;
}

function isStandardizedPricing(value) {
  const text = cleanString(value).toLowerCase();
  if (!text) return false;
  const signals = ["package", "tier", "starting at", "from $", "flat rate", "standard", "basic", "premium"];
  return signals.some((signal) => text.includes(signal));
}

function buildTaglineFromEvidence(factRegistry) {
  const offer = cleanString(factRegistry?.primary_offer?.value);
  const diff = cleanString(factRegistry?.differentiation?.value);
  return firstNonEmpty([offer, diff]);
}

function buildHeroHeadlineFromEvidence({ businessName, offer, differentiation }) {
  if (cleanString(offer)) return truncate(offer, 90);
  if (cleanString(differentiation)) return truncate(differentiation, 90);
  return `${businessName} built for quality and trust`;
}

function buildHeroSubtextFromEvidence({ offer, persona, differentiation, bookingMethod }) {
  const parts = [offer, persona, differentiation].map(cleanString).filter(Boolean);
  let text = parts.slice(0, 2).join(" ");
  if (bookingMethod) {
    text = `${text} Reach out to ${bookingMethod}.`.trim();
  }
  return truncate(text || "Built to help the right clients feel confident taking the next step.", 220);
}

function buildHeroImageQuery({ industry, offer, themes, differentiation }) {
  const base = firstNonEmpty([
    cleanString(industry),
    cleanString(offer),
    cleanString(differentiation),
    ensureArrayStrings(themes).join(" ")
  ]);

  return truncate(compactVisualQuery(base, ["professional", "service", "premium", "realistic"]), 80);
}

function buildGalleryImageQuery({ industry, offer, differentiation, themes }) {
  const base = firstNonEmpty([
    cleanString(offer),
    cleanString(industry),
    cleanString(differentiation),
    ensureArrayStrings(themes).join(" ")
  ]);

  return truncate(compactVisualQuery(base, ["detail", "results", "quality", "realistic"]), 100);
}

function compactVisualQuery(base, boosters = []) {
  const text = cleanString(base);
  if (!text) return boosters.join(" ");
  const words = text
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  return uniqueList(words.concat(boosters)).slice(0, 8).join(" ");
}

function inferGalleryLayout({ vibe, offer, differentiation }) {
  const text = `${cleanString(vibe)} ${cleanString(offer)} ${cleanString(differentiation)}`.toLowerCase();

  if (text.includes("luxury") || text.includes("high-end") || text.includes("premium")) return "bento";
  if (text.includes("portfolio") || text.includes("creative") || text.includes("visual")) return "masonry";
  return "grid";
}

function inferGalleryCount({ offer, differentiation, visualDirection }) {
  const text = `${cleanString(offer)} ${cleanString(differentiation)} ${cleanString(visualDirection)}`.toLowerCase();
  if (text.includes("detailed") || text.includes("before-and-after") || text.includes("portfolio")) return 8;
  if (text.includes("premium") || text.includes("high-end")) return 6;
  return 5;
}

function buildGalleryItemTitle(index, offer, industry) {
  const base = firstNonEmpty([cleanString(offer), cleanString(industry), "Work Example"]);
  return `${truncate(titleCase(base), 40)} ${index + 1}`;
}

function buildServiceAreaTravelNote(mainCity, surrounding) {
  if (mainCity && surrounding.length) {
    return `Outside ${mainCity} and the nearby areas listed here, custom travel quotes are available when the fit is right.`;
  }
  if (mainCity) {
    return `If your project is outside ${mainCity}, reach out and we can discuss travel options.`;
  }
  return "If your project is outside the listed areas, reach out and we can discuss travel options.";
}

function buildContactSubheadline({ bookingMethod, pricing, contactPath }) {
  if (cleanString(pricing)) {
    return "Reach out to get the right next step and a quote based on your scope.";
  }
  if (cleanString(bookingMethod)) {
    return "Use the preferred contact path and we’ll guide you through the next step.";
  }
  if (cleanString(contactPath)) {
    return "The easiest way to get started is through the contact section below.";
  }
  return "Tell us what you need and we’ll point you toward the right next step.";
}

function buildProcessStepsFromSummary(summary) {
  const text = cleanString(summary);
  if (!text) return [];

  const lower = text.toLowerCase();
  const steps = [];

  if (lower.includes("quote") || lower.includes("estimate") || lower.includes("inquiry")) {
    steps.push({
      title: "Start with the Right Scope",
      description: "The process begins with a clear understanding of the work, priorities, and project details."
    });
  }
  if (lower.includes("confirm") || lower.includes("scope") || lower.includes("review")) {
    steps.push({
      title: "Confirm the Details",
      description: "Once the scope is clear, the plan is confirmed so expectations feel aligned before work begins."
    });
  }
  if (lower.includes("schedule") || lower.includes("calendar")) {
    steps.push({
      title: "Schedule the Work",
      description: "A time is set that matches the project needs and keeps the process moving smoothly."
    });
  }
  if (lower.includes("complete") || lower.includes("finish") || lower.includes("clean")) {
    steps.push({
      title: "Deliver the Work Carefully",
      description: "The service is completed with attention to detail, quality, and the overall client experience."
    });
  }
  if (lower.includes("walkthrough") || lower.includes("final")) {
    steps.push({
      title: "Review the Final Result",
      description: "A final review helps make sure the outcome feels complete and the client leaves confident."
    });
  }

  if (steps.length < 3) {
    return [
      {
        title: "Start with a Clear Conversation",
        description: "The process starts by understanding the scope, goals, and what success looks like."
      },
      {
        title: "Align on the Right Plan",
        description: "The next step is confirming the best approach so expectations feel clear before work begins."
      },
      {
        title: "Deliver with Care",
        description: "The work is completed with attention to detail, communication, and the final result."
      }
    ];
  }

  return steps.slice(0, 5);
}

function inferVibe(state) {
  return cleanString(state?.provenance?.strategy_contract?.visual_strategy?.recommended_vibe) || "Modern Minimal";
}

function titleCase(text) {
  return cleanString(text)
    .split(/\s+/)
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "")
    .join(" ");
}

function safeFeatureIcon(icon) {
  const cleaned = cleanString(icon);
  return ALLOWED_ICON_TOKENS.includes(cleaned) ? cleaned : "check";
}

function isOverloadedQuestion(message, bundleId) {
  const text = cleanString(message).toLowerCase();
  if (!text) return false;

  const bundleKeywords = {
    conversion: ["book", "booking", "quote", "pricing", "availability", "call", "form", "next step"],
    positioning: ["audience", "customer", "offer", "different", "difference", "stand out", "ideal fit"],
    service_area: ["city", "cities", "area", "areas", "region", "regions", "neighborhood", "neighborhoods", "serve"],
    proof: ["review", "reviews", "trust", "results", "experience", "credibility", "reputation", "testimonial"],
    process: ["process", "workflow", "steps", "inquiry", "completion", "walkthrough"],
    gallery_strategy: ["visual", "images", "gallery", "hero image", "look", "feel"],
    pricing_model: ["tier", "package", "pricing model", "investment"],
    objection_handling: ["questions", "objections", "hesitations", "concerns"],
    story: ["story", "founder", "why", "philosophy", "standards", "started"],
    events_strategy: ["classes", "sessions", "schedule", "events", "workshops", "tours"],
    comparison_strategy: ["compare", "alternatives", "other options"],
    contact_details: ["phone", "email", "address", "hours", "contact", "booking link"]
  };

  const activeBundles = Object.entries(bundleKeywords)
    .map(([key, words]) => ({
      key,
      matched: words.some((word) => text.includes(word))
    }))
    .filter((entry) => entry.matched)
    .map((entry) => entry.key);

  let relevant = activeBundles;
  if (cleanString(bundleId) === "conversion") {
    relevant = activeBundles.filter((k) => k !== "positioning");
  }

  if (relevant.length <= 1) return false;
  return !relevant.every((key) => key === bundleId);
}

function unresolvedPointMatchesBundle(point, bundleId) {
  const text = cleanString(point).toLowerCase();
  const bundle = cleanString(bundleId);
  if (!text || !bundle) return false;

  const keywords = {
    conversion: ["book", "booking", "quote", "pricing", "availability", "call", "form", "schedule", "timing"],
    positioning: ["audience", "offer", "different", "difference", "position", "persona", "fit"],
    service_area: ["city", "cities", "area", "areas", "region", "regions", "neighborhood", "neighborhoods", "service area"],
    proof: ["review", "reviews", "trust", "result", "results", "experience", "testimonial", "credibility", "reputation"],
    process: ["process", "workflow", "steps", "walkthrough", "scope", "completion"],
    gallery_strategy: ["visual", "gallery", "hero image", "layout", "image", "photos"],
    pricing_model: ["pricing", "package", "tier", "investment"],
    objection_handling: ["questions", "objections", "concerns", "hesitations"],
    story: ["story", "founder", "philosophy", "standards", "started", "background"],
    events_strategy: ["events", "schedule", "classes", "sessions", "tours", "workshops"],
    comparison_strategy: ["compare", "alternatives", "difference"],
    contact_details: ["phone", "email", "address", "hours", "contact", "booking url", "booking link"]
  };

  return (keywords[bundle] || []).some((word) => text.includes(word));
}

function looksLikeRepeatedQuestion(message, answerSummary, bundleId) {
  const question = cleanString(message).toLowerCase();
  const answer = cleanString(answerSummary).toLowerCase();
  const bundle = cleanString(bundleId);
  if (!question || !answer || !bundle) return false;

  const repeatedSignals = {
    conversion: ["call", "request a quote", "fill out a form", "book online", "next step"],
    positioning: ["who it is for", "what you offer", "different"],
    service_area: ["what areas", "which cities", "where do you serve"],
    proof: ["why trust", "reviews", "results", "experience"],
    process: ["workflow", "steps", "inquiry to completion"],
    gallery_strategy: ["visual direction", "hero image", "gallery"],
    pricing_model: ["packages", "tiers", "pricing model"],
    objection_handling: ["questions", "objections"],
    story: ["story behind", "why you started", "philosophy"],
    events_strategy: ["classes", "sessions", "schedule"],
    comparison_strategy: ["alternatives", "compare"],
    contact_details: ["phone", "email", "address", "hours"]
  };

  const bundlePhrases = repeatedSignals[bundle] || [];
  const matchedInQuestion = bundlePhrases.some((phrase) => question.includes(phrase));
  const matchedInAnswer = bundlePhrases.some((phrase) => answer.includes(phrase));

  return matchedInQuestion && matchedInAnswer;
} 