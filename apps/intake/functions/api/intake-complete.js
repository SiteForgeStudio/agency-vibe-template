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

  const targetAudience =
    cleanString(state.answers?.target_audience) ||
    cleanString(strategyContract.audience_model?.primary_persona) ||
    "Homeowners looking for a trusted provider";

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
    cleanString(strategyContract.conversion_strategy?.cta_text) ||
    inferPrimaryCtaText(strategyContract, bookingUrl);

  const ctaLink = bookingUrl || "#contact";
  const ctaType = bookingUrl ? "external" : "anchor";

  const processSteps = buildProcessSteps(state, strategyContract);

  const toggles = {
    show_trustbar: Boolean(strategyContract.schema_toggles?.show_trustbar),
    show_about: Boolean(strategyContract.schema_toggles?.show_about),
    show_features: Boolean(strategyContract.schema_toggles?.show_features),
    show_events: false,
    show_process: Boolean(strategyContract.schema_toggles?.show_process) || processSteps.length >= 3,
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
      secondary_cta_text: inferSecondaryCtaText(strategyContract, phone),
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
        cleanString(state.ghostwritten?.hero_headline) && isUsableHeroHeadline(state.ghostwritten.hero_headline)
          ? cleanString(state.ghostwritten.hero_headline)
          : inferHeroHeadline(state, strategyContract),
      subtext:
        cleanString(state.ghostwritten?.hero_subheadline) && isUsableHeroSubtext(state.ghostwritten.hero_subheadline)
          ? cleanString(state.ghostwritten.hero_subheadline)
          : inferHeroSubtext(state, strategyContract),
      image: {
        alt: inferHeroImageAlt(state, strategyContract),
        image_search_query: heroQuery
      }
    },

    about: {
      story_text:
        cleanString(state.ghostwritten?.about_summary) && isUsableAboutCopy(state.ghostwritten.about_summary)
          ? cleanString(state.ghostwritten.about_summary)
          : inferAboutStory(state, strategyContract),
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
      label: normalizeTrustbarLabel(label),
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

  const cleaned = text
    .replace(/\b(and|the|a|an)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  const titleWords = words.slice(0, Math.min(words.length, 3));
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
  const offerings = cleanList(state.answers?.offerings);
  const differentiators = cleanList(state.answers?.differentiators);
  const decisionFactors = cleanList(state.answers?.buyer_decision_factors);
  const audience = audienceToCustomerPhrase(cleanString(state.answers?.target_audience)) || "homeowners";
  const businessName = cleanString(state.businessName) || "this business";

  const items = [];

  offerings.forEach(function(item, idx) {
    const normalized = normalizeOfferTitle(item);
    if (!normalized) return;

    items.push({
      title: normalized,
      description: inferOfferingDescription(item, audience),
      icon_slug: pickFeatureIcon(item, idx)
    });
  });

  differentiators.forEach(function(item, idx) {
    const normalized = normalizeDifferentiatorTitle(item);
    if (!normalized || isWeakProofOnlyItem(normalized)) return;

    items.push({
      title: normalized,
      description: inferDifferentiatorDescription(normalized, businessName, audience),
      icon_slug: pickFeatureIcon(normalized, idx + items.length)
    });
  });

  decisionFactors.forEach(function(item, idx) {
    const normalized = normalizeDecisionFactorTitle(item);
    if (!normalized || isWeakProofOnlyItem(normalized)) return;

    items.push({
      title: normalized,
      description: inferDecisionFactorDescription(normalized, audience),
      icon_slug: pickFeatureIcon(normalized, idx + items.length)
    });
  });

  const deduped = uniqueObjectsByTitle(items).slice(0, 6);

  while (deduped.length < 3) {
    deduped.push({
      title: `Service Highlight ${deduped.length + 1}`,
      description: `Built around clear communication, careful work, and a better client experience for ${audience}.`,
      icon_slug: pickFeatureIcon("", deduped.length)
    });
  }

  return deduped;
}

function buildGallery(state, strategyContract) {
  const industry = cleanString(strategyContract.business_context?.category);
  const visualDirection = cleanString(state.answers?.visual_direction);
  const offerings = cleanList(state.answers?.offerings);
  const serviceArea = cleanString(state.answers?.service_area);

  const seeds = uniqueList([
    buildVisualImageSeed(industry, offerings[0], visualDirection),
    buildDetailImageSeed(industry, offerings[0]),
    buildTrustImageSeed(industry, serviceArea),
    buildLifestyleImageSeed(industry, visualDirection)
  ]).filter(Boolean);

  const items = seeds.slice(0, 6).map(function(query, idx) {
    return {
      title: inferGalleryTitle(query, idx),
      image_search_query: clampWords(stripLocationTerms(query, serviceArea), 4, 8)
    };
  });

  return {
    enabled: items.length > 0,
    layout: items.length >= 4 ? "grid" : "masonry",
    computed_count: Math.max(3, Math.min(6, items.length || 3)),
    image_source: "search",
    items: items.length ? items : [
      {
        title: "Professional Service",
        image_search_query: "professional service detail clean finish"
      },
      {
        title: "Careful Work",
        image_search_query: "careful hands professional service detail"
      },
      {
        title: "Trusted Experience",
        image_search_query: "trusted home service premium detail"
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

  const quotes = [
    "Professional, careful, and easy to work with from start to finish.",
    "Clear communication, reliable scheduling, and great final results.",
    `We chose ${cleanString(state.businessName) || "this team"} because they felt trustworthy and professional from the first interaction.`
  ];

  const base = trustSignals.map(function(signal, idx) {
    return {
      quote: inferTestimonialQuote(signal, state, idx, quotes),
      author: `Happy Client ${idx + 1}`
    };
  });

  if (!base.length) {
    return [
      {
        quote: quotes[0],
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

function inferPrimaryCtaText(strategyContract, bookingUrl) {
  const primary = cleanString(strategyContract.conversion_strategy?.primary_conversion);

  if (bookingUrl || primary === "book_now") return "Book Now";
  if (primary === "call_now") return "Call Now";
  if (primary === "request_quote" || primary === "submit_inquiry") return "Request Quote";
  return "Get Started";
}

function inferSecondaryCtaText(strategyContract, phone) {
  const secondary = cleanString(strategyContract.conversion_strategy?.secondary_conversion);

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

function inferBrandTagline(state, strategyContract) {
  const offer = cleanList(state.answers?.offerings)[0];
  const audience = cleanString(state.answers?.target_audience);
  const industry = cleanString(strategyContract.business_context?.category);

  const cleanedOffer = simplifyOfferPhrase(offer);
  const audienceHint = audienceToCustomerPhrase(audience);

  if (cleanedOffer && audienceHint) {
    return clampString(`${cleanedOffer} for ${audienceHint}.`, 96);
  }

  if (cleanedOffer) {
    return clampString(`${cleanedOffer} with a cleaner, more professional experience.`, 96);
  }

  if (industry) {
    return clampString(`Professional ${industry.toLowerCase()} with a polished customer experience.`, 96);
  }

  return "Professional service with a polished customer experience.";
}

function inferObjectionHandle(state, strategyContract) {
  const objections = cleanList(state.answers?.common_objections);
  const trust = cleanList(state.answers?.trust_signals);
  const diff = cleanList(state.answers?.differentiators);

  const source =
    objections[0] ||
    trust[0] ||
    diff[0] ||
    cleanList(strategyContract.audience_model?.buyer_objections)[0] ||
    "";

  const normalized = cleanString(source).toLowerCase();

  if (normalized.includes("cost")) {
    return "Clear quotes and honest expectations from the start.";
  }
  if (normalized.includes("trust")) {
    return "Clear communication and dependable service you can feel good about.";
  }
  if (normalized.includes("availability")) {
    return "Responsive scheduling and dependable follow-through.";
  }
  if (normalized.includes("quality")) {
    return "Careful work and attention to detail from start to finish.";
  }

  return "Clear communication, dependable service, and quality work.";
}

function inferHeroHeadline(state, strategyContract) {
  const offer = simplifyOfferPhrase(cleanList(state.answers?.offerings)[0]);
  const audience = audienceToCustomerPhrase(cleanString(state.answers?.target_audience));
  const businessName = cleanString(state.businessName);
  const industry = cleanString(strategyContract.business_context?.category);

  if (offer && audience) {
    return clampString(`${offer} for ${audience}`, 72);
  }

  if (offer) {
    return clampString(offer, 72);
  }

  if (businessName && industry) {
    return clampString(`${businessName} — ${industry}`, 72);
  }

  return `Trusted ${industry || "service"} with a polished client experience`;
}

function inferHeroSubtext(state, strategyContract) {
  const serviceArea = cleanString(state.answers?.service_area);
  const differentiator = cleanList(state.answers?.differentiators)[0];
  const trust = cleanList(state.answers?.trust_signals)[0];
  const bookingMethod = cleanString(state.answers?.booking_method);
  const years = cleanString(state.answers?.experience_years);

  const sentenceA = [
    years ? `${years} of experience` : "",
    differentiator ? normalizeDifferentiatorPhrase(differentiator) : "",
    serviceArea ? `serving ${serviceArea}` : ""
  ].filter(Boolean).join(" — ");

  const sentenceB = bookingMethodToCustomerSentence(bookingMethod, trust);

  return [sentenceA, sentenceB]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\s*\./g, ".")
    .trim() || "Built to create trust, clarity, and an easy next step.";
}

function inferHeroImageAlt(state, strategyContract) {
  const industry = cleanString(strategyContract.business_context?.category);
  const offer = simplifyOfferPhrase(cleanList(state.answers?.offerings)[0]);

  return offer || industry || "Professional brand image";
}

function inferAboutStory(state, strategyContract) {
  const businessName = cleanString(state.businessName);
  const offer = simplifyOfferPhrase(cleanList(state.answers?.offerings)[0]);
  const audience = audienceToCustomerPhrase(cleanString(state.answers?.target_audience));
  const serviceArea = cleanString(state.answers?.service_area);
  const whyNow = cleanString(state.answers?.why_now);

  if (offer && audience) {
    return `${businessName || "This business"} focuses on ${offer.toLowerCase()} for ${audience}${serviceArea ? ` in ${serviceArea}` : ""}. The goal is a better experience from the first visit to the final result.`;
  }

  if (whyNow && !looksLikeInternalStrategyText(whyNow)) {
    return cleanSentence(whyNow);
  }

  return "Built around careful work, clear communication, and a customer experience that feels professional from the start.";
}

function inferFounderNote(state, strategyContract) {
  const ownerBackground = cleanString(state.answers?.owner_background);
  const audience = audienceToCustomerPhrase(cleanString(state.answers?.target_audience));
  const years = cleanString(state.answers?.experience_years);

  if (ownerBackground && !looksLikeInternalStrategyText(ownerBackground)) {
    return cleanSentence(ownerBackground);
  }

  if (years && audience) {
    return `${years} of experience serving ${audience} with careful, dependable work.`;
  }

  return "Built for people who value quality, clear communication, and a smooth process.";
}

function inferYearsExperience(state, strategyContract) {
  const explicit = cleanString(state.answers?.experience_years);
  if (explicit) return explicit;

  const contractYears = cleanString(strategyContract.business_context?.years_experience);
  if (contractYears) return contractYears;

  return "Experienced professional service";
}

function inferContactSubheadline(state, strategyContract) {
  const primary = cleanString(strategyContract.conversion_strategy?.primary_conversion);
  const bookingMethod = cleanString(state.answers?.booking_method);
  const phone = cleanString(state.answers?.phone);
  const offer = simplifyOfferPhrase(cleanList(state.answers?.offerings)[0]);

  if (bookingMethod === "phone" || primary === "call_now") {
    return phone
      ? "Call today and we’ll help you figure out the best next step."
      : "Reach out and we’ll help you take the next step.";
  }

  if (primary === "request_quote" || primary === "submit_inquiry") {
    return offer
      ? `Tell us a bit about your ${offer.toLowerCase()} needs and we’ll help you with the right next step.`
      : "Tell us what you need and we’ll help you with the right next step.";
  }

  if (primary === "book_now") {
    return "Ready to get started? Reach out and we’ll help you book the right next step.";
  }

  return "Reach out and we’ll help you move forward with confidence.";
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
      : "Pricing depends on the scope of work, and we’ll help guide you to the right fit.";
  }

  if (lower.includes("process")) {
    return "We aim to keep the process clear, responsive, and easy from first contact to final follow-through.";
  }

  return "We keep the experience clear, helpful, and easy to understand.";
}

function buildHeroImageQuery(state, strategyContract) {
  const offer = simplifyOfferPhrase(cleanList(state.answers?.offerings)[0]);
  const industry = cleanString(strategyContract.business_context?.category);
  const visual = cleanString(state.answers?.visual_direction);
  const serviceArea = cleanString(state.answers?.service_area);

  const query = buildVisualImageSeed(industry, offer, visual) ||
    `${offer || industry || "professional service"} clean detail`;

  return clampWords(stripLocationTerms(query, serviceArea), 4, 8);
}

/* =========================
   Quality Helpers
========================= */

function isUsableHeroHeadline(text) {
  const value = cleanString(text);
  if (!value) return false;
  if (looksLikeInternalStrategyText(value)) return false;
  if (/with a clear path to/i.test(value)) return false;
  if (/improve conversions/i.test(value)) return false;
  if (/people actively looking for/i.test(value)) return false;
  if (/\.?\s+in\s+[A-Z]/.test(value)) return false;
  if (value.split(/\s+/).length > 12) return false;
  return true;
}

function isUsableHeroSubtext(text) {
  const value = cleanString(text);
  if (!value) return false;
  if (looksLikeInternalStrategyText(value)) return false;
  if (/people actively looking for/i.test(value)) return false;
  return true;
}

function isUsableAboutCopy(text) {
  const value = cleanString(text);
  if (!value) return false;
  if (looksLikeInternalStrategyText(value)) return false;
  return true;
}

function looksLikeInternalStrategyText(text) {
  const value = cleanString(text).toLowerCase();
  return [
    "improve conversions",
    "conversion-focused",
    "people actively looking",
    "request quote",
    "clear path to",
    "website designed to build trust",
    "drive action"
  ].some(function(token) {
    return value.includes(token);
  });
}

function simplifyOfferPhrase(offer) {
  let value = cleanString(offer);
  if (!value) return "";

  value = value
    .replace(/\bin\s+[A-Z][^,.]*$/g, "")
    .replace(/\bspecializing in\b/gi, "")
    .replace(/\bwith\b.+$/i, "")
    .replace(/\bfor\b.+$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (/window cleaning/i.test(value) && /glass restoration/i.test(value)) {
    return "High-End Window Cleaning and Glass Restoration";
  }

  if (/window cleaning/i.test(value)) {
    return "High-End Window Cleaning";
  }

  return cleanSentenceFragment(value);
}

function audienceToCustomerPhrase(audience) {
  const value = cleanString(audience).toLowerCase();
  if (!value) return "";

  if (value.includes("homeowner")) return "homeowners";
  if (value.includes("family")) return "families";
  if (value.includes("property manager")) return "property managers";
  if (value.includes("business")) return "businesses";
  if (value.includes("customer")) return "customers";
  if (value.includes("people actively looking")) return "homeowners";
  if (value.includes("trustworthy provider")) return "homeowners";

  return cleanSentenceFragment(value);
}

function bookingMethodToCustomerSentence(method, trustSignal) {
  const m = cleanString(method).toLowerCase();
  const trust = cleanString(trustSignal);

  if (m === "phone") {
    return "Call directly to ask questions and schedule the right next step";
  }
  if (m === "external_booking") {
    return "Use the booking link to choose the right next step";
  }
  if (m === "request_quote" || m === "inquiry_first") {
    return trust
      ? `Start with a quote request and move forward with confidence backed by ${normalizeTrustbarLabel(trust).toLowerCase()}`
      : "Start with a quote request and get clear guidance on the right next step";
  }

  return trust
    ? `Built to create confidence through ${normalizeTrustbarLabel(trust).toLowerCase()}`
    : "Built to create trust and make the next step easy";
}

function normalizeOfferTitle(item) {
  const value = simplifyOfferPhrase(item);
  if (!value) return "";

  if (/window cleaning/i.test(value) && /glass restoration/i.test(value)) {
    return "Window Cleaning & Glass Restoration";
  }

  if (/window cleaning/i.test(value)) {
    return "Window Cleaning";
  }

  return titleCaseSmart(value);
}

function normalizeDifferentiatorTitle(item) {
  const value = cleanString(item).toLowerCase();
  if (!value) return "";

  if (value.includes("quality")) return "Quality Work";
  if (value.includes("availability")) return "Responsive Scheduling";
  if (value.includes("communication")) return "Clear Communication";
  if (value.includes("detail")) return "Attention to Detail";
  if (value.includes("professional")) return "Professional Experience";
  if (value.includes("trust")) return "Trusted Service";

  return titleCaseSmart(cleanString(item));
}

function normalizeDecisionFactorTitle(item) {
  const value = cleanString(item).toLowerCase();
  if (!value) return "";

  if (value.includes("pricing")) return "Clear Quotes";
  if (value.includes("quality")) return "Careful Work";
  if (value.includes("reputation")) return "Trusted Reputation";
  if (value.includes("availability")) return "Reliable Scheduling";
  if (value.includes("specialization")) return "Specialized Experience";

  return titleCaseSmart(cleanString(item));
}

function inferOfferingDescription(item, audience) {
  const normalizedTitle = normalizeOfferTitle(item);
  if (!normalizedTitle) {
    return `A focused offering designed for ${audience}.`;
  }

  return cleanSentence(
    `${normalizedTitle} delivered with careful work, clear communication, and a better experience for ${audience}`
  );
}

function inferDifferentiatorDescription(title, businessName, audience) {
  const lower = cleanString(title).toLowerCase();

  if (lower.includes("responsive scheduling")) {
    return "Easier planning, faster follow-up, and dependable communication from the start.";
  }
  if (lower.includes("quality work")) {
    return "Careful workmanship and attention to detail that help the final result feel worth it.";
  }
  if (lower.includes("clear communication")) {
    return "Clear expectations before, during, and after the job so clients always know what to expect.";
  }
  if (lower.includes("professional experience")) {
    return "A polished, respectful experience built around reliability, care, and professionalism.";
  }
  if (lower.includes("trusted service")) {
    return `Built to give ${audience} more confidence in choosing ${businessName}.`;
  }

  return `A meaningful reason clients choose ${businessName}.`;
}

function inferDecisionFactorDescription(title, audience) {
  const lower = cleanString(title).toLowerCase();

  if (lower.includes("clear quotes")) {
    return "Helpful pricing conversations without making the process feel confusing or rushed.";
  }
  if (lower.includes("careful work")) {
    return "Thoughtful service for clients who care about results, cleanliness, and attention to detail.";
  }
  if (lower.includes("trusted reputation")) {
    return "A stronger sense of confidence for clients who want to hire the right provider the first time.";
  }
  if (lower.includes("reliable scheduling")) {
    return "A smoother client experience for busy customers who value dependable timing and follow-through.";
  }
  if (lower.includes("specialized experience")) {
    return `A stronger fit for ${audience} who want a provider with relevant experience.`;
  }

  return "Designed around what matters most in the buying decision.";
}

function isWeakProofOnlyItem(text) {
  const value = cleanString(text).toLowerCase();
  return [
    "customer testimonials",
    "before-and-after photos",
    "photo gallery",
    "customer reviews",
    "local referrals"
  ].includes(value);
}

function normalizeTrustbarLabel(label) {
  const value = cleanString(label).toLowerCase();
  if (!value) return "";

  if (value.includes("testimonial")) return "Trusted by Homeowners";
  if (value.includes("review")) return "5-Star Reviews";
  if (value.includes("photo")) return "Proven Results";
  if (value.includes("experience")) return "Experienced Service";
  if (value.includes("referral")) return "Locally Recommended";

  if (value === "future_google_business_profile") return "Local Business Presence";
  if (value === "local_service_area_relevance") return "Local Service Focus";

  return titleCaseSmart(cleanString(label).replace(/[_-]/g, " "));
}

function inferTestimonialQuote(signal, state, idx, quotes) {
  const lower = cleanString(signal).toLowerCase();

  if (lower.includes("testimonial") || lower.includes("review")) return quotes[2];
  if (lower.includes("photo")) return "The final result looked fantastic, and the whole experience felt polished and professional.";
  if (lower.includes("experience")) return "You can feel the experience in the way everything is handled — clear, careful, and dependable.";
  if (lower.includes("referral")) return "They came highly recommended, and the service absolutely lived up to that reputation.";

  return quotes[idx % quotes.length];
}

function buildVisualImageSeed(industry, offer, visualDirection) {
  const value = cleanString(`${offer || industry} ${visualDirection}`).toLowerCase();

  if (value.includes("window")) return "sunlit clean window glass detail";
  if (value.includes("home service")) return "premium home service clean detail";
  if (value.includes("clean")) return "bright clean detail premium service";
  return "professional service clean detail";
}

function buildDetailImageSeed(industry, offer) {
  const value = cleanString(`${offer || industry}`).toLowerCase();

  if (value.includes("window")) return "window cleaning detail squeegee glass";
  if (value.includes("glass")) return "clear glass detail polished finish";
  return "professional detail workmanship closeup";
}

function buildTrustImageSeed(industry, serviceArea) {
  const value = cleanString(industry).toLowerCase();

  if (value.includes("window")) return "bright home exterior clean windows";
  return "trusted service exterior professional look";
}

function buildLifestyleImageSeed(industry, visualDirection) {
  const value = cleanString(`${industry} ${visualDirection}`).toLowerCase();

  if (value.includes("window")) return "natural light modern home clean glass";
  if (value.includes("modern")) return "modern premium service environment";
  return "premium service lifestyle detail";
}

function inferGalleryTitle(query, idx) {
  const q = cleanString(query).toLowerCase();

  if (q.includes("window")) return "Clean Glass Detail";
  if (q.includes("home")) return "Residential Service";
  if (q.includes("detail")) return "Attention to Detail";
  if (q.includes("premium")) return "Premium Finish";

  return `Project ${idx + 1}`;
}

function stripLocationTerms(text, serviceArea) {
  const area = cleanString(serviceArea);
  let value = cleanString(text)
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (area) {
    const areaWords = area.split(/[,\s]+/).filter(Boolean);
    areaWords.forEach(function(word) {
      const escaped = escapeRegExp(word);
      value = value.replace(new RegExp(`\\b${escaped}\\b`, "ig"), "");
    });
  }

  return value.replace(/\s+/g, " ").trim();
}

function cleanSentenceFragment(text) {
  return cleanString(text)
    .replace(/[|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[.,;:]+$/g, "")
    .trim();
}

function titleCaseSmart(text) {
  return cleanString(text)
    .split(/\s+/)
    .filter(Boolean)
    .map(function(word) {
      if (word.toLowerCase() === "and") return "and";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function capitalizeFirst(text) {
  const value = cleanString(text);
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clampString(text, max) {
  const value = cleanString(text);
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`;
}

function normalizeDifferentiatorPhrase(text) {
  const value = cleanString(text).toLowerCase();
  if (!value) return "";

  if (value.includes("quality")) return "careful, high-quality work";
  if (value.includes("availability")) return "responsive scheduling";
  if (value.includes("communication")) return "clear communication";
  if (value.includes("detail")) return "attention to detail";

  return value;
}

function escapeRegExp(text) {
  return cleanString(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  if (value.includes("price") || value.includes("value") || value.includes("quote")) return "coins";
  if (value.includes("window") || value.includes("glass")) return "sparkles";
  if (value.includes("schedule") || value.includes("availability")) return "clock";
  if (value.includes("phone") || value.includes("call")) return "phone";

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
    owner_background: "",
    location_context: "",
    service_area: "",
    tone_preferences: "",
    visual_direction: "",
    process_notes: [],
    faq_topics: [],
    pricing_context: "",
    buyer_decision_factors: [],
    common_objections: [],
    experience_years: "",
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

function clampWords(text, minWords, maxWords) {
  const words = cleanString(text).split(/\s+/).filter(Boolean);
  if (!words.length) return "service business professional work";
  return words.slice(0, maxWords).join(" ");
}