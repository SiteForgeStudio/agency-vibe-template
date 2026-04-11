// functions/api/intake-complete.js
/**
 * SiteForge Factory — Paid Intake Complete (V2)
 *
 * ROLE:
 * - gate on V2 readiness + enrichment
 * - assemble schema-valid business_json from V2 intake state
 * - preserve deterministic image query / gallery logic
 * - optionally submit to /api/submit
 */

import {
  SCHEMA_VIBES,
  selectVibe,
  buildHeroImageQuery,
  buildFallbackGalleryQueries,
  inferPremiumGalleryCount,
  galleryLayoutFromSignals,
  assertFactorySynthesisGuards
} from "../utils/factory-synthesis.js";

const ALLOWED_MENU_PATHS = [
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
];

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

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const state = normalizeState(body.state || {});
    const action = cleanString(body.action || state.action || "");

    if (!cleanString(state.slug)) {
      return json({ ok: false, error: "Missing state.slug" }, 400);
    }

    const strategyContract = getStrategyContract(state);
    if (!strategyContract) {
      return json({ ok: false, error: "Missing strategy_contract in state" }, 400);
    }

    state.readiness = evaluateNarrativeReadiness(state);
    state.enrichment = evaluateEnrichment(state);

    if (!state.readiness.can_generate_now) {
      return json(
        {
          ok: false,
          error: "intake_not_ready",
          message: "Narrative unlock is not complete yet.",
          readiness: state.readiness,
          enrichment: state.enrichment
        },
        400
      );
    }

    if (!state.enrichment.ready_for_preview) {
      return json(
        {
          ok: false,
          error: "premium_enrichment_incomplete",
          message: "Narrative is clear, but premium enrichment is not strong enough for final preview assembly yet.",
          readiness: state.readiness,
          enrichment: state.enrichment
        },
        400
      );
    }

    const strategyBrief = buildStrategyBrief(state, strategyContract);
    let businessJson = buildBusinessJson(state, strategyContract, strategyBrief);
    businessJson = ensureInspirationQueries(businessJson, state, strategyContract);
    assertFactorySynthesisGuards(businessJson);

    const validation = validateBusinessJson(businessJson);

    if (!validation.ok) {
      return json(
        {
          ok: false,
          error: "business_json_validation_failed",
          issues: validation.issues,
          strategy_brief: strategyBrief,
          business_json: businessJson
        },
        400
      );
    }

    const payload = {
      ok: true,
      slug: cleanString(state.slug),
      readiness: state.readiness,
      enrichment: state.enrichment,
      strategy_brief: strategyBrief,
      business_json: businessJson,
      business_base_json: businessJson
    };

    if (action === "complete") {
      payload.submit = await trySubmitBusinessJson(context.request, {
        business_json: businessJson,
        client_email: cleanString(state.clientEmail) || cleanString(businessJson?.brand?.email)
      });
    }

    return json(payload);
  } catch (err) {
    console.error("[intake-complete]", err);
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
    endpoint: "intake-complete",
    method: "POST"
  });
}

/* =========================
   Strategy Brief
========================= */

function buildStrategyBrief(state, strategyContract) {
  return {
    business_name: cleanString(state.businessName),
    slug: cleanString(state.slug),
    category: cleanString(strategyContract.business_context?.category),
    strategic_archetype: cleanString(strategyContract.business_context?.strategic_archetype),
    one_page_fit: cleanString(strategyContract.business_context?.one_page_fit),
    primary_conversion: cleanString(strategyContract.conversion_strategy?.primary_conversion),
    secondary_conversion: cleanString(strategyContract.conversion_strategy?.secondary_conversion),
    conversion_mode: cleanString(strategyContract.conversion_strategy?.conversion_mode),
    audience: cleanString(state.answers?.audience),
    primary_offer: cleanString(state.answers?.primary_offer),
    service_area: cleanString(state.answers?.service_area),
    trust_signal: cleanString(state.answers?.trust_signal),
    differentiation: cleanString(state.answers?.differentiation),
    recommended_vibe: cleanString(strategyContract.visual_strategy?.recommended_vibe),
    schema_toggles: isObject(strategyContract.schema_toggles) ? strategyContract.schema_toggles : {},
    asset_policy: isObject(strategyContract.asset_policy) ? strategyContract.asset_policy : {},
    copy_policy: isObject(strategyContract.copy_policy) ? strategyContract.copy_policy : {}
  };
}

/* =========================
   Main Assembly
========================= */

function buildBusinessJson(state, strategyContract, strategyBrief) {
  const businessName =
    cleanString(state.businessName) ||
    cleanString(strategyContract.business_context?.business_name) ||
    "Business Name";

  const slug = cleanString(state.slug) || normalizeSlug(businessName);
  const email =
    cleanString(state.clientEmail) ||
    cleanString(state.answers?.email) ||
    "contact@example.com";

  const phone = cleanString(state.answers?.phone);
  const bookingUrl = cleanString(state.answers?.booking_url);
  const officeAddress = cleanString(state.answers?.office_address);

  const category = cleanString(strategyContract.business_context?.category) || "Service business";
  const targetAudience =
    cleanString(state.answers?.audience) ||
    cleanString(strategyContract.audience_model?.primary_persona) ||
    "Customers seeking a trusted provider";

  const tone =
    cleanString(state.answers?.tone_of_voice) ||
    inferTone(strategyContract) ||
    "Professional, clear, trustworthy";

  const vibe = selectVibe(SCHEMA_VIBES, strategyContract, state);

  const trustbar = buildTrustbar(state, strategyContract);
  const features = buildFeatures(state, strategyContract);
  const processSteps = buildProcessSteps(state);
  const gallery = buildGallery(state, strategyContract, vibe);
  const testimonials = buildTestimonials(state, strategyContract);
  const faqs = buildFaqs(state, strategyContract);
  const serviceArea = buildServiceArea(state, strategyContract);

  const toggles = {
    show_trustbar: Boolean(strategyContract.schema_toggles?.show_trustbar) && Boolean(trustbar),
    show_about: Boolean(strategyContract.schema_toggles?.show_about ?? true),
    show_features: Boolean(strategyContract.schema_toggles?.show_features ?? true),
    show_events: false,
    show_process: processSteps.length >= 3,
    show_testimonials: Boolean(strategyContract.schema_toggles?.show_testimonials ?? true) && testimonials.length > 0,
    show_comparison: false,
    show_gallery: Boolean(strategyContract.schema_toggles?.show_gallery ?? true) && Boolean(gallery),
    show_investment: false,
    show_faqs: Boolean(strategyContract.schema_toggles?.show_faqs ?? true) && faqs.length > 0,
    show_service_area: Boolean(strategyContract.schema_toggles?.show_service_area ?? true) && Boolean(serviceArea)
  };

  const sections = {
    about: true,
    features,
    processSteps,
    testimonials,
    gallery,
    faqs,
    service_area: serviceArea
  };

  return {
    intelligence: {
      industry: normalizePublicText(category),
      target_persona: normalizePublicText(targetAudience),
      tone_of_voice: normalizePublicText(tone)
    },

    strategy: toggles,

    settings: {
      vibe,
      menu: buildMenu(toggles, sections),
      cta_text: normalizePublicText(
        cleanString(state.answers?.cta_text) ||
        inferPrimaryCtaText(strategyContract, bookingUrl)
      ),
      cta_link: bookingUrl || cleanString(state.answers?.cta_link) || "#contact",
      cta_type: bookingUrl ? "external" : inferCtaType(cleanString(state.answers?.cta_link) || "#contact"),
      secondary_cta_text: normalizePublicText(inferSecondaryCtaText(strategyContract, phone)),
      secondary_cta_link: inferSecondaryCtaLink(phone, bookingUrl)
    },

    brand: {
      name: normalizePublicText(businessName),
      slug,
      tagline: normalizePublicText(resolveTagline(state, strategyContract, businessName)),
      email,
      phone,
      office_address: normalizePublicText(officeAddress),
      objection_handle: normalizePublicText(resolveObjectionHandle(state, strategyContract))
    },

    hero: {
      headline: normalizePublicText(resolveHeroHeadline(state, businessName)),
      subtext: normalizePublicText(resolveHeroSubtext(state, strategyContract)),
      image: {
        alt: normalizePublicText(resolveHeroImageAlt(state, businessName)),
        image_search_query: buildHeroImageQuery(state, strategyContract, vibe)
      }
    },

    about: {
      story_text: normalizePublicText(resolveAboutStory(state, businessName)),
      founder_note: normalizePublicText(resolveFounderNote(state)),
      years_experience: normalizePublicText(resolveYearsExperience(state, strategyContract))
    },

    ...(trustbar ? { trustbar } : {}),
    features,
    ...(processSteps.length ? { processSteps } : {}),
    ...(gallery ? { gallery } : {}),

    contact: {
      headline: "Get in Touch",
      subheadline: normalizePublicText(resolveContactSubheadline(state, strategyContract)),
      email,
      phone,
      email_recipient: email,
      button_text: normalizePublicText(inferContactButtonText(strategyContract, bookingUrl)),
      office_address: normalizePublicText(officeAddress)
    },

    ...(serviceArea ? { service_area: serviceArea } : {}),
    ...(testimonials.length ? { testimonials } : {}),
    ...(faqs.length ? { faqs } : {})
  };
}

/* =========================
   Section Builders
========================= */

function buildMenu(toggles, sections) {
  const items = [{ label: "Home", path: "#home" }];

  if (toggles.show_about && sections.about) items.push({ label: "About", path: "#about" });
  if (toggles.show_features && Array.isArray(sections.features) && sections.features.length) {
    items.push({ label: "Services", path: "#features" });
  }
  if (toggles.show_process && Array.isArray(sections.processSteps) && sections.processSteps.length >= 3) {
    items.push({ label: "Process", path: "#process" });
  }
  if (toggles.show_testimonials && Array.isArray(sections.testimonials) && sections.testimonials.length) {
    items.push({ label: "Reviews", path: "#testimonials" });
  }
  if (toggles.show_gallery && sections.gallery && Array.isArray(sections.gallery.items) && sections.gallery.items.length) {
    items.push({ label: "Gallery", path: "#gallery" });
  }
  if (toggles.show_faqs && Array.isArray(sections.faqs) && sections.faqs.length) {
    items.push({ label: "FAQ", path: "#faqs" });
  }
  if (toggles.show_service_area && sections.service_area && cleanString(sections.service_area.main_city)) {
    items.push({ label: "Area", path: "#service-area" });
  }

  items.push({ label: "Contact", path: "#contact" });

  return items
    .filter((item) => ALLOWED_MENU_PATHS.includes(item.path))
    .slice(0, 8);
}

function buildTrustbar(state, strategyContract) {
  const trustSeeds = uniqueList([
    cleanString(state.answers?.trust_signal),
    ...cleanList(strategyContract.proof_model?.trust_signals),
    ...cleanList(strategyContract.proof_model?.credibility_sources)
  ]).slice(0, 4);

  const items = trustSeeds
    .map((label, idx) => {
      const normalized = normalizeTrustbarLabel(label);
      if (!normalized) return null;
      return {
        label: normalizePublicText(normalized),
        icon: pickTrustbarIcon(label, idx)
      };
    })
    .filter(Boolean);

  if (items.length < 2) {
    items.push(
      { label: "Trusted Service", icon: "shield" },
      { label: "Customer Focused", icon: "heart" }
    );
  }

  return items.length ? { enabled: true, items: items.slice(0, 4) } : null;
}

function buildFeatures(state, strategyContract) {
  const features = [];
  const primaryOffer = cleanString(state.answers?.primary_offer);
  const differentiation = cleanString(state.answers?.differentiation);
  const serviceDescriptions = cleanString(state.answers?.service_descriptions);
  const decisionFactors = cleanList(state.answers?.buyer_decision_factors);
  const contractDecisionFactors = cleanList(strategyContract.audience_model?.decision_factors);

  const serviceBullets = inferServiceBullets(primaryOffer, serviceDescriptions, strategyContract);
  for (const bullet of serviceBullets) {
    features.push({
      title: normalizePublicText(bullet.title),
      description: normalizePublicText(bullet.description),
      icon_slug: pickFeatureIcon(`${bullet.title} ${bullet.description}`, features.length)
    });
  }

  if (differentiation) {
    features.push({
      title: normalizePublicText(normalizeDifferentiatorTitle(differentiation)),
      description: normalizePublicText(cleanSentence(differentiation)),
      icon_slug: pickFeatureIcon(differentiation, features.length)
    });
  }

  const factors = uniqueList([...decisionFactors, ...contractDecisionFactors]).slice(0, 2);
  for (const factor of factors) {
    const mapped = mapDecisionFactorToFeature(factor);
    if (!mapped) continue;
    features.push({
      title: normalizePublicText(mapped.title),
      description: normalizePublicText(mapped.description),
      icon_slug: pickFeatureIcon(`${mapped.title} ${mapped.description}`, features.length)
    });
  }

  const deduped = uniqueObjectsByTitle(features).slice(0, 6);

  while (deduped.length < 3) {
    deduped.push({
      title: `Service Highlight ${deduped.length + 1}`,
      description: "Clear, professional work designed to make the next step easy.",
      icon_slug: pickFeatureIcon("", deduped.length)
    });
  }

  return deduped;
}

function buildProcessSteps(state) {
  const source = cleanString(state.answers?.process_notes);
  const steps = extractProcessSteps(source);

  if (steps.length < 3) return [];

  return steps.slice(0, 5).map((step, idx) => ({
    title: normalizePublicText(step.title || inferProcessStepTitle(step.description, idx)),
    description: normalizePublicText(cleanSentence(step.description))
  }));
}

function buildGallery(state, strategyContract, vibe) {
  const explicitQueries = cleanList(state.answers?.gallery_queries);
  const explicitItems = Array.isArray(state.answers?.gallery_items) ? state.answers.gallery_items : [];

  let items = explicitItems
    .map((item, idx) => {
      if (!isObject(item)) return null;
      const query = clampWords(cleanString(item.image_search_query), 4, 8);
      if (!query) return null;
      return {
        title: normalizePublicText(cleanString(item.title) || `Project ${idx + 1}`),
        image_search_query: query
      };
    })
    .filter(Boolean);

  if (!items.length && explicitQueries.length) {
    items = explicitQueries.map((query, idx) => ({
      title: `Project ${idx + 1}`,
      image_search_query: clampWords(query, 4, 8)
    }));
  }

  const fallback = buildFallbackGalleryQueries(state, strategyContract, vibe);
  if (!items.length && !fallback.length) return null;
  if (!items.length) {
    items = fallback.map((query, idx) => ({
      title: galleryTitleFromQuery(query, idx),
      image_search_query: query
    }));
  }

  const normalized = normalizeGalleryShape(
    {
      enabled: true,
      items,
      image_source: { image_search_query: items[0]?.image_search_query || "" }
    },
    true,
    strategyContract,
    vibe,
    state
  );

  return normalized;
}

function buildFaqs(state, strategyContract) {
  const topics = uniqueList([
    ...cleanList(state.answers?.common_objections),
    ...cleanList(state.answers?.buyer_decision_factors),
    ...cleanList(state.answers?.faq_topics),
    ...cleanList(state.answers?.faq_angles),
    ...cleanList(strategyContract.site_structure?.faq_angles),
    ...cleanList(strategyContract.audience_model?.common_objections),
    ...cleanList(strategyContract.audience_model?.decision_factors)
  ])
    .map((item) => normalizeFaqQuestion(item))
    .filter(Boolean)
    .slice(0, 6);

  return topics.map((question) => ({
    question: ensureQuestion(normalizePublicText(question)),
    answer: normalizePublicText(inferFaqAnswer(question, state, strategyContract))
  }));
}

function buildTestimonials(state, strategyContract) {
  const provided =
    Array.isArray(state.answers?.testimonials) ? state.answers.testimonials :
    Array.isArray(state.ghostwritten?.testimonials) ? state.ghostwritten.testimonials :
    [];

  const normalized = provided
    .map((item, idx) => {
      if (typeof item === "string") {
        return {
          quote: normalizePublicText(item),
          author: `Happy Client ${idx + 1}`
        };
      }
      if (!isObject(item)) return null;
      const quote = cleanString(item.quote);
      const author = cleanString(item.author) || `Happy Client ${idx + 1}`;
      if (!quote) return null;
      return {
        quote: normalizePublicText(quote),
        author: normalizePublicText(author)
      };
    })
    .filter(Boolean);

  if (normalized.length) return normalized.slice(0, 3);

  const status = cleanString(state.answers?.testimonials_status).toLowerCase();
  if (status.includes("not yet")) return [];

  const praise = inferPraiseThemes(state, strategyContract);

  return praise.slice(0, 2).map((theme, idx) => ({
    quote: normalizePublicText(theme),
    author: `Happy Client ${idx + 1}`
  }));
}

function buildServiceArea(state, strategyContract) {
  const mainCity =
    cleanString(state.answers?.service_area) ||
    cleanList(strategyContract.business_context?.service_area)[0] ||
    cleanList(strategyContract.source_snapshot?.nap_recommendation?.service_area)[0];

  if (!mainCity) return null;

  return {
    main_city: normalizePublicText(mainCity),
    surrounding_areas: uniqueList([
      ...cleanList(state.answers?.service_areas),
      ...cleanList(strategyContract.business_context?.service_area),
      ...cleanList(strategyContract.source_snapshot?.nap_recommendation?.service_area)
    ])
      .filter((value) => value && value !== mainCity)
      .map((value) => normalizePublicText(value))
      .slice(0, 6)
  };
}

/* =========================
   Hero / Copy Resolution
========================= */

function resolveTagline(state, strategyContract, businessName) {
  return (
    cleanString(state.answers?.tagline) ||
    cleanString(strategyContract.source_snapshot?.primary_offer_hint) ||
    cleanString(state.answers?.primary_offer) ||
    businessName
  );
}

function resolveHeroHeadline(state, businessName) {
  return (
    cleanString(state.ghostwritten?.hero_headline) ||
    cleanString(state.answers?.hero_headline) ||
    cleanString(state.answers?.primary_offer) ||
    businessName
  );
}

function resolveHeroSubtext(state, strategyContract) {
  return (
    cleanString(state.ghostwritten?.hero_subheadline) ||
    cleanString(state.answers?.hero_subheadline) ||
    buildPremiumHeroSubtext(state, strategyContract)
  );
}

function buildPremiumHeroSubtext(state, strategyContract) {
  const audience = cleanString(state.answers?.audience);
  const area = cleanString(state.answers?.service_area);
  const differentiation = cleanString(state.answers?.differentiation);
  const bookingMethod = cleanString(state.answers?.booking_method);

  const sentenceA = differentiation
    ? cleanSentenceFragment(differentiation)
    : cleanSentenceFragment(cleanString(state.answers?.website_direction));

  const sentenceB = audience && area
    ? `Serving ${area} for ${audience}.`
    : area
      ? `Serving ${area}.`
      : audience
        ? `Designed for ${audience}.`
        : "";

  const sentenceC =
    bookingMethod.includes("quote")
      ? "Request a quote and we’ll guide you from there."
      : bookingMethod.includes("call")
        ? "Reach out directly and we’ll help you get started."
        : "Reach out and we’ll help you take the next step.";

  return [sentenceA, sentenceB, sentenceC]
    .filter(Boolean)
    .map(cleanSentence)
    .join(" ");
}

function resolveHeroImageAlt(state, businessName) {
  return (
    cleanString(state.answers?.hero_image_alt) ||
    cleanString(state.answers?.primary_offer) ||
    businessName
  );
}

function resolveAboutStory(state, businessName) {
  return (
    cleanString(state.answers?.business_understanding) ||
    cleanString(state.answers?.about_story) ||
    `${businessName} is built around clear communication, reliable service, and a better customer experience.`
  );
}

function resolveFounderNote(state) {
  return (
    cleanString(state.answers?.founder_bio) ||
    "Built for people who value quality, clarity, and a smooth process."
  );
}

function resolveYearsExperience(state, strategyContract) {
  return (
    normalizeYearsExperience(cleanString(state.answers?.experience_years)) ||
    normalizeYearsExperience(cleanString(strategyContract.business_context?.years_experience)) ||
    "Experienced professional service"
  );
}

function resolveContactSubheadline(state, strategyContract) {
  return (
    cleanString(state.answers?.contact_subheadline) ||
    inferContactSubheadline(state, strategyContract)
  );
}

function resolveObjectionHandle(state, strategyContract) {
  const first =
    cleanString(cleanList(state.answers?.common_objections)[0]).toLowerCase() ||
    cleanString(cleanList(strategyContract.audience_model?.common_objections)[0]).toLowerCase();

  if (first.includes("cost") || first.includes("price")) {
    return "Clear quotes and honest expectations from the start.";
  }
  if (first.includes("trust") || first.includes("reputation")) {
    return "Clear communication and dependable service you can feel good about.";
  }
  if (first.includes("availability") || first.includes("schedule")) {
    return "Responsive scheduling and dependable follow-through.";
  }

  return "Clear communication, dependable service, and quality work.";
}

/* =========================
   Image Logic
========================= */

function ensureInspirationQueries(data, state, strategyContract) {
  const resolvedVibe = cleanString(data?.settings?.vibe);

  if (!data?.hero?.image?.image_search_query) {
    data.hero.image.image_search_query = buildHeroImageQuery(state, strategyContract, resolvedVibe);
  }

  if (data?.strategy?.show_gallery) {
    data.gallery = data.gallery || { enabled: true, items: [] };
    data.gallery.enabled = true;

    if (!Array.isArray(data.gallery.items)) data.gallery.items = [];

    const count = Number(
      data.gallery.computed_count ||
      data.gallery.items.length ||
      inferPremiumGalleryCount(strategyContract, state, resolvedVibe)
    );

    const fallbackQueries = buildFallbackGalleryQueries(
      state,
      strategyContract,
      resolvedVibe
    );

    while (data.gallery.items.length < count) {
      const idx = data.gallery.items.length;
      data.gallery.items.push({
        title: `Project ${idx + 1}`,
        image_search_query: fallbackQueries[idx % fallbackQueries.length] || "professional service detail photography"
      });
    }

    data.gallery.items = data.gallery.items.map((it, i) => {
      const title = String(it?.title || galleryTitleFromQuery(it?.image_search_query, i));
      const q = String(it?.image_search_query || "").trim();
      const fallback = fallbackQueries[i % fallbackQueries.length] || "professional service detail photography";

      return {
        ...it,
        title,
        image_search_query: clampWords(q || fallback, 4, 8)
      };
    });

    if (!isObject(data.gallery.image_source)) {
      data.gallery.image_source = {};
    }

    if (!cleanString(data.gallery.image_source.image_search_query)) {
      data.gallery.image_source.image_search_query =
        data.gallery.items[0]?.image_search_query ||
        fallbackQueries[0] ||
        "professional service lifestyle photography";
    }
  } else if (data.gallery) {
    data.gallery.enabled = Boolean(data.gallery.enabled);
  }

  return data;
}

/* =========================
   Validation
========================= */

function validateBusinessJson(data) {
  const issues = [];

  const reqTop = ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"];
  for (const key of reqTop) {
    if (!data?.[key]) issues.push(`Missing top-level "${key}"`);
  }

  for (const key of ["industry", "target_persona", "tone_of_voice"]) {
    if (!cleanString(data?.intelligence?.[key])) issues.push(`Missing intelligence.${key}`);
  }

  if (!SCHEMA_VIBES.includes(cleanString(data?.settings?.vibe))) {
    issues.push("settings.vibe must be one of allowed enum values");
  }

  for (const key of ["cta_text", "cta_link", "cta_type"]) {
    if (!cleanString(data?.settings?.[key])) issues.push(`Missing settings.${key}`);
  }

  if (!Array.isArray(data?.settings?.menu) || !data.settings.menu.length) {
    issues.push("settings.menu must be a non-empty array");
  } else {
    data.settings.menu.forEach((item, idx) => {
      if (!cleanString(item?.label)) issues.push(`settings.menu[${idx}].label missing`);
      if (!ALLOWED_MENU_PATHS.includes(cleanString(item?.path))) {
        issues.push(`settings.menu[${idx}].path invalid: ${item?.path}`);
      }
    });
  }

  for (const key of ["name", "tagline", "email"]) {
    if (!cleanString(data?.brand?.[key])) issues.push(`Missing brand.${key}`);
  }

  for (const key of ["headline", "subtext"]) {
    if (!cleanString(data?.hero?.[key])) issues.push(`Missing hero.${key}`);
  }

  if (!cleanString(data?.hero?.image?.alt)) issues.push("Missing hero.image.alt");
  if (!cleanString(data?.hero?.image?.image_search_query)) issues.push("Missing hero.image.image_search_query");

  for (const key of ["story_text", "founder_note", "years_experience"]) {
    if (!cleanString(data?.about?.[key])) issues.push(`Missing about.${key}`);
  }

  if (!Array.isArray(data?.features) || data.features.length < 3) {
    issues.push("features must be an array with at least 3 items");
  } else {
    data.features.forEach((item, idx) => {
      for (const key of ["title", "description", "icon_slug"]) {
        if (!cleanString(item?.[key])) issues.push(`features[${idx}].${key} missing`);
      }
      if (!ALLOWED_ICON_TOKENS.includes(cleanString(item?.icon_slug))) {
        issues.push(`features[${idx}].icon_slug invalid: ${item?.icon_slug}`);
      }
    });
  }

  for (const key of ["headline", "subheadline", "email_recipient", "button_text"]) {
    if (!cleanString(data?.contact?.[key])) issues.push(`Missing contact.${key}`);
  }

  if (data?.strategy?.show_gallery) {
    if (!data?.gallery?.enabled) issues.push("strategy.show_gallery=true but gallery.enabled is not true");
    if (!Array.isArray(data?.gallery?.items) || !data.gallery.items.length) {
      issues.push("gallery.items must be a non-empty array when gallery enabled");
    } else {
      data.gallery.items.forEach((item, idx) => {
        if (!cleanString(item?.title)) issues.push(`gallery.items[${idx}].title missing`);
        if (!cleanString(item?.image_search_query)) issues.push(`gallery.items[${idx}].image_search_query missing`);
      });
    }
  }

  if (data?.trustbar) {
    if (typeof data.trustbar.enabled !== "boolean") issues.push("trustbar.enabled must be boolean");
    if (!Array.isArray(data.trustbar.items) || data.trustbar.items.length < 2) {
      issues.push("trustbar.items must have 2+ items when trustbar exists");
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

/* =========================
   Readiness / V2 Gating
========================= */

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
  return {
    score: Number((satisfiedBlocks.length / total).toFixed(2)),
    can_generate_now: remainingBlocks.length === 0,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks
  };
}

function evaluateEnrichment(state) {
  const category = getCategory(state);
  const model = getNarrativeModel(category);

  const satisfiedBlocks = [];
  const remainingBlocks = [];

  for (const block of model.premium_enrichment) {
    if (isBlockSatisfied(state, block)) satisfiedBlocks.push(block);
    else remainingBlocks.push(block);
  }

  const total = model.premium_enrichment.length || 1;
  return {
    score: Number((satisfiedBlocks.length / total).toFixed(2)),
    ready_for_preview: remainingBlocks.length <= model.preview_tolerance,
    remaining_blocks: remainingBlocks,
    satisfied_blocks: satisfiedBlocks
  };
}

function getNarrativeModel(category) {
  const models = {
    service: {
      must_express: ["what_it_is", "who_its_for", "why_trust_it", "what_to_do_next"],
      premium_enrichment: ["differentiation", "service_specificity", "process_clarity", "proof_depth", "faq_substance"],
      preview_tolerance: 1
    },
    event: {
      must_express: ["what_it_is", "who_its_for", "when_where", "what_to_do_next"],
      premium_enrichment: ["agenda_or_format", "urgency_or_reason_now", "proof_depth", "faq_substance"],
      preview_tolerance: 1
    },
    coach: {
      must_express: ["what_it_is", "who_its_for", "transformation", "what_to_do_next"],
      premium_enrichment: ["method_clarity", "proof_depth", "offer_specificity", "faq_substance"],
      preview_tolerance: 1
    },
    portfolio: {
      must_express: ["what_it_is", "who_its_for", "proof_of_quality", "what_to_do_next"],
      premium_enrichment: ["style_or_positioning", "projects_or_examples", "process_clarity", "about_depth"],
      preview_tolerance: 1
    }
  };

  return models[category] || models.service;
}

const BLOCK_MAP = {
  what_it_is: ["primary_offer", "business_understanding", "website_direction"],
  who_its_for: ["audience"],
  why_trust_it: ["trust_signal", "testimonials_status", "photos_status"],
  what_to_do_next: ["contact_path", "booking_method", "cta_text", "cta_link"],
  when_where: ["service_area", "service_areas", "hours"],
  transformation: ["primary_offer", "differentiation"],
  proof_of_quality: ["trust_signal", "testimonials_status", "photos_status", "gallery_queries"],

  differentiation: ["differentiation"],
  service_specificity: ["service_descriptions"],
  process_clarity: ["process_notes"],
  proof_depth: ["testimonials_status", "photos_status", "trust_signal"],
  faq_substance: ["common_objections", "buyer_decision_factors", "faq_angles"],
  agenda_or_format: ["service_descriptions", "process_notes"],
  urgency_or_reason_now: ["peak_season_availability", "hours"],
  method_clarity: ["process_notes", "service_descriptions"],
  offer_specificity: ["pricing_structure", "service_descriptions"],
  style_or_positioning: ["differentiation", "website_direction"],
  projects_or_examples: ["gallery_queries", "photos_status"],
  about_depth: ["founder_bio"]
};

function isBlockSatisfied(state, block) {
  const fields = BLOCK_MAP[block] || [];
  return fields.some((field) => hasMeaningfulValue(state.answers[field]));
}

/* =========================
   Submit
========================= */

async function trySubmitBusinessJson(request, payload) {
  const url = new URL(request.url);
  const submitUrl = `${url.origin}/api/submit`;

  const res = await fetch(submitUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    response: parsed
  };
}

/* =========================
   Premium Builders
========================= */

function inferServiceBullets(primaryOffer, serviceDescriptions, strategyContract) {
  const bullets = [];
  const offer = cleanString(primaryOffer).toLowerCase();
  const descriptions = cleanString(serviceDescriptions).toLowerCase();
  const category = cleanString(strategyContract.business_context?.category).toLowerCase();

  if (offer.includes("window cleaning") || category.includes("window")) {
    bullets.push(
      {
        title: "Exterior Window Cleaning",
        description: "Detailed cleaning designed to leave large glass surfaces clear, bright, and streak-free."
      },
      {
        title: "Glass Restoration",
        description: "Restore clarity and improve the look of weathered or hard-water-marked glass."
      },
      {
        title: "Premium Home Service",
        description: "Professional service for larger homes where detail, care, and presentation matter."
      }
    );
  }

  if (descriptions.includes("large homes") || descriptions.includes("big glass")) {
    bullets.push({
      title: "Large-Home Expertise",
      description: "Comfortable with larger residential properties, expansive glass, and high-visibility details."
    });
  }

  if (descriptions.includes("white-glove") || descriptions.includes("professionalism")) {
    bullets.push({
      title: "White-Glove Experience",
      description: "Clear communication, careful work practices, and a polished customer experience from start to finish."
    });
  }

  return uniqueObjectsByTitle(bullets);
}

function mapDecisionFactorToFeature(factor) {
  const value = cleanString(factor).toLowerCase();
  if (!value) return null;

  if (value.includes("quality")) {
    return {
      title: "Quality-First Results",
      description: "Every detail is handled carefully so the finished result looks clean, sharp, and consistent."
    };
  }
  if (value.includes("reputation") || value.includes("trust")) {
    return {
      title: "Trusted Service",
      description: "Built around professionalism, reliability, and a customer experience that feels easy to trust."
    };
  }
  if (value.includes("availability") || value.includes("respons")) {
    return {
      title: "Responsive Scheduling",
      description: "Clear communication and dependable follow-through make the process easier from the first inquiry."
    };
  }
  if (value.includes("pricing")) {
    return {
      title: "Clear Quotes",
      description: "Quotes are tailored to the scope of work so expectations feel straightforward and honest."
    };
  }
  return null;
}

function extractProcessSteps(text) {
  const raw = cleanString(text);
  if (!raw) return [];

  const normalized = raw
    .replace(/from first contact to finished result/gi, "")
    .replace(/\bthen\b/gi, " | ")
    .replace(/\band do a final walkthrough if needed\b/gi, " | final walkthrough")
    .replace(/\band\b/gi, " | ")
    .replace(/,/g, " | ")
    .replace(/\./g, " | ");

  const pieces = normalized
    .split(/\|/)
    .map((part) => cleanSentenceFragment(part))
    .filter(Boolean);

  const canonical = [];
  const seen = new Set();

  for (const piece of pieces) {
    const lower = piece.toLowerCase();

    const step =
      lower.includes("quote") ? { title: "Request a Quote", description: "Reach out with the details and get a quote based on the scope of work." } :
      lower.includes("scope") || lower.includes("confirm") ? { title: "Confirm the Scope", description: "Review the property, expectations, and any details that matter before the work begins." } :
      lower.includes("schedule") ? { title: "Schedule the Service", description: "Choose the right time and confirm the details so everything feels organized." } :
      lower.includes("clean") || lower.includes("work") ? { title: "Complete the Work", description: "Carry out the cleaning carefully with attention to detail and presentation." } :
      lower.includes("walkthrough") || lower.includes("final") ? { title: "Final Review", description: "Make sure the finished result looks right and the experience ends cleanly." } :
      null;

    if (step && !seen.has(step.title.toLowerCase())) {
      seen.add(step.title.toLowerCase());
      canonical.push(step);
    }
  }

  return canonical;
}

function inferPraiseThemes(state, strategyContract) {
  const status = cleanString(state.answers?.testimonials_status);
  const trust = cleanString(state.answers?.trust_signal);
  const differentiation = cleanString(state.answers?.differentiation);
  const businessName = cleanString(state.businessName) || "this team";

  const themes = [];

  if (status) {
    themes.push(`Clients consistently praise the professionalism, responsiveness, and finished results from working with ${businessName}.`);
  }

  if (trust) {
    themes.push(`Customers often mention ${trust.toLowerCase()} as a reason they felt confident choosing ${businessName}.`);
  }

  if (differentiation) {
    themes.push(`People appreciate the way ${businessName} combines careful work with a more polished, higher-trust customer experience.`);
  }

  if (!themes.length) {
    themes.push(
      `Professional, careful, and easy to work with from start to finish.`,
      `We chose ${businessName} because they felt trustworthy and professional from the first interaction.`
    );
  }

  return uniqueList(themes);
}

function galleryTitleFromQuery(query, idx) {
  const q = cleanString(query).toLowerCase();
  if (q.includes("before after")) return "Before & After";
  if (q.includes("detail")) return "Detail Work";
  if (q.includes("exterior")) return "Exterior Results";
  if (q.includes("lifestyle")) return "On-Site Service";
  if (q.includes("modern home")) return "Residential Project";
  return `Project ${idx + 1}`;
}

/* =========================
   Existing Helper Logic
========================= */

function getStrategyContract(state) {
  return isObject(state?.provenance?.strategy_contract)
    ? state.provenance.strategy_contract
    : null;
}

function getCategory(state) {
  const metaCategory = cleanString(state?.meta?.category).toLowerCase();
  if (metaCategory) return normalizeCategory(metaCategory);

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

function inferTone(strategyContract) {
  return cleanString(strategyContract?.source_snapshot?.client_preview?.sales_preview)
    ? "Premium, confident, trustworthy"
    : "";
}

function inferPrimaryCtaText(strategyContract, bookingUrl) {
  const primary = cleanString(strategyContract?.conversion_strategy?.primary_conversion);
  if (bookingUrl || primary === "book_now") return "Book Now";
  if (primary === "call_now") return "Call Now";
  if (primary === "request_quote" || primary === "submit_inquiry") return "Request Quote";
  return "Get Started";
}

function inferSecondaryCtaText(strategyContract, phone) {
  const secondary = cleanString(strategyContract?.conversion_strategy?.secondary_conversion);
  if (phone || secondary === "call_now") return "Call Now";
  if (secondary === "submit_inquiry") return "Send Inquiry";
  if (secondary === "request_quote") return "Request Quote";
  return "Learn More";
}

function inferSecondaryCtaLink(phone, bookingUrl) {
  if (phone) return "#contact";
  if (bookingUrl) return bookingUrl;
  return "#about";
}

function inferContactSubheadline(state, strategyContract) {
  const primary = cleanString(strategyContract?.conversion_strategy?.primary_conversion);
  if (primary === "call_now") return "Call today and we’ll help you figure out the best next step.";
  if (primary === "book_now") return "Ready to get started? Reach out and we’ll help you book the right next step.";
  return "Tell us what you need and we’ll help you with the right next step.";
}

function inferContactButtonText(strategyContract, bookingUrl) {
  const primary = cleanString(strategyContract?.conversion_strategy?.primary_conversion);
  if (bookingUrl || primary === "book_now") return "Book Now";
  if (primary === "call_now") return "Call Now";
  if (primary === "request_quote") return "Request Quote";
  return "Send Message";
}

function inferFaqAnswer(question, state, strategyContract) {
  const bookingMethod = cleanString(state.answers?.booking_method).toLowerCase();
  const serviceArea = cleanString(state.answers?.service_area);
  const pricing = cleanString(state.answers?.pricing_structure);
  const processNotes = cleanString(state.answers?.process_notes);
  const trust = cleanString(state.answers?.trust_signal);
  const lower = cleanString(question).toLowerCase();

  if (lower.includes("book") || lower.includes("schedule")) {
    if (bookingMethod.includes("book")) return "Use the booking link to choose the best next step and timing.";
    if (bookingMethod.includes("call")) return "Call directly and we’ll help you schedule the right next step.";
    if (bookingMethod.includes("quote")) return "Start with a quote request and we’ll help you confirm the scope before scheduling.";
    return "Reach out through the contact form and we’ll help guide you from there.";
  }

  if (lower.includes("area") || lower.includes("location")) {
    return serviceArea
      ? `We primarily serve ${serviceArea}. Reach out if you want to confirm your location.`
      : "Reach out to confirm service availability in your area.";
  }

  if (lower.includes("price") || lower.includes("cost")) {
    return pricing
      ? cleanSentence(pricing)
      : "Pricing depends on the scope of work, and we’ll help guide you to the right fit with a clear quote.";
  }

  if (lower.includes("trust")) {
    return trust
      ? `We focus on ${trust.toLowerCase()} and a professional customer experience so the service feels easy to trust.`
      : "We aim to make the experience feel clear, professional, and dependable from the first interaction.";
  }

  if (lower.includes("process")) {
    return processNotes
      ? "The process is designed to feel clear and well-managed, from the first quote request through the final result."
      : "We aim to keep the process clear, responsive, and easy from first contact to final follow-through.";
  }

  if (lower.includes("streak-free") || lower.includes("results")) {
    return "Attention to detail, careful technique, and a quality-first approach help deliver a cleaner final result.";
  }

  if (lower.includes("advance") || lower.includes("availability")) {
    return "Availability depends on the schedule and season, so reaching out early is the best way to lock in the timing you want.";
  }

  return "We keep the experience clear, helpful, and easy to understand.";
}

function normalizeGalleryShape(gallery, showGallery, strategyContract, vibe, state) {
  const gg = gallery || {};
  const enabled = Boolean(gg.enabled ?? showGallery);

  let items = Array.isArray(gg.items) ? gg.items : [];
  if (!Array.isArray(items) && Array.isArray(gg.images)) {
    items = gg.images.map((im, i) => ({
      title: im.title || im.alt || `Project ${i + 1}`,
      image_search_query: im.image_search_query || ""
    }));
  }

  const computed_layout =
    gg.computed_layout ||
    galleryLayoutFromSignals(strategyContract);

  const computed_count =
    gg.computed_count ||
    items.length ||
    inferPremiumGalleryCount(strategyContract, state, vibe);

  return {
    enabled,
    title: gg.title || "Gallery",
    layout: gg.layout ?? null,
    show_titles: gg.show_titles ?? true,
    image_source: isObject(gg.image_source) ? gg.image_source : { image_search_query: "" },
    computed_count: enabled ? computed_count : (gg.computed_count ?? null),
    computed_layout: enabled ? computed_layout : (gg.computed_layout ?? null),
    items
  };
}

function normalizeTrustbarLabel(label) {
  const value = cleanString(label).toLowerCase();
  if (!value) return "";

  if (value.includes("testimonial")) return "Trusted by Clients";
  if (value.includes("review")) return "Strong Reviews";
  if (value.includes("photo")) return "Proven Results";
  if (value.includes("experience")) return "Experienced Service";
  if (value.includes("referral")) return "Highly Recommended";
  if (value === "future_google_business_profile") return "Local Business Presence";
  if (value === "local_service_area_relevance") return "Local Service Focus";

  return normalizeShortTitle(label, 0);
}

function audienceToCustomerPhrase(audience) {
  const value = cleanString(audience).toLowerCase();
  if (!value) return "";
  if (value.includes("homeowner")) return "homeowners";
  if (value.includes("family")) return "families";
  if (value.includes("property manager")) return "property managers";
  if (value.includes("business")) return "businesses";
  if (value.includes("customer")) return "customers";
  if (value.includes("client")) return "clients";
  if (value.includes("people actively looking")) return "customers";
  if (value.includes("trustworthy provider")) return "customers";
  return cleanSentenceFragment(value);
}

function normalizeDifferentiatorTitle(item) {
  const value = cleanString(item).toLowerCase();
  if (!value) return "";
  if (value.includes("quality")) return "Quality Work";
  if (value.includes("availability") || value.includes("schedule")) return "Responsive Scheduling";
  if (value.includes("communication")) return "Clear Communication";
  if (value.includes("detail")) return "Attention to Detail";
  if (value.includes("professional")) return "Professional Experience";
  if (value.includes("trust") || value.includes("reputation")) return "Trusted Reputation";
  if (value.includes("white-glove")) return "White-Glove Service";
  return normalizeShortTitle(item, 0);
}

function normalizeFaqQuestion(text) {
  const value = cleanString(text).toLowerCase();
  if (!value) return "";
  if (value.includes("cost concern") || value === "cost concerns") return "How does pricing work?";
  if (value.includes("trustworth")) return "How do I know I can trust your service?";
  if (value.includes("availability")) return "How far in advance should I schedule?";
  return cleanString(text);
}

function normalizeYearsExperience(value) {
  const text = cleanString(value);
  if (!text) return "";
  if (/\byear/i.test(text)) return text;
  if (/^\d+$/.test(text)) return `${text} years of experience`;
  return text;
}

function normalizeShortTitle(text, idx) {
  const cleaned = cleanString(text)
    .replace(/[|,:;]+/g, " ")
    .replace(/\bspecializing in\b/gi, " ")
    .replace(/\bin\s+[A-Z][^,.]*$/g, "")
    .replace(/\b(and|the|a|an|of|for|with|who)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 5);
  return titleCaseSmart(words.join(" ")) || `Item ${idx + 1}`;
}

function pickTrustbarIcon(text, idx) {
  const value = cleanString(text).toLowerCase();
  if (value.includes("testimonial") || value.includes("review")) return "star";
  if (value.includes("trust") || value.includes("safe")) return "shield";
  if (value.includes("experience") || value.includes("award")) return "award";
  if (value.includes("referral") || value.includes("people")) return "users";
  if (value.includes("local") || value.includes("area")) return "map";
  return ["shield", "star", "award", "heart"][idx % 4];
}

function pickFeatureIcon(text, idx) {
  const value = cleanString(text).toLowerCase();
  if (value.includes("fast") || value.includes("speed")) return "zap";
  if (value.includes("team") || value.includes("people")) return "users";
  if (value.includes("local") || value.includes("area")) return "map";
  if (value.includes("trust") || value.includes("safe") || value.includes("reputation")) return "shield";
  if (value.includes("quality") || value.includes("award") || value.includes("detail")) return "award";
  if (value.includes("schedule") || value.includes("time")) return "clock";
  if (value.includes("glass") || value.includes("window")) return "sparkles";
  return ["sparkles", "award", "shield", "clock", "heart", "map"][idx % 6];
}

function inferCtaType(link) {
  return String(link || "").startsWith("#") ? "anchor" : "external";
}

function normalizeState(state) {
  const next = isObject(state) ? state : {};

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
    gallery_items: [],
    testimonials: [],
    peak_season_availability: "",
    ...((isObject(next.answers) ? next.answers : {}))
  };

  next.ghostwritten = isObject(next.ghostwritten) ? next.ghostwritten : {};
  next.provenance = isObject(next.provenance) ? next.provenance : {};
  next.meta = isObject(next.meta) ? next.meta : {};
  next.readiness = isObject(next.readiness) ? next.readiness : {};
  next.enrichment = isObject(next.enrichment) ? next.enrichment : {};

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
  next.answers.testimonials = Array.isArray(next.answers.testimonials) ? next.answers.testimonials : [];
  next.answers.gallery_items = Array.isArray(next.answers.gallery_items) ? next.answers.gallery_items : [];

  next.slug = cleanString(next.slug);
  next.businessName = cleanString(next.businessName);
  next.clientEmail = cleanString(next.clientEmail);

  return next;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function uniqueList(values) {
  return Array.from(new Set(cleanList(values)));
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (isObject(value)) return Object.values(value).some((item) => hasMeaningfulValue(item));
  return cleanString(String(value || "")) !== "";
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
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
  return /[.!?]$/.test(value) ? value : `${value}.`;
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

function titleCaseSmart(text) {
  return cleanString(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && ["and", "of", "for", "with", "to"].includes(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function uniqueObjectsByTitle(items) {
  const seen = new Set();
  return items.filter((item) => {
    const raw = cleanString(item?.title).toLowerCase();
    if (!raw) return false;
    if (seen.has(raw)) return false;
    seen.add(raw);
    return true;
  });
}

function ensureQuestion(text) {
  const q = cleanString(text);
  if (!q) return "What should I know?";
  return /[?]$/.test(q) ? q : `${q}?`;
}

function clampWords(text, min, max) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= max && words.length >= min) return words.join(" ");
  if (words.length > max) return words.slice(0, max).join(" ");
  const pad = ["photography", "professional", "high", "quality", "detail"];
  while (words.length < min && pad.length) words.push(pad.shift());
  return words.slice(0, max).join(" ");
}

function normalizeSlug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readJson(request) {
  const text = await request.text();
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}