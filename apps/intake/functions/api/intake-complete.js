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
    show_process: false,
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
  const processSteps = undefined;
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
    ...cleanList(state.answers?.credibility_factors)
  ]).slice(0, 4);

  const items = trustSignals.length
    ? trustSignals.map(function(item) {
        return {
          icon: inferTrustbarIcon(item),
          label: item,
          sublabel: ""
        };
      })
    : [
        { icon: "award", label: "Trusted quality" },
        { icon: "shield", label: "Confidence and care" },
        { icon: "clock", label: "Fast response" }
      ];

  return {
    enabled: true,
    headline: "Why People Choose Us",
    items
  };
}

function buildFeatures(state, strategyContract) {
  const offerings = cleanList(state.answers?.offerings);
  const differentiators = uniqueList(state.answers?.differentiators);
  const buyerFactors = uniqueList(state.answers?.buyer_decision_factors);
  const trustSignals = uniqueList([
    ...cleanList(state.answers?.trust_signals),
    ...cleanList(state.answers?.credibility_factors)
  ]);
  const ghostFeatures = Array.isArray(state.ghostwritten?.features_copy)
    ? state.ghostwritten.features_copy.filter(isObject)
    : [];

  if (ghostFeatures.length) {
    const ghostItems = ghostFeatures
      .map(function(item) {
        const title = cleanString(item.title || item.headline || item.name);
        const description = cleanString(item.description || item.body || item.copy);
        if (!title || !description) return null;
        return {
          title,
          description,
          icon_slug: inferFeatureIcon(`${title} ${description}`)
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    if (ghostItems.length >= 3) return ghostItems;
  }

  if (offerings.length >= 3) {
    return offerings.slice(0, 6).map(function(offer, idx) {
      const diff = differentiators[idx] || differentiators[0] || "";
      const factor = buyerFactors[idx] || buyerFactors[0] || "";
      const support = diff || factor;

      return {
        title: offer,
        description: support
          ? buildFeatureDescription(offer, support)
          : `${offer} delivered with clarity, professionalism, and a smooth customer experience.`,
        icon_slug: inferFeatureIcon(`${offer} ${support}`)
      };
    });
  }

  if (differentiators.length >= 3) {
    return differentiators.slice(0, 6).map(function(item) {
      return {
        title: toFeatureTitle(item),
        description: buildValuePropDescription(item, buyerFactors[0]),
        icon_slug: inferFeatureIcon(item)
      };
    });
  }

  const fallback = uniqueList([
    offerings[0] || "",
    differentiators[0] || "",
    trustSignals[0] || ""
  ]).filter(Boolean);

  if (fallback.length >= 3) {
    return fallback.slice(0, 3).map(function(item) {
      return {
        title: toFeatureTitle(item),
        description: buildValuePropDescription(item, buyerFactors[0]),
        icon_slug: inferFeatureIcon(item)
      };
    });
  }

  return [
    {
      title: offerings[0] || "Core Service",
      description: offerings[0]
        ? `${offerings[0]} presented clearly so visitors immediately understand the main offer.`
        : "A clear primary offer designed to help visitors quickly understand what the business provides.",
      icon_slug: inferFeatureIcon(offerings[0] || "core service")
    },
    {
      title: toFeatureTitle(differentiators[0] || trustSignals[0] || "Trusted Experience"),
      description: differentiators[0] || trustSignals[0]
        ? buildValuePropDescription(differentiators[0] || trustSignals[0], buyerFactors[0])
        : "Positioned to reduce hesitation and help customers feel confident taking the next step.",
      icon_slug: inferFeatureIcon(differentiators[0] || trustSignals[0] || "trusted experience")
    },
    {
      title: bookingFeatureTitle(state),
      description: bookingFeatureDescription(state),
      icon_slug: inferFeatureIcon("booking contact easy next step")
    }
  ];
}

function buildGallery(state, strategyContract) {
  const profile = inferGalleryProfile(state, strategyContract);
  const baseQueries = buildGalleryQuerySeeds(state, strategyContract, profile);
  const count = pickGalleryCount(profile);
  const computedLayout = pickGalleryLayout(profile);
  const title = pickGalleryTitle(profile);
  const showTitles = pickGalleryShowTitles(profile);

  const items = [];
  for (let i = 0; i < count; i++) {
    const seed =
      baseQueries[i % baseQueries.length] ||
      buildHeroImageQuery(state, strategyContract) ||
      "professional service business";
    items.push({
      title: makeGalleryItemTitle(seed, i, profile),
      image_search_query: clampWords(seed, 3, 8),
      caption: "",
      tag: showTitles ? makeGalleryTag(profile, i) : ""
    });
  }

  return {
    enabled: true,
    title,
    layout: null,
    show_titles: showTitles,
    image_source: {
      provider: cleanString(strategyContract.asset_policy?.preview_asset_mode) || "preview",
      image_search_query: clampWords(
        baseQueries[0] || buildHeroImageQuery(state, strategyContract),
        3,
        8
      ),
      filename_pattern: "",
      target_folder: ""
    },
    computed_count: count,
    computed_layout: computedLayout,
    items
  };
}

function buildTestimonials(state, strategyContract) {
  const trustSignals = uniqueList([
    ...cleanList(state.answers?.trust_signals),
    ...cleanList(state.answers?.credibility_factors)
  ]);

  const items = trustSignals.length
    ? trustSignals.slice(0, 4).map(function(item) {
        return {
          quote: item,
          author: "Customer Trust Signal",
          role: "Preview Proof"
        };
      })
    : [
        {
          quote: "Trust-focused preview copy can be replaced with verified reviews later.",
          author: "Preview Note",
          role: "Factory Preview"
        }
      ];

  return items;
}

function buildFaqs(state, strategyContract) {
  const explicitFaqs = Array.isArray(state.ghostwritten?.faqs)
    ? state.ghostwritten.faqs.filter(isObject)
    : [];

  if (explicitFaqs.length) {
    return explicitFaqs
      .filter(function(item) {
        return cleanString(item.question);
      })
      .slice(0, 6)
      .map(function(item) {
        return {
          question: cleanString(item.question),
          answer:
            cleanString(item.answer) ||
            inferFaqAnswer(item.question, state, strategyContract)
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
      answer: inferFaqAnswer(topic, state, strategyContract)
    };
  });
}

function buildServiceArea(state, strategyContract) {
  const mainCity = cleanString(state.answers?.service_area) ||
    cleanString(strategyContract.business_context?.service_area?.[0]);

  return {
    main_city: mainCity,
    surrounding_cities: [],
    travel_note: "",
    cta_text: cleanString(strategyContract.conversion_strategy?.cta_text) || "Get Started",
    cta_link: cleanString(state.answers?.booking_url) || "#contact",
    map_search_query: mainCity
  };
}

/* =========================
   Inference
========================= */

function resolveSchemaVibe(vibe) {
  return SCHEMA_VIBES.includes(vibe) ? vibe : "Modern Minimal";
}

function inferHeroHeadline(state, strategyContract) {
  const offer = cleanList(state.answers?.offerings)[0];
  const area = cleanString(state.answers?.service_area);

  if (offer && area) return `${offer} in ${area}`;
  if (offer) return offer;

  return cleanString(state.businessName) || "Trusted Local Business";
}

function inferHeroSubtext(state, strategyContract) {
  const audience =
    cleanString(state.answers?.target_audience) ||
    cleanString(strategyContract.audience_model?.primary_persona);

  const primary =
    cleanString(strategyContract.conversion_strategy?.primary_conversion);

  if (audience && primary === "book_now") {
    return `Built to help ${audience.toLowerCase()} feel confident booking the right experience.`;
  }

  if (audience) {
    return `Built to help ${audience.toLowerCase()} take the next step with confidence.`;
  }

  return "A premium experience built around your needs.";
}

function buildHeroImageQuery(state, strategyContract) {
  const parts = uniqueList([
    cleanString(strategyContract.business_context?.category),
    cleanString(state.answers?.service_area),
    cleanList(state.answers?.offerings)[0],
    cleanString(strategyContract.visual_strategy?.recommended_vibe)
  ]).filter(Boolean);

  return clampWords(parts.join(" "), 4, 8);
}

function inferHeroImageAlt(state, strategyContract) {
  const category = cleanString(strategyContract.business_context?.category) || "service business";
  return `${category} hero image`;
}

function inferAboutStory(state, strategyContract) {
  const businessName = cleanString(state.businessName);
  const offer = cleanList(state.answers?.offerings)[0];
  const area = cleanString(state.answers?.service_area);
  const trustSignals = uniqueList([
    ...cleanList(state.answers?.trust_signals),
    ...cleanList(state.answers?.credibility_factors)
  ]);

  const trustLine = trustSignals.length
    ? `The site emphasizes ${trustSignals.slice(0, 2).join(" and ").toLowerCase()}.`
    : "The site is designed to build trust quickly.";

  return [
    businessName ? `${businessName} is` : "This business is",
    offer ? `focused on ${offer.toLowerCase()}` : "focused on delivering a strong customer experience",
    area ? `in ${area}.` : ".",
    trustLine
  ].join(" ").replace(/\s+/g, " ").trim();
}

function inferFounderNote(state, strategyContract) {
  const custom = cleanString(state.ghostwritten?.about_summary);
  if (custom) {
    return "This preview copy can be refined and approved before final publish.";
  }
  return "Crafted with care and clarity to help visitors trust what they see.";
}

function inferYearsExperience(state, strategyContract) {
  return "10+";
}

function inferContactSubheadline(state, strategyContract) {
  const bookingUrl = cleanString(state.answers?.booking_url);
  if (bookingUrl) {
    return "Use the booking link or reach out directly with any questions.";
  }
  return "Tell us what you need and we’ll respond quickly.";
}

function inferContactButtonText(strategyContract, bookingUrl) {
  if (bookingUrl) return "Book Now";
  return "Send Message";
}

function inferSecondaryCtaText(strategyContract) {
  const secondary = cleanString(strategyContract.conversion_strategy?.secondary_conversion).toLowerCase();

  if (secondary.includes("inquiry")) return "Send an Inquiry";
  if (secondary.includes("call")) return "Call Today";
  return "Learn More";
}

function inferSecondaryCtaLink(phone, bookingUrl) {
  if (bookingUrl) return "#contact";
  if (phone) return "#contact";
  return "#about";
}

function inferBrandTagline(state, strategyContract) {
  const category = cleanString(strategyContract.business_context?.category);
  const audience = cleanString(state.answers?.target_audience);

  if (category && audience) {
    return `${category} built for trust and clear action.`;
  }

  return "Built for quality and trust.";
}

function inferObjectionHandle(state, strategyContract) {
  const objections = cleanList(state.answers?.common_objections);
  return objections[0] || "";
}

function inferFeatureIcon(offer) {
  const lower = cleanString(offer).toLowerCase();

  if (/tour|experience|trip|travel|local|area|destination/.test(lower)) return "map";
  if (/sunset|outdoor|nature|water|boat/.test(lower)) return "sun";
  if (/photo|gallery|visual|detail|clean|polish|shine/.test(lower)) return "sparkles";
  if (/family|group|team|crew/.test(lower)) return "users";
  if (/book|booking|schedule|appointment|time/.test(lower)) return "clock";
  if (/price|cost|quote|estimate|value/.test(lower)) return "coins";
  if (/call|contact|phone/.test(lower)) return "phone";
  if (/safe|safety|secure|insured|protection/.test(lower)) return "shield";
  if (/repair|fix|service|maintenance/.test(lower)) return "wrench";
  if (/build|construction|install/.test(lower)) return "hammer";
  if (/haul|delivery|transport|move|pickup/.test(lower)) return "truck";
  if (/garden|landscape|lawn|yard|green/.test(lower)) return "leaf";
  if (/premium|quality|best|high-end|luxury/.test(lower)) return "award";
  if (/simple|easy|included|done/.test(lower)) return "check";
  if (/business|commercial|professional|office/.test(lower)) return "briefcase";
  if (/fast|quick|rapid|same day/.test(lower)) return "zap";

  return "star";
}

function inferTrustbarIcon(item) {
  const lower = cleanString(item).toLowerCase();

  if (/safety|certification|certified|secure|insured|protected/.test(lower)) return "shield";
  if (/review|testimonial|customer|people|family|group/.test(lower)) return "users";
  if (/partnership|local|area|community|nearby/.test(lower)) return "map";
  if (/photo|gallery|visual|detail|clean|shine/.test(lower)) return "sparkles";
  if (/fast|quick|same day|responsive/.test(lower)) return "clock";
  if (/quality|premium|trusted|proven/.test(lower)) return "award";
  if (/phone|call|contact/.test(lower)) return "phone";

  return "check";
}

function inferFaqAnswer(question, state, strategyContract) {
  const q = cleanString(question).toLowerCase();
  const bookingUrl = cleanString(state.answers?.booking_url);
  const pricing = cleanString(state.answers?.pricing_context);
  const serviceArea = cleanString(state.answers?.service_area);

  if (q.includes("bring")) {
    return "We can refine this answer later, but the preview should reassure visitors about what to expect before they book.";
  }

  if (q.includes("how long")) {
    return "Tour duration can be clarified in final polish once exact package details are confirmed.";
  }

  if (q.includes("safety")) {
    return "Safety reassurance should be clearly stated so visitors feel confident taking the next step.";
  }

  if (q.includes("price") || q.includes("pricing")) {
    return pricing || "Pricing details can be shown as exact pricing, starting prices, or package tiers.";
  }

  if (q.includes("where") || q.includes("location")) {
    return serviceArea
      ? `This business serves or operates in ${serviceArea}.`
      : "Location details can be clarified during final review.";
  }

  if (q.includes("book") || q.includes("booking")) {
    return bookingUrl
      ? "Visitors can use the booking link shown on the site to take the next step."
      : "Visitors can use the contact path on the site to take the next step.";
  }

  return "This answer can be refined during final review and approval.";
}

function buildFeatureDescription(offer, support) {
  const lower = cleanString(support).toLowerCase();

  if (!lower) {
    return `${offer} delivered with clarity, professionalism, and a smooth customer experience.`;
  }

  if (/fast|quick|same day|responsive/.test(lower)) {
    return `${offer} designed for speed, responsiveness, and an easier path to getting started.`;
  }
  if (/safe|insured|certified|secure|protection/.test(lower)) {
    return `${offer} supported by trust-building details that help customers feel confident moving forward.`;
  }
  if (/quality|premium|detail|craft|high-end/.test(lower)) {
    return `${offer} positioned around craftsmanship, quality, and a stronger overall experience.`;
  }
  if (/local|community|nearby|area/.test(lower)) {
    return `${offer} tailored for local customers who want a reliable provider in their area.`;
  }

  return `${offer} designed around ${lower}.`;
}

function buildValuePropDescription(item, buyerFactor) {
  const factor = cleanString(buyerFactor);
  const base = cleanString(item);

  if (factor) {
    return `${toFeatureTitle(base)} helps reinforce what matters most to buyers: ${factor.toLowerCase()}.`;
  }

  return `${toFeatureTitle(base)} is positioned as a meaningful reason to choose this business over generic alternatives.`;
}

function toFeatureTitle(text) {
  const value = cleanString(text);
  if (!value) return "Key Advantage";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
}

function bookingFeatureTitle(state) {
  if (cleanString(state.answers?.booking_url)) return "Easy Booking";
  if (cleanString(state.answers?.phone)) return "Direct Contact";
  return "Simple Next Step";
}

function bookingFeatureDescription(state) {
  if (cleanString(state.answers?.booking_url)) {
    return "Visitors get a clear, low-friction path to book without confusion.";
  }
  if (cleanString(state.answers?.phone)) {
    return "Visitors get a clear contact path so taking the next step feels easy and direct.";
  }
  return "The site is structured to make contacting the business feel straightforward and low-friction.";
}

function inferGalleryProfile(state, strategyContract) {
  const category = cleanString(strategyContract.business_context?.category).toLowerCase();
  const vibe = cleanString(strategyContract.visual_strategy?.recommended_vibe).toLowerCase();
  const offers = cleanList(state.answers?.offerings).join(" ").toLowerCase();
  const themes = cleanList(strategyContract.asset_policy?.preferred_image_themes).join(" ").toLowerCase();

  const text = [category, vibe, offers, themes].join(" ");

  if (/tour|experience|charter|trip|event|class|workshop/.test(text)) {
    return { archetype: "experiential", vibe, text };
  }
  if (/landscape|lawn|garden|detail|clean|cleaning|paint|roof|remodel|construction|floor|pressure wash|junk|haul/.test(text)) {
    return { archetype: "visual_service", vibe, text };
  }
  if (/product|shop|retail|boutique|store|inventory/.test(text)) {
    return { archetype: "product", vibe, text };
  }
  if (/law|legal|finance|consult|agency|advisor|accounting|healthcare|clinic|therapy/.test(text)) {
    return { archetype: "professional", vibe, text };
  }

  return { archetype: "general", vibe, text };
}

function pickGalleryCount(profile) {
  switch (profile.archetype) {
    case "visual_service": return profile.vibe.includes("luxury") ? 10 : 8;
    case "experiential": return 8;
    case "product": return 7;
    case "professional": return 5;
    default: return 6;
  }
}

function pickGalleryLayout(profile) {
  if (profile.vibe.includes("luxury")) return "bento";

  switch (profile.archetype) {
    case "visual_service": return "masonry";
    case "experiential": return "masonry";
    case "professional": return "grid";
    case "product": return "grid";
    default: return "masonry";
  }
}

function pickGalleryTitle(profile) {
  switch (profile.archetype) {
    case "visual_service": return "Our Work";
    case "experiential": return "Experiences";
    case "product": return "Products";
    case "professional": return "In Action";
    default: return "Gallery";
  }
}

function pickGalleryShowTitles(profile) {
  return profile.archetype === "experiential" || profile.archetype === "product";
}

function buildGalleryQuerySeeds(state, strategyContract, profile) {
  const category = cleanString(strategyContract.business_context?.category);
  const area = cleanString(state.answers?.service_area);
  const offers = cleanList(state.answers?.offerings);
  const themes = cleanList(strategyContract.asset_policy?.preferred_image_themes);
  const out = [];

  offers.forEach(function(offer) {
    out.push(buildImageQueryFromParts([offer, category, area]));
    out.push(buildImageQueryFromParts([offer, category]));
  });

  themes.forEach(function(theme) {
    out.push(buildImageQueryFromParts([theme, category, area]));
    out.push(buildImageQueryFromParts([theme, category]));
  });

  if (profile.archetype === "experiential") {
    out.push(buildImageQueryFromParts([offers[0] || category, "group experience", area]));
    out.push(buildImageQueryFromParts([offers[0] || category, "outdoor activity"]));
    out.push(buildImageQueryFromParts([offers[0] || category, "sunset"]));
  }

  if (profile.archetype === "visual_service") {
    out.push(buildImageQueryFromParts([offers[0] || category, "before after"]));
    out.push(buildImageQueryFromParts([offers[0] || category, "finished result"]));
    out.push(buildImageQueryFromParts([offers[0] || category, "close detail"]));
  }

  if (profile.archetype === "professional") {
    out.push(buildImageQueryFromParts([category, "client meeting"]));
    out.push(buildImageQueryFromParts([category, "professional office"]));
  }

  return uniqueList(out).filter(Boolean).slice(0, 12);
}

function buildImageQueryFromParts(parts) {
  return clampWords(
    parts
      .map(cleanString)
      .filter(Boolean)
      .join(" "),
    3,
    8
  );
}

function makeGalleryItemTitle(seed, idx, profile) {
  if (profile.archetype === "experiential") return `Experience ${idx + 1}`;
  if (profile.archetype === "product") return `Product ${idx + 1}`;
  if (profile.archetype === "visual_service") return `Project ${idx + 1}`;
  if (profile.archetype === "professional") return `Moment ${idx + 1}`;
  return `Gallery Image ${idx + 1}`;
}

function makeGalleryTag(profile, idx) {
  if (profile.archetype === "experiential") return idx % 2 === 0 ? "Experience" : "Atmosphere";
  if (profile.archetype === "product") return "Featured";
  return "";
}

function buildStrategyMemory(state, strategyContract, strategyBrief, businessJson) {
  return {
    strategy_brief: deepClone(strategyBrief),
    strategy_contract: deepClone(strategyContract),
    raw_answers: deepClone(isObject(state.answers) ? state.answers : {}),
    ghostwritten: deepClone(isObject(state.ghostwritten) ? state.ghostwritten : {}),
    future_aeo: {
      aeo_angles: cleanList(strategyContract.site_structure?.aeo_angles),
      faq_topics: uniqueList([
        ...cleanList(state.answers?.faq_topics),
        ...cleanList(state.answers?.common_objections),
        ...cleanList(strategyContract.site_structure?.faq_angles)
      ]),
      buyer_decision_factors: cleanList(state.answers?.buyer_decision_factors),
      differentiators: cleanList(state.answers?.differentiators),
      trust_signals: uniqueList([
        ...cleanList(state.answers?.trust_signals),
        ...cleanList(state.answers?.credibility_factors)
      ]),
      offerings: cleanList(state.answers?.offerings),
      service_area: cleanString(state.answers?.service_area),
      booking_url: cleanString(state.answers?.booking_url),
      phone: cleanString(state.answers?.phone),
      office_address: cleanString(state.answers?.office_address),
      target_audience: cleanString(state.answers?.target_audience),
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

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function clampWords(text, minWords, maxWords) {
  const words = cleanString(text).split(/\s+/).filter(Boolean);
  if (!words.length) return "service business professional work";
  return words.slice(0, maxWords).join(" ");
}