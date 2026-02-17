// functions/api/generate.js
function normalizeSlug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function must(obj, keys) {
  for (const k of keys) if (!(k in obj)) throw new Error(`Missing key: ${k}`);
}

const ICON_ENUM = new Set([
  "zap","cpu","layers","rocket","leaf","sprout","sun","scissors","truck","hammer","wrench","trash","sparkles",
  "heart","award","users","map","shield","star","check","coins","briefcase","clock","phone"
]);

const MENU_ORDER = [
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

const LABELS = {
  "#home": "Home",
  "#about": "About",
  "#features": "Features",
  "#events": "Events",
  "#process": "Process",
  "#testimonials": "Testimonials",
  "#comparison": "Comparison",
  "#gallery": "Gallery",
  "#investment": "Investment",
  "#faqs": "FAQs",
  "#service-area": "Service Area",
  "#contact": "Contact",
};

function buildMenuFromFlags(strategy) {
  const enabled = new Set(["#home", "#contact"]);

  if (strategy.show_about) enabled.add("#about");
  if (strategy.show_features) enabled.add("#features");
  if (strategy.show_events) enabled.add("#events");
  if (strategy.show_process) enabled.add("#process");
  if (strategy.show_testimonials) enabled.add("#testimonials");
  if (strategy.show_comparison) enabled.add("#comparison");
  if (strategy.show_gallery) enabled.add("#gallery");
  if (strategy.show_investment) enabled.add("#investment");
  if (strategy.show_faqs) enabled.add("#faqs");
  if (strategy.show_service_area) enabled.add("#service-area");

  return MENU_ORDER
    .filter((path) => enabled.has(path))
    .map((path) => ({ label: LABELS[path] || path.replace("#", ""), path }));
}

function enforceIconSlug(slug) {
  if (ICON_ENUM.has(slug)) return slug;
  // graceful fallback
  return "layers";
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const s of arr || []) {
    const key = String(s || "").trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(String(s).trim());
  }
  return out;
}

function safeStr(x, fallback = "") {
  const s = String(x ?? "").trim();
  return s || fallback;
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

    // Intake facts (authoritative)
    const site_for = safeStr(input.site_for);
    const business_name = safeStr(input.business_name);
    const email = safeStr(input.email);
    const phone = safeStr(input.phone);
    const main_city = safeStr(input.main_city);
    const goal = safeStr(input.goal, "Contact"); // e.g. Quote / Contact / Call
    const tone_hint = safeStr(input.tone_hint);

    const baseSlug = normalizeSlug(input.slug || business_name || "brand");

    // ---------------------------
    // PASS A: Architect (plan)
    // ---------------------------
    const plan = await openaiJson({
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: `
You are SiteForge "Architect".
Return JSON ONLY with keys: intelligence, strategy, settings.

MUST MATCH THIS SHAPE:

intelligence:
  industry, target_persona, tone_of_voice

strategy (booleans only):
  show_trustbar, show_about, show_features, show_events, show_process, show_testimonials,
  show_comparison, show_gallery, show_investment, show_faqs, show_service_area

settings:
  vibe (enum), cta_text, cta_link, cta_type ("anchor" or "external"),
  secondary_cta_text, secondary_cta_link
  menu (DO NOT include; server will build menu from flags)

Rules:
- vibe must be one of:
  "Midnight Tech","Zenith Earth","Vintage Boutique","Rugged Industrial","Modern Minimal","Luxury Noir","Legacy Professional","Solar Flare"
- Always assume show_features true for service businesses.
- show_events ONLY if you can later populate 3–10 events items. Otherwise false.
- show_investment ONLY if you can provide 2–4 pricing tiers WITHOUT inventing exact prices (use ranges/“Starting at” if needed).
- show_testimonials ONLY if you can write safe placeholder testimonials (clearly generic) OR you have real ones. Keep them generic.
- show_comparison ONLY if it’s genuinely helpful (e.g., mobile vs shop, DIY vs pro).
- show_gallery true for visual services (detailing, landscaping, remodeling, etc.)

User input:
site_for: ${JSON.stringify(site_for)}
business_name: ${JSON.stringify(business_name)}
goal: ${JSON.stringify(goal)}
tone_hint: ${JSON.stringify(tone_hint)}
main_city: ${JSON.stringify(main_city)}
email: ${JSON.stringify(email)}
phone: ${JSON.stringify(phone)}

Return JSON ONLY.
          `.trim(),
        },
      ],
    });

    must(plan, ["intelligence", "strategy", "settings"]);

    // We build menu ourselves so it never includes dead links
    plan.settings = plan.settings || {};
    plan.settings.menu = buildMenuFromFlags(plan.strategy || {});
    // Force required settings defaults if model omitted
    plan.settings.cta_text = safeStr(plan.settings.cta_text, goal.toLowerCase() === "quote" ? "Request a Quote" : "Contact Us");
    plan.settings.cta_link = safeStr(plan.settings.cta_link, "#contact");
    plan.settings.cta_type = plan.settings.cta_type === "external" ? "external" : "anchor";
    plan.settings.secondary_cta_text = safeStr(plan.settings.secondary_cta_text, "");
    plan.settings.secondary_cta_link = safeStr(plan.settings.secondary_cta_link, "");

    // ---------------------------
    // PASS B: Builder (business_json)
    // ---------------------------
    const business_json = await openaiJson({
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
      temperature: 0.35,
      messages: [
        {
          role: "user",
          content: `
You are SiteForge "Builder".
Return ONE JSON object.

It MUST conform to this top-level contract used by Astro:

REQUIRED top-level keys:
- intelligence, strategy, settings, brand, hero, about, features, contact

OPTIONAL keys (only include if strategy says true AND you provide the correct shape):
- trustbar, events, processSteps, testimonials, comparison, gallery, investment, faqs, service_area

STRICT SHAPES:

intelligence:
  industry, target_persona, tone_of_voice

strategy:
  show_trustbar, show_about, show_features, show_events, show_process, show_testimonials,
  show_comparison, show_gallery, show_investment, show_faqs, show_service_area

settings:
  vibe, cta_text, cta_link, cta_type, secondary_cta_text, secondary_cta_link, menu
  menu items are objects: {label, path} and paths are anchors like "#about"

brand:
  name, tagline, email (required)
  optional: slug, phone, office_address, objection_handle

hero:
  headline, subtext, image {alt, image_search_query}
  image_search_query: 4–8 words: {subject} {action} {context}
  DO NOT include city names in image_search_query.

about:
  story_text, founder_note, years_experience (strings)

features:
  3–8 items: {title, description, icon_slug}
  icon_slug MUST be one of:
  zap,cpu,layers,rocket,leaf,sprout,sun,scissors,truck,hammer,wrench,trash,sparkles,heart,award,users,map,shield,star,check,coins,briefcase,clock,phone

contact:
  headline, subheadline, email_recipient, button_text
  optional: email, phone, office_address

service_area (if included):
  main_city, surrounding_cities (array)
  optional: travel_note, cta_text, cta_link, map_search_query

processSteps (if included):
  3–5 items: {title, description}

testimonials (if included):
  3–6 items: {quote, author, role}
  Keep clearly generic if unknown (no fake businesses, no “5-star Google” claims).

comparison (if included):
  { title, items: [{label, us, them}] } 3–6 items

gallery (if included):
  { enabled: true, title, layout: null, show_titles: true, items: [{title, caption?, tag?, image_search_query}] }
  Provide 6–10 items. Each image_search_query MUST be different (vary subject/action/context).

investment (if included):
  2–4 tiers: { tier_name, price, popular?, features[] }
  If user did NOT provide exact prices, use ranges or "Starting at" safely.

faqs (if included):
  4–8 items: { question, answer }

trustbar (if included):
  { enabled: true, headline?, items: [{icon, label, sublabel?}] }
  icon MUST be one of the icon enum (or short emoji). Avoid hard claims.

Plan (follow exactly):
${JSON.stringify(plan)}

Authoritative facts:
business_name: ${JSON.stringify(business_name)}
email: ${JSON.stringify(email)}
phone: ${JSON.stringify(phone)}
main_city: ${JSON.stringify(main_city)}
goal: ${JSON.stringify(goal)}
site_for: ${JSON.stringify(site_for)}
slug: ${JSON.stringify(baseSlug)}

Return JSON ONLY. No markdown.
          `.trim(),
        },
      ],
    });

    must(business_json, ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"]);

    // ---------------------------
    // Server-side normalization to prevent dead links / missing sections
    // ---------------------------
    // Lock slug
    const slug = normalizeSlug(
      business_json?.brand?.slug || business_json?.brand?.name || business_name || baseSlug || "brand"
    );
    business_json.brand = business_json.brand || {};
    business_json.brand.slug = slug;

    // Ensure brand required fields exist
    business_json.brand.name = safeStr(business_json.brand.name, business_name || "Your Business");
    business_json.brand.tagline = safeStr(business_json.brand.tagline, `${business_json.brand.name}`);
    business_json.brand.email = safeStr(business_json.brand.email, email);

    // Ensure optional phone/address carried through
    if (phone && !business_json.brand.phone) business_json.brand.phone = phone;
    if (main_city && !business_json.brand.office_address) business_json.brand.office_address = main_city;

    // Force settings.menu built from flags (never trust model menu)
    business_json.settings = business_json.settings || {};
    business_json.strategy = business_json.strategy || {};
    business_json.settings.menu = buildMenuFromFlags(business_json.strategy);

    // Ensure CTA fields present (schema requires these)
    business_json.settings.cta_text = safeStr(business_json.settings.cta_text, plan?.settings?.cta_text || "Contact Us");
    business_json.settings.cta_link = safeStr(business_json.settings.cta_link, plan?.settings?.cta_link || "#contact");
    business_json.settings.cta_type = business_json.settings.cta_type === "external" ? "external" : "anchor";
    business_json.settings.secondary_cta_text = safeStr(business_json.settings.secondary_cta_text, "");
    business_json.settings.secondary_cta_link = safeStr(business_json.settings.secondary_cta_link, "");

    // Enforce features icon enum (prevents “car”, “user-check”, etc.)
    if (Array.isArray(business_json.features)) {
      business_json.features = business_json.features.map((f) => ({
        ...f,
        icon_slug: enforceIconSlug(f?.icon_slug),
      }));
    }

    // If show_service_area true, ensure correct service_area shape
    if (business_json.strategy.show_service_area) {
      const sa = business_json.service_area || {};
      const surrounding = uniqStrings(sa.surrounding_cities);
      business_json.service_area = {
        main_city: safeStr(sa.main_city, main_city || "Our Region"),
        surrounding_cities: surrounding.length ? surrounding : [],
        travel_note: safeStr(sa.travel_note, "Outside these areas? We offer custom quotes for extended travel."),
        cta_text: safeStr(sa.cta_text, business_json.settings.cta_text),
        cta_link: safeStr(sa.cta_link, "#contact"),
        map_search_query: safeStr(sa.map_search_query, ""),
      };
    } else {
      delete business_json.service_area;
    }

    // If show_gallery true, ensure gallery.enabled and queries are unique-ish
    if (business_json.strategy.show_gallery) {
      const g = business_json.gallery || {};
      const items = Array.isArray(g.items) ? g.items : [];
      // De-dupe identical queries/titles
      const seenQ = new Set();
      const cleaned = [];
      for (const it of items) {
        const q = safeStr(it?.image_search_query);
        const t = safeStr(it?.title, "Project");
        const key = (q + "|" + t).toLowerCase();
        if (!q) continue;
        if (seenQ.has(key)) continue;
        seenQ.add(key);
        cleaned.push({
          title: t,
          caption: safeStr(it?.caption, ""),
          tag: safeStr(it?.tag, ""),
          image_search_query: q,
        });
      }
      business_json.gallery = {
        enabled: true,
        title: safeStr(g.title, "Recent Work"),
        layout: g.layout ?? null,
        show_titles: typeof g.show_titles === "boolean" ? g.show_titles : true,
        items: cleaned,
      };
      // If model forgot items, create safe defaults based on industry
      if (business_json.gallery.items.length < 6) {
        const defaults = [
          "car detailing polishing luxury car",
          "car interior cleaning vacuum seats",
          "car wash foam rinse driveway",
          "headlight restoration before after",
          "wheel cleaning tire shine closeup",
          "paint correction polishing buffer",
          "ceramic coating application hood",
          "leather seat conditioning interior",
        ];
        const already = new Set(business_json.gallery.items.map((x) => x.image_search_query.toLowerCase()));
        for (const q of defaults) {
          if (business_json.gallery.items.length >= 8) break;
          if (already.has(q.toLowerCase())) continue;
          business_json.gallery.items.push({ title: "Detailing", caption: "", tag: "", image_search_query: q });
          already.add(q.toLowerCase());
        }
      }
    } else {
      delete business_json.gallery;
    }

    // Guard: only keep optional sections if enabled in strategy
    const optMap = [
      ["trustbar", "show_trustbar"],
      ["events", "show_events"],
      ["processSteps", "show_process"],
      ["testimonials", "show_testimonials"],
      ["comparison", "show_comparison"],
      ["investment", "show_investment"],
      ["faqs", "show_faqs"],
    ];
    for (const [key, flag] of optMap) {
      if (!business_json.strategy?.[flag]) delete business_json[key];
    }

    // Make sure contact recipient is set
    business_json.contact = business_json.contact || {};
    business_json.contact.email_recipient = safeStr(
      business_json.contact.email_recipient,
      email || business_json.brand.email || ""
    );
    // Helpful passthrough fields (your Contact schema allows these)
    if (email) business_json.contact.email = safeStr(business_json.contact.email, email);
    if (phone) business_json.contact.phone = safeStr(business_json.contact.phone, phone);
    if (main_city) business_json.contact.office_address = safeStr(business_json.contact.office_address, main_city);

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
