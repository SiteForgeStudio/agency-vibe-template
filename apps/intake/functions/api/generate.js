// functions/api/generate.js
// Cloudflare Pages Function: POST /api/generate
// Returns: { ok: true, slug, plan, business_json }

function normalizeSlug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function must(obj, keys) {
  for (const k of keys) {
    if (!obj || !(k in obj)) throw new Error(`Missing key: ${k}`);
  }
}

const ALLOWED_VIBES = [
  "Midnight Tech",
  "Zenith Earth",
  "Vintage Boutique",
  "Rugged Industrial",
  "Modern Minimal",
  "Luxury Noir",
  "Legacy Professional",
  "Solar Flare",
];

const ALLOWED_ANCHORS = [
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
  "#contact",
];

const ICON_TOKENS = [
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
  "phone",
];

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function toMenuObjects(menuMaybe) {
  // Accept either ["#home", ...] OR [{label,path},...]
  if (!Array.isArray(menuMaybe)) return [];
  if (menuMaybe.length === 0) return [];
  if (typeof menuMaybe[0] === "string") {
    const paths = menuMaybe.filter((p) => ALLOWED_ANCHORS.includes(p));
    return paths.map((p) => ({
      label: anchorToLabel(p),
      path: p,
    }));
  }
  return menuMaybe
    .filter((it) => it && typeof it === "object")
    .map((it) => ({
      label: safeString(it.label, "").trim() || anchorToLabel(it.path),
      path: ALLOWED_ANCHORS.includes(it.path) ? it.path : "#home",
    }))
    .filter((it) => it.label && it.path);
}

function anchorToLabel(anchor) {
  switch (anchor) {
    case "#home":
      return "Home";
    case "#about":
      return "About";
    case "#features":
      return "Services";
    case "#events":
      return "Events";
    case "#process":
      return "Process";
    case "#testimonials":
      return "Reviews";
    case "#comparison":
      return "Comparison";
    case "#gallery":
      return "Gallery";
    case "#investment":
      return "Investment";
    case "#faqs":
      return "FAQs";
    case "#service-area":
      return "Service Area";
    case "#contact":
      return "Contact";
    default:
      return "Home";
  }
}

function ensureHomeAndContact(menu) {
  const paths = new Set(menu.map((m) => m.path));
  const out = [...menu];

  if (!paths.has("#home")) out.unshift({ label: "Home", path: "#home" });
  if (!paths.has("#contact")) out.push({ label: "Contact", path: "#contact" });

  // De-dupe by path (keep first)
  const seen = new Set();
  return out.filter((m) => {
    if (seen.has(m.path)) return false;
    seen.add(m.path);
    return true;
  });
}

function coerceIconSlug(slug) {
  const s = String(slug || "").trim();
  if (ICON_TOKENS.includes(s)) return s;
  // If model gave lucide-ish names like "user-check", "calendar-alt", "car", etc.
  // map them to the closest token.
  const lower = s.toLowerCase();
  if (lower.includes("truck") || lower.includes("mobile")) return "truck";
  if (lower.includes("clock") || lower.includes("calendar")) return "clock";
  if (lower.includes("leaf") || lower.includes("eco")) return "leaf";
  if (lower.includes("shield") || lower.includes("protect")) return "shield";
  if (lower.includes("spark") || lower.includes("shine")) return "sparkles";
  if (lower.includes("award") || lower.includes("cert")) return "award";
  if (lower.includes("user") || lower.includes("team")) return "users";
  if (lower.includes("phone") || lower.includes("call")) return "phone";
  if (lower.includes("map") || lower.includes("area") || lower.includes("pin")) return "map";
  if (lower.includes("rocket") || lower.includes("fast")) return "rocket";
  if (lower.includes("layer")) return "layers";
  if (lower.includes("check")) return "check";
  return "layers";
}

function sanitizeHeroQuery(q) {
  // Keep it broad and avoid city names (your templates recommend no locations).
  // Also ensure 4–8-ish words by trimming and collapsing spaces.
  const raw = String(q || "").replace(/\s+/g, " ").trim();
  // Remove commas and obvious state abbreviations patterns like "Philadelphia, PA"
  const noPunct = raw.replace(/[,:;]/g, " ");
  const words = noPunct
    .split(" ")
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !/^[A-Z]{2}$/.test(w)); // remove "PA" etc

  // Keep first 8 words max
  const clipped = words.slice(0, 8);
  // Ensure minimum 4 words if possible by adding generic fallbacks
  const fallbacks = ["car", "detailing", "polishing", "driveway"];
  while (clipped.length < 4) clipped.push(fallbacks[clipped.length] || "detail");
  return clipped.join(" ");
}

async function openaiJson({ apiKey, model, messages, temperature = 0.3 }) {
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY env var");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${text}`);

  const data = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return JSON.parse(content);
}

function postProcessPlan(plan) {
  plan = plan || {};
  plan.intelligence = plan.intelligence || {};
  plan.strategy = plan.strategy || {};
  plan.settings = plan.settings || {};

  // Vibe
  if (!ALLOWED_VIBES.includes(plan.settings.vibe)) plan.settings.vibe = "Modern Minimal";

  // CTA defaults
  if (!plan.settings.cta_text) plan.settings.cta_text = "Contact Us";
  if (!plan.settings.cta_link) plan.settings.cta_link = "#contact";
  if (!plan.settings.cta_type) plan.settings.cta_type = "anchor";

  // Menu
  const menu = ensureHomeAndContact(toMenuObjects(plan.settings.menu));
  plan.settings.menu = menu;

  // Strategy defaults (booleans)
  const boolKeys = [
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
    "show_service_area",
  ];
  for (const k of boolKeys) {
    if (typeof plan.strategy[k] !== "boolean") plan.strategy[k] = false;
  }

  // Intelligence required keys
  if (!plan.intelligence.industry) plan.intelligence.industry = "Service business";
  if (!plan.intelligence.target_persona) plan.intelligence.target_persona = "Local customers";
  if (!plan.intelligence.tone_of_voice) plan.intelligence.tone_of_voice = "friendly and professional";

  return plan;
}

function postProcessBusinessJson(bj, input) {
  bj = bj || {};
  bj.intelligence = bj.intelligence || {};
  bj.strategy = bj.strategy || {};
  bj.settings = bj.settings || {};
  bj.brand = bj.brand || {};
  bj.hero = bj.hero || {};
  bj.about = bj.about || {};
  bj.contact = bj.contact || {};

  // Ensure required intelligence keys
  bj.intelligence.industry = bj.intelligence.industry || safeString(input.industry) || safeString(input.site_for) || "Service business";
  bj.intelligence.target_persona = bj.intelligence.target_persona || "Local customers";
  bj.intelligence.tone_of_voice = bj.intelligence.tone_of_voice || safeString(input.tone_hint) || "friendly and professional";

  // Settings
  if (!ALLOWED_VIBES.includes(bj.settings.vibe)) bj.settings.vibe = "Modern Minimal";
  bj.settings.cta_text = bj.settings.cta_text || "Contact Us";
  bj.settings.cta_link = bj.settings.cta_link || "#contact";
  bj.settings.cta_type = bj.settings.cta_type || "anchor";
  if (typeof bj.settings.secondary_cta_text !== "string") bj.settings.secondary_cta_text = "";
  if (typeof bj.settings.secondary_cta_link !== "string") bj.settings.secondary_cta_link = "";
  bj.settings.menu = ensureHomeAndContact(toMenuObjects(bj.settings.menu));

  // Strategy booleans
  const boolKeys = [
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
    "show_service_area",
  ];
  for (const k of boolKeys) {
    if (typeof bj.strategy[k] !== "boolean") bj.strategy[k] = false;
  }

  // Brand required keys: name, tagline, email
  const businessName = safeString(input.business_name, "").trim();
  const email = safeString(input.email, "").trim();
  const phone = safeString(input.phone, "").trim();
  const mainCity = safeString(input.main_city, "").trim();

  bj.brand.name = safeString(bj.brand.name, "").trim() || businessName || "Your Business";
  bj.brand.tagline = safeString(bj.brand.tagline, "").trim() || "Professional services made simple.";
  bj.brand.email = safeString(bj.brand.email, "").trim() || email || "hello@example.com";
  if (!bj.brand.phone && phone) bj.brand.phone = phone;
  if (!bj.brand.office_address && mainCity) bj.brand.office_address = mainCity;

  // Slug
  bj.brand.slug = normalizeSlug(bj.brand.slug || bj.brand.name || businessName || "brand");

  // Hero: headline, subtext, image{alt,image_search_query}
  bj.hero.headline = safeString(bj.hero.headline, "").trim() || `Welcome to ${bj.brand.name}`;
  bj.hero.subtext = safeString(bj.hero.subtext, "").trim() || "Clear, professional service—designed for busy customers.";
  bj.hero.image = bj.hero.image || {};
  bj.hero.image.alt = safeString(bj.hero.image.alt, "").trim() || "Professional service in action";
  bj.hero.image.image_search_query = sanitizeHeroQuery(bj.hero.image.image_search_query || `${bj.intelligence.industry} polishing driveway`);

  // About: story_text, founder_note, years_experience
  bj.about.story_text = safeString(bj.about.story_text, "").trim() || `${bj.brand.name} helps customers with ${bj.intelligence.industry.toLowerCase()} through a simple, reliable process.`;
  bj.about.founder_note = safeString(bj.about.founder_note, "").trim() || "Owner-led, detail-focused, and committed to doing it right.";
  bj.about.years_experience = safeString(bj.about.years_experience, "").trim() || "Newly launched";

  // Features array: enforce shape + icon_slug normalization
  if (!Array.isArray(bj.features)) bj.features = [];
  bj.features = bj.features
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      title: safeString(x.title, "").trim(),
      description: safeString(x.description, "").trim(),
      icon_slug: coerceIconSlug(x.icon_slug),
    }))
    .filter((x) => x.title && x.description)
    .slice(0, 8);

  // If show_features is true but empty, add 3 safe, generic features
  if (bj.strategy.show_features && bj.features.length === 0) {
    bj.features = [
      { title: "Convenient Scheduling", description: "Pick a time that fits your day with a simple booking flow.", icon_slug: "clock" },
      { title: "Careful, Professional Service", description: "We focus on details and treat your property/vehicle with care.", icon_slug: "shield" },
      { title: "Clear Communication", description: "Fast updates, transparent expectations, and an easy next step.", icon_slug: "check" },
    ];
  }

  // Contact required keys
  bj.contact.headline = safeString(bj.contact.headline, "").trim() || "Get in touch";
  bj.contact.subheadline = safeString(bj.contact.subheadline, "").trim() || "Tell us what you need and we’ll reply with the best next step.";
  bj.contact.email_recipient = safeString(bj.contact.email_recipient, "").trim() || bj.brand.email;
  bj.contact.button_text = safeString(bj.contact.button_text, "").trim() || "Contact Us";
  if (!bj.contact.email && bj.brand.email) bj.contact.email = bj.brand.email;
  if (!bj.contact.phone && bj.brand.phone) bj.contact.phone = bj.brand.phone;
  if (typeof bj.contact.office_address !== "string") bj.contact.office_address = "";

  // Optional sections used by templates (only if strategy says show + we have usable data)

  // Trustbar
  if (bj.strategy.show_trustbar) {
    if (!bj.trustbar || typeof bj.trustbar !== "object") {
      bj.trustbar = {
        enabled: true,
        headline: "A premium experience—without the hassle",
        items: [
          { icon: "sparkles", label: "Polished results", sublabel: "Clean, premium finish" },
          { icon: "clock", label: "Time-saving", sublabel: "We come to you" },
          { icon: "shield", label: "Care-first", sublabel: "Detail-oriented work" },
        ],
      };
    }
  }

  // Process
  if (bj.strategy.show_process) {
    if (!Array.isArray(bj.processSteps)) bj.processSteps = [];
    bj.processSteps = bj.processSteps
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        title: safeString(x.title, "").trim(),
        description: safeString(x.description, "").trim(),
      }))
      .filter((x) => x.title && x.description)
      .slice(0, 6);

    if (bj.processSteps.length === 0) {
      bj.processSteps = [
        { title: "Request a quote", description: "Tell us what you need and where you’re located." },
        { title: "Confirm details", description: "We’ll confirm timing, scope, and expectations." },
        { title: "We deliver the service", description: "Professional work completed on-site, with care." },
        { title: "Wrap-up", description: "Quick walkthrough and simple next steps if needed." },
      ];
    }
  }

  // FAQs
  if (bj.strategy.show_faqs) {
    if (!Array.isArray(bj.faqs)) bj.faqs = [];
    bj.faqs = bj.faqs
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        question: safeString(x.question, "").trim(),
        answer: safeString(x.answer, "").trim(),
      }))
      .filter((x) => x.question && x.answer)
      .slice(0, 8);

    if (bj.faqs.length === 0) {
      bj.faqs = [
        { question: "How do I book?", answer: "Use the contact form below and tell us what you need. We’ll confirm the next available time." },
        { question: "Do you come to my location?", answer: "Yes—this is a mobile service. Share your address and we’ll confirm coverage." },
        { question: "What do you need from me?", answer: "Just the basics: what you want done, your preferred time window, and any special notes." },
      ];
    }
  }

  // Service Area
  if (bj.strategy.show_service_area) {
    if (!bj.service_area || typeof bj.service_area !== "object") bj.service_area = {};
    if (!bj.service_area.main_city) bj.service_area.main_city = mainCity || "Our Region";
    if (!Array.isArray(bj.service_area.surrounding_cities)) bj.service_area.surrounding_cities = [];
    // Keep it non-empty if main city is known
    if (bj.service_area.surrounding_cities.length === 0 && bj.service_area.main_city && bj.service_area.main_city !== "Our Region") {
      // Safe generic nearby list (can be edited later)
      bj.service_area.surrounding_cities = ["Nearby suburbs", "Surrounding communities", "Local neighborhoods"];
    }
    if (!bj.service_area.travel_note) {
      bj.service_area.travel_note = "Outside these areas? We offer custom quotes for extended travel.";
    }
  }

  // Gallery
  if (bj.strategy.show_gallery) {
    if (!bj.gallery || typeof bj.gallery !== "object") bj.gallery = {};
    if (typeof bj.gallery.enabled !== "boolean") bj.gallery.enabled = true;
    bj.gallery.title = bj.gallery.title || "Recent work";
    if (!bj.gallery.image_source || typeof bj.gallery.image_source !== "object") {
      bj.gallery.image_source = {
        provider: "unsplash",
        image_search_query: sanitizeHeroQuery(`${bj.intelligence.industry} clean detail`),
        filename_pattern: `${bj.brand.slug}-project-{i}.jpg`,
        target_folder: "public/images",
      };
    }
    if (!Array.isArray(bj.gallery.items)) bj.gallery.items = [];
    bj.gallery.items = bj.gallery.items
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        title: safeString(x.title, "").trim(),
        caption: safeString(x.caption, "").trim(),
        tag: safeString(x.tag, "").trim(),
        image_search_query: sanitizeHeroQuery(x.image_search_query),
      }))
      .filter((x) => x.title && x.image_search_query)
      .slice(0, 12);

    if (bj.gallery.items.length === 0) {
      bj.gallery.items = [
        { title: "Before & after detail", caption: "Clean finish and refreshed look", tag: "Detailing", image_search_query: sanitizeHeroQuery("car detailing before after") },
        { title: "Interior refresh", caption: "A cleaner, more comfortable cabin", tag: "Interior", image_search_query: sanitizeHeroQuery("car interior cleaning vacuum") },
        { title: "Paint care", caption: "Polished shine with careful technique", tag: "Exterior", image_search_query: sanitizeHeroQuery("polishing car paint closeup") },
      ];
    }
  }

  // IMPORTANT: Do NOT fabricate testimonials/pricing. Only render if provided later.
  // So force these flags off unless user explicitly provided them in input.
  if (!input?.allow_testimonials) {
    bj.strategy.show_testimonials = false;
    bj.testimonials = Array.isArray(bj.testimonials) ? bj.testimonials.filter(() => false) : [];
  }
  if (!input?.allow_investment) {
    bj.strategy.show_investment = false;
    bj.investment = Array.isArray(bj.investment) ? bj.investment.filter(() => false) : [];
  }
  if (!input?.allow_comparison) {
    bj.strategy.show_comparison = false;
    bj.comparison = null;
  }
  if (!input?.allow_events) {
    bj.strategy.show_events = false;
    bj.events = Array.isArray(bj.events) ? bj.events.filter(() => false) : [];
  }

  return bj;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Use POST /api/generate" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const input = await request.json();

    const site_for = safeString(input.site_for, "");
    const business_name = safeString(input.business_name, "");
    const email = safeString(input.email, "");
    const phone = safeString(input.phone, "");
    const main_city = safeString(input.main_city, "");
    const tone_hint = safeString(input.tone_hint, "");
    const goal = safeString(input.goal, "Contact");

    // PASS A: Architect — produce plan aligned with your Master Schema
    const planRaw = await openaiJson({
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: `
You are SiteForge "Architect".
Return JSON ONLY with EXACT keys: intelligence, strategy, settings.

Must follow this contract:

intelligence (REQUIRED):
- industry (string)
- target_persona (string)
- tone_of_voice (string)

strategy (booleans, REQUIRED keys):
- show_trustbar, show_about, show_features, show_events, show_process, show_testimonials,
  show_comparison, show_gallery, show_investment, show_faqs, show_service_area

settings (REQUIRED):
- vibe must be one of: ${ALLOWED_VIBES.map((v) => `"${v}"`).join(", ")}
- cta_text (string), cta_link (string), cta_type ("anchor" or "external")
- secondary_cta_text (string), secondary_cta_link (string)
- menu: array of { label, path } where path is one of:
  ${ALLOWED_ANCHORS.join(", ")}

Rules:
- Always include #home and #contact in settings.menu.
- Prefer: show_features=true, show_about=true, show_process=true, show_faqs=true, show_service_area=true for most local services.
- Do NOT set show_testimonials=true unless user provided testimonials (assume NOT provided).
- Do NOT set show_investment=true unless user provided pricing (assume NOT provided).
- show_events must be false unless you can produce 3+ real event items (assume false).
- show_comparison should default false unless user asked for comparisons (assume false).
- show_gallery can be true (we can use safe stock/preview images).

User input:
business_name: ${JSON.stringify(business_name)}
site_for: ${JSON.stringify(site_for)}
goal: ${JSON.stringify(goal)}
tone_hint: ${JSON.stringify(tone_hint)}
main_city: ${JSON.stringify(main_city)}
email: ${JSON.stringify(email)}
phone: ${JSON.stringify(phone)}

JSON ONLY. No markdown.
          `.trim(),
        },
      ],
    });

    const plan = postProcessPlan(planRaw);
    must(plan, ["intelligence", "strategy", "settings"]);

    // PASS B: Builder — produce business_json aligned with Master Schema + templates
    const businessJsonRaw = await openaiJson({
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
      temperature: 0.25,
      messages: [
        {
          role: "user",
          content: `
You are SiteForge "Builder".
Return ONE JSON object that matches this shape (Master Schema names):

REQUIRED top-level keys:
- intelligence, strategy, settings, brand, hero, about, features, contact

OPTIONAL top-level keys (only if strategy says so):
- trustbar, processSteps, faqs, service_area, gallery

Field requirements:

intelligence:
- industry, target_persona, tone_of_voice

strategy (booleans):
- show_trustbar, show_about, show_features, show_events, show_process, show_testimonials,
  show_comparison, show_gallery, show_investment, show_faqs, show_service_area

settings:
- vibe (enum), cta_text, cta_link, cta_type ("anchor"|"external"),
  secondary_cta_text, secondary_cta_link,
  menu: [{label,path}] where path is one of:
  ${ALLOWED_ANCHORS.join(", ")}

brand:
- name, slug, tagline, email
- phone (optional), office_address (optional), objection_handle (optional)

hero:
- headline (string)
- subtext (string)
- image: { alt, image_search_query }
  image_search_query must be 4–8 words and MUST NOT include city names.

about:
- story_text, founder_note, years_experience
  Do NOT claim awards/certs/years that weren’t provided. If unknown, say "Newly launched".

features:
- 3–8 items: { title, description, icon_slug }
  icon_slug must be one of:
  ${ICON_TOKENS.join(", ")}

contact:
- headline, subheadline, email_recipient, button_text
- email/phone optional overrides

service_area (ONLY if strategy.show_service_area=true):
- main_city (string)
- surrounding_cities (array of 3–8 strings)
- travel_note optional

trustbar (ONLY if strategy.show_trustbar=true):
- enabled (boolean) + items (2–6) with icon in:
  ${ICON_TOKENS.join(", ")}

processSteps (ONLY if strategy.show_process=true):
- 3–6 items with title + description (no fake credentials/claims)

faqs (ONLY if strategy.show_faqs=true):
- 3–8 items with question + answer

gallery (ONLY if strategy.show_gallery=true):
- enabled=true
- title
- image_source: { provider:"unsplash", image_search_query, filename_pattern:"${normalizeSlug(business_name) || "brand"}-project-{i}.jpg", target_folder:"public/images" }
- items: 3–10 items { title, caption?, tag?, image_search_query }

Important:
- Use the EXACT field names above (subtext, story_text, processSteps, service_area).
- Output JSON ONLY. No markdown.

Plan (must follow):
${JSON.stringify(plan)}

Authoritative facts from user:
business_name: ${JSON.stringify(business_name)}
email: ${JSON.stringify(email)}
phone: ${JSON.stringify(phone)}
main_city: ${JSON.stringify(main_city)}
tone_hint: ${JSON.stringify(tone_hint)}
goal: ${JSON.stringify(goal)}
site_for: ${JSON.stringify(site_for)}
          `.trim(),
        },
      ],
    });

    const business_json = postProcessBusinessJson(businessJsonRaw, {
      business_name,
      email,
      phone,
      main_city,
      tone_hint,
      goal,
      site_for,
      // Keep these false by default unless caller explicitly opts in
      allow_testimonials: false,
      allow_investment: false,
      allow_comparison: false,
      allow_events: false,
    });

    must(business_json, ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"]);

    // Final slug lock (always)
    const slug = normalizeSlug(business_json?.brand?.slug || business_json?.brand?.name || business_name || "brand");
    business_json.brand.slug = slug;

    return new Response(JSON.stringify({ ok: true, slug, plan, business_json }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
