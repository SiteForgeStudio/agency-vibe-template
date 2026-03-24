// functions/api/intake-start.js

/**
 * SiteForge Factory — Paid Intake Start
 *
 * Purpose:
 * - accept a paid slug
 * - load preflight intelligence
 * - verify paid_unlocked
 * - seed intake state from preflight intelligence
 * - return the first verification-style assistant message
 *
 * Notes:
 * - This is intentionally compatible with the current intake-next.js / intake-complete.js state shape.
 * - It introduces strategy_contract and seed_metadata without breaking the legacy flow.
 * - It assumes /api/preflight-status already works (confirmed in repo).
 * - It will try to update Apps Script with route=preflight_update, but that update is non-blocking.
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

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const slug = cleanString(body.slug);

    if (!slug) {
      return json({ ok: false, error: "slug_required" }, 400);
    }

    const preflight = await loadPreflightRecord(context.request, slug);

    if (!preflight?.ok) {
      return json(
        {
          ok: false,
          error: preflight?.error || "preflight_not_found",
          slug
        },
        preflight?.statusCode || 404
      );
    }

    const record = normalizePreflightRecord(preflight);

    if (!isPaidUnlocked(record)) {
      return json(
        {
          ok: false,
          error: "intake_locked",
          slug,
          paid_unlocked: false,
          paid_status: cleanString(record.paid_status) || "not_paid",
          intake_status: cleanString(record.intake_status) || "locked"
        },
        403
      );
    }

    const strategyContract = mapPreflightToStrategyContract(record);
    const state = buildSeededIntakeState(record, strategyContract);
    const readiness = evaluateReadiness(state);
    state.readiness = readiness;

    const sessionId = makeId();
    const openingMessage = buildOpeningMessage(state, strategyContract);

    state.session_id = sessionId;
    state.phase = "guided_enrichment";
    state.conversation = [
      {
        role: "assistant",
        content: openingMessage.content
      }
    ];

    // Non-blocking status update: safe if Apps Script route is not added yet.
    const intakeStatusUpdate = await tryUpdatePreflightStatus(context.env, {
      slug,
      intake_status: "started",
      paid_intake_json: JSON.stringify({
        session_id: sessionId,
        strategy_contract: strategyContract,
        seeded_at: new Date().toISOString()
      })
    });

    return json({
      ok: true,
      slug,
      session_id: sessionId,
      phase: "guided_enrichment",
      message: openingMessage,
      state,
      readiness,
      action: {
        type: "question",
        label: "Continue",
        intent: "verify_and_refine"
      },
      summary_panel: buildSummaryPanel(state),
      intake_status_update: intakeStatusUpdate
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
    endpoint: "intake-start",
    method: "POST"
  });
}

/* --------------------------------
   LOAD PREFLIGHT
-------------------------------- */

async function loadPreflightRecord(request, slug) {
  const url = new URL(request.url);
  url.pathname = "/api/preflight-status";
  url.search = "";

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug })
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("preflight-status returned non JSON");
  }

  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      statusCode: res.status || 404,
      error: data?.error || "Failed to load preflight record"
    };
  }

  return data;
}

function normalizePreflightRecord(record) {
  return {
    ...record,
    slug: cleanString(record.slug),
    input_business_name: cleanString(record.input_business_name),
    canonical_business_name: cleanString(record.canonical_business_name),
    client_email: cleanString(record.client_email),
    city_or_service_area_input: cleanString(record.city_or_service_area_input),
    description_input: cleanString(record.description_input),
    optional_website_or_social: cleanString(record.optional_website_or_social),
    preflight_status: cleanString(record.preflight_status),
    paid_status: cleanString(record.paid_status),
    intake_status: cleanString(record.intake_status),
    build_status: cleanString(record.build_status)
  };
}

function isPaidUnlocked(record) {
  const paidUnlocked = record?.paid_unlocked;
  return (
    paidUnlocked === true ||
    String(paidUnlocked).trim().toLowerCase() === "true" ||
    String(record?.paid_status).trim().toLowerCase() === "paid"
  );
}

/* --------------------------------
   STRATEGY CONTRACT
-------------------------------- */

function mapPreflightToStrategyContract(record) {
  const entityProfile = safeParse(record.entity_profile_json);
  const buyerIntel = safeParse(record.buyer_intelligence_json);
  const strategyData = safeParse(record.preflight_strategy_json);
  const gbpAudit = safeParse(record.gbp_audit_json);

  const internalStrategy = isObject(strategyData.internal_strategy)
    ? strategyData.internal_strategy
    : {};

  const clientPreview = isObject(strategyData.client_preview)
    ? strategyData.client_preview
    : {};

  const recommendedSections = cleanList(internalStrategy.recommended_sections);
  const schemaToggles = inferSchemaToggles(recommendedSections, entityProfile, buyerIntel);
  const selectedVibe = inferSchemaVibe(entityProfile, buyerIntel, internalStrategy);

  const businessName =
    cleanString(record.canonical_business_name) ||
    cleanString(record.input_business_name);

  const serviceArea =
    cleanList(entityProfile.service_area).length
      ? cleanList(entityProfile.service_area)
      : cleanList([record.city_or_service_area_input]);

  const category = cleanString(entityProfile.primary_category);
  const archetype = cleanString(entityProfile.strategic_archetype);
  const model = cleanString(entityProfile.business_model);

  const primaryOffer = cleanString(record.description_input);

  return {
    business_context: {
      slug: cleanString(record.slug),
      business_name: businessName,
      category,
      secondary_categories: cleanList(entityProfile.secondary_categories),
      business_model: model,
      service_area: serviceArea,
      strategic_archetype: archetype,
      vertical_complexity: cleanString(entityProfile.vertical_complexity),
      one_page_fit: cleanString(entityProfile.one_page_fit),
      confidence: numberOr(entityProfile.confidence, 0)
    },

    conversion_strategy: {
      primary_conversion:
        cleanString(internalStrategy.primary_conversion) || "submit_inquiry",
      secondary_conversion:
        cleanString(internalStrategy.secondary_conversion) || "",
      conversion_mode: inferConversionMode(internalStrategy, gbpAudit),
      cta_text: inferCtaText(internalStrategy, gbpAudit),
      cta_type: inferCtaTypeFromStrategy(internalStrategy, gbpAudit),
      cta_destination: inferCtaDestination(internalStrategy, gbpAudit)
    },

    audience_model: {
      primary_persona: inferPrimaryPersona(entityProfile, buyerIntel, record),
      secondary_persona: inferSecondaryPersona(entityProfile, buyerIntel, record),
      decision_factors: cleanList(buyerIntel.decision_factors),
      common_objections: cleanList(buyerIntel.common_objections),
      red_flags_customers_avoid: cleanList(buyerIntel.red_flags_customers_avoid)
    },

    proof_model: {
      trust_signals: cleanList(buyerIntel.trust_markers),
      credibility_sources: inferCredibilitySources(buyerIntel, gbpAudit, entityProfile)
    },

    site_structure: {
      recommended_sections: recommendedSections,
      faq_angles: cleanList(internalStrategy.faq_angles),
      aeo_angles: cleanList(internalStrategy.aeo_angles),
      future_dynamic_vibe_hint: inferFutureDynamicVibeHint(entityProfile, record)
    },

    visual_strategy: {
      recommended_vibe: selectedVibe,
      vibe_source: "ai_inferred",
      vibe_confidence: clamp(numberOr(entityProfile.confidence, 0.68), 0, 1),
      vibe_reasoning: inferVibeReasoning(entityProfile, internalStrategy, selectedVibe)
    },

    asset_policy: {
      preview_asset_mode: "inspirational_images",
      allow_ai_generated_images: true,
      allow_stock_images: true,
      client_assets_required_for_preview: false,
      replace_assets_before_publish: true,
      preferred_image_themes: inferPreferredImageThemes(record, entityProfile, buyerIntel)
    },

    copy_policy: {
      allow_ai_inferred_copy: true,
      allow_ai_assisted_copy: true,
      require_client_verification_for_facts: true,
      fields_ai_can_draft: [
        "hero_headline",
        "hero_subheadline",
        "about_blurb",
        "service_descriptions",
        "faq_answers",
        "cta_text"
      ],
      fields_requiring_verification: [
        "phone",
        "address",
        "booking_url",
        "hours",
        "pricing",
        "certifications",
        "review_quotes",
        "departure_location"
      ]
    },

    content_requirements: {
      must_verify_now: cleanList(internalStrategy.must_verify_now),
      must_collect_paid_phase: cleanList(internalStrategy.must_collect_paid_phase),
      nice_to_have_assets: cleanList(internalStrategy.nice_to_have_assets),
      preview_required_fields: inferPreviewRequiredFields(internalStrategy, gbpAudit),
      publish_required_fields: inferPublishRequiredFields(gbpAudit)
    },

    schema_toggles: schemaToggles,

    source_snapshot: {
      client_preview: clientPreview,
      gbp_status: cleanString(gbpAudit.gbp_status),
      recommended_gbp_category: cleanString(gbpAudit.recommended_primary_category),
      nap_recommendation: isObject(gbpAudit.nap_recommendation)
        ? gbpAudit.nap_recommendation
        : {},
      primary_offer_hint: primaryOffer
    }
  };
}

/* --------------------------------
   STATE SEEDING
-------------------------------- */

function buildSeededIntakeState(record, strategyContract) {
  const businessName = cleanString(strategyContract.business_context.business_name);
  const clientEmail = cleanString(record.client_email);

  const answers = {
    why_now: buildWhyNowSeed(strategyContract, record),
    desired_outcome: buildDesiredOutcomeSeed(strategyContract),
    primary_conversion_goal: cleanString(
      strategyContract.conversion_strategy.primary_conversion
    ),
    first_impression_goal: buildFirstImpressionSeed(strategyContract),
    target_audience:
      cleanString(strategyContract.audience_model.primary_persona) ||
      "",
    offerings: inferOfferings(record, strategyContract),
    booking_method: inferBookingMethodSeed(strategyContract),
    phone: cleanString(
      strategyContract.source_snapshot?.nap_recommendation?.phone
    ),
    booking_url: "",
    office_address: cleanString(
      strategyContract.source_snapshot?.nap_recommendation?.address
    ),
    differentiators: inferDifferentiatorsSeed(strategyContract),
    trust_signals: cleanList(strategyContract.proof_model.trust_signals),
    credibility_factors: cleanList(strategyContract.proof_model.credibility_sources),
    location_context: cleanString(record.city_or_service_area_input),
    service_area: cleanList(strategyContract.business_context.service_area).join(", "),
    tone_preferences: buildTonePreferenceSeed(strategyContract),
    visual_direction: buildVisualDirectionSeed(strategyContract),
    process_notes: [],
    faq_topics: cleanList(strategyContract.site_structure.faq_angles),
    pricing_context: "",
    buyer_decision_factors: cleanList(strategyContract.audience_model.decision_factors),
    common_objections: cleanList(strategyContract.audience_model.common_objections)
  };

  const inference = {
    suggested_vibe: cleanString(strategyContract.visual_strategy.recommended_vibe),
    suggested_components: schemaToggleKeysToComponents(strategyContract.schema_toggles),
    tone_direction: buildTonePreferenceSeed(strategyContract),
    visual_direction: buildVisualDirectionSeed(strategyContract),
    missing_information: collectSeedMissingInfo(strategyContract, answers),
    confidence_score: numberOr(strategyContract.business_context.confidence, 0.7),
    strategy_contract: strategyContract
  };

  const ghostwritten = {
    tagline: "",
    hero_headline: buildHeroHeadlineDraft(record, strategyContract),
    hero_subheadline: buildHeroSubheadlineDraft(record, strategyContract),
    about_summary: buildAboutSummaryDraft(record, strategyContract),
    features_copy: [],
    faqs: cleanList(strategyContract.site_structure.faq_angles).map(function(q) {
      return {
        question: q,
        answer: ""
      };
    })
  };

  const state = normalizeState({
    slug: cleanString(record.slug),
    businessName,
    clientEmail,
    phase: "guided_enrichment",
    answers,
    inference,
    ghostwritten,
    provenance: {
      seed_source: "preflight",
      preflight_status: cleanString(record.preflight_status),
      paid_status: cleanString(record.paid_status),
      strategy_contract: strategyContract
    },
    seed_metadata: {
      seeded_from_preflight: true,
      seeded_at: new Date().toISOString(),
      preview_mode_assets: true,
      requires_client_assets_before_publish: true
    }
  });

  return state;
}

/* --------------------------------
   OPENING MESSAGE
-------------------------------- */

function buildOpeningMessage(state, strategyContract) {
  const offer = cleanList(state.answers.offerings)[0] || "your main service";
  const missing = cleanList(strategyContract.content_requirements.must_verify_now);
  const firstUnknown = missing[0] || "booking flow details";

  return {
    type: "welcome",
    title: "Paid intake unlocked",
    content:
      "We already analyzed your business and mapped an initial site strategy. " +
      "Now we’ll tighten the details that affect conversion, trust, booking, and the preview build. " +
      "You do not need polished photos yet — we can use inspirational imagery for the first preview. " +
      "Let’s start with " +
      offer +
      ". " +
      "What should we know first about " +
      firstUnknown.replace(/_/g, " ") +
      "?",
    options: [
      { label: "Let’s do it", action: "continue" },
      { label: "Show me what you inferred", action: "accept" }
    ]
  };
}

/* --------------------------------
   APPS SCRIPT UPDATE
-------------------------------- */

async function tryUpdatePreflightStatus(env, patch) {
  try {
    const url = env.APPS_SCRIPT_WEBAPP_URL;
    const factoryKey = env.FACTORY_KEY;

    if (!url || !factoryKey) {
      return { ok: false, skipped: true, reason: "missing_apps_script_env" };
    }

    const payload = {
      route: "preflight_update",
      factory_key: factoryKey,
      ...patch
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();

    let data = {};
    try {
      data = JSON.parse(text || "{}");
    } catch {
      data = { ok: false, raw: text };
    }

    return {
      ok: Boolean(res.ok && data?.ok),
      status: res.status,
      response: data
    };
  } catch (err) {
    return {
      ok: false,
      skipped: true,
      reason: String(err?.message || err)
    };
  }
}

/* --------------------------------
   READINESS + SUMMARY
-------------------------------- */

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

/* --------------------------------
   VIBE + TOGGLES
-------------------------------- */

function inferSchemaVibe(entityProfile = {}, buyerIntel = {}, internalStrategy = {}) {
  const category = cleanString(entityProfile.primary_category).toLowerCase();
  const archetype = cleanString(entityProfile.strategic_archetype).toLowerCase();
  const model = cleanString(entityProfile.business_model).toLowerCase();
  const sections = cleanList(internalStrategy.recommended_sections).map(function(v) {
    return v.toLowerCase();
  });

  if (/saas|software|ai|tech|cyber|fintech/.test(category)) {
    return "Midnight Tech";
  }

  if (/solar|eco|green|sustain|wellness|nature/.test(category)) {
    return "Zenith Earth";
  }

  if (/artisan|handmade|craft|boutique|studio/.test(category)) {
    return "Vintage Boutique";
  }

  if (/construction|contractor|roof|electric|plumb|hvac|industrial|manufactur|trade/.test(category)) {
    return "Rugged Industrial";
  }

  if (/luxury|premium|exclusive/.test(category) || archetype.includes("premium")) {
    return "Luxury Noir";
  }

  if (/law|legal|finance|account|health|medical|clinic|dental/.test(category)) {
    return "Legacy Professional";
  }

  if (/music|entertainment|creative|media|youth/.test(category)) {
    return "Solar Flare";
  }

  if (
    archetype.includes("experience") ||
    model === "destination" ||
    sections.includes("gallery")
  ) {
    return "Modern Minimal";
  }

  return "Modern Minimal";
}

function inferSchemaToggles(sections, entityProfile, buyerIntel) {
  const normalized = cleanList(sections).map(function(v) {
    return v.toLowerCase();
  });

  const has = function(token) {
    return normalized.some(function(v) {
      return v.includes(token);
    });
  };

  const trustSignals = cleanList(buyerIntel?.trust_markers);
  const serviceArea = cleanList(entityProfile?.service_area);

  return {
    show_trustbar: trustSignals.length > 0,
    show_about: true,
    show_features: has("tour") || has("service") || has("feature") || has("option"),
    show_events: has("tour") || has("event") || has("availability"),
    show_process: has("process"),
    show_testimonials: has("testimonial") || trustSignals.some(v => /testimonial|review/i.test(v)),
    show_comparison: has("comparison") || has("package"),
    show_gallery: has("gallery") || trustSignals.some(v => /photo|gallery|visual/i.test(v)),
    show_investment: has("pricing") || has("investment"),
    show_faqs: has("faq") || true,
    show_service_area: serviceArea.length > 0
  };
}

/* --------------------------------
   INFERENCE HELPERS
-------------------------------- */

function inferPrimaryPersona(entityProfile, buyerIntel, record) {
  const category = cleanString(entityProfile.primary_category).toLowerCase();
  const city = cleanString(record.city_or_service_area_input);

  if (category.includes("boat tour")) {
    return city
      ? "tourists and local families looking for memorable experiences in " + city
      : "tourists and local families looking for memorable boat experiences";
  }

  return "people actively looking for a trustworthy provider";
}

function inferSecondaryPersona(entityProfile, buyerIntel, record) {
  const model = cleanString(entityProfile.business_model).toLowerCase();

  if (model === "destination") {
    return "visitors comparing local experiences before booking";
  }

  return "";
}

function inferCredibilitySources(buyerIntel, gbpAudit, entityProfile) {
  const out = [];

  cleanList(buyerIntel?.trust_markers).forEach(function(item) {
    const lower = item.toLowerCase();
    if (lower.includes("testimonial") || lower.includes("review")) out.push("customer_reviews");
    if (lower.includes("photo") || lower.includes("gallery")) out.push("photo_gallery");
    if (lower.includes("partnership")) out.push("local_partnerships");
    if (lower.includes("safety")) out.push("safety_reassurance");
  });

  if (cleanString(gbpAudit?.gbp_status) === "not_found") {
    out.push("future_google_business_profile");
  }

  if (cleanList(entityProfile?.service_area).length) {
    out.push("local_service_area_relevance");
  }

  return uniqueList(out);
}

function inferConversionMode(internalStrategy, gbpAudit) {
  const primary = cleanString(internalStrategy?.primary_conversion).toLowerCase();

  if (primary.includes("book")) return "direct_booking";
  if (primary.includes("call")) return "call_now";
  if (primary.includes("quote")) return "request_quote";

  const required = cleanList(gbpAudit?.required_inputs_for_setup).map(function(v) {
    return v.toLowerCase();
  });

  if (required.some(v => v.includes("booking url"))) return "direct_booking";

  return "contact_request";
}

function inferCtaText(internalStrategy, gbpAudit) {
  const primary = cleanString(internalStrategy?.primary_conversion).toLowerCase();

  if (primary === "book_now") return "Book Now";
  if (primary === "submit_inquiry") return "Check Availability";
  if (primary.includes("quote")) return "Request Quote";
  if (primary.includes("call")) return "Call Now";

  const required = cleanList(gbpAudit?.required_inputs_for_setup).map(function(v) {
    return v.toLowerCase();
  });

  if (required.some(v => v.includes("booking url"))) return "Book Now";

  return "Get Started";
}

function inferCtaTypeFromStrategy(internalStrategy, gbpAudit) {
  const primary = cleanString(internalStrategy?.primary_conversion).toLowerCase();

  if (primary.includes("book")) return "external";
  return "anchor";
}

function inferCtaDestination(internalStrategy, gbpAudit) {
  const primary = cleanString(internalStrategy?.primary_conversion).toLowerCase();

  if (primary.includes("book")) return "booking_url";
  if (primary.includes("call")) return "phone";
  return "contact";
}

function inferPreferredImageThemes(record, entityProfile, buyerIntel) {
  const out = [];

  const category = cleanString(entityProfile.primary_category);
  const description = cleanString(record.description_input);
  const serviceArea = cleanList(entityProfile.service_area);

  if (category) out.push(category);
  if (description) out.push(description);
  serviceArea.forEach(function(v) { out.push(v); });

  cleanList(buyerIntel?.trust_markers).forEach(function(item) {
    if (/photo|gallery|visual/i.test(item)) out.push("realistic lifestyle imagery");
  });

  return uniqueList(out).slice(0, 8);
}

function inferPreviewRequiredFields(internalStrategy, gbpAudit) {
  const out = [
    "primary_offer",
    "booking_method",
    "service_area"
  ];

  cleanList(internalStrategy?.must_verify_now).forEach(function(v) {
    out.push(v);
  });

  return uniqueList(out);
}

function inferPublishRequiredFields(gbpAudit) {
  const out = [
    "phone",
    "booking_url",
    "hours"
  ];

  cleanList(gbpAudit?.required_inputs_for_setup).forEach(function(v) {
    out.push(v);
  });

  return uniqueList(out);
}

function inferFutureDynamicVibeHint(entityProfile, record) {
  const archetype = cleanString(entityProfile.strategic_archetype).toLowerCase();
  const category = cleanString(entityProfile.primary_category).toLowerCase();
  const area = cleanString(record.city_or_service_area_input).toLowerCase();

  if (archetype.includes("experience") || category.includes("tour")) {
    return "destination experience";
  }

  if (area) {
    return area + " local business";
  }

  return "premium local service";
}

function inferVibeReasoning(entityProfile, internalStrategy, selectedVibe) {
  const reasoning = [];

  const category = cleanString(entityProfile.primary_category);
  const archetype = cleanString(entityProfile.strategic_archetype);
  const model = cleanString(entityProfile.business_model);

  if (category) reasoning.push(category);
  if (archetype) reasoning.push(archetype);
  if (model) reasoning.push(model);

  reasoning.push("resolved to current schema-supported vibe: " + selectedVibe);

  return uniqueList(reasoning);
}

function inferOfferings(record, strategyContract) {
  const direct = cleanString(record.description_input);
  const sections = cleanList(strategyContract.site_structure.recommended_sections);

  if (direct) return [direct];
  if (sections.length) return sections.filter(v => !/hero|gallery|faq|contact|testimonial/i.test(v));
  return [];
}

function inferBookingMethodSeed(strategyContract) {
  const mode = cleanString(strategyContract.conversion_strategy.conversion_mode);

  if (mode === "direct_booking") return "external_booking";
  if (mode === "call_now") return "phone";
  return "";
}

function inferDifferentiatorsSeed(strategyContract) {
  const out = [];
  cleanList(strategyContract.audience_model.decision_factors).forEach(function(item) {
    if (/quality|safety|availability|experience/i.test(item)) out.push(item);
  });
  return uniqueList(out).slice(0, 4);
}

function buildWhyNowSeed(strategyContract, record) {
  const category = cleanString(strategyContract.business_context.category);
  const area = cleanString(record.city_or_service_area_input);

  if (category && area) {
    return "create a clearer online presence for " + category.toLowerCase() + " customers in " + area;
  }

  return "turn more interested visitors into direct leads or bookings";
}

function buildDesiredOutcomeSeed(strategyContract) {
  const primary = cleanString(strategyContract.conversion_strategy.primary_conversion);

  if (primary === "book_now") return "increase direct bookings";
  if (primary === "submit_inquiry") return "increase qualified inquiries";
  return "improve conversions";
}

function buildFirstImpressionSeed(strategyContract) {
  const vibe = cleanString(strategyContract.visual_strategy.recommended_vibe);

  if (vibe === "Luxury Noir") return "premium and high-end";
  if (vibe === "Rugged Industrial") return "credible, dependable, and capable";
  if (vibe === "Legacy Professional") return "established, trustworthy, and professional";
  if (vibe === "Solar Flare") return "bold, energetic, and memorable";

  return "clear, trustworthy, and polished";
}

function buildTonePreferenceSeed(strategyContract) {
  const category = cleanString(strategyContract.business_context.category).toLowerCase();

  if (category.includes("tour")) return "friendly, trustworthy, and experience-focused";
  if (category.includes("law") || category.includes("finance") || category.includes("medical")) {
    return "professional, reassuring, and credible";
  }

  return "confident, clear, and conversion-focused";
}

function buildVisualDirectionSeed(strategyContract) {
  const vibe = cleanString(strategyContract.visual_strategy.recommended_vibe);
  const hint = cleanString(strategyContract.site_structure.future_dynamic_vibe_hint);

  return [vibe, hint].filter(Boolean).join(" | ");
}

function buildHeroHeadlineDraft(record, strategyContract) {
  const name = cleanString(strategyContract.business_context.business_name);
  const area = cleanString(record.city_or_service_area_input);
  const offer = cleanList(inferOfferings(record, strategyContract))[0];

  if (offer && area) {
    return offer + " in " + area;
  }

  if (offer) return offer;
  if (name) return "Welcome to " + name;

  return "";
}

function buildHeroSubheadlineDraft(record, strategyContract) {
  const audience = cleanString(strategyContract.audience_model.primary_persona);
  const cta = cleanString(strategyContract.conversion_strategy.cta_text);

  return [
    audience ? "Built for " + audience : "",
    cta ? "with a clear path to " + cta.toLowerCase() : ""
  ].filter(Boolean).join(" ");
}

function buildAboutSummaryDraft(record, strategyContract) {
  const name = cleanString(strategyContract.business_context.business_name);
  const offer = cleanList(inferOfferings(record, strategyContract))[0];
  const area = cleanString(record.city_or_service_area_input);

  return [
    name ? name + " is" : "This business is",
    offer ? "focused on " + offer.toLowerCase() : "focused on delivering a strong customer experience",
    area ? "in " + area : "",
    "with a website designed to build trust and drive action."
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function collectSeedMissingInfo(strategyContract, answers) {
  const out = [];

  cleanList(strategyContract.content_requirements.must_verify_now).forEach(function(v) {
    out.push(v);
  });

  if (!cleanString(answers.booking_url)) out.push("booking_url");
  if (!cleanString(answers.phone)) out.push("phone");
  if (!cleanString(answers.pricing_context)) out.push("pricing_context");

  return uniqueList(out);
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

  return Object.keys(map).filter(function(key) {
    return Boolean(schemaToggles?.[key]);
  }).map(function(key) {
    return map[key];
  });
}

/* --------------------------------
   UTILITIES
-------------------------------- */

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
  next.slug = cleanString(next.slug);
  next.phase = cleanString(next.phase) || "guided_enrichment";

  return next;
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

function safeParse(value) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return {};
  }
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function cleanString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function(v) {
    return typeof v === "string" ? v.trim() : "";
  }).filter(Boolean);
}

function uniqueList(arr) {
  return Array.from(new Set(cleanList(arr)));
}

function numberOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "session_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}