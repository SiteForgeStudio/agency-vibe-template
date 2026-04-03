/**
 * SITEFORGE FACTORY — intake-next-v2.js
 *
 * V2 Blueprint Intake Engine
 * ------------------------------------------------------------
 * Purpose:
 * - Accept a user answer + current state.blueprint
 * - Use AI only for answer interpretation and optional copy refinement
 * - Safely update fact_registry
 * - Incrementally patch business_draft
 * - Recompute section_status
 * - Rebuild verification_queue
 * - Re-score bundle candidates
 * - Select the next question using the same bundle-based planner model
 * - Return { ok, message, state }
 *
 * Hard rules:
 * - No regex-based answer extraction
 * - No hard-coded industry logic
 * - AI does not define schema
 * - No full business_draft regeneration
 *
 * Compatibility:
 * - strategy_contract provenance preserved
 * - blueprint shape preserved
 * - compatibility mirrors preserved: answers, verified, verification, current_key, readiness
 */

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

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
      return json(
        {
          ok: false,
          error: "Missing answer"
        },
        400
      );
    }

    const state = normalizeState(incomingState);
    state.conversation.push({
      role: "user",
      content: userAnswer
    });

    const blueprint = normalizeBlueprint(state.blueprint);
    const currentPlan = isObject(blueprint.question_plan) ? blueprint.question_plan : {};
    const interpretation = await interpretUserAnswer({
      env,
      answer: userAnswer,
      blueprint,
      strategyContract: state.provenance.strategy_contract
    });

    const mutation = applyInterpretationToBlueprint({
      blueprint,
      interpretation,
      answer: userAnswer
    });

    const recomputedSectionStatus = computeSectionStatus(
      blueprint.strategy,
      mutation.fact_registry,
      mutation.business_draft
    );

    const verificationQueue = buildVerificationQueue(
      blueprint.strategy,
      mutation.fact_registry,
      recomputedSectionStatus
    );

    const questionCandidates = buildQuestionCandidates(
      blueprint.strategy,
      mutation.fact_registry,
      recomputedSectionStatus,
      verificationQueue
    );

    const questionPlan = planNextQuestion(questionCandidates, currentPlan.bundle_id || "");

    state.blueprint = {
      ...blueprint,
      fact_registry: mutation.fact_registry,
      business_draft: mutation.business_draft,
      section_status: recomputedSectionStatus,
      verification_queue: verificationQueue,
      question_candidates: questionCandidates,
      question_plan: questionPlan,
      last_answer: {
        text: userAnswer,
        bundle_id: cleanString(currentPlan.bundle_id),
        primary_field: cleanString(currentPlan.primary_field),
        timestamp: new Date().toISOString()
      },
      last_interpretation: mutation.audit
    };

    syncCompatibilityMirrors(state);

    state.readiness = evaluateBlueprintReadiness(state.blueprint);
    state.phase = state.readiness.can_generate_now ? "intake_complete" : "blueprint_verify";
    state.action = state.readiness.can_generate_now ? "complete" : "continue";
    state.current_key = cleanString(state.blueprint.question_plan?.primary_field);

    const assistantMessage = await renderNextQuestion({
      env,
      blueprint: state.blueprint,
      previousPlan: currentPlan,
      interpretation: mutation.audit,
      businessName: state.businessName
    });

    state.conversation.push({
      role: "assistant",
      content: assistantMessage
    });

    return json({
      ok: true,
      message: assistantMessage,
      state
    });
  } catch (err) {
    console.error("[intake-next-v2]", err);
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
    endpoint: "intake-next-v2",
    method: "POST",
    version: "v2-blueprint-engine"
  });
}

/* =========================
   AI Interpretation
========================= */

async function interpretUserAnswer({ env, answer, blueprint, strategyContract }) {
  const allowedFactKeys = Object.keys(blueprint.fact_registry || {});
  const allowedTopLevelSections = Object.keys(blueprint.business_draft || {});
  const allowedLeafPaths = collectLeafPaths(blueprint.business_draft);
  const currentPlan = isObject(blueprint.question_plan) ? blueprint.question_plan : {};

  const fallback = {
    ok: true,
    answered_bundle_id: cleanString(currentPlan.bundle_id),
    answer_summary: answer,
    confidence: 0,
    fact_updates: [],
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
            task: "Interpret the user's answer into safe structured updates for SiteForge Factory intake-next-v2.",
            answer,
            current_question_plan: currentPlan,
            strategy: blueprint.strategy,
            fact_registry_snapshot: pruneFactRegistryForModel(blueprint.fact_registry),
            section_status: blueprint.section_status,
            verification_queue: blueprint.verification_queue,
            business_draft_snapshot: blueprint.business_draft,
            allowed_fact_keys: allowedFactKeys,
            allowed_top_level_sections: allowedTopLevelSections,
            allowed_leaf_paths: allowedLeafPaths,
            strategy_contract_context: {
              business_context: safeObject(strategyContract?.business_context),
              conversion_strategy: safeObject(strategyContract?.conversion_strategy),
              content_requirements: safeObject(strategyContract?.content_requirements),
              schema_toggles: safeObject(strategyContract?.schema_toggles),
              copy_policy: safeObject(strategyContract?.copy_policy)
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

    return sanitizeInterpretation(parsed, {
      allowedFactKeys,
      allowedTopLevelSections,
      allowedLeafPaths,
      currentPlan
    });
  } catch (err) {
    console.error("[intake-next-v2:interpret]", err);
    return fallback;
  }
}

function buildInterpreterSystemPrompt() {
  return [
    "You are the interpretation layer for SiteForge Factory intake-next-v2.",
    "You do NOT control schema or system logic.",
    "You may ONLY interpret the user's answer into safe updates for existing fact keys and existing business_draft sections.",
    "Do not invent fields.",
    "Do not invent new schema sections.",
    "Do not hardcode industries.",
    "Do not use generic filler when the user did not provide enough support.",
    "Be conservative.",
    "You may optionally suggest copy refinements, but only under existing business_draft sections and only when clearly supported by the answer.",
    "",
    "Return JSON only with this exact shape:",
    "{",
    '  "answered_bundle_id": "string or null",',
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
    '  "notes": "string" ',
    "}",
    "",
    "Rules for fact_updates:",
    "- fact_key must be in allowed_fact_keys.",
    "- Only update facts clearly supported by the user's answer.",
    "- Prefer partial over speculative full answers.",
    "- verified=true when the user directly stated it.",
    "",
    "Rules for draft_patches/copy_refinements:",
    "- section must be one of allowed_top_level_sections.",
    "- path must either be an allowed leaf path OR a child path under an existing top-level section.",
    "- Do not regenerate full sections unless the current section is already a compact object and the answer clearly supports the patch.",
    "- Keep copy natural, premium, and faithful to the answer."
  ].join("\n");
}

function sanitizeInterpretation(parsed, { allowedFactKeys, allowedTopLevelSections, allowedLeafPaths, currentPlan }) {
  const cleanFactUpdates = (Array.isArray(parsed.fact_updates) ? parsed.fact_updates : [])
    .filter((item) => isObject(item) && allowedFactKeys.includes(cleanString(item.fact_key)))
    .map((item) => ({
      fact_key: cleanString(item.fact_key),
      value: normalizeModelValue(item.value),
      confidence: clampNumber(item.confidence, 0, 1, 0.5),
      verified: item.verified !== false,
      status: sanitizeFactStatus(item.status),
      rationale: cleanString(item.rationale)
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
    answered_bundle_id: cleanString(parsed.answered_bundle_id) || cleanString(currentPlan.bundle_id),
    answer_summary: cleanString(parsed.answer_summary),
    confidence: clampNumber(parsed.confidence, 0, 1, 0.5),
    fact_updates: dedupeBy(cleanFactUpdates, "fact_key"),
    draft_patches: dedupeBy(cleanDraftPatches, "path"),
    copy_refinements: dedupeBy(cleanCopyRefinements, "path"),
    unresolved_points: normalizeStringArray(parsed.unresolved_points),
    notes: cleanString(parsed.notes)
  };
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

/* =========================
   Apply AI Interpretation
========================= */

function applyInterpretationToBlueprint({ blueprint, interpretation, answer }) {
  const factRegistry = deepClone(blueprint.fact_registry || {});
  const businessDraft = deepClone(blueprint.business_draft || {});
  const now = new Date().toISOString();

  const updatedFactKeys = [];
  const patchedPaths = [];

  for (const update of interpretation.fact_updates) {
    const current = isObject(factRegistry[update.fact_key]) ? factRegistry[update.fact_key] : {};
    const history = Array.isArray(current.history) ? current.history.slice() : [];

    history.push({
      timestamp: now,
      source: "user",
      previous_value: current.value,
      next_value: deepClone(update.value),
      rationale: cleanString(update.rationale),
      answer_excerpt: truncate(answer, 300)
    });

    factRegistry[update.fact_key] = {
      ...current,
      value: deepClone(update.value),
      source: "user",
      confidence: clampNumber(update.confidence, 0, 1, current.confidence ?? 0.5),
      verified: update.verified !== false,
      status: sanitizeFactStatus(update.status),
      rationale: cleanString(update.rationale),
      updated_at: now,
      history
    };

    updatedFactKeys.push(update.fact_key);
  }

  for (const patch of interpretation.draft_patches) {
    setByPath(businessDraft, patch.path, deepClone(patch.value));
    patchedPaths.push(patch.path);
  }

  for (const refinement of interpretation.copy_refinements) {
    const existing = getByPath(businessDraft, refinement.path);
    if (shouldApplyCopyRefinement(existing, refinement.value, refinement.confidence)) {
      setByPath(businessDraft, refinement.path, deepClone(refinement.value));
      patchedPaths.push(refinement.path);
    }
  }

  syncDraftFromFacts({
    businessDraft,
    factRegistry,
    strategy: blueprint.strategy
  });

  return {
    fact_registry: factRegistry,
    business_draft: businessDraft,
    audit: {
      timestamp: now,
      answered_bundle_id: cleanString(interpretation.answered_bundle_id),
      answer_summary: cleanString(interpretation.answer_summary),
      interpretation_confidence: clampNumber(interpretation.confidence, 0, 1, 0),
      updated_fact_keys: uniqueList(updatedFactKeys),
      patched_paths: uniqueList(patchedPaths),
      unresolved_points: normalizeStringArray(interpretation.unresolved_points),
      notes: cleanString(interpretation.notes)
    }
  };
}

function shouldApplyCopyRefinement(existing, nextValue, confidence) {
  if (!hasMeaningfulValue(nextValue)) return false;
  if (typeof nextValue !== "string") return true;
  if (!hasMeaningfulValue(existing)) return true;
  return confidence >= 0.6;
}

function syncDraftFromFacts({ businessDraft, factRegistry, strategy }) {
  const fact = (key) => factRegistry?.[key]?.value;
  const toggles = safeObject(strategy?.schema_toggles);

  safeAssignPathIfExists(businessDraft, "brand.phone", fact("phone"));
  safeAssignPathIfExists(businessDraft, "brand.email", fact("email"));
  safeAssignPathIfExists(businessDraft, "brand.office_address", firstNonEmpty([fact("address"), fact("office_address")]));
  safeAssignPathIfExists(businessDraft, "brand.tagline", fact("tagline"));

  safeAssignPathIfExists(businessDraft, "hero.subtext", firstNonEmpty([fact("primary_offer"), fact("website_direction")]));
  safeAssignPathIfExists(businessDraft, "hero.headline", fact("hero_headline"));
  safeAssignPathIfExists(businessDraft, "hero.image.alt", fact("hero_image_alt"));
  safeAssignPathIfExists(businessDraft, "hero.image.image_search_query", firstNonEmpty([fact("hero_image_query"), fact("gallery_visual_direction")]));

  safeAssignPathIfExists(businessDraft, "about.story_text", firstNonEmpty([fact("founder_story"), fact("business_understanding")]));
  safeAssignPathIfExists(businessDraft, "about.founder_note", fact("founder_story"));
  safeAssignPathIfExists(businessDraft, "about.years_experience", stringifyFactValue(fact("years_experience")));

  safeAssignPathIfExists(businessDraft, "settings.cta_text", fact("cta_text"));
  safeAssignPathIfExists(businessDraft, "settings.cta_link", firstNonEmpty([fact("booking_url"), fact("cta_link"), "#contact"]));

  safeAssignPathIfExists(businessDraft, "contact.subheadline", firstNonEmpty([fact("contact_path"), fact("booking_method")]));
  safeAssignPathIfExists(businessDraft, "contact.email_recipient", firstNonEmpty([fact("email"), fact("contact_email")]));
  safeAssignPathIfExists(businessDraft, "contact.phone", fact("phone"));
  safeAssignPathIfExists(businessDraft, "contact.booking_url", fact("booking_url"));
  safeAssignPathIfExists(businessDraft, "contact.hours", fact("hours"));
  safeAssignPathIfExists(businessDraft, "contact.address", firstNonEmpty([fact("address"), fact("office_address")]));

  if (toggles.show_service_area) {
    safeAssignPathIfExists(businessDraft, "service_area.main_city", firstNonEmpty([fact("service_area_main"), fact("service_area")]));
    safeAssignPathIfExists(businessDraft, "service_area.surrounding_cities", ensureArrayStrings(fact("surrounding_cities")));
  }

  if (toggles.show_investment) {
    safeAssignPathIfExists(businessDraft, "investment.summary", fact("pricing"));
  }

  if (toggles.show_testimonials) {
    const quotes = ensureArrayObjects(fact("review_quotes"));
    if (quotes.length && hasPath(businessDraft, "testimonials.items")) {
      safeAssignPathIfExists(businessDraft, "testimonials.items", quotes);
    }
  }

  if (toggles.show_faqs) {
    const faqAngles = ensureArrayStrings(fact("faq_angles"));
    if (faqAngles.length && hasPath(businessDraft, "faqs")) {
      if (Array.isArray(getByPath(businessDraft, "faqs"))) {
        safeAssignPathIfExists(
          businessDraft,
          "faqs",
          faqAngles.map((question) => ({
            question,
            answer: ""
          }))
        );
      }
    }
  }
}

/* =========================
   Blueprint Recompute
========================= */

function computeSectionStatus(strategy, factRegistry, businessDraft) {
  const sectionMap = getSectionMap();
  const out = {};
  const schemaToggles = safeObject(strategy?.schema_toggles);

  for (const [sectionName, config] of Object.entries(sectionMap)) {
    const enabled = isSectionEnabled(sectionName, config, schemaToggles);
    const required = !!config.required;
    const requiredForPreview = !!config.required_for_preview;
    const fields = Array.isArray(config.fields) ? config.fields : [];

    let filledCount = 0;
    let verifiedCount = 0;
    let total = fields.length;

    for (const field of fields) {
      const draftValue = getByPath(businessDraft, field.path);
      const factValue = factRegistry?.[field.fact_key]?.value;
      const factVerified = isFactVerifiedByPath(factRegistry, field.fact_key);

      const hasValue = hasMeaningfulValue(draftValue) || hasMeaningfulValue(factValue);
      if (hasValue) filledCount += 1;
      if (hasValue && factVerified) verifiedCount += 1;
    }

    const score = total > 0 ? Number((filledCount / total).toFixed(2)) : 1;
    const verifiedRatio = total > 0 ? Number((verifiedCount / total).toFixed(2)) : 1;

    out[sectionName] = {
      enabled,
      required,
      required_for_preview: requiredForPreview,
      score,
      verified_ratio: verifiedRatio,
      filled_fields: filledCount,
      total_fields: total,
      status:
        !enabled ? "disabled" :
        score >= 0.9 ? "strong" :
        score >= 0.5 ? "partial" :
        "weak"
    };
  }

  return out;
}

function buildVerificationQueue(strategy, factRegistry, sectionStatus) {
  const queue = [];
  const mustVerifyNow = cleanList(strategy?.content_requirements?.must_verify_now);
  const previewRequired = cleanList(strategy?.content_requirements?.preview_required_fields);
  const publishRequired = cleanList(strategy?.content_requirements?.publish_required_fields);
  const fieldIntentMap = getFieldIntentMap(strategy);

  for (const [fieldKey, config] of Object.entries(fieldIntentMap)) {
    const fact = isObject(factRegistry?.[fieldKey]) ? factRegistry[fieldKey] : null;
    if (!fact) continue;

    const missing = !hasMeaningfulValue(fact.value);
    const partial = cleanString(fact.status) === "partial";
    const needsClient = !!fact.requires_client_verification;
    const shouldVerify =
      needsClient ||
      config.must_verify_now_aliases.some((alias) => mustVerifyNow.includes(alias)) ||
      config.preview_aliases.some((alias) => previewRequired.includes(alias)) ||
      config.publish_aliases.some((alias) => publishRequired.includes(alias));

    if (!missing && !partial && !shouldVerify) {
      continue;
    }

    const relatedSections = cleanList(config.related_sections).filter((section) => sectionStatus?.[section]?.enabled);
    const weakSectionCount = relatedSections.filter((section) => (sectionStatus?.[section]?.score ?? 0) < 0.75).length;

    queue.push({
      field_key: fieldKey,
      bundle_id: cleanString(config.bundle_id),
      priority: computeVerificationPriority({
        config,
        missing,
        partial,
        shouldVerify,
        needsClient,
        weakSectionCount
      }),
      missing,
      partial,
      requires_client_verification: needsClient,
      related_sections: relatedSections,
      reason: cleanString(config.reason)
    });
  }

  return queue.sort((a, b) => b.priority - a.priority);
}

function computeVerificationPriority({ config, missing, partial, shouldVerify, needsClient, weakSectionCount }) {
  let score = 0;
  if (missing) score += 120;
  if (partial) score += 55;
  if (shouldVerify) score += 35;
  if (needsClient) score += 30;
  score += weakSectionCount * 20;
  score += bundleBaseWeight(cleanString(config.bundle_id));
  return score;
}

function buildQuestionCandidates(strategy, factRegistry, sectionStatus, verificationQueue) {
  const grouped = new Map();
  const fieldIntentMap = getFieldIntentMap(strategy);

  for (const item of verificationQueue) {
    const bundleId = cleanString(item.bundle_id);
    if (!bundleId) continue;

    if (!grouped.has(bundleId)) {
      grouped.set(bundleId, {
        bundle_id: bundleId,
        score: 0,
        target_fields: [],
        target_sections: [],
        primary_field: "",
        intent: "",
        reason: "",
        tone: "consultative"
      });
    }

    const group = grouped.get(bundleId);
    const config = fieldIntentMap[item.field_key] || {};

    group.score += Number(item.priority || 0);
    group.target_fields = uniqueList(group.target_fields.concat([item.field_key]));
    group.target_sections = uniqueList(group.target_sections.concat(item.related_sections || []));
    if (!group.primary_field) {
      group.primary_field = cleanString(config.primary_field || item.field_key);
    }
    if (!group.intent) group.intent = cleanString(config.bundle_intent);
    if (!group.reason) group.reason = cleanString(config.bundle_reason);
  }

  const candidates = Array.from(grouped.values())
    .map((candidate) => {
      const weakSections = candidate.target_sections.filter(
        (section) => (sectionStatus?.[section]?.score ?? 0) < 0.75
      );
      const missingFields = candidate.target_fields.filter(
        (field) => !hasMeaningfulValue(factRegistry?.[field]?.value)
      );
      const partialFields = candidate.target_fields.filter(
        (field) => cleanString(factRegistry?.[field]?.status) === "partial"
      );

      const extraScore =
        (missingFields.length * 40) +
        (partialFields.length * 18) +
        (weakSections.length * 20);

      return {
        ...candidate,
        score: candidate.score + extraScore,
        target_fields: candidate.target_fields,
        target_sections: candidate.target_sections
      };
    })
    .sort((a, b) => b.score - a.score);

  return candidates;
}

function planNextQuestion(questionCandidates, previousBundleId) {
  const candidates = Array.isArray(questionCandidates) ? questionCandidates : [];
  if (!candidates.length) {
    return null;
  }

  const best = candidates[0];

  return {
    bundle_id: cleanString(best.bundle_id),
    score: Number(best.score || 0),
    target_fields: cleanList(best.target_fields),
    target_sections: cleanList(best.target_sections),
    primary_field: cleanString(best.primary_field),
    intent: cleanString(best.intent),
    reason: cleanString(best.reason),
    tone: cleanString(best.tone) || "consultative",
    previous_bundle_id: cleanString(previousBundleId)
  };
}

function evaluateBlueprintReadiness(blueprint) {
  const sectionStatus = safeObject(blueprint?.section_status);
  const requiredSections = ["intelligence", "strategy", "settings", "brand", "hero", "features", "contact"];
  const satisfiedBlocks = [];
  const remainingBlocks = [];

  for (const section of requiredSections) {
    const entry = sectionStatus?.[section];
    if (entry?.enabled !== false && (entry?.score ?? 0) >= 0.5) {
      satisfiedBlocks.push(section);
    } else {
      remainingBlocks.push(section);
    }
  }

  const mustVerifyOpen = (Array.isArray(blueprint?.verification_queue) ? blueprint.verification_queue : [])
    .filter((item) => item.missing || item.requires_client_verification || item.partial)
    .map((item) => cleanString(item.field_key))
    .filter(Boolean);

  const score = Number((satisfiedBlocks.length / requiredSections.length).toFixed(2));

  return {
    score,
    can_generate_now: remainingBlocks.length === 0 && mustVerifyOpen.length === 0,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks,
    must_verify_open: mustVerifyOpen
  };
}

/* =========================
   Compatibility Mirrors
========================= */

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

/* =========================
   Question Rendering
========================= */

async function renderNextQuestion({ env, blueprint, previousPlan, interpretation, businessName }) {
  const plan = blueprint.question_plan;
  if (!plan) {
    return "Excellent — we now have enough verified clarity to move into final assembly.";
  }

  const fallback = buildDeterministicQuestion(plan, blueprint, businessName);

  if (!env?.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    const payload = {
      model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You write the next intake question for SiteForge Factory.",
            "Style: consultative, expert-level, natural, concise, premium.",
            "Do not mention schema, JSON, fields, or technical internals.",
            "Ask one strong next question.",
            "Do not repeat what was just answered.",
            "Do not hardcode industries.",
            'Return JSON only: { "message": "..." }'
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              business_name: cleanString(businessName),
              previous_bundle_id: cleanString(previousPlan?.bundle_id),
              next_bundle_id: cleanString(plan.bundle_id),
              primary_field: cleanString(plan.primary_field),
              intent: cleanString(plan.intent),
              reason: cleanString(plan.reason),
              updated_fact_keys: cleanList(interpretation?.updated_fact_keys),
              answer_summary: cleanString(interpretation?.answer_summary),
              unresolved_points: normalizeStringArray(interpretation?.unresolved_points)
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

    if (!response.ok) return fallback;

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    const parsed = safeJsonParse(raw);
    const message = cleanString(parsed?.message);
    return message || fallback;
  } catch (err) {
    console.error("[intake-next-v2:render-question]", err);
    return fallback;
  }
}

function buildDeterministicQuestion(plan, blueprint, businessName) {
  const name = cleanString(businessName) || cleanString(getByPath(blueprint.business_draft, "brand.name")) || "your business";

  switch (cleanString(plan.bundle_id)) {
    case "conversion":
      return `When someone is ready to take the next step with ${name}, what should happen — do they call, request a quote, fill out a form, book online, or something else — and is there anything they should understand about pricing, timing, or availability?`;
    case "positioning":
      return `If a strong-fit visitor lands on ${name}, what should they immediately understand about who it is for, what you offer, and what makes it meaningfully different?`;
    case "service_area":
      return `What is the primary market you want this site to speak to, and are there nearby cities or regions you also want represented?`;
    case "proof":
      return `What are the strongest proof points we can use to help someone trust ${name} quickly — for example experience, client feedback, outcomes, reputation, or anything else that matters?`;
    case "brand_story":
      return `What is the story behind ${name}, and what standards, philosophy, or personal perspective should come through in the about section?`;
    case "contact_details":
      return `What contact details should we treat as the accurate public version for the site — phone, email, address, hours, and anything else people should know before reaching out?`;
    default:
      return `What is the next important thing a serious prospect should understand about ${name} before deciding to contact or book?`;
  }
}

/* =========================
   Field Intent + Section Map
========================= */

function getFieldIntentMap(strategy) {
  const toggles = safeObject(strategy?.schema_toggles);
  const showProcess = !!toggles.show_process;
  const showGallery = !!toggles.show_gallery;
  const showTestimonials = !!toggles.show_testimonials;
  const showServiceArea = !!toggles.show_service_area;
  const showInvestment = !!toggles.show_investment;
  const showAbout = !!toggles.show_about;
  const showFaqs = !!toggles.show_faqs;
  const showEvents = !!toggles.show_events;
  const showComparison = !!toggles.show_comparison;

  const map = {
    primary_offer: {
      bundle_id: "positioning",
      primary_field: "primary_offer",
      related_sections: ["hero", "features"],
      must_verify_now_aliases: ["primary_offer"],
      preview_aliases: ["primary_offer"],
      publish_aliases: [],
      reason: "Primary offer shapes hero, features, and page direction.",
      bundle_intent: "Clarify who the site is for, what the offer is, and why it stands apart.",
      bundle_reason: "This unlocks hero, features, and overall page direction."
    },
    target_persona: {
      bundle_id: "positioning",
      primary_field: "primary_offer",
      related_sections: ["intelligence", "hero", "features"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: [],
      reason: "Audience clarity improves positioning and conversion.",
      bundle_intent: "Clarify who the site is for, what the offer is, and why it stands apart.",
      bundle_reason: "This unlocks hero, features, and overall page direction."
    },
    differentiation: {
      bundle_id: "positioning",
      primary_field: "primary_offer",
      related_sections: ["hero", "about", "features"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: [],
      reason: "Differentiation sharpens the page direction.",
      bundle_intent: "Clarify who the site is for, what the offer is, and why it stands apart.",
      bundle_reason: "This unlocks hero, features, and overall page direction."
    },
    booking_method: {
      bundle_id: "conversion",
      primary_field: "booking_method",
      related_sections: ["contact", "settings", "hero"],
      must_verify_now_aliases: ["booking process"],
      preview_aliases: ["booking_method"],
      publish_aliases: [],
      reason: "Booking method defines the site conversion flow.",
      bundle_intent: "Clarify the next step, booking flow, and any pricing or availability expectations.",
      bundle_reason: "This defines how the site converts visitors."
    },
    contact_path: {
      bundle_id: "conversion",
      primary_field: "booking_method",
      related_sections: ["contact", "settings"],
      must_verify_now_aliases: [],
      preview_aliases: ["contact_path"],
      publish_aliases: [],
      reason: "Contact path clarifies the desired visitor action.",
      bundle_intent: "Clarify the next step, booking flow, and any pricing or availability expectations.",
      bundle_reason: "This defines how the site converts visitors."
    },
    pricing: {
      bundle_id: "conversion",
      primary_field: "booking_method",
      related_sections: showInvestment ? ["investment", "contact", "hero"] : ["contact", "hero"],
      must_verify_now_aliases: ["pricing structure", "pricing"],
      preview_aliases: ["pricing"],
      publish_aliases: [],
      reason: "Pricing context helps the site set expectations.",
      bundle_intent: "Clarify the next step, booking flow, and any pricing or availability expectations.",
      bundle_reason: "This defines how the site converts visitors."
    },
    booking_url: {
      bundle_id: "conversion",
      primary_field: "booking_method",
      related_sections: ["contact", "settings"],
      must_verify_now_aliases: ["booking process"],
      preview_aliases: ["booking_url"],
      publish_aliases: ["booking_url"],
      reason: "Booking URL determines whether CTA can send visitors externally.",
      bundle_intent: "Clarify the next step, booking flow, and any pricing or availability expectations.",
      bundle_reason: "This defines how the site converts visitors."
    },
    service_area_main: {
      bundle_id: "service_area",
      primary_field: "service_area_main",
      related_sections: showServiceArea ? ["service_area", "hero"] : ["hero"],
      must_verify_now_aliases: ["service area specifics", "service_area"],
      preview_aliases: ["service_area"],
      publish_aliases: [],
      reason: "Primary market improves local relevance and targeting.",
      bundle_intent: "Clarify the primary market and nearby areas served.",
      bundle_reason: "This improves local relevance and targeting."
    },
    surrounding_cities: {
      bundle_id: "service_area",
      primary_field: "service_area_main",
      related_sections: showServiceArea ? ["service_area", "hero"] : ["hero"],
      must_verify_now_aliases: ["service area specifics"],
      preview_aliases: [],
      publish_aliases: [],
      reason: "Surrounding markets improve geo coverage and SEO targeting.",
      bundle_intent: "Clarify the primary market and nearby areas served.",
      bundle_reason: "This improves local relevance and targeting."
    },
    review_quotes: {
      bundle_id: "proof",
      primary_field: "review_quotes",
      related_sections: showTestimonials ? ["trustbar", "testimonials", "about"] : ["trustbar", "about"],
      must_verify_now_aliases: [],
      preview_aliases: ["review_quotes"],
      publish_aliases: [],
      reason: "Reviews make the site feel credible quickly.",
      bundle_intent: "Clarify why someone should trust the business quickly.",
      bundle_reason: "Proof makes the site feel credible."
    },
    years_experience: {
      bundle_id: showAbout ? "proof" : "brand_story",
      primary_field: showAbout ? "review_quotes" : "founder_story",
      related_sections: showAbout ? ["about", "trustbar"] : ["about"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: [],
      reason: "Experience strengthens trust and about depth.",
      bundle_intent: showAbout
        ? "Clarify why someone should trust the business quickly."
        : "Clarify how the business started and what standards or philosophy define it.",
      bundle_reason: showAbout
        ? "Proof makes the site feel credible."
        : "A stronger story improves the about section."
    },
    trust_signal: {
      bundle_id: "proof",
      primary_field: "review_quotes",
      related_sections: ["trustbar", "testimonials", "about"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: [],
      reason: "Trust signals help visitors believe the offer quickly.",
      bundle_intent: "Clarify why someone should trust the business quickly.",
      bundle_reason: "Proof makes the site feel credible."
    },
    founder_story: {
      bundle_id: "brand_story",
      primary_field: "founder_story",
      related_sections: showAbout ? ["about"] : [],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: [],
      reason: "Founder story deepens the about section.",
      bundle_intent: "Clarify how the business started and what standards or philosophy define it.",
      bundle_reason: "A stronger story improves the about section."
    },
    phone: {
      bundle_id: "contact_details",
      primary_field: "phone",
      related_sections: ["brand", "contact"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: ["phone", "public business phone number"],
      reason: "Phone must be accurate for publish-readiness.",
      bundle_intent: "Verify the factual contact details needed for publish-readiness.",
      bundle_reason: "These details should be accurate before publish."
    },
    email: {
      bundle_id: "contact_details",
      primary_field: "phone",
      related_sections: ["brand", "contact"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: ["email"],
      reason: "Email recipient must be accurate for the contact section.",
      bundle_intent: "Verify the factual contact details needed for publish-readiness.",
      bundle_reason: "These details should be accurate before publish."
    },
    address: {
      bundle_id: "contact_details",
      primary_field: "phone",
      related_sections: ["brand", "contact"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: ["business address", "address"],
      reason: "Address may be needed for publish-readiness.",
      bundle_intent: "Verify the factual contact details needed for publish-readiness.",
      bundle_reason: "These details should be accurate before publish."
    },
    hours: {
      bundle_id: "contact_details",
      primary_field: "phone",
      related_sections: ["contact"],
      must_verify_now_aliases: ["availability for peak seasons"],
      preview_aliases: [],
      publish_aliases: ["hours", "hours of operation"],
      reason: "Hours clarify availability and publish-readiness.",
      bundle_intent: "Verify the factual contact details needed for publish-readiness.",
      bundle_reason: "These details should be accurate before publish."
    }
  };

  if (showFaqs) {
    map.faq_angles = {
      bundle_id: "proof",
      primary_field: "review_quotes",
      related_sections: ["faqs"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: [],
      reason: "FAQ substance helps address objections.",
      bundle_intent: "Clarify why someone should trust the business quickly.",
      bundle_reason: "Proof and objection handling make the site feel credible."
    };
  }

  if (showGallery) {
    map.gallery_visual_direction = {
      bundle_id: "positioning",
      primary_field: "primary_offer",
      related_sections: ["gallery", "hero"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: ["photos"],
      reason: "Visual direction improves image sourcing and overall page fit.",
      bundle_intent: "Clarify who the site is for, what the offer is, and why it stands apart.",
      bundle_reason: "This sharpens the visual direction of the page."
    };
  }

  if (showEvents) {
    map.events = {
      bundle_id: "conversion",
      primary_field: "booking_method",
      related_sections: ["events"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: [],
      reason: "Events define time-based conversion flow.",
      bundle_intent: "Clarify the next step, booking flow, and any pricing or availability expectations.",
      bundle_reason: "This defines how the site converts visitors."
    };
  }

  if (showComparison) {
    map.comparison = {
      bundle_id: "positioning",
      primary_field: "primary_offer",
      related_sections: ["comparison"],
      must_verify_now_aliases: [],
      preview_aliases: [],
      publish_aliases: [],
      reason: "Comparison content clarifies why this option wins.",
      bundle_intent: "Clarify who the site is for, what the offer is, and why it stands apart.",
      bundle_reason: "This sharpens positioning against alternatives."
    };
  }

  return map;
}

function getSectionMap() {
  return {
    intelligence: {
      required: true,
      required_for_preview: true,
      fields: [
        { path: "intelligence.industry", fact_key: "category" },
        { path: "intelligence.target_persona", fact_key: "target_persona" },
        { path: "intelligence.tone_of_voice", fact_key: "tone_of_voice" }
      ]
    },
    strategy: {
      required: true,
      required_for_preview: true,
      fields: [
        { path: "strategy.show_about", fact_key: "show_about" },
        { path: "strategy.show_features", fact_key: "show_features" },
        { path: "strategy.show_testimonials", fact_key: "show_testimonials" }
      ]
    },
    settings: {
      required: true,
      required_for_preview: true,
      fields: [
        { path: "settings.vibe", fact_key: "vibe" },
        { path: "settings.cta_text", fact_key: "cta_text" },
        { path: "settings.cta_link", fact_key: "cta_link" },
        { path: "settings.cta_type", fact_key: "cta_type" }
      ]
    },
    brand: {
      required: true,
      required_for_preview: true,
      fields: [
        { path: "brand.name", fact_key: "business_name" },
        { path: "brand.tagline", fact_key: "tagline" },
        { path: "brand.email", fact_key: "email" }
      ]
    },
    hero: {
      required: true,
      required_for_preview: true,
      fields: [
        { path: "hero.headline", fact_key: "hero_headline" },
        { path: "hero.subtext", fact_key: "primary_offer" },
        { path: "hero.image.alt", fact_key: "hero_image_alt" }
      ]
    },
    about: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_about",
      fields: [
        { path: "about.story_text", fact_key: "founder_story" },
        { path: "about.founder_note", fact_key: "founder_story" },
        { path: "about.years_experience", fact_key: "years_experience" }
      ]
    },
    features: {
      required: true,
      required_for_preview: true,
      fields: [
        { path: "features", fact_key: "primary_offer" }
      ]
    },
    trustbar: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_trustbar",
      fields: [
        { path: "trustbar", fact_key: "trust_signal" }
      ]
    },
    testimonials: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_testimonials",
      fields: [
        { path: "testimonials.items", fact_key: "review_quotes" }
      ]
    },
    process: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_process",
      fields: [
        { path: "processSteps", fact_key: "process_summary" }
      ]
    },
    faqs: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_faqs",
      fields: [
        { path: "faqs", fact_key: "faq_angles" }
      ]
    },
    gallery: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_gallery",
      fields: [
        { path: "gallery.image_source.image_search_query", fact_key: "gallery_visual_direction" }
      ]
    },
    service_area: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_service_area",
      fields: [
        { path: "service_area.main_city", fact_key: "service_area_main" },
        { path: "service_area.surrounding_cities", fact_key: "surrounding_cities" }
      ]
    },
    investment: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_investment",
      fields: [
        { path: "investment", fact_key: "pricing" }
      ]
    },
    events: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_events",
      fields: [
        { path: "events", fact_key: "events" }
      ]
    },
    comparison: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_comparison",
      fields: [
        { path: "comparison.items", fact_key: "comparison" }
      ]
    },
    contact: {
      required: true,
      required_for_preview: true,
      fields: [
        { path: "contact.email_recipient", fact_key: "email" },
        { path: "contact.button_text", fact_key: "cta_text" },
        { path: "contact.subheadline", fact_key: "contact_path" }
      ]
    }
  };
}

function isSectionEnabled(sectionName, config, schemaToggles) {
  if (!config.toggle_key) return true;
  return !!schemaToggles?.[config.toggle_key];
}

function isFactVerifiedByPath(factRegistry, factKey) {
  if (!factKey) return false;
  const fact = factRegistry?.[factKey];
  return !!fact?.verified || !fact?.requires_client_verification;
}

function bundleBaseWeight(bundleId) {
  switch (bundleId) {
    case "conversion":
      return 90;
    case "positioning":
      return 80;
    case "service_area":
      return 70;
    case "proof":
      return 60;
    case "brand_story":
      return 35;
    case "contact_details":
      return 15;
    default:
      return 20;
  }
}

/* =========================
   Normalization
========================= */

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
  next.question_plan = isObject(next.question_plan) ? next.question_plan : {};

  return next;
}

function normalizeFactRegistry(input) {
  const registry = isObject(input) ? input : {};
  const out = {};

  for (const [key, entry] of Object.entries(registry)) {
    if (isObject(entry) && Object.prototype.hasOwnProperty.call(entry, "value")) {
      out[key] = {
        ...entry,
        value: normalizeModelValue(entry.value),
        source: cleanString(entry.source) || "unknown",
        confidence: clampNumber(entry.confidence, 0, 1, 0),
        verified: !!entry.verified,
        status: sanitizeFactStatus(entry.status || inferFactStatus(entry.value)),
        rationale: cleanString(entry.rationale),
        history: Array.isArray(entry.history) ? entry.history : []
      };
    } else {
      out[key] = {
        value: normalizeModelValue(entry),
        source: "unknown",
        confidence: hasMeaningfulValue(entry) ? 0.5 : 0,
        verified: false,
        status: inferFactStatus(entry),
        rationale: "",
        history: []
      };
    }
  }

  return out;
}

/* =========================
   Utility
========================= */

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
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
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

function sanitizeFactStatus(value) {
  const status = cleanString(value);
  if (status === "partial") return "partial";
  if (status === "inferred") return "inferred";
  if (status === "answered") return "answered";
  if (status === "missing") return "missing";
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
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map((item) => cleanString(item)).filter(Boolean))
  );
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
  if (Array.isArray(value)) {
    return value.map((item) => normalizeModelValue(item));
  }

  if (isObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = normalizeModelValue(item);
    }
    return out;
  }

  if (typeof value === "string") return value.trim();
  return value;
}

function ensureArrayStrings(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter(Boolean);
  }
  if (cleanString(value)) return [cleanString(value)];
  return [];
}

function ensureArrayObjects(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => isObject(item) || hasMeaningfulValue(item)).map((item) => {
    if (isObject(item)) return item;
    return { quote: cleanString(item) };
  });
}

function stringifyFactValue(value) {
  if (typeof value === "number") return String(value);
  return cleanString(value);
}