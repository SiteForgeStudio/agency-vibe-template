// functions/api/intake-complete.js
/**
 * SiteForge Factory — Paid Intake Complete
 *
 * Outputs build-ready data:
 * - strategy_brief
 * - business.base.json
 * - final business payload
 *
 * IMPORTANT:
 * This file emits the RAW business JSON shape that your existing
 * generate.js normalizer/validator already expects.
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
    const action = cleanString(body.action || "");

    if (!cleanString(state.slug)) {
      return json({ ok: false, error: "Missing state.slug" }, 400);
    }

    const strategyContract = getStrategyContract(state);
    if (!strategyContract) {
      return json({ ok: false, error: "Missing strategy_contract in state" }, 400);
    }

    const verification = isObject(state.verification) ? state.verification : {};
    if (verification.queue_complete !== true) {
      return json(
        {
          ok: false,
          error: "verification_incomplete",
          message: "Please complete all required intake steps before generating the final payload.",
          verification,
          missing: cleanList(state.inference?.missing_information)
        },
        400
      );
    }

    const readiness = evaluateReadiness(state);
    state.readiness = readiness;

    if (!readiness.can_generate_now) {
      return json(
        {
          ok: false,
          error: "intake_not_ready",
          readiness,
          message: "We still need a few core details before building the final payload."
        },
        400
      );
    }

    const strategyBrief = buildStrategyBrief(state, strategyContract);
    const businessJson = buildRawBusinessJson(state, strategyContract, strategyBrief);
    const strategyMemory = buildStrategyMemory(state, strategyContract, strategyBrief, businessJson);
    const validation = validateRawBusinessJson(businessJson);

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
      readiness,
      strategy_brief: strategyBrief,
      strategy_memory: strategyMemory,
      business_json: businessJson,
      business_base_json: businessJson
    };

    if (action === "complete") {
      payload.submit = await trySubmitBusinessJson(context.request, {
        business_json: businessJson,
        client_email: cleanString(state.clientEmail)
      });
    }

    return json(payload);
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
    endpoint: "intake-complete",
    method: "POST"
  });
}

/* =========================
   Build Outputs
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
    target_audience: cleanString(state.answers?.target_audience),
    primary_offer: cleanList(state.answers?.offerings),
    service_area: cleanString(state.answers?.service_area),
    trust_signals: uniqueList([
      ...cleanList(state.answers?.trust_signals),
      ...cleanList(state.answers?.credibility_factors)
    ]),
    differentiators: cleanList(state.answers?.differentiators),
    faq_topics: uniqueList([
      ...cleanList(state.answers?.faq_topics),
      ...cleanList(state.answers?.common_objections),
      ...cleanList(strategyContract.site_structure?.faq_angles)
    ]),
    aeo_angles: cleanList(strategyContract.site_structure?.aeo_angles),
    recommended_vibe: cleanString(strategyContract.visual_strategy?.recommended_vibe),
    schema_toggles: isObject(strategyContract.schema_toggles)
      ? strategyContract.schema_toggles
      : {},
    asset_policy: isObject(strategyContract.asset_policy)
      ? strategyContract.asset_policy
      : {},
    copy_policy: isObject(strategyContract.copy_policy)
      ? strategyContract.copy_policy
      : {}
  };
}

function buildRawBusinessJson(state, strategyContract, strategyBrief) {
  const businessName =
    cleanString(state.businessName) ||
    cleanString(strategyContract.business_context?.business_name) ||
    "Business Name";

  const slug = cleanString(state.slug);
  const email = cleanString(state.clientEmail) || "contact@example.com";
  const phone = cleanString(state.answers?.phone);
  const bookingUrl = cleanString(state.answers?.booking_url);
  const officeAddress = cleanString(state.answers?.office_address);
  const serviceArea = cleanString(state.answers?.service_area);
  const targetAudience =
    cleanString(state.answers?.target_audience) ||
    cleanString(strategyContract.audience_model?.primary_persona) ||
    "Customers seeking a premium provider";

  const industry =
    cleanString(strategyContract.business_context?.category) || "Service business";

  const tone =
    cleanString(state.answers?.tone_preferences) ||
    cleanString(state.inference?.tone_direction) ||
    "Premium, confident, trustworthy";

  const vibe = resolveSchemaVibe(
    cleanString(strategyContract.visual_strategy?.recommended_vibe)
  );

  const ctaText =
    cleanString(strategyContract.conversion_strategy?.cta_text) || "Get Started";

  const ctaLink = bookingUrl || "#contact";
  const ctaType = bookingUrl ? "external" : "anchor";

  const toggles = {
    show_trustbar: Boolean(strategyContract.schema_toggles?.show_trustbar),
    show_about: Boolean(strategyContract.schema_toggles?.show_about),
    show_features: Boolean(strategyContract.schema_toggles?.show_features),
    show_events: false,
    show_process: Boolean(strategyContract.schema_toggles?.show_process),
    show_testimonials: Boolean(strategyContract.schema_toggles?.show_testimonials),
    show_comparison: false,
    show_gallery: Boolean(strategyContract.schema_toggles?.show_gallery),
    show_investment: false,
    show_faqs: Boolean(strategyContract.schema_toggles?.show_faqs),
    show_service_area: Boolean(strategyContract.schema_toggles?.show_service_area)
  };

  const heroQuery = buildHeroImageQuery(state, strategyContract);

  const trustbar = toggles.show_trustbar
    ? buildTrustbar(state, strategyContract)
    : undefined;

  const features = toggles.show_features
    ? buildFeatures(state, strategyContract)
    : [];

  const gallery = toggles.show_gallery
    ? buildGallery(state, strategyContract)
    : undefined;

  const faqs = toggles.show_faqs
    ? buildFaqs(state, strategyContract)
    : undefined;

  const testimonials = toggles.show_testimonials
    ? buildTestimonials(state, strategyContract)
    : undefined;

  const serviceAreaBlock = toggles.show_service_area
    ? buildServiceArea(state, strategyContract)
    : undefined;

  const events = undefined;
  const processSteps = buildProcessSteps(state, strategyContract);
  toggles.show_process = toggles.show_process || processSteps.length >= 3;
  const comparison = undefined;
  const investment = undefined;

  const sections = {
    about: true,
    features,
    events,
    processSteps,
    testimonials,
    comparison,
    gallery,
    investment,
    faqs,
    service_area: serviceAreaBlock
  };

  return {
    intelligence: {
      industry,
      target_persona: targetAudience,
      tone_of_voice: tone
    },

    strategy: toggles,

    settings: {
      vibe,
      menu: buildMenu(toggles, sections),
      cta_text: ctaText,
      cta_link: ctaLink,
      cta_type: ctaType,
      secondary_cta_text: inferSecondaryCtaText(strategyContract),
      secondary_cta_link: inferSecondaryCtaLink(phone, bookingUrl)
    },

    brand: {
      name: businessName,
      slug,
      tagline: inferBrandTagline(state, strategyContract),
      email,
      phone,
      office_address: officeAddress,
      objection_handle: inferObjectionHandle(state, strategyContract)
    },

    hero: {
      headline:
        cleanString(state.ghostwritten?.hero_headline) ||
        inferHeroHeadline(state, strategyContract),
      subtext:
        cleanString(state.ghostwritten?.hero_subheadline) ||
        inferHeroSubtext(state, strategyContract),
      image: {
        alt: inferHeroImageAlt(state, strategyContract),
        image_search_query: heroQuery
      }
    },

    about: {
      story_text:
        cleanString(state.ghostwritten?.about_summary) ||
        inferAboutStory(state, strategyContract),
      founder_note: inferFounderNote(state, strategyContract),
      years_experience: inferYearsExperience(state, strategyContract)
    },

    ...(trustbar ? { trustbar } : {}),

    features,

    ...(processSteps.length ? { processSteps } : {}),
    ...(gallery ? { gallery } : {}),

    contact: {
      headline: "Get in Touch",
      subheadline: inferContactSubheadline(state, strategyContract),
      email,
      phone,
      email_recipient: email,
      button_text: inferContactButtonText(strategyContract, bookingUrl),
      office_address: officeAddress
    },

    ...(serviceAreaBlock ? { service_area: serviceAreaBlock } : {}),
    ...(testimonials ? { testimonials } : {}),
    ...(faqs ? { faqs } : {})
  };
}

/* =========================
   Builders
========================= */

function buildMenu(toggles, sections) {
  const items = [{ label: "Home", path: "#home" }];

  const renderable = {
    about: Boolean(toggles?.show_about && sections?.about),
    features: Boolean(
      toggles?.show_features &&
      Array.isArray(sections?.features) &&
      sections.features.length
    ),
    events: Boolean(
      toggles?.show_events &&
      Array.isArray(sections?.events) &&
      sections.events.length >= 3
    ),
    process: Boolean(
      toggles?.show_process &&
      Array.isArray(sections?.processSteps) &&
      sections.processSteps.length >= 3
    ),
    testimonials: Boolean(
      toggles?.show_testimonials &&
      Array.isArray(sections?.testimonials) &&
      sections.testimonials.length
    ),
    comparison: Boolean(
      toggles?.show_comparison &&
      sections?.comparison &&
      Array.isArray(sections.comparison.items) &&
      sections.comparison.items.length
    ),
    gallery: Boolean(
      toggles?.show_gallery &&
      sections?.gallery &&
      Array.isArray(sections.gallery.items) &&
      sections.gallery.items.length
    ),
    investment: Boolean(
      toggles?.show_investment &&
      Array.isArray(sections?.investment) &&
      sections.investment.length
    ),
    faqs: Boolean(
      toggles?.show_faqs &&
      Array.isArray(sections?.faqs) &&
      sections.faqs.length
    ),
    serviceArea: Boolean(
      toggles?.show_service_area &&
      sections?.service_area &&
      cleanString(sections.service_area.main_city)
    )
  };

  if (renderable.about) items.push({ label: "About", path: "#about" });
  if (renderable.features) items.push({ label: "Services", path: "#features" });
  if (renderable.events) items.push({ label: "Events", path: "#events" });
  if (renderable.process) items.push({ label: "Process", path: "#process" });
  if (renderable.testimonials) items.push({ label: "Reviews", path: "#testimonials" });
  if (renderable.comparison) items.push({ label: "Why Us", path: "#comparison" });
  if (renderable.gallery) items.push({ label: "Gallery", path: "#gallery" });
  if (renderable.investment) items.push({ label: "Pricing", path: "#investment" });
  if (renderable.faqs) items.push({ label: "FAQ", path: "#faqs" });
  if (renderable.serviceArea) items.push({ label: "Area", path: "#service-area" });
  items.push({ label: "Contact", path: "#contact" });

  return items;
}

function buildTrustbar(state, strategyContract) {
  const trustSignals = uniqueList([
    ...cleanList(state.answers?.trust_signals),
    ...cleanList(state.answers?.credibility_factors),
    ...cleanList(strategyContract.site_structure?.trust_signals)
  ]).slice(0, 4);

  const items = trustSignals.map(function(label, idx) {
    return {
      label,
      icon: pickTrustbarIcon(label, idx)
    };
  });

  if (items.length < 2) {
    items.push(
      { label: "Trusted Service", icon: "shield" },
      { label: "Customer Focused", icon: "heart" }
    );
  }

  return {
    enabled: true,
    items: items.slice(0, 4)
  };
}

function buildProcessSteps(state, strategyContract) {
  const rawSteps = normalizeProcessStepSource(state.answers?.process_notes);
  if (rawSteps.length < 3) return [];

  return rawSteps.slice(0, 5).map(function(step, idx) {
    return {
      title: inferProcessStepTitle(step, idx),
      description: inferProcessStepDescription(step)
    };
  }).filter(function(step) {
    return cleanString(step.title) && cleanString(step.description);
  });
}

function normalizeProcessStepSource(input) {
  let steps = cleanList(input);

  if (steps.length === 1) {
    const expanded = splitProcessStepText(steps[0]);
    if (expanded.length > 1) steps = expanded;
  }

  return uniqueList(steps)
    .map(function(step) { return cleanString(step); })
    .filter(function(step) { return step.split(/\s+/).filter(Boolean).length >= 2; });
}

function splitProcessStepText(text) {
  return cleanString(text)
    .split(/\n|->|→|;|\.|, then | then /gi)
    .map(function(step) { return cleanString(step); })
    .filter(Boolean);
}

function inferProcessStepTitle(step, idx) {
  const text = cleanString(step);
  if (!text) return `Step ${idx + 1}`;

  const separatorMatch = text.match(/^([^:–—-]{3,48})\s*[:–—-]\s+(.+)$/);
  if (separatorMatch) {
    return toTitleCase(separatorMatch[1]);
  }

  const words = text.split(/\s+/).filter(Boolean);
  const titleWords = words.slice(0, Math.min(words.length, 4));
  return toTitleCase(titleWords.join(" ")) || `Step ${idx + 1}`;
}

function inferProcessStepDescription(step) {
  const text = cleanString(step);
  if (!text) return "";

  const separatorMatch = text.match(/^([^:–—-]{3,48})\s*[:–—-]\s+(.+)$/);
  if (separatorMatch) {
    return cleanSentence(separatorMatch[2]);
  }

  return cleanSentence(text);
}

function cleanSentence(text) {
  const value = cleanString(text).replace(/^[-–—\d.\s]+/, "");
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function toTitleCase(text) {
  return cleanString(text)
    .split(/\s+/)
    .filter(Boolean)
    .map(function(word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function buildFeatures(state, strategyContract) {
  const ghost = Array.isArray(state.ghostwritten?.features_copy)
    ? state.ghostwritten.features_copy
    : [];

  const offerings = cleanList(state.answers?.offerings);
  const differentiators = cleanList(state.answers?.differentiators);
  const trust = uniqueList([
    ...cleanList(state.answers?.trust_signals),
    ...cleanList(state.answers?.credibility_factors)
  ]);
  const decisionFactors = cleanList(state.answers?.buyer_decision_factors);

  const raw = [];

  offerings.forEach(function(item, idx) {
    raw.push({
      title: item,
      description:
        cleanString(ghost[idx]) ||
        `A focused offering tailored to ${cleanString(state.answers?.target_audience) || "your ideal customers"}.`,
      icon_slug: pickFeatureIcon(item, idx)
    });
  });

  differentiators.forEach(function(item, idx) {
    raw.push({
      title: item,
      description: `A meaningful reason customers choose ${cleanString(state.businessName) || "this business"}.`,
      icon_slug: pickFeatureIcon(item, idx + raw.length)
    });
  });

  decisionFactors.slice(0, 2).forEach(function(item, idx) {
    raw.push({
      title: item,
      description: `Built to address an important buyer priority in the decision-making process.`,
      icon_slug: pickFeatureIcon(item, idx + raw.length)
    });
  });

  trust.slice(0, 2).forEach(function(item, idx) {
    raw.push({
      title: item,
      description: `A trust-building signal that reinforces quality and confidence.`,
      icon_slug: pickFeatureIcon(item, idx + raw.length)
    });
  });

  const deduped = uniqueObjectsByTitle(raw).slice(0, 6);

  while (deduped.length < 3) {
    deduped.push({
      title: `Service Highlight ${deduped.length + 1}`,
      description: `A customer-centered reason to choose ${cleanString(state.businessName) || "this business"}.`,
      icon_slug: pickFeatureIcon("", deduped.length)
    });
  }

  return deduped;
}

function buildGallery(state, strategyContract) {
  const visualDirection = cleanString(state.answers?.visual_direction);
  const audience = cleanString(state.answers?.target_audience);
  const industry = cleanString(strategyContract.business_context?.category);

  const sourceTerms = uniqueList([
    visualDirection,
    ...cleanList(state.answers?.offerings),
    industry,
    audience
  ]).slice(0, 4);

  const items = sourceTerms.map(function(item, idx) {
    return {
      title: item || `Gallery Image ${idx + 1}`,
      image_search_query: clampWords(
        `${item || industry || "professional service"} experience detail`,
        4,
        8
      )
    };
  });

  return {
    enabled: items.length > 0,
    layout: items.length >= 4 ? "grid" : "masonry",
    computed_count: Math.max(3, Math.min(6, items.length || 3)),
    image_source: "search",
    items: items.length ? items : [
      {
        title: "Professional Experience",
        image_search_query: "professional service detail experience"
      },
      {
        title: "Trusted Service",
        image_search_query: "trusted customer service detail"
      },
      {
        title: "Modern Brand",
        image_search_query: "modern premium business detail"
      }
    ]
  };
}

function buildFaqs(state, strategyContract) {
  const items = uniqueList([
    ...cleanList(state.answers?.faq_topics),
    ...cleanList(state.answers?.common_objections),
    ...cleanList(strategyContract.site_structure?.faq_angles)
  ]).slice(0, 6);

  return items.map(function(q) {
    return {
      question: ensureQuestion(q),
      answer: inferFaqAnswer(q, state, strategyContract)
    };
  });
}

function buildTestimonials(state, strategyContract) {
  const trustSignals = uniqueList([
    ...cleanList(state.answers?.trust_signals),
    ...cleanList(state.answers?.credibility_factors),
    ...cleanList(state.answers?.differentiators)
  ]).slice(0, 3);

  const base = trustSignals.map(function(signal, idx) {
    return {
      quote: `We appreciated the professionalism, communication, and quality behind ${signal.toLowerCase()}.`,
      author: `Happy Client ${idx + 1}`
    };
  });

  if (!base.length) {
    return [
      {
        quote: "Professional, responsive, and easy to work with from start to finish.",
        author: "Happy Client"
      }
    ];
  }

  return base;
}

function buildServiceArea(state, strategyContract) {
  const mainCity =
    cleanString(state.answers?.service_area) ||
    cleanString(state.answers?.location_context) ||
    cleanString(state.answers?.office_address);

  return {
    main_city: mainCity,
    surrounding_areas: uniqueList([
      cleanString(state.answers?.service_area),
      cleanString(state.answers?.location_context)
    ]).filter(function(value) {
      return value && value !== mainCity;
    })
  };
}

/* =========================
   Inference
========================= */

function inferSecondaryCtaText(strategyContract) {
  const secondary = cleanString(strategyContract.conversion_strategy?.secondary_conversion);
  if (secondary === "call_now") return "Call Now";
  if (secondary === "submit_inquiry") return "Send Inquiry";
  if (secondary === "request_quote") return "Request Quote";
  return "Learn More";
}

function inferSecondaryCtaLink(phone, bookingUrl) {
  if (phone) return "#contact";
  if (bookingUrl) return bookingUrl;
  return "#about";
}

function inferBrandTagline(state, strategyContract) {
  return (
    cleanString(state.ghostwritten?.tagline) ||
    cleanString(strategyContract.positioning?.brand_promise) ||
    cleanString(state.answers?.desired_outcome) ||
    "Trusted work with a modern customer experience."
  );
}

function inferObjectionHandle(state, strategyContract) {
  return (
    cleanList(state.answers?.common_objections)[0] ||
    cleanList(strategyContract.audience_model?.buyer_objections)[0] ||
    "Clear communication, trustworthy process, and strong results."
  );
}

function inferHeroHeadline(state, strategyContract) {
  return (
    cleanString(strategyContract.positioning?.hero_headline) ||
    cleanString(state.answers?.desired_outcome) ||
    `A better website experience for ${cleanString(state.businessName) || "your business"}`
  );
}

function inferHeroSubtext(state, strategyContract) {
  const audience = cleanString(state.answers?.target_audience);
  const offer = cleanList(state.answers?.offerings)[0];
  const whyNow = cleanString(state.answers?.why_now);
  return (
    cleanString(strategyContract.positioning?.hero_subheadline) ||
    [offer, audience, whyNow].filter(Boolean).join(" — ") ||
    "Built to create clarity, trust, and action."
  );
}

function inferHeroImageAlt(state, strategyContract) {
  return (
    cleanString(state.answers?.visual_direction) ||
    cleanString(strategyContract.visual_strategy?.hero_image_direction) ||
    "Professional brand image"
  );
}

function inferAboutStory(state, strategyContract) {
  return (
    cleanString(state.answers?.why_now) ||
    cleanString(strategyContract.positioning?.brand_story_angle) ||
    "A thoughtful business built around service, trust, and customer outcomes."
  );
}

function inferFounderNote(state, strategyContract) {
  const ownerBackground = cleanString(state.answers?.owner_background);
  const audience = cleanString(state.answers?.target_audience);
  return (
    ownerBackground ||
    cleanString(strategyContract.positioning?.founder_note_angle) ||
    `We built this experience for ${audience || "people who value quality and clarity"}.`
  );
}

function inferYearsExperience(state, strategyContract) {
  return (
    cleanString(state.answers?.experience_years) ||
    cleanString(strategyContract.business_context?.years_experience) ||
    "Experienced professional service"
  );
}

function inferContactSubheadline(state, strategyContract) {
  const primary = cleanString(strategyContract.conversion_strategy?.primary_conversion);
  if (primary === "book_now") return "Ready to book? Reach out and we’ll help you get started.";
  if (primary === "call_now") return "Have questions? Call and talk with us directly.";
  if (primary === "request_quote") return "Tell us what you need and we’ll put together the right next step.";
  return "Reach out and we’ll help you take the next step.";
}

function inferContactButtonText(strategyContract, bookingUrl) {
  const primary = cleanString(strategyContract.conversion_strategy?.primary_conversion);
  if (bookingUrl || primary === "book_now") return "Book Now";
  if (primary === "call_now") return "Call Now";
  if (primary === "request_quote") return "Request Quote";
  return "Send Message";
}

function inferFaqAnswer(question, state, strategyContract) {
  const bookingMethod = cleanString(state.answers?.booking_method);
  const serviceArea = cleanString(state.answers?.service_area);
  const pricing = cleanString(state.answers?.pricing_context);

  const lower = cleanString(question).toLowerCase();

  if (lower.includes("book") || lower.includes("schedule")) {
    if (bookingMethod === "external_booking") {
      return "You can use the booking link on the site to choose the best next step.";
    }
    if (bookingMethod === "phone") {
      return "Call directly and we’ll help you schedule the right next step.";
    }
    return "Reach out through the contact path on the site and we’ll guide you from there.";
  }

  if (lower.includes("area") || lower.includes("location")) {
    return serviceArea
      ? `We primarily serve ${serviceArea}. Reach out if you want to confirm your location.`
      : "Reach out to confirm service availability in your area.";
  }

  if (lower.includes("price") || lower.includes("cost")) {
    return pricing
      ? pricing
      : "Pricing depends on the scope of work, and we’ll help guide you to the right fit.";
  }

  return (
    cleanString(strategyContract.copy_policy?.faq_answer_style) ||
    "We aim to keep the process clear, helpful, and easy to understand."
  );
}

function buildHeroImageQuery(state, strategyContract) {
  const explicit = clampWords(cleanString(state.answers?.visual_direction), 4, 8);
  if (explicit && explicit !== "service business professional work") {
    return explicit;
  }

  const offer = cleanList(state.answers?.offerings)[0];
  const audience = cleanString(state.answers?.target_audience);
  const industry = cleanString(strategyContract.business_context?.category);

  return clampWords(
    `${offer || industry || "professional service"} ${audience || "customer experience"} detail`,
    4,
    8
  );
}

/* =========================
   Icon Picking
========================= */

function pickFeatureIcon(text, idx) {
  const value = cleanString(text).toLowerCase();
  if (value.includes("fast") || value.includes("speed")) return "zap";
  if (value.includes("tech") || value.includes("ai")) return "cpu";
  if (value.includes("layer") || value.includes("system")) return "layers";
  if (value.includes("launch") || value.includes("growth")) return "rocket";
  if (value.includes("green") || value.includes("eco")) return "leaf";
  if (value.includes("care") || value.includes("support")) return "heart";
  if (value.includes("team") || value.includes("people")) return "users";
  if (value.includes("map") || value.includes("local")) return "map";
  if (value.includes("trust") || value.includes("safe")) return "shield";
  if (value.includes("quality") || value.includes("award")) return "award";
  if (value.includes("price") || value.includes("value")) return "coins";

  const fallback = ["layers", "sparkles", "shield", "star", "check", "briefcase"];
  return fallback[idx % fallback.length];
}

function pickTrustbarIcon(text, idx) {
  const value = cleanString(text).toLowerCase();
  if (value.includes("insured") || value.includes("licensed")) return "shield";
  if (value.includes("years") || value.includes("experience")) return "clock";
  if (value.includes("local") || value.includes("area")) return "map";
  if (value.includes("5-star") || value.includes("review")) return "star";
  if (value.includes("award")) return "award";
  if (value.includes("family") || value.includes("team")) return "users";

  const fallback = ["shield", "star", "award", "users"];
  return fallback[idx % fallback.length];
}

/* =========================
   Utility Builders
========================= */

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

function uniqueObjectsByTitle(items) {
  const seen = new Set();
  return items.filter(function(item) {
    const key = cleanString(item?.title).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensureQuestion(text) {
  const q = cleanString(text);
  if (!q) return "What should I know?";
  return /[?]$/.test(q) ? q : `${q}?`;
}

/* =========================
   Strategy Memory
========================= */

function buildStrategyMemory(state, strategyContract, strategyBrief, businessJson) {
  return {
    intake_summary: {
      business_name: cleanString(state.businessName),
      slug: cleanString(state.slug),
      target_audience: cleanString(state.answers?.target_audience),
      primary_conversion_goal: cleanString(state.answers?.primary_conversion_goal),
      booking_method: cleanString(state.answers?.booking_method),
      booking_url: cleanString(state.answers?.booking_url),
      phone: cleanString(state.answers?.phone),
      service_area: cleanString(state.answers?.service_area),
      offerings: cleanList(state.answers?.offerings),
      differentiators: cleanList(state.answers?.differentiators),
      trust_signals: uniqueList([
        ...cleanList(state.answers?.trust_signals),
        ...cleanList(state.answers?.credibility_factors)
      ]),
      faq_topics: cleanList(state.answers?.faq_topics),
      common_objections: cleanList(state.answers?.common_objections),
      process_notes: cleanList(state.answers?.process_notes),
      visual_direction: cleanString(state.answers?.visual_direction),
      target_persona: cleanString(state.answers?.target_audience),
      tone_preferences: cleanString(state.answers?.tone_preferences),
      preview_asset_mode: cleanString(strategyContract.asset_policy?.preview_asset_mode),
      publish_requires_asset_swap: Boolean(strategyContract.asset_policy?.replace_assets_before_publish)
    },
    emitted_sections: Object.keys(businessJson || {})
  };
}

/* =========================
   Validation
========================= */

function validateRawBusinessJson(data) {
  const issues = [];

  if (!isObject(data)) {
    return { ok: false, issues: ["business_json must be an object"] };
  }

  const allowedTopLevel = new Set([
    "intelligence",
    "strategy",
    "settings",
    "brand",
    "hero",
    "about",
    "trustbar",
    "events",
    "service_area",
    "features",
    "processSteps",
    "testimonials",
    "comparison",
    "investment",
    "faqs",
    "gallery",
    "contact"
  ]);

  Object.keys(data).forEach(function(key) {
    if (!allowedTopLevel.has(key)) {
      issues.push(`unknown top-level key: ${key}`);
    }
  });

  if (!cleanString(data?.intelligence?.industry)) {
    issues.push("intelligence.industry is required");
  }
  if (!cleanString(data?.intelligence?.target_persona)) {
    issues.push("intelligence.target_persona is required");
  }
  if (!cleanString(data?.intelligence?.tone_of_voice)) {
    issues.push("intelligence.tone_of_voice is required");
  }

  if (!isObject(data?.strategy)) {
    issues.push("strategy is required");
  }

  if (!cleanString(data?.settings?.vibe)) {
    issues.push("settings.vibe is required");
  }
  if (!SCHEMA_VIBES.includes(cleanString(data?.settings?.vibe))) {
    issues.push("settings.vibe must be a valid schema vibe");
  }
  if (!Array.isArray(data?.settings?.menu) || data.settings.menu.length === 0) {
    issues.push("settings.menu must be a non-empty array");
  } else {
    data.settings.menu.forEach(function(item, idx) {
      if (!cleanString(item?.label)) {
        issues.push(`settings.menu[${idx}].label is required`);
      }
      if (!cleanString(item?.path)) {
        issues.push(`settings.menu[${idx}].path is required`);
      } else if (!ALLOWED_MENU_PATHS.includes(cleanString(item.path))) {
        issues.push(`settings.menu[${idx}].path must be a valid schema anchor`);
      }
      if (Object.prototype.hasOwnProperty.call(item || {}, "href")) {
        issues.push(`settings.menu[${idx}] must use path, not href`);
      }
    });
  }
  if (!cleanString(data?.settings?.cta_text)) {
    issues.push("settings.cta_text is required");
  }
  if (!cleanString(data?.settings?.cta_link)) {
    issues.push("settings.cta_link is required");
  }
  if (!["anchor", "external"].includes(cleanString(data?.settings?.cta_type))) {
    issues.push("settings.cta_type must be anchor or external");
  }

  if (!cleanString(data?.brand?.name)) {
    issues.push("brand.name is required");
  }
  if (!cleanString(data?.brand?.slug)) {
    issues.push("brand.slug is required");
  }
  if (!cleanString(data?.brand?.tagline)) {
    issues.push("brand.tagline is required");
  }
  if (!cleanString(data?.brand?.email)) {
    issues.push("brand.email is required");
  }

  if (!cleanString(data?.hero?.headline)) {
    issues.push("hero.headline is required");
  }
  if (!cleanString(data?.hero?.subtext)) {
    issues.push("hero.subtext is required");
  }
  if (!cleanString(data?.hero?.image?.alt)) {
    issues.push("hero.image.alt is required");
  }
  if (!cleanString(data?.hero?.image?.image_search_query)) {
    issues.push("hero.image.image_search_query is required");
  }

  if (!cleanString(data?.about?.story_text)) {
    issues.push("about.story_text is required");
  }
  if (!cleanString(data?.about?.founder_note)) {
    issues.push("about.founder_note is required");
  }
  if (!cleanString(data?.about?.years_experience)) {
    issues.push("about.years_experience is required");
  }

  if (!Array.isArray(data?.features) || data.features.length < 3) {
    issues.push("features must contain at least 3 items");
  } else {
    data.features.forEach(function(item, idx) {
      if (!cleanString(item?.title)) {
        issues.push(`features[${idx}].title is required`);
      }
      if (!cleanString(item?.description)) {
        issues.push(`features[${idx}].description is required`);
      }
      if (!cleanString(item?.icon_slug)) {
        issues.push(`features[${idx}].icon_slug is required`);
      } else if (!ALLOWED_ICON_TOKENS.includes(cleanString(item.icon_slug))) {
        issues.push(`features[${idx}].icon_slug must be a valid icon token`);
      }
    });
  }

  if (!cleanString(data?.contact?.headline)) {
    issues.push("contact.headline is required");
  }
  if (!cleanString(data?.contact?.subheadline)) {
    issues.push("contact.subheadline is required");
  }
  if (!cleanString(data?.contact?.email_recipient)) {
    issues.push("contact.email_recipient is required");
  }
  if (!cleanString(data?.contact?.button_text)) {
    issues.push("contact.button_text is required");
  }

  if (data?.trustbar) {
    if (typeof data.trustbar.enabled !== "boolean") {
      issues.push("trustbar.enabled must be boolean");
    }
    if (!Array.isArray(data.trustbar.items) || data.trustbar.items.length < 2) {
      issues.push("trustbar.items must contain at least 2 items when trustbar is present");
    } else {
      data.trustbar.items.forEach(function(item, idx) {
        if (!cleanString(item?.label)) {
          issues.push(`trustbar.items[${idx}].label is required`);
        }
        if (!cleanString(item?.icon)) {
          issues.push(`trustbar.items[${idx}].icon is required`);
        } else if (!ALLOWED_ICON_TOKENS.includes(cleanString(item.icon))) {
          issues.push(`trustbar.items[${idx}].icon must be a valid icon token`);
        }
      });
    }
  }

  if (data?.strategy?.show_process) {
    if (!Array.isArray(data?.processSteps) || data.processSteps.length < 3) {
      issues.push("processSteps[] required with at least 3 items when strategy.show_process is true");
    } else {
      data.processSteps.forEach(function(item, idx) {
        if (!cleanString(item?.title)) {
          issues.push(`processSteps[${idx}].title is required`);
        }
        if (!cleanString(item?.description)) {
          issues.push(`processSteps[${idx}].description is required`);
        }
      });
    }
  }

  if (data?.strategy?.show_gallery) {
    if (!isObject(data?.gallery)) {
      issues.push("gallery is required when strategy.show_gallery is true");
    } else {
      if (!Array.isArray(data.gallery.items) || data.gallery.items.length === 0) {
        issues.push("gallery.items are required when strategy.show_gallery is true");
      } else {
        data.gallery.items.forEach(function(item, idx) {
          if (!cleanString(item.image_search_query)) {
            issues.push(`gallery.items[${idx}].image_search_query is required`);
          }
        });
      }
    }
  }

  if (data?.strategy?.show_testimonials) {
    if (!Array.isArray(data?.testimonials) || data.testimonials.length === 0) {
      issues.push("testimonials[] required when strategy.show_testimonials is true");
    }
  }

  if (data?.strategy?.show_faqs) {
    if (!Array.isArray(data?.faqs) || data.faqs.length === 0) {
      issues.push("faqs[] required when strategy.show_faqs is true");
    }
  }

  if (data?.strategy?.show_service_area) {
    if (!isObject(data?.service_area) || !cleanString(data?.service_area?.main_city)) {
      issues.push("service_area.main_city required when strategy.show_service_area is true");
    }
  }

  return { ok: issues.length === 0, issues };
}

/* =========================
   Submit
========================= */

async function trySubmitBusinessJson(request, payload) {
  try {
    const url = new URL(request.url);
    url.pathname = "/api/submit";
    url.search = "";

    const res = await fetch(url.toString(), {
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
  } catch (err) {
    return {
      ok: false,
      error: String(err?.message || err)
    };
  }
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

  const queueComplete = state.verification?.queue_complete === true;

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
  if (!queueComplete) missing.push("verification_queue");

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
    can_generate_now:
      queueComplete &&
      Boolean(whyNow || desiredOutcome) &&
      Boolean(audience) &&
      Boolean(hasOffer) &&
      Boolean(hasCta) &&
      Boolean(hasContactPath) &&
      hasBuyerIntel &&
      hasTrustOrDiff
  };
}

/* =========================
   Shared Helpers
========================= */

function getStrategyContract(state) {
  return state?.provenance?.strategy_contract ||
    state?.inference?.strategy_contract ||
    null;
}

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
  next.answers.faq_topics = cleanList(next.answers.faq_topics);
  next.answers.buyer_decision_factors = cleanList(next.answers.buyer_decision_factors);
  next.answers.common_objections = cleanList(next.answers.common_objections);
  next.answers.process_notes = cleanList(next.answers.process_notes);
  next.verification = isObject(next.verification) ? next.verification : {};

  next.slug = cleanString(next.slug);
  next.businessName = cleanString(next.businessName);
  next.clientEmail = cleanString(next.clientEmail);

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

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function clampWords(text, minWords, maxWords) {
  const words = cleanString(text).split(/\s+/).filter(Boolean);
  if (!words.length) return "service business professional work";
  return words.slice(0, maxWords).join(" ");
}