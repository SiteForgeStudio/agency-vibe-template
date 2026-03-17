// functions/api/intake-complete.js
/**
 * SiteForge Factory — Paid Intake Complete
 *
 * Purpose:
 * - finalize intake state into build-ready output
 * - produce:
 *   1) strategy_brief
 *   2) business_json (master-schema aligned)
 *   3) optional submit dispatch to /api/submit when action === "complete"
 *
 * Notes:
 * - built to work with seeded paid-intake state from intake-start.js
 * - built to work with verification/refinement state from intake-next.js
 * - intentionally avoids vertical-specific logic
 * - uses strategy_contract as the primary strategic source of truth
 */

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const state = normalizeState(body.state || {});
    const action = cleanString(body.action || body.intent || "");
    const strategyContract = getStrategyContract(state);

    if (!cleanString(state.slug)) {
      return json({ ok: false, error: "Missing state.slug" }, 400);
    }

    if (!strategyContract) {
      return json({ ok: false, error: "Missing strategy_contract in state" }, 400);
    }

    const readiness = evaluateReadiness(state);
    state.readiness = readiness;

    if (!readiness.can_generate_now) {
      return json(
        {
          ok: false,
          error: "intake_not_ready",
          readiness,
          message:
            "We still need a few core details before producing a build-ready business payload."
        },
        400
      );
    }

    const strategyBrief = buildStrategyBrief(state, strategyContract);
    const businessJson = buildBusinessJson(state, strategyContract, strategyBrief);
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

    const responsePayload = {
      ok: true,
      slug: state.slug,
      readiness,
      strategy_brief: strategyBrief,
      business_json: businessJson,
      business_base_json: businessJson
    };

    if (action === "complete") {
      const submitResult = await trySubmitBusinessJson(context.request, {
        business_json: businessJson,
        client_email:
          cleanString(state.clientEmail) || cleanString(businessJson?.brand?.email)
      });

      responsePayload.submit = submitResult;
    }

    return json(responsePayload);
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
   Build Final Outputs
========================= */

function buildStrategyBrief(state, strategyContract) {
  return {
    business_name: cleanString(state.businessName),
    slug: cleanString(state.slug),
    category: cleanString(strategyContract.business_context?.category),
    strategic_archetype: cleanString(
      strategyContract.business_context?.strategic_archetype
    ),
    one_page_fit: cleanString(strategyContract.business_context?.one_page_fit),
    primary_conversion: cleanString(
      strategyContract.conversion_strategy?.primary_conversion
    ),
    secondary_conversion: cleanString(
      strategyContract.conversion_strategy?.secondary_conversion
    ),
    conversion_mode: cleanString(
      strategyContract.conversion_strategy?.conversion_mode
    ),
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
      ...cleanList(strategyContract.site_structure?.faq_angles)
    ]),
    aeo_angles: cleanList(strategyContract.site_structure?.aeo_angles),
    recommended_vibe: cleanString(
      strategyContract.visual_strategy?.recommended_vibe
    ),
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

function buildBusinessJson(state, strategyContract, strategyBrief) {
  const businessName =
    cleanString(state.businessName) ||
    cleanString(strategyContract.business_context?.business_name);

  const slug = cleanString(state.slug);
  const email = cleanString(state.clientEmail);
  const serviceArea = cleanString(state.answers?.service_area);
  const locationContext =
    cleanString(state.answers?.location_context) || serviceArea;
  const phone = cleanString(state.answers?.phone);
  const bookingUrl = cleanString(state.answers?.booking_url);
  const officeAddress = cleanString(state.answers?.office_address);
  const vibe = cleanString(strategyContract.visual_strategy?.recommended_vibe);
  const ctaText = cleanString(strategyContract.conversion_strategy?.cta_text) || "Get Started";
  const ctaType = mapCtaType(strategyContract.conversion_strategy, state);
  const ctaLink = mapCtaLink(strategyContract.conversion_strategy, state);

  const menu = buildMenu(strategyContract.schema_toggles);
  const heroHeadline =
    cleanString(state.ghostwritten?.hero_headline) ||
    inferHeroHeadline(state, strategyContract);
  const heroSubheadline =
    cleanString(state.ghostwritten?.hero_subheadline) ||
    inferHeroSubheadline(state, strategyContract);

  const aboutBody =
    cleanString(state.ghostwritten?.about_summary) ||
    inferAboutSummary(state, strategyContract);

  const offers = buildFeatureItems(state, strategyContract);
  const testimonialItems = buildTestimonialItems(state, strategyContract);
  const faqItems = buildFaqItems(state, strategyContract);
  const gallerySection = buildGallerySection(state, strategyContract);
  const contactSection = buildContactSection(state, strategyContract);

  return {
    intelligence: {
      industry:
        cleanString(strategyContract.business_context?.category) || "Local Business",
      target_persona:
        cleanString(state.answers?.target_audience) ||
        cleanString(strategyContract.audience_model?.primary_persona),
      tone_of_voice:
        cleanString(state.answers?.tone_preferences) ||
        cleanString(state.inference?.tone_direction) ||
        "Confident, clear, and trustworthy"
    },

    strategy: {
      show_trustbar: Boolean(strategyContract.schema_toggles?.show_trustbar),
      show_about: Boolean(strategyContract.schema_toggles?.show_about),
      show_features: Boolean(strategyContract.schema_toggles?.show_features),
      show_events: Boolean(strategyContract.schema_toggles?.show_events),
      show_process: Boolean(strategyContract.schema_toggles?.show_process),
      show_testimonials: Boolean(
        strategyContract.schema_toggles?.show_testimonials
      ),
      show_comparison: Boolean(
        strategyContract.schema_toggles?.show_comparison
      ),
      show_gallery: Boolean(strategyContract.schema_toggles?.show_gallery),
      show_investment: Boolean(
        strategyContract.schema_toggles?.show_investment
      ),
      show_faqs: Boolean(strategyContract.schema_toggles?.show_faqs),
      show_service_area: Boolean(
        strategyContract.schema_toggles?.show_service_area
      )
    },

    settings: {
      vibe: vibe || "Modern Minimal",
      menu,
      cta_text: ctaText,
      cta_link: ctaLink,
      cta_type: ctaType
    },

    brand: {
      name: businessName,
      slug,
      email,
      phone,
      address: officeAddress,
      service_area: serviceArea
    },

    hero: {
      enabled: true,
      eyebrow:
        cleanString(strategyContract.business_context?.category) ||
        "Trusted Local Business",
      headline: heroHeadline,
      subheadline: heroSubheadline,
      primary_cta_text: ctaText,
      primary_cta_link: ctaLink,
      secondary_cta_text: inferSecondaryCtaText(strategyContract),
      secondary_cta_link: inferSecondaryCtaLink(state, strategyContract)
    },

    about: {
      enabled: Boolean(strategyContract.schema_toggles?.show_about),
      title: `About ${businessName}`,
      body: aboutBody
    },

    features: {
      enabled: Boolean(strategyContract.schema_toggles?.show_features),
      title: inferFeaturesTitle(state, strategyContract),
      items: offers
    },

    testimonials: {
      enabled: Boolean(strategyContract.schema_toggles?.show_testimonials),
      title: "What Customers Notice",
      items: testimonialItems
    },

    gallery: gallerySection,

    faqs: {
      enabled: Boolean(strategyContract.schema_toggles?.show_faqs),
      title: "Frequently Asked Questions",
      items: faqItems
    },

    contact: contactSection,

    siteforge_meta: {
      strategy_brief: strategyBrief,
      strategy_contract: strategyContract,
      generated_from_paid_intake: true,
      preview_asset_mode: cleanString(
        strategyContract.asset_policy?.preview_asset_mode
      ),
      publish_requires_asset_swap: Boolean(
        strategyContract.asset_policy?.replace_assets_before_publish
      )
    }
  };
}

/* =========================
   Section Builders
========================= */

function buildMenu(toggles) {
  const items = [{ label: "Home", href: "#top" }];

  if (toggles?.show_about) items.push({ label: "About", href: "#about" });
  if (toggles?.show_features) items.push({ label: "Services", href: "#features" });
  if (toggles?.show_testimonials) {
    items.push({ label: "Reviews", href: "#testimonials" });
  }
  if (toggles?.show_gallery) items.push({ label: "Gallery", href: "#gallery" });
  if (toggles?.show_faqs) items.push({ label: "FAQ", href: "#faqs" });
  items.push({ label: "Contact", href: "#contact" });

  return items;
}

function buildFeatureItems(state, strategyContract) {
  const offerings = cleanList(state.answers?.offerings);
  const differentiators = cleanList(state.answers?.differentiators);
  const buyerFactors = cleanList(state.answers?.buyer_decision_factors);

  if (!offerings.length) {
    return [
      {
        title: "Primary Service",
        description: "Tailored around the main offer captured during intake."
      }
    ];
  }

  return offerings.slice(0, 6).map(function(offer, idx) {
    const proof = differentiators[idx] || buyerFactors[idx] || "";
    return {
      title: offer,
      description: proof
        ? `${offer} with an emphasis on ${proof.toLowerCase()}.`
        : `${offer} presented with clear positioning and a strong next step.`
    };
  });
}

function buildTestimonialItems(state, strategyContract) {
  const trustSignals = uniqueList([
    ...cleanList(state.answers?.trust_signals),
    ...cleanList(state.answers?.credibility_factors)
  ]);

  if (!trustSignals.length) {
    return [
      {
        quote:
          "Trust-focused preview copy can be replaced with real reviews and proof during final approval.",
        name: "Preview Note"
      }
    ];
  }

  return trustSignals.slice(0, 4).map(function(item) {
    return {
      quote: item,
      name: "Customer Trust Signal"
    };
  });
}

function buildFaqItems(state, strategyContract) {
  const explicitFaqs = Array.isArray(state.ghostwritten?.faqs)
    ? state.ghostwritten.faqs.filter(isObject)
    : [];

  if (explicitFaqs.length) {
    return explicitFaqs.map(function(item) {
      return {
        question: cleanString(item.question),
        answer:
          cleanString(item.answer) ||
          "We’ll refine this answer during final polish if needed."
      };
    });
  }

  const topics = uniqueList([
    ...cleanList(state.answers?.faq_topics),
    ...cleanList(state.answers?.common_objections),
    ...cleanList(strategyContract.site_structure?.faq_angles)
  ]);

  return topics.slice(0, 6).map(function(topic) {
    return {
      question: topic,
      answer: "This answer can be refined during final review and approval."
    };
  });
}

function buildGallerySection(state, strategyContract) {
  const enabled = Boolean(strategyContract.schema_toggles?.show_gallery);
  const businessName =
    cleanString(state.businessName) ||
    cleanString(strategyContract.business_context?.business_name);
  const category = cleanString(strategyContract.business_context?.category);
  const serviceArea =
    cleanString(state.answers?.service_area) ||
    cleanString(strategyContract.business_context?.service_area?.[0]);

  return {
    enabled,
    title: "Gallery",
    layout: null,
    show_titles: false,
    strategy: {
      primary_goal: "visual trust and atmosphere",
      show_gallery: enabled
    },
    image_source: {
      provider: "preview_search",
      image_search_query: buildImageSearchQuery(
        businessName,
        category,
        serviceArea,
        strategyContract
      ),
      filename_pattern: "gallery-{index}.jpg",
      target_folder: `clients/${cleanString(state.slug)}/images/gallery`
    },
    computed_count: null,
    computed_layout: null,
    items: []
  };
}

function buildContactSection(state, strategyContract) {
  const bookingMethod = cleanString(state.answers?.booking_method);
  const phone = cleanString(state.answers?.phone);
  const bookingUrl = cleanString(state.answers?.booking_url);
  const email = cleanString(state.clientEmail);
  const address = cleanString(state.answers?.office_address);
  const serviceArea = cleanString(state.answers?.service_area);

  return {
    enabled: true,
    title: "Get in Touch",
    intro:
      "Ready to take the next step? Reach out using the contact path that works best for you.",
    phone,
    email,
    address,
    service_area: serviceArea,
    booking_method: bookingMethod,
    booking_url: bookingUrl
  };
}

/* =========================
   Inference Helpers
========================= */

function buildImageSearchQuery(
  businessName,
  category,
  serviceArea,
  strategyContract
) {
  const preferred = cleanList(
    strategyContract.asset_policy?.preferred_image_themes
  );

  const parts = uniqueList([
    category,
    serviceArea,
    ...preferred
  ]);

  return parts.join(", ");
}

function inferHeroHeadline(state, strategyContract) {
  const offer = cleanList(state.answers?.offerings)[0];
  const serviceArea = cleanString(state.answers?.service_area);

  if (offer && serviceArea) return `${offer} in ${serviceArea}`;
  if (offer) return offer;

  return cleanString(strategyContract.business_context?.business_name) ||
    "Trusted Local Business";
}

function inferHeroSubheadline(state, strategyContract) {
  const audience =
    cleanString(state.answers?.target_audience) ||
    cleanString(strategyContract.audience_model?.primary_persona);
  const ctaText =
    cleanString(strategyContract.conversion_strategy?.cta_text) || "get started";

  if (audience) {
    return `Built to help ${audience.toLowerCase()} feel confident taking the next step.`;
  }

  return `Designed to build trust and make it easy for visitors to ${ctaText.toLowerCase()}.`;
}

function inferAboutSummary(state, strategyContract) {
  const businessName =
    cleanString(state.businessName) ||
    cleanString(strategyContract.business_context?.business_name);
  const category = cleanString(strategyContract.business_context?.category);
  const serviceArea = cleanString(state.answers?.service_area);
  const trustSignals = uniqueList([
    ...cleanList(state.answers?.trust_signals),
    ...cleanList(state.answers?.credibility_factors)
  ]);

  const trustLine = trustSignals.length
    ? `The site emphasizes ${trustSignals.slice(0, 2).join(" and ").toLowerCase()}.`
    : "The site is designed to build trust and clarity quickly.";

  return [
    businessName ? `${businessName} is` : "This business is",
    category ? `positioned as a ${category.toLowerCase()}` : "positioned to serve customers well",
    serviceArea ? `in ${serviceArea}.` : ".",
    trustLine
  ].join(" ").replace(/\s+/g, " ").trim();
}

function inferFeaturesTitle(state, strategyContract) {
  const category = cleanString(strategyContract.business_context?.category);
  if (/tour|experience/i.test(category)) return "Featured Experiences";
  if (/consult|service/i.test(category)) return "Core Services";
  return "What We Offer";
}

function inferSecondaryCtaText(strategyContract) {
  const secondary = cleanString(
    strategyContract.conversion_strategy?.secondary_conversion
  ).toLowerCase();

  if (secondary.includes("inquiry")) return "Send an Inquiry";
  if (secondary.includes("call")) return "Call Today";
  return "Learn More";
}

function inferSecondaryCtaLink(state, strategyContract) {
  if (cleanString(state.answers?.phone)) return "#contact";
  return "#about";
}

function mapCtaType(conversionStrategy, state) {
  const bookingUrl = cleanString(state.answers?.booking_url);
  if (bookingUrl) return "external";
  return "anchor";
}

function mapCtaLink(conversionStrategy, state) {
  const bookingUrl = cleanString(state.answers?.booking_url);
  if (bookingUrl) return bookingUrl;
  return "#contact";
}

/* =========================
   Validation
========================= */

function validateBusinessJson(businessJson) {
  const issues = [];

  if (!isObject(businessJson)) {
    issues.push("business_json must be an object");
    return { ok: false, issues };
  }

  if (!cleanString(businessJson?.brand?.slug)) {
    issues.push("brand.slug is required");
  }

  if (!cleanString(businessJson?.brand?.name)) {
    issues.push("brand.name is required");
  }

  if (!cleanString(businessJson?.settings?.vibe)) {
    issues.push("settings.vibe is required");
  }

  if (!SCHEMA_VIBES.includes(cleanString(businessJson?.settings?.vibe))) {
    issues.push("settings.vibe must be a valid schema vibe");
  }

  if (!Array.isArray(businessJson?.settings?.menu)) {
    issues.push("settings.menu must be an array");
  }

  if (!cleanString(businessJson?.settings?.cta_text)) {
    issues.push("settings.cta_text is required");
  }

  if (!cleanString(businessJson?.settings?.cta_link)) {
    issues.push("settings.cta_link is required");
  }

  if (!cleanString(businessJson?.settings?.cta_type)) {
    issues.push("settings.cta_type is required");
  }

  if (
    businessJson?.strategy?.show_gallery &&
    !cleanString(businessJson?.gallery?.image_source?.image_search_query)
  ) {
    issues.push("gallery.image_source.image_search_query is required when gallery is enabled");
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

/* =========================
   Submit Dispatch
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

/* =========================
   Shared Helpers
========================= */

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