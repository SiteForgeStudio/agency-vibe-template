// functions/api/intake-complete.js
/**
 * SiteForge Factory — Paid Intake Complete
 *
 * ROLE PER MANIFEST:
 * - Gate on readiness
 * - Require verification queue completion
 * - Map verified/seeded state into schema-valid business_json
 * - Light normalization only
 * - Submit
 *
 * IMPORTANT:
 * This file is an assembler and validator.
 * It is NOT the primary strategy engine or copywriter.
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
    "Customers looking for a trusted provider";

  const industry =
    cleanString(strategyContract.business_context?.category) ||
    "Service business";

  const tone =
    cleanString(state.answers?.tone_preferences) ||
    cleanString(state.inference?.tone_direction) ||
    "Professional, clear, trustworthy";

  const vibe = resolveSchemaVibe(
    cleanString(strategyContract.visual_strategy?.recommended_vibe)
  );

  const processSteps = buildProcessSteps(state);
  const features = buildFeatures(state);
  const gallery = buildGallery(state, strategyContract);
  const faqs = buildFaqs(state, strategyContract);
  const testimonials = buildTestimonials(state);
  const trustbar = buildTrustbar(state, strategyContract);
  const serviceAreaBlock = buildServiceArea(state);

  const toggles = {
    show_trustbar: Boolean(strategyContract.schema_toggles?.show_trustbar) && Boolean(trustbar),
    show_about: Boolean(strategyContract.schema_toggles?.show_about),
    show_features: Boolean(strategyContract.schema_toggles?.show_features),
    show_events: false,
    show_process: processSteps.length >= 3,
    show_testimonials: Boolean(strategyContract.schema_toggles?.show_testimonials) && testimonials.length > 0,
    show_comparison: false,
    show_gallery: Boolean(strategyContract.schema_toggles?.show_gallery) && Boolean(gallery),
    show_investment: false,
    show_faqs: Boolean(strategyContract.schema_toggles?.show_faqs) && faqs.length > 0,
    show_service_area: Boolean(strategyContract.schema_toggles?.show_service_area) && Boolean(serviceAreaBlock)
  };

  const sections = {
    about: true,
    features,
    events: undefined,
    processSteps,
    testimonials,
    comparison: undefined,
    gallery,
    investment: undefined,
    faqs,
    service_area: serviceAreaBlock
  };

  return {
    intelligence: {
      industry: normalizePublicText(industry),
      target_persona: normalizePublicText(targetAudience),
      tone_of_voice: normalizePublicText(tone)
    },

    strategy: toggles,

    settings: {
      vibe,
      menu: buildMenu(toggles, sections),
      cta_text: normalizePublicText(inferPrimaryCtaText(strategyContract, bookingUrl)),
      cta_link: bookingUrl || "#contact",
      cta_type: bookingUrl ? "external" : "anchor",
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
      objection_handle: normalizePublicText(resolveObjectionHandle(state))
    },

    hero: {
      headline: normalizePublicText(resolveHeroHeadline(state, businessName)),
      subtext: normalizePublicText(resolveHeroSubtext(state, strategyContract)),
      image: {
        alt: normalizePublicText(resolveHeroImageAlt(state, businessName)),
        image_search_query: buildHeroImageQuery(state, strategyContract)
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

    ...(serviceAreaBlock ? { service_area: serviceAreaBlock } : {}),
    ...(testimonials.length ? { testimonials } : {}),
    ...(faqs.length ? { faqs } : {})
  };
}

/* =========================
   Builders
========================= */

function buildMenu(toggles, sections) {
  const items = [{ label: "Home", path: "#home" }];

  const renderable = {
    about: Boolean(toggles?.show_about && sections?.about),
    features: Boolean(toggles?.show_features && Array.isArray(sections?.features) && sections.features.length),
    events: false,
    process: Boolean(toggles?.show_process && Array.isArray(sections?.processSteps) && sections.processSteps.length >= 3),
    testimonials: Boolean(toggles?.show_testimonials && Array.isArray(sections?.testimonials) && sections.testimonials.length),
    comparison: false,
    gallery: Boolean(toggles?.show_gallery && sections?.gallery && Array.isArray(sections.gallery.items) && sections.gallery.items.length),
    investment: false,
    faqs: Boolean(toggles?.show_faqs && Array.isArray(sections?.faqs) && sections.faqs.length),
    serviceArea: Boolean(toggles?.show_service_area && sections?.service_area && cleanString(sections.service_area.main_city))
  };

  if (renderable.about) items.push({ label: "About", path: "#about" });
  if (renderable.features) items.push({ label: "Services", path: "#features" });
  if (renderable.process) items.push({ label: "Process", path: "#process" });
  if (renderable.testimonials) items.push({ label: "Reviews", path: "#testimonials" });
  if (renderable.gallery) items.push({ label: "Gallery", path: "#gallery" });
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

  const items = trustSignals
    .map(function(label, idx) {
      const publicLabel = normalizeTrustbarLabel(label);
      if (!publicLabel) return null;
      return {
        label: normalizePublicText(publicLabel),
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

function buildProcessSteps(state) {
  const steps = normalizeProcessStepSource(state.answers?.process_notes);
  if (steps.length < 3) return [];

  return steps.slice(0, 5).map(function(step, idx) {
    return {
      title: normalizePublicText(inferProcessStepTitle(step, idx)),
      description: normalizePublicText(cleanSentence(step))
    };
  });
}

function normalizeProcessStepSource(input) {
  let steps = cleanList(input);

  if (steps.length === 1) {
    const expanded = splitProcessStepText(steps[0]);
    if (expanded.length > 1) steps = expanded;
  }

  return uniqueList(steps)
    .map(function(step) { return normalizePublicText(step); })
    .filter(function(step) {
      return step.split(/\s+/).filter(Boolean).length >= 2;
    });
}

function splitProcessStepText(text) {
  return cleanString(text)
    .split(/\n|->|→|;|\.|, then | then /gi)
    .map(function(step) { return normalizePublicText(step); })
    .filter(Boolean);
}

function inferProcessStepTitle(step, idx) {
  const text = cleanString(step).toLowerCase();
  if (!text) return `Step ${idx + 1}`;

  const patterns = [
    { match: ["quote", "request"], title: "Request a Quote" },
    { match: ["review", "needs"], title: "Review Your Needs" },
    { match: ["schedule"], title: "Schedule the Service" },
    { match: ["confirm"], title: "Confirm the Details" },
    { match: ["walkthrough"], title: "Final Walkthrough" },
    { match: ["satisfaction"], title: "Final Review" }
  ];

  for (const pattern of patterns) {
    if (pattern.match.every(function(token) { return text.includes(token); })) {
      return pattern.title;
    }
  }

  return normalizeShortTitle(step, idx);
}

function buildFeatures(state) {
  const ghostFeatures = normalizeGhostFeatures(state.ghostwritten?.features_copy);
  if (ghostFeatures.length >= 3) {
    return ghostFeatures.slice(0, 6);
  }

  const offerings = cleanList(state.answers?.offerings);
  const differentiators = cleanList(state.answers?.differentiators);
  const audience = audienceToCustomerPhrase(cleanString(state.answers?.target_audience)) || "customers";

  const raw = [];

  offerings.forEach(function(item, idx) {
    raw.push({
      title: normalizePublicText(normalizeOfferTitle(item) || `Service ${idx + 1}`),
      description: normalizePublicText(`Delivered with care and attention for ${audience}.`),
      icon_slug: pickFeatureIcon(item, idx)
    });
  });

  differentiators.forEach(function(item, idx) {
    const title = normalizeDifferentiatorTitle(item);
    if (!title) return;
    raw.push({
      title: normalizePublicText(title),
      description: normalizePublicText("A meaningful reason clients choose this business."),
      icon_slug: pickFeatureIcon(title, idx + raw.length)
    });
  });

  const deduped = uniqueObjectsByTitle(raw).slice(0, 6);

  while (deduped.length < 3) {
    deduped.push({
      title: `Service Highlight ${deduped.length + 1}`,
      description: normalizePublicText("Clear, professional work designed to make the next step easy."),
      icon_slug: pickFeatureIcon("", deduped.length)
    });
  }

  return deduped;
}

function normalizeGhostFeatures(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map(function(item, idx) {
      if (typeof item === "string") {
        const title = normalizeShortTitle(item, idx);
        return {
          title: normalizePublicText(title),
          description: normalizePublicText(cleanSentence(item)),
          icon_slug: pickFeatureIcon(item, idx)
        };
      }

      if (!isObject(item)) return null;

      const title = cleanString(item.title) || normalizeShortTitle(item.description || `Feature ${idx + 1}`, idx);
      const description = cleanString(item.description) || cleanSentence(item.title || "");
      const icon = ALLOWED_ICON_TOKENS.includes(cleanString(item.icon_slug))
        ? cleanString(item.icon_slug)
        : pickFeatureIcon(title, idx);

      if (!title || !description) return null;

      return {
        title: normalizePublicText(title),
        description: normalizePublicText(description),
        icon_slug: icon
      };
    })
    .filter(Boolean);
}

function buildGallery(state, strategyContract) {
  const provided = normalizeGalleryItems(state);
  if (provided.length > 0) {
    return {
      enabled: true,
      layout: provided.length >= 4 ? "grid" : "masonry",
      computed_count: Math.max(3, Math.min(6, provided.length)),
      image_source: "search",
      items: provided.slice(0, 6)
    };
  }

  const fallbackQueries = buildFallbackGalleryQueries(state, strategyContract);
  if (!fallbackQueries.length) return null;

  const items = fallbackQueries.slice(0, 6).map(function(query, idx) {
    return {
      title: `Project ${idx + 1}`,
      image_search_query: query
    };
  });

  return {
    enabled: true,
    layout: items.length >= 4 ? "grid" : "masonry",
    computed_count: Math.max(3, Math.min(6, items.length)),
    image_source: "search",
    items
  };
}

function normalizeGalleryItems(state) {
  const explicitItems = Array.isArray(state.answers?.gallery_items) ? state.answers.gallery_items : [];
  const explicitQueries = cleanList(state.answers?.gallery_queries);

  const items = explicitItems
    .map(function(item, idx) {
      if (!isObject(item)) return null;
      const query = clampWords(cleanString(item.image_search_query), 4, 8);
      if (!query) return null;
      return {
        title: normalizePublicText(cleanString(item.title) || `Project ${idx + 1}`),
        image_search_query: query
      };
    })
    .filter(Boolean);

  if (items.length) return items;

  return explicitQueries.map(function(query, idx) {
    return {
      title: `Project ${idx + 1}`,
      image_search_query: clampWords(query, 4, 8)
    };
  });
}

function buildFallbackGalleryQueries(state, strategyContract) {
  const seeds = uniqueList([
    cleanString(state.answers?.visual_direction),
    cleanList(state.answers?.offerings)[0],
    cleanString(strategyContract.business_context?.category)
  ]).filter(Boolean);

  return seeds.map(function(seed) {
    return clampWords(seed, 4, 8);
  });
}

function buildFaqs(state, strategyContract) {
  const ghostFaqs = normalizeGhostFaqs(state.ghostwritten?.faqs);
  if (ghostFaqs.length > 0) return ghostFaqs.slice(0, 6);

  const items = uniqueList([
    ...cleanList(state.answers?.faq_topics),
    ...cleanList(state.answers?.common_objections),
    ...cleanList(strategyContract.site_structure?.faq_angles)
  ])
    .map(function(item) { return normalizeFaqQuestion(item); })
    .filter(Boolean)
    .slice(0, 6);

  return items.map(function(q) {
    return {
      question: ensureQuestion(normalizePublicText(q)),
      answer: normalizePublicText(inferFaqAnswer(q, state, strategyContract))
    };
  });
}

function normalizeGhostFaqs(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map(function(item) {
      if (!isObject(item)) return null;
      const question = ensureQuestion(cleanString(item.question));
      const answer = cleanString(item.answer);
      if (!question || !answer) return null;
      return {
        question: normalizePublicText(question),
        answer: normalizePublicText(answer)
      };
    })
    .filter(Boolean);
}

function buildTestimonials(state) {
  const provided = normalizeProvidedTestimonials(state);
  if (provided.length > 0) return provided.slice(0, 3);

  const quotes = [
    "Professional, careful, and easy to work with from start to finish.",
    "Clear communication, reliable scheduling, and a strong final result.",
    `We chose ${cleanString(state.businessName) || "this team"} because they felt trustworthy and professional from the first interaction.`
  ];

  return quotes.map(function(quote, idx) {
    return {
      quote: normalizePublicText(quote),
      author: `Happy Client ${idx + 1}`
    };
  });
}

function normalizeProvidedTestimonials(state) {
  const provided =
    Array.isArray(state.ghostwritten?.testimonials) ? state.ghostwritten.testimonials :
    Array.isArray(state.answers?.testimonials) ? state.answers.testimonials :
    [];

  return provided
    .map(function(item, idx) {
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
}

function buildServiceArea(state) {
  const mainCity =
    cleanString(state.answers?.service_area) ||
    cleanString(state.answers?.location_context) ||
    cleanString(state.answers?.office_address);

  if (!mainCity) return null;

  return {
    main_city: normalizePublicText(mainCity),
    surrounding_areas: uniqueList([
      cleanString(state.answers?.service_area),
      cleanString(state.answers?.location_context)
    ])
      .filter(function(value) { return value && value !== mainCity; })
      .map(function(value) { return normalizePublicText(value); })
  };
}

/* =========================
   Resolution / Fallbacks
========================= */

function resolveTagline(state, strategyContract, businessName) {
  return (
    cleanString(state.ghostwritten?.tagline) ||
    cleanString(state.answers?.tagline) ||
    cleanList(state.answers?.offerings)[0] ||
    cleanString(strategyContract.positioning?.brand_promise) ||
    businessName
  );
}

function resolveHeroHeadline(state, businessName) {
  return (
    cleanString(state.ghostwritten?.hero_headline) ||
    cleanString(state.answers?.hero_headline) ||
    cleanList(state.answers?.offerings)[0] ||
    businessName
  );
}

function resolveHeroSubtext(state, strategyContract) {
  return (
    cleanString(state.ghostwritten?.hero_subheadline) ||
    cleanString(state.answers?.hero_subheadline) ||
    buildSimpleHeroSubtext(state, strategyContract)
  );
}

function buildSimpleHeroSubtext(state, strategyContract) {
  const years = normalizeYearsExperience(cleanString(state.answers?.experience_years));
  const area = cleanString(state.answers?.service_area);
  const primary = cleanString(strategyContract.conversion_strategy?.primary_conversion);

  const sentenceA = [years, area ? `serving ${area}` : ""]
    .filter(Boolean)
    .join(" - ");

  const sentenceB =
    primary === "book_now" ? "Use the site to take the next step." :
    primary === "call_now" ? "Reach out directly and we’ll help you get started." :
    "Reach out and we’ll help guide you from there.";

  return [sentenceA, sentenceB].filter(Boolean).join(". ");
}

function resolveHeroImageAlt(state, businessName) {
  return (
    cleanString(state.answers?.hero_image_alt) ||
    cleanString(state.ghostwritten?.hero_image_alt) ||
    cleanList(state.answers?.offerings)[0] ||
    businessName
  );
}

function resolveAboutStory(state, businessName) {
  return (
    cleanString(state.ghostwritten?.about_summary) ||
    cleanString(state.answers?.about_story) ||
    cleanString(state.answers?.why_now) ||
    `${businessName} is built around clear communication, reliable service, and a better customer experience.`
  );
}

function resolveFounderNote(state) {
  return (
    cleanString(state.answers?.owner_background) ||
    cleanString(state.ghostwritten?.founder_note) ||
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
    cleanString(state.ghostwritten?.contact_subheadline) ||
    inferContactSubheadline(state, strategyContract)
  );
}

function resolveObjectionHandle(state) {
  const objections = cleanList(state.answers?.common_objections);
  const first = cleanString(objections[0]).toLowerCase();

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
   Lightweight Inference
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

function inferContactSubheadline(state, strategyContract) {
  const primary = cleanString(strategyContract.conversion_strategy?.primary_conversion);

  if (primary === "call_now") {
    return "Call today and we’ll help you figure out the best next step.";
  }
  if (primary === "book_now") {
    return "Ready to get started? Reach out and we’ll help you book the right next step.";
  }
  return "Tell us what you need and we’ll help you with the right next step.";
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
    if (bookingMethod === "external_booking") return "You can use the booking link on the site to choose the best next step.";
    if (bookingMethod === "phone") return "Call directly and we’ll help you schedule the right next step.";
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
  const explicit =
    cleanString(state.answers?.hero_image_query) ||
    cleanString(state.inference?.hero_image_query);

  if (explicit) return clampWords(explicit, 4, 8);

  const seeds = uniqueList([
    cleanString(state.answers?.visual_direction),
    cleanList(state.answers?.offerings)[0],
    cleanString(strategyContract.business_context?.category)
  ]).filter(Boolean);

  return clampWords(seeds.join(" "), 4, 8);
}

/* =========================
   Generic Normalization
========================= */

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

function normalizeOfferTitle(item) {
  return normalizeShortTitle(item, 0);
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

  return normalizeShortTitle(item, 0);
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

function normalizeFaqQuestion(text) {
  const value = cleanString(text).toLowerCase();
  if (!value) return "";

  if (value.includes("cost concern") || value === "cost concerns") {
    return "How does pricing work?";
  }
  if (value.includes("trustworth")) {
    return "How do I know I can trust your service?";
  }
  if (value.includes("availability")) {
    return "How far in advance should I schedule?";
  }

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
    .map(function(word, idx) {
      const lower = word.toLowerCase();
      if (idx > 0 && ["and", "of", "for", "with", "to"].includes(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function clampString(text, max) {
  const value = cleanString(text);
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max - 1).trim()}...`;
}

function canonicalFeatureKey(title) {
  const value = cleanString(title).toLowerCase();
  if (!value) return "";

  if (value.includes("quality") || value.includes("careful") || value.includes("detail")) return "quality";
  if (value.includes("schedule") || value.includes("availability") || value.includes("responsive")) return "scheduling";
  if (value.includes("trust") || value.includes("reputation")) return "trust";
  if (value.includes("quote") || value.includes("pricing")) return "pricing";
  return value;
}

function uniqueObjectsByTitle(items) {
  const seen = new Set();
  return items.filter(function(item) {
    const raw = cleanString(item?.title).toLowerCase();
    if (!raw) return false;
    const canonical = canonicalFeatureKey(raw);
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  });
}

function ensureQuestion(text) {
  const q = cleanString(text);
  if (!q) return "What should I know?";
  return /[?]$/.test(q) ? q : `${q}?`;
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
  if (value.includes("trust") || value.includes("safe") || value.includes("reputation")) return "shield";
  if (value.includes("quality") || value.includes("award") || value.includes("detail")) return "award";
  if (value.includes("price") || value.includes("value") || value.includes("quote")) return "coins";
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
  if (value.includes("review")) return "star";
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

  if (!cleanString(data?.intelligence?.industry)) issues.push("intelligence.industry is required");
  if (!cleanString(data?.intelligence?.target_persona)) issues.push("intelligence.target_persona is required");
  if (!cleanString(data?.intelligence?.tone_of_voice)) issues.push("intelligence.tone_of_voice is required");

  if (!isObject(data?.strategy)) issues.push("strategy is required");

  if (!cleanString(data?.settings?.vibe)) issues.push("settings.vibe is required");
  if (!SCHEMA_VIBES.includes(cleanString(data?.settings?.vibe))) {
    issues.push("settings.vibe must be a valid schema vibe");
  }

  if (!Array.isArray(data?.settings?.menu) || data.settings.menu.length === 0) {
    issues.push("settings.menu must be a non-empty array");
  } else {
    data.settings.menu.forEach(function(item, idx) {
      if (!cleanString(item?.label)) issues.push(`settings.menu[${idx}].label is required`);
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

  if (!cleanString(data?.settings?.cta_text)) issues.push("settings.cta_text is required");
  if (!cleanString(data?.settings?.cta_link)) issues.push("settings.cta_link is required");
  if (!["anchor", "external"].includes(cleanString(data?.settings?.cta_type))) {
    issues.push("settings.cta_type must be anchor or external");
  }

  if (!cleanString(data?.brand?.name)) issues.push("brand.name is required");
  if (!cleanString(data?.brand?.slug)) issues.push("brand.slug is required");
  if (!cleanString(data?.brand?.tagline)) issues.push("brand.tagline is required");
  if (!cleanString(data?.brand?.email)) issues.push("brand.email is required");

  if (!cleanString(data?.hero?.headline)) issues.push("hero.headline is required");
  if (!cleanString(data?.hero?.subtext)) issues.push("hero.subtext is required");
  if (!cleanString(data?.hero?.image?.alt)) issues.push("hero.image.alt is required");
  if (!cleanString(data?.hero?.image?.image_search_query)) {
    issues.push("hero.image.image_search_query is required");
  }

  if (!cleanString(data?.about?.story_text)) issues.push("about.story_text is required");
  if (!cleanString(data?.about?.founder_note)) issues.push("about.founder_note is required");
  if (!cleanString(data?.about?.years_experience)) issues.push("about.years_experience is required");

  if (!Array.isArray(data?.features) || data.features.length < 3) {
    issues.push("features must contain at least 3 items");
  } else {
    data.features.forEach(function(item, idx) {
      if (!cleanString(item?.title)) issues.push(`features[${idx}].title is required`);
      if (!cleanString(item?.description)) issues.push(`features[${idx}].description is required`);
      if (!cleanString(item?.icon_slug)) {
        issues.push(`features[${idx}].icon_slug is required`);
      } else if (!ALLOWED_ICON_TOKENS.includes(cleanString(item.icon_slug))) {
        issues.push(`features[${idx}].icon_slug must be a valid icon token`);
      }
    });
  }

  if (!cleanString(data?.contact?.headline)) issues.push("contact.headline is required");
  if (!cleanString(data?.contact?.subheadline)) issues.push("contact.subheadline is required");
  if (!cleanString(data?.contact?.email_recipient)) issues.push("contact.email_recipient is required");
  if (!cleanString(data?.contact?.button_text)) issues.push("contact.button_text is required");

  if (data?.trustbar) {
    if (typeof data.trustbar.enabled !== "boolean") {
      issues.push("trustbar.enabled must be boolean");
    }
    if (!Array.isArray(data.trustbar.items) || data.trustbar.items.length < 2) {
      issues.push("trustbar.items must contain at least 2 items when trustbar is present");
    }
  }

  if (data?.strategy?.show_process) {
    if (!Array.isArray(data?.processSteps) || data.processSteps.length < 3) {
      issues.push("processSteps[] required with at least 3 items when strategy.show_process is true");
    } else {
      data.processSteps.forEach(function(item, idx) {
        if (!cleanString(item?.title)) issues.push(`processSteps[${idx}].title is required`);
        if (!cleanString(item?.description)) issues.push(`processSteps[${idx}].description is required`);
      });
    }
  }

  if (data?.strategy?.show_gallery) {
    if (!isObject(data?.gallery)) {
      issues.push("gallery is required when strategy.show_gallery is true");
    } else if (!Array.isArray(data.gallery.items) || data.gallery.items.length === 0) {
      issues.push("gallery.items are required when strategy.show_gallery is true");
    }
  }

  if (data?.strategy?.show_testimonials && (!Array.isArray(data?.testimonials) || data.testimonials.length === 0)) {
    issues.push("testimonials[] required when strategy.show_testimonials is true");
  }

  if (data?.strategy?.show_faqs && (!Array.isArray(data?.faqs) || data.faqs.length === 0)) {
    issues.push("faqs[] required when strategy.show_faqs is true");
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
  const hasOffer = Array.isArray(state.answers?.offerings) && state.answers.offerings.length > 0;
  const hasCta = cleanString(state.answers?.primary_conversion_goal);
  const hasContactPath = Boolean(
    cleanString(state.clientEmail) ||
    cleanString(state.answers?.phone) ||
    cleanString(state.answers?.booking_url)
  );

  const hasBuyerIntel =
    (state.answers?.buyer_decision_factors?.length > 0) ||
    (state.answers?.common_objections?.length > 0);

  const queueComplete = state.verification?.queue_complete === true;

  const diff = Array.isArray(state.answers?.differentiators) ? state.answers.differentiators.length : 0;
  const trust = Array.isArray(state.answers?.trust_signals) ? state.answers.trust_signals.length : 0;
  const cred = Array.isArray(state.answers?.credibility_factors) ? state.answers.credibility_factors.length : 0;
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
    hero_headline: "",
    hero_subheadline: "",
    hero_image_alt: "",
    hero_image_query: "",
    tagline: "",
    about_story: "",
    contact_subheadline: "",
    gallery_queries: [],
    gallery_items: [],
    testimonials: [],
    ...(isObject(next.answers) ? next.answers : {})
  };

  next.ghostwritten = {
    tagline: "",
    hero_headline: "",
    hero_subheadline: "",
    hero_image_alt: "",
    about_summary: "",
    founder_note: "",
    contact_subheadline: "",
    features_copy: [],
    faqs: [],
    testimonials: [],
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
  next.answers.gallery_queries = cleanList(next.answers.gallery_queries);
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
  if (!words.length) return "professional service detail work";

  const sliced = words.slice(0, maxWords);
  while (sliced.length < minWords) sliced.push("detail");
  return sliced.join(" ");
}